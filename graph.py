#!/usr/bin/env python3

# Core python modules
import sys
import os
import logging
import random
import numbers
import math

# Peripheral python modules
import argparse
from collections import Counter
from itertools import product
from pathlib import Path
from copy import copy
import json
from pkg_resources import resource_filename as get_path

# python external libraries
import numpy as np
import pandas as pd
import networkx as nx
from networkx.readwrite import json_graph as nx_json
import community    # pip install python-louvain
from sklearn.cluster import SpectralClustering
import jinja2


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)
handler.setFormatter(logging.Formatter('%(asctime)s - OI2: %(levelname)s - %(message)s', "%I:%M:%S"))
logger.addHandler(handler)


###############################################################################
            #######           Augmentation           #######
###############################################################################

def betweenness(nxgraph):
    """
    Compute and add as an attribute the betweenness of each node.

    Betweenness centrality of a node v is the sum of the fraction of all-pairs shortest paths that pass through v.

    Arguments:
        nxgraph (networkx.Graph): a networkx graph, usually the augmented_forest.
    """
    nx.set_node_attributes(nxgraph, {node: {'betweenness':betweenness} for node,betweenness in nx.betweenness_centrality(nxgraph).items()})


def louvain_clustering(nxgraph):
    """
    Compute "Louvain"/"Community" clustering on a networkx graph, and add the cluster labels as attributes on the nodes.


    Arguments:
        nxgraph (networkx.Graph): a networkx graph, usually the augmented_forest.
    """
    nx.set_node_attributes(nxgraph, {node: {'louvain_clusters':str(cluster)} for node,cluster in community.best_partition(nxgraph).items()})


def k_clique_clustering(nxgraph, k):
    """
    Compute "k-Clique" clustering on a networkx graph, and add the cluster labels as attributes on the nodes.

    See the [networkx docs](https://networkx.github.io/documentation/stable/reference/algorithms/generated/networkx.algorithms.community.kclique.k_clique_communities.html#networkx.algorithms.community.kclique.k_clique_communities)

    Arguments:
        nxgraph (networkx.Graph): a networkx graph, usually the augmented_forest.
    """

    if k < 2: logger.critical("K-Clique Clustering requires that k be an integer larger than 1."); raise ValueError("Improper input to k_clique_clustering")

    clustering = pd.Series(invert(nx.algorithms.community.kclique.k_clique_communities(nxgraph, k)), name='k_clique_clusters').astype(str).reindex(nxgraph.nodes())
    nx.set_node_attributes(nxgraph, clustering.to_frame().to_dict(orient='index'))


def spectral_clustering(nxgraph, k):
    """
    Compute "spectral" clustering on a networkx graph, and add the cluster labels as attributes on the nodes.


    Arguments:
        nxgraph (networkx.Graph): a networkx graph, usually the augmented_forest.
    """
    adj_matrix = nx.to_pandas_adjacency(nxgraph)
    clustering =  SpectralClustering(k, affinity='precomputed', n_init=100, assign_labels='discretize').fit_predict(adj_matrix.values)
    nx.set_node_attributes(nxgraph, {node: {'spectral_clusters':str(cluster)} for node,cluster in zip(adj_matrix.index, clustering)})


###############################################################################
            #######              Export             #######
###############################################################################

def get_networkx_graph_as_dataframe_of_nodes(nxgraph):
    """
    Arguments:
        nxgraph (networkx.Graph): any instance of networkx.Graph
    Returns:
        pd.DataFrame: nodes from the input graph and their attributes as a dataframe
    """

    return pd.DataFrame.from_dict(dict(nxgraph.nodes(data=True))).transpose()


def get_networkx_graph_as_dataframe_of_edges(nxgraph):
    """
    Arguments:
        nxgraph (networkx.Graph): any instance of networkx.Graph
    Returns:
        pd.DataFrame: edges from the input graph and their attributes as a dataframe
    """

    return nx.to_pandas_edgelist(nxgraph, 'protein1', 'protein2')


def output_networkx_graph_as_pickle(nxgraph, output_dir=".", filename="graph.pickle"):
    """
    Arguments:
        nxgraph (networkx.Graph): any instance of networkx.Graph
        output_dir (str): the directory in which to output the graph.
        filename (str): Filenames ending in .gz or .bz2 will be compressed.
    Returns:
        Path: the filepath which was outputted to
    """

    path = Path(output_dir)
    path.mkdir(exist_ok=True, parents=True)
    path = path / filename
    nx.write_gpickle(nxgraph, open(path, 'wb'))

    return path.absolute()


def output_networkx_graph_as_graphml_for_cytoscape(nxgraph, output_dir=".", filename="graph.graphml.gz"):
    """
    Arguments:
        nxgraph (networkx.Graph): any instance of networkx.Graph
        output_dir (str): the directory in which to output the graph.
        filename (str): Filenames ending in .gz or .bz2 will be compressed.
    Returns:
        Path: the filepath which was outputted to
    """
    path = Path(output_dir)
    path.mkdir(exist_ok=True, parents=True)
    path = path / filename
    nx.write_graphml(nxgraph, path)

    return path.absolute()


def output_networkx_graph_as_interactive_html(nxgraph, attribute_metadata=dict(), output_dir=".", filename="graph.html"):
    """
    Arguments:
        nxgraph (networkx.Graph): any instance of networkx.Graph
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    templateLoader = jinja2.FileSystemLoader(os.path.dirname(os.path.abspath(__file__)))
    templateEnv = jinja2.Environment(loader=templateLoader)

    graph_json = nx_json.node_link_data(nxgraph, attrs=dict(source='source_name', target='target_name', name='id', key='key', link='links'))
    def indexOf(node_id): return [i for (i,node) in enumerate(graph_json['nodes']) if node['id'] == node_id][0]
    graph_json["links"] = [{**link, **{"source":indexOf(link['source_name']), "target":indexOf(link['target_name'])}} for link in graph_json["links"]]
    graph_json = json.dumps(graph_json)

    # TODO comment
    max_prize = max(list(nx.get_node_attributes(nxgraph, 'prize').values()), default=0)
    max_degree = max(list(nx.get_node_attributes(nxgraph, 'degree').values()), default=0)
    max_betweenness = max(list(nx.get_node_attributes(nxgraph, 'betweenness').values()), default=0)
    # TODO cast terminal attr as string or int
    # TODO safe string every attr?

    # construct default attribute metadata
    default_attribute_metadata = {
        'prize'             : {'display': 'color_scale', 'domain': f'[0, {1e-10}, {max_prize}]', 'range': '["lightgrey", "white", "red"]'},
        'degree'            : {'display': 'color_scale', 'domain': f'[0, {max_degree}]', 'range': '["lightblue", "red"]'},
        'betweenness'       : {'display': 'color_scale', 'domain': f'[0, {max_betweenness}]', 'range': '["purple", "orange"]'},
        'terminal'          : {'display': 'color_scale', 'domain':  '[false, true]', 'range': '["grey", "orange"]'},

        'type'              : {'display': 'shape' },
        'louvain_clusters'  : {'display': 'box' },
        'location'          : {'display': 'box' },
        'general_function'  : {'display': 'color_category' },
        'specific_function' : {'display': 'color_category' },
        'general_process'   : {'display': 'box' },
        'specific_process'  : {'display': 'box' },
    }

    # TODO comment
    all_graph_attribute_keys = set(flatten([attrs.keys() for node_id, attrs in nxgraph.nodes(data=True)]))
    default_attribute_metadata = {attr: metadata for attr,metadata in default_attribute_metadata.items() if attr in all_graph_attribute_keys}
    unaccounted_for_attributes = all_graph_attribute_keys - (set(default_attribute_metadata.keys()) | set(attribute_metadata.keys()))
    inferred_attribute_metadata = {}

    for attr in unaccounted_for_attributes:
        logger.info(f'Inferring display parameters for {attr}')
        values = pd.Series(list(nx.get_node_attributes(nxgraph, attr).values())).dropna()

        if all([isinstance(value, numbers.Number) for value in values]):
            if min(values) < 0:
                inferred_attribute_metadata[attr] = {'display': 'color_scale', 'domain': f'[{min(values)},0,{max(values)}]', 'range':'["blue","white","red"]'}
            elif 0 <= min(values) < 0.1:
                inferred_attribute_metadata[attr] = {'display': 'color_scale', 'domain': f'[0,{max(values)}]', 'range':'["white","red"]'}
            else:
                inferred_attribute_metadata[attr] = {'display': 'color_scale', 'domain': f'[{min(values)},{max(values)}]', 'range':'["purple","orange"]'}

        else:
            if '_clusters' in attr:
                inferred_attribute_metadata[attr] = {'display': 'box' }
            else:
                inferred_attribute_metadata[attr] = {'display': 'color_category' }

    # TODO comment
    attribute_metadata = {**default_attribute_metadata, **inferred_attribute_metadata, **attribute_metadata}

    logger.info('Final display parameters:')
    logger.info('\n'+json.dumps(attribute_metadata, indent=4))

    # TODO cast attribute_metadata to list?

    # TODO comment
    path = Path(output_dir)
    path.mkdir(exist_ok=True, parents=True)
    path = path / filename

    html_output = templateEnv.get_template('viz.jinja').render(
            graph_json=graph_json,
            nodes=nxgraph.nodes(),
            attributes=attribute_metadata)

    path.write_text(html_output)

    return path.absolute()


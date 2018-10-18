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

import jinja2


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)
handler.setFormatter(logging.Formatter('%(asctime)s - Axial: %(levelname)s - %(message)s', "%I:%M:%S"))
logger.addHandler(handler)


###############################################################################
            #######           Volcano           #######
###############################################################################

def volcano(pandas_df, attribute_metadata=dict(), output_dir=".", filename="volcano.html"):
    pass


###############################################################################
            #######           Bar           #######
###############################################################################

def bar(pandas_df, attribute_metadata=dict(), output_dir=".", filename="bar.html"):
    pass


###############################################################################
            #######           Heatmap           #######
###############################################################################

def heatmap(pandas_df, attribute_metadata=dict(), output_dir=".", filename="heatmap.html"):
    pass


###############################################################################
            #######           Braid           #######
###############################################################################

def braid(pandas_df, attribute_metadata=dict(), output_dir=".", filename="braid.html"):
    pass


###############################################################################
            #######           Graph           #######
###############################################################################

def graph(networkx_graph, attribute_metadata=dict(), output_dir=".", filename="graph.html"):
    """
    Arguments:
        networkx_graph (networkx.Graph): any instance of networkx.Graph
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    templateLoader = jinja2.FileSystemLoader(os.path.dirname(os.path.abspath(__file__)))
    templateEnv = jinja2.Environment(loader=templateLoader)

    graph_json = nx_json.node_link_data(networkx_graph, attrs=dict(source='source_name', target='target_name', name='id', key='key', link='links'))
    def indexOf(node_id): return [i for (i,node) in enumerate(graph_json['nodes']) if node['id'] == node_id][0]
    graph_json["links"] = [{**link, **{"source":indexOf(link['source_name']), "target":indexOf(link['target_name'])}} for link in graph_json["links"]]
    graph_json = json.dumps(graph_json)

    # TODO comment
    max_prize = max(list(nx.get_node_attributes(networkx_graph, 'prize').values()), default=0)
    max_degree = max(list(nx.get_node_attributes(networkx_graph, 'degree').values()), default=0)
    max_betweenness = max(list(nx.get_node_attributes(networkx_graph, 'betweenness').values()), default=0)
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
    all_graph_attribute_keys = set(flatten([attrs.keys() for node_id, attrs in networkx_graph.nodes(data=True)]))
    default_attribute_metadata = {attr: metadata for attr,metadata in default_attribute_metadata.items() if attr in all_graph_attribute_keys}
    unaccounted_for_attributes = all_graph_attribute_keys - (set(default_attribute_metadata.keys()) | set(attribute_metadata.keys()))
    inferred_attribute_metadata = {}

    for attr in unaccounted_for_attributes:
        logger.info(f'Inferring display parameters for {attr}')
        values = pd.Series(list(nx.get_node_attributes(networkx_graph, attr).values())).dropna()

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

    html_output = templateEnv.get_template('graph.html.j2').render(
            graph_json=graph_json,
            nodes=networkx_graph.nodes(),
            attributes=attribute_metadata)

    path.write_text(html_output)

    return path.absolute()


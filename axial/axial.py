#!/usr/bin/env python3

# Core python modules
import sys
import os
from shutil import copyfile
import logging
import random
import numbers
import math

# Peripheral python modules
from pathlib import Path
# import json
import pkg_resources
import requests

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

gene_ontology = {
    'human': '/Users/alex/Documents/Axial/axial/go/human_gene_sets.js',
    'mouse': '/Users/alex/Documents/Axial/axial/go/mouse_gene_sets.js',
}

# gene_ontology = {
#     'human': pkg_resources.resource_filename('axial', 'go/human_gene_sets.js'),
#     'mouse': pkg_resources.resource_filename('axial', 'go/mouse_gene_sets.js'),
# }

CDN_url = 'https://unpkg.com/axialjs@0.0.2/'

third_party_scripts = [
    "https://code.jquery.com/jquery-3.2.1.slim.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js",
    "https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js",

    "https://d3js.org/d3.v5.min.js",
    "https://d3js.org/d3-selection-multi.v1.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js",

    "https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.2/awesomplete.js",
    "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js",
]


# "/bar.js"
# "/util.js"
# "/reorder.js"
# "/braid.js"
# "/heatmap.js"


templateEnv = jinja2.Environment(loader=jinja2.FileSystemLoader( "/Users/alex/Documents/Axial/axial/templates" ))

# templateEnv = jinja2.Environment(loader=jinja2.PackageLoader('axial', 'templates'))



###############################################################################
##   Private Helper Methods


def _scripts_block(scripts, mode, output_dir):

    if mode == "directory":

        (output_dir / "scripts").mkdir(exist_ok=True, parents=True)

        for script in scripts:
            (output_dir / "scripts" / script.rsplit('/', 1)[1]).write_text(requests.get(script).text)

        script_block = '\n'.join([f"<script type='text/javascript' src='scripts/{script.rsplit('/', 1)[1]}'></script>" for script in scripts])

    elif mode == "CDN":

        script_block = '\n'.join([f"<script type='text/javascript' src='{script}'></script>" for script in scripts])

    elif mode == "inline":

        script_block = '\n'.join([f"<script type='text/javascript'>{requests.get(script).text}</script>" for script in scripts])

    else: raise ValueError('scripts_mode must be one of ["CDN", "directory", "inline"]')

    return script_block



###############################################################################
##   Public  Methods

def volcano(differential_df, title='Volcano Plot', scripts_mode="CDN", data_mode="directory",
            organism="human", q_value_column_name="q", log2FC_column_name="logFC",
            output_dir=".", filename="volcano.html"):
    """
    Arguments:
        differential_df (pandas.DataFrame): a dataframe indexed by gene symbols which must have columns named log2FC and qval.
        scripts_mode (str): Choose from ["CDN", "directory", "inline"]:
                "CDN" compiles a single HTML page with links to scripts hosted on a CDN,
                "directory" compiles a directory with all scripts locally cached,
                "inline" compiles a single HTML file with all scripts/styles inlined.
        data_mode (str): Choose from ["directory", "inline"]:
                "directory" compiles a directory with all data locally cached,
                "inline" compiles a single HTML file with all data inlined.
        organism (str): "human" or "mouse"
        attribute_metadata (dict):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    df = differential_df[[q_value_column_name, log2FC_column_name]]
    df.columns = ['q', 'logFC']
    # make sure all q values are positive
    # make sure it looks like the -log transform has been taken.
    # make sure the logFCs sum to zero, are all less than 5ish

    json = f"var differential = {df.to_json(orient='index')};"

    if data_mode == "directory":

        (output_dir / "data").mkdir(exist_ok=True, parents=True)
        (output_dir / "data" / "differential.js").write_text(json)
        copyfile(gene_ontology[organism], output_dir / "data" / f"{organism}_gene_sets.js")

        data_block = f"""
        <script type='text/javascript' src='data/differential.js'></script>
        """

    elif data_mode == "inline":

        data_block = f"""
        <script type='text/javascript'>{json}</script>
        """

    else: raise ValueError('data_mode must be one of ["directory", "inline"]')


    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/volcano.js", CDN_url+"js/GOrilla.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('volcano.html.j2').render(title=title, scripts_block=scripts_block+data_block, organism="HOMO_SAPIENS")

    (output_dir / filename).write_text(html)


    return output_dir.absolute()




def bar(differential_df, page_title='Bar Plot', compilation="CDN", organism="human", output_dir=".", filename="bar.html"):
    """
    Arguments:
        differential_df (pandas.DataFrame): a dataframe indexed by gene symbols which must have columns named log2FC and qval.
        scripts_mode (str): Choose from ["CDN", "directory", "inline"]:
                "CDN" compiles a single HTML page with links to scripts hosted on a CDN,
                "directory" compiles a directory with all scripts locally cached,
                "inline" compiles a single HTML file with all scripts/styles inlined.
        data_mode (str): Choose from ["directory", "inline"]:
                "directory" compiles a directory with all data locally cached,
                "inline" compiles a single HTML file with all data inlined.
        organism (str): "human" or "mouse"
        attribute_metadata (dict):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    df = differential_df[[q_value_column_name, log2FC_column_name]]
    df.columns = ['q', 'logFC']
    # make sure all q values are positive
    # make sure it looks like the -log transform has been taken.
    # make sure the logFCs sum to zero, are all less than 5ish

    json = f"var differential = {df.to_json(orient='columns')};"

    if data_mode == "directory":

        (output_dir / "data").mkdir(exist_ok=True, parents=True)
        (output_dir / "data" / "differential.js").write_text(json)
        copyfile(gene_ontology[organism], output_dir / "data" / f"{organism}_gene_sets.js")

        data_block = f"""
        <script type='text/javascript' src='data/differential.js'></script>
        <script type='text/javascript' src='data/{organism}_gene_sets.js'></script>
        """

    elif data_mode == "inline":

        data_block = f"""
        <script type='text/javascript'>{json}</script>
        <script type='text/javascript'>{Path(gene_ontology[organism]).read_text()}</script>
        """

    else: raise ValueError('data_mode must be one of ["directory", "inline"]')


    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/volcano.js", CDN_url+"js/GOrilla.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('volcano.html.j2').render(title=title, scripts_block=scripts_block+data_block)

    (output_dir / filename).write_text(html)


    return output_dir.absolute()



def braid(samples_by_genes_matrix, sample_classes, page_title='Braid Plot', compilation="CDN", organism="human", output_dir=".", filename="braid.html"):
    """
    Arguments:
        samples_by_genes_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_classes (pandas.DataFrame): dataframe indexed by samples, columns are attributes (e.g. classes)
        scripts_mode (str): Choose from ["CDN", "directory", "inline"]:
                "CDN" compiles a single HTML page with links to scripts hosted on a CDN,
                "directory" compiles a directory with all scripts locally cached,
                "inline" compiles a single HTML file with all scripts/styles inlined.
        data_mode (str): Choose from ["directory", "inline"]:
                "directory" compiles a directory with all data locally cached,
                "inline" compiles a single HTML file with all data inlined.
        organism (str): "human" or "mouse"
        attribute_metadata (dict):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    path = Path(output_dir)
    path.mkdir(exist_ok=True, parents=True)
    path = path / filename

    html_output = templateEnv.get_template('braid.html.j2').render(
            graph_json=graph_json,
            nodes=networkx_graph.nodes(),
            attributes=attribute_metadata)

    path.write_text(html_output)

    return path.absolute()


def heatmap(samples_by_genes_matrix, sample_classes, page_title='Heatmap', compilation="CDN", organism="human", output_dir=".", filename="heatmap.html"):
    """
    Arguments:
        samples_by_genes_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_classes (pandas.DataFrame): dataframe indexed by samples, columns are attributes (e.g. classes)
        scripts_mode (str): Choose from ["CDN", "directory", "inline"]:
                "CDN" compiles a single HTML page with links to scripts hosted on a CDN,
                "directory" compiles a directory with all scripts locally cached,
                "inline" compiles a single HTML file with all scripts/styles inlined.
        data_mode (str): Choose from ["directory", "inline"]:
                "directory" compiles a directory with all data locally cached,
                "inline" compiles a single HTML file with all data inlined.
        organism (str): "human" or "mouse"
        attribute_metadata (dict):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
    Returns:
        Path: the filepath which was outputted to
    """

    path = Path(output_dir)
    path.mkdir(exist_ok=True, parents=True)
    path = path / filename

    html_output = templateEnv.get_template('heatmap.html.j2').render(
            graph_json=graph_json,
            nodes=networkx_graph.nodes(),
            attributes=attribute_metadata)

    path.write_text(html_output)

    return path.absolute()





def graph(networkx_graph, page_title='Graph Visualization', compilation="CDN", attribute_metadata=dict(), output_dir=".", filename="graph.html"):
    """
    Arguments:
        networkx_graph (networkx.Graph): any instance of networkx.Graph
        scripts_mode (str): Choose from ["CDN", "directory", "inline"]:
                "CDN" compiles a single HTML page with links to scripts hosted on a CDN,
                "directory" compiles a directory with all scripts locally cached,
                "inline" compiles a single HTML file with all scripts/styles inlined.
        data_mode (str): Choose from ["directory", "inline"]:
                "directory" compiles a directory with all data locally cached,
                "inline" compiles a single HTML file with all data inlined.
        organism (str): "human" or "mouse"
        attribute_metadata (dict):
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


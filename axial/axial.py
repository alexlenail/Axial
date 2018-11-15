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

    "https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.3/awesomplete.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js",
]


templateEnv = jinja2.Environment(loader=jinja2.FileSystemLoader( "/Users/alex/Documents/Axial/axial/templates" ))

# templateEnv = jinja2.Environment(loader=jinja2.PackageLoader('axial', 'templates'))



###############################################################################
##   Private Helper Methods


def _scripts_block(scripts, mode, output_dir):
    """
    """
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


def _data_block(mode, names_and_jsons, include_gene_sets=True, organism="human"):
    """
    """
    data_block = []

    if mode == "directory":

        (output_dir / "data").mkdir(exist_ok=True, parents=True)

        for name, json in names_and_jsons:
            (output_dir / "data" / f"{name}.js").write_text(json)
            data_block.append(f"<script type='text/javascript' src='data/{name}.js'></script>")

        if include_gene_sets:
            copyfile(gene_ontology[organism], output_dir / "data" / "gene_sets.js")
            data_block.append(f"<script type='text/javascript' src='data/gene_sets.js'></script>")

    elif mode == "inline":

        for name, json in names_and_jsons:
            data_block.append(f"<script type='text/javascript'>{json}</script>")

        if include_gene_sets:
            data_block.append(f"<script type='text/javascript'>{Path(gene_ontology[organism]).read_text()}</script>")


    else: raise ValueError('data_mode must be one of ["directory", "inline"]')

    data_block = '\n'.join(data_block)+'\n'
    return data_block



def _verify_differential_df(df):
    """
    """
    # make sure all q values are positive
    # make sure it looks like the -log transform has been taken.
    # make sure the logFCs sum to zero, are all less than 5ish

    pass


def _verify_sample_by_genes_matrix(df):
    """
    """

    pass



def _verify_sample_attributes(matrix, attributes):
    """
    """

    pass


###############################################################################
##   Public  Methods

def volcano(differential_df, title='Axial Volcano Plot', scripts_mode="CDN", data_mode="directory",
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
    _verify_differential_df(df)

    json = f"var differential = {df.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('differential', json)], include_gene_sets=False, organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/volcano.js", CDN_url+"js/GOrilla.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('volcano.html.j2').render(title=title, scripts_block=scripts_block+data_block, organism="HOMO_SAPIENS")

    (output_dir / filename).write_text(html)


    return (output_dir / filename).absolute()




def bar(differential_df, title='Axial Pathway Bar Plot', scripts_mode="CDN", data_mode="directory",
        organism="human", q_value_column_name="q", log2FC_column_name="logFC",
        output_dir=".", filename="bar.html"):
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
    _verify_differential_df(df)

    json = f"var differential = {df.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('differential', json)], organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/bar.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('bar.html.j2').render(title=title, scripts_block=scripts_block+data_block)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).absolute()



def braid(genes_by_samples_matrix, sample_attributes, title='Axial Braid Plot', scripts_mode="CDN", data_mode="directory",
          organism="human", output_dir=".", filename="braid.html"):
    """
    Arguments:
        genes_by_samples_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_attributes (pandas.DataFrame): dataframe indexed by samples, columns are sample attributes (e.g. classes)
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

    _verify_sample_by_genes_matrix(genes_by_samples_matrix)
    _verify_sample_attributes(genes_by_samples_matrix, sample_attributes)

    matrix = f"var matrix = {genes_by_samples_matrix.to_json(orient='columns')};"
    classes = f"var classes = {sample_attributes.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('matrix', matrix), ('classes', classes)], organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/util.js", CDN_url+"js/reorder.js", CDN_url+"js/braid.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('braid.html.j2').render(title=title, scripts_block=scripts_block+data_block)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).absolute()


def heatmap(genes_by_samples_matrix, sample_attributes, title='Axial Heatmap', scripts_mode="CDN", data_mode="directory",
            organism="human", separate_zscore_by=["system"],
            output_dir=".", filename="heatmap.html"):
    """
    Arguments:
        genes_by_samples_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_attributes (pandas.DataFrame): dataframe indexed by samples, columns are sample attributes (e.g. classes)
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

    _verify_sample_by_genes_matrix(genes_by_samples_matrix)
    _verify_sample_attributes(genes_by_samples_matrix, sample_attributes)

    matrix = f"var matrix = {genes_by_samples_matrix.to_json(orient='columns')};"
    classes = f"var classes = {sample_attributes.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('matrix', matrix), ('classes', classes)], organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url+"js/util.js", CDN_url+"js/reorder.js", CDN_url+"js/heatmap.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('heatmap.html.j2').render(title=title, scripts_block=scripts_block+data_block, separate_zscore_by=separate_zscore_by)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).absolute()




def graph(networkx_graph, title='Axial Graph Visualization', scripts_mode="CDN", data_mode="directory",
          attribute_metadata=dict(), output_dir=".", filename="graph.html"):
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

    graph_json = nx_json.node_link_data(networkx_graph, attrs=dict(source='source_name', target='target_name', name='id', key='key', link='links'))
    def indexOf(node_id): return [i for (i,node) in enumerate(graph_json['nodes']) if node['id'] == node_id][0]
    graph_json["links"] = [{**link, **{"source":indexOf(link['source_name']), "target":indexOf(link['target_name'])}} for link in graph_json["links"]]
    graph_json = json.dumps(graph_json)


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

    html_output = templateEnv.get_template('graph.html.j2').render(graph_json=graph_json, nodes=networkx_graph.nodes(), attributes=attribute_metadata)

    path.write_text(html_output)

    return path.absolute()


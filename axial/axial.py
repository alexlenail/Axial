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
import json
import pkg_resources
import requests

# python external libraries
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

this_version = pkg_resources.get_distribution('axial').version

gene_ontology = {
    'human': pkg_resources.resource_filename('axial', 'go/human_gene_sets.js'),
    'mouse': pkg_resources.resource_filename('axial', 'go/mouse_gene_sets.js'),
}

def CDN_url(version): return f'https://unpkg.com/axialjs@{version}/'

third_party_scripts = [
    "https://code.jquery.com/jquery-3.2.1.slim.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js",
    "https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js",

    "https://d3js.org/d3.v5.min.js",
    "https://d3js.org/d3-selection-multi.v1.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js",

    "https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.3/awesomplete.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js",
    "https://unpkg.com/clone@2.1.2/clone.js",
]

templateEnv = jinja2.Environment(loader=jinja2.PackageLoader('axial', 'templates'))


###############################################################################
##   Private Helper Methods


def _scripts_block(scripts, mode, output_dir):
    """
    """
    if mode == "directory":

        (output_dir / "scripts").mkdir(exist_ok=True, parents=True)

        for script in scripts:
            (output_dir / "scripts" / script.rsplit('/', 1)[1]).write_text(requests.get(script).text)

        script_block = '\n'.join([f"<script src='scripts/{script.rsplit('/', 1)[1]}'></script>" for script in scripts])

    elif mode == "CDN":

        script_block = '\n'.join([f"<script src='{script}'></script>" for script in scripts])

    elif mode == "inline":

        script_block = '\n'.join([f"<script>{requests.get(script).text}</script>" for script in scripts])

    else: raise ValueError('scripts_mode must be one of ["CDN", "directory", "inline"]')

    return script_block


def _data_block(mode, names_and_jsons, output_dir, include_gene_sets=True, organism="human"):
    """
    """
    data_block = []

    if mode == "directory":

        (output_dir / "data").mkdir(exist_ok=True, parents=True)

        for name, json in names_and_jsons:
            (output_dir / "data" / f"{name}.js").write_text(json)
            data_block.append(f"<script src='data/{name}.js'></script>")

        if include_gene_sets:
            copyfile(gene_ontology[organism], output_dir / "data" / "gene_sets.js")
            data_block.append(f"<script src='data/gene_sets.js'></script>")

    elif mode == "inline":

        for name, json in names_and_jsons:
            data_block.append(f"<script>{json}</script>")

        if include_gene_sets:
            data_block.append(f"<script>{Path(gene_ontology[organism]).read_text()}</script>")


    else: raise ValueError('data_mode must be one of ["directory", "inline"]')

    data_block = '\n'.join(data_block)
    return data_block



def _verify_differential_df(df):
    """
    """
    if any(df.q < 0): logger.critical('Negative q-values not allowed')
    assert all(df.q >= 0)
    if all(df.q < 1): logger.critical('Q-values must be -log\'d -- raw q-values not accepted')
    assert any(df.q > 1)
    if any(abs(df.logFC) > 10): logger.info('some logFC exceed 10 -- please make sure log transform was appropriately taken.')


def _verify_sample_by_genes_matrix(df):
    """
    """
    if any([df[col].dtype.kind not in 'bifc' for col in df.columns]): logger.critical('All values in sample by genes matrix must be numeric')
    assert all([df[col].dtype.kind in 'bifc' for col in df.columns])

    if len(df.index) < len(df.columns): logger.warning('Genes must be on the index, not in the columns')
    assert len(df.index) > len(df.columns)


def _verify_sample_attributes(matrix, attributes):
    """
    """
    if set(matrix.columns.tolist()) != set(attributes.index.tolist()):
        logger.warning('Given sample metadata does not perfectly overlap with given sample data:')
        logger.warning('Samples with data: ', matrix.columns.tolist())
        logger.warning('Samples with metadata: ', attributes.index.tolist())

    assert len(set(matrix.columns.tolist()) & set(attributes.index.tolist())) > 0


def _flatten(list_of_lists): return [item for sublist in list_of_lists for item in sublist]

def _sanitize(string): return string  ## TODO

def _quote(string): return '\"'+string+'\"'

###############################################################################
##   Public  Methods

def volcano(differential_dfs, title='Axial Volcano Plot', scripts_mode="CDN", data_mode="directory",
            organism="human", q_value_column_name="q", log2FC_column_name="logFC",
            output_dir=".", filename="volcano.html", version=this_version):
    """
    Arguments:
        differential_dfs (dict or pandas.DataFrame): python dict of names to pandas dataframes, or a single dataframe, indexed by gene symbols which must have columns named log2FC and qval.
        title (str): The title of the plot (to be embedded in the html).
        scripts_mode (str): Choose from [`"CDN"`, `"directory"`, `"inline"`]:

            - `"CDN"` compiles a single HTML page with links to scripts hosted on a CDN,

            - `"directory"` compiles a directory with all scripts locally cached,

            - `"inline"` compiles a single HTML file with all scripts/styles inlined.

        data_mode (str): Choose from ["directory", "inline"]:

            - "directory" compiles a directory with all data locally cached,

            - "inline" compiles a single HTML file with all data inlined.

        organism (str): `"human"` or `"mouse"`
        q_value_column_name (str):
        log2FC_column_name (str):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
        version (str): the version of the javascripts to use.
            Leave the default to pin the version, or choose "latest" to get updates,
            or choose part of the version string to get minor updates.
    Returns:
        Path: The filepath which the html was outputted to.
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    if isinstance(differential_dfs, pd.DataFrame):
        differential_dfs = {'differential': differential_dfs}

    for name, df in differential_dfs.items():
        df = df[[q_value_column_name, log2FC_column_name]]
        df.columns = ['q', 'logFC']
        df = df.round(2)
        # TODO drop all zero rows
        _verify_differential_df(df)

        del differential_dfs[name]
        differential_dfs[_sanitize(name)] = df

    names_and_differentials = f"var names_and_differentials = { '{'+ ','.join([_quote(name)+': '+df.to_json(orient='index') for name, df in differential_dfs.items()]) +'}' };"

    data_block = _data_block(data_mode, [('names_and_differentials', names_and_differentials)], output_dir, include_gene_sets=False, organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url(version)+"js/util.js", CDN_url(version)+"js/GOrilla.js", CDN_url(version)+"js/volcano.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('volcano.html.j2').render(title=title, scripts_block=scripts_block+'\n'+data_block, organism="HOMO_SAPIENS")

    (output_dir / filename).write_text(html)


    return (output_dir / filename).resolve()



def bar(differential_dfs, title='Axial Pathway Bar Plot', scripts_mode="CDN", data_mode="directory",
        organism="human", q_value_column_name="q", log2FC_column_name="logFC",
        output_dir=".", filename="bar.html", version=this_version):
    """
    Arguments:
        differential_dfs (dict or pandas.DataFrame): python dict of names to pandas dataframes, or a single dataframe, indexed by gene symbols which must have columns named log2FC and qval.
        title (str): The title of the plot (to be embedded in the html).
        scripts_mode (str): Choose from [`"CDN"`, `"directory"`, `"inline"`]:

            - `"CDN"` compiles a single HTML page with links to scripts hosted on a CDN,

            - `"directory"` compiles a directory with all scripts locally cached,

            - `"inline"` compiles a single HTML file with all scripts/styles inlined.

        data_mode (str): Choose from ["directory", "inline"]:

            - "directory" compiles a directory with all data locally cached,

            - "inline" compiles a single HTML file with all data inlined.

        organism (str): `"human"` or `"mouse"`
        q_value_column_name (str):
        log2FC_column_name (str):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
        version (str): the version of the javascripts to use.
            Leave the default to pin the version, or choose "latest" to get updates,
            or choose part of the version string to get minor updates.
    Returns:
        Path: The filepath which the html was outputted to.
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    if isinstance(differential_dfs, pd.DataFrame):
        differential_dfs = {'differential': differential_dfs}

    for name, df in differential_dfs.items():
        df = df[[q_value_column_name, log2FC_column_name]]
        df.columns = ['q', 'logFC']
        df = df.round(2)
        # TODO drop all zero rows
        _verify_differential_df(df)

        del differential_dfs[name]
        differential_dfs[_sanitize(name)] = df

    names_and_differentials = f"var names_and_differentials = { '{'+ ','.join([_quote(name)+': '+df.to_json(orient='index') for name, df in differential_dfs.items()]) +'}' };"

    data_block = _data_block(data_mode, [('names_and_differentials', names_and_differentials)], output_dir, organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [ CDN_url(version)+"js/util.js", CDN_url(version)+"js/bar.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('bar.html.j2').render(title=title, scripts_block=scripts_block+'\n'+data_block)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).resolve()



def braid(genes_by_samples_matrix, sample_attributes, title='Axial Braid Plot', scripts_mode="CDN", data_mode="directory",
          organism="human", output_dir=".", filename="braid.html", version=this_version):
    """
    Arguments:
        genes_by_samples_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_attributes (pandas.DataFrame): dataframe indexed by samples, columns are sample attributes (e.g. classes)
        title (str): The title of the plot (to be embedded in the html).
        scripts_mode (str): Choose from [`"CDN"`, `"directory"`, `"inline"`]:

            - `"CDN"` compiles a single HTML page with links to scripts hosted on a CDN,

            - `"directory"` compiles a directory with all scripts locally cached,

            - `"inline"` compiles a single HTML file with all scripts/styles inlined.

        data_mode (str): Choose from ["directory", "inline"]:

            - "directory" compiles a directory with all data locally cached,

            - "inline" compiles a single HTML file with all data inlined.

        organism (str): `"human"` or `"mouse"`
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
        version (str): the version of the javascripts to use.
            Leave the default to pin the version, or choose "latest" to get updates,
            or choose part of the version string to get minor updates.
    Returns:
        Path: The filepath which the html was outputted to.
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    _verify_sample_by_genes_matrix(genes_by_samples_matrix)
    _verify_sample_attributes(genes_by_samples_matrix, sample_attributes)
    genes_by_samples_matrix = genes_by_samples_matrix.round(2)
    # TODO drop all zero rows

    matrix = f"var matrix = {genes_by_samples_matrix.to_json(orient='columns')};"
    classes = f"var classes = {sample_attributes.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('matrix', matrix), ('classes', classes)], output_dir, organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url(version)+"js/util.js", CDN_url(version)+"js/reorder.js", CDN_url(version)+"js/braid.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('braid.html.j2').render(title=title, scripts_block=scripts_block+'\n'+data_block)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).resolve()


def heatmap(genes_by_samples_matrix, sample_attributes, title='Axial Heatmap', scripts_mode="CDN", data_mode="directory",
            organism="human", separate_zscore_by=["system"],
            output_dir=".", filename="heatmap.html", version=this_version):
    """
    Arguments:
        genes_by_samples_matrix (pandas.DataFrame): dataframe indexed by genes, columns are samples
        sample_attributes (pandas.DataFrame): dataframe indexed by samples, columns are sample attributes (e.g. classes)
        title (str): The title of the plot (to be embedded in the html).
        scripts_mode (str): Choose from [`"CDN"`, `"directory"`, `"inline"`]:

            - `"CDN"` compiles a single HTML page with links to scripts hosted on a CDN,

            - `"directory"` compiles a directory with all scripts locally cached,

            - `"inline"` compiles a single HTML file with all scripts/styles inlined.

        data_mode (str): Choose from ["directory", "inline"]:

            - "directory" compiles a directory with all data locally cached,

            - "inline" compiles a single HTML file with all data inlined.

        organism (str): `"human"` or `"mouse"`
        separate_zscore_by (list):
        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
        version (str): the version of the javascripts to use.
            Leave the default to pin the version, or choose "latest" to get updates,
            or choose part of the version string to get minor updates.
    Returns:
        Path: The filepath which the html was outputted to.
    """


    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Data   =======================

    _verify_sample_by_genes_matrix(genes_by_samples_matrix)
    _verify_sample_attributes(genes_by_samples_matrix, sample_attributes)
    genes_by_samples_matrix = genes_by_samples_matrix.round(2)
    # TODO drop all zero rows

    matrix = f"var matrix = {genes_by_samples_matrix.to_json(orient='columns')};"
    classes = f"var classes = {sample_attributes.to_json(orient='index')};"

    data_block = _data_block(data_mode, [('matrix', matrix), ('classes', classes)], output_dir, organism=organism)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url(version)+"js/util.js", CDN_url(version)+"js/reorder.js", CDN_url(version)+"js/heatmap.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)


    html = templateEnv.get_template('heatmap.html.j2').render(title=title, scripts_block=scripts_block+'\n'+data_block, separate_zscore_by=separate_zscore_by)

    (output_dir / filename).write_text(html)


    return (output_dir / filename).resolve()




def graph(networkx_graph, title='Axial Graph Visualization', scripts_mode="CDN", data_mode="directory",
          output_dir=".", filename="graph.html", version=this_version):
    """
    Arguments:
        networkx_graph (networkx.Graph): any instance of networkx.Graph
        title (str): The title of the plot (to be embedded in the html).
        scripts_mode (str): Choose from [`"CDN"`, `"directory"`, `"inline"`]:

            - `"CDN"` compiles a single HTML page with links to scripts hosted on a CDN,

            - `"directory"` compiles a directory with all scripts locally cached,

            - `"inline"` compiles a single HTML file with all scripts/styles inlined.

        data_mode (str): Choose from ["directory", "inline"]:

            - "directory" compiles a directory with all data locally cached,

            - "inline" compiles a single HTML file with all data inlined.

        output_dir (str): the directory in which to output the file
        filename (str): the filename of the output file
        version (str): the version of the javascripts to use.
            Leave the default to pin the version, or choose "latest" to get updates,
            or choose part of the version string to get minor updates.
    Returns:
        Path: The filepath which the html was outputted to.
    """

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Scripts =======================

    scripts = third_party_scripts + [CDN_url(version)+"js/cola.min.js", CDN_url(version)+"js/graph.js"]

    scripts_block = _scripts_block(scripts, scripts_mode, output_dir)

    # Data    =======================

    graph_json = nx_json.node_link_data(networkx_graph)

    for node in graph_json['nodes']:
        for attr, val in node.items():
            if isinstance(val, numbers.Number):
                node[attr] = round(val, 2)
    for link in graph_json['links']:
        for attr, val in link.items():
            if isinstance(val, numbers.Number):
                link[attr] = round(val, 2)

    graph_json = f"var graph = {json.dumps(graph_json)};"

    data_block = _data_block(data_mode, [('graph', graph_json)], output_dir)

    html = templateEnv.get_template('graph.html.j2').render(title=title, scripts_block=scripts_block+'\n'+data_block, nodes=networkx_graph.nodes())

    (output_dir / filename).write_text(html)

    return (output_dir / filename).resolve()


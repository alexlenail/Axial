# Axial

### Interactive Visualizations for High Dimensional Genomics Data

## Motivation

In order to understand latent structures in biological data, design machine learning algorithms to search for those structures, and debug those models' outputs,
we need to be able to _see_ our data. Visualization tools can help.

The framework the [fraenkel lab](http://fraenkel.mit.edu/) uses today to visualize our today is jupyter notebook calls to matplotlib or seaborn.
Needing to write code to generate each visualization independently interrupts a user's ability to focus on what matters: the data.

This library provides an interface to generate interactive plots commonly used in genomics.
Once the data is loaded into the plot template, the configuration takes place in the browser, via the UI (rather than code).


## Organization

This repo is divided into three parts:

- `axialjs` includes javascript closures for each visualization type.
- `axial` is a python package which compiles jinja templates with your data into html pages which contain `axialjs` visualizations of your data.
- `axialR` is an R package which compiles jinja templates with your data into html pages which contain `axialjs` visualizations of your data (unstarted).

The python and javascript portions are ready for users.

## Axial.js

#### [Docs](http://alexlenail.me/Axial/index.html)

#### CDN

The javascript library is available at the [UNPKG](https://unpkg.com/axialjs@0.0.2/) CDN for inclusion in your projects:
```
https://unpkg.com/axialjs@0.0.2/css/axial.css

https://unpkg.com/axialjs@0.0.2/js/GOrilla.js
https://unpkg.com/axialjs@0.0.2/js/volcano.js (depends on GOrilla.js)
https://unpkg.com/axialjs@0.0.2/js/bar.js

https://unpkg.com/axialjs@0.0.2/js/util.js
https://unpkg.com/axialjs@0.0.2/js/reorder.js
https://unpkg.com/axialjs@0.0.2/js/braid.js (depends on util.js, reorder.js)
https://unpkg.com/axialjs@0.0.2/js/heatmap.js (depends on util.js, reorder.js)

https://unpkg.com/axialjs@0.0.2/js/cola.min.js
https://unpkg.com/axialjs@0.0.2/js/graph.js (depends on cola.min.js)
```

All axialjs visualizations depend on

```
<script type="tesxt/javascript" src="https://d3js.org/d3.v5.min.js"></script>
<script type="text/javascript" src="https://d3js.org/d3-selection-multi.v1.min.js"></script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js"></script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js"></script>
```


## Axial.py

#### [Docs](http://alexlenail.me/Axial/html/index.html)

#### Installation

```
pip install axial
```


## Axial.R

Unstarted.


## Develop

```
python -m http.server
```

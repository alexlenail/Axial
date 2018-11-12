# Axial: Interactive Visualizations for High Dimensional Data

## Motivation



## Organization

This repo is divided into three parts:

- A javascript library named `axialjs` includes closures for each
- A python library named `axial` compiles jinja templates with your data into html pages with visualizations provided by `axialjs`.
- An R library named `axial` compiles jinja templates with your data into html pages with visualizations provided by `axialjs`. (unstarted)


### Axialjs

#### [Docs](http://alexlenail.me/Axial/index.html)

#### CDN

The javascript library is available at the [UNPKG](https://unpkg.com/axialjs@0.0.2/) CDN for inclusion in your projects:
- `https://unpkg.com/axialjs@0.0.2/css/axial.css`

- `https://unpkg.com/axialjs@0.0.2/js/util.js`

- `https://unpkg.com/axialjs@0.0.2/js/GOrilla.js`
- `https://unpkg.com/axialjs@0.0.2/js/volcano.js` (depends on GOrilla.js)
- `https://unpkg.com/axialjs@0.0.2/js/bar.js`

- `https://unpkg.com/axialjs@0.0.2/js/reorder.js`
- `https://unpkg.com/axialjs@0.0.2/js/braid.js` (depends on util.js, reorder.js)
- `https://unpkg.com/axialjs@0.0.2/js/heatmap.js` (depends on util.js, reorder.js)

Everything depends on

```
    <script type="text/javascript" src="https://d3js.org/d3.v5.min.js"></script>
    <script type="text/javascript" src="https://d3js.org/d3-selection-multi.v1.min.js"></script>
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/d3-legend/2.25.6/d3-legend.min.js"></script>

    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.2/awesomplete.js"></script>
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore-min.js"></script>
```


### Axialpy

#### [Docs](http://alexlenail.me/Axial/html/index.html)

#### Installation

```
pip install axial
```


### AxialR

Unstarted.


## Develop

```
python -m http.server
```

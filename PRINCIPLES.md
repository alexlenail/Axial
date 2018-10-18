# Principles

1. **Every Conceivable Feature**

Axial should provide rich interactivity. (Just about) Every single gesture (click, drag, ...) on every part of the figure should be mapped to some manipulation of that figure.
Further, Axial plots should be highly configurable -- all common visualization permuataions should be reachable, and have frontend UI components devoted to producing them.

2. **Unique Figures**

Axial should *not* be a general purpose visualization library.
Axial should provide only those figure types which are under-supported by other libraries (e.g. seaborn, plotly, ggplot), especially those pertaining to high-dimensional data, *especially* those pertaining to few examples in high dimensions.

3. **HTML & SVG**

Axial should provide users with HTML which allows them to configure their plot and export SVG or high-res rasters, but also just push the HTML to the web. Axial should have an option to compile a figure to a single HTML document to support the latter use case.

4. **Aesthetic**

Axial should strive to provide publication-ready figures which can credibly be described as both data visualization and data art.

5. **Speed**

A user should never wait longer than 1s for a figure to render or update. As much as possible, plots should update at >30fps.


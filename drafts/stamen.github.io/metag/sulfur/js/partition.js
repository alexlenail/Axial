function Partition(config) {
  var margin = config.margin || {top: 280, right: 0, bottom: 0, left: 0};
  var cell_size = config.cellsize || 17;
  var cell_width = config.cellwidth || cell_size;
  var width = config.width || 264,
      height = config.height || config.data.length * cell_size;

  var dispatch = d3.dispatch("click", "hover", "mouseout");

  var usingClassicPhyloColors = colorScheme === 'classic';
  var magmaColor = d3.scaleSequential(d3.interpolateMagma)
    .domain([14,-1]);

  var color = function (cell) {
    if (usingClassicPhyloColors) {
      var cellColor,
        name,
        index = 0,
        ancestors = cell.ancestors();

      if (!cell.data.name) {
        cellColor = phyloColors.root;
      }

      while (!cellColor) {
        name = ancestors[index].data.name;
        cellColor = phyloColors[name];
        if (++index >= ancestors.length && !cellColor) {
          cellColor = 'grey';
        }
      }
      return cellColor;
    } else {
      return magmaColor(cell.depth);
    }
  }

  var partition = d3.partition()
      .size([height, 8*cell_width])
      .padding(1)

  var svg = d3.select(config.container).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(2," + (margin.top-1) + ")");

  var data = config.data.slice(0).map(function(d) {
    d.taxonomy = d.taxonomy.split(",").reverse().map(function(d) { return d.trim(); });
    return d;
  });

  var root = d3.hierarchy(burrow(data))
    .sum(function(d) { return d.children.length > 0 ? 0 : 1; })

  partition(root);
  var celldata = root.descendants();

  var cell = svg
    .selectAll(".node")
    .data(celldata, function(d) { return d.ancestors().map(function(p) { return p.data.name; }).join("") + d.data.name; })
    .enter().append("g")
      .attr("class", function(d) { return "node" + (d.children ? " node--internal" : " node--leaf"); })
      .attr("transform", function(d) {
        return "translate(" + d.y0 + "," + d.x0 + ")"
      })
      .on("click", function(d) {
        dispatch.call("click", undefined, d);
      })
      .on("mouseout", function(d) { 
        dispatch.call("mouseout");
        svg.classed("hovered", false);
        svg.selectAll(".node").classed("active", false);
      })
      .on("mouseover", function(d) { 
        highlightTaxonomy(d3.select(this), d)
        dispatch.call("hover", undefined, d.leaves());
      });

    cell
        .append("rect")
        .attr("id", function(d,i) { return "rect-" + i; })
        .attr("width", function(d) { return d.children ? d.y1 - d.y0 : 2*width; })
        .attr("height", function(d) { return d.x1 - d.x0; })
        .style("fill", function(d,i) { return d.children ? color(d): "transparent"; });

    cell.append("clipPath")
        .attr("id", function(d,i) { return "clip-" + i; })
      .append("use")
        .attr("xlink:href", function(d,i) { return "#rect-" + i + ""; });

    cell.append("g")
        .attr("clip-path", function(d,i) { return "url(#clip-" + i + ")"; })
        .append("text")
        .attr("y", function(d) { return (d.y1 - d.y0)/2 + 1; })
        .attr("transform", "rotate(270)")
        .attr("alignment-baseline", "middle")
        .attr("text-anchor", "middle")
        .attr("x", function(d) {
          return -(d.x1-d.x0)/2;
        })
        .text(function(d) { return d.data.name; })
        .text(function(d) {
          if (!d.children) return;
          return this.clientWidth > 1.2*(d.x1-d.x0) ? d.data.name.slice(0,1) : d.data.name;
        });

    cell.filter(function(d) { return d.children ? false : true; })
        .append("text")
        .attr("x", 3)
        .attr("y", (userCellSize - 8)/2)
        .attr("alignment-baseline", "hanging")
        .text(function(d) { return d.data.name; });

  function burrow(table) {
    var obj = {};
    table.forEach(function(row) {
      var layer = obj;
      var tokenized = row.taxonomy;
      tokenized.push(row.name);
      tokenized.forEach(function(key) {
        layer[key] = key in layer ? layer[key] : {};
        layer = layer[key];
      });
    });

    var descend = function(obj, depth) {
      var arr = [];
      var depth = depth || 0;
      for (var k in obj) {
        var child = {
          name: k,
          depth: depth,
          children: descend(obj[k], depth+1)
        };
        arr.push(child);
      }
      return arr;
    };

    return {
      name: config.rootLabel,
      children: descend(obj, 1),
      depth: 0
    }
  };

  function getSelectionFromLeaf(leaf) {
    return cell.filter(function(d) {
      return d.data.name == leaf;
    });
  }

  function getAncestors(leaf) {
    var selection = getSelectionFromLeaf(leaf);

    if (selection.data().length == 0) return;

    return selection.data()[0].ancestors().map(function(d) { return d.data.name });
  };

  function highlightTaxonomy(selection, d) {
    svg.classed("hovered", "true");
    svg.selectAll(".node").classed("active", false);
    selection.classed("active", true)
    var family = d.ancestors().concat(d.descendants());
    svg.selectAll(".node")
       .data(family, function(d) { return d.ancestors().map(function(p) { return p.data.name; }).join("") + d.data.name; })
       .classed("active", "true");
  }


  function highlight(leaf) {
    var selection = getSelectionFromLeaf(leaf);

    if (selection.data().length == 0) return;

    var d = selection.data()[0];

    highlightTaxonomy(selection, d)

    return d;
  };
  

  function unhighlight(frozenState) {
    svg.classed("hovered", false);
    svg.selectAll(".node").classed("active", false);
  };

  return {
    root: root,
    dispatch: dispatch,
    highlight: highlight,
    unhighlight: unhighlight,
    getAncestors: getAncestors
  };
};

function Matrix(config) {
  var cell_size = config.cellsize || 17;
  var cutoff_bars = 10;

  var fadeAlphaMatrix = {
    bluesAndOrangesOnWhite: 0.75,
    bluesAndOrangesOnBlack: 0.6,
    greensAndPurplesOnBlack: 0.6,
    greensAndPurplesOnWhite: 0.75,
    bluesAndGreensOnBlack: 0.6,
    bluesAndGreensOnWhite: 0.75,
    nightrider: 0.6,
    classic: 0.75,
    lightrider: 0.75,
  }

  var deemphasizeColorOverlay = config.background || "#000";

  var textScale = d3.scaleQuantize()
    .domain([4, 24])
    .range([5, 12])
  var textHoverScale = d3.scaleQuantize()
    .domain([4, 24])
    .range([12, 18])

  var dispatch = d3.dispatch("click", "hover", "mouseout", "hoverList");

  // copied from data files w/ hardcoded lists
  var bacterialSCG = ["alanyl tRNA synthetase","arginyl tRNA synthetase","aspartyl tRNA synthetase","gyrA","Histidyl tRNA synthetase","leucyl tRNA synthetase","Phenylalanyl tRNA synthetase alpha","Preprotein translocase subunit SecY","recA","ribosomal protein L1","ribosomal protein L10","ribosomal protein L11","ribosomal protein L13","ribosomal protein L14","ribosomal protein L15","ribosomal protein L16 L10E","ribosomal protein L17","ribosomal protein L18","ribosomal protein L19","ribosomal protein L2","ribosomal protein L20","ribosomal protein L21","ribosomal protein L22","ribosomal protein L23","ribosomal protein L24","ribosomal protein L27","ribosomal protein L29","ribosomal protein L3","ribosomal protein L30","ribosomal protein L4","ribosomal protein L5","ribosomal protein L6P L9E","ribosomal protein S10","ribosomal protein S11","ribosomal protein S12","ribosomal protein S13","ribosomal protein S15","ribosomal protein S16","ribosomal protein S17","ribosomal protein S18","ribosomal protein S19","ribosomal protein S2","ribosomal protein S20","ribosomal protein S3","ribosomal protein S4","ribosomal protein S5","ribosomal protein S6","ribosomal protein S7","ribosomal protein S8","ribosomal protein S9","Valyl tRNA synthetase"]
  var archaealSCG = ["CCA-adding enzyme","Dimethyladenosine transferase","Diphthamide biosynthesis protein","DNA-directed RNA polymerase","DNA-directed RNA polymerase subunit N","Fibrillarin-like rRNA/tRNA 2'-O-methyltransferase","Glycyl-tRNA synthetase","KH type 1 domain protein","Methionyl-tRNA synthetase","Non-canonical purine NTP pyrophosphatase","Phenylalanyl-tRNA synthetase alpha subunit","Phenylalanyl-tRNA synthetase beta subunit","Pre-mRNA processing ribonucleoprotein","Prolyl-tRNA synthetase","Protein pelota homolog","PUA domain containing protein","Ribosomal protein L10e","Ribosomal protein L13","Ribosomal protein L18e","Ribosomal protein L21e","Ribosomal protein L3","Ribosomal protein L7Ae/L8e","Ribosomal protein S13","Ribosomal protein S15","Ribosomal protein S19e","Ribosomal protein S2","Ribosomal protein S28e","Ribosomal protein S3Ae","Ribosomal protein S6e","Ribosomal protein S7","Ribosomal protein S9","Ribosome maturation protein SDO1 homolog","Signal recognition particle 54 kDa protein","Transcription elongation factor Spt5","Translation initiation factor 5A","Translation initiation factor IF-2 subunit gamma","tRNA N6-adenosine threonylcarbamoyltransferase","Valyl-tRNA synthetase"
  ]

  var columns = config.columns || d3.keys(config.data[0])
    .filter(function(d) {
      return d !== "name";
    });

  var rows = config.rows || config.data.map(function(d) { return d.name; });

  var dataLookup = {};
  config.data.forEach(function(d) {
    dataLookup[d.name] = d;
  });

  var margin = config.margin || {top: 280, right: 0, bottom: 0, left: 0};
      width = cell_size*columns.length,
      height = cell_size*rows.length;

  var alpha = d3.scaleThreshold()
    .domain([1,2,3,4,9,15,Infinity])
    .range([0,0.15,0.3,0.5,0.7,0.9,1]);

  var xscale = d3.scaleBand().range([0, width]);
  var yscale = d3.scaleBand().range([0, height]);

  var container = d3.select(config.container).append("div")
    .style("position", "relative")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  var devicePixelRatio = window.devicePixelRatio || 1;
  var canvas = container.append("canvas")
      .attr("width", (width + margin.left + margin.right) * devicePixelRatio)
      .attr("height", (height + margin.top + margin.bottom) * devicePixelRatio)
      .style("width", (width + margin.left + margin.right) + "px")
      .style("height", (height + margin.top + margin.bottom) + "px")
      .style("position", "absolute");

  var ctx = canvas.node().getContext("2d");
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(margin.left, margin.top);

  // for highlighting
  var canvas2 = container.append("canvas")
      .attr("class", "hovercanvas")
      .attr("width", (width + margin.left + margin.right) * devicePixelRatio)
      .attr("height", (height + margin.top + margin.bottom) * devicePixelRatio)
      .style("width", (width + margin.left + margin.right) + "px")
      .style("height", (height + margin.top + margin.bottom) + "px")
      .style("pointer-events", "none")
      .style("position", "absolute");

  var ctx2 = canvas2.node().getContext("2d");
  ctx2.scale(devicePixelRatio, devicePixelRatio);
  ctx2.translate(margin.left, margin.top);

  // for bar lines on frozen state
  var canvasGuidelines = container.append("canvas")
    .attr("class", "guidelineCanvas")
    .attr("width", (width + margin.left + margin.right) * devicePixelRatio)
    .attr("height", (height + margin.top + margin.bottom) * devicePixelRatio)
    .style("width", (width + margin.left + margin.right) + "px")
    .style("height", (height + margin.top + margin.bottom) + "px")
    .style("pointer-events", "none")
    .style("position", "absolute");

  var ctxGuidelines = canvasGuidelines.node().getContext("2d");
  ctxGuidelines.scale(devicePixelRatio, devicePixelRatio);
  ctxGuidelines.translate(margin.left, margin.top);


  var svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", margin.top)
      .style("position", "absolute")
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  xscale.domain(columns);
  yscale.domain(rows);

  canvas.on("click", function(){
    dispatch.call("click");
  })
    .on("mousemove", function() {
    var pos = d3.mouse(this);
    var i = Math.floor((pos[0]-margin.left-2) / cell_size);
    var j = Math.floor((pos[1]-margin.top-2) / cell_size);
    if (i < 0) return;
    if (j < 0) return;

    var list = xscale.domain()[i];
    var organism = yscale.domain()[j];
    svg.selectAll(".tick text")
      .style("opacity", 0.1)
      .style("font-size", Math.floor(textScale(config.cellsize)) + "px")
      .style("fill", function(d){
        return config.listTextColor(d);
      })
      .filter(function(d) { return d == list; })
      .style("opacity", 1)
      .style("font-size", Math.floor(textHoverScale(config.cellsize)) + "px");

    dispatch.call("hover", undefined, {
      pos: pos,
      list: list,
      organism: organism,
      count: dataLookup[organism] ? dataLookup[organism][list] : 0  // no data for this organism
    });
  })
  .on("mouseout", function() {
    svg.selectAll(".tick text")
      .style("opacity", null)
      .style("font-size", Math.floor(textScale(config.cellsize)) + "px");
    dispatch.call("mouseout")
  });

  svg.append("g")
     .attr("class", "x axis")
//     .attr("transform", "translate(" + xscale.bandwidth()/2 + ",0)")
     .call(d3.axisTop()
      .scale(xscale))
    .selectAll("text")
    .style("font-size", Math.floor(textScale(config.cellsize)) + "px")
    .style("fill", function(d){
      return config.listTextColor(d);
    })
    .style("text-anchor", "start")
    .on("click", function(d){
      dispatch.call("click")
    })
    .on("mouseover", function(d){
      dispatch.call("hoverList", undefined, d)
      //highlightColumns(d);
      d3.select(this).style("font-size", Math.floor(textHoverScale(config.cellsize)) + "px")
    })
    .on("mouseout", function(d){
      dispatch.call("mouseout")
      d3.select(this).style("font-size", Math.floor(textScale(config.cellsize)) + "px")
    });

  var renderCell = {
    square: function(ctx,x,y,value,color) {
      if (value == 0) return;
      ctx.fillStyle = color;
      //ctx.globalAlpha = alpha(value);
      ctx.fillRect(x,y,xscale.bandwidth()-1,yscale.bandwidth()-1);
    },
    bar: function(ctx,x,y,value,color) {
      if (value == 0) return;
      ctx.fillStyle = color;
      var height = value * yscale.bandwidth();
      var width = xscale.bandwidth()-1;
      //ctx.globalAlpha = alpha(value);
      if (value <= cutoff_bars){
        ctx.fillRect(x,y - height + yscale.bandwidth(),width, height);
      }
      if(value > cutoff_bars){
        height = cutoff_bars * yscale.bandwidth();
        extendedRectsVertical(ctx, x, y + yscale.bandwidth(), y - height + yscale.bandwidth(), y - height + yscale.bandwidth()/2, x + xscale.bandwidth() - 1)
      }
    },
    hBar: function(ctx,x,y,value,color) {
      if (value == 0) return;
      ctx.fillStyle = color;
      var width = value * xscale.bandwidth();
      var height = yscale.bandwidth() - 1;
      if (value <= cutoff_bars){
        ctx.fillRect(x,y - height + yscale.bandwidth() - 1,width, height);
      }
      if(value > cutoff_bars){
        width = cutoff_bars * yscale.bandwidth();
        extendedRectsHorizontal(ctx, x, y, x + width, x + width + xscale.bandwidth() / 2, y + yscale.bandwidth() - 1)
      }
    },
  };

  function extendedRectsVertical(ctx, left, bottom, top, point, right) {
        ctx.beginPath();
        ctx.moveTo(left,bottom)
        ctx.lineTo(left,top);
        ctx.lineTo((left + right)/2, point);
        ctx.lineTo(right,top);
        ctx.lineTo(right,bottom);
        ctx.fill();
  }

  function extendedRectsHorizontal(ctx, left, top, right, point, bottom) {
        ctx.beginPath();
        ctx.moveTo(left,top)
        ctx.lineTo(right,top);
        ctx.lineTo(point, (top + bottom)/2);
        ctx.lineTo(right,bottom);
        ctx.lineTo(left,bottom);
        ctx.fill();
  }

  function isSCG(col) {
   return (bacterialSCG.indexOf(col) > -1 || archaealSCG.indexOf(col) > -1) ? true : false
  }

  function render() {
    xscale.domain().forEach(function(col) {
      var x = xscale(col);

      config.data.forEach(function(row) {
        var y = yscale(row.name);
        renderCell['square'](ctx,x,y,row[col],config.getColor(row[col], isSCG(col), col));
      });
    });
  };

  function prepForHighlight(canvas){
    canvas.clearRect(-margin.left-1,-margin.top,width+margin.right+margin.left+2,height+margin.top+margin.bottom);
    canvas.globalAlpha = fadeAlphaMatrix[colorScheme];
    canvas.fillStyle = deemphasizeColorOverlay;
    canvas.fillRect(0,0,width,height);
    canvas.globalAlpha = 1;
  }

  function prepForGuidelines(canvas){
    canvas.clearRect(-margin.left-1,-margin.top,width+margin.right+margin.left+2,height+margin.top+margin.bottom);
    canvas.globalAlpha = fadeAlphaMatrix[colorScheme];
  }


  function drawLine(canvas, x, y){
    canvas.save();
    canvas.beginPath();
    canvas.moveTo(x[0],y[0]);
    canvas.lineTo(x[1],y[1]);
    canvas.lineWidth = 1;
    canvas.globalAlpha = fadeAlphaMatrix[colorScheme];
    canvas.strokeStyle = config.textColor;
    canvas.stroke();
    canvas.restore();
  }

  function highlight(organism, list, frozen) {
    canvas2.classed("active", true);

    if(!frozen){
      prepForHighlight(ctx2)
      prepForGuidelines(ctxGuidelines);

      xscale.domain().forEach(function(col) {
        var x = xscale(col);

        config.data.forEach(function(row) {
          if(col == list || row.name == organism){
            var y = yscale(row.name);  
            renderCell['square'](ctx2,x,y,row[col],config.getColor(row[col], isSCG(col), col));
          }
        });
      });

      // draw axis for matrix
      var x = xscale(list);
      var y = yscale(organism);
      
      // long axis lines
      drawLine(ctx2, [x-0.5,x-0.5], [0-0.5,height-0.5]);
      drawLine(ctx2, [0,width], [y + yscale.bandwidth()-0.5,y + yscale.bandwidth()-0.5]);
      // short cell lines
      drawLine(ctx2, [x+cell_size-0.5,x+cell_size-0.5] , [y-0.5*cell_size, y+1.5*cell_size]);
      drawLine(ctx2, [x-0.5*cell_size,x+1.5*cell_size], [y-0.5,y-0.5]);
    } else {
            // draw axis for matrix
      var x = xscale(list);
      var y = yscale(organism);
      
      prepForGuidelines(ctxGuidelines);
      //ctxGuidelines.clearRect(0,0,width,height);
      // long axis lines
      drawLine(ctxGuidelines, [x-0.5,x-0.5], [0-0.5,height-0.5]);
      drawLine(ctxGuidelines, [0,width], [y + yscale.bandwidth()-0.5,y + yscale.bandwidth()-0.5]);
      // short cell lines
      drawLine(ctxGuidelines, [x+cell_size-0.5,x+cell_size-0.5] , [y-0.5*cell_size, y+1.5*cell_size]);
      drawLine(ctxGuidelines, [x-0.5*cell_size,x+1.5*cell_size], [y-0.5,y-0.5]);
    }

  };

  function clear() {
    ctx.clearRect(0,0,width,height);
  };

  function unhighlight(frozen) {  
    if(!frozen){
      canvas2.classed("active", false);
      ctx2.clearRect(-margin.left-1,-margin.top,width+margin.right+margin.left+2,height+margin.top+margin.bottom);
    }
    // always clear guideline rect
    ctxGuidelines.clearRect(-margin.left-1,-margin.top,width+margin.right+margin.left+2,height+margin.top+margin.bottom);
  };

  function highlightBars(orglist, frozen) {
    var type = "square";
    var subset = config.data.filter(function(d) {
      return orglist.indexOf(d.name) > -1;
    });
    if (subset.length == 1) type = "bar";

    if(!frozen){
      canvas2.classed("active", true);

      prepForHighlight(ctx2)

      xscale.domain().forEach(function(col) {
        var x = xscale(col);

        subset.forEach(function(row) {
          var y = yscale(row.name);

          // render cells
          renderCell[type](ctx2,x,y,row[col],config.getColor(row[col], isSCG(col), col));
        });
      });

      if(type == 'bar'){
        var y = yscale(subset[0].name);
        drawLine(ctx2, [0,width], [y + yscale.bandwidth(),y + yscale.bandwidth()])
      }
    } else {
      if(type == 'square'){
        var yValues = [];
        subset.forEach(function(organism){
          yValues.push(yscale(organism.name))
        })
        var min = d3.min(yValues);
        var max = d3.max(yValues)
        drawLine(ctxGuidelines, [0,width], [min, min])
        drawLine(ctxGuidelines, [0,width], [max + yscale.bandwidth(),max + yscale.bandwidth()])
      }
      if(type == 'bar'){
        var y = yscale(subset[0].name);
        drawLine(ctxGuidelines, [0,width], [y + yscale.bandwidth(),y + yscale.bandwidth()])
      }
    }
  };


  function highlightColumns(col, frozen) {

    if(!frozen){
      canvas2.classed("active", true);
      
      var subset = []
      config.data.forEach(function(d) {
        subset.push({
          'name': d.name,
          'value': d[col]
        })
      });

      prepForHighlight(ctx2)


      var x = xscale(col);
      subset.forEach(function(row) {

          var y = yscale(row.name);

          renderCell["hBar"](ctx2,x,y,row.value,config.getColor(row.value, isSCG(col), col));

      });
      drawLine(ctx2, [x,x], [0,height])
    } else {

      var x = xscale(col);
      drawLine(ctxGuidelines, [x,x], [0,height])
    }

  };


  return {
    config: config,
    clear: clear,
    yscale: yscale,
    render: render,
    highlight: highlight,
    highlightBars: highlightBars,
    highlightColumns: highlightColumns,
    unhighlight: unhighlight,
    dispatch: dispatch
  };
};

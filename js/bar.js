
function Bar(differential) {

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 0, bottom: 0, left: 0};

    var w = $("#graph-container").innerWidth() - (margin.left + margin.right);
    var h = $("#graph-container").innerHeight() - (margin.top + margin.bottom);

    function idFunc(d) { return d ? d.id : this.id; }

    var bar_thickness = 20;
    var margin_between_bars = 10;

    var animation_out_duration = 700;
    var animation_in_duration = 700;

    var minLogFC = -6;
    var maxLogFC = 6;

    var low_color = "blue";
    var center_color = "white"
    var high_color = "red";
    // var color = d3.scaleLinear().domain([minLogFC, 0, maxLogFC])
    //                             .range([low_color, center_color, high_color]);
    let color = (logFC) => logFC < 0 ? low_color : high_color;


    var fc_threshold = 0;
    var q_threshold = 0;
    let is_differential = (d) => d.q > q_threshold && Math.abs(d.logFC) > fc_threshold;

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");

    var x_neg = d3.scaleLinear().domain([minLogFC, 0]).rangeRound([0, w/2 - 50]).nice();
    var x_pos = d3.scaleLinear().domain([0, maxLogFC]).rangeRound([w/2 + 50, w]).nice();

    neg_axis = d3.axisTop(x_neg);
    pos_axis = d3.axisTop(x_pos);
    g.append("g").attr("class", "axis axis--x").call(neg_axis);
    g.append("g").attr("class", "axis axis--x").call(pos_axis);

    var neg_grid = d3.axisTop(x_neg).tickFormat("").tickSize(-h);
    var pos_grid = d3.axisTop(x_pos).tickFormat("").tickSize(-h);

    var grid_left = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(neg_grid);
    var grid_right = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(pos_grid);

    var title = g.append("text")
                 .attr("class", "title")
                 .attr("font-family", "sans-serif")
                 .text("")
                 .style("text-anchor", "middle")
                 .attr("x", (x_pos(0) + x_neg(0)) / 2)
                 .attr("y", 0)
                 .attr("dy", "-3em");

    var logFCs = [];
    var title_text = "";

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Re-Draw Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_gene_set_name_=selected_gene_set_name,
                      selected_genes_=selected_genes,
                      q_threshold_=q_threshold,
                      fc_threshold_=fc_threshold}={}) {

        logFCs = _.pick(differential, selected_genes);
        title_text = selected_gene_set_name;
        q_threshold = q_threshold_;
        fc_threshold = fc_threshold_;

        data = Object.entries(logFCs).map(entry => Object.assign(entry[1], {'id':entry[0]}))
                                     .filter(is_differential)
                                     .sort((a,b) => b.logFC - a.logFC);

        indexer = _.object(data.map((gene, i) => [gene.id, i]));

        y_max = (data.length - 1) * (bar_thickness + margin_between_bars) + margin.top;

        let y = (id) => (indexer[id]+0.5) * (bar_thickness + margin_between_bars);
        let x_start = (x) => x > 0 ? x_pos(0) : x_neg(x);
        let x_width = (x) => x > 0 ? x_pos(x)-x_pos(0) : x_neg(0)-x_neg(x);
        let x_start_before_animation = (x) => x > 0 ? x_pos(0) : x_neg(0);

        title.text(title_text)

        var text = g.selectAll('.a').data(data, idFunc);
        var bar  = g.selectAll('.bar').data(data, idFunc);
        var t = d3.transition().duration(1000);

        // gene symbols
        text.exit().remove();
        text.selectAll('.text').transition(t).attr("y", (d) => y(d.id) );
        text.enter()
            .append("a")
            .attr("class", "a")
            .attr("xlink:href", (d) => "http://www.genecards.org/cgi-bin/carddisp.pl?gene="+d.id)
            .style("cursor", "pointer")
                .append("text")
                .attr("class", "text")
                .attr("font-family", "sans-serif")
                .text((d) => d.id )
                .style("text-anchor", "middle")
                .attr("x", (x_pos(0) + x_neg(0)) / 2)
                .attr("y", (d) => y(d.id) )
                .attr("dy", "1em");

        // bars
        bar.exit()
           .transition(t)
           .attr("x", (d) => x_start_before_animation(d.logFC) )
           .attr("width", 0)
           .remove();

        bar.transition(t).attr("y", (d) => y(d.id) )

        bar.enter()
            .append("rect")
            .attr("class", (d) => "bar bar--" + (d.logFC < 0 ? "negative" : "positive") )
            .attr("y", (d) => y(d.id) )
            .attr("height", bar_thickness)
            .attr("x", (d) => x_start_before_animation(d.logFC) )
            .attr("width", 0)
            .style("fill", (d) => color(d.logFC))
            .transition(t)
                .attr("x", (d) => x_start(d.logFC) )
                .attr("width", (d) => x_width(d.logFC) );

        // grid lines
        neg_grid = neg_grid.tickSize(-y_max);
        pos_grid = pos_grid.tickSize(-y_max);

        grid_left.remove();
        grid_right.remove();
        grid_left = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(neg_grid);
        grid_right = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(pos_grid);

    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

    let clamp = (min, max) => ((x) => Math.min(Math.max(x, min), max));

    svg.call(d3.zoom().on("zoom", zoomed)).on("wheel.zoom", wheeled);

    transform = d3.zoomTransform(g);
    transform.x += margin.left;
    transform.y += margin.top;
    g.attr("transform", transform);

    function zoomed() {
        current_transform = d3.zoomTransform(g);
        current_transform.x += d3.event.sourceEvent.movementX;
        current_transform.y += d3.event.sourceEvent.movementY;
        g.attr("transform", current_transform);
    }

    function wheeled() {
        current_transform = d3.zoomTransform(g);
        current_transform.y = clamp(-(g.node().getBBox().height-window.innerHeight-100), 100)(current_transform.y - d3.event.deltaY);
        g.attr("transform", current_transform);
    }

    function resize() {
        svg.attr("width", $("#graph-container").innerWidth()).attr("height", $("#graph-container").innerHeight());
        w = $("#graph-container").innerWidth() - (margin.left + margin.right);
        h = $("#graph-container").innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on("resize", resize)

    resize();

    return {
        'restart': restart,
        DEgenes  : () => _(data.filter(is_differential)).pluck('id'),

    }

}

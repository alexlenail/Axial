
function Volcano(names_and_differentials) {

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 100, bottom: 100, left: 100};

    var w = $("#graph-container").innerWidth() - (margin.left + margin.right);
    var h = $("#graph-container").innerHeight() - (margin.top + margin.bottom);

    var point_size = 2;
    var show_text = false;
    var font_size = 5;

    var bad_logFC_bad_q_color = "#cccccc";
    var good_logFC_bad_q_color = "#ee8822";
    var bad_logFC_good_q_color = "#eecc22";
    var good_logFC_good_q_color = "#ee2222";

    var q_threshold = 5;
    var fc_threshold = 1;
    let is_differential = (d) => d.q > q_threshold && Math.abs(d.logFC) > fc_threshold;

    var yLabel = '-log₁₀ Q-Value (FDR)';
    var xLabel = 'log₂ Fold-Change';

    var x, y;

    var threshold_color = "#ff0000";
    var threshold_line_width = "1";
    var threshold_line_dashes = "5, 3";

    var dataset = Object.keys(names_and_differentials)[0];
    var data;

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");

    // Axes and Grid
    var minLogFC = d3.min(data, entry => entry.logFC);
    var maxLogFC = d3.max(data, entry => entry.logFC);
    var x_bound  = Math.max(Math.abs(minLogFC), Math.abs(maxLogFC));

    var min_q = 0;
    var max_q = d3.max(data, entry => entry.q);

    x = d3.scaleLinear().domain([-x_bound, x_bound]).rangeRound([0, w]).nice().clamp(true);
    y = d3.scaleLinear().domain([min_q, max_q]).rangeRound([h, 0]).nice().clamp(true);


    var logFC_axis = d3.axisBottom(x);
    var logFC_axis_svg = g.append("g").attr("class", "axis axis--x").attr('transform', 'translate(0,'+h+')').call(logFC_axis);

    var logFC_grid = d3.axisBottom(x).tickFormat("").tickSize(-h);
    var logFC_grid_svg = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).attr('transform', 'translate(0,'+h+')').call(logFC_grid);


    var qVal_axis = d3.axisLeft(y);
    var qVal_axis_svg = g.append("g").attr("class", "axis axis--y").call(qVal_axis);

    var qVal_grid = d3.axisLeft(y).tickFormat("").tickSize(-w);
    var qVal_grid_svg = g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(qVal_grid);

    g.append('text')
        .attr('class', 'label')
        .attr('transform', 'translate('+w/2+','+(h+margin.bottom/2)+')')
        .attr('text-anchor', 'middle')
        .html(xLabel);

    g.append('text')
        .attr('class', 'label')
        .attr('transform', 'translate('+(0-margin.left/2)+','+(h/2)+')rotate(-90)')
        .style('text-anchor', 'middle')
        .html(yLabel);

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({dataset_=dataset}={}) {

        data = Object.entries(names_and_differentials[dataset]).map(entry => Object.assign({'id':entry[0]}, entry[1]))
                                                               .filter(entry => entry['logFC'] != null && entry['q'] != null);


        render();

    }

    function render() {



        // Dots
        var dots = g.selectAll(".dot").data(data);
        dots.enter()
            .append("a")
            .attr('class', 'a')
            .attr('id', d => d.id)
            .attr("xlink:href", (d) => "http://www.genecards.org/cgi-bin/carddisp.pl?gene="+d.id)
            .style("cursor", "pointer")
            .on('mouseenter', tipEnter)
            .on('mousemove', tipMove)
            // .on('mouseleave', tipExit)
            .append('circle')
            .attr('class', 'dot')
            .attr('r', point_size)
            .attr('cx', d => x(d.logFC) )
            .attr('cy', d => y(d.q) )
            .attr('fill', d => ((d.logFC > fc_threshold || d.logFC < -fc_threshold) ? (d.q > q_threshold ? good_logFC_good_q_color : good_logFC_bad_q_color) : (d.q > q_threshold ? bad_logFC_good_q_color : bad_logFC_bad_q_color)));

        // Thresholds
        var y_threshold = g.append("line")
            .attr('id', 'y_threshold')
            .attr("x1", 0)
            .attr("x2", w)
            .attr("y1", y(q_threshold))
            .attr("y2", y(q_threshold))
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        var y_threshold_selector = g.append("circle")
            .attr('id', 'y_threshold_selector')
            .attr("cx", w)
            .attr("cy", y(q_threshold))
            .attr("r", 5)
            .attr("fill", threshold_color)
            .attr("stroke", "#000000")
            .attr("cursor", "ns-resize")
            .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged_y)
                    .on("end", dragended));

        var y_threshold_text = g.append("text")
            .attr('id', 'y_threshold_text')
            .attr("x", w+10)
            .attr("y", y(q_threshold)+5)
            .text(Math.round(q_threshold))
            .style("font-size", 12)
            .attr("font-family", "sans-serif");

        var x_threshold_1 = g.append("line")
            .attr('id', 'x_threshold_1')
            .attr("x1", x(-fc_threshold))
            .attr("x2", x(-fc_threshold))
            .attr("y1", 0)
            .attr("y2", h)
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        var x_threshold_1_selector = g.append("circle")
            .attr('id', 'x_threshold_1_selector')
            .attr("cx", x(-fc_threshold))
            .attr("cy", 0)
            .attr("r", 5)
            .attr("fill", threshold_color)
            .attr("stroke", "#000000")
            .attr("cursor", "ew-resize")
            .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged_x)
                    .on("end", dragended));

        var x_threshold_2 = g.append("line")
            .attr('id', 'x_threshold_2')
            .attr("x1", x(fc_threshold))
            .attr("x2", x(fc_threshold))
            .attr("y1", 0)
            .attr("y2", h)
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        var x_threshold_2_selector = g.append("circle")
            .attr('id', 'x_threshold_2_selector')
            .attr("cx", x(fc_threshold))
            .attr("cy", 0)
            .attr("r", 5)
            .attr("fill", threshold_color)
            .attr("stroke", "#000000")
            .attr("cursor", "ew-resize")
            .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged_x)
                    .on("end", dragended));

        var x_threshold_text = g.append("text")
            .attr('id', 'x_threshold_text')
            .attr("x", x(fc_threshold)+10)
            .attr("y", 0+5)
            .text(Math.round(fc_threshold*10)/10)
            .style("font-size", 12)
            .attr("font-family", "sans-serif");

        // ToolTip
        var tooltip = d3.select("body")
            .append("div")
            .attr('class', 'tooltip')
            .style('font-size', '11px');

    }

    function style({bad_logFC_bad_q_color_=bad_logFC_bad_q_color,
                    good_logFC_bad_q_color_=good_logFC_bad_q_color,
                    bad_logFC_good_q_color_=bad_logFC_good_q_color,
                    good_logFC_good_q_color_=good_logFC_good_q_color,
                    threshold_color_=threshold_color,
                    point_size_=point_size,
                    font_size_=font_size,
                    show_text_=show_text}={}) {

        bad_logFC_bad_q_color = bad_logFC_bad_q_color_;
        good_logFC_bad_q_color = good_logFC_bad_q_color_;
        bad_logFC_good_q_color = bad_logFC_good_q_color_;
        good_logFC_good_q_color = good_logFC_good_q_color_;
        threshold_color = threshold_color_;
        point_size = point_size_;
        font_size = font_size_;
        show_text = show_text_;

        g.selectAll(".dot")
            .attr('r', point_size)
            .attr('fill', d => ((d.logFC > fc_threshold || d.logFC < -fc_threshold) ? (d.q > q_threshold ? good_logFC_good_q_color : good_logFC_bad_q_color) : (d.q > q_threshold ? bad_logFC_good_q_color : bad_logFC_bad_q_color)));

        text = g.selectAll(".text").data([]);
        text.exit().remove();
        if (show_text) {
            text = g.selectAll(".text").data(data.filter(is_differential));
            text.enter()
                .append("a")
                .attr('class', 'a')
                .attr("xlink:href", (d) => "http://www.genecards.org/cgi-bin/carddisp.pl?gene="+d.id)
                .style("cursor", "pointer")
                    .append("text")
                    .attr('class', 'text')
                    .text(d => d.id)
                    .attr('x', d => x(d.logFC) )
                    .attr('y', d => y(d.q) )
                    .style("font-size", font_size)
                    .attr("font-family", "sans-serif");

        }
    }


    function dragstarted(d) {
        d3.select(this).raise().classed("active", true);
    }

    function dragged_x(d) {
        fc_threshold = x.invert(d3.event.x);
        fc_threshold = Math.abs(fc_threshold);

        d3.select("#x_threshold_1_selector").attr("cx", x(-fc_threshold));
        d3.select("#x_threshold_1").attr('x1', x(-fc_threshold));
        d3.select("#x_threshold_1").attr('x2', x(-fc_threshold));

        d3.select("#x_threshold_2_selector").attr("cx", x(fc_threshold));
        d3.select("#x_threshold_2").attr('x1', x(fc_threshold));
        d3.select("#x_threshold_2").attr('x2', x(fc_threshold));

        d3.select("#x_threshold_text").attr("x", x(fc_threshold)+10)
                                      .attr("y", 0+5)
                                      .text(Math.round(fc_threshold*10)/10);

    }
    function dragged_y(d) {
        q_threshold = y.invert(d3.event.y);
        d3.select(this).attr("cy", y(q_threshold));
        d3.select("#y_threshold").attr('y1', y(q_threshold));
        d3.select("#y_threshold").attr('y2', y(q_threshold));

        d3.select("#y_threshold_text").attr("x", w+10)
                                      .attr("y", y(q_threshold)+5)
                                      .text(Math.round(q_threshold));
    }

    function dragended(d) {
        d3.select(this).classed("active", false);
        style();
    }


    function tipEnter(d) {
        d3.select(".tooltip").style('visibility', 'visible')
                             .html(
                                '<strong>' + d.id + '</strong><br/>' +
                                '<strong>logFC</strong>: ' + d.logFC + '<br/>' +
                                '<strong>-logQ</strong>: ' + d.q
                             );
    }

    function tipMove() {
        d3.select(".tooltip").style("top", (event.pageY - 5) + "px")
                             .style("left", (event.pageX + 10) + "px");
    }

    function tipExit() {
        d3.select(".tooltip").style('visibility', 'hidden');
    }

    function showTipOn(gene) {
        position = d3.select("#"+gene).node().getBoundingClientRect();
        tipEnter(d3.select("#"+gene)._groups[0][0].__data__);  // sad days -- there's gotta be a better way.
        d3.select(".tooltip").style("top", (position.y - 5) + "px")
                             .style("left", (position.x + 10) + "px");

    }

    /////////////////////////////////////////////////////////////////////////////
                          ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////


    svg.call(d3.zoom().on('zoom', zoomed)).on('wheel.zoom', wheeled);

    var transform = d3.zoomTransform(g);
    transform.x += margin.left;
    transform.y += margin.top;
    g.attr('transform', transform);

    function zoomed() {
        var current_transform = d3.zoomTransform(g);
        current_transform.x += d3.event.sourceEvent.movementX;
        current_transform.y += d3.event.sourceEvent.movementY;
        g.attr('transform', current_transform);
    }

    function wheeled() {
        var current_transform = d3.zoomTransform(g);
        if (d3.event.ctrlKey) {
            current_transform.k = clamp(0.1, 5)(current_transform.k - d3.event.deltaY * 0.01);
        } else {
            if (t) {
                current_transform.x = clamp(-w*current_transform.k, w)(current_transform.x - d3.event.deltaY);
            } else {
                current_transform.y = clamp(-w*current_transform.k, h)(current_transform.y - d3.event.deltaY);
            }
        }
        g.attr('transform', current_transform);
    }

    function resize() {
        svg.attr('width', $('#graph-container').innerWidth()).attr('height', $('#graph-container').innerHeight());
        w = $('#graph-container').innerWidth() - (margin.left + margin.right);
        h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on('resize', resize)

    resize();


    return {
        'restart': restart,
        'style'  : style,
        'data'   : data,
        DEgenes  : () => _(data.filter(is_differential)).pluck('id'),
        'showTipOn':showTipOn,
    }

}

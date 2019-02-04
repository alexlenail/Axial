
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
    var tooltip_shown = false;

    var dataset = Object.keys(names_and_differentials)[0];
    var data;


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");
    svg.on('click', function() { if (d3.event.target.localName === 'svg') { tipExit(); } });

    g.append('text').attr('class', 'label').attr('transform', 'translate('+w/2+','+(h+margin.bottom/2)+')').attr('text-anchor', 'middle').html(xLabel);
    g.append('text').attr('class', 'label').attr('transform', 'translate('+(0-margin.left/2)+','+(h/2)+')rotate(-90)').style('text-anchor', 'middle').html(yLabel);


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({dataset_=dataset}={}) {

        dataset = dataset_;

        data = Object.entries(names_and_differentials[dataset]).map(entry => Object.assign({'id':entry[0]}, entry[1]))
                                                               .filter(entry => entry['logFC'] != null && entry['q'] != null);


        g.selectAll('.axis,.grid,.dot,.threshold').remove();

        // Axes and Grid
        var minLogFC = d3.min(data, entry => entry.logFC);
        var maxLogFC = d3.max(data, entry => entry.logFC);
        var x_bound  = Math.max(Math.abs(minLogFC), Math.abs(maxLogFC));

        var min_q = 0;
        var max_q = d3.max(data, entry => entry.q);

        x = d3.scaleLinear().domain([-x_bound, x_bound]).rangeRound([0, w]).nice().clamp(true);
        y = d3.scaleLinear().domain([min_q, max_q]).rangeRound([h, 0]).nice().clamp(true);

        g.append("g").attr("class", "axis axis--x").attr('transform', 'translate(0,'+h+')').call(d3.axisBottom(x));
        g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).attr('transform', 'translate(0,'+h+')').call(d3.axisBottom(x).tickFormat("").tickSize(-h));

        g.append("g").attr("class", "axis axis--y").call(d3.axisLeft(y));
        g.append("g").attr("class", "grid").style("stroke", "#ddd").style("opacity", 0.1).call(d3.axisLeft(y).tickFormat("").tickSize(-w));


        // Dots
        g.selectAll(".dot").data(data).enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('id', d => d.id)
            .attr('r', point_size)
            .attr('cx', d => x(d.logFC) )
            .attr('cy', d => y(d.q) )
            .attr('fill', d => ((d.logFC > fc_threshold || d.logFC < -fc_threshold) ? (d.q > q_threshold ? good_logFC_good_q_color : good_logFC_bad_q_color) : (d.q > q_threshold ? bad_logFC_good_q_color : bad_logFC_bad_q_color)))
            .style("cursor", "pointer")
            .on('mouseenter', tipEnter)
            .on('mousemove', tipMove)
            // .on('mouseleave', tipExit)

        // Thresholds
        g.append("line")
            .attr('class', 'threshold')
            .attr('id', 'y_threshold')
            .attr("x1", 0)
            .attr("x2", w)
            .attr("y1", y(q_threshold))
            .attr("y2", y(q_threshold))
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        g.append("circle")
            .attr('class', 'threshold')
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

        g.append("text")
            .attr('class', 'threshold')
            .attr('id', 'y_threshold_text')
            .attr("x", w+10)
            .attr("y", y(q_threshold)+5)
            .text(Math.round(q_threshold))
            .style("font-size", 12)
            .attr("font-family", "sans-serif");

        g.append("line")
            .attr('class', 'threshold')
            .attr('id', 'x_threshold_1')
            .attr("x1", x(-fc_threshold))
            .attr("x2", x(-fc_threshold))
            .attr("y1", 0)
            .attr("y2", h)
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        g.append("circle")
            .attr('class', 'threshold')
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

        g.append("line")
            .attr('class', 'threshold')
            .attr('id', 'x_threshold_2')
            .attr("x1", x(fc_threshold))
            .attr("x2", x(fc_threshold))
            .attr("y1", 0)
            .attr("y2", h)
            .attr("stroke", threshold_color)
            .attr("stroke-width", threshold_line_width)
            .attr("stroke-dasharray", threshold_line_dashes);

        g.append("circle")
            .attr('class', 'threshold')
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

        g.append("text")
            .attr('class', 'threshold')
            .attr('id', 'x_threshold_text')
            .attr("x", x(fc_threshold)+10)
            .attr("y", 0+5)
            .text(Math.round(fc_threshold*10)/10)
            .style("font-size", 12)
            .attr("font-family", "sans-serif");

        // ToolTip
        d3.select("body")
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
        tooltip_shown = true;
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
        tooltip_shown = false;
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

    svg.call(d3.zoom().on('zoom', zoomed));

    var transform = d3.zoomTransform(g);
    transform.x += margin.left;
    transform.y += margin.top;
    g.attr('transform', transform);

    function zoomed() {
        if (tooltip_shown) { tipExit(); }
        g.attr("transform", d3.event.transform);
    }

    function resize() {
        svg.attr('width', $('#graph-container').innerWidth()).attr('height', $('#graph-container').innerHeight());
        w = $('#graph-container').innerWidth() - (margin.left + margin.right);
        h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on('resize', resize)

    resize();


    return {
        'restart'    : restart,
        'style'      : style,

        genes        : () => _(data).pluck('id'),
        DEgenes      : () => _(data.filter(is_differential)).pluck('id'),
        'showTipOn'  : showTipOn,
    }

}

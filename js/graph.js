

function Graph(graph) {

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Structure Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var w = window.innerWidth;
    var h = window.innerHeight;


    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var focus_node = null;

    var show_only_solution_edges = false;
    var repulsion_strength = 100;
    var colorBy = 'prize';
    var groupBy = null;
    var turnForceOff = false;

    var text_center = false;
    var highlight_color = 'blue';
    var highlight_trans = 0.1;
    var default_node_color = '#ccc';
    var default_link_color = '#aaa';
    var edge_opacity = 0.6;
    var base_node_size = 8;
    var nominal_text_size = 10;
    var max_text_size = 24;
    var stroke_width = 1;
    var min_zoom = 0.2;
    var max_zoom = 7;
    var group_boundary_margin = 32;
    var group_compactness = 0.000001;
    var group_padding = 8;


    var min_confidence = 0;
    var max_confidence = 1;
    var edge_width = d3.scaleLinear().domain([0, 1]).range([0.3, 3]).clamp(true);

    var colors20 = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477',
                    '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', '#aaaa11', '#6633cc',
                    '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'];



    var display_type = d3.scaleOrdinal(d3.symbols);

    var size = d3.scalePow().exponent(1).domain([1, 100]).range([8, 24]);


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select('#graph-container').append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    var g = svg.append('g');




    var cola = cola.d3adaptor(d3).size([w, h]);
    cola.groupCompactness = group_compactness;


    var linked = {};
    graph.links.forEach(function(d) { linked[d.source_name + ',' + d.target_name] = true; });

    function isConnected(a, b) {
        return linked[a.id + ',' + b.id] || linked[b.id + ',' + a.id] || a.id == b.id;
    }



    graph.nodes.forEach(function (v, i) {
        Object.keys(groups).forEach(function (key) {
            if (key in v) {
                if (!(v[key] in groups[key])) { groups[key][v[key]] = {'id':v[key], 'leaves':[], 'groups':[], 'padding':group_padding}; }
                groups[key][v[key]]['leaves'].push(i);
            }
        });
    });

    Object.keys(groups).forEach(function (key) {
        groups[key] = Object.values(groups[key])
    });

    graph.nodes.forEach(function (n) {
        n.height = n.width = group_boundary_margin;
    });

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Legends    ///////
    /////////////////////////////////////////////////////////////////////////////

    var legends = g.append('g').attr('class', 'legends');

    var shape_legend = legends.append('g').styles(text_styles).call(d3.legendSymbol().scale(display_type).orient('vertical').title('Node Type'));
    var color_legend = legends.append('g').styles(text_styles).call(d3.legendColor().shapeWidth(30).orient('vertical').scale(color[colorBy]).title(colorBy));
    var width_legend = legends.append('g').styles(text_styles).call(d3.legendSize().scale(edge_width).shape('line').orient('vertical').shapeWidth(40).labelAlign('start').shapePadding(10).title('Confidence'));


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Setup Graph    ///////
    /////////////////////////////////////////////////////////////////////////////

    function render() {

        links = show_only_solution_edges ? graph.links.filter(function (l) {return l.in_solution}) : graph.links;


        var node = g.selectAll('.node').data(graph.nodes);
        var text = g.selectAll('.text').data(graph.nodes);
        var link = g.selectAll('.link').data(links);
        var group = g.selectAll('.group').data(groups[groupBy]);
        var label = g.selectAll('.label').data(groups[groupBy]);

        //
        link.exit().remove()
        group.exit().remove()
        label.exit().remove()


        group.enter()
             .append('rect')
             .attr('rx',5)
             .attr('ry',5)
             .style('fill', function (d) { return color[groupBy](d.id); })
             .style('opacity', 0.7)
             .style('cursor', 'pointer')
             .call(cola.drag);

        label.enter()
             .append('text')
             .attr('class', 'label')
             .attr('font-family', 'sans-serif')
             .text(function (d) { return d.id; })
             .call(cola.drag);

        link.enter()
           .append('line') // insert before 'node' so that nodes show up on top
           .attr('class', 'link')
           .style('stroke-width', d => edge_width(1-d.cost))
           .style('stroke', d => color[colorBy](d.score))
           .style('opacity', edge_opacity);

        node.enter()
            .append('path')
            .attr('class', 'node')
            .attr('id', d => d.id)
            .attr('d', d => display_type(d.type))  // should be able to change the size one day
            .style('fill', (d) => (d[colorBy] ? color[colorBy](d[colorBy]) : default_node_color) )
            .style('stroke', 'white')
            .style('stroke-width', stroke_width)
            .style('cursor', 'pointer')
            .on('mouseover', (d) => set_highlight(d)).on('mouseout', (d) => remove_highlight());
            .call(cola.drag);
            // node.on('mousedown', (d) => set_focus(d));
            // node.on('mouseup', (d) => remove_focus(d));
            .on('click', function(d) { if (d3.event.metaKey) {window.open('http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d.id);} });

        text.enter()
            .append('text')
            .attr('dy', '.35em')
            .style('font-size', nominal_text_size + 'px')
            .attr('font-family', 'sans-serif')
            .text(d => (text_center ? d.id : '\u2002' + d.id))
            .style('text-anchor', d => (text_center ? 'middle' : 'inherit') )
            .attr('dx', d => (text_center ? 0 : (size(d.size) || base_node_size)) );







        cola.nodes(graph.nodes)
            .links(links)
            // .links(turnForceOff ? [] : links)  # TODO
            .groups(groups[groupBy])
            .jaccardLinkLengths(repulsion_strength, 0.7)
            .avoidOverlaps(true)
            .start(50, 0, 50);



        cola.on('tick', function () {

            node.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );
            text.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );

            link.attr('x1', (d) => d.source.x )
                .attr('y1', (d) => d.source.y )
                .attr('x2', (d) => d.target.x )
                .attr('y2', (d) => d.target.y );

            node.attr('cx', (d) => d.x )
                .attr('cy', (d) => d.y );

            if (groupBy) {
                group.attr('x', (d) => d.bounds.x + d.padding / 2 )
                     .attr('y', (d) => d.bounds.y + d.padding / 2 )
                     .attr('width', (d) => d.bounds.width() - d.padding )
                     .attr('height',(d) => d.bounds.height() - d.padding );

                label.attr('x', (d) => d.bounds.x + d.padding / 2 )
                     .attr('y', (d) => d.bounds.y + d.padding / 2 );
            }
        });
    }

    function style() {

        node.style('fill', (d) => (d[colorBy] ? color[colorBy](d[colorBy]) : default_node_color) );

        color_legend.call(d3.legendColor().shapeWidth(30).orient('vertical').scale(color[colorBy]).title(colorBy));



    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Highlight    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_highlight(d) {
        node.style('stroke', (o) => (isConnected(d, o) ? highlight_color : 'white'));
        text.style('font-weight', (o) => (isConnected(d, o) ? 'bold' : 'normal'));
        link.style('stroke', (o) => (o.source.index == d.index || o.target.index == d.index ? highlight_color : default_link_color));
    }

    function remove_highlight() {
        if (focus_node===null) {
            node.style('stroke', 'white');
            text.style('font-weight', 'normal');
            link.style('stroke', default_link_color);
        }
    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Focus    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_focus(d) {
        d3.event.stopPropagation();
        focus_node = d3.select(this);

        if (highlight_trans < 1) {

            g.selectAll('.node').style('opacity', (o) => (isConnected(d, o) ? 1 : highlight_trans));
            g.selectAll('.text').style('opacity', (o) => (isConnected(d, o) ? 1 : highlight_trans));
            g.selectAll('.link').style('opacity', (o) => (o.source.index == d.index || o.target.index == d.index ? 1 : highlight_trans));
            g.selectAll('.group').style('opacity', (o) => (highlight_trans * 2));
            g.selectAll('.label').style('opacity', (o) => (highlight_trans * 2));

        }
    }

    function remove_focus() {
        d3.event.stopPropagation();
        focus_node = null;

        g.selectAll('.node').style('opacity', 1);
        g.selectAll('.text').style('opacity', 1);
        g.selectAll('.link').style('opacity', edge_opacity);
        g.selectAll('.group').style('opacity', 0.6);
        g.selectAll('.label').style('opacity', 1);

        remove_highlight();
    }


    /////////////////////////////////////////////////////////////////////////////
                        ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

    svg.call(d3.zoom().scaleExtent([1 / 2, 8]).on('zoom', zoomed));

    function zoomed() { g.attr('transform', d3.event.transform); }

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        svg.attr('width', window.innerWidth).attr('height', window.innerHeight);
    }

    d3.select(window).on('resize', resize);

    resize();


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Return    ///////
    /////////////////////////////////////////////////////////////////////////////

    return {
        'render': render,
        'style' : style,

    }

}



function Graph(graph, nested_groups) {

    node_attributes = {};
    graph.nodes.forEach(node => Object.entries(node).forEach(([key, val]) => { node_attributes[key] = node_attributes[key] || []; node_attributes[key].push(val) }))

    continuous_node_attributes = {};
    categorical_node_attributes = {};
    Object.entries(node_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_node_attributes[attr] = _(d3.extent(vals).push(0)).sortBy(); }
        else { categorical_node_attributes[attr] = _.uniq(vals); }
    });

    edge_attributes = {};
    graph.links.forEach(edge => Object.entries(edge).forEach(([key, val]) => { edge_attributes[key] = edge_attributes[key] || []; edge_attributes[key].push(val) }))

    continuous_edge_attributes = {};
    categorical_edge_attributes = {};
    Object.entries(edge_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_edge_attributes[attr] = _(d3.extent(vals).push(0)).sortBy(); }
        else { categorical_edge_attributes[attr] = _.uniq(vals); }
    });

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var force = true;
    var repulsion_strength = 100;
    var show_only_solution_edges = false;

    var text_center = false;
    var text_styles = {
        'font-family': 'sans-serif',
        'font-weight': 300,
        'cursor': 'pointer',
        'text-anchor': 'start',
    };

    var confidence_domain = [0, 1];
    var edge_width_range = [0.3, 5];
    var edge_width = d3.scaleLinear().domain(confidence_domain).range(edge_width_range).clamp(true).nice();

    var diverging_color_range = ["blue","white","red"];
    var schemeCategorical20 = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6',
                '#dd4477', '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', '#aaaa11',
                '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'];


    var node_color = _.object(Object.entries(continuous_node_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(diverging_color_range)])
                      .concat(Object.keys(categorical_node_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));
    var color_nodes_by = Object.keys(continuous_node_attributes).length ? continuous_node_attributes[Object.keys(continuous_node_attributes)[0]] : null;
    var default_node_color = '#ccc';


    var edge_color = _.object(Object.entries(continuous_edge_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(diverging_color_range)])
                      .concat(Object.keys(categorical_edge_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));
    var color_edges_by = Object.keys(continuous_edge_attributes).length ? continuous_edge_attributes[Object.keys(continuous_edge_attributes)[0]] : null;
    var default_edge_color = '#aaa';

    var node_shape = _.object(Object.entries(categorical_node_attributes).map(([attr, domain]) => [attr, d3.scaleOrdinal(d3.symbols)]));
    var shape_nodes_by = Object.keys(categorical_node_attributes).length ? categorical_node_attributes[Object.keys(categorical_node_attributes)[0]] : null;
    var default_node_shape = d3.symbol().type(d3.symbolCircle).size(200)();


    var node_size  = d3.scalePow().exponent(1).domain([1, 100]).range([8, 24]);
    var size_nodes_by = null;
    var default_node_size = 8;

    var group_nodes_by = null;
    var group_padding = 8;
    var group_boundary_margin = 32;
    graph.nodes.forEach(node => { node.height = node.width = group_boundary_margin; });
    var group_compactness = 0.000001;
    var group_opacity = 0.7;


    var highlight_color = 'blue';
    var highlight_trans = 0.1;
    var edge_opacity = 0.6;
    var base_text_size = 10;
    var max_text_size = 24;
    var node_border_width = 1;


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var w = window.innerWidth;
    var h = window.innerHeight;

    var svg = d3.select('#graph-container').append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    var g = svg.append('g');

    cola2 = cola.d3adaptor(d3).size([w, h]);
    cola2.groupCompactness = group_compactness;



    groups = _(categorical_node_attributes).mapObject((values, attr) => values.map(value => {
        return {'id':value, 'leaves':graph.nodes.map((node, i) => node[attr] === value ? i : -1).filter(x => x > -1), 'groups':[], 'padding':group_padding}
    }));

    // Nest location groups here.
    // console.log(nested_groups);




    var linked = {};
    graph.links.forEach(function(d) { linked[d.source_name + ',' + d.target_name] = true; });

    function isConnected(a, b) {
        return linked[a.id + ',' + b.id] || linked[b.id + ',' + a.id] || a.id == b.id;
    }


    var focus_node = null;


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Legends    ///////
    /////////////////////////////////////////////////////////////////////////////

    var legends = g.append('g').attr('class', 'legends');

    // var shape_legend = legends.append('g').styles(text_styles).call(d3.legendSymbol().scale(shape[shape_by]).orient('vertical').title(shape_by));
    // var color_legend = legends.append('g').styles(text_styles).call(d3.legendColor().scale(color[color_nodes_by]).orient('vertical').title(color_nodes_by));
    // var width_legend = legends.append('g').styles(text_styles).call(d3.legendSize().scale(edge_width).shape('line').orient('vertical').shapeWidth(40).labelAlign('start').shapePadding(10).title('Confidence'));


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods   ///////
    /////////////////////////////////////////////////////////////////////////////

    function render({force_=force,
                     repulsion_strength_=repulsion_strength,
                     show_only_solution_edges_=show_only_solution_edges,
                     group_nodes_by_=group_nodes_by,
                     shape_nodes_by_=shape_nodes_by}={}) {

        force = force_;
        repulsion_strength = repulsion_strength_;
        show_only_solution_edges = show_only_solution_edges_;
        group_nodes_by = group_nodes_by_;
        shape_nodes_by = shape_nodes_by_;

        links = show_only_solution_edges ? graph.links.filter(link => link.in_solution) : graph.links;

        var node = g.selectAll('.node').data(graph.nodes);
        var text = g.selectAll('.text').data(graph.nodes);
        var link = g.selectAll('.link').data(links);
        var group = g.selectAll('.group').data(groups[group_nodes_by] || []);
        var label = g.selectAll('.label').data(groups[group_nodes_by] || []);

        link.exit().remove();
        group.exit().remove();
        label.exit().remove();

        group.enter()
             .append('rect')
             .attr('rx',5)
             .attr('ry',5)
             .style('fill', function (d) { return node_color[group_nodes_by](d.id); })
             .style('opacity', group_opacity)
             .style('cursor', 'pointer')
             .call(cola2.drag);

        label.enter()
             .append('text')
             .attr('class', 'label')
             .attr('font-family', 'sans-serif')
             .text(function (d) { return d.id; })
             .call(cola2.drag);

        link.enter()
           .append('line') // insert before 'node' so that nodes show up on top
           .attr('class', 'link')
           .style('stroke-width', d => edge_width(1-d.cost))
           .style('stroke', d => d[color_edges_by] ? edge_color[color_edges_by](d[color_edges_by]) : default_edge_color)
           .style('opacity', edge_opacity);

        node.enter()
            .append('path')
            .attr('class', 'node')
            .attr('id', d => d.id)
            .attr('d', d => d[shape_nodes_by] ? node_shape[shape_nodes_by](d[shape_nodes_by]) : default_node_shape)  // should be able to change the size one day
            .style('fill', (d) => d[color_nodes_by] ? node_color[color_nodes_by](d[color_nodes_by]) : default_node_color)
            .style('stroke', 'white')
            .style('stroke-width', node_border_width)
            .style('cursor', 'pointer')
            .on('mouseover', (d) => set_highlight(d)).on('mouseout', (d) => remove_highlight())
            .on('click', function(d) { if (d3.event.metaKey) {window.open('http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d.id);} })
            .call(cola2.drag);
            // node.on('mousedown', (d) => set_focus(d));
            // node.on('mouseup', (d) => remove_focus(d));

        text.enter()
            .append('text')
            .attr('dy', '.35em')
            .style('font-size', base_text_size + 'px')
            .attr('font-family', 'sans-serif')
            .text(d => (text_center ? d.id : '\u2002' + d.id))
            .style('text-anchor', d => (text_center ? 'middle' : 'inherit') );
            // .attr('dx', d => (text_center ? 0 : (size(d.size) || default_node_size)) );



        cola2.nodes(graph.nodes)
            .links(links)
            // .groups(groups[group_nodes_by])
            .jaccardLinkLengths(repulsion_strength, 0.7)
            .avoidOverlaps(true)
            .start(50, 0, 50);



        cola2.on('tick', function () {

            node.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );
            text.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );

            link.attr('x1', (d) => d.source.x )
                .attr('y1', (d) => d.source.y )
                .attr('x2', (d) => d.target.x )
                .attr('y2', (d) => d.target.y );

            node.attr('cx', (d) => d.x )
                .attr('cy', (d) => d.y );

            if (group_nodes_by) {
                group.attr('x', (d) => d.bounds.x + d.padding / 2 )
                     .attr('y', (d) => d.bounds.y + d.padding / 2 )
                     .attr('width', (d) => d.bounds.width() - d.padding )
                     .attr('height',(d) => d.bounds.height() - d.padding );

                label.attr('x', (d) => d.bounds.x + d.padding / 2 )
                     .attr('y', (d) => d.bounds.y + d.padding / 2 );
            }
        });
    }


    function style({color_nodes_by_=color_nodes_by,
                    color_edges_by_=color_edges_by,
                    size_nodes_by_=size_nodes_by}={}) {

        color_nodes_by = color_nodes_by_;
        color_edges_by = color_edges_by_;
        size_nodes_by = size_nodes_by_;

        node.style('fill', (d) => (d[color_nodes_by] ? color[color_nodes_by](d[color_nodes_by]) : default_node_color) );

        color_legend.call(d3.legendColor().shapeWidth(30).orient('vertical').scale(color[color_nodes_by]).title(color_nodes_by));


    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Highlight    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_highlight(d) {
        node.style('stroke', (o) => (isConnected(d, o) ? highlight_color : 'white'));
        text.style('font-weight', (o) => (isConnected(d, o) ? 'bold' : 'normal'));
        link.style('stroke', (o) => (o.source.index == d.index || o.target.index == d.index ? highlight_color : default_edge_color));
    }

    function remove_highlight() {
        if (focus_node===null) {
            node.style('stroke', 'white');
            text.style('font-weight', 'normal');
            link.style('stroke', default_edge_color);
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
        'continuous_node_attributes': continuous_node_attributes,
        'categorical_node_attributes': categorical_node_attributes,


    }

}

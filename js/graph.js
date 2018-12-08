

function Graph(graph, nested_groups) {

    // TODO assert that all the graph.nodes have IDs

    var node_attributes = {};
    graph.nodes.forEach(node => Object.entries(node).forEach(([key, val]) => { node_attributes[key] = node_attributes[key] || []; node_attributes[key].push(val) }))

    // TODO remove attributes like ID, name which you don't want to color by

    var continuous_node_attributes = {};
    var categorical_node_attributes = {};
    Object.entries(node_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_node_attributes[attr] = _(d3.extent(vals).concat([0])).sortBy(); }
        else { categorical_node_attributes[attr] = _.uniq(vals); }
    });

    var edge_attributes = {};
    var edge_indices = new Map(graph.nodes.map((d, i) => [d.id, i]));
    graph.links.forEach(edge => {
        Object.entries(edge).forEach(([key, val]) => { edge_attributes[key] = edge_attributes[key] || []; edge_attributes[key].push(val) })
        Object.assign(edge, {'source_name': edge.source, 'target_name': edge.target, 'source': edge_indices.get(edge.source), 'target': edge_indices.get(edge.target), 'id':_([edge.source, edge.target]).sortBy().join('--')})
    });

    var continuous_edge_attributes = {};
    var categorical_edge_attributes = {};
    Object.entries(edge_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_edge_attributes[attr] = _(d3.extent(vals).concat([0])).sortBy(); }
        else { categorical_edge_attributes[attr] = _.uniq(vals); }
    });


    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var fix_nodes = false;
    var repulsion_strength = 20;

    var text_center = false;
    var text_styles = {
        'font-family': 'sans-serif',
        'font-weight': 500,
        'cursor': 'pointer',
        'text-anchor': 'start',
        'font-size': '10px',
    };

    var confidence_domain = [0, 1];
    var edge_width_range = [0.3, 5];
    var edge_width = d3.scaleLinear().domain(confidence_domain).range(edge_width_range).clamp(true).nice();

    var color_schemes = {
        'Blue_White_Red': ["blue","white","red"]
    }
    var node_color_scheme = 'Blue_White_Red';

    var schemeCategorical20 = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6',
                '#dd4477', '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', '#aaaa11',
                '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'];


    var node_color = _.fromPairs(Object.entries(continuous_node_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(color_schemes[node_color_scheme])])
                      .concat(Object.keys(categorical_node_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));
    var edge_color = _.fromPairs(Object.entries(continuous_edge_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(color_schemes[node_color_scheme])])
                      .concat(Object.keys(categorical_edge_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));

    var node_shape = _.fromPairs(Object.entries(categorical_node_attributes).map(([attr, domain]) => [attr, d3.scaleOrdinal(d3.symbols)]));

    var node_size  = _.fromPairs(Object.entries(continuous_node_attributes).map(([attr, domain]) => [attr, d3.scalePow().exponent(1).domain(domain).range([200, 1000]).clamp(true)]));

    var color_nodes_by = null;
    var color_edges_by = null;
    var shape_nodes_by = null;
    var size_nodes_by = null;

    var default_node_color = '#ccc';
    var default_edge_color = '#aaa';
    var default_node_shape = d3.symbolCircle;
    var default_node_size = 300;  // refers to node _area_.

    var group_nodes_by = null;
    var group_padding = 8;
    var group_boundary_margin = 32;
    graph.nodes.forEach(node => { node.height = node.width = group_boundary_margin; });
    var group_compactness = 0.000001;
    var group_opacity = 0.7;

    var highlight_color = 'blue';
    var highlight_trans = 0.1;
    var edge_opacity = 0.6;
    var node_border_width = 1;


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 0, right: 0, bottom: 0, left: 0};

    var w = window.innerWidth - (margin.left + margin.right);
    var h = window.innerHeight - (margin.top + margin.bottom);

    var svg = d3.select('#graph-container').append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    var g = svg.append('g');

    groupings = _.mapValues(categorical_node_attributes, (values, attr) => values.filter(v => v).map(value => {
        return {'id':value, 'leaves':graph.nodes.map((node, i) => node[attr] === value ? i : -1).filter(x => x > -1), 'groups':[], 'padding':group_padding}
    }));

    console.log(groupings);

    // Nest location groups here.
    // console.log(nested_groups);

    if ("location" in groupings) {

        groupings.location = groupings.location.filter(loc => loc.id !== 'extracellular');

        var plasma_membrane_index = _(groupings.location).findIndex(loc => loc.id === 'plasma_membrane');
        var cytoplasm_index       = _(groupings.location).findIndex(loc => loc.id === 'cytoplasm');

        groupings.location[plasma_membrane_index].groups.push(cytoplasm_index)

        groupings.location.forEach((loc, i) => { if (loc.id !== 'plasma_membrane' && loc.id !== 'cytoplasm') { groupings.location[cytoplasm_index].groups.push(i) } });

        // _(groupings.location).each(function (g) {g.padding = g.id === 'plasma_membrane' ? 0 : group_padding * (g.groups.length + 1);});

    }


    var linked = {};
    graph.links.forEach(function(d) { linked[d.source_name + ',' + d.target_name] = true; });

    function isConnected(a, b) {
        return linked[a.id + ',' + b.id] || linked[b.id + ',' + a.id] || a.id == b.id;
    }


    var focus_node = null;
    var force = null;
    var nodes = graph.nodes.map(node => Object.assign({}, node));
    var links = graph.links.map(edge => Object.assign({}, edge));
    var groups = (groupings[group_nodes_by] || []).map(group => Object.create(group));

    var d3_force = d3.forceSimulation();
    var cola_force = cola.d3adaptor(d3).size([w, h]);
    cola_force.groupCompactness = group_compactness;

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Legends    ///////
    /////////////////////////////////////////////////////////////////////////////

    var legends = svg.append('g').attr('class', 'legends');

    // var node_shape_legend = legends.append('g').styles(text_styles).call(d3.legendSymbol().scale(node_shape[shape_nodes_by]).orient('vertical').title(shape_nodes_by));
    // var node_color_legend = legends.append('g').styles(text_styles).call(d3.legendColor().scale(node_color[color_nodes_by]).orient('vertical').title(color_nodes_by));
    var edge_width_legend = legends.append('g').styles(text_styles).call(d3.legendSize().scale(edge_width).shape('line').orient('vertical').shapeWidth(40).labelAlign('start').shapePadding(10).title('Confidence'));
    // var edge_color_legend = legends.append('g').styles(text_styles).call(d3.legendColor().scale(edge_color[color_edges_by]).orient('vertical').title(color_edges_by));


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods   ///////
    /////////////////////////////////////////////////////////////////////////////

    var node = g.selectAll('.node');
    var text = g.selectAll('.text');
    var link = g.selectAll('.link');
    var group = g.selectAll('.group');
    var label = g.selectAll('.label');


    function render({fix_nodes_=fix_nodes,
                     repulsion_strength_=repulsion_strength,
                     group_nodes_by_=group_nodes_by}={}) {

        if (group_nodes_by !== group_nodes_by_) {

            group_nodes_by = group_nodes_by_;

            force.on('tick', null);

            // this isn't doing a good enough job of stopping the cola force.
            force.stop();
            node.on(".drag", null);
            // possibly need to add a line for removing cola drag handlers -- if they aren't under '.drag'

            groups = group_nodes_by ? _.cloneDeep(groupings[group_nodes_by]) : [];
        }

        fix_nodes = fix_nodes_;
        repulsion_strength = repulsion_strength_;

        nodes.forEach(d => {
            d.fx = fix_nodes ? d.x : null;
            d.fy = fix_nodes ? d.y : null;
        });

        node = node.data(nodes, d => d.id);
        text = text.data(nodes, d => d.id);
        link = link.data(links, d => d.id);
        group = group.data(groups, d => d.id);
        label = label.data(groups, d => d.id);

        node.exit().remove();
        text.exit().remove();
        link.exit().remove();
        group.exit().remove();
        label.exit().remove();

        node = node.enter()
            .append('path')
            .attr('class', 'node')
            .attr('id', d => 'node-'+d.id)
            .style('cursor', 'pointer')
            .on('mouseover', set_highlight)
            .on('mouseout', remove_highlight)
            // .on('mousedown', set_focus)
            // .on('mouseup', remove_focus)
            .on('click', d => { if (d3.event.metaKey) { window.open('http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d.id); } })
            .merge(node)

        text = text.enter()
            .append('text')
            .attr('dy', '.35em')
            .styles(text_styles)
            .text(d => (text_center ? d.id : '\u2002' + d.id))
            .style('text-anchor', d => (text_center ? 'middle' : 'inherit') )
            .attr('dx', d => (text_center ? 0 : Math.sqrt(node_size[size_nodes_by] ? node_size[size_nodes_by](d[size_nodes_by]) : default_node_size))/2 )
            .merge(text);

        link = link.enter()
           .insert('line', '.node')
           .attr('class', 'link')
           .style('stroke-width', d => edge_width(1-d.cost))
           .style('stroke', d => d[color_edges_by] ? edge_color[color_edges_by](d[color_edges_by]) : default_edge_color)
           .style('opacity', edge_opacity)
           .merge(link);

        group = group.enter()
             .insert('rect', '.link')
             .attr('rx',5)
             .attr('ry',5)
             .style('fill', d => node_color[group_nodes_by](d.id))
             .style("opacity", 0.7)
             .style('opacity', group_opacity)
             .style('cursor', 'pointer')
             .merge(group);

        label = label.enter()
             .insert('text', '.link')
             .attr('class', 'label')
             .styles(text_styles)
             .text(d => d.id)
             .merge(label);


        if (group_nodes_by) {

            force = cola_force.nodes(nodes)
                              .links(links)
                              .groups(groups)
                              .jaccardLinkLengths(repulsion_strength, 0.7)
                              .avoidOverlaps(true);

            force.on('tick', ticked).start(50, 0, 50);

            node.call(cola_force.drag);
            group.call(cola_force.drag);

        } else {

            force = d3_force.nodes(nodes)
                            .force("link", d3.forceLink(links)) // .strength(1/repulsion_strength+1)
                            .force("charge", d3.forceManyBody().strength(-2*repulsion_strength+10))
                            .force("center", d3.forceCenter(w/2,h/2))
                            .on('tick', ticked)
                            .alpha(1).restart();

            node.call(drag(force));

        }

    }

    function ticked() {

        // console.log('tick');

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

    }

    function drag(force) {

        function dragstarted(d) {
            if (!d3.event.active) { force.alphaTarget(0.3).restart(); }
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) { force.alphaTarget(0); }
            d.fx = null;
            d.fy = null;
        }

        return d3.drag()
                 .on("start", dragstarted)
                 .on("drag", dragged)
                 .on("end", dragended);
    }

    function style({color_nodes_by_=color_nodes_by,
                    color_edges_by_=color_edges_by,
                    size_nodes_by_=size_nodes_by,
                    edge_opacity_=edge_opacity,
                    node_color_scheme_=node_color_scheme,
                    shape_nodes_by_=shape_nodes_by}={}) {

        color_nodes_by = color_nodes_by_;
        color_edges_by = color_edges_by_;
        size_nodes_by = size_nodes_by_;
        edge_opacity = edge_opacity_;
        node_color_scheme = node_color_scheme_;
        shape_nodes_by = shape_nodes_by_;


        node.attr('d', configure_shape)
            .style('fill', (d) => d[color_nodes_by] ? node_color[color_nodes_by](d[color_nodes_by]) : default_node_color)
            .style('stroke', 'white')
            .style('stroke-width', node_border_width);

        // color_legend.call(d3.legendColor().shapeWidth(30).orient('vertical').scale(color[color_nodes_by]).title(color_nodes_by));

        link.style('opacity', edge_opacity);

        text.attr('dx', d => (text_center ? 0 : Math.sqrt(node_size[size_nodes_by] ? node_size[size_nodes_by](d[size_nodes_by]) : default_node_size))/2 );

    }

    function configure_shape(d) {

        var size = d[size_nodes_by] ? node_size[size_nodes_by](d[size_nodes_by]) : default_node_size;
        var shape = d[shape_nodes_by] ? node_shape[shape_nodes_by](d[shape_nodes_by]) : default_node_shape;

        return d3.symbol().type(shape).size(size)();

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
        if (focus_node === null) {
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

    function set_focus_by_id(id) { set_focus(d3.select(`#node-${id}`)); }

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
        svg.attr('width', $('#graph-container').innerWidth()).attr('height', $('#graph-container').innerHeight());
        w = $('#graph-container').innerWidth() - (margin.left + margin.right);
        h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on('resize', resize);

    resize();


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Return    ///////
    /////////////////////////////////////////////////////////////////////////////

    return {
        'render': render,
        'style' : style,
        'set_focus_by_id': set_focus_by_id,

        continuous_node_attributes: () => continuous_node_attributes,  // should be making a copy to be safe
        categorical_node_attributes: () => categorical_node_attributes,  // should be making a copy to be safe


    }

}

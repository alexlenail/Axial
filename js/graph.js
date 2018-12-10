

function Graph(graph, nested_groups) {

    if (!graph.nodes.every(node => node.id)) { window.alert("Every node must have an ID set, aborting."); return {}; }

    var node_attributes = {};
    graph.nodes.forEach(node => Object.entries(node).forEach(([key, val]) => { node_attributes[key] = node_attributes[key] || []; node_attributes[key].push(val) }))
    delete node_attributes['id'];

    var continuous_node_attributes = {};
    var categorical_node_attributes = {};
    Object.entries(node_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_node_attributes[attr] = d3.extent(vals)[0] > 0 ? d3.extent(vals) : _(d3.extent(vals).concat([0])).sortBy(); }
        else { categorical_node_attributes[attr] = _.uniq(vals); }
    });

    var edge_attributes = {};
    var edge_indices = new Map(graph.nodes.map((d, i) => [d.id, i]));
    graph.links.forEach(edge => {
        Object.entries(edge).forEach(([key, val]) => { edge_attributes[key] = edge_attributes[key] || []; edge_attributes[key].push(val) })
        Object.assign(edge, {'source_name': edge.source, 'target_name': edge.target, 'source': edge_indices.get(edge.source), 'target': edge_indices.get(edge.target), 'id':_([edge.source, edge.target]).sortBy().join('--')})
    });

    var blacklist = ['source', 'target', 'source_name', 'target_name', 'protein1', 'protein2', 'id'];
    blacklist.forEach(attr => { delete edge_attributes[attr] });

    var continuous_edge_attributes = {};
    var categorical_edge_attributes = {};
    var boolean_edge_attributes = {};
    Object.entries(edge_attributes).forEach(([attr, vals]) => {
        if (vals.every(val => [NaN, null, false, true, 0, 1].includes(val))) { boolean_edge_attributes[attr] = ""; }
        else if (vals.every(val => _.isNumber(val) || _.isNaN(val))) { continuous_edge_attributes[attr] = d3.extent(vals)[0] > 0 ? d3.extent(vals) : _(d3.extent(vals).concat([0])).sortBy(); }
        else { categorical_edge_attributes[attr] = _.uniq(vals); }
    });

    if ('cost' in continuous_edge_attributes) {
        graph.links.forEach(edge => Object.assign(edge, {'confidence': 1-edge.cost}));
        continuous_edge_attributes['confidence'] = _(continuous_edge_attributes['cost'].map(cost => 1-cost)).reverse();
    }

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var fix_nodes = false;
    var repulsion_strength = 20;
    var only_show_edges = "";

    var text_center = false;
    var text_styles = {
        'font-family': 'sans-serif',
        'font-weight': 500,
        'cursor': 'pointer',
        'text-anchor': 'start',
        'font-size': 10,
    };

    var edge_width_range = [0.3, 5];

    var color_schemes = {
        'Blue_White_Red': ["blue","white","red"],
        'Purple_White_Orange': ["purple","white","orange"]
    }
    var node_color_scheme = 'Blue_White_Red';
    var outline_color_scheme = 'Purple_White_Orange';
    var edge_color_scheme = 'Blue_White_Red';

    var schemeCategorical20 = ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6',
                '#dd4477', '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', '#aaaa11',
                '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'];


    var node_color = _.object(Object.entries(continuous_node_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(color_schemes[node_color_scheme])])
                      .concat(Object.keys(categorical_node_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));
    var edge_color = _.object(Object.entries(continuous_edge_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(color_schemes[edge_color_scheme])])
                      .concat(Object.keys(categorical_edge_attributes).map(attr => [attr, d3.scaleOrdinal(schemeCategorical20)])));

    var node_shape = _.object(Object.entries(categorical_node_attributes).map(([attr, domain]) => [attr, d3.scaleOrdinal(d3.symbols)]));

    var node_size  = _.object(Object.entries(continuous_node_attributes).map(([attr, domain]) => [attr, d3.scalePow().exponent(1).domain(domain).range([200, 1000]).clamp(true)]));

    var edge_width = _.object(Object.entries(continuous_edge_attributes).map(([attr, domain]) => [attr, d3.scaleLinear().domain(domain).range(edge_width_range).clamp(true).nice()]));

    var color_nodes_by = null;
    var outline_nodes_by = null;
    var shape_nodes_by = null;
    var size_nodes_by = null;
    var color_edges_by = null;
    var size_edges_by = null;

    var default_node_color = '#ccc';
    var default_outline_color = '#fff';
    var default_edge_color = '#aaa';
    var default_node_shape = d3.symbolCircle;
    var default_node_size = 300;  // refers to node _area_.
    var default_edge_size = 3;

    var group_nodes_by = null;
    var group_padding = 14;
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
    svg.on('click', function() { if (d3.event.target.localName === 'svg') { remove_focus(); } });


    var in_drag = false;

    groupings = _(categorical_node_attributes).mapObject((values, attr) => values.filter(v => v).map(value => {
        return {'id':value, 'leaves':graph.nodes.map((node, i) => node[attr] === value ? i : -1).filter(x => x > -1), 'groups':[], 'padding':group_padding}
    }));

    // Nest location groups here.
    // console.log(nested_groups);

    if ("location" in groupings) {

        groupings.location = groupings.location.filter(loc => loc.id !== 'extracellular');

        var plasma_membrane_index = _(groupings.location).findIndex(loc => loc.id === 'plasma_membrane');
        var cytoplasm_index       = _(groupings.location).findIndex(loc => loc.id === 'cytoplasm');

        groupings.location[plasma_membrane_index].groups.push(cytoplasm_index)

        groupings.location.forEach((loc, i) => { if (loc.id !== 'plasma_membrane' && loc.id !== 'cytoplasm') { groupings.location[cytoplasm_index].groups.push(i) } });

        _(groupings.location).each(function (g) {g.padding = g.id === 'plasma_membrane' ? 0 : group_padding;});

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

    var group_color_legend = legends.append('g').styles(text_styles).style('font-size', 14);
    var node_shape_legend = legends.append('g').styles(text_styles).style('font-size', 14);
    var node_color_legend = legends.append('g').styles(text_styles).style('font-size', 14);
    var outline_color_legend = legends.append('g').styles(text_styles).style('font-size', 14);
    var edge_width_legend = legends.append('g').styles(text_styles).style('font-size', 14);
    var edge_color_legend = legends.append('g').styles(text_styles).style('font-size', 14);




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
                     only_show_edges_=only_show_edges,
                     group_nodes_by_=group_nodes_by}={}) {


        fix_nodes = fix_nodes_;
        repulsion_strength = repulsion_strength_;
        only_show_edges = only_show_edges_;
        group_nodes_by = group_nodes_by_;

        groups = group_nodes_by ? clone(groupings[group_nodes_by]) : [];

        if (group_nodes_by) {

            d3_force.stop();
            force.on('tick', null);
            node.on(".drag", null);

        } else {

            cola_force.stop();
            node.on(".drag", null);

        }

        nodes.forEach(d => {
            d.fx = fix_nodes ? d.x : null;
            d.fy = fix_nodes ? d.y : null;
        });

        links = graph.links.filter(edge => only_show_edges ? edge[only_show_edges] : true);

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
            .on('click', set_focus)
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
           .merge(link);

        group = group.enter()
             .insert('rect', '.link')
             .attr('rx',5)
             .attr('ry',5)
             .style('fill', d => node_color[group_nodes_by](d.id))
             .style('opacity', group_opacity)
             .style('cursor', 'pointer')
             .merge(group);

        label = label.enter()
             .insert('text', '.link')
             .attr('class', 'label')
             .styles(text_styles)
             .style('font-size', 14)
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

        node.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );
        text.attr('transform', (d) => 'translate(' + d.x + ',' + d.y + ')' );

        link.attr('x1', (d) => d.source.x )
            .attr('y1', (d) => d.source.y )
            .attr('x2', (d) => d.target.x )
            .attr('y2', (d) => d.target.y );

        node.attr('cx', (d) => d.x )
            .attr('cy', (d) => d.y );

        if (group_nodes_by) {
            group.attr('x', (d) => d.bounds.x + d.padding )
                 .attr('y', (d) => d.bounds.y + d.padding )
                 .attr('width', (d) => d.bounds.width() - 2*d.padding )
                 .attr('height',(d) => d.bounds.height() - 2*d.padding );

            label.attr('x', (d) => d.bounds.x + d.padding )
                 .attr('y', (d) => d.bounds.y + d.padding );
        }

    }

    function drag(force) {

        function dragstarted(d) {
            in_drag = true;
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
            if (!fix_nodes) { d.fx = null; d.fy = null; }
            remove_focus();
            in_drag = false;
        }

        return d3.drag()
                 .on("start", dragstarted)
                 .on("drag", dragged)
                 .on("end", dragended);
    }

    function style({color_nodes_by_=color_nodes_by,
                    outline_nodes_by_=outline_nodes_by,
                    size_nodes_by_=size_nodes_by,
                    node_color_scheme_=node_color_scheme,
                    outline_color_scheme_=outline_color_scheme,
                    shape_nodes_by_=shape_nodes_by,
                    edge_opacity_=edge_opacity,
                    color_edges_by_=color_edges_by,
                    edge_color_scheme_=edge_color_scheme,
                    size_edges_by_=size_edges_by,}={}) {

        color_nodes_by = color_nodes_by_;
        outline_nodes_by = outline_nodes_by_;
        size_nodes_by = size_nodes_by_;
        node_color_scheme = node_color_scheme_;
        outline_color_scheme = outline_color_scheme_;
        shape_nodes_by = shape_nodes_by_;
        edge_opacity = edge_opacity_;
        color_edges_by = color_edges_by_;
        edge_color_scheme = edge_color_scheme_;
        size_edges_by = size_edges_by_;

        node.attr('d', configure_shape)
            .style('fill', (d) => d[color_nodes_by] ? node_color[color_nodes_by](d[color_nodes_by]) : default_node_color)
            .style('stroke', (d) => d[outline_nodes_by] ? node_color[outline_nodes_by](d[outline_nodes_by]) : default_outline_color)
            .style('stroke-width', node_border_width);

        link.style('opacity', edge_opacity)
            .style('stroke', (d) => d[color_edges_by] ? edge_color[color_edges_by](d[color_edges_by]) : default_edge_color)
            .style('stroke-width', (d) => d[size_edges_by] ? edge_width[size_edges_by](d[size_edges_by]) : default_edge_size);

        text.attr('dx', d => (text_center ? 0 : Math.sqrt(node_size[size_nodes_by] ? node_size[size_nodes_by](d[size_nodes_by]) : default_node_size))/2 );

        show_legends();

    }

    function configure_shape(d) {

        var size = d[size_nodes_by] ? node_size[size_nodes_by](d[size_nodes_by]) : default_node_size;
        var shape = d[shape_nodes_by] ? node_shape[shape_nodes_by](d[shape_nodes_by]) : default_node_shape;

        return d3.symbol().type(shape).size(size)();

    }

    function show_legends() {

        var next_legend_pos = 0;
        shown_legends = [];

        group_color_legend.selectAll('*').remove();
        if (group_nodes_by) {
            shown_legends.push(group_color_legend.call(d3.legendColor().scale(node_color[group_nodes_by]).orient('vertical').title(group_nodes_by))); } else { group_color_legend.selectAll('*').remove(); }

        node_shape_legend.selectAll('*').remove();
        if (shape_nodes_by) {
            scale = node_shape[shape_nodes_by].copy().range(d3.symbols.map(shape => d3.symbol().type(shape).size(100)()));
            shown_legends.push(node_shape_legend.call(d3.legendSymbol().scale(scale).orient('vertical').title(shape_nodes_by))); } else { node_shape_legend.selectAll('*').remove(); }

        node_color_legend.selectAll('*').remove();
        if (color_nodes_by && color_nodes_by !== group_nodes_by) {
            shown_legends.push(node_color_legend.call(d3.legendColor().scale(node_color[color_nodes_by]).orient('vertical').title(color_nodes_by))); } else { node_color_legend.selectAll('*').remove(); }

        outline_color_legend.selectAll('*').remove();
        if (outline_nodes_by && outline_nodes_by !== color_nodes_by && outline_nodes_by !== group_nodes_by) {
            shown_legends.push(outline_color_legend.call(d3.legendColor().scale(node_color[outline_nodes_by]).orient('vertical').title(outline_nodes_by))); } else { outline_color_legend.selectAll('*').remove(); }

        edge_width_legend.selectAll('*').remove();
        if (size_edges_by) {
            shown_legends.push(edge_width_legend.call(d3.legendSize().scale(edge_width[size_edges_by]).shape('line').orient('vertical').shapeWidth(40).labelAlign('start').shapePadding(10).title(size_edges_by))); edge_width_legend.selectAll(".swatch").style("stroke", "black"); } else { edge_width_legend.selectAll('*').remove(); }

        edge_color_legend.selectAll('*').remove();
        if (color_edges_by) {
            shown_legends.push(edge_color_legend.call(d3.legendColor().scale(edge_color[color_edges_by]).orient('vertical').title(color_edges_by))); } else { edge_color_legend.selectAll('*').remove(); }

        shown_legends.forEach(legend => {

            legend.attr('transform', 'translate(20,'+(next_legend_pos+20)+')');
            next_legend_pos += legend.node().getBBox().height+20;

        });

    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Highlight    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_highlight(d) {
        if (focus_node === null && !in_drag) {
            node.style('stroke', (o) => (isConnected(d, o) ? highlight_color : 'white'));
            text.style('font-weight', (o) => (isConnected(d, o) ? 'bold' : 'normal'));
            link.style('stroke', (o) => (o.source.index == d.index || o.target.index == d.index ? highlight_color : default_edge_color));
        }
    }

    function remove_highlight() {
        if (focus_node === null && !in_drag) {
            node.style('stroke', 'white');
            text.style('font-weight', text_styles['font-weight']);
            link.style('stroke', (d) => d[color_edges_by] ? edge_color[color_edges_by](d[color_edges_by]) : default_edge_color);
        }
    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Focus    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_focus_by_id(id) {
        if (!_.isNull(focus_node) && d3.select(`#node-${id}`).empty()) { remove_focus(); }
        else { d3.select(`#node-${id}`).dispatch('mousedown'); }
    }

    function set_focus(d) {

        if (d3.event.metaKey) { window.open('http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d.id); }

        set_highlight(d);
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

        focus_node = null;
        remove_highlight();

        g.selectAll('.node').style('opacity', 1);
        g.selectAll('.text').style('opacity', 1);
        g.selectAll('.link').style('opacity', edge_opacity);
        g.selectAll('.group').style('opacity', group_opacity);
        g.selectAll('.label').style('opacity', 1);
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

        continuous_node_attributes: () => clone(continuous_node_attributes),
        categorical_node_attributes: () => clone(categorical_node_attributes),

        continuous_edge_attributes: () => clone(continuous_edge_attributes),
        categorical_edge_attributes: () => clone(categorical_edge_attributes),
        boolean_edge_attributes: () => clone(boolean_edge_attributes),


    }

}

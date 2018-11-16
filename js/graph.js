

function Graph() {

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var w = window.innerWidth;
    var h = window.innerHeight;


    var focus_node = null;

    var show_only_solution_edges = false;
    var repulsion_strength = 100;
    var colorBy = "prize";
    var groupBy = null;
    var turnForceOff = false;

    var text_center = false;
    var outline = false;
    var highlight_color = "blue";
    var highlight_trans = 0.1;
    var default_node_color = "#ccc";
    var default_link_color = "#aaa";
    var edge_opacity = 0.6;
    var nominal_base_node_size = 8;
    var nominal_text_size = 10;
    var max_text_size = 24;
    var default_stroke_width = 1;
    var max_stroke = 16;
    var max_base_node_size = 36;
    var min_zoom = 0.2;
    var max_zoom = 7;
    var group_boundary_margin = 32;
    var group_compactness = 0.000001;
    var group_padding = 8;

    var tocolor = "fill";
    var towhite = "stroke";
    if (outline) {
        tocolor = "stroke"
        towhite = "fill"
    }

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");

    var cola = cola.d3adaptor(d3).size([w, h]);
    cola.groupCompactness = group_compactness;


    var min_confidence = 0;
    var max_confidence = 1;
    var edge_width = d3.scaleLinear().domain([0, 1]).range([0.3, 3]).clamp(true);

    var colors20 = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477",
                    "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc",
                    "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
    var color = {
        {% for attribute_name, metadata in attributes.items() if metadata['display'] in ['color_scale'] %}
            '{{attribute_name}}':d3.scaleLinear().domain({{ metadata['domain'] }}).range({{ metadata['range'] }}).nice(),
        {% endfor %}
        {% for attribute_name, metadata in attributes.items() if metadata['display'] in ['box'] %}
            '{{attribute_name}}': d3.scaleOrdinal(d3.schemePastel1),
        {% endfor %}
        {% for attribute_name, metadata in attributes.items() if metadata['display'] in ['color_category'] %}
            '{{attribute_name}}': d3.scaleOrdinal(colors20),
        {% endfor %}
    };

    var triangle = d3.symbol().type(d3.symbolTriangle).size(200)(),
         circle = d3.symbol().type(d3.symbolCircle).size(200)(),
         diamond = d3.symbol().type(d3.symbolDiamond).size(200)();

    var display_type = d3.scaleOrdinal().domain(['protein', 'TF', 'metabolite']).range([circle, triangle, diamond] );

    var size = d3.scalePow().exponent(1).domain([1, 100]).range([8, 24]);


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Legends    ///////
    /////////////////////////////////////////////////////////////////////////////

    // SYMBOL LEGEND
    var shapes = svg.append("g")
                    .attr("class", "legend_Symbol")
                    .attr("transform", "translate(20, 20)")
                    .style("stroke", "black")
                    .attr("font-family", "sans-serif")
                    .call(d3.legendSymbol()
                            .scale(display_type)
                            .orient("vertical")
                            .title("Node Type"));

    // COLOR LEGEND
    var colors = svg.append("g")
                    .attr("class", 'legendLinear color_Legend')
                    .attr("transform", "translate(20,340)")
                    .style("stroke", "black")
                    .attr("font-family", "sans-serif")
                    .call(d3.legendColor()
                            .shapeWidth(30)
                            .orient('vertical')
                            .scale(color[colorBy])
                            .title(colorBy));

    // WIDTH LEGEND
    var widths = svg.append("g")
                    .attr("class", "legendSizeLine")
                    .attr("transform", "translate(20, 160)")
                    .style("stroke", "black")
                    .attr("font-family", "sans-serif")
                    .call(d3.legendSize()
                            .scale(edge_width)
                            .shape("line")
                            .orient("vertical")
                            .shapeWidth(40)
                            .labelAlign("start")
                            .shapePadding(10)
                            .title("Confidence"));


    /////////////////////////////////////////////////////////////////////////////
                          ///////   Links Setup    ///////
    /////////////////////////////////////////////////////////////////////////////

    var linked = {};
    graph.links.forEach(function(d) { linked[d.source_name + "," + d.target_name] = true; });

    function isConnected(a, b) {
        return linked[a.id + "," + b.id] || linked[b.id + "," + a.id] || a.id == b.id;
    }

    function hasConnections(a) {
        for (var property in linked) {
            s = property.split(",");
            if ((s[0] == a.id || s[1] == a.id) && linked[property]) { return true; }
        }
        return false;
    }

    let isNumber = (n) => !isNaN(parseFloat(n)) && isFinite(n);


    /////////////////////////////////////////////////////////////////////////////
                          ///////   Groups Setup    ///////
    /////////////////////////////////////////////////////////////////////////////

    var groups = {
        {% for attribute_name, metadata in attributes.items() if metadata['display'] in ['box'] %}"{{attribute_name}}": {},{% endfor %}
    };

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
                          ///////    Setup Graph    ///////
    /////////////////////////////////////////////////////////////////////////////

    var node = g.selectAll(".node")
                .data(graph.nodes)
                .enter().append("path")
                .attr("class", "node")
                .attr("id", d => d.id)
                .attr("d", d => display_type(d.type))
                // .size(function(d) { return Math.PI * Math.pow(size(d.size) || nominal_base_node_size, 2); })
                .style(tocolor, (d) => (d[colorBy] ? color[colorBy](d[colorBy]) : default_node_color) )
                .style("stroke-width", default_stroke_width)
                .style(towhite, "white")
                .on("mouseover", (d) => set_highlight(d)).on("mouseout", (d) => remove_highlight());

    node.call(cola.drag);
    // node.on("mousedown", (d) => set_focus(d));
    // node.on("mouseup", (d) => remove_focus(d));

    var text = g.selectAll(".text")
                .data(graph.nodes)
                .enter().append("text")
                .attr("dy", ".35em")
                .style("font-size", nominal_text_size + "px")
                .attr("font-family", "sans-serif")
                .text((d) => (text_center ? d.id : '\u2002' + d.id))
                .style("text-anchor", (d) => (text_center ? "middle" : "inherit") )
                .attr("dx", (d) => (text_center ? 0 : (size(d.size) || nominal_base_node_size)) );


    var link = g.selectAll(".link");
    var group = g.selectAll('.group');
    var label = g.selectAll(".label");


    /////////////////////////////////////////////////////////////////////////////
                        ///////    Re-Draw Graph    ///////
    /////////////////////////////////////////////////////////////////////////////


    function restart() {
        // When we restart, we'd like to be able to change
        //  - which edges exist
        //  - how the nodes are grouped

        // Changing which links exist
        links = show_only_solution_edges ? graph.links.filter(function (l) {return l.in_solution}) : graph.links;
        link = link.data(links);
        link.exit().remove();
        link = link.enter()
                   .insert("line", ".node") // insert before "node" so that nodes show up on top
                   .attr("class", "link")
                   .style("stroke-width", function(d) {
                       if (isNumber(d.cost) && d.cost >= 0) { return edge_width(1-d.cost); }
                       else { return default_stroke_width; }
                   })
                   .style("stroke", function(d) {
                       if (isNumber(d.score) && d.score >= 0) { return color[colorBy](d.score); }
                       else { return default_link_color; }
                   })
                   .style("opacity", edge_opacity)
                   .merge(link);

        // Changing what the grouping is
        if (groupBy) {
            group = group.data([]);
            group.exit().remove();
            group = group.data(groups[groupBy])
                         .enter()
                         .insert('rect', '.link')
                         .attr('rx',5)
                         .attr('ry',5)
                         .style("fill", function (d) { return color[groupBy](d.id); })
                         .style("opacity", 0.7)
                         .call(cola.drag);

            label = label.data([]);
            label.exit().remove()
            label = label.data(groups[groupBy])
                         .enter()
                         .insert('text', '.group')
                         .attr("class", "label")
                         .attr("font-family", "sans-serif")
                         .text(function (d) { return d.id; })
                         .call(cola.drag);

            cola.nodes(graph.nodes)
                .links(links)
                // .links(turnForceOff ? [] : links)  # TODO
                .groups(groups[groupBy])
                .jaccardLinkLengths(repulsion_strength, 0.7)
                .avoidOverlaps(true)
                .start(50, 0, 50);

        } else {
            group = group.data([])
            group.exit().remove()
            cola.groups([]);

            label = label.data([]);
            label.exit().remove()

            cola.nodes(graph.nodes)
                .links(links)
                // .links(turnForceOff ? [] : links)  # TODO
                .jaccardLinkLengths(repulsion_strength, 0.7)
                .avoidOverlaps(true)
                .start(50, 0, 50);
        }

        cola.on('tick', function () {

            node.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")" );
            text.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")" );

            link.attr("x1", (d) => d.source.x )
                .attr("y1", (d) => d.source.y )
                .attr("x2", (d) => d.target.x )
                .attr("y2", (d) => d.target.y );

            node.attr("cx", (d) => d.x )
                .attr("cy", (d) => d.y );

            if (groupBy) {
                group.attr('x', (d) => d.bounds.x + d.padding / 2 )
                     .attr('y', (d) => d.bounds.y + d.padding / 2 )
                     .attr('width', (d) => d.bounds.width() - d.padding )
                     .attr('height',(d) => d.bounds.height() - d.padding );

                label.attr("x", (d) => d.bounds.x + d.padding / 2 )
                     .attr("y", (d) => d.bounds.y + d.padding / 2 );
            }
        });
    }

    function recolor() {
        node.style(tocolor, (d) => (d[colorBy] ? color[colorBy](d[colorBy]) : default_node_color) );

        colors.remove()
        colors = svg.append("g")
                    .attr("class", 'legendLinear color_Legend')
                    .attr("transform", "translate(20,340)")
                    .style("stroke", "black")
                    .attr("font-family", "sans-serif")
                    .call(d3.legendColor()
                            .shapeWidth(30)
                            .orient('vertical')
                            .scale(color[colorBy])
                            .title(colorBy));
    }

    restart();
    recolor();


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Highlight    ///////
    /////////////////////////////////////////////////////////////////////////////

    function set_highlight(d) {
        svg.style("cursor", "pointer");

        node.style(towhite, (o) => (isConnected(d, o) ? highlight_color : "white"));
        text.style("font-weight", (o) => (isConnected(d, o) ? "bold" : "normal"));
        link.style("stroke", (o) => (o.source.index == d.index || o.target.index == d.index ? highlight_color : default_link_color));
    }

    function remove_highlight() {
        if (focus_node===null) {
            node.style(towhite, "white");
            text.style("font-weight", "normal");
            link.style("stroke", default_link_color);
        }
    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Focus    ///////
    /////////////////////////////////////////////////////////////////////////////

    node.on("click", function(d) { if (shiftKey) {shiftKey = false; window.open("http://www.genecards.org/cgi-bin/carddisp.pl?gene="+d.id);} });

    function set_focus(d) {
        d3.event.stopPropagation();
        focus_node = d3.select(this);
        // console.log('set_focus');
        if (highlight_trans < 1) {
            node.style("opacity", (o) => (isConnected(d, o) ? 1 : highlight_trans));
            text.style("opacity", (o) => (isConnected(d, o) ? 1 : highlight_trans));
            link.style("opacity", (o) => (o.source.index == d.index || o.target.index == d.index ? 1 : highlight_trans));
            group.style("opacity", (o) => (highlight_trans * 2));
            label.style("opacity", (o) => (highlight_trans * 2));
        }
    }

    function remove_focus() {
        focus_node = null;
        // console.log('remove_focus');
        d3.event.stopPropagation();
        node.style("opacity", 1);
        text.style("opacity", 1);
        link.style("opacity", edge_opacity);
        group.style("opacity", 0.6);
        label.style("opacity", 1);
        remove_highlight();
    }

    var shiftKey;

    function keypress() { shiftKey = d3.event.shiftKey || d3.event.metaKey; }

    d3.select("body").on("keydown", keypress).on("keyup", keypress);

    /////////////////////////////////////////////////////////////////////////////
                        ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

    svg.call(d3.zoom()
               .scaleExtent([1 / 2, 8])
               .on("zoom", zoomed));

    function zoomed() { g.attr("transform", d3.event.transform); }


    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
    }

    d3.select(window).on("resize", resize)

    resize();

    return {


    }

}

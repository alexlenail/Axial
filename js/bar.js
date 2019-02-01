
function Bar(names_and_differentials) {

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 0, bottom: 0, left: 0};

    var w = $('#graph-container').innerWidth() - (margin.left + margin.right);
    var h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);

    var row_thickness = 24;
    var margin_between_bars = 1;
    var margin_between_rows = 10;

    var animation_duration = 700;

    var minLogFC = -6;
    var maxLogFC = 6;

    var colors;
    var color;
    var show_legends = false;

    var fc_threshold = 0;
    var q_threshold = 0;
    let is_differential = (d) => _(d).has('q') && _(d).has('logFC') && d.q > q_threshold && Math.abs(d.logFC) > fc_threshold;

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select('#graph-container').append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    var g = svg.append('g');
    svg.style('cursor', 'move');

    var x_neg = d3.scaleLinear().domain([minLogFC, 0]).rangeRound([0, w/2 - 50]).nice();
    var x_pos = d3.scaleLinear().domain([0, maxLogFC]).rangeRound([w/2 + 50, w]).nice();

    neg_axis = d3.axisTop(x_neg);
    pos_axis = d3.axisTop(x_pos);
    g.append('g').attr('class', 'axis axis--x').call(neg_axis);
    g.append('g').attr('class', 'axis axis--x').call(pos_axis);

    var neg_grid = d3.axisTop(x_neg).tickFormat('').tickSize(-h);
    var pos_grid = d3.axisTop(x_pos).tickFormat('').tickSize(-h);

    var grid_left = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(neg_grid);
    var grid_right = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(pos_grid);

    var title = g.append('text')
                 .attr('class', 'title')
                 .attr('font-family', 'sans-serif')
                 .text('')
                 .style('text-anchor', 'middle')
                 .attr('x', (x_pos(0) + x_neg(0)) / 2)
                 .attr('y', 0)
                 .attr('dy', '-3em');


    var legends = g.append('g').attr('class', 'legends');

    var color_legend = legends.append('g')
                              .attr('class', 'legend')
                              .style('font-family', 'sans-serif')
                              .style('cursor', 'pointer')
                              .style('text-anchor', 'start')
                              .call(d3.drag().on('drag', function () {d3.select(this).attr('transform', 'translate('+d3.event.x+','+d3.event.y+')')}));

    var selected_datasets = Object.keys(names_and_differentials);
    var sort_by = selected_datasets[0];
    var selected_gene_set_name = '';
    var selected_genes = [];
    var data;


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_datasets_=selected_datasets,
                      selected_gene_set_name_=selected_gene_set_name,
                      selected_genes_=selected_genes,
                      sort_by_=sort_by,
                      q_threshold_=q_threshold,
                      fc_threshold_=fc_threshold}={}) {

        selected_datasets = selected_datasets_;
        selected_gene_set_name = selected_gene_set_name_;
        selected_genes = selected_genes_;
        sort_by = sort_by_;
        q_threshold = q_threshold_;
        fc_threshold = fc_threshold_;

        selected_genes = _.uniq(selected_genes);

        data = selected_genes.map(selected_gene => {return {'id':selected_gene, 'levels': selected_datasets.map(dataset_name => Object.assign({'dataset':dataset_name}, names_and_differentials[dataset_name][selected_gene])).filter(d => d.logFC)}})
                             .filter(selected_gene_and_levels => Object.values(selected_gene_and_levels.levels).some(is_differential))
                             .sort((a,b) => {
                                a_ = names_and_differentials[sort_by][a.id];
                                b_ = names_and_differentials[sort_by][b.id];
                                return a_ ? (b_ ? (b_.logFC - a_.logFC) : -1) : 1;
                             });

        render();

    }

    function render({row_thickness_=row_thickness,
                     margin_between_bars_=margin_between_bars,
                     margin_between_rows_=margin_between_rows}={}) {

        row_thickness = row_thickness_;
        margin_between_bars = margin_between_bars_;
        margin_between_rows = margin_between_rows_;

        var indexer = _.object(data.map((gene, i) => [gene.id, i]));

        var bar_thickness = (row_thickness - ((selected_datasets.length-1) * margin_between_bars)) / selected_datasets.length;
        var y_max = (data.length * (row_thickness + margin_between_rows)) + margin.top;

        let y = (id) => indexer[id] * (row_thickness + margin_between_rows) + margin_between_rows;
        let x_start = (x) => x > 0 ? x_pos(0) : x_neg(x);
        let x_width = (x) => x > 0 ? x_pos(x)-x_pos(0) : x_neg(0)-x_neg(x);
        let x_start_before_animation = (x) => x > 0 ? x_pos(0) : x_neg(0);

        title.text(selected_gene_set_name)

        var rows = g.selectAll('.row').data(data, d => d.id);
        var t = d3.transition().duration(animation_duration);

        rows.exit().remove();

        rows.transition(t).attr('transform', d => `translate(0,${y(d.id)})`)

        var bars = rows.enter()
            .append('g')
            .attr('class', 'row')
            .attr('id', d => d.id)
            .attr('transform', d => `translate(0,${y(d.id)})`)
                .append('a')
                .attr('class', 'a')
                .attr('xlink:href', d => 'http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d.id)
                .style('cursor', 'pointer')
                    .append('text')
                    .attr('class', 'text')
                    .attr('font-family', 'sans-serif')
                    .text(d => d.id)
                    .style('text-anchor', 'middle')
                    .attr('x', (x_pos(0) + x_neg(0)) / 2)
                    .attr('dy', '1em')
                .select(function() { return this.parentNode; })
            .select(function() { return this.parentNode; })
            .merge(rows)
            .selectAll('.bar').data(gene_and_levels => gene_and_levels.levels, level => level.dataset)

        bars.exit()
            .transition(t)
            .attr('x', (d) => x_start_before_animation(d.logFC) )
            .attr('width', 0)
            .attr('height', 0)
            .remove();

        bars.transition(t)
            .attr('y', (d, i) => (bar_thickness + margin_between_bars) * i)
            .attr('height', bar_thickness);

        bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', (d, i) => (bar_thickness + margin_between_bars) * i)
            .attr('height', bar_thickness)
            .attr('x', d => d ? x_start_before_animation(d.logFC) : 0)
            .attr('width', 0)
            .style('fill', d => d ? color[d.dataset](d) : 'white')
            .transition(t)
                .attr('x', d => d ? x_start(d.logFC) : 0)
                .attr('width', d => d ? x_width(d.logFC) : 0);

        // grid lines
        neg_grid = neg_grid.tickSize(-y_max);
        pos_grid = pos_grid.tickSize(-y_max);

        grid_left.remove();
        grid_right.remove();
        grid_left = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(neg_grid);
        grid_right = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(pos_grid);

    }

    function style({colors_=colors,
                    show_legends_=show_legends}={}) {

        colors = colors_;
        show_legends = show_legends_;

        color = _(names_and_differentials).mapObject((val, name) => {
            return (d) => d.logFC < 0 ? colors[name].low : colors[name].high
        });

        // Legends
        if (show_legends) { configure_legends(); }
        else { color_legend.selectAll('*').remove(); }

    }

    function configure_legends() {

        color_legend.call(d3.legendColor().scale(d3.scaleOrdinal(
            flatten(Object.keys(colors).map(system => [`${system} down`, `${system} up`])),
            flatten(Object.values(colors).map(colors => [colors['low'], colors['high']]))
        )).title('Colors')).attr('transform', 'translate(0,20)');

    }

    /////////////////////////////////////////////////////////////////////////////
                          ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

    svg.call(d3.zoom().on('zoom', zoomed)).on('wheel.zoom', wheeled);

    transform = d3.zoomTransform(g);
    transform.x += margin.left;
    transform.y += margin.top;
    g.attr('transform', transform);

    function zoomed() {
        current_transform = d3.zoomTransform(g);
        current_transform.x += d3.event.sourceEvent.movementX;
        current_transform.y += d3.event.sourceEvent.movementY;
        g.attr('transform', current_transform);
    }

    function wheeled() {
        current_transform = d3.zoomTransform(g);
        current_transform.y = clamp(-(g.node().getBBox().height-window.innerHeight-100), 100)(current_transform.y - d3.event.deltaY);
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
        'render' : render,
        'style'  : style,

        get_sorted_gene_list : () => data.map(d => d.id),

        colors: () => _.clone(colors),

    }

}

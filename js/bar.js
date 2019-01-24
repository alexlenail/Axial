let clamp = (min, max) => ((x) => Math.min(Math.max(x, min), max));

function Bar(names_and_differentials) {

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 0, bottom: 0, left: 0};

    var w = $('#graph-container').innerWidth() - (margin.left + margin.right);
    var h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);

    var row_thickness = 24;
    var margin_between_bars = 4;
    var margin_between_rows = 10;
    var offset_from_top = 10;

    var animation_duration = 1000;

    var minLogFC = -6;
    var maxLogFC = 6;

    var low_color = 'blue';
    var center_color = 'white'
    var high_color = 'red';
    // var color = d3.scaleLinear().domain([minLogFC, 0, maxLogFC])
    //                             .range([low_color, center_color, high_color]);
    let color = (logFC) => logFC < 0 ? low_color : high_color;


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

    var logFCs = [];

    var selected_datasets = Object.keys(names_and_differentials);
    var index_of_sort_by_dataset = 0;
    var selected_gene_set_name = '';
    var selected_genes = [];


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Re-Draw Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_datasets_=selected_datasets,
                      selected_gene_set_name_=selected_gene_set_name,
                      selected_genes_=selected_genes,
                      q_threshold_=q_threshold,
                      fc_threshold_=fc_threshold}={}) {

        selected_datasets = selected_datasets_;
        selected_gene_set_name = selected_gene_set_name_;
        selected_genes = selected_genes_;
        q_threshold = q_threshold_;
        fc_threshold = fc_threshold_;


        data = selected_genes.map(selected_gene => {return {'id':selected_gene, 'levels': selected_datasets.map(name => names_and_differentials[name][selected_gene])}})
                             .filter(selected_gene_and_levels => Object.values(selected_gene_and_levels.levels).some(is_differential))
                             .sort((a,b) => b.levels[index_of_sort_by_dataset].logFC - a.levels[index_of_sort_by_dataset].logFC);

        title.text(selected_gene_set_name)

        var t = d3.transition().duration(animation_duration);

        var rows = g.selectAll('.row').data(data, d => d.id);

        var indexer = _.object(data.map((gene, i) => [gene.id, i]));

        var bar_thickness = (row_thickness - ((selected_datasets.length-1) * margin_between_bars)) / selected_datasets.length;

        var y_max = (data.length * (row_thickness + margin_between_rows)) + margin.top;

        let y = (id) => indexer[id] * (row_thickness + margin_between_rows) + offset_from_top;
        let x_start = (x) => x > 0 ? x_pos(0) : x_neg(x);
        let x_width = (x) => x > 0 ? x_pos(x)-x_pos(0) : x_neg(0)-x_neg(x);
        let x_start_before_animation = (x) => x > 0 ? x_pos(0) : x_neg(0);

        rows.exit().remove();

        // rows.exit().selectAll('.bar')
        //    .transition(t)
        //    .attr('x', (d) => x_start_before_animation(d.logFC) )
        //    .attr('width', 0)
        //    .remove();

        rows.transition(t).attr('transform', d => `translate(0,${y(d.id)})`)
        rows.enter()
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
            .selectAll('.bar').data(gene_and_levels => gene_and_levels.levels).enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('y', (d, i) => (bar_thickness + margin_between_bars) * i )
                .attr('height', bar_thickness)
                .attr('x', d => x_start_before_animation(d.logFC) )
                .attr('width', 0)
                .style('fill', d => color(d.logFC))
                .transition(t)
                    .attr('x', d => x_start(d.logFC) )
                    .attr('width', d => x_width(d.logFC) );

        // grid lines
        neg_grid = neg_grid.tickSize(-y_max);
        pos_grid = pos_grid.tickSize(-y_max);

        grid_left.remove();
        grid_right.remove();
        grid_left = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(neg_grid);
        grid_right = g.append('g').attr('class', 'grid').style('stroke', '#ddd').style('opacity', 0.1).call(pos_grid);

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

        DEgenes  : () => _(data.filter(is_differential)).pluck('id'),

        get_sorted_gene_list : () => _(data.filter(is_differential)).pluck('id'),  // TODO

    }

}

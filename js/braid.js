
function Braid(samples_by_genes_matrix, gene_sets, classes) {

    // samples_by_genes_matrix: {'sample_id': {'gene1': float, 'gene2': float}};

    // gene_sets: {'gene_set_name': ['gene1', 'gene2']};

    // classes: {'sample_id': {'category1': 'value', 'category2': value}}

    // categories: ['column_name_of_sample_class_labels_1', 'column_name_of_sample_class_labels_2']
    var categories = _.uniq(_.flatten(Object.values(classes).map(obj => Object.keys(obj))));

    // categories_to_members_to_values: {'category': {'sample_id1': 'value', 'sample_id2': value}}
    var categories_to_members_to_values = _.object(categories.map((category) =>
        [category, _.object(Object.entries(classes).map(([sample_id, categories_to_values]) => [sample_id, categories_to_values[category]]))]
    ));

    // categories_to_values_to_members: {'category': {'value1': ['sample_id1', 'sample_id2']}}  <- I need this one
    var categories_to_values_to_members = _(categories_to_members_to_values).mapObject((samples_to_values) =>
        _(_(Object.entries(samples_to_values)).groupBy(([sample_id, value]) => value)).mapObject((arr_of_arr) => arr_of_arr.map(arr => arr[0]))
    );

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Structure Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 100, bottom: 0, left: 100};

    var w = $("#graph-container").innerWidth() - (margin.left + margin.right);
    var h = $("#graph-container").innerHeight() - (margin.top + margin.bottom);

    var values = 'counts';
    var show_averages = false;
    var scaling = 'mean';
    var sorting = 'complete';
    var reordering = true;
    var minimum_nonzero = 0;

    var scale_types = {
        mean     : () => d3.scaleLinear(),
        absolute : () => d3.scaleLinear(),
        log      : () => d3.scaleLog().clamp(true),  // in the future this will be a magic scale: https://stackoverflow.com/questions/51584888/how-to-write-a-d3-positive-and-negative-logarithmic-scale
    };
    var domains = {};
    var ranges = {};
    var brush_selections = {};

    value_accessors = {
        counts: (gene) => gene.counts,
        zscore_stddev: (gene) => gene.samples.map((sample) => sample.zscore_stddev),
        zscore_mad: (gene) => gene.samples.map((sample) => sample.zscore_mad),
    }
    value_accessor = value_accessors.counts;


    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var show_points = true;
    var point_radius = 3;
    var point_opacity = 1;
    var point_coloring_system = 'identity';
    var points_color_by = categories[0];
    var default_point_color = '#333333';
    var show_lines = true;
    var show_halos = true;
    var line_coloring_system = 'identity';
    var lines_color_by = categories[0];
    var default_line_color = '#333333';
    var negative_color = '#0000cc';
    var middle_color = '#c0c0c0';
    var positive_color = '#cc0000';
    var curve = 'linear';
    var line_width = 1;
    var line_opacity = 1.0;
    var halo_width = 20;
    var halo_opacity = 0.1;
    var axis_spacing = 50;
    var max_point_radius = 20;
    var show_legends = false;


    var colors20 = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477",
                    "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc",
                    "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];

    var line_bendiness = 0.5;
    var curves = {
        'linear'   : d3.curveLinear,
        'natural'  : d3.curveNatural,
        'catmull'  : d3.curveCatmullRom.alpha(line_bendiness),
        'monotone' : d3.curveMonotoneY,
        'cardinal' : d3.curveCardinal.tension(1-line_bendiness),
    }


    var id_colors = d3.scaleOrdinal(d3.schemeCategory10);
    var class_colors = _.object(categories, categories.map(c => d3.scaleOrdinal(d3.schemeCategory10)));
    let color_range = (gene, attr) => {
        samples = _.object(gene_wise[gene_wise_indexer[gene]].samples.map(sample => [sample.sample, sample[attr]]));
        domain = d3.extent(Object.values(samples)); domain.splice(1, 0, 0);
        scale = d3.scaleLinear().domain(domain).range([negative_color, middle_color, positive_color]);
        return [(sample) => scale(samples[sample]), scale]
    }
    var zscore_stddev_colors = null;
    var zscore_stddev_color_scale = null;
    var zscore_mad_colors = null;
    var zscore_mad_color_scale = null;
    var samples_pc1_domain = [];
    var pc1_colors = null;

    var point_colors = {
        identity: (d) => id_colors(d.sample),
        class: (d) => class_colors[points_color_by](d.classes[points_color_by]),
        uniform: (d) => default_point_color,
    }

    var line_colors = {
        identity: (d) => id_colors(d.sample),
        class: (d) => class_colors[lines_color_by](d.classes[lines_color_by]),
        uniform: (d) => default_line_color,
        zscore_stddev: (d) => zscore_stddev_colors(d.sample),
        zscore_mad: (d) => zscore_mad_colors(d.sample),
        pc1: (d) => pc1_colors(d.pc1),
    }

    var line_from_sample = d3.line()
                              .y((d, i) => y(i))
                              .x((d) => x_scales[d.gene](d.value))
                              .curve(curves[curve]);


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");

    var gene_set_name = "";
    var genes = [];
    var gene_wise = [];
    var gene_wise_indexer = {};
    var ordered_gene_wise = [];
    var sample_wise = [];
    var x_scales = {};
    var genes_pc1 = [];
    var samples_pc1 = [];

    var x_scales = {};
    var y = (index) => axis_spacing*index;

    function idFunc(d) { return d ? d.id : this.id; }

    var axes = g.selectAll(".axis");
    var dots = g.selectAll(".dots");
    var line = g.selectAll(".line");
    var halo = g.selectAll(".halo");

    var title = g.append("text")
                 .attr("class", "title")
                 .attr("font-family", "sans-serif")
                 .text("")
                 .style("text-anchor", "middle")
                 .attr("x", 0)
                 .attr("y", 0)
                 .attr("dy", "-3em");

    var legend_lines = g.append("g").attr("class", "legend legendLines");
    var legend_points = g.append("g").attr("class", "legend legendPoints");


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_gene_set_name=gene_set_name,
                      selected_genes=genes}={}) {

        gene_set_name = selected_gene_set_name;
        genes = selected_genes;
        matrix = _(samples_by_genes_matrix).mapObject((sample) => _(sample).pick(genes));

        // Gene-Wise
        gene_wise =
            _.zip(
                _(_(matrix).values()[0]).keys(),
                _.zip(..._(matrix).values().map((gene_counts) => _(gene_counts).values())).map((gene_counts) =>
                    _.object(_(matrix).keys(), gene_counts)
            )).map(([gene, counts]) => {
                counts_arr = Object.values(counts);
                num_nonzeros = counts_arr.filter(e => e !== 0).length;
                mean = d3.mean(counts_arr);
                stddev = d3.deviation(counts_arr);
                mad = d3.mean(counts_arr.map((count) => Math.abs(mean - count)));
                return {
                'id'       : gene,
                'gene'     : gene,
                'num_nonzeros': num_nonzeros,
                'min'      : d3.min(counts_arr),
                'max'      : d3.max(counts_arr),
                'mean'     : mean,                  // should we only be counting non-zeros?
                'stddev'   : stddev,
                'mad'      : mad,
                'pc1'      : null,
                'counts'   : counts_arr,
                'samples'  : Object.entries(counts).map(([sample, count]) => { return {
                    'id'            : sample+"_"+gene,
                    'sample'        : sample,
                    'classes'       : classes[sample],
                    'gene'          : gene,
                    'counts'        : count,
                    'zscore_stddev' : stddev === 0 ? 0 : (count - mean) / stddev,
                    'zscore_mad'    : mad === 0 ? 0    : (count - mean) / mad,
                }}),
                'classes':
                    _(categories_to_values_to_members).mapObject((values_to_members) =>
                        _(values_to_members).mapObject((sample_ids, label) => {
                            class_counts = _(counts).pick(sample_ids);
                            class_mean = d3.mean(class_counts);
                            class_stddev = d3.deviation(class_counts);
                            class_mad = d3.mean(Object.values(class_counts).map((count) => Math.abs(class_mean - count)));
                            return {
                            'label'        : label,
                            'class_mean'   : class_mean,
                            'class_stddev' : class_stddev,
                            'class_mad'    : class_mad,
                            }
                        })
                    ),
                }
            });

        gene_wise_indexer = _.object(gene_wise.map((gene, i) => [gene.id, i]));

        order();
        render();

    }

    function order({values_=values,
                    sorting_=sorting,
                    minimum_nonzero_=minimum_nonzero}={}) {

        if (values_ !== values) { brush_selections = {}; }
        values = values_;
        value_accessor = value_accessors[values];
        sorting = sorting_;
        minimum_nonzero = minimum_nonzero_;
        if (minimum_nonzero > 0) { gene_set_name = ""; }

        // Filter by number non-zeros
        ordered_gene_wise = gene_wise.filter((gene) => gene.num_nonzeros >= minimum_nonzero);

        if (ordered_gene_wise.length === 0) { sample_wise = []; return }

        // Set Gene-Wise PC1
        genes_pc1 = reorder.pca1d(reorder.transpose(ordered_gene_wise.map(value_accessor)));
        _(_.zip(ordered_gene_wise, genes_pc1)).each((gene, pc1) => gene.pc1 = pc1);

        // Order Genes
        if (reordering && ordered_gene_wise.length > 1) {

            if (sorting === 'pc1') {
                permutation_order = reorder.sort_order(genes_pc1);
            } else if (sorting === 'complete') {
                permutation_order = reorder.optimal_leaf_order()(ordered_gene_wise.map(value_accessor)).reverse();  // get dendogram out?
            } else { console.log(' this should never happen '); }

            ordered_gene_wise = reorder.stablepermute(ordered_gene_wise, permutation_order);

        } else { permutation_order = range(ordered_gene_wise.length); }

        // Build Sample-Wise
        sample_wise = Object.entries(matrix).map(([sample, genes]) => { return {
                        'id'     : sample,
                        'sample' : sample,
                        'classes': classes[sample],
                        'pc1'    : null,
                        'genes'  : reorder.stablepermute(
                                    Object.entries(genes).map(([gene, count]) => { return {
                                      'id'       : gene+"_"+sample,
                                      'gene'     : gene,
                                      'value'    : values === 'counts' ? count : _(gene_wise[gene_wise_indexer[gene]].samples).findWhere({'sample':sample})[values],
                                      'num_nonzeros': gene_wise[gene_wise_indexer[gene]].num_nonzeros,
                                    }}).filter((gene) => gene.num_nonzeros >= minimum_nonzero),
                                    permutation_order)
                      }});

        // Set Sample-Wise PC1
        samples_pc1 = reorder.pca1d(ordered_gene_wise.map(value_accessor));
        _(_.zip(sample_wise, samples_pc1)).each(([sample, pc1]) => { sample.pc1 = pc1; });
        samples_pc1_domain = d3.extent(samples_pc1);  // hack TODO get rid of this.

        // Add Averages
        if (show_averages) {
            console.log('show averages! append to sample wise! ');
            // sample_wise.append()
        }

        // Domains and Ranges
        recompute_domains_and_ranges();

    }

    function recompute_domains_and_ranges() {

        arr2d = ordered_gene_wise.map(value_accessor);
        min = d3.min(arr2d.map((a) => d3.min(a)));
        max = d3.max(arr2d.map((a) => d3.max(a)));

        if      (min >= 0) { min = 0; }
        else if (max <= 0) { max = 0; }
        else {
            abs_max = d3.max([min, max].map(Math.abs));
            min = -abs_max;
            max = abs_max;
        }

        if (scaling === 'absolute') {

                domains = _.object(gene_wise.map((gene) => [gene.id, [min, max]]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));

        } else if (scaling === 'mean') {

            if (values === 'counts') {
                domains = _.object(gene_wise.map((gene) => [gene.id, [0, d3.max([gene.mean*2, 10])] ]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));
            }
            else if (values === 'zscore_stddev') {
                domains = _.object(gene_wise.map((gene) => [gene.id, [-3, 3] ]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));
            }
            else if (values === 'zscore_mad') {
                domains = _.object(gene_wise.map((gene) => [gene.id, [-3, 3] ]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));
            }

        } else if (scaling === 'log') {

            if (values === 'counts') {
                domains = _.object(gene_wise.map((gene) => [gene.id, [1, round_to_power_of_10(max)]]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));
            }
            else if (values === 'zscore_stddev' || values === 'zscore_mad') {
                domains = _.object(gene_wise.map((gene) => [gene.id, [min, max].map(round_to_power_of_10)]));
                ranges  = _.object(gene_wise.map((gene) => [gene.id, [50,h]]));
            }
        }

    }

    function render({scaling_=scaling,
                     show_averages_=show_averages,
                     axis_spacing_=axis_spacing}={}) {

        if (scaling_ !== scaling) { scaling = scaling_; recompute_domains_and_ranges(); }
        show_averages = show_averages_;
        axis_spacing = axis_spacing_;
        selected_samples = selectedSamples();

        title.text(gene_set_name);

        x_scales = _.object(ordered_gene_wise.map((gene) => [gene.id, scale_types[scaling]().domain(domains[gene.id]).range(ranges[gene.id]).nice()]));

        axes = g.selectAll(".axis").data(Object.entries(x_scales), function(d) { return d ? d[0] : this.id; });
        dots = g.selectAll(".dots").data(ordered_gene_wise, idFunc);
        line = g.selectAll(".line").data(sample_wise, idFunc);
        halo = g.selectAll(".halo").data(sample_wise, idFunc);

        // phase 1
            // lines and halos which are updating are hidden and updated
            // lines and exiting are hidden then removed
        t_last = d3.transition().duration(200);
        if (line.enter().size() === 0) {  // if lines are already drawn,
            line.exit().transition(t_last).style("stroke-opacity", 0).remove();
            halo.exit().transition(t_last).style("stroke-opacity", 0).remove();
            line.transition(t_last).style("stroke-opacity", 0).on("end", function(d) { d3.select(this).attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes)); });
            halo.transition(t_last).style("stroke-opacity", 0).on("end", function(d) { d3.select(this).attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes)); });
            t_last = t_last.transition().duration(500);
        }

        // phase 2
            // old axes collapse to 0
            // old gene symbols lose opacity
            // rows of dots corresponding to old genes disappear
        if (axes.exit().size() > 0) {
            axes.exit().transition(t_last).style("opacity", 0).remove();
            dots.exit().transition(t_last).style("opacity", 0).remove();
            t_last = t_last.transition().duration(500);
        }

        // phase 3
            // axes which are staying get re-arranged
            // gene symbols which are staying get re-arranged
            // dots which are staying get re-arranged
        if (axes.size() > 0) {
            axes.order()
            axes.transition(t_last).attr("transform", (d, i) => "translate(0," + y(i) + ")");
            axes.each(function (d) { d3.select(this).select('.sub').call(d3.axisBottom(d[1])) });
            axes.each(function (d) { d3.select(this).select('.brush').call(d3.brushX().extent([[50,-10],[h,10]]).move, (d[0] in brush_selections ? [d[1](brush_selections[d[0]][0]), d[1](brush_selections[d[0]][1])] : null))  });
            dots.order()
            dots.transition(t_last).attr("transform", (d, i) => "translate(0," + (y(i) - max_point_radius) + ")")
            dots.selectAll('.dot').transition(t_last).attr("cx", (d) => x_scales[d.gene](d[values]) );
            t_last = t_last.transition().duration(500);
        }

        // phase 4
            // new gene symbol names fade in
            // new axes roll out
        axes.enter()
            .append("g")
            .attr("class", "axis")
            .attr("id", d => d[0])
            .attr("transform", (d, i) => "translate(0," + y(i) + ")")
            .call(d3.drag().on("start", drag_axis_start).on("drag", drag_axis).on("end", drag_axis_end))
                .append("g")
                .attr("class", "sub")
                .attr("id", d => d.id)
                .each(function (d) { d3.select(this).call(d3.axisBottom(d[1])) })
            .select(function() { return this.parentNode; })
                .append("text")
                .attr("class", "text")
                .attr("id", d => d[0])
                .text(d => d[0])
                .attr("font-family", "sans-serif")
                .style("font-weight", 300)
                .style("cursor", "pointer")
                .style("text-anchor", "middle")
                .attr("dy", "1em")
                .on("click", (d) => line_coloring_system[0] === 'z' ? style({lines_color_by_: d[0]}) : GeneCards(d[0]))
            .select(function() { return this.parentNode; })
                .append("g")
                .attr("class", "brush")
                .attr("id", d => d.id)
                .each(function (d) { d3.select(this).call(d3.brushX().extent([[50,-10],[h,10]]).on("start", brushstart).on("brush", brush).on("end", brushend) ) })
            .select(function() { return this.parentNode; })
                .style("opacity", 0)
                .transition(t_last)
                    .style("opacity", 1);

        if (scaling === 'log') { d3.selectAll(".tick text").text(null).filter(powerOfTen).text(10).append("tspan").attr("dy", "-.7em").text(function(d) { return Math.round(Math.log(d) / Math.LN10); }); }

        dots.enter()
            .append("g")
            .attr("class", "dots")
            .attr("id", d => d.id)
            .attr("transform", (d, i) => "translate(0," + (y(i) - max_point_radius) + ")")
                .selectAll(".dot")
                .data((d) => d.samples, idFunc)
                .enter()
                .append("circle")
                .attr("class", "dot")
                .attr("id", d => d.id)
                .attr("cy", max_point_radius)
                .attr("cx", (d) => x_scales[d.gene](d[values]) )
                .attr("visibility", show_points ? "visible" : "hidden")
                .style("opacity", 0)
                .attr("r", point_radius)
                .style("fill", (d) => point_colors[point_coloring_system](d))
                .transition(t_last)
                    .style("opacity", point_opacity);

        // phase 5
            // new lines and halos appear
        t_last = t_last.transition().duration(500);

        line.enter()
            .append("path")
            .attr("class", "line")
            .attr("id", d => d.id)
            .style("fill", "none")
            .attr("visibility", show_lines ? "visible" : "hidden")
            .attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes))
            .style("stroke", (d) => line_colors[line_coloring_system](d))
            .style("stroke-width", line_width)
            .style("stroke-opacity", 0)
            .style("cursor", "pointer")
            .merge(line)
            .on("mouseover", (d) => setFocus([d.sample]))
            .on("mouseout", removeFocus)
            .transition(t_last)
                .style("stroke-opacity", (d) => selected_samples.includes(d.sample) ? line_opacity : line_opacity*0.25);

        halo.enter()
            .append("path")
            .attr("class", "halo")
            .attr("id", d => d.id)
            .style("fill", "none")
            .attr("visibility", show_halos ? "visible" : "hidden")
            .attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes))
            .style("stroke", (d) => line_colors[line_coloring_system](d))
            .style("stroke-linecap", "round")
            .style("stroke-linejoin", "round")
            .style("stroke-width", halo_width)
            .style("stroke-opacity", 0)
            .style("cursor", "pointer")
            .merge(halo)
            .on("mouseover", (d) => setFocus([d.sample]))
            .on("mouseout", removeFocus)
            .transition(t_last)
                .style("stroke-opacity", (d) => selected_samples.includes(d.sample) ? halo_opacity : halo_opacity*0.1);


    }

    function style({show_points_=show_points,
                    point_radius_=point_radius,
                    point_opacity_=point_opacity,
                    point_coloring_system_=point_coloring_system,
                    points_color_by_=points_color_by,
                    default_point_color_=default_point_color,
                    show_lines_=show_lines,
                    show_halos_=show_halos,
                    line_coloring_system_=line_coloring_system,
                    lines_color_by_=lines_color_by,
                    default_line_color_=default_line_color,
                    negative_color_=negative_color,
                    middle_color_=middle_color,
                    positive_color_=positive_color,
                    curve_=curve,
                    line_width_=line_width,
                    line_opacity_=line_opacity,
                    halo_width_=halo_width,
                    halo_opacity_=halo_opacity,
                    show_legends_=show_legends}={}) {

        show_points = show_points_;
        point_radius = point_radius_;
        point_opacity = point_opacity_;
        point_coloring_system = point_coloring_system_;
        points_color_by = points_color_by_;
        default_point_color = default_point_color_;
        show_lines = show_lines_;
        show_halos = show_halos_;
        line_coloring_system = line_coloring_system_;
        lines_color_by = lines_color_by_;
        default_line_color = default_line_color_;
        negative_color = negative_color_,
        middle_color = middle_color_,
        positive_color = positive_color_,
        curve = curve_;
        line_width = line_width_;
        line_opacity = line_opacity_;
        halo_width = halo_width_;
        halo_opacity = halo_opacity_;
        show_legends=show_legends_;


        if (line_coloring_system === 'zscore_stddev' || line_coloring_system === 'zscore_mad') {

            if (!_(ordered_gene_wise).findWhere({'gene': lines_color_by})) { lines_color_by = ordered_gene_wise[0].gene; }

            zscore_stddev_colors = color_range(lines_color_by, 'zscore_stddev');
            zscore_stddev_color_scale = zscore_stddev_colors[1]; zscore_stddev_colors = zscore_stddev_colors[0];
            zscore_mad_colors = color_range(lines_color_by, 'zscore_mad');
            zscore_mad_color_scale = zscore_mad_colors[1]; zscore_mad_colors = zscore_mad_colors[0];

        } else if (line_coloring_system === 'class') {

            if (!categories.includes(lines_color_by)) { lines_color_by = categories[0] }

        } else if (line_coloring_system === 'pc1') {

            pc1_colors = d3.scaleLinear().domain(samples_pc1_domain).range([negative_color, positive_color]);
        }

        // text is bound to Object.entries(x_axes)
        g.selectAll(".text").style("font-weight", (d) => (d[0] === lines_color_by ? 700 : 300));

        // dots are bound to ordered_gene_wise.samples
        g.selectAll(".dot")
            .attr("visibility", show_points ? "visible" : "hidden")
            .attr("r", point_radius)
            .style("fill", (d) => point_colors[point_coloring_system](d))
            .style("opacity", point_opacity);

        // lines are bound to sample_wise
        g.selectAll(".line")
            .attr("visibility", show_lines ? "visible" : "hidden")
            .attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes))
            .style("stroke", (d) => line_colors[line_coloring_system](d))
            .style("stroke-width", line_width)
            .style("stroke-opacity", line_opacity);

        // halos are bound to sample_wise
        g.selectAll(".halo")
            .attr("visibility", show_halos ? "visible" : "hidden")
            .attr("d", (d) => line_from_sample.curve(curves[curve])(d.genes))
            .style("stroke", (d) => line_colors[line_coloring_system](d))
            .style("stroke-width", halo_width)
            .style("stroke-opacity", halo_opacity);


        if (show_legends) {

            if (point_coloring_system !== 'uniform') {

                s = {'identity': id_colors, 'class': class_colors[points_color_by]}[point_coloring_system];
                legend_points.call(d3.legendColor().scale(s)).attr("transform", "translate(-240,0)");

            } else { legend_points.selectAll("*").remove(); }

            if (line_coloring_system !== 'uniform' && line_coloring_system !== point_coloring_system) {

                s = {'identity': id_colors, 'class': class_colors[lines_color_by], 'zscore_stddev': zscore_stddev_color_scale, 'zscore_mad': zscore_mad_color_scale, 'pc1': pc1_colors}[line_coloring_system];
                legend_lines.call(d3.legendColor().scale(s)).attr("transform", "translate(-240,"+(legend_points.node().getBBox().height+40)+")");

            } else { legend_lines.selectAll("*").remove(); }

        } else {
            legend_points.selectAll("*").remove();
            legend_lines.selectAll("*").remove();
        }

    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Drag Axes    ///////
    /////////////////////////////////////////////////////////////////////////////

    function drag_axis_start(d) {
        g.selectAll(".line,.halo").transition().duration(100).style('stroke-opacity', 0);
    }

    function drag_axis(d) {
        dragged_index = _(ordered_gene_wise).findIndex((gene) => gene.id === d[0]);

        let expr = (current_index) => {
            if (current_index < dragged_index) {
                if (current_index < ((d3.event.y-axis_spacing/2) / axis_spacing)) {
                        return y(current_index);
                    } else {
                        return y(current_index) + axis_spacing;
                    }
            } else {  // current_index >= dragged_index
                if (current_index < ((d3.event.y+axis_spacing/2) / axis_spacing)) {
                        return y(current_index) - axis_spacing;
                    } else {
                        return y(current_index);
                    }
            }
        }

        g.selectAll(".axis").attr("transform", function(d, i) { return "translate(0," +  expr(i) + ")" });
        g.selectAll(".dots").attr("transform", function(d, i) { return "translate(0," + (expr(i) - max_point_radius) + ")" });

        d3.select(this).attr("transform", "translate(0," + d3.event.y + ")");
        d3.select(".dots#"+d[0]).attr("transform", (d, i) => "translate(0," + (d3.event.y - max_point_radius) + ")");

    }

    function drag_axis_end(d) {

        dragged_index = _(ordered_gene_wise).findIndex((gene) => gene.id === d[0]);
        old_index = dragged_index;
        new_index = clamp(0, ordered_gene_wise.length)(Math.round(d3.event.y / axis_spacing));

        ordered_gene_wise.splice(new_index, 0, ordered_gene_wise.splice(old_index, 1)[0]);
        sample_wise.forEach((sample) => sample.genes.splice(new_index, 0, sample.genes.splice(old_index, 1)[0]));

        render();

    }

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Brush Axes    ///////
    /////////////////////////////////////////////////////////////////////////////


    function brushstart() {  }

    function brush(d) {
        var gene = d[0];
        var scale = x_scales[gene];
        var range = d3.event.selection.map(scale.invert);
        brush_selections[gene] = range;
        return resetFocus();
    }

    function brushend(d) {
        if (d3.event.selection === null) { delete brush_selections[d[0]]; }
        return resetFocus();
    }

    function setFocus(list_of_samples) {
        g.selectAll(".line").style('stroke-opacity', (d) => list_of_samples.includes(d.id) ? 1 :                line_opacity*0.25);
        g.selectAll(".halo").style('stroke-opacity', (d) => list_of_samples.includes(d.id) ? halo_opacity*1.5 : halo_opacity*0.1);
    }

    function selectedSamples() {
        return sample_wise.filter((sample) =>
            sample.genes.every((sample_gene) => {
                if (sample_gene.gene in brush_selections) {
                    bounds = brush_selections[sample_gene.gene];
                    return (bounds[0] < sample_gene.value && sample_gene.value < bounds[1]);
                } else { return true; }
            })
        ).map(sample => sample.id);
    }

    function resetFocus() {
        if (Object.keys(brush_selections).length === 0) { return removeFocus(); }
        return setFocus(selectedSamples());
    }

    function removeFocus() {
        if (Object.keys(brush_selections).length > 0) { return resetFocus(); }
        else {
            g.selectAll(".line").style('stroke-opacity', line_opacity);
            g.selectAll(".halo").style('stroke-opacity', halo_opacity);
        }
    }

    function GeneCards(symbol) { window.open("http://www.genecards.org/cgi-bin/carddisp.pl?gene="+symbol,'_blank') }


    /////////////////////////////////////////////////////////////////////////////
                          ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

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
        current_transform.y = clamp(-(axis_spacing*ordered_gene_wise.length-100) , 100)(current_transform.y - d3.event.deltaY);
        g.attr("transform", current_transform);
    }

    function resize() {
        svg.attr("width", $("#graph-container").innerWidth()).attr("height", $("#graph-container").innerHeight());
        w = $("#graph-container").innerWidth() - (margin.left + margin.right);
        h = $("#graph-container").innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on("resize", resize)

    resize();


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Return    ///////
    /////////////////////////////////////////////////////////////////////////////

    return {
        'restart'     : restart,
        'render'      : render,
        'order'       : order,
        'style'       : style,

        get_sorted_gene_list: () => ordered_gene_wise.length ? _(ordered_gene_wise).pluck('gene') : _(gene_wise).pluck('gene'),

        set_reordering: (reordering_) => { reordering = reordering_; if (reordering) { order(); render(); } },
    }

}






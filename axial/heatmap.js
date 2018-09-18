

let range = n => [...Array(n).keys()];
let clamp = (min, max) => ((x) => Math.min(Math.max(x, min), max));
let transpose = (array) => array[0].map((col, i) => array.map(row => row[i]));
let flatten = (array) => [].concat.apply([], array);

function Heatmap(samples_by_genes_matrix, gene_sets, classes, separate_by) {

    // samples_by_genes_matrix: {'sample_id': {'gene1': float, 'gene2': float}};

    // gene_sets: {'gene_set_name': ['gene1', 'gene2']};

    // classes: {'sample_id': {'category1': 'value', 'category2': value}}

    // categories: ['column_name_of_sample_class_labels_1', 'column_name_of_sample_class_labels_2']
    var categories = _.uniq(_.flatten(Object.values(classes).map(obj => Object.keys(obj))));

    // categories_to_members_to_values: {'category': {'sample_id1': 'value', 'sample_id2': value}}
    var categories_to_members_to_values = _.object(categories.map((category) =>
        [category, _.object(Object.entries(classes).map(([sample_id, categories_to_values]) => [sample_id, categories_to_values[category]]))]
    ));

    // categories_to_values_to_members: {'category': {'value1': ['sample_id1', 'sample_id2']}}
    var categories_to_values_to_members = _(categories_to_members_to_values).mapObject((samples_to_values) =>
        _(_(Object.entries(samples_to_values)).groupBy(([sample_id, value]) => value)).mapObject((arr_of_arr) => arr_of_arr.map(arr => arr[0]))
    );


    /////////////////////////////////////////////////////////////////////////////
                    ///////    Structure Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 100, bottom: 0, left: 100};

    var w = window.innerWidth - (margin.left + margin.right);
    var h = window.innerHeight - (margin.top + margin.bottom);

    var values = 'zscore_stddev';
    var show_averages = false;
    var sorting = 'complete';
    var reordering = true;
    var minimum_nonzero = 0;

    value_accessors = {
        counts: (gene) => gene.counts,
        zscore_stddev: (gene) => gene.samples.map((sample) => sample.zscore_stddev),
        zscore_mad: (gene) => gene.samples.map((sample) => sample.zscore_mad),
        pc1: (gene) => gene.samples.map((sample) => sample.pc1),
    }
    value_accessor = value_accessors.counts;

    var ordered_sample_ids = [];
    var ordered_gene_ids = [];

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var negative_color = '#0000cc';
    var middle_color = '#c0c0c0';
    var positive_color = '#cc0000';
    var show_legends = false;


    var colors20 = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477",
                    "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc",
                    "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];

    var category_colors = _.object(categories.map((category) => [category, d3.scaleOrdinal(d3.schemeCategory10)]))

    var colors = {};

    var spacing = 2;
    var rect_width = 16;
    var rect_height = 16;

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select("#graph-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    var g = svg.append("g");
    svg.style("cursor", "move");

    var selected_gene_sets = {}
    var genes = [];
    var gene_wise = [];
    var gene_wise_indexer = {};
    var ordered_gene_wise = [];
    var sample_wise = [];
    var sample_wise_indexer = {};
    var metadata = {};


    function idFunc(d) { return d ? d.id : this.id; }

    var legend_color = g.append("g").attr("class", "legend legendColor");


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_gene_sets_=selected_gene_sets}={}) {

        selected_gene_sets = selected_gene_sets_;
        keys = Object.keys(Object.values(samples_by_genes_matrix)[0]);
        genes = d3.hierarchy({'name': 'genes',
                              'children': selected_gene_sets['selected_gene_sets'].map((gs, i) => {
                                                return {'name': gs.gene_set_name,
                                                        'children': gs.genes.filter(gene => keys.includes(gene)).map(gene => {
                                                             return {'gene_set':gs.gene_set_name, 'name':gene}
                                                         })}
                                                }).concat(selected_gene_sets['other_genes'].filter(gene => keys.includes(gene)).map(gene => {
                                                    return {'name':null, 'children':[{'name':gene}]}
                                                }))
                             });

        matrix = _(samples_by_genes_matrix).mapObject((sample) => _(sample).pick(genes.leaves().map(d => d.data.name)));

        sample_wise = Object.entries(matrix).map(([sample, genes]) =>
            Object.entries(genes).map(([gene, count]) => { return {
                'id'     : sample+"_"+gene,
                'sample' : sample,
                'gene'   : gene,
                'count'  : count,
            }})
         );

        gene_wise = transpose(sample_wise).map((by_gene) => {
            min    = d3.min(by_gene, gene => gene.count);
            max    = d3.max(by_gene, gene => gene.count);
            mean   = d3.mean(by_gene, gene => gene.count);
            stddev = d3.deviation(by_gene, gene => gene.count);
            mad    = d3.mean(by_gene.map(gene => Math.abs(mean - gene.count)));
            num_nonzeros = by_gene.filter(d => d.count !== 0).length;
            return by_gene.map((gene) => Object.assign(gene, {
                'min'      : min,
                'max'      : max,
                'mean'     : mean,                  // should we only be counting non-zeros?
                'stddev'   : stddev,
                'mad'      : mad,
                'num_nonzeros'  : num_nonzeros,
                'zscore_stddev' : stddev === 0 ? 0 : (gene.count - mean) / stddev,
                'zscore_mad'    : mad === 0 ? 0    : (gene.count - mean) / mad,
            }));
        });

        gene_wise_indexer =  _.object(gene_wise.map((gene, i) => [gene[0].gene, i]));
        sample_wise_indexer = _.object(sample_wise.map((sample, i) => [sample[0].sample, i]));

        order();
        render();

    }

    function order({values_=values,
                    sorting_=sorting,
                    minimum_nonzero_=minimum_nonzero}={}) {

        values = values_;
        value_accessor = value_accessors[values];
        sorting = sorting_;
        minimum_nonzero = minimum_nonzero_;

    // ORDER GENE WISE

        // Filter by number non-zeros
        ordered_gene_wise = gene_wise.filter((gene) => gene[0].num_nonzeros >= minimum_nonzero);

        if (ordered_gene_wise.length === 0) { return; }  // do something smart here.

        // Set Gene-Wise PC1
        // genes_pc1 = reorder.pca1d(reorder.transpose(ordered_gene_wise.map(value_accessor)));
        // _(_.zip(ordered_gene_wise, genes_pc1)).each((gene, pc1) => gene.pc1 = pc1);

        if (reordering && ordered_gene_wise.length > 1) {

            genes.each(node => {
                if (node.depth === 1 && node.name !== null) {

                    set = node.children.map(gene => gene.data.name)

                    if (sorting === 'complete') { permutation_order = reorder.optimal_leaf_order()(ordered_gene_wise.filter(bygene => set.includes(bygene[0].gene)).map((bygene) => bygene.map(d => d[values]))); } // get dendogram out?
                    else if (sorting === 'pc1') { permutation_order = reorder.sort_order(genes_pc1); }

                    node.children.forEach((gene, i) => gene.data.order = permutation_order[i])
                }
            });

        }

        genes = genes.count().sort(function(a, b) { return b.height - a.height || b.data.order - a.data.order; });

        console.log(genes);

        ordered_gene_ids = genes.leaves().map(leaf => leaf.data.name);

    // ORDER SAMPLE WISE

        hierarchy = {'name':'metadata', 'children':[]};

        Object.entries(classes).forEach(([sample_id, metadata]) => {
            pointer = hierarchy.children;
            categories.forEach((category, i) => {
                value = metadata[category]
                existing_index_for_value = _(pointer).findIndex({'name': value});
                if (existing_index_for_value > -1) {
                    if (i+1 === categories.length) { pointer[existing_index_for_value].children.push({'name':sample_id}); }
                    else { pointer = pointer[existing_index_for_value].children; }
                } else {
                    if (i+1 === categories.length) { pointer.push({'name':value, 'children':[{'name':sample_id}]}); }
                    else {
                        pointer.push({'name':value,'children':[]});
                        pointer = pointer[_(pointer).findIndex({'name': value})].children;
                    }
                }
            })
        });

        metadata = d3.hierarchy(hierarchy).count().sort(function(a, b) { return b.height - a.height || b.value - a.value; });

        ordered_sample_ids = metadata.leaves().map(leaf => leaf.data.name);

    }

    function render({spacing_=spacing}={}) {

        spacing = spacing_;

        x = d3.scalePoint().domain(ordered_sample_ids).range([0,(ordered_sample_ids.length-1)*rect_width]);
        y = d3.scalePoint().domain(ordered_gene_ids).range([0,(ordered_gene_ids.length-1)*rect_height]);

        all_values = flatten(gene_wise);

        colors = {
            zscore_stddev:  d3.scaleLinear().domain([d3.min(all_values, d => d.zscore_stddev), 0, d3.max(all_values, d => d.zscore_stddev)]).range([negative_color, middle_color, positive_color]),
            zscore_mad:     d3.scaleLinear().domain([d3.min(all_values, d => d.zscore_mad),    0, d3.max(all_values, d => d.zscore_mad)]   ).range([negative_color, middle_color, positive_color]),
            pc1:            d3.scaleLinear().domain([d3.min(all_values, d => d.pc1),           0, d3.max(all_values, d => d.pc1)]          ).range([negative_color, middle_color, positive_color]),
        }


        metadata_height = rect_width*ordered_sample_ids.length+2;
        metadata_width = rect_height*(categories.length+2);
        d3.partition().size([metadata_height, metadata_width]).padding(2).round(true)(metadata);

        genes_height = rect_height*ordered_gene_ids.length+2;
        genes_width = 200;
        d3.partition().size([genes_height, genes_width]).padding(2).round(true)(genes);

        rect = g.selectAll(".rect").data(flatten(ordered_gene_wise), idFunc);
        sNam = g.selectAll(".sNam").data(ordered_sample_ids, d => d);
        gene = g.selectAll(".gene").data(genes.descendants(), idFunc);  // needs to be better than idFunc
        meta = g.selectAll(".meta").data(metadata.descendants(), idFunc);  // needs to be better than idFunc

        // phase 1
            // rectangles which are exiting fade out
            // gene names which are exiting fade out
            // gene groups which are exiting fade out
        t_last = d3.transition().duration(200);
        if (rect.exit().size() > 0) {
            rect.exit().transition(t_last).style("opacity", 0).remove();
            gene.exit().transition(t_last).style("opacity", 0).remove();
            sNam.exit().transition(t_last).style("opacity", 0).remove();
            meta.exit().transition(t_last).style("opacity", 0).remove();
            t_last = t_last.transition().duration(500);
        }

        // phase 2
            // re-arrange ROWS (rectangles, gene symbols, gene groups)
        rect.transition(t_last).attr('y', d => y(d.gene));
        gene.transition(t_last).attr('y', d => y(d));
        sNam.transition(t_last).attr('transform', function (d) {
            current_x = d3.select(this).attr('transform').split("translate(")[1].split(",")[0];
            return "translate("+current_x+","+ordered_gene_ids.length*rect_height+")rotate(60)" });
        // gene.transition(t_last)
        t_last = t_last.transition().duration(500);

        // phase 3
            // re-arrange COLUMNS (rectangles, sample names, meta)
        rect.transition(t_last).attr('x', d => x(d.sample)+10);
        sNam.transition(t_last).attr('transform', d => "translate("+(x(d)+rect_width)+","+ordered_gene_ids.length*rect_height+")rotate(60)");
        // meta.selectAll('.category_cell').transition(t_last).attr('x', d => x(d[0])+10);
        t_last = t_last.transition().duration(500);

        // phase 4
            // rectangles which are entering get appended
            // gene names which are entering get appended
            // gene groups which are entering get appended
        rect.enter()
            .append('rect')
            .attr('class', 'rect')
            .attr('id', d => d.id)
            .attr('x', d => x(d.sample)+10)
            .attr('y', d => y(d.gene))
            .attr('width', rect_width-2)
            .attr('height', rect_height-2)
            .attr('fill', d => colors[values](d[values]))
            .style("opacity", 0)
            .transition(t_last)
                .style("opacity", 1);

        gene.enter()
            .filter(function(d) { return d.depth === 2; })  // leaves
            .append('text')
            .attr('class', 'gene')
            .attr('id', d => d.data.name)
            .text(d => d.data.name)
            .attr('y', d => y(d.data.name))
            .attr("font-family", "sans-serif")
            .style("font-weight", 300)
            .style("cursor", "pointer")
            .style("text-anchor", "end")
            .attr("dy", "0.8em")
            .on("click", (d) => GeneCards(d.data.name))
            .call(d3.drag().on("start", drag_gene_start).on("drag", drag_gene).on("end", drag_gene_end))
            .style("opacity", 0)
            .transition(t_last)
                .style("opacity", 1);
        gene.enter()
            .filter(function(d) { return d.depth === 1; })  // gene sets
            .append('rect')
            .attr("transform", function(d) { return "translate(" + (d.y0-200) + "," + (d.x0-2) + ")"; })
            .attr("width", function(d) { return d.y1 - d.y0; })
            .attr("height", function(d) { return d.x1 - d.x0; })
            .style('fill-opacity', 0)
            .style('stroke', 'black');

        meta.enter()
            .filter(function(d) { return d.children !== undefined && d.depth > 0; })  // exclude root and leaves -- only internal nodes
            .append('rect')
            .attr("class", "meta")
            .attr("id", d => d.data.name)
            .attr("transform", (d, i) => "translate("+ (d.x0 + 8) +"," + (d.y0 - (categories.length+1)*rect_height - 8) + ")")
            .attr("width", function(d) { return d.x1 - d.x0; })
            .attr("height", function(d) { return d.y1 - d.y0; })
            .style("fill", d => category_colors[categories[d.depth-1]](d.data.name))
            .call(d3.drag().on("start", drag_meta_start).on("drag", drag_meta).on("end", drag_meta_end))
            .style("opacity", 0)
            .transition(t_last)
                .style("opacity", 1);
        meta.enter()
            .filter(function(d) { return d.children !== undefined && d.depth > 0; })
            .append('text')
            .attr("class", "category_label")
            .attr("font-family", "sans-serif")
            .text(d => d.data.name)
            .style("text-anchor", "left")
            .attr("transform", (d, i) => "translate("+ (d.x0 + 8 + 4) +"," + (d.y0 - (categories.length+1)*rect_height + 4) + ")")
            .style("font-size", 10)
            .style("opacity", 0)
            .transition(t_last)
                .style("opacity", 1);

          // cell.append("clipPath")
          //     .attr("id", function(d) { return "clip-" + d.id; })
          //   .append("use")
          //     .attr("xlink:href", function(d) { return "#rect-" + d.id + ""; });

          // cell.append("text")
          //     .attr("clip-path", function(d) { return "url(#clip-" + d.id + ")"; })

        sNam.enter()
            .append('text')
            .attr('class', 'sNam')
            .attr('id', d => d)
            .text(d => d)
            .attr('transform', d => "translate("+(x(d)+rect_width)+","+ordered_gene_ids.length*rect_height+")rotate(60)")
            .attr("font-family", "sans-serif")
            .style("font-weight", 300)
            .style("cursor", "pointer")
            .style("text-anchor", "start")
            .attr("dy", "0.5em")
            .call(d3.drag().on("start", drag_sample_start).on("drag", drag_sample).on("end", drag_sample_end))
            .style("opacity", 0)
            .transition(t_last)
                .style("opacity", 1);

    }

    function style({negative_color_=negative_color,
                    middle_color_=middle_color,
                    positive_color_=positive_color,
                    show_legends_=show_legends}={}) {

        negative_color = negative_color_,
        middle_color = middle_color_,
        positive_color = positive_color_,
        show_legends=show_legends_;

        g.selectAll(".rect")
            .style("fill", (d) => colors[values](d[values]));



        if (show_legends) {

        } else {

        }

    }


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Drag Axes    ///////
    /////////////////////////////////////////////////////////////////////////////

    function drag_gene_start(d) {


        // console.log(ordered_gene_wise);

    }

    function drag_gene(d) {

        dragged_index = _(ordered_gene_wise).findIndex((gene) => gene.gene === d);
        // console.log(dragged_index);

        // g.select("#"+d).attr("transform", function(d, i) { return "translate(0," +  expr(i) + ")" });
        // g.selectAll(".rect").attr("transform", function(d, i) { return "translate(0," + (expr(i) - max_point_radius) + ")" });


        // let expr = (current_index) => {
        //     if (current_index < dragged_index) {
        //         if (current_index < ((d3.event.y-s()/2) / s())) {
        //                 return y(current_index);
        //             } else {
        //                 return y(current_index) + s();
        //             }
        //     } else {  // current_index >= dragged_index
        //         if (current_index < ((d3.event.y+s()/2) / s())) {
        //                 return y(current_index) - s();
        //             } else {
        //                 return y(current_index);
        //             }
        //     }
        // }


        // d3.select(this).attr("transform", "translate(0," + d3.event.y + ")");
        // d3.select(".dots#"+d[0]).attr("transform", (d, i) => "translate(0," + (d3.event.y - max_point_radius) + ")");

    }

    function drag_gene_end(d) {

        // dragged_index = _(ordered_gene_wise).findIndex((gene) => gene.id === d[0]);
        // old_index = dragged_index;
        // new_index = clamp(0, ordered_gene_wise.length)(Math.round(d3.event.y / s()));

        // ordered_gene_wise.splice(new_index, 0, ordered_gene_wise.splice(old_index, 1)[0]);
        // sample_wise.forEach((sample) => sample.genes.splice(new_index, 0, sample.genes.splice(old_index, 1)[0]));

        // render();

    }


    function drag_sample_start(d) {
        // console.log(sample_wise);

    }
    function drag_sample(d) {}
    function drag_sample_end(d) {}


    function drag_meta_start(d) {
        console.log(d);

    }
    function drag_meta(d) {}
    function drag_meta_end(d) {}

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Brush Axes    ///////
    /////////////////////////////////////////////////////////////////////////////


    function setFocus(d) {
    }

    function removeFocus(d) {
    }

    function GeneCards(d) { window.open("http://www.genecards.org/cgi-bin/carddisp.pl?gene="+d,'_blank') }


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
        if (d3.event.ctrlKey) {
            current_transform.k = clamp(0.1, 5)(current_transform.k - d3.event.deltaY * 0.01);
        } else {
            current_transform.y = clamp(-(ordered_gene_ids.length*rect_height-100), h)(current_transform.y - d3.event.deltaY);
        }
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

        get_sorted_gene_list: () => _(sample_wise[0]).pluck('gene'),

        set_reordering: (reordering_) => { reordering = reordering_; if (reordering) { order(); render(); } },
    }

}






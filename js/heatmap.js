

let range = n => [...Array(n).keys()];  // underscore has a range()
let clamp = (min, max) => ((x) => Math.min(Math.max(x, min), max));
let transpose = (array) => array[0].map((col, i) => array.map(row => row[i]));
let flatten = (array) => [].concat.apply([], array);
let safeStr = (str) => str.split(' (')[0].replace(/\ /gi, '_');
let sum_counts_objects = (a, b) => _.object(_.uniq(Object.keys(a).concat(Object.keys(b))).map(key => [key, (a[key] || 0) + (b[key] || 0)]));
let pointing_down = (d) => ''+((d.x1 - d.x0) * 1 + (d.y1 - d.y0) * 1)+','+(d.x1 - d.x0);  // https://stackoverflow.com/questions/8976791/how-to-set-a-stroke-width1-on-only-certain-sides-of-svg-shapes
let pointing_up = (d) => '0,'+((d.x1 - d.x0) * 1)+','+((d.x1 - d.x0) * 1 + (d.y1 - d.y0) * 2);
Array.prototype.last = function() { return this[this.length - 1]; };
Array.prototype.move = function(from, to) { this.splice(to, 0, this.splice(from, 1)[0]); };
Array.prototype.insert = function(index, item) { this.splice( index, 0, item ); return this; };

function Heatmap(samples_by_genes_matrix, gene_sets, classes, separate_zscore_by, refresh_genes_cb) {

    // samples_by_genes_matrix: {'sample_id': {'gene1': float, 'gene2': float}};   // since this is an object, sample IDs and gene names are guaranteed to be unique.

    // gene_sets: {'gene_set_name': ['gene1', 'gene2']};

    // classes: {'sample_id': {'category1': 'value', 'category2': value}}

    // categories: ['column_name_of_sample_class_labels_1', 'column_name_of_sample_class_labels_2']
    var categories = _.uniq(_.flatten(Object.values(classes).map(obj => Object.keys(obj))));

    var samples_to_bin = _(classes).mapObject(categories_to_values => Object.entries(_(categories_to_values).pick(separate_zscore_by)).sort().reduce((acc, [category, value]) => (acc ? acc+'-'+value : value), ''));
    var bin_to_samples = _(Object.keys(samples_to_bin)).groupBy(sample => samples_to_bin[sample]);

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Structure Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var margin = {top: 100, right: 100, bottom: 0, left: 100};

    var w = window.innerWidth - (margin.left + margin.right);
    var h = window.innerHeight - (margin.top + margin.bottom);

    var values = 'zscore_stddev';
    var sorting = 'complete';
    var reordering = true;
    var dragging = false;

    /////////////////////////////////////////////////////////////////////////////
                    ///////    Styling Variables    ///////
    /////////////////////////////////////////////////////////////////////////////

    var negative_color = '#0000cc';
    var middle_color = '#c0c0c0';
    var positive_color = '#cc0000';

    var show_sample_metadata = true;
    var show_legends = false;
    var legends_position = 'right';
    var darker_legends = false;

    var focused_node = null;
    var unfocused_opacity = 0.2;

    // var category_colors = _.object(categories.map((category) => [category, d3.scaleOrdinal(d3.schemeCategory10)]))
    var category_colors = {'system': d3.scaleOrdinal(d3.schemeCategory10), 'condition': d3.scaleOrdinal(d3.schemeSet2)};

    var color_style = 'interpolateTriplet'
    var colors = null;

    var spacing = 1;
    var rect_width = 16;
    var rect_height = 16;

    var margins = {'sample_id': {'2': 10}, 'gene_id': {'1': 10}};
    var styles = {
        'nodes': {
            'sample_id': {
                'fill': d => category_colors[d.data.category](d.data.name)},
            'gene_id': {
                'fill-opacity': 0,
                'stroke': 'black',
                'stroke-dasharray': d => (((x_attr === 'gene_id' && x_axis_nodes_position === 'before') || (y_attr === 'gene_id' && y_axis_nodes_position === 'before')) ? pointing_down(d) : pointing_up(d))}
        },
        'leaves': { 'sample_id': {}, 'gene_id': {}, }
    };

    var y_axis_leaves_position = 'before';
    var y_axis_nodes_position = 'before';
    var y_axis_nodes_x_width = 16;
    var x_axis_leaves_position = 'after';
    var x_axis_nodes_position = 'before';
    var x_axis_nodes_y_height = 16;
    var y_axis_style = 'genes';
    var x_axis_style = 'samples';
    var t = false;
    var x_categories = categories;
    var y_categories = ['Gene Set'];
    var y_axis_leaves_x, y_axis_nodes_x, x_axis_nodes_y, x_axis_leaves_y;
    var rotation = 60;
    var x_axis_leaves_rotation = (x_axis_leaves_position === 'before') ? -rotation : rotation;
    var y_font_size, x_font_size, x_cat_font_size, y_cat_font_size, xtre_label_font_size, ytre_label_font_size;
    var show_x_level_names = true
    var show_y_level_names = true;

    // position[display_style][nodes_or_leaves]: (params) => int;
    var axis_position = {
        'genes': {
            leaves: (nodes_position, leaves_position, this_tree, other_tree, layer_width, text_width) =>
                (leaves_position === 'before') ? -10 : other_tree.x1 + 10,
            nodes:  (nodes_position, leaves_position, this_tree, other_tree, layer_width, text_width) =>
                (nodes_position === 'before') ? -(layer_width*this_tree.height)-10 - ((leaves_position === 'before') ? text_width : 0) : other_tree.x1 - layer_width + ((leaves_position === 'before') ? 10 : text_width),
        },
        'samples': {
            leaves: (nodes_position, leaves_position, this_tree, other_tree, layer_width, text_width) =>
                (leaves_position === 'before') ? ((nodes_position === 'before') ? -(layer_width*(this_tree.height-1))-20 : -10) : other_tree.x1 + ((nodes_position === 'before') ? 10 : (layer_width*(this_tree.height-1))+20),
            nodes:  (nodes_position, leaves_position, this_tree, other_tree, layer_width, text_width) =>
                (nodes_position === 'before') ? -(layer_width*this_tree.height)-10 : other_tree.x1 - layer_width + 10,
        }
    };

    var max_font_size = 16;
    var text_styles = {
        'font-family': 'sans-serif',
        'font-weight': 300,
        'cursor': 'pointer',
        'text-anchor': 'start',
    };

    let text_max_width = (tree, font_size) => (d3.max(tree.leaves().filter(leaf => leaf.depth > 0).map(leaf => leaf.data.name.length)) || 0) * font_size;

    var clear_styles = {
        'fill': 'red',
        'stroke': 'black',
        'cursor': 'pointer',
        'opacity': 0,
    }

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Set Up Chart    ///////
    /////////////////////////////////////////////////////////////////////////////

    var svg = d3.select('#graph-container').append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    var g = svg.append('g');
    svg.style('cursor', 'move');
    svg.on('click', function() { if (d3.event.target.localName === 'svg') { removeFocus(); } });

    var selected_gene_sets = {}
    var genes = {};
    var samples = {};
    var gene_wise = [];
    var gene_wise_indexer = {};
    var ordered_gene_wise = [];
    var sample_wise = [];
    // var sample_wise_indexer = {};
    var sample_to_sample_id = {};
    var x, y, x_category_y, y_category_x;
    var x_tree, y_tree, x_attr, y_attr;

    var drag_y        = (d) => drag_node(     d, y_tree, 'y', y_attr);
    var drag_y_end    = (d) => drag_node_end( d, y_tree, 'y', sample_wise, ordered_gene_wise);

    var drag_x        = (d) => drag_node(     d, x_tree, 'x', x_attr);
    var drag_x_end    = (d) => drag_node_end( d, x_tree, 'x', ordered_gene_wise, sample_wise);

    var drag_ycat     = (d) => drag_catg(     d, 'y', y_categories, y_category_x, y_axis_nodes_x_width);
    var drag_ycat_end = (d) => drag_catg_end( d, 'y');

    var drag_xcat     = (d) => drag_catg(     d, 'x', x_categories, x_category_y, x_axis_nodes_y_height);
    var drag_xcat_end = (d) => drag_catg_end( d, 'x');


    var legends = g.append('g').attr('class', 'legends');

    var color_legend = legends.append('g').attr('class', 'legend').styles(text_styles).style('font-size', 14).call(d3.drag().on('drag', drag_legend));

    var category_legends = _(category_colors).mapObject((color_scale, catg) => legends.append('g').attr('class', 'legend').styles(text_styles).style('font-size', 14).call(d3.drag().on('drag', drag_legend)) );

    var rect_resizer = g.append('circle')
                        .attr('class', 'resizer')
                        .attr('id', 'rect_resizer')
                        .attr('r', 20)
                        .style('cursor', 'crosshair')
                        .style('opacity', 0)
                        .call(d3.drag().on('drag', drag_rect_resizer).on('end', render));

    var xtre_resizer = g.append('circle')
                        .attr('class', 'resizer')
                        .attr('id', 'xtre_resizer')
                        .attr('r', 20)
                        .style('cursor', 'crosshair')
                        .style('opacity', 0)
                        .call(d3.drag().on('drag', drag_xtre_resizer).on('end', render));

    var ytre_resizer = g.append('circle')
                        .attr('class', 'resizer')
                        .attr('id', 'ytre_resizer')
                        .attr('r', 20)
                        .style('cursor', 'crosshair')
                        .style('opacity', 0)
                        .call(d3.drag().on('drag', drag_ytre_resizer).on('end', render));

    /////////////////////////////////////////////////////////////////////////////
                          ///////    Methods    ///////
    /////////////////////////////////////////////////////////////////////////////

    function restart({selected_gene_sets_=selected_gene_sets}={}) {

        if (Object.keys(samples_by_genes_matrix).length === 0) { return clear_fig(); }

        selected_gene_sets = selected_gene_sets_;
        selected_gene_sets = _.uniq(selected_gene_sets, (gs,i) => gs.gene_set_name ? gs.gene_set_name : gs.genes[0]);
        var measured_genes = Object.keys(Object.values(samples_by_genes_matrix)[0]);  // genes included in matrix

        var previous_gene_order = {}, previous_sample_order = {};
        if (!reordering && ('children' in samples || 'children' in genes)) {
            samples.each(node => previous_sample_order[node.data.id] = node.data.order);
            genes.each(node => previous_gene_order[node.data.id] = node.data.order);
        }

        // GENES =====================

        genes = d3.hierarchy({
                    'id': 'genes',
                    'children': selected_gene_sets.filter(gs => _.any(gs.genes, gene => measured_genes.includes(gene))).map((gs, i) => {
                        if (gs.gene_set_name === null) {
                            return {'gene_set':null, 'name':gs.genes[0], 'order':i, 'id':'other'+'_'+gs.genes[0]}
                        } else {
                            return {
                                'id': safeStr(gs.gene_set_name),
                                'name': gs.gene_set_name,
                                'order': (previous_gene_order[safeStr(gs.gene_set_name)] || i),
                                'category': 'Gene Set',
                                'children': _.uniq(gs.genes).filter(gene => measured_genes.includes(gene)).map((gene, j) => {
                                    gene_id = safeStr(gs.gene_set_name)+'_'+gene;
                                    return {'id':gene_id, 'name':gene, 'order':(previous_gene_order[gene_id] || j), 'gene_set':gs.gene_set_name}
                                })
                            }}
                        })
                });

        if (genes.data.children.length === 0) { return clear_fig(); }

        // SAMPLES =====================

        var nest = d3.nest();
        categories.forEach(category => nest.key(d => d[category]) );
        samples = {
            'key':'samples',
            'values': nest.entries(Object.entries(classes).filter(([sample_id, metadata]) => Object.keys(samples_by_genes_matrix).includes(sample_id))
                                                          .map(([sample_id, metadata]) => Object.assign(metadata, {'key': sample_id})))
        }
        samples = d3.hierarchy(samples, d => d.values)
        samples.each(node => {
            node.data['id'] = node.ancestors().reverse().map(d => safeStr(d.data.key)).join('-');
            node.data['name'] = node.data.key;
            if (0 < node.depth < categories.length) { node.data['category'] = categories[node.depth-1]; }
            node.data['order'] = node.data.id in previous_sample_order ? previous_sample_order[node.data.id] : (node.parent ? node.parent.children.indexOf(node) : 0);
        });

        sample_to_sample_id = _.object(samples.leaves().map(leaf => [leaf.data.name, leaf.data.id]));

        // SAMPLE WISE =====================

        var matrix = _(samples_by_genes_matrix).mapObject((sample) => _(sample).pick(genes.leaves().map(d => d.data.name)));

        sample_wise = Object.entries(matrix).map(([sample, genes]) =>
            Object.entries(genes).map(([gene, count]) => { return {
                'id'        : sample+'_'+gene,
                'sample'    : sample,
                'sample_id' : sample_to_sample_id[sample],
                'gene'      : gene,
                // 'gene_id' assigned later
                'count'     : count,
                'logcount'  : Math.log10(count+1),
            }})
         );
        // sample_wise_indexer = _.object(sample_wise.map((sample, i) => [sample[0].sample, i]));

        // GENE WISE =====================

        gene_wise = transpose(sample_wise).map((by_gene) => {
            var bin = _.object(Object.entries(bin_to_samples).map(([bin, samples]) => {
                var l = by_gene.filter(gene => samples.includes(gene.sample));
                var min    = d3.min(l, gene => gene.count);
                var max    = d3.max(l, gene => gene.count);
                var mean   = d3.mean(l, gene => gene.count);            // should we only be counting non-zeros?
                var stddev = d3.deviation(l, gene => gene.count);
                var mad    = d3.mean(l.map(gene => Math.abs(mean - gene.count)));
                return [bin, {'min':min,'max':max,'mean':mean,'stddev':stddev,'mad':mad}];
            }));
            var num_nonzeros = by_gene.filter(d => d.count !== 0).length;
            return by_gene.map((gene) => Object.assign(gene, {
                'min'      : bin[samples_to_bin[gene.sample]].min,
                'max'      : bin[samples_to_bin[gene.sample]].max,
                'mean'     : bin[samples_to_bin[gene.sample]].mean,
                'stddev'   : bin[samples_to_bin[gene.sample]].stddev,
                'mad'      : bin[samples_to_bin[gene.sample]].mad,
                'num_nonzeros'  : num_nonzeros,
                'zscore_stddev' : bin[samples_to_bin[gene.sample]].stddev === 0 ? 0 : (gene.count - bin[samples_to_bin[gene.sample]].mean) / bin[samples_to_bin[gene.sample]].stddev,
                'zscore_mad'    : bin[samples_to_bin[gene.sample]].mad === 0 ? 0    : (gene.count - bin[samples_to_bin[gene.sample]].mean) / bin[samples_to_bin[gene.sample]].mad,
            }));
        });

        gene_wise_indexer =  _.object(gene_wise.map((gene, i) => [gene[0].gene, i]));

        order();
        render();

    }

    function order({
        values_=values,
        sorting_=sorting}={}) {

        values = values_;
        sorting = sorting_;

        if (gene_wise.length === 0) { return; }  // do something smart here.

        ordered_gene_wise = genes.leaves().map(leaf => gene_wise[gene_wise_indexer[leaf.data.name]].map(sample => Object.assign({'gene_id':leaf.data.id}, sample)));

        if (ordered_gene_wise.length === 0) { return; }  // do something smart here.

        if (reordering && ordered_gene_wise.length > 1) {
            reorder_leaves(genes, ordered_gene_wise, 'gene_id');
            reorder_leaves(samples, sample_wise, 'sample_id');
        }

        genes.count().sort(function(a, b) { return a.depth - b.depth || a.data.order - b.data.order; });
        samples.count().sort(function(a, b) { return a.depth - b.depth || a.data.order - b.data.order; });

    }

    function reorder_leaves(hierarchy, this_wise, id_attr) {

        hierarchy.each(node => {
            if (node.height === 1) {  // for each gene set / smallest set of samples

                var set_leaf_ids = node.children.map(leaf => leaf.data.id);
                var set_leaves = this_wise.filter(vec => set_leaf_ids.includes(vec[0][id_attr]));

                if (set_leaves.length > 1) {

                    var set_leaf_values = set_leaves.map(vec => vec.map(leaf => leaf[values] || 0));

                    // Set leaf-Wise PC1
                    var leaves_pc1 = reorder.pca1d(reorder.transpose(set_leaf_values));
                    _.zip(set_leaves, leaves_pc1).forEach(([vec, pc1]) => vec.forEach(d => d.pc1 = pc1));

                    if (sorting === 'complete') { var permutation_order = reorder.optimal_leaf_order()(set_leaf_values); } // get dendogram out?
                    else if (sorting === 'pc1') { var permutation_order = reorder.sort_order(leaves_pc1); }

                    set_leaf_ids = reorder.stablepermute(set_leaf_ids, permutation_order);
                    permutation_order = _.object(set_leaf_ids.map((id, i) => [id, i]));
                    node.children.forEach((leaf) => leaf.data.order = permutation_order[leaf.data.id]);

                } else {
                    node.children[0].data.order = 0;
                }
            }
        });

    }

    function offset(partition, margin) {

        var counter = 0;
        var current_depth = 0;
        partition.each((node) => {
            node.num_below = _(node.descendants().slice(1).map(d => d.height)).countBy();

            if (node.depth !== current_depth) { current_depth = node.depth; counter = 0; }
            node.sibling_index = counter; counter += 1;
        });

        partition.offset = 0;
        partition.num_left = 0;

        partition.each((node) => {
            if (node.parent) {
                var left_sibling = _(node.parent.children.filter(sibling => sibling.sibling_index < node.sibling_index)).sortBy(sibling => sibling.sibling_index).last();

                if (!left_sibling) {
                    node.offset = node.parent.offset;
                } else {
                    node.offset = (
                        left_sibling.offset +
                        d3.sum(Object.entries(left_sibling.num_below).map(([level, num]) => (margin[level] || 0)*(num-1) )) +
                        d3.max([(margin[node.height] || 0), (margin[left_sibling.height] || 0)])
                    );
                }

                node.x0 += node.offset;
                node.x1 += node.offset + d3.sum(Object.entries(node.num_below).map(([level, num]) => (margin[level] || 0)*(num-1)));
            }
        });

        partition.x1 += d3.max(partition.descendants().map(node => node.offset));

    }

    function set_transposition(t_) {

        t = t_ ? true : false;

        if (t) {

            x_categories = (genes.height > 1 ? ['Gene Set'] : []);
            y_categories = categories;

            x_tree = genes;
            x_attr = 'gene_id';
            y_tree = samples;
            y_attr = 'sample_id';

            drag_y_end = (d) => drag_node_end( d, y_tree, 'y', sample_wise, ordered_gene_wise);
            drag_x_end = (d) => drag_node_end( d, x_tree, 'x', ordered_gene_wise, sample_wise);

        } else {

            x_categories = categories;
            y_categories = (genes.height > 1 ? ['Gene Set'] : []);

            x_tree = samples;
            x_attr = 'sample_id';
            y_tree = genes;
            y_attr = 'gene_id';

            drag_y_end = (d) => drag_node_end( d, y_tree, 'y', ordered_gene_wise, sample_wise);
            drag_x_end = (d) => drag_node_end( d, x_tree, 'x', sample_wise, ordered_gene_wise);

        }
    }

    function position() {

        set_transposition(t);

        var x_tree_across = (rect_width*x_tree.leaves().length)+spacing;
        var x_tree_topdown = x_axis_nodes_y_height*(x_tree.height+1);
        d3.partition().size([x_tree_across, x_tree_topdown]).padding(spacing)(x_tree);
        offset(x_tree, margins[x_attr]);

        var y_tree_across = (rect_height*y_tree.leaves().length)+spacing;
        var y_tree_topdown = y_axis_nodes_x_width*(y_tree.height+1);
        d3.partition().size([y_tree_across, y_tree_topdown]).padding(spacing)(y_tree);
        offset(y_tree, margins[y_attr]);

        x = _.object(x_tree.leaves().map(leaf => [leaf.data.id, leaf.x0]));
        y = _.object(y_tree.leaves().map(leaf => [leaf.data.id, leaf.x0]));

        y_font_size = Math.min(rect_height-spacing, max_font_size);
        x_font_size = Math.min(rect_width-spacing, max_font_size);
        x_cat_font_size = Math.min(x_axis_nodes_y_height-spacing, max_font_size);
        y_cat_font_size = Math.min(y_axis_nodes_x_width-spacing, max_font_size);
        xtre_label_font_size = Math.min(x_axis_nodes_y_height*2/3-spacing, max_font_size);
        ytre_label_font_size = Math.min(y_axis_nodes_x_width*2/3-spacing, max_font_size);

        y_axis_leaves_x = axis_position[y_axis_style]['leaves'](y_axis_nodes_position, y_axis_leaves_position, y_tree, x_tree, y_axis_nodes_x_width, text_max_width(y_tree, y_font_size));
        y_axis_nodes_x  = axis_position[y_axis_style]['nodes']( y_axis_nodes_position, y_axis_leaves_position, y_tree, x_tree, y_axis_nodes_x_width, text_max_width(y_tree, y_font_size));
        x_axis_leaves_y = axis_position[x_axis_style]['leaves'](x_axis_nodes_position, x_axis_leaves_position, x_tree, y_tree, x_axis_nodes_y_height, text_max_width(x_tree, x_font_size)*2/3);
        x_axis_nodes_y  = axis_position[x_axis_style]['nodes']( x_axis_nodes_position, x_axis_leaves_position, x_tree, y_tree, x_axis_nodes_y_height, text_max_width(x_tree, x_font_size)*2/3);

        x_axis_leaves_rotation = (x_axis_leaves_position === 'before') ? -rotation : rotation;

        x_category_y = _.object(x_categories.map((c, i) => [c, x_axis_nodes_y + x_axis_nodes_y_height*(i+1)]));
        y_category_x = _.object(y_categories.map((c, i) => [c, y_axis_nodes_x + y_axis_nodes_x_width*(i+1)]));

    }

    function render({
        spacing_=spacing,
        y_axis_leaves_position_=y_axis_leaves_position,
        y_axis_nodes_position_=y_axis_nodes_position,
        y_axis_style_=y_axis_style,
        x_axis_leaves_position_=x_axis_leaves_position,
        x_axis_nodes_position_=x_axis_nodes_position,
        x_axis_style_=x_axis_style,}={}) {

        spacing = spacing_;
        y_axis_leaves_position = y_axis_leaves_position_;
        y_axis_nodes_position = y_axis_nodes_position_;
        y_axis_style = y_axis_style_;
        x_axis_leaves_position = x_axis_leaves_position_;
        x_axis_nodes_position = x_axis_nodes_position_;
        x_axis_style = x_axis_style_;

        if (ordered_gene_wise.length === 0) { return clear_fig(); }

        position();
        set_colors();

        var rect = g.selectAll('.rect').data(flatten(ordered_gene_wise), d => d.id);
        var ytre = g.selectAll('.ytre').data(y_tree.descendants(), d => d.data.id);
        var xtre = g.selectAll('.xtre').data(x_tree.descendants(), d => d.data.id);
        var xcat = g.selectAll('.xcat').data(x_categories, d => d);
        var ycat = g.selectAll('.ycat').data(y_categories, d => d);

        // phase 1
            // rectangles which are exiting fade out
            // gene names / groups which are exiting fade out
            // sample names / groups which are exiting fade out
            // gene / sample x names / groups which are staying get full opacity
        var t_last = d3.transition().duration(500);
        if (rect.exit().size() > 0 || ytre.exit().size() > 0 || xtre.exit().size() > 0 || xcat.exit().size() > 0 || ycat.exit().size() > 0) {
            rect.exit().transition(t_last).style('opacity', 0).remove();
            ytre.exit().transition(t_last).style('opacity', 0).remove();
            xtre.exit().transition(t_last).style('opacity', 0).remove();
            ycat.exit().transition(t_last).style('opacity', 0).remove();
            xcat.exit().transition(t_last).style('opacity', 0).remove();
            rect.transition(t_last).style('opacity', 1);
            ytre.transition(t_last).style('opacity', 1);
            xtre.transition(t_last).style('opacity', 1);
            t_last = t_last.transition().duration(500);
        }

        // phase 2
            // re-arrange ROWS
        rect.transition(t_last).attr('y', d => y[d[y_attr]]).attr('height', rect_height-spacing).style('fill', d => colors(d[values]));
        ytre.filter(node => node.height === 0).transition(t_last).attr('y', d => y[d.data.id])
                                                                 .attr('x', y_axis_leaves_x)
                                                                 .style('text-anchor', (y_axis_leaves_position === 'before' ? 'end' : 'start'))
                                                                 .style('font-size', y_font_size)
                                                                 .attr('dy', y_font_size);
        ytre.filter(node => node.depth > 0 && node.height > 0).transition(t_last).attr('transform', d => 'translate('+(y_axis_nodes_x + d.y0)+','+d.x1+')rotate(-90)');
        ytre.filter(node => node.depth > 0 && node.height > 0).select('.ytre_box').transition(t_last).attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0).style('stroke-dasharray', d => (y_axis_nodes_position === 'before' ? pointing_down(d) : pointing_up(d)));
        ycat.transition(t_last).attr('y', x_axis_leaves_y).attr('x', d => y_category_x[d]).attr('dy', (x_axis_leaves_position === 'before' ? y_cat_font_size : 0))
                               .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+y_category_x[d]+','+x_axis_leaves_y+')');
        t_last = t_last.transition().duration(500);

        if (show_legends) { configure_legends(t_last); }

        // phase 3
            // re-arrange COLUMNS
        rect.transition(t_last).attr('x', d => x[d[x_attr]]).attr('width', rect_width-spacing);
        xtre.filter(node => node.height === 0).transition(t_last).attr('x', d => d.x0)
                                                                 .attr('y', x_axis_leaves_y)
                                                                 .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+d.x0+','+x_axis_leaves_y+')')
                                                                 .style('font-size', x_font_size)
                                                                 .attr('dy', (x_axis_leaves_position === 'before' ? x_font_size : 0));
        xtre.filter(node => node.depth > 0 && node.height > 0).transition(t_last).attr('transform', d => 'translate('+d.x0+','+(x_axis_nodes_y + d.y0)+')');
        xtre.filter(node => node.depth > 0 && node.height > 0).select('.xtre_box').transition(t_last).attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0).style('stroke-dasharray', d => (x_axis_nodes_position === 'before' ? pointing_down(d) : pointing_up(d)));
        xcat.transition(t_last).attr('x', y_axis_leaves_x).attr('y', d => x_category_y[d]).style('text-anchor', (y_axis_leaves_position === 'before' ? 'end' : 'start'));
        t_last = t_last.transition().duration(500);

        // phase 4
            // rectangles which are entering get appended
            // gene names / groups which are entering get appended
            // sample names / groups which are entering get appended
        xtre.enter()
            .filter(d => d.height === 0)  // leaves
            .append('text')
            .attr('class', 'xtre')
            .attr('id', d => d.data.id)
            .attr('x', d => x[d.data.id])
            .attr('y', x_axis_leaves_y)
            .attr('dy', (x_axis_leaves_position === 'before' ? x_font_size : 0))
            .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+d.x0+','+x_axis_leaves_y+')')
            .text(d => d.data.name)
            .styles(text_styles)
            .style('font-size', x_font_size)
            .on('click', (d) => ((x_attr === 'gene_id' && d3.event.metaKey) ? GeneCards(d.data.name) : setFocus(d)))
            .call(d3.drag().on('drag', drag_x).on('end', drag_x_end))
            .style('opacity', 0).transition(t_last).style('opacity', 1);

        xtre.enter()
            .filter(d => d.height > 0 && d.depth > 0)  // internal nodes
            .append('g')
            .attr('class', 'xtre')
            .attr('id', d => d.data.id)
            .attr('transform', d => 'translate('+d.x0+','+(x_axis_nodes_y + d.y0)+')')
            .on('click', setFocus)
            .call(d3.drag().on('drag', drag_x).on('end', drag_x_end))
                .append('rect')
                .attr('class', 'xtre_box')
                .attr('id', d => 'rect-' + d.data.id)
                .attr('width', d => d.x1 - d.x0)
                .attr('height', d => d.y1 - d.y0)
                .styles(styles['nodes'][x_attr])
            .select(function() { return this.parentNode; })
                .append('text')
                .attr('class', 'xtre_label')
                .attr('clip-path', d => 'url(#clip-' + d.data.id + ')')
                .text(d => d.data.name)
                .styles(text_styles)
                .style('font-size', xtre_label_font_size)
                .attr('dy', xtre_label_font_size+spacing)
                .attr('dx', '0.2em')
                .attr('visibility', (x_attr !== 'sample_id' || show_sample_metadata) ? 'visible' : 'hidden')
            .select(function() { return this.parentNode; })
                .append('clipPath')
                .attr('id', d => 'clip-'+d.data.id)
                    .append('use')
                    .attr('xlink:href', d => '#rect-'+d.data.id)
                .select(function() { return this.parentNode; })
            .select(function() { return this.parentNode; })
            .style('opacity', 0).transition(t_last).style('opacity', 1);

        xcat.enter()
            .append('text')
            .attr('class', 'xcat')
            .attr('id', d => d)
            .text(d => d)
            .attr('x', y_axis_leaves_x)
            .attr('y', d => x_category_y[d])
            .style('font-size', x_cat_font_size)
            .attr('dy', x_cat_font_size)
            .styles(text_styles)
            .style('text-anchor', (y_axis_leaves_position === 'before' ? 'end' : 'start'))
            .call(d3.drag().on('drag', drag_xcat).on('end', drag_xcat_end))
            .style('opacity', 0).transition(t_last).style('opacity', 1);


        ytre.enter()
            .filter(d => d.height === 0)  // leaves
            .append('text')
            .attr('class', 'ytre')
            .attr('id', d => d.data.id)
            .attr('x', y_axis_leaves_x)
            .attr('y', d => y[d.data.id])
            .text(d => d.data.name)
            .style('font-size', y_font_size)
            .styles(text_styles)
            .style('text-anchor', (y_axis_leaves_position === 'before' ? 'end' : 'start'))
            .attr('dy', y_font_size)
            .on('click', (d) => ((y_attr === 'gene_id' && d3.event.metaKey) ? GeneCards(d.data.name) : setFocus(d)))
            .call(d3.drag().on('drag', drag_y).on('end', drag_y_end))
            .style('opacity', 0).transition(t_last).style('opacity', 1);

        ytre.enter()
            .filter(d => d.height > 0 && d.depth > 0)  // internal nodes
            .append('g')
            .attr('class', 'ytre')
            .attr('id', d => d.data.id)
            .attr('transform', d => 'translate('+(y_axis_nodes_x + d.y0)+','+d.x1+')rotate(-90)')
            .on('click', setFocus)
            .call(d3.drag().on('drag', drag_y).on('end', drag_y_end))
                .append('rect')
                .attr('class', 'ytre_box')
                .attr('id', d => 'rect-' + d.data.id)
                .attr('width', d => d.x1 - d.x0)
                .attr('height', d => d.y1 - d.y0)
                .styles(styles['nodes'][y_attr])
            .select(function() { return this.parentNode; })
                .append('text')
                .attr('class', 'ytre_label')
                .attr('clip-path', d => 'url(#clip-' + d.data.id + ')')
                .text(d => d.data.name)
                .styles(text_styles)
                .style('font-size', ytre_label_font_size)
                .attr('dy', ytre_label_font_size+spacing)
                .attr('dx', '0.2em')
                .attr('visibility', (y_attr !== 'sample_id' || show_sample_metadata) ? 'visible' : 'hidden')
            .select(function() { return this.parentNode; })
                .append('clipPath')
                .attr('id', d => 'clip-'+d.data.id)
                    .append('use')
                    .attr('xlink:href', d => '#rect-'+d.data.id)
                .select(function() { return this.parentNode; })
            .select(function() { return this.parentNode; })
            .style('opacity', 0).transition(t_last).style('opacity', 1);

        ycat.enter()
            .append('text')
            .attr('class', 'ycat')
            .attr('id', d => d)
            .text(d => d)
            .attr('x', d => y_category_x[d])
            .attr('y', x_axis_leaves_y)
            .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+y_category_x[d]+','+x_axis_leaves_y+')')
            .style('font-size', y_cat_font_size)
            .styles(text_styles)
            .attr('dx', '0.2em')
            .call(d3.drag().on('drag', drag_ycat).on('end', drag_ycat_end))
            .style('opacity', 0).transition(t_last).style('opacity', 1);


        rect.enter()
            .append('rect')
            .attr('class', 'rect')
            .attr('id', d => d.id)
            .attr('x', d => x[d[x_attr]])
            .attr('y', d => y[d[y_attr]])
            .attr('width', rect_width-spacing)
            .attr('height', rect_height-spacing)
            .attr('fill', d => colors(d[values]))
            .on('click', setFocus)
            .style('opacity', 0).transition(t_last).style('opacity', 1);


        g.select('#rect_resizer').attr('cx', x_tree.x1).attr('cy', y_tree.x1);
        g.select('#xtre_resizer').attr('cx', x_tree.x1).attr('cy', x_axis_nodes_y + (x_axis_nodes_position === 'before' ? x_axis_nodes_y_height : x_axis_nodes_y_height*x_tree.height));
        g.select('#ytre_resizer').attr('cx', y_axis_nodes_x + (y_axis_nodes_position === 'before' ? y_axis_nodes_x_width : y_axis_nodes_x_width*y_tree.height)).attr('cy', y_tree.x1);

    }


    function set_colors() {
        var values_domain = d3.extent(flatten(gene_wise), d => d[values]);

        if (color_style === 'interpolateTriplet') {
            colors = d3.scaleLinear().domain(values_domain.insert(1, 0)).range([negative_color, middle_color, positive_color]); }
        else {
            colors = d3.scaleSequential(d3[color_style]).domain(values_domain); }
    }

    function style({color_style_=color_style,
                    negative_color_=negative_color,
                    middle_color_=middle_color,
                    positive_color_=positive_color,
                    show_sample_metadata_=show_sample_metadata,
                    show_legends_=show_legends,
                    legends_position_=legends_position,
                    darker_legends_=darker_legends,
                    show_x_level_names_=show_x_level_names,
                    show_y_level_names_=show_y_level_names,
                    rotation_=rotation}={}) {

        color_style = color_style_;
        negative_color = negative_color_,
        middle_color = middle_color_,
        positive_color = positive_color_,
        show_sample_metadata = show_sample_metadata_;
        show_legends = show_legends_;
        legends_position = legends_position_;
        darker_legends = darker_legends_;
        show_x_level_names = show_x_level_names_;
        show_y_level_names = show_y_level_names_;
        rotation = rotation_;

        if (ordered_gene_wise.length === 0) { return; }

        // Colors
        set_colors();
        g.selectAll('.rect').style('fill', (d) => colors(d[values]));

        // Hide / Show & Rotate Labels
        x_axis_leaves_rotation = (x_axis_leaves_position === 'before') ? -rotation : rotation;

        g.selectAll('.xcat').attr('visibility', show_x_level_names ? 'visible' : 'hidden');
        g.selectAll('.ycat').attr('visibility', show_y_level_names ? 'visible' : 'hidden')
                            .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+y_category_x[d]+','+x_axis_leaves_y+')');

        g.selectAll('.xtre').filter(node => node.height === 0).attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+d.x0+','+x_axis_leaves_y+')');

        g.selectAll(y_attr === 'sample_id' ? '.ytre_label' : '.xtre_label').attr('visibility', show_sample_metadata ? 'visible' : 'hidden');

        // Legends
        if (show_legends) { configure_legends(); }
        else {
            color_legend.selectAll('*').remove();

            Object.entries(category_legends).forEach(([catg, legend], i) => {
                legend.selectAll('*').remove();
            });
        }

    }

    function configure_legends(transition) {

        if (!transition) { transition = d3.transition().duration(0); }

        color_legend.call(d3.legendColor().scale(colors).title(values)).attr('transform', 'translate(0,0)');

        if      (legends_position === 'left' || legends_position === 'right') { var size_attr = 'height'; }
        else if (legends_position === 'above' || legends_position === 'below') { var size_attr = 'width'; }
        var next_legend_pos = color_legend.node().getBBox()[size_attr];

        Object.entries(category_legends).forEach(([catg, legend]) => {
            legend.call(d3.legendColor().scale(category_colors[catg]).title(catg))
                  .attr('transform', 'translate('+(size_attr === 'width' ? next_legend_pos+20 : 0)+','+(size_attr === 'height' ? next_legend_pos+20 : 0)+')');
            next_legend_pos += legend.node().getBBox()[size_attr]+20;
        });

        var max_legend_size = d3.max(Object.values(category_legends).map(legend => legend.node().getBBox()[size_attr]))+40;
        var furthest_left = -10;
        var furthest_right = x_tree.x1;
        var top = x_axis_nodes_y_height;
        var bottom = y_tree.x1;

        if (y_axis_leaves_position === 'after') { furthest_right += text_max_width(y_tree, y_font_size); } else { furthest_left -= text_max_width(y_tree, y_font_size); }
        if (y_axis_nodes_position === 'after') { furthest_right += y_tree.height * y_axis_nodes_x_width; } else { furthest_left -= y_tree.height * y_axis_nodes_x_width; }
        if (x_axis_leaves_position === 'after') { bottom += text_max_width(x_tree, x_font_size); } else { top -= text_max_width(x_tree, x_font_size); }
        if (x_axis_nodes_position === 'after') { bottom += x_tree.height * x_axis_nodes_y_height; } else { top -= x_tree.height * x_axis_nodes_y_height; }

        if      (legends_position === 'right') { legends.transition(transition).attr('transform', 'translate('+(furthest_right+40)+','+top+')'); }
        else if (legends_position === 'left')  { legends.transition(transition).attr('transform', 'translate('+(furthest_left-max_legend_size)+','+top+')'); }
        else if (legends_position === 'above') { legends.transition(transition).attr('transform', 'translate(0,'+(top-max_legend_size)+')'); }
        else if (legends_position === 'below') { legends.transition(transition).attr('transform', 'translate(0,'+(bottom+40)+')'); }

        g.selectAll('.legend').style('stroke', darker_legends ? 'black' : 'none')

    }

    function resize_fig({
        rect_width_=rect_width,
        rect_height_=rect_height,
        x_axis_nodes_y_height_=x_axis_nodes_y_height,
        y_axis_nodes_x_width_=y_axis_nodes_x_width,}={}) {

        rect_width = rect_width_;
        rect_height = rect_height_;
        x_axis_nodes_y_height = x_axis_nodes_y_height_;
        y_axis_nodes_x_width = y_axis_nodes_x_width_;

        position();

        var rect = g.selectAll('.rect');
        var ytre = g.selectAll('.ytre');
        var xtre = g.selectAll('.xtre');
        var ycat = g.selectAll('.ycat');
        var xcat = g.selectAll('.xcat');

        rect.attr('y', d => y[d[y_attr]])
            .attr('x', d => x[d[x_attr]])
            .attr('width', rect_width-spacing)
            .attr('height', rect_height-spacing);

        ytre.filter(node => node.height === 0).attr('y', d => y[d.data.id])
                                              .attr('x', y_axis_leaves_x)
                                              .style('font-size', y_font_size)
                                              .attr('dy', y_font_size);
        ytre.filter(node => node.depth > 0 && node.height > 0).attr('transform', d => 'translate('+(y_axis_nodes_x + d.y0)+','+d.x1+')rotate(-90)')
        ytre.filter(node => node.depth > 0 && node.height > 0).select('.ytre_box').attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0).style('stroke-dasharray', d => (y_axis_nodes_position === 'before' ? pointing_down(d) : pointing_up(d)));
        ytre.filter(node => node.depth > 0 && node.height > 0).select('.ytre_label').style('font-size', ytre_label_font_size).attr('dy', ytre_label_font_size+spacing);
        ycat.attr('y', x_axis_leaves_y)
            .attr('x', d => y_category_x[d])
            .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+y_category_x[d]+','+x_axis_leaves_y+')')
            .style('font-size', y_cat_font_size)
            .attr('dy', (x_axis_leaves_position === 'before' ? y_cat_font_size : 0));

        xtre.filter(node => node.height === 0).attr('x', d => d.x0)
                                              .attr('y', x_axis_leaves_y)
                                              .attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+d.x0+','+x_axis_leaves_y+')')
                                              .style('font-size', x_font_size)
                                              .attr('dy', (x_axis_leaves_position === 'before' ? x_font_size : 0))
        xtre.filter(node => node.depth > 0 && node.height > 0).attr('transform', d => 'translate('+d.x0+','+(x_axis_nodes_y + d.y0)+')');
        xtre.filter(node => node.depth > 0 && node.height > 0).select('.xtre_box').attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0).style('stroke-dasharray', d => (x_axis_nodes_position === 'before' ? pointing_down(d) : pointing_up(d)));
        xtre.filter(node => node.depth > 0 && node.height > 0).select('.xtre_label').style('font-size', xtre_label_font_size).attr('dy', xtre_label_font_size+spacing);
        xcat.attr('x', y_axis_leaves_x)
            .attr('y', d => x_category_y[d])
            .style('font-size', x_cat_font_size)
            .attr('dy', x_cat_font_size);

        if (show_legends) { configure_legends(); }

    }

    function clear_fig() {
        var transition = d3.transition().duration(500);
        g.selectAll('.rect,.ytre,.xtre,.xcat,.ycat').transition(transition).style('opacity', 0).remove();
        g.selectAll('.legend').selectAll('*').transition(transition).style('opacity', 0).remove();
        selected_gene_sets = {}; genes = {}; samples = {};
        refresh_genes_cb();
    }

    ///////////////////////////////////////////////////////////////////////////
                          ///////      Drag      ///////
    ///////////////////////////////////////////////////////////////////////////

    function drag_node(d, hierarchy, xy, attr) {

        dragging = true;

        let initial_position = (node) => (xy === 'x' ? node.x0 : (node.height === 0 ? node.x0 : node.x1));

        var index_of_dragging_node = d.data.order;
        var current_position_of_dragging_node = (d.x ? d.x : initial_position(d)) + (xy === 'x' ? d3.event.dx : d3.event.dy);
        var dragging_node_width = d.x1 - d.x0;

        var set_nodes = d.parent.children;

        let expr = (node) => {

            var index_of_other_node = node.data.order;
            var original_position_of_other_node = initial_position(node);
            var other_node_width = node.x1 - node.x0;

            if (index_of_other_node < index_of_dragging_node && current_position_of_dragging_node - (xy === 'y' ? dragging_node_width : other_node_width) < original_position_of_other_node) {
                return original_position_of_other_node + dragging_node_width + (margins[attr][d.height] || 0) + spacing;
            }

            if (index_of_other_node > index_of_dragging_node && current_position_of_dragging_node > original_position_of_other_node - (xy === 'y' ? other_node_width : dragging_node_width)) {
                return original_position_of_other_node - dragging_node_width - (margins[attr][d.height] || 0) - spacing;
            }

            if (index_of_other_node !== index_of_dragging_node) { return original_position_of_other_node; }


            if (index_of_other_node === index_of_dragging_node) {
                if (xy === 'y' && node.height > 0) { return clamp(node.parent.x0+other_node_width, node.parent.x1)(current_position_of_dragging_node); }
                else { return clamp(node.parent.x0, node.parent.x1-other_node_width)(current_position_of_dragging_node); }
            }
        };

        var updated_xy = _.object(
            flatten(
                set_nodes.map(node => {
                    var delta = expr(node) - initial_position(node);
                    return node.descendants().map(des => [des.data.id, initial_position(des)+delta]);
                })
            )
        );

        var nodes = g.selectAll('.'+xy+'tre').filter(node => node.data.id in updated_xy).each(node => {node.x = updated_xy[node.data.id]});

        g.selectAll('.rect').filter(rect => updated_xy[rect[attr]]).attr(xy, (rect) => updated_xy[rect[attr]]);
        nodes.filter(node => node.height === 0).attr(xy, node => node.x);
        nodes.filter(node => node.height > 0).attr('transform', (node) => {
            if (xy === 'x') { return 'translate('+node.x+','+(x_axis_nodes_y + node.y0)+')'; }
            if (xy === 'y') { return 'translate('+(y_axis_nodes_x+node.y0)+','+node.x+')rotate(-90)'; }
        });

        if (xy === 'x') {
            nodes.filter(node => node.height === 0).attr('transform', node => 'rotate('+x_axis_leaves_rotation+','+node.x+','+x_axis_leaves_y+')');
        }

    }

    function drag_node_end(d, hierarchy, xy, this_wise, other_wise) {

        if (!dragging) { return; }

        var set_nodes = d.parent.children;

        var new_order = _.object(set_nodes.filter(node => node.data.id !== d.data.id)
                                       .map(node => [node.x, node.data.id])
                                       .concat([[d.x, d.data.id]])
                                       .sort((a, b) => a[0] - b[0])
                                       .map(([y, id], i) => [id, i]));

        hierarchy.each(node => { if (node.data.id && node.data.id in new_order) { node.data.order = new_order[node.data.id]} });
        hierarchy.each(node => { node.x = undefined; }); // do I even need this?

        var old_index = hierarchy.leaves().map(leaf => leaf.data.id).indexOf(d.data.id);
        hierarchy.sort(function(a, b) { return a.depth - b.depth || a.data.order - b.data.order; });
        var new_index = hierarchy.leaves().map(leaf => leaf.data.id).indexOf(d.data.id);

        this_wise.move(old_index, new_index);
        other_wise.forEach((other) => other.move(old_index, new_index));

        dragging = false;
        render();
        refresh_genes_cb();

    }

    // Drag category

    function drag_catg(d, xy, xy_categories, xy_categories_y, layer_width) {

        var yx = (xy === 'x' ? 'y' : 'x');
        var bounds = d3.extent(Object.values(xy_categories_y));
        var current_position_of_dragging_category = clamp(bounds[0], bounds[1])(d3.event[yx]);
        var depth = _.object(xy_categories.map((catg, i) => [catg, i]));

        let expr = (category) => {

            if (depth[category] > depth[d] && current_position_of_dragging_category > xy_categories_y[category] - layer_width/2) { return xy_categories_y[category] - layer_width; }

            if (depth[category] < depth[d] && current_position_of_dragging_category < xy_categories_y[category] + layer_width/2) { return xy_categories_y[category] + layer_width; }

            if (category !== d) { return xy_categories_y[category]; }

            if (category === d) { return current_position_of_dragging_category; }

        }

        var updated_xy_categories_y = _.object(xy_categories, xy_categories.map(expr));

        g.selectAll('.'+xy+'cat').attr(yx, d => updated_xy_categories_y[d]);

        if (xy === 'y') {
            g.selectAll('.ycat').attr('transform', d => 'rotate('+x_axis_leaves_rotation+','+updated_xy_categories_y[d]+','+x_axis_leaves_y+')')
        }

        g.selectAll('.'+xy+'tre').filter(node => node.data.category in updated_xy_categories_y).each(node => {node.y = updated_xy_categories_y[node.data.category]}).attr('transform', function(node) {
            if (xy === 'x') { return 'translate('+node.x0+','+node.y+')'; }
            if (xy === 'y') { return 'translate('+node.y+','+node.x1+')rotate(-90)'; }
        });

    }

    function drag_catg_end(d, xy) {

        var yx = (xy === 'x' ? 'y' : 'x');
        var xy_categories_y = {};
        g.selectAll('.'+xy+'cat').each(function(d) { xy_categories_y[d] = d3.select(this).attr(yx); });
        var updated_categories = Object.entries(xy_categories_y).sort((a, b) => a[1] - b[1]).map(([category, pos]) => category);
        if (_.isEqual(_.sortBy(categories), _.sortBy(updated_categories))) { categories = updated_categories; }
        restart();

    }

    // Drag Resizers

    function drag_rect_resizer(d) {
        d3.select(this).attr('cx', d3.event.x).attr('cy', d3.event.y);
        resize_fig({
            'rect_width_': Math.max((d3.event.x - x_tree.leaves().last().offset), x_tree.leaves().length*2) / x_tree.leaves().length,
            'rect_height_': Math.max((d3.event.y - y_tree.leaves().last().offset), y_tree.leaves().length*2) / y_tree.leaves().length,
        });
    }

    function drag_xtre_resizer(d) {
        d3.select(this).attr('cx', d3.event.x).attr('cy', d3.event.y);
        resize_fig({
            'x_axis_nodes_y_height_': Math.max(x_axis_nodes_y_height + (x_axis_nodes_position === 'before' ? -1 : 1) * (d3.event.dy / (x_tree.height-1)), 4),
            'rect_width_': Math.max((d3.event.x - x_tree.leaves().last().offset), x_tree.leaves().length*2) / x_tree.leaves().length,
        });
    }

    function drag_ytre_resizer(d) {
        d3.select(this).attr('cx', d3.event.x).attr('cy', d3.event.y);
        resize_fig({
            'y_axis_nodes_x_width_': Math.max(y_axis_nodes_x_width + (y_axis_nodes_position === 'before' ? -1 : 1) * (d3.event.dx / (y_tree.height-1)), 4),
            'rect_height_': Math.max((d3.event.y - y_tree.leaves().last().offset), y_tree.leaves().length*2) / y_tree.leaves().length,
        });
    }

    function drag_legend(d) {
        d3.select(this).attr('transform', 'translate('+d3.event.x+','+d3.event.y+')')
    }

    /////////////////////////////////////////////////////////////////////////////
                          ///////     Focus    ///////
    /////////////////////////////////////////////////////////////////////////////

    function setFocus(clicked) {  // clicked is either a node or a rect

        if ('parent' in clicked) {  // clicked is a node

            focused_node = clicked;

            var node_ids = clicked.descendants().map(d => d.data.id).concat(clicked.ancestors().map(d => d.data.id));
            var leaf_ids = clicked.leaves().map(d => d.data.id);

            var tre = ((x_attr === 'gene_id' && clicked.ancestors().last().data.id === 'genes') || (x_attr === 'sample_id' && clicked.ancestors().last().data.id === 'samples')) ? '.xtre' : '.ytre';
            var other_tre = (tre === '.ytre' ? '.xtre' : '.ytre');
            g.selectAll(tre).style('opacity', d => node_ids.includes(d.data.id) ? 1 : unfocused_opacity)
            g.selectAll(other_tre).style('opacity', 1)

            g.selectAll('.rect').style('opacity', d => (leaf_ids.includes(d.sample_id) || leaf_ids.includes(d.gene_id)) ? 1 : unfocused_opacity)

        } else if ('count' in clicked) {  // clicked is a rect

            g.selectAll('.rect').style('opacity', d => (clicked.sample_id === d.sample_id || clicked.gene_id === d.gene_id) ? 1 : unfocused_opacity)

            var gene_ids = genes.descendants().filter(node => node.data.id === clicked.gene_id)[0].ancestors().map(node => node.data.id);
            var sample_ids = samples.descendants().filter(node => node.data.id === clicked.sample_id)[0].ancestors().map(node => node.data.id);

            g.selectAll('.xtre,.ytre').style('opacity', d => (gene_ids.includes(d.data.id) || sample_ids.includes(d.data.id)) ? 1 : unfocused_opacity)

        }
    }

    function removeFocus() {
        g.selectAll('.xtre,.ytre,.rect').style('opacity', 1);
        focused_node = null;
    }

    function remove_node() {

        if (focused_node.ancestors().last().data.id === 'genes') {

            restart({'selected_gene_sets_': flatten(genes.children.map(node => {
                if (node.height === 0) {
                    if (node.data.id === focused_node.data.id) { return {}; }
                    else { return {'gene_set_name':null, 'genes':[node.data.name]} }
                } else {
                    if (node.children.map(gene => gene.data.id).includes(focused_node.data.id)) { return node.children.filter(gene => gene.data.id !== focused_node.data.id).map(gene => { return {'gene_set_name':null, 'genes':[gene.data.name]} }) }
                    else if (node.data.id === focused_node.data.id) { return {}; }
                    else { return {'gene_set_name': node.data.name, 'genes': node.children.map(gene => gene.data.name)} }
                }
            })).filter(obj => Object.keys(obj).length)});

            refresh_genes_cb();

        } else if (focused_node.ancestors().last().data.id === 'samples') {
            focused_node.leaves().forEach(leaf => { delete samples_by_genes_matrix[leaf.data.name] });
            restart();
        }
    }

    d3.select("body").on("keydown", () => { if ((d3.event.keyCode === 8 || d3.event.keyCode === 46) && focused_node) { remove_node(); }});  // ideally we would also make sure the svg is focused

    function GeneCards(d) { window.open('http://www.genecards.org/cgi-bin/carddisp.pl?gene='+d,'_blank') }


    /////////////////////////////////////////////////////////////////////////////
                          ///////   Zoom & Resize    ///////
    /////////////////////////////////////////////////////////////////////////////

    svg.call(d3.zoom().on('zoom', zoomed)).on('wheel.zoom', wheeled);

    var transform = d3.zoomTransform(g);
    transform.x += margin.left;
    transform.y += margin.top;
    g.attr('transform', transform);

    function zoomed() {
        var current_transform = d3.zoomTransform(g);
        current_transform.x += d3.event.sourceEvent.movementX;
        current_transform.y += d3.event.sourceEvent.movementY;
        g.attr('transform', current_transform);
    }

    function wheeled() {
        var current_transform = d3.zoomTransform(g);
        if (d3.event.ctrlKey) {
            current_transform.k = clamp(0.1, 5)(current_transform.k - d3.event.deltaY * 0.01);
        } else {
            if (t) {
                current_transform.x = clamp(-(x_tree.x1-100)*current_transform.k, w)(current_transform.x - d3.event.deltaY);
            } else {
                current_transform.y = clamp(-(y_tree.x1-100)*current_transform.k, h)(current_transform.y - d3.event.deltaY);
            }
        }
        g.attr('transform', current_transform);
    }

    function resize() {
        svg.attr('width', $('#graph-container').innerWidth()).attr('height', $('#graph-container').innerHeight());
        w = $('#graph-container').innerWidth() - (margin.left + margin.right);
        h = $('#graph-container').innerHeight() - (margin.top + margin.bottom);
    }

    d3.select(window).on('resize', resize)

    resize();


    /////////////////////////////////////////////////////////////////////////////
                          ///////    Return    ///////
    /////////////////////////////////////////////////////////////////////////////

    function rendered_gene_sets() {
        if ('children' in genes) {
            return genes.children.map(node => {
                if (node.height === 0) { return {'gene_set_name':null, 'genes':[node.data.name]} }
                else { return {'gene_set_name': node.data.name, 'genes': node.children.map(gene => gene.data.name)} } });
        } else {
            return [];
        }
    }

    function metadata_spacing(dict) {

        Object.entries(dict).forEach(([catg, space]) => {
            if (catg === 'gene_set') { margins['gene_id']['1'] = parseFloat(space); }
            else { margins['sample_id'][categories.length - categories.indexOf(catg).toString()] = parseFloat(space); }
        });

        resize_fig();
    }


    return {
        'restart'     : restart,
        'render'      : render,
        'order'       : order,
        'style'       : style,

        'rendered_gene_sets': rendered_gene_sets,
        'spacing'     : metadata_spacing,

        transpose     : function() { t = !t; [rect_width, rect_height] = [rect_height, rect_width]; [y_axis_style, x_axis_style] = [x_axis_style, y_axis_style]; render(); },
        set_reordering: function(reordering_) { reordering = reordering_; if (reordering) { order(); render(); } },
    }

}






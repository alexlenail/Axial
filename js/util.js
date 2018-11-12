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

let round_to_power_of_10 = v => Math.pow(10, Math.ceil(Math.log10(Math.abs(v)))) * Math.pow(-1, v < 0);
let powerOfTen = (d) => d / Math.pow(10, Math.ceil(Math.log(d) / Math.LN10 - 1e-12)) === 1;

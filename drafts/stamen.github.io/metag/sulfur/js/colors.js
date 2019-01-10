
function defineColors(colorScheme) {

	var backgrounds = {
	  white: {
	    background: "white",
	    fill: "grey",
	    color: "#1f1e1e",
	    listTextColor: function(){return "#1f1e1e"}
	  },
	  black: {
	    background: "#020202",
	    fill: "#d6d6d6",
	    color: "#f9f9f9",
	    listTextColor: function(){return "#f9f9f9"},
	  }
	}

	// for use with nightrider and lightrider
	var magmaCont = d3.scaleSequential(d3.interpolateMagma)
	  .domain([-60,20]);

	var magmaListColors = function(value){
	  color = magmaCont(value);
	  if(value == 1){
	    color = "#f72b57"
	  }
	  if(value == 2 || value == 3){
	    color = "#ff882c"
	  }
	  return color;
	}

	// for SCG for nightrider
	var scgColors = function(value){
	    color = "#fdf244"
	    if(value == 1){
	      color = "#48c3e7"
	    }
	    if(value == 2 || value == 3){
	      color = "#76ff7a"
	    }
	    return color;
	  }

	// for SCG for lightrider
	var scgColorsLight = function(value){
	    color = "#bfe03f"
	    if(value == 1){
	      color = "#0d898e"
	    }
	    if(value == 2 || value == 3){
	      color = "#05b680"
	    }
	    return color;
	  }

	function defineMagmaColorFunction(scgFunction, listFunction, background) {
	  var colorSettings = _.extend(backgrounds[background]);

	  colorSettings.matrixColorFunction = function(count, scg, colName){
	      if(scg){
	        return scgFunction(count);
	      } else {
	        return listFunction(count)
	      }
	    }

	  return colorSettings;
	}

	// color values: 1, 2/3, and >4 
	var greensSCG = ['#e5f5e0', '#a1d99b', '#31a354'];
	var greensMulti = ['#e5f5e0', '#a1d99b', ["#3FAF61", "#19873A"]];

	var purplesMulti = ['#efedf5', "#efedf5", ["#efedf5", "#493E8D"]];
	var purplesSCG = ['#efedf5', "#bcbddc","#756bb1"];

	var bluesSCG = ["#deebf7", "#9ecae1", "#3182bd"];

	var orangesMulti = [ "#fee6ce", "#fdae6b", ["#e6550d", "#b73f03"]];
	var orangesSCG = ['#fee6ce', "#fdae6b","#756bb1"];


	function defineColorFunction(scgColors, multiColors, background){
	  var multiCont = d3.scaleLinear().domain([4,10]).range(multiColors[2]).clamp(true);
	  var colorSettings = Object.assign({},backgrounds[background]);

	  colorSettings.matrixColorFunction = function(count, scg, colName){
	      if(scg){
	        var scgcolor = scgColors[2]
	          if(count == 1){
	            scgcolor = scgColors[0]
	          }
	        if(count == 2 || count == 3){
	          scgcolor = scgColors[1]
	        }
	        return scgcolor;
	      } else {
	        if(count > 3){
	          return multiCont(count)
	        }
	        if(count == 1){
	          return multiColors[0]
	        }
	        if(count == 2 || count == 3){
	          return multiColors[1]
	        }
	      }
	    }

	  return colorSettings;
	}

	var colorSchemes = {
	  bluesAndOrangesOnWhite: defineColorFunction(bluesSCG, orangesMulti, 'white'),
	  bluesAndOrangesOnBlack: defineColorFunction(bluesSCG, orangesMulti, 'black'),
	  greensAndPurplesOnBlack: defineColorFunction(greensSCG, purplesMulti, 'black'),
	  greensAndPurplesOnWhite: defineColorFunction(greensSCG, purplesMulti, 'white'),
	  bluesAndGreensOnBlack: defineColorFunction(bluesSCG, greensMulti, 'black'),
	  bluesAndGreensOnWhite: defineColorFunction(bluesSCG, greensMulti, 'white'),
	  nightrider: defineMagmaColorFunction(scgColors, magmaListColors, 'black'),
	  lightrider: defineMagmaColorFunction(scgColorsLight, magmaListColors, 'white'),
	  classic: {
	    background: "white",
	    fill: "black",
	    color: "#1f1e1e",
	    listTextColor: function(colName){
	      return colorLookup[colName] || "#1f1e1e";
	    },
	    matrixColorFunction: function(value, scg, colName){
	       var color = colorLookup[colName] ? d3.rgb(colorLookup[colName]) : d3.rgb("#1f1e1e");
	       var alpha = .4
	       if(value > 1){
	        value > 3 ? alpha = 1 : alpha = .7
	       }
	       return 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')'
	    }
	  }
	}

	return colorSchemes[colorScheme]
}
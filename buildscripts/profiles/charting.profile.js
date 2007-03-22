var dependencies = [ 
	"dojo.json",
	"dojo.collections.Store",
	"dojo.gfx.color",
	"dojo.gfx.color.hsl",
	"dojo.charting.*",
	"dojo.dom",
	"dojo.svg",
	"dojo.charting.Axis",
	"dojo.charting.Plot",
	"dojo.charting.PlotArea",
	"dojo.charting.Plotters",
	"dojo.charting.Chart",
];

dependencies.dojoLoaded = function(){
	dojo.render.svg.capable = true;
	dojo.render.vml.capable = true;
}

load("getDependencyList.js");

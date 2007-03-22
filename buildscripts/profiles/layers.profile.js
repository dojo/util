// pull in the dependency list and define it in the var "dependencies". This
// over-rides the default built into getDependencyList.js. The bootstrap and
// hostenv files are included by default and don't need to be included here,
// but you can change the hostenv file that's included by setting the value of
// the variable "hostenvType" (defaults to "browser").
var dependencies = [
	"dojo.io.*",
	"dojo.io.BrowserIO",
	"dojo.event.*",
	"dojo.lfx.*"
];

dependencies.layers = [
	{
		name: "dojo2.js",
		layerDependencies: [
			"dojo.js"
		],
		dependencies: [
			"dojo.widget.*"
		]
	},
	{
		name: "dojo3.js",
		layerDependencies: [
			"dojo2.js"
		],
		dependencies: [
			"dojo.widget.Tooltip",
			"dojo.widget.ComboBox"
		]
	}
];

// NOTE: this MUST be included or a list of files must be output via print()
// manually.
load("getDependencyList.js");

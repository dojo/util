// pull in the dependency list and define it in the var "dependencies". This
// overrides the default built into getDependencyList.js. The bootstrap and
// hostenv files are included by default and don't need to be included here,
// but you can change the hostenv file that's included by setting the value of
// the variable "hostenvType" (defaults to "browser").
var dependencies = [ 
	"dojo.lang.common",
	"dojo.lang.array",
	"dojo.lang.extras",
	"dojo.lang.declare",
	"dojo.lang.func",
	"dojo.event",
	"dojo.string.common",
	"dojo.string.extras",
	"dojo.io.*",
	"dojo.io.BrowserIo",
	"dojo.io.cookie",
	"dojo.json",
	"dojo.html.*",
	"dojo.html.display",
	"dojo.html.layout",
	"dojo.html.util"
];

// NOTE: this MUST be included or a list of files must be output via print()
// manually.
load("getDependencyList.js");

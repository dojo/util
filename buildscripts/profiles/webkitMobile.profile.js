// Profile for mobile builds on WebKit.
//
// Use when:
//		- target to webkit platforms (iOS and Android)
//		- document is in standards mode (i.e., with <!DOCTYPE html>)
// Usage:
//		./build.sh releaseDir=... action=release optimize=closure profile=webkitMobile

var profile = {
	// relative to this file
	basePath:"../../..",

	// relative to base path
	releaseDir:"../webkitMobile",

	stripConsole: "normal",

	// Use closure to optimize, to remove code branches for has("ie") etc.
	optimize: "closure",
	layerOptimize: "closure",

	packages:[
		{
			name:"dojo",
			location:"./dojo"
		},
		{
			name:"dijit",
			location:"./dijit"
		},
		{
			name:"dojox",
			location:"./dojox"
		}
	],

	// this is a "new-version" profile since is sets the variable "profile" rather than "depenencies"; therefore
	// the layers property is a map from AMD module id to layer properies...
	layers: {
		"dojo/dojo":{
			// the module dojo/dojo is the default loader (you can make multiple bootstraps with the new builder)
			include: [
				// the include vector gives the modules to include in this layer
				// note: unless the dojo/dojo layer has the property "customBase" set to truthy, then module
				// dojo/main will be automatically added...and conversely
				"dijit/_WidgetBase",
				"dijit/_Container",
				"dijit/_Contained",
				"dijit/registry"
				// TODO: do we need to list dojo/selector/lite to avoid an extra request?
			]
		},
		"dojox/mobile":{
			include: [
				"dojox/mobile"
			],
			exclude: [
				// exclude gives a dependency forrest to exclude; i tend to put is second since the algorithm is...
				//
				// The modules to include in a particular layer are computed as follows:
				//
				// 1. The layer module itself.
				//
				// 2. Plus the dependency graph implied by the AMD dependencies of the layer module. This is given
				//	by the dependency vector found in the define application associated with the target module,
				//	the modules found in the dependency vectors of those modules, and so on until all modules in
				//	the graph have been found (remember, though not desirable, there may be cycles, so the graph
				//	is not necessarily a tree).
				//
				// 3. Plus all modules given in the include array, along with all of those modules' dependency graphs.
				//
				// 4. Less all modules given in the exclude array, along with all of those modules' dependency graphs.

				"dojo/dojo"
			]
		},
		"dojox/mobile/app":{
			include: [
				"dojox/mobile/app"
			],
			exclude: [
				"dojo/dojo",
				"dojox/mobile"
			]


		}
	},

	staticHasFeatures: {
		// Default settings for a browser, from dojo.js; apparently these get modified in special cases
		// like when running under node, or against RequireJS, but nothing we need to worry about.
		"host-browser":1,
		"host-node": false,
		"host-rhino": false,
		"dom":1,
		"dojo-amd-factory-scan":1,
		"dojo-loader":1,
		"dojo-has-api":1,
		"dojo-inject-api":1,
		"dojo-timeout-api":1,
		"dojo-trace-api":1,
		"dojo-log-api":1,
		"dojo-dom-ready-api":1,
		"dojo-publish-privates":1,
		"dojo-config-api":1,
		"dojo-sniff":1,
		"dojo-sync-loader":1,
		"dojo-test-sniff":1,
		"config-tlmSiblingOfDojo":1,

		// Other configuration switches that are hardcoded in the source.
		// Setting some of these to false may reduce code size, but unclear what they all mean.
		"config-publishRequireResult": 1,
		"dojo-config-addOnLoad": 1,		// hardcoded to 1 in the source
		"dojo-config-require": 1,
		"dojo-debug-messages": true,
		"dojo-gettext-api": 1,			// apparently unused
		"dojo-guarantee-console": 1,
		"dojo-loader-eval-hint-url": 1,
		"dojo-modulePaths": 1,
		"dojo-moduleUrl": 1,
		"dojo-v1x-i18n-Api": 1,
		"dojo-xhr-factory": 1,	// if require.getXhr() exists (true for dojo's AMD loader, false for requireJS?)
		"extend-dojo": 1,		// add functions to global dojo object

		// Browser flags
		"webkit": true,	// this is actually a number like 525 but I don't think anyone is using it
		"air": false,
		"ff": undefined,
		"mozilla": undefined,
		"ie": undefined,

		// Configuration settings
		"config-selectorEngine": "lite",
		"dijit-legacy-requires": false,		// don't load unrequested modules for back-compat
		"dom-quirks": false,				// we assume/require that the app is in strict mode
		"quirks": false,					// we assume/require that the app is in strict mode

		// Flags for old IE browser bugs / non-standard behavior
		"array-extensible": true,		// false for old IE
		"bug-for-in-skips-shadowed": 0,	// false for old IE
		"dom-attributes-explicit": true,	// everyone except IE6, 7
		"dom-attributes-specified-flag": true,	//everyone except IE6-8
		"dom-addeventlistener": true,		// everyone except IE
		"native-xhr": true,			// has XMLHTTPRequest
		"ie-event-behavior": undefined,
		"dojo-force-activex-xhr": false,	// true is for IE path

		// Flags for features
		"dom-matches-selector": true,
		"dom-qsa": true,
		"dom-qsa2.1": true,
		"dom-qsa3": true,
		"json-parse": true,
		"json-stringify": true,

		// Behavior that varies by browser, but is constant across webkit mobile browsers
		"events-keypress-typed": true,		// whether printable characters generate keypress event?
		"events-mouseenter": false,		// this is set by mouse.html but never used
		"touch": true

		// Values which can be different across mobile devices, so intentionally not specified in this list.
		// "event-orientationchange": true,
		// "safari": true,
		// "android": true
		// "wii": true
	},

	// Not sure if this is right?	We just want to use querySelectorAll().
	selectorEngine:"lite",

	defaultConfig:{
		hasCache:{
			// default
			"config-selectorEngine":"lite"
		},
		async:1
	}
};
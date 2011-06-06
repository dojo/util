dependencies = {
	stripConsole: "normal",
	layers: [
		{
			name: "dojo.js",
			dependencies: [
				"dojo.selector.lite",
				"dijit._WidgetBase",
				"dijit._Container",
				"dijit._Contained",
				"dijit._base.manager"
			]
		},
		{
			name: "../dojox/mobile.js",
			layerDependencies: [
				"dojo.js"
			],
			dependencies: [
				"dojox.mobile",
				"dojox.mobile.compat"
			]
		},
		{
			name: "../dojox/mobile/app.js",
			layerDependencies: [
				"dojo.js",
				"../dojox/mobile.js"
			],
			dependencies: [
				"dojox.mobile.app"
			]
		},
		{
			name: "../dojox/mobile/_compat.js",
			layerDependencies: [
				"dojo.js",
				"../dojox/mobile.js"
			],
			dependencies: [
				"dojox.mobile._compat"
			]
		},
		{
			name: "../dojox/mobile/app/compat.js",
			layerDependencies: [
				"dojo.js",
				"../dojox/mobile/_compat.js",
				"../dojox/mobile/app.js"
			],
			dependencies: [
				"dojox.mobile.app.compat"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}

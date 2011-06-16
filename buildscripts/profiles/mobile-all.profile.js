dependencies = {
	stripConsole: "normal",

	layers: [
		{
			name: "dojo.js",
			customBase: true,
			dependencies: [
				"dojo.selector.lite",
				"dojox.mobile.parser",
				"dojox.mobile",
				"dojox.mobile.compat"
			]
		},
		{
			name: "../dojox/mobile/_compat.js",
			layerDependencies: [
				"dojo.js"
			],
			dependencies: [
				"dojox.mobile._compat"
			]
		}
	],

	plugins: { // workaround to exclude acme.js from the build (until #13198 is fixed)
		"dojo/text":"build/plugins/text",
		"dojo/i18n":"build/plugins/i18n",
		"dojo/has":"build/plugins/has"
	},

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}

dependencies = {
	layers: [
		{
			name: "../dijit/dijit.js",
			resourceName: "dijit.dijit",
			dependencies: [
				"dijit.dijit"
			]
		},
		{
			name: "../dijit/dijit-all.js",
			resourceName: "dijit.dijit-all",
			layerDependencies: [
				"../dijit/dijit.js"
			],
			dependencies: [
				"dijit.dijit-all"
			]
		},
		{
			name: "../dojox/off/offline.js",
			resourceName: "dojox.off.offline",
			layerDependencies: [
			],
			dependencies: [
				"dojox.off.offline"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}

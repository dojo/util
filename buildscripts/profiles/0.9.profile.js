dependencies = {
	layers: [
		{
			name: "../dijit/dijit.js",
			layerDependencies: [
			"dojo.js"
			],
			dependencies: [
				"dijit.dijit"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}

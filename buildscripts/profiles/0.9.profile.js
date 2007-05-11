var dependencies = [
	"dojo._base"
];

dependencies.layers = [
	{
		name: "../dijit/dijit.js",
		layerDependencies: [
			"dojo.js"
		],
		dependencies: [
			"dijit.dijit"
		]
	}
];

dependencies.prefixes = [
	[ "dijit", "../dijit" ],
	[ "dojox", "../dojox" ],
];

dependencies ={

    layers:  [
        {
        name: "dojoCometd.js",
        dependencies: [
            "dojo",
            "dojox.cometd",
        ]
        }
    ],

    prefixes: [
        [ "dijit", "../dijit" ],
        [ "dojox", "../dojox" ]
    ]

};
var dependencies = [
	"dojo._base"
];

dependencies.layers = [
	{
		name: "cometd.js",
		layerDependencies: [
			"dojo.js"
		],
		dependencies: [
			"dojox.io.cometd"
		]
	},
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

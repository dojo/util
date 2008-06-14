
dependencies = {
	layers: [
		{
			name: "../custom/layer.js",
			resourceName: "custom.layer",
			dependencies:[
				"custom.layer"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ],
		[ "custom", "../custom" ]
	]
}

//If you choose to optimize the JS files in a prefix directory (via the optimize= build parameter),
//you can choose to have a custom copyright text prepended to the optimized file. To do this, specify
//the path to a file tha contains the copyright info as the third array item in the prefixes array. For
//instance:
//	prefixes: [
//		[ "mycompany", "/path/to/mycompany", "/path/to/mycompany/copyright.txt"]
//	]
//
//	If no copyright is specified in this optimize case, then by default, the dojo copyright will be used.

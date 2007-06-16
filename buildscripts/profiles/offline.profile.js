dependencies = {
	layers: [
		{
			name: "../dojox/offline.js",
			layerDependencies: [
			],
			dependencies: [
				"dojox.off",
				"dojox.off.files",
				"dojox.off.sync",
				"dojox.off.ui",
				"dojox.storage",
				"dojox.storage.Provider",
				"dojox.storage.manager",
				"dojox.storage.GearsStorageProvider",
				"dojox.sql",
				"dojox.crypto.DES"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}
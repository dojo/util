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
                //    by the dependency vector found in the define application associated with the target module,
                //    the modules found in the dependency vectors of those modules, and so on until all modules in
                //    the graph have been found (remember, though not desirable, there may be cycles, so the graph
                //    is not necessarily a tree).
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
		// Browser specific build flags
		// TODO: Change non-webkit browers to undefined (instead of false) when #14792 is fixed
        webkit: true,
        ie: false,
        mozilla: false,
        opera: false,
		quirks: false		// this profile requires applications to be in standards mode

		// Other build flags like dom-addEventListener
		// TODO: fill these in after I get the hasReport build transform working
    },

	// Not sure if this is right?    We just want to use querySelectorAll().
    selectorEngine:"lite",

    defaultConfig:{
        hasCache:{
            // default
            "config-selectorEngine":"lite"
        },
        async:1
    }
};
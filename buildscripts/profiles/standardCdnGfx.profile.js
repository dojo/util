/*
This is a special build that combines dojo.js with dojox.gfx to work around this trac issue
with doing CDN/xdomain builds:
http://trac.dojotoolkit.org/ticket/4462

After a build with this profile is done, copy the built dojo.xd.js to your normal xdomain build
but name the file gfx-dojo.xd.js (and gfx-dojo.xd.js.uncompressed.js if taking the uncompressed
file too). If you need to use dojox.gfx in an xdomain fashion, reference gfx-dojo.xd.js instead
of dojo.xd.js.
*/

dependencies = {

	layers: [
		{
			name: "dojo.js",
			dependencies: [
				"dojox.gfx"
			]
		}
	],

	prefixes: [
		[ "dijit", "../dijit" ],
		[ "dojox", "../dojox" ]
	]
}

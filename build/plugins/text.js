///
// \module b	uild/plugins/text
//
// This build plugin caches text resources by cache identifiers that are computed by...
//
//	 * removing any filetype
//	 * computing the resulting module information (with respect to the reference module if the resource id is relative)
//	 * appending the filetype (if any) to the module information AMD path
//
// For example, the text resource "myPackage/myModule/myResource.html" implies the cache identifier
// "myPackage/myModule/myResource.html" (assuming "myPackage/myModule/myResource" is a valid
// AMD module id). This is also to some that if the passed mid cannot be resolved to a valid AMD module
// (after stripping the filetype (if any) and "!strip" pragma (if anY), then this plugin cannot determine a cache id, and
// therefore cannot cache the text
//
define(["dojo/json"], function(json) {
	var
		// note: we use *x in the pattern since it is guaranteed not to be in any real path or filetype
		cacheTemplate= 'define("*text/*1", *2);\n\n',

		getPluginLayerText= function() {
			return cacheTemplate.replace("*1", this.pqn).replace("*2", json.stringify(this.module.text));
		},

		makePluginPseudoModule= function(module, path, filetype) {
			return {
				module:module,
				path:path,
				filetype:filetype,
				pqn:path+filetype,
				deps:[],
				getPluginLayerText:getPluginLayerText,
				internStrings:getPluginLayerText
			};
		},

		start= function(
			mid,
			referenceModule,
			bc
		) {
			var textPlugin= bc.amdResources["dojo*text"];
			if (!textPlugin) {
				throw new Error("text! plugin missing");
			}

			// mid may have a filetype (e.g., ".html") and/or a pragma (e.g. "!strip")
			var
				match= mid.split("!")[0].match(/(.+?)(\.[^\/]*)?$/),
				moduleInfo= bc.getSrcModuleInfo(match[1], referenceModule),
				filetype= match[2] || "",
				url= moduleInfo.url.substring(0, moduleInfo.url.length-3) + filetype,
				textResource= bc.resources[url];
			if (!textResource) {
				throw new Error("text resource (" + url + ") missing");
			}
			if(bc.internStrings){
				textResource.tag.noWrite= 1;
			}
			return [textPlugin, makePluginPseudoModule(textResource, moduleInfo.path, filetype)];
		};

	return {
		start:start
	};
});

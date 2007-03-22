// This little utility is invoked by the build to flatten all of the JSON resource bundles used
// by dojo.requireLocalization(), much like the main build itself, to optimize so that multiple
// web hits will not be necessary to load these resources.  Normally, a request for a particular
// bundle in a locale like "en-us" would result in three web hits: one looking for en_us/ another
// for en/ and another for ROOT/.  All of this multiplied by the number of bundles used can result
// in a lot of web hits and latency.  This script uses Dojo to actually load the resources into
// memory, then flatten the object and spit it out using dojo.json.serialize.  The bootstrap
// will be modified to download exactly one of these files, whichever is closest to the user's
// locale.

// The input {releaseDir} is the release directory for the build.
// The input {reqFile} is the list of dojo.requireLocalization() commands grepped from a build.
// A list of locales to build is loaded.  Any applicable locales plus all partial locales will
// be generated in the appropriate files at {destDir}/{prefix}_{locale}.js.  Lastly, the list of
// actual translations found and processed is returned as an array in stdout.

var releaseDir = arguments[0];
var profileFile = arguments[1];
var reqFile = arguments[2];
var destDir = arguments[3];
var prefix = arguments[4];
var localeList = arguments[5].split(',');

djConfig={
	locale: 'xx',
	extraLocale: localeList,
	baseRelativePath: "../"
};

load('../dojo.js');

dojo.require("dojo.string.extras");
dojo.require("dojo.i18n.common");
dojo.require("dojo.json");
load("buildUtil.js");

var djLoadedBundles = [];

//TODO: register plain function handler (output source) in jsonRegistry?
var drl = dojo.requireLocalization;
dojo.requireLocalization = function(modulename, bundlename, locale){
	drl(modulename, bundlename, locale);
//TODO: avoid dups?
	djLoadedBundles.push({modulename: modulename, module: eval(modulename), bundlename: bundlename});
};

load(reqFile);

//print("loaded bundles: "+djLoadedBundles.length);

var djBundlesByLocale = {};
var jsLocale, entry, bundle;

for (var i = 0; i < djLoadedBundles.length; i++){
	entry = djLoadedBundles[i];
	bundle = entry.module.nls[entry.bundlename];
	for (jsLocale in bundle){
		if (!djBundlesByLocale[jsLocale]){djBundlesByLocale[jsLocale]=[];}
		djBundlesByLocale[jsLocale].push(entry);
	}
}

localeList = [];

//Save flattened bundles used by dojo.js.
var mkdir = false;
var dir = new java.io.File(destDir);
for (jsLocale in djBundlesByLocale){
	var locale = jsLocale.replace('_', '-');
	if(!mkdir){ dir.mkdir(); mkdir = true; }
	var outFile = new java.io.File(dir, prefix + "_" + locale + ".js");
	var os = new java.io.BufferedWriter(
			new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), "utf-8"));
	try{
		os.write("dojo.provide(\"nls.dojo_"+locale+"\");");
		for (var j = 0; j < djLoadedBundles.length; j++){
			entry = djLoadedBundles[j];
			var bundlePkg = [entry.modulename,"nls",entry.bundlename].join(".");
			var translationPkg = [bundlePkg,jsLocale].join(".");
			bundle = entry.module.nls[entry.bundlename];
			if(bundle[jsLocale]){ //FIXME:redundant check?
				os.write("dojo.provide(\""+bundlePkg+"\");");
				os.write(bundlePkg+"._built=true;");
				os.write("dojo.provide(\""+translationPkg+"\");");
				os.write(translationPkg+"="+dojo.json.serialize(bundle[jsLocale])+";");
			}
		}
	}finally{
		os.close();
	}
	localeList.push(locale);
}

//Flatten all bundles and modifying dojo.requireLocalization calls.
var prefixes = buildUtil.configPrefixes(profileFile);
var fileList = buildUtil.getFilteredFileList(releaseDir + "/src", /\.js$/, true);

for(var i= 0; i < fileList.length; i++){
	//Use new String so we get a JS string and not a Java string.
	var jsFileName = new String(fileList[i]);
	var fileContents = null;
	
	//Files in nls directories (except for the top level one in Dojo that has multiple
	//bundles flattened) need to have special xd contents.
	if(jsFileName.match(/\/nls\//) && jsFileName.indexOf(releaseDir + "/nls/") == -1){
		fileContents = "(" + buildUtil.makeFlatBundleContents("dojo", djConfig.baseRelativePath + "/src", jsFileName) + ")";			
	}else{
		fileContents = buildUtil.modifyRequireLocalization(readText(jsFileName), djConfig.baseRelativePath, prefixes);
	}
	
	if(fileContents){
		buildUtil.saveUtf8File(jsFileName, fileContents);
	}
}

print(dojo.json.serialize(localeList));

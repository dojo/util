//Main build script for Dojo
var buildTimerStart = (new Date()).getTime();

load("jslib/logger.js");
load("jslib/fileUtil.js");
load("jslib/buildUtil.js");

//Convert arguments to keyword arguments.
var kwArgs = buildUtil.convertArrayToObject(arguments);

//Set some defaults for some args if they are missing.
kwArgs.releaseName = kwArgs["releaseName"] || "dojo";
kwArgs.releaseDir = "release/" + kwArgs["releaseName"] || "dojo";
kwArgs.version = kwArgs["version"] || "0.0.0.dev";
kwArgs.action = (kwArgs["action"] || "release").split(",");
kwArgs.loader = kwArgs["loader"] || "default";
if(!kwArgs["profileFile"] && kwArgs["profile"]){
	kwArgs.profileFile = "profiles/" + kwArgs.profile + ".profile.js";
}
if(typeof kwArgs["internStrings"] == "undefined"){
	kwArgs.internStrings = true;	
}
if(kwArgs["log"]){
	logger.level = logger[kwArgs["log"]];
}
if(typeof kwArgs["copyTests"] == "undefined"){
	kwArgs.copyTests = true;	
}

//Execute the requested build actions
var action = kwArgs.action;
for(var i = 0; i < action.length; i ++){
	logger.logPrefix = action[i] + ": ";
	this[action[i]]();
	logger.logPrefix = "";
}

var buildTime = ((new Date().getTime() - buildTimerStart) / 1000);
logger.info("Build time: " + buildTime + " seconds");

//********* Start clean ************
function clean(){
	logger.info("Deleting: " + kwArgs.releaseDir);
	fileUtil.deleteFile(kwArgs.releaseDir);
}
//********* End clean *********

//********* Start release *********
function release(){
	logger.info("Using profile: " + kwArgs.profileFile);

	logger.info("Using version number: " + kwArgs.version + " for the release.");
	
	clean();
	
	//Get the list of module directories we need to process.
	//They will be in the dependencies.prefixes array.
	kwArgs.profileProperties = buildUtil.evalProfile(kwArgs.profileFile);
	var dependencies = kwArgs.profileProperties.dependencies;
	var prefixes = dependencies.prefixes;
	var dojoPrefixPath = null;
	var lineSeparator = fileUtil.getLineSeparator();
	var copyrightText = String(fileUtil.readFile("copyright.txt"));
	var buildNoticeText = String(fileUtil.readFile("build_notice.txt"));
	
	//Copy each prefix dir to the releases and
	//operate on that copy.
	for(var i = 0; i < prefixes.length; i++){
		var prefixName = prefixes[i][0];
		var prefixPath = prefixes[i][1];
		
		//Set prefix path to the release location, so that
		//build operations that depend/operate on it are using
		//the release location.
		prefixes[i][1] = kwArgs.releaseDir + "/"  + prefixName;

		//Save dojo for last.
		if(prefixName == "dojo"){
			dojoPrefixPath = prefixPath;
		}else{
			_prefixPathRelease(prefixName, prefixPath, kwArgs);
		}
	}

	//Now process Dojo core. Special things for that one.
	if(dojoPrefixPath){
		 _prefixPathRelease("dojo", dojoPrefixPath, kwArgs);

		//FIXME: loadDependency list reparses profile file, but we've already done that.
		logger.trace("Building dojo.js and layer files");
		var result = buildUtil.makeDojoJs(buildUtil.loadDependencyList(kwArgs.profileFile), kwArgs.version);

		//Save the build layers. The first layer is dojo.js.
		var layerLegalText = copyrightText + buildNoticeText;
		var dojoReleaseDir = kwArgs.releaseDir + "/dojo/";
		for(var i = 0; i < result.length; i++){
			var fileName = dojoReleaseDir + result[i].layerName;
			var fileContents = result[i].contents;
			
			//FIXME: Flatten resources. Only do the top level flattening for bundles
			//in the layer files. How to do this for layers? only do one nls file for
			//all layers, or a different one for each layer?
			//		<replaceregexp match="/\*\*\*BUILD:localesGenerated\*\*\*/" byline="false" replace="=${generatedLocales}"
			//	file="${dstFile}"/>
			//remove dojo.requireLocalization calls.

			//Save uncompressed file.
			var uncompressedFileName = fileName + ".uncompressed.js";
			fileUtil.saveFile(uncompressedFileName, layerLegalText + fileContents);

			//Save compressed file.
			//FIXME: this probably breaks with multiple layers -- it seems like an issue
			//inside the compressor.
			var compresedContents = buildUtil.optimizeJs(fileName, fileContents, layerLegalText, true);
			fileUtil.saveFile(fileName, compresedContents);

			//Intern strings if desired.
			if(kwArgs.internStrings){
				logger.info("Interning strings for file: " + fileName);
				var prefixes = dependencies["prefixes"] || [];
				var skiplist = dependencies["internSkipList"] || [];
				buildUtil.internTemplateStringsInFile(uncompressedFileName, dojoReleaseDir, prefixes, skiplist);
				buildUtil.internTemplateStringsInFile(fileName, dojoReleaseDir, prefixes, skiplist);
			}
		}

		//Save the dependency lists to build.txt
		var buildText = "Files baked into this build:" + lineSeparator;
		for(var i = 0; i < result.length; i++){
			buildText += lineSeparator + result[i].layerName + ":" + lineSeparator;
			buildText += result[i].depList.join(lineSeparator) + lineSeparator;
		}
		fileUtil.saveFile(kwArgs.releaseDir + "/dojo/build.txt", buildText);

		logger.info(buildText);
	}
}
//********* End release *********

//********* Start _releasePrefixPath *********
function _prefixPathRelease(prefixName, prefixPath, kwArgs){
	var releasePath = kwArgs.releaseDir + "/"  + prefixName;
	var copyRegExp = /./;
	
	//Use the copyRegExp to filter out tests if requested.
	if(!kwArgs.copyTests){
		copyRegExp = new RegExp(prefixName.replace(/\\/g, "/") + "/(?!tests)");
	}

	fileUtil.copyDir(prefixPath, releasePath, copyRegExp);

	//Intern strings if desired.
	if(kwArgs.internStrings){
		logger.info("Interning strings for: " + releasePath);
		buildUtil.internTemplateStrings(kwArgs.profileProperties.dependencies, releasePath);
	}

	//FIXME: flatten bundles inside the directory

	//FIXME: Run xdgen if an xdomain build.
}
//********* End _releasePrefixPath *********


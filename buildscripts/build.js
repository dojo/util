//Main build script for Dojo

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


//********* Start clean ************
function clean(){
	logger.info("Deleting: " + kwArgs.releaseDir);
	fileUtil.deleteFile(kwArgs.releaseDir);
}
//********* End clean *********

//********* Start release *********
function release(){
	logger.info("Using version number: " + kwArgs.version + " for the release.");
	logger.info("profileFile: " + kwArgs.profileFile);
	
	clean();
	
	//Get the list of module directories we need to process.
	//They will be in the dependencies.prefixes array.
	var profileProperties = buildUtil.evalProfile(kwArgs.profileFile);
	var dependencies = profileProperties.dependencies;
	var prefixes = dependencies.prefixes;
	var dojoPrefixPath = null;
	var lineSeparator = fileUtil.getLineSeparator();

	//Copy each prefix dir to the releases and
	//operate on that copy.
	for(var i = 0; i < prefixes.length; i++){
		var prefixName = prefixes[i][0];
		var prefixPath = prefixes[i][1];
		
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
		var result = buildUtil.makeDojoJs(buildUtil.loadDependencyList(kwArgs.profileFile), kwArgs.version);

		//Save the dojo.js contents. It is always the first result.
		fileUtil.saveFile(kwArgs.releaseDir + "/dojo/dojo.js", result[0].contents);

		//Save the other layers, if there are any.
		for(var i = 1; i < result.length; i++){
			fileUtil.saveFile(kwArgs.releaseDir + "/dojo/" + result[i].layerName, result[i].contents);
		}

		//Save the dependency list to build.txt
		var buildText = "Files baked into this build:" + lineSeparator;
		for(var i = 0; i < result.length; i++){
			buildText += lineSeparator + result[i].layerName + ":" + lineSeparator;
			buildText += result[i].depList.join(lineSeparator) + lineSeparator;
		}

		fileUtil.saveFile(kwArgs.releaseDir + "/dojo/build.txt", buildText);

		logger.info(buildText);


		//-flatten-resources
		//		<replaceregexp match="/\*\*\*BUILD:localesGenerated\*\*\*/" byline="false" replace="=${generatedLocales}"
		//	file="${dstFile}"/>
		
		//remove dojo.requireLocalization calls.
		
		//Make a compressed and uncompressed version of the layer files.
		
		//add build_notice and copyright to module files.

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
	
	//makeDojoJs.js
	//xxx
	
	//flatten 
	//Run xdgen if an xdomain build.
	//xxx
}
//********* End _releasePrefixPath *********


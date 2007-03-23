//Main build script for Dojo

load("jslib/logger.js");
load("jslib/fileUtil.js");
load("jslib/buildUtil.js");

//Constants
var releaseDir = "release/";

//Convert arguments to keyword arguments.
var kwArgs = buildUtil.convertArrayToObject(arguments);

//Set some defaults for some args if they are missing.
kwArgs.releaseName = kwArgs["releaseName"] || "dojo";
releaseDir += kwArgs.releaseName;
kwArgs.version = kwArgs["version"] || "0.0.0.dev";
kwArgs.actions = (kwArgs["action"] || "release").split(",");
if(!kwArgs["profileFile"] && kwArgs["profile"]){
	kwArgs.profileFile = "profiles/" + kwArgs.profile + ".profile.js";
}
if(kwArgs["log"]){
	logger.level = logger[kwArgs["log"]];
}
if(typeof kwArgs["copyTests"] == "undefined")
	kwArgs.copyTests = true;	
}

//*** Start clean ***
function clean(){
	fileUtil.deleteFile(releaseDir);
}
//*** End clean ***

//*** Start release ***
function release(){
	logger.info("Using version number: " + kwArgs.version + " for the release.");
	
	clean();
	
	//Get the list of module directories we need to process.
	
	//Copy each module directory.
	
	
	
}
//*** End release ***

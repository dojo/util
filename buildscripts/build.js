//Main build script for Dojo
var buildTimerStart = (new Date()).getTime();

load("jslib/logger.js");
load("jslib/fileUtil.js");
load("jslib/buildUtil.js");
load("jslib/i18nUtil.js");

var DojoBuildOptions = {
	"profile": {
		defaultValue: "base",
		helpText: "The name of the profile to use for the build. It must be the first part of "
			+ "the profile file name in the profiles/ directory. For instance, to use base.profile.js, "
			+ "specify profile=base."
	},
	"profileFile": {
		defaultValue: "",
		helpText: "A file path to the the profile file. Use this if your profile is outside of the profiles "
			+ "directory. Do not specify the \"profile\" build option if you use \"profileFile\"."
	},
	"action": {
		defaultValue: "help",
		helpText: "The build action(s) to run. Can be a comma-separated list, like action=clean,release. "
			+ "The possible build actions are: clean, release."
	},
	"version": {
		defaultValue: "0.0.0.dev",
		helpText: "The build will be stamped with this version string."
	},
	"localeList": {
		defaultValue: "en-gb,en-us,de-de,es-es,fr-fr,it-it,pt-br,ko-kr,zh-tw,zh-cn,ja-jp",
		helpText: "The set of locales to use when flattening i18n bundles."
	},
	
	"releaseName": {
		defaultValue: "dojo",
		helpText: "The name of the release. A directory inside 'releaseDir' will be created with this name."
	},
	"releaseDir": {
		defaultValue: "../../release/",
		helpText: "The top level release directory where builds end up. The 'releaseName' directories will "
			+ " be placed inside this directory."
	},
	"loader": {
		defaultValue: "default",
		helpText: "The type of dojo loader to use. \"default\" or \"xdomain\" are acceptable values."		
	},
	"internStrings": {
		defaultValue: true,
		helpText: "Turn on or off widget template/dojo.uri.cache() file interning."
	},
	"copyTests": {
		defaultValue: true,
		helpText: "Turn on or off copying of test files."
	},
	"log": {
		defaultValue: logger.TRACE,
		helpText: "Sets the logging verbosity. See jslib/logger.js for possible integer values."
	}
};

//*****************************************************************************
//Convert arguments to keyword arguments.
var kwArgs = _makeBuildOptions(arguments);

//Set logging level.
logger.level = kwArgs["log"];

//Execute the requested build actions
var action = kwArgs.action;
for(var i = 0; i < action.length; i ++){
	logger.logPrefix = action[i] + ": ";
	this[action[i]]();
	logger.logPrefix = "";
}

var buildTime = ((new Date().getTime() - buildTimerStart) / 1000);
logger.info("Build time: " + buildTime + " seconds");
//*****************************************************************************

//********* Start help ************
function help(){
	var buildOptionText = "";
	for(var param in DojoBuildOptions){
		buildOptionText += param + "=" + DojoBuildOptions[param].defaultValue + "\n"
			+ DojoBuildOptions[param].helpText + "\n\n";
	}

	var helpText = "To run the build, you must have Java 1.4.2 or later installed.\n"
		+ "To run a build run the following command from this directory:\n\n"
		+ "> java -jar lib/custom_rhino.jar build.js [name=value...]\n\n"
		+ "Here is an example of a typical release build:\n\n"
		+ "> java -jar lib/custom_rhino.jar build.js profile=base action=release\n\n"
		+ "The possible name=value build options are shown below with the defaults as their values:\n\n"
		+ buildOptionText;
	
	print(helpText);
}
//********* End help *********

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

	var dependencies = kwArgs.profileProperties.dependencies;
	var prefixes = dependencies.prefixes;
	var dojoPrefixPath = null;
	var lineSeparator = fileUtil.getLineSeparator();
	var copyrightText = fileUtil.readFile("copyright.txt");
	var buildNoticeText = fileUtil.readFile("build_notice.txt");
	
	//Find the dojo prefix path. Need it to process other module prefixes.
	for(var i = 0; i < prefixes.length; i++){
		if(prefixes[i][0] == "dojo"){
			dojoPrefixPath = prefixes[i][1];
			break;
		}
	}

	//Get the list of module directories we need to process.
	//They will be in the dependencies.prefixes array.
	//Copy each prefix dir to the releases and
	//operate on that copy.
	for(var i = 0; i < prefixes.length; i++){
		var prefixName = prefixes[i][0];
		var prefixPath = prefixes[i][1];
		
		//Set prefix path to the release location, so that
		//build operations that depend/operate on it are using
		//the release location.
		prefixes[i][1] = kwArgs.releaseDir + "/"  + prefixName;

		//dojo prefix is special. Do that later.
		if(prefixName != "dojo"){
			var finalPrefixPath = prefixPath;
			if(finalPrefixPath.indexOf(".") == 0){
				finalPrefixPath = dojoPrefixPath + "/" + prefixPath;
			}
			_prefixPathRelease(prefixName, finalPrefixPath, kwArgs);
		}
	}

	//Now process Dojo core. Special things for that one.
	 _prefixPathRelease("dojo", dojoPrefixPath, kwArgs);

	//Make sure dojo is clear before trying to map dependencies.
	if(typeof dojo != "undefined"){
		dojo = undefined;
	}

	logger.trace("Building dojo.js and layer files");
	var result = buildUtil.makeDojoJs(buildUtil.loadDependencyList(kwArgs.profileProperties), kwArgs.version);

	//Save the build layers. The first layer is dojo.js.
	var layerLegalText = copyrightText + buildNoticeText;
	var dojoReleaseDir = kwArgs.releaseDir + "/dojo/";
	for(var i = 0; i < result.length; i++){
		var fileName = dojoReleaseDir + result[i].layerName;
		var fileContents = result[i].contents;
		
		//Flatten resources 
		//FIXME: Flatten resources. Only do the top level flattening for bundles
		//in the layer files. How to do this for layers? only do one nls file for
		//all layers, or a different one for each layer?
		if(fileName == "dojo.js"){
			i18n.flattenLayerFileBundles(fileName, dojoReleaseDir + "nls", "nls", kwArgs);
		}

		//Save uncompressed file.
		var uncompressedFileName = fileName + ".uncompressed.js";
		fileUtil.saveFile(uncompressedFileName, layerLegalText + fileContents);
		
		//Intern strings if desired. Do this before compression, since, in the xd case,
		//"dojo" gets converted to a shortened name.
		if(kwArgs.internStrings){
			logger.info("Interning strings for file: " + fileName);
			var prefixes = dependencies["prefixes"] || [];
			var skiplist = dependencies["internSkipList"] || [];
			buildUtil.internTemplateStringsInFile(uncompressedFileName, dojoReleaseDir, prefixes, skiplist);

			//Load the file contents after string interning, to pick up interned strings.
			fileContents = fileUtil.readFile(uncompressedFileName);
		}

		//Save compressed file.
		var compresedContents = buildUtil.optimizeJs(fileName, fileContents, layerLegalText, true);
		fileUtil.saveFile(fileName, compresedContents);

		//Remove _base from the release.
		fileUtil.deleteFile(dojoReleaseDir + "_base");
		fileUtil.deleteFile(dojoReleaseDir + "_base.js");
		
		//FIXME: generate xd contents for layer files.
	}

	//Save the dependency lists to build.txt
	var buildText = "Files baked into this build:" + lineSeparator;
	for(var i = 0; i < result.length; i++){
		buildText += lineSeparator + result[i].layerName + ":" + lineSeparator;
		buildText += result[i].depList.join(lineSeparator) + lineSeparator;
	}
	fileUtil.saveFile(kwArgs.releaseDir + "/dojo/build.txt", buildText);
	logger.info(buildText);

	//Copy over DOH if tests where copied.
	if(kwArgs.copyTests){
		copyRegExp = new RegExp(prefixName.replace(/\\/g, "/") + "/(?!tests)");
		fileUtil.copyDir("../doh", kwArgs.releaseDir + "/util/doh", /./);
	}

	logger.info("Build is in directory: " + kwArgs.releaseDir);
}
//********* End release *********

//********* Start _releasePrefixPath *********
function _prefixPathRelease(/*String*/prefixName, /*String*/prefixPath, /*Object*/kwArgs){
	//summary: copies modules and supporting files from the prefix path to the release
	//directory. Also runs intern strings, i18n bundle flattening and xdomain file generation
	//on the files in directory, if those options are enabled.
	var releasePath = kwArgs.releaseDir + "/"  + prefixName;
	var copyRegExp = /./;
	
	//Use the copyRegExp to filter out tests if requested.
	if(!kwArgs.copyTests){
		copyRegExp = new RegExp(prefixName.replace(/\\/g, "/") + "/(?!tests)");
	}

	logger.info("Copying: " + prefixPath + " to: " + releasePath);
	fileUtil.copyDir(prefixPath, releasePath, copyRegExp);

	//Intern strings if desired.
	if(kwArgs.internStrings){
		logger.info("Interning strings for: " + releasePath);
		buildUtil.internTemplateStrings(kwArgs.profileProperties.dependencies, releasePath);
	}

	//Flatten bundles inside the directory
	//FIXME: Is baseRelativePath now obsolete?
	i18nUtil.flattenDirBundles(prefixName, prefixPath, /*baseRelativePath*/"", kwArgs);

	//FIXME: Run xdgen if an xdomain build.
	if(kwArgs.loader == "xdomain"){

	}
	
	//FIXME: call stripComments. Maybe rename, inline with optimize? need build options too.
}
//********* End _releasePrefixPath *********

//********* Start _makeBuildOptions *********
function _makeBuildOptions(/*Array*/scriptArgs){
	var kwArgs = {};

	//Parse the command line arguments
	var kwArgs = buildUtil.convertArrayToObject(scriptArgs);
	if(!kwArgs["profileFile"] && kwArgs["profile"]){
		kwArgs.profileFile = "profiles/" + kwArgs.profile + ".profile.js";
	}

	//Load dependencies object from profile file, if there is one.
	var dependencies = {};
	if(kwArgs["profileFile"]){
		var profileProperties = buildUtil.evalProfile(kwArgs.profileFile);
		if(profileProperties){
			kwArgs.profileProperties = profileProperties;
			dependencies = kwArgs.profileProperties.dependencies;
			
			//Allow setting build options from on the profile's dependencies object
			for(var param in DojoBuildOptions){
				if(typeof dependencies[param] != "undefined"){
					kwArgs[param] = dependencies[param];
				}
			}
		}
	}

	//Set up default options
	for(var param in DojoBuildOptions){
		//Only use default if there is no value so far.
		if(typeof kwArgs[param] == "undefined"){
			kwArgs[param] = DojoBuildOptions[param].defaultValue;
		}else if(kwArgs[param] === "false"){
			//Make sure "false" strings get translated to proper false value.
			kwArgs[param] = false;
		}
	}

	//Set up some compound values
	kwArgs.releaseDir += kwArgs["releaseName"];
	kwArgs.action = kwArgs.action.split(",");
	kwArgs.localeList = kwArgs.localeList.split(",");
	
	return kwArgs;
}
//********* End _makeBuildOptions *********


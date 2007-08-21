//Main build script for Dojo
var buildTimerStart = (new Date()).getTime();

load("jslib/logger.js");
load("jslib/fileUtil.js");
load("jslib/buildUtil.js");
load("jslib/buildUtilXd.js");
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
	"optimize": {
		defaultValue: "",
		helpText: "Specifies how to optimize module files. If \"comments\" is specified, "
			+ "then code comments are stripped. If \"shrinksafe\" is specified, then "
			+ "the Dojo compressor will be used on the files, and line returns will be removed. "
			+ "If \"shrinksafe.keepLines\" is specified, then the Dojo compressor will be used "
			+ "on the files, and line returns will be preserved. If \"packer\" is specified, "
			+ "Then Dean Edwards' Packer will be used."
	},
	"layerOptimize": {
		defaultValue: "shrinksafe",
		helpText: "Specifies how to optimize the layer files. If \"comments\" is specified, "
			+ "then code comments are stripped. If \"shrinksafe\" is specified, then "
			+ "the Dojo compressor will be used on the files, and line returns will be removed. "
			+ "If \"shrinksafe.keepLines\" is specified, then the Dojo compressor will be used "
			+ "on the layer files, and line returns will be preserved. If \"packer\" is specified, "
			+ "Then Dean Edwards' Packer will be used."
	},
	"cssOptimize": {
		defaultValue: "",
		helpText: "Specifies how to optimize CSS files. If \"comments\" is specified, "
			+ "then code comments and line returns are stripped. If \"comments.keepLines\" "	
			+ "is specified, then code comments are stripped, but line returns are preserved."
	},
	"copyTests": {
		defaultValue: true,
		helpText: "Turn on or off copying of test files."
	},
	"log": {
		defaultValue: logger.TRACE,
		helpText: "Sets the logging verbosity. See jslib/logger.js for possible integer values."
	},
	"xdDojoPath": {
		defaultValue: "",
		helpText: "If the loader=xdomain build option is used, then the value of this option "
			+ "will be used to call dojo.registerModulePath() for dojo, dijit and dojox. "
			+ "The xdDojoPath should be the directory that contains the dojo, dijit and dojox "
			+ "directories, and it should NOT end in a slash. For instance: 'http://some.domain.com/path/to/dojo090'."
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
	var lineSeparator = fileUtil.getLineSeparator();
	var copyrightText = fileUtil.readFile("copyright.txt");
	var buildNoticeText = fileUtil.readFile("build_notice.txt");
	
	//Find the dojo prefix path. Need it to process other module prefixes.
	var dojoPrefixPath = buildUtil.getDojoPrefixPath(prefixes);

	//Get the list of module directories we need to process.
	//They will be in the dependencies.prefixes array.
	//Copy each prefix dir to the releases and
	//operate on that copy instead of modifying the source.
	for(var i = 0; i < prefixes.length; i++){
		var prefixName = prefixes[i][0];
		var prefixPath = prefixes[i][1];

		var finalPrefixPath = prefixPath;
		if(finalPrefixPath.indexOf(".") == 0 && prefixName != "dojo"){
			finalPrefixPath = dojoPrefixPath + "/" + prefixPath;
		}
		_copyToRelease(prefixName, finalPrefixPath, kwArgs);
	}

	//Fix all the prefix paths to be in the release directory.
	//Do this after the copy step above. If it is done as part
	//of that loop, then dojo path gets set first usually, and any prefixes
	//after it are wrong.
	for(var i = 0; i < prefixes.length; i++){
		prefixes[i][1] = kwArgs.releaseDir + "/"  + prefixes[i][0].replace(/\./g, "/");
	}

	//Make sure dojo is clear before trying to map dependencies.
	if(typeof dojo != "undefined"){
		dojo = undefined;
	}

	//Recalculate the dojo prefix path since we should now use the one in the
	//release folder.
	var dojoPrefixPath = buildUtil.getDojoPrefixPath(prefixes);

	logger.trace("Building dojo.js and layer files");
	var result = buildUtil.makeDojoJs(buildUtil.loadDependencyList(kwArgs.profileProperties), kwArgs.version);

	//Save the build layers. The first layer is dojo.js.
	var defaultLegalText = copyrightText + buildNoticeText;
	var dojoReleaseDir = kwArgs.releaseDir + "/dojo/";
	var layerIgnoreString = "";
	var nlsIgnoreString = "";
	for(var i = 0; i < result.length; i++){
		var currentLayer = result[i];
		var layerName = currentLayer.layerName;
		var layerLegalText = (currentLayer.copyrightFile ? fileUtil.readFile(currentLayer.copyrightFile) : defaultLegalText);
		var fileName = dojoReleaseDir + currentLayer.layerName;
		var fileContents = currentLayer.contents;
		
		//Build up string of files to ignore for the directory optimization step
		var ignoreName = layerName.replace(/\.\.\//g, "");
		var nameSegment = ignoreName.replace(/\.js$/, "");
		layerIgnoreString += (layerIgnoreString ? "|" : "") + buildUtil.regExpEscape(ignoreName);
		layerIgnoreString += "|" + buildUtil.regExpEscape(ignoreName + ".uncompressed");

		if(nameSegment.indexOf("/") != -1){
			nameSegment = nameSegment.substring(nameSegment.lastIndexOf("/") + 1, nameSegment.length);
		}
		nlsIgnoreString += (nlsIgnoreString ? "|" : "") + buildUtil.regExpEscape(nameSegment);
		
		//Burn in xd path for dojo if requested, and only do this in dojo.xd.js.
		if(layerName.match(/dojo\.xd\.js/) && kwArgs.xdDojoPath){
			fileContents = buildUtilXd.setXdDojoConfig(fileContents, kwArgs.xdDojoPath);
		}

		//Flatten resources
		fileContents = i18nUtil.flattenLayerFileBundles(fileName, fileContents, kwArgs);

		//Save uncompressed file.
		var uncompressedFileName = fileName + ".uncompressed.js";
		var uncompressedContents = layerLegalText + fileContents;
		if(layerName.match(/\.xd\.js$/) && !layerName.match(/dojo(\.xd)?\.js/)){
			uncompressedContents = buildUtilXd.makeXdContents(uncompressedContents, prefixes);
		}
		fileUtil.saveFile(uncompressedFileName, uncompressedContents);

		//Intern strings if desired. Do this before compression, since, in the xd case,
		//"dojo" gets converted to a shortened name.
		if(kwArgs.internStrings){
			logger.info("Interning strings for file: " + fileName);
			var prefixes = dependencies["prefixes"] || [];
			var skiplist = dependencies["internSkipList"] || [];
			buildUtil.internTemplateStringsInFile(uncompressedFileName, dojoReleaseDir, prefixes, skiplist);

			//Load the file contents after string interning, to pick up interned strings.
			fileContents = fileUtil.readFile(uncompressedFileName);
		}else{
			fileContents = uncompressedContents;
		}

		//Save compressed file.
		logger.trace("Optimizing (" + kwArgs.layerOptimize + ") file: " + fileName);
		var compressedContents = buildUtil.optimizeJs(fileName, fileContents, layerLegalText, kwArgs.layerOptimize);
		fileUtil.saveFile(fileName, compressedContents);

	}

	//Remove _base from the release.
	fileUtil.deleteFile(dojoReleaseDir + "_base");
	fileUtil.deleteFile(dojoReleaseDir + "_base.js");

	//Save the dependency lists to build.txt
	var buildText = "Files baked into this build:" + lineSeparator;
	for(var i = 0; i < result.length; i++){
		buildText += lineSeparator + result[i].layerName + ":" + lineSeparator;
		buildText += result[i].depList.join(lineSeparator) + lineSeparator;
	}
	fileUtil.saveFile(kwArgs.releaseDir + "/dojo/build.txt", buildText);
	logger.info(buildText);

	//Run string interning, xd file building, etc.. on the prefix dirs in the
	//release area.
	var layerIgnoreRegExp = new RegExp("(" + layerIgnoreString + ")\.js$");
	var nlsIgnoreRegExp = new RegExp("\\/nls\\/(" + nlsIgnoreString + ")_");
	for(var i = 0; i < prefixes.length; i++){
		_optimizeReleaseDirs(prefixes[i][0], prefixes[i][1], kwArgs, layerIgnoreRegExp, nlsIgnoreRegExp);
	}
	
	//Copy over DOH if tests where copied.
	if(kwArgs.copyTests){
		copyRegExp = new RegExp(prefixName.replace(/\\/g, "/") + "/(?!tests)");
		fileUtil.copyDir("../doh", kwArgs.releaseDir + "/util/doh", /./);
	}

	logger.info("Build is in directory: " + kwArgs.releaseDir);
}
//********* End release *********

//********* Start _copyToRelease *********
function _copyToRelease(/*String*/prefixName, /*String*/prefixPath, /*Object*/kwArgs){
	//summary: copies modules and supporting files from the prefix path to the release
	//directory. Also adds code guards to module resources.
	var releasePath = kwArgs.releaseDir + "/"  + prefixName.replace(/\./g, "/");
	var copyRegExp = /./;
	
	//Use the copyRegExp to filter out tests if requested.
	if(!kwArgs.copyTests){
		copyRegExp = new RegExp(prefixName.replace(/\\/g, "/") + "/(?!tests)");
	}

	logger.info("Copying: " + prefixPath + " to: " + releasePath);
	fileUtil.copyDir(prefixPath, releasePath, copyRegExp);
	
	//Put in code guards for each resource, to protect against redifinition of
	//code in the layered build cases. Do this here before the layers are built.
	buildUtil.addGuards(releasePath);
}
//********* End _copyToRelease *********


//********* Start _optimizeReleaseDirs *********
function _optimizeReleaseDirs(
	/*String*/prefixName, 
	/*String*/prefixPath, 
	/*Object*/kwArgs,
	/*RegExp*/layerIgnoreRegExp,
	/*RegExp*/nlsIgnoreRegExp){	
	//summary: runs intern strings, i18n bundle flattening and xdomain file generation
	//on the files in a release directory, if those options are enabled.
	var releasePath = kwArgs.releaseDir + "/"  + prefixName.replace(/\./g, "/");
	var prefixes = kwArgs.profileProperties.dependencies.prefixes;
		
	//Intern strings if desired.
	if(kwArgs.internStrings){
		logger.info("Interning strings for: " + releasePath);
		buildUtil.internTemplateStrings(kwArgs.profileProperties.dependencies, releasePath, layerIgnoreRegExp);
	}

	//Flatten bundles inside the directory
	i18nUtil.flattenDirBundles(prefixName, prefixPath, kwArgs, nlsIgnoreRegExp);

	if(kwArgs.loader == "xdomain"){
		buildUtilXd.xdgen(prefixName, prefixPath, prefixes, layerIgnoreRegExp);
	}

	//FIXME: call stripComments. Maybe rename, inline with optimize? need build options too.
	if(kwArgs.optimize){
		buildUtil.stripComments(releasePath, layerIgnoreRegExp, false, kwArgs.optimize);
	}
	
	if(kwArgs.cssOptimize){
		buildUtil.optimizeCss(releasePath, kwArgs.cssOptimize);
	}
}
//********* End _optimizeReleaseDirs *********


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
	
	//Attach the final loader type to the dependencies
	dependencies.loader = kwArgs.loader;

	return kwArgs;
}
//********* End _makeBuildOptions *********


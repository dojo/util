i18nUtil = {};

i18nUtil.setup = function(/*Object*/kwArgs){
	//summary: loads dojo so we can use it for i18n bundle flattening.
	
	//Do the setup only if it has not already been done before.
	if(typeof djConfig == "undefined" || !(typeof dojo != "undefined" && dojo["i18n"])){
		djConfig={
			locale: 'xx',
			extraLocale: kwArgs.localeList,
			baseUrl: "../../dojo/"
		};
		
		load('../../dojo/dojo.js');

		//Now set baseUrl so it is current directory, since all the prefixes
		//will be relative to the release dir in this directory.
		djConfig.baseUrl = "./" + kwArgs.releaseDir + "/dojo/";

		dojo.require("dojo.i18n");
	}
}

i18nUtil.flattenLayerFileBundles = function(/*String*/fileName, /*String*/destDirName,
	/*String*/nlsNamePrefix, /*Object*/kwArgs){
	//summary:
	//		This little utility is invoked by the build to flatten all of the JSON resource bundles used
	//		by dojo.requireLocalization(), much like the main build itself, to optimize so that multiple
	//		web hits will not be necessary to load these resources.  Normally, a request for a particular
	//		bundle in a locale like "en-us" would result in three web hits: one looking for en_us/ another
	//		for en/ and another for ROOT/.  All of this multiplied by the number of bundles used can result
	//		in a lot of web hits and latency.  This script uses Dojo to actually load the resources into
	//		memory, then flatten the object and spit it out using dojo.toJson.  The bootstrap
	//		will be modified to download exactly one of these files, whichever is closest to the user's
	//		locale.
	//fileName:
	//		Name of the file to process (like dojo.js). This function will look in
	//		that file for dojo.requireLocation() calls.
	//destDirName:
	//		Name of the directory to store the flattend bundles.
	//nlsNamePrefix:
	//		First part of the file name used to save the bundles. Format is:
	//		{nlsNamePrefix}_{locale}.js
	//kwArgs:
	//		The build's kwArgs.
	
	i18nUtil.setup(kwArgs);
	var djLoadedBundles = [];
	
	//TODO: register plain function handler (output source) in jsonRegistry?
	var drl = dojo.requireLocalization;
	dojo.requireLocalization = function(modulename, bundlename, locale){
		drl(modulename, bundlename, locale);
	//TODO: avoid dups?
		djLoadedBundles.push({modulename: modulename, module: eval(modulename), bundlename: bundlename});
	};
	
	//Find dojo.requireLocalization files in fileName, and eval them to load
	//the bundles.
	var fileContents = fileUtil.readFile(fileName);
	var requireStatements = fileContents.match(/dojo\.requireLocalization\(.*\)\;/g);
	if(requireStatements){
		eval(requireStatements.join(";"));

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
		var dir = new java.io.File(destDirName);
		for (jsLocale in djBundlesByLocale){
			var locale = jsLocale.replace('_', '-');
			if(!mkdir){ dir.mkdir(); mkdir = true; }
			var outFile = new java.io.File(dir, nlsNamePrefix + "_" + locale + ".js");
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
						os.write(translationPkg+"="+dojo.toJson(bundle[jsLocale])+";");
					}
				}
			}finally{
				os.close();
			}
			localeList.push(locale);
		}
		
		//Inject the processed locales into the file name.
		fileContents.replace(/\/\*\*\*BUILD:localesGenerated\*\*\*\//, dojo.toJson(localeList));
	
		//Remove dojo.requireLocalization calls from the file.
		fileContents.replace(/dojo\.requireLocalization\(.*\)\;/g, "");
		
		//Save the modified file.
		fileUtil.saveFile(fileName, fileContents);
	}
}

i18nUtil.flattenDirBundles = function(/*String*/prefixName, /*String*/prefixDir,
	/*String*/baseRelativePath, /*Object*/kwArgs){
	//summary: Flattens the i18n bundles inside a directory so that only request
	//is needed per bundle. Does not handle resource flattening for dojo.js or
	//layered build files.
	i18nUtil.setup(kwArgs);
	var fileList = fileUtil.getFilteredFileList(prefixDir, /\/(?!tests)\/.*\.js$/, true);
	var prefixes = kwArgs.profileProperties.dependencies.prefixes;
	for(var i= 0; i < fileList.length; i++){
		//Use new String so we get a JS string and not a Java string.
		var jsFileName = String(fileList[i]);
		var fileContents = null;
		
		//Files in nls directories (except for the top level one in Dojo that has multiple
		//bundles flattened) need to have special xd contents.
		if(jsFileName.match(/\/nls\//) && jsFileName.indexOf(prefixDir + "/nls/") == -1){
			fileContents = "(" + i18nUtil.makeFlatBundleContents(prefixName, prefixDir, jsFileName) + ")";			
		}else{
			fileContents = i18nUtil.modifyRequireLocalization(readText(jsFileName), baseRelativePath, prefixes);
		}

		if(fileContents){
			fileUtil.saveUtf8File(jsFileName, fileContents);
		}
	}
}

i18nUtil.modifyRequireLocalization = function(fileContents, baseRelativePath, prefixes){
	//summary: Modifies any dojo.requireLocalization calls in the fileContents to have the
	//list of supported locales as part of the call. This allows the i18n loading functions
	//to only make request(s) for locales that actually exist on disk.
	var dependencies = [];
	
	//Make sure we have a JS string, and not a Java string.
	fileContents = String(fileContents);
	
	var modifiedContents = fileContents;
	
	if(fileContents.match(buildUtil.globalRequireLocalizationRegExp)){
		modifiedContents = fileContents.replace(buildUtil.globalRequireLocalizationRegExp, function(matchString){
			var replacement = matchString;
			var partMatches = matchString.match(buildUtil.requireLocalizationRegExp);
			var depCall = partMatches[1];
			var depArgs = partMatches[2];
	
			if(depCall == "requireLocalization"){
				//Need to find out what locales are available so the dojo loader
				//only has to do one script request for the closest matching locale.
				var reqArgs = i18nUtil.getRequireLocalizationArgsFromString(depArgs);
				if(reqArgs.moduleName){
					//Find the list of locales supported by looking at the path names.
					var locales = i18nUtil.getLocalesForBundle(reqArgs.moduleName, reqArgs.bundleName, baseRelativePath, prefixes);
	
					//Add the supported locales to the requireLocalization arguments.
					if(!reqArgs.localeName){
						depArgs += ", null";
					}
	
					depArgs += ', "' + locales.join(",") + '"';
					
					replacement = "dojo." + depCall + "(" + depArgs + ")";
				}
			}
			return replacement;		
		});
	}	
	return modifiedContents;
}

i18nUtil.makeFlatBundleContents = function(prefix, prefixPath, srcFileName){
	//summary: Given a nls file name, flatten the bundles from parent locales into the nls bundle.
	var bundleParts = i18nUtil.getBundlePartsFromFileName(prefix, prefixPath, srcFileName);
	if(!bundleParts){
		return null;
	}
	var moduleName = bundleParts.moduleName;
	var bundleName = bundleParts.bundleName;
	var localeName = bundleParts.localeName;

	//print("## moduleName: " + moduleName + ", bundleName: " + bundleName + ", localeName: " + localeName);
	dojo.requireLocalization(moduleName, bundleName, localeName);
	
	//Get the generated, flattened bundle.
	var module = dojo.getObject(moduleName);
	var bundleLocale = localeName ? localeName.replace(/-/g, "_") : "ROOT";
	var flattenedBundle = module.nls[bundleName][bundleLocale];
	//print("## flattenedBundle: " + flattenedBundle);
	if(!flattenedBundle){
		throw "Cannot create flattened bundle for src file: " + srcFileName;
	}

	return dojo.toJson(flattenedBundle);
}

//Given a module and bundle name, find all the supported locales.
i18nUtil.getLocalesForBundle = function(moduleName, bundleName, baseRelativePath, prefixes){
	//Build a path to the bundle directory and ask for all files that match
	//the bundle name.
	var filePath = buildUtil.mapResourceToPath(moduleName, baseRelativePath, prefixes);
	
	var bundleRegExp = new RegExp("nls[/]?([\\w\\-]*)/" + bundleName + ".js$");
	var bundleFiles = fileUtil.getFilteredFileList(filePath + "nls/", bundleRegExp, true);
	
	//Find the list of locales supported by looking at the path names.
	var locales = [];
	for(var j = 0; j < bundleFiles.length; j++){
		var bundleParts = bundleFiles[j].match(bundleRegExp);
		if(bundleParts && bundleParts[1]){
			locales.push(bundleParts[1]);
		}else{
			locales.push("ROOT");
		}
	}

	return locales;
}

i18nUtil.getRequireLocalizationArgsFromString = function(argString){
	//summary: Given a string of the arguments to a dojo.requireLocalization
	//call, separate the string into individual arguments.
	var argResult = {
		moduleName: null,
		bundleName: null,
		localeName: null
	};
	
	var l10nMatches = argString.split(/\,\s*/);
	if(l10nMatches && l10nMatches.length > 1){
		argResult.moduleName = l10nMatches[0] ? l10nMatches[0].replace(/\"/g, "") : null;
		argResult.bundleName = l10nMatches[1] ? l10nMatches[1].replace(/\"/g, "") : null;
		argResult.localeName = l10nMatches[2];
	}
	return argResult;
}

i18nUtil.getBundlePartsFromFileName = function(prefix, prefixPath, srcFileName){
	//Pull off any ../ values from prefix path to make matching easier.
	var prefixPath = prefixPath.replace(/\.\.\//g, "");

	//Strip off the prefix path so we can find the real resource and bundle names.
	var prefixStartIndex = srcFileName.lastIndexOf(prefixPath);
	if(prefixStartIndex != -1){
		var startIndex = prefixStartIndex + prefixPath.length;
		
		//Need to add one if the prefiPath does not include an ending /. Otherwise,
		//We'll get extra dots in our bundleName.
		if(prefixPath.charAt(prefixPath.length) != "/"){
			startIndex += 1;
		}
		srcFileName = srcFileName.substring(startIndex, srcFileName.length);
	}
	
	//var srcIndex = srcFileName.indexOf("src/");
	//srcFileName = srcFileName.substring(srcIndex + 4, srcFileName.length);
	var parts = srcFileName.split("/");

	//Split up the srcFileName into arguments that can be used for dojo.requireLocalization()
	var moduleParts = [prefix];
	for(var i = 0; parts[i] != "nls"; i++){
		moduleParts.push(parts[i]);
	}
	var moduleName = moduleParts.join(".");
	if(parts[i+1].match(/\.js$/)){
		var localeName = "";
		var bundleName = parts[i+1];
	}else{
		var localeName = parts[i+1];
		var bundleName = parts[i+2];	
	}

	if(!bundleName || bundleName.indexOf(".js") == -1){
		//Not a valid bundle. Could be something like a README file.
		return null;
	}else{
		bundleName = bundleName.replace(/\.js/, "");
	}

	return {moduleName: moduleName, bundleName: bundleName, localeName: localeName};
}

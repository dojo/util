define(["../buildControl", "../fileUtils"], function(bc, fileUtils) {
	// note: this transform was copied from the v1.6 build system; the expression was cleaned up, but the
	// algorithm is *exactly* as before

	var
		//Make sure we have a delimited ignore list to make matching faster
		cssImportIgnore= bc.cssImportIgnore? bc.cssImportIgnore + "," : 0,

		cssImportRegExp = /\@import\s+(url\()?\s*([^);]+)\s*(\))?([\w, ]*)(;)?/g,
		cssUrlRegExp = /\url\(\s*([^\)]+)\s*\)?/g,

		checkSlashes= function(name){
			return name.replace(/\\/g, "/");
		},

		cleanCssUrlQuotes = function(/*String*/url){
			//summary: If an URL from a CSS url value contains start/end quotes, remove them.
			//This is not done in the regexp, since my regexp fu is not that strong,
			//and the CSS spec allows for ' and " in the URL if they are backslash escaped.

			//Make sure we are not ending in whitespace.
			//Not very confident of the css regexps above that there will not be ending whitespace.
			url = url.replace(/\s+$/, "");
			if(url.charAt(0) == "'" || url.charAt(0) == "\""){
				url = url.substring(1, url.length - 1);
			}
			return url;
		},

		flattenCss = function(/*String*/fileName, /*String*/text){
			//summary: inlines nested stylesheets that have @import calls in them.

			// get the path of the reference resource
			var referencePath = fileUtils.getFilepath(checkSlashes(fileName));

			return text.replace(cssImportRegExp, function(fullMatch, urlStart, importFileName, urlEnd, mediaTypes){
				//Only process media type "all" or empty media type rules.
				if(mediaTypes && ((mediaTypes.replace(/^\s\s*/, '').replace(/\s\s*$/, '')) != "all")){
					return fullMatch;
				}

				importFileName = cleanCssUrlQuotes(importFileName);

				//Ignore the file import if it is part of an ignore list.
				if(cssImportIgnore && cssImportIgnore.indexOf(importFileName + ",") != -1){
					return fullMatch;
				}

				//Make sure we have a unix path for the rest of the operation.
				importFileName = checkSlashes(importFileName);

				var
					fullImportFileName = importFileName.charAt(0) == "/" ? importFileName : fileUtils.compactPath(fileUtils.catPath(referencePath, importFileName)),
					importPath= fileUtils.getFilepath(importFileName),
					importModule= bc.resources[fullImportFileName],
					importContents = importModule && importModule.text;
				if(!importContents){
					bc.logWarn("CSS import (" + importFileName + ")	 skipped in " + importFileName);
					return fullMatch;
				}

				//Make sure to flatten any nested imports.
				importContents = flattenCss(fullImportFileName, importContents);

				//Modify URL paths to match the path represented by this file.
				importContents = importContents.replace(cssUrlRegExp, function(fullMatch, urlMatch){
					var fixedUrlMatch = cleanCssUrlQuotes(urlMatch);
					fixedUrlMatch = checkSlashes(fixedUrlMatch);

					//Only do the work for relative URLs. Skip things that start with / or have a protocol.
					var colonIndex = fixedUrlMatch.indexOf(":");
					if(fixedUrlMatch.charAt(0) != "/" && (colonIndex == -1 || colonIndex > fixedUrlMatch.indexOf("/"))){
						//It is a relative URL, tack on the path prefix
						urlMatch =  fileUtils.compactPath(fileUtils.catPath(importPath, fixedUrlMatch));
					}else{
						bc.logWarn("Non-relative URL (" + urlMatch + ") skipped in " + importFileName);
					}
					return "url(" + fileUtils.compactPath(urlMatch) + ")";
				});

				return importContents;
			});
		};

	return function(resource, callback) {
		if(!bc.cssOptimize){
			return;
		}

		//bc.logInfo("Optimizing CSS file: " + resource.src);
		var text = flattenCss(resource.src, resource.text, cssImportIgnore);

		//Do comment removal.
		try{
			var startIndex = -1;
			//Get rid of comments.
			while((startIndex = text.indexOf("/*")) != -1){
				var endIndex = text.indexOf("*/", startIndex + 2);
				if(endIndex == -1){
					throw "Improper comment in CSS file: " + resource.src;
				}
				text = text.substring(0, startIndex) + text.substring(endIndex + 2, text.length);
			}
			//Get rid of newlines.
			if(/keepLines/i.test(bc.cssOptimize)){
				text = text.replace(/[\r\n]/g, "");
				text = text.replace(/\s+/g, " ");
				text = text.replace(/\{\s/g, "{");
				text = text.replace(/\s\}/g, "}");
			}else{
				//Remove multiple empty lines.
				text = text.replace(/(\r\n)+/g, "\r\n");
				text = text.replace(/(\n)+/g, "\n");
			}
			resource.text= text;
		}catch(e){
			bc.logError("Could not optimized CSS file: " + resource.src + "; error follows...", e);
		}
	};
});

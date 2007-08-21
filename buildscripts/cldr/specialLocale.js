/**
 * In CLDR, there are some special locales with abnormal hierarchy.
 * 
 * E.g.zh-cn.xml is aliased to zh-hans-cn.xml for all the calendar/number/currency data.
 * So after CLDR transformation, JSON bundles under zh-cn is totally the same as those under zh-hans-cn.
 * Problems will occur when dojo loads zh-cn bundle, as dojo will flatten it with the following sequence:
 * Root -> zh -> zh-cn, but the right sequence should be Root -> zh -> zh-hans -> zh-cn(zh-hans-cn)
 * so the bundles under zh-hans locale is missing.
 * 
 * This script is used to process all the special locales so that after CLDR transformation,
 * zh-cn bundle will be flatted both with zh-hans and zh-hans-cn, nothing will be lost then.
 * Please see the following SPECIAL_LOCALES_MAP for detail mapping info.
 * 
 * Note: Here for simplification, we name zh-cn as source locale, 
 *       and name zh-hans as alias locale(though actually is zh-hans-cn).  
 */

var SPECIAL_LOCALES_MAP = {
	//summary:Mapping info for some special locales with abnormal hierarchy.
	//        Currently for CLDR 1.4, will be updated with the newest CLDR release.
	'zh-cn':'zh-hans',
	'zh-sg':'zh-hans',
	'zh-hk':'zh-hant',
	'zh-mo':'zh-hant',		
	'zh-tw':'zh-hant',
	'sh':'sr'

	//The following locales don't have any bundles currently (CLDR 1.4),
	//listed here for CLDR future release.
	/* 
	'az-az':'az-latn',
	'ha-gh':'ha-latn',
	'ha-ne':'ha-latn',
	'ha-ng':'ha-latn',
	'ku-iq':'ku-latn',
	'ku-ir':'ku-latn',
	'ku-sy':'ku-latn',
	'ku-tr':'ku-latn',		
	'sr-ba':'sr-cyrl',
	'sr-cs':'sr-cyrl',
	'sr-yu':'sr-cyrl',
	'uz-uz':'uz-cyrl',
	'uz-af':'uz-arab'
	//TBD:specific case:uz-af doesn't exist but uz-arab exists
	//seems can only be switched in dojo loading runtime		
	*/
};

var dir = arguments[0];

djConfig={baseUrl: "../../../dojo/"};

load("../../../dojo/dojo.js");
load("../jslib/fileUtil.js");

dojo.require("dojo.i18n");

//regular expression, e.g /\/(zh-hk|zh-cn|zh-mo|sh|zh-sg|zh-tw|)\/(gregorian|number|currency)\.js$/
var pattern = "\/(";
for(x in SPECIAL_LOCALES_MAP){
	pattern += x + "|";
}
pattern += ")\/(gregorian|number|currency)\.js$";
var reg = new RegExp(pattern);

//get filtered bundle file paths
var fileList/*JS string array*/ = fileUtil.getFilteredFileList(dir, reg, true);

//map for later file copying
var dirMap = {}; 

for(var i= 0; i < fileList.length; i++){
	try{
		var hasChanged = false;
		
		//source bundle file path
		var filePath = fileList[i];
		var pathSegments = filePath.split("/");
		
		//alias bundle file path
		var aliasPathSegments = [];
		aliasPathSegments = pathSegments.slice(0);
		var localeIndex = aliasPathSegments.length - 2;
		//replace the source locale with alias one
		aliasPathSegments[localeIndex] = SPECIAL_LOCALES_MAP[aliasPathSegments[localeIndex]];
		
		//record processed source-alias locale mapping info
		updateDirMap(pathSegments,aliasPathSegments);
		
		//get source and alias bundle content
		var srcBundle = getBundle(filePath);
		var aliasBundle = getBundle(aliasPathSegments.join("/"));
		if(null == srcBundle || null == aliasBundle){
			continue;
		}
		
		for(p in aliasBundle){
			if(!srcBundle[p]){
				//inherit new properties
				srcBundle[p] = aliasBundle[p];
				hasChanged = true;
			}
		}
		
		if(hasChanged){
			//update the source bundle content
			fileUtil.saveUtf8File(filePath, "(" + dojo.toJson(srcBundle) + ")");
			//print("specail locale : " + filePath + " finished");
		}
	}catch(e){
		//Ignored  E.g. if zh-cn has number.js but zh-hans doesn't
		continue;
	}	
}

/*
 *Copy bundles only contained in alias locale to source locale.
  This can be simplified if add a none overwritable copyDir method to fileUtil. 
  E.g. if zh-hans has gregorian.js and currency.js;
          zh-cn has gregorian.js and number.js
        then we also need to copy currency.js to zh-cn
  the dirMap content will be:
  {
	 "E:/.../zh-cn" : {
	   				   'aliasDir': "E:/.../zh-hans",
					   'srcFiles':["gregorian.js","number.js"]
					  },
		 ...
  }*/
for(p in dirMap){
	//get the regular expression
	var reg = concatNegativeReg(dirMap[p].srcFiles);
	//e.g. copy matched bundles from zh-hans to zh-cn like currency.js
	fileUtil.copyDir(dirMap[p].aliasDir,p,reg);
}


/***************************************auxiliary methods**************************************/

function getBundle(filePath){
	//summary:get bundle content with utf-8 encoding
	var content = fileUtil.readFile(filePath, "utf-8");
	if(null == content || 0 >= content.length){
		return null;
	}else{
		return dojo.fromJson(content);
	}
}

function updateDirMap(pathSegments/*js string array*/,aliasPathSegments/*js string array*/){
	//summary: update dir mapping info
	var dirPath = pathSegments.slice(0,pathSegments.length-1).join("/");
	if(!dirMap[dirPath]){
		var aliasDirPath = aliasPathSegments.slice(0,aliasPathSegments.length-1).join("/");
		var item = {'aliasDir':aliasDirPath,
					'srcFiles':[pathSegments[pathSegments.length - 1]]};
		dirMap[dirPath] = item;
	}else{
		dirMap[dirPath].srcFiles.push(pathSegments[pathSegments.length - 1]);
	}
}

function concatNegativeReg(files/*array*/){
	//summary:To match bundles only contained in alias locale but not in source locale
	//E.g. currency bundle only contained in zh-hans but not in zh-cn 
	//the generated reg will be:  /^(\/(?!(gregorian\.js|number\.js))|[^\/])*$/
	
	var reg = "^(\/(?!(";
	for(var i = 0; i < files.length; i ++){
		reg += files[i].replace(/\./g,"\\\.") + "|";
	}
	reg = reg.substring(0,reg.length-1);
	reg += "))|[^\/])*$";
	return new RegExp(reg);
}
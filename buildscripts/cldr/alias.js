/**
 * There are basically two kinds of alias in CLDR:
 * 1. locale alias e.g. 
 *    in xml, <alias source="locale" path="......"/>, 
 *    in gernated JSON bunle, xxxx@localeAlias:{'target':'xxx', 'bundle':'xxxx'}
 * 2. other locale alias e.g.
 *    in xml, currently only like <alias source="fr" path="//ldml"/>
 * #1 is supported by this 'alias.js', 
 * #2 is covered by 'specialLocale.js' and may need enhancement for future CLDR versions.
 */

djConfig={baseUrl: "../../../dojo/"};

load("../../../dojo/dojo.js");
load("../jslib/logger.js");
load("../jslib/fileUtil.js");
load("cldrUtil.js");

dojo.require("dojo.i18n");

var dir/*String*/ = arguments[0];// ${dojo}/dojo/cldr/nls
var logDir = arguments[1];
var logStr = "";

//bundles that should be processed for 'locale' alias, currently only 'gregorian' bundle,
//may extend it as BUNDLES = ['gregorian','number','currency','hebrew', ...] in the future; 
var BUNDLES = ['gregorian'];

var LOCALE_ALIAS_MARK = '@localeAlias';
var LOCALE_ALIAS_TARGET_PROPERTY = 'target';
var LOCALE_ALIAS_TARGET_BUNDLE = 'bundle';
var updated = false;

print('alias.js...');

for(var i = 0; i < BUNDLES.length; i++){
	var regExp = new RegExp('\/' + BUNDLES[i] + '\.js$'); //e.g. new RegExp('\/gregorian\.js$')
	var fileList = fileUtil.getFilteredFileList(dir, regExp, true);
	
	for(var j = 0; j < fileList.length; j++){
		var jsFileName = new String(fileList[j]); //Java String
		var jsFilePath = jsFileName.split("/");
		var locale = jsFilePath[jsFilePath.length-2];
		if(locale=="nls"){continue;} // no need for root bundle
		
		try{
			dojo.i18n._requireLocalization('dojo.cldr', BUNDLES[i], locale); //declare bundle						
			var bundle = dojo.i18n.getLocalization('dojo.cldr', BUNDLES[i], locale); //get bundle
			var nativeSrcBundle = getNativeBundle(jsFileName);//bundle not flattened
		}catch(e){print(e);/* simply ignore if no bundle found*/}
		
		if(!bundle) continue;
		
		updated = false;
		logStr += locale + ":" + BUNDLES[i] + "=========================================================================\n";		
		for(p in bundle){
			if(p.indexOf(LOCALE_ALIAS_MARK) >= 0){
				//p like 'xxx@localeAlias'
				_processLocaleAlias(bundle, p, nativeSrcBundle);
			}
		}
		
		if(updated){
			fileUtil.saveUtf8File(jsFileName, "(" + dojo.toJson(nativeSrcBundle, true) + ")");
		}
		logStr += '\n';
	}
}

fileUtil.saveUtf8File(logDir + '/alias.log',logStr+'\n');
print('CLDR finished, please refer to logs at ' + logDir + ' for more details.');

function _processLocaleAlias(bundle/*JSON Obj*/, localeAliasKey/*String*/,nativeSrcBundle/*JSON Obj*/){
	//Summary: Update all properties as defined by 'locale' alias mapping
	//		   E.g.'months-format-abbr@localeAlias':{'target':"months-format-wide", 'bundle':"gregorian"},
	//		   means the array values of 'months-format-abbr' in current bundle should be
	//		   merged with(inherit or overwrite) that of 'months-format-wide' in 'gregorian' bundle
	//
	//Note:	   Currently no bundle recognition, always assume 'gregorian'.
	
	var index = localeAliasKey.indexOf(LOCALE_ALIAS_MARK);
	var localeAliasSource/*String*/ = localeAliasKey.substring(0,index);//e.g 'months-format-abbr@localeAlias' -> 'months-format-abbr' 
	var localeAliasTarget/*String*/ = bundle[localeAliasKey][LOCALE_ALIAS_TARGET_PROPERTY];
	//var localeAliasBundle/*String*/ = bundle[localeAliasKey][LOCALE_ALIAS_TARGET_BUNDLE]; //For future use 
	
	for(x in bundle){
		if(x.indexOf(LOCALE_ALIAS_MARK) < 0 /*not a locale alias mapping item*/ 
		   && x.indexOf(localeAliasSource) == 0/*x naming start with localeAliasSource*/){
			if(x == localeAliasSource){
				//exactaly match, like 'months-format-abbr@localeAlias':{'target':"months-format-wide",'bundle':"gregorian"},
				//currently source and target bundles are the same - gregorian
				_updateLocaleAlias(bundle, x, bundle, localeAliasTarget, nativeSrcBundle);
			}else{
				//x naming start with localeAliasSource
				//TODO: for future use, 
				//E.g. in 'buddhist' bundle - 'months@localeAlias':{'target':"months", 'bundle':"gregorian"}
				//this means in 'buddhist',all properties naming start with 'months' 
				//should be replaced by that same item in 'gregorian', this may be necessary
				//when Dojo supports non-gregorian calendars
			}
		}
	}
}

function _updateLocaleAlias(sourceBundle/*JSON Obj*/,aliasSource/*String*/, targetBundle/*JSON Obj*/,
							aliasTarget/*String*/, nativeSrcBundle/*JSON Obj*/){
		//single property
		if(!nativeSrcBundle[aliasSource] && nativeSrcBundle[aliasTarget]//no this property in current locale
		   && !compare(sourceBundle[aliasSource], targetBundle[aliasTarget])){
			// then should inherit from alias target (as defined by 'locale' alias)
			logStr += '1 '+aliasSource + "=" + sourceBundle[aliasSource] + " is replaced with " + aliasTarget + "=" + targetBundle[aliasTarget]+'\n';
			//sourceBundle[aliasSource] =  targetBundle[aliasTarget];
			nativeSrcBundle[aliasSource] =  targetBundle[aliasTarget];
			updated = true;	
		}else if(nativeSrcBundle[aliasSource] && dojo.isArray(sourceBundle[aliasSource]) 
		         && dojo.isArray(targetBundle[aliasTarget])){
			if(sourceBundle[aliasSource].length > targetBundle[aliasTarget].length){
				logStr +="Error:" + aliasSource + ".length > " +  aliasTarget + ".length \n";
			}
			//array property, see if need inherit
			for(var i = 0; i < sourceBundle[aliasSource].length; i++){
				if(sourceBundle[aliasSource][i] == undefined){//need inherit
					logStr += '2 ' + aliasSource + "["+i+"]=" +sourceBundle[aliasSource][i]+" is replaced with " + aliasTarget+"["+i+"]="+targetBundle[aliasTarget][i]+'\n';
					sourceBundle[aliasSource][i] =  targetBundle[aliasTarget][i];
					updated = true;	
				}// otherwise no change and use current value
			}
			if(sourceBundle[aliasSource].length < targetBundle[aliasTarget].length){
				logStr +='3 ' + aliasSource +' from ' + sourceBundle[aliasSource].length +' to ' 
						  + (targetBundle[aliasTarget].length-1) + ' are copied from ' 
						  +aliasTarget + '='+ targetBundle[aliasTarget] +'\n';
				sourceBundle[aliasSource] = sourceBundle[aliasSource].concat(
											targetBundle[aliasTarget].slice(sourceBundle[aliasSource].length));
				updated = true;	
			}
			if(updated) nativeSrcBundle[aliasSource] = sourceBundle[aliasSource];
		}
}

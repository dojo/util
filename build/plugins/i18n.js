///
// \module build/plugins/i18n
//
define([], function() {
	var
		nlsRe=
			// regexp for reconstructing the master bundle name from parts of the regexp match
			// nlsRe.exec("foo/bar/baz/nls/en-ca/foo") gives:
			// ["foo/bar/baz/nls/en-ca/foo", "foo/bar/baz/nls/", "/", "/", "en-ca", "foo"]
			// nlsRe.exec("foo/bar/baz/nls/foo") gives:
			// ["foo/bar/baz/nls/foo", "foo/bar/baz/nls/", "/", "/", "foo", ""]
			// so, if match[5] is blank, it means this is the top bundle definition.
			// courtesy of http://requirejs.org
			/(^.*(^|\/)nls(\/|$))([^\/]*)\/?([^\/]*)/,

		getAvailableLocales= function(
			root, 
			locale,
			bundlePath,
			bundleName,
			availableLocales
		) {
			for (var localeParts= locale.split("-"), current= "", i= 0; i<localeParts.length; i++) {
				current+= localeParts[i];
				if (root[current]) {
					availableLocales[bundlePath + current + "/" + bundleName]= 1;
				}
			}
		},

		startI18nPlugin= function(
			mid,
			referenceModule
		) {
			var
				match= nlsRe.exec(mid),
				bundlePath= match[1],
				bundleName= match[5] || match[4],
				locale= (match[5] && match[4]),
				moduleInfo= bc.getSrcModuleInfo(bundlePath + bundleName, referenceModule),
				pqn= moduleInfo.pqn= "i18n!" + moduleInfo.pid + "*" + moduleInfo.mid + (locale ? "/" + locale : "");
			if (bc.jobs[pqn]) {
				// already resolved...
				return bc.jobs[pqn];
			} else {
				// bundlePath may have been relative; get the absolute path
				bundlePath= moduleInfo.path.match(/(.+\/)[^\/]+$/)[1];

				// compute all of the necessary bundle module ids
				var 
					rootBundle= bc.resources[moduleInfo.url].bundle,
					availableLocales= {};
				availableLocales[bundlePath + bundleName]= 1;
				if (locale) {
					getAvailableLocales(rootBundle, locale, bundlePath, bundleName, availableLocales);
				}
				bc.locales.forEach(function(locale) {
					getAvailableLocales(rootBundle, locale, bundlePath, bundleName, availableLocales);
				});
				var deps= [bc.amdResources["i18n"]];
				for (var p in availableLocales) {
					deps.push(bc.amdResources[p]);
				}
				moduleInfo.deps= deps;
				moduleInfo.pluginResource= true; 
				return bc.amdResources[pqn]= moduleInfo;
			}
		},

		start= function(
			mid,
			referenceModule,
			bc
		) {
			var
				i18nPlugin= bc.amdResources["dojo*i18n"],
				match= nlsRe.exec(mid),
				bundleName= match[5] || match[4],
				bundlePath= bc.getSrcModuleInfo(match[1] + bundleName, referenceModule).pqn.match(/(.+\/)[^\/]+/)[1],
				locale= (match[5] && match[4]),
				i18nResourceMid= locale ? bundlePath + locale + "/" + bundleName : bundlePath + bundleName,
				i18nResource= bc.amdResources[i18nResourceMid];

			if (!i18nPlugin) {
				throw new Error("i18n! plugin missing");
			}
			if (!i18nResource) {
				throw new Error("i18n resource (" + i18nResourceMid + ") missing");
			}
			return [i18nPlugin, i18nResource];
		};

	return {
		start:start
	};
});

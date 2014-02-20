define([], function(){
	var
		rev = "$Rev$".match(/\d+/),
		version= {
			major: 1, minor: 8, patch: 7, flag: "-pre",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

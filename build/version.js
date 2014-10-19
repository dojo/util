define([], function(){
	var
		rev = "$Rev: e6bddde $".match(/[0-9a-f]{7,}/),
		version= {
			major: 1, minor: 8, patch: 8, flag: "",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

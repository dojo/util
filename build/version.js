define([], function(){
	var
		rev = "$Rev: 2ac6bad $".match(/[0-9a-f]{7,}/),
		version= {
			major: 1, minor: 16, patch: 2, flag: "",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

define([], function(){
	var
		rev = "$Rev: 8aea4bd $".match(/[0-9a-f]{7,}/),
		version= {
			major: 1, minor: 8, patch: 10, flag: "",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

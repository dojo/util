define([], function(){
	var
		rev = "$Rev: 9e48f8e $".match(/[0-9a-f]{7,}/),
		version= {
			major: 1, minor: 11, patch: 0, flag: "-rc2",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

define([], function(){
	var
		rev = "$Rev: 8c74592 $".match(/\d+/),
		version= {
			major: 1, minor: 8, patch: 6, flag: "",
			revision: rev ? rev[0] : NaN,
			toString: function(){
				var v= version;
				return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";
			}
		};
	return version;
});

define([], function() {
	return {
		cwd: function() {
			return environment["user.dir"];
		},


		exit: function(resultCode) {
			// no documented way to return an exit code in rhino
			if (resultCode) {
				throw new Error("exit with result code: " + resultCode);
			}
			quit();
		}
	};
});

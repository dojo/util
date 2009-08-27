//Test file for the flattening of CSS files.
//Run this file from the util/buildscripts/tests/css directory.
load("../../jslib/logger.js");
load("../../jslib/buildUtil.js");
load("../../jslib/fileUtil.js");

var result = buildUtil.flattenCss( "blue/one.css", fileUtil.readFile("blue/one.css"));

/* Copy the blue folder to a folder called temp then try this command
(warning, it modifies the folder contents
var result = buildUtil.optimizeCss("temp", "comments");
*/

print(result);

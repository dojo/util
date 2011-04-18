#!/bin/sh

java -Xms256m -Xmx256m -jar ../shrinksafe/js.jar ../../dojo/dojo.js baseUrl=../../dojo load=build "$@"

# for node...
#node ../../dojo/dojo.js load=build "$@"

# for the v1.6- builder...
#java -classpath ../shrinksafe/js.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main build.js "$@"

# if you experience an "Out of Memory" error, you can increase it as follows:
#java -Xms256m -Xmx256m -classpath ../shrinksafe/js.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  build.js "$@"

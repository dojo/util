#!/bin/sh

# for rhino...
java -Xms256m -Xmx256m  -cp ../shrinksafe/js.jar:../closureCompiler/compiler.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  ../../dojo/dojo.js baseUrl=../../dojo load=build "$@"

# for node...
#node ../../dojo/dojo.js load=build "$@"

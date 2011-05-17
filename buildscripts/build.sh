#!/bin/sh

if which -s node
then
   node ../../dojo/dojo.js load=build "$@"
else
   java -Xms256m -Xmx256m  -cp ../shrinksafe/js.jar:../closureCompiler/compiler.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  ../../dojo/dojo.js baseUrl=../../dojo load=build "$@"
fi

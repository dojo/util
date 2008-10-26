#!/bin/sh

java -classpath ../shrinksafe/js.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main build.js "$@"

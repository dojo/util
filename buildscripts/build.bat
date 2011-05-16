java -Xms256m -Xmx256m  -cp ../shrinksafe/js.jar:../closureCompiler/compiler.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  ../../dojo/dojo.js baseUrl=../../dojo load=build %*


@rem java -classpath ../shrinksafe/js.jar;../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main build.js %*

@rem java -Xms256m -Xmx256m -classpath ../shrinksafe/js.jar;../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  build.js %*

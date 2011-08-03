#!/bin/sh

use_node=1
if [ "$#" > 1 -a "${1::4}" == "bin=" ]; then
   case ${1:4} in
   node)
     use_node=0
     ;;
   java)
     ;;
   *)
     echo "Invalid binary option: only node/java is supported"
     exit 1
   esac
   shift
else
   which node > /dev/null 2>&1
   use_node=$?
fi
if echo " $@ " | grep -q ' --help ' || [ "$#" == 0 ]; then
   echo "builder wrapper USAGE: 
  $0 [bin=node|java] BUILDER_OPTIONS
	By default, if first argument does not start with \"bin=\", node will be used if available.

Builder Help Messages:
"
fi

if [[ $use_node == "0" ]]; then
   node ../../dojo/dojo.js load=build "$@"
else
   java -Xms256m -Xmx256m  -cp ../shrinksafe/js.jar:../closureCompiler/compiler.jar:../shrinksafe/shrinksafe.jar org.mozilla.javascript.tools.shell.Main  ../../dojo/dojo.js baseUrl=../../dojo load=build "$@"
fi

#!/bin/bash

# Folder names
DOJO=dojo-`date +%F`
OUT_DIR=../release/


doBuild(){
	profile=`echo $1 | sed 's/.profile.js//g'`
	version=$2
	loader=$3
	proName=dojo-$version-$profile
	extraAntTasks="intern-strings strip-resource-comments"
	if [ "$loader" == "xdomain" ]; then
		proName=dojo-$version-xdomain-$profile
		version=$version"xdomain"
	fi

	echo Building profile: $profile
	CLASSPATH="./lib/js.jar" ant -q -Dversion=$version -Dprofile=$profile -DdojoLoader=$loader release $extraAntTasks
	# the release task now includes tests by default
	# cp -r ../tests/* ../release/dojo/tests/

	cd ../release
	mv dojo $proName
	tar -zcf $proName.tar.gz $proName/
	zip -rq $proName.zip $proName/
	rm -rf $proName
	cd ../buildscripts
}

# Build profiles
echo Build profiles...
ant # get it setup

for pfile in $(cd profiles; ls *.profile.js; cd ..)
do
	doBuild $pfile $1 "default"
done

# Make one xdomain build, for ajax.
doBuild "ajax.profile.js" $1 "xdomain"

# Make a src package.
srcVersion=$1
srcName=dojo-$srcVersion-src
cd ../release
svn export http://svn.dojotoolkit.org/dojo/tags/release-$srcVersion
mv release-$srcVersion $srcName
tar -zcf $srcName.tar.gz $srcName/
zip -rq $srcName.zip $srcName/
rm -rf $srcName/
cd ../buildscripts


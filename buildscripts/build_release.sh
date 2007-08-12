#!/bin/bash

#version should be something like 0.9.0beta or 0.9.0
version=$1
#svnUserName is the name you use to connect to Dojo's subversion.
svnUserName=$2
#The svn revision number to use for tag. Should be a number, like 11203
svnRevision=$3

tagName=release-$version
buildName=dojo-$tagName

#Make the SVN tag.
svn mkdir -m "Using r$svnRevision to create a tag for the $version release." svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName
svn copy -r $svnRevision svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/dojo/trunk svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName/dojo -m "Using r$svnRevision to create a tag for the $version release."
svn copy -r $svnRevision svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/dijit/trunk svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName/dijit -m "Using r$svnRevision to create a tag for the $version release."
svn copy -r $svnRevision svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/dojox/trunk svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName/dojox -m "Using r$svnRevision to create a tag for the $version release."
svn copy -r $svnRevision svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/util/trunk svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName/util -m "Using r$svnRevision to create a tag for the $version release."

#Check out the tag
mkdir ../../build
cd ../../build
svn co svn+ssh://$svnUserName@svn.dojotoolkit.org/var/src/dojo/tags/$tagName $buildName
cd $buildName/util/buildscripts

#Update the dojo version in the tag
java -jar lib/custom_rhino.jar changeVersion.js $version ../../dojo/_base/_loader/bootstrap.js
cd ../../dojo
svn commit -m "Updating dojo version for the tag." _base/_loader/bootstrap.js

#Erase the SVN dir and replace with an exported SVN contents.
cd ../..
rm -rf ./$buildName/*
svn export http://svn.dojotoolkit.org/dojo/tags/$tagName $buildName

#Make a src bundle
srcName=$buildName-src
mv $buildName $srcName
zip -rq $srcName.zip $srcName/
tar -zcf $srcName.tar.gz $srcName/
mv $srcName $buildName

#Make a buildscripts bundle
buildScriptsName=$buildName-buildscripts
mv $buildName $buildScriptsName
zip -rq $buildScriptsName.zip $buildScriptsName/util/buildscripts/
tar -zcf $buildScriptsName.tar.gz $buildScriptsName/util/buildscripts/
mv $buildScriptsName $buildName

#Run the build.
cd $buildName/util/buildscripts/
build.sh profile=0.9 version=$1 releaseName=$buildName action=release
cd ../../release/
zip -rq $buildName.zip $buildName/
tar -zcf $buildName.tar.gz $buildName/
mv $buildName.zip ../../
mv $buildName.tar.gz ../../

#Finished.
cd ../../
outDirName=`pwd`
echo "Build complete. Files are in: $outDirName"
cd ../util/buildscripts

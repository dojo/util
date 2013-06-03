#!/usr/bin/env bash

set -e

while getopts b:u: OPTION; do
	case $OPTION in
	b)
		BRANCH=$OPTARG
		shift 2
		OPTIND=1
		;;
	u)
		USERNAME=$OPTARG
		shift 2
		OPTIND=1
		;;
	\?)
		echo "Invalid option -$OPTARG"
		exit 1
		;;
	:)
		echo "Missing argument for -$OPTARG"
		exit 1
		;;
	esac
done

# Version should be something like 0.9.0-beta or 0.9.0. See http://semver.org.
VERSION=$1
BRANCH=${BRANCH=master}

BUILD_NAME=dojo-release-$VERSION
SOURCE_NAME=$BUILD_NAME-src
DEMOS_NAME=$BUILD_NAME-demos
OUTPUT_NAME=release-$VERSION

UTIL_DIR=$(cd $(dirname $0) && pwd)
ROOT_DIR=$UTIL_DIR/build
# OUTPUT_DIR and SOURCE_DIR must be children of ROOT_DIR for certain operations to work properly
OUTPUT_DIR=$ROOT_DIR/$OUTPUT_NAME
SOURCE_DIR=$ROOT_DIR/$SOURCE_NAME
SOURCE_BUILD_DIR=$SOURCE_DIR/util/buildscripts
SOURCE_RELEASE_DIR=$SOURCE_DIR/release

ALL_REPOS="demos dijit dojo dojox util"

zip="zip -dd -ds 1m -rq"
tar="tar --checkpoint=1000 --checkpoint-action=dot"

usage() {
	echo "Usage: $0 [-b branch] [-u username] version"
	echo
	echo "-b  Branch to archive. Defaults to 'master'."
	echo "-u  Username to use for send to downloads.dojotoolkit.org."
	echo "    If not provided, manual upload is required."
	exit 1
}

if [ "$VERSION" == "" ]; then
	usage
	exit 1
fi

if [ -d $SOURCE_DIR -o -d $OUTPUT_DIR ]; then
	echo "Existing build directories detected at $ROOT_DIR"
	echo "Aborted."
	exit 1
fi

echo "This is an internal Dojo release script. You probably meant to run build.sh!"
echo "If you want to create Dojo $VERSION from $BRANCH, press 'y'."
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

if [ ! -d $ROOT_DIR ]; then
	mkdir $ROOT_DIR
fi

mkdir $SOURCE_DIR
mkdir $OUTPUT_DIR

for REPO in $ALL_REPOS; do
	# Clone pristine copies of the repository for the desired branch instead of trying to copy a local repo
	# which might be outdated, on a different branch, or containing other unpushed/uncommitted code
	git clone --recursive --single-branch --branch=$BRANCH git@github.com:dojo/$REPO.git $SOURCE_DIR/$REPO

	cd $SOURCE_DIR/$REPO

	REVISION=$(git log -n 1 --format='%h')
	VERSION_FILES=package.json

	if [ $REPO == "dojo" ]; then
		VERSION_FILES="$VERSION_FILES _base/kernel.js"
	fi

	if [ $REPO != "util" ]; then
		for FILENAME in $VERSION_FILES; do
			java -jar $UTIL_DIR/../shrinksafe/js.jar $UTIL_DIR/changeVersion.js $VERSION $REVISION $FILENAME
		done

		# These will be pushed later, once it is confirmed the build was successful, in order to avoid polluting
		# the origin repository with failed build commits and tags
		git commit -m "Updating metadata for $VERSION" $VERSION_FILES
	fi

	git tag -a -m "Release $VERSION" $VERSION
done

cd $ROOT_DIR

# Archive all source except for demos, which are provided separately so people do not have to download them
# with the source
echo -n "Archiving source..."
$zip $OUTPUT_DIR/$SOURCE_NAME.zip $SOURCE_NAME/ -x "*/.git" -x "*/.git/*" -x "$SOURCE_NAME/demos/"
$tar --exclude="$SOURCE_NAME/demos/" --exclude-vcs -zcf $OUTPUT_DIR/$SOURCE_NAME.tar.gz $SOURCE_NAME/
echo "Done"

# Temporarily rename $SOURCE_NAME ($SOURCE_DIR) to $BUILD_NAME to archive demos backwards-compatibly
mv $SOURCE_NAME $BUILD_NAME
echo -n "Archiving demos..."
$zip $OUTPUT_DIR/$DEMOS_NAME.zip $BUILD_NAME/demos/ -x "*/.git" -x "*/.git/*"
$tar --exclude-vcs -zcf $OUTPUT_DIR/$DEMOS_NAME.tar.gz $BUILD_NAME/demos/
mv $BUILD_NAME $SOURCE_NAME
echo "Done"

# Create the built release archive using the checked out release code
cd $SOURCE_BUILD_DIR
echo "Building release..."
./build.sh action=release profile=standard version=$VERSION releaseName=$BUILD_NAME cssOptimize=comments.keepLines optimize=shrinksafe.keepLines insertAbsMids=1 mini=true
cd $SOURCE_RELEASE_DIR
echo -n "Archiving release..."
$zip $OUTPUT_DIR/$BUILD_NAME.zip $BUILD_NAME/
$tar -zcf $OUTPUT_DIR/$BUILD_NAME.tar.gz $BUILD_NAME/
echo "Done"

# For backwards-compatibility, Dojo Base is also copied for direct download
cp $BUILD_NAME/dojo/dojo.js* $OUTPUT_DIR

# Second build with tests that is kept unarchived and placed directly on downloads.dojotoolkit.org
rm -rf $SOURCE_RELEASE_DIR
cd $SOURCE_BUILD_DIR
echo "Building downloads release..."
./build.sh action=release profile=standard version=$VERSION releaseName=$BUILD_NAME cssOptimize=comments.keepLines optimize=shrinksafe.keepLines insertAbsMids=1 copyTests=true mini=false
mv $SOURCE_RELEASE_DIR/$BUILD_NAME $OUTPUT_DIR
rmdir $SOURCE_RELEASE_DIR
echo "Done"

cd $OUTPUT_DIR

# Checksums, because who doesn't love checksums?!
md5=$(which md5 md5sum 2>/dev/null || true)
if [ -x $md5 ]; then
	echo -n "Generating checksums..."
	for FILENAME in *.zip *.gz *.js; do
		$md5 $FILENAME > $FILENAME.md5
		echo -n "."
	done
	echo "Done"
else
	echo "MD5 utility missing; cannot generate checksums"
fi

cd $ROOT_DIR
echo -n "Creating downloads archive..."
$tar -cf $OUTPUT_NAME.tar $OUTPUT_NAME/
echo "Done"

if [ "$USERNAME" == "" ]; then
	echo "Build complete."
	echo "Files are in: $OUTPUT_DIR"
	echo "You did not provide a username so you will need to upload manually."
	exit 0
fi

echo "Please confirm build success, then press 'y' key to clean up archives, push"
echo "tags, and upload, or any other key to bail."
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

echo -n "Cleaning up archives..."
rm -rf $OUTPUT_DIR
echo "Done"

for REPO in $ALL_REPOS; do
	cd $SOURCE_DIR/$REPO
	echo "Pushing to repo $REPO"
	git push origin $BRANCH
	git push origin --tags
done

cd $ROOT_DIR

HOST="$USERNAME@downloads.dojotoolkit.org"

echo "Copying to downloads.dojotoolkit.org..."
scp $OUTPUT_NAME.tar $HOST:/srv/www/vhosts.d/download.dojotoolkit.org
ssh $HOST "cd /srv/www/vhosts.d/download.dojotoolkit.org && tar -xf $OUTPUT_NAME.tar && rm $OUTPUT_NAME.tar"

echo "Upload complete. Please remember to update index.html."

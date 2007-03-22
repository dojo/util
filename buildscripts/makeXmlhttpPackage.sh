ant -Dprofile=browserio -Drest_files=intro_to_dojo_io.rest release

mkdir ../release/dojo/tests

cp ../tests/io/xmlhttp_package_test.html ../release/dojo/tests/ 
cp ../tests/io/test_BrowserIO_data.txt ../release/dojo/tests/

rm -rf ../release/dojo/src

(cd ../release && tar -zcf dojo.tar.gz dojo/)

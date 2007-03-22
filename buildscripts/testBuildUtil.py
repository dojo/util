import os
import buildUtil

buildUtil.findTestFiles("../tests")
buildUtil.buildTestFiles()

print file("../testRunner.js", "r+").read()

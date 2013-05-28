This test module optimizes the DOH regression testing process.
You specify the files you changed and it will automatically start DOH with all of the tests that (directly or indirectly) load the files.
This is useful for when you need to regression test code but aren't sure of the full extent of the change.
It uses a static snapshot of the define/require/initRobot calls to find the relevant test cases (to be generated nightly).

use: util/doh/runner.html?testModule=doh.plugins.changeimpact.module&files=...&robot={no|yes}

window arguments:
files: comma separated list of files you changed, like "file=dojo/on.js,dijit/_WidgetBase.js"
robot: optional, whether to also run robot tests. defaults to no.
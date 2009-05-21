The checkstyle tool is provided to help Dojo developers conform to the Dojo style guides.

Read the help by running the command:
	checkstyle.sh help
or
	checkstyle.bat.help
	
If you want to use the checkstyleReport.html tool to fix style errors and save the files,
make a copy of the file 'checkstyle.php.rename.html', and call it 'checkstyle.php'.
This script will then be used to save fixed files.

All fixed files end in '.checkstyle.js', e.g. dojo/back.js.checkstyle.js.
Cnce you are satisfied with the changes, commit them all by typing:
	checkstyle.sh commit
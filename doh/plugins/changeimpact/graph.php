<?php
	// explore the graph on the server, not the client, to help slow machines
	$files=filter_input(INPUT_POST,'files',FILTER_SANITIZE_URL);
	$robot=filter_input(INPUT_POST,'robot',FILTER_SANITIZE_URL);
	print(`java -jar ../../../shrinksafe/js.jar selectTests.js $files $robot 2>&1`);
?>
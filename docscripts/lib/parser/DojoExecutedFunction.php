<?php

require_once('DojoFunctionDeclare.php');
require_once('DojoParameters.php');
require_once('Text.php');

class DojoExecutedFunction extends DojoFunctionDeclare
{
	public function build()
	{
	  if (!$this->start) {
      die("DojoExecutedFunction->build() used before setting a start position");
    }
    if ($this->end) {
      return $this->end;
    }

    $lines = Text::chop($this->package->getCode(), $this->start[0], $this->start[1]);
		$line = $lines[$this->start[0]];
		
		$this->start = array($this->start[0], strpos($line, 'function'));

		$this->end = parent::build();
		$lines = Text::chop($this->package->getCode(), $this->end[0], $this->end[1], false, false, true);
		
		$closed = false;
		foreach ($lines as $line_number => $line) {
			$offset = 0;
			if ($line_number == $this->end[0]) {
				$offset = $this->end[1];
			}
			if (preg_match('%\S%', $line, $match, PREG_OFFSET_CAPTURE, $offset)) {
				if (!$closed) {
					if ($match[0][0] != ')') {
						return false;
					}
					else {
						$closed = true;
						$offset = $match[0][1] + 1;
					}
				}
			}
			if (preg_match('%\S%', $line, $match, PREG_OFFSET_CAPTURE, $offset)) {
				if ($closed) {
					if ($match[0][0] != '(') {
						return false;
					}
					else {
						$parameters = new DojoParameters($this->package, $line_number, $match[0][1]);
						$end = $parameters->build();
						break;
					}
				}
			}
		}
		
		return $end;
	}
}
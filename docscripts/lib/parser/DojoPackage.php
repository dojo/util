<?php

require_once('Text.php');
require_once('DojoFunctionCall.php');
require_once('DojoExecutedFunction.php');

class DojoPackage
{
	private $dojo;
	protected $file; // The file reference (including dir) to the file;
	private $code; // The source - comments
	protected $source;
	protected $declarations = array(); // Builds an array of functions declarations by name, with meta
	protected $executions = array();
	protected $calls = array(); // Builds an array of calls
	protected $objects = array(); // Builds an array of objects
	protected $aliases = array(); // Builds a key/value list of aliases in this file

	public function __construct(Dojo $dojo, $file)
	{
		$this->dojo = $dojo;
		$this->setFile($file);
	}
	
	public function getFile()
	{
		return $this->file;
	}
	
	public function setFile($file)
	{
		$this->file = $file;
	}

	public function getFunctionDeclarations()
	{
		$lines = $this->getCode();
		$end = array(0, 0);

		$matches = preg_grep('%function%', $lines);
		$last_line = 0;
		foreach ($matches as $line_number => $line) {
			if ($line_number < $last_line) {
				continue;
			}

			if (preg_match('%(\bfunction\s+[a-zA-Z0-9_.$]+\b\s*\(|\b[a-zA-Z0-9_.$]+\s*=\s*(new\s*)?function\s*\()%', $line, $match)) {
				$declaration = new DojoFunctionDeclare($this);
				$declaration->setStart($line_number, strpos($line, $match[0]));
				$end = $declaration->build();
				$last_line = $end[0];
				$this->declarations[$declaration->getFunctionName()] = $declaration;
			}
		}
		
		return $this->declarations;
	}

	public function getExecutedFunctions()
	{
		$lines = $this->getCode();
		
		$matches = preg_grep('%function%', $lines);
		$last_line = 0;
		foreach ($matches as $line_number => $line) {
			if ($line_number < $last_line) {
				continue;
			}
			
			if (preg_match('%\(\s*function\s*\(\s*\)\s*{%', $line, $match)) {
				$execution = new DojoExecutedFunction($this);
				$execution->setStart($line_number, strpos($line, $match[0]));
				$end = $execution->build();
				if ($end) {
					$last_line = $end[0];
					$this->executions[] = $execution;
				}
			}
		}
		
		return $this->executions;
	}
	
	/**
	 * Use this to find everywhere in the code a function is called.
	 *
	 * @param unknown_type $name
	 */
	public function getFunctionCalls($name)
	{
		if ($this->calls[$name]) {
			return $this->calls[$name];
		}
		
		$this->calls[$name] = array();
		$lines = $this->getCode();
		$lines = preg_grep('%\b' . preg_quote($name) . '\s*\(%', $lines);
		foreach ($lines as $line_number => $line) {
			$position = strpos($line, $name);
			if ($line_number < $last_line_number || ($line_number == $last_line_number && $position < $last_position)) {
				continue;
			}
			$call = new DojoFunctionCall($this, $line_number, $position);
			list($last_line_number, $last_position) = $call->build();
			$this->calls[$name][] = $call;
		}
		return $this->calls[$name];
	}
	
	public function removeCodeFrom($lines)
	{
		for($i = 0; $i < count($lines); $i++) {
			$line = $lines[$i];
			if (preg_match('%function\s*\([^)]*\)\s*{%', $line, $match, PREG_OFFSET_CAPTURE)) {
				$declaration = new DojoFunctionDeclare($this, $i, $match[0][1]);
				list($i, ) = $declaration->build();
				$lines = $declaration->removeCodeFrom($lines);
			}
			elseif (preg_match('%^.*(with|switch)\s*\([^(]*\)\s*{%', $line, $match)) {
				$with_lines = Text::chop($lines, $i, strlen($match[0]) - 1, null, null, true);
				list($end_line, $end_pos) = Text::findTermination($with_lines, '}', '{}()[]');
				for ($j = $i; $j <= $end_line; $j++) {
					$line = $lines[$j];
					if ($j == $i) {
						$lines[$j] = Text::blankOutAt($line, strlen($match[0]) - 1);
					}
					elseif ($j == $end_line) {
						$lines[$j] = Text::blankOutAt($line, 0, $end_pos);
					}
					else {
						$lines[$j] = Text::blankOut($line, $line);
					}
				}
			}
		}
		return $lines;
	}
	
	public function getAliases()
	{
		if ($this->aliases) {
			return $this->aliases;
		}
		
		$lines = $this->getCode();
		foreach ($this->calls as $calls) {
			foreach ($calls as $call) {
				$lines = $call->removeCodeFrom($lines);
			}
		}
		foreach ($this->declarations as $declaration) {
			$lines = $declaration->removeCodeFrom($lines);
		}
		foreach ($this->objects as $objects) {
			$lines = $objects->removeCodeFrom($lines);
		}
		$lines = $this->removeCodeFrom($lines);
		foreach ($lines as $line_number => $line) {
			if (empty($line)) continue;
			if (preg_match('%(?:[a-zA-Z0-9._$]+\s*=\s*[a-zA-Z_$][a-zA-Z0-9._$]+)+(?=;|\n)%', $line, $match)) {
				$aliases = preg_split('%\s*=\s*%', $match[0]);
				$main_alias = array_pop($aliases);
				if ($main_alias == 'true' || $main_alias == 'false' || $main_alias == 'null' || $main_alias == 'undefined' || $main_alias == 'this' || $main_alias == 'window' || substr($main_alias, 0, 5) == 'this.' || substr($main_alias, 0, 7) == 'window.') continue;
				foreach ($aliases as $alias) {
					$this->aliases[$alias] = $main_alias;
				}
			}
		}
		return $this->aliases;
	}
	
	
	public function getObjects()
	{
		if ($this->objects) {
			return $this->objects;
		}
		
		$lines = $this->getCode();
		foreach ($this->calls as $calls) {
			foreach ($calls as $call) {
				$lines = $call->removeCodeFrom($lines);
			}
		}
		foreach ($this->declarations as $declaration) {
			$lines = $declaration->removeCodeFrom($lines);
		}
		$lines = $this->removeCodeFrom($lines);
		foreach ($lines as $line_number => $line) {
			if ($line_number < $end_line_number) {
				continue;
			}
			if (preg_match('%\b([a-zA-Z0-9_.$]+)\s*=\s*{%', $line, $match, PREG_OFFSET_CAPTURE)) {
				$object = new DojoObject($this, $line_number, $match[0][1] + strlen($match[0][0]) - 1);
				$object->setName($match[1][0]);
				list($end_line_number, $end_position) = $object->build();
				$this->objects[] = $object;
			}
		}
		return $this->objects;
	}
	
	public function getSource()
	{
		if ($this->source) {
			return $this->source;
		}
		$lines = explode("\n", file_get_contents($this->dojo->getDir() . $this->file));
		$lines[] = '';
		$in_comment = false;
		foreach ($lines as $line_number => $line) {
			if (!$in_comment) {
				if (preg_match('%/\*={5,}%', $line, $match)) {
					$lines[$line_number] = Text::blankOut($match[0], $line);
					$in_comment = true;
				}
			}
			elseif (preg_match('%={5,}\*/%', $line, $match)) {
				$lines[$line_number] = Text::blankOut($match[0], $line);
				$in_comment = false;
			}
		}
		return $this->source = $lines;
	}
	
	/**
	 * Removes comments and strings, preserving layout
	 */
	public function getCode()
	{
		if ($this->code) {
			return $this->code;
		}
		
		$lines = $this->getSource();
		
		$in_comment = false;
		foreach ($lines as $line_number => $line) {
			//print "$line_number $line\n";
			if ($in_comment !== false) {
				if (preg_match('%^.*\*/%U', $line, $match)) {
					$line = Text::blankOut($match[0], $line);
					$in_comment = false;
				}
				else {
					$line = Text::blankOut($line, $line);
				}
			}
			
			$position = 0;
			$in_single_string = false;
			$in_double_string = false;
			$in_regex = false;

			for ($i = 0; $i < 100; $i++) {
				$matches = array();

				if ($in_comment === false && $in_regex === false && $in_single_string === false && $in_double_string === false) {
					if (preg_match('%(?:^|\breturn\b|[=([{,|&;:?])\s*/(?!/)%', $line, $match, PREG_OFFSET_CAPTURE, $position)) {
						$matches[$match[0][1] + strlen($match[0][0]) - 1] = '/';
					}
					if (preg_match('%(?:^|\breturn\b|[=([{,|&;:?+])\s*(["\'])%', $line, $match, PREG_OFFSET_CAPTURE, $position)) {
						$matches[$match[0][1] + strlen($match[0][0]) - 1] = $match[1][0];
					}
					if (($pos = strpos($line, '//', $position)) !== false) {
						$matches[$pos] = '//';
					}
					if (($pos = strpos($line, '/*', $position)) !== false) {
						$matches[$pos] = '/*';
					}
				}
				elseif ($in_regex !== false) {
					if (preg_match('%(?<![/\\\])/\s*([img.)\]},|&;:]|$)%', $line, $match, PREG_OFFSET_CAPTURE, $position)) {
						$matches[$match[0][1]] = '/';
					}
				}
				elseif ($in_single_string !== false || $in_double_string !== false) {
					while (($pos = strpos($line, '\\\\', $position)) !== false || ($pos = strpos($line, '\\"', $position)) !== false || ($pos = strpos($line, "\\'", $position)) !== false) {
						$position = $pos + 2;
					}
					$test = substr($line, $position);
					if (preg_match('%([\'"])\s*([+.)\]},|&;:?]|$)%', $line, $match, PREG_OFFSET_CAPTURE, $position)) {
						$matches[$match[0][1]] = $match[1][0];
					}
				}
				elseif ($in_comment !== false) {
					if (($pos = strpos($line, '*/', $position)) !== false) {
						$matches[$pos] = '*/';
					}
				}
				
				if (!$matches) {
					break;
				}
				
				ksort($matches);
				foreach ($matches as $position => $match) {
					if ($in_comment === false && $in_regex === false && $in_single_string === false && $in_double_string === false) {
						if ($match == '"') {
							$in_double_string = $position;
							break;
						}
						elseif ($match == "'") {
							$in_single_string = $position;
							break;
						}
						elseif ($match == '/') {
							$in_regex = $position;
							break;
						}
						elseif ($match == '//') {
							$line = Text::blankOutAt($line, $position);
							break;
						}
						elseif ($match == '/*') {
							$in_comment = $position;
							break;
						}
					}
					elseif ($in_double_string !== false && $match == '"') {
						$line = Text::blankOutAt($line, $in_double_string + 1, $position - 1);
						$in_double_string = false;
					}
					elseif ($in_single_string !== false && $match == "'") {
						$line = Text::blankOutAt($line, $in_single_string + 1, $position - 1);
						$in_single_string = false;
					}
					elseif ($in_regex !== false && $match == '/') {
						$line = Text::blankOutAt($line, $in_regex + 1, $position - 1);
						$in_regex = false;
					}
					elseif ($in_comment !== false && $match == '*/') {
						$line = Text::blankOutAt($line, $in_comment + 2, $position - 1);
						$in_comment = false;
					}
				}
				++$position;
			}
			
			if ($i == 500) {
				die("\$i should not reach 500: $line");
			}
			
			if ($in_comment !== false && !empty($line)) {
				$line = Text::blankOutAt($line, $in_comment);
				$in_comment = 0;
			}
			
			//print "$line_number $line\n";
			$lines[$line_number] = $line;
		}
		return $this->code = $lines;
	}
	
	/**
	 * Remove items from the passed objects if they are inside of existing calls or declarations
	 */
	public function removeSwallowed(&$objects)
	{
		foreach ($objects as $i => $object) {
			foreach ($this->declarations as $declaration) {
					if (($object->start[0] > $declaration->start[0] || ($object->start[0] == $declaration->start[0] && $object->start[1] > $declaration->start[1]))
							&& ($object->end[0] < $declaration->end[0] || ($object->end[0] == $declaration->end[0] && $object->end[1] < $declaration->end[1]))) {
					unset($objects[$i]);
				}
			}
			foreach ($this->calls as $call_name => $calls) {
				foreach ($calls as $call) {
					if (($object->start[0] > $call->start[0] || ($object->start[0] == $call->start[0] && $object->start[1] > $call->start[1]))
							&& ($object->end[0] < $call->end[0] || ($object->end[0] == $call->end[0] && $object->end[1] < $call->end[1]))) {
						unset($objects[$i]);
					}
				}
			}
			foreach ($this->executions as $execution) {
				if (($object->start[0] > $execution->start[0] || ($object->start[0] == $execution->start[0] && $object->start[1] > $execution->start[1]))
							&& ($object->end[0] < $execution->end[0] || ($object->end[0] == $execution->end[0] && $object->end[1] < $execution->end[1]))) {
					unset($objects[$i]);
				}
			}
		}
	}

	public function getPackageName()
	{
		$name = '';

		if (file_exists('modules/' . $this->dojo->namespace . '.module')) {
			include_once('modules/' . $this->dojo->namespace . '.module');
			$name = call_user_func($this->dojo->namespace . '_package_name', $this->dojo->namespace, $this->file);
		}

		if ($name) return $name;
		return 'null';
	}

	public function getResourceName()
	{
		$name = '';

		if (file_exists('modules/' . $this->dojo->namespace . '.module')) {
			include_once('modules/' . $this->dojo->namespace . '.module');
			$name = call_user_func($this->dojo->namespace . '_resource_name', $this->dojo->namespace, $this->file);
		}

		if ($name) return $name;
		return 'null';
	}

}

?>
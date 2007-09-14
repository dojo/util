<?php

require_once('DojoFunctionBody.php');
require_once('DojoBlock.php');

class DojoFunctionDeclare extends DojoBlock
{
  private $object = 'DojoFunctionDeclare';
  
  private $parameters;
  protected $parameter_values;
  private $function_name;
  private $body;
  
  private $anonymous = false;
  private $prototype = '';
	private $constructor = false;
	private $aliases = '';

  public function __construct($package, $line_number = false, $position = false)
  {
    parent::__construct($package, $line_number, $position);
    $this->parameters = new DojoParameters($package);
    $this->body = new DojoFunctionBody($package);
  }

  public function getFunctionName()
  {
    return $this->function_name;
  }
	
	public function getAliases()
	{
		return $this->aliases;
	}
  
  public function setFunctionName($function_name)
  {
    $this->function_name = $function_name;
  }
  
  public function setPrototype($function_name)
  {
    $this->prototype = $function_name;
  }
  
  public function getPrototype()
  {
    return $this->prototype;
  }
  
  public function setInstance($function_name)
  {
    $this->instance = $function_name;
  }
  
  public function getInstance()
  {
    return $this->instance;
  }
	
	public function setConstructor($constructor)
	{
		$this->constructor = $constructor;
	}
	
	public function isConstructor()
	{
		return $this->constructor;
	}
  
  public function isAnonymous()
  {
    return $this->anonymous;
  }
  
  public function isThis()
  {
    return ($this->prototype || $this->instance);
  }
  
  public function getThis()
  {
    return ($this->prototype) ? $this->prototype : $this->instance;
  }
  
  public function getInstanceVariableNames()
  {
    return array_unique($this->body->getInstanceVariableNames());
  }
  
  public function getReturnComments()
  {
    return array_unique($this->body->getReturnComments());
  }
  
  public function getThisInheritanceCalls()
  {
    return array_unique($this->body->getThisInheritanceCalls());
  }
  
  public function getFunctionDeclarations()
  {
  	return $this->body->getExternalizedFunctionDeclarations();
  }
  
  public function removeCodeFrom($lines){
    for ($i = $this->start[0]; $i <= $this->end[0]; $i++) {
      $line = $lines[$i];
      if ($i == $this->start[0]) {
        $lines[$i] = Text::blankOutAt($line, $this->start[1]);
      }
      elseif ($i == $this->end[0]) {
        $lines[$i] = Text::blankOutAt($line, 0, $this->end[1]);
      }
      else {
        $lines[$i] = Text::blankOut($line, $line);
      }
    }
    return $lines;
  }

  public function build(){
    if (!$this->start) {
      die("DojoFunctionDeclare->build() used before setting a start position");
    }
    if ($this->end) {
      return $this->end;
    }

  	$lines = Text::chop($this->package->getCode(), $this->start[0], $this->start[1]);
    $line = trim($lines[$this->start[0]]);
    if (strpos($line, 'function') === 0) {
      $line = substr($line, 8);
      preg_match('%[^\s]%', $line, $match);
      if ($match[0] != '(') {
        $this->function_name = trim(substr($line, 0, strpos($line, '(')));
      }
    }
    else {
      $name = trim(substr($line, 0, strpos($line, '=')));
			$extra = substr($line, strpos($line, '=') + 1);
      if (preg_match('%^\s+new\s+%', $name, $match) || preg_match('%^\s*new\s+%', $extra, $match)) {
        $this->anonymous = true;
        $name = str_replace($match[0], '', $name);
      }
      if (($pos = strpos($name, '.prototype.')) !== false) {
        $this->prototype = substr($name, 0, $pos);
        $name = str_replace('.prototype', '', $name);
      }
      if (($pos = strpos($name, 'this.')) === 0) {
        $this->instance = $this->getFunctionName();
        $name = $this->getFunctionName() . "." . preg_replace('%^this\.%', '', $name);
      }
			
			$full_lines = Text::chop($this->package->getCode(), $this->start[0], 0);
			$full_line = substr($full_lines[$this->start[0]], 0, $this->start[1]);
			if (preg_match('%(?:[a-zA-Z0-9._$]+\s*=\s*)+$%', $full_line, $matches)) {
				$aliases = preg_split('%\s*=\s*%', $matches[0]);
				foreach ($aliases as $alias) {
					$alias = trim($alias);
					if ($alias) {
						if (strpos($alias, 'this.') === 0) {
							$alias = $this->getFunctionName() . "." . preg_replace('%^this\.%', '', $alias);
						}
						$this->aliases[] = $alias;
					}
				}
			}
			
			$this->function_name = $name;
    }
    
    $this->parameters->setStart($this->start[0], strpos($lines[$this->start[0]], '('));
    $end = $this->parameters->build();
    
    $lines = Text::chop($this->package->getCode(), $end[0], $end[1]);
    foreach ($lines as $line_number => $line) {
      if (($pos = strpos($line, '{')) !== false) {
        $this->body->setStart($line_number, $pos);
        return $this->end = $this->body->build();
      }
    }
  }
  
  public function getParameter($pos)
  {
    return $this->parameters->getParameter($pos);
  }
  
  public function getParameters()
  {
    return $this->parameters->getParameters();
  }
  
  public function addBlockCommentKey($key)
  {
    $this->body->addBlockCommentKey($key);
  }
  
  public function getBlockCommentKeys() 
  {
    return $this->body->getBlockCommentKeys();
  }
  
  public function getBlockComment($key)
  {
    return $this->body->getBlockComment($key);
  }
  
  public function getSource()
  {
    return $this->body->getSource();
  }
  
  public function getInstanceFunctions($function_name)
  {
    return $this->body->getInstanceFunctions($function_name);
  }
  
  public function rollOut(&$output) {
		// Basically, any this.variables in here never impact this object, they apply to the "this" function
    $masquerading_as_function = $function_name = $this->getFunctionName();
    if ($this->isThis()) {
      $masquerading_as_function = $this->getThis();
    }

		$output[$function_name]['type'] = 'Function';
		$output[$masquerading_as_function]['type'] = 'Function';

		if ($aliases = $this->getAliases()) {
			foreach ($aliases as $alias) {
				$output[$alias]['aliases'] = $function_name;
			}
		}
		if ($this->isAnonymous()) {
			$output[$function_name]['initialized'] = true;
		}

    $parameters = $this->getParameters();
    foreach ($parameters as $parameter) {
      if ($parameter->isA(DojoVariable)) {
				$parameter_name = $parameter->getVariable();
				$parameter_type = $parameter->getType();
				if (strpos($parameter_type, '?')) {
					$parameter_type = substr($parameter_type, 0, strlen($parameter_type) - 1);
					$output[$function_name]['parameters'][$parameter_name]['optional'] = true;
				}
				if (strpos($parameter_type, '...')) {
					$parameter_type = substr($parameter_type, 0, strlen($parameter_type) - 3);
					$output[$function_name]['parameters'][$parameter_name]['repeating'] = true;
				}
        $output[$function_name]['parameters'][$parameter_name]['type'] = $parameter_type;
        $this->addBlockCommentKey($parameter->getVariable());
      }
    }

    $this->addBlockCommentKey('summary');
    $this->addBlockCommentKey('description');
		$this->addBlockCommentKey('returns'); 
    
    $output[$function_name]['source'] = $this->getSource();
    
    $all_variables = array();
    $instance_variables = $this->getInstanceVariableNames();
    foreach ($instance_variables as $instance_variable) {
      $this->addBlockCommentKey($instance_variable);
      $all_variables[] = $instance_variable;

			$full_variable_name = "{$masquerading_as_function}.{$instance_variable}";
			$output[$full_variable_name]['instance'] = $masquerading_as_function;
    }
    
    $instance_functions = $this->getInstanceFunctions($function_name);
    foreach ($instance_functions as $instance_function) {
      $instance_function->rollOut($output);
			$output[$instance_function->getFunctionName()]['instance'] = $function_name;
    }
    
    $comment_keys = $this->getBlockCommentKeys();
    foreach ($comment_keys as $key) {
      if ($key == 'summary') {
        $output[$function_name]['summary'] = $this->getBlockComment($key);
      }
      elseif ($key == 'description') {
        $output[$function_name]['description'] = $this->getBlockComment($key);
      }
			elseif ($key == 'returns') {
				$output[$function_name]['returns'] = $this->getBlockComment($key);
			}
      elseif (in_array($key, $all_variables) && $comment = $this->getBlockComment($key)) {
			  list($type, $comment) = explode(' ', $comment, 2);
        $type = preg_replace('%(^[^a-zA-Z0-9._$]|[^a-zA-Z0-9._$?]$)%', '', $type);
				if ($type) {
        	$output[$key]['type'] = $type;
				}
				$output[$key]['summary'] = $comment;
      }
      elseif (!empty($output[$function_name]['parameters']) && array_key_exists($key, $output[$function_name]['parameters']) && $comment = $this->getBlockComment($key)) {
			  list($parameter_type, $comment) = explode(' ', $comment, 2);
        $parameter_type = preg_replace('%(^[^a-zA-Z0-9._$]|[^a-zA-Z0-9._$?]$)%', '', $parameter_type);
				if ($parameter_type) {
					if (strpos($parameter_type, '?')) {
						$parameter_type = substr($parameter_type, 0, strlen($parameter_type) - 1);
						$output[$function_name]['parameters'][$key]['optional'] = true;
					}
					if (strpos($parameter_type, '...')) {
						$parameter_type = substr($parameter_type, 0, strlen($parameter_type) - 3);
						$output[$function_name]['parameters'][$key]['repeating'] = true;
					}
        	$output[$function_name]['parameters'][$key]['type'] = $parameter_type;
				}
				$output[$function_name]['parameters'][$key]['summary'] = $comment;
      }
    }
  
    $returns = $this->getReturnComments();
    if (count($returns) == 1) {
      $output[$function_name]['returns'] = $returns[0];
    }
    elseif ($returns) {
      $output[$function_name]['returns'] = 'mixed';
    }
    
    if ($calls = $this->getThisInheritanceCalls()) {
			foreach ($calls as $call) {
      	$output[$function_name]['chains']['call'][] = $call;
			}
    }
    
    if ($this->getPrototype()) {
      $output[$function_name]['prototype'] = $this->getPrototype();
    }
    if ($this->getInstance()) {
      $output[$function_name]['instance'] = $this->getInstance();
    }
  }
}

?>
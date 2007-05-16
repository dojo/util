<?php

require_once('DojoBlock.php');
require_once('DojoFunctionBody.php');
require_once('Text.php');

class DojoObject extends DojoBlock
{
  private $object = 'DojoObject';
  
  private $values = array();
  private $name = '';
  private $body;
  private $extra_block_values = array();
  private $anonymous = false;
  
  public function __construct($package, $line_number = false, $position = false)
  {
    parent::__construct($package, $line_number, $position);
    $this->body = new DojoFunctionBody($package, $line_number, $position);
  }
  
  public function setName($name)
  {
    $this->name = $name;
  }
  
  public function getName()
  {
    return $this->name;
  }
  
  public function setAnonymous($anonymous)
  {
    $this->anonymous = true;
  }
  
  public function isAnonymous()
  {
    return $this->anonymous;
  }
  
  public function getBlockCommentKeys()
  {
    return $this->body->getBlockCommentKeys();
  }
  
  public function getBlockComment($key)
  {
    return $this->body->getBlockComment($key);
  }
  
  public function addBlockCommentKey($key)
  {
    return $this->body->addBlockCommentKey($key);
  }
  
  public function build()
  {
    if (!$this->start) {
      die("DojoObject->build() used before setting a start position");
    }
   
    $lines = Text::chop($this->package->getCode(), $this->start[0], $this->start[1], false, false, true);
    $end = array($this->start[0], $this->start[1]);

    do {
      $lines = Text::chop($this->package->getCode(), $end[0], $end[1], false, false, true);
      foreach ($lines as $line_number => $line) {
				if (preg_match('%^\s*}%', $line)) {
					break;
				}
        if (preg_match('%^(\s*)([a-zA-Z0-9_$]+|"\s+")\s*:%', $line, $match)) {
          if ($end[0] != $this->start[0] && $end[1] != $this->start[1]) {
            $between_lines = Text::chop($this->package->getSource(), $end[0], $end[1], $line_number, strlen($match[1]), true);
            $between_started = true;
            foreach ($between_lines as $between_line) {
              if ($between_started && empty($between_line)) {
                break;
              }
              if (!empty($between_line)) {
                $between_started = true;
              }
              $this->body->addBlockCommentLine($between_line);
            }
            $between_started = false;
          }
          $end = array($line_number, strlen($match[0]));
          if ($match[2]{0} == '"' || $match[2]{0} == "'") {
            $key = trim(implode(Text::chop($this->package->getSource(), $line_number, strpos($line, '"') + 1, $line_number, strlen($match[0]) - 3, false)));
          }
          else {
            $key = $match[2];
          }
          break;
        }
      }
			
      if (!$key) {
        $end = Text::findTermination($lines, '}');
      }
      else {
        $parameter = new DojoParameter($this->package, $end[0], $end[1], '}');
        $end = $parameter->build();
        $this->values[$key] = $parameter;
      }
    }
    while ($lines[$end[0]]{$end[1]} != '}');

    $this->setEnd($end[0], $end[1]);
    return $end;
  }
  
  public function getKeys()
  {
    if (!$this->values) {
      $this->build();
    }
    return array_keys($this->values);
  }
  
  public function getValues()
  {
    if (!$this->values) {
      $this->build();
    }
    return $this->values;
  }
  
  public function rollOut(&$output, $item_type = 'object')
  {
		$item_type .= 's';
    $package_name = $this->package->getPackageName();
    $name = $this->getName();
    $values = $this->getValues();
    $variables = array();

    foreach ($values as $key => $value) {
      if ($value->isA(DojoFunctionDeclare)) {
        $function = $value->getFunction();
				if (!$function->isConstructor()) {
					$function->setFunctionName("{$name}.{$key}");
	        $function->rollOut($output);
				}
      }
      elseif ($value->isA(DojoObject)) {
        $object = $value->getObject();
        $object->setName("{$name}.{$key}");
        $object->rollOut($output);
      }
      else {
        $this->addBlockCommentKey($key);
				$full_variable_name = "{$name}.{$key}";
				if (empty($output[$full_variable_name])) {
					$output[$full_variable_name] = array();
				}
        $variables[] = $key;
      }
    }

		$this->addBlockCommentKey('summary');
		$this->addBlockCommentKey('description');

    foreach ($variables as $key) {
			$full_variable_name = "{$name}.{$key}";

      if ($comment = $this->getBlockComment($key)) {
        list($type, $comment) = explode(' ', $comment, 2);
        $type = preg_replace('%(^[^a-zA-Z0-9._$]|[^a-zA-Z0-9._$?]$)%', '', $type);
				if ($type) {
					$output[$full_variable_name]['type'] = $type;
				}
        $output[$full_variable_name]['summary'] = $comment;
      }
    }
		if (!$this->isAnonymous() && $comment = $this->getBlockComment('summary')) {
			$output[$name]['summary'] = $comment;
		}
		if (!$this->isAnonymous() && $comment = $this->getBlockComment('description')) {
			$output[$name]['description'] = $comment;
		}
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
}

?>
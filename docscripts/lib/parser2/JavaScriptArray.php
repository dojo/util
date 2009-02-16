<?php

require_once('JavaScriptStatements.php');
require_once('JavaScriptLiteral.php');
require_once('JavaScriptString.php');
require_once('JavaScriptNumber.php');
require_once('JavaScriptRegExp.php');
require_once('JavaScriptFunction.php');
require_once('JavaScriptObject.php');

class JavaScriptArray {
  protected $args;
  protected $resolved_args;

  public function __construct($args) {
    $this->args = $args;
  }

  public function type() {
    return 'Array';
  }

  public function get($position) {
    $args = $this->all();
    return $args[$position];
  }

  private function getType($position, $type) {
    $args = $this->all();
    if ($args[$position] instanceof $type) {
      return $args[$position];
    }
  }

  public function getVariable($position) {
    return $this->getType($position, JavaScriptLiteral)->value();
  }

  public function getString($position) {
    return $this->getType($position, JavaScriptString)->value();
  }

  public function getNumber($position) {
    return $this->getType($position, JavaScriptNumber)->value();
  }

  public function getRegExp($position) {
    return $this->getType($position, JavaScriptRegExp)->value();
  }

  public function getFunction($position) {
    return $this->getType($position, JavaScriptFunction);
  }

  public function getArray($position) {
    return $this->getType($position, JavaScriptArray);
  }

  public function getObject($position) {
    return $this->getType($position, JavaScriptObject);
  }

  public function all() {
    if (isset($this->resolved_args)) {
      return $this->resolved_args;
    }

    $args = array();
    foreach ($this->args as $arg) {
      $args[] = JavaScriptStatements::convert_symbol($arg);
    }

    return ($this->resolved_args = $args);
  }
}

?>
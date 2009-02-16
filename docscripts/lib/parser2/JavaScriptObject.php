<?php

require_once('JavaScriptStatements.php');

class JavaScriptObject {
  protected $values;

  protected $keys;

  public function __construct($values) {
    $this->values = $values;
  }

  public function type() {
    return 'Object';
  }

  public function values() {
    if (isset($this->keys)) {
      return $this->keys;
    }

    $keys = array();
    foreach ($this->values as $value) {
      $keys[$value->key][] = JavaScriptStatements::convert_symbol($value);
    }

    return ($this->keys = $keys);
  }
}
<?php

class JavaScriptLiteral {
  protected $value;

  public function __construct($value) {
    $this->value = $value;
  }

  public function value() {
    return $this->value;
  }

  public function type() {
    if (is_null($this->value)) {
      return 'null';
    }
    elseif (is_bool($this->value)) {
      return 'bool';
    }
    throw new Exception('Unstringed literal type');
  }
}
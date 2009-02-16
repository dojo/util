<?php

class JavaScriptFunction {
  protected $statement;

  public function __construct($statement) {
    $this->statement = $statement;
  }

  public function type() {
    return 'Function';
  }
}
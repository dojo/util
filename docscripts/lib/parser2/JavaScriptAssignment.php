<?php

require_once('JavaScriptStatements.php');

class JavaScriptAssignment {
  protected $variable;
  protected $value;

  protected $resolved_variable;
  protected $resolve_value;
  protected $global_scope;

  public function __construct($variable, $value) {
    $this->variable = $variable;
    $this->value = $value;
  }

  private function resolve() {
    list ($this->global_scope, $this->resolved_variable) = JavaScriptStatements::resolve_variable($this->variable);
  }

  public function name() {
    if (!isset($this->resolved_variable)) {
      $this->resolve();
    }
    return $this->resolved_variable;
  }

  public function type() {
    return $this->value()->type();
  }

  public function value() {
    if (!isset($this->resolved_value)) {
      $this->resolved_value = JavaScriptStatements::convert_symbol($this->value);
    }
    return $this->resolved_value;
  }

  public function is_global () {
    if (!isset($this->global_scope)) {
      $this->resolve();
    }
    return !!$this->global_scope;
  }

  public function arguments() {
    if (isset($this->resolved_value)) {
      return $this->resolved_value;
    }
    return ($this->resolved_value = JavaScriptStatement::convert_symbol($this->value));
  }
}
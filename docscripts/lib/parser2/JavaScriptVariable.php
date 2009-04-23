<?php

require_once('Destructable.php');

class JavaScriptVariable extends Destructable {
  protected $variable;
  protected $resolved_variable;
  protected $global_scope;

  public function __construct($variable, $instantiated = FALSE) {
    $this->variable = $variable;
  }

  public function __destruct() {
    $this->mem_flush('variable', 'resolved_variable', 'global_scope');
  }

  private function resolve() {
    if (!$this->variable->is_lookup()) {
      $this->global_scope = FALSE;
      $this->resolved_variable = NULL;
    }
    else {
      list ($this->global_scope, $this->resolved_variable) = $this->variable->resolve();
    }
  }

  public function value() {
    if (!isset($this->resolved_variable)) {
      $this->resolve();
    }
    return $this->resolved_variable;
  }

  public function type() {
    // TODO: Things that receive this value should reassign to aliases as appropriate
    return 'variable';
  }

  public function is_global () {
    if (!isset($this->global_scope)) {
      $this->resolve();
    }
    return !!$this->global_scope;
  }
}
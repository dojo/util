<?php

require_once('Destructable.php');

class JavaScriptTernary extends Destructable {
  protected $expression;
  protected $if_true;
  protected $if_false;

  public function __construct($expression, $if_true, $if_false) {
    $this->expression = $expression;
    $this->if_true = $if_true;
    $this->if_false = $if_false;
  }

  public function __destruct() {
    $this->mem_flush('expression', 'if_true', 'if_false');
  }

  public function type() {
    if ($type = $this->if_true->type()) {
      return $type;
    }
    return $this->if_false->type();
  }
}
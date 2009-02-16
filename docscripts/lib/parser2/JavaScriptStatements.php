<?php

require_once('JavaScriptFunctionCall.php');
require_once('JavaScriptLiteral.php');
require_once('JavaScriptString.php');
require_once('JavaScriptNumber.php');
require_once('JavaScriptRegExp.php');
require_once('JavaScriptFunction.php');
require_once('JavaScriptObject.php');
require_once('JavaScriptArray.php');
require_once('JavaScriptAssignment.php');

class JavaScriptStatements {
  protected $statements;
  protected $function_calls;
  protected $function_assignments;

  public function __construct($statements) {
    $this->statements = $statements;
  }

  public static function convert_symbol($symbol) {
    if ($symbol->arity == 'literal') {
      switch($symbol->type){
      case 'string':
        return new JavaScriptString($symbol->value);
      case 'number':
        return new JavaScriptNumber($symbol->value);
      case 'regex':
        return new JavaScriptRegExp($symbol->value);
      default:
        return new JavaScriptLiteral($symbol->value);
      }
    }
    else {
      switch($symbol->id){
      case 'function':
        return new JavaScriptFunction($symbol);
      case '{':
        return new JavaScriptObject($symbol->first);
      case '[':
        return new JavaScriptArray($symbol);
      }
    }
    throw new Exception("No class for {$symbol->id}:{$symbol->arity}");
  }

  public static function resolve_variable($statement) {
    $first = ($statement->arity == 'name') ? $statement : $statement->first;
    $second = $statement->second;
    $global_scope = FALSE;

    if ($first->id == '.') {
      list($is_global, $name) = self::resolve_variable($statement->first);
    }
    else {
      if ($first->arity == 'name' && $assigned = $first->scope->assigned($first->value)) {
        if ($assigned->id != '.' && $assigned->id != '[' && $assigned->arity != 'name') {
          return array($first->global_scope, $first->value);
        }
        list($is_global, $name) = self::resolve_variable($assigned);
      }
      else {
        $is_global = $first->global_scope;
        $name = $first->value;
      }
    }

    if ($second) {
      $name .= '.' . $second->value;
    }

    if ($is_global) {
      $global_scope = TRUE;
    }

    return array($global_scope, $name);
  }

  public function function_calls($global_scope = FALSE, $name = NULL) {
    $calls = $this->function_calls = isset($this->function_calls) ? $this->function_calls : $this->resolve_something('resolve_function_calls');
    if ($name) {
      $calls = array_filter($calls, create_function('$item', 'return $item->name() == "' . $name . '";'));
    }
    if ($global_scope) {
      $calls = array_filter($calls, create_function('$item', 'return $item->is_global();'));
    }
    return $calls;
  }

  public function assignments($global_scope = FALSE) {
    $assignments = $this->function_assignments = isset($this->function_assignments) ? $this->function_assignments : $this->resolve_something('resolve_assignments');
    if ($global_scope) {
      $assignments =  array_filter($assignments, create_function('$item', 'return $item->is_global();'));
    }
    return $assignments;
  }

  private function resolve_something($found_callback, $somethings = array(), $statements = NULL) {
    if (!$statements) {
      $statements = $this->statements;
    }

    if (!is_array($statements)) {
      $statements = array($statements);
    }

    foreach ($statements as $statement) {
      if ($something = call_user_func(array($this, $found_callback), $statement)) {
        $somethings[] = $something;
        continue;
      }

      if ($statement->first) {
        $somethings = $this->resolve_something($found_callback, $somethings, $statement->first);
      }
      if ($statement->second) {
        $somethings = $this->resolve_something($found_callback, $somethings, $statement->second);
      }
      if ($statement->third) {
        $somethings = $this->resolve_something($found_callback, $somethings, $statement->third);
      }
    }

    return $somethings;
  }

  private function resolve_function_calls($statement) {
    if ($statement->id == '(' && $statement->arity == 'binary') {
      return new JavaScriptFunctionCall($statement->first, $statement->second);
    }
  }

  private function resolve_assignments($statement) {
    if ($statement->id == '=' && ($statement->first->id == '.' || $statement->first->id == '[' || $statement->arity == 'name')) {
      return new JavaScriptAssignment($statement->first, $statement->second);
    }
  }
}
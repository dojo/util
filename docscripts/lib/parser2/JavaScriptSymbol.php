<?php

require_once('Symbol.php');

class JavaScriptSymbol extends Symbol {
  public function nud_angled($parser) {
    $items = array();
    if (!$parser->peek(']')) {
      while (1) {
        $items[] = $parser->expression();
        if (!$parser->peek(',')) {
          break;
        }
        $parser->advance(',');
      }
    }
    $parser->advance(']');
    $this->first = $items;
    $this->arity = 'unary';
    return $this;
  }

  public function led_bracket($parser, $left) {
    $this->first = $left;
    $this->second = $parser->expression();
    $this->arity = 'binary';
    $parser->advance(']');
    return $this;
  }

  public function lbp_crement($parser, $left) {
    if ($left->id == '.' || $left->id == '[' || $left->arity == 'name') {
      return 100;
    }
    return 0;
  }

  public function led_crement($parser, $left) {
    // Show that the in/decrementer is on the right
    $this->first = $left;
    $this->arity = 'unary';
    return $this;
  }

  public function nud_crement($parser) {
    // Show that the in/decrement is before the expression
    $this->first = NULL;
    $this->second = $parser->expression(70);
    return $this;
  }

  public function std_break($parser) {
    if ($parser->peek(';')) {
      $parser->advance(';');
    }
    if ($parser->peek('}')) {
      throw new error('Unreachable statement');
    }
    $this->arity = 'statement';
    return $this;
  }

  public function nud_curly($parser) {
    $values = array();

    if (!$parser->peek('}')) {
      while (1) {
        $token = $parser->token;
        if ($token->arity != 'name' && $token->arity != 'literal') {
          throw new Exception("Bad key: {$token->id}");
        }
        $parser->advance();
        $parser->advance(':');
        $expression = $parser->expression();
        $expression->key = $token->value;
        $values[] = $expression;
        if (!$parser->peek(',')) {
          break;
        }
        $parser->advance(',');
      }
    }

    $parser->advance('}');
    $this->first = $values;
    $this->arity = 'unary';
    return $this;
  }

  public function std_curly($parser) {
    $statements = $parser->statements(array('}'));
    $parser->advance('}');
    return $statements;
  }

  public function std_for($parser) {
    $parser->advance('(');

    if($parser->peek('var')) {
      $token = $parser->token;
      $parser->advance('var');
      $this->first = $token->std($parser);
      if ($parser->peek('in')) {
        $parser->advance('in');
        $this->second = $parser->expression();
      }
    }
    else {
      // Don't forget that expressionless for(;;) loops are valid
      $this->first = $parser->peek(';') ? NULL : $parser->expression();
    }

    if ($parser->peek(')')) {
    }
    else {
      $parser->advance(';');
      $this->second = $parser->peek(';') ? NULL : $parser->expression();
      $parser->advance(';');
      $this->thid = $parser->peek(')') ? NULL : $parser->expression();
    }
    $parser->advance(')');
    if ($parser->peek('{')) {
      $this->block = $this->block($parser);
    }
    else {
      $this->block = $parser->expression();
    }
    $this->arity = 'statement';
    return $this;
  }

  public function nud_function($parser) {
    $arguments = array();
    $parser->new_scope();
    $this->scope = $parser->scope;
    if ($parser->token->arity == 'name') {
      $parser->scope->define($parser->token);
      $this->name = $parser->token->value;
      $parser->advance();
    }
    $parser->advance('(');
    if (!$parser->peek(')')) {
      while (1) {
        if ($parser->token->arity != 'name') {
          throw new Exception('Expected a parameter name');
        }
        $parser->scope->define($parser->token);
        $arguments[] = $parser->token;
        $parser->advance();
        if (!$parser->peek(',')) {
          break;
        }
        $parser->advance(',');
      }
    }

    $this->first = $arguments;
    $parser->advance(')');
    $parser->advance('{');
    $this->second = $parser->statements(array('}'));
    $parser->advance('}');
    $this->arity = 'function';
    $parser->scope_pop();
    return $this;
  }

  public function std_if($parser) {
    $parser->advance('(');
    $this->first = $parser->expression();
    $parser->advance(')');
    if ($parser->peek('{')) {
      $this->second = $this->block($parser);
    }
    else {
      $this->second = $parser->expression();
    }
    if ($parser->peek('else')) {
      $parser->scope->reserve($parser->token);
      $parser->advance('else');
      $this->third = $parser->peek('if') ? $parser->statement() : $this->block($parser);
    }
    else {
      $this->third = NULL;
    }
    $this->arity = 'statement';
    return $this;
  }

  public function led_parenthesis($parser, $left) {
    if ($left->id != '.' && $left->id != '[') {
      if (($left->arity != 'unary' || $left->id != 'function') && $left->arity != 'name' && $left->id != '(' && $left->id != '&&' && $left->id != '||' && $left->id != '?') {
        throw new Exception('Expected a variable name');
      }
    }

    $arguments = array();

    if (!$parser->peek(')')) {
      while (1) {
        $arguments[] = $parser->expression();
        if (!$parser->peek(',')) {
          break;
        }
        $parser->advance(',');
      }
    }

    // e.g. foo(bar) has a foo first, bar second
    $this->arity = 'binary';
    $this->first = $left;
    $this->second = $arguments;

    $parser->advance(')');
    return $this;
  }

  public function nud_parenthesis($parser) {
    // '(' can mean function call, or executed function
    $is_function = $parser->peek('function');
    $expression = $parser->expression();
    $parser->advance(')');

    if ($is_function && $parser->peek('(')) {
      // The function gets executed
      $parser->advance('(');
      $arguments = array();
      if (!$parser->peek(')')) {
        while (1) {
          $arguments[] = $parser->expression();
          if (!$parser->peek(',')) {
            break;
          }
          $parser->advance(',');
        }
      }
      $parser->advance(')');
      if ($parser->peek(';')) {
        $parser->advance(';');
      }

      // Make assignments within the function scope (in $expression)
      // between the arguments in the expression and the passed arguments
      foreach ($expression->first as $i => $parameter) {
        if ($arguments[$i]) {
          // The passed argument is assigned immediately to the matching parameter
          $expression->scope->assignment($parameter, $arguments[$i]);
        }
      }

      $this->first = $expression;
      $this->second = $arguments;
      $this->arity = 'execution';
      return $this;
    }

    return $expression;
  }

  public function led_period($parser, $left) {
    $this->first = $left;
    if ($parser->token->arity != 'name') {
      throw new Exception('Expected a property name');
    }
    $parser->token->arity = 'literal';
    $this->second = $parser->token;
    $this->arity ='binary';
    $parser->advance();
    return $this;
  }

  public function led_questionmark($parser, $left) {
    $this->first = $left;
    $this->second = $parser->expression();
    $parser->advance(':');
    $this->third = $parser->expression();
    $this->arity = 'ternary';
    return $this;
  }

  public function nud_this($parser) {
    $parser->scope->reserve($this);
    $this->arity = 'this';
    return $this;
  }

  public function std_try($parser) {
    $this->first = $this->block($parser);

    if ($parser->peek('catch')) {
      $parser->advance('catch');
      $catch = $parser->new_symbol('catch');
      $parser->advance('(');
      $catch->first = $parser->expression();
      $parser->advance(')');
      $catch->second = $this->block($parser);

      $this->second = $catch;

      if ($parser->peek('finally')) {
        $parser->advance('finally');
        $this->third = $this->block($parser);
      }
    }

    $this->arity = 'statement';

    return $this;
  }

  public function std_return($parser) {
    if (!$parser->peek("\n") && !$parser->peek(';')) {
      $this->first = $parser->expression();
    }
    if ($parser->peek(';')) {
      $parser->advance(';');
    }
    if (!$parser->peek('}')) {
      throw new Exception('Unreachable statement');
    }
    $this->arity = 'statement';
    return $this;
  }

  public function std_switch($parser) {
    // switch statements can have multiple
    // levels of passthrough and expressions
    // need to be aggregated for each current
    // case statement until a break is reached
    $branches = array();

    $parser->advance('(');
    $this->first = $parser->expression();
    $parser->advance(')');
    $parser->advance('{');
    $this->second = array();

    $cases = array();
    while (1) {
      if ($parser->peek('}')) {
        break;
      }

      if ($parser->peek('default')) {
        $switch = 'default';
        $parser->advance('default');
      }
      else {
        $parser->advance('case');
        $switch = 'case';
        if ($parser->token->arity != 'literal') {
          throw new Exception('Invalid case attribute in a switch statement');
        }
        $cases[] = $parser->token->value;
        $parser->advance();
      }

      $parser->advance(':');
      $statements = $parser->statements(array('break', 'case', '}'));

      if ($switch == 'default') {
        $default = $parser->new_symbol('default');
        $default->first = $statements;
        if (!empty($cases)) {
          $default->cases = array_values($cases);
        }
        $this->third = $default;
      }
      elseif ($switch == 'case' && !empty($statements)) {
        $case = $parser->new_symbol('case');
        $case->first = $statements;
        $case->cases = array_values($cases);
        $this->second[] = $case;
      }

      if ($parser->peek('break')) {
        $cases = array();

        $parser->advance();
        if ($parser->peek(';')) {
          $parser->advance(';');
        }
      }
    }

    $parser->advance('}');
    $this->arity = 'statement';

    return $this;
  }

  public function std_var($parser) {
    $assignments = array();
    while (1) {
      $token = $parser->token;
      if ($token->arity != 'name') {
        throw new Exception('Expected a new variable name');
      }
      $parser->scope->define($token);
      $parser->advance();
      if ($parser->peek('=')) {
        $t = $parser->token;
        $parser->advance('=');
        $t->first = $token;
        $t->second = $parser->expression();
        $parser->scope->assignment($t->first, $t->second);
        $t->arity = 'binary';
        $assignments[] = $t;
      }
      else {
        $t = $parser->new_symbol('=');
        $t->first = $token;
        $t->seoncd = NULL;
        $assignments[] = $t;
      }
      if (!$parser->peek(',')) {
        break;
      }
      $parser->advance(',');
    }
    if ($parser->peek(';')) {
      $parser->advance(';');
    }
    return $assignments;
  }

  public function std_while($parser) {
    $parser->advance('(');
    $this->first = $parser->expression();
    $parser->advance(')');
    if ($parser->peek('{')) {
      $this->second = $this->block($parser);
    }
    else {
      $this->second = $parser->expression();
    }
    $this->arity = 'statement';
    return $this;
  }
}
<?php

require_once('Parser.php');
require_once('JavaScriptSymbol.php');

class JavaScriptParser extends Parser {
  protected $language = 'javascript';
  protected $symbol_class = JavaScriptSymbol;

  protected function build() {
    $this->symbol(':');
    $this->symbol(';');
    $this->symbol("\n");
    $this->symbol(',');
    $this->symbol(')');
    $this->symbol(']');
    $this->symbol('}');
    $this->symbol('else');
    $this->symbol('case');
    $this->symbol('default');
    $this->symbol('catch');
    $this->symbol('finally');

    $this->symbol('(end)');
    $this->symbol('(name)');

    $this->infix('+', 50);
    $this->infix('-', 50);
    $this->infix('*', 60);
    $this->infix('/', 60);

    $this->infix('in', 40);
    $this->infix('==', 40);
    $this->infix('!=', 40);
    $this->infix('===', 40);
    $this->infix('!==', 40);
    $this->infix('<', 40);
    $this->infix('<=', 40);
    $this->infix('>', 40);
    $this->infix('>=', 40);

    $this->infix('?', 20, 'led_questionmark');
    $this->infix('.', 80, 'led_period');
    $this->infix('[', 80, 'led_bracket');

    $this->infixr('&&', 30);
    $this->infixr('||', 30);

    $this->prefix('-');
    $this->prefix('!');
    $this->prefix('typeof');

    $symbol = $this->symbol('++');
    $symbol->lbp = 'lbp_crement';
    $symbol->led = 'led_crement';
    $symbol->nud = 'nud_crement';
    $symbol = $this->symbol('--');
    $symbol->lbp = 'lbp_crement';
    $symbol->led = 'led_crement';
    $symbol->nud = 'nud_crement';

    $this->assignment('=');
    $this->assignment('+=');
    $this->assignment('-=');

    $this->constant('true', TRUE);
    $this->constant('false', FALSE);
    $this->constant('null', NULL);
    $this->constant('undefined', NULL);
    $this->constant('pi', pi());

    $this->symbol('(literal)')->nud = 'nud_itself';

    $this->stmt('{', 'std_curly');
    $this->stmt('var', 'std_var');
    $this->stmt('while', 'std_while');
    $this->stmt('for', 'std_for');
    $this->stmt('if', 'std_if');
    $this->stmt('switch', 'std_switch');
    $this->stmt('try', 'std_try');
    $this->stmt('break', 'std_break');
    $this->stmt('return', 'std_return');
    $this->stmt('function', 'std_function');
    $this->prefix('function', 'nud_function');

    $this->infix('(', 80, 'led_parenthesis')->nud = 'nud_parenthesis';

    $symbol = $this->symbol('this');
    $symbol->nud = 'nud_this';

    $this->prefix('[', 'nud_angled');
    $this->prefix('{', 'nud_curly');
  }
}
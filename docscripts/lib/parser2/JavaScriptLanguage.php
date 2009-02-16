<?php

class JavaScriptLanguage {
  public static function new_token($type, $value, $line_number, $char_pos) {
    return array('type' => $type, 'value' => $value, 'line_number' => $line_number, 'char_pos' => $char_pos);
  }

  public static function tokenize($lines) {
    $lines = str_replace("\r", '', $lines);
    $tokens = array();

    $line_number = 1;
    $char_pos = 0;
    $positions = array();
    for ($i = 0; $i < strlen($lines); $i++) {
      $char = $lines{$i};

      $positions[$i] = array($line_number, ++$char_pos);

      if ($char == "\n") {
        ++$line_number;
        $char_pos = 0;
      }
    }

    for ($i = 0; $i < strlen($lines); $i++) {
      $char = $lines{$i};

      list($line_number, $char_pos) = $positions[$i];

      if (count($tokens)) {
        $pop = &$tokens[count($tokens) - 1];
      }
      else {
        $pop = array('type' => '', 'value' => '');
      }

      $last_expression = array('type' => '', 'value' => '');
      // The last expression might be behind a comment
      // This is needed for stuff like regex
      for ($j = count($tokens) - 1; $j >= 0; $j--) {
        if ($tokens[$j]['type'] != 'comment') {
          $last_expression = $tokens[$j];
          break;
        }
      }

      if ($char == ' ' || $char == "\t") {
        $pop['terminated'] = true;
        continue;
      }

      switch($char){
      case "\n":
      case ';':
      case ':':
      case ',':
      case '(':
      case ')':
      case '[':
      case ']':
      case '{':
      case '}':
      case '!':
      case '?':
      case '-':
      case '*':
      case '%':
      case '<':
      case '>':
        $tokens[] = self::new_token('operator', $char, $line_number, $char_pos);
        break;
      case '.':
        if ($pop['type'] == 'number') {
          $pop['value'] .= $char;
        }
        else {
          $tokens[] = self::new_token('operator', $char, $line_number, $char_pos);
        }
        break;
      case '+':
        if ($pop['value'] == '+') {
          $pop['value'] = '++';
        }
        elseif ($pop['value'] == '-') {
          $pop['value'] = '--';
        }
        else {
          $tokens[] = self::new_token('operator', $char, $line_number, $char_pos);
        }
        break;
      case '=':
        if (substr($pop['value'], -1) == '=') {
          $pop['value'] .= $char;
        }
        elseif (in_array($pop['value'], array('<', '>', '!', '+', '-', '/', '*', '%'))) {
          $pop['value'] .= $char;
        }
        else {
          $tokens[] = self::new_token('operator', $char, $line_number, $char_pos);
        }
        break;
      case '&':
      case '|':
        if ($pop['value'] == $char) {
          $pop['value'] .= $char;
        }
        else {
          $tokens[] = self::new_token('operator', $char, $line_number, $char_pos);
        }
        break;
      case "'":
      case '"':
        $string = '';
        $last = '';
        for(++$i; $i < strlen($lines); $i++){
          $letter = $lines{$i};
          if ($last == '\\') {
            $string .= $letter;
            if ($letter == '\\') {
              // Double backslash
              $last = '';
              continue;
            }
          }
          elseif ($letter != $char) {
            $string .= $letter;
          }
          else {
            break;
          }
          $last = $char;
        }
        $tokens[] = self::new_token('string', str_replace("\\$char", $char, $string), $line_number, $char_pos);
        break;
      case '/':
        // Single-line comment, multi-line comment, regular expression, or just a division sign
        $content = $char;
        $instruction = NULL;
        $single = FALSE;
        $multi = FALSE;
        $last = '';
        for ($j = $i + 1; $j < strlen($lines); $j++) {
          $letter = $lines{$j};
          if ($single) {
            if ($letter == "\n") {
              $instruction = 'comment';
              $i = $j - 1;
              break;
            }
          }
          elseif ($multi) {
            if ($letter == '/' && $last == '*') {
              $content .= $letter;
              $instruction = 'comment';
              $i = $j;
              break;
            }
          }
          elseif (!$last && $letter == '/') {
            $single = TRUE;
          }
          elseif (!$last && $letter == '*') {
            $multi = TRUE;
          }
          elseif (!$last) {
            // If it's not a comment, it might be a regex
            // which can only occur after certain operators
            if ($last_expression['type'] != 'operator') {
              $content = '/';
              $instruction = 'operator';
              break;
            }
            // A regex is only valid after a few characters
            else if (!in_array($last_expression['value']{strlen($last_expression['value']) - 1},
                array('=', '(', ',', ':', ';', '[', '!', '?', "\n"))) {
              $content = '/';
              $instruction = 'operator';
              break;
            }
          }
          elseif ($letter == '/') {
            // When the regex ends, we need to look for modifiers
            if ($last != '\\') {
              $content .= $letter;
              $instruction = 'regex';
              $i = $j;
              for ($k = $j + 1; $k < strlen($lines); $k++) {
                $modifier = $lines{$k};
                if ($modifier == ' ' || $modifier == "\t") {
                  continue;
                }
                elseif(in_array($modifier, array('i', 'm', 'g'))) {
                  $i = $k;
                  $content .= $modifier;
                }
                else {
                  break;
                }
              }
              break;
            }
          }
          elseif ($letter == "\n") {
            // End of the expression with no regex terminator
            // So it's a division sign
            $content = '/';
            $instruction = 'operator';
            break;
          }

          $content .= $letter;
          $last = $letter;
        }

        $tokens[] = self::new_token($instruction, $content, $line_number, $char_pos);
        break;
      default:
        if (is_numeric($char)) {
          if ($pop['value'] == '.') {
            $pop['type'] = 'number';
            $pop['value'] .= $char;
          }
          elseif ($pop['type'] == 'number') {
            $pop['value'] .= $char;
          }
          else {
            $tokens[] = self::new_token('number', $char, $line_number, $char_pos);
          }
        }
        else {
          if (!$pop['terminated'] && $pop['type'] == 'name') {
            $pop['value'] .= $char;
          }
          elseif ($pop['type'] == 'number' && strtolower(substr($pop['value'], 0, 2)) == '0x' && stripos('1234567890abcdef', $char) !== false) {
            // Hex
            $pop['value'] .= $char;
          }
          elseif (strtolower($char) == 'x' && $pop['value'] == '0') {
            // Hex
            $pop['value'] .= $char;
          }
          elseif (strtolower($char) == 'e' && $pop['type'] == 'number') {
            // e-notation
            $pop['value'] .= $char;
          }
          else {
            $tokens[] = self::new_token('name', $char, $line_number, $char_pos);
          }
        }
      }
    }

    return $tokens;
  }
}
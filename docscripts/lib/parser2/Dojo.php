<?php

require_once('JavaScriptStatements.php');
require_once('JavaScriptFunction.php');
require_once('DojoCommentBlock.php');

class Dojo {
  public static $block_keys = array('summary', 'description', 'returns', 'tags', 'exceptions');

  public static function property_text(&$text, &$on) {
    if (preg_match('%^\s*([a-z\s]+)\]\s*%', $text, $match)) {
      $on['tags'] = preg_split('%\s+%', $match[1]);
      $text = trim(substr($text, strlen($match[0])));
    }

    if (preg_match('%\s%', $text)) {
      list($type, $summary) = preg_split('%\s+%', $text, 2);
    }
    else {
      $type = $text;
      $summary = '';
    }

    if(strpos($type, '?')){
      $type = str_replace('?', '', $type);
      $on['optional'] = true;
    }
    if(strpos($type, '...')){
      $type = str_replace('...', '', $type);
      $on['repeating'] = true;
    }

    $type = trim($type);
    $summary = trim($summary);

    if (!empty($on['type']) && $type != $on['type']) {
      $summary = trim("$type $summary");
    }
    elseif (!empty($type) && (empty($on['type']) || $type != 'Object')) {
      $on['type'] = $type;
    }

    if (!empty($summary)) {
      $on['summary'] = self::format_summary($summary);
    }
  }

  private static function roll_out_object($object, $name, &$output, $on_prototype=NULL) {
    foreach ($object->values() as $key => $values) {
      foreach ($values as $value) {
        self::roll_out($value, "$name.$key", $output);
        if ($on_prototype) {
          $output["$name.$key"]['prototype'] = $on_prototype;
        }
      }
    }
  }

  private static function set_type($object, &$on) {
    if (empty($on['type']) && ($type = $object->type()) && $type != 'null') {
      if ($type == 'variable') {
        $on['alias'] = $object->value();
      }
      elseif (empty($on['inferred_type']) || $type != 'Object') {
        $on['inferred_type'] = $type;
      }
    }
  }

  public static function roll_out($object, $name, &$output, $is_prototype=FALSE) {
    if (empty($output[$name])) {
      $output[$name] = array();
    }

    self::set_type($object, $output[$name]);

    $keys = self::$block_keys;

    if ($object instanceof JavaScriptObject || $object instanceof JavaScriptFunction) {
      $comments = new DojoCommentBlock($object->comments(), $keys, array('example'));

      if ($object instanceof JavaScriptObject) {
        self::roll_out_object($object, $name, $output, $is_prototype ? $name : NULL);
      }
      elseif ($object instanceof JavaScriptFunction) {
        $body = new JavaScriptStatements($object->body());

        // TODO: Instance variables
        // TODO: Look for non-global assignments within $body starting with 'this'
        // TODO: Look for mixins on the same sort of values
        foreach ($object->parameters() as $parameter) {
          $comments->add_key($parameter->name);

          $output[$name]['parameters'][$parameter->name]['name'] = $parameter->name;

          $type = '';
          if (!empty($parameter->comments)) {
            $type = preg_replace('%(^/\*\s*|\s*\*/$)%', '', $parameter->comments[0]);
          }

          self::property_text($type, $output[$name]['parameters'][$parameter->name]);
        }

        if ($body->function_calls(TRUE, 'dojo.deprecated')) {
          $output[$name]['deprecated'] = TRUE;
        }

        $returns = empty($output[$name]['returns']) ? array() : explode('|', $output[$name]['returns']);
        foreach ($body->prefix('return') as $return) {
          if (($pos = strrpos($return->line, '//')) !== false) {
            $returns = array_merge($returns, preg_split('%\s*\|\s*%', trim(substr($return->line, $pos + 2))));
          }
        }
        if (!empty($returns)) {
          $output[$name]['returns'] = implode('|', array_unique($returns));
        }
      }

      foreach ($comments->all() as $key => $text) {
        if ($key == 'example') {
          $output[$name]['examples'] = $text;
        }
        elseif ($key == 'tags') {
          $output[$name]['tags'] = preg_split('%\s+%', trim($text));
        }
        elseif ($key == 'returns') {
          $output[$name]['return_summary'] = $text;
        }
        elseif (in_array($key, $keys)) {
          $output[$name][$key] = ($key == 'summary') ? self::format_summary($text) : $text;
        }
        elseif (!empty($output[$name]['parameters']) && array_key_exists($key, $output[$name]['parameters'])) {
          self::property_text($text, $output[$name]['parameters'][$key]);
        }
      }      
    }
  }

  private static function format_summary($summary) {
    return preg_replace('%`([^`]+)`%', '<code>$1</code>', htmlentities($summary));
  }
}
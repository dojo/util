<?php

require_once('Serializer.php');

class JsonSerializer extends Serializer
{
  protected $header = array('{');
  protected $footer = array('}');

  protected function lineStarts($line) {
    if (preg_match('%^\t"([\w_.$]+)":\s+{$%', $line, $match)) {
      return $match[1];
    }
  }

  protected function lineEnds($line) {
    if (preg_match('%^\t},$%', $line, $match)) {
      return true;
    }
  }

  protected function linesToRaw($lines) {
    $lines[0] = '{';
    $lines[count($lines)-1] = '}';
    return json_decode(implode("\n", $lines));
  }

  public function toObject($raw, $id=null) {
    return $raw;
  }

  public function toString($raw, $id=null) {
    if (!$id) {
      if (!($id = $raw['id'])) {
        throw new Exception('toString must be passed an ID or raw object must contain and ID');
      }
    }

    $tab = "\t";
    $new_json = "\"$id\": ";
    $indent_level = 0;
    $in_string = false;

    $json = json_encode($raw);
    $len = strlen($json);

    for ($c = 0; $c < $len; $c++) {
      $char = $json{$c};
      switch($char) {
      case '{':
      case '[':
        if (!$in_string) {
          $new_json .= $char . "\n" . str_repeat($tab, ++$indent_level);
        }
        else {
          $new_json .= $char;
        }
        break;
      case '}':
      case ']':
        if(!$in_string) {
          $new_json .= "\n" . str_repeat($tab, --$indent_level) . $char;
        }
        else {
          $new_json .= $char;
        }
        break;
      case ',':
        if (!$in_string) {
          $new_json .= ",\n" . str_repeat($tab, $indent_level);
        }
        else {
          $new_json .= $char;
        }
        break;
      case ':':
        if (!$in_string) {
          $new_json .= ": ";
        }
        else {
          $new_json .= $char;
        }
        break;
      case '"':
        if($c > 0 && $json[$c-1] != '\\') {
          $in_string = !$in_string;
        }
      default:
        $new_json .= $char;
        break;
      }
    }

    return $new_json . ',';
  }

  public function toRaw($object, $id=null) {
    return $object;
  }
}

?>
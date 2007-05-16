<?php

class Text
{
  /**
   * Blanks out a portion of a string with whitespace
   * 
   * @param $to_blank Portion of the string to be removed
   * @param $string Overall string to remove it from
   */
  public static function blankOut($to_blank, $string)
  {
    $length = strlen($to_blank);
    if (!$length) {
      return $string;
    }

    $blanks = array_fill(0, $length, ' ');
    return preg_replace('%' . preg_quote($to_blank, '%') . '%', implode($blanks), $string, 1);
  }
  
  public static function getNextPosition($array, $line_position_pair)
  {
    list($line_number, $position) = $line_position_pair;
    ++$position;
    if ($position >= strlen($array[$line_number])) {
      ++$line_number;
      $position = 0;
      while (!strlen($array[$line_number])) {
        ++$line_number;
      }
    }
    return array($line_number, $position);
  }
  
  public static function blankOutAt($to_blank, $start, $end = -1)
  {
    if($end == -1) {
      $end = strlen($to_blank) - 1;
    }
    $length = $end - $start + 1;
    if (!$length) {
      return $to_blank;
    }
    if ($length < 0) {
      print 'hi';
    }
    $blanks = array_fill(0, $length, ' ');
    return substr($to_blank, 0, $start) . implode($blanks) .  substr($to_blank, $end + 1);
  }
  
  public static function trim($string)
  {
    return trim(preg_replace('%(^\s*/\*.*\*/\s*?|\s*?/\*.*\*/\s*$|^\s*//.*\n\s*?|\s*?//.*$)%U', '', $string));
  }
  
  public static function chop($array, $start_line, $start_position, $end_line = false, $end_position = false, $exclusive = false)
  {
    if (!is_numeric($end_line)) {
      $end_line = end(array_keys($array));
    }
    if (!is_numeric($end_position)) {
      $end_position = strlen($array[$end_line]) - 1;
      if($end_position < 0){
        $end_position = 0;
      }
    }
    
    $lines = array_slice($array, $start_line, $end_line - $start_line + 1, true);
    if ($start_position > 0) {
      $lines[$start_line] = Text::blankOutAt($lines[$start_line], 0, $start_position - 1);
    }
    $lines[$end_line] = Text::blankOutAt($lines[$end_line], $end_position + 1, strlen($lines[$end_line]));
    if ($exclusive) {
      if ($lines[$start_line]{$start_position}) {
        $lines[$start_line]{$start_position} = ' ';
      }
      if ($lines[$end_line]{$end_position}) {
        $lines[$end_line]{$end_position} = ' ';
      }
    }
    
    return $lines;
  }
  
  /**
   * Always starts at the beginning. If you want a character to be ignored, it shouldn't be passed (see chop and blankOutAt)
   */
  public static function findTermination($source_array, $termination_characters, $enclosing_characters = '')
  {
    $characters = array();
    $terminators = array();
    foreach(self::toArray($termination_characters) as $character) { 
      $terminators[$character] = true;
    }
    foreach (self::toArray($enclosing_characters) as $index => $character) {
      $characters[$character] = ($index % 2) ? -1 : 1;
    }
    $all_characters = array_merge(array_keys($terminators), array_keys($characters));
    
    $balance = 0;
    
    foreach ($source_array as $line_number => $line) {
      $line = self::toArray($line);
      foreach (array_intersect($line, $all_characters) as $position => $character) {
        if (!$balance && $terminators[$character]) {
          return array($line_number, $position);
        }
        $balance += $characters[$character];
      }
    }
    
    return array($line_number, $position);
  }
  
  public static function toArray($string)
  {
    return array_slice(preg_split('%%', $string), 1, -1);
  }
  
  public static function findComments($line, $started = false)
  {
    if (empty($line) && !$started) {
      return array(false, false, false, false, false);
    }
    
    $first = array();
    $middle = array();
    $last = array();
    $data = false;
    $multiline = false;
    
    if ($started) {
      if (($pos = strpos($line, '*/')) !== false) {
        $first[] = trim(substr($line, 0, $pos));
        $line = substr($line, $pos + 2);
      }
      else {
        $multiline = true;
      }
    }

    $single_line = false;
    if (!$multiline) {
      $parts = preg_split('%(\s*(?://|/\*|\*/)\s*)%', $line, -1, PREG_SPLIT_DELIM_CAPTURE);
      foreach ($parts as $part) {
        if (!($part = trim($part))) continue;
        if ($multiline && $part == '*/') {
          $multiline = false;
        }
        elseif ($single_line || $multiline) {
          if (!$data) {
            $first[] = $part;
          }
          else {
            $last[] = $part;
          }
        }
        elseif ($part == '//') {
          $single_line = true;
        }
        elseif ($part == '/*') {
          $multiline = true;
        }
        else {
          $data = true;
          $middle = array_merge($middle, $last);
          $last = array();
        }
      }
    }

    return array(implode(' ', $first), implode(' ', $middle), implode(' ', $last), $data, $multiline);
  }
}

?>
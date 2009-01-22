<?php

abstract class Serializer
{
  protected $header = array(); // Array of lines to begin the file with
  protected $footer = array(); // Array of lines to end the file with
  protected $indent = "\t";
  private $file_location;

  private $file;
  private $length = 9999;

  // Deal with line parsing
  abstract protected function lineStarts($line); // Returns the ID of the block that this line starts
  abstract protected function lineEnds($line); // Return true if this line closes a block
  abstract protected function linesToRaw($lines); // Convert an array of lines to a raw output

  // Deal with object conversion
  abstract public function toObject($raw, $id=null); // Convert raw output to an object
  abstract public function toString($raw, $id=null); // Convert raw output to a string for serialization
  abstract public function toRaw($object, $id=null); // Convert an object to a raw value

  // Public stuff
  public function __construct($directory, $suffix, $filename='api') {
    $this->file_location = $directory . '/' . $filename . '.' . $suffix;
    touch($this->file_location);
    $this->file = fopen($this->file_location, 'r');
  }

  public function __destruct() {
    fclose($this->file);
  }

  public function ids() {
    $ids = array();
    $started = false;

    rewind($this->file);
    while (!feof($this->file)) {
      $line = stream_get_line($this->file, $this->length, "\n");
      if ($started && $this->lineEnds($line)) {
        $started = false;
        continue;
      }
      elseif ($id = $this->lineStarts($line)) {
        $started = true;
        $ids[] = $id;
      }
    }

    return $ids;
  }

  private function getString($id) {
    $lines = array();
    $started = false;
    $strlen = strlen($this->indent);

    rewind($this->file);
    while (!feof($this->file)) {
      $line = stream_get_line($this->file, $this->length, "\n");
      if ($started) {
        $lines[] = substr($line, $strlen);
        if ($this->lineEnds($line)) {
          return implode("\n", $lines);
        }
      }
      elseif ($this->lineStarts($line) == $id) {
        $started = true;
        $lines[] = substr($line, $strlen);
      }
    }
  }

  public function setObject($id, $value) {
    $raw = $this->toRaw($value, $id);
    $this->set($id, $raw);
    return $raw;
  }

  public function set($id, $value) {
    if (!$id) {
      debug_print_backtrace();
      die("Called set without an ID\n");
    }

    $tostring = $this->toString($value, $id);
    if ($tostring == $this->getString($id)) {
      return;
    }

    $lines = array();
    $started = false;
    $finished = false;
    $header = false;
    $buffer = array();

    $tmp = fopen($this->file_location . '_tmp', 'w');
    foreach ($this->header as $header_line) {
      fwrite($tmp, $header_line . "\n");
    }

    rewind($this->file);
    while (!feof($this->file)) {
      $line = stream_get_line($this->file, $this->length, "\n");
      if (!trim($line)) {
        continue;
      }

      if ($started) {
        $lines[] = $line;
        if ($this->lineEnds($line)) {
          $lines = explode("\n", $tostring);
          foreach ($lines as $line) {
            fwrite($tmp, $this->indent . $line . "\n");
          }
          $started = false;
          $finished = true;
        }
      }
      elseif (!$finished && $this->lineStarts($line) == $id) {
        $started = true;
        $lines[] = $line;
      }
      else {        
        // Search through non-block data for headers first, then footers
        if (!isset($searching)) {
          $searching = $this->header;
        }

        $buffer[] = $line;
        if (count($buffer) == count($searching) && count(array_intersect($buffer, $searching)) == count($searching)) {
          // Successful match
          if ($searching === $this->header) {
            $buffer = array();
            $searching = $this->footer;
          }
          else {
            // Break before the footer is added
            break;
          }
        }
        elseif(count($buffer) > count($searching)) {
          fwrite($tmp, array_shift($buffer) . "\n");
        }
      }
    }

    if (!$finished) {
      $lines = explode("\n", $this->toString($value, $id));
      foreach ($lines as $line) {
        fwrite($tmp, $this->indent . $line . "\n");
      }
    }

    foreach ($this->footer as $footer_line) {
      fwrite($tmp, $footer_line . "\n");
    }

    fclose($tmp);
    fclose($this->file);

    unlink($this->file_location);
    rename($this->file_location . '_tmp', $this->file_location);
    $this->file = fopen($this->file_location, 'r');
  }
}
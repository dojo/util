<?php

require_once('Serializer.php');

class XmlSerializer extends Serializer
{
  protected $header = array('<?xml version="1.0" encoding="UTF-8"?>', '<javascript>');
  protected $footer = array('</javascript>');

  protected function lineStarts($line) {
    if (preg_match('%^\t<[^>]+location="([\w_.$]+)"%', $line, $match)) {
      return $match[1];
    }
  }

  protected function lineEnds($line) {
    if (preg_match('%^\t</object>,$%', $line, $match)) {
      return true;
    }
  }

  protected function linesToRaw($lines) {
    return DOMDocument::loadXML(implode("\n", $lines));
  }

  public function toObject($raw, $id=null) {
    // Might use this later
    return array();
  }

  public function toString($raw, $id=null) {
    if (!$id) {
      if (!($id = $raw->firstChild->getAttribute('location'))) {
        throw new Exception('toString must be passed an ID or raw object must contain and ID');
      }
    }

    $lines = explode("\n", str_replace('<?xml version="1.0" encoding="UTF-8"?>' . "\n", '', $raw->saveXML()));
    foreach ($lines as $i => $line) {
      $indent = 0;
      while (substr($line, 0, 2) == '  ') {
        ++$indent;
        $line = substr($line, 2);
      }
      $lines[$i] = str_repeat("\t", $indent) . $line;
    }
    return implode("\n", $lines);
  }

  public function toRaw($object, $id=null) {
    if (!$id) {
      throw new Exception('toRaw in the XmlSerializer must be passed an ID value');
    }

    $document = new DOMDocument('1.0', 'UTF-8');
    $document->preserveWhiteSpace = true;
    $document->formatOutput = true;

    $object_node = $document->appendChild($document->createElement('object'));
    $object_node->setAttribute('location', $id);

    $methods_node = null;
    if ($object['type'] == 'Function') {
      $methods_node = $document->createElement('methods');
      $method_node = $methods_node->appendChild($document->createElement('method'));
      $method_node->setAttribute('constructor', 'constructor');

      $object_node->setAttribute('type', 'Function');
      if ($object['classlike']) {
        $object_node->setAttribute('classlike', 'true');
        if (!empty($object['chains']['prototype'])) {
          $superclass = array_shift($object['chains']['prototype']);
          $object_node->setAttribute('superclass', $superclass);
          if (!empty($object['chains']['call']) && in_array($superclass, $object['chains']['call'])) {
            $object['chains']['call'] = array_diff($object['chains']['call'], array($superclass));
            $method_node->setAttribute('super', 'true');
          }
        }
      }
    }
    elseif ($object['type'] != 'Object') {
      $object_node->setAttribute('type', $object['type']);
    }

    if (trim($object['summary'])) {
      $description_node = $object_node->appendChild($document->createElement('description'));
      $description_node->appendChild($document->createTextNode($object['summary']));
    }

    if (!empty($object['example'])) {
      $example_node = $object_node->appendChild($document->createElement('example'));
      $example_node->appendChild($document->createTextNode($object['example']));
    }

    $mixins = array();
    if (!empty($object['chains']['prototype'])) {
      foreach ($object['chains']['prototype'] as $mixin) {
        // Classes are assumed here
        $mixins['prototype']['prototype'][] = $mixin;
      }
    }
    if (!empty($object['mixins']['prototype'])) {
      foreach ($object['mixins']['prototype'] as $mixin) {
        if (strlen($mixin) > 10 && substr($mixin, -10) == '.prototype') {
          $mixins['prototype']['prototype'][] = substr($mixin, 0, -10);
        }
        else {
          $mixins['prototype']['normal'][] = $mixin;
        }
      }
    }
    if (!empty($object['chains']['call'])) {
      foreach ($object['chains']['call'] as $mixin) {
        $mixins['prototype']['instance'][] = $mixin;
      }
    }
    if (!empty($object['mixins']['normal'])) {
      foreach ($object['mixins']['normal'] as $mixin) {
        if (strlen($mixin) > 10 && substr($mixin, -10) == '.prototype') {
          $mixins['normal']['prototype'][] = substr($mixin, 0, -10);
        }
        else {
          $mixins['normal']['normal'][] = $mixin;
        }
      }
    }

    foreach ($mixins as $scope => $mixins) {
      $mixins_node = $object_node->appendChild($document->createElement('mixins'));
      $mixins_node->setAttribute('scope', $scope);
      foreach ($mixins as $scope => $mixins) {
        foreach (array_unique($mixins) as $mixin) {
          $mixin_node = $mixins_node->appendChild($document->createElement('mixin'));
          $mixin_node->setAttribute('scope', ($scope == 'normal') ? '' : $scope);
          $mixin_node->setAttribute('location', $mixin);
        }
      }
    }

    $methods = array();
    $properties = array();
    if (!empty($object['#children'])) {
      foreach ($object['#children'] as $child_id => $child) {
        if ($child['type'] == 'Function') {
          $methods[$child_id] = $child;
        }
        else {
          $properties[$child_id] = $child;
        }
      }
    }

    if (!empty($properties)) {
      $properties_node = $object_node->appendChild($document->createElement('properties'));
      foreach ($properties as $property_id => $property) {
        $property_node = $properties_node->appendChild($document->createElement('property'));

        $property_node->setAttribute('name', $property_id);

        if ($property['instance'] && $property['prototype']) {
          $property_node->setAttribute('scope', 'instance-prototype');
        }
        elseif($property['instance']) {
          $property_node->setAttribute('scope', 'instance');
        }
        elseif($property['prototype']) {
          $property_node->setAttribute('scope', 'prototype');
        }
        else {
          $property_node->setAttribute('scope', '');
        }

        $property_node->setAttribute('type', $property['type']);

        if ($property['summary']) {
          $description_node = $property_node->appendChild($document->createElement('description'));
          $description_node->appendChild($document->createTextNode($property['summary']));
        }
      }
    }

    if (!empty($methods)) {
      if (!$methods_node) {
        $methods_node = $document->createElement('methods');
      }
      $object_node->appendChild($methods_node);

      foreach ($methods as $method_id => $method) {
        $method_node = $methods_node->appendChild($document->createElement('method'));
        $method_node->setAttribute('name', $method_id);

        if ($method_id == 'preamble' || $method_id == 'postscript') {
          $method_node->setAttribute('constructor', $method_id);
        }

        if ($method['instance'] && $method['prototype']) {
          $method_node->setAttribute('scope', 'instance-prototype');
        }
        elseif($method['instance']) {
          $method_node->setAttribute('scope', 'instance');
        }
        elseif($method['prototype']) {
          $method_node->setAttribute('scope', 'prototype');
        }
        else {
          $method_node->setAttribute('scope', '');
        }

        if (trim($method['summary'])) {
          $description_node = $method_node->appendChild($document->createElement('description'));
          $description_node->appendChild($document->createTextNode($method['summary']));
        }

        if (trim($method['return_summary'])) {
          $description_node = $method_node->appendChild($document->createElement('return-description'));
          $description_node->appendChild($document->createTextNode($method['return_summary']));
        }

        if (!empty($method['parameters'])) {
          $parameters_node = $method_node->appendChild($document->createElement('parameters'));
          foreach ($method['parameters'] as $parameter_name => $parameter) {
            $parameter_node = $parameters_node->appendChild($document->createElement('parameter'));
            $parameter_node->setAttribute('name', $parameter_name);
            $parameter_node->setAttribute('type', $parameter['type']);
            $parameter_node->setAttribute('usage', ($parameter['optional']) ? 'optional' : (($parameter['repeating']) ? 'one-or-more' : 'required'));
            if ($parameter['summary']) {
              $description_node = $parameter_node->appendChild($document->createElement("description"));
              $description_node->appendChild($document->createTextNode($parameter['summary']));
            }
          }
        }

        if (!empty($method['returns'])) {
          $returns_node = $method_node->appendChild($document->createElement('return-types'));
          foreach ($method['returns'] as $return) {
            $return_node = $returns_node->appendChild($document->createElement('return-type'));
            $return_node->setAttribute('type', $return);
          }
        }

        if (!empty($method['example'])) {
          $example_node = $method_node->appendChild($document->createElement('example'));
          $example_node->appendChild($document->createTextNode($method['example']));
        }
      }
    }

    return $document;
  }
}

?>
<?php

# php generate.php
# -- Runs everything in the modules directory
# php generate.php custom
# -- Runs only the module starting with "custom"
# php generate.php dijit dojo
# -- Runs both dijit and dojo modules

if ($_SERVER['HTTP_HOST']) {
  die('Run from command line');
}

$debug = true;

require_once('includes/dojo.inc');
require_once('lib/generator/JsonSerializer.php');
require_once('lib/generator/XmlSerializer.php');
require_once('lib/generator/Freezer.php');

$keys = array();
$namespaces = array();

// Do this in 3 parts
// 1. Turn all variables into single objects
// 2. Internalize class members
// 3. Serialize objects

$files = dojo_get_files(array_slice($argv, 1));
$nodes = new Freezer('cache', 'nodes');
$resources = new Freezer('cache', 'resources');

foreach ($files as $set){
  list($namespace, $file) = $set;
  if (!$namespaces[$namespace]) {
    $namespaces[$namespace] = true;
  }

  $ctime = dojo_get_file_time($namespace, $file);
  if ($ctime == $resources->open($namespace . '%' . $file, null)) {
    continue;
  }

  print "$namespace/$file\t\t" . memory_get_usage() . "\n";
  flush();

  $contents = dojo_get_contents($namespace, $file);

  $provides = $contents['#provides'];
  unset($contents['#provides']);
  $resource = $contents['#resource'];
  unset($contents['#resource']);
  $requires = $contents['#requires'];
  unset($contents['#requires']);

  foreach ($contents as $var => $content) {
    foreach ($content as $key_key => $key_value) {
      $key_type = 'undefined';
      if (is_numeric($key_value)) {
        $key_type = 'numeric';
      }elseif(is_array($key_value)) {
        $key_type = 'array';
      }elseif(is_bool($key_value)) {
        $key_type = 'bool';
      }elseif(is_string($key_value)) {
        $key_type = 'string';
      }
      $keys[$key_key][] = $key_type;
      $keys[$key_key] = array_unique($keys[$key_key]);
    }

    $node = $nodes->open($var, array());

    $new = !empty($node);

    // Handle file-level information
    if (!is_array($node['#provides']) || !in_array($provides, $node['#provides'])) {
      $node['#provides'][] = $provides;
    }

    $node['#resource'][] = $resource;

    if (trim($content['type'])) {
      $node['type'] = $content['type'];
    }

    if (trim($content['summary'])) {
      $node['summary'] = $content['summary'];
    }

    if (trim($content['description'])) {
      $node['description'] = $content['description'];
    }

    if (trim($content['exceptions'])) {
      $node['exceptions'] = $content['exceptions'];
    }

    if ($content['private']) {
      $node['private'] = $content['private'];
    }

    if ($content['private_parent']) {
      $node['private_parent'] = $content['private_parent'];
    }

    if (is_array($content['aliases'])) {
      foreach ($content['aliases'] as $alias) {
        if (!is_array($node['aliases']) || !in_array($alias, $node['aliases'])) {
          $node['aliases'][] = $alias;
        }
      }
    }

    if (is_array($content['examples'])) {
      foreach ($content['examples'] as $example) {
        if (!is_array($node['examples']) || !in_array($example, $node['examples'])) {
          $node['examples'][] = $example;
        }
      }
    }

    if ($content['instance']) {
      $node['instance'] = $content['instance'];
    }
    
    if ($content['prototype']) {
      $node['prototype'] = $content['prototype'];
    }

    if (!empty($content['examples'])) {
      $node['example'] = $content['examples'][0];
    }

    if (!is_array($node['returns'])) {
      $node['returns'] = array();
    }
    if (trim($content['returns'])) {
      $node['returns'] = array_unique(array_merge($node['returns'], explode('|', $content['returns'])));
    }

    if (trim($content['return_summary'])) {
      $node['return_summary'] = $content['return_summary'];
    }

    foreach (array('prototype', 'normal') as $scope) {
      if (!empty($content['mixins'][$scope])) {
        if (empty($node['mixins'][$scope])) {
          $node['mixins'][$scope] = array();
        }
        $node['mixins'][$scope] = array_unique(array_merge($node['mixins'][$scope], $content['mixins'][$scope]));
      }
    }

    if ($content['type'] == 'Function') {
      if ($content['classlike']) {
        $node['classlike'] = true;
      }

      if ($node['chains']) {
        if (!$content['chains']['prototype']) {
          $content['chains']['prototype'] = array();
        }
        $node['chains']['prototype'] = array_unique(array_merge($node['chains']['prototype'], $content['chains']['prototype']));
        if (!$content['chains']['prototype']) {
          $content['chains']['prototype'] = array();
        }
        $node['chains']['call'] = array_unique(array_merge($node['chains']['call'], $content['chains']['prototype']));
      }
      else {
        $node['chains']['prototype'] = ($content['chains']['prototype']) ? $content['chains']['prototype'] : array();
        $node['chains']['call'] = ($content['chains']['call']) ? $content['chains']['call'] : array();
      }

      if ($content['chains']) {
        unset($content['chains']['prototype']);
        unset($content['chains']['call']);
        $types = array_keys($content['chains']);
        if (!empty($types)) {
          print_r($types);
          die();
        }
      }

      if (!empty($content['parameters'])) {
        if (!empty($node['parameters'])) {
          $node_parameters = array_keys($node['parameters']);
          $content_parameters = array_keys($content['parameters']);
          $long_parameters = (count($node_parameters) > count($content_parameters)) ? $node_parameters : $content_parameters;
          $short_parameters = (count($node_parameters) >  count($content_parameters)) ? $content_parameters : $node_parameters;

          $match = true;
          foreach ($long_parameters as $i => $parameter) {
            if ($i < count($short_parameters) && $parameter != $short_parameters[$i]) {
              $match = false;
            }
          }

          if ($match) {
            // Only process these if they match the first occurence
            foreach ($content['parameters'] as $parameter_name => $parameter) {
              if (empty($node['parameters'][$parameter_name]['type'])) {
                $node['parameters'][$parameter_name]['type'] = $parameter['type'];
              }
              if (trim($parameter['summary'])) {
                $node['parameters'][$parameter_name]['summary'] = $parameter['summary'];
              }
            }
          }
        }
        else {
          $node['parameters'] = $content['parameters'];
        }
      }
    }

    $nodes->save($var, $node);
  }

  $resources->save($namespace . '%' . $file, $ctime);

  // print_r($keys);
}

unset($resources);

$roots = array();
$nodes = new Freezer('cache', 'nodes');
$ids = $nodes->ids();
foreach ($ids as $id) {
  print "first: " . $id;
  flush();
  $parts = explode('.', $id);
  if (count($parts) > 1) {
    $name = array_pop($parts);
    $parent = implode('.', $parts);
    if (!array_key_exists($parent, $roots)) {
      $roots[$parent] = array();
    }

    $default = array();
    $node = $nodes->open($id, $default);
    if ($node['type'] == 'Function') {
      $roots[$id]['function'] = true;
    }
    if ($node['classlike']) {
      $roots[$id]['classlike'] = true;
    }
  }
}

// Figure out whether a root item has children or not
foreach ($roots as $id => $root) {
  print "second: " . $id;
  flush();
  if ($root['function'] && !$root['classlike']) {
    $has_children = false;
    $parts = explode('.', $id);
    if (count($parts) > 1) {
      foreach ($roots as $possible_child_id => $possible_child) {
        $child_parts = explode('.', $possible_child_id);
        if (count($child_parts) == count($parts)+1 && strpos($possible_child_id, "$id.") === 0) {
          $has_children = true;
          break;
        }
      }
      if (!$has_children) {
        unset($roots[$id]);
      }
    }
  }
}

// Aggregate and save
$json = new JsonSerializer('cache', 'json');
$xml = new XmlSerializer('cache', 'xml');
foreach ($roots as $id => $root) {
  if(!$id){
    // Minor bug
    continue;
  }

  print "save: " . $id;
  flush();

  $node = $nodes->open($id, null);

  $parts = explode('.', $id);
  foreach ($ids as $child_id) {
    $child_parts = explode('.', $child_id);
    if (count($child_parts) == count($parts)+1 && strpos($child_id, "$id.") === 0 && !array_key_exists($child_id, $roots)) {
      $node['#children'][array_pop($child_parts)] = $nodes->open($child_id, null);
    }
  }

  // JSON needs to be updated to match format
  // $json->setObject($id, $node);
  $xml->setObject($id, $node);
}

// * Assemble parent/child relationships

?>
<?php

require_once('lib/parser/Dojo.php');
require_once('lib/parser/DojoPackage.php');

function _dojo_get_namespaces(){
  static $namespaces;
  if (!isset($namespaces)) {
    $namespaces = array();
    $files = scandir('modules');
    foreach ($files as $file) {
      if (substr($file, -7) == '.module') {
        include_once('modules/' . $file);
        $namespaces[] = substr($file, 0, -7);
      }
    }
  }
  return $namespaces;
}

function dojo_get_file_time($namespace, $file) {
  return filectime(call_user_func($namespace . '_code_location') . $file);
}

function dojo_get_files() {
    $namespaces = _dojo_get_namespaces();
    $files = array();
    foreach ($namespaces as $namespace) {
        $location = call_user_func($namespace . '_code_location');
        if (!$location) die($namespace . '_code_location does not return useful result');
        $dojo = new Dojo($namespace, $location);
        $list = $dojo->getFileList();
        foreach ($list as $i => $item) {
            $list[$i] = array($namespace, $item);
        }
        $files = array_merge($files, $list);
    }

    return $files;
}

function dojo_get_conditions() {
    return array('svg', 'vml');
}

function dojo_get_environments() {
    return array(
        'common' => array(
            'browser' => true
        )
    );
}

function dojo_get_contents($namespace, $file_name) {
  $output = array();

  $package = new DojoPackage(new Dojo($namespace, call_user_func($namespace . '_code_location')), $file_name);

  $output['#provides'] = $package->getPackageName();
  $output['#resource'] = $package->getResourceName();

  $compound_calls = $package->getFunctionCalls('dojo.kwCompoundRequire');
  // Handle compound require calls
  foreach ($compound_calls as $call) {
    if ($call->getParameter(0)->isA(DojoObject)) {
      $object = $call->getParameter(0)->getObject();
      foreach ($object->getValues() as $key => $value) {
        if ($value->isA(DojoArray)) {
          foreach ($value->getArray()->getItems() as $item) {
            if ($item->isA(DojoString)) {
              $output['#requires'][] = array($key, $item->getString());
            }
            elseif ($item->isA(DojoArray)) {
              $item = $item->getArray();
              if ($item->getItem(0)->isA(DojoString)) {
                $output['#requires'][] = array($key, $item->getItem(0)->getString());
              }
            }
          }
        }
      }
    }
  }
	unset($compound_calls);
	unset($call);
	unset($object);
	unset($key);
	unset($value);
	unset($item);

  $require_calls = $package->getFunctionCalls('dojo.require');
  // Handle dojo.require calls
  foreach ($require_calls as $call) {
    $require = $call->getParameter(0);
    if ($require->isA(DojoString)) {
      $output['#requires'][] = array('common', $require->getString());
    }
  }
	unset($require_calls);
	unset($call);
	unset($require);

  $require_if_calls = array_merge($package->getFunctionCalls('dojo.requireIf'), $package->getFunctionCalls('dojo.requireAfterIf'));
  // Handle dojo.requireAfterIf calls
  foreach ($require_if_calls as $call) {
    $environment = $call->getParameter(0);
    $require = $call->getParameter(1);
    if ($environment && $require) {
      $environment = $environment->getValue();
      $require = $require->getValue();

			unset($env);
			unset($req);

      if ($require instanceof DojoString) {
				$req = $require->getValue();
      }
			if ($environment instanceof DojoString) {
        $env = $environment->getValue();
      }
      elseif ($environment instanceof DojoVariable) {
        $environment = $environment->getValue();
        if ($environment == "dojo.isBrowser") {
          $env = 'browser';
        }
        elseif ($environment == "dojo.render.svg.capable") {
          $env = 'svg';
        }
        elseif ($environment == "dojo.render.vml.capable") {
          $env = 'vml';
        }
        elseif (preg_match('%^dojox.gfx.render\s*=\s*"([a-z]+)"%', $environment, $match)) {
          $env = $match[1];
        }
      }
			if ($env && $req) {
				$output['#requires'][] = array($env, $req);
			}
    }
  }
	unset($require_if_calls);
	unset($call);
	unset($environment);
	unset($require);
	unset($env);
	unset($req);

  $declare_calls = array_merge($package->getFunctionCalls('dojo.declare'), $package->getFunctionCalls('dojo.widget.defineWidget'));
  // This closely matches dojo.widget.defineWidget as declared in src/widget/Widget.js
  foreach ($declare_calls as $call) {
    $init = null;
    if ($call->getName() == 'dojo.declare') {
      $args = array($call->getParameter(0), null, $call->getParameter(1), $call->getParameter(2), $call->getParameter(3));
      $name = $args[0]->getString();
      if ($args[3]->isA(DojoFunctionDeclare)) {
        $init = $args[3]->getFunction();
      }
            if ($args[3]->isA(DojoObject)) {
                $args[4] = $args[3];
                $args[3] = null;
            }
    }
    else {
      if ($call->getParameter(3)->isA(DojoString)) {
        $args = array($call->getParameter(0), $call->getParameter(3), $call->getParameter(1), $call->getParameter(4), $call->getParameter(2));
      }
      else {
        $args = array($call->getParameter(0));
        $p = 3;
        if ($call->getParameter(1)->isA(DojoString)) {
          array_push($args, $call->getParameter(1), $call->getParameter(2));
        }
        else {
          array_push($args, null, $call->getParameter(1));
          $p = 2;
        }
        if ($call->getParameter($p)->isA(DojoFunctionDeclare)) {
          $init = $call->getParameter($p)->getFunction();
          array_push($args, $call->getParameter($p), $call->getParameter($p + 1));
        }
        else {
          array_push($args, null, $call->getParameter($p));
        }
      }
    }

    $name = $args[0]->getString();
    $output[$name]['type'] = 'Function';

    // $args looks like (name, null, superclass(es), initializer, mixins)      
    if ($args[2]->isA(DojoVariable)) {
      $output[$name]['chains']['prototype'][] = $args[2]->getVariable();
      $output[$name]['chains']['call'][] = $args[2]->getVariable();
    }
    elseif ($args[2]->isA(DojoArray)) {
      $items = $args[2]->getArray()->getItems();
      foreach ($items as $item) {
        if ($item->isA(DojoString)) {
          $item = $item->getString();
          $output[$name]['chains']['prototype'][] = $item;
          $output[$name]['chains']['call'][] = $item;
        }
      }
    }

    if ($args[4]->isA(DojoObject)) {
      $object = $args[4]->getObject();
      $object->setName($name);
      $object->setAnonymous(true);
      $values = $object->getValues();
      foreach ($values as $key => $value) {
        $full_name = "$name.$key";
        if (($key == 'initializer' || $key == 'constructor') && $value->isA(DojoFunctionDeclare)) {
          $init = $value->getFunction();
          $init->setConstructor(true);
          continue;
        }
        if ($value->isA(DojoFunctionDeclare)) {
          $function = $value->getFunction($value);
          $function->setPrototype($name);
        }
        elseif (!$value->isA(DojoObject)) {
          $output[$full_name]['prototype'] = $name;
        }
      }
      $object->rollOut($output, 'function');
      if ($object->getBlockComment('summary')) {
        $output[$name]['summary'] = $object->getBlockComment('summary');
      }
      if ($object->getBlockComment('description')) {
        $output[$name]['description'] = $object->getBlockComment('description');
      }
    }
    
    if ($init) {
      $init->setFunctionName($name);
      $init->rollOut($output);
    }
  }
	unset($declare_calls);
	unset($call);
	unset($init);
	unset($args);
	unset($name);
	unset($p);
	unset($items);
	unset($item);
	unset($object);
	unset($values);
	unset($key);
	unset($value);
	unset($full_name);
	unset($function);

  $inherit_calls = $package->getFunctionCalls('dojo.inherits', true);
  foreach ($inherit_calls as $call) {
    if ($call->getParameter(0)->isA(DojoVariable) && $call->getParameter(1)->isA(DojoVariable)) {
      $output[$call->getParameter(0)->getVariable()]['chains']['prototype'][] = $call->getParameter(1)->getVariable();
    }
  }
	unset($inherit_calls);
	unset($call);

  $objects = $package->getObjects();
	foreach ($objects as $object) {
    $object->rollOut($output);
  }
	unset($objects);
	unset($object);

	$aliases = $package->getAliases();
	unset($aliases);

  $mixin_calls = array_merge($package->getFunctionCalls('dojo.extend'), $package->getFunctionCalls('dojo.lang.extend', true), $package->getFunctionCalls('dojo.mixin'), $package->getFunctionCalls('dojo.lang.mixin'));
  $declarations = $package->getFunctionDeclarations();
  $executions = $package->getExecutedFunctions();

  // Since there can be chase conditions between declarations and calls, we need to find which were "swallowed" by larger blocks
  $package->removeSwallowed($mixin_calls);
  $package->removeSwallowed($declarations);
  $package->removeSwallowed($executions);

  // Handle function declarations
  foreach ($declarations as $declaration) {
    $declaration->rollOut($output);
  }
	unset($declarations);
	unset($declaration);
  
  foreach ($executions as $execution) {
    $execution_declarations = $execution->getFunctionDeclarations();
    foreach ($execution_declarations as $declaration) {
        $declaration->rollOut($output);
    }
  }
	unset($executions);
	unset($execution);
	unset($execution_declarations);
	unset($declaration);

  // Handle. dojo.lang.extend and dojo.lang.mixin calls
  foreach ($mixin_calls as $call) {
    $is_prototype = false;
    if ($call->getParameter(0)->isA(DojoVariable)) {
      $object = $call->getParameter(0)->getVariable();
      $call_name = $call->getName();

      if(strlen($object) > 10 && substr($object, -10) == '.prototype') {
          $is_prototype = true;
          $object = substr($object, 0, -10);
      }

      if ($call->getParameter(1)->isA(DojoObject)) {
        $properties = $call->getParameter(1)->getObject();
        $keys = $properties->getValues();
        foreach ($keys as $key => $function) {
          $full_variable_name = "$object.$key";

          if ($is_prototype) {
              $output[$full_variable_name]['prototype'] = $object;
          }
          if ($function->isA(DojoFunctionDeclare)) {
            $function = $function->getFunction();
            if ($call_name == 'dojo.lang.extend') {
              $function->setPrototype($object);
            }
            $function->setFunctionName($full_variable_name);
            $function->rollOut($output);
          }
          else {
            if ($call_name == 'dojo.lang.mixin' || $call_name == 'dojo.mixin') {
              if (empty($output[$full_variable_name])) {
                $output[$full_variable_name] = array();
              }
            }
            else {
                if ($is_prototype) {
                    $output[$full_variable_name]['prototype'] = $object;
                }
            }
          }
        }
      }
      elseif ($call->getParameter(1)->isA(DojoString)) {
        $properties = $call->getParameter(1)->getString();
        // Note: inherits expects to be reading from prototype values
        if ($call_name == 'dojo.lang.extend' && strpos($properties, '.prototype') !== false) {
          $output[$object]['chains']['prototye'][] = str_replace('.prototype', '', $properties);
        }
        elseif ($call_name == 'dojo.lang.extend' && strpos($properties, 'new ') !== false) {
          $output[$object]['chains']['prototype'][] = str_replace('new ', '', $properties);
          $output[$object]['chains']['prototype'][] = str_replace('new ', '', $properties);
        }
        else {
          $output[$properties]['inherits'] = $object;
        }
      }
    }
  }
	unset($mixin_calls);
	unset($call);
	unset($is_prototype);
	unset($object);
	unset($call_name);
	unset($properties);
	unset($keys);
	unset($key);
	unset($function);
	unset($variable_name);
	unset($full_variable_name);

  // Remember, dojo.provides creates new objects if needed
  $parts = explode('.', $output['#resource']);
  while (count($parts)) {
      if (!array_key_exists(implode('.', $parts), $output)) {
          $output[implode('.', $parts)] = array('type' => 'Object');
      }
      array_pop($parts);
  }
	unset($parts);

  foreach ($output as $object_name => $object) {
    $parts = explode('.', $object_name);
    $last = array_pop($parts);
    if ($last{0} == '_') {
      $output[$object_name]['private'] = true;
    }
    if (strpos($object_name, '._') !== false) {
        $output[$object_name]['private_parent'] = true;
    }
    if (preg_match('%^[A-Z]%', $last) && $object['type'] == 'Function') {
        $output[$object_name]['classlike'] = true;
    }
  }

  return $output;
}

?>
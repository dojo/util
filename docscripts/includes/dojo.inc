<?php

require_once('lib/parser/Dojo.php');
require_once('lib/parser/DojoPackage.php');

global $namespaces;
$namespaces = array();
$files = scandir('modules');
foreach ($files as $file) {
  if (substr($file, -7) == '.module') {
    include_once('modules/' . $file);
		$namespaces[] = substr($file, 0, -7);
	}
}
unset($file);
unset($files);

function dojo_file_is_new($namespace, $file) {
	static $timestamps;

	if (!$timestamps) {
		$lines = @file_get_contents('timestamps');
		if (!$lines) {
			$timestamps = array();
		}
		else {
			$timestamps = unserialize($lines);
		}
	}
	
	$current = filectime(call_user_func($namespace . '_code_location') . $file);
	if (!isset($timestamps[$file]) || $current > $timestamps[$file]) {
		$timestamps[$file] = $current;
		file_put_contents('timestamps', serialize($timestamps));
		return true;
	}

	return false;
}

function dojo_get_files() {
	global $namespaces;
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
			'browser' => array(
				'dashboard' => true
			),
			'rhino' => true
		)
	);
}

function dojo_get_contents($namespace, $file_name) {
	$output = array();

	$dojo = new Dojo($namespace, call_user_func($namespace . '_code_location'));
	$package = new DojoPackage($dojo, $file_name);
	$package_name = $package->getPackageName();

	$output['#provides'] = $package_name;
	$output['#project'] = call_user_func($namespace . '_project_name');

  $compound_calls = $package->getFunctionCalls('dojo.kwCompoundRequire');
  $require_calls = $package->getFunctionCalls('dojo.require');
  $require_if_calls = array_merge($package->getFunctionCalls('dojo.requireIf'), $package->getFunctionCalls('dojo.requireAfterIf'));
  $declare_calls = array_merge($package->getFunctionCalls('dojo.declare'), $package->getFunctionCalls('dojo.widget.defineWidget'));
  $inherit_calls = $package->getFunctionCalls('dojo.inherits', true);
  $mixin_calls = array_merge($package->getFunctionCalls('dojo.extend'), $package->getFunctionCalls('dojo.lang.extend', true), $package->getFunctionCalls('dojo.mixin'), $package->getFunctionCalls('dojo.lang.mixin'));
  $declarations = $package->getFunctionDeclarations();
  $executions = $package->getExecutedFunctions();
  $objects = $package->getObjects();
  $aliases = $package->getAliases();

  // Since there can be chase conditions between declarations and calls, we need to find which were "swallowed" by larger blocks
  $package->removeSwallowed($mixin_calls);
  $package->removeSwallowed($declarations);
  $package->removeSwallowed($executions);

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

  // Handle dojo.require calls
  foreach ($require_calls as $call) {
    $require = $call->getParameter(0);
    if ($require->isA(DojoString)) {
      $output['#requires'][] = array('common', $require->getString());
    }
  }

  // Handle dojo.requireAfterIf calls
  foreach ($require_if_calls as $call) {
    $environment = $call->getParameter(0);
    $require = $call->getParameter(1);
    if ($environment && $require) {
      $environment = $environment->getValue();
      $require = $require->getValue();
			$env_value = $environment->getValue();
      if ($require instanceof DojoString) {
				if ($environment instanceof DojoString) {
        	$output['#requires'][] = array($environment->getValue(), $require->getValue());
				}
			}
			elseif ($environment instanceof DojoVariable) {
				if ($environment->getValue() == "dojo.render.svg.capable") {
      		$output['#requires'][] = array('svg', $require);
				}
				else if($environment->getValue() == "dojo.render.vml.capable") {
      		$output['#requires'][] = array('vml', $require);
				}
			}
    }
  }
  
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
        if ($key == 'initializer' && $value->isA(DojoFunctionDeclare)) {
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

  // Handle function declarations
  foreach ($declarations as $declaration) {
    $declaration->rollOut($output);
  }
  
  foreach ($executions as $execution) {
  	$execution_declarations = $execution->getFunctionDeclarations();
  	foreach ($execution_declarations as $declaration) {
  		$declaration->rollOut($output);
  	}
  }
  
  foreach ($inherit_calls as $call) {
    if ($call->getParameter(0)->isA(DojoVariable) && $call->getParameter(1)->isA(DojoVariable)) {
      $output[$call->getParameter(0)->getVariable()]['chains']['prototype'][] = $call->getParameter(1)->getVariable();
    }
  }

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
  
  foreach ($objects as $object) {
    $object->rollOut($output);
  }
	
	// Remember, dojo.provides creates new objects if needed
	$parts = explode('.', $output['#provides']);
	while (count($parts)) {
		if (!array_key_exists(implode('.', $parts), $output)) {
			$output[implode('.', $parts)] = array('type' => 'Object');
		}
		array_pop($parts);
	}

	foreach ($output as $object_name => $object) {
		$parts = explode('.', $object_name);
		$last = array_pop($parts);
		if ($last{0} == '_') {
			$output[$object_name]['private'] = true;
		}
	}

	return $output;
}

?>
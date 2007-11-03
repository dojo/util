<? /*

  _browse.php - rudimentary api browser designed to expose flaws in
  either the dojo doc parser or the effort to document the Dojo Toolkit
  API. it is embarasingly inefficient and sloppy, but works.
  
  this file requires PHP5, and a full source tree of the dojo toolkit.

  it parses a module, and dumps relevant API information made in real
  time. PLEASE use this to preview how the parse tool will interpret
  your code.

  it covers all files in dojtool's modules/ directory dynamically, so
  can be used to preview documentation in custom namespace code, as well.

*/ ?>

<? if (empty($_REQUEST['ajaxy'])){ ?>
<html>
<head>
  <title>API Preview tool | The Dojo Toolkit <title>
  <script type="text/javascript" src="../../dojo/dojo.js" djConfig="parseOnLoad:true"></script>
  <script type="text/javascript">
    dojo.require("dijit.layout.LayoutContainer"); 
    dojo.require("dijit.layout.SplitContainer");
    dojo.require("dijit.layout.ContentPane");
    function tgShow(id){
      var identity=document.getElementById(id);
            if(identity.className=="sho"){ identity.className="nosho";
            }else{ identity.className="sho"; }
    }
  </script>
  <style type="text/css">
    @import "../../dijit/themes/tundra/tundra.css"; 
    @import "../../dojo/resources/dojo.css"; 
    body, html { width:100%; height:100%; margin:0; padding:0; }
    .sho { display:block; }
    .nosho { display:none; } 
    .topbar li { display:inline; padding:5px; } 
    .source code { 
    </style>
  </style>
</head>
<body class="tundra">
<?
} // empty($_REQUEST['ajaxy']

include_once('includes/dojo.inc');

$tree = '';
// no dojo.require() call made?
$u = 0; 
$files = dojo_get_files(); 
foreach ($files as $set){ 
  list($namespace, $file) = $set;
  $data[$namespace][] = $file; 
  $tmptree = explode("/",$file);
  if(count($tmptree)>1){
    $treefilename = array_pop($tmptree);
    $treepath = join("/",$tmptree);
  }else{
    $treefilename = array_pop($tmptree);
    $treepath = '/'; 
  }
  $tree['items'][] = array(
    'label' => $treefilename,
    'ns' => $namespace,
    'type' => "file",
    'id' => "node".$node++
  );
}
$namespaces = array_keys($data); 

$nshtml = "<ul>";
$regexp = "";
foreach ($namespaces as $ns){
  $regexp .= $ns."|";
  if($_REQUEST['ns'] != $ns){
    $nshtml .= "<li><a href=\"?ns=".$ns."\">".$ns."</a></li>"; 
  }else{
    $nshtml .= "<li>".$ns."</li>"; 
  }
}
define('REGEXP','('.$regexp.')'); 

$nshtml .= "</ul>"; 
unset($files); 

if(!empty($_REQUEST['ns'])){
  $ns = $_REQUEST['ns'];
  $ifile = $_REQUEST['file'];
  
  $tree .= "<ul>";
  foreach ($data[$ns] as $file){
    if(!preg_match('/tests\//i',$file)){
      if($ifile == $file){ $tree .= "<li>".$file."</li>"; 
      }else{ $tree .= "<li><a href=\"?ns=".$ns."&amp;file=".$file."\">".$ns."/".$file."</a></li>"; }
    }else{ $testfiles[] = $ns."/".$file; } 
  }
  $tree .= "</ul>";

  if($ifile){
    $apiData = dojo_get_contents($ns,$ifile);

    $print .= "<h2>".$ns."/".$ifile."</h2><ul>";
    foreach($apiData as $key => $val){
      switch($key){
        case "#resource" : break;
        case "#requires" : 
          $print .= "<li><h3>Requires:</h3><ul>";
                foreach($val[0] as $resource){
            $print .= "<li>".$resource."</li>"; 
                }
          $print .= "</ul></li>"; 
                break;
        case "#provides" : break;
        default:
          $print .= "<li><h4>".$key."</h4><ul> ";
          foreach($val as $key2 => $val2){
  
              switch($key2){
                // most things using dojo.declare() trigger this, eg: dijits
                case "classlike": $knownClasses[] = $key; break;

                // these are partially useless for our "overview" api, but set showall=1 in the
                // url if you want to see these, too. sortof.
                case "type" : $print .= "<li><em>".$key2."</em><div><pre>".htmlentities($val2)."</pre></div></li>"; break;
                case "private_parent" :
                case "prototype" :
                case "instance" :
                case "private" :
                  if($_REQUEST['showall']){ $print .= "<li>".$key2." - ".$val2."</li>"; }
                  break;
                
                // another array we want inspect more closely 
                case "parameters" : 
                  $print .= "<li><em>parameters:</em> <ul>"; 
                  foreach($val2 as $param => $paramData){
                    $print .= "<li>".$param.": <em>(typeof ".$paramData['type'].")</em><div>";
                    if(!empty($paramData['summary'])){
                      $print .= "<pre>".htmlentities($paramData['summary'])."</pre>";
                    }
                    $print .= "</div></li>";
                  } //print_r($val2);             
                  $print .= "</ul></li>";
                  break;
                
                // the stripped source, and some minimal toggling to show/hide  
                case "source" : 
                  /*  
                  $print .= "<li class=\"source\"><em>source: [<a onclick=\"tgShow('unique".++$u."');\">view</a>]</em> 
                    <div class=\"nosho\" id=\"unique".$u."\">\n
                    ".ltrim(str_replace("\n","<br>",str_replace("\t","&nbsp;",$val2)))."
                    </div>
                    ";  
                  */
                  break;

                case "chains" :
                  if (!empty($val2)) {
                    $print .= "<li><em>chain:</em> <ul>";
                    foreach ($val2 as $subtype => $chains) {
                      foreach ($chains as $chain) {
                        $print .= "<li>$chain: <em>($subtype)</em></li>";
                      }
                    }
                    $print .= "</ul></li>";
                  }
                  break;

                // these are the ones we care about, and are fulltext/sometimes html
                case "examples" :
                  foreach ($val2 as $example){
                    $print .= "<li><em>example</em><div><pre>".htmlentities($example)."</pre></div></li>";
                  }
                  break;
                case "returns" :
                case "exceptions" :
                case "description" :
                case "summary" : $print .= "<li><em>".$key2."</em><div><pre>".htmlentities($val2)."</pre></div></li>"; break;

                // this is a key we don't know about above, so show it just in case
                default: $print .= "<li>?? ".$key2." = ".$val2." (debug: ".gettype($val2).") ??</li>"; break;
              }
          } 
          $print .= "</ul></li>"; break;
      }
    }
    $print .= "</ul>";
  }
}

// ... aaaaaand some basic dijit layout to make this quick thing somewhat user friendly. i have guilt in my heart loading all this 
// dijit-ness, and not just capturing the onclick of the links and just targeting #apiPane ... would have to only echo $print.
// set ?ajaxy=1 on a url to only print the content part of a request. 
if(empty($_REQUEST['ajaxy'])){ ?>
<div dojoType="dijit.layout.LayoutContainer" style="width:100%; height:100%;">
  <div dojoType="dijit.layout.ContentPane" class="topbar" layoutAlign="top"><? echo $nshtml; ?></div>
  <div dojoType="dijit.layout.SplitContainer" layoutAlign="bottom" orientation="horizontal" sizerWidth="7" style="height:90%; border-top:1px solid #a0a0a0;">
    <div dojoType="dijit.layout.ContentPane"><? echo $tree; ?></div>
    <div dojoType="dijit.layout.ContentPane" id="apiPane">
      <? echo $print; ?>
    </div>
  </div>
</div>
<? }else{ echo $print; }?>
</body>
</html>
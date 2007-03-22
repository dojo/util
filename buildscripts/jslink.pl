#!/usr/bin/perl -w

=head1 NAME

  jslink.pl - eliminate unused code from a javascript library

=head1 SYNOPSIS

  jslink.pl -pre cat -i myapp.js -l lib.js -o -

Options are:

   -pre cat                  # preprocessor to apply to input files (but not -e).
   -e 'myfunc(3); foobar;'   # an "anchor" expression.
   -h index.html             # an "anchor" html file, whose script will be used. unimplemented.
   -i myapp.js               # an "anchor" script file, which will pull in things from library files.  
   -l lib.js                 # a library file.
   -o output.js              # the -l files with unneeded code removed. defaults to '-' (stdout).
   -debug debug              # default is none (no debugging)
   -warn functionmatch,instmeth,ambigs,dups                # default is none (no warnings about things that may be acceptable). 'all' is also supported.
   -dump used,unused,usedby,refs,undefs                    # default is none (no dumping). 'all' is also supported.
   -print used,filemarker,skipped,sourcelines              # default is 'used,filemarker' (print used code from libraries)
   -trace symname            # issue debug output every time symname is seen. unimplemented.
   -tabwidth 4               # set the number of spaces that tabs are interpreted as, if different from default of 8.
   -nestedassigns 0          # whether to attempt to track assignments of nested function definitions to other symbols.

All output except for -o (from -debug, -warn, or -dump) is sent to STDERR.

=head1 DESCRIPTION

This determines "dead" code based on following the transitive closure of references to
symbols in one or more "anchor" files.

It eliminates whole definitions only; it does not do anything even
approaching full dead code elimination, as might be done within function bodies.

It will eliminate nested functions if they are not used.

It has knowledge of the builtin ECMAScript objects and their method names, as well as many DOM objects and their methods. It assumes that
any parameter which calls a method with a name matching a builtin method name is indeed that kind of object. It does not currently
do any sort of detailed static analysis that might actually prove this.

It also has knowledge of all builtin ECMAscript global functions, and so knows not
to try to find their definitions. Note that this means that it is up to you to
determine if you need to provide definitions for missing builtin function or
missing builtin object methods (for example, Array.prototype.push for IE 5.0).


=head2 Treatment of Top-Level Statements

If it finds any references at all to a symbol in some library file (global data or function),
it will not only pull in the definitions of those symbols, it will then also include
*all* of the top-level statements in that file.
That is because we don't want to try to analyze the necessity of the load-time
statements; it is all or nothing for them.
If any of those load-time statements have references to functions in
the same file, then those functions are pulled in too.
For this reason, it is better to supply individual smaller javascript files
(or just have few load-time statements).

=head1 IMPLEMENTATION

=head2 Unnecessary Limitations

This implementation is based on a crude parser using regular expressions,
which makes assumptions about indentation in order to identify the beginnings
and endings of function definitions.

The assumptions about indentation are valid if a pretty-printing
preprocessor is used. The default preprocessor is just 'cat'.
(We also have a Rhino-based preprocessor that we hacked together,
but it is dependent on Rhino patches we have not yet organized.)

Even if the indentation is regular, there are still lots of problems
with this implementation: not properly skipping literals (String and RegExp),
not properly parsing all expressions that might be a function call,
etc.

There are a variety of alternative implementation approaches, any of which
would be more interesting and probably better, such as:

  - based on a real ECMAScript grammar, or
  - based on extending some real ECMAScript interpreter (such as SpiderMonkey or
    Rhino, which do not explicitly use a grammar), or
  - implemented in ECMAScript itself, such as something based on Narcissus, or
  - implemented by analyzing the result of a "real" ECMAScript/JScript linker
    (which would work with a "real" ECMAScript compiler), to see what symbols it pulls in.
  - perform source translation to some other programming language that has
    more mature tools.

=head2 Fundamental Limitations

Given the possible uses of eval(), function lookup tables, computed function names,
dynamically added object methods, redefinition of functions, and so on, 
it is practically impossible to do this job fully automatically and correctly. 

These challenges can result in both false negatives and false positives.
We can for example entirely miss a dependence on some code
whose entry point is a string that might even come from
the outside environment.

On the other hand, when applied to an application that has
a "driver" or "plugin" model, we might end up pulling in all
available drivers/plugins, just because their entry points show
up in some global registry table.

We will also tend to pull in code even if the reference
is protected by a conditional:

   if (typeof someFunc != 'undefined') someFunc()

The intent of the programmer in such code is typically to call
someFunc() only if the code that defines it has been loaded
for some other reason (vz. "weak references" in compiled
languages).

It is impossible really to solve all these situations automatically.
It is necessary to get some guidance from the programmer, such
as pragmas in the code itself, or by some other external
configuration.

=head2 Internals

As we parse the input, we make up a list of definition objects, which
have these keys:

   deftype      # one of: 'ctormeth', 'protometh', 'instmeth', 'globalfunc', 'localfunc', 'assign', 'singleton'
   is_global    # whether this is a top-level expression in a file (versus a function definition). 
   actualname   # the string the actually occurred in the source code for the definition, such as 'MyClass.prototype.sort'. 
   justname     # the last identifier name in the dotted name of the definition, such as 'sort'. key for $DEFS_BY_UNQUAL.
   qualname     # the fully qualified name for the defined symbol, which may be more explicit than appeared in source code. key for $DEFS_BY_QUAL.
   parentqual   # the value of qualname of the parent definition (in nesting level), if any.
   protoname    # the name of the prototype class, such as 'MyClass' (if any -- just for deftype 'protometh')
   aliasto      # the name of another symbol that this is an alias for (as in "Foo.prototype.meth = aliasfunc").
   level        # the nesting level of the definition
   filename     # name of the file (or expression) this came from.
   startline    # zero-based line number this definition starts with.
   lastline     # zero-based line number of last line of this definition.
   lines        # array ref of source lines corresponding to startline to lastline.
   params       # a hash ref with keys which are the parameter names of the defined function.
   refs         # the references from this definition to other symbols. hash ref from qualnames to [$reftype, $lineno]
   undefs       # array ref of symbols in refs that are apparently not defined anywhere.
   usedby       # array ref of other definition objects which refer (directly) to this one. opposite of refs.
   used         # boolean to indicate whether it is part of the transitive closure (actually it is the loopcount).

=head1 TODO

=head2 Data Tracking

Track definitions of global data variables, and references to them.

   # global data
   ^var $NAMERE = 
   # member data
   ^\ *this.$NAMERE = 
   # local data
   ^\ *var $NAMERE = 

=head2 Aliasing and Scoping

Make sure aliased definitions are not used to resolve references across lexical blocks.

Warn about shadowed variable/function names. Implement 'localfunc' and 'assign' properly
(see $ANALYZE_NESTED_ASSIGNMENTS).

Track alias definitions (in 'assign' case, LHS inherits all the methods available from RHS).
Things like "a = b.c.d;".

Track creation of global instances, things like "var foo = new SomeFunc();".

Ultimately, properly tracking of aliases could allow for tightening up of typeing.

=head2 Typing

Right now, if we can't resolve a reference using the fully qualified name, we'll
match to any definition of a function with the same unqualified name.
This has the unfortunate consequence of potentially pulling in the wrong code.

We also currently ignore all references to methods that share a name with
any DOM or builtin ECMAScript object method. This means we can miss undefined
symbols.

A proper fix would involve attempts at full data flow analysis to determine
and variable argument types, and/or capitalize on some declaration mechanism
(such as commented out types, or reliance on JScript .NET source code prior
to down translation).

Other benefits would be obtained as well, such as catching such errors as
calling getElementById on a Window object instead of a Document object.... 

=head2 Subclass Method Calls

Track calls to prototype functions from within subprototype method bodies (based on 
remembering the set of the subprototype's prototype object).

=head2 Function References

Do something about passing in named function references (no parens). Though
we win somewhat with "justname" look up on the other side.

Scope locally bound functions such as "OuterFunction.inner."

Extend $QUALRE to handle function calls with parameters in dotted expressions: "foobar(1,2).println()"

Handle (ignore) calls from literals, such as '00000'.substring(2)

=head2 Predefined Symbols

Make complete list of ECMAScript functions, variables, and builtin object methods.

Make complete (or somewhat complete) list of DOM object methods.

=head2 Top-Level Statements

Break up top-level statements into multiple continuous sequences within the file,
or even per whole statement. This would make for better diagnostics (tracking
line number for the definition/reference instead of just line -1). It would
also pave the way for perhaps excluding more blocks from the
final code.

=head2 Preprocessing

Get Rhino to issue original file line numbers.
Also maybe get Rhino to mangle/change names, or do other transforms (such as conditional "in").

Exclude pattern matches within quoted strings and regexp literals.

Regular expressions to match for strings containing references that should be
considered (vs. ignore all strings).

Support for -h: allow anchor refs to come from an html page.

Support -D of expressions known to be false or true, to exclude references in:

    if (FALSEEXPR) {...} 
    if (!FALSEEXPR) {} else {...}
    if (TRUEEXPR) {} else {...}

=head2 Pragmas

Support external declaration of other builtin objects and functions to assume are defined.

Support some special inline comment syntax to indicate that something should be
considered defined.

=head2 Debugging and Reporting Features

Implement -trace.

Report on line counts in used and unused code.

=head2 Lint-Like Features

Provide warnings on:

   calls to eval 
   computed apply and computed call
   js file names
   unknown method on builtin object
   redefinition of builtin object method

=head1 AUTHOR

Copyright 2004, Mark D. Anderson, mda@discerning.com.

This is free software; you can redistribute it and/or
modify it under the same terms as Perl itself.

Alternatively, this is licensed under Academic Free License version 1.2.

=cut

use Data::Dumper;

################################################################
# constants

# including 'this'
my @KEYWORDS = qw(break else new var case finally return void catch for switch while continue function with this default if throw delete in try do instanceof typeof);
my %KEYWORDS = map {$_=>1} @KEYWORDS;
my @BUILTIN_OBJECTS = (qw(Number String Boolean Date RegExp Array Math Object Error Function),
                       qw(XMLHttpRequest ActiveXObject DOMParser XMLSerializer),
                       qw(arguments NaN Infinity undefined));
my %BUILTIN_OBJECTS = map {$_=>1} @BUILTIN_OBJECTS;
my @BUILTIN_FUNCTIONS = (qw(eval parseInt parseFloat isNaN isFinite decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape),
			 qw(ScriptEngineMajorVersion ScriptEngineMinorVersion));
my @WINDOW_FUNCTIONS = qw(alert blur clearTimeout close focus open print setTimeout);
my %BUILTIN_FUNCTIONS = map {$_=>1} (@BUILTIN_FUNCTIONS, @WINDOW_FUNCTIONS);

# TODO: Math static methods, rest of methods for RegExp and Date
my @BUILTIN_METHODS = (
  qw(toString toLocaleString valueOf hasOwnProperty isPrototypeOf propertyIsEnumerable), # Object
  qw(apply call), # Function
  qw(charAt charCodeAt fromCharCode concat indexOf lastIndexOf localeCompare match replace search slice split substring substr toLowerCase toUpperCase toLocaleLowerCase toLocaleUpperCase), # String
  qw(test match exec), # RegExp
  qw(concat join push pop reverse shift slice sort splice unshift), # Array
  qw(toFixed toExponential toPrecision), # Number
  qw(parse toDateString toTimeString getDate getDay getFullYear getHours getMilliseconds getMinutes getMonth getSeconds getTime getTimezoneOffset getYear), # Date
  qw(setDate setHours setMilliseconds setMinutes setMonth setSeconds setYear toLocaleTimeString), # more Date
  qw(caller), # Arguments
       );

my @DOM_METHODS = (
    qw(clear createDocument createDocumentFragment createElement createEvent createEventObject createRange createTextNode getElementsByTagName getElementById write), # Document, Document.implementation
    qw(addEventListener appendChild attachEvent cloneNode createTextRange detachEvent dispatchEvent fireEvent getAttributeNS getAttributeNode hasChildNodes hasAttribute hasAttributes insertBefore removeChild removeEventListener replaceChild scrollIntoView), # Node
    qw(submit), # Form
    qw(item), # DOM collections
    qw(collapse createContextualFragment moveEnd moveStart parentElement select setStartBefore), # Range
    qw(getPropertyValue setProperty), # Style
    qw(initEvent preventDefault stopPropagation), # Event
    qw(serializeToString), # XMLSerializer
    qw(open send), # XMLHTTP
    qw(loadXML), # XMLDOM
    qw(parseFromString), # DOMParser
);
# put @WINDOW_FUNCTIONS both in methods and functions, since might be qualified or not
my %BUILTIN_METHODS = map {$_=>1} (@BUILTIN_METHODS, @DOM_METHODS, @WINDOW_FUNCTIONS);
my $NAMERE = '([\w_]+)';
# TODO: need to handle "foobar().baz", but not "switch(a)"  
my $QUALRE = '([\w_][\w_\.]*)';
my $GLOBALNAME = 'GLOBAL '; # fake symbol name for top-level statements in some file. trailing space is deliberate to match any real symbol.

################################################################
# internal variables
my $DEFS_BY_QUAL = {};
my $DEFS_BY_UNQUAL = {};
my $DEFS_BY_FNAME = {};

################################################################
# configuration variables (or at least potentially configurable)

# the presumed indent on input to indicate a whole definition level.
my $PREINDENT = 1;
my $TABWIDTH = 8;
my $TABSPACES;
my $PREPROCESSOR = 'cat';
my $RHINOJAR = '/Users/mda/workspaces/rhino1_5R5/js.jar';
my $JSLINKERDIR = '.';

my $DEBUGOPTS = {debug => 0};
my $WARNOPTS = {functionmatch => 0, instmeth => 0, ambigs => 0, dups => 0};

my $DUMPOPTS = {used => 0, unused => 0, usedby => 0, undefs => 0, refs => 0}; 
my $DUMPINDENT = '   ';

my $SYMSEP = "         ";

my $OUTOPTS = {skipped => 0, sourcelines => 0, used => 1, filemarker => 1};

my $OUTFILE = '-';

my $TRACE_SYMS = {};

my $FIND_UNDEFINED_IN_UNUSED = 1;
my $ANALYZE_NESTED_ASSIGNMENTS = 1;

################################################################
# output routines

sub debug {
    print STDERR 'DEBUG: ', @_, "\n" if $DEBUGOPTS->{debug};
}

sub info {
    my $mess = "\n" . join('', @_);
    $mess =~ s/\n$//;
    $mess =~ s/\n/\n    /g;
    print STDERR 'INFO:', $mess, "\n";
}

# set in parse_file()
my $CURRENT_FNAME = '';

sub parse_warn {
    my ($mess, @rest) = @_;
    my $line = $_;
    my $lineno = $.;
    my $fname = $CURRENT_FNAME;
    print STDERR "PARSE WARNING: At line $fname\:$lineno : '$line'\n        $mess", @rest, "\n";
}

sub warning {
    print STDERR "WARNING: ", @_, "\n";
}

sub trace_sym {
    my ($sym, @rest) = @_;
    my $is_trace = 0;
    if (ref($sym) eq 'ARRAY') {$is_trace = grep{$TRACE_SYMS->{$_}} @$sym}
    else {$is_trace = $TRACE_SYMS->{$sym};}
    debug @rest if $is_trace;
}

################################################################

my $FILEOBJS_BY_NAME = {};

sub usage {
    my ($mess) = @_;
    print STDERR "ERROR: $mess\n" if $mess;
    print STDERR "See 'perldoc $0' for usage\n";
    exit(1);
}

sub process_commandline {
    my $fileobjs = [];
    my $i = 0;
    my $expr_count = 0;
    while (@ARGV) {
	my $opt = shift @ARGV;
	warning "skipping empty argument", next unless $opt;
	usage("unexpected non-option $opt") unless $opt =~ m/^-/;
	my $optarg = shift @ARGV;
	usage("no option argument following '$opt'") unless $optarg;
	my $fileobj;
	if ($opt eq '-e') {
	    $fileobj = {
		filename => ('expr' . ($expr_count++)),
		expr => $optarg,
		is_anchor => 1,
	    };
	}
	elsif ($opt eq '-h') {
	    usage("unimplemented: reading script out of an html file");
	}
	elsif ($opt eq '-i') {
	    $fileobj = {filename => $optarg, is_anchor => 1};
	}
	elsif ($opt eq '-l') {
	    $fileobj = {filename => $optarg};
	}
	elsif ($opt eq '-o') {
	    $OUTFILE = $optarg;
	}
	elsif ($opt eq '-debug') {
	    $DEBUGOPTS = {map {$_ => 1} split(',',$optarg)};
	}
	elsif ($opt eq '-trace') {
	    $TRACE_SYMS->{$optarg} = 1;
	}
	elsif ($opt eq '-warn') {
	    if ($optarg eq 'all') {
		while(my($k,$v) = each %$WARNOPTS) {$WARNOPTS->{$k} = 1;}
	    }
	    else {
		$WARNOPTS = {map {$_ => 1} split(',',$optarg)};
	    }
	}
	elsif ($opt eq '-dump') {
	    if ($optarg eq 'all') {
		while(my($k,$v) = each %$DUMPOPTS) {$DUMPOPTS->{$k} = 1;}
	    }
	    else {
		$DUMPOPTS = {map {$_ => 1} split(',',$optarg)};
	    }
	}
	elsif ($opt eq '-pre') {
	    $PREPROCESSOR = $optarg;
	}
	elsif ($opt eq '-tabwidth') {
	    $TABWIDTH = $optarg;
	}
	elsif ($opt eq '-nestedassigns') {
	    $ANALYZE_NESTED_ASSIGNMENTS = (!$optarg || $optarg eq '0') ? 1 : 0;
	}
	else {
	    usage("unknown option '$opt'");
	}
	if ($fileobj) {
	    push(@$fileobjs, $fileobj) ;
	    $FILEOBJS_BY_NAME->{$fileobj->{filename}} = $fileobj;
	}
	$i++;
    }
    $TABSPACES = ' 'x$TABWIDTH;
    return $fileobjs;
}

# used for 'ctormeth' definition, for example "this.foobar = function ...". 
# It figures out what "this" is from the $parentdef
sub qualify_def_this {
    my ($name, $parentdef) = @_;
    my $pname = $parentdef->{qualname};
    my $pdeftype = $parentdef->{deftype};
    if ($pdeftype eq 'globalfunc') {
	debug("qualifying name '$name' with parent '$pname' of type '$pdeftype'");
	$name = "$pname\.constructor\.$name";
    }
    else {
	if ($pdeftype eq 'instmeth' || $pdeftype eq 'localfunc') {
	    if ($WARNOPTS->{instmeth}) {
		parse_warn("instance method definition of '$name' in parent '$pname'; if parent is a singleton, defining a method in the constructor is ok") 
	    }
	}
	elsif ($pdeftype eq 'singleton') {
	}
	else {
	    parse_warn("member function definition of '$name' with parent '$pname', parent deftype '$pdeftype'");
	}
    }
    return $name;
}

# used when a reference string for a function call starts with 'this.'
# we try to determine what "this" means based on deftype we are in :
#   'ctormeth'   - in a "this.foobar = function" (itself inside a global function)
#   'protometh'  - in a "FooBar.prototype.methname = function"
#   'instmeth'  -  in a "whatever.methname = function"
#   'globalfunc' - inside body of global function (constructor)
sub qualify_ref_this {
    my ($refname, $def) = @_;

    # we this could have been from the body of a constructor, or from the body of another method.
    my ($restname) = ($refname =~ m/^this\.(.*)/);
    my $deftype = $def->{deftype};

    my $refqual = undef;
    my $is_funny = 0;

    if ($deftype eq 'ctormeth' || $deftype eq 'protometh' || $deftype eq 'instmeth' || $deftype eq 'singleton') {
	($refqual) = ($def->{qualname} =~ m/(.*)\./);
	if (!$refqual && $def->{parentqual}) {
	    debug("giving reference '$refname' the parent qualifier of '", $def->{parentqual}, "'");
	    $refqual = $def->{parentqual};
	}
    }
    elsif ($deftype eq 'globalfunc') {
	$refqual = $def->{qualname} . '.prototype';
    }
    else {
	$is_funny = 1;
	parse_warn("reference '$refname' in a definition of unknown type '$deftype'");
    }

    if ($refqual) {
	debug("qualifying reference '$refname' in a '$deftype' definition as '$refqual' + '.' + '$restname'");
	$refname = "$refqual\.$restname";
    }
    elsif (!$is_funny) {
	parse_warn("could not figure out what 'this' means in reference, inside definition: ", Dumper($def));
    }
    return $refname;
}

# create and register a definition object.
sub add_def {
    my ($qualname, $actualname, $deftype, $fname, $lineno, $level, $parentdef, $protoname, $aliasto) = @_;
    die "add_def: wrong number args: @_" unless scalar(@_) == 9;
    # we are currently at the next line, so subtract 1 from $. for zero-based line number.
    $lineno--;

    my $is_global = 0;
    if ($qualname eq $GLOBALNAME) {
	$is_global = 1;
	$qualname = "$GLOBALNAME$fname";
    }

    # parse out params, unless type 'assign'
    my $params = {};
    if (!$is_global && $deftype ne 'assign') {
	my ($funcname, $paramstr) =  m/function ([\w_]*?)\s*\((.*?)\)/ ;
	if (!$funcname) {
	    $funcname = '';
	    ($paramstr) = m/function\s*\((.*?)\)/;
	}
	if (defined($paramstr)) { 
	    trace_sym($funcname, "funcname=$funcname, paramstr=$paramstr in '$_'");
	    # $paramstr ||= '';
	    # if (!defined($paramstr)) { parse_warn("did not match function params, 1='$1'"); $paramstr = ''}
	    my @parms = split(/\s*,\s*/, $paramstr);
	    $params = {map {$_ => 1} @parms};
	    trace_sym($funcname, "got params '$paramstr', ", Dumper($params));
	}
	else {
	    parse_warn("no function params to parse in: ", $_); 
	}
    }
    
    my $parentqual = $parentdef->{qualname};
    my $justname = undef;
    if (!$is_global) {
	($justname) = ($qualname =~ m/$NAMERE$/);
	parse_warn("no match to m/$NAMERE\$/ in '$qualname'") unless $justname;
    }
    my $def = {
	qualname => $qualname,
	is_global => $is_global,
	actualname => $actualname,
	justname => $justname,
	deftype => $deftype,
	filename => $fname,
	startline => $lineno,
	linenos => [],    # used only if $is_global, a list of line numbers
	params => $params,
	level => $level,
	parentqual => $parentqual,
	protoname => $protoname,
	aliasto => $aliasto,
	refs => {},      # all references found in body of this definition. hash from $qualname to [$reftype, $lineno]
        undefs => [],    # list of keys from refs which are not defined.
	usedby => [],    # array of other $def's which point to this one.
        used => 0,
	added => 0,
    };
    my $existing = $DEFS_BY_QUAL->{$qualname};
    my $do_replace = 1;
    if ($existing) {
	# don't warn if either of type 'assign' (and same file?)
	if ( # $existing->{filename} eq $def->{filename} &&
	    ($existing->{deftype} eq 'assign' || $def->{deftype} eq 'assign')) {
            # don't replace a non-assign with an assign
	    if ($def->{deftype} eq 'assign') { 
		$do_replace = 0;
		parse_warn("preventing replacement of existing definition of '$qualname' at ", $existing->{filename}, ":", $existing->{startline}, 
			   " with an 'assign' definition") if $WARNOPTS->{dups};
	    }
	    else {
		parse_warn("allowing replacement of an existing 'assign' definition of '$qualname' at ", $existing->{filename}, ":", $existing->{startline}, 
			   " with another") if $WARNOPTS->{dups};
	    }

	}
	# don't warn if a localfunction
	elsif ($existing->{deftype} eq 'localfunc') {
	    debug("overriding previous definition of '$qualname' because localfunc");
	}
	else {
	    parse_warn("duplicate definition of '$qualname': ", Dumper($existing), Dumper($def)) if $WARNOPTS->{dups};
	}
    }
    $DEFS_BY_QUAL->{$qualname} = $def if $do_replace;

    # if $do_replace of $existing, then we better make sure that $existing knows not to
    # complain later....
    $existing->{replacedby} = $def if $do_replace && $existing;

    trace_sym($qualname, "storing def on '$qualname' with justname=$justname") if $justname;

    if ($justname) {
	my $a = $DEFS_BY_UNQUAL->{$justname};
	$DEFS_BY_UNQUAL->{$justname} = $a ? [@$a, $def] : [$def];
    }
    my $filedefs = $DEFS_BY_FNAME->{$fname};
    my ($already) = grep {$_->{qualname} eq $qualname} @$filedefs;
    parse_warn("The file $fname already has a definition for '$qualname' at ", $already->{filename}, ':', $already->{startline}) 
	if $WARNOPTS->{dups} && $already && ($already->{deftype} ne 'localfunc' || $def->{deftype} ne 'localfunc') ;
    push(@$filedefs, $def);

    debug("starting definition of '", def_name($def), "' with type '$deftype' at $fname:$lineno, level $level");
    return $def;
}

# used when displaying messages about a definition.
sub def_name {
    my ($def) = @_;
    my $q = $def->{qualname};
    if ($def->{is_global}) {
	return "(global expr)";
	my $sl = $def->{startline};
	my $ll = $def->{lastline};
	return "(expr lines $sl-$ll)"; # in $1)";
    }
    # return $def->{protoname} . ".prototype.$q" if $def->{protoname};
    return $q;
}

# note that this definition $def is referring to qualified symbol $refname.
# a single definition might refer to some other symbol multiple times; we only record one such case.
sub add_ref {
    my ($def, $refname, $reftype, $fname, $lineno) = @_;
    # we are currently at the next line, so subtract 1 from $. for zero-based line number.
    $lineno--;
    my ($startname) = ($refname =~ m/^(\w+)/);

    if ($refname eq $def->{qualname} || $refname eq $def->{actualname}) {
	debug("skipping recursive reference to '$refname' in ", def_name($def));
	return;
    }

    if ($def->{params}->{$refname}) {
	debug("skipping reference '$refname' in ", def_name($def), " because it is a parameter");
	return;
    }

    if (!$startname) {
	warning("reference name '$refname' does not start with word (reftype=$reftype), at $fname\:$lineno");
	return;
    }

    my $qualname = $refname;
    # my $actualname = $refname;
    if ($startname eq 'this') {
	if ($refname eq 'this') {debug("skipping 'this' as function"); return;}
	$qualname = qualify_ref_this($refname, $def);
    }
    elsif ($KEYWORDS{$startname}) {
	# debug("skipping keyword '$refname' at $fname:$lineno"); 
	return;
    }
    elsif ($BUILTIN_OBJECTS{$startname}) {
	# debug("skipping builtin object reference '$refname' at $fname:$lineno"); 
	return;
    }
    elsif ($BUILTIN_FUNCTIONS{$startname}) {
	# debug("skipping builtin function reference '$refname' at $fname:$lineno"); 
	return;
    }
    debug("adding reference '$refname' (qualname='$qualname') of type '$reftype' from ", def_name($def), " at $fname:$lineno : ", $_);
    # 3rd slot is to hold the definition, once we know it
    $def->{refs}->{$qualname} = [$reftype, $., undef];
}

sub is_parameter {
    my ($currentdef, $actualname) = @_;
    return ($currentdef && $actualname && $currentdef->{params}->{$actualname});
}

# parse the provided file (or expression)
sub parse_file {
    my ($f, $fileobj) = @_;

    my $fname = $fileobj->{filename};
    $CURRENT_FNAME = $fname;
    $DEFS_BY_FNAME->{$fname} = [];

    # the function def we are currently inside of, or the top-level script
    my $currentdef = add_def($GLOBALNAME, '', 'global', $fname, 0, 0, undef, undef, undef);
    $fileobj->{globaldef} = $currentdef;

    my $nested = [$currentdef];          # stack of functions being defined. 
    my $in_comment = 0;
    my $lines = []; 
    while(<$f>) {
	push(@$lines, "$_");
	chop;
	# debug("parsing $fname:$. : '$_'");

	# convert tabs to equivalent number of spaces
	s/\t/$TABSPACES/g;

	# a dumb C-comment parser, in case preprocessor didn't exclude them.
	# check for end of multi-line C comment
	if ($in_comment) {
	    if (m,\*/,) {
		$in_comment = 0;
		s,.*?\*/,,;
	    }
	    else {next;}
	}
	# remove C++ comment
	s,//.*$,,;
	# start of C comment.
	if (m,^\s*/\*,) {
	    if (m,\*/,) {
		s,/\*.*?\*/,,;
	    }
	    else {
		$in_comment = 1;
		next;
	    }
	}

	# entirely blank line
	next if m/^\s*$/;

	# collapse quotes
	s/"[^\\\"]*"/""/g;
	s/'[^\\\']*'/''/g;

	# determine indent level. 
	m/^( *)/;
	my $level = length($1)/$PREINDENT;

	# ugly assume global definitions are ones that start with a zero indent
	my $is_global = ($level == 0);

	# maybe done defining function
	my $lastlevel = $currentdef->{level};
	my $numnested = scalar(@$nested);
	my $popped = 0;
	if ($level <= $lastlevel && ($lastlevel > 0 || $numnested > 1)) {
	    debug("finishing definition of ", def_name($currentdef), " at line $. because $level <= $lastlevel\: '", $_, "'");
	    $popped = 1;
	    $currentdef->{lastline} = $.;
	    pop(@$nested);
	    $currentdef = $nested->[$numnested - 2];
	    die "no nested function definition to pop at: $_" unless $currentdef;
	}

	my $qualname = undef; # full qualified
	my $actualname = undef; # what actually was found in the file
	my $deftype = undef;
	my $protoname = undef;
	my $aliasto = undef;

	if (m/^ *function $NAMERE/ || m/^ *var $NAMERE = function/ ) {
	    $deftype = ($is_global ? 'globalfunc' : 'localfunc');
	    $qualname = $actualname = $1;
	}
	elsif (m/^$NAMERE = new function\(/ || m/^ *var $NAMERE = new function\(/) {
	    $deftype = 'singleton';
	    $qualname = $actualname = $1;
	}
	elsif (m/^ *this\.$NAMERE = function/) {
	    $deftype = 'ctormeth';
	    $actualname = "this.$1";
	    $qualname = qualify_def_this($1, $currentdef);
	}
	# TODO: Foo.prototype.meth = aliasfunc
	# TODO: var Foo = {methname : function ...
	elsif (m/^ *$QUALRE\.prototype\.$NAMERE = function/) {
	    $deftype = 'protometh';
	    $protoname = $1;
	    $actualname = $qualname = "$1\.prototype\.$2";
	}
	elsif (m/^ *$QUALRE\.$NAMERE = function/) {
	    $actualname = $qualname = "$1\.$2";
	    $deftype = 'instmeth';
	}

	# starting a function definition - register and continue loop
	my $wholebody;
	if ($deftype) {
	    my $parentdef = $currentdef;
	    $currentdef = add_def($qualname, $actualname, $deftype, $fname, $., $level, $parentdef, $protoname, $aliasto); 
	    push(@$nested, $currentdef);
	    # if line ends in an open curly, then there are no body lines to parse, and it will finish on another line
	    if (m/\{[\s\n]*$/) {
		next;
	    }
	    elsif (m/\{(.*)\}[\;\s\n]*$/) {
		debug("function begins and ends on same line $.: $_"); 
		$wholebody = $1;
		$_ = $wholebody;
	    }
	    else {
		parse_warn("definition start line does not end with open or closing bracket");
		next;
	    }
	}

	# if global expression, and not a new function definition, add the line to the currentdef
	if (!$popped && !$wholebody && $currentdef->{is_global} && ! m/^[\s\n\r]*$/) {
	    my $linenos = $currentdef->{linenos};
	    push(@$linenos, $. - 1);
	    # debug("pushing expression line ", $. - 1);
	}
	else {
	    debug("not in a global expression at $.: ", $popped, $currentdef->{is_global}, ': ', $_);
	}

	# deal with assignment. This could be both a definition (LHS) and reference (RHS). could also be an alias.
	if (!$deftype && (m/^ *$QUALRE = / || m/^ *var $NAMERE = /) && ($is_global || $ANALYZE_NESTED_ASSIGNMENTS) ) {
	    $deftype = 'assign';
	    $actualname = $qualname = $1;
	    if (is_parameter($currentdef, $actualname)) {
		debug("skipping assignment because it is to parameter '$actualname', at line $.");
	    }
	    elsif (@$nested > 1 && is_parameter($nested->[@$nested - 2], $actualname)) {
		debug("skipping assignment because it is to parameter '$actualname' of parent function, at line $.");
	    }
	    else {
		# we don't push a function defining context
		add_def($qualname, $actualname, $deftype, $fname, $., $level, $currentdef, $protoname, $aliasto);
	    }
	}
	else {
	    my $line = $_;
	    trace_sym($1, "did not match assignment") if grep {$line =~ m/$_/} keys %$TRACE_SYMS;
	    $_ = $line;
	}

	# Maybe warn because not starting a function definition, but contains the string 'function'.
	if (m/function/) {
	    # matches to the string 'function' that are normal and expected: 
	    #    closures in function calls: foobar(17, function(a, b) {
            #    returning a closure:        return function (o) {  
            #    closure on rhs, in level:   foobar = function (s) {
	    #    matches in string:          foobar("what is this function"); 
            #    matches in regexp:          var m = s.match(/function /);
            #    partial matches:            var s = foobar.functionName(f);
	    parse_warn("ignoring function defintion starting here") if $WARNOPTS->{functionmatch};
	}

	# scan this line for function references, using possibly qualified names

	# find all constructor calls (use of "new")
	my @ctorcalls = m/new $QUALRE/g;
	for my $csym (@ctorcalls) {
	    if (is_parameter($currentdef, $csym)) {
		debug "skipping call to constructor '$csym' because a parameter";
	    }
	    add_ref($currentdef, $csym, 'construct', $fname, $.);
	}

	# find all function calls (normal parens)
	my @funcalls = m/$QUALRE\(/g;
	# exclude calls to methods of literal regexps such as /foo/i.exec();
	# TODO detect other things besides \w and / prior to .
	@funcalls = grep {! m/apply$/ && ! m/call$/ && !m,^\.,} @funcalls;
	for my $fsym (@funcalls) {
	    if (is_parameter($currentdef, $fsym)) {
		debug "skipping call to function '$fsym' because a parameter";
		next;
	    }
	    # TODO: should really track assignments, and check all ancestor scopes....
 	    elsif (@$nested > 1 && is_parameter($nested->[@$nested - 2], $fsym)) {
		debug "skipping call to function '$fsym' because a parameter to parent function";
		next;
	    }
	    my ($justname, $firstname) = split_name($fsym);
	    my $skip = 0;
	    if ($justname && $BUILTIN_METHODS{$justname}) {
		$skip = 1;
		if ($firstname eq $justname && $BUILTIN_FUNCTIONS{$firstname}) {
		    debug "skipping global builtin function reference to '$fsym'";
		}
		elsif ($firstname && is_parameter($currentdef, $firstname)) {
		    debug "skipping method reference to '$fsym' because parameter and builtin method";
		}
		elsif ($firstname && ($firstname ne $justname)) {
		    debug "skipping method reference to '$fsym' because builtin method even though object is not a parameter"; 
		}
		# right now, we miss matching expressions like: String(n).replace(/(\d)/, "$1.")
		# because of the parens in "String(n)", we just see "replace"
		elsif (m/\.$justname/) {
		    debug "skipping method reference to '$fsym' because builtin method and qualifier is an expression: $_";
		}
		else {
		    $skip = 0;
		    warning("adding reference to '$fsym' (justname=$justname, firstname=$firstname) even though a builtin method: ", $_);
		}
	    }

	    add_ref($currentdef, $fsym, 'call', $fname, $.) unless $skip;
	}

	# find all dynamic calls (use of "apply" or "call")
	my @applycalls = m/$QUALRE\.apply\s*\(/;
	my @callcalls = m/$QUALRE\.call\s*\(/; # don't want to match 'caller' etc.
	my @dyncalls = (@applycalls, @callcalls);
	for my $dynsym (@dyncalls) {
	    if (is_parameter($currentdef, $dynsym)) {
		debug "skipping dynamic call to '$dynsym' because a parameter";
		next;
	    }
	    add_ref($currentdef, $dynsym, 'dynamic', $fname, $.);
	}	

	# if function began and ended on this line, pop it
	if ($wholebody) {
	    $currentdef->{lastline} = $.;
	    pop(@$nested);
	    $currentdef = $nested->[scalar(@$nested) - 1];
	    die "no nested function definition to pop at line $." unless $currentdef;
	}
    }
    die "did not pop all nested definitions in file $fname: ", Dumper($nested) if scalar(@$nested) > 1;
    die "still in comment at end of file $fname" if $in_comment;
    $fileobj->{lines} = $lines;
}

sub preprocessor_command {
    my ($fname) = @_;
    return "cat $fname" if $PREPROCESSOR eq 'cat';
    return "java -classpath $RHINOJAR:$JSLINKERDIR JsLinker $fname" if $PREPROCESSOR eq 'rhino';
    die "unknown preprocessor '$PREPROCESSOR'";
}

# collect definitions and references
sub process_files {
    my ($fileobjs) = @_;
    for my $fileobj (@$fileobjs) {
	my $fname = $fileobj->{filename};
	my $cmd;
	if ($fileobj->{expr}) {
	    pipe PRE, STRING;
	    print STRING $fileobj->{expr};
	    close STRING;
	}
	else {
	    die "no such file '$fname'" unless -e $fname;
	    $cmd = preprocessor_command($fname) . ' |';
	    open(PRE, $cmd) || die "can't open $cmd: $!";
	}
	parse_file(PRE, $fileobj);
	close(PRE);
    }
}

sub split_name {
    my ($qualname) = @_;
    my ($justname) = ($qualname =~ m/$NAMERE$/);
    warning("no justname in '$qualname'") unless $justname;
    my ($firstname) = ($qualname =~ m/^$NAMERE/);
    warning("no firstname in '$qualname'") unless $firstname;
    return ($justname, $firstname);
}

sub find_def {
    my ($refname, $fromdef, $undefs_hash) = @_;

    my ($justname, $firstname) = split_name($refname);

    # look up definition object by full name
    my $todef = $DEFS_BY_QUAL->{$refname};

    return $todef if $todef;

    # don't bother tracking a builtin method name
    if ($BUILTIN_METHODS{$justname}) {
	debug("ignoring reference to builtin method in $refname");
	return undef;
    }

    # not found, try to find less strict match.
    # if find multiple, warn.
    # if still find none, collect in an 'undefined' collection.
    my $is_local = $fromdef->{params}->{$firstname} ? 1 : 0 ;
    trace_sym($refname, "is_local=$is_local, firstname=$firstname, fromdef=", def_name($fromdef), ", params=", Dumper($fromdef->{params}));

    my $unqual_defs = $DEFS_BY_UNQUAL->{$justname};
    my $mess = "reference '$refname' from " . def_name($fromdef) . " at " . $fromdef->{filename} . ':' . $fromdef->{startline};
    # attempt to find matches to just the unqualified last part of the name
    if ($unqual_defs) {
	my $num_unqual = scalar(@$unqual_defs);
	if ($num_unqual > 1) {
	    warning("no fully qualified matches, found $num_unqual matches to '$justname', " . $mess) if $WARNOPTS->{ambigs};
	}
	elsif ($num_unqual == 0) {
	    die "no unqualified matches for '$justname' yet entry exists in DEFS_BY_UNQUAL";
	}
	else {
	    debug("found 1 match to justname='$justname', " . $mess);
	}
	$todef = $unqual_defs->[0] || die("no 0 entry in ", Dumper($unqual_defs));
    }
    # no matches to unqualified name either, collect it.
    elsif ($undefs_hash) {
	my $def_undefs = $fromdef->{undefs};
	push(@$def_undefs, $refname);
	$undefs_hash->{$refname} = $fromdef;
    }
    return $todef;
}

# perform transitive closure determining what other functions are required
sub transitive_closure {
    my ($start_defs) = @_;

    my $used_defs = [];
    my $new_defs = $start_defs;
    my $loopcount = 1;
    my $used_undefs = {};
    my $unused_undefs = {};

    # loop as long we we added new definitions in the last pass.
    # we start with the "anchor" definitions.
    # note that this will only find undefined symbols among smbols pulled in.
    while (scalar(@$new_defs) > 0) {
	debug("starting loop $loopcount with ", scalar(@$new_defs), " definitions");
	my $current_defs = $new_defs;
	$new_defs = [];

	# loop over all (new definitions), looking at what they refer to, and pulling those in if not already 
	for my $fromdef (@$current_defs) {
	    my $refs = $fromdef->{refs};
	    my $fromqual = $fromdef->{qualname};
	    # print STDERR "**** $loopcount $fromdef->{used} $fromdef->{added} FROM $fromqual\n";

	    # loop over all refs from this definition
	    for my $refname (keys %$refs) {
		# print STDERR "******** $loopcount REF $refname\n";
		my $todef = find_def($refname, $fromdef, $used_undefs);

		if ($todef) {
		    # add this reference to the definition's usedby array
		    my $usedby = $todef->{usedby};
		    my ($already) = grep {$_->{qualname} eq $fromqual} @$usedby;
		    if ($already) {
			warning("attempt to do duplicate add of '$fromqual' to usedby of '", $todef->{qualname}, "' because of refname '$refname'");
		    }
		    else {
			push(@$usedby, $fromdef);
		    }

		    # record it in the refinfo
		    $refs->{$refname}->[2] = $todef;

		    # add the definition we have pulled in to $new_defs (if it hasn't already been processed, 
		    # and we haven't already added it in this loop).
		    if (!$todef->{used} && !$todef->{added}) {
			$todef->{added} = 1;
			push(@$new_defs, $todef);

			# see if $todef is from a file we haven't pulled in before (but isn't the globaldef itself)
			if (!$todef->{is_global}) {
			    my $fileobj = $FILEOBJS_BY_NAME->{$todef->{filename}} || die "no fileobj for definition filename " . $todef->{filename};
			    my $globaldef = $fileobj->{globaldef} || die "no globaldef in fileobj: ", Dumper($fileobj);
			    if (!$globaldef->{used} && !$globaldef->{added}) {
				$globaldef->{added} = 1;
				debug "adding global def for file ", $todef->{filename}, " pulled in by $refname";
				push(@$new_defs, $globaldef);
			    }
			}
		    }
		}
	    } # loop for refs

	    # mark this definition as having been processed
	    $fromdef->{used} = $loopcount;
	} # for $new_defs
	$loopcount++;
	push(@$used_defs, @$current_defs);
    }

    # also track undefined symbols in unused functions
    if ($FIND_UNDEFINED_IN_UNUSED) {
	my $all_defs = [values %$DEFS_BY_QUAL];
	for my $def (@$all_defs) {
	    # just because it is marked as used by one ref doesn't mean that all refs know about it
	    # next if $def->{used};
	    my $refs = $def->{refs};
	    my $defname = $def->{qualname};
	    trace_sym($defname, "checking undefs for $defname");
	    for my $refname (keys %$refs) {
		my $refinfo = $refs->{$refname};
		if ($refinfo->[2]) {
		    trace_sym([$defname,$refname], "looking for definition of '$refname' used by '$defname', but it ref already has a definition");
		    next ;
		}
		my $todef = find_def($refname, $def, $unused_undefs);
		trace_sym([$defname,$refname], "looking for definition of '$refname' used by '$defname'; ", ($todef ? "found definition" : "did not find definition"));
		# record it in the refinfo
		$refs->{$refname}->[2] = $todef if $todef;
	    }
	}
    }

    return ($used_defs, $loopcount, $used_undefs, $unused_undefs);
}

sub dump_syms {
    my ($fileobjs, $used_undefs, $unused_undefs) = @_;

    *DUMP = *STDOUT;

    for my $fileobj (@$fileobjs) {
	my $fname = $fileobj->{filename};
	my $fdefs = $DEFS_BY_FNAME->{$fname};

	# filename summary
	my $ndefs = scalar(@$fdefs);
	my @used = grep {$_->{used}} @$fdefs;
	my $nused = scalar(@used);
	my $nunused = $ndefs - $nused;
	print DUMP "DUMP: symbols in '$fname': ";
	if ($fileobj->{is_anchor}) {print DUMP "anchor input, with $ndefs definitions\n";}
	else {
	    if (!$DUMPOPTS->{unused} && !$fileobj->{globaldef}->{used}) {
		debug("skipping unused file, since all symbols in it will be unused");
		next;
	    }
	    print DUMP "library input, with $nused used, $nunused unused\n";
	}

	for my $def (@$fdefs) {
	    next if $def->{deftype} eq 'assign';

	    my $usedby;
	    my $nused = 0;
	    if ($def->{used}) {
		next unless $DUMPOPTS->{used};
		$usedby = $def->{usedby};
		$nused = scalar(@$usedby);
	    }
	    else {
		next unless $DUMPOPTS->{unused};
	    }

	    # per definition summary
	    # print DUMP sprintf("%s%-10s %3d %s\n", $DUMPINDENT, $def->{deftype}, $nused, def_name($def));
	    print DUMP sprintf("%s%-30s type=%-10s used=%-3d lineno=%-3d\n", $DUMPINDENT, def_name($def), $def->{deftype}, $nused, $def->{startline});

	    my $replacedby = $def->{replacedby};
	    if ($replacedby) {
		print DUMP $DUMPINDENT, $DUMPINDENT, 'REPLACED BY: ', $replacedby->{filename}, ':', $replacedby->{startline}, "\n";
		next;
	    }

	    my $refs = $def->{refs};
	    my $undefs = $def->{undefs};
	    if ($DUMPOPTS->{refs} && (scalar(keys %$refs) - scalar(@$undefs)) > 0) {
		print DUMP $DUMPINDENT, $DUMPINDENT, 'DEFINED REFERENCES:', "\n";
		for my $refname (keys %$refs) {
		    my $refinfo = $refs->{$refname};
		    my ($reftype, $reflineno, $def_for_ref) = @$refinfo;
		    my $def_for_ref2 = $DEFS_BY_QUAL->{$refname};
		    # my $def_for_ref = find_def($refname, $def);
		    if (!$def_for_ref) {
			warning "no definition for reference '$refname' but not in this def's undefs (@$undefs)" unless grep {$_ eq $refname} @$undefs;
			warning "undefined reference '$refname' not in global undefs" unless $used_undefs->{$refname} || $unused_undefs->{$refname};
			warning "but in DEFS_BY_QUAL->{$refname}" if $def_for_ref2;
			next;
		    }
		    print DUMP $DUMPINDENT, $DUMPINDENT, $DUMPINDENT, $refname, 
		    ' defined at ', $def_for_ref->{filename}, ':', $def_for_ref->{startline},
		    ' used at ', $fname, ':', $reflineno, "\n";
		}
	    }

	    # indented list of undefined references from within this function
	    if ($DUMPOPTS->{undefs} && scalar(@$undefs) > 0) {
		print DUMP $DUMPINDENT, $DUMPINDENT, 'UNDEFINED REFERENCES:', "\n";
		for my $refsym (@$undefs) {
		    my $refinfo = $def->{refs}->{$refsym};
		    my ($reftype, $reflineno) = @$refinfo;
		    print DUMP $DUMPINDENT, $DUMPINDENT, $DUMPINDENT, $refsym, 
		    ' used at ', $fname, ':', $reflineno, "\n";
		}
	    }

	    # if desired, list usedby for this definition
	    if ($DUMPOPTS->{usedby} && $nused > 0) {
		print $DUMPINDENT, $DUMPINDENT, 'USED BY:', "\n";
		for my $usedef (@$usedby) {
		    print DUMP $DUMPINDENT, $DUMPINDENT, $DUMPINDENT, def_name($usedef), ' at ', $usedef->{filename}, ':', $usedef->{startline}, "\n";
		}
	    }
	}
    }
}

sub print_some_ {
    my ($lines, $lineno_ind, $linenos, $startline) = @_;
    my $globalcount = 0;
    while ($lineno_ind < scalar(@$linenos) && ($startline < 0 || $linenos->[$lineno_ind] < $startline)) {
	if ($globalcount == 0) {
	    print OUT "// some global statements\n" if $OUTOPTS->{sourcelines};
	    $globalcount++;
	}
	my $lineno = $linenos->[$lineno_ind];
	print OUT "// line $lineno\n" if $OUTOPTS->{sourcelines};
	print OUT $lines->[$lineno];
	$lineno_ind++;
    }
    return $lineno_ind;
}

sub print_minimal_files {
    my ($fileobjs) = @_;

    if ($OUTFILE eq '-') {
	*OUT = *STDOUT;
    }
    else {
	open(OUT, ">$OUTFILE") || die "can't open output file $OUTFILE: $!";
    }
    my $count = -1;
    for my $fileobj (@$fileobjs) {
	$count++;
	my $fname = $fileobj->{filename};
	# skip anchor files; we know they have everything
	next if $fileobj->{is_anchor};

	my $globaldef = $fileobj->{globaldef};
	if (! $globaldef->{used}) {
	    debug "skipping file $fname because not used";
	    next;
	}

	print OUT "// STARTING FILE $fname\n" if $OUTOPTS->{filemarker};
	my $fdefs = $DEFS_BY_FNAME->{$fname} || die "no definitions for file '$fname'";
	$fdefs = [sort {$a->{startline} <=> $b->{startline}} @$fdefs]; 

	my $linenos = $globaldef->{linenos};

	# filename summary
	my $ndefs = scalar(@$fdefs);

	my $lines = $fileobj->{lines};

	my $lineno_ind = 0;
	for my $def (@$fdefs) {
	    next if $def->{deftype} eq 'assign';
	    my $usedby;
	    my $nused = 0;
	    if ($def->{used}) {
		$usedby = $def->{usedby};
		$nused = scalar(@$usedby);
	    }
	    my $startline = $def->{startline};

	    $lineno_ind = print_some_($lines, $lineno_ind, $linenos, $startline);

	    if (!$usedby || scalar(@$usedby) == 0) {
		print OUT "// skipping unused ", def_name($def), " from ", $def->{filename}, ":$startline : ", $lines->[$startline] if $OUTOPTS->{skipped};
	    }
	    else {
		my $lastline = $def->{lastline};
		if (!defined($lastline)) {
		    print OUT "// WARNING: no last line for function ", def_name($def), " starting at ",  $def->{filename}, ":$startline\n";
		}
		else {
		    print OUT "// definition ", def_name($def), " from ", $def->{filename}, ":$startline\n" if $OUTOPTS->{sourcelines};
		    for my $i ($startline..$lastline) {
			print OUT $lines->[$i];
		    }
		}
	    }
	}
	print_some_($lines, $lineno_ind, $linenos, -1);
    }
    close OUT unless $OUTFILE eq '-';
}

sub dump_undefs {
    my ($undefs_hash) = @_;
    my $s = '';
    for my $refname (keys %$undefs_hash) {
	my $fromdef = $undefs_hash->{$refname};
	$s .= $SYMSEP . $refname . ' referenced from ' . $fromdef->{filename} . ':' . $fromdef->{startline} . "\n";
    }
    return $s;
}

sub main {
    my $fileobjs = process_commandline();

    # collect definitions and references
    process_files($fileobjs);

    # collect anchor file(s) and/or defs
    my $start_defs = [];
    my $anchor_filenames = [];
    for (@$fileobjs) {
	my $filename = $_->{filename};
	next unless $_->{is_anchor};
	my $anchor_defs = $DEFS_BY_FNAME->{$filename};
	push(@$anchor_filenames, $filename);
	push(@$start_defs, @$anchor_defs);
    }
    die "no anchor files" unless @$anchor_filenames;
    die "no starting definitions" unless @$start_defs;

    # perform transitive closure determining what other functions are required
    my ($used_defs, $loopcount, $used_undefs, $unused_undefs) = transitive_closure($start_defs);
    
    # overall summary
    my $number_start_globals = scalar(@$anchor_filenames);
    my $number_start = scalar(@$start_defs);
    my $number_used_undefs = (scalar keys %$used_undefs);
    my $number_unused_undefs = (scalar keys %$unused_undefs);
    my @used_fileobjs = grep {!$_->{is_anchor} && $_->{globaldef}->{used}} @$fileobjs;
    my @unused_fileobjs = grep {!$_->{is_anchor} && ! $_->{globaldef}->{used}} @$fileobjs;
    info("Anchor files: @$anchor_filenames\n",
	 "Number of anchor symbol definitions: ", ($number_start - $number_start_globals), "\n",
	 "Number of anchor global expressions: ", $number_start_globals, "\n",
	 "Number used library definitions: ", (scalar(@$used_defs) - scalar(@$start_defs)), "\n",
	 "Number unused library definitions: ", (scalar(keys %$DEFS_BY_QUAL) - (scalar @$used_defs)), "\n",
	 "Number of library files used: ", scalar(@used_fileobjs), "\n",
	 "Number of library files unused: ", scalar(@unused_fileobjs), "\n",
	 "Number loop iterations required to obtain transitive closure: $loopcount\n",
	 "Number undefined symbols in used code: $number_used_undefs\n",
	 "Undefined symbols in used code:\n", dump_undefs($used_undefs),
	 "Number undefined symbols in unused code: $number_unused_undefs\n",
	 "Undefined symbols in unused code:\n", dump_undefs($unused_undefs),
	 "");

    # list what files are not used at all, and what functions in files are not used
    dump_syms($fileobjs, $used_undefs, $unused_undefs) if $DUMPOPTS->{used} || $DUMPOPTS->{unused};

    die "not a single library file is used" unless scalar(@used_fileobjs) > 0;
    print_minimal_files($fileobjs) if $OUTOPTS->{used};

}


main();

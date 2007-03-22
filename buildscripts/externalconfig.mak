#
# you probably need to override some variables in this file, unless everything is in your path
#

PERL     := perl -w
CP       := cp

####
# JS javascript interpreter
####
JS = js -w -s
JSNAME = spidermonkey

# spidermonkey
#SPIDER_DIR= /Applications/js/src/Darwin_DBG.OBJ
#SPIDER_DIR= /Users/mda/bin
#JS = $(SPIDER_DIR)/js -w -s

# or xpcshell
#MOZ_DIR = /tmp/mozilla
#JS = $(MOZ_DIR)/run-mozilla.sh $(MOZ_DIR)/xpcshell -w

# or rhino
RHINO_OPT=-opt -1 #
RHINO_OPT=#
#RHINO_DIR = /Applications/rhino1_5R5pre
#RHINO_DIR = /Users/mda/Desktop/rhino1_5R4_1
RHINO_DIR = /Users/mda/Desktop/rhino1_5R5
#RHINO_DIR = /Users/mda/workspaces/mozilla/js/rhino/build/rhino1_5R5pre
# RHINO_CP is only needed for the JsLinker project
RHINO_CP   :=-classpath $(RHINO_DIR)/js.jar
#JS = java -jar $(RHINO_DIR)/js.jar
#JSNAME = rhino

# or windows cscript
#JSNAME = wsh

# or kjs
#JS = /home/mda/shared/src/javascript/JavaScriptCore/kjs/testkjs.linux
# JS = /Users/mda/Desktop/JavaScriptCore/kjs/kjs

####
# JSC
####
# Rotor (shared source JScript .NET)
# JSC_DIR := /users/mda/workspaces/sscli/build/v1.ppcfstchk.rotor/
JSC_DIR := /users/mda/workspaces/sscli/build/v1.ppcfstchk.rotor/
JSC_DIR := /usr/local/src/sscli_linux_20020821/clr/src/tools/
CLIX := $(JSC_DIR)clix
JSC := $(CLIX) $(JSC_DIR)jsc.exe

####
# DOXYGEN
####
DOXYGEN = doxygen

#####
# DOT (from graphviz)
####
DOT = dot
#DOT = `which dot 2>/dev/null`

####
# POD2HTML (for extracting source comment from .pod or .pl files)
####
# must use $< as input and $@ as output
# there is no way to turn off pod2html's double quote conversion, so we post process
POD2HTML = pod2html --verbose --norecurse --podroot=$(DOCSRC_DIR) --infile=$< --css=burstsite.css | perl -pe "s/\`\`/\"/g; s/\'\'/\"/g" > $@

####
# rst2html (for converting reStructuredText to html)
####
# from http://docutils.sourceforge.net
RST2HTML := rst2html.py

####
# xsltproc (for doing docbook processing)
# from http://xmlsoft.org/XSLT/xsltproc2.html
####
XSLTPROC := xsltproc

####
# docbook-xsl
# from http://docbook.sourceforge.net
####

# "apt-get install docbook-xsl" puts it here.
DOCBOOK_XSL := /usr/share/xml/docbook/stylesheet/nwalsh/xhtml/docbook.xsl

# docbook dtd is for validation. 
# "apt-get install docbook" puts it here.
DOCBOOK_DTD_DIR := /usr/share/sgml/docbook/dtd/4.3




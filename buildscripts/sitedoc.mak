sitedoc: copyfiles rest docbook

####
# target "copyfiles"
# copy files over that require no processing (images, css, html, txt, pdf)
####

COPY_SRC_FILES  := $(shell find $(TOP)/documents -name '*.html' -o -name '*.png' -o -name '*.jpg' -o -name '*.gif' -o -name '*.css' | grep -v docbook)
COPY_DEST_FILES := $(patsubst $(TOP)/documents/%,$(WEBSITE)/%,$(COPY_SRC_FILES))

copyfiles: $(COPY_DEST_FILES)

$(COPY_DEST_FILES): $(WEBSITE)/%: $(TOP)/documents/%
	@mkdir -p $(dir $@)
	$(CP) $< $@

####
# target "rest"
# process files in reStructuredText format
####
REST_SRC_FILES  := $(shell find $(TOP)/documents -name '*.rst')
REST_DEST_FILES := $(patsubst $(TOP)/documents/%.rst,$(WEBSITE)/%.html,$(REST_SRC_FILES))

rest: $(REST_DEST_FILES) $(WEBSITE)/js_style_guide.html

$(WEBSITE)/js_style_guide.html: $(TOP)/documents/js_style_guide.txt
	@mkdir -p $(dir $@)
	$(RST2HTML) $< $@

$(REST_DEST_FILES): $(WEBSITE)/%.html: $(TOP)/documents/%.rst
	@mkdir -p $(dir $@)
	$(RST2HTML) $< $@

####
# target "docbook"
# process files in docbook format
####

DB_SRC_FILES :=
DB_DEST_FILES :=

docbook: $(DB_DEST_FILES) $(WEBSITE)/requirements.html

# FYI, a "failed to load external entity" warning on docbookx.dtd seems benign. 
$(WEBSITE)/requirements.html: $(TOP)/documents/requirements.docbook $(DOCBOOK_XSL)
	@mkdir -p $(dir $@)
	$(XSLTPROC) -o $@ $(DOCBOOK_XSL) $<

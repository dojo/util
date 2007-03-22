#!/usr/bin/python

docfile = open("inline_generated.html", "r")
docfilelines = docfile.readlines()

subdocfile = False

for line in docfilelines:
	if line[:6] == "------":
		subdocfile = open('%s.html' % line[6:-1], "w")
	elif subdocfile:
		subdocfile.write(line)

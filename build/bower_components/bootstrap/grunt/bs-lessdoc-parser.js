/*!
 * Bootstrap Grunt task for parsing Less docstrings
 * http://getbootstrap.com
 * Copyright 2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */
'use strict';

var Markdown = require('markdown-it');

function markdown2html(markdownString) {
  var md = new Markdown();

  // the slice removes the <p>...</p> wrapper output by Markdown processor
  return md.render(markdownString.trim()).slice(3, -5);
}


/*
Mini-language:
  //== This is a normal heading, which starts a section. Sections group variables together.
  //## Optional description for the heading

  //=== This is a subheading.

  //** Optional description for the following variable. You **can** use Markdown in descriptions to discuss `<html>` stuff.
  @foo: #fff;

  //-- This is a heading for a section whose variables shouldn't be customizable

  All other lines are ignored completely.
*/


var CUSTOMIZABLE_HEADING = /^[/]{2}={2}(.*)$/;
var UNCUSTOMIZABLE_HEADING = /^[/]{2}-{2}(.*)$/;
var SUBSECTION_HEADING = /^[/]{2}={3}(.*)$/;
var SECTION_DOCSTRING = /^[/]{2}#{2}(.+)$/;
var VAR_ASSIGNMENT = /^(@[a-zA-Z0-9_-]+):[ ]*([^ ;][^;]*);[ ]*$/;
var VAR_DOCSTRING = /^[/]{2}[*]{2}(.+)$/;

function Section(heading, customizable) {
  this.heading = heading.trim();
  this.id = this.heading.replace(/\s+/g, '-').toLowerCase();
  this.customizable = customizable;
  this.docstring = null;
  this.subsections = [];
}

Section.prototype.addSubSection = function (subsection) {
  this.subsections.push(subsection);
};

function SubSection(heading) {
  this.heading = heading.trim();
  this.id = this.heading.replace(/\s+/g, '-').toLowerCase();
  this.variables = [];
}

SubSection.prototype.addVar = function (variable) {
  this.variables.push(variable);
};

function VarDocstring(markdownString) {
  this.html = markdown2html(markdownString);
}

function SectionDocstring(markdownString) {
  this.html = markdown2html(markdownString);
}

function Variable(name, defaultValue) {
  this.name = name;
  this.defaultValue = defaultValue;
  this.docstring = null;
}

function Tokenizer(fileContent) {
  this._lines = fileContent.split('\n');
  this._next = undefined;
}

Tokenizer.prototype.unshift = function (token) {
  if (this._next !== undefined) {
    throw new Error('Attempted to unshift twice!');
  }
  this._next = token;
};

Tokenizer.prototype._shift = function () {
  // returning null signals EOF
  // returning undefined means the line was ignored
  if (this._next !== undefined) {
    var result = this._next;
    this._next = undefined;
    return result;
  }
  if (this._lines.length <= 0) {
    return null;
  }
  var line = this._lines.shift();
  var match = null;
  match = SUBSECTION_HEADING.exec(line);
  if (match !== null) {
    return new SubSection(match[1]);
  }
  match = CUSTOMIZABLE_HEADING.exec(line);
  if (match !== null) {
    return new Section(match[1], true);
  }
  match = UNCUSTOMIZABLE_HEADING.exec(line);
  if (match !== null) {
    return new Section(match[1], false);
  }
  match = SECTION_DOCSTRING.exec(line);
  if (match !== null) {
    return new SectionDocstring(match[1]);
  }
  match = VAR_DOCSTRING.exec(line);
  if (match !== null) {
    return new VarDocstring(match[1]);
  }
  var commentStart = line.lastIndexOf('//');
  var varLine = (commentStart === -1) ? line : line.slice(0, commentStart);
  match = VAR_ASSIGNMENT.exec(varLine);
  if (match !== null) {
    return new Variable(match[1], match[2]);
  }
  return undefined;
};

Tokenizer.prototype.shift = function () {
  while (true) {
    var result = this._shift();
    if (result === undefined) {
      continue;
    }
    return result;
  }
};

function Parser(fileContent) {
  this._tokenizer = new Tokenizer(fileContent);
}

Parser.prototype.parseFile = function () {
  var sections = [];
  while (true) {
    var section = this.parseSection();
    if (section === null) {
      if (this._tokenizer.shift() !== null) {
        throw new Error('Unexpected unparsed section of file remains!');
      }
      return sections;
    }
    sections.push(section);
  }
};

Parser.prototype.parseSection = function () {
  var section = this._tokenizer.shift();
  if (section === null) {
    return null;
  }
  if (!(section instanceof Section)) {
    throw new Error('Expected section heading; got: ' + JSON.stringify(section));
  }
  var docstring = this._tokenizer.shift();
  if (docstring instanceof SectionDocstring) {
    section.docstring = docstring;
  }
  else {
    this._tokenizer.unshift(docstring);
  }
  this.parseSubSections(section);

  return section;
};

Parser.prototype.parseSubSections = function (section) {
  while (true) {
    var subsection = this.parseSubSection();
    if (subsection === null) {
      if (section.subsections.length === 0) {
        // Presume an implicit initial subsection
        subsection = new SubSection('');
        this.parseVars(subsection);
      }
      else {
        break;
      }
    }
    section.addSubSection(subsection);
  }

  if (section.subsections.length === 1 && !(section.subsections[0].heading) && section.subsections[0].variables.length === 0) {
    // Ignore lone empty implicit subsection
    section.subsections = [];
  }
};

Parser.prototype.parseSubSection = function () {
  var subsection = this._tokenizer.shift();
  if (subsection instanceof SubSection) {
    this.parseVars(subsection);
    return subsection;
  }
  this._tokenizer.unshift(subsection);
  return null;
};

Parser.prototype.parseVars = function (subsection) {
  while (true) {
    var variable = this.parseVar();
    if (variable === null) {
      return;
    }
    subsection.addVar(variable);
  }
};

Parser.prototype.parseVar = function () {
  var docstring = this._tokenizer.shift();
  if (!(docstring instanceof VarDocstring)) {
    this._tokenizer.unshift(docstring);
    docstring = null;
  }
  var variable = this._tokenizer.shift();
  if (variable instanceof Variable) {
    variable.docstring = docstring;
    return variable;
  }
  this._tokenizer.unshift(variable);
  return null;
};


module.exports = Parser;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJib290c3RyYXAvZ3J1bnQvYnMtbGVzc2RvYy1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXG4gKiBCb290c3RyYXAgR3J1bnQgdGFzayBmb3IgcGFyc2luZyBMZXNzIGRvY3N0cmluZ3NcbiAqIGh0dHA6Ly9nZXRib290c3RyYXAuY29tXG4gKiBDb3B5cmlnaHQgMjAxNCBUd2l0dGVyLCBJbmMuXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBNYXJrZG93biA9IHJlcXVpcmUoJ21hcmtkb3duLWl0Jyk7XG5cbmZ1bmN0aW9uIG1hcmtkb3duMmh0bWwobWFya2Rvd25TdHJpbmcpIHtcbiAgdmFyIG1kID0gbmV3IE1hcmtkb3duKCk7XG5cbiAgLy8gdGhlIHNsaWNlIHJlbW92ZXMgdGhlIDxwPi4uLjwvcD4gd3JhcHBlciBvdXRwdXQgYnkgTWFya2Rvd24gcHJvY2Vzc29yXG4gIHJldHVybiBtZC5yZW5kZXIobWFya2Rvd25TdHJpbmcudHJpbSgpKS5zbGljZSgzLCAtNSk7XG59XG5cblxuLypcbk1pbmktbGFuZ3VhZ2U6XG4gIC8vPT0gVGhpcyBpcyBhIG5vcm1hbCBoZWFkaW5nLCB3aGljaCBzdGFydHMgYSBzZWN0aW9uLiBTZWN0aW9ucyBncm91cCB2YXJpYWJsZXMgdG9nZXRoZXIuXG4gIC8vIyMgT3B0aW9uYWwgZGVzY3JpcHRpb24gZm9yIHRoZSBoZWFkaW5nXG5cbiAgLy89PT0gVGhpcyBpcyBhIHN1YmhlYWRpbmcuXG5cbiAgLy8qKiBPcHRpb25hbCBkZXNjcmlwdGlvbiBmb3IgdGhlIGZvbGxvd2luZyB2YXJpYWJsZS4gWW91ICoqY2FuKiogdXNlIE1hcmtkb3duIGluIGRlc2NyaXB0aW9ucyB0byBkaXNjdXNzIGA8aHRtbD5gIHN0dWZmLlxuICBAZm9vOiAjZmZmO1xuXG4gIC8vLS0gVGhpcyBpcyBhIGhlYWRpbmcgZm9yIGEgc2VjdGlvbiB3aG9zZSB2YXJpYWJsZXMgc2hvdWxkbid0IGJlIGN1c3RvbWl6YWJsZVxuXG4gIEFsbCBvdGhlciBsaW5lcyBhcmUgaWdub3JlZCBjb21wbGV0ZWx5LlxuKi9cblxuXG52YXIgQ1VTVE9NSVpBQkxFX0hFQURJTkcgPSAvXlsvXXsyfT17Mn0oLiopJC87XG52YXIgVU5DVVNUT01JWkFCTEVfSEVBRElORyA9IC9eWy9dezJ9LXsyfSguKikkLztcbnZhciBTVUJTRUNUSU9OX0hFQURJTkcgPSAvXlsvXXsyfT17M30oLiopJC87XG52YXIgU0VDVElPTl9ET0NTVFJJTkcgPSAvXlsvXXsyfSN7Mn0oLispJC87XG52YXIgVkFSX0FTU0lHTk1FTlQgPSAvXihAW2EtekEtWjAtOV8tXSspOlsgXSooW14gO11bXjtdKik7WyBdKiQvO1xudmFyIFZBUl9ET0NTVFJJTkcgPSAvXlsvXXsyfVsqXXsyfSguKykkLztcblxuZnVuY3Rpb24gU2VjdGlvbihoZWFkaW5nLCBjdXN0b21pemFibGUpIHtcbiAgdGhpcy5oZWFkaW5nID0gaGVhZGluZy50cmltKCk7XG4gIHRoaXMuaWQgPSB0aGlzLmhlYWRpbmcucmVwbGFjZSgvXFxzKy9nLCAnLScpLnRvTG93ZXJDYXNlKCk7XG4gIHRoaXMuY3VzdG9taXphYmxlID0gY3VzdG9taXphYmxlO1xuICB0aGlzLmRvY3N0cmluZyA9IG51bGw7XG4gIHRoaXMuc3Vic2VjdGlvbnMgPSBbXTtcbn1cblxuU2VjdGlvbi5wcm90b3R5cGUuYWRkU3ViU2VjdGlvbiA9IGZ1bmN0aW9uIChzdWJzZWN0aW9uKSB7XG4gIHRoaXMuc3Vic2VjdGlvbnMucHVzaChzdWJzZWN0aW9uKTtcbn07XG5cbmZ1bmN0aW9uIFN1YlNlY3Rpb24oaGVhZGluZykge1xuICB0aGlzLmhlYWRpbmcgPSBoZWFkaW5nLnRyaW0oKTtcbiAgdGhpcy5pZCA9IHRoaXMuaGVhZGluZy5yZXBsYWNlKC9cXHMrL2csICctJykudG9Mb3dlckNhc2UoKTtcbiAgdGhpcy52YXJpYWJsZXMgPSBbXTtcbn1cblxuU3ViU2VjdGlvbi5wcm90b3R5cGUuYWRkVmFyID0gZnVuY3Rpb24gKHZhcmlhYmxlKSB7XG4gIHRoaXMudmFyaWFibGVzLnB1c2godmFyaWFibGUpO1xufTtcblxuZnVuY3Rpb24gVmFyRG9jc3RyaW5nKG1hcmtkb3duU3RyaW5nKSB7XG4gIHRoaXMuaHRtbCA9IG1hcmtkb3duMmh0bWwobWFya2Rvd25TdHJpbmcpO1xufVxuXG5mdW5jdGlvbiBTZWN0aW9uRG9jc3RyaW5nKG1hcmtkb3duU3RyaW5nKSB7XG4gIHRoaXMuaHRtbCA9IG1hcmtkb3duMmh0bWwobWFya2Rvd25TdHJpbmcpO1xufVxuXG5mdW5jdGlvbiBWYXJpYWJsZShuYW1lLCBkZWZhdWx0VmFsdWUpIHtcbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5kZWZhdWx0VmFsdWUgPSBkZWZhdWx0VmFsdWU7XG4gIHRoaXMuZG9jc3RyaW5nID0gbnVsbDtcbn1cblxuZnVuY3Rpb24gVG9rZW5pemVyKGZpbGVDb250ZW50KSB7XG4gIHRoaXMuX2xpbmVzID0gZmlsZUNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuICB0aGlzLl9uZXh0ID0gdW5kZWZpbmVkO1xufVxuXG5Ub2tlbml6ZXIucHJvdG90eXBlLnVuc2hpZnQgPSBmdW5jdGlvbiAodG9rZW4pIHtcbiAgaWYgKHRoaXMuX25leHQgIT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQXR0ZW1wdGVkIHRvIHVuc2hpZnQgdHdpY2UhJyk7XG4gIH1cbiAgdGhpcy5fbmV4dCA9IHRva2VuO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc2hpZnQgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIHJldHVybmluZyBudWxsIHNpZ25hbHMgRU9GXG4gIC8vIHJldHVybmluZyB1bmRlZmluZWQgbWVhbnMgdGhlIGxpbmUgd2FzIGlnbm9yZWRcbiAgaWYgKHRoaXMuX25leHQgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLl9uZXh0O1xuICAgIHRoaXMuX25leHQgPSB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpZiAodGhpcy5fbGluZXMubGVuZ3RoIDw9IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2YXIgbGluZSA9IHRoaXMuX2xpbmVzLnNoaWZ0KCk7XG4gIHZhciBtYXRjaCA9IG51bGw7XG4gIG1hdGNoID0gU1VCU0VDVElPTl9IRUFESU5HLmV4ZWMobGluZSk7XG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xuICAgIHJldHVybiBuZXcgU3ViU2VjdGlvbihtYXRjaFsxXSk7XG4gIH1cbiAgbWF0Y2ggPSBDVVNUT01JWkFCTEVfSEVBRElORy5leGVjKGxpbmUpO1xuICBpZiAobWF0Y2ggIT09IG51bGwpIHtcbiAgICByZXR1cm4gbmV3IFNlY3Rpb24obWF0Y2hbMV0sIHRydWUpO1xuICB9XG4gIG1hdGNoID0gVU5DVVNUT01JWkFCTEVfSEVBRElORy5leGVjKGxpbmUpO1xuICBpZiAobWF0Y2ggIT09IG51bGwpIHtcbiAgICByZXR1cm4gbmV3IFNlY3Rpb24obWF0Y2hbMV0sIGZhbHNlKTtcbiAgfVxuICBtYXRjaCA9IFNFQ1RJT05fRE9DU1RSSU5HLmV4ZWMobGluZSk7XG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xuICAgIHJldHVybiBuZXcgU2VjdGlvbkRvY3N0cmluZyhtYXRjaFsxXSk7XG4gIH1cbiAgbWF0Y2ggPSBWQVJfRE9DU1RSSU5HLmV4ZWMobGluZSk7XG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xuICAgIHJldHVybiBuZXcgVmFyRG9jc3RyaW5nKG1hdGNoWzFdKTtcbiAgfVxuICB2YXIgY29tbWVudFN0YXJ0ID0gbGluZS5sYXN0SW5kZXhPZignLy8nKTtcbiAgdmFyIHZhckxpbmUgPSAoY29tbWVudFN0YXJ0ID09PSAtMSkgPyBsaW5lIDogbGluZS5zbGljZSgwLCBjb21tZW50U3RhcnQpO1xuICBtYXRjaCA9IFZBUl9BU1NJR05NRU5ULmV4ZWModmFyTGluZSk7XG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xuICAgIHJldHVybiBuZXcgVmFyaWFibGUobWF0Y2hbMV0sIG1hdGNoWzJdKTtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5zaGlmdCA9IGZ1bmN0aW9uICgpIHtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5fc2hpZnQoKTtcbiAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59O1xuXG5mdW5jdGlvbiBQYXJzZXIoZmlsZUNvbnRlbnQpIHtcbiAgdGhpcy5fdG9rZW5pemVyID0gbmV3IFRva2VuaXplcihmaWxlQ29udGVudCk7XG59XG5cblBhcnNlci5wcm90b3R5cGUucGFyc2VGaWxlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VjdGlvbnMgPSBbXTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgc2VjdGlvbiA9IHRoaXMucGFyc2VTZWN0aW9uKCk7XG4gICAgaWYgKHNlY3Rpb24gPT09IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLl90b2tlbml6ZXIuc2hpZnQoKSAhPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgdW5wYXJzZWQgc2VjdGlvbiBvZiBmaWxlIHJlbWFpbnMhJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2VjdGlvbnM7XG4gICAgfVxuICAgIHNlY3Rpb25zLnB1c2goc2VjdGlvbik7XG4gIH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUucGFyc2VTZWN0aW9uID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VjdGlvbiA9IHRoaXMuX3Rva2VuaXplci5zaGlmdCgpO1xuICBpZiAoc2VjdGlvbiA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmICghKHNlY3Rpb24gaW5zdGFuY2VvZiBTZWN0aW9uKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgc2VjdGlvbiBoZWFkaW5nOyBnb3Q6ICcgKyBKU09OLnN0cmluZ2lmeShzZWN0aW9uKSk7XG4gIH1cbiAgdmFyIGRvY3N0cmluZyA9IHRoaXMuX3Rva2VuaXplci5zaGlmdCgpO1xuICBpZiAoZG9jc3RyaW5nIGluc3RhbmNlb2YgU2VjdGlvbkRvY3N0cmluZykge1xuICAgIHNlY3Rpb24uZG9jc3RyaW5nID0gZG9jc3RyaW5nO1xuICB9XG4gIGVsc2Uge1xuICAgIHRoaXMuX3Rva2VuaXplci51bnNoaWZ0KGRvY3N0cmluZyk7XG4gIH1cbiAgdGhpcy5wYXJzZVN1YlNlY3Rpb25zKHNlY3Rpb24pO1xuXG4gIHJldHVybiBzZWN0aW9uO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZVN1YlNlY3Rpb25zID0gZnVuY3Rpb24gKHNlY3Rpb24pIHtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgc3Vic2VjdGlvbiA9IHRoaXMucGFyc2VTdWJTZWN0aW9uKCk7XG4gICAgaWYgKHN1YnNlY3Rpb24gPT09IG51bGwpIHtcbiAgICAgIGlmIChzZWN0aW9uLnN1YnNlY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBQcmVzdW1lIGFuIGltcGxpY2l0IGluaXRpYWwgc3Vic2VjdGlvblxuICAgICAgICBzdWJzZWN0aW9uID0gbmV3IFN1YlNlY3Rpb24oJycpO1xuICAgICAgICB0aGlzLnBhcnNlVmFycyhzdWJzZWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgc2VjdGlvbi5hZGRTdWJTZWN0aW9uKHN1YnNlY3Rpb24pO1xuICB9XG5cbiAgaWYgKHNlY3Rpb24uc3Vic2VjdGlvbnMubGVuZ3RoID09PSAxICYmICEoc2VjdGlvbi5zdWJzZWN0aW9uc1swXS5oZWFkaW5nKSAmJiBzZWN0aW9uLnN1YnNlY3Rpb25zWzBdLnZhcmlhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBJZ25vcmUgbG9uZSBlbXB0eSBpbXBsaWNpdCBzdWJzZWN0aW9uXG4gICAgc2VjdGlvbi5zdWJzZWN0aW9ucyA9IFtdO1xuICB9XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlU3ViU2VjdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN1YnNlY3Rpb24gPSB0aGlzLl90b2tlbml6ZXIuc2hpZnQoKTtcbiAgaWYgKHN1YnNlY3Rpb24gaW5zdGFuY2VvZiBTdWJTZWN0aW9uKSB7XG4gICAgdGhpcy5wYXJzZVZhcnMoc3Vic2VjdGlvbik7XG4gICAgcmV0dXJuIHN1YnNlY3Rpb247XG4gIH1cbiAgdGhpcy5fdG9rZW5pemVyLnVuc2hpZnQoc3Vic2VjdGlvbik7XG4gIHJldHVybiBudWxsO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZVZhcnMgPSBmdW5jdGlvbiAoc3Vic2VjdGlvbikge1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIHZhciB2YXJpYWJsZSA9IHRoaXMucGFyc2VWYXIoKTtcbiAgICBpZiAodmFyaWFibGUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3Vic2VjdGlvbi5hZGRWYXIodmFyaWFibGUpO1xuICB9XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnBhcnNlVmFyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZG9jc3RyaW5nID0gdGhpcy5fdG9rZW5pemVyLnNoaWZ0KCk7XG4gIGlmICghKGRvY3N0cmluZyBpbnN0YW5jZW9mIFZhckRvY3N0cmluZykpIHtcbiAgICB0aGlzLl90b2tlbml6ZXIudW5zaGlmdChkb2NzdHJpbmcpO1xuICAgIGRvY3N0cmluZyA9IG51bGw7XG4gIH1cbiAgdmFyIHZhcmlhYmxlID0gdGhpcy5fdG9rZW5pemVyLnNoaWZ0KCk7XG4gIGlmICh2YXJpYWJsZSBpbnN0YW5jZW9mIFZhcmlhYmxlKSB7XG4gICAgdmFyaWFibGUuZG9jc3RyaW5nID0gZG9jc3RyaW5nO1xuICAgIHJldHVybiB2YXJpYWJsZTtcbiAgfVxuICB0aGlzLl90b2tlbml6ZXIudW5zaGlmdCh2YXJpYWJsZSk7XG4gIHJldHVybiBudWxsO1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlcjtcbiJdLCJmaWxlIjoiYm9vdHN0cmFwL2dydW50L2JzLWxlc3Nkb2MtcGFyc2VyLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
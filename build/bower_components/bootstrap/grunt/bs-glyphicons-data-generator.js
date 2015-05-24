/*!
 * Bootstrap Grunt task for Glyphicons data generation
 * http://getbootstrap.com
 * Copyright 2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */
'use strict';
var fs = require('fs');

module.exports = function generateGlyphiconsData(grunt) {
  // Pass encoding, utf8, so `readFileSync` will return a string instead of a
  // buffer
  var glyphiconsFile = fs.readFileSync('less/glyphicons.less', 'utf8');
  var glyphiconsLines = glyphiconsFile.split('\n');

  // Use any line that starts with ".glyphicon-" and capture the class name
  var iconClassName = /^\.(glyphicon-[a-zA-Z0-9-]+)/;
  var glyphiconsData = '# This file is generated via Grunt task. **Do not edit directly.**\n' +
                       '# See the \'build-glyphicons-data\' task in Gruntfile.js.\n\n';
  var glyphiconsYml = 'docs/_data/glyphicons.yml';
  for (var i = 0, len = glyphiconsLines.length; i < len; i++) {
    var match = glyphiconsLines[i].match(iconClassName);

    if (match !== null) {
      glyphiconsData += '- ' + match[1] + '\n';
    }
  }

  // Create the `_data` directory if it doesn't already exist
  if (!fs.existsSync('docs/_data')) {
    fs.mkdirSync('docs/_data');
  }

  try {
    fs.writeFileSync(glyphiconsYml, glyphiconsData);
  }
  catch (err) {
    grunt.fail.warn(err);
  }
  grunt.log.writeln('File ' + glyphiconsYml.cyan + ' created.');
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJib290c3RyYXAvZ3J1bnQvYnMtZ2x5cGhpY29ucy1kYXRhLWdlbmVyYXRvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIEJvb3RzdHJhcCBHcnVudCB0YXNrIGZvciBHbHlwaGljb25zIGRhdGEgZ2VuZXJhdGlvblxuICogaHR0cDovL2dldGJvb3RzdHJhcC5jb21cbiAqIENvcHlyaWdodCAyMDE0IFR3aXR0ZXIsIEluYy5cbiAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UpXG4gKi9cbid1c2Ugc3RyaWN0JztcbnZhciBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2VuZXJhdGVHbHlwaGljb25zRGF0YShncnVudCkge1xuICAvLyBQYXNzIGVuY29kaW5nLCB1dGY4LCBzbyBgcmVhZEZpbGVTeW5jYCB3aWxsIHJldHVybiBhIHN0cmluZyBpbnN0ZWFkIG9mIGFcbiAgLy8gYnVmZmVyXG4gIHZhciBnbHlwaGljb25zRmlsZSA9IGZzLnJlYWRGaWxlU3luYygnbGVzcy9nbHlwaGljb25zLmxlc3MnLCAndXRmOCcpO1xuICB2YXIgZ2x5cGhpY29uc0xpbmVzID0gZ2x5cGhpY29uc0ZpbGUuc3BsaXQoJ1xcbicpO1xuXG4gIC8vIFVzZSBhbnkgbGluZSB0aGF0IHN0YXJ0cyB3aXRoIFwiLmdseXBoaWNvbi1cIiBhbmQgY2FwdHVyZSB0aGUgY2xhc3MgbmFtZVxuICB2YXIgaWNvbkNsYXNzTmFtZSA9IC9eXFwuKGdseXBoaWNvbi1bYS16QS1aMC05LV0rKS87XG4gIHZhciBnbHlwaGljb25zRGF0YSA9ICcjIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgdmlhIEdydW50IHRhc2suICoqRG8gbm90IGVkaXQgZGlyZWN0bHkuKipcXG4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgJyMgU2VlIHRoZSBcXCdidWlsZC1nbHlwaGljb25zLWRhdGFcXCcgdGFzayBpbiBHcnVudGZpbGUuanMuXFxuXFxuJztcbiAgdmFyIGdseXBoaWNvbnNZbWwgPSAnZG9jcy9fZGF0YS9nbHlwaGljb25zLnltbCc7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBnbHlwaGljb25zTGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbWF0Y2ggPSBnbHlwaGljb25zTGluZXNbaV0ubWF0Y2goaWNvbkNsYXNzTmFtZSk7XG5cbiAgICBpZiAobWF0Y2ggIT09IG51bGwpIHtcbiAgICAgIGdseXBoaWNvbnNEYXRhICs9ICctICcgKyBtYXRjaFsxXSArICdcXG4nO1xuICAgIH1cbiAgfVxuXG4gIC8vIENyZWF0ZSB0aGUgYF9kYXRhYCBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0XG4gIGlmICghZnMuZXhpc3RzU3luYygnZG9jcy9fZGF0YScpKSB7XG4gICAgZnMubWtkaXJTeW5jKCdkb2NzL19kYXRhJyk7XG4gIH1cblxuICB0cnkge1xuICAgIGZzLndyaXRlRmlsZVN5bmMoZ2x5cGhpY29uc1ltbCwgZ2x5cGhpY29uc0RhdGEpO1xuICB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBncnVudC5mYWlsLndhcm4oZXJyKTtcbiAgfVxuICBncnVudC5sb2cud3JpdGVsbignRmlsZSAnICsgZ2x5cGhpY29uc1ltbC5jeWFuICsgJyBjcmVhdGVkLicpO1xufTtcbiJdLCJmaWxlIjoiYm9vdHN0cmFwL2dydW50L2JzLWdseXBoaWNvbnMtZGF0YS1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
/*!
 * Bootstrap Grunt task for generating raw-files.min.js for the Customizer
 * http://getbootstrap.com
 * Copyright 2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

/* global btoa: true */

'use strict';
var fs = require('fs');
var btoa = require('btoa');
var glob = require('glob');

function getFiles(type) {
  var files = {};
  var recursive = (type === 'less');
  var globExpr = (recursive ? '/**/*' : '/*');
  glob.sync(type + globExpr)
    .filter(function (path) {
      return type === 'fonts' ? true : new RegExp('\\.' + type + '$').test(path);
    })
    .forEach(function (fullPath) {
      var relativePath = fullPath.replace(/^[^/]+\//, '');
      files[relativePath] = (type === 'fonts' ? btoa(fs.readFileSync(fullPath)) : fs.readFileSync(fullPath, 'utf8'));
    });
  return 'var __' + type + ' = ' + JSON.stringify(files) + '\n';
}

module.exports = function generateRawFilesJs(grunt, banner) {
  if (!banner) {
    banner = '';
  }
  var dirs = ['js', 'less', 'fonts'];
  var files = banner + dirs.map(getFiles).reduce(function (combined, file) {
    return combined + file;
  }, '');
  var rawFilesJs = 'docs/assets/js/raw-files.min.js';
  try {
    fs.writeFileSync(rawFilesJs, files);
  }
  catch (err) {
    grunt.fail.warn(err);
  }
  grunt.log.writeln('File ' + rawFilesJs.cyan + ' created.');
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJib290c3RyYXAvZ3J1bnQvYnMtcmF3LWZpbGVzLWdlbmVyYXRvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIEJvb3RzdHJhcCBHcnVudCB0YXNrIGZvciBnZW5lcmF0aW5nIHJhdy1maWxlcy5taW4uanMgZm9yIHRoZSBDdXN0b21pemVyXG4gKiBodHRwOi8vZ2V0Ym9vdHN0cmFwLmNvbVxuICogQ29weXJpZ2h0IDIwMTQgVHdpdHRlciwgSW5jLlxuICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYXN0ZXIvTElDRU5TRSlcbiAqL1xuXG4vKiBnbG9iYWwgYnRvYTogdHJ1ZSAqL1xuXG4ndXNlIHN0cmljdCc7XG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xudmFyIGJ0b2EgPSByZXF1aXJlKCdidG9hJyk7XG52YXIgZ2xvYiA9IHJlcXVpcmUoJ2dsb2InKTtcblxuZnVuY3Rpb24gZ2V0RmlsZXModHlwZSkge1xuICB2YXIgZmlsZXMgPSB7fTtcbiAgdmFyIHJlY3Vyc2l2ZSA9ICh0eXBlID09PSAnbGVzcycpO1xuICB2YXIgZ2xvYkV4cHIgPSAocmVjdXJzaXZlID8gJy8qKi8qJyA6ICcvKicpO1xuICBnbG9iLnN5bmModHlwZSArIGdsb2JFeHByKVxuICAgIC5maWx0ZXIoZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgIHJldHVybiB0eXBlID09PSAnZm9udHMnID8gdHJ1ZSA6IG5ldyBSZWdFeHAoJ1xcXFwuJyArIHR5cGUgKyAnJCcpLnRlc3QocGF0aCk7XG4gICAgfSlcbiAgICAuZm9yRWFjaChmdW5jdGlvbiAoZnVsbFBhdGgpIHtcbiAgICAgIHZhciByZWxhdGl2ZVBhdGggPSBmdWxsUGF0aC5yZXBsYWNlKC9eW14vXStcXC8vLCAnJyk7XG4gICAgICBmaWxlc1tyZWxhdGl2ZVBhdGhdID0gKHR5cGUgPT09ICdmb250cycgPyBidG9hKGZzLnJlYWRGaWxlU3luYyhmdWxsUGF0aCkpIDogZnMucmVhZEZpbGVTeW5jKGZ1bGxQYXRoLCAndXRmOCcpKTtcbiAgICB9KTtcbiAgcmV0dXJuICd2YXIgX18nICsgdHlwZSArICcgPSAnICsgSlNPTi5zdHJpbmdpZnkoZmlsZXMpICsgJ1xcbic7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2VuZXJhdGVSYXdGaWxlc0pzKGdydW50LCBiYW5uZXIpIHtcbiAgaWYgKCFiYW5uZXIpIHtcbiAgICBiYW5uZXIgPSAnJztcbiAgfVxuICB2YXIgZGlycyA9IFsnanMnLCAnbGVzcycsICdmb250cyddO1xuICB2YXIgZmlsZXMgPSBiYW5uZXIgKyBkaXJzLm1hcChnZXRGaWxlcykucmVkdWNlKGZ1bmN0aW9uIChjb21iaW5lZCwgZmlsZSkge1xuICAgIHJldHVybiBjb21iaW5lZCArIGZpbGU7XG4gIH0sICcnKTtcbiAgdmFyIHJhd0ZpbGVzSnMgPSAnZG9jcy9hc3NldHMvanMvcmF3LWZpbGVzLm1pbi5qcyc7XG4gIHRyeSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhyYXdGaWxlc0pzLCBmaWxlcyk7XG4gIH1cbiAgY2F0Y2ggKGVycikge1xuICAgIGdydW50LmZhaWwud2FybihlcnIpO1xuICB9XG4gIGdydW50LmxvZy53cml0ZWxuKCdGaWxlICcgKyByYXdGaWxlc0pzLmN5YW4gKyAnIGNyZWF0ZWQuJyk7XG59O1xuIl0sImZpbGUiOiJib290c3RyYXAvZ3J1bnQvYnMtcmF3LWZpbGVzLWdlbmVyYXRvci5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
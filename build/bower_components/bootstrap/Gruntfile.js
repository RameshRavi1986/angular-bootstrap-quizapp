/*!
 * Bootstrap's Gruntfile
 * http://getbootstrap.com
 * Copyright 2013-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

module.exports = function (grunt) {
  'use strict';

  // Force use of Unix newlines
  grunt.util.linefeed = '\n';

  RegExp.quote = function (string) {
    return string.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  var fs = require('fs');
  var path = require('path');
  var npmShrinkwrap = require('npm-shrinkwrap');
  var generateGlyphiconsData = require('./grunt/bs-glyphicons-data-generator.js');
  var BsLessdocParser = require('./grunt/bs-lessdoc-parser.js');
  var getLessVarsData = function () {
    var filePath = path.join(__dirname, 'less/variables.less');
    var fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
    var parser = new BsLessdocParser(fileContent);
    return { sections: parser.parseFile() };
  };
  var generateRawFiles = require('./grunt/bs-raw-files-generator.js');
  var generateCommonJSModule = require('./grunt/bs-commonjs-generator.js');
  var configBridge = grunt.file.readJSON('./grunt/configBridge.json', { encoding: 'utf8' });

  Object.keys(configBridge.paths).forEach(function (key) {
    configBridge.paths[key].forEach(function (val, i, arr) {
      arr[i] = path.join('./docs/assets', val);
    });
  });

  // Project configuration.
  grunt.initConfig({

    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*!\n' +
            ' * Bootstrap v<%= pkg.version %> (<%= pkg.homepage %>)\n' +
            ' * Copyright 2011-<%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
            ' * Licensed under <%= pkg.license.type %> (<%= pkg.license.url %>)\n' +
            ' */\n',
    jqueryCheck: configBridge.config.jqueryCheck.join('\n'),
    jqueryVersionCheck: configBridge.config.jqueryVersionCheck.join('\n'),

    // Task configuration.
    clean: {
      dist: 'dist',
      docs: 'docs/dist'
    },

    jshint: {
      options: {
        jshintrc: 'js/.jshintrc'
      },
      grunt: {
        options: {
          jshintrc: 'grunt/.jshintrc'
        },
        src: ['Gruntfile.js', 'grunt/*.js']
      },
      core: {
        src: 'js/*.js'
      },
      test: {
        options: {
          jshintrc: 'js/tests/unit/.jshintrc'
        },
        src: 'js/tests/unit/*.js'
      },
      assets: {
        src: ['docs/assets/js/src/*.js', 'docs/assets/js/*.js', '!docs/assets/js/*.min.js']
      }
    },

    jscs: {
      options: {
        config: 'js/.jscsrc'
      },
      grunt: {
        src: '<%= jshint.grunt.src %>'
      },
      core: {
        src: '<%= jshint.core.src %>'
      },
      test: {
        src: '<%= jshint.test.src %>'
      },
      assets: {
        options: {
          requireCamelCaseOrUpperCaseIdentifiers: null
        },
        src: '<%= jshint.assets.src %>'
      }
    },

    concat: {
      options: {
        banner: '<%= banner %>\n<%= jqueryCheck %>\n<%= jqueryVersionCheck %>',
        stripBanners: false
      },
      bootstrap: {
        src: [
          'js/transition.js',
          'js/alert.js',
          'js/button.js',
          'js/carousel.js',
          'js/collapse.js',
          'js/dropdown.js',
          'js/modal.js',
          'js/tooltip.js',
          'js/popover.js',
          'js/scrollspy.js',
          'js/tab.js',
          'js/affix.js'
        ],
        dest: 'dist/js/<%= pkg.name %>.js'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some'
      },
      core: {
        src: '<%= concat.bootstrap.dest %>',
        dest: 'dist/js/<%= pkg.name %>.min.js'
      },
      customize: {
        src: configBridge.paths.customizerJs,
        dest: 'docs/assets/js/customize.min.js'
      },
      docsJs: {
        src: configBridge.paths.docsJs,
        dest: 'docs/assets/js/docs.min.js'
      }
    },

    qunit: {
      options: {
        inject: 'js/tests/unit/phantom.js'
      },
      files: 'js/tests/index.html'
    },

    less: {
      compileCore: {
        options: {
          strictMath: true,
          sourceMap: true,
          outputSourceFiles: true,
          sourceMapURL: '<%= pkg.name %>.css.map',
          sourceMapFilename: 'dist/css/<%= pkg.name %>.css.map'
        },
        src: 'less/bootstrap.less',
        dest: 'dist/css/<%= pkg.name %>.css'
      },
      compileTheme: {
        options: {
          strictMath: true,
          sourceMap: true,
          outputSourceFiles: true,
          sourceMapURL: '<%= pkg.name %>-theme.css.map',
          sourceMapFilename: 'dist/css/<%= pkg.name %>-theme.css.map'
        },
        src: 'less/theme.less',
        dest: 'dist/css/<%= pkg.name %>-theme.css'
      }
    },

    autoprefixer: {
      options: {
        browsers: configBridge.config.autoprefixerBrowsers
      },
      core: {
        options: {
          map: true
        },
        src: 'dist/css/<%= pkg.name %>.css'
      },
      theme: {
        options: {
          map: true
        },
        src: 'dist/css/<%= pkg.name %>-theme.css'
      },
      docs: {
        src: ['docs/assets/css/anchor.css', 'docs/assets/css/src/docs.css']
      },
      examples: {
        expand: true,
        cwd: 'docs/examples/',
        src: ['**/*.css'],
        dest: 'docs/examples/'
      }
    },

    csslint: {
      options: {
        csslintrc: 'less/.csslintrc'
      },
      dist: [
        'dist/css/bootstrap.css',
        'dist/css/bootstrap-theme.css'
      ],
      examples: [
        'docs/examples/**/*.css'
      ],
      docs: {
        options: {
          ids: false,
          'overqualified-elements': false
        },
        src: 'docs/assets/css/src/docs.css'
      }
    },

    cssmin: {
      options: {
        // TODO: disable `zeroUnits` optimization once clean-css 3.2 is released
        //    and then simplify the fix for https://github.com/twbs/bootstrap/issues/14837 accordingly
        compatibility: 'ie8',
        keepSpecialComments: '*',
        advanced: false
      },
      minifyCore: {
        src: 'dist/css/<%= pkg.name %>.css',
        dest: 'dist/css/<%= pkg.name %>.min.css'
      },
      minifyTheme: {
        src: 'dist/css/<%= pkg.name %>-theme.css',
        dest: 'dist/css/<%= pkg.name %>-theme.min.css'
      },
      docs: {
        src: [
          'docs/assets/css/src/pygments-manni.css',
          'docs/assets/css/src/anchor.css',
          'docs/assets/css/src/docs.css'

        ],
        dest: 'docs/assets/css/docs.min.css'
      }
    },

    usebanner: {
      options: {
        position: 'top',
        banner: '<%= banner %>'
      },
      files: {
        src: 'dist/css/*.css'
      }
    },

    csscomb: {
      options: {
        config: 'less/.csscomb.json'
      },
      dist: {
        expand: true,
        cwd: 'dist/css/',
        src: ['*.css', '!*.min.css'],
        dest: 'dist/css/'
      },
      examples: {
        expand: true,
        cwd: 'docs/examples/',
        src: '**/*.css',
        dest: 'docs/examples/'
      },
      docs: {
        src: 'docs/assets/css/src/docs.css',
        dest: 'docs/assets/css/src/docs.css'
      }
    },

    copy: {
      fonts: {
        expand: true,
        src: 'fonts/*',
        dest: 'dist/'
      },
      docs: {
        expand: true,
        cwd: 'dist/',
        src: [
          '**/*'
        ],
        dest: 'docs/dist/'
      }
    },

    connect: {
      server: {
        options: {
          port: 3000,
          base: '.'
        }
      }
    },

    jekyll: {
      options: {
        config: '_config.yml'
      },
      docs: {},
      github: {
        options: {
          raw: 'github: true'
        }
      }
    },

    jade: {
      options: {
        pretty: true,
        data: getLessVarsData
      },
      customizerVars: {
        src: 'docs/_jade/customizer-variables.jade',
        dest: 'docs/_includes/customizer-variables.html'
      },
      customizerNav: {
        src: 'docs/_jade/customizer-nav.jade',
        dest: 'docs/_includes/nav/customize.html'
      }
    },

    htmllint: {
      options: {
        ignore: [
          'Attribute "autocomplete" not allowed on element "button" at this point.',
          'Attribute "autocomplete" not allowed on element "input" at this point.',
          'Element "img" is missing required attribute "src".'
        ]
      },
      src: '_gh_pages/**/*.html'
    },

    watch: {
      src: {
        files: '<%= jshint.core.src %>',
        tasks: ['jshint:src', 'qunit', 'concat']
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'qunit']
      },
      less: {
        files: 'less/**/*.less',
        tasks: 'less'
      }
    },

    sed: {
      versionNumber: {
        pattern: (function () {
          var old = grunt.option('oldver');
          return old ? RegExp.quote(old) : old;
        })(),
        replacement: grunt.option('newver'),
        recursive: true
      }
    },

    'saucelabs-qunit': {
      all: {
        options: {
          build: process.env.TRAVIS_JOB_ID,
          throttled: 10,
          maxRetries: 3,
          maxPollRetries: 4,
          urls: ['http://127.0.0.1:3000/js/tests/index.html?hidepassed'],
          browsers: grunt.file.readYAML('grunt/sauce_browsers.yml')
        }
      }
    },

    exec: {
      npmUpdate: {
        command: 'npm update'
      }
    },

    compress: {
      main: {
        options: {
          archive: 'bootstrap-<%= pkg.version %>-dist.zip',
          mode: 'zip',
          level: 9,
          pretty: true
        },
        files: [
          {
            expand: true,
            cwd: 'dist/',
            src: ['**'],
            dest: 'bootstrap-<%= pkg.version %>-dist'
          }
        ]
      }
    }

  });


  // These plugins provide necessary tasks.
  require('load-grunt-tasks')(grunt, { scope: 'devDependencies' });
  require('time-grunt')(grunt);

  // Docs HTML validation task
  grunt.registerTask('validate-html', ['jekyll:docs', 'htmllint']);

  var runSubset = function (subset) {
    return !process.env.TWBS_TEST || process.env.TWBS_TEST === subset;
  };
  var isUndefOrNonZero = function (val) {
    return val === undefined || val !== '0';
  };

  // Test task.
  var testSubtasks = [];
  // Skip core tests if running a different subset of the test suite
  if (runSubset('core') &&
      // Skip core tests if this is a Savage build
      process.env.TRAVIS_REPO_SLUG !== 'twbs-savage/bootstrap') {
    testSubtasks = testSubtasks.concat(['dist-css', 'dist-js', 'csslint:dist', 'test-js', 'docs']);
  }
  // Skip HTML validation if running a different subset of the test suite
  if (runSubset('validate-html') &&
      // Skip HTML5 validator on Travis when [skip validator] is in the commit message
      isUndefOrNonZero(process.env.TWBS_DO_VALIDATOR)) {
    testSubtasks.push('validate-html');
  }
  // Only run Sauce Labs tests if there's a Sauce access key
  if (typeof process.env.SAUCE_ACCESS_KEY !== 'undefined' &&
      // Skip Sauce if running a different subset of the test suite
      runSubset('sauce-js-unit') &&
      // Skip Sauce on Travis when [skip sauce] is in the commit message
      isUndefOrNonZero(process.env.TWBS_DO_SAUCE)) {
    testSubtasks.push('connect');
    testSubtasks.push('saucelabs-qunit');
  }
  grunt.registerTask('test', testSubtasks);
  grunt.registerTask('test-js', ['jshint:core', 'jshint:test', 'jshint:grunt', 'jscs:core', 'jscs:test', 'jscs:grunt', 'qunit']);

  // JS distribution task.
  grunt.registerTask('dist-js', ['concat', 'uglify:core', 'commonjs']);

  // CSS distribution task.
  grunt.registerTask('less-compile', ['less:compileCore', 'less:compileTheme']);
  grunt.registerTask('dist-css', ['less-compile', 'autoprefixer:core', 'autoprefixer:theme', 'usebanner', 'csscomb:dist', 'cssmin:minifyCore', 'cssmin:minifyTheme']);

  // Full distribution task.
  grunt.registerTask('dist', ['clean:dist', 'dist-css', 'copy:fonts', 'dist-js']);

  // Default task.
  grunt.registerTask('default', ['clean:dist', 'copy:fonts', 'test']);

  // Version numbering task.
  // grunt change-version-number --oldver=A.B.C --newver=X.Y.Z
  // This can be overzealous, so its changes should always be manually reviewed!
  grunt.registerTask('change-version-number', 'sed');

  grunt.registerTask('build-glyphicons-data', function () { generateGlyphiconsData.call(this, grunt); });

  // task for building customizer
  grunt.registerTask('build-customizer', ['build-customizer-html', 'build-raw-files']);
  grunt.registerTask('build-customizer-html', 'jade');
  grunt.registerTask('build-raw-files', 'Add scripts/less files to customizer.', function () {
    var banner = grunt.template.process('<%= banner %>');
    generateRawFiles(grunt, banner);
  });

  grunt.registerTask('commonjs', 'Generate CommonJS entrypoint module in dist dir.', function () {
    var srcFiles = grunt.config.get('concat.bootstrap.src');
    var destFilepath = 'dist/js/npm.js';
    generateCommonJSModule(grunt, srcFiles, destFilepath);
  });

  // Docs task.
  grunt.registerTask('docs-css', ['autoprefixer:docs', 'autoprefixer:examples', 'csscomb:docs', 'csscomb:examples', 'cssmin:docs']);
  grunt.registerTask('lint-docs-css', ['csslint:docs', 'csslint:examples']);
  grunt.registerTask('docs-js', ['uglify:docsJs', 'uglify:customize']);
  grunt.registerTask('lint-docs-js', ['jshint:assets', 'jscs:assets']);
  grunt.registerTask('docs', ['docs-css', 'lint-docs-css', 'docs-js', 'lint-docs-js', 'clean:docs', 'copy:docs', 'build-glyphicons-data', 'build-customizer']);

  grunt.registerTask('prep-release', ['jekyll:github', 'compress']);

  // Task for updating the cached npm packages used by the Travis build (which are controlled by test-infra/npm-shrinkwrap.json).
  // This task should be run and the updated file should be committed whenever Bootstrap's dependencies change.
  grunt.registerTask('update-shrinkwrap', ['exec:npmUpdate', '_update-shrinkwrap']);
  grunt.registerTask('_update-shrinkwrap', function () {
    var done = this.async();
    npmShrinkwrap({ dev: true, dirname: __dirname }, function (err) {
      if (err) {
        grunt.fail.warn(err);
      }
      var dest = 'test-infra/npm-shrinkwrap.json';
      fs.renameSync('npm-shrinkwrap.json', dest);
      grunt.log.writeln('File ' + dest.cyan + ' updated.');
      done();
    });
  });
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJib290c3RyYXAvR3J1bnRmaWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxuICogQm9vdHN0cmFwJ3MgR3J1bnRmaWxlXG4gKiBodHRwOi8vZ2V0Ym9vdHN0cmFwLmNvbVxuICogQ29weXJpZ2h0IDIwMTMtMjAxNSBUd2l0dGVyLCBJbmMuXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGdydW50KSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvLyBGb3JjZSB1c2Ugb2YgVW5peCBuZXdsaW5lc1xuICBncnVudC51dGlsLmxpbmVmZWVkID0gJ1xcbic7XG5cbiAgUmVnRXhwLnF1b3RlID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy1cXFxcXiQqKz8uKCl8W1xcXXt9XS9nLCAnXFxcXCQmJyk7XG4gIH07XG5cbiAgdmFyIGZzID0gcmVxdWlyZSgnZnMnKTtcbiAgdmFyIHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG4gIHZhciBucG1TaHJpbmt3cmFwID0gcmVxdWlyZSgnbnBtLXNocmlua3dyYXAnKTtcbiAgdmFyIGdlbmVyYXRlR2x5cGhpY29uc0RhdGEgPSByZXF1aXJlKCcuL2dydW50L2JzLWdseXBoaWNvbnMtZGF0YS1nZW5lcmF0b3IuanMnKTtcbiAgdmFyIEJzTGVzc2RvY1BhcnNlciA9IHJlcXVpcmUoJy4vZ3J1bnQvYnMtbGVzc2RvYy1wYXJzZXIuanMnKTtcbiAgdmFyIGdldExlc3NWYXJzRGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZmlsZVBhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGVzcy92YXJpYWJsZXMubGVzcycpO1xuICAgIHZhciBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xuICAgIHZhciBwYXJzZXIgPSBuZXcgQnNMZXNzZG9jUGFyc2VyKGZpbGVDb250ZW50KTtcbiAgICByZXR1cm4geyBzZWN0aW9uczogcGFyc2VyLnBhcnNlRmlsZSgpIH07XG4gIH07XG4gIHZhciBnZW5lcmF0ZVJhd0ZpbGVzID0gcmVxdWlyZSgnLi9ncnVudC9icy1yYXctZmlsZXMtZ2VuZXJhdG9yLmpzJyk7XG4gIHZhciBnZW5lcmF0ZUNvbW1vbkpTTW9kdWxlID0gcmVxdWlyZSgnLi9ncnVudC9icy1jb21tb25qcy1nZW5lcmF0b3IuanMnKTtcbiAgdmFyIGNvbmZpZ0JyaWRnZSA9IGdydW50LmZpbGUucmVhZEpTT04oJy4vZ3J1bnQvY29uZmlnQnJpZGdlLmpzb24nLCB7IGVuY29kaW5nOiAndXRmOCcgfSk7XG5cbiAgT2JqZWN0LmtleXMoY29uZmlnQnJpZGdlLnBhdGhzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBjb25maWdCcmlkZ2UucGF0aHNba2V5XS5mb3JFYWNoKGZ1bmN0aW9uICh2YWwsIGksIGFycikge1xuICAgICAgYXJyW2ldID0gcGF0aC5qb2luKCcuL2RvY3MvYXNzZXRzJywgdmFsKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gUHJvamVjdCBjb25maWd1cmF0aW9uLlxuICBncnVudC5pbml0Q29uZmlnKHtcblxuICAgIC8vIE1ldGFkYXRhLlxuICAgIHBrZzogZ3J1bnQuZmlsZS5yZWFkSlNPTigncGFja2FnZS5qc29uJyksXG4gICAgYmFubmVyOiAnLyohXFxuJyArXG4gICAgICAgICAgICAnICogQm9vdHN0cmFwIHY8JT0gcGtnLnZlcnNpb24gJT4gKDwlPSBwa2cuaG9tZXBhZ2UgJT4pXFxuJyArXG4gICAgICAgICAgICAnICogQ29weXJpZ2h0IDIwMTEtPCU9IGdydW50LnRlbXBsYXRlLnRvZGF5KFwieXl5eVwiKSAlPiA8JT0gcGtnLmF1dGhvciAlPlxcbicgK1xuICAgICAgICAgICAgJyAqIExpY2Vuc2VkIHVuZGVyIDwlPSBwa2cubGljZW5zZS50eXBlICU+ICg8JT0gcGtnLmxpY2Vuc2UudXJsICU+KVxcbicgK1xuICAgICAgICAgICAgJyAqL1xcbicsXG4gICAganF1ZXJ5Q2hlY2s6IGNvbmZpZ0JyaWRnZS5jb25maWcuanF1ZXJ5Q2hlY2suam9pbignXFxuJyksXG4gICAganF1ZXJ5VmVyc2lvbkNoZWNrOiBjb25maWdCcmlkZ2UuY29uZmlnLmpxdWVyeVZlcnNpb25DaGVjay5qb2luKCdcXG4nKSxcblxuICAgIC8vIFRhc2sgY29uZmlndXJhdGlvbi5cbiAgICBjbGVhbjoge1xuICAgICAgZGlzdDogJ2Rpc3QnLFxuICAgICAgZG9jczogJ2RvY3MvZGlzdCdcbiAgICB9LFxuXG4gICAganNoaW50OiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGpzaGludHJjOiAnanMvLmpzaGludHJjJ1xuICAgICAgfSxcbiAgICAgIGdydW50OiB7XG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBqc2hpbnRyYzogJ2dydW50Ly5qc2hpbnRyYydcbiAgICAgICAgfSxcbiAgICAgICAgc3JjOiBbJ0dydW50ZmlsZS5qcycsICdncnVudC8qLmpzJ11cbiAgICAgIH0sXG4gICAgICBjb3JlOiB7XG4gICAgICAgIHNyYzogJ2pzLyouanMnXG4gICAgICB9LFxuICAgICAgdGVzdDoge1xuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAganNoaW50cmM6ICdqcy90ZXN0cy91bml0Ly5qc2hpbnRyYydcbiAgICAgICAgfSxcbiAgICAgICAgc3JjOiAnanMvdGVzdHMvdW5pdC8qLmpzJ1xuICAgICAgfSxcbiAgICAgIGFzc2V0czoge1xuICAgICAgICBzcmM6IFsnZG9jcy9hc3NldHMvanMvc3JjLyouanMnLCAnZG9jcy9hc3NldHMvanMvKi5qcycsICchZG9jcy9hc3NldHMvanMvKi5taW4uanMnXVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBqc2NzOiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGNvbmZpZzogJ2pzLy5qc2NzcmMnXG4gICAgICB9LFxuICAgICAgZ3J1bnQ6IHtcbiAgICAgICAgc3JjOiAnPCU9IGpzaGludC5ncnVudC5zcmMgJT4nXG4gICAgICB9LFxuICAgICAgY29yZToge1xuICAgICAgICBzcmM6ICc8JT0ganNoaW50LmNvcmUuc3JjICU+J1xuICAgICAgfSxcbiAgICAgIHRlc3Q6IHtcbiAgICAgICAgc3JjOiAnPCU9IGpzaGludC50ZXN0LnNyYyAlPidcbiAgICAgIH0sXG4gICAgICBhc3NldHM6IHtcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHJlcXVpcmVDYW1lbENhc2VPclVwcGVyQ2FzZUlkZW50aWZpZXJzOiBudWxsXG4gICAgICAgIH0sXG4gICAgICAgIHNyYzogJzwlPSBqc2hpbnQuYXNzZXRzLnNyYyAlPidcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY29uY2F0OiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGJhbm5lcjogJzwlPSBiYW5uZXIgJT5cXG48JT0ganF1ZXJ5Q2hlY2sgJT5cXG48JT0ganF1ZXJ5VmVyc2lvbkNoZWNrICU+JyxcbiAgICAgICAgc3RyaXBCYW5uZXJzOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIGJvb3RzdHJhcDoge1xuICAgICAgICBzcmM6IFtcbiAgICAgICAgICAnanMvdHJhbnNpdGlvbi5qcycsXG4gICAgICAgICAgJ2pzL2FsZXJ0LmpzJyxcbiAgICAgICAgICAnanMvYnV0dG9uLmpzJyxcbiAgICAgICAgICAnanMvY2Fyb3VzZWwuanMnLFxuICAgICAgICAgICdqcy9jb2xsYXBzZS5qcycsXG4gICAgICAgICAgJ2pzL2Ryb3Bkb3duLmpzJyxcbiAgICAgICAgICAnanMvbW9kYWwuanMnLFxuICAgICAgICAgICdqcy90b29sdGlwLmpzJyxcbiAgICAgICAgICAnanMvcG9wb3Zlci5qcycsXG4gICAgICAgICAgJ2pzL3Njcm9sbHNweS5qcycsXG4gICAgICAgICAgJ2pzL3RhYi5qcycsXG4gICAgICAgICAgJ2pzL2FmZml4LmpzJ1xuICAgICAgICBdLFxuICAgICAgICBkZXN0OiAnZGlzdC9qcy88JT0gcGtnLm5hbWUgJT4uanMnXG4gICAgICB9XG4gICAgfSxcblxuICAgIHVnbGlmeToge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBwcmVzZXJ2ZUNvbW1lbnRzOiAnc29tZSdcbiAgICAgIH0sXG4gICAgICBjb3JlOiB7XG4gICAgICAgIHNyYzogJzwlPSBjb25jYXQuYm9vdHN0cmFwLmRlc3QgJT4nLFxuICAgICAgICBkZXN0OiAnZGlzdC9qcy88JT0gcGtnLm5hbWUgJT4ubWluLmpzJ1xuICAgICAgfSxcbiAgICAgIGN1c3RvbWl6ZToge1xuICAgICAgICBzcmM6IGNvbmZpZ0JyaWRnZS5wYXRocy5jdXN0b21pemVySnMsXG4gICAgICAgIGRlc3Q6ICdkb2NzL2Fzc2V0cy9qcy9jdXN0b21pemUubWluLmpzJ1xuICAgICAgfSxcbiAgICAgIGRvY3NKczoge1xuICAgICAgICBzcmM6IGNvbmZpZ0JyaWRnZS5wYXRocy5kb2NzSnMsXG4gICAgICAgIGRlc3Q6ICdkb2NzL2Fzc2V0cy9qcy9kb2NzLm1pbi5qcydcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgcXVuaXQ6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaW5qZWN0OiAnanMvdGVzdHMvdW5pdC9waGFudG9tLmpzJ1xuICAgICAgfSxcbiAgICAgIGZpbGVzOiAnanMvdGVzdHMvaW5kZXguaHRtbCdcbiAgICB9LFxuXG4gICAgbGVzczoge1xuICAgICAgY29tcGlsZUNvcmU6IHtcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHN0cmljdE1hdGg6IHRydWUsXG4gICAgICAgICAgc291cmNlTWFwOiB0cnVlLFxuICAgICAgICAgIG91dHB1dFNvdXJjZUZpbGVzOiB0cnVlLFxuICAgICAgICAgIHNvdXJjZU1hcFVSTDogJzwlPSBwa2cubmFtZSAlPi5jc3MubWFwJyxcbiAgICAgICAgICBzb3VyY2VNYXBGaWxlbmFtZTogJ2Rpc3QvY3NzLzwlPSBwa2cubmFtZSAlPi5jc3MubWFwJ1xuICAgICAgICB9LFxuICAgICAgICBzcmM6ICdsZXNzL2Jvb3RzdHJhcC5sZXNzJyxcbiAgICAgICAgZGVzdDogJ2Rpc3QvY3NzLzwlPSBwa2cubmFtZSAlPi5jc3MnXG4gICAgICB9LFxuICAgICAgY29tcGlsZVRoZW1lOiB7XG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzdHJpY3RNYXRoOiB0cnVlLFxuICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICBvdXRwdXRTb3VyY2VGaWxlczogdHJ1ZSxcbiAgICAgICAgICBzb3VyY2VNYXBVUkw6ICc8JT0gcGtnLm5hbWUgJT4tdGhlbWUuY3NzLm1hcCcsXG4gICAgICAgICAgc291cmNlTWFwRmlsZW5hbWU6ICdkaXN0L2Nzcy88JT0gcGtnLm5hbWUgJT4tdGhlbWUuY3NzLm1hcCdcbiAgICAgICAgfSxcbiAgICAgICAgc3JjOiAnbGVzcy90aGVtZS5sZXNzJyxcbiAgICAgICAgZGVzdDogJ2Rpc3QvY3NzLzwlPSBwa2cubmFtZSAlPi10aGVtZS5jc3MnXG4gICAgICB9XG4gICAgfSxcblxuICAgIGF1dG9wcmVmaXhlcjoge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBicm93c2VyczogY29uZmlnQnJpZGdlLmNvbmZpZy5hdXRvcHJlZml4ZXJCcm93c2Vyc1xuICAgICAgfSxcbiAgICAgIGNvcmU6IHtcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIG1hcDogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBzcmM6ICdkaXN0L2Nzcy88JT0gcGtnLm5hbWUgJT4uY3NzJ1xuICAgICAgfSxcbiAgICAgIHRoZW1lOiB7XG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBtYXA6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgc3JjOiAnZGlzdC9jc3MvPCU9IHBrZy5uYW1lICU+LXRoZW1lLmNzcydcbiAgICAgIH0sXG4gICAgICBkb2NzOiB7XG4gICAgICAgIHNyYzogWydkb2NzL2Fzc2V0cy9jc3MvYW5jaG9yLmNzcycsICdkb2NzL2Fzc2V0cy9jc3Mvc3JjL2RvY3MuY3NzJ11cbiAgICAgIH0sXG4gICAgICBleGFtcGxlczoge1xuICAgICAgICBleHBhbmQ6IHRydWUsXG4gICAgICAgIGN3ZDogJ2RvY3MvZXhhbXBsZXMvJyxcbiAgICAgICAgc3JjOiBbJyoqLyouY3NzJ10sXG4gICAgICAgIGRlc3Q6ICdkb2NzL2V4YW1wbGVzLydcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY3NzbGludDoge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBjc3NsaW50cmM6ICdsZXNzLy5jc3NsaW50cmMnXG4gICAgICB9LFxuICAgICAgZGlzdDogW1xuICAgICAgICAnZGlzdC9jc3MvYm9vdHN0cmFwLmNzcycsXG4gICAgICAgICdkaXN0L2Nzcy9ib290c3RyYXAtdGhlbWUuY3NzJ1xuICAgICAgXSxcbiAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICdkb2NzL2V4YW1wbGVzLyoqLyouY3NzJ1xuICAgICAgXSxcbiAgICAgIGRvY3M6IHtcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGlkczogZmFsc2UsXG4gICAgICAgICAgJ292ZXJxdWFsaWZpZWQtZWxlbWVudHMnOiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICBzcmM6ICdkb2NzL2Fzc2V0cy9jc3Mvc3JjL2RvY3MuY3NzJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjc3NtaW46IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgLy8gVE9ETzogZGlzYWJsZSBgemVyb1VuaXRzYCBvcHRpbWl6YXRpb24gb25jZSBjbGVhbi1jc3MgMy4yIGlzIHJlbGVhc2VkXG4gICAgICAgIC8vICAgIGFuZCB0aGVuIHNpbXBsaWZ5IHRoZSBmaXggZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9pc3N1ZXMvMTQ4MzcgYWNjb3JkaW5nbHlcbiAgICAgICAgY29tcGF0aWJpbGl0eTogJ2llOCcsXG4gICAgICAgIGtlZXBTcGVjaWFsQ29tbWVudHM6ICcqJyxcbiAgICAgICAgYWR2YW5jZWQ6IGZhbHNlXG4gICAgICB9LFxuICAgICAgbWluaWZ5Q29yZToge1xuICAgICAgICBzcmM6ICdkaXN0L2Nzcy88JT0gcGtnLm5hbWUgJT4uY3NzJyxcbiAgICAgICAgZGVzdDogJ2Rpc3QvY3NzLzwlPSBwa2cubmFtZSAlPi5taW4uY3NzJ1xuICAgICAgfSxcbiAgICAgIG1pbmlmeVRoZW1lOiB7XG4gICAgICAgIHNyYzogJ2Rpc3QvY3NzLzwlPSBwa2cubmFtZSAlPi10aGVtZS5jc3MnLFxuICAgICAgICBkZXN0OiAnZGlzdC9jc3MvPCU9IHBrZy5uYW1lICU+LXRoZW1lLm1pbi5jc3MnXG4gICAgICB9LFxuICAgICAgZG9jczoge1xuICAgICAgICBzcmM6IFtcbiAgICAgICAgICAnZG9jcy9hc3NldHMvY3NzL3NyYy9weWdtZW50cy1tYW5uaS5jc3MnLFxuICAgICAgICAgICdkb2NzL2Fzc2V0cy9jc3Mvc3JjL2FuY2hvci5jc3MnLFxuICAgICAgICAgICdkb2NzL2Fzc2V0cy9jc3Mvc3JjL2RvY3MuY3NzJ1xuXG4gICAgICAgIF0sXG4gICAgICAgIGRlc3Q6ICdkb2NzL2Fzc2V0cy9jc3MvZG9jcy5taW4uY3NzJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICB1c2ViYW5uZXI6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgcG9zaXRpb246ICd0b3AnLFxuICAgICAgICBiYW5uZXI6ICc8JT0gYmFubmVyICU+J1xuICAgICAgfSxcbiAgICAgIGZpbGVzOiB7XG4gICAgICAgIHNyYzogJ2Rpc3QvY3NzLyouY3NzJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjc3Njb21iOiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGNvbmZpZzogJ2xlc3MvLmNzc2NvbWIuanNvbidcbiAgICAgIH0sXG4gICAgICBkaXN0OiB7XG4gICAgICAgIGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgY3dkOiAnZGlzdC9jc3MvJyxcbiAgICAgICAgc3JjOiBbJyouY3NzJywgJyEqLm1pbi5jc3MnXSxcbiAgICAgICAgZGVzdDogJ2Rpc3QvY3NzLydcbiAgICAgIH0sXG4gICAgICBleGFtcGxlczoge1xuICAgICAgICBleHBhbmQ6IHRydWUsXG4gICAgICAgIGN3ZDogJ2RvY3MvZXhhbXBsZXMvJyxcbiAgICAgICAgc3JjOiAnKiovKi5jc3MnLFxuICAgICAgICBkZXN0OiAnZG9jcy9leGFtcGxlcy8nXG4gICAgICB9LFxuICAgICAgZG9jczoge1xuICAgICAgICBzcmM6ICdkb2NzL2Fzc2V0cy9jc3Mvc3JjL2RvY3MuY3NzJyxcbiAgICAgICAgZGVzdDogJ2RvY3MvYXNzZXRzL2Nzcy9zcmMvZG9jcy5jc3MnXG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvcHk6IHtcbiAgICAgIGZvbnRzOiB7XG4gICAgICAgIGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgc3JjOiAnZm9udHMvKicsXG4gICAgICAgIGRlc3Q6ICdkaXN0LydcbiAgICAgIH0sXG4gICAgICBkb2NzOiB7XG4gICAgICAgIGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgY3dkOiAnZGlzdC8nLFxuICAgICAgICBzcmM6IFtcbiAgICAgICAgICAnKiovKidcbiAgICAgICAgXSxcbiAgICAgICAgZGVzdDogJ2RvY3MvZGlzdC8nXG4gICAgICB9XG4gICAgfSxcblxuICAgIGNvbm5lY3Q6IHtcbiAgICAgIHNlcnZlcjoge1xuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgcG9ydDogMzAwMCxcbiAgICAgICAgICBiYXNlOiAnLidcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBqZWt5bGw6IHtcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgY29uZmlnOiAnX2NvbmZpZy55bWwnXG4gICAgICB9LFxuICAgICAgZG9jczoge30sXG4gICAgICBnaXRodWI6IHtcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHJhdzogJ2dpdGh1YjogdHJ1ZSdcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBqYWRlOiB7XG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIHByZXR0eTogdHJ1ZSxcbiAgICAgICAgZGF0YTogZ2V0TGVzc1ZhcnNEYXRhXG4gICAgICB9LFxuICAgICAgY3VzdG9taXplclZhcnM6IHtcbiAgICAgICAgc3JjOiAnZG9jcy9famFkZS9jdXN0b21pemVyLXZhcmlhYmxlcy5qYWRlJyxcbiAgICAgICAgZGVzdDogJ2RvY3MvX2luY2x1ZGVzL2N1c3RvbWl6ZXItdmFyaWFibGVzLmh0bWwnXG4gICAgICB9LFxuICAgICAgY3VzdG9taXplck5hdjoge1xuICAgICAgICBzcmM6ICdkb2NzL19qYWRlL2N1c3RvbWl6ZXItbmF2LmphZGUnLFxuICAgICAgICBkZXN0OiAnZG9jcy9faW5jbHVkZXMvbmF2L2N1c3RvbWl6ZS5odG1sJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBodG1sbGludDoge1xuICAgICAgb3B0aW9uczoge1xuICAgICAgICBpZ25vcmU6IFtcbiAgICAgICAgICAnQXR0cmlidXRlIFwiYXV0b2NvbXBsZXRlXCIgbm90IGFsbG93ZWQgb24gZWxlbWVudCBcImJ1dHRvblwiIGF0IHRoaXMgcG9pbnQuJyxcbiAgICAgICAgICAnQXR0cmlidXRlIFwiYXV0b2NvbXBsZXRlXCIgbm90IGFsbG93ZWQgb24gZWxlbWVudCBcImlucHV0XCIgYXQgdGhpcyBwb2ludC4nLFxuICAgICAgICAgICdFbGVtZW50IFwiaW1nXCIgaXMgbWlzc2luZyByZXF1aXJlZCBhdHRyaWJ1dGUgXCJzcmNcIi4nXG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICBzcmM6ICdfZ2hfcGFnZXMvKiovKi5odG1sJ1xuICAgIH0sXG5cbiAgICB3YXRjaDoge1xuICAgICAgc3JjOiB7XG4gICAgICAgIGZpbGVzOiAnPCU9IGpzaGludC5jb3JlLnNyYyAlPicsXG4gICAgICAgIHRhc2tzOiBbJ2pzaGludDpzcmMnLCAncXVuaXQnLCAnY29uY2F0J11cbiAgICAgIH0sXG4gICAgICB0ZXN0OiB7XG4gICAgICAgIGZpbGVzOiAnPCU9IGpzaGludC50ZXN0LnNyYyAlPicsXG4gICAgICAgIHRhc2tzOiBbJ2pzaGludDp0ZXN0JywgJ3F1bml0J11cbiAgICAgIH0sXG4gICAgICBsZXNzOiB7XG4gICAgICAgIGZpbGVzOiAnbGVzcy8qKi8qLmxlc3MnLFxuICAgICAgICB0YXNrczogJ2xlc3MnXG4gICAgICB9XG4gICAgfSxcblxuICAgIHNlZDoge1xuICAgICAgdmVyc2lvbk51bWJlcjoge1xuICAgICAgICBwYXR0ZXJuOiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBvbGQgPSBncnVudC5vcHRpb24oJ29sZHZlcicpO1xuICAgICAgICAgIHJldHVybiBvbGQgPyBSZWdFeHAucXVvdGUob2xkKSA6IG9sZDtcbiAgICAgICAgfSkoKSxcbiAgICAgICAgcmVwbGFjZW1lbnQ6IGdydW50Lm9wdGlvbignbmV3dmVyJyksXG4gICAgICAgIHJlY3Vyc2l2ZTogdHJ1ZVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAnc2F1Y2VsYWJzLXF1bml0Jzoge1xuICAgICAgYWxsOiB7XG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBidWlsZDogcHJvY2Vzcy5lbnYuVFJBVklTX0pPQl9JRCxcbiAgICAgICAgICB0aHJvdHRsZWQ6IDEwLFxuICAgICAgICAgIG1heFJldHJpZXM6IDMsXG4gICAgICAgICAgbWF4UG9sbFJldHJpZXM6IDQsXG4gICAgICAgICAgdXJsczogWydodHRwOi8vMTI3LjAuMC4xOjMwMDAvanMvdGVzdHMvaW5kZXguaHRtbD9oaWRlcGFzc2VkJ10sXG4gICAgICAgICAgYnJvd3NlcnM6IGdydW50LmZpbGUucmVhZFlBTUwoJ2dydW50L3NhdWNlX2Jyb3dzZXJzLnltbCcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZXhlYzoge1xuICAgICAgbnBtVXBkYXRlOiB7XG4gICAgICAgIGNvbW1hbmQ6ICducG0gdXBkYXRlJ1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBjb21wcmVzczoge1xuICAgICAgbWFpbjoge1xuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgYXJjaGl2ZTogJ2Jvb3RzdHJhcC08JT0gcGtnLnZlcnNpb24gJT4tZGlzdC56aXAnLFxuICAgICAgICAgIG1vZGU6ICd6aXAnLFxuICAgICAgICAgIGxldmVsOiA5LFxuICAgICAgICAgIHByZXR0eTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICBmaWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGV4cGFuZDogdHJ1ZSxcbiAgICAgICAgICAgIGN3ZDogJ2Rpc3QvJyxcbiAgICAgICAgICAgIHNyYzogWycqKiddLFxuICAgICAgICAgICAgZGVzdDogJ2Jvb3RzdHJhcC08JT0gcGtnLnZlcnNpb24gJT4tZGlzdCdcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgfSk7XG5cblxuICAvLyBUaGVzZSBwbHVnaW5zIHByb3ZpZGUgbmVjZXNzYXJ5IHRhc2tzLlxuICByZXF1aXJlKCdsb2FkLWdydW50LXRhc2tzJykoZ3J1bnQsIHsgc2NvcGU6ICdkZXZEZXBlbmRlbmNpZXMnIH0pO1xuICByZXF1aXJlKCd0aW1lLWdydW50JykoZ3J1bnQpO1xuXG4gIC8vIERvY3MgSFRNTCB2YWxpZGF0aW9uIHRhc2tcbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCd2YWxpZGF0ZS1odG1sJywgWydqZWt5bGw6ZG9jcycsICdodG1sbGludCddKTtcblxuICB2YXIgcnVuU3Vic2V0ID0gZnVuY3Rpb24gKHN1YnNldCkge1xuICAgIHJldHVybiAhcHJvY2Vzcy5lbnYuVFdCU19URVNUIHx8IHByb2Nlc3MuZW52LlRXQlNfVEVTVCA9PT0gc3Vic2V0O1xuICB9O1xuICB2YXIgaXNVbmRlZk9yTm9uWmVybyA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gdmFsID09PSB1bmRlZmluZWQgfHwgdmFsICE9PSAnMCc7XG4gIH07XG5cbiAgLy8gVGVzdCB0YXNrLlxuICB2YXIgdGVzdFN1YnRhc2tzID0gW107XG4gIC8vIFNraXAgY29yZSB0ZXN0cyBpZiBydW5uaW5nIGEgZGlmZmVyZW50IHN1YnNldCBvZiB0aGUgdGVzdCBzdWl0ZVxuICBpZiAocnVuU3Vic2V0KCdjb3JlJykgJiZcbiAgICAgIC8vIFNraXAgY29yZSB0ZXN0cyBpZiB0aGlzIGlzIGEgU2F2YWdlIGJ1aWxkXG4gICAgICBwcm9jZXNzLmVudi5UUkFWSVNfUkVQT19TTFVHICE9PSAndHdicy1zYXZhZ2UvYm9vdHN0cmFwJykge1xuICAgIHRlc3RTdWJ0YXNrcyA9IHRlc3RTdWJ0YXNrcy5jb25jYXQoWydkaXN0LWNzcycsICdkaXN0LWpzJywgJ2Nzc2xpbnQ6ZGlzdCcsICd0ZXN0LWpzJywgJ2RvY3MnXSk7XG4gIH1cbiAgLy8gU2tpcCBIVE1MIHZhbGlkYXRpb24gaWYgcnVubmluZyBhIGRpZmZlcmVudCBzdWJzZXQgb2YgdGhlIHRlc3Qgc3VpdGVcbiAgaWYgKHJ1blN1YnNldCgndmFsaWRhdGUtaHRtbCcpICYmXG4gICAgICAvLyBTa2lwIEhUTUw1IHZhbGlkYXRvciBvbiBUcmF2aXMgd2hlbiBbc2tpcCB2YWxpZGF0b3JdIGlzIGluIHRoZSBjb21taXQgbWVzc2FnZVxuICAgICAgaXNVbmRlZk9yTm9uWmVybyhwcm9jZXNzLmVudi5UV0JTX0RPX1ZBTElEQVRPUikpIHtcbiAgICB0ZXN0U3VidGFza3MucHVzaCgndmFsaWRhdGUtaHRtbCcpO1xuICB9XG4gIC8vIE9ubHkgcnVuIFNhdWNlIExhYnMgdGVzdHMgaWYgdGhlcmUncyBhIFNhdWNlIGFjY2VzcyBrZXlcbiAgaWYgKHR5cGVvZiBwcm9jZXNzLmVudi5TQVVDRV9BQ0NFU1NfS0VZICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgLy8gU2tpcCBTYXVjZSBpZiBydW5uaW5nIGEgZGlmZmVyZW50IHN1YnNldCBvZiB0aGUgdGVzdCBzdWl0ZVxuICAgICAgcnVuU3Vic2V0KCdzYXVjZS1qcy11bml0JykgJiZcbiAgICAgIC8vIFNraXAgU2F1Y2Ugb24gVHJhdmlzIHdoZW4gW3NraXAgc2F1Y2VdIGlzIGluIHRoZSBjb21taXQgbWVzc2FnZVxuICAgICAgaXNVbmRlZk9yTm9uWmVybyhwcm9jZXNzLmVudi5UV0JTX0RPX1NBVUNFKSkge1xuICAgIHRlc3RTdWJ0YXNrcy5wdXNoKCdjb25uZWN0Jyk7XG4gICAgdGVzdFN1YnRhc2tzLnB1c2goJ3NhdWNlbGFicy1xdW5pdCcpO1xuICB9XG4gIGdydW50LnJlZ2lzdGVyVGFzaygndGVzdCcsIHRlc3RTdWJ0YXNrcyk7XG4gIGdydW50LnJlZ2lzdGVyVGFzaygndGVzdC1qcycsIFsnanNoaW50OmNvcmUnLCAnanNoaW50OnRlc3QnLCAnanNoaW50OmdydW50JywgJ2pzY3M6Y29yZScsICdqc2NzOnRlc3QnLCAnanNjczpncnVudCcsICdxdW5pdCddKTtcblxuICAvLyBKUyBkaXN0cmlidXRpb24gdGFzay5cbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdkaXN0LWpzJywgWydjb25jYXQnLCAndWdsaWZ5OmNvcmUnLCAnY29tbW9uanMnXSk7XG5cbiAgLy8gQ1NTIGRpc3RyaWJ1dGlvbiB0YXNrLlxuICBncnVudC5yZWdpc3RlclRhc2soJ2xlc3MtY29tcGlsZScsIFsnbGVzczpjb21waWxlQ29yZScsICdsZXNzOmNvbXBpbGVUaGVtZSddKTtcbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdkaXN0LWNzcycsIFsnbGVzcy1jb21waWxlJywgJ2F1dG9wcmVmaXhlcjpjb3JlJywgJ2F1dG9wcmVmaXhlcjp0aGVtZScsICd1c2ViYW5uZXInLCAnY3NzY29tYjpkaXN0JywgJ2Nzc21pbjptaW5pZnlDb3JlJywgJ2Nzc21pbjptaW5pZnlUaGVtZSddKTtcblxuICAvLyBGdWxsIGRpc3RyaWJ1dGlvbiB0YXNrLlxuICBncnVudC5yZWdpc3RlclRhc2soJ2Rpc3QnLCBbJ2NsZWFuOmRpc3QnLCAnZGlzdC1jc3MnLCAnY29weTpmb250cycsICdkaXN0LWpzJ10pO1xuXG4gIC8vIERlZmF1bHQgdGFzay5cbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdkZWZhdWx0JywgWydjbGVhbjpkaXN0JywgJ2NvcHk6Zm9udHMnLCAndGVzdCddKTtcblxuICAvLyBWZXJzaW9uIG51bWJlcmluZyB0YXNrLlxuICAvLyBncnVudCBjaGFuZ2UtdmVyc2lvbi1udW1iZXIgLS1vbGR2ZXI9QS5CLkMgLS1uZXd2ZXI9WC5ZLlpcbiAgLy8gVGhpcyBjYW4gYmUgb3ZlcnplYWxvdXMsIHNvIGl0cyBjaGFuZ2VzIHNob3VsZCBhbHdheXMgYmUgbWFudWFsbHkgcmV2aWV3ZWQhXG4gIGdydW50LnJlZ2lzdGVyVGFzaygnY2hhbmdlLXZlcnNpb24tbnVtYmVyJywgJ3NlZCcpO1xuXG4gIGdydW50LnJlZ2lzdGVyVGFzaygnYnVpbGQtZ2x5cGhpY29ucy1kYXRhJywgZnVuY3Rpb24gKCkgeyBnZW5lcmF0ZUdseXBoaWNvbnNEYXRhLmNhbGwodGhpcywgZ3J1bnQpOyB9KTtcblxuICAvLyB0YXNrIGZvciBidWlsZGluZyBjdXN0b21pemVyXG4gIGdydW50LnJlZ2lzdGVyVGFzaygnYnVpbGQtY3VzdG9taXplcicsIFsnYnVpbGQtY3VzdG9taXplci1odG1sJywgJ2J1aWxkLXJhdy1maWxlcyddKTtcbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdidWlsZC1jdXN0b21pemVyLWh0bWwnLCAnamFkZScpO1xuICBncnVudC5yZWdpc3RlclRhc2soJ2J1aWxkLXJhdy1maWxlcycsICdBZGQgc2NyaXB0cy9sZXNzIGZpbGVzIHRvIGN1c3RvbWl6ZXIuJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBiYW5uZXIgPSBncnVudC50ZW1wbGF0ZS5wcm9jZXNzKCc8JT0gYmFubmVyICU+Jyk7XG4gICAgZ2VuZXJhdGVSYXdGaWxlcyhncnVudCwgYmFubmVyKTtcbiAgfSk7XG5cbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdjb21tb25qcycsICdHZW5lcmF0ZSBDb21tb25KUyBlbnRyeXBvaW50IG1vZHVsZSBpbiBkaXN0IGRpci4nLCBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNyY0ZpbGVzID0gZ3J1bnQuY29uZmlnLmdldCgnY29uY2F0LmJvb3RzdHJhcC5zcmMnKTtcbiAgICB2YXIgZGVzdEZpbGVwYXRoID0gJ2Rpc3QvanMvbnBtLmpzJztcbiAgICBnZW5lcmF0ZUNvbW1vbkpTTW9kdWxlKGdydW50LCBzcmNGaWxlcywgZGVzdEZpbGVwYXRoKTtcbiAgfSk7XG5cbiAgLy8gRG9jcyB0YXNrLlxuICBncnVudC5yZWdpc3RlclRhc2soJ2RvY3MtY3NzJywgWydhdXRvcHJlZml4ZXI6ZG9jcycsICdhdXRvcHJlZml4ZXI6ZXhhbXBsZXMnLCAnY3NzY29tYjpkb2NzJywgJ2Nzc2NvbWI6ZXhhbXBsZXMnLCAnY3NzbWluOmRvY3MnXSk7XG4gIGdydW50LnJlZ2lzdGVyVGFzaygnbGludC1kb2NzLWNzcycsIFsnY3NzbGludDpkb2NzJywgJ2Nzc2xpbnQ6ZXhhbXBsZXMnXSk7XG4gIGdydW50LnJlZ2lzdGVyVGFzaygnZG9jcy1qcycsIFsndWdsaWZ5OmRvY3NKcycsICd1Z2xpZnk6Y3VzdG9taXplJ10pO1xuICBncnVudC5yZWdpc3RlclRhc2soJ2xpbnQtZG9jcy1qcycsIFsnanNoaW50OmFzc2V0cycsICdqc2NzOmFzc2V0cyddKTtcbiAgZ3J1bnQucmVnaXN0ZXJUYXNrKCdkb2NzJywgWydkb2NzLWNzcycsICdsaW50LWRvY3MtY3NzJywgJ2RvY3MtanMnLCAnbGludC1kb2NzLWpzJywgJ2NsZWFuOmRvY3MnLCAnY29weTpkb2NzJywgJ2J1aWxkLWdseXBoaWNvbnMtZGF0YScsICdidWlsZC1jdXN0b21pemVyJ10pO1xuXG4gIGdydW50LnJlZ2lzdGVyVGFzaygncHJlcC1yZWxlYXNlJywgWydqZWt5bGw6Z2l0aHViJywgJ2NvbXByZXNzJ10pO1xuXG4gIC8vIFRhc2sgZm9yIHVwZGF0aW5nIHRoZSBjYWNoZWQgbnBtIHBhY2thZ2VzIHVzZWQgYnkgdGhlIFRyYXZpcyBidWlsZCAod2hpY2ggYXJlIGNvbnRyb2xsZWQgYnkgdGVzdC1pbmZyYS9ucG0tc2hyaW5rd3JhcC5qc29uKS5cbiAgLy8gVGhpcyB0YXNrIHNob3VsZCBiZSBydW4gYW5kIHRoZSB1cGRhdGVkIGZpbGUgc2hvdWxkIGJlIGNvbW1pdHRlZCB3aGVuZXZlciBCb290c3RyYXAncyBkZXBlbmRlbmNpZXMgY2hhbmdlLlxuICBncnVudC5yZWdpc3RlclRhc2soJ3VwZGF0ZS1zaHJpbmt3cmFwJywgWydleGVjOm5wbVVwZGF0ZScsICdfdXBkYXRlLXNocmlua3dyYXAnXSk7XG4gIGdydW50LnJlZ2lzdGVyVGFzaygnX3VwZGF0ZS1zaHJpbmt3cmFwJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBkb25lID0gdGhpcy5hc3luYygpO1xuICAgIG5wbVNocmlua3dyYXAoeyBkZXY6IHRydWUsIGRpcm5hbWU6IF9fZGlybmFtZSB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGdydW50LmZhaWwud2FybihlcnIpO1xuICAgICAgfVxuICAgICAgdmFyIGRlc3QgPSAndGVzdC1pbmZyYS9ucG0tc2hyaW5rd3JhcC5qc29uJztcbiAgICAgIGZzLnJlbmFtZVN5bmMoJ25wbS1zaHJpbmt3cmFwLmpzb24nLCBkZXN0KTtcbiAgICAgIGdydW50LmxvZy53cml0ZWxuKCdGaWxlICcgKyBkZXN0LmN5YW4gKyAnIHVwZGF0ZWQuJyk7XG4gICAgICBkb25lKCk7XG4gICAgfSk7XG4gIH0pO1xufTtcbiJdLCJmaWxlIjoiYm9vdHN0cmFwL0dydW50ZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
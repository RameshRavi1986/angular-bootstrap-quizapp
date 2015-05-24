/** Gulp task runner for automating build
**/

var gulp=require('gulp');
var uglify=require('gulp-uglify');
var concat=require('gulp-concat');
var del=require('del');
var server=require('./config/server.js');
var sourcemaps=require('gulp-sourcemaps');
var rename=require('gulp-rename');
var wiredep = require('wiredep').stream;
var inject=require('gulp-inject');
var less=require('gulp-less');
var gutil=require('gulp-util');
// Configure paths for different parts of the file
var paths={
	scripts:['!app/**/**/data/*data.js','app/components/*module/**!(app)/*.js','app/components/**/*.js','app/app.js'],
	styles:'app/components/**/assets/*.less',
	html:'app/index.html',
	build:'build',
	jsbuildpath:'build/js',
	stylesbuildpath:'build/css',
	bower_components:['bower_components/**/*.js','bower_components/**/*min.js.map'],
	img:['app/**/*.gif','app/**/*.jpg'],
	apis:['app/**/**/data/*data.js']
};
// Clean the build folder before we start
gulp.task('clean',function(cb){
	del(['build'],cb);
});

// bootstrap less file to be configured
gulp.task('less', function(){
return gulp.src('app/bootstrap/vendor.less')
       .pipe(less({compress: true}).on('error', gutil.log))
	   .pipe(concat("vendor.min.css"))
       .pipe(gulp.dest('build/css'));


});

// To copy the bower_components to build
gulp.task('bower_files',function(){
return gulp.src(paths.bower_components)
	.pipe(sourcemaps.init())
	.pipe(sourcemaps.write())
	.pipe(gulp.dest('build/bower_components'));
});

// Copy html templates specific to each module to build folder
gulp.task('templates',function(){
return gulp.src('app/components/**/assets/*.html')
	.pipe(rename(function(path){
		path.dirname="";

	}))
	.pipe(gulp.dest('build/templates/'));

});

// Main html with css and js included
gulp.task('html',function(){
  gulp.src('app/index.html')
    .pipe(wiredep({
		// exclude:['bootstrap'],
		fileTypes: {
        html: {
          replace: {
            js: function(filePath) {
              return '<script src="' +filePath.split(".")[2] + '.min.js"></script>';
            },
            css: function(filePath) {
			  var css="";
			  if(filePath.indexOf("bootstrap")===-1)
				  css='<link rel="stylesheet" href="'+ filePath.split(".")[2] + '.min.css"/>';
              return css;
            }
          }
        }
      }
    }))
    .pipe(gulp.dest(paths.build));
  });

 // App specific scripts to be copied to build folder
gulp.task('scripts',function(){
return gulp.src(paths.scripts)
	.pipe(sourcemaps.init())
	.pipe(concat('app.min.js'))
	.pipe(sourcemaps.write())
	.pipe(gulp.dest(paths.jsbuildpath));
});

// Images  copied to build
gulp.task('images',function(){
return gulp.src(paths.img)
	  .pipe(rename(function(path){
		path.dirname="";

	}))
	.pipe(gulp.dest('build/images'));

});

// Mocked apis copied to build
gulp.task('apis',function(){
	return gulp.src(paths.apis)
		.pipe(rename(function(path){
			path.dirname="";
		}))
		.pipe(gulp.dest('build/data'));
});

// css copied to build
gulp.task('styles',function(){
return gulp.src(paths.styles)
       .pipe(less({compress: true}).on('error', gutil.log))
		
	   .pipe(concat("app.min.css"))
       .pipe(gulp.dest('build/css'));

});
// Auto update the build folder once you change the data
gulp.task('watch',function(){
	gulp.watch(paths.scripts,['scripts']);
	gulp.watch(paths.styles,['styles']);
	gulp.watch(paths.html,['html']);
	gulp.watch('app/components/**/assets/*.html',['templates']);
});
gulp.task('server',function(){

	server.startServer();
});
gulp.task('default',['clean'],function(){
	gulp.start('watch','scripts','less','styles','images','apis','bower_files','templates','html','server');
});
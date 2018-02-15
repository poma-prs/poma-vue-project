'use strict';

var fs = require('fs'),
	gulp = require('gulp'),
	sync = require('browser-sync'),
	browserify = require('browserify'),
	watchify = require('watchify'),
	vueify = require('vueify'),
    source = require('vinyl-source-stream'),
	wiredep = require('wiredep').stream,
	sass = require('node-sass'),
	autoprefixer = require('autoprefixer'),
	postcss = require('postcss'),
	config = require('./config');

var $ = require('gulp-load-plugins')();

vueify.compiler.applyConfig({
	customCompilers: {
		scss: function (content, cb, compiler, filePath) {
			sass.render({
				data: content
			}, function (err, res) {
				if (err) {
					cb(err);
				} else {
					var css = res.css.toString();
					var prefixed = postcss([autoprefixer]).process(css).css;
					cb(null, prefixed);
				}
			});
		}
	}
})

/**
 *	Transform paths function
 *	@desc Updates paths before insert css and js into html file
 */

function transformPaths() {

	return {
		transform: function(filepath, file, i, length, targetFile) {

			var root = config.src.slice(2),
				targetpath = targetFile.path.slice(targetFile.path.indexOf(root) + root.length);

			filepath = filepath.slice(filepath.slice(1).indexOf('/') + 2);

			if(targetpath.indexOf('/') + 1) {
				filepath = '../' + filepath;
			}

			return $.inject.transform.apply($.inject.transform, [filepath, file, i, length, targetFile]);

		}
	};

}

/**
 *	BrowserSync task
 *	@desc Initializes BrowserSync
 */

gulp.task('watch:sync', function() {

	sync({
		open: false,
		startPath: '/',
		server: {
			baseDir: config.src,
			index: 'index.html'
		}
	});

});

/**
 *	Reload styles task
 *	@desc Runs sync reload
 */

gulp.task('watch:reloadstyles', function() {

	gulp.src(config.src + config.tmp + '/**/*.css')
		.pipe($.plumber())
		.pipe(sync.reload({
			stream: true
		}));

});

/**
 *	Reload pug task
 *	@extends wiredep
 *	@desc Compiles pug, inserts css and js, runs sync reload
 *	@return
 */

gulp.task('watch:reloadhtml', ['watch:wiredep'], function() {

	var sources = [
		config.src + config.tmp + '/**/*.css',
		config.src + config.tmp + '/**/*.js'
	];

	return gulp.src([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'])
		.pipe($.inject(gulp.src(sources), transformPaths()))
		.pipe(gulp.dest(config.src))
		.pipe(sync.reload({
			stream: true
		}));

});

/**
 *	Bower task
 *	@extends pug
 *	@desc Injects bower dependencies into html
 *	@return
 */

gulp.task('watch:wiredep', function() {

	if(config.folder.vendors && fs.existsSync(config.src + config.folder.vendors)) {

		return gulp.src([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'])
			.pipe(wiredep({
				directory: config.src + config.folder.vendors
			}))
			.pipe(gulp.dest(config.src));

	}

});

/**
 *	Clean js task
 *	@desc Removes js files from temp folder
 *	@return
 */

gulp.task('watch:cleanjs', function() {

	return gulp.src([config.src + config.tmp + '/**/*.js'])
		.pipe($.rimraf({ force: true }));

});

/**
 *	Watchify task
 *	@extends cleanjs
 *	@return
 */

gulp.task('watch:watchify', ['watch:cleanjs'], function() {

	var bundler = watchify(browserify(config.src + 'index.js'))
		.transform(vueify)
		.plugin('vueify/plugins/extract-css', {
			out: config.src + config.tmp + '/bundle.css'
		})
		.on('update', rebundle);

	function rebundle() {
		return bundler.bundle()
			.pipe(source('bundle.js'))
			.pipe(gulp.dest(config.src + config.tmp));
	}

	return rebundle();

});

/**
 *	Reload js task
 *	@extends babeljs
 *	@desc Compiles/validates js files, runs sync reload
 */

gulp.task('watch:reloadjs', function() {

	gulp.src([config.src + '/**/*.js', '!' + config.src + config.folder.vendors + '/**'])
		.pipe($.plumber())
		.pipe($.jshint('.es6hintrc'))
		.pipe($.jshint.reporter())
		.pipe(sync.reload({
			stream: true
		}));

});

/**
 *	Html task
 *	@desc Validates html files
 */

gulp.task('watch:html', function() {

	gulp.src([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'])
		.pipe($.plumber())
		.pipe($.htmlhint('.htmlhintrc'))
		.pipe($.htmlhint.reporter())
		.pipe(sync.reload({
			stream: true
		}));

});

/**
 *	Inject task
 *	@extends wiredep, watchify
 *	@desc Inserts js and css files into html
 *	@return
 */

gulp.task('watch:inject', ['watch:wiredep', 'watch:watchify'], function() {

	var sources = [
		config.src + config.tmp + '/**/*.css',
		config.src + config.tmp + '/**/*.js'
	];

	return gulp.src([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'])
		.pipe($.inject(gulp.src(sources), transformPaths()))
		.pipe(gulp.dest(config.src));

});

/**
 *	Watch
 *	@extends inject, sync
 *	@desc Runs browser sync and watches for src folder
 */

gulp.task('watch', ['watch:inject', 'watch:sync'], function() {

	gulp.watch([config.src + config.tmp + '/**/*.{css}'], ['watch:reloadstyles']);

	gulp.watch([config.src + config.tmp + '/**/*.js'], ['watch:reloadjs']);

	gulp.watch([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'], ['watch:html']);
	
});
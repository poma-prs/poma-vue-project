'use strict';

var fs = require('fs'),
	gulp = require('gulp'),
	sync = require('browser-sync'),
	browserify = require('browserify'),
	envify = require('envify/custom'),
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
 *	Watch task
 *	@desc Runs watcher for dist folder
 */

gulp.task('build:watch', function() {

	sync({
		open: false,
		startPath: '/',
		server: {
			baseDir: config.dist,
			index: 'index.html'
		}
	});

});

/**
 *	Clean task
 *	@desc Removes temp and dist folders
 *	@return
 */

gulp.task('build:clean', function() {

	return gulp.src([config.dist, config.src + config.tmp])
		.pipe($.rimraf({ force: true }));

});

/**
 *	Copy task
 *	@extends clean
 *	@desc Copies files and folders from root folder
 *	@return
 */

gulp.task('build:copy', ['build:clean'], function() {

	if(config.copyfiles.length) {

		for(var i = 0, l = config.copyfiles.length; i < l; i++) {
			config.copyfiles[i] = config.src + config.copyfiles[i];
		}

		return gulp.src(config.copyfiles)
			.pipe($.copy(config.dist, { prefix: 1 }))
			.pipe($.size());

	}

});

/**
 *	Fonts task
 *	@extends clean
 *	@desc Copies fonts to dist folder
 *	@return
 */

gulp.task('build:fonts', ['build:clean'], function() {

	if(config.folder.fonts) {

		return gulp.src(config.src + config.folder.fonts + '/**/*.{eot,svg,ttf,woff}')
			.pipe(gulp.dest(config.dist + config.folder.fonts))
			.pipe($.size());

	}

});

/**
 *	Images task
 *	@extends clean
 *	@desc Optimizations images, copies media files to dist folder
 *	@return
 */

gulp.task('build:images', ['build:clean'], function() {

	var path = [];

	if(config.folder.icons) { path.push(config.folder.icons); }
	if(config.folder.images) { path.push(config.folder.images); }
	if(config.folder.pictures) { path.push(config.folder.pictures); }

	path.forEach(function(folder) {

		return gulp.src(config.src + folder + '/**/*.{jpg,png,gif,svg}')
			.pipe($.plumber())
			.pipe($.imagemin({
				optimizationLevel: 3,
				progressive: true,
				interlaced: true,
				svgoPlugins: [
					{ removeViewBox: true },
					{ removeEmptyAttrs: true }
				]
			}))
			.pipe(gulp.dest(config.dist + folder))
			.pipe($.size());

	});

});

/**
 *	Bower task
 *	@extends clean
 *	@desc Injects bower dependencies into html
 *	@return
 */

gulp.task('build:wiredep', ['build:clean'], function() {

	if(config.folder.vendors && fs.existsSync(config.src + config.folder.vendors)) {

		return gulp.src([config.src + '**/*.html', '!' + config.src + config.folder.vendors + '/**'])
			.pipe(wiredep({
				directory: config.src + config.folder.vendors
			}))
			.pipe(gulp.dest(config.src));

	}

});

/**
 *	Browserify task
 *	@extends clean
 *	@desc
 */

gulp.task('build:browserify', ['build:clean'], function() {
	
	//process.env.NODE_ENV = 'production';
	return browserify(config.src + 'index.js')
		.transform(vueify)
		.plugin('vueify/plugins/extract-css', {
			out: config.src + config.tmp + '/bundle.css'
		})
		.transform(
			// Порядок необходим для обработки файлов node_modules
			{ global: true },
			envify({ NODE_ENV: process.env.NODE_ENV }))
		.bundle()
		.pipe(source('bundle.js'))
		.pipe(gulp.dest(config.src + config.tmp));

});

/**
 *	Inject task
 *	@extends clean, wiredep, browserify
 *	@desc Injects js and css files into html
 *	@return
 */

gulp.task('build:inject', ['build:clean', 'build:wiredep', 'build:browserify'], function() {

	var sources = [
		config.src + config.tmp + '/**/*.css',
		config.src + config.tmp + '/**/*.js'
	];

	var transform = {
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

	return gulp.src(config.src + 'index.html')
		.pipe($.inject(gulp.src(sources), transform))
		.pipe(gulp.dest(config.src));

});

/**
 *	Assets task
 *	@extends clean, inject
 *	@desc Concatenates/compresses js and css files, copies files to the dist folder, adds hash to files name if rev flag set as true
 *	@return
 */

gulp.task('build:assets', ['build:clean', 'build:inject'], function() {

	var jsFilter = $.filter('**/*.js'),
		cssFilter = $.filter('**/*.css');

	return gulp.src(config.src + 'index.html')
		.pipe($.useref.assets())
		.pipe($.if(config.rev, $.rev()))

		.pipe(jsFilter)
		.pipe($.sourcemaps.init())
		.pipe($.uglify())
		.pipe($.sourcemaps.write('.'))
		.pipe(jsFilter.restore())

		.pipe(cssFilter)
		.pipe($.sourcemaps.init())
		.pipe($.csso())
		.pipe($.autoprefixer({
			browsers: config.browsers,
			cascade: false
		}))
		.pipe($.sourcemaps.write('.'))
		.pipe(cssFilter.restore())

		.pipe(gulp.dest(config.dist))
		.pipe($.size());

});

/**
 *	Build task
 *	@extends clean, copy, fonts, images, assets
 *	@desc Injects js and css files into html, compresses html and replace paths
 */

gulp.task('build', ['build:clean', 'build:copy', 'build:fonts', 'build:images', 'build:assets'], function() {

	gulp.src(config.src + 'index.html')
		.pipe($.inject(gulp.src(config.dist + 'css/**/*.css', { read: true }), { relative: true }))
		.pipe($.inject(gulp.src(config.dist + 'scripts/**/*.js', { read: true }), { relative: true }))
		.pipe($.removeCode({ build: true }))
		.pipe($.if($.util.env.abspaths, $.replace('.' + config.dist, '/'), $.replace('.' + config.dist, '')))
		.pipe($.htmlmin({
			removeComments: true,
			collapseWhitespace: true,
			removeStyleLinkTypeAttributes: true,
			removeScriptTypeAttributes: true
		}))
		.pipe($.notify({
			title: 'Gulp',
			message: 'Build is ready',
			sound: 'Pop',
			icon: false,
			onLast: true
		}))
		.pipe(gulp.dest(config.dist))
		.pipe($.size());

});
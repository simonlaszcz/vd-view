/// <binding AfterBuild='build' />

'use strict';

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
var uglify = require('gulp-terser');
var sourcemaps = require('gulp-sourcemaps');
var buffer = require('vinyl-buffer');
var browserifyTargetFolder = 'wwwroot/js/bundles';
var concat = require('gulp-concat');
var cssmin = require('gulp-cssmin');
var merge = require('merge-stream');
var sass = require('gulp-sass')(require('sass'));
var crypto = require('crypto');
var fs = require('fs');
var glob = require('glob');
var pathify = require('path');
var bundleConfig = require('./bundleconfig.json');
var tsConfig = require('./tsconfig.json');
var fileRegex = {
    css: /\.css$/,
    html: /\.(html|htm)$/,
    js: /\.js$/
};

gulp.task('build', gulp.series(gulp.parallel(gulp.series(function minifyJs() {
    var tasks = getBundles(fileRegex.js).map(function (bundle) {
        return gulp.src(bundle.inputFiles, { base: '.' }).pipe(concat(bundle.outputFileName)).pipe(uglify()).pipe(gulp.dest('.'));
    });
    return merge(tasks);
}), gulp.series(function compileSass() {
    return gulp.src('wwwroot/css/*.scss', { allowEmpty: true }).pipe(sass().on('error', sass.logError)).pipe(gulp.dest('wwwroot/css', { allowEmpty: true }));
}, function processCssBundles() {
    var tasks = getBundles(fileRegex.css).map(function (bundle) {
        return gulp.src(bundle.inputFiles, { base: '.' }).pipe(concat(bundle.outputFileName)).pipe(cssmin()).pipe(gulp.dest('.'));
    });
    return merge(tasks);
}, function copyLibImages() {
    return gulp.src(['wwwroot/libs/lightslider/img/*']).pipe(gulp.dest('wwwroot/css/img'));
}), gulp.series(function compileMain() {
    return browserifyModule(['wwwroot/js/app_ts/Main.ts'], 'main.bundle.js');
}, function compileEditorMain() {
    return browserifyModule(['wwwroot/js/app_ts/EditorMain.ts'], 'editormain.bundle.js');
})), gulp.series(function generateFileHashes(done) {
    var files, output;
    return regeneratorRuntime.async(function generateFileHashes$(context$1$0) {
        var _this = this;

        while (1) switch (context$1$0.prev = context$1$0.next) {
            case 0:
                context$1$0.next = 2;
                return regeneratorRuntime.awrap(globMultipleAsync(['wwwroot/js/bundles/*.js', 'wwwroot/css/bundles/*.css', 'wwwroot/libs/requirejs/*.js']));

            case 2:
                files = context$1$0.sent;
                output = fs.createWriteStream('Build/hashes.txt');
                context$1$0.next = 6;
                return regeneratorRuntime.awrap(Promise.all(files.map(function callee$1$0(path) {
                    var hash;
                    return regeneratorRuntime.async(function callee$1$0$(context$2$0) {
                        while (1) switch (context$2$0.prev = context$2$0.next) {
                            case 0:
                                console.log('Hashing ' + path);
                                context$2$0.next = 3;
                                return regeneratorRuntime.awrap(getFileHash(path));

                            case 3:
                                hash = context$2$0.sent;
                                context$2$0.next = 6;
                                return regeneratorRuntime.awrap(writeHashResult(output, path, hash));

                            case 6:
                            case 'end':
                                return context$2$0.stop();
                        }
                    }, null, _this);
                })));

            case 6:

                output.close();
                done();

            case 8:
            case 'end':
                return context$1$0.stop();
        }
    }, null, this);
})));

function browserifyModule(entries, bundleFile) {
    return browserify({
        basedir: '.',
        debug: true,
        entries: entries,
        cache: {},
        packageCache: {}
    }).plugin(tsify, tsConfig).bundle().pipe(source(bundleFile)).pipe(buffer()).pipe(sourcemaps.init({ loadMaps: true })).pipe(uglify()).pipe(sourcemaps.write('./')).pipe(gulp.dest(browserifyTargetFolder));
}

function getBundles(regexPattern) {
    return bundleConfig.filter(function (bundle) {
        return regexPattern.test(bundle.outputFileName);
    });
}

function getFileHash(path) {
    return new Promise(function (resolve, reject) {
        var hash = crypto.createHash('sha256');
        var input = fs.createReadStream(path);

        input.on('error', reject);
        input.on('data', function (chunk) {
            hash.update(chunk);
        });
        input.on('close', function () {
            resolve(hash.digest('base64'));
        });
    });
}

function writeHashResult(stream, path, hash) {
    return new Promise(function (resolve, reject) {
        var p = pathify.parse(path);

        stream.write(p.base + '\t' + hash + '\r\n', function () {
            resolve();
        });
    });
}

function globMultipleAsync(patterns) {
    var unflat;
    return regeneratorRuntime.async(function globMultipleAsync$(context$1$0) {
        var _this2 = this;

        while (1) switch (context$1$0.prev = context$1$0.next) {
            case 0:
                context$1$0.next = 2;
                return regeneratorRuntime.awrap(Promise.all(patterns.map(function callee$1$0(pattern) {
                    return regeneratorRuntime.async(function callee$1$0$(context$2$0) {
                        while (1) switch (context$2$0.prev = context$2$0.next) {
                            case 0:
                                context$2$0.next = 2;
                                return regeneratorRuntime.awrap(globAsync(pattern));

                            case 2:
                                return context$2$0.abrupt('return', context$2$0.sent);

                            case 3:
                            case 'end':
                                return context$2$0.stop();
                        }
                    }, null, _this2);
                })));

            case 2:
                unflat = context$1$0.sent;
                return context$1$0.abrupt('return', unflat.flat());

            case 4:
            case 'end':
                return context$1$0.stop();
        }
    }, null, this);
}

function globAsync(pattern) {
    return new Promise(function (resolve, reject) {
        glob(pattern, function (err, files) {
            if (err != null) {
                reject();
            } else {
                resolve(files);
            }
        });
    });
}


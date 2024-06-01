/// <binding AfterBuild='build' />

const gulp = require('gulp');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const tsify = require('tsify');
const uglify = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');
const buffer = require('vinyl-buffer');
const browserifyTargetFolder = 'wwwroot/js/bundles';
const concat = require('gulp-concat');
const cssmin = require('gulp-cssmin');
const merge = require('merge-stream');
const sass = require('gulp-sass')(require('sass'));
const crypto = require('crypto');
const fs = require('fs');
const glob = require('glob');
const pathify = require('path');
const bundleConfig = require('./bundleconfig.json');
const tsConfig = require('./tsconfig.json');
const fileRegex = {
    css: /\.css$/,
    html: /\.(html|htm)$/,
    js: /\.js$/
};

gulp.task(
    'build',
    gulp.series(
        gulp.parallel(
            gulp.series(function minifyJs() {
                var tasks = getBundles(fileRegex.js).map(function (bundle) {
                    return gulp.src(bundle.inputFiles, { base: '.' })
                        .pipe(concat(bundle.outputFileName))
                        .pipe(uglify())
                        .pipe(gulp.dest('.'));
                });
                return merge(tasks);
            }),
            gulp.series(
                function compileSass() {
                    return gulp.src('wwwroot/css/*.scss', { allowEmpty: true })
                        .pipe(sass().on('error', sass.logError))
                        .pipe(gulp.dest('wwwroot/css', { allowEmpty: true }));

                },
                function processCssBundles() {
                    var tasks = getBundles(fileRegex.css).map(function (bundle) {
                        return gulp.src(bundle.inputFiles, { base: '.' })
                            .pipe(concat(bundle.outputFileName))
                            .pipe(cssmin())
                            .pipe(gulp.dest('.'));
                    })
                    return merge(tasks);
                },
                function copyLibImages() {
                    return gulp.src(['wwwroot/libs/lightslider/img/*']).pipe(gulp.dest('wwwroot/css/img'));
                }
            ),
            gulp.series(
                function compileMain() {
                    return browserifyModule(['wwwroot/js/app_ts/Main.ts'], 'main.bundle.js');
                },
                function compileEditorMain() {
                    return browserifyModule(['wwwroot/js/app_ts/EditorMain.ts'], 'editormain.bundle.js');
                }
            )
        ),
        gulp.series(async function generateFileHashes(done) {
            const files = await globMultipleAsync(['wwwroot/js/bundles/*.js', 'wwwroot/css/bundles/*.css', 'wwwroot/libs/requirejs/*.js']);
            const output = fs.createWriteStream('Build/hashes.txt');

            await Promise.all(files.map(async path => {
                console.log(`Hashing ${path}`);
                const hash = await getFileHash(path);
                await writeHashResult(output, path, hash);
            }));

            output.close();
            done();
        })
    )
);

function browserifyModule(entries, bundleFile) {
    return browserify({
        basedir: '.',
        debug: true,
        entries: entries,
        cache: {},
        packageCache: {},
    })
    .plugin(tsify, tsConfig)
    .bundle()
    .pipe(source(bundleFile))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(browserifyTargetFolder));
}

function getBundles(regexPattern) {
    return bundleConfig.filter(function (bundle) {
        return regexPattern.test(bundle.outputFileName);
    });
}

function getFileHash(path) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(path);

        input.on('error', reject);
        input.on('data', (chunk) => {
            hash.update(chunk);
        });
        input.on('close', () => {
            resolve(hash.digest('base64'));
        });
    });
}

function writeHashResult(stream, path, hash) {
    return new Promise((resolve, reject) => {
        const p = pathify.parse(path);

        stream.write(`${p.base}\t${hash}\r\n`, () => {
            resolve();
        });
    });
}

async function globMultipleAsync(patterns) {
    const unflat = await Promise.all(patterns.map(async pattern => {
        return await globAsync(pattern);        
    }));

    return unflat.flat();
}

function globAsync(pattern) {
    return new Promise((resolve, reject) => {
        glob(pattern, (err, files) => {
            if (err != null) {
                reject();
            }
            else {
                resolve(files);
            }
        });
    });
}
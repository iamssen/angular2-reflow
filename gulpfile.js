'use strict';

let gulp = require('gulp');
let sass = require('gulp-sass');
let clean = require('gulp-clean');
let typescript = require('typescript');
let glob = require('glob');

gulp.task('clean', () => {
  return gulp
    .src('./dist/**/*', {read: false})
    .pipe(clean());
});

gulp.task('copy', () => {
  return gulp
    .src(['./src/**/*', '!./src/**/*.ts', '!./src/**/*.scss'])
    .pipe(gulp.dest('./dist'));
})

function tsc(options) {
  glob('./src/**/*.ts', {}, (err, files) => {
    let program = typescript.createProgram(files, Object.assign(options, {
      target: typescript.ScriptTarget.ES5,
      sourceMap: true,
      removeComments: true,
      noImplicitAny: false,
      experimentalDecorators: true,
      emitDecoratorMetadata: true
    }));

    let emitResult = program.emit();
    let allDiagnostics = typescript.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      let lineAndCharacter = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      let line = lineAndCharacter.line;
      let character = lineAndCharacter.character;
      let message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    });
  })
}

gulp.task('build.commonjs', () => {
  tsc({
    module: typescript.ModuleKind.CommonJS,
    declaration: true,
    outDir: "./dist"
  });
});

gulp.task('build.amd', () => {
  tsc({
    module: typescript.ModuleKind.AMD,
    declaration: false,
    outFile: "./dist/angular2-reflow.amd.js"
  });
});

gulp.task('build.system', () => {
  tsc({
    module: typescript.ModuleKind.System,
    declaration: false,
    outFile: "./dist/angular2-reflow.system.js"
  });
});

gulp.task('typescript', ['build.commonjs', 'build.amd', 'build.system']);

gulp.task('sass', () => {
  return gulp
    .src('./src/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./dist'));
});

gulp.task('build', ['clean', 'typescript', 'sass', 'copy']);
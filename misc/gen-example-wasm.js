#!/usr/bin/env node
"use strict";
// Used to generate WASM code from S-expression ".wast" files for examples.
// Requires binaryen.js to exist in this directory -- get it from
//   https://github.com/WebAssembly/binaryen
let fs = require('fs');
let path = require('path');
let binaryen = require(__dirname + '/binaryen.js');

process.chdir(path.dirname(__dirname));

let dir = 'example/web/pkg';
fs.readdirSync(dir).forEach(fn => {
  let ext = path.extname(fn);
  if (ext === '.wast') {
    let srcpath = dir + '/' + fn;
    let dstpath = dir + '/' + path.basename(fn, ext) + '.wasm';
    console.log('compiling', srcpath, '=>', dstpath);
    let buf = binaryen.compileWast(fs.readFileSync(srcpath, {encoding:'utf8'}));
    fs.writeFileSync(dstpath, buf);
  }
})

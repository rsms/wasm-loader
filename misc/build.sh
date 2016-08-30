#!/bin/sh
set -e
cd "$(dirname "$0")/.."

if [ "$1" == '-h' ] || [ "$1" == '-help' ] || [ "$1" == '--help' ]; then
  echo "Usage: $0 [-watch|-g|-help]" >&2
  echo "  -g      Don't optimize" >&2
  echo "  -watch  Observe file system for changes and recompile (implies -g)" >&2
  echo "  -help   Show this message and exit" >&2
  exit 1
fi

opt_optimize=true
opt_watch=false

if [ "$1" = "-watch" ] || [ "$1" = "--watch" ]; then
  opt_watch=true
  opt_optimize=false
elif [ "$1" = "-g" ]; then
  opt_optimize=false
fi

export PATH="$PATH:$(pwd)/node_modules/.bin"

if ! (which tsc 2>/dev/null 1>&2); then
  echo "$0: TypeScript compiler 'tsc' not found in PATH. Try 'npm install -g TypeScript'" >&2
  exit 1
fi

if $opt_optimize; then
  echo "tsc: wasm-loader.ts -> lib/wasm-loader.d.ts"
  tsc --declaration --outDir lib wasm-loader.ts
fi

tscopt=
if $opt_watch; then
  tscopt=--watch
else
  echo 'tsc: wasm-loader.ts -> lib/wasm-loader.js'
fi

tsc \
  --sourceMap \
  --rootDir . \
  --sourceRoot . \
  --noEmitOnError \
  --noImplicitAny \
  --noImplicitReturns \
  --noFallthroughCasesInSwitch \
  --newLine LF \
  --target ES5 \
  --pretty \
  --outFile lib/wasm-loader.js \
  $tscopt \
  wasm-loader.ts \

if $opt_optimize; then
  pushd lib >/dev/null
  if [ ! -f ../node_modules/.bin/uglifyjs ]; then
    pushd .. >/dev/null
    npm install
    popd >/dev/null
  fi
  echo 'uglifyjs: lib/wasm-loader.js -> lib/wasm-loader.js'
  ../node_modules/.bin/uglifyjs \
    --output          wasm-loader.js \
    --source-map      wasm-loader.js.map \
    --source-map-url  wasm-loader.js.map \
    --in-source-map   wasm-loader.js.map \
    --compress \
    --mangle \
    -- \
    wasm-loader.js

  if [ ! -f wasm-loader.ts ]; then
    ln -s ../wasm-loader.ts wasm-loader.ts
  fi

  popd >/dev/null
fi

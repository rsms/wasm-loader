# wasm-loader

A minimal WebAssembly (WASM) module loader with automatic "import" resolution.

Example:

```js
let ml = new WasmLoader.Loader()
ml.load('foo/bar').then(m => {
  // 1. foo/bar.wasm is loaded,
  // 2. imports are scanned, and steps 1 through 3 are performed
  //    for each imported module in decent-first order.
  // 3. foo/bar is initialized with its dependencies, and finally
  // 4. the promise is resolved with the module API:
  let r = m.exports.add(10, 20)
  console.log('add(10, 20) =>', r)
})
```

foo/bar.wasm:
```lisp
(module
  (memory 256 256)
  (export "add" $add)
  (import $imp1 "hello_world" "add" (param i32 i32) (result i32))
  (func $add (param $x f64) (param $y f64) (result f64)
    (f64.add
      (f64.convert_s/i32 (call_import $imp1 (i32.const 1) (i32.const 2)))
      (f64.add (get_local $x) (get_local $y))
    )
  )
)
```

foo/hello_world.wasm: (imported by foo/bar.wasm)
```lisp
(module
  (memory 256 256)
  (type $0 (func (param i32 i32) (result i32)))
  (export "add" $add)
  (func $add (type $0) (param $x i32) (param $y i32) (result i32)
    (i32.add (get_local $x) (get_local $y))
  )
)
```


See [example/web](example/web) for a complete live example. Run `example/web/serve.sh -h` (requires [servedir](https://www.npmjs.com/package/secure-servedir) or [caddy](https://caddyserver.com/) to be installed.)

## Usage

The loader has no dependencies and is just the small JavaScript file [`wasm-loader.js`](lib/wasm-loader.js)

```html
<script type="text/javascript" src="wasm-loader.js"></script>
```

When loaded into a global context, like in a HTML document, the script adds a single global variable `WasmLoader`. When loaded by a CommonJS, AMD or UMD module loader, the interface is instead added to `exports` (no global variable is created.)

By default WASM module binaries are loaded by normalizing the path of the importer, i.e. if a module loaded from "foo/bar/cat" imports "../lol", then a request for "foo/lol.wasm" is made by the loader. You can override or wrap `Loader.fetch` and/or `Loader.normalizeRef` to alter this behavior.

## Synopsis

```ts
class Loader {
  options :LoaderOptions

  // Initialize with options
  constructor(options? :LoaderOptions)

  // Load a module by reference
  load(ref :string, parentRef? :string) :Promise<Module>

  // Load a module from a byte array.
  // Note: If there's already a registered module for normalizeRef(ref), this throws an
  // error to avoid a race condition of loading two different modules with the same ref.
  loadBuf(buf :ArrayBuffer, kind: ModuleKind, ref :string, parentRef? :string) :Promise<Module>

  // Define a module via Asynchronous Module Definition (AMD) including resolution of any
  // dependencies. See https://github.com/amdjs/amdjs-api/blob/master/AMD.md for more info.
  // If the parentRef is specified, ref will be considered relative to the parentRef.
  defineAMD(ref?          :string,
            dependencies? :string[],
            factory?      :(...args :any[])=>any | {[key :string] :any}, // (required)
            parentRef?    :string) :Promise<AMDModule>

  // Takes some ref and returns the canonical version of it.
  // ref starting with "./" or "../" will be considered relative to the parentRef, if specified.
  // Note: This is called for EVERY import request, even if the module is already loaded.
  // Override to alter behavior of how refs are interpreted.
  normalizeRef(ref :string, parentRef? :string) :string

  // Default function for fetching a module that makes a URL request with the ref, taking
  // options.baseURL into consideration. This implementation uses the Fetch API to retrieve
  // the source as an ArrayBuffer. Override to alter where and how module source is loaded.
  fetch(ref :string, parentRef? :string) :Promise<FetchResult>
}

// Options passed to Loader constructor
interface LoaderOptions {
  skipVerification? :boolean // Don't call Wasm.verifyModule on loaded modules
  baseURL?          :string  // URL prefix for canonical refs
}

// A resolved module
interface Module {
  exports :FFI
}

// Interface exported by a module
interface FFI {
  [name :string] :any
}

// Asynchronous Module Definition (AMD) module
interface AMDModule {
  exports  :any  // Not FFI since AMD allows `exports` to be anything
  id?      :string
}

enum ModuleKind {
  Wasm       = 0,
  JavaScript = 1,
}

interface FetchResult {
  buf  :ArrayBuffer
  kind :ModuleKind
}
```

## Developing and Contributing

The source is written in TypeScript. You can use the build script in [`misc/build.sh`](misc/build.sh):

```
$ misc/build.sh -h
Usage: misc/build.sh [-g|-watch|-help]
  -g      Don't optimize
  -watch  Observe file system for changes and recompile (implies -g)
  -help   Show this message and exit
```

To build an optimized version of wasm-loader, just run the script without any arguments:

```
$ misc/build.sh
tsc: wasm-loader.ts -> lib/wasm-loader.d.ts
tsc: wasm-loader.ts -> lib/wasm-loader.js
uglifyjs: lib/wasm-loader.js -> lib/wasm-loader.js
```

To have the TypeScript compiler perform incremental compilation (which is much faster than one-shot compilation), pass the `-watch` flag:

```
$ misc/build.sh -watch
6:41:30 PM - Compilation complete. Watching for file changes.
...
```

"watching" is the preferred method while working on the code, but remember to run the script without any arguments before checking in any build products (or you'll check in unoptimized/debug variants.)


## License

MIT (see [LICENSE.md](LICENSE.md))

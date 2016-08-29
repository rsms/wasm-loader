# wasm-loader

A minimal WASM module loader.

Example:

```js
let ml = new WasmLoader.Loader()
ml.load('foo/bar').then(m => {
  // 1. foo/bar.wasm is loaded,
  // 2. imports are scanned and any unloaded modules required
  //    are fetched and loaded
  // 3. foo/bar is initialized with its dependencies
  // 4. the promise is resolved with the module API:
  let r = m.exports.add(10, 20)
  console.log('add(10, 20) =>', r)
})
```

## Usage

The loader has no dependencies and is just the small JavaScript file [`wasm-loader.js`](lib/wasm-loader.js)

```html
<script type="text/javascript" src="wasm-loader.js"></script>
```

When loaded into a global context, like in a HTML document, the script adds a single global variable `WasmLoader`. When loaded by a CommonJS, AMD or UMD module loader, the interface is instead added to `exports` (no global variable is created.)

By default WASM module binaries are loaded by normalizing the path of the importer, i.e. if a module loaded from "foo/bar/cat" imports "../lol", then a request for "foo/lol.wasm" is made by the loader. You can override or wrap `Loader.fetch` and/or `Loader.normalizeRef` to alter this behavior.

## Synopsis

```ts

// Interface exported by a module
interface FFI {
  [name :string] :any
}

// A resolved module
interface Module {
  exports :FFI
}

class Loader {
  // Load a module by reference, calling `fetch` as needed.
  // If the parentRef is specified, ref will be considered relative to the parentRef.
  load(ref :string, parentRef? :string) :Promise<Module>

  // Load a module from a byte array.
  // Note: If there's already a registered module for normalizeRef(ref), this throws as
  // error because it would be ambiguous to replace a module that is currently loading
  // as it could cause dependants to receive a different module for the same ref.
  loadBuf(buf :ArrayBuffer, kind: ModuleKind, ref :string, parentRef? :string) :Promise<Module>

  // Define a module via Asynchronous Module Definition (AMD) including resolution of any
  // dependencies. See https://github.com/amdjs/amdjs-api/blob/master/AMD.md for more info.
  // If the parentRef is specified, ref will be considered relative to the parentRef.
  defineAMD(ref?          :string,
            dependencies? :string[],
            factory?      :(...args :any[])=>any | {[key :string] :any}, // (required)
            parentRef?    :string) :Promise<AMDModule>

  // Takes some ref and returns the canonical version of it.
  // This is called for EVERY REQUEST no matter if the module is already loaded,
  // so it needs to be efficient. Here so it can be overridden.
  normalizeRef(ref :string, parentRef? :string) :string

  // Fetches module source from a normalized ref. The default implementation uses `fetch`
  // to request the source relative to the current document/program origin.
  // Here so it can be overridden.
  fetch(ref :string, parentRef? :string) :Promise<FetchResult>
}

// Asynchronous Module Definition (AMD) module
interface AMDModule {
  exports  :any
  id?      :string
  loading? :ModulePromiseResolver[]; // non-null while the module is currently loading
}

enum ModuleKind {
  Wasm       = 0,
  JavaScript = 1,
}

// Result from a fetch operation
interface FetchResult {
  buf  :ArrayBuffer
  kind :ModuleKind
}
```

## License

MIT (see [LICENSE.md](LICENSE.md))

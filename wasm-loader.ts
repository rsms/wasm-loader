///<reference path="./lib/env.d.ts" />
///<reference path="./lib/wasm.d.ts" />

module WasmLoader {


// Interpret an array of integer values as UTF-8 characters, producing a string.
let Utf8ArrayToStr: (buf :ArrayBufferView) => string;
if (typeof TextDecoder !== 'undefined') {
  let utf8Decoder = new TextDecoder('utf-8');
  Utf8ArrayToStr = function (buf :ArrayBufferView) :string {
    return utf8Decoder.decode(buf);
  }
} else {
  Utf8ArrayToStr = function (buf :ArrayBufferView) :string {
    let out = "";
    let len = buf.byteLength;
    let i = 0;
    let c: number;
    let char2: number;
    let char3: number;

    while(i < len) {
      c = buf[i++];
      switch(c >> 4) {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: {
          // 0xxxxxxx
          out += String.fromCharCode(c);
          break;
        }
        case 12: case 13: {
          // 110x xxxx   10xx xxxx
          char2 = buf[i++];
          out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
          break;
        }
        case 14: {
          // 1110 xxxx  10xx xxxx  10xx xxxx
          char2 = buf[i++];
          char3 = buf[i++];
          out += String.fromCharCode(((c & 0x0F) << 12) |
                   ((char2 & 0x3F) << 6) |
                   ((char3 & 0x3F) << 0));
          break;
        }
      }
    }

    return out;
  }
}


function joinPath(...path :string[]) :string {
  if (path.length === 0) {
    return '.';
  }
  let joined: string;
  for (let i = 0; i < path.length; ++i) {
    let arg = path[i];
    if (arg.length > 0) {
      if (joined === undefined)
        joined = arg;
      else
        joined += '/' + arg;
    }
  }
  if (joined === undefined)
    return '.';
  return normalizePath(joined);
}


function normalizePath(path :string) :string {
  if (path.length === 0)
    return '.';

  const isAbsolute = path.charCodeAt(0) === 47/*/*/;
  const trailingSeparator = path.charCodeAt(path.length - 1) === 47/*/*/;

  // Normalize the path
  path = normalizeStringPosix(path, !isAbsolute);

  if (path.length === 0 && !isAbsolute)
    path = '.';
  if (path.length > 0 && trailingSeparator)
    path += '/';

  if (isAbsolute)
    return '/' + path;
  return path;
}


// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path :string, allowAboveRoot? :boolean) :string {
  let res = '';
  let lastSlash = -1;
  let dots = 0;
  let code: number;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47/*/*/)
      break;
    else
      code = 47/*/*/;
    if (code === 47/*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 ||
            res.charCodeAt(res.length - 1) !== 46/*.*/ ||
            res.charCodeAt(res.length - 2) !== 46/*.*/) {
          if (res.length > 2) {
            const start = res.length - 1;
            let j = start;
            for (; j >= 0; --j) {
              if (res.charCodeAt(j) === 47/*/*/)
                break;
            }
            if (j !== start) {
              if (j === -1)
                res = '';
              else
                res = res.slice(0, j);
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46/*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function dirname(path :string) :string {
  if (path.length === 0)
    return '.';
  var code = path.charCodeAt(0);
  var hasRoot = (code === 47/*/*/);
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47/*/*/) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }
  if (end === -1)
    return hasRoot ? '/' : '.';
  if (hasRoot && end === 1)
    return '//';
  return path.slice(0, end);
}


// WASM module scanner
class WASMScanner {
  static SectIDType   = Uint8Array.from([116,121,112,101])         // "type"
  static SectIDImport = Uint8Array.from([105,109,112,111,114,116]) // "import"

  v          :Uint8Array
  i          :number
  bodyLength :number = 0 // set by FindSect()

  // Find section with `id`
  static FindSect(buf :ArrayBuffer, id :Uint8Array) :WASMScanner {
    let s = new WASMScanner(buf, 8); // 8 = skip past magic number and version
    let z = 0
    let end = s.v.length

    while (s.i < end) {
      z = s.ReadU32v() // id_len
      if (z == id.length) {
        let x = 0;
        while (x != z && s.v[s.i++] == id[x++]) {
        }
        let found = x == z;
        z = s.ReadU32v() // body_len
        if (found) {
          // found section
          s.bodyLength = z;
          return s;
        }
      } else {
        s.i += z;
        z = s.ReadU32v() // body_len
      }
      s.i += z; // skip body
    }

    return null
  }

  constructor(buf :ArrayBuffer, i :number) {
    this.v = new Uint8Array(buf)
    this.i = i
  }

  SetOffs(i :number) {
    this.i = i
  }

  Skip(numberOfBytes :number) {
    let i = this.i + numberOfBytes;
    if (i > this.v.length) {
      throw new Error('not enough data');
    }
    this.i = i;
  }

  ReadBuf() :Uint8Array {
    return this.ReadBufOfLen(this.ReadU32v());
  }

  ReadUTF8Str() :string {
    return this.ReadUTF8StrOfLen(this.ReadU32v());
  }

  ReadBufOfLen(len :number) :Uint8Array {
    let end = this.i + len;
    if (end > this.v.length) {
      throw new Error('not enough data');
    }
    let b = this.v.subarray(this.i, end);
    this.i += len;
    return b;
  }

  ReadUTF8StrOfLen(len :number) :string {
    let b = this.ReadBufOfLen(len)
    let s = Utf8ArrayToStr(b);
    return s;
  }

  ReadU32v() :number {
    let pos = this.i;

    let end = pos + 5;
    if (end > this.v.length) {
      end = this.v.length;
    }

    let result = 0; // :uint32
    let shift = 0;  // :int32
    let b = 0;      // :byte
    while (this.i < end) {
      b = this.v[this.i++];
      result = result | ((b & 0x7F) << shift);
      if ((b & 0x80) == 0) {
        break;
      }
      shift += 7;
    }

    let length = this.i - pos;
    if (this.i == end && (b & 0x80)) {
      throw new Error("varint too large");
    } else if (length == 0) {
      throw new Error("varint of length 0");
    }

    return result;
  }
}

// Interface exported by a module
export interface FFI {
  [name :string] :any
}

// A resolved module
export interface Module {
  exports :FFI
}

export enum ModuleKind {
  Wasm       = 0,
  JavaScript = 1,
}

export interface FetchResult {
  buf  :ArrayBuffer
  kind :ModuleKind
}

// Asynchronous Module Definition (AMD) module
export interface AMDModule {
  exports  :any  // Not FFI since AMD allows `exports` to be anything
  id?      :string
}

// Options passed to Loader constructor
export interface LoaderOptions {
  skipVerification? :boolean // Don't call Wasm.verifyModule on loaded modules
  baseURL?          :string  // URL prefix for canonical refs
}


// internal types

interface _AMDModule extends AMDModule {
  loading? :ModulePromiseResolver[]; // non-null while the module is currently loading
}

// Resolver for a promise to load a module
interface ModulePromiseResolver {
  resolve: (m: Module) => void;
  reject:  (error: Error) => void;
}

// Module registry entry
interface ModuleEntry {
  loading? :ModulePromiseResolver[]; // non-null while the module is currently loading
  error?   :Error;                   // non-null if the module failed to load or initialize
  exports? :FFI;                     // non-null if the module is loaded & initialized
}


// Loads a module and all its dependencies, and finally intializes the module.
//
// If you have the knowledge of all or some of the packages that will be needed,
// consider calling Load* for each and every module as early as possible.
//
export class Loader {

  private _modules :Map<string, ModuleEntry>  // Maps normalizeRef(ref) to a module

  options :LoaderOptions   // Controls behavior of the loader

  constructor(options? :LoaderOptions) {
    this._modules = new Map<string, ModuleEntry>()
    if (typeof options === 'object') {
      this.options = options
      if (this.options.baseURL && this.options.baseURL.substr(-1) !== '/') {
        // baseURL must end with a slash
        this.options.baseURL += '/'
      }
    } else {
      this.options = {}
    }
  }


  // Import a module by reference.
  // If the parentRef is specified, ref will be considered relative to the parentRef.
  load(ref :string, parentRef? :string) :Promise<Module> {
    // TODO: discover cyclic imports (and fail)
    return new Promise((resolve, reject) => {
      ref = this.normalizeRef(ref, parentRef);
      let m = this._modules.get(ref);
      if (m) {
        if (m.loading) {
          // is waiting for a load to complete
          //console.log('LoadRef: waiting', {ref, parentRef})
          m.loading.push({resolve, reject});
        } else if (m.error) {
          // previously failed to load or initialize
          reject(m.error);
        } else {
          // already loaded
          // console.log('LoadRef: loaded', {ref, parentRef})
          resolve(m as Module);
        }
      } else {
        // ref not seen before
        // console.log('LoadRef: loading', {ref, parentRef})
        this._modules.set(ref, {loading:[{resolve, reject}]});
        this.fetch(ref, parentRef).then(res => this._load(res.buf, res.kind, ref))
      }
    });
  }


  // Load a module from a byte array.
  // Note: If there's already a registered module for normalizeRef(ref), this throws an
  // error because it would be ambiguous to replace a module that is currently loading
  // as it could cause dependants to receive a different module for the same ref.
  loadBuf(buf :ArrayBuffer, kind: ModuleKind, ref :string, parentRef? :string) :Promise<Module> {
    return new Promise((resolve, reject) => {
      ref = this.normalizeRef(ref, parentRef);

      if (this._modules.has(ref)) {
        throw new Error(`module "${ref}" already registered`);
      }

      this._modules.set(ref, {loading:[{resolve, reject}]});
      this._load(buf, kind, ref);
    });
  }


  // Define a module via Asynchronous Module Definition (AMD) including resolution of any
  // dependencies. See https://github.com/amdjs/amdjs-api/blob/master/AMD.md for more info.
  // If the parentRef is specified, ref will be considered relative to the parentRef.
  defineAMD(ref?          :string,
            dependencies? :string[],
            factory?      :(...args :any[])=>any | {[key :string] :any}, // (required)
            parentRef?    :string) :Promise<AMDModule>
  {
    // Don't you just love it when people define APIs with bidirectional variable arguments..?
    // OMG AMD why, WHY?!
    let _ref          :string
    let _dependencies :string[]
    let _factory      :(...args :any[])=>any | {[key :string] :any}
    let _parentRef    :string
    if (typeof arguments[0] === 'string') {
      _ref = arguments[0]
      if (arguments[1] instanceof Array) {
        // e.g. define('foo', ['bar'], function(bar){ ... })
        _dependencies = arguments[1]
        _factory = arguments[2]
        _parentRef = arguments[3] || null
      } else {
        // e.g. define('foo', function(require, exports, module){ ... })
        // e.g. define('foo', { ... })
        _dependencies = null
        _factory = arguments[1]
        _parentRef = arguments[2] || null
      }
    } else if (arguments[0] instanceof Array) {
      // e.g. define(['bar'], function(bar){ ... })
      _ref = null
      _dependencies = arguments[0]
      _factory = arguments[1]
      _parentRef = arguments[2] || null
    } else {
      // e.g. define(function(require, exports, module){ ... })
      _ref = null
      _dependencies = null
      _factory = arguments[0]
      _parentRef = arguments[1] || null
    }

    if (!_factory) {
      throw new Error('missing factory');
    }

    return new Promise((resolve, reject) => {

      let m :_AMDModule = {loading:[{resolve, reject}], exports:{}};

      if (_ref) {
        _ref = this.normalizeRef(_ref, _parentRef);
        if (this._modules.has(_ref)) {
          throw new Error(`module "${_ref}" already registered`);
        }
        m.id = _ref
        this._modules.set(_ref, m);
      }

      if (!_dependencies) {
        if (typeof _factory === 'object') {
          // factory is the module FFI
          m.loading = null
          m.exports = _factory
          return resolve(m)
        }
        // default dependencies, by AMD spec
        _dependencies = ["require", "exports", "module"];
      }

      if (typeof _factory !== 'function') {
        throw new Error('factory is not a function');
      }

      let pv :Promise<any>[] = _dependencies.map(depref => {
        if (depref === 'require') {
          return Promise.resolve<any>((subref :string) => {
            // require function that succeeds only if the requested
            // module is already loaded and initialized.
            let m = this._modules.get(this.normalizeRef(subref, _ref));
            if (!m || !m.exports || m.loading) {
              throw new Error('module not found');
            }
            return m.exports;
          });
        } else if (depref === 'exports') {
          return Promise.resolve<any>(m.exports);
        } else if (depref === 'module') {
          return Promise.resolve<any>(m);
        } else {
          // Note: no function names passed to resolveImport as AMD doesn't support it.
          return this.resolveImport(depref, [], _ref)
        }
      })

      // await all dependency resolutions
      Promise.all(pv).then(dependencies => {
        // call module factory function
        let returnedExports = _factory.apply(null, dependencies);
        if (returnedExports !== undefined) {
          // Note: AMD allows anything to represent a module, not just an object, as is the
          // case with WebAssembly modules
          m.exports = returnedExports;
        }
        m.loading.forEach(p => p.resolve(m))
        m.loading = null
      })
    });
  }


  // Internal module loader that expects `_modules.get(ref).loading` to be an
  // array of promise callbacks (the array can be empty.)
  // Also expects `ref == normalizeRef(ref)`.
  private _load(buf :ArrayBuffer, kind: ModuleKind, ref :string) {
    let m = this._modules.get(ref);

    let resolve = (m0 :Module) => {
      this._modules.set(ref, m0);
      m.loading.forEach(p => p.resolve(m0))
    }

    let reject = (err :Error) => {
      m.loading.forEach(p => p.reject(err))
      m.loading = null
      m.error = err
    }

    switch (kind) {
      case ModuleKind.Wasm: {
        this._loadWasm(buf, ref, m).then(resolve).catch(reject);
        break;
      }
      case ModuleKind.JavaScript: {
        throw new Error('ModuleKind.JavaScript not implemented');
      }
      default: {
        throw new Error('invalid module kind');
      }
    }
  }


  private _loadWasm(buf :ArrayBuffer, ref :string, m :ModuleEntry) :Promise<Module> {
    if (!this.options.skipVerification) {
      try {
        Wasm.verifyModule(buf);
      } catch (err) {
        throw new Error('Invalid Wasm module: ' + (err.message || String(err)))
      }
    }

    let imports = this.readWasmImports(buf);
    return this.resolveImports(imports, ref).then(imports => {
      let m0 = Wasm.instantiateModule(buf, imports)
      if (!m0.exports) {
        m0 = {exports:{}};
      }
      // console.log(`init wasm ${ref} =>`, m0)
      return m0
    })
  }


  resolveImports(imports :Map<string,string[]>, ref :string) :Promise<FFI> {
    return new Promise<FFI>((resolve, reject) => {

      let importObj :FFI = {};
      
      let resolvedCount = 1;
      let decrResolved = () => {
        if (--resolvedCount === 0) {
          resolve(importObj);
        }
      };
      
      imports.forEach((funcnames, modref) => {
        ++resolvedCount;
        
        this.resolveImport(modref, funcnames, ref).then(funcs => {
          importObj[modref] = funcs;
          decrResolved();
        }).catch(err => {
          resolvedCount = 0;
          reject(err);
        })
      })

      decrResolved();
    });
  }


  resolveImport(ref :string, funcnames :string[], parentRef :string) :Promise<Module> {
    return this.load(ref, parentRef).then(m => {
      // check that names exist
      funcnames.forEach(funcName => {
        if (!m.exports[funcName]) {
          throw new Error(
            `no function "${funcName}" in module "${ref}" imported by "${parentRef}"`
          )
        }
      });
      return m.exports;
    })
  }


  // Returns a Map, mapping module name to a list of functions required.
  readWasmImports(buf :ArrayBuffer) :Map<string,string[]> {
    let imports = new Map<string,string[]>()
    let importSect = WASMScanner.FindSect(buf, WASMScanner.SectIDImport)

    if (importSect) {
      let count = importSect.ReadU32v(); // count of import entries to follow
      let i = 0;
      for (; i < count; ++i) {
        /*let sig_index =*/ importSect.ReadU32v(); // signature index of the import
        let modname = importSect.ReadUTF8Str();
        let funcname = importSect.ReadUTF8Str();
        let imps = imports.get(modname);
        if (!imps) {
          imps = [];
          imports.set(modname, imps);
        }
        imps.push(funcname);
      }
    }

    // TODO: read "type" section and map sig_index from above to signatures.
    // since the signatures are to be compared with those exported, all we need
    // is the subarray of each import signature, that we later compare byte-by-byte
    // to the export signatures. No need to interpret the signatures.
    //
    //let typeSect = WASMScanner.FindSect(buf, WASMScanner.SectIDType);
    //...

    // TODO: Allow disabling signature checks for "production" situations.

    return imports;
  }


  // Explicitly define a module that is already initialized.
  // This can be used to expose a JavaScript module.
  // The ref is assumed to be normalized already (normalizeRef is NOT called.)
  // define(ref :string, exports :FFI) :Module {
  //   if (this._modules.has(ref)) {
  //     throw new Error(`module "${ref}" already registered`);
  //   }
  //   let m :Module = {exports}
  //   this._modules.set(ref, m);
  //   return m
  // }


  // Takes some ref and returns the canonical version of it.
  // This is called for EVERY REQUEST no matter if the module is already loaded,
  // so it needs to be efficient.
  normalizeRef(ref :string, parentRef? :string) :string {
    if (parentRef && ref[0] === '.' && (ref[1] === '/' || ref.substr(0,3) === '../')) {
      // ref is relative to parentRef
      ref = joinPath(dirname(parentRef), ref);
    }
    return ref;
  }


  // Default function for fetching a module that makes a URL request with the ref.
  // Can be overridden or wrapped by user to load module source in a different way.
  fetch(ref :string, parentRef? :string) :Promise<FetchResult> {
    // TODO: do some sort of write-up or example of setting up this function
    // to remap normalized refs to URLs with source versions, e.g.
    //   foo/bar => ///mod/foo/bar.123abc.wasm
    // In combination with disabling signature checks during import, this could
    // allow efficient loading of "production" module sets without worrying about
    // resource cache issues.
    // I.e. since no signature checks would be applied, a module loaded and imported
    // that is of a different version might cause a runtime crash at some future
    // point in the program and/or only in some situations.
    let url = ref;
    if (url.substr(-5) !== '.wasm') {
      url += '.wasm';
    }
    if (this.options.baseURL && url[0] !== '/' && url.indexOf('://') === -1) {
      url = this.options.baseURL + url
    }
    // console.log('fetch', url)
    return fetch(new Request(url)).then(res => {
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) {
          let errmsg = `unknown module "${ref}"`;
          if (parentRef) {
            errmsg += ` imported by ${parentRef}`;
          }
          throw new Error(errmsg)
        } else {
          throw new Error(url + ' ' + res.statusText)
        }
      }
      return res.arrayBuffer().then(buf => {
        return {buf, kind: ModuleKind.Wasm}
      }) // as Promise<FetchResult>
    })
  }
}

// Required by the AMD spec
(Loader.prototype.defineAMD as any)['amd'] = {};


} // end module WasmLoader

declare var exports: {[key :string] :any}
declare var module: {exports:{[key :string] :any}}
declare var global: {[key :string] :any}
declare var process: {}

if (typeof exports !== 'undefined') {
  if (typeof module === 'object') {
    module.exports = WasmLoader;
  } else {
    for (var k in WasmLoader) {
      exports[k] = (WasmLoader as any)[k];
    }
  }
} else {
  (typeof window !== 'undefined' ? window :
   typeof global !== 'undefined' && !global['process'] ? global :
   this as any
  )['WasmLoader'] = WasmLoader;
}

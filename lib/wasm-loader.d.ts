/// <reference path="env.d.ts" />
/// <reference path="wasm.d.ts" />
declare module WasmLoader {
    interface FFI {
        [name: string]: any;
    }
    interface Module {
        exports: FFI;
    }
    enum ModuleKind {
        Wasm = 0,
        JavaScript = 1,
    }
    interface FetchResult {
        buf: ArrayBuffer;
        kind: ModuleKind;
    }
    interface AMDModule {
        exports: any;
        id?: string;
    }
    interface LoaderOptions {
        skipVerification?: boolean;
        baseURL?: string;
    }
    class Loader {
        private _modules;
        options: LoaderOptions;
        constructor(options?: LoaderOptions);
        load(ref: string, parentRef?: string): Promise<Module>;
        loadBuf(buf: ArrayBuffer, kind: ModuleKind, ref: string, parentRef?: string): Promise<Module>;
        defineAMD(ref?: string, dependencies?: string[], factory?: (...args: any[]) => any | {
            [key: string]: any;
        }, parentRef?: string): Promise<AMDModule>;
        normalizeRef(ref: string, parentRef?: string): string;
        fetch(ref: string, parentRef?: string): Promise<FetchResult>;
        private _load(buf, kind, ref);
        private _loadWasm(buf, ref, m);
        private _resolveImports(imports, ref);
        private _resolveImport(ref, funcnames, parentRef);
        private _readWasmImports(buf);
    }
}
declare var exports: {
    [key: string]: any;
};
declare var module: {
    exports: {
        [key: string]: any;
    };
};
declare var global: {
    [key: string]: any;
};

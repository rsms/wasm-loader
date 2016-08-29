declare namespace Wasm {

interface FFI {
  [name :string] :any
}

interface Module {
  exports: FFI
}

function instantiateModule(buf :ArrayBuffer, imports? :FFI, mem? :ArrayBuffer) :Module
function verifyModule(buf :ArrayBuffer) :void

}

(module
  (import $imp0 "foo" "bar" (param f64) (result f64))
  (import $imp0 "pkg/root1" "add" (param f64 f64) (result f64))
  (import $imp1 "../pkg/hello_world" "add" (param i32 i32) (result i32))
)
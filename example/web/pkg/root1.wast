(module
  (memory 256 256)
  (export "add" $add)
  (import $imp0 "foo" "bar" (param f64) (result f64))
  (import $imp1 "pkg/hello_world" "add" (param i32 i32) (result i32))
  (func $add (param $x f64) (param $y f64) (result f64)
    (f64.add
      (f64.convert_s/i32 (call_import $imp1 (i32.const 1) (i32.const 2)))
      (f64.add
        (call_import $imp0 (f64.const 1))
        (f64.add
          (get_local $x)
          (get_local $y)
        )
      )
    )
  )
)
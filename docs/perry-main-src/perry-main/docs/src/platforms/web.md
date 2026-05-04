# Web

`--target web` and `--target wasm` are aliases for the same backend. Both produce a self-contained HTML file with embedded WebAssembly and a JavaScript bridge for DOM widgets.

```bash
perry app.ts -o app --target web    # same output as --target wasm
open app.html
```

See **[WebAssembly / Web](wasm.md)** for the full documentation: how it works, supported features, UI mapping, FFI, threading, limitations, and examples.

## Why one target instead of two?

Perry used to have two browser backends:

- `--target web` (`perry-codegen-js`) — transpiled HIR to JavaScript
- `--target wasm` (`perry-codegen-wasm`) — compiled HIR to WebAssembly

These were consolidated into the WASM target so browser apps get near-native performance, FFI imports, and Web Worker threading without needing a separate JS-emit pipeline. The DOM widget runtime that the old `--target web` provided is now embedded in `wasm_runtime.js`. Both flags route through `perry-codegen-wasm` and produce identical HTML output.

## Next Steps

- [WebAssembly / Web](wasm.md) — full target documentation
- [Platform Overview](overview.md) — all platforms

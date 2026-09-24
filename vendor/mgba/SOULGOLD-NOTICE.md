# Vendored mGBA engine

2026-09-23 SDK extension: 1×/2×/4× fast-forward scheduling, accelerated-audio discard and worklet queue flush; normal volume restored at 1×. Core WASM and savestate layout remain unchanged.

- Package: `@wasm-gaming/mgba-wasm` 0.1.1, MPL-2.0
- Upstream: https://github.com/wasm-gaming/mGBA-wasm
- Emulator core: https://github.com/mgba-emu/mgba
- Original package SHA-512: `PviwdUQGasp6QlXa0cl0ccUj0z5zGMITkwmAsZy9yOVpJpO4IYRmMQUBlwLvnpDMh9EhqbED+bgXyPheb3zL1Q==`
- Bundled license: LICENSE; upstream TypeScript source: source/; browser JavaScript remains human-readable.

Local changes (2026-09-22) in mgba.sdk.js: expose battery snapshot/import methods using existing WASM shim exports; separate touch-button mask; release-buttons helper; ignore game keydown in form inputs. Core WASM unchanged. Modified JavaScript remains under MPL-2.0. No commercial game ROM or BIOS is included.

Journey live reader relies on the mGBA v11 GBA state layout documented in https://github.com/mgba-emu/mgba/blob/master/include/mgba/internal/gba/serialize.h and requires matching user-supplied symbols. Other formats are rejected.

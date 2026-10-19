# MoHex 2.0 / Benzene

HEX XII uses the existing C++ MoHex 2.0 engine compiled to WebAssembly. Move generation, virtual connections, inferior-cell analysis, learned pattern weights, RAVE and the swap table come from Benzene/MoHex. `hex/ai.js` adapts the website's board and search requests to that engine.

## Source and authors

- Upstream: [linusneumann/mohex2](https://github.com/linusneumann/mohex2/tree/8fd7e13aa501c05e1a328f019b95ef15ae1e785c), commit `8fd7e13aa501c05e1a328f019b95ef15ae1e785c`.
- Browser port and exact corresponding source archive: [Leaf Arcade](https://leafarcade.com/engines/mohex/SOURCE.txt). The original archive is provided locally as [source.zip](source.zip). [UPSTREAM-SOURCE.txt](UPSTREAM-SOURCE.txt) records the original distribution and its hashes.
- Benzene contributors include Broderick Arneson, Philip Henderson, Ryan Hayward, Jakub Pawlewicz, Aja Huang, Kenny Young and Chao Gao. Fuego/SmartGame and Boost contributors retain their notices in the supplied source.
- Algorithm paper: [Huang et al., MoHex 2.0: a pattern-based MCTS Hex player](https://webdocs.cs.ualberta.ca/~hayward/papers/m2.pdf).

The engine and browser adapter are LGPLv3 or later; see [LICENSE](LICENSE) and [GPLv3.txt](GPLv3.txt). Boost headers use the [Boost Software License](BOOST-LICENSE.txt). Emscripten, compiler-rt, musl, libc++ and libc++abi notices are supplied alongside the binary. The website's own files retain their existing license.

## This build

Emscripten 6.0.11, one thread, no server, shared memory, database or opening-book dependency. The original browser port's synchronous thread and database shims are preserved. `browser-adapter.cpp` supplies the board, color, budget, seed and swap request, returns the move and actual search statistics, and preserves native configuration lifetimes across calls.

`browser-runtime.patch` records five small changes relative to the source archive: use the requested subsecond budget, bound the knowledge cache to 4,096 entries, yield from the original search loop for cancellation/progress, keep the empty-tree fallback inside MoHex's already computed candidate set, and return the existing INVALID_POINT sentinel when inferior-cell analysis is disabled (fixing an upstream missing-return defect). The last change prevents extremely short searches from ignoring their own must-play region. Search trees are capped at 60,000 nodes; the WebAssembly heap is capped at 512 MiB.

`mohex.js` contains the WebAssembly binary. `patterns.js` packages the original text files without changing weights. These two runtime resources total about 8.1 MiB, load on the first AI turn, and also work with `file://`. The separate source archive and raw pattern files are for inspection and relinking, and are not downloaded during play.

## Rebuild / replace the engine

1. Extract `source.zip` to a directory containing `mohex/`, `boost-headers/` and the component sources. The supplied `boost-extra/` contains missing Boost 1.92 headers from [boostorg/type_traits](https://github.com/boostorg/type_traits/tree/boost-1.92.0) and [boostorg/config](https://github.com/boostorg/config/tree/boost-1.92.0), with their original notices.
2. Activate an official [Emscripten 6.0.11 SDK](https://github.com/emscripten-core/emsdk). Use its `em++.py` driver, Python 3 and Node.js. No compiler is needed to play the game.
3. From PowerShell run:

```powershell
./hex/vendor/mohex/build.ps1 -Emcc /absolute/path/to/em++.py -SourceRoot /absolute/path/to/extracted/source
node hex/vendor/mohex/bundle-patterns.cjs
node hex/verify.cjs
node hex/verify-opening.cjs
node hex/verify-defense.cjs
```

The script copies the supplied adapter, applies the runtime changes, compiles cached objects and produces `mohex.js`. Remove the extracted source's `.browser-objects/` cache when changing engine or dependency headers. Any compatible replacement can be relinked with the supplied source and then used in place of `mohex.js`; the web adapter calls `hex_search` and `hex_cancel`. No signature checks or deployment restrictions prevent replacing this component.

The original browser port's `BUILD.txt` and `upstream-changes.patch` document its starting point. This README, `browser-adapter.cpp`, `browser-runtime.patch`, both build scripts and the extra headers describe this site's additional changes and build inputs.

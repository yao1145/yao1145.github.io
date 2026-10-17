# Sixteen difficulty certificate

The implemented rules allow 34 unit-cost actions: 16 cyclic one-cell row/column shifts and 18 quarter-turns of a contiguous 2×2 block. Half-turns cost two moves. The target fixes both position and numeric labels.

The game includes 12 fixed challenges, one at each depth from 6 to 17 moves. Retained boards keep their original completion identifiers. The maximum shortest distance is 17 under Rokicki's exhaustive slide-only result and the completeness of the supplied 32-antipode list. The upper and lower bounds are given below.

## An exact 17-move instance

```
12 11  9 10
15 16 13 14
 3  4  1  2
 7  8  5  6
```

For each tile, measure its shortest distance to its target on the 4×4 torus:

`min(abs(row-targetRow), 4-abs(row-targetRow)) + min(abs(col-targetCol), 4-abs(col-targetCol))`.

The sum for this instance is 62. Every legal move moves exactly four tiles by one toroidal edge, including 2×2 rotations, so a move reduces this sum by at most four. Every solution therefore needs at least `ceil(62/4) = 16` moves.

Each legal move is a 4-cycle and hence an odd permutation. The displayed instance has odd parity, so every solution has odd length. This raises the lower bound to **17**.

A solution of length 17 is stored as action IDs in `engine.js`:

```
2, 2, 4, 4, 6, 6, 8, 8, 14, 14, 18, 13, 24, 4, 10, 24, 13
```

In words: row 2 left twice; row 3 left twice; row 4 left twice; column 1 up twice; column 4 up twice; clockwise block at row 1 column 2; column 3 down; clockwise block at row 2 column 2; row 3 left; column 2 up; clockwise block at row 2 column 2; column 3 down. Rows and columns are numbered from one; block coordinates identify the upper-left tile.

The matching lower and upper bounds prove this instance's exact optimum. The witness was found by IDA* search with the displacement bound (12,832 visited nodes); verification of optimality itself requires only the bound and witness, without trusting the search implementation.

## Generating certified challenges

Depth 6 retains the original bidirectional BFS generator. For depths 7–15, the generator first tries randomized paths that increase the distance sum by exactly four per move. Reversing such a path reaches the matching geometric lower bound. If this construction reaches a dead end, it uses a suffix of the certified 17-step witness. Depths 16–17 use witness suffixes. Each result is checked against its lower bound and a concrete solution before play.

The eight symmetries of the square conjugate legal moves to legal moves and relabel tiles so the target stays fixed. Inverting the whole permutation also preserves shortest distance because the generating moves are reversible. These variants keep the exact difficulty. Fixed and daily challenges use the selected 6–17 difficulty; daily challenges are deterministic for the Shanghai date. Their deepest levels use a finite family of certified variants.

## Random challenges and browser optimal search

Random challenges use Fisher–Yates to sample all 16 labeled tiles uniformly, drawing unbiased bounded integers from `crypto.getRandomValues` with rejection sampling. The initial board is shown immediately and is never filtered, replaced or restricted to the selected difficulty. Even the solved permutation remains a valid sample. Restart retains the same sampled board.

`optimal.js` solves that exact board in the browser with IDA*. It constructs eight weighted four-tile pattern databases: four disjoint row groups and four disjoint column groups. Each abstract edge costs the number of tracked tiles moved. Summing the four tables in either partition costs exactly four per real move, so the ceiling of either summed abstract distance divided by four is an admissible lower bound. The heuristic also uses toroidal displacement and permutation parity.

Search exhausts each admissible depth before proceeding to the next depth of the same parity. It removes immediate inverses, three consecutive identical quarter-turns, and out-of-order adjacent commuting moves. The bounded transposition cache compares complete board keys plus the preceding move/repetition context; hash collisions replace entries and never establish equality. The first solution is therefore optimal. Search has no 17-step ceiling or automatic approximation cutoff.

A Web Worker keeps search off the UI thread; an asynchronous yielding implementation supports browsers without Workers. Progress reports the current proven lower bound and visited nodes. Cancel or a new challenge stops the active task, and stale replies cannot overwrite the next board. Movement stays locked and the budget stays unknown until an exact solution is found. Some random boards can require a long search; the player can cancel at any time.

Run `node sixteen/verify-optimal.cjs` for independent BFS comparisons, all fixed-level optima, a shuffled board with optimum 14, uniform-sampling edge cases, cancellation and solved-board handling. An independent IDA* implementation also exhausted all 12-step possibilities for `HLIMAJOBDCNFGPEK` (222,204 nodes), establishing the 14-step optimum with its parity and the concrete 14-step solution.

## Upper bound: every board is solvable within 17 moves

The supplied list of 32 Loopover antipodes is stored in `loopover-32.json`. Running `node sixteen/verify-loopover-32.cjs` independently finds a mixed-rule solution of at most 16 moves for every one of them and writes `loopover-32-results.md` plus complete replay certificates in `loopover-32-results.json`. Use `--replay` to check those certificates with the independent numeric move oracle. The supplied 8/16/8 slide-only symmetry classes are also checked; only eight of the 128 examined torus symmetries preserve the non-wrapping rotation moves, so all 32 instances are searched separately.

[Rokicki's original results post, 12 June 2021](https://www.speedsolving.com/threads/loopover-gods-number-upper-bounds-4%C3%974-asymptotics-etc.75180/) reports a 4×4 single-tile-metric diameter of 18 and 32 antipodes. If the supplied list is the complete set of those antipodes, the 32 replay certificates supply the missing upper-bound argument: all other states already have slide-only solutions of at most 17 moves, and these 32 states have mixed solutions of at most 16. Combined with the exact 17-move instance above, this implies a mixed-rule diameter of 17, conditional on the supplied list's completeness.

The proof combines two cases. Every board outside the 32-antipode list already has a slide-only solution of length at most 17; that solution remains legal in the mixed game. Every board in the list has a mixed-rule solution of length at most 16, checked here by independent replay. These cases cover all boards under the stated completeness assumption, establishing the global upper bound of 17.

The exact 17-move instance above supplies the matching lower bound. Therefore the mixed-rule diameter is **17** under these premises. This argument uses the original exhaustive result rather than repeating its full-state computation. A move means a one-cell cyclic row/column shift or a 90-degree rotation of a non-wrapping 2×2 block, each at unit cost.

Run `node sixteen/verify.cjs` from the repository root. It checks all fixed levels, verifies 264 seeded deep-level certificates against an independently implemented distance/parity bound and array-move oracle, and tests deterministic generation and strict move budgets.

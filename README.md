# yao1145.github.io

Personal homepage and browser games, published with GitHub Pages.

- **Sixteen:** `/sixteen/` — restore a 4×4 board numbered 1–16 using cyclic row/column shifts and 90° rotations of any 2×2 block. Mixed mode enables both operations together; separate slide and rotation interfaces are also available. Every operation costs one step. The 12 challenges progress from 6 to 17 moves, with an explicit difficulty selector, daily boards, uniformly random boards solved optimally in the browser, undo, restart, keyboard/touch controls and preserved completion records. Depth 6 uses bidirectional BFS; deeper challenges use matching displacement/parity lower bounds and concrete solution witnesses. The global maximum shortest distance is 17 under Rokicki's slide-only exhaustive result and the completeness of the supplied 32-antipode list: all 32 have independently replayed 16-move mixed solutions, and a 17-move instance supplies the lower bound. The generator and exact IDA* solver run in a Web Worker with an asynchronous fallback. Random boards are sampled before solving, with progress and cancellation; their optimum is independent of the difficulty selector. Daily boards use Asia/Shanghai time and the selected difficulty. Open `sixteen/index.html` directly for offline play, or `/sixteen/?level=12` for the hardest fixed level. A bottom-right switch chooses clockwise or counterclockwise as the default rotation direction; it is saved in `sixteen.rotation.v1` and also follows the Q / E and rotation-direction buttons. Run `node sixteen/verify.cjs` to verify the certificates, and `node sixteen/verify-optimal.cjs` to cross-check the exact solver. See [the proof and scope](sixteen/DIFFICULTY.md).

- **Homepage:** https://yao1145.github.io/
- **PKUfighter:** https://yao1145.github.io/pkufighter/ — canvas shooter. See [game documentation](pkufighter/README.md).
- **十步万度:** https://yao1145.github.io/clocks/ — 5×5 pointer-chain puzzle with 1–12 step challenges and star collection. A first-time perfect score in each step tier lights one of twelve stars; collecting all twelve unlocks the crown easter egg.
- **Cube:** https://yao1145.github.io/cube/ — 4×4 rolling cube puzzle with 12 challenges (6–17 moves), daily and random boards. Every move swaps the landing square with the cube's bottom face. All six faces must turn blue within the exact shortest-path budget; exhausting that budget without finishing loses the game. Each level's first clear lights a star; all twelve unlock the star-cube easter egg.

## Run locally

Serve the repository root over HTTP (PKUfighter uses ES modules):

```sh
python -m http.server 8000
```

Open http://localhost:8000/ and choose a game. The game URLs are `/pkufighter/`, `/clocks/`, `/cube/`, and `/sixteen/`. Cube and Sixteen also run directly from their `index.html` files without a server.

## Structure

```text
index.html          # homepage and game links
home.js             # homepage language and theme controls
firework/           # pure JavaScript Yaozi particle intro and replay preview
pkufighter/         # original game, scripts, styles, icons and school badges
clocks/index.html   # self-contained 十步万度 game
cube/index.html     # self-contained Cube game and exact shortest-path solver
```

GitHub Pages publishes the root directory of the `main` branch. Each game directory has an `index.html`.

PKUfighter's localStorage keys are preserved, so existing scores and crowns remain available on the same origin.

The homepage supports Chinese and English, plus light and dark themes. Header controls save preferences in `yaozi.home.language` and `yaozi.home.theme`. The first visit uses the browser language and system theme; system theme changes apply until a theme is chosen manually. Language switching translates homepage copy, metadata, accessible labels, and the intro's skip control. Game pages retain their own settings. Controls remain usable when browser storage is unavailable.

The homepage opens with an eight-second `Yaozi` particle animation: scattered sparks gradually emerge from a black background, drift into glowing letters and shimmer. The completed word explodes into sparks that fall under gravity and fade into the homepage. Canvas 2D handles the animation in vanilla JavaScript, with no external libraries, fonts, images, or Python runtime. Open `firework/index.html` for a replayable preview; it also works directly from disk. Skip with the button or Escape. Reduced motion shows the name briefly without moving particles. Hidden tabs pause the animation, and completion releases the canvas and event listeners. Returning from a game page, or arriving through browser back / forward, skips the intro; opening the homepage directly still plays it.

Cube uses `cube.minimum.4x4.v2` for completion records. Undo restores the previous state and move budget. The shortest-path solver runs in a Web Worker, with an asynchronous main-thread fallback. It performs reverse breadth-first search from every solved position, tracking the board, position and six directional face colours. The reverse operation undoes the colour exchange before rolling back. The daily seed uses the date in Asia/Shanghai.

Players can independently enable the unfolded six-face view and dice pips 1–6; both are off by default on page load. Numbers remain attached to their physical faces as the cube rolls, with opposite faces summing to seven. The board view and unfolded six-face view share the same orientation, and undo restores both colours and dice orientation. Display toggles preserve the current game state.

Swipe up, right, down or left on the board to roll one cell. Small movements, ambiguous diagonal drags, cancelled gestures and multitouch do not trigger a roll. The page scrolls normally outside the board, and pinch zoom remains available. Each legal swipe counts once, with the same move budget and loss lockout as buttons and keyboard controls.

Rolling uses reusable SVG surfaces with continuous geometry around the contact edge. Animation defaults to 360 ms per move; players can choose faster 180 ms rolling or switch it off. This explicit game setting also applies on devices with reduced motion enabled. Consecutive inputs wait for each roll to finish. Undo, restart or changing challenges clears buffered inputs.

Exhaustive 4×4 search: all 80,080 initial states with six blue board squares, six white cube faces and a white starting square are solvable. Their shortest solutions range from 6 to 17 moves. Allowing a blue starting square yields 128,128 initial states and the same maximum of 17. Across all 1,193,808 states with six blue elements distributed between the board and cube, the maximum shortest distance to completion is 18 moves. Starting squares do not trigger an initial colour exchange.

Focused checks (test files are locally ignored): `node tests/cube-engine.cjs` and `node tests/cube-browser.cjs`. Engine checks compare rolling with an independent geometric oracle and every level's optimum with a separate forward BFS; browser checks cover the strict budget, controls, persistence, responsive layout and offline play.

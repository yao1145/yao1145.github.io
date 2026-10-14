# yao1145.github.io

Personal homepage and browser games, published with GitHub Pages.

- **Homepage:** https://yao1145.github.io/
- **PKUfighter:** https://yao1145.github.io/pkufighter/ — canvas shooter. See [game documentation](pkufighter/README.md).
- **十步万度:** https://yao1145.github.io/clocks/ — 5×5 pointer-chain puzzle with 1–12 step challenges and star collection.
- **Cube:** https://yao1145.github.io/cube/ — 4×4 rolling cube puzzle with 12 challenges (6–17 moves), daily and random boards. Every move swaps the landing square with the cube's bottom face. All six faces must turn blue within the exact shortest-path budget; exhausting that budget without finishing loses the game.

## Run locally

Serve the repository root over HTTP (PKUfighter uses ES modules):

```sh
python -m http.server 8000
```

Open http://localhost:8000/ and choose a game. The game URLs are `/pkufighter/`, `/clocks/`, and `/cube/`. Cube also runs directly from `cube/index.html` without a server.

## Structure

```text
index.html          # homepage and game links
pkufighter/         # original game, scripts, styles, icons and school badges
clocks/index.html   # self-contained 十步万度 game
cube/index.html     # self-contained Cube game and exact shortest-path solver
```

GitHub Pages publishes the root directory of the `main` branch. Each game directory has an `index.html`.

PKUfighter's localStorage keys are preserved, so existing scores and crowns remain available on the same origin.

Cube uses `cube.minimum.4x4.v2` for completion records. Undo restores the previous state and move budget. The shortest-path solver runs in a Web Worker, with an asynchronous main-thread fallback. It performs reverse breadth-first search from every solved position, tracking the board, position and six directional face colours. The reverse operation undoes the colour exchange before rolling back. The daily seed uses the date in Asia/Shanghai.

Players can independently enable the unfolded six-face view and dice pips 1–6; both are off by default on page load. Numbers remain attached to their physical faces as the cube rolls, with opposite faces summing to seven. The board view and unfolded six-face view share the same orientation, and undo restores both colours and dice orientation. Display toggles preserve the current game state.

Swipe up, right, down or left on the board to roll one cell. Small movements, ambiguous diagonal drags, cancelled gestures and multitouch do not trigger a roll. The page scrolls normally outside the board, and pinch zoom remains available. Each legal swipe counts once, with the same move budget and loss lockout as buttons and keyboard controls.

Rolling uses reusable SVG surfaces with continuous geometry around the contact edge. Animation defaults to 360 ms per move; players can choose slower 600 ms rolling or switch it off. This explicit game setting also applies on devices with reduced motion enabled. Consecutive inputs wait for each roll to finish. Undo, restart or changing challenges clears buffered inputs.

Exhaustive 4×4 search: all 80,080 initial states with six blue board squares, six white cube faces and a white starting square are solvable. Their shortest solutions range from 6 to 17 moves. Allowing a blue starting square yields 128,128 initial states and the same maximum of 17. Across all 1,193,808 states with six blue elements distributed between the board and cube, the maximum shortest distance to completion is 18 moves. Starting squares do not trigger an initial colour exchange.

Focused checks (test files are locally ignored): `node tests/cube-engine.cjs` and `node tests/cube-browser.cjs`. Engine checks compare rolling with an independent geometric oracle and every level's optimum with a separate forward BFS; browser checks cover the strict budget, controls, persistence, responsive layout and offline play.

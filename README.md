# yao1145.github.io

Personal homepage and browser games, published with GitHub Pages.

- **Homepage:** https://yao1145.github.io/
- **PKUfighter:** https://yao1145.github.io/pkufighter/ — canvas shooter. See [game documentation](pkufighter/README.md).
- **十步万度:** https://yao1145.github.io/clocks/ — 5×5 pointer-chain puzzle with 1–12 step challenges and star collection.

## Run locally

Serve the repository root over HTTP (PKUfighter uses ES modules):

```sh
python -m http.server 8000
```

Open http://localhost:8000/ and choose a game. The game URLs are `/pkufighter/` and `/clocks/`.

## Structure

```text
index.html          # homepage and game links
pkufighter/         # original game, scripts, styles, icons and school badges
clocks/index.html   # self-contained 十步万度 game
```

GitHub Pages publishes the root directory of the `main` branch. Each game directory has an `index.html`, so both paths also work without a trailing slash.

PKUfighter's localStorage keys are preserved, so existing scores and crowns remain available on the same origin.

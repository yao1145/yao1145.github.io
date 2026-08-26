# starfighter

A single-page HTML5 canvas space shooter. Fight off waves of enemies, dodge their bullet patterns, and defeat the element bosses (fire / ice / poison). UI is in Chinese (zh-CN).

**Play: https://yao1145.github.io/**

## Run locally

The project uses ES modules, so it must be served over HTTP — opening `index.html` directly won't work:

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

## Structure

```
index.html       — thin shell: DOM markup + CSS <link> tags + module entry script
css/             — styles split by concern (reset, layout, panels, hud, boss, mobile, responsive)
js/              — ES modules; shared Game object + feature modules
  game.js        — Game state & core lifecycle
  config.js      — tuning constants (rates, pool sizes, boss stats)
  main.js        — entry point; wires Game.init() on load
```

## Controls

- **Keyboard**: Arrows / WASD to move, Space to pause.
- **Touch / mouse**: drag to move.

## License

MIT — see [LICENSE](LICENSE).

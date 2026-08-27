import { Game } from './game.js';

// Feature modules — each attaches its methods to the shared Game object (side-effects).
import './pools.js';
import './grid.js';
import './player.js';
import './bullets.js';
import './enemyBullets.js';
import './enemies.js';
import './items.js';
import './boss.js';
import './collisions.js';
import './render.js';
import './input.js';
import './achievements.js';

window.addEventListener('load', () => {
    Game.init();
});

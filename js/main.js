import { Game } from './core/game.js';

// Feature modules — each attaches its methods to the shared Game object (side-effects).
import './core/pools.js';
import './core/grid.js';
import './entities/player.js';
import './entities/bullets.js';
import './entities/enemyBullets.js';
import './entities/enemies.js';
import './entities/items.js';
import './entities/boss.js';
import './systems/collisions.js';
import './systems/render.js';
import './systems/sprites.js';
import './systems/badges.js';
import './systems/input.js';
import './systems/achievements.js';

window.addEventListener('load', () => {
    Game.init();
});

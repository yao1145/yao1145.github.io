import { Game } from '../../js/core/game.js';
import '../../js/core/pools.js';

export function resetGameFixture() {
    Game.clearAllPools();
    Game.score = 0;
    Game.level = 1;
    Game.lives = 3;
    Game.gameTime = 0;
    Game.isBossStage = false;
    Game.boss = null;
    Game.activeCard = null;
    Game.cardPickCount = {};
    Game.greenStacks = { g_rate: 0, g_bullets: 0, g_vitality: 0 };
    return Game;
}

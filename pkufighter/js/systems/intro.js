import { Game } from '../core/game.js';

// Game-introduction overlay, opened from the main menu like the achievements
// panel. Pure menu UI — no effect on the running simulation.
Game.openIntro = function() {
    document.getElementById('introPanel').style.display = 'block';
    document.getElementById('gameStartPanel').style.display = 'none';
};

Game.closeIntro = function() {
    document.getElementById('introPanel').style.display = 'none';
    document.getElementById('gameStartPanel').style.display = 'block';

    // Reset the start panel to its default idle look (in case it was in pause state).
    document.querySelector('.uiTitle').textContent = 'PKUfighter';
    document.getElementById('startButton').textContent = '开始游戏';
};

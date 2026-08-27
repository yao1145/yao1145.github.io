import { Game } from './game.js';

Game.setupEventListeners = function() {
    window.addEventListener('keydown', (e) => {
        this.keys[e.key.toLowerCase()] = true;
        if (e.key === ' ' && this.isRunning) {
            this.togglePause();
        }
    });

    window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
    });

    const controlArea = document.querySelector('.controlArea');

    const handleMove = (x, y) => {
        const dx = x - this.touch.startX;
        const dy = y - this.touch.startY;

        this.player.x += dx;
        this.player.y += dy;

        this.touch.startX = x;
        this.touch.startY = y;

        this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
        this.player.y = Math.max(0, Math.min(this.height - this.player.height, this.player.y));
    };

    controlArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!this.isRunning || this.isGameOver) return;

        const touch = e.touches[0];
        this.touch.isTouching = true;
        this.touch.startX = touch.clientX;
        this.touch.startY = touch.clientY;
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;
    });

    controlArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!this.touch.isTouching || !this.isRunning || this.isGameOver) return;

        const touch = e.touches[0];
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;

        handleMove(this.touch.currentX, this.touch.currentY);
    });

    controlArea.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.touch.isTouching = false;
    });

    controlArea.addEventListener('mousedown', (e) => {
        if (!this.isRunning || this.isGameOver) return;

        this.touch.isTouching = true;
        this.touch.startX = e.clientX;
        this.touch.startY = e.clientY;
        this.touch.currentX = e.clientX;
        this.touch.currentY = e.clientY;
    });

    controlArea.addEventListener('mousemove', (e) => {
        if (!this.touch.isTouching || !this.isRunning || this.isGameOver) return;

        this.touch.currentX = e.clientX;
        this.touch.currentY = e.clientY;

        handleMove(this.touch.currentX, this.touch.currentY);
    });

    controlArea.addEventListener('mouseup', () => {
        this.touch.isTouching = false;
    });

    controlArea.addEventListener('mouseleave', () => {
        this.touch.isTouching = false;
    });

    window.addEventListener('resize', () => {
        this.resizeCanvas();
    });

    document.getElementById('startButton').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startGame();
    });

    document.getElementById('restartButton').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.returnToMainMenu();
    });

    this.enableControlArea(false);
};

Game.enableControlArea = function(enable) {
    const controlArea = document.querySelector('.controlArea');
    if (controlArea) {
        controlArea.style.pointerEvents = enable ? 'auto' : 'none';
    }
};

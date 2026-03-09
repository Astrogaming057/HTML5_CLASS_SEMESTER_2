const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('score-label');
const highScoreLabel = document.getElementById('high-score');
const overlay = document.getElementById('overlay');

// Configuration
canvas.width = 800;
canvas.height = 400;

let score = 0;
let highScore = 0;
let gameRunning = true;
let gameSpeed = 5;

const player = {
    x: 50,
    y: 300,
    width: 30,
    height: 30,
    color: '#00f2ff',
    dy: 0,
    jumpForce: 12,
    gravity: 0.6,
    grounded: false
};

const obstacles = [];

function spawnObstacle() {
    const height = Math.random() * 50 + 20;
    obstacles.push({
        x: canvas.width,
        y: canvas.height - height,
        width: 20,
        height: height,
        color: '#ff0055'
    });
}

function update() {
    if (!gameRunning) return;

    // Physics
    player.dy += player.gravity;
    player.y += player.dy;

    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.grounded = true;
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;

        // Collision Check
        if (
            player.x < obstacles[i].x + obstacles[i].width &&
            player.x + player.width > obstacles[i].x &&
            player.y < obstacles[i].y + obstacles[i].height &&
            player.y + player.height > obstacles[i].y
        ) {
            gameOver();
        }

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            score++;
            scoreLabel.innerText = `Score: ${score}`;
            if (score % 5 === 0) gameSpeed += 0.2; // Increase difficulty
        }
    }

    if (Math.random() < 0.015) spawnObstacle();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Player
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Obstacles
    ctx.shadowColor = '#ff0055';
    ctx.fillStyle = '#ff0055';
    for (let obs of obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
    ctx.shadowBlur = 0;
}

function gameOver() {
    gameRunning = false;
    overlay.classList.remove('hidden');
    if (score > highScore) {
        highScore = score;
        highScoreLabel.innerText = `Best: ${highScore}`;
    }
}

function reset() {
    score = 0;
    gameSpeed = 5;
    obstacles.length = 0;
    player.y = 300;
    scoreLabel.innerText = `Score: 0`;
    overlay.classList.add('hidden');
    gameRunning = true;
    requestAnimationFrame(loop);
}

function loop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(loop);
}

// Controls
window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'ArrowUp') && player.grounded) {
        player.dy = -player.jumpForce;
        player.grounded = false;
    }
    if (e.code === 'Space' && !gameRunning) {
        reset();
    }
});

loop();
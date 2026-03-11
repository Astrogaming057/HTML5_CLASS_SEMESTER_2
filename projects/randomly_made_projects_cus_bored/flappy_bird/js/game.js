// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 400;
canvas.height = 600;

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let bestScore = localStorage.getItem('flappyBirdBest') || 0;
let frameCount = 0;

// Bird object
const bird = {
    x: 100,
    y: canvas.height / 2,
    width: 34,
    height: 24,
    velocity: 0,
    gravity: 0.15,
    jumpPower: -6,
    rotation: 0,
    maxVelocity: 4
};

// Pipes array
const pipes = [];
const pipeWidth = 52;
const pipeGap = 160;
const pipeSpeed = 2.5;
let pipeSpawnTimer = 0;
const pipeSpawnInterval = 100;

// Ground
const ground = {
    y: canvas.height - 112,
    height: 112
};

// Game screens
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');
const bestScoreDisplay = document.getElementById('bestScore');

// Update best score display
bestScoreDisplay.textContent = bestScore;

// Input handling
let keys = {};
let mouseDown = false;

document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

canvas.addEventListener('mousedown', () => {
    mouseDown = true;
    handleInput();
});

canvas.addEventListener('mouseup', () => {
    mouseDown = false;
});

canvas.addEventListener('click', handleInput);

function handleInput() {
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'playing') {
        birdJump();
    } else if (gameState === 'gameover') {
        restartGame();
    }
}

function birdJump() {
    bird.velocity = bird.jumpPower;
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    
    // Reset game
    bird.y = canvas.height / 2;
    bird.velocity = -1; // Give a slight upward push when starting
    bird.rotation = 0;
    pipes.length = 0;
    score = 0;
    frameCount = 0;
    pipeSpawnTimer = 0;
    
    gameLoop();
}

function restartGame() {
    startGame();
}

function gameOver() {
    gameState = 'gameover';
    scoreDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreDisplay.textContent = score;
    
    // Update best score
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappyBirdBest', bestScore);
        bestScoreDisplay.textContent = bestScore;
    }
}

// Draw functions
function drawBird() {
    ctx.save();
    
    // Calculate rotation based on velocity
    bird.rotation = Math.min(Math.max(bird.velocity * 3, -25), 90);
    
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation * Math.PI / 180);
    
    // Draw bird body (yellow with gradient)
    const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, bird.width / 2);
    gradient.addColorStop(0, '#FFEB3B');
    gradient.addColorStop(1, '#FFC107');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bird wing (animated)
    const wingOffset = Math.sin(frameCount * 0.3) * 3;
    ctx.fillStyle = '#FFA000';
    ctx.beginPath();
    ctx.ellipse(-8, 5 + wingOffset, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bird eye
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(5, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(6, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bird beak
    ctx.fillStyle = '#FF6F00';
    ctx.beginPath();
    ctx.moveTo(bird.width / 2 - 3, 0);
    ctx.lineTo(bird.width / 2 + 8, -2);
    ctx.lineTo(bird.width / 2 + 8, 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw bird outline
    ctx.strokeStyle = '#FF8F00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function drawPipes() {
    pipes.forEach(pipe => {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(pipe.x + 2, 2, pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x + 2, pipe.topHeight + pipeGap + 2, pipeWidth, pipe.bottomHeight);
        
        // Top pipe
        const topGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
        topGradient.addColorStop(0, '#4CAF50');
        topGradient.addColorStop(0.5, '#66BB6A');
        topGradient.addColorStop(1, '#4CAF50');
        ctx.fillStyle = topGradient;
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        
        // Top pipe cap
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(pipe.x - 3, pipe.topHeight - 25, pipeWidth + 6, 25);
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(pipe.x - 3, pipe.topHeight - 25, pipeWidth + 6, 5);
        
        // Bottom pipe
        const bottomGradient = ctx.createLinearGradient(pipe.x, pipe.topHeight + pipeGap, pipe.x + pipeWidth, pipe.topHeight + pipeGap);
        bottomGradient.addColorStop(0, '#4CAF50');
        bottomGradient.addColorStop(0.5, '#66BB6A');
        bottomGradient.addColorStop(1, '#4CAF50');
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(pipe.x, pipe.topHeight + pipeGap, pipeWidth, pipe.bottomHeight);
        
        // Bottom pipe cap
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(pipe.x - 3, pipe.topHeight + pipeGap, pipeWidth + 6, 25);
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(pipe.x - 3, pipe.topHeight + pipeGap, pipeWidth + 6, 5);
        
        // Pipe highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(pipe.x + 3, 0, 8, pipe.topHeight);
        ctx.fillRect(pipe.x + 3, pipe.topHeight + pipeGap, 8, pipe.bottomHeight);
        
        // Pipe outline
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        ctx.strokeRect(pipe.x, pipe.topHeight + pipeGap, pipeWidth, pipe.bottomHeight);
    });
}

function drawGround() {
    // Draw ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, ground.y + 2, canvas.width, ground.height);
    
    // Draw ground
    const groundGradient = ctx.createLinearGradient(0, ground.y, 0, canvas.height);
    groundGradient.addColorStop(0, '#8B4513');
    groundGradient.addColorStop(1, '#654321');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, ground.y, canvas.width, ground.height);
    
    // Draw grass
    ctx.fillStyle = '#32CD32';
    ctx.fillRect(0, ground.y, canvas.width, 12);
    
    // Draw grass blades
    ctx.fillStyle = '#228B22';
    for (let i = 0; i < canvas.width; i += 15) {
        const offset = (frameCount * 0.5 + i) % 10;
        ctx.beginPath();
        ctx.moveTo(i + offset, ground.y);
        ctx.lineTo(i + offset - 3, ground.y - 5);
        ctx.lineTo(i + offset + 3, ground.y - 3);
        ctx.lineTo(i + offset, ground.y);
        ctx.fill();
    }
    
    // Draw ground pattern (bricks/stones)
    ctx.fillStyle = 'rgba(139, 69, 19, 0.4)';
    for (let i = 0; i < canvas.width; i += 25) {
        const offset = (frameCount * 0.3 + i) % 25;
        ctx.fillRect(i + offset, ground.y + 15, 12, 8);
    }
}

function drawBackground() {
    // Sky gradient is handled by CSS, but we can add clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    // Simple cloud shapes
    for (let i = 0; i < 3; i++) {
        const cloudX = (frameCount * 0.5 + i * 200) % (canvas.width + 100) - 50;
        const cloudY = 50 + i * 80;
        
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 20, 0, Math.PI * 2);
        ctx.arc(cloudX + 25, cloudY, 30, 0, Math.PI * 2);
        ctx.arc(cloudX + 50, cloudY, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update functions
function updateBird() {
    if (gameState !== 'playing') return;
    
    // Apply gravity
    bird.velocity += bird.gravity;
    
    // Limit max velocity
    if (bird.velocity > bird.maxVelocity) {
        bird.velocity = bird.maxVelocity;
    }
    
    bird.y += bird.velocity;
    
    // Check boundaries
    if (bird.y + bird.height > ground.y) {
        bird.y = ground.y - bird.height;
        gameOver();
    }
    
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }
}

function updatePipes() {
    if (gameState !== 'playing') return;
    
    // Spawn new pipes
    pipeSpawnTimer++;
    if (pipeSpawnTimer >= pipeSpawnInterval) {
        pipeSpawnTimer = 0;
        spawnPipe();
    }
    
    // Update and remove pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= pipeSpeed;
        
        // Remove pipes that are off screen
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(i, 1);
            continue;
        }
        
        // Check if bird passed the pipe (for scoring)
        if (!pipe.passed && pipe.x + pipeWidth < bird.x) {
            pipe.passed = true;
            score++;
        }
        
        // Check collision
        if (checkCollision(pipe)) {
            gameOver();
        }
    }
}

function spawnPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - ground.height - pipeGap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    const bottomHeight = canvas.height - ground.height - topHeight - pipeGap;
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        bottomHeight: bottomHeight,
        passed: false
    });
}

function checkCollision(pipe) {
    const birdLeft = bird.x;
    const birdRight = bird.x + bird.width;
    const birdTop = bird.y;
    const birdBottom = bird.y + bird.height;
    
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + pipeWidth;
    
    // Check if bird is within pipe's x range
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check if bird hits top or bottom pipe
        if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + pipeGap) {
            return true;
        }
    }
    
    return false;
}

// Main game loop
function gameLoop() {
    if (gameState !== 'playing') return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    // Update game objects
    updateBird();
    updatePipes();
    
    // Draw game objects
    drawPipes();
    drawGround();
    drawBird();
    
    // Update score display
    scoreDisplay.textContent = score;
    
    frameCount++;
    requestAnimationFrame(gameLoop);
}

// Initialize
drawBackground();
drawGround();
drawBird();

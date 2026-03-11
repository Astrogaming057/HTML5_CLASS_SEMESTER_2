// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 400;
canvas.height = 600;

// Settings
let instanceCount = parseInt(localStorage.getItem('flappyBirdInstanceCount') || '1');
let speedMultiplier = parseFloat(localStorage.getItem('flappyBirdSpeedMultiplier') || '1');
let deterministicPipes = localStorage.getItem('flappyBirdDeterministicPipes') === 'true';
let pipeSeed = parseInt(localStorage.getItem('flappyBirdPipeSeed') || '12345');
let bestScore = localStorage.getItem('flappyBirdAIBest') || 0;
let gamesPlayed = parseInt(localStorage.getItem('flappyBirdAIGames') || '0');
let generation = parseInt(localStorage.getItem('flappyBirdAIGeneration') || '1');

// AI Learning System
let neuralNetwork;
const INPUT_NODES = 6; // birdY, birdVelocity, nextPipeX, gapCenter, relativeToGap, groundDistance
const HIDDEN_NODES = 8;
const OUTPUT_NODES = 1; // jump or not

// Game instances
let gameInstances = [];
let globalFrameCount = 0;
let allTrainingData = []; // Aggregate training data from all instances

// Main game state (visible game)
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let frameCount = 0;

// Training data
let trainingData = [];
let lastState = null;
let lastAction = null;

// Initialize or load neural network
function initializeNeuralNetwork() {
    const saved = NeuralNetwork.load('flappyBirdAI');
    if (saved) {
        // Check if saved network matches current structure
        if (saved.inputNodes === INPUT_NODES && saved.hiddenNodes === HIDDEN_NODES && saved.outputNodes === OUTPUT_NODES) {
            neuralNetwork = saved;
            console.log('✅ Loaded saved neural network');
            console.log('Network structure:', {
                input: neuralNetwork.inputNodes,
                hidden: neuralNetwork.hiddenNodes,
                output: neuralNetwork.outputNodes
            });
        } else {
            console.log('⚠️ Saved network structure mismatch, creating new network');
            console.log('Old structure:', {
                input: saved.inputNodes,
                hidden: saved.hiddenNodes,
                output: saved.outputNodes
            });
            console.log('New structure:', {
                input: INPUT_NODES,
                hidden: HIDDEN_NODES,
                output: OUTPUT_NODES
            });
            neuralNetwork = new NeuralNetwork(INPUT_NODES, HIDDEN_NODES, OUTPUT_NODES);
        }
    } else {
        neuralNetwork = new NeuralNetwork(INPUT_NODES, HIDDEN_NODES, OUTPUT_NODES);
        console.log('🆕 Created new neural network');
        console.log('Network structure:', {
            input: INPUT_NODES,
            hidden: HIDDEN_NODES,
            output: OUTPUT_NODES
        });
    }
    
    // Test the network
    const testInput = [0.5, 0.5, 0.5, 0.5, 0.0, 0.5]; // 6 inputs now
    const testOutput = neuralNetwork.predict(testInput);
    console.log('Test prediction:', testOutput[0].toFixed(3));
}

initializeNeuralNetwork();

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

// Seeded random number generator for deterministic pipes
class SeededRandom {
    constructor(seed = 12345) {
        this.seed = seed;
    }
    
    next() {
        // Linear congruential generator
        this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
        return this.seed / Math.pow(2, 32);
    }
    
    reset(seed = 12345) {
        this.seed = seed;
    }
}

let seededRandom = new SeededRandom(pipeSeed);
let pipeSpawnIndex = 0; // Track which pipe we're spawning for deterministic mode

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
const aiStatus = document.getElementById('aiStatus');
const aiActionDisplay = document.getElementById('aiAction');
const pipeDistanceDisplay = document.getElementById('pipeDistance');
const gapCenterDisplay = document.getElementById('gapCenter');
const generationDisplay = document.getElementById('generation');
const gamesPlayedDisplay = document.getElementById('gamesPlayed');
const learningRateDisplay = document.getElementById('learningRate');

// Update displays
bestScoreDisplay.textContent = bestScore;
generationDisplay.textContent = generation;
gamesPlayedDisplay.textContent = gamesPlayed;
learningRateDisplay.textContent = neuralNetwork.learningRate.toFixed(3);

// Get game state for neural network input (uses getGameStateForBird helper)
function getGameState() {
    // Use main bird instance if available, otherwise use standalone bird
    if (allBirds.length > 0) {
        return getGameStateForBird(allBirds[0]);
    }
    // Fallback for standalone bird
    const nextPipe = getNextPipe();
    const birdY = bird.y / canvas.height;
    const birdVel = (bird.velocity + bird.maxVelocity) / (bird.maxVelocity * 2);
    let pipeX = 1;
    let gapCenter = 0.5;
    if (nextPipe) {
        const distance = nextPipe.x - (bird.x + bird.width);
        pipeX = Math.min(1, Math.max(0, distance / canvas.width));
        gapCenter = (nextPipe.topHeight + pipeGap / 2) / canvas.height;
    }
    const birdCenter = (bird.y + bird.height / 2) / canvas.height;
    const relativeToGap = birdCenter - gapCenter;
    return [birdY, birdVel, pipeX, gapCenter, relativeToGap];
}

// AI Decision Making
function getNextPipe() {
    // Find the next pipe that hasn't been passed
    for (let pipe of pipes) {
        if (pipe.x + pipeWidth > bird.x) {
            return pipe;
        }
    }
    return null;
}

function calculateGapCenter(pipe) {
    if (!pipe) return canvas.height / 2;
    return pipe.topHeight + pipeGap / 2;
}

function shouldAIJump(birdInstance) {
    const birdToCheck = birdInstance.bird;
    const distanceToGround = ground.y - (birdToCheck.y + birdToCheck.height);
    
    // CRITICAL: ABSOLUTELY NO JUMPING if too close to top (bird.y < 50)
    // This prevents constant jumping at the ceiling - CHECK THIS FIRST AND ENFORCE STRICTLY
    if (birdToCheck.y < 50) {
        if (frameCount % 30 === 0 && birdInstance.id === 'main') {
            console.log(`🚫 BLOCKED JUMP: Too close to top (y=${birdToCheck.y.toFixed(1)})`);
        }
        return false; // FORCE no jump - return immediately
    }
    
    // EMERGENCY GROUND FALLBACK - FORCE JUMP if too close to ground!
    // This is critical - ground kills you, so we MUST jump when close
    if (distanceToGround < 80) {
        // Very close to ground - FORCE jump (unless at top, which we already checked)
        const framesSinceLastJump = birdInstance.frameCount - birdInstance.lastJumpFrame;
        
        // Allow emergency jump even with cooldown if critically close
        if (distanceToGround < 50 || framesSinceLastJump >= 8) {
            if (birdInstance.id === 'main') {
                console.log(`⚠️ EMERGENCY JUMP: Too close to ground (${distanceToGround.toFixed(1)}px)`);
            }
            return true; // FORCE jump to avoid ground
        }
    }
    
    // Emergency fallback: if bird is falling fast and low, force jump
    if (birdToCheck.velocity > 2.5 && distanceToGround < 120) {
        const framesSinceLastJump = birdInstance.frameCount - birdInstance.lastJumpFrame;
        if (framesSinceLastJump >= 8) {
            if (birdInstance.id === 'main') {
                console.log(`⚠️ EMERGENCY JUMP: Falling fast (vel=${birdToCheck.velocity.toFixed(2)}, ground=${distanceToGround.toFixed(1)}px)`);
            }
            return true; // Force jump if falling fast near ground
        }
    }
    
    const state = getGameStateForBird(birdInstance);
    
    // EMERGENCY: If way below gap and pipe is close, force jump to get up!
    let nextPipe = null;
    for (let pipe of pipes) {
        if (pipe.x + pipeWidth > birdToCheck.x) {
            nextPipe = pipe;
            break;
        }
    }
    
    if (nextPipe) {
        const gapCenter = nextPipe.topHeight + pipeGap / 2;
        const birdCenter = birdToCheck.y + birdToCheck.height / 2;
        const distanceFromGap = birdCenter - gapCenter; // Positive if below gap
        const distanceToPipe = nextPipe.x - (birdToCheck.x + birdToCheck.width);
        
        // If way below gap (>100px) and pipe is approaching (<150px), force jump
        if (distanceFromGap > 100 && distanceToPipe < 150 && distanceToPipe > 0) {
            const framesSinceLastJump = birdInstance.frameCount - birdInstance.lastJumpFrame;
            if (framesSinceLastJump >= 8) {
                if (birdInstance.id === 'main') {
                    console.log(`⚠️ EMERGENCY JUMP: Way below gap (${distanceFromGap.toFixed(1)}px below, pipe ${distanceToPipe.toFixed(1)}px away)`);
                }
                return true; // Force jump to get up to gap!
            }
        }
    }
    const prediction = neuralNetwork.predict(state);
    const predictionValue = prediction[0];
    let shouldJump = predictionValue > 0.5;
    
    // Prevent constant jumping - add cooldown (use birdInstance.frameCount, not global frameCount)
    const framesSinceLastJump = birdInstance.frameCount - birdInstance.lastJumpFrame;
    
    if (shouldJump) {
        if (framesSinceLastJump < 10) {
            shouldJump = false;
            if (birdInstance.id === 'main' && birdInstance.frameCount % 30 === 0) {
                console.log(`⏸️ JUMP BLOCKED: Cooldown (${framesSinceLastJump}/10 frames)`);
            }
        } else {
            birdInstance.lastJumpFrame = birdInstance.frameCount;
        }
    }
    
    // Log AI decision periodically
    if (birdInstance.id === 'main' && frameCount % 30 === 0) {
        let nextPipe = null;
        for (let pipe of pipes) {
            if (pipe.x + pipeWidth > birdToCheck.x) {
                nextPipe = pipe;
                break;
            }
        }
        
        const gapInfo = nextPipe ? {
            gapCenter: (nextPipe.topHeight + pipeGap / 2).toFixed(1),
            birdCenter: (birdToCheck.y + birdToCheck.height / 2).toFixed(1),
            distanceFromGap: Math.abs((birdToCheck.y + birdToCheck.height / 2) - (nextPipe.topHeight + pipeGap / 2)).toFixed(1),
            distanceToPipe: (nextPipe.x - (birdToCheck.x + birdToCheck.width)).toFixed(1)
        } : 'No pipe';
        
        console.log(`🤖 AI Decision:`, {
            prediction: predictionValue.toFixed(3),
            shouldJump: shouldJump,
            birdY: birdToCheck.y.toFixed(1),
            birdVel: birdToCheck.velocity.toFixed(2),
            groundDist: distanceToGround.toFixed(1),
            gapInfo: gapInfo,
            state: state.map(s => s.toFixed(3))
        });
    }
    
    return shouldJump;
}

// Helper function to get game state for any bird instance
function getGameStateForBird(birdInstance) {
    const birdToCheck = birdInstance.bird || bird;
    // All birds share the same pipes array
    const pipesToCheck = pipes;
    
    let nextPipe = null;
    for (let pipe of pipesToCheck) {
        if (pipe.x + pipeWidth > birdToCheck.x) {
            nextPipe = pipe;
            break;
        }
    }
    
    const birdY = birdToCheck.y / canvas.height;
    const birdVel = (birdToCheck.velocity + birdToCheck.maxVelocity) / (birdToCheck.maxVelocity * 2);
    
    // Add ground distance as input - CRITICAL for learning ground avoidance!
    const distanceToGround = ground.y - (birdToCheck.y + birdToCheck.height);
    const normalizedGroundDistance = Math.min(1, Math.max(0, distanceToGround / (canvas.height - ground.y)));
    
    let pipeX = 1;
    let gapCenter = 0.5;
    
    if (nextPipe) {
        const distance = nextPipe.x - (birdToCheck.x + birdToCheck.width);
        pipeX = Math.min(1, Math.max(0, distance / canvas.width));
        gapCenter = (nextPipe.topHeight + pipeGap / 2) / canvas.height;
    }
    
    const birdCenter = (birdToCheck.y + birdToCheck.height / 2) / canvas.height;
    const relativeToGap = birdCenter - gapCenter;
    
    // Return 6 inputs instead of 5 - now includes ground distance
    return [birdY, birdVel, pipeX, gapCenter, relativeToGap, normalizedGroundDistance];
}

// Learn from the game outcome with immediate rewards
function learnFromGame() {
    if (trainingData.length === 0) {
        console.log('No training data collected');
        return;
    }
    
    console.log(`Learning from game - Score: ${score}, Training samples: ${trainingData.length}`);
    
    let trainingCount = 0;
    let totalReward = 0;
    let positiveRewards = 0;
    let negativeRewards = 0;
    
    // Calculate total reward from immediate rewards
    for (let data of trainingData) {
        totalReward += data.reward || 0;
        if (data.reward > 0) positiveRewards++;
        if (data.reward < 0) negativeRewards++;
    }
    
    console.log(`Total immediate reward: ${totalReward.toFixed(2)} (${positiveRewards} positive, ${negativeRewards} negative)`);
    
    // Find the last few actions before death (these are critical)
    const lastActions = trainingData.slice(-10);
    
    for (let i = 0; i < trainingData.length; i++) {
        const data = trainingData[i];
        const isLastAction = i >= trainingData.length - 10;
        
        // Base target from immediate reward
        let target;
        const immediateReward = data.reward || 0;
        
        // Convert reward (-1 to 1 range) to target (0 to 1 range)
        // Positive reward -> encourage the action taken
        // Negative reward -> discourage the action taken
        if (immediateReward > 0) {
            // Good position - reinforce the action
            target = data.action === 1 ? (0.5 + immediateReward * 0.4) : (0.5 - immediateReward * 0.4);
            target = Math.max(0.1, Math.min(0.9, target)); // Clamp between 0.1 and 0.9
        } else if (immediateReward < 0) {
            // Bad position - penalize the action
            target = data.action === 1 ? (0.5 + immediateReward * 0.5) : (0.5 - immediateReward * 0.5);
            target = Math.max(0.05, Math.min(0.95, target)); // Clamp between 0.05 and 0.95
        } else {
            // Neutral - use score-based learning
            if (score === 0) {
                target = data.action === 1 ? 0.3 : 0.7;
            } else if (score < 5) {
                target = data.action === 1 ? 0.6 : 0.4;
            } else {
                target = data.action === 1 ? 0.75 : 0.25;
            }
        }
        
        // Bonus: if we successfully passed pipes, reward actions that led to success
        if (score > 0 && immediateReward > 0.1) {
            target = data.action === 1 ? Math.min(0.9, target + 0.1) : Math.max(0.1, target - 0.1);
        }
        
        // Penalty: if we died and had bad immediate rewards, penalize more
        if (score === 0 && immediateReward < -0.2) {
            target = data.action === 1 ? Math.max(0.1, target - 0.2) : Math.min(0.9, target + 0.2);
        }
        
        // Train on this sample
        neuralNetwork.train(data.state, [target]);
        trainingCount++;
        
        // Train multiple times on critical samples (very bad or very good)
        if (Math.abs(immediateReward) > 0.3) {
            neuralNetwork.train(data.state, [target]);
            trainingCount++;
        }
    }
    
    console.log(`Trained ${trainingCount} times on ${trainingData.length} samples`);
    
    // Reward successful pipe passes
    if (score > 0) {
        console.log(`Rewarding ${score} successful pipe passes`);
        // Find samples where bird was in good position (positive reward)
        const goodSamples = trainingData.filter(d => (d.reward || 0) > 0.1);
        for (let data of goodSamples) {
            const target = data.action === 1 ? 0.8 : 0.2;
            neuralNetwork.train(data.state, [target]);
            trainingCount++;
        }
    }
    
    // Special case: if bird hit top of screen, strongly penalize
    const topHits = trainingData.filter(d => {
        return d.state[0] < 0.05 && d.action === 1;
    });
    
    if (topHits.length > 0) {
        console.log(`Penalizing ${topHits.length} jumps at top of screen`);
        for (let data of topHits) {
            for (let i = 0; i < 3; i++) {
                neuralNetwork.train(data.state, [0.05]);
                trainingCount++;
            }
        }
    }
    
    // Penalize being too high or too low from gap
    const badPositions = trainingData.filter(d => (d.reward || 0) < -0.3);
    if (badPositions.length > 0) {
        console.log(`Penalizing ${badPositions.length} bad positions relative to pipes`);
        for (let data of badPositions) {
            const target = data.action === 1 ? 0.2 : 0.8; // Reverse the action
            neuralNetwork.train(data.state, [target]);
            trainingCount++;
        }
    }
    
    trainingData = [];
}

// Calculate immediate reward/penalty based on bird position
function calculateImmediateReward() {
    let reward = 0;
    const nextPipe = getNextPipe();
    const birdCenter = bird.y + bird.height / 2;
    
    // Penalty for being stuck at top
    if (bird.y < 30) {
        const distanceFromTop = bird.y;
        reward -= (30 - distanceFromTop) / 30 * 0.5; // Max -0.5 penalty when at top
        if (frameCount % 60 === 0) {
            console.log(`⚠️ Penalty: Stuck at top (y=${bird.y.toFixed(1)})`);
        }
    }
    
    if (nextPipe) {
        const gapCenter = calculateGapCenter(nextPipe);
        const distanceToPipe = nextPipe.x - (bird.x + bird.width);
        
        // Only calculate rewards when close to pipe (within 200px)
        if (distanceToPipe < 200 && distanceToPipe > -50) {
            const distanceFromGap = Math.abs(birdCenter - gapCenter);
            const maxDistance = pipeGap / 2;
            
            // Reward for being close to gap center (good position)
            if (distanceFromGap < maxDistance * 0.3) {
                // Very close to center - good!
                reward += 0.3;
            } else if (distanceFromGap < maxDistance * 0.6) {
                // Somewhat close - okay
                reward += 0.1;
            } else {
                // Too far from center - penalty based on distance
                const penalty = (distanceFromGap - maxDistance * 0.6) / maxDistance;
                reward -= penalty * 0.4; // Max -0.4 penalty
                
                if (frameCount % 60 === 0) {
                    const direction = birdCenter < gapCenter ? 'too high' : 'too low';
                    console.log(`⚠️ Penalty: ${direction} from gap (${distanceFromGap.toFixed(1)}px from center)`);
                }
            }
            
            // Extra penalty if way too high or too low
            if (birdCenter < gapCenter - maxDistance * 0.8) {
                reward -= 0.5; // Way too high
            } else if (birdCenter > gapCenter + maxDistance * 0.8) {
                reward -= 0.5; // Way too low
            }
        }
    }
    
    return reward;
}

// Collect training data during gameplay with immediate rewards
function collectTrainingData() {
    if (lastState !== null && lastAction !== null) {
        const immediateReward = calculateImmediateReward();
        
        trainingData.push({
            state: [...lastState], // Copy array
            action: lastAction,
            reward: immediateReward // Store immediate reward
        });
        
        // Limit training data size
        if (trainingData.length > 100) {
            trainingData.shift();
        }
        
        // Log first few samples
        if (trainingData.length === 1) {
            console.log('📊 First training sample collected:', {
                state: lastState.map(s => s.toFixed(2)),
                action: lastAction,
                reward: immediateReward.toFixed(3)
            });
        }
    }
}

function birdJump() {
    bird.velocity = bird.jumpPower;
}

function startGame() {
    console.log(`🎮 Starting game #${gamesPlayed + 1} with ${instanceCount} birds`);
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    aiStatus.classList.remove('hidden');
    
    // Reset seeded random if deterministic pipes are enabled
    if (deterministicPipes) {
        seededRandom.reset(pipeSeed);
        pipeSpawnIndex = 0;
        console.log(`🔄 Deterministic pipes enabled - using seed: ${pipeSeed}`);
    }
    
    // Create all birds (this clears pipes)
    createAllBirds();
    
    // Reset main bird
    bird.y = canvas.height / 2;
    bird.velocity = -1;
    bird.rotation = 0;
    // Don't clear pipes again - createAllBirds() already did it
    score = 0;
    frameCount = 0;
    
    // Spawn initial pipe immediately so pipes are visible right away
    spawnPipe();
    console.log('Spawned initial pipe, pipes.length:', pipes.length, 'pipe x:', pipes[0]?.x);
    
    gameLoop();
}

function restartGame() {
    console.log('=== Game Over ===');
    console.log(`Score: ${score}, Games Played: ${gamesPlayed}, Generation: ${generation}`);
    
    // Learn from the previous game
    learnFromGame();
    
    gamesPlayed++;
    gamesPlayedDisplay.textContent = gamesPlayed;
    localStorage.setItem('flappyBirdAIGames', gamesPlayed.toString());
    
    // Save progress periodically
    if (gamesPlayed % 10 === 0) {
        neuralNetwork.save('flappyBirdAI');
        localStorage.setItem('flappyBirdAIGeneration', generation.toString());
        console.log('💾 Saved neural network progress');
    }
    
    // Occasionally mutate the network (genetic algorithm approach)
    // Update generation more frequently for better feedback
    if (gamesPlayed > 0 && gamesPlayed % 10 === 0) {
        generation++;
        generationDisplay.textContent = generation;
        localStorage.setItem('flappyBirdAIGeneration', generation.toString());
        // Create a mutated copy
        const mutated = neuralNetwork.copy();
        mutated.mutate(0.05); // Smaller mutation rate since we're doing it more often
        neuralNetwork = mutated;
        console.log(`🧬 Mutated neural network - Generation ${generation} (every 10 games)`);
    }
    
    // If AI is stuck (always getting 0 score), add some randomness
    if (gamesPlayed % 20 === 0 && bestScore === 0) {
        console.log('⚠️ AI seems stuck, adding exploration');
        // Slightly randomize some weights to explore
        for (let i = 0; i < neuralNetwork.weightsIH.length; i++) {
            for (let j = 0; j < neuralNetwork.weightsIH[i].length; j++) {
                if (Math.random() < 0.1) {
                    neuralNetwork.weightsIH[i][j] += (Math.random() - 0.5) * 0.5;
                }
            }
        }
    }
    
    console.log('=== Starting new game ===');
    
    // Auto-restart after 1 second
    setTimeout(() => {
        startGame();
    }, 1000);
}

function gameOver() {
    // Collect training data from all birds
    allTrainingData = [];
    let bestBirdScore = 0;
    
    for (let birdInstance of allBirds) {
        allTrainingData.push(...birdInstance.trainingData);
        if (birdInstance.score > bestBirdScore) {
            bestBirdScore = birdInstance.score;
        }
    }
    
    console.log(`💀 Game Over! Best Score: ${bestBirdScore} (from ${allBirds.length} birds)`);
    gameState = 'gameover';
    scoreDisplay.classList.add('hidden');
    aiStatus.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreDisplay.textContent = bestBirdScore;
    
    // Update best score
    if (bestBirdScore > bestScore) {
        console.log(`🏆 NEW BEST SCORE: ${bestBirdScore} (was ${bestScore})`);
        bestScore = bestBirdScore;
        localStorage.setItem('flappyBirdAIBest', bestScore);
        bestScoreDisplay.textContent = bestScore;
        neuralNetwork.save('flappyBirdAI');
        console.log('💾 Saved network after new best score');
    }
    
    // Learn from all birds' data
    if (allTrainingData.length > 0) {
        learnFromAggregatedData();
    }
    
    // Auto-restart
    restartGame();
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
        
        // Draw AI vision line to next pipe
        if (pipe === getNextPipe()) {
            const gapCenter = calculateGapCenter(pipe);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(bird.x + bird.width / 2, bird.y + bird.height / 2);
            ctx.lineTo(pipe.x + pipeWidth / 2, gapCenter);
            ctx.stroke();
            ctx.setLineDash([]);
        }
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

// Old update functions - now handled by updateBirdInstance

function spawnPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - ground.height - pipeGap - minHeight;
    
    let topHeight;
    if (deterministicPipes) {
        // Use seeded random for consistent pipe positions
        topHeight = seededRandom.next() * (maxHeight - minHeight) + minHeight;
    } else {
        // Use regular random
        topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    }
    
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

// Create all visible bird instances
let allBirds = [];

function createAllBirds() {
    allBirds = [];
    // Clear and reset shared pipes
    pipes.length = 0;
    
    // Main bird - shares the global pipes array
    allBirds.push({
        id: 'main',
        bird: bird,
        pipes: pipes, // All birds share the same pipes array
        score: 0,
        frameCount: 0,
        pipeSpawnTimer: 0,
        trainingData: [],
        lastState: null,
        lastAction: null,
        lastJumpFrame: 0,
        gameState: 'playing',
        maxVelocity: 4,
        gravity: 0.15,
        jumpPower: -6
    });
    
    // Additional birds - all share the same pipes array
    // Spread birds more evenly across the safe vertical space to avoid all hitting first pipe
    const safeHeight = ground.y - 50; // Safe area (avoid top 50px and ground)
    const spacing = safeHeight / Math.max(instanceCount, 1);
    
    for (let i = 0; i < instanceCount - 1; i++) {
        // Distribute birds evenly across safe vertical space
        const startY = 50 + (i * spacing) + (spacing / 2);
        allBirds.push({
            id: i,
            bird: {
                x: 100,
                y: Math.min(startY, ground.y - 30), // Ensure not too low
                width: 34,
                height: 24,
                velocity: -1,
                rotation: 0,
                maxVelocity: 4
            },
            pipes: pipes, // Share the same pipes array
            score: 0,
            frameCount: 0,
            pipeSpawnTimer: 0, // Only main bird spawns pipes
            trainingData: [],
            lastState: null,
            lastAction: null,
            lastJumpFrame: 0,
            gameState: 'playing',
            maxVelocity: 4,
            gravity: 0.15,
            jumpPower: -6
        });
    }
}

function updateBirdInstance(birdInstance) {
    if (birdInstance.gameState !== 'playing') return;
    
    const b = birdInstance.bird;
    
    // AI decision - STRICT top boundary check happens inside shouldAIJump
    if (shouldAIJump(birdInstance)) {
        b.velocity = birdInstance.jumpPower;
    }
    
    // Apply gravity
    b.velocity += birdInstance.gravity;
    if (b.velocity > birdInstance.maxVelocity) {
        b.velocity = birdInstance.maxVelocity;
    }
    b.y += b.velocity;
    
    // Check boundaries
    if (b.y + b.height > ground.y || b.y < 0) {
        if (birdInstance.id === 'main') {
            const cause = b.y + b.height > ground.y ? 'GROUND' : 'CEILING';
            console.log(`💀 Bird ${birdInstance.id} DIED: Hit ${cause} (y=${b.y.toFixed(1)}, vel=${b.velocity.toFixed(2)}, score=${birdInstance.score})`);
        }
        birdInstance.gameState = 'gameover';
        return;
    }
    
    // Only main bird spawns and updates pipes (all birds share the same pipes)
    if (birdInstance.id === 'main') {
        // Update pipes for main bird (shared by all)
        birdInstance.pipeSpawnTimer++;
        if (birdInstance.pipeSpawnTimer >= pipeSpawnInterval) {
            birdInstance.pipeSpawnTimer = 0;
            spawnPipe();
        }
        
        // Update pipes
        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.x -= pipeSpeed;
            
            if (pipe.x + pipeWidth < 0) {
                pipes.splice(i, 1);
                continue;
            }
        }
    }
    
    // All birds check collision with shared pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        
        // Check if this bird passed the pipe (for scoring)
        if (!pipe.passedBy) pipe.passedBy = new Set();
        if (!pipe.passedBy.has(birdInstance.id) && pipe.x + pipeWidth < b.x) {
            pipe.passedBy.add(birdInstance.id);
            birdInstance.score++;
        }
        
        // Check collision
        if (b.x + b.width > pipe.x && b.x < pipe.x + pipeWidth) {
            if (b.y < pipe.topHeight || b.y + b.height > pipe.topHeight + pipeGap) {
                if (birdInstance.id === 'main') {
                    const gapCenter = pipe.topHeight + pipeGap / 2;
                    const birdCenter = b.y + b.height / 2;
                    const distanceFromGap = Math.abs(birdCenter - gapCenter);
                    const hitTop = b.y < pipe.topHeight;
                    console.log(`💀 Bird ${birdInstance.id} DIED: Hit PIPE (${hitTop ? 'TOP' : 'BOTTOM'})`, {
                        score: birdInstance.score,
                        birdY: b.y.toFixed(1),
                        birdCenter: birdCenter.toFixed(1),
                        gapCenter: gapCenter.toFixed(1),
                        distanceFromGap: distanceFromGap.toFixed(1),
                        pipeX: pipe.x.toFixed(1),
                        velocity: b.velocity.toFixed(2)
                    });
                }
                birdInstance.gameState = 'gameover';
                return;
            }
        }
    }
    
    // Collect training data
    const state = getGameStateForBird(birdInstance);
    const reward = calculateImmediateRewardForBird(birdInstance);
    const willJump = shouldAIJump(birdInstance);
    birdInstance.trainingData.push({
        state: [...state],
        action: willJump ? 1 : 0,
        reward: reward
    });
    
    // Log training data collection periodically
    if (birdInstance.id === 'main' && birdInstance.trainingData.length % 50 === 0) {
        const avgReward = birdInstance.trainingData.slice(-50).reduce((sum, d) => sum + (d.reward || 0), 0) / 50;
        const positiveCount = birdInstance.trainingData.slice(-50).filter(d => (d.reward || 0) > 0).length;
        const negativeCount = birdInstance.trainingData.slice(-50).filter(d => (d.reward || 0) < 0).length;
        console.log(`📊 Training Data: ${birdInstance.trainingData.length} samples, Last 50 avg reward: ${avgReward.toFixed(3)} (${positiveCount} pos, ${negativeCount} neg)`);
    }
    
    if (birdInstance.trainingData.length > 100) {
        birdInstance.trainingData.shift();
    }
    
    birdInstance.frameCount++;
}

function calculateImmediateRewardForBird(birdInstance) {
    let reward = 0;
    const b = birdInstance.bird;
    const rewardBreakdown = {
        topPenalty: 0,
        groundPenalty: 0,
        gapAlignment: 0,
        directional: 0,
        crashPenalty: 0
    };
    
    // STRICT penalty for being at top
    if (b.y < 50) {
        rewardBreakdown.topPenalty = (50 - b.y) / 50 * 0.8;
        reward -= rewardBreakdown.topPenalty;
    }
    
    // STRONG penalty for being close to ground - GROUND KILLS YOU!
    const distanceToGround = ground.y - (b.y + b.height);
    if (distanceToGround < 150) {
        // Very close to ground - EXTREMELY strong penalty
        const dangerLevel = 1 - (distanceToGround / 150);
        rewardBreakdown.groundPenalty = dangerLevel * 3.0;
        reward -= rewardBreakdown.groundPenalty;
        
        // Extra penalty if falling fast near ground
        if (b.velocity > 1.5 && distanceToGround < 80) {
            rewardBreakdown.groundPenalty += 1.0;
            reward -= 1.0;
        }
    }
    
    // Penalty for falling velocity when low to ground (encourage jumping)
    if (distanceToGround < 200 && b.velocity > 0) {
        const fallPenalty = (b.velocity / birdInstance.maxVelocity) * 0.5;
        rewardBreakdown.groundPenalty += fallPenalty;
        reward -= fallPenalty;
    }
    
    // Use shared pipes array
    let nextPipe = null;
    for (let pipe of pipes) {
        if (pipe.x + pipeWidth > b.x) {
            nextPipe = pipe;
            break;
        }
    }
    
    if (nextPipe) {
        const gapCenter = nextPipe.topHeight + pipeGap / 2;
        const birdCenter = b.y + b.height / 2;
        const distanceFromGap = Math.abs(birdCenter - gapCenter);
        const distanceToPipe = nextPipe.x - (b.x + b.width);
        const isAboveGap = birdCenter < gapCenter;
        const isBelowGap = birdCenter > gapCenter;
        
        // STRONG rewards for being aligned with gap - this is CRITICAL for success!
        // Apply rewards when approaching pipe (further away too, so AI can plan ahead)
        if (distanceToPipe < 300 && distanceToPipe > -100) {
            const maxGapDistance = pipeGap / 2;
            const alignmentScore = 1 - (distanceFromGap / maxGapDistance);
            
            // Scale penalties/rewards based on distance to pipe
            // When pipe is far, be more lenient. When close, be strict.
            const proximityFactor = distanceToPipe > 200 ? 0.3 : (distanceToPipe > 100 ? 0.6 : 1.0);
            
            // PERFECT alignment - very strong reward
            if (distanceFromGap < maxGapDistance * 0.2) {
                rewardBreakdown.gapAlignment = 1.5 * proximityFactor;
                reward += rewardBreakdown.gapAlignment;
            } 
            // Good alignment
            else if (distanceFromGap < maxGapDistance * 0.4) {
                rewardBreakdown.gapAlignment = 0.8 * proximityFactor;
                reward += rewardBreakdown.gapAlignment;
            }
            // Decent alignment
            else if (distanceFromGap < maxGapDistance * 0.6) {
                rewardBreakdown.gapAlignment = 0.3 * proximityFactor;
                reward += rewardBreakdown.gapAlignment;
            }
            // Poor alignment - penalty scaled by distance
            else {
                // Only penalize if reasonably close to pipe
                if (distanceToPipe < 200) {
                    const misalignment = (distanceFromGap - maxGapDistance * 0.6) / (maxGapDistance * 0.4);
                    // Scale penalty: less when far, more when close
                    const penaltyScale = distanceToPipe > 150 ? 0.3 : (distanceToPipe > 100 ? 0.6 : 1.0);
                    rewardBreakdown.gapAlignment = -misalignment * 1.5 * penaltyScale;
                    reward += rewardBreakdown.gapAlignment;
                } else {
                    // Pipe is far away - give small reward for moving toward gap
                    if (isAboveGap && b.velocity >= 0) {
                        rewardBreakdown.gapAlignment = 0.1; // Small reward for moving toward gap
                        reward += rewardBreakdown.gapAlignment;
                    } else if (isBelowGap && b.velocity <= 0) {
                        rewardBreakdown.gapAlignment = 0.1; // Small reward for moving toward gap
                        reward += rewardBreakdown.gapAlignment;
                    }
                }
            }
            
            // Directional guidance: reward actions that move bird TOWARD gap center
            // If bird is above gap and falling (or should fall), that's good
            // If bird is below gap and rising (or should rise), that's good
            if (distanceToPipe < 250 && distanceToPipe > 0) {
                if (isAboveGap && b.velocity >= 0) {
                    // Above gap and falling/stable - good, moving toward gap
                    rewardBreakdown.directional = 0.2 * proximityFactor;
                    reward += rewardBreakdown.directional;
                } else if (isAboveGap && b.velocity < -2) {
                    // Above gap but rising fast - bad, moving away from gap
                    rewardBreakdown.directional = -0.3 * proximityFactor;
                    reward += rewardBreakdown.directional;
                }
                
                if (isBelowGap && b.velocity <= 0) {
                    // Below gap and rising/stable - good, moving toward gap
                    // STRONGER reward if way below gap - bird needs to jump UP!
                    const distanceBelow = birdCenter - gapCenter;
                    if (distanceBelow > 100) {
                        // Way below - STRONG reward for rising/jumping
                        rewardBreakdown.directional = 0.5 * proximityFactor;
                    } else {
                        rewardBreakdown.directional = 0.2 * proximityFactor;
                    }
                    reward += rewardBreakdown.directional;
                } else if (isBelowGap && b.velocity > 2) {
                    // Below gap but falling fast - bad, moving away from gap
                    // Extra penalty if way below - bird is going the wrong way!
                    const distanceBelow = birdCenter - gapCenter;
                    if (distanceBelow > 100) {
                        rewardBreakdown.directional = -0.6 * proximityFactor; // Stronger penalty
                    } else {
                        rewardBreakdown.directional = -0.3 * proximityFactor;
                    }
                    reward += rewardBreakdown.directional;
                }
            }
            
            // CRITICAL: If bird is way below gap and pipe is approaching, STRONG reward for jumping
            if (isBelowGap && distanceToPipe < 200 && distanceToPipe > 50) {
                const distanceBelow = birdCenter - gapCenter;
                if (distanceBelow > 80 && b.velocity <= 0) {
                    // Way below gap and rising - this is what we want!
                    rewardBreakdown.directional += 0.3 * proximityFactor;
                    reward += 0.3 * proximityFactor;
                } else if (distanceBelow > 80 && b.velocity > 0) {
                    // Way below gap but falling - STRONG penalty
                    rewardBreakdown.directional -= 0.5 * proximityFactor;
                    reward -= 0.5 * proximityFactor;
                }
            }
            
            // Extra strong penalty if way off target (will definitely hit pipe)
            if (distanceFromGap > maxGapDistance * 0.8 && distanceToPipe < 100 && distanceToPipe > -50) {
                rewardBreakdown.crashPenalty = -2.0;
                reward += rewardBreakdown.crashPenalty;
            }
            
            // Log reward breakdown periodically
            if (birdInstance.id === 'main' && frameCount % 30 === 0) {
                console.log(`💰 Reward Breakdown:`, {
                    total: reward.toFixed(3),
                    gapAlignment: rewardBreakdown.gapAlignment.toFixed(3),
                    directional: rewardBreakdown.directional.toFixed(3),
                    groundPenalty: rewardBreakdown.groundPenalty.toFixed(3),
                    topPenalty: rewardBreakdown.topPenalty.toFixed(3),
                    crashPenalty: rewardBreakdown.crashPenalty.toFixed(3),
                    gapDistance: distanceFromGap.toFixed(1),
                    pipeDistance: distanceToPipe.toFixed(1),
                    position: isAboveGap ? 'ABOVE' : isBelowGap ? 'BELOW' : 'ALIGNED'
                });
            }
        }
    }
    
    return reward;
}

function drawBirdInstance(birdInstance) {
    const b = birdInstance.bird;
    ctx.save();
    
    b.rotation = Math.min(Math.max(b.velocity * 3, -25), 90);
    ctx.translate(b.x + b.width / 2, b.y + b.height / 2);
    ctx.rotate(b.rotation * Math.PI / 180);
    
    const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, b.width / 2);
    gradient.addColorStop(0, '#FFEB3B');
    gradient.addColorStop(1, '#FFC107');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const wingOffset = Math.sin(frameCount * 0.3) * 3;
    ctx.fillStyle = '#FFA000';
    ctx.beginPath();
    ctx.ellipse(-8, 5 + wingOffset, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(5, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(6, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FF6F00';
    ctx.beginPath();
    ctx.moveTo(b.width / 2 - 3, 0);
    ctx.lineTo(b.width / 2 + 8, -2);
    ctx.lineTo(b.width / 2 + 8, 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function drawPipesForInstance(birdInstance) {
    birdInstance.pipes.forEach(pipe => {
        // Draw pipes (same as before but for this instance)
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.topHeight + pipeGap, pipeWidth, pipe.bottomHeight || (canvas.height - pipe.topHeight - pipeGap - ground.height));
    });
}

    // Main game loop
function gameLoop() {
    // Check if any birds are still alive
    const aliveBirds = allBirds.filter(b => b.gameState === 'playing');
    
    // Log bird status periodically
    if (frameCount % 60 === 0 && gameState === 'playing') {
        const deadBirds = allBirds.filter(b => b.gameState !== 'playing');
        console.log(`🦅 Birds status: ${aliveBirds.length} alive, ${deadBirds.length} dead (total: ${allBirds.length})`);
    }
    
    if (aliveBirds.length === 0 && gameState === 'playing') {
        // All birds dead - game over
        console.log(`💀 All ${allBirds.length} birds are dead - ending game`);
        gameOver();
        return;
    }
    
    if (gameState !== 'playing') {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Update all birds
    for (let i = 0; i < speedMultiplier; i++) {
        for (let birdInstance of allBirds) {
            if (birdInstance.gameState === 'playing') {
                updateBirdInstance(birdInstance);
            }
        }
        frameCount++;
    }
    
    // All birds share the same pipes array, so just get score from main bird
    const mainBird = allBirds[0];
    score = mainBird.score;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    // Draw pipes (shared by all birds)
    if (pipes.length > 0) {
        drawPipes();
    } else {
        // Debug: log if no pipes
        if (frameCount % 60 === 0) {
            console.log('No pipes to draw! pipes.length:', pipes.length);
        }
    }
    
    // Draw all birds
    for (let birdInstance of allBirds) {
        if (birdInstance.gameState === 'playing') {
            drawBirdInstance(birdInstance);
        }
    }
    
    drawGround();
    
    // Update score display (show best score from all birds)
    const bestBirdScore = Math.max(...allBirds.map(b => b.score));
    scoreDisplay.textContent = bestBirdScore;
    gamesPlayedDisplay.textContent = gamesPlayed;
    generationDisplay.textContent = generation;
    activeInstancesDisplay.textContent = aliveBirds.length;
    
    // Update AI status display (from main bird)
    if (aliveBirds.length > 0 && mainBird) {
        const mainBirdState = getGameStateForBird(mainBird);
        const prediction = neuralNetwork.predict(mainBirdState);
        const predictionValue = prediction[0];
        const willJump = shouldAIJump(mainBird);
        
        aiActionDisplay.textContent = willJump ? `JUMP (${predictionValue.toFixed(2)})` : `FLY (${predictionValue.toFixed(2)})`;
        
        // Use shared pipes array
        let nextPipe = null;
        for (let pipe of pipes) {
            if (pipe.x + pipeWidth > mainBird.bird.x) {
                nextPipe = pipe;
                break;
            }
        }
        
        if (nextPipe) {
            const distance = nextPipe.x - (mainBird.bird.x + mainBird.bird.width);
            pipeDistanceDisplay.textContent = Math.max(0, Math.round(distance));
            gapCenterDisplay.textContent = Math.round(calculateGapCenter(nextPipe));
        } else {
            pipeDistanceDisplay.textContent = '-';
            gapCenterDisplay.textContent = '-';
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Settings menu functionality
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const instanceCountInput = document.getElementById('instanceCount');
const speedMultiplierInput = document.getElementById('speedMultiplier');
const deterministicPipesInput = document.getElementById('deterministicPipes');
const pipeSeedInput = document.getElementById('pipeSeed');
const seedInputContainer = document.getElementById('seedInputContainer');
const applySettingsButton = document.getElementById('applySettings');
const closeSettingsButton = document.getElementById('closeSettings');
const exportDataButton = document.getElementById('exportData');
const resetDataButton = document.getElementById('resetData');
const activeInstancesDisplay = document.getElementById('activeInstances');

// Load saved settings
instanceCountInput.value = instanceCount;
speedMultiplierInput.value = speedMultiplier;
deterministicPipesInput.checked = deterministicPipes;
pipeSeedInput.value = pipeSeed;

// Show/hide seed input based on checkbox
function updateSeedInputVisibility() {
    seedInputContainer.style.display = deterministicPipesInput.checked ? 'block' : 'none';
}
updateSeedInputVisibility();

deterministicPipesInput.addEventListener('change', updateSeedInputVisibility);

settingsButton.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

closeSettingsButton.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
});

applySettingsButton.addEventListener('click', () => {
    const newInstanceCount = parseInt(instanceCountInput.value) || 1;
    const newSpeedMultiplier = parseFloat(speedMultiplierInput.value) || 1;
    const newDeterministicPipes = deterministicPipesInput.checked;
    const newPipeSeed = parseInt(pipeSeedInput.value) || 12345;
    
    if (newInstanceCount !== instanceCount || newSpeedMultiplier !== speedMultiplier || 
        newDeterministicPipes !== deterministicPipes || newPipeSeed !== pipeSeed) {
        instanceCount = Math.max(1, Math.min(200, newInstanceCount));
        speedMultiplier = Math.max(1, Math.min(10, newSpeedMultiplier));
        deterministicPipes = newDeterministicPipes;
        pipeSeed = Math.max(1, Math.min(999999999, newPipeSeed));
        
        localStorage.setItem('flappyBirdInstanceCount', instanceCount.toString());
        localStorage.setItem('flappyBirdSpeedMultiplier', speedMultiplier.toString());
        localStorage.setItem('flappyBirdDeterministicPipes', deterministicPipes.toString());
        localStorage.setItem('flappyBirdPipeSeed', pipeSeed.toString());
        
        console.log(`Settings updated: ${instanceCount} instances, ${speedMultiplier}x speed, deterministic pipes: ${deterministicPipes}, seed: ${pipeSeed}`);
        
        // Reset seeded random if deterministic pipes or seed changed
        if (deterministicPipes) {
            seededRandom.reset(pipeSeed);
            pipeSpawnIndex = 0;
        }
        
        // Birds will be recreated in startGame
        
        // Restart main game if needed
        if (gameState === 'playing') {
            // Just update, don't restart
        } else if (gameState === 'start') {
            setTimeout(() => startGame(), 500);
        }
    }
    
    settingsPanel.classList.add('hidden');
});

// Export data function
exportDataButton.addEventListener('click', () => {
    console.log('📥 Exporting AI data...');
    
    // Collect all relevant data
    const exportData = {
        timestamp: new Date().toISOString(),
        neuralNetwork: {
            inputNodes: neuralNetwork.inputNodes,
            hiddenNodes: neuralNetwork.hiddenNodes,
            outputNodes: neuralNetwork.outputNodes,
            learningRate: neuralNetwork.learningRate,
            weightsIH: neuralNetwork.weightsIH,
            weightsHO: neuralNetwork.weightsHO,
            biasH: neuralNetwork.biasH,
            biasO: neuralNetwork.biasO
        },
        gameStats: {
            bestScore: bestScore,
            gamesPlayed: gamesPlayed,
            generation: generation,
            instanceCount: instanceCount,
            speedMultiplier: speedMultiplier,
            deterministicPipes: deterministicPipes,
            pipeSeed: pipeSeed
        },
        currentGameState: {
            score: score,
            aliveBirds: allBirds.filter(b => b.gameState === 'playing').length,
            totalBirds: allBirds.length,
            pipesCount: pipes.length
        },
        localStorage: {
            flappyBirdAIWeights: localStorage.getItem('flappyBirdAIWeights'),
            flappyBirdAIBest: localStorage.getItem('flappyBirdAIBest'),
            flappyBirdAIGames: localStorage.getItem('flappyBirdAIGames'),
            flappyBirdAIGeneration: localStorage.getItem('flappyBirdAIGeneration'),
            flappyBirdInstanceCount: localStorage.getItem('flappyBirdInstanceCount'),
            flappyBirdSpeedMultiplier: localStorage.getItem('flappyBirdSpeedMultiplier'),
            flappyBirdDeterministicPipes: localStorage.getItem('flappyBirdDeterministicPipes'),
            flappyBirdPipeSeed: localStorage.getItem('flappyBirdPipeSeed')
        },
        recentTrainingData: {
            currentGameSamples: allBirds.reduce((sum, b) => sum + b.trainingData.length, 0),
            aggregatedSamples: allTrainingData.length,
            sampleBreakdown: allBirds.map(b => ({
                id: b.id,
                samples: b.trainingData.length,
                avgReward: b.trainingData.length > 0 ? 
                    (b.trainingData.reduce((s, d) => s + (d.reward || 0), 0) / b.trainingData.length).toFixed(3) : 0
            }))
        }
    };
    
    // Create downloadable JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flappy_bird_ai_export_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Also log to console for easy copy-paste
    console.log('📋 Export Data (also saved to file):');
    console.log(JSON.stringify(exportData, null, 2));
    console.log('✅ Data exported successfully!');
    
    alert(`Data exported successfully!\n\nFile: flappy_bird_ai_export_${Date.now()}.json\n\nAlso logged to console for easy sharing.`);
});

// Reset data function
resetDataButton.addEventListener('click', () => {
    if (!confirm('⚠️ WARNING: This will delete ALL saved AI progress!\n\nThis includes:\n- Neural network weights\n- Best score\n- Games played\n- Generation\n- All settings\n\nAre you sure you want to reset?')) {
        return;
    }
    
    console.log('🗑️ Resetting all AI data...');
    
    // Clear all localStorage items
    localStorage.removeItem('flappyBirdAIWeights');
    localStorage.removeItem('flappyBirdAIBest');
    localStorage.removeItem('flappyBirdAIGames');
    localStorage.removeItem('flappyBirdAIGeneration');
    localStorage.removeItem('flappyBirdInstanceCount');
    localStorage.removeItem('flappyBirdSpeedMultiplier');
    localStorage.removeItem('flappyBirdDeterministicPipes');
    localStorage.removeItem('flappyBirdPipeSeed');
    
    // Reset game variables
    bestScore = 0;
    gamesPlayed = 0;
    generation = 1;
    instanceCount = 1;
    speedMultiplier = 1;
    deterministicPipes = false;
    pipeSeed = 12345;
    
    // Reset neural network
    neuralNetwork = new NeuralNetwork(INPUT_NODES, 8, 1);
    neuralNetwork.learningRate = 0.05; // Reduced learning rate for stability
    
    // Update displays
    bestScoreDisplay.textContent = '0';
    gamesPlayedDisplay.textContent = '0';
    generationDisplay.textContent = '1';
    instanceCountInput.value = '1';
    speedMultiplierInput.value = '1';
    deterministicPipesInput.checked = false;
    pipeSeedInput.value = '12345';
    updateSeedInputVisibility();
    
    // Clear training data
    trainingData = [];
    allTrainingData = [];
    for (let bird of allBirds) {
        bird.trainingData = [];
    }
    
    console.log('✅ All data reset successfully!');
    alert('✅ All data has been reset!\n\nThe game will restart with a fresh neural network.');
    
    // Restart game if playing
    if (gameState === 'playing') {
        gameState = 'gameover';
        setTimeout(() => {
            startGame();
        }, 1000);
    }
});

// Simple multi-instance system: run multiple games in background
let backgroundInstances = [];
let instanceTrainingData = [];

function createBackgroundInstance(instanceId) {
    return {
        id: instanceId,
        bird: {
            x: 100,
            y: canvas.height / 2,
            width: 34,
            height: 24,
            velocity: -1,
            rotation: 0
        },
        pipes: [],
        score: 0,
        frameCount: 0,
        pipeSpawnTimer: 0,
        trainingData: [],
        lastState: null,
        lastAction: null,
        lastJumpFrame: 0,
        gameState: 'playing'
    };
}

function updateBackgroundInstance(instance) {
    if (instance.gameState !== 'playing') return;
    
    // Update bird
    const state = getGameStateForInstance(instance);
    const prediction = neuralNetwork.predict(state);
    const shouldJump = prediction[0] > 0.5 && instance.bird.y >= 30;
    
    // Jump cooldown
    if (shouldJump && instance.frameCount - instance.lastJumpFrame >= 10) {
        instance.bird.velocity = -6;
        instance.lastJumpFrame = instance.frameCount;
    }
    
    // Apply gravity
    instance.bird.velocity += 0.15;
    if (instance.bird.velocity > 4) instance.bird.velocity = 4;
    instance.bird.y += instance.bird.velocity;
    
    // Check boundaries
    if (instance.bird.y + instance.bird.height > ground.y || instance.bird.y < 0) {
        instance.gameState = 'gameover';
        return;
    }
    
    // Update pipes
    instance.pipeSpawnTimer++;
    if (instance.pipeSpawnTimer >= 100) {
        instance.pipeSpawnTimer = 0;
        const minHeight = 50;
        const maxHeight = canvas.height - ground.height - 160 - minHeight;
        const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
        instance.pipes.push({
            x: canvas.width,
            topHeight: topHeight,
            passed: false
        });
    }
    
    for (let i = instance.pipes.length - 1; i >= 0; i--) {
        const pipe = instance.pipes[i];
        pipe.x -= 2.5;
        
        if (pipe.x + 52 < 0) {
            instance.pipes.splice(i, 1);
            continue;
        }
        
        if (!pipe.passed && pipe.x + 52 < instance.bird.x) {
            pipe.passed = true;
            instance.score++;
        }
        
        // Check collision
        if (instance.bird.x + instance.bird.width > pipe.x && 
            instance.bird.x < pipe.x + 52) {
            if (instance.bird.y < pipe.topHeight || 
                instance.bird.y + instance.bird.height > pipe.topHeight + 160) {
                instance.gameState = 'gameover';
                return;
            }
        }
    }
    
    // Collect training data
    const reward = calculateImmediateRewardForInstance(instance);
    instance.trainingData.push({
        state: [...state],
        action: shouldJump ? 1 : 0,
        reward: reward
    });
    
    if (instance.trainingData.length > 100) {
        instance.trainingData.shift();
    }
    
    instance.frameCount++;
}

function getGameStateForInstance(instance) {
    let nextPipe = null;
    for (let pipe of instance.pipes) {
        if (pipe.x + 52 > instance.bird.x) {
            nextPipe = pipe;
            break;
        }
    }
    
    const birdY = instance.bird.y / canvas.height;
    const birdVel = (instance.bird.velocity + 4) / 8;
    
    // Add ground distance as input - CRITICAL for learning ground avoidance!
    const distanceToGround = ground.y - (instance.bird.y + instance.bird.height);
    const normalizedGroundDistance = Math.min(1, Math.max(0, distanceToGround / (canvas.height - ground.y)));
    
    let pipeX = 1;
    let gapCenter = 0.5;
    
    if (nextPipe) {
        const distance = nextPipe.x - (instance.bird.x + instance.bird.width);
        pipeX = Math.min(1, Math.max(0, distance / canvas.width));
        gapCenter = (nextPipe.topHeight + 160 / 2) / canvas.height;
    }
    
    const birdCenter = (instance.bird.y + instance.bird.height / 2) / canvas.height;
    const relativeToGap = birdCenter - gapCenter;
    
    // Return 6 inputs instead of 5 - now includes ground distance
    return [birdY, birdVel, pipeX, gapCenter, relativeToGap, normalizedGroundDistance];
}

function calculateImmediateRewardForInstance(instance) {
    let reward = 0;
    const b = instance.bird;
    
    // STRICT penalty for being at top
    if (b.y < 30) {
        reward -= (30 - b.y) / 30 * 0.5;
    }
    
    // STRONG penalty for being close to ground - GROUND KILLS YOU!
    const distanceToGround = ground.y - (b.y + b.height);
    if (distanceToGround < 150) {
        // Very close to ground - EXTREMELY strong penalty
        const dangerLevel = 1 - (distanceToGround / 150);
        reward -= dangerLevel * 3.0; // MUCH stronger penalty for being near ground
        
        // Extra penalty if falling fast near ground
        if (b.velocity > 1.5 && distanceToGround < 80) {
            reward -= 1.0; // Additional heavy penalty for diving into ground
        }
    }
    
    // Penalty for falling velocity when low to ground (encourage jumping)
    if (distanceToGround < 200 && b.velocity > 0) {
        reward -= (b.velocity / 4) * 0.5; // Stronger penalty for falling when low
    }
    
    let nextPipe = null;
    for (let pipe of instance.pipes) {
        if (pipe.x + 52 > b.x) {
            nextPipe = pipe;
            break;
        }
    }
    
    if (nextPipe) {
        const gapCenter = nextPipe.topHeight + 160 / 2;
        const birdCenter = b.y + b.height / 2;
        const distanceFromGap = Math.abs(birdCenter - gapCenter);
        const distanceToPipe = nextPipe.x - (b.x + b.width);
        const isAboveGap = birdCenter < gapCenter;
        const isBelowGap = birdCenter > gapCenter;
        
        // STRONG rewards for being aligned with gap - this is CRITICAL for success!
        // Apply rewards when approaching pipe (further away too, so AI can plan ahead)
        if (distanceToPipe < 300 && distanceToPipe > -100) {
            const maxGapDistance = 80; // pipeGap / 2
            const alignmentScore = 1 - (distanceFromGap / maxGapDistance);
            
            // Scale penalties/rewards based on distance to pipe
            // When pipe is far, be more lenient. When close, be strict.
            const proximityFactor = distanceToPipe > 200 ? 0.3 : (distanceToPipe > 100 ? 0.6 : 1.0);
            
            // PERFECT alignment - very strong reward
            if (distanceFromGap < maxGapDistance * 0.2) {
                reward += 1.5 * proximityFactor;
            } 
            // Good alignment
            else if (distanceFromGap < maxGapDistance * 0.4) {
                reward += 0.8 * proximityFactor;
            }
            // Decent alignment
            else if (distanceFromGap < maxGapDistance * 0.6) {
                reward += 0.3 * proximityFactor;
            }
            // Poor alignment - penalty scaled by distance
            else {
                // Only penalize if reasonably close to pipe
                if (distanceToPipe < 200) {
                    const misalignment = (distanceFromGap - maxGapDistance * 0.6) / (maxGapDistance * 0.4);
                    // Scale penalty: less when far, more when close
                    const penaltyScale = distanceToPipe > 150 ? 0.3 : (distanceToPipe > 100 ? 0.6 : 1.0);
                    reward -= misalignment * 1.5 * penaltyScale;
                } else {
                    // Pipe is far away - give small reward for moving toward gap
                    if (isAboveGap && b.velocity >= 0) {
                        reward += 0.1; // Small reward for moving toward gap
                    } else if (isBelowGap && b.velocity <= 0) {
                        reward += 0.1; // Small reward for moving toward gap
                    }
                }
            }
            
            // Directional guidance: reward actions that move bird TOWARD gap center
            if (distanceToPipe < 250 && distanceToPipe > 0) {
                if (isAboveGap && b.velocity >= 0) {
                    // Above gap and falling/stable - good, moving toward gap
                    reward += 0.2 * proximityFactor;
                } else if (isAboveGap && b.velocity < -2) {
                    // Above gap but rising fast - bad, moving away from gap
                    reward -= 0.3 * proximityFactor;
                }
                
                if (isBelowGap && b.velocity <= 0) {
                    // Below gap and rising/stable - good, moving toward gap
                    // STRONGER reward if way below gap - bird needs to jump UP!
                    const distanceBelow = birdCenter - gapCenter;
                    if (distanceBelow > 100) {
                        // Way below - STRONG reward for rising/jumping
                        reward += 0.5 * proximityFactor;
                    } else {
                        reward += 0.2 * proximityFactor;
                    }
                } else if (isBelowGap && b.velocity > 2) {
                    // Below gap but falling fast - bad, moving away from gap
                    // Extra penalty if way below - bird is going the wrong way!
                    const distanceBelow = birdCenter - gapCenter;
                    if (distanceBelow > 100) {
                        reward -= 0.6 * proximityFactor; // Stronger penalty
                    } else {
                        reward -= 0.3 * proximityFactor;
                    }
                }
            }
            
            // CRITICAL: If bird is way below gap and pipe is approaching, STRONG reward for jumping
            if (isBelowGap && distanceToPipe < 200 && distanceToPipe > 50) {
                const distanceBelow = birdCenter - gapCenter;
                if (distanceBelow > 80 && b.velocity <= 0) {
                    // Way below gap and rising - this is what we want!
                    reward += 0.3 * proximityFactor;
                } else if (distanceBelow > 80 && b.velocity > 0) {
                    // Way below gap but falling - STRONG penalty
                    reward -= 0.5 * proximityFactor;
                }
            }
            
            // Extra strong penalty if way off target (will definitely hit pipe)
            if (distanceFromGap > maxGapDistance * 0.8 && distanceToPipe < 100 && distanceToPipe > -50) {
                reward -= 2.0; // Very strong penalty - will crash!
            }
        }
    }
    
    return reward;
}

function runBackgroundInstances() {
    // Update background instances
    for (let instance of backgroundInstances) {
        if (instance.gameState === 'playing') {
            for (let i = 0; i < speedMultiplier; i++) {
                updateBackgroundInstance(instance);
                if (instance.gameState === 'gameover') break;
            }
        } else {
            // Game over - collect training data and restart
            allTrainingData.push(...instance.trainingData);
            gamesPlayed++;
            
            if (instance.score > bestScore) {
                bestScore = instance.score;
                localStorage.setItem('flappyBirdAIBest', bestScore);
            }
            
            // Reset instance
            instance.bird.y = canvas.height / 2;
            instance.bird.velocity = -1;
            instance.pipes = [];
            instance.score = 0;
            instance.frameCount = 0;
            instance.pipeSpawnTimer = 0;
            instance.trainingData = [];
            instance.lastState = null;
            instance.lastAction = null;
            instance.lastJumpFrame = 0;
            instance.gameState = 'playing';
        }
    }
    
    // Learn from aggregated training data periodically
    if (allTrainingData.length > 500) {
        learnFromAggregatedData();
        allTrainingData = [];
    }
    
    // Update active instances display
    activeInstancesDisplay.textContent = backgroundInstances.length;
}

function learnFromAggregatedData() {
    if (allTrainingData.length === 0) return;
    
    console.log(`📚 Learning from ${allTrainingData.length} aggregated samples`);
    
    // Analyze reward distribution
    const rewards = allTrainingData.map(d => d.reward || 0);
    const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const maxReward = Math.max(...rewards);
    const minReward = Math.min(...rewards);
    const positiveCount = rewards.filter(r => r > 0).length;
    const negativeCount = rewards.filter(r => r < 0).length;
    
    console.log(`📈 Reward Stats: avg=${avgReward.toFixed(3)}, max=${maxReward.toFixed(3)}, min=${minReward.toFixed(3)}, pos=${positiveCount}, neg=${negativeCount}`);
    
    // Separate samples by reward type for better learning
    const perfectAlignmentSamples = [];
    const goodAlignmentSamples = [];
    const misalignedSamples = [];
    let trainingCount = 0;
    
    for (let data of allTrainingData) {
        const immediateReward = data.reward || 0;
        let target;
        
        if (immediateReward > 0) {
            target = data.action === 1 ? (0.5 + immediateReward * 0.4) : (0.5 - immediateReward * 0.4);
            target = Math.max(0.1, Math.min(0.9, target));
            
            // Track samples with strong gap alignment rewards
            if (immediateReward > 1.0) {
                perfectAlignmentSamples.push(data);
            } else if (immediateReward > 0.5) {
                goodAlignmentSamples.push(data);
            }
        } else if (immediateReward < 0) {
            target = data.action === 1 ? (0.5 + immediateReward * 0.5) : (0.5 - immediateReward * 0.5);
            target = Math.max(0.05, Math.min(0.95, target));
            
            // Track misaligned samples (strong negative rewards)
            if (immediateReward < -1.0) {
                misalignedSamples.push(data);
            }
        } else {
            target = data.action === 1 ? 0.5 : 0.5;
        }
        
        neuralNetwork.train(data.state, [target]);
        trainingCount++;
    }
    
    console.log(`🎓 Trained ${trainingCount} times on ${allTrainingData.length} samples`);
    
    // EXTRA training on gap alignment samples - this is critical!
    if (perfectAlignmentSamples.length > 0) {
        console.log(`🎯 Extra training on ${perfectAlignmentSamples.length} perfect gap alignment samples (reward > 1.0)`);
        for (let data of perfectAlignmentSamples) {
            // Train multiple times on perfect alignment - this is the key to success!
            const target = data.action === 1 ? 0.9 : 0.1; // Strong target for perfect alignment
            for (let i = 0; i < 3; i++) {
                neuralNetwork.train(data.state, [target]);
            }
        }
        console.log(`   → Added ${perfectAlignmentSamples.length * 3} extra training iterations`);
    }
    
    if (goodAlignmentSamples.length > 0) {
        console.log(`✅ Extra training on ${goodAlignmentSamples.length} good gap alignment samples (reward > 0.5)`);
        for (let data of goodAlignmentSamples) {
            const target = data.action === 1 ? 0.75 : 0.25;
            neuralNetwork.train(data.state, [target]);
        }
        console.log(`   → Added ${goodAlignmentSamples.length} extra training iterations`);
    }
    
    if (misalignedSamples.length > 0) {
        console.log(`❌ Extra training on ${misalignedSamples.length} misaligned samples (reward < -1.0)`);
        for (let data of misalignedSamples) {
            // Strongly penalize misalignment - reverse the action
            const target = data.action === 1 ? 0.1 : 0.9;
            for (let i = 0; i < 2; i++) {
                neuralNetwork.train(data.state, [target]);
            }
        }
        console.log(`   → Added ${misalignedSamples.length * 2} extra training iterations`);
    }
    
    console.log(`📊 Total training: ${trainingCount + (perfectAlignmentSamples.length * 3) + goodAlignmentSamples.length + (misalignedSamples.length * 2)} iterations`);
}

// Initialize
drawBackground();
drawGround();
drawBird();

// Auto-start the game after 1 second
setTimeout(() => {
    if (gameState === 'start') {
        startGame();
    }
}, 1000);

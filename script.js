const gameBoard = document.getElementById('game-board');
const gameStatus = document.getElementById('game-status');
const levelIndicator = document.getElementById('level-indicator');

// Menu Elements
const mainMenu = document.getElementById('main-menu');
const gameContainer = document.getElementById('game-container');
const campaignBtn = document.getElementById('campaign-btn');
const freePlayBtn = document.getElementById('free-play-btn');
const difficultySelect = document.getElementById('difficulty-select');
const backMenuBtn = document.getElementById('back-menu-btn');
const micBtn = document.getElementById('mic-btn');
const themeBtn = document.getElementById('theme-btn');
const menuThemeBtn = document.getElementById('menu-theme-btn');

// Game State
let gameMode = 'campaign'; // 'campaign' or 'free'
let currentLevelSize = 5;
let maze = [];
let playerPos = { x: 1, y: 1 };
let goalPos = { x: 1, y: 1 };
let isGameActive = false;
let audioCtx;
let flaggedCells = new Set(); // Manual Flags
let flagsRemaining = 0;
let helpUsesRemaining = 3; // Panic Mode

// Ambient Music State
let musicNodes = [];
let musicGainNode = null;
let isMusicOn = true;

// Theme State
let currentThemeIndex = 0;
const themes = ['', 'theme-high-contrast', 'theme-paper'];
const themeNames = ['Normal', 'Alto Contraste', 'Papel'];

// Timer & Score State
let startTime;
let timerInterval;
let isTimerRunning = false;
const timerDisplay = document.getElementById('timer-display');
const bestTimeDisplay = document.getElementById('best-time-display');

// --- Audio System ---

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function startAmbientMusic() {
    if (!audioCtx || !isMusicOn) return;
    
    // Stop any existing music first
    stopAmbientMusic();

    musicGainNode = audioCtx.createGain();
    musicGainNode.gain.value = 0.1; // Low volume
    
    // Low Pass Filter for "Underwater/Chill" effect
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200; // Cutoff at 200Hz

    musicGainNode.connect(filter);
    filter.connect(audioCtx.destination);

    // Chord: C Major 7th (Low Octave)
    // C2 (65.41), E2 (82.41), G2 (98.00), B2 (123.47)
    const freqs = [65.41, 82.41, 98.00, 123.47];
    
    freqs.forEach(freq => {
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle'; // Soft tone
        osc.frequency.value = freq;
        osc.connect(musicGainNode);
        osc.start();
        musicNodes.push(osc);
    });
}

function stopAmbientMusic() {
    musicNodes.forEach(node => {
        try {
            node.stop();
            node.disconnect();
        } catch(e) {}
    });
    musicNodes = [];
    if (musicGainNode) {
        musicGainNode.disconnect();
        musicGainNode = null;
    }
}

function toggleMusic() {
    isMusicOn = !isMusicOn;
    const btn = document.getElementById('music-btn');
    if (btn) btn.textContent = isMusicOn ? "Música: ON" : "Música: OFF";
    
    if (isMusicOn && isGameActive) {
        startAmbientMusic();
    } else {
        stopAmbientMusic();
    }
}

function toggleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.className = themes[currentThemeIndex];
    const label = `Tema: ${themeNames[currentThemeIndex]}`;
    if (themeBtn) themeBtn.textContent = label;
    if (menuThemeBtn) menuThemeBtn.textContent = label;
}

function launchConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        
        // Random Properties
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 2 + 1) + 's'; // 1-3s
        
        document.body.appendChild(confetti);
        
        // Cleanup
        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

function calculateStereoPan(playerX, goalX, mapWidth) {
    // Returns value between -1 (Left) and 1 (Right)
    // If goal is to the right of player, pan > 0
    const diff = goalX - playerX;
    // Normalize somewhat based on map width
    let pan = diff / (mapWidth / 2);
    // Clamp
    if (pan > 1) pan = 1;
    if (pan < -1) pan = -1;
    return pan;
}

function playSound(type, frequencyOverride = null, panValue = 0) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const panner = audioCtx.createStereoPanner();

    // Chain: Oscillator -> Gain -> Panner -> Destination
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(audioCtx.destination);

    // Set Panning (Default to passed value, override for wall)
    if (type === 'wall') {
        panner.pan.value = 0; // Force Center for Wall Hit
    } else {
        panner.pan.value = panValue;
    }

    const now = audioCtx.currentTime;

    // --- Haptic Feedback (Vibration) ---
    if (navigator.vibrate) {
        if (type === 'wall') {
            navigator.vibrate(200); // Strong vibration for collision
        } else if (type === 'flag-plant') {
            navigator.vibrate(50); // Short tick
        } else if (type === 'win') {
            navigator.vibrate([100, 50, 100, 50, 200]); // Victory pattern
        }
    }

    if (type === 'step') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequencyOverride || 300, now);
        gainNode.gain.setValueAtTime(0.1, now);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'wall') {
        // Low Thud (Triangle, 60Hz -> 40Hz) - BOOSTED VOLUME
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(60, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        
        gainNode.gain.setValueAtTime(2.0, now); // Super Loud (Boosted)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } else if (type === 'flag-plant') {
        // High tick sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'flag-found') {
        // Soft chime
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
    } else if (type === 'win') {
        playNote(523.25, now, 0.1); // C5
        playNote(659.25, now + 0.1, 0.1); // E5
        playNote(783.99, now + 0.2, 0.2); // G5
        playNote(1046.50, now + 0.4, 0.4); // C6
    } else if (type === 'ping') {
        // Clear Ping for Panic Mode
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now); // A5
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
    }
}

function playNote(freq, startTime, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.volume = 1.0;
        utterance.rate = 1.2;
        
        // Audio Ducking Logic
        utterance.onstart = () => {
            if (musicGainNode && audioCtx) {
                musicGainNode.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.1);
            }
        };
        
        utterance.onend = () => {
            if (musicGainNode && audioCtx && isMusicOn) {
                musicGainNode.gain.setTargetAtTime(0.1, audioCtx.currentTime, 0.1);
            }
        };

        window.speechSynthesis.speak(utterance);
    }
}

// --- Maze Generation (Recursive Backtracker + Braiding) ---

function generateMaze(size) {
    // Adjust size to be odd
    const actualSize = size % 2 === 0 ? size + 1 : size;
    
    const newMaze = Array(actualSize).fill().map(() => Array(actualSize).fill(1));
    
    const stack = [];
    
    // Random Start Position for Generation (can be anywhere, but let's stick to 1,1 for the algorithm base)
    const genStartX = 1;
    const genStartY = 1;
    
    newMaze[genStartY][genStartX] = 0;
    stack.push({x: genStartX, y: genStartY});
    
    // 1. Recursive Backtracker (Base Tree)
    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = getUnvisitedNeighbors(current.x, current.y, newMaze, actualSize);
        
        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            newMaze[(current.y + next.y) / 2][(current.x + next.x) / 2] = 0;
            newMaze[next.y][next.x] = 0;
            stack.push(next);
        } else {
            stack.pop();
        }
    }
    
    // 2. Braiding (Remove random walls to create loops)
    braidMaze(newMaze, actualSize);

    // --- 3. Diagonal Opposition Logic ---
    
    // Define 4 Corners (approximate regions)
    const corners = [
        { name: 'Top-Left', xRange: [1, Math.floor(actualSize/3)], yRange: [1, Math.floor(actualSize/3)] },
        { name: 'Top-Right', xRange: [Math.floor(actualSize*2/3), actualSize-2], yRange: [1, Math.floor(actualSize/3)] },
        { name: 'Bottom-Left', xRange: [1, Math.floor(actualSize/3)], yRange: [Math.floor(actualSize*2/3), actualSize-2] },
        { name: 'Bottom-Right', xRange: [Math.floor(actualSize*2/3), actualSize-2], yRange: [Math.floor(actualSize*2/3), actualSize-2] }
    ];

    // Pick Random Start Corner
    const startCornerIndex = Math.floor(Math.random() * 4);
    const startCorner = corners[startCornerIndex];

    // Pick Opposite Goal Corner
    // 0 (TL) <-> 3 (BR)
    // 1 (TR) <-> 2 (BL)
    let goalCornerIndex;
    if (startCornerIndex === 0) goalCornerIndex = 3;
    else if (startCornerIndex === 1) goalCornerIndex = 2;
    else if (startCornerIndex === 2) goalCornerIndex = 1;
    else if (startCornerIndex === 3) goalCornerIndex = 0;
    
    const goalCorner = corners[goalCornerIndex];

    // Find valid cells in these sectors
    const startCell = findFirstValidCellInRegion(newMaze, startCorner.xRange, startCorner.yRange);
    const goalCell = findFirstValidCellInRegion(newMaze, goalCorner.xRange, goalCorner.yRange);

    // Fallback if regions are too tight (shouldn't happen with braiding, but safety first)
    if (!startCell) {
        playerPos = { x: 1, y: 1 };
    } else {
        playerPos = startCell;
    }

    if (!goalCell) {
        // Fallback scan
        goalPos = { x: actualSize - 2, y: actualSize - 2 };
    } else {
        goalPos = goalCell;
    }

    // Mark on Maze
    newMaze[playerPos.y][playerPos.x] = 2;
    newMaze[goalPos.y][goalPos.x] = 3;
    
    return newMaze;
}

function findFirstValidCellInRegion(grid, xRange, yRange) {
    // Scan the region for the first 0 (path)
    // We randomize the scan order slightly to avoid always picking the top-left-most pixel of the region
    const candidates = [];
    for (let y = yRange[0]; y <= yRange[1]; y++) {
        for (let x = xRange[0]; x <= xRange[1]; x++) {
            if (grid[y] && grid[y][x] === 0) {
                candidates.push({x, y});
            }
        }
    }
    if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return null;
}

function getUnvisitedNeighbors(x, y, grid, size) {
    const neighbors = [];
    const directions = [
        { dx: 0, dy: -2 }, { dx: 0, dy: 2 },
        { dx: -2, dy: 0 }, { dx: 2, dy: 0 }
    ];
    
    for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && grid[ny][nx] === 1) {
            neighbors.push({ x: nx, y: ny });
        }
    }
    return neighbors;
}

function braidMaze(grid, size) {
    for (let y = 2; y < size - 2; y++) {
        for (let x = 2; x < size - 2; x++) {
            if (grid[y][x] === 1) {
                if (grid[y][x-1] === 0 && grid[y][x+1] === 0) {
                    if (Math.random() < 0.1) grid[y][x] = 0;
                }
                else if (grid[y-1][x] === 0 && grid[y+1][x] === 0) {
                    if (Math.random() < 0.1) grid[y][x] = 0;
                }
            }
        }
    }
}

// --- Pathfinding (BFS) ---

function calculatePathDistance(startX, startY, targetX, targetY) {
    const queue = [{ x: startX, y: startY, steps: 0 }];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    while (queue.length > 0) {
        const { x, y, steps } = queue.shift();

        if (x === targetX && y === targetY) {
            return steps;
        }

        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newY >= 0 && newY < maze.length && newX >= 0 && newX < maze[0].length) {
                const cell = maze[newY][newX];
                if (cell !== 1 && !visited.has(`${newX},${newY}`)) {
                    visited.add(`${newX},${newY}`);
                    queue.push({ x: newX, y: newY, steps: steps + 1 });
                }
            }
        }
    }
    return 999;
}

// --- Game Logic & View Management ---

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    startTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.textContent = formatTime(elapsed);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function getHighScore(size) {
    return localStorage.getItem(`echoWalker_record_${size}`);
}

function saveHighScore(size, time) {
    const currentRecord = getHighScore(size);
    if (!currentRecord || time < parseInt(currentRecord)) {
        localStorage.setItem(`echoWalker_record_${size}`, time);
        return true;
    }
    return false;
}

function updateBestTimeDisplay() {
    const record = getHighScore(currentLevelSize);
    if (record) {
        bestTimeDisplay.textContent = `Mejor: ${formatTime(record)}`;
    } else {
        bestTimeDisplay.textContent = `Mejor: --:--`;
    }
}

function showMenu() {
    mainMenu.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    isGameActive = false;
    stopAmbientMusic(); // Stop music in menu
    mainMenu.focus();
}

function showGame() {
    mainMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    initAudio();
    startGame();
}

function startCampaign() {
    gameMode = 'campaign';
    currentLevelSize = 5;
    showGame();
}

function startFreePlay() {
    gameMode = 'free';
    currentLevelSize = parseInt(difficultySelect.value);
    showGame();
}

function getAmmoForSize(size) {
    if (size <= 5) return 10;
    if (size <= 7) return 7;
    if (size <= 10) return 5;
    if (size <= 15) return 3;
    return 1;
}

function startGame() {
    levelIndicator.textContent = gameMode === 'campaign' 
        ? `Modo Campaña - Tamaño: ${currentLevelSize}x${currentLevelSize}`
        : `Modo Libre - Tamaño: ${currentLevelSize}x${currentLevelSize}`;
    
    // Generate Maze AND Set Positions (playerPos, goalPos)
    helpUsesRemaining = 3; // Reset Panic Mode
    maze = generateMaze(currentLevelSize);
    
    // Note: playerPos is now set inside generateMaze, so we do NOT reset it here.
    isGameActive = true;
    
    // Reset Flags
    flaggedCells.clear();
    flagsRemaining = getAmmoForSize(currentLevelSize);

    // Timer Reset
    stopTimer();
    timerDisplay.textContent = "00:00";
    updateBestTimeDisplay();
    
    renderMaze();
    
    // --- AQUÍ ESTÁ EL CAMBIO PARA LAS INSTRUCCIONES ---
    
    const introMsg = `Nivel ${currentLevelSize}. Tienes ${flagsRemaining} Banderas.`;
    const instructionsMsg = "Usa Espacio para poner bandera. Presiona F para saber cuántas te quedan.";
    
    // Combinamos todo en un solo mensaje para asegurar que se lea completo
    const fullAudioMessage = `${introMsg} ${instructionsMsg} ¡Buena suerte!`;

    // Visualmente solo mostramos lo básico para no saturar la pantalla
    announceStatus(introMsg); 
    
    // Auditivamente decimos todo
    speak(fullAudioMessage);
    
    // Start Ambient Music
    if (isMusicOn) {
        startAmbientMusic();
    }
    
    // Aseguramos que el teclado funcione inmediatamente
    gameBoard.focus();
}

function nextLevel() {
    if (gameMode === 'campaign') {
        currentLevelSize += 2; // Increase difficulty
        if (currentLevelSize > 25) currentLevelSize = 25; // Cap at 25
    }
    startGame();
}

function renderMaze() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${maze[0].length}, 1fr)`;

    for(let y = 0; y < maze.length; y++) {
        for(let x = 0; x < maze[y].length; x++) {
            const cellValue = maze[y][x];
            const cell = document.createElement('div');
            cell.classList.add('cell');
            
            // Flag Visuals
            if (flaggedCells.has(`${x},${y}`)) {
                cell.classList.add('flag');
            }

            if (cellValue === 1) {
                cell.classList.add('wall');
            } else if (cellValue === 2) {
                cell.classList.add('player');
                cell.setAttribute('aria-label', 'Jugador');
                cell.setAttribute('aria-current', 'location'); // ARIA Update for Screen Readers
            } else if (cellValue === 3) {
                cell.classList.add('goal');
                cell.setAttribute('aria-label', 'Meta');
            }
            
            gameBoard.appendChild(cell);
        }
    }
}

function getDirectionName(dx, dy) {
    if (dy === -1) return "Norte";
    if (dy === 1) return "Sur";
    if (dx === -1) return "Oeste";
    if (dx === 1) return "Este";
    return "";
}

function getTemperaturePhrase(steps) {
    const size = maze.length;
    if (steps <= 2) return "Muy Caliente";
    if (steps <= size * 0.5) return "Caliente";
    if (steps <= size * 1.0) return "Tibio";
    if (steps <= size * 1.5) return "Frío";
    return "Muy Frío";
}

function movePlayer(dx, dy) {
    if (!isGameActive) return;

    // Start timer on first move
    if (!isTimerRunning) startTimer();

    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;
    const direction = getDirectionName(dx, dy);

    // Calculate Pan for Wall Hit (based on current position)
    const pan = calculateStereoPan(playerPos.x, goalPos.x, maze[0].length);

    if (newY < 0 || newY >= maze.length || newX < 0 || newX >= maze[0].length) {
        triggerVibration(200);
        // NO VOICE for wall
        return;
    }

    const targetCell = maze[newY][newX];

    if (targetCell === 1) {
        playSound('wall', null, pan);
        triggerVibration(200);
        // NO VOICE for wall
    } else if (targetCell === 0 || targetCell === 3) {
        const oldDistance = calculatePathDistance(playerPos.x, playerPos.y, goalPos.x, goalPos.y);
        
        const isFlagged = flaggedCells.has(`${newX},${newY}`);

        maze[playerPos.y][playerPos.x] = 0;
        playerPos = { x: newX, y: newY };
        
        if (targetCell === 3) {
            // Win Condition
            stopTimer();
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const isNewRecord = saveHighScore(currentLevelSize, elapsedSeconds);
            
            triggerVibration([100, 50, 100, 50, 400]);
            maze[newY][newX] = 2;
            renderMaze();
            playSound('win');
            launchConfetti();
            
            let winMsg = `¡Victoria! Tiempo total: ${elapsedSeconds} segundos.`;
            if (isNewRecord) winMsg += " ¡Nuevo récord!";
            
            if (gameMode === 'campaign') {
                winMsg += " Pasando al siguiente nivel.";
            } else {
                winMsg += " Generando nuevo laberinto.";
            }
            
            speak(winMsg);
            announceStatus(winMsg);
            
            isGameActive = false;
            setTimeout(nextLevel, 4000);
        } else {
            maze[newY][newX] = 2;
            renderMaze();
            
            // Calculate Stereo Pan for new position
            const newPan = calculateStereoPan(playerPos.x, goalPos.x, maze[0].length);

            if (isFlagged) {
                playSound('flag-found', null, newPan);
                triggerVibration([50, 50, 50]);
                announceStatus(`Aquí hay una bandera.`);
                speak("Bandera aquí");
            } else {
                // Standard Feedback
                const newDistance = calculatePathDistance(playerPos.x, playerPos.y, goalPos.x, goalPos.y);
                const temperaturePhrase = getTemperaturePhrase(newDistance);
                
                let stepFreq = 300;
                if (newDistance < oldDistance) {
                    stepFreq = 400; 
                } else if (newDistance > oldDistance) {
                    stepFreq = 250; 
                }

                playSound('step', stepFreq, newPan);
                announceStatus(`Paso al ${direction}. ${temperaturePhrase}.`); 
                speak(temperaturePhrase);
            }
        }
    }
}

function placeFlag() {
    if (!isGameActive) return;
    
    const key = `${playerPos.x},${playerPos.y}`;
    
    if (flaggedCells.has(key)) {
        speak("Ya hay una bandera aquí.");
        return;
    }
    
    if (flagsRemaining > 0) {
        flagsRemaining--;
        flaggedCells.add(key);
        renderMaze();
        playSound('flag-plant');
        const msg = `Bandera puesta. Quedan ${flagsRemaining}.`;
        announceStatus(msg);
        speak(msg);
    } else {
        speak("Sin banderas.");
    }
}

function checkFlags() {
    if (!isGameActive) return;
    
    const msg = `Te quedan ${flagsRemaining} banderas.`;
    announceStatus(msg);
    speak(msg);
}

function triggerVibration(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

function usePanicMode() {
    if (!isGameActive) return;
    
    if (helpUsesRemaining > 0) {
        helpUsesRemaining--;
        
        // Calculate direction
        const dx = goalPos.x - playerPos.x;
        const dy = goalPos.y - playerPos.y;
        let directionText = "";
        
        if (Math.abs(dx) > Math.abs(dy)) {
            directionText = dx > 0 ? "Este" : "Oeste";
        } else {
            directionText = dy > 0 ? "Sur" : "Norte";
        }
        
        const pan = calculateStereoPan(playerPos.x, goalPos.x, maze[0].length);
        playSound('ping', null, pan);
        
        const msg = `La meta está hacia el ${directionText}. Quedan ${helpUsesRemaining} ayudas.`;
        announceStatus(msg);
        speak(msg);
    } else {
        speak("Sin ayudas.");
    }
}

function announceStatus(message) {
    gameStatus.textContent = message;
}

// --- Voice Control (Web Speech API) ---

let recognition;
let isListening = false;

function initVoiceControl() {
    if (window.location.protocol === 'file:') {
        console.warn("ADVERTENCIA: La API de voz puede no funcionar en archivos locales (file://).");
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micBtn.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const command = lastResult[0].transcript.trim().toLowerCase();
        console.log("Voice Command Received:", command);
        processVoiceCommand(command);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isListening = false;
            updateMicButtonUI();
            speak("Error de micrófono.");
        }
    };

    recognition.onend = () => {
        if (isListening) {
            try {
                recognition.start();
            } catch (e) {
                isListening = false;
                updateMicButtonUI();
            }
        } else {
            updateMicButtonUI();
        }
    };
}

function updateMicButtonUI() {
    if (isListening) {
        micBtn.textContent = "Escuchando...";
        micBtn.setAttribute('aria-pressed', 'true');
        micBtn.style.backgroundColor = "#cc0000"; 
    } else {
        micBtn.textContent = "Activar Voz";
        micBtn.setAttribute('aria-pressed', 'false');
        micBtn.style.backgroundColor = ""; 
    }
}

function toggleVoiceControl() {
    if (!recognition) initVoiceControl();
    
    if (!recognition) {
        alert("Tu navegador no soporta la API de reconocimiento de voz.");
        return;
    }

    if (isListening) {
        isListening = false;
        recognition.stop();
        speak("Control por voz desactivado.");
    } else {
        try {
            recognition.start();
            isListening = true;
            speak("Control por voz activado.");
        } catch (e) {
            isListening = false;
            speak("Error al iniciar voz.");
        }
    }
    updateMicButtonUI();
}

function processVoiceCommand(command) {
    if (!isGameActive) return;

    const normalized = command.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes('arriba') || normalized.includes('norte')) {
        movePlayer(0, -1);
    } else if (normalized.includes('abajo') || normalized.includes('sur')) {
        movePlayer(0, 1);
    } else if (normalized.includes('izquierda') || normalized.includes('oeste')) {
        movePlayer(-1, 0);
    } else if (normalized.includes('derecha') || normalized.includes('este')) {
        movePlayer(1, 0);
    } else if (normalized.includes('bandera') || normalized.includes('poner')) {
        placeFlag();
    } else if (normalized.includes('cuantas') || normalized.includes('quedan')) {
        checkFlags();
    } else if (normalized.includes('ayuda') || normalized.includes('pista') || normalized.includes('meta')) {
        usePanicMode();
    }
}

// --- Touch Control System ---
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 20; // px

function handleTouchStart(e) {
    if (!isGameActive) return;
    
    // If touching a button, let the browser handle the click and DO NOT track swipe
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
    }
    
    // Block default scrolling/zooming for game area touches
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const touch = e.changedTouches[0];
    touchStartX = touch.screenX;
    touchStartY = touch.screenY;
}

function handleTouchEnd(e) {
    if (!isGameActive) return;
    
    // If touching a button, ignore game logic (let click handler work)
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
    }
    
    if (e.cancelable) {
        e.preventDefault();
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.screenX - touchStartX;
    const deltaY = touch.screenY - touchStartY;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 1. Check for Swipe (Movement)
    if (Math.max(absX, absY) > SWIPE_THRESHOLD) {
        if (absX > absY) {
            // Horizontal
            movePlayer(deltaX > 0 ? 1 : -1, 0);
        } else {
            // Vertical
            movePlayer(0, deltaY > 0 ? 1 : -1);
        }
    } else {
        // 2. It's a Tap (No movement) -> Place Flag
        // User requested: "Aplastes una vez para poner una bandera"
        placeFlag();
    }
}

// --- Shake Detection (Panic Mode) ---
let lastX, lastY, lastZ;
let lastShakeTime = 0;
const SHAKE_THRESHOLD = 15; // Sensitivity

function handleShake(e) {
    if (!isGameActive) return;

    const current = e.accelerationIncludingGravity;
    if (!current) return;

    const currentTime = new Date().getTime();
    if ((currentTime - lastShakeTime) > 100) {
        const diffTime = currentTime - lastShakeTime;
        lastShakeTime = currentTime;

        if (lastX === undefined) {
            lastX = current.x;
            lastY = current.y;
            lastZ = current.z;
            return;
        }

        const deltaX = Math.abs(lastX - current.x);
        const deltaY = Math.abs(lastY - current.y);
        const deltaZ = Math.abs(lastZ - current.z);

        if ((deltaX > SHAKE_THRESHOLD && deltaY > SHAKE_THRESHOLD) || 
            (deltaX > SHAKE_THRESHOLD && deltaZ > SHAKE_THRESHOLD) || 
            (deltaY > SHAKE_THRESHOLD && deltaZ > SHAKE_THRESHOLD)) {
            
            // Shake detected!
            usePanicMode();
            // Vibrate to confirm shake detection
            if (navigator.vibrate) navigator.vibrate(200);
        }

        lastX = current.x;
        lastY = current.y;
        lastZ = current.z;
    }
}

// Add Touch Listeners
document.addEventListener('touchstart', handleTouchStart, {passive: false});
document.addEventListener('touchend', handleTouchEnd, {passive: false});
// Add Shake Listener
if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', handleShake, false);
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (!isGameActive) return;

    switch(e.key) {
        case 'ArrowUp':
            e.preventDefault();
            movePlayer(0, -1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            movePlayer(0, 1);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            movePlayer(-1, 0);
            break;
        case 'ArrowRight':
            e.preventDefault();
            movePlayer(1, 0);
            break;
        case ' ': // Spacebar
            e.preventDefault();
            placeFlag();
            break;
        case 'f':
        case 'F':
            e.preventDefault();
            checkFlags();
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            toggleMusic();
            break;
        case 'h':
        case 'H':
            e.preventDefault();
            usePanicMode();
            break;
    }
});

campaignBtn.addEventListener('click', startCampaign);
freePlayBtn.addEventListener('click', startFreePlay);
backMenuBtn.addEventListener('click', showMenu);
micBtn.addEventListener('click', toggleVoiceControl);
document.getElementById('music-btn').addEventListener('click', toggleMusic);
menuThemeBtn.addEventListener('click', toggleTheme);
themeBtn.addEventListener('click', toggleTheme);
document.getElementById('mobile-help-btn').addEventListener('click', (e) => {
    e.preventDefault();
    usePanicMode();
});

// Unlock Vibration API on first interaction
function unlockVibration() {
    if (navigator.vibrate) {
        try { navigator.vibrate(1); } catch(e) {}
    }
}
campaignBtn.addEventListener('click', unlockVibration);
freePlayBtn.addEventListener('click', unlockVibration);

initVoiceControl();

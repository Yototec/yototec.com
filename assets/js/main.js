const canvas = document.getElementById('officeCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 30;
const COLS = Math.floor(canvas.width / GRID_SIZE);
const ROWS = Math.floor(canvas.height / GRID_SIZE);
const ANIMATION_SPEED = 500;
const REASONING_DISPLAY_TIME = 5000;

const CHAIN_LENGTH_API = "https://api.sentichain.com/blockchain/get_chain_length?network=mainnet";
const REASONING_API_BASE = "https://api.sentichain.com/agent/get_reasoning_match_chunk_end?summary_type=observation_public&user_chunk_end=";

const OBJECTS = {
    EMPTY: 0,
    WALL: 1,
    CHAIR: 2,
    DESK: 3,
    COMPUTER: 4,
    COFFEE: 5,
    PLANT: 6,
    CARPET: 7,
    WINDOW: 8,
    BALCONY: 9,
    BALCONY_RAIL: 10,
    TABLE: 11
};

const COLORS = {
    floor: '#ffffff',
    carpet: '#f8f8f8',
    wall: '#cccccc',
    desk: '#8B4513',
    table: '#6d4c41',
    computer: '#333333',
    screen: '#87CEEB',
    chair: '#4a4a4a',
    skin: '#FFD700',
    body: '#2c3e50',
    btcUniform: '#F7931A',
    ethUniform: '#627EEA',
    solUniform: '#00FFA3',
    dogeUniform: '#C3A634',
    window: '#add8e6',
    sky: '#87CEEB',
    cloud: '#ffffff'
};

// OBJECTS constant has been moved to office.js

let apiConnected = false;
let chainLength = 0;
let lastFetchTime = 0;
let currentFetchingTicker = null;
let fetchQueue = [];
let reasoningData = {
    btc: null,
    eth: null,
    sol: null,
    doge: null
};

const DEBUG = true;
function debugLog(message) {
    if (DEBUG) {
        console.log(message);
        const debugDiv = document.getElementById('debug-info');
        if (debugDiv) {
            debugDiv.textContent = message;
            setTimeout(() => {
                debugDiv.textContent = '';
            }, 5000);
        }
    }
}

let office = [];
let people = [];
let animationTimer;
let apiPollTimer;
let taskScheduleTimer;
let taskInterval = 10000;
let isTaskInProgress = false;

function updateCanvasSize() {
    const gridWidthPx = COLS * GRID_SIZE;
    const gridHeightPx = ROWS * GRID_SIZE;

    canvas.width = gridWidthPx;
    canvas.height = gridHeightPx;
}

function initOffice() {
    updateCanvasSize();

    office = Array(ROWS).fill().map(() => Array(COLS).fill(OBJECTS.EMPTY));
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            office[y][x] = OBJECTS.CARPET;
        }
    }
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
                office[y][x] = OBJECTS.WALL;
            }
        }
    }

    for (let x = 3; x < COLS - 3; x += 3) {
        office[0][x] = OBJECTS.WINDOW;
        office[0][x + 1] = OBJECTS.WINDOW;
    }

    for (let y = 3; y < ROWS - 6; y += 3) {
        office[y][COLS - 1] = OBJECTS.WINDOW;
        office[y + 1][COLS - 1] = OBJECTS.WINDOW;
    }

    for (let x = 0; x < COLS; x++) {
        office[ROWS - 1][x] = OBJECTS.WALL;
    }

    createWorkstation(6, 5);          // BTC
    createWorkstation(6, 15);         // ETH
    createWorkstation(COLS - 10, 5);    // SOL
    createWorkstation(COLS - 10, 15);   // DOGE

    // Create a rectangular table in the middle of the office
    const tableWidth = 4;
    const tableHeight = 2;
    const tableCenterX = Math.floor(COLS / 2);
    const tableCenterY = Math.floor(ROWS / 2);

    for (let dx = -Math.floor(tableWidth / 2); dx < Math.ceil(tableWidth / 2); dx++) {
        for (let dy = -Math.floor(tableHeight / 2); dy < Math.ceil(tableHeight / 2); dy++) {
            office[tableCenterY + dy][tableCenterX + dx] = OBJECTS.TABLE;
        }
    }

    // Create a coffee area (2x2 grid) slightly to the right of center
    const coffeeX = Math.floor(COLS / 2) + 3; // Moved right by 3 spaces
    const coffeeY = Math.floor(ROWS / 2) - 1;
    office[coffeeY][coffeeX] = OBJECTS.COFFEE;
    office[coffeeY][coffeeX + 1] = OBJECTS.COFFEE;
    office[coffeeY + 1][coffeeX] = OBJECTS.COFFEE;
    office[coffeeY + 1][coffeeX + 1] = OBJECTS.COFFEE;

    const deskPositions = {
        btc: { x: 6, y: 6 },
        eth: { x: 6, y: 16 },
        sol: { x: COLS - 10, y: 6 },
        doge: { x: COLS - 10, y: 16 }
    };

    people = [
        new Person(deskPositions.btc.x, deskPositions.btc.y, 'Analyst Biton', 'btc'),
        new Person(deskPositions.eth.x, deskPositions.eth.y, 'Analyst Ethan', 'eth'),
        new Person(deskPositions.sol.x, deskPositions.sol.y, 'Analyst Solar', 'sol'),
        new Person(deskPositions.doge.x, deskPositions.doge.y, 'Analyst Dodge', 'doge')
    ];

    // Add tab switching functionality for mobile
    const tabButtons = document.querySelectorAll('.tab-button');

    // Set initial state - terminal is active by default on mobile
    if (window.innerWidth <= 767) {
        document.body.classList.remove('office-active');
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Switch view based on selected tab
            if (tabName === 'office') {
                document.body.classList.add('office-active');
            } else {
                document.body.classList.remove('office-active');
            }
        });
    });

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = Math.floor((e.clientX - rect.left) / GRID_SIZE);
        const clickY = Math.floor((e.clientY - rect.top) / GRID_SIZE);

        for (const person of people) {
            if (person.x === clickX && person.y === clickY) {
                const ticker = person.ticker.toLowerCase();
                const full = reasoningData[ticker];
                const terminalContent = document.getElementById('terminalContent');
                if (terminalContent) {
                    if (full) {
                        terminalContent.textContent = `=== ${person.name} ===\n\n${full}\n`;
                    } else {
                        terminalContent.textContent = `=== ${person.name} ===\n\n...\n`;
                    }
                }
                break;
            }
        }
    });
}

function createWorkstation(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = 0; dy <= 0; dy++) {
            office[y + dy][x + dx] = OBJECTS.DESK;
        }
    }

    office[y - 1][x] = OBJECTS.COMPUTER;
}

function isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (
        office[y][x] === OBJECTS.WALL ||
        office[y][x] === OBJECTS.DESK ||
        office[y][x] === OBJECTS.COMPUTER ||
        office[y][x] === OBJECTS.BALCONY_RAIL ||
        office[y][x] === OBJECTS.TABLE ||
        office[y][x] === OBJECTS.COFFEE
    ) {
        return false;
    }
    for (const p of people) {
        if (p.x === x && p.y === y) {
            return false;
        }
    }
    return true;
}

function findDeskForTicker(ticker) {
    const deskPositions = {
        btc: { x: 6, y: 6 },
        eth: { x: 6, y: 16 },
        sol: { x: COLS - 10, y: 6 },
        doge: { x: COLS - 10, y: 16 }
    };
    if (deskPositions[ticker.toLowerCase()]) {
        return deskPositions[ticker.toLowerCase()];
    }
    return { x: 10, y: 10 };
}

function findPath(startX, startY, endX, endY) {
    const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
    const closedSet = [];
    while (openSet.length > 0) {
        let currentIndex = 0;
        for (let i = 0; i < openSet.length; i++) {
            if (openSet[i].f < openSet[currentIndex].f) {
                currentIndex = i;
            }
        }
        const current = openSet[currentIndex];
        if (current.x === endX && current.y === endY) {
            const path = [];
            let temp = current;
            while (temp.parent) {
                path.push({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return path.reverse();
        }
        openSet.splice(currentIndex, 1);
        closedSet.push(current);

        const neighbors = [
            { x: current.x - 1, y: current.y },
            { x: current.x + 1, y: current.y },
            { x: current.x, y: current.y - 1 },
            { x: current.x, y: current.y + 1 }
        ];
        for (const n of neighbors) {
            if (!isWalkable(n.x, n.y) ||
                closedSet.some(cl => cl.x === n.x && cl.y === n.y)) {
                continue;
            }
            const g = current.g + 1;
            const h = Math.abs(n.x - endX) + Math.abs(n.y - endY);
            const f = g + h;
            const existing = openSet.find(o => o.x === n.x && o.y === n.y);
            if (existing && g >= existing.g) {
                continue;
            }
            if (existing) {
                existing.g = g;
                existing.f = f;
                existing.parent = current;
            } else {
                openSet.push({ x: n.x, y: n.y, g, h, f, parent: current });
            }
        }
        if (closedSet.length > 200) {
            return [];
        }
    }
    return [];
}

function drawSpeechBubble(x, y, text) {
    const maxWidth = 120;
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    ctx.font = '12px Arial';

    for (let i = 1; i < words.length; i++) {
        const w = words[i];
        const width = ctx.measureText(currentLine + ' ' + w).width;
        if (width < maxWidth) {
            currentLine += ' ' + w;
        } else {
            lines.push(currentLine);
            currentLine = w;
        }
    }
    lines.push(currentLine);

    const lineHeight = 14;
    const bubbleWidth = maxWidth + 10;
    const bubbleHeight = (lines.length * lineHeight) + 10;

    const bubbleX = x;
    const bubbleY = y - bubbleHeight;

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubbleX - bubbleWidth / 2, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth / 2, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleX + 5, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleX, bubbleY + bubbleHeight + 10);
    ctx.lineTo(bubbleX - 5, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleX - bubbleWidth / 2, bubbleY + bubbleHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(
            lines[i],
            bubbleX,
            bubbleY + 15 + (i * lineHeight)
        );
    }
}

function drawOffice() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, -GRID_SIZE, canvas.width, GRID_SIZE);

    drawClouds();

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cellX = x * GRID_SIZE;
            const cellY = y * GRID_SIZE;
            switch (office[y][x]) {
                case OBJECTS.CARPET:
                    // Base carpet color
                    ctx.fillStyle = COLORS.carpet;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    // Add carpet texture and pattern
                    const patternType = (x + Math.floor(y / 2)) % 3; // Create different pattern sections

                    // Draw carpet fibers and texture
                    ctx.strokeStyle = ((x + y) % 2 === 0) ? '#e5e0da' : '#d8d4ce';
                    ctx.lineWidth = 0.4;

                    if (patternType === 0) {
                        // Diagonal texture pattern
                        ctx.beginPath();
                        for (let i = 0; i < GRID_SIZE; i += 3) {
                            ctx.moveTo(cellX, cellY + i);
                            ctx.lineTo(cellX + i, cellY);

                            ctx.moveTo(cellX + GRID_SIZE, cellY + i);
                            ctx.lineTo(cellX + GRID_SIZE - i, cellY);

                            ctx.moveTo(cellX + i, cellY + GRID_SIZE);
                            ctx.lineTo(cellX, cellY + GRID_SIZE - i);

                            ctx.moveTo(cellX + GRID_SIZE - i, cellY + GRID_SIZE);
                            ctx.lineTo(cellX + GRID_SIZE, cellY + GRID_SIZE - i);
                        }
                        ctx.stroke();
                    } else if (patternType === 1) {
                        // Square pattern with subtle details
                        ctx.beginPath();
                        ctx.rect(cellX + 4, cellY + 4, GRID_SIZE - 8, GRID_SIZE - 8);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.rect(cellX + 8, cellY + 8, GRID_SIZE - 16, GRID_SIZE - 16);
                        ctx.stroke();
                    } else {
                        // Dotted texture effect
                        for (let i = 4; i < GRID_SIZE; i += 6) {
                            for (let j = 4; j < GRID_SIZE; j += 6) {
                                ctx.beginPath();
                                ctx.arc(cellX + i, cellY + j, 0.5, 0, Math.PI * 2);
                                ctx.stroke();
                            }
                        }
                    }

                    // Add subtle color variation to create depth
                    if ((x * y) % 5 === 0) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                        ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    }

                    // Add occasional "wear" marks on the carpet
                    if ((x * y) % 31 === 0) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                        const wearSize = 3 + Math.random() * 4;
                        ctx.beginPath();
                        ctx.arc(
                            cellX + GRID_SIZE / 2 + (Math.random() * 6 - 3),
                            cellY + GRID_SIZE / 2 + (Math.random() * 6 - 3),
                            wearSize, 0, Math.PI * 2
                        );
                        ctx.fill();
                    }
                    break;

                case OBJECTS.WALL:
                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    ctx.strokeStyle = '#bbb';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    break;

                case OBJECTS.WINDOW:
                    // Wall around the window frame
                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    
                    // Sky visible through the window
                    ctx.fillStyle = COLORS.sky;
                    ctx.fillRect(cellX + 4, cellY + 4, GRID_SIZE - 8, GRID_SIZE - 8);
                    
                    // Draw clouds visible through the window
                    drawWindowClouds(cellX + 4, cellY + 4, GRID_SIZE - 8, GRID_SIZE - 8);
                    
                    // Window frame (cross pattern)
                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX + GRID_SIZE / 2 - 1, cellY + 4, 2, GRID_SIZE - 8);
                    ctx.fillRect(cellX + 4, cellY + GRID_SIZE / 2 - 1, GRID_SIZE - 8, 2);
                    
                    // Frame edge details
                    ctx.strokeStyle = '#555';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cellX + 4, cellY + 4, GRID_SIZE - 8, GRID_SIZE - 8);
                    
                    // Window reflection/light effect
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(cellX + 6, cellY + 6);
                    ctx.lineTo(cellX + GRID_SIZE / 3, cellY + 6);
                    ctx.lineTo(cellX + 6, cellY + GRID_SIZE / 3);
                    ctx.closePath();
                    ctx.fill();
                    break;

                case OBJECTS.DESK:
                    ctx.fillStyle = COLORS.desk;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    ctx.fillStyle = '#7a3b11';
                    ctx.fillRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE - 4);

                    ctx.strokeStyle = '#5d2906';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();

                    for (let i = 1; i < 8; i++) {
                        const yOffset = cellY + 2 + i * (GRID_SIZE - 4) / 8;
                        ctx.moveTo(cellX + 2, yOffset);
                        ctx.lineTo(cellX + GRID_SIZE - 2, yOffset);

                        if (i % 2 === 0) {
                            ctx.moveTo(cellX + 2, yOffset - 1);
                            ctx.bezierCurveTo(
                                cellX + GRID_SIZE / 3, yOffset - 3,
                                cellX + GRID_SIZE * 2 / 3, yOffset + 3,
                                cellX + GRID_SIZE - 2, yOffset - 1
                            );
                        }
                    }

                    for (let i = 1; i < 4; i++) {
                        const xOffset = cellX + 2 + i * (GRID_SIZE - 4) / 4;
                        ctx.moveTo(xOffset, cellY + 2);
                        ctx.lineTo(xOffset, cellY + GRID_SIZE - 2);
                    }

                    ctx.stroke();

                    ctx.strokeStyle = '#8B4513';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE - 4);
                    break;

                case OBJECTS.COMPUTER:
                    // Draw desk surface under computer
                    ctx.fillStyle = '#f5f5f5';
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    // Monitor stand - more elegant design
                    ctx.fillStyle = '#222222';
                    ctx.beginPath();
                    ctx.moveTo(cellX + GRID_SIZE * 0.4, cellY + GRID_SIZE * 0.75);
                    ctx.lineTo(cellX + GRID_SIZE * 0.6, cellY + GRID_SIZE * 0.75);
                    ctx.lineTo(cellX + GRID_SIZE * 0.55, cellY + GRID_SIZE * 0.85);
                    ctx.lineTo(cellX + GRID_SIZE * 0.45, cellY + GRID_SIZE * 0.85);
                    ctx.closePath();
                    ctx.fill();

                    // Stand base
                    ctx.fillStyle = '#333333';
                    ctx.beginPath();
                    ctx.ellipse(
                        cellX + GRID_SIZE / 2,
                        cellY + GRID_SIZE * 0.85,
                        GRID_SIZE * 0.2,
                        GRID_SIZE * 0.06,
                        0, 0, Math.PI * 2
                    );
                    ctx.fill();

                    // Neck of the stand
                    ctx.fillStyle = '#222222';
                    ctx.fillRect(
                        cellX + GRID_SIZE * 0.47,
                        cellY + GRID_SIZE * 0.55,
                        GRID_SIZE * 0.06,
                        GRID_SIZE * 0.2
                    );

                    // Monitor frame - outside bezel
                    ctx.fillStyle = COLORS.computer;
                    roundedRect(
                        ctx,
                        cellX + GRID_SIZE * 0.15,
                        cellY + GRID_SIZE * 0.1,
                        GRID_SIZE * 0.7,
                        GRID_SIZE * 0.45,
                        4
                    );

                    // Screen - inside of bezel
                    ctx.fillStyle = COLORS.screen;
                    roundedRect(
                        ctx,
                        cellX + GRID_SIZE * 0.17,
                        cellY + GRID_SIZE * 0.12,
                        GRID_SIZE * 0.66,
                        GRID_SIZE * 0.41,
                        2
                    );

                    // Determine what ticker to show based on location
                    let ticker = '';
                    const deskX = Math.floor(cellX / GRID_SIZE);
                    const deskY = Math.floor(cellY / GRID_SIZE);

                    if (deskX < COLS / 2 && deskY < ROWS / 2) ticker = 'btc';
                    else if (deskX < COLS / 2) ticker = 'eth';
                    else if (deskY < ROWS / 2) ticker = 'sol';
                    else ticker = 'doge';

                    // Chart data based on ticker
                    const chartColor = ticker === 'btc' ? '#F7931A' :
                        ticker === 'eth' ? '#627EEA' :
                            ticker === 'sol' ? '#00FFA3' : '#C3A634';

                    // Draw screen content - price chart
                    ctx.strokeStyle = chartColor;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cellX + GRID_SIZE * 0.18, cellY + GRID_SIZE * 0.32);

                    // Create a price chart specific to the ticker
                    const points = 8;
                    const volatility = ticker === 'btc' ? 0.05 :
                        ticker === 'eth' ? 0.07 :
                            ticker === 'sol' ? 0.09 : 0.11;

                    // Generate the chart line
                    let prevY = cellY + GRID_SIZE * (0.32 - Math.random() * 0.1);
                    for (let i = 1; i <= points; i++) {
                        const x = cellX + GRID_SIZE * (0.18 + (i * 0.64 / points));
                        const direction = Math.random() > 0.5 ? 1 : -1;
                        const change = Math.random() * volatility * direction;
                        const y = prevY + change * GRID_SIZE;
                        // Keep the chart within the screen bounds
                        const yBounded = Math.max(cellY + GRID_SIZE * 0.13,
                            Math.min(cellY + GRID_SIZE * 0.52, y));
                        ctx.lineTo(x, yBounded);
                        prevY = yBounded;
                    }
                    ctx.stroke();

                    // Screen horizontal lines (data rows)
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 0.5;
                    ctx.globalAlpha = 0.2;
                    for (let i = 0; i < 4; i++) {
                        ctx.beginPath();
                        ctx.moveTo(cellX + GRID_SIZE * 0.17, cellY + GRID_SIZE * (0.18 + i * 0.09));
                        ctx.lineTo(cellX + GRID_SIZE * 0.83, cellY + GRID_SIZE * (0.18 + i * 0.09));
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1.0;

                    // Small indicator light
                    ctx.fillStyle = '#00ff00';
                    ctx.beginPath();
                    ctx.arc(
                        cellX + GRID_SIZE * 0.15 + 3,
                        cellY + GRID_SIZE * 0.1 + 3,
                        2,
                        0, Math.PI * 2
                    );
                    ctx.fill();

                    // Add logo/ticker to the screen
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '6px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(
                        ticker.toUpperCase(),
                        cellX + GRID_SIZE * 0.19,
                        cellY + GRID_SIZE * 0.17
                    );

                    // Price indicators
                    ctx.font = '6px Arial';
                    ctx.fillText(
                        `$${Math.floor(1000 + Math.random() * 9000)}`,
                        cellX + GRID_SIZE * 0.72,
                        cellY + GRID_SIZE * 0.17
                    );

                    // Screen reflection
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.05;
                    ctx.beginPath();
                    ctx.moveTo(cellX + GRID_SIZE * 0.17, cellY + GRID_SIZE * 0.12);
                    ctx.lineTo(cellX + GRID_SIZE * 0.6, cellY + GRID_SIZE * 0.12);
                    ctx.lineTo(cellX + GRID_SIZE * 0.35, cellY + GRID_SIZE * 0.25);
                    ctx.lineTo(cellX + GRID_SIZE * 0.17, cellY + GRID_SIZE * 0.25);
                    ctx.closePath();
                    ctx.fill();
                    ctx.globalAlpha = 1.0;

                    // Draw keyboard
                    ctx.fillStyle = '#222222';
                    roundedRect(
                        ctx,
                        cellX + GRID_SIZE * 0.25,
                        cellY + GRID_SIZE * 0.65,
                        GRID_SIZE * 0.5,
                        GRID_SIZE * 0.1,
                        2
                    );

                    // Keyboard keys
                    ctx.fillStyle = '#444444';
                    for (let i = 0; i < 3; i++) {
                        for (let j = 0; j < 8; j++) {
                            ctx.fillRect(
                                cellX + GRID_SIZE * (0.26 + j * 0.06),
                                cellY + GRID_SIZE * (0.66 + i * 0.03),
                                GRID_SIZE * 0.05,
                                GRID_SIZE * 0.02
                            );
                        }
                    }
                    break;

                case OBJECTS.COFFEE:
                    // Enhanced coffee machine rendering
                    const centerX = Math.floor(COLS / 2) + 3; // Moved right by 3 spaces
                    const centerY = Math.floor(ROWS / 2) - 0.5;
                    const isCenterPiece = (x === Math.floor(centerX) && y === Math.floor(centerY));

                    // Base/counter
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    ctx.fillStyle = '#D2B48C';
                    ctx.fillRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE - 4);

                    // Draw different parts of the coffee machine based on position
                    if (x === Math.floor(centerX) && y === Math.floor(centerY)) {
                        // Main coffee machine body in top-left cell
                        ctx.fillStyle = '#333';
                        ctx.fillRect(cellX + 5, cellY + 5, GRID_SIZE - 10, GRID_SIZE - 15);

                        // Control panel
                        ctx.fillStyle = '#222';
                        ctx.fillRect(cellX + 5, cellY + GRID_SIZE - 15, GRID_SIZE - 10, 10);

                        // Buttons
                        ctx.fillStyle = '#f00';
                        ctx.beginPath();
                        ctx.arc(cellX + 15, cellY + GRID_SIZE - 10, 3, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#0f0';
                        ctx.beginPath();
                        ctx.arc(cellX + 25, cellY + GRID_SIZE - 10, 3, 0, Math.PI * 2);
                        ctx.fill();

                        // Screen
                        ctx.fillStyle = '#336699';
                        ctx.fillRect(cellX + GRID_SIZE / 2 - 10, cellY + GRID_SIZE - 14, 20, 8);

                    } else if (x === Math.floor(centerX) + 1 && y === Math.floor(centerY)) {
                        // Top-right: Coffee grinder
                        ctx.fillStyle = '#444';
                        ctx.fillRect(cellX + 5, cellY + 5, GRID_SIZE - 15, GRID_SIZE - 10);

                        // Bean container
                        ctx.fillStyle = '#222';
                        ctx.beginPath();
                        ctx.arc(cellX + 12, cellY + GRID_SIZE / 3, GRID_SIZE / 4, 0, Math.PI * 2);
                        ctx.fill();

                        // Coffee beans
                        ctx.fillStyle = '#654321';
                        for (let i = 0; i < 5; i++) {
                            ctx.beginPath();
                            ctx.ellipse(
                                cellX + 12 + (Math.random() * 10 - 5),
                                cellY + GRID_SIZE / 3 + (Math.random() * 10 - 5),
                                3, 2, Math.random() * Math.PI, 0, Math.PI * 2
                            );
                            ctx.fill();
                        }
                    } else if (x === Math.floor(centerX) && y === Math.floor(centerY) + 1) {
                        // Bottom-left: Coffee dispensing area
                        ctx.fillStyle = '#222';
                        ctx.fillRect(cellX + 5, cellY + 5, GRID_SIZE - 10, GRID_SIZE / 3);

                        // Drip area
                        ctx.fillStyle = '#111';
                        ctx.fillRect(cellX + GRID_SIZE / 2 - 8, cellY + GRID_SIZE / 3, 16, 2);

                        // Coffee spouts
                        ctx.fillStyle = '#222';
                        ctx.fillRect(cellX + GRID_SIZE / 2 - 5, cellY + GRID_SIZE / 3 + 2, 2, 5);
                        ctx.fillRect(cellX + GRID_SIZE / 2 + 3, cellY + GRID_SIZE / 3 + 2, 2, 5);

                        // Coffee cup
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(cellX + GRID_SIZE / 2 - 7, cellY + GRID_SIZE / 2, 14, 10);
                        ctx.fillStyle = '#6F4E37';
                        ctx.fillRect(cellX + GRID_SIZE / 2 - 5, cellY + GRID_SIZE / 2 + 2, 10, 6);
                    } else if (x === Math.floor(centerX) + 1 && y === Math.floor(centerY) + 1) {
                        // Bottom-right: Supplies and cups
                        const cupColors = ['#fff', '#e0e0e0', '#f0f0f0'];
                        const cupCount = 5;

                        // Stack of cups
                        for (let i = 0; i < cupCount; i++) {
                            ctx.fillStyle = cupColors[i % cupColors.length];
                            ctx.beginPath();
                            ctx.arc(cellX + GRID_SIZE / 3, cellY + GRID_SIZE / 3 - i * 3, 8, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.beginPath();
                            ctx.ellipse(cellX + GRID_SIZE / 3, cellY + GRID_SIZE / 3 - i * 3, 8, 3, 0, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        // Coffee packets
                        ctx.fillStyle = '#A52A2A';
                        ctx.fillRect(cellX + GRID_SIZE / 2 + 2, cellY + 10, 12, 8);
                        ctx.fillRect(cellX + GRID_SIZE / 2 + 5, cellY + 18, 12, 8);

                        // Sugar packets
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(cellX + GRID_SIZE / 2, cellY + GRID_SIZE / 2, 10, 5);
                        ctx.fillRect(cellX + GRID_SIZE / 2 + 3, cellY + GRID_SIZE / 2 + 5, 10, 5);
                    }
                    break;

                case OBJECTS.TABLE:
                    // Draw table
                    ctx.fillStyle = COLORS.table;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    // Table surface with wood grain
                    ctx.fillStyle = '#8B5A2B';
                    ctx.fillRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE - 4);

                    // Wood grain effect
                    ctx.strokeStyle = '#7C4A2A';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();

                    // Add wood grain lines
                    for (let i = 1; i < 5; i++) {
                        const lineY = cellY + 2 + i * (GRID_SIZE - 4) / 5;
                        ctx.moveTo(cellX + 2, lineY);
                        ctx.lineTo(cellX + GRID_SIZE - 2, lineY);

                        // Add some wavy grain pattern
                        const waveY = cellY + 2 + (i - 0.5) * (GRID_SIZE - 4) / 5;
                        ctx.moveTo(cellX + 2, waveY);
                        ctx.bezierCurveTo(
                            cellX + GRID_SIZE / 3, waveY - 1,
                            cellX + GRID_SIZE * 2 / 3, waveY + 1,
                            cellX + GRID_SIZE - 2, waveY
                        );
                    }

                    ctx.stroke();

                    // Add border to make the table appear more polished
                    ctx.strokeStyle = '#6B4226';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE - 4);
                    break;

                default:
                    ctx.fillStyle = COLORS.floor;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
            }
        }
    }
}

function drawClouds() {
    const time = Date.now() / 10000;
    ctx.fillStyle = COLORS.cloud;

    for (let i = 0; i < 5; i++) {
        const x = ((i * 100) + time * 20) % canvas.width;
        const y = -GRID_SIZE / 2;
        const size = GRID_SIZE * (0.8 + Math.sin(i) * 0.3);

        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.arc(x + size / 3, y - size / 3, size / 3, 0, Math.PI * 2);
        ctx.arc(x - size / 3, y - size / 4, size / 3, 0, Math.PI * 2);
        ctx.arc(x + size / 2, y, size / 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPeople() {
    for (const person of people) {
        person.draw();
    }
}

function update() {
    for (const person of people) {
        person.update();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    if (isMobileView) {
        ctx.translate(canvasOffset.x + 50, canvasOffset.y);
    }

    drawOffice();
    drawPeople();
    
    // Draw the dog
    dog.draw();

    ctx.restore();
}

function animate() {
    update();
    requestAnimationFrame(draw);
}

function connectToApi() {
    if (!apiConnected) {
        apiConnected = true;
        updateConnectionStatus(true);

        // Update terminal content to show analysts are in action
        const terminalContent = document.getElementById('terminalContent');
        if (terminalContent) {
            const instructionsDiv = terminalContent.querySelector('.terminal-instructions');
            if (instructionsDiv) {
                instructionsDiv.textContent = "Our Analysts are in action. Waiting for the first task to complete...";
            } else {
                terminalContent.innerHTML = `<div id="branding">Welcome to Yototec - Innovating Market Intelligence</div>
<div class="terminal-instructions">Our Analysts are in action. Waiting for the first task to complete...</div>`;
            }
        }

        // Initialize and start a task immediately
        debugLog("API Connected - Assigning immediate task");
        
        // Select a random analyst and start them working immediately
        const tickers = ['btc', 'eth', 'sol', 'doge'];
        const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
        const randomAnalyst = people.find(p => p.ticker.toLowerCase() === randomTicker);
        
        if (randomAnalyst) {
            // Stop whatever they're doing and start analysis
            randomAnalyst.state = 'walking';
            randomAnalyst.wander = function() {}; // Temporarily disable wandering
            
            // Force them to go to desk and start analyzing
            randomAnalyst.goToDesk();
            randomAnalyst.speak("Urgent analysis needed!");
            
            // Add to the queue and process immediately
            fetchQueue.push({ ticker: randomTicker, hasNewData: true });
            isTaskInProgress = false;
            currentFetchingTicker = null;
            processQueue();
        }
        
        // Start regular timers
        if (!animationTimer) {
            animationTimer = setInterval(animate, ANIMATION_SPEED);
        }
        
        // Start full task scheduler for future tasks
        fetchChainData();
        startTaskScheduler();
        
        debugLog("Immediate analysis assigned");
    }
}

function disconnectFromApi() {
    if (apiConnected) {
        apiConnected = false;
        updateConnectionStatus(false);
        stopTaskScheduler();
        currentFetchingTicker = null;
        fetchQueue = [];
        isTaskInProgress = false;
        for (const p of people) {
            p.isFetching = false;
        }
        debugLog("API Disconnected");
    }
}

function updateConnectionStatus(status) {
    const statusDot = document.getElementById('api-status-dot');
    if (!statusDot) return;

    statusDot.classList.remove('connected-dot', 'disconnected-dot', 'connecting-dot');

    if (status === true || status === 'connected') {
        statusDot.classList.add('connected-dot');
        apiConnected = true;
    } else if (status === 'connecting') {
        statusDot.classList.add('connecting-dot');
        // Leave apiConnected as is (should be false)
    } else {
        statusDot.classList.add('disconnected-dot');
        apiConnected = false;
    }
}

async function fetchChainData() {
    if (!apiConnected) return;
    try {
        debugLog("Fetching chain data...");
        updateSyncStatus("Checking blockchain for new data...");
        const response = await fetch(CHAIN_LENGTH_API);
        const data = await response.json();
        if (data && data.chain_length) {
            chainLength = data.chain_length;
            document.getElementById('chain-info').textContent = `Block Height: ${chainLength} (SentiChain ${data.network})`;
            if (chainLength > lastFetchTime) {
                updateSyncStatus("Blockchain data sync complete.");
                queueReasoningFetches(true);
                lastFetchTime = chainLength;
            } else {
                updateSyncStatus("No new blockchain data.");
                queueReasoningFetches(false);
            }
        }
    } catch (err) {
        console.error("Error fetching blockchain data", err);
        debugLog("Error fetching blockchain data");
        updateSyncStatus("Error checking blockchain data");
    }
}

function queueReasoningFetches(hasNewData) {
    fetchQueue = [];
    if (currentFetchingTicker) {
        const p = people.find(x => x.ticker.toLowerCase() === currentFetchingTicker);
        if (p) p.isFetching = false;
    }
    currentFetchingTicker = null;

    const tickers = ['btc', 'eth', 'sol', 'doge'];
    const shuffledTickers = [...tickers].sort(() => Math.random() - 0.5);

    shuffledTickers.forEach(ticker => {
        fetchQueue.push({ ticker, hasNewData });
    });

    debugLog(`Queue: ${fetchQueue.map(item => item.ticker).join(', ')} (hasNewData: ${hasNewData})`);

    if (!isTaskInProgress) {
        scheduleNextTask();
    }
}

function processQueue() {
    if (!apiConnected || fetchQueue.length === 0 || currentFetchingTicker || isTaskInProgress) {
        debugLog(`Skipping queue: connected=${apiConnected}, length=${fetchQueue.length}, current=${currentFetchingTicker}, taskInProgress=${isTaskInProgress}`);
        return;
    }

    isTaskInProgress = true;

    const queueItem = fetchQueue.shift();
    const ticker = queueItem.ticker;
    const hasNewData = queueItem.hasNewData;

    currentFetchingTicker = ticker;
    debugLog(`Processing: ${ticker} (newData: ${hasNewData})`);

    const person = people.find(p => p.ticker.toLowerCase() === ticker);
    if (person) {
        if (person.x === person.desk.x && person.y === person.desk.y) {
            person.startFetching();
            fetchReasoningData(ticker, hasNewData);
        } else {
            person.goToDesk();
            const checkInterval = setInterval(() => {
                if (person.x === person.desk.x && person.y === person.desk.y) {
                    clearInterval(checkInterval);
                    person.startFetching();
                    fetchReasoningData(ticker, hasNewData);
                }
            }, 500);
        }
    } else {
        debugLog(`No person for ticker: ${ticker}`);
        currentFetchingTicker = null;
        isTaskInProgress = false;
        scheduleNextTask();
    }
}

async function fetchReasoningData(ticker, hasNewData) {
    if (!apiConnected || !chainLength) {
        currentFetchingTicker = null;
        isTaskInProgress = false;
        debugLog("Abort fetch: Not connected or no block information");
        scheduleNextTask();
        return;
    }

    const person = people.find(p => p.ticker.toLowerCase() === ticker);
    const observerName = person ? person.name : `${ticker.toUpperCase()} Observer`;

    const displayInterval = setInterval(() => {
        updateTerminalDisplay();
    }, 200);

    if (!hasNewData) {
        debugLog(`Simulating analysis for ${ticker} (no new data)...`);

        const analysisTime = 5000 + Math.random() * 3000;

        setTimeout(() => {
            updateSyncStatus(`${observerName} revised analysis and found nothing new.`);

            if (person) {
                person.speak("Analysis revision complete");
                person.isFetching = false;

                setTimeout(() => {
                    if (person.isFetching === false) {
                        person.wander();
                        person.state = 'walking';
                        person.speak('Taking a break');
                    }
                }, 1000);
            }

            currentFetchingTicker = null;
            isTaskInProgress = false;

            clearInterval(displayInterval);

            addToTerminalHistory(`${observerName} completed analysis - no changes detected`);
            updateTerminalDisplay();

            setTimeout(() => {
                if (document.getElementById('fetch-status').textContent.includes("revised analysis")) {
                    updateSyncStatus("");
                }
            }, 3000);

            scheduleNextTask();
        }, analysisTime);

        return;
    }

    try {
        debugLog(`Fetching reasoning for ${ticker}...`);

        const url = `${REASONING_API_BASE}${chainLength}&ticker=${ticker.toUpperCase()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.reasoning) {
            reasoningData[ticker] = data.reasoning;
            if (person) {
                clearInterval(displayInterval);
                person.displayReasoning(data.reasoning);

                setTimeout(() => {
                    if (person.isFetching === false) {
                        person.wander();
                        person.state = 'walking';
                        person.speak('Taking a break');
                    }
                }, 3000);
            } else {
                debugLog(`No person found for ticker after fetch: ${ticker}`);
                updateSyncStatus(`${observerName} finished analysis and found something new!`);
                clearInterval(displayInterval);
                currentFetchingTicker = null;
                isTaskInProgress = false;
                scheduleNextTask();
            }
        } else {
            debugLog(`No reasoning data for ${ticker}`);
            updateSyncStatus(`${observerName} finished analysis and found nothing new.`);
            if (person) {
                person.isFetching = false;

                setTimeout(() => {
                    if (person.isFetching === false) {
                        person.wander();
                        person.state = 'walking';
                        person.speak('Taking a break');
                    }
                }, 1000);
            }
            clearInterval(displayInterval);
            currentFetchingTicker = null;
            isTaskInProgress = false;
            scheduleNextTask();
        }

        setTimeout(() => {
            if (document.getElementById('fetch-status').textContent.includes("finished analysis")) {
                updateSyncStatus("");
            }
        }, 3000);
    } catch (err) {
        console.error(`Error fetching reasoning for ${ticker}`, err);
        debugLog(`Error fetching reasoning for ${ticker}`);
        updateSyncStatus(`Error during ${observerName}'s analysis`);
        if (person) {
            person.isFetching = false;

            setTimeout(() => {
                person.wander();
                person.state = 'walking';
                person.speak('Something went wrong');
            }, 1000);
        }
        clearInterval(displayInterval);
        currentFetchingTicker = null;
        isTaskInProgress = false;
        scheduleNextTask();
    }
}

function updateSyncStatus(msg) {
    const el = document.getElementById('fetch-status');
    if (el) {
        el.textContent = msg;
    }

    if (msg && (msg.includes("performing analysis") || msg.includes("finished analysis") || msg.includes("revised analysis"))) {
        addToTerminalHistory(msg);
    }
}

let terminalHistory = [];
const MAX_HISTORY = 50;

function addToTerminalHistory(msg) {
    const timestamp = new Date().toLocaleTimeString();
    terminalHistory.push(`[${timestamp}] ${msg}`);
    if (terminalHistory.length > MAX_HISTORY) {
        terminalHistory.shift();
    }
    updateTerminalDisplay();
}

function getAnalysisSteps(ticker) {
    return [
        "Pulling market data",
        "Performing market analysis",
        "Building quantitative and risk models",
        "Pulling sentiment data",
        "Analyzing market sentiment (bullish/bearish indicators)",
        "Identifying major market events"
    ];
}

function getDetailedAnalysisContent(ticker) {
    const person = people.find(p => p.ticker.toLowerCase() === ticker);
    const observerName = person ? person.name : `${ticker.toUpperCase()} Observer`;
    const timestamp = new Date().toLocaleTimeString();

    const steps = getAnalysisSteps(ticker);
    const currentStep = Math.floor(Math.random() * steps.length);

    let content = `<strong>=== ${observerName} Live Analysis ===</strong>\n`;
    content += `<span style="color: #888;">[${timestamp}] Analysis in progress...</span>\n\n`;

    steps.forEach((step, index) => {
        if (index < currentStep) {
            content += `<span style="color: #0f0">✓</span> ${step}\n`;
        } else if (index === currentStep) {
            content += `<span style="color: #ff0">▶</span> ${step} <span class="blink">...</span>\n`;
        } else {
            content += `<span style="color: #888">○</span> ${step}\n`;
        }
    });

    return content;
}

function getMarketData(ticker) {
    const data = {
        'btc': [
            "Last price data retrieved",
            "Volume analyzed across major exchanges",
            "Market depth evaluated"
        ],
        'eth': [
            "Gas price metrics retrieved",
            "Smart contract volume analyzed",
            "Exchange inflow/outflow measured"
        ],
        'sol': [
            "TPS metrics collected",
            "Validator statistics retrieved",
            "TVL data analyzed"
        ],
        'doge': [
            "Price volatility metrics retrieved",
            "Trading volume patterns analyzed",
            "Exchange distribution examined"
        ]
    };

    return data[ticker.toLowerCase()].join('\n');
}

function getMarketAnalysis(ticker) {
    const analysis = {
        'btc': [
            "Identifying support/resistance levels",
            "Analyzing on-chain metrics",
            "Evaluating market structure"
        ],
        'eth': [
            "Correlating gas prices with network activity",
            "Analyzing DeFi protocol interaction",
            "Evaluating L2 adoption impact"
        ],
        'sol': [
            "Analyzing network performance metrics",
            "Evaluating adoption trends",
            "Measuring ecosystem growth"
        ],
        'doge': [
            "Correlating social metrics with price action",
            "Analyzing community sentiment impact",
            "Measuring velocity patterns"
        ]
    };

    return analysis[ticker.toLowerCase()].join('\n');
}

function getQuantModels(ticker) {
    const models = {
        'btc': [
            "NVTS model updated",
            "Hash rate correlation calculated",
            "Volatility projections modeled"
        ],
        'eth': [
            "ETH/BTC correlation model updated",
            "Gas fee elasticity calculated",
            "DeFi yield impact modeled"
        ],
        'sol': [
            "TPS sustainability model updated",
            "TVL correlation calculated",
            "Network growth projections modeled"
        ],
        'doge': [
            "Social sentiment model updated",
            "Volatility correlation calculated",
            "Momentum indicators modeled"
        ]
    };

    return models[ticker.toLowerCase()].join('\n');
}

function getSentimentIndicators(ticker) {
    const sentiment = {
        'btc': [
            "Twitter sentiment indicators retrieved",
            "News sentiment analysis performed",
            "Market positioning analyzed"
        ],
        'eth': [
            "Developer sentiment analyzed",
            "Institutional interest measured",
            "Community growth evaluated"
        ],
        'sol': [
            "Developer activity measured",
            "Ecosystem sentiment analyzed",
            "Investor positioning evaluated"
        ],
        'doge': [
            "Social media sentiment retrieved",
            "Meme velocity measured",
            "Community engagement analyzed"
        ]
    };

    return sentiment[ticker.toLowerCase()].join('\n');
}

function updateTerminalDisplay() {
    const terminalContent = document.getElementById('terminalContent');
    if (!terminalContent) return;

    if (currentFetchingTicker) {
        const person = people.find(p => p.ticker.toLowerCase() === currentFetchingTicker);
        if (person && person.isFetching) {
            if (person.reasoningText) {
                const timestamp = new Date().toLocaleTimeString();
            } else {
                const analysisContent = getDetailedAnalysisContent(currentFetchingTicker);
                terminalContent.innerHTML = analysisContent;
            }
            return;
        }
    }

    terminalContent.innerHTML = `<div id="branding">Welcome to Yototec - Innovating Market Intelligence</div>\n=== Terminal History ===\n\n${terminalHistory.join('\n')}\n`;
}

function startTaskScheduler() {
    if (apiConnected) {
        debugLog("Starting task scheduler");
        checkForTasks();
    }
}

function stopTaskScheduler() {
    debugLog("Stopping task scheduler");
    clearTimeout(taskScheduleTimer);
}

function scheduleNextTask() {
    if (!apiConnected) return;

    if (fetchQueue.length > 0) {
        debugLog(`Scheduling next task in ${taskInterval / 1000} seconds`);
        taskScheduleTimer = setTimeout(() => {
            processQueue();
        }, taskInterval);
    } else {
        debugLog("No tasks in queue, will check for new data");
        taskScheduleTimer = setTimeout(() => {
            checkForTasks();
        }, taskInterval);
    }
}

function checkForTasks() {
    if (apiConnected) {
        if (!isTaskInProgress && fetchQueue.length === 0) {
            fetchChainData();
        } else {
            scheduleNextTask();
        }
    }
}

function start() {
    initOffice();
    if (animationTimer) clearInterval(animationTimer);
    if (apiPollTimer) clearInterval(apiPollTimer);
    if (taskScheduleTimer) clearTimeout(taskScheduleTimer);
    currentFetchingTicker = null;
    fetchQueue = [];
    isTaskInProgress = false;
    animationTimer = setInterval(animate, ANIMATION_SPEED);
    updateConnectionStatus(false);
    debugLog("Simulation started");
}

let canvasOffset = { x: 0, y: 0 };
let isDragging = false;
let startDragX = 0;
let isMobileView = window.innerWidth < 768;

function setupMobileScrolling() {
    if (!canvas) return;

    // Reset canvas offset when switching between mobile and desktop modes
    window.addEventListener('resize', () => {
        const newIsMobileView = window.innerWidth < 768;

        // Reset offset when switching view modes
        if (isMobileView !== newIsMobileView) {
            canvasOffset = { x: 0, y: 0 };
            // Force a redraw
            requestAnimationFrame(draw);
        }

        isMobileView = newIsMobileView;
    });

    canvas.addEventListener('touchstart', (e) => {
        if (isMobileView) {
            isDragging = true;
            startDragX = e.touches[0].clientX;
            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (isMobileView && isDragging) {
            const currentX = e.touches[0].clientX;
            const deltaX = currentX - startDragX;

            canvasOffset.x += deltaX;

            // Get actual canvas dimensions
            const canvasRect = canvas.getBoundingClientRect();

            // Asymmetric scrolling - more to the right, less to the left
            const leftPadding = canvasRect.width * -0.4;  // Less padding on left
            const rightPadding = canvasRect.width * 0.3;  // More padding on right
            const maxScroll = Math.max(0, canvas.width - canvasRect.width + rightPadding);

            // Allow scrolling with asymmetric limits
            canvasOffset.x = Math.min(rightPadding, Math.max(-maxScroll + leftPadding, canvasOffset.x));

            startDragX = currentX;

            // Force an immediate redraw
            requestAnimationFrame(draw);

            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (isMobileView) {
            isDragging = true;
            startDragX = e.clientX;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isMobileView && isDragging) {
            const deltaX = e.clientX - startDragX;
            canvasOffset.x += deltaX;

            // Get actual canvas dimensions
            const canvasRect = canvas.getBoundingClientRect();

            // Asymmetric scrolling - more to the right, less to the left
            const leftPadding = canvasRect.width * 0.1;  // Less padding on left
            const rightPadding = canvasRect.width * 0.8;  // More padding on right
            const maxScroll = Math.max(0, canvas.width - canvasRect.width + rightPadding);

            // Allow scrolling with asymmetric limits
            canvasOffset.x = Math.min(rightPadding, Math.max(-maxScroll + leftPadding, canvasOffset.x));

            startDragX = e.clientX;

            // Force an immediate redraw
            requestAnimationFrame(draw);
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Also handle mouse leaving the canvas
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
}

start();

setupMobileScrolling();

// Immediately assign different starting activities to each person
people[0].wander(); // BTC analyst takes a walk
people[0].state = 'walking';
people[0].speak('Taking a walk');

people[1].goToCoffee(); // ETH analyst gets coffee
people[1].state = 'walking';
people[1].speak('Need some coffee to stay focused');

people[2].goToTable(); // SOL analyst goes to the table
people[2].state = 'walking';
people[2].speak('Going to take a break at the table');

people[3].goToWindow(); // DOGE analyst goes to the window
people[3].state = 'walking';
people[3].speak('Going to get some fresh air');

// Still delay starting the task scheduler to give analysts time to move
// setTimeout(startTaskScheduler, 5000);

// Helper function for drawing rounded rectangles
function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
}

// Add click event listener to the API status dot
document.getElementById('api-status-dot').addEventListener('click', () => {
    if (apiConnected) {
        disconnectFromApi();
    } else {
        // First show connecting state
        updateConnectionStatus('connecting');
        connectToApi();
    }
});

// Add this new function for drawing clouds in windows
function drawWindowClouds(x, y, width, height) {
    const time = Date.now() / 10000; // Same timing as main clouds for consistency
    ctx.fillStyle = COLORS.cloud;
    
    // Save context to clip clouds to window area
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    // Draw 3 smaller clouds visible through window
    for (let i = 0; i < 3; i++) {
        const cloudX = x + ((i * width/2) + time * 15) % (width * 2) - width/4;
        const cloudY = y + height/3 + Math.sin(time + i) * (height/6);
        const size = width * (0.3 + Math.sin(i + time) * 0.1);
        
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, size/2, 0, Math.PI * 2);
        ctx.arc(cloudX + size/4, cloudY - size/4, size/3, 0, Math.PI * 2);
        ctx.arc(cloudX - size/4, cloudY - size/5, size/4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

// Create a dog instance
let dog = new Dog();

// Modify the update function to include the dog
function update() {
    for (const person of people) {
        person.update();
    }
    
    // Update the dog
    dog.update();
}

// Modify the draw function to include the dog
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    if (isMobileView) {
        ctx.translate(canvasOffset.x + 50, canvasOffset.y);
    }

    drawOffice();
    drawPeople();
    
    // Draw the dog
    dog.draw();

    ctx.restore();
}

// Add dog petting ability to Person class
Person.prototype.petDog = function() {
    if (dog.isPettable(this)) {
        if (dog.getPetBy(this)) {
            this.state = 'pettingDog';
            this.stateTime = 0;
            this.speak("What a good dog!");
            return true;
        }
    }
    return false;
};

// Add a dog petting state to the Person update function
const originalUpdate = Person.prototype.update;
Person.prototype.update = function() {
    // Add new dog petting state
    if (this.state === 'pettingDog') {
        this.stateTime++;
        if (this.stateTime > 8) {
            this.state = 'idle';
            this.stateTime = 0;
            
            // Say something nice about the dog
            const dogComments = [
                "Such a good pup!",
                "Who's a good analyst helper?",
                "Dogs make the office better",
                "That was a nice break",
                "Pets reduce workplace stress"
            ];
            this.speak(dogComments[Math.floor(Math.random() * dogComments.length)]);
        }
        return;
    }
    
    // Call the original update
    originalUpdate.call(this);
    
    // Add dog interaction logic at the end
    if (this.state === 'idle' && Math.random() < 0.01) {
        if (dog.isPettable(this)) {
            this.petDog();
        }
    }
};

// Add optional dog finding to idle behavior
const originalIdle = people[0].constructor.prototype.wander;
Person.prototype.wander = function() {
    // 20% chance to try to find the dog instead of random wandering
    if (Math.random() < 0.2) {
        this.setDestination(dog.x, dog.y);
        this.speak("Going to see the office dog");
    } else {
        originalIdle.call(this);
    }
};
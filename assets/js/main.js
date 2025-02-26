const canvas = document.getElementById('officeCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 30;
const COLS = Math.floor(canvas.width / GRID_SIZE);
const ROWS = Math.floor(canvas.height / GRID_SIZE);
const ANIMATION_SPEED = 500;
const API_POLL_INTERVAL = 10000;
const REASONING_DISPLAY_TIME = 5000;

const CHAIN_LENGTH_API = "https://api.sentichain.com/blockchain/get_chain_length?network=mainnet";
const REASONING_API_BASE = "https://api.sentichain.com/agent/get_reasoning_match_chunk_end?summary_type=observation_public&user_chunk_end=";

const COLORS = {
    floor: '#ffffff',
    carpet: '#f8f8f8',
    wall: '#cccccc',
    desk: '#8B4513',
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
    BALCONY_RAIL: 10
};

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

class Person {
    constructor(x, y, name, ticker) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.ticker = ticker;
        this.uniformColor = COLORS[ticker.toLowerCase() + 'Uniform'];
        this.destination = null;
        this.path = [];
        this.state = 'idle';
        this.stateTime = 0;
        this.interactionPartner = null;
        this.desk = findDeskForTicker(ticker);
        this.messageTime = 0;
        this.message = '';
        this.isFetching = false;
        this.reasoningText = '';
        this.facingDirection = 'down';
        this.animationFrame = 0;

        this.bodyWidth = GRID_SIZE * 0.98;
        this.bodyHeight = GRID_SIZE * 1.12;
        this.headSize = GRID_SIZE * 0.7;
        this.armWidth = GRID_SIZE * 0.28;
        this.armHeight = GRID_SIZE * 0.56;
        this.legWidth = GRID_SIZE * 0.35;
        this.legHeight = GRID_SIZE * 0.42;
    }

    speak(message) {
        const maxWords = 20;
        const words = message.split(' ');
        if (words.length > maxWords) {
            message = words.slice(0, maxWords).join(' ') + '...';
        }
        this.message = message;
        this.messageTime = 10;
    }

    draw() {
        const centerX = this.x * GRID_SIZE + GRID_SIZE / 2;
        const centerY = this.y * GRID_SIZE + GRID_SIZE / 2;

        if (this.state === 'walking' && this.path.length > 0) {
            const nextPoint = this.path[0];
            if (nextPoint.x > this.x) this.facingDirection = 'right';
            else if (nextPoint.x < this.x) this.facingDirection = 'left';
            else if (nextPoint.y > this.y) this.facingDirection = 'down';
            else if (nextPoint.y < this.y) this.facingDirection = 'up';
        } else if (this.state === 'working') {
            this.facingDirection = 'up';
        }

        if (this.state === 'walking') {
            this.animationFrame = (this.animationFrame + 1) % 20;
        } else {
            this.animationFrame = 0;
        }

        if (this.facingDirection === 'up') {
            this.drawFromBehind(centerX, centerY);
        } else if (this.facingDirection === 'down') {
            this.drawFromFront(centerX, centerY);
        } else if (this.facingDirection === 'left') {
            this.drawFromSide(centerX, centerY, 'left');
        } else {
            this.drawFromSide(centerX, centerY, 'right');
        }

        if (this.message && this.messageTime > 0) {
            drawSpeechBubble(centerX, centerY - GRID_SIZE * 1.8, this.message);
        }

        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.name,
            centerX,
            centerY + GRID_SIZE * 1.5 + 10
        );
    }

    drawFromFront(x, y) {
        const legSpread = this.animationFrame > 10 ? 4 : 0;

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight - legSpread
        );
        ctx.fillRect(
            x + this.bodyWidth / 2 - this.legWidth,
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight + legSpread
        );

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight
        );

        const armOffset = this.animationFrame > 10 ? 3 : -3;
        ctx.fillRect(
            x - this.bodyWidth / 2 - this.armWidth,
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth,
            this.armHeight
        );
        ctx.fillRect(
            x + this.bodyWidth / 2,
            y - this.bodyHeight / 4 - armOffset,
            this.armWidth,
            this.armHeight
        );

        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x,
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(
            x - this.headSize / 4,
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 10,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
            x + this.headSize / 4,
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 10,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    drawFromBehind(x, y) {
        const legSpread = this.animationFrame > 10 ? 4 : 0;

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight - legSpread
        );
        ctx.fillRect(
            x + this.bodyWidth / 2 - this.legWidth,
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight + legSpread
        );

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight
        );

        const armOffset = this.animationFrame > 10 ? 3 : -3;
        ctx.fillRect(
            x - this.bodyWidth / 2 - this.armWidth,
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth,
            this.armHeight
        );
        ctx.fillRect(
            x + this.bodyWidth / 2,
            y - this.bodyHeight / 4 - armOffset,
            this.armWidth,
            this.armHeight
        );

        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x,
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    drawFromSide(x, y, side) {
        const direction = (side === 'left') ? -1 : 1;
        const legOffset = this.animationFrame > 10 ? 4 : -4;

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x + direction * (this.bodyWidth / 4),
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight + legOffset
        );
        ctx.fillRect(
            x - direction * (this.bodyWidth / 4),
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight - legOffset
        );

        ctx.fillStyle = this.uniformColor;
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight
        );

        const armOffset = this.animationFrame > 10 ? 3 : -3;
        ctx.fillRect(
            x + direction * (this.bodyWidth / 4),
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth * direction,
            this.armHeight
        );

        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x + direction * (this.bodyWidth / 4),
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(
            x + direction * (this.bodyWidth / 4 + this.headSize / 4),
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 10,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    update() {
        if (this.messageTime > 0) {
            this.messageTime--;
        }

        if (this.isFetching) {
            if (this.x !== this.desk.x || this.y !== this.desk.y) {
                this.goToDesk();
            }
            else {
                this.facingDirection = 'up';
            }
            return;
        }

        switch (this.state) {
            case 'idle':
                this.stateTime++;
                if (this.stateTime > 10) {
                    this.stateTime = 0;
                    const rand = Math.random();
                    if (rand < 0.3) {
                        this.goToDesk();
                    } else if (rand < 0.6) {
                        this.wander();
                        this.state = 'walking';
                        this.speak('Taking a walk');
                    } else {
                        this.findInteraction();
                    }
                }
                break;

            case 'walking':
                if (this.path.length > 0) {
                    const nextPoint = this.path.shift();
                    this.x = nextPoint.x;
                    this.y = nextPoint.y;
                } else {
                    this.state = 'idle';
                    this.stateTime = 0;
                    if (this.x === this.desk.x && this.y === this.desk.y) {
                        this.state = 'working';
                        this.stateTime = 0;
                        this.speak('Reviewing data');
                    } else if (this.interactionPartner) {
                        const partner = people.find(p => p.name === this.interactionPartner);
                        if (partner && this.isAdjacentTo(partner)) {
                            this.interact(partner);
                        } else {
                            this.interactionPartner = null;
                        }
                    }
                }
                break;

            case 'working':
                this.stateTime++;
                if (this.stateTime > 15) {
                    this.state = 'idle';
                    this.stateTime = 0;
                }
                break;

            case 'talking':
                this.stateTime++;
                if (this.stateTime > 10) {
                    this.state = 'idle';
                    this.stateTime = 0;
                    this.interactionPartner = null;
                }
                break;
        }
    }

    goToDesk() {
        this.setDestination(this.desk.x, this.desk.y);
        this.state = 'walking';
        this.speak('Going to my station');
    }

    wander() {
        let tries = 0;
        let validMove = false;
        while (!validMove && tries < 10) {
            tries++;
            const randomX = Math.floor(Math.random() * COLS);
            const randomY = Math.floor(Math.random() * ROWS);
            if (isWalkable(randomX, randomY)) {
                this.setDestination(randomX, randomY);
                validMove = true;
            }
        }
        if (!validMove) {
            this.goToDesk();
        }
    }

    setDestination(x, y) {
        this.destination = { x, y };
        this.path = findPath(this.x, this.y, x, y);
    }

    findInteraction() {
        const possiblePartners = people.filter(p => p !== this && !p.isFetching);
        if (possiblePartners.length > 0) {
            const partner = possiblePartners[Math.floor(Math.random() * possiblePartners.length)];
            this.interactionPartner = partner.name;
            this.findPathToAdjacent(partner.x, partner.y);
            this.state = 'walking';
            this.speak(`Going to talk to ${partner.name}`);
        } else {
            this.wander();
            this.state = 'walking';
        }
    }

    findPathToAdjacent(targetX, targetY) {
        const adjacentCells = [
            { x: targetX - 1, y: targetY },
            { x: targetX + 1, y: targetY },
            { x: targetX, y: targetY - 1 },
            { x: targetX, y: targetY + 1 }
        ].filter(cell => isWalkable(cell.x, cell.y));
        if (adjacentCells.length > 0) {
            let closestCell = adjacentCells[0];
            let closestDist = Infinity;
            for (const cell of adjacentCells) {
                const dist = Math.abs(cell.x - this.x) + Math.abs(cell.y - this.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestCell = cell;
                }
            }
            this.setDestination(closestCell.x, closestCell.y);
        }
    }

    isAdjacentTo(other) {
        const dx = Math.abs(this.x - other.x);
        const dy = Math.abs(this.y - other.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }

    interact(partner) {
        this.state = 'talking';
        this.stateTime = 0;
        // Face each other
        if (this.x < partner.x) {
            this.facingDirection = 'right';
            partner.facingDirection = 'left';
        } else if (this.x > partner.x) {
            this.facingDirection = 'left';
            partner.facingDirection = 'right';
        } else if (this.y < partner.y) {
            this.facingDirection = 'down';
            partner.facingDirection = 'up';
        } else {
            this.facingDirection = 'up';
            partner.facingDirection = 'down';
        }

        if (partner.state !== 'talking' && !partner.isFetching) {
            partner.state = 'talking';
            partner.stateTime = 0;
            partner.interactionPartner = this.name;

            const cryptoInteractions = [
                "Market looks volatile today",
                "Have you seen the latest trend?",
                "Bullish or bearish?",
                "Major resistance ahead",
                "Support levels are holding"
            ];
            const tickerComments = {
                btc: ["Bitcoin's dominance is strong", "Hash rate is increasing", "On-chain metrics look positive"],
                eth: ["ETH gas fees are dropping", "Smart contract activity is up", "Layer 2 adoption growing"],
                sol: ["Solana TPS hitting new highs", "DeFi on SOL expanding", "Low latency is key"],
                doge: ["Meme coins gaining traction", "Community engagement is high", "Social metrics moving"]
            };

            if (Math.random() < 0.5) {
                this.speak(cryptoInteractions[Math.floor(Math.random() * cryptoInteractions.length)]);
                setTimeout(() => {
                    if (partner.state === 'talking' && partner.interactionPartner === this.name && !partner.isFetching) {
                        partner.speak(cryptoInteractions[Math.floor(Math.random() * cryptoInteractions.length)]);
                    }
                }, 1000);
            } else {
                const myComments = tickerComments[this.ticker.toLowerCase()];
                this.speak(myComments[Math.floor(Math.random() * myComments.length)]);
                setTimeout(() => {
                    if (partner.state === 'talking' && partner.interactionPartner === this.name && !partner.isFetching) {
                        const partnerComments = tickerComments[partner.ticker.toLowerCase()];
                        partner.speak(partnerComments[Math.floor(Math.random() * partnerComments.length)]);
                    }
                }, 1000);
            }
        }
    }

    startFetching() {
        debugLog(`${this.name} starting to fetch data`);
        this.isFetching = true;
        this.speak("Analyzing the market");

        if (this.x !== this.desk.x || this.y !== this.desk.y) {
            this.setDestination(this.desk.x, this.desk.y);
        }

        updateSyncStatus(`${this.name} performing analysis...`);

        this.reasoningText = '';
    }

    displayReasoning(reasoning) {
        debugLog(`${this.name} displaying reasoning`);
        this.speak("Analysis complete");

        const terminalContent = document.getElementById('terminalContent');
        if (terminalContent) {
            const timestamp = new Date().toLocaleTimeString();
            let formattedReasoning = reasoning;

            formattedReasoning = formattedReasoning.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            if (!formattedReasoning.includes("Market Analysis:")) {
                const ticker = this.ticker.toLowerCase();

                let structuredReasoning = `<strong>FINAL ANALYSIS REPORT</strong>\n\n`;
                structuredReasoning += formattedReasoning.split('\n')[0] + '\n\n';
                formattedReasoning = structuredReasoning;
            }

            this.reasoningText = `<strong>=== ${this.name} Analysis Results ===</strong>\n` +
                `<span style="color: #0f0">[${timestamp}] Analysis completed successfully!</span>\n\n` +
                formattedReasoning;

            terminalContent.innerHTML = this.reasoningText;

            addToTerminalHistory(`${this.name} completed analysis - NEW INSIGHTS FOUND`);
        }

        updateSyncStatus(`${this.name} finished analysis and found something new!`);

        setTimeout(() => {
            debugLog(`${this.name} done fetching reasoning`);
            this.isFetching = false;
            currentFetchingTicker = null;
            isTaskInProgress = false;
            scheduleNextTask();
        }, REASONING_DISPLAY_TIME);
    }
}

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

    office[Math.floor(ROWS / 2)][Math.floor(COLS / 2)] = OBJECTS.COFFEE;

    const plantPositions = [
        { x: 3, y: 3 },
        { x: COLS - 4, y: 3 },
        { x: 3, y: ROWS - 4 },
        { x: COLS - 4, y: ROWS - 4 },
        { x: Math.floor(COLS / 2), y: 3 },
        { x: Math.floor(COLS / 2), y: ROWS - 4 }
    ];
    for (const pos of plantPositions) {
        office[pos.y][pos.x] = OBJECTS.PLANT;
    }

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

    office[y + 1][x] = OBJECTS.CHAIR;

    office[y - 1][x] = OBJECTS.COMPUTER;
}

function isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (
        office[y][x] === OBJECTS.WALL ||
        office[y][x] === OBJECTS.DESK ||
        office[y][x] === OBJECTS.COMPUTER ||
        office[y][x] === OBJECTS.BALCONY_RAIL
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
                    ctx.fillStyle = COLORS.carpet;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    ctx.strokeStyle = '#f0f0f0';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    if ((x + y) % 2 === 0) {
                        ctx.moveTo(cellX, cellY);
                        ctx.lineTo(cellX + GRID_SIZE, cellY + GRID_SIZE);
                    } else {
                        ctx.moveTo(cellX + GRID_SIZE, cellY);
                        ctx.lineTo(cellX, cellY + GRID_SIZE);
                    }
                    ctx.stroke();
                    break;

                case OBJECTS.WALL:
                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    ctx.strokeStyle = '#bbb';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cellX, cellY, GRID_SIZE, GRID_SIZE);
                    break;

                case OBJECTS.WINDOW:
                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    ctx.fillStyle = COLORS.window;
                    ctx.fillRect(cellX + 4, cellY + 4, GRID_SIZE - 8, GRID_SIZE - 8);

                    ctx.fillStyle = COLORS.wall;
                    ctx.fillRect(cellX + GRID_SIZE / 2 - 2, cellY + 4, 4, GRID_SIZE - 8);
                    ctx.fillRect(cellX + 4, cellY + GRID_SIZE / 2 - 2, GRID_SIZE - 8, 4);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(cellX + 6, cellY + 6);
                    ctx.lineTo(cellX + GRID_SIZE / 2 - 4, cellY + 6);
                    ctx.lineTo(cellX + 6, cellY + GRID_SIZE / 2 - 4);
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
                    for (let i = 1; i < 5; i++) {
                        ctx.moveTo(cellX + 2, cellY + 2 + i * 3);
                        ctx.lineTo(cellX + GRID_SIZE - 2, cellY + 2 + i * 3);
                    }
                    ctx.stroke();
                    break;

                case OBJECTS.CHAIR:
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(cellX + GRID_SIZE / 2, cellY + GRID_SIZE * 3 / 4, GRID_SIZE / 5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#777';
                    ctx.fillRect(cellX + GRID_SIZE * 0.45, cellY + GRID_SIZE * 0.4, GRID_SIZE * 0.1, GRID_SIZE * 0.35);

                    ctx.fillStyle = COLORS.chair;
                    ctx.fillRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE / 4, GRID_SIZE / 2, GRID_SIZE / 3);

                    ctx.fillRect(cellX + GRID_SIZE / 3, cellY, GRID_SIZE / 3, GRID_SIZE / 4);

                    ctx.strokeStyle = '#555';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE / 4, GRID_SIZE / 2, GRID_SIZE / 3);
                    break;

                case OBJECTS.COMPUTER:
                    ctx.fillStyle = '#f5f5f5';
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    ctx.fillStyle = COLORS.computer;
                    ctx.fillRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE * 2 / 3, GRID_SIZE / 2, GRID_SIZE / 6);

                    ctx.fillRect(cellX + GRID_SIZE * 0.45, cellY + GRID_SIZE * 0.5, GRID_SIZE * 0.1, GRID_SIZE * 0.2);

                    ctx.fillRect(cellX + GRID_SIZE / 6, cellY + GRID_SIZE / 6, GRID_SIZE * 2 / 3, GRID_SIZE / 2);

                    ctx.fillStyle = COLORS.screen;
                    ctx.fillRect(cellX + GRID_SIZE / 6 + 2, cellY + GRID_SIZE / 6 + 2, GRID_SIZE * 2 / 3 - 4, GRID_SIZE / 2 - 4);

                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(cellX + GRID_SIZE * 0.25, cellY + GRID_SIZE * 0.25, GRID_SIZE * 0.1, GRID_SIZE * 0.05);
                    ctx.fillRect(cellX + GRID_SIZE * 0.25, cellY + GRID_SIZE * 0.35, GRID_SIZE * 0.2, GRID_SIZE * 0.05);

                    ctx.fillStyle = '#555';
                    ctx.fillRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE * 3 / 4, GRID_SIZE / 2, GRID_SIZE / 8);
                    break;

                case OBJECTS.COFFEE:
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(cellX, cellY, GRID_SIZE, GRID_SIZE);

                    ctx.fillStyle = '#D2B48C';
                    ctx.fillRect(cellX + 2, cellY + 2, GRID_SIZE - 4, GRID_SIZE / 2 - 2);

                    ctx.fillStyle = '#333';
                    ctx.fillRect(cellX + GRID_SIZE / 6, cellY + GRID_SIZE / 6, GRID_SIZE * 2 / 3, GRID_SIZE / 3);

                    ctx.fillStyle = '#555';
                    ctx.fillRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE / 12, GRID_SIZE / 2, GRID_SIZE / 12);

                    ctx.fillStyle = '#222';
                    ctx.fillRect(cellX + GRID_SIZE * 0.6, cellY + GRID_SIZE / 5, GRID_SIZE / 5, GRID_SIZE / 4);

                    ctx.fillStyle = '#fff';
                    ctx.fillRect(cellX + GRID_SIZE / 3, cellY + GRID_SIZE * 2 / 3, GRID_SIZE / 4, GRID_SIZE / 5);

                    ctx.fillStyle = '#6F4E37';
                    ctx.fillRect(cellX + GRID_SIZE / 3 + 2, cellY + GRID_SIZE * 2 / 3 + 2, GRID_SIZE / 4 - 4, GRID_SIZE / 5 - 4);

                    ctx.strokeStyle = '#ddd';
                    ctx.beginPath();
                    ctx.moveTo(cellX + GRID_SIZE * 0.4, cellY + GRID_SIZE * 2 / 3);
                    ctx.bezierCurveTo(
                        cellX + GRID_SIZE * 0.45, cellY + GRID_SIZE * 0.6,
                        cellX + GRID_SIZE * 0.5, cellY + GRID_SIZE * 0.65,
                        cellX + GRID_SIZE * 0.45, cellY + GRID_SIZE * 0.55
                    );
                    ctx.stroke();
                    break;

                case OBJECTS.PLANT:
                    ctx.fillStyle = '#A0522D';
                    ctx.fillRect(cellX + GRID_SIZE / 4, cellY + GRID_SIZE * 2 / 3, GRID_SIZE / 2, GRID_SIZE / 3);

                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(cellX + GRID_SIZE / 4 - 2, cellY + GRID_SIZE * 2 / 3, GRID_SIZE / 2 + 4, GRID_SIZE / 12);

                    ctx.fillStyle = '#3a2a1d';
                    ctx.fillRect(cellX + GRID_SIZE / 4 + 2, cellY + GRID_SIZE * 2 / 3 + 3, GRID_SIZE / 2 - 4, GRID_SIZE / 12);

                    ctx.fillStyle = '#228B22';
                    ctx.beginPath();
                    ctx.arc(cellX + GRID_SIZE / 2, cellY + GRID_SIZE / 3, GRID_SIZE / 3, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#32CD32';
                    ctx.beginPath();
                    ctx.arc(cellX + GRID_SIZE / 2 + GRID_SIZE / 5, cellY + GRID_SIZE / 3 - GRID_SIZE / 8, GRID_SIZE / 5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(cellX + GRID_SIZE / 2 - GRID_SIZE / 6, cellY + GRID_SIZE / 4, GRID_SIZE / 6, 0, Math.PI * 2);
                    ctx.fill();
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
    drawOffice();
    drawPeople();
}

function animate() {
    update();
    draw();
}

function connectToApi() {
    if (!apiConnected) {
        apiConnected = true;
        updateConnectionStatus(true);
        fetchChainData();
        if (!animationTimer) {
            animationTimer = setInterval(animate, ANIMATION_SPEED);
        }
        debugLog("API Connected");
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

function updateConnectionStatus(connected) {
    const dot = document.getElementById('api-status-dot');
    if (!dot) return;
    if (connected) {
        dot.classList.remove('disconnected-dot');
        dot.classList.add('connected-dot');
    } else {
        dot.classList.remove('connected-dot');
        dot.classList.add('disconnected-dot');
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
            document.getElementById('chain-info').textContent = `Chain Length: ${chainLength} (${data.network})`;
            if (chainLength > lastFetchTime) {
                updateSyncStatus("New blockchain data found!");
                queueReasoningFetches(true);
                lastFetchTime = chainLength;
            } else {
                updateSyncStatus("No new blockchain data.");
                queueReasoningFetches(false);
            }
        }
    } catch (err) {
        console.error("Error fetching chain data", err);
        debugLog("Error fetching chain data");
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
        debugLog("Abort fetch: Not connected or no chain length");
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

document.getElementById('connectBtn').addEventListener('click', () => {
    if (apiConnected) {
        disconnectFromApi();
        document.getElementById('connectBtn').textContent = 'Connect to API';
    } else {
        connectToApi();
        document.getElementById('connectBtn').textContent = 'Disconnect from API';
    }
});

let canvasOffset = { x: 0, y: 0 };
let isDragging = false;
let startDragX = 0;
let isMobileView = window.innerWidth < 768;

function setupMobileScrolling() {
    if (!canvas) return;

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

            const maxScroll = canvas.width - window.innerWidth;
            canvasOffset.x = Math.min(0, Math.max(-maxScroll, canvasOffset.x));

            startDragX = currentX;
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

            const maxScroll = canvas.width - window.innerWidth;
            canvasOffset.x = Math.min(0, Math.max(-maxScroll, canvasOffset.x));

            startDragX = e.clientX;
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('resize', () => {
        isMobileView = window.innerWidth < 768;
        if (!isMobileView) {
            canvasOffset = { x: 0, y: 0 };
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    if (isMobileView) {
        ctx.translate(canvasOffset.x, canvasOffset.y);
    }

    drawOffice();
    drawPeople();

    ctx.restore();
}

start();

setupMobileScrolling();

setTimeout(() => {
    for (const person of people) {
        person.wander();
        person.state = 'walking';
        person.speak('Taking a walk');
    }

    setTimeout(startTaskScheduler, 5000);
}, 2000);
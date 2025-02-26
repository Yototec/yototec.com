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
        this.animationSpeed = 0.5;
        this.animationPhase = 0; // New property for smoother animation

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
        // Enhanced leg animation with smoother movement
        const legAngle = Math.sin(this.animationPhase * Math.PI / 10);
        const legSpread = this.state === 'walking' ? legAngle * 4 : 0;
        const legHeight = this.state === 'walking' ? this.legHeight + Math.abs(legAngle) * 2 : this.legHeight;

        // Draw legs with better animation
        ctx.fillStyle = this.uniformColor;
        // Left leg with dynamic position
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y + this.bodyHeight / 2,
            this.legWidth,
            legHeight - legSpread
        );
        // Right leg with opposite phase
        ctx.fillRect(
            x + this.bodyWidth / 2 - this.legWidth,
            y + this.bodyHeight / 2,
            this.legWidth,
            legHeight + legSpread
        );

        // Draw body/uniform with rounded corners
        ctx.fillStyle = this.uniformColor;
        this.roundedRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight,
            4
        );

        // Add shirt collar
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x - this.bodyWidth / 4, y - this.bodyHeight / 2 + 5);
        ctx.lineTo(x, y - this.bodyHeight / 2 + 12);
        ctx.lineTo(x + this.bodyWidth / 4, y - this.bodyHeight / 2 + 5);
        ctx.fill();

        // Add ticker logo on uniform
        this.drawTickerLogo(x, y - this.bodyHeight / 5, this.ticker);

        // Enhanced arm animation for walking
        const armAngle = Math.sin(this.animationPhase * Math.PI / 10 + Math.PI); // Opposite phase to legs
        const armOffset = this.state === 'walking' ? armAngle * 3 : 0;

        ctx.fillStyle = this.uniformColor;
        // Left arm with dynamic position
        this.roundedRect(
            x - this.bodyWidth / 2 - this.armWidth,
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth,
            this.armHeight,
            3
        );
        // Right arm with opposite phase
        this.roundedRect(
            x + this.bodyWidth / 2,
            y - this.bodyHeight / 4 - armOffset,
            this.armWidth,
            this.armHeight,
            3
        );

        // Draw hands
        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x - this.bodyWidth / 2 - this.armWidth / 2,
            y - this.bodyHeight / 4 + this.armHeight + armOffset,
            this.armWidth / 2 + 1,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
            x + this.bodyWidth / 2 + this.armWidth / 2,
            y - this.bodyHeight / 4 + this.armHeight - armOffset,
            this.armWidth / 2 + 1,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw head with skin color
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

        // Draw eyes
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

        // Draw mouth
        ctx.beginPath();
        ctx.arc(
            x,
            y - this.bodyHeight / 2 - this.headSize / 2 + this.headSize / 4,
            this.headSize / 6,
            0.1 * Math.PI,
            0.9 * Math.PI,
            false
        );
        ctx.stroke();

        // Add hair based on ticker
        this.drawHair(x, y - this.bodyHeight / 2 - this.headSize / 2, 'front');
    }

    drawFromBehind(x, y) {
        // Enhanced leg animation with smoother movement
        const legAngle = Math.sin(this.animationPhase * Math.PI / 10);
        const legSpread = this.state === 'walking' ? legAngle * 4 : 0;
        const legHeight = this.state === 'walking' ? this.legHeight + Math.abs(legAngle) * 2 : this.legHeight;

        // Draw legs with better animation
        ctx.fillStyle = this.uniformColor;
        // Left leg
        ctx.fillRect(
            x - this.bodyWidth / 2,
            y + this.bodyHeight / 2,
            this.legWidth,
            legHeight - legSpread
        );
        // Right leg
        ctx.fillRect(
            x + this.bodyWidth / 2 - this.legWidth,
            y + this.bodyHeight / 2,
            this.legWidth,
            legHeight + legSpread
        );

        // Draw body/uniform with rounded corners
        ctx.fillStyle = this.uniformColor;
        this.roundedRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight,
            4
        );

        // Add ticker logo on back of uniform
        this.drawTickerLogo(x, y - this.bodyHeight / 5, this.ticker);

        // Enhanced arm animation for walking
        const armAngle = Math.sin(this.animationPhase * Math.PI / 10 + Math.PI); // Opposite phase to legs
        const armOffset = this.state === 'walking' ? armAngle * 3 : 0;

        ctx.fillStyle = this.uniformColor;
        // Left arm
        this.roundedRect(
            x - this.bodyWidth / 2 - this.armWidth,
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth,
            this.armHeight,
            3
        );
        // Right arm
        this.roundedRect(
            x + this.bodyWidth / 2,
            y - this.bodyHeight / 4 - armOffset,
            this.armWidth,
            this.armHeight,
            3
        );

        // Draw hands
        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x - this.bodyWidth / 2 - this.armWidth / 2,
            y - this.bodyHeight / 4 + this.armHeight + armOffset,
            this.armWidth / 2 + 1,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
            x + this.bodyWidth / 2 + this.armWidth / 2,
            y - this.bodyHeight / 4 + this.armHeight - armOffset,
            this.armWidth / 2 + 1,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw head with skin color
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

        // Add hair from behind
        this.drawHair(x, y - this.bodyHeight / 2 - this.headSize / 2, 'back');
    }

    drawFromSide(x, y, side) {
        const direction = (side === 'left') ? -1 : 1;

        // Enhanced leg animation with smoother movement
        const legPhase = this.animationPhase * Math.PI / 10;
        const frontLegAngle = Math.sin(legPhase);
        const backLegAngle = Math.sin(legPhase + Math.PI); // Opposite phase
        const frontLegOffset = this.state === 'walking' ? frontLegAngle * 4 : 0;
        const backLegOffset = this.state === 'walking' ? backLegAngle * 4 : 0;

        // Draw legs with better animation
        ctx.fillStyle = this.uniformColor;
        // Front leg
        ctx.fillRect(
            x + direction * (this.bodyWidth / 4),
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight + frontLegOffset
        );
        // Back leg
        ctx.fillRect(
            x - direction * (this.bodyWidth / 4),
            y + this.bodyHeight / 2,
            this.legWidth,
            this.legHeight + backLegOffset
        );

        // Draw body/uniform with rounded corners
        ctx.fillStyle = this.uniformColor;
        this.roundedRect(
            x - this.bodyWidth / 2,
            y - this.bodyHeight / 2,
            this.bodyWidth,
            this.bodyHeight,
            4
        );

        // Add ticker symbol on side of uniform
        ctx.font = '10px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.ticker,
            x,
            y
        );

        // Enhanced arm animation for walking
        const armAngle = Math.sin(this.animationPhase * Math.PI / 10 + Math.PI); // Opposite phase to legs
        const armOffset = this.state === 'walking' ? armAngle * 3 : 0;

        ctx.fillStyle = this.uniformColor;
        this.roundedRect(
            x + direction * (this.bodyWidth / 4),
            y - this.bodyHeight / 4 + armOffset,
            this.armWidth * direction,
            this.armHeight,
            3
        );

        // Draw hand
        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x + direction * (this.bodyWidth / 4 + this.armWidth / 2 * direction),
            y - this.bodyHeight / 4 + this.armHeight + armOffset,
            this.armWidth / 2 + 1,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw head with skin color
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

        // Draw eye
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

        // Draw ear on the visible side
        ctx.fillStyle = COLORS.skin;
        ctx.beginPath();
        ctx.arc(
            x + direction * (this.bodyWidth / 4 + this.headSize / 2 - 2),
            y - this.bodyHeight / 2 - this.headSize / 2,
            this.headSize / 6,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Add hair from side
        this.drawHair(x + direction * (this.bodyWidth / 4), y - this.bodyHeight / 2 - this.headSize / 2, side);

        // Draw mouth from side
        ctx.beginPath();
        ctx.moveTo(
            x + direction * (this.bodyWidth / 4 + this.headSize / 8),
            y - this.bodyHeight / 2 - this.headSize / 2 + this.headSize / 4
        );
        ctx.lineTo(
            x + direction * (this.bodyWidth / 4 + this.headSize / 3),
            y - this.bodyHeight / 2 - this.headSize / 2 + this.headSize / 4
        );
        ctx.stroke();
    }

    // Helper method to draw rounded rectangles
    roundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    // Helper method to draw ticker logos
    drawTickerLogo(x, y, ticker) {
        const logoSize = this.bodyWidth * 0.4;

        ctx.save();
        ctx.translate(x, y);

        switch (ticker.toLowerCase()) {
            case 'btc':
                // Bitcoin logo
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, logoSize / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#F7931A';
                ctx.font = `bold ${logoSize * 0.8}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('₿', 0, 0);
                break;

            case 'eth':
                // Ethereum logo
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, logoSize / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#627EEA';
                ctx.font = `bold ${logoSize * 0.8}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Ξ', 0, 0);
                break;

            case 'sol':
                // Solana logo
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, logoSize / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#00FFA3';
                ctx.font = `bold ${logoSize * 0.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('SOL', 0, 0);
                break;

            case 'doge':
                // Dogecoin logo
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, logoSize / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#C3A634';
                ctx.font = `bold ${logoSize * 0.4}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('DOGE', 0, -2);

                // Simple dog ears
                ctx.beginPath();
                ctx.moveTo(-logoSize / 4, -logoSize / 3);
                ctx.lineTo(-logoSize / 2, -logoSize / 2);
                ctx.lineTo(-logoSize / 5, -logoSize / 5);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(logoSize / 4, -logoSize / 3);
                ctx.lineTo(logoSize / 2, -logoSize / 2);
                ctx.lineTo(logoSize / 5, -logoSize / 5);
                ctx.fill();
                break;
        }

        ctx.restore();
    }

    // Helper method to draw hair based on character
    drawHair(x, y, view) {
        const hairColors = {
            btc: '#8B4513', // brown hair for Bitcoin
            eth: '#000000', // black hair for Ethereum
            sol: '#FFD700', // blonde hair for Solana
            doge: '#A0522D'  // auburn hair for Doge
        };

        ctx.fillStyle = hairColors[this.ticker.toLowerCase()];

        if (view === 'front') {
            // Front view hair
            ctx.beginPath();
            ctx.arc(x, y - this.headSize / 6, this.headSize / 2 + 2, Math.PI, 2 * Math.PI);
            ctx.fill();

            // Add hair tufts based on character
            if (this.ticker.toLowerCase() === 'btc') {
                // Short business-like hair
                ctx.beginPath();
                ctx.moveTo(x - this.headSize / 2, y - this.headSize / 3);
                ctx.quadraticCurveTo(x - this.headSize / 4, y - this.headSize / 2, x, y - this.headSize / 2);
                ctx.quadraticCurveTo(x + this.headSize / 4, y - this.headSize / 2, x + this.headSize / 2, y - this.headSize / 3);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'eth') {
                // Modern tech look
                ctx.beginPath();
                ctx.moveTo(x - this.headSize / 2, y - this.headSize / 4);
                ctx.quadraticCurveTo(x, y - this.headSize, x + this.headSize / 2, y - this.headSize / 4);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'sol') {
                // Trendy hairstyle
                ctx.beginPath();
                ctx.moveTo(x - this.headSize / 2, y - this.headSize / 3);
                ctx.quadraticCurveTo(x, y - this.headSize * 0.9, x + this.headSize / 2, y - this.headSize / 3);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'doge') {
                // Fun, playful hair
                ctx.beginPath();
                for (let i = -3; i <= 3; i++) {
                    ctx.moveTo(x + i * (this.headSize / 6), y - this.headSize / 2);
                    ctx.lineTo(x + i * (this.headSize / 6), y - this.headSize * 0.7 - Math.abs(i) * 2);
                }
                ctx.stroke();
                ctx.fill();
            }
        } else if (view === 'back') {
            // Back view hair
            ctx.beginPath();
            ctx.arc(x, y, this.headSize / 2 + 2, 0, Math.PI);
            ctx.fill();

            // Add character-specific back hair
            if (this.ticker.toLowerCase() === 'eth' || this.ticker.toLowerCase() === 'sol') {
                // Longer hair in back for some characters
                ctx.beginPath();
                ctx.moveTo(x - this.headSize / 2, y);
                ctx.quadraticCurveTo(x, y + this.headSize / 3, x + this.headSize / 2, y);
                ctx.fill();
            }
        } else {
            // Side view hair (left or right)
            const direction = view === 'left' ? -1 : 1;

            // Basic side hair shape
            ctx.beginPath();
            ctx.arc(x, y, this.headSize / 2 + 2, Math.PI * 0.5, Math.PI * 1.5);
            ctx.fill();

            // Character specific side hair
            if (this.ticker.toLowerCase() === 'btc') {
                // Short business cut
                ctx.beginPath();
                ctx.arc(x, y - this.headSize / 4, this.headSize / 2, Math.PI * 1.1, Math.PI * 1.9);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'eth') {
                // Modern tech look
                ctx.beginPath();
                ctx.moveTo(x - direction * this.headSize / 4, y - this.headSize / 2);
                ctx.quadraticCurveTo(x, y - this.headSize * 0.8, x + direction * this.headSize / 3, y - this.headSize / 4);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'sol') {
                // Trendy hairstyle
                ctx.beginPath();
                ctx.moveTo(x - direction * this.headSize / 4, y - this.headSize / 2);
                ctx.quadraticCurveTo(x, y - this.headSize * 0.9, x + direction * this.headSize / 4, y - this.headSize / 2);
                ctx.fill();
            } else if (this.ticker.toLowerCase() === 'doge') {
                // Fun, playful hair
                ctx.beginPath();
                for (let i = -1; i <= 1; i++) {
                    ctx.moveTo(x + i * (this.headSize / 6), y - this.headSize / 2);
                    ctx.lineTo(x + i * (this.headSize / 6), y - this.headSize * 0.7 - Math.abs(i) * 2);
                }
                ctx.stroke();
                ctx.fill();
            }
        }
    }

    update() {
        if (this.messageTime > 0) {
            this.messageTime--;
        }

        // Update animation
        if (this.state === 'walking') {
            this.animationPhase += this.animationSpeed;
            if (this.animationPhase >= 20) {
                this.animationPhase = 0;
            }
            this.animationFrame = Math.floor(this.animationPhase);
        } else {
            this.animationPhase = 0;
            this.animationFrame = 0;
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
                    if (rand < 0.15) {
                        this.goToDesk();
                    } else if (rand < 0.3) {
                        this.wander();
                        this.state = 'walking';
                        this.speak('Taking a walk');
                    } else if (rand < 0.5) {
                        this.findInteraction();
                    } else if (rand < 0.65) {
                        this.goToTable();
                    } else if (rand < 0.8) {
                        this.goToCoffee();
                    } else {
                        this.goToWindow();
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
                    } else if (this.isNearTable()) {
                        this.state = 'resting';
                        this.stateTime = 0;
                        this.speak('Taking a breather');
                        // Face the table
                        const tableCenterX = Math.floor(COLS / 2);
                        const tableCenterY = Math.floor(ROWS / 2);
                        if (this.x < tableCenterX) this.facingDirection = 'right';
                        else if (this.x > tableCenterX) this.facingDirection = 'left';
                        else if (this.y < tableCenterY) this.facingDirection = 'down';
                        else this.facingDirection = 'up';
                    } else if (this.isNearCoffee()) {
                        this.state = 'makingCoffee';
                        this.stateTime = 0;
                        this.speak('Making a coffee');
                        // Face the coffee machine
                        const coffeeCenterX = Math.floor(COLS / 2) + 3;
                        const coffeeCenterY = Math.floor(ROWS / 2) - 1;
                        if (this.x < coffeeCenterX) this.facingDirection = 'right';
                        else if (this.x > coffeeCenterX + 1) this.facingDirection = 'left';
                        else if (this.y < coffeeCenterY) this.facingDirection = 'down';
                        else if (this.y > coffeeCenterY + 1) this.facingDirection = 'up';
                    } else if (this.isNearWindow()) {
                        this.state = 'takingFreshAir';
                        this.stateTime = 0;
                        this.speak('Enjoying the view');
                        // Face the window
                        if (this.y === 1) {
                            this.facingDirection = 'up'; // Top window
                        } else if (this.x === COLS - 2) {
                            this.facingDirection = 'right'; // Right window
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

            case 'resting':
                this.stateTime++;
                if (this.stateTime > 12) {
                    this.state = 'idle';
                    this.stateTime = 0;

                    // Occasionally say something when finished resting
                    if (Math.random() < 0.6) {
                        const restingComments = [
                            "That was refreshing",
                            "Back to work now",
                            "Feeling recharged",
                            "That was a good break",
                            "Time to be productive again"
                        ];
                        this.speak(restingComments[Math.floor(Math.random() * restingComments.length)]);
                    }
                } else if (this.stateTime === 6 && Math.random() < 0.4) {
                    // Occasionally say something while resting
                    const tableComments = [
                        "This market never sleeps",
                        "Sometimes you need a moment to think",
                        "The office view is nice today",
                        "I should grab coffee next",
                        `${this.ticker} analysis is tough today`,
                        "I've been tracking some interesting patterns"
                    ];
                    this.speak(tableComments[Math.floor(Math.random() * tableComments.length)]);
                }
                break;

            case 'makingCoffee':
                this.stateTime++;
                // First phase - making coffee
                if (this.stateTime === 4) {
                    this.speak('Coffee brewing...');
                }
                // Second phase - drinking coffee
                else if (this.stateTime === 8) {
                    const coffeeComments = [
                        "Ah, that's the good stuff",
                        "Perfect! Just what I needed",
                        "Nothing like a fresh cup of coffee",
                        "This coffee is excellent",
                        "Caffeine boost initiated"
                    ];
                    this.speak(coffeeComments[Math.floor(Math.random() * coffeeComments.length)]);
                }
                // Finish coffee break
                else if (this.stateTime > 12) {
                    this.state = 'idle';
                    this.stateTime = 0;

                    // Occasionally say something after coffee
                    if (Math.random() < 0.5) {
                        const afterCoffeeComments = [
                            "Now I can focus better",
                            "Ready to analyze some data",
                            "That cleared my mind",
                            "Now back to crypto analysis",
                            "Coffee really helps with the market patterns"
                        ];
                        this.speak(afterCoffeeComments[Math.floor(Math.random() * afterCoffeeComments.length)]);
                    }
                }
                break;

            case 'takingFreshAir':
                this.stateTime++;
                if (this.stateTime === 5) {
                    const freshAirComments = [
                        "The fresh air feels nice",
                        "What a beautiful day outside",
                        "Taking a moment to clear my thoughts",
                        "The view helps with perspective",
                        "Sometimes you need to look outside to see clearly"
                    ];
                    this.speak(freshAirComments[Math.floor(Math.random() * freshAirComments.length)]);
                }
                // End fresh air break
                else if (this.stateTime > 12) {
                    this.state = 'idle';
                    this.stateTime = 0;
                    
                    // Occasionally say something about market insights when finishing
                    if (Math.random() < 0.4) {
                        const marketInsights = [
                            "I just had a new insight about the market",
                            "I think I see a pattern now",
                            "Sometimes distance brings clarity",
                            `The ${this.ticker} trend is becoming clearer now`,
                            "Back to work with a fresh perspective"
                        ];
                        this.speak(marketInsights[Math.floor(Math.random() * marketInsights.length)]);
                    }
                }
                break;
        }
    }

    isNearTable() {
        const tableCenterX = Math.floor(COLS / 2);
        const tableCenterY = Math.floor(ROWS / 2);
        const tableWidth = 4;
        const tableHeight = 2;

        // Check if the person is adjacent to the table
        for (let dx = -Math.floor(tableWidth / 2) - 1; dx <= Math.ceil(tableWidth / 2); dx++) {
            for (let dy = -Math.floor(tableHeight / 2) - 1; dy <= Math.ceil(tableHeight / 2); dy++) {
                const tableX = tableCenterX + dx;
                const tableY = tableCenterY + dy;

                // Check if this is a table cell
                const isTable = (
                    dx >= -Math.floor(tableWidth / 2) &&
                    dx < Math.ceil(tableWidth / 2) &&
                    dy >= -Math.floor(tableHeight / 2) &&
                    dy < Math.ceil(tableHeight / 2)
                );

                // If it's a table cell and the person is adjacent to it
                if (isTable && Math.abs(this.x - tableX) <= 1 && Math.abs(this.y - tableY) <= 1) {
                    return true;
                }
            }
        }

        return false;
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

    findTableLocation() {
        // Get table center coordinates
        const tableCenterX = Math.floor(COLS / 2);
        const tableCenterY = Math.floor(ROWS / 2);
        const tableWidth = 4;
        const tableHeight = 2;

        // Find empty cells around the table
        const tableCells = [];

        // Check cells along the perimeter of the table
        for (let dx = -Math.floor(tableWidth / 2) - 1; dx <= Math.ceil(tableWidth / 2); dx++) {
            for (let dy = -Math.floor(tableHeight / 2) - 1; dy <= Math.ceil(tableHeight / 2); dy++) {
                // Only consider cells that are exactly adjacent to the table
                const isTableAdjacent =
                    (dx === -Math.floor(tableWidth / 2) - 1 && dy >= -Math.floor(tableHeight / 2) && dy < Math.ceil(tableHeight / 2)) ||
                    (dx === Math.ceil(tableWidth / 2) && dy >= -Math.floor(tableHeight / 2) && dy < Math.ceil(tableHeight / 2)) ||
                    (dy === -Math.floor(tableHeight / 2) - 1 && dx >= -Math.floor(tableWidth / 2) && dx < Math.ceil(tableWidth / 2)) ||
                    (dy === Math.ceil(tableHeight / 2) && dx >= -Math.floor(tableWidth / 2) && dx < Math.ceil(tableWidth / 2));

                if (isTableAdjacent) {
                    const x = tableCenterX + dx;
                    const y = tableCenterY + dy;
                    if (isWalkable(x, y)) {
                        tableCells.push({ x, y });
                    }
                }
            }
        }

        // If we found valid cells, return a random one
        if (tableCells.length > 0) {
            return tableCells[Math.floor(Math.random() * tableCells.length)];
        }

        // Fallback to a position near the center if no valid cells
        return { x: tableCenterX + 3, y: tableCenterY + 3 };
    }

    goToTable() {
        const tablePos = this.findTableLocation();
        this.setDestination(tablePos.x, tablePos.y);
        this.state = 'walking';
        this.speak('Going to take a break at the table');
    }

    findCoffeeLocation() {
        // Coffee machine is located slightly to the right of center
        const coffeeCenterX = Math.floor(COLS / 2) + 3.5;
        const coffeeCenterY = Math.floor(ROWS / 2) - 0.5;
        const coffeeWidth = 2;
        const coffeeHeight = 2;

        // Find empty cells around the coffee machine
        const coffeeCells = [];

        // Check cells along the perimeter of the coffee machine
        for (let dx = -coffeeWidth / 2 - 1; dx <= coffeeWidth / 2; dx++) {
            for (let dy = -coffeeHeight / 2 - 1; dy <= coffeeHeight / 2; dy++) {
                // Only consider cells that are exactly adjacent to the coffee machine
                const isCoffeeAdjacent =
                    (dx === -coffeeWidth / 2 - 1 && dy >= -coffeeHeight / 2 && dy < coffeeHeight / 2) ||
                    (dx === coffeeWidth / 2 && dy >= -coffeeHeight / 2 && dy < coffeeHeight / 2) ||
                    (dy === -coffeeHeight / 2 - 1 && dx >= -coffeeWidth / 2 && dx < coffeeWidth / 2) ||
                    (dy === coffeeHeight / 2 && dx >= -coffeeWidth / 2 && dx < coffeeWidth / 2);

                if (isCoffeeAdjacent) {
                    const x = Math.floor(coffeeCenterX + dx);
                    const y = Math.floor(coffeeCenterY + dy);
                    if (isWalkable(x, y)) {
                        coffeeCells.push({ x, y });
                    }
                }
            }
        }

        // If we found valid cells, return a random one
        if (coffeeCells.length > 0) {
            return coffeeCells[Math.floor(Math.random() * coffeeCells.length)];
        }

        // Fallback to a position near the coffee machine if no valid cells
        return { x: Math.floor(coffeeCenterX) + 2, y: Math.floor(coffeeCenterY) + 2 };
    }

    goToCoffee() {
        const coffeePos = this.findCoffeeLocation();
        this.setDestination(coffeePos.x, coffeePos.y);
        this.state = 'walking';
        this.speak('Need some coffee to stay focused');
    }

    isNearCoffee() {
        const coffeeCenterX = Math.floor(COLS / 2) + 3.5;
        const coffeeCenterY = Math.floor(ROWS / 2) - 0.5;
        const coffeeWidth = 2;
        const coffeeHeight = 2;

        // Check if the person is adjacent to the coffee machine
        for (let dx = -coffeeWidth / 2 - 1; dx <= coffeeWidth / 2; dx++) {
            for (let dy = -coffeeHeight / 2 - 1; dy <= coffeeHeight / 2; dy++) {
                const coffeeX = Math.floor(coffeeCenterX + dx);
                const coffeeY = Math.floor(coffeeCenterY + dy);

                // Check if this is a coffee machine cell
                const isCoffee = (
                    dx >= -coffeeWidth / 2 &&
                    dx < coffeeWidth / 2 &&
                    dy >= -coffeeHeight / 2 &&
                    dy < coffeeHeight / 2
                );

                // If it's a coffee machine cell and the person is adjacent to it
                if (isCoffee && Math.abs(this.x - coffeeX) <= 1 && Math.abs(this.y - coffeeY) <= 1) {
                    return true;
                }
            }
        }

        return false;
    }

    findWindowLocation() {
        const windowLocations = [];
        
        // Check top wall windows
        for (let x = 3; x < COLS - 3; x += 3) {
            if (office[0][x] === OBJECTS.WINDOW || office[0][x + 1] === OBJECTS.WINDOW) {
                // Check the cell below the window
                if (isWalkable(x, 1)) windowLocations.push({ x, y: 1 });
                if (isWalkable(x + 1, 1)) windowLocations.push({ x: x + 1, y: 1 });
            }
        }
        
        // Check right wall windows
        for (let y = 3; y < ROWS - 6; y += 3) {
            if (office[y][COLS - 1] === OBJECTS.WINDOW || office[y + 1][COLS - 1] === OBJECTS.WINDOW) {
                // Check the cell to the left of the window
                if (isWalkable(COLS - 2, y)) windowLocations.push({ x: COLS - 2, y });
                if (isWalkable(COLS - 2, y + 1)) windowLocations.push({ x: COLS - 2, y: y + 1 });
            }
        }
        
        // If we found valid cells, return a random one
        if (windowLocations.length > 0) {
            return windowLocations[Math.floor(Math.random() * windowLocations.length)];
        }
        
        // Fallback to a position near a wall if no valid window locations
        return { x: 1, y: 1 };
    }

    goToWindow() {
        const windowPos = this.findWindowLocation();
        this.setDestination(windowPos.x, windowPos.y);
        this.state = 'walking';
        this.speak('Going to get some fresh air');
    }

    isNearWindow() {
        // Check if adjacent to a window on the top wall
        if (this.y === 1) {
            if (office[0][this.x] === OBJECTS.WINDOW) return true;
            if (this.x > 0 && office[0][this.x - 1] === OBJECTS.WINDOW) return true;
            if (this.x < COLS - 1 && office[0][this.x + 1] === OBJECTS.WINDOW) return true;
        }
        
        // Check if adjacent to a window on the right wall
        if (this.x === COLS - 2) {
            if (office[this.y][COLS - 1] === OBJECTS.WINDOW) return true;
            if (this.y > 0 && office[this.y - 1][COLS - 1] === OBJECTS.WINDOW) return true;
            if (this.y < ROWS - 1 && office[this.y + 1][COLS - 1] === OBJECTS.WINDOW) return true;
        }
        
        return false;
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
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
class Dog {
    constructor() {
        // Find a valid starting position
        let validPosition = false;
        while (!validPosition) {
            this.x = Math.floor(Math.random() * COLS);
            this.y = Math.floor(Math.random() * ROWS);
            validPosition = isWalkable(this.x, this.y);
        }

        this.state = 'wandering';
        this.stateTime = 0;
        this.path = [];
        this.animationFrame = 0;
        this.animationPhase = 0;
        this.animationSpeed = 0.5;
        this.facingDirection = 'right';
        this.beingPetBy = null;
        this.messageText = '';
        this.messageTime = 0;
    }

    update() {
        // Update animation
        this.animationPhase += this.animationSpeed;
        if (this.animationPhase >= 12) {
            this.animationPhase = 0;
        }
        this.animationFrame = Math.floor(this.animationPhase) % 4;

        // If being pet, stay still
        if (this.beingPetBy) {
            this.state = 'beingPet';
            this.stateTime++;

            if (this.stateTime > 8) {
                this.beingPetBy = null;
                this.state = 'wandering';
                this.stateTime = 0;
                this.woof();
            }
            return;
        }

        // Handle states
        switch (this.state) {
            case 'wandering':
                // Move along path if we have one
                if (this.path.length > 0) {
                    const nextPoint = this.path.shift();

                    // Set facing direction based on movement
                    if (nextPoint.x > this.x) this.facingDirection = 'right';
                    else if (nextPoint.x < this.x) this.facingDirection = 'left';

                    this.x = nextPoint.x;
                    this.y = nextPoint.y;
                } else {
                    // Pick a new random destination occasionally
                    this.stateTime++;
                    if (this.stateTime > 15) {
                        this.wander();
                        this.stateTime = 0;
                    }
                }
                break;

            case 'idle':
                this.stateTime++;
                if (this.stateTime > 10) {
                    this.state = 'wandering';
                    this.stateTime = 0;
                    this.wander();
                }
                break;
        }

        // Update message timer
        if (this.messageTime > 0) {
            this.messageTime--;
        } else {
            // Increased chance to bark (0.01 = 1% chance per update)
            if (Math.random() < 0.01) {
                this.cuteBark();
            }
        }
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
            // Stay idle if no valid moves
            this.state = 'idle';
        }
    }

    setDestination(x, y) {
        this.path = findPath(this.x, this.y, x, y);
    }

    draw() {
        const x = this.x * GRID_SIZE;
        const y = this.y * GRID_SIZE;

        ctx.save();

        // Flip the drawing if facing left
        if (this.facingDirection === 'left') {
            ctx.translate(x + GRID_SIZE, y);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(x, y);
        }

        // Get animation values
        const walkBounce = this.state === 'wandering' ? Math.sin(this.animationPhase * 0.8) * 2 : 0;
        const tailWag = this.state === 'beingPet' ?
            Math.sin(this.animationPhase * 1.2) * 6 :
            Math.sin(this.animationPhase * 0.6) * 3;

        // Shiba Inu colors
        const primaryColor = '#E37F00';    // Fox-red/orange
        const secondaryColor = '#FFFFFF';  // White
        const maskColor = '#FFF0CC';       // Light cream for face mask
        const noseColor = '#000000';       // Black nose
        const eyeColor = '#402416';        // Dark brown eyes

        // Legs with proper animation
        const legOffset = this.state === 'wandering' ?
            [Math.sin(this.animationPhase) * 3, Math.sin(this.animationPhase + Math.PI) * 3] : [0, 0];

        // Front leg (white sock)
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.roundRect(10, 28 + legOffset[0], 5, 8, 2);
        ctx.fill();

        // Back leg (white sock)
        ctx.beginPath();
        ctx.roundRect(22, 28 + legOffset[1], 5, 8, 2);
        ctx.fill();

        // Body
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.ellipse(18, 22 + walkBounce / 2, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // White chest/underside
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.ellipse(14, 25 + walkBounce / 2, 8, 5, -0.2, 0, Math.PI);
        ctx.fill();

        // Curled-up tail (characteristic of Shiba Inu)
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.moveTo(28, 18 + walkBounce / 2);
        ctx.bezierCurveTo(
            32, 14 + tailWag,
            38, 16 + tailWag,
            34, 19 + tailWag
        );
        ctx.bezierCurveTo(
            31, 22 + tailWag,
            28, 20 + tailWag,
            28, 18 + walkBounce / 2
        );
        ctx.fill();

        // Neck
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.ellipse(10, 20 + walkBounce / 2, 6, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Head - slightly larger and more fox-like
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.ellipse(5, 15 + walkBounce, 7, 6, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // White facial mask (Shiba characteristic)
        ctx.fillStyle = maskColor;
        ctx.beginPath();
        ctx.ellipse(3, 17 + walkBounce, 5, 4.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Ears - pointed and upright (Shiba characteristic)
        ctx.fillStyle = primaryColor;

        // Left ear (triangular and pointed)
        ctx.beginPath();
        ctx.moveTo(2, 11 + walkBounce);
        ctx.lineTo(-2, 5 + walkBounce);
        ctx.lineTo(5, 8 + walkBounce);
        ctx.closePath();
        ctx.fill();

        // Right ear (triangular and pointed)
        ctx.beginPath();
        ctx.moveTo(10, 10 + walkBounce);
        ctx.lineTo(14, 4 + walkBounce);
        ctx.lineTo(7, 7 + walkBounce);
        ctx.closePath();
        ctx.fill();

        // Snout
        ctx.fillStyle = maskColor;
        ctx.beginPath();
        ctx.ellipse(0, 18 + walkBounce, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose - black and smaller
        ctx.fillStyle = noseColor;
        ctx.beginPath();
        ctx.ellipse(-2, 18 + walkBounce, 1.5, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes - almond shaped
        ctx.fillStyle = eyeColor;

        // Left eye - more almond shaped
        ctx.beginPath();
        ctx.ellipse(2, 14 + walkBounce, 1.5, this.state === 'beingPet' ? 0.5 : 1.2, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Right eye - more almond shaped
        ctx.beginPath();
        ctx.ellipse(7, 13.5 + walkBounce, 1.5, this.state === 'beingPet' ? 0.5 : 1.2, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Mouth - usually looks like a slight smile
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.8;
        ctx.beginPath();

        // Fix: Improved detection of barking animations
        const isBarking = this.messageTime > 0 && (
            this.messageText.includes("Woof") ||
            this.messageText.includes("Bark") ||
            this.messageText.includes("Arf")
        );

        if (isBarking) {
            // Open mouth when barking
            ctx.moveTo(-1, 20 + walkBounce);
            ctx.bezierCurveTo(
                0, 22 + walkBounce,
                3, 22 + walkBounce,
                4, 20 + walkBounce
            );

            // Tongue
            ctx.fillStyle = '#FF7F7F'; // Pink
            ctx.beginPath();
            ctx.ellipse(1.5, 21 + walkBounce, 1.8, 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Typical Shiba slight smile
            ctx.moveTo(-1, 19.5 + walkBounce);
            ctx.bezierCurveTo(
                0, 20.5 + walkBounce,
                3, 20.5 + walkBounce,
                4, 19.5 + walkBounce
            );
        }
        ctx.stroke();

        // Collar
        ctx.fillStyle = '#E53935'; // Red collar (traditional Japanese style)
        ctx.beginPath();
        ctx.rect(4, 22 + walkBounce, 10, 2);
        ctx.fill();

        // Collar tag
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.beginPath();
        ctx.arc(9, 23 + walkBounce, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw speech bubble if the dog is communicating
        if (this.messageTime > 0 && this.messageText) {
            drawSpeechBubble(
                x + GRID_SIZE / 2,
                y - 10,
                this.messageText,
                100
            );
        }
    }

    woof() {
        const woofs = [
            "Woof!",
            "Bark!",
            "*wags tail happily*",
            "*happy panting*",
            "Arf!",
            "*excited tail wagging*",
            "*playful bark*",
            "*rolls over*",
            "*looks at you lovingly*",
            "*licks hand*",
            "*nuzzles analyst*",
            "*doge smile*",
            "*happy Shiba noises*",
            "*ears perk up*",
            "*jumps excitedly*"
        ];
        this.messageText = woofs[Math.floor(Math.random() * woofs.length)];
        this.messageTime = 60;
    }

    isPettable(person) {
        return Math.abs(person.x - this.x) <= 1 && Math.abs(person.y - this.y) <= 1;
    }

    getPetBy(person) {
        if (this.beingPetBy) return false;

        this.beingPetBy = person.name;
        this.stateTime = 0;
        this.woof();
        return true;
    }

    cuteBark() {
        const cuteBarks = [
            "Woof woof!",
            "Arf arf!",
            "*sniffs curiously*",
            "*tilts head*",
            "*happy shiba smile*",
            "*perks ears up*",
            "*watches analysts intently*",
            "*looks for treats*",
            "*does a little spin*",
            "*sits patiently*",
            "*gives puppy eyes*",
            "*play bow invitation*",
            "*soft whine for attention*",
            "*sneezes cutely*",
            "*shakes fur*",
            "*zoomies around office*"
        ];
        this.messageText = cuteBarks[Math.floor(Math.random() * cuteBarks.length)];
        this.messageTime = 60;

        // Sometimes do a little animation when barking
        if (Math.random() < 0.3) {
            // Increase animation speed briefly for excited moments
            this.animationSpeed = 0.8;
            setTimeout(() => {
                this.animationSpeed = 0.5;
            }, 1000);
        }
    }
}
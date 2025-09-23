// =============================================================================
// POWERUPS MODULE
// =============================================================================

class GamePowerups {
    constructor(game) {
        this.game = game;
        // Weighted powerup distribution mapping to GAME_CONFIG keys
        // Requested ratios:
        // RAINBOW(invincibility)=1, ORANGE(bouncing)=2, GREEN(speed)=2, PURPLE(spread)=3, BLUE(fireRate)=3, RED(heal)=2
        this.powerupWeights = [
            { type: 'INVINCIBILITY', weight: 1 },
            { type: 'BOUNCING_BULLETS', weight: 4 },
            { type: 'SPEED', weight: 6 },
            { type: 'SPREAD_SHOT', weight: 8 },
            { type: 'RAPID_FIRE', weight: 8 },
            { type: 'HEALTH', weight: 2 }
        ];
    }

    update(deltaTime) {
        this.game.tanks.forEach(tank => {
            if (!tank.isAlive) return;
            Object.keys(tank.powerups).forEach(powerupType => {
                const powerupArray = tank.powerups[powerupType];
                for (let i = powerupArray.length - 1; i >= 0; i--) {
                    powerupArray[i] -= deltaTime;
                    if (powerupArray[i] <= 0) {
                        powerupArray.splice(i, 1);
                    }
                }
            });
        });

        this.game.powerupSpawnTimer -= deltaTime;
        if (this.game.powerupSpawnTimer <= 0) {
            this.spawn();
            
            // Scale powerup spawn rate based on number of players/AIs
            // Current rate is designed for 4 players, so scale accordingly
            const totalTanks = this.game.numPlayers + this.game.numAIBots;
            const scalingFactor = Math.max(0.5, Math.min(2.0, totalTanks / 4)); // Scale between 0.5x and 2.0x
            
            const scaledMinInterval = GAME_CONFIG.POWERUP_SPAWN_INTERVAL_MIN / scalingFactor;
            const scaledMaxInterval = GAME_CONFIG.POWERUP_SPAWN_INTERVAL_MAX / scalingFactor;
            
            this.game.powerupSpawnTimer = scaledMinInterval +
                Math.random() * (scaledMaxInterval - scaledMinInterval);
        }

        this.game.powerups.forEach((powerup, index) => {
            if (!powerup.alive) {
                this.game.powerups.splice(index, 1);
                return;
            }
            this.game.tanks.forEach(tank => {
                if (!tank.isAlive) return;
                const distance = Math.sqrt((powerup.x - tank.x) ** 2 + (powerup.y - tank.y) ** 2);
                if (distance < tank.size / 2 + powerup.size / 2) {
                    this.apply(tank, powerup.type);
                    powerup.alive = false;
                }
            });
        });
    }

    spawn() {
        const randomType = this.getWeightedRandomType();
        let attempts = 0;
        let position = null;
        while (attempts < 50) {
            const x = GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE +
                Math.random() * (GAME_CONFIG.MAP_WIDTH - 2 * GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE);
            const y = GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE +
                Math.random() * (GAME_CONFIG.MAP_HEIGHT - 2 * GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE);
            let valid = true;
            for (const obstacle of this.game.obstacles) {
                if (obstacle.type === 'rock') {
                    const distance = Math.sqrt((x - obstacle.x) ** 2 + (y - obstacle.y) ** 2);
                    if (distance < obstacle.size + GAME_CONFIG.POWERUP_SIZE) { valid = false; break; }
                } else {
                    const powerupLeft = x - GAME_CONFIG.POWERUP_SIZE;
                    const powerupRight = x + GAME_CONFIG.POWERUP_SIZE;
                    const powerupTop = y - GAME_CONFIG.POWERUP_SIZE;
                    const powerupBottom = y + GAME_CONFIG.POWERUP_SIZE;
                    const obstacleLeft = obstacle.x;
                    const obstacleRight = obstacle.x + obstacle.width;
                    const obstacleTop = obstacle.y;
                    const obstacleBottom = obstacle.y + obstacle.height;
                    if (powerupLeft < obstacleRight && powerupRight > obstacleLeft &&
                        powerupTop < obstacleBottom && powerupBottom > obstacleTop) { valid = false; break; }
                }
            }
            if (valid) {
                for (const tank of this.game.tanks) {
                    const distance = Math.sqrt((x - tank.x) ** 2 + (y - tank.y) ** 2);
                    if (distance < tank.size + GAME_CONFIG.POWERUP_SIZE) { valid = false; break; }
                }
            }
            if (valid) { position = { x, y }; break; }
            attempts++;
        }
        if (position) {
            this.game.powerups.push({
                id: Date.now() + Math.random(),
                x: position.x,
                y: position.y,
                type: randomType,
                size: GAME_CONFIG.POWERUP_SIZE,
                alive: true,
                rotation: 0
            });
        }
    }

    getWeightedRandomType() {
        const total = this.powerupWeights.reduce((sum, p) => sum + p.weight, 0);
        let r = Math.random() * total;
        for (const entry of this.powerupWeights) {
            if ((r -= entry.weight) <= 0) {
                return entry.type;
            }
        }
        // Fallback
        return this.powerupWeights[this.powerupWeights.length - 1].type;
    }

    apply(tank, powerupType) {
        switch (powerupType) {
            case 'HEALTH':
                tank.health = Math.min(tank.maxHealth, tank.health + GAME_CONFIG.POWERUP_HEALTH_BOOST);
                break;
            case 'INVINCIBILITY':
                if (tank.powerups.invincibility.length === 0) {
                    tank.powerups.invincibility.push(GAME_CONFIG.POWERUP_DURATION);
                } else {
                    tank.powerups.invincibility[0] += GAME_CONFIG.POWERUP_DURATION;
                }
                break;
            case 'SPEED':
                tank.powerups.speed.push(GAME_CONFIG.POWERUP_DURATION);
                break;
            case 'RAPID_FIRE':
                tank.powerups.rapidFire.push(GAME_CONFIG.POWERUP_DURATION);
                break;
            case 'SPREAD_SHOT':
                tank.powerups.spreadShot.push(GAME_CONFIG.POWERUP_DURATION);
                break;
            case 'BOUNCING_BULLETS':
                if (tank.powerups.bouncingBullets.length === 0) {
                    tank.powerups.bouncingBullets.push(GAME_CONFIG.POWERUP_DURATION);
                } else {
                    tank.powerups.bouncingBullets[0] += GAME_CONFIG.POWERUP_DURATION;
                }
                break;
        }
        if (window.audioSystem) { window.audioSystem.powerUp(); }
        // Track powerup collection
        const stats = this.game.playerStats.get(tank.id);
        if (stats) {
            stats.powerupsCollected = (stats.powerupsCollected || 0) + 1;
        }
    }
}

window.GamePowerups = GamePowerups;



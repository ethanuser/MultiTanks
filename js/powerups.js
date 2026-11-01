// =============================================================================
// POWERUPS MODULE
// =============================================================================

class GamePowerups {
    constructor(game) {
        this.game = game;
        this.powerupWeights = Object.entries(GAME_CONFIG.POWERUP_WEIGHTS)
            .map(([type, weight]) => ({ type, weight }));
    }

    update(deltaTime) {
        const game = this.game;
        game.tanks.forEach(tank => {
            if (!tank.isAlive || !tank.powerups) return;
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

        // Campaign stages place their own items, and enemies and crates drop them
        if (game.gameMode !== GAME_MODES.CAMPAIGN) {
            game.powerupSpawnTimer -= deltaTime;
            if (game.powerupSpawnTimer <= 0) {
                if (game.powerups.length < GAME_CONFIG.POWERUP_MAX_ON_MAP) this.spawn();

                // Scale powerup spawn rate based on number of players/AIs
                const totalTanks = game.numPlayers + game.numAIBots;
                const scalingFactor = Math.max(0.6, Math.min(1.5, totalTanks / 4));
                const scaledMinInterval = GAME_CONFIG.POWERUP_SPAWN_INTERVAL_MIN / scalingFactor;
                const scaledMaxInterval = GAME_CONFIG.POWERUP_SPAWN_INTERVAL_MAX / scalingFactor;

                game.powerupSpawnTimer = scaledMinInterval +
                    Math.random() * (scaledMaxInterval - scaledMinInterval);
            }
        }

        game.powerups = game.powerups.filter(powerup => {
            if (game.clock > powerup.expiresAt) {
                game.puff(powerup.x, powerup.y, '#ffffff', 4);
                return false;
            }
            for (const tank of game.tanks) {
                if (!tank.isAlive || !tank.powerups || tank.enemyType || tank.boss) continue;
                const distance = Math.hypot(powerup.x - tank.x, powerup.y - tank.y);
                if (distance < tank.size / 2 + powerup.size / 2 && this.apply(tank, powerup.type)) {
                    game.puff(powerup.x, powerup.y, '#ffd45e', 6);
                    return false;
                }
            }
            return true;
        });
    }

    spawn() {
        const position = this.game.map.randomOpenPoint();
        if (!position) return;
        // Keep clear of tanks so nobody gets one by simply sitting still
        const crowded = this.game.tanks.some(tank => tank.isAlive && distanceBetween(tank, position) < 90);
        if (!crowded) this.drop(position.x, position.y, this.getWeightedRandomType());
    }

    /**
     * Place a powerup in the world
     * @param {number} x - World x
     * @param {number} y - World y
     * @param {string} type - A GAME_CONFIG.POWERUP_TYPES key
     */
    drop(x, y, type) {
        this.game.powerups.push({
            id: Date.now() + Math.random(),
            x,
            y,
            type,
            size: GAME_CONFIG.POWERUP_SIZE,
            expiresAt: this.game.clock + GAME_CONFIG.POWERUP_LIFETIME,
            bornAt: this.game.clock
        });
    }

    /**
     * Would anyone on the receiving end get anything out of this? Harmony is no use
     * to a tank that is full of it, or to a crew who have not learned a chord yet.
     */
    isUseful(type) {
        const game = this.game;
        const takers = game.tanks.filter(tank => tank.isAlive && tank.powerups && !tank.enemyType && !tank.boss && !tank.inert);
        if (type === 'HEALTH') return takers.some(tank => tank.health < tank.maxHealth);
        if (type !== 'HARMONY') return true;
        const knowsAny = !game.mode.knowsHarmony || game.mode.knowsHarmony();
        return knowsAny && takers.some(tank => tank.meter < GAME_CONFIG.METER_MAX);
    }

    getWeightedRandomType() {
        const options = this.powerupWeights.filter(entry => this.isUseful(entry.type));
        const total = options.reduce((sum, p) => sum + p.weight, 0);
        let r = Math.random() * total;
        for (const entry of options) {
            if ((r -= entry.weight) <= 0) {
                return entry.type;
            }
        }
        // Fallback
        return options[options.length - 1].type;
    }

    addStack(stack) {
        if (stack.length >= GAME_CONFIG.POWERUP_MAX_STACKS) {
            stack[0] = GAME_CONFIG.POWERUP_DURATION; // Refresh rather than waste it
            return;
        }
        stack.push(GAME_CONFIG.POWERUP_DURATION);
    }

    addTime(stack, duration = GAME_CONFIG.POWERUP_DURATION) {
        if (stack.length === 0) {
            stack.push(duration);
        } else {
            stack[0] += duration;
        }
    }

    /**
     * Give a powerup to a tank
     * @returns {boolean} False if the tank has no use for it, leaving it on the ground
     */
    apply(tank, powerupType) {
        switch (powerupType) {
            case 'HEALTH':
                if (tank.health >= tank.maxHealth) return false;
                this.game.healTank(tank, GAME_CONFIG.POWERUP_HEALTH_BOOST);
                break;
            case 'HARMONY':
                if (tank.meter >= GAME_CONFIG.METER_MAX) return false;
                this.game.addMeter(tank, GAME_CONFIG.POWERUP_METER_BOOST);
                break;
            case 'INVINCIBILITY':
                this.addTime(tank.powerups.invincibility, GAME_CONFIG.POWERUP_STAR_MS);
                break;
            case 'SPEED':
                this.addStack(tank.powerups.speed);
                break;
            case 'RAPID_FIRE':
                this.addStack(tank.powerups.rapidFire);
                break;
            case 'SPREAD_SHOT':
                this.addStack(tank.powerups.spreadShot);
                break;
            case 'BOUNCING_BULLETS':
                this.addTime(tank.powerups.bouncingBullets);
                break;
        }
        if (window.audioSystem) { window.audioSystem.powerUp(); }
        if (tank.isPlayer) this.game.floatIcon(tank.x, tank.y - 30, GAME_CONFIG.POWERUP_TYPES[powerupType].icon);
        // Track powerup collection
        const stats = this.game.playerStats.get(tank.id);
        if (stats) {
            stats.powerupsCollected = (stats.powerupsCollected || 0) + 1;
        }
        return true;
    }
}

window.GamePowerups = GamePowerups;

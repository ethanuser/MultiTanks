// =============================================================================
// COLLISIONS & MOVEMENT MODULE
// =============================================================================

class GameCollisions {
    constructor(game) {
        this.game = game;
    }

    moveTankWithSliding(tank, newX, newY, moveAngle) {
        if (!this.checkTankObstacleCollision(tank, newX, newY)) {
            tank.x = newX; tank.y = newY; tank.angle = moveAngle; return;
        }
        if (!this.checkTankObstacleCollision(tank, newX, tank.y)) {
            tank.x = newX; tank.angle = moveAngle; return;
        }
        if (!this.checkTankObstacleCollision(tank, tank.x, newY)) {
            tank.y = newY; tank.angle = moveAngle; return;
        }
        const perpendicularAngle = moveAngle + Math.PI / 2;
        const slideX = tank.x + Math.cos(perpendicularAngle) * tank.speed * GAME_CONFIG.AI_SLIDE_SPEED_MULTIPLIER;
        const slideY = tank.y + Math.sin(perpendicularAngle) * tank.speed * GAME_CONFIG.AI_SLIDE_SPEED_MULTIPLIER;
        if (!this.checkTankObstacleCollision(tank, slideX, slideY)) {
            tank.x = slideX; tank.y = slideY; tank.angle = perpendicularAngle; return;
        }
        const oppositePerpendicularAngle = moveAngle - Math.PI / 2;
        const slideX2 = tank.x + Math.cos(oppositePerpendicularAngle) * tank.speed * GAME_CONFIG.AI_SLIDE_SPEED_MULTIPLIER;
        const slideY2 = tank.y + Math.sin(oppositePerpendicularAngle) * tank.speed * GAME_CONFIG.AI_SLIDE_SPEED_MULTIPLIER;
        if (!this.checkTankObstacleCollision(tank, slideX2, slideY2)) {
            tank.x = slideX2; tank.y = slideY2; tank.angle = oppositePerpendicularAngle;
        }
    }

    checkTankObstacleCollision(tank, newX, newY) {
        return this.game.obstacles.some(obstacle => {
            if (obstacle.type === 'rock') {
                const distance = Math.sqrt((newX - obstacle.x) ** 2 + (newY - obstacle.y) ** 2);
                return distance < obstacle.radius + tank.size / 2;
            } else {
                const dx = Math.abs(newX - obstacle.x);
                const dy = Math.abs(newY - obstacle.y);
                return dx < (obstacle.width / 2 + tank.size / 2) && dy < (obstacle.height / 2 + tank.size / 2);
            }
        });
    }

    constrainTankToMap(tank) {
        tank.x = Math.max(tank.size / 2, Math.min(GAME_CONFIG.MAP_WIDTH - tank.size / 2, tank.x));
        tank.y = Math.max(tank.size / 2, Math.min(GAME_CONFIG.MAP_HEIGHT - tank.size / 2, tank.y));
    }

    /**
     * Calculate distance between two objects
     * @param {Object} obj1 - First object with x, y properties
     * @param {Object} obj2 - Second object with x, y properties
     * @returns {number} Distance between objects
     */
    calculateDistance(obj1, obj2) {
        return Math.sqrt((obj1.x - obj2.x) ** 2 + (obj1.y - obj2.y) ** 2);
    }

    /**
     * Check if two circular objects are colliding
     * @param {Object} obj1 - First object with x, y, size properties
     * @param {Object} obj2 - Second object with x, y, size properties
     * @returns {boolean} True if objects are colliding
     */
    checkCircularCollision(obj1, obj2) {
        const distance = this.calculateDistance(obj1, obj2);
        return distance < obj1.size / 2 + obj2.size / 2;
    }

    /**
     * Check if a tank is invincible
     * @param {Object} tank - Tank object
     * @returns {boolean} True if tank is invincible
     */
    isTankInvincible(tank) {
        return tank.powerups && tank.powerups.invincibility && tank.powerups.invincibility.length > 0;
    }

    /**
     * Apply damage to a tank
     * @param {Object} tank - Tank to damage
     * @param {number} damage - Amount of damage to apply
     * @param {Object} bullet - Bullet causing damage (for damage property)
     */
    applyDamage(tank, damage, bullet = null) {
        const actualDamage = bullet ? bullet.damage : damage;
        tank.health -= actualDamage;
    }

    /**
     * Update statistics for a successful hit
     * @param {Object} game - Game instance
     * @param {Object} bulletOwner - Tank that fired the bullet
     */
    updateHitStatistics(game, bulletOwner) {
        if (bulletOwner) {
            bulletOwner.shotsHit++;
            const bulletOwnerStats = game.playerStats.get(bulletOwner.id);
            if (bulletOwnerStats) {
                bulletOwnerStats.shotsHit++;
            }
        }
    }

    /**
     * Handle tank death
     * @param {Object} game - Game instance
     * @param {Object} tank - Tank that died
     * @param {Object} bulletOwner - Tank that killed the tank
     * @param {string} soundType - Type of death sound ('player', 'ai', 'aiAlly')
     */
    handleTankDeath(game, tank, bulletOwner, soundType = 'player') {
        tank.isAlive = false;
        tank.deathTime = Date.now();
        tank.killedBy = bulletOwner ? bulletOwner.name : 'Unknown';
        
        // Update kill/death statistics
        if (bulletOwner) {
            bulletOwner.kills++;
            const bulletOwnerStats = game.playerStats.get(bulletOwner.id);
            if (bulletOwnerStats) {
                bulletOwnerStats.kills++;
                bulletOwnerStats.killsList.push(tank.name);
            }
        }
        
        const tankStats = game.playerStats.get(tank.id);
        if (tankStats) {
            tankStats.deaths++;
            tankStats.deathTime = tank.deathTime;
            tankStats.killedBy = tank.killedBy;
            tankStats.killedByList.push(tank.killedBy);
        }
        
        // Play death sound
        if (window.audioSystem) {
            switch (soundType) {
                case 'ai':
                    window.audioSystem.enemyDeath();
                    break;
                case 'aiAlly':
                case 'player':
                default:
                    window.audioSystem.death();
                    break;
            }
        }
    }

    /**
     * Play hit sound based on tank type
     * @param {Object} tank - Tank that was hit
     * @param {string} soundType - Type of sound ('hit', 'hurt')
     */
    playHitSound(tank, soundType = 'hit') {
        if (window.audioSystem) {
            if (soundType === 'hurt') {
                window.audioSystem.hurt();
            } else {
                window.audioSystem.hit();
            }
        }
    }

    /**
     * Remove bullet from game
     * @param {Object} game - Game instance
     * @param {number} bulletIndex - Index of bullet to remove
     */
    removeBullet(game, bulletIndex) {
        game.bullets.splice(bulletIndex, 1);
    }

    /**
     * Core bullet vs tank collision logic
     * @param {Object} game - Game instance
     * @param {Object} bullet - Bullet object
     * @param {number} bulletIndex - Index of bullet in bullets array
     * @param {Object} tank - Tank object
     * @param {Object} options - Collision options
     * @returns {boolean} True if collision was handled
     */
    handleBulletTankCollision(game, bullet, bulletIndex, tank, options = {}) {
        // Default options
        const {
            skipFriendlyFire = false,
            friendlyFireCheck = null,
            damage = GAME_CONFIG.BULLET_DAMAGE,
            soundType = 'hit',
            deathSoundType = 'player'
        } = options;

        // Basic collision checks
        if (!tank.isAlive || tank.id === bullet.ownerId) return false;
        
        // Check for friendly fire if specified
        if (skipFriendlyFire && friendlyFireCheck) {
            if (friendlyFireCheck(game, bullet, tank)) {
                return false;
            }
        }
        
        // Check if objects are colliding
        if (!this.checkCircularCollision(bullet, tank)) {
            return false;
        }
        
        // Check invincibility
        if (this.isTankInvincible(tank)) {
            this.removeBullet(game, bulletIndex);
            return true;
        }
        
        // Apply damage
        this.applyDamage(tank, damage, bullet);
        this.removeBullet(game, bulletIndex);
        
        // Update statistics
        const bulletOwner = game.tanks.find(t => t.id === bullet.ownerId);
        this.updateHitStatistics(game, bulletOwner);
        
        // Play hit sound
        this.playHitSound(tank, soundType);
        
        // Handle death if health is 0 or below
        if (tank.health <= 0) {
            this.handleTankDeath(game, tank, bulletOwner, deathSoundType);
        }
        
        return true;
    }
}

window.GameCollisions = GameCollisions;



// =============================================================================
// COLLISIONS & MOVEMENT MODULE
// =============================================================================

class GameCollisions {
    constructor(game) {
        this.game = game;
    }

    /**
     * Move a tank toward a position, sliding along walls and easing around corners
     * so that tight gaps are forgiving to steer through with eight directions.
     */
    moveTankWithSliding(tank, newX, newY, moveAngle) {
        const map = this.game.map;
        const hovering = this.game.hasStatus(tank, 'dash');
        const fromX = tank.x;
        const fromY = tank.y;

        if (!map.tankBlocked(newX, fromY, tank.size, hovering)) {
            tank.x = newX;
        } else {
            this.nudge(tank, 'y', newX - fromX, hovering);
        }
        if (!map.tankBlocked(tank.x, newY, tank.size, hovering)) {
            tank.y = newY;
        } else {
            this.nudge(tank, 'x', newY - fromY, hovering);
        }

        if (moveAngle !== undefined && moveAngle !== null) tank.angle = moveAngle;
    }

    /**
     * Blocked head on by only the corner of a wall? Ease sideways past it.
     * @param {string} axis - The axis to slide along
     * @param {number} push - The blocked movement on the other axis
     */
    nudge(tank, axis, push, hovering) {
        if (!push) return;
        const map = this.game.map;
        const reach = GAME_CONFIG.CORNER_NUDGE;
        const step = Math.min(Math.abs(push), 1.4);
        for (const direction of [-1, 1]) {
            const clearX = axis === 'x' ? tank.x + direction * reach : tank.x + push;
            const clearY = axis === 'y' ? tank.y + direction * reach : tank.y + push;
            if (!map.tankBlocked(clearX, clearY, tank.size, hovering)) {
                if (axis === 'x') tank.x += direction * step;
                else tank.y += direction * step;
                return;
            }
        }
    }

    /**
     * Stop tanks from sitting on top of one another
     */
    separateTanks() {
        const tanks = this.game.tanks;
        const map = this.game.map;
        for (let i = 0; i < tanks.length; i++) {
            const a = tanks[i];
            if (!a.isAlive || a.intangible) continue;
            for (let j = i + 1; j < tanks.length; j++) {
                const b = tanks[j];
                if (!b.isAlive || b.intangible) continue;
                // Friends give way to one another, or two would jam in a narrow gap
                const friends = !this.game.areHostile(a, b);
                const reach = (a.size + b.size) * (friends ? GAME_CONFIG.FRIEND_OVERLAP : 0.46);
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
                const distance = Math.hypot(dx, dy) || 1;
                if (distance >= reach) continue;
                const push = (reach - distance) * GAME_CONFIG.TANK_PUSH_STRENGTH;
                const nx = dx / distance;
                const ny = dy / distance;
                const moveA = a.immobile ? 0 : (b.immobile ? 2 : 1);
                const moveB = b.immobile ? 0 : (a.immobile ? 2 : 1);
                const ax = a.x - nx * push * moveA;
                const ay = a.y - ny * push * moveA;
                const bx = b.x + nx * push * moveB;
                const by = b.y + ny * push * moveB;
                if (!map.tankBlocked(ax, ay, a.size)) { a.x = ax; a.y = ay; }
                if (!map.tankBlocked(bx, by, b.size)) { b.x = bx; b.y = by; }
            }
        }
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
        return (tank.powerups && tank.powerups.invincibility && tank.powerups.invincibility.length > 0)
            || this.game.hasStatus(tank, 'spawnProtect');
    }

    /**
     * Update bullets against walls and tanks
     */
    updateBullets(deltaTime) {
        const game = this.game;
        const map = game.map;

        game.bullets.forEach(bullet => {
            if (bullet.dead) return;
            bullet.life -= deltaTime;
            if (bullet.life <= 0) {
                bullet.dead = true;
                if (bullet.onExpire) bullet.onExpire(bullet);
                return;
            }

            if (bullet.homing) this.steerHomingBullet(bullet);
            if (bullet.drag) {
                bullet.vx *= bullet.drag;
                bullet.vy *= bullet.drag;
            }

            const nextX = bullet.x + bullet.vx;
            const nextY = bullet.y + bullet.vy;
            const hitX = map.blocksBullet(map.tileAt(nextX, bullet.y));
            const hitY = map.blocksBullet(map.tileAt(bullet.x, nextY));
            const hitBoth = map.blocksBullet(map.tileAt(nextX, nextY));

            if (hitX || hitY || hitBoth) {
                this.hitTile(bullet, nextX, nextY, hitX, hitY);
                if (bullet.dead) return;
            }

            bullet.x += bullet.vx;
            bullet.y += bullet.vy;

            for (const tank of game.tanks) {
                if (!tank.isAlive || tank.intangible || !game.bulletHostileTo(bullet, tank)) continue;
                const reach = tank.size / 2 + bullet.size / 2;
                if (Math.abs(tank.x - bullet.x) > reach || Math.abs(tank.y - bullet.y) > reach) continue;
                if (Math.hypot(tank.x - bullet.x, tank.y - bullet.y) >= reach) continue;
                if (this.hitTank(bullet, tank)) return;
            }
        });

        game.bullets = game.bullets.filter(bullet => !bullet.dead);
    }

    steerHomingBullet(bullet) {
        const target = this.game.nearestHostile(bullet.ownerTank || bullet, bullet.x, bullet.y, 500);
        if (!target) return;
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const angle = Math.atan2(bullet.vy, bullet.vx);
        const want = Math.atan2(target.y - bullet.y, target.x - bullet.x);
        const turn = Math.max(-bullet.homing, Math.min(bullet.homing, normalizeAngle(want - angle)));
        bullet.vx = Math.cos(angle + turn) * speed;
        bullet.vy = Math.sin(angle + turn) * speed;
    }

    hitTile(bullet, nextX, nextY, hitX, hitY) {
        const game = this.game;
        const map = game.map;
        const c = Math.floor(nextX / WORLD.TILE);
        const r = Math.floor(nextY / WORLD.TILE);
        if (map.at(c, r) === TILES.CRATE) game.damageTile(c, r, bullet.damage);

        if (bullet.bounces > 0) {
            bullet.bounces--;
            if (bullet.ricochet) bullet.damage += GAME_CONFIG.POWERUP_BOUNCE_DAMAGE;
            if (hitX || (!hitX && !hitY)) bullet.vx = -bullet.vx;
            if (hitY || (!hitX && !hitY)) bullet.vy = -bullet.vy;
            game.puff(bullet.x, bullet.y, '#ffffff', 2);
        } else {
            bullet.dead = true;
            game.puff(bullet.x, bullet.y, bullet.color, 3);
            if (bullet.onExpire) bullet.onExpire(bullet);
        }
    }

    /**
     * A bullet has reached a tank
     * @returns {boolean} True if the bullet is used up
     */
    hitTank(bullet, tank) {
        const game = this.game;

        // Dashing tanks slip straight through
        if (game.hasStatus(tank, 'dash')) return false;

        // Armored fronts turn shots aside
        if (tank.frontArmor) {
            const facing = tank.armorAngle ?? tank.turretAngle;
            const incoming = Math.atan2(bullet.y - tank.y, bullet.x - tank.x);
            if (Math.abs(normalizeAngle(incoming - facing)) < tank.frontArmor) {
                bullet.dead = true;
                game.spark(bullet.x, bullet.y);
                game.floatIcon(bullet.x, bullet.y - 10, 'shield');
                window.audioSystem.shieldBlock();
                return true;
            }
        }

        if (this.isTankInvincible(tank) || game.absorbHit(tank)) {
            bullet.dead = true;
            game.spark(bullet.x, bullet.y);
            window.audioSystem.shieldBlock();
            return true;
        }

        const owner = bullet.ownerTank || null;
        if (owner) {
            owner.shotsHit++;
            const stats = game.playerStats.get(owner.id);
            if (stats) stats.shotsHit++;
        }

        game.damageTank(tank, bullet.damage, { source: owner, bullet, type: 'bullet' });
        if (bullet.knockback) {
            game.knockback(tank, Math.atan2(bullet.vy, bullet.vx), bullet.knockback);
        }
        bullet.dead = true;
        return true;
    }

    /**
     * Keep a tank inside the map (the walls usually do this)
     */
    constrainTankToMap(tank) {
        tank.x = Math.max(tank.size / 2, Math.min(GAME_CONFIG.MAP_WIDTH - tank.size / 2, tank.x));
        tank.y = Math.max(tank.size / 2, Math.min(GAME_CONFIG.MAP_HEIGHT - tank.size / 2, tank.y));
    }
}

window.GameCollisions = GameCollisions;

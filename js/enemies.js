// =============================================================================
// THE DISSONANCE: CAMPAIGN ENEMIES
// =============================================================================

const ENEMY_BULLET_COLOR = '#ff4d6d';

const ENEMY_TYPES = {
    quaver: {
        name: 'Quaver', style: 'rusher', chassis: 'scout', palette: 'blood', eyes: 'angry',
        size: 30, health: 8, speed: 2.4, fireMs: 1000, bulletSpeed: 4.6, damage: 1, range: 150, aggro: 460,
        pattern: { fan: 3, spread: 0.3 }
    },
    triplet: {
        name: 'Triplet', style: 'skirmisher', chassis: 'triplet', palette: 'bruise', eyes: 'angry',
        size: 38, health: 14, speed: 1.6, fireMs: 1700, bulletSpeed: 4, damage: 1, range: 300, aggro: 520,
        shots: 3, spread: 0.27, pattern: { fan: 7, spread: 0.2 }
    },
    metronome: {
        name: 'Metronome', style: 'emplacement', chassis: 'emplacement', palette: 'rust', eyes: 'angry',
        size: 44, health: 24, speed: 0, immobile: true, beats: 2, bulletSpeed: 4.4, damage: 2, aggro: 560,
        bounces: 1, pattern: { ring: 10 }
    },
    damper: {
        name: 'Damper', style: 'skirmisher', chassis: 'heavy', palette: 'hush', eyes: 'sleepy',
        size: 44, health: 26, speed: 1, fireMs: 2100, bulletSpeed: 3.6, damage: 3, range: 240, aggro: 480,
        frontArmor: 1, bulletKind: 'big', bulletSize: 20, pattern: { fan: 3, spread: 0.4 }
    },
    sharp: {
        name: 'Sharp', style: 'sniper', chassis: 'sniper', palette: 'ghost', eyes: 'angry',
        size: 36, health: 10, speed: 1.5, fireMs: 2800, bulletSpeed: 10, damage: 4, range: 480, aggro: 680,
        aimMs: 950, pattern: { fan: 3, spread: 0.1 }
    },
    crescendo: {
        name: 'Crescendo', style: 'bomber', chassis: 'bomb', palette: 'acid', eyes: 'hollow',
        size: 34, health: 9, speed: 2.1, damage: 6, blastRadius: 110, aggro: 500,
        pattern: { ring: 14 }
    },
    rest: {
        name: 'Rest', style: 'phantom', chassis: 'wisp', palette: 'hush', eyes: 'hollow',
        size: 34, health: 12, speed: 2.2, fireMs: 800, bulletSpeed: 4.8, damage: 2, range: 230, aggro: 560,
        pattern: { ring: 8 }
    },
    fermata: {
        name: 'Fermata', style: 'support', chassis: 'medic', palette: 'pink', eyes: 'sleepy',
        size: 36, health: 16, speed: 1.4, aggro: 480, supportRadius: 210, supportHeal: 3,
        pattern: { ring: 8 }
    },
    trill: {
        name: 'Trill', style: 'skirmisher', chassis: 'trill', palette: 'orange', eyes: 'angry',
        size: 38, health: 16, speed: 1.5, fireMs: 2200, bulletSpeed: 5, damage: 1, range: 280, aggro: 520,
        burst: 5, pattern: { burst: 11 }
    }
};

const Enemies = {
    /**
     * Create an enemy tank
     * @param {Object} game - Game instance
     * @param {string} type - Key into ENEMY_TYPES
     * @param {number} x - World x
     * @param {number} y - World y
     * @param {Object} difficulty - Entry from CAMPAIGN_CONFIG.DIFFICULTY
     */
    create(game, type, x, y, difficulty) {
        const def = ENEMY_TYPES[type];
        const health = Math.ceil(def.health * difficulty.enemyHealthMultiplier);
        const enemy = game.createTank({
            x,
            y,
            name: def.name,
            enemyType: type,
            faction: 'dissonance',
            isAI: true,
            palette: def.palette,
            chassis: def.chassis,
            eyes: def.eyes,
            size: def.size,
            health,
            maxHealth: health,
            speed: def.speed * difficulty.enemySpeedMultiplier,
            immobile: !!def.immobile,
            frontArmor: def.frontArmor || 0,
            turretLength: CHASSIS[def.chassis].barrelLength * WORLD.PIXEL,
            turretRotationSpeed: 0.05,
            fireMs: (def.fireMs || 1000) / difficulty.enemyFireRateMultiplier,
            bulletSpeed: (def.bulletSpeed || 4) * difficulty.enemyBulletSpeedMultiplier,
            damage: def.damage * difficulty.enemyDamageMultiplier,
            aimError: difficulty.aimError,
            pattern: difficulty.patterns ? def.pattern : null,
            def,
            alerted: false,
            homeX: x,
            homeY: y,
            nextFire: game.clock + 600 + Math.random() * 900,
            strafe: Math.random() < 0.5 ? 1 : -1,
            nextStrafeFlip: 0,
            wanderAngle: Math.random() * Math.PI * 2,
            nextWander: 0,
            stuckX: x,
            stuckY: y,
            stuckCheckAt: 0,
            sidestepUntil: 0,
            sidestepAngle: 0
        });
        enemy.turretAngle = Math.random() * Math.PI * 2;
        if (def.style === 'emplacement') enemy.onBeat = this.emplacementBeat;
        if (def.style === 'support') enemy.onBeat = this.supportBeat;
        return enemy;
    },

    update(game, enemy, deltaTime) {
        const target = this.chooseTarget(game, enemy);
        this.checkAlert(game, enemy, target);

        if (!enemy.alerted || !target) {
            this.patrol(game, enemy);
            return;
        }
        this[enemy.def.style](game, enemy, target, deltaTime);
    },

    chooseTarget(game, enemy) {
        return game.nearestHostile(enemy, enemy.x, enemy.y);
    },

    /**
     * Enemies stay on station until they see someone or are shot, then call in
     * whoever is nearby. A stage plays as a string of fights, not one big rush.
     */
    checkAlert(game, enemy, target) {
        if (enemy.alerted) return;
        const shot = enemy.health < enemy.maxHealth;
        const sees = target && distanceBetween(enemy, target) < enemy.def.aggro
            && game.map.lineClear(enemy.x, enemy.y, target.x, target.y);
        if (!shot && !sees) return;
        enemy.alerted = true;
        enemy.nextFire = Math.max(enemy.nextFire, game.clock + 500);
        game.floatText(enemy.x, enemy.y - enemy.size, '!', '#ffd45e', 20);
        game.tanks.forEach(other => {
            if (other.enemyType && !other.alerted && distanceBetween(other, enemy) < 340) {
                other.alerted = true;
                other.nextFire = Math.max(other.nextFire, game.clock + 800);
            }
        });
    },

    patrol(game, enemy) {
        if (enemy.immobile) {
            enemy.turretAngle += 0.012;
            return;
        }
        if (game.clock >= enemy.nextWander) {
            enemy.nextWander = game.clock + 1000 + Math.random() * 1800;
            const toHome = Math.atan2(enemy.homeY - enemy.y, enemy.homeX - enemy.x);
            const farAway = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y) > 90;
            enemy.wanderAngle = farAway ? toHome : Math.random() * Math.PI * 2;
            enemy.wandering = Math.random() < 0.6;
        }
        if (enemy.wandering) {
            this.drive(game, enemy, enemy.wanderAngle, 0.45);
            enemy.turretAngle += normalizeAngle(enemy.wanderAngle - enemy.turretAngle) * 0.04;
        }
    },

    drive(game, enemy, angle, factor = 1) {
        const speed = game.speedOf(enemy) * factor;
        game.collisions.moveTankWithSliding(
            enemy, enemy.x + Math.cos(angle) * speed, enemy.y + Math.sin(angle) * speed, angle
        );
        enemy.moved = true;
    },

    /**
     * Head for the nearest crew member along the shared route
     */
    chase(game, enemy, factor = 1) {
        const hunted = game.tanks.filter(t => t.isAlive && game.areHostile(enemy, t) && !game.hasStatus(t, 'hidden'));
        if (hunted.length === 0) return;
        const route = game.map.routePoint(enemy.x, enemy.y, enemy.size, game.map.field(hunted));
        if (!route) return;

        if (route.crate) {
            this.aimAt(game, enemy, Math.atan2(route.y - enemy.y, route.x - enemy.x));
            if (game.clock >= enemy.nextFire) {
                enemy.nextFire = game.clock + 400;
                this.shoot(game, enemy, enemy.turretAngle);
            }
            return;
        }
        this.drive(game, enemy, this.unstuckAngle(game, enemy, Math.atan2(route.y - enemy.y, route.x - enemy.x)), factor);
    },

    unstuckAngle(game, enemy, angle) {
        if (game.clock >= enemy.stuckCheckAt) {
            if (Math.hypot(enemy.x - enemy.stuckX, enemy.y - enemy.stuckY) < 5) {
                enemy.sidestepAngle = angle + (Math.random() < 0.5 ? 1.5 : -1.5);
                enemy.sidestepUntil = game.clock + 350;
            }
            enemy.stuckX = enemy.x;
            enemy.stuckY = enemy.y;
            enemy.stuckCheckAt = game.clock + 600;
        }
        return game.clock < enemy.sidestepUntil ? enemy.sidestepAngle : angle;
    },

    aimAt(game, enemy, wanted, rate = enemy.turretRotationSpeed) {
        const difference = normalizeAngle(wanted - enemy.turretAngle);
        enemy.turretAngle += Math.max(-rate, Math.min(rate, difference));
        return Math.abs(difference);
    },

    /**
     * Aim with a little human error
     */
    aimPoint(game, enemy, target) {
        const point = window.aiBehavior.leadTarget(enemy, target, enemy.bulletSpeed, 0.75);
        return Math.atan2(point.y - enemy.y, point.x - enemy.x) + (Math.random() - 0.5) * 2 * enemy.aimError;
    },

    /**
     * Only so many enemies may open fire at once, which keeps big fights readable
     */
    claimAttack(game, enemy) {
        const mode = game.mode;
        if (mode.attackBudget > 0) {
            mode.attackBudget--;
            return true;
        }
        enemy.nextFire = game.clock + 180 + Math.random() * 220;
        return false;
    },

    shoot(game, enemy, angle, overrides = {}) {
        const def = enemy.def || {};
        game.spawnBullet({
            x: enemy.x + Math.cos(angle) * enemy.turretLength,
            y: enemy.y + Math.sin(angle) * enemy.turretLength,
            angle,
            speed: enemy.bulletSpeed,
            size: def.bulletSize || 12,
            damage: enemy.damage,
            owner: enemy,
            kind: def.bulletKind || 'wrong',
            color: ENEMY_BULLET_COLOR,
            bounces: def.bounces || 0,
            ...overrides
        });
        enemy.recoilUntil = game.clock + 110;
        enemy.muzzleUntil = game.clock + 70;
        window.audioSystem.enemyShoot();
    },

    /**
     * The extra shots in a pattern travel slower than aimed ones, so that there is
     * room to read them and weave through
     */
    fan(game, enemy, angle, count, spread) {
        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * spread;
            this.shoot(game, enemy, angle + offset, offset ? { speed: enemy.bulletSpeed * 0.72 } : {});
        }
    },

    ring(game, enemy, count) {
        const start = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
            this.shoot(game, enemy, start + (i / count) * Math.PI * 2, {
                speed: enemy.bulletSpeed * 0.62, size: 11, bounces: 0
            });
        }
    },

    fireVolley(game, enemy, angle) {
        const def = enemy.def;
        const pattern = enemy.pattern;
        if (pattern && pattern.ring) {
            this.ring(game, enemy, pattern.ring);
        } else if (pattern && pattern.fan) {
            this.fan(game, enemy, angle, pattern.fan, pattern.spread);
        } else if (def.burst) {
            const burst = pattern ? pattern.burst : def.burst;
            for (let i = 0; i < burst; i++) {
                game.after(i * 85, () => {
                    if (enemy.isAlive && !game.hasStatus(enemy, 'sleep')) {
                        this.shoot(game, enemy, enemy.turretAngle + (Math.random() - 0.5) * (pattern ? 0.5 : 0.08));
                    }
                });
            }
        } else if (def.shots) {
            for (let i = 0; i < def.shots; i++) {
                this.shoot(game, enemy, angle + (i - (def.shots - 1) / 2) * def.spread);
            }
        } else {
            this.shoot(game, enemy, angle);
        }
    },

    tryFire(game, enemy, target) {
        if (game.clock < enemy.nextFire) return;
        if (!game.map.lineClear(enemy.x, enemy.y, target.x, target.y)) return;
        const wanted = this.aimPoint(game, enemy, target);
        if (Math.abs(normalizeAngle(wanted - enemy.turretAngle)) > 0.3) return;
        if (!this.claimAttack(game, enemy)) return;
        enemy.nextFire = game.clock + enemy.fireMs * (0.85 + Math.random() * 0.3);
        this.fireVolley(game, enemy, wanted);
    },

    // -------------------------------------------------------------------------
    // Fighting styles
    // -------------------------------------------------------------------------

    /**
     * Quavers charge straight in and circle at close range
     */
    rusher(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        const sees = game.map.lineClear(enemy.x, enemy.y, target.x, target.y);
        this.aimAt(game, enemy, this.aimPoint(game, enemy, target), 0.09);

        if (!sees || distance > enemy.def.range * 1.2) {
            this.chase(game, enemy);
        } else {
            if (game.clock >= enemy.nextStrafeFlip) {
                enemy.strafe *= -1;
                enemy.nextStrafeFlip = game.clock + 700 + Math.random() * 900;
            }
            this.drive(game, enemy, angle + enemy.strafe * (distance < enemy.def.range * 0.7 ? 2.1 : 1.4), 0.8);
        }
        this.tryFire(game, enemy, target);
    },

    /**
     * Holds a firing distance, strafing, and looks for an angle when blocked
     */
    skirmisher(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        const sees = game.map.lineClear(enemy.x, enemy.y, target.x, target.y);
        const range = enemy.def.range;
        const armored = enemy.frontArmor > 0;
        this.aimAt(game, enemy, this.aimPoint(game, enemy, target), armored ? 0.022 : 0.05);

        if (!sees || distance > range * 1.3) {
            this.chase(game, enemy);
        } else if (distance < range * 0.6 && !armored) {
            this.drive(game, enemy, angle + Math.PI + enemy.strafe * 0.5);
        } else if (!armored) {
            if (game.clock >= enemy.nextStrafeFlip) {
                enemy.strafe *= -1;
                enemy.nextStrafeFlip = game.clock + 1100 + Math.random() * 1100;
            }
            this.drive(game, enemy, angle + enemy.strafe * Math.PI / 2, 0.7);
        } else {
            this.drive(game, enemy, angle, 0.7);
        }
        this.tryFire(game, enemy, target);
    },

    /**
     * Sharps back away to long range, draw a sight line, and fire one fast shot.
     * The line locks just before firing, so moving sideways dodges it.
     */
    sniper(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        const sees = game.map.lineClear(enemy.x, enemy.y, target.x, target.y);

        if (enemy.aimStart) {
            const held = game.clock - enemy.aimStart;
            const locked = held > enemy.def.aimMs - 280;
            if (!locked) this.aimAt(game, enemy, angle, 0.08);
            enemy.sightLine = locked ? 'locked' : 'tracking';
            if (held >= enemy.def.aimMs) {
                enemy.aimStart = 0;
                enemy.sightLine = null;
                enemy.nextFire = game.clock + enemy.fireMs;
                this.shoot(game, enemy, enemy.turretAngle, { size: 10 });
                if (enemy.pattern) this.fan(game, enemy, enemy.turretAngle, 2, enemy.pattern.spread * 2);
            } else if (!sees && !locked) {
                enemy.aimStart = 0;
                enemy.sightLine = null;
                enemy.nextFire = game.clock + 400;
            }
            return;
        }

        this.aimAt(game, enemy, angle);
        if (!sees || distance > enemy.def.range * 1.25) {
            this.chase(game, enemy);
        } else if (distance < enemy.def.range * 0.65) {
            this.drive(game, enemy, angle + Math.PI);
        }
        if (sees && game.clock >= enemy.nextFire && distance < enemy.def.range * 1.4 && this.claimAttack(game, enemy)) {
            enemy.aimStart = game.clock;
        }
    },

    /**
     * Crescendos swell as they close in, and go off near their target
     */
    bomber(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        enemy.swell = Math.max(0, 1 - distance / 340);
        this.aimAt(game, enemy, Math.atan2(target.y - enemy.y, target.x - enemy.x), 0.1);

        if (enemy.fuseAt) {
            if (game.clock >= enemy.fuseAt) {
                this.detonate(game, enemy);
            }
            return;
        }
        if (distance < 84) {
            enemy.fuseAt = game.clock + 520;
            game.telegraph({ x: enemy.x, y: enemy.y, radius: enemy.def.blastRadius, follow: enemy }, 520, () => {});
            return;
        }
        this.chase(game, enemy, 1 + enemy.swell * 0.5);
    },

    /**
     * Blow up. Everyone nearby is caught in it, including other enemies, so a
     * Crescendo shot in a crowd is a gift.
     */
    detonate(game, enemy) {
        if (enemy.detonated) return;
        enemy.detonated = true;
        const radius = enemy.def.blastRadius;
        game.ring(enemy.x, enemy.y, radius, '#c8dc40', 300);
        game.shake(6);
        window.audioSystem.blast();
        if (enemy.pattern) this.ring(game, enemy, enemy.pattern.ring);
        game.tanks.forEach(other => {
            if (other === enemy || !other.isAlive) return;
            if (distanceBetween(other, enemy) < radius + other.size / 2) {
                game.damageTank(other, enemy.damage, { type: 'blast' });
            }
        });
        game.forEachTileInRadius(enemy.x, enemy.y, radius * 0.7, (c, r) => {
            if (game.map.at(c, r) === TILES.CRATE) game.damageTile(c, r, CRATE_HEALTH);
        });
        if (enemy.isAlive) {
            enemy.isAlive = false;
            game.explode(enemy.x, enemy.y, enemy.palette, enemy.size);
        }
    },

    /**
     * Rests fade from sight to slip around behind, then appear and open fire
     */
    phantom(game, enemy, target) {
        const hiding = game.hasStatus(enemy, 'hidden');
        if (!hiding && game.clock >= (enemy.nextFade || 0)) {
            game.setStatus(enemy, 'hidden', 2000);
            enemy.nextFade = game.clock + 4600;
            game.puff(enemy.x, enemy.y, TANK_PALETTES.hush.l, 6);
        }

        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        const distance = distanceBetween(enemy, target);
        if (hiding) {
            // Circle toward the target's blind side
            this.drive(game, enemy, angle + (distance > 170 ? 0.7 * enemy.strafe : 1.5 * enemy.strafe));
            enemy.turretAngle = angle;
            return;
        }
        this.aimAt(game, enemy, this.aimPoint(game, enemy, target), 0.08);
        const sees = game.map.lineClear(enemy.x, enemy.y, target.x, target.y);
        if (!sees || distance > enemy.def.range * 1.3) this.chase(game, enemy);
        this.tryFire(game, enemy, target);
    },

    /**
     * Fermatas stay out of the fight, keeping close to whoever needs them
     */
    support(game, enemy, target) {
        const friends = game.tanks.filter(t => t.isAlive && t.enemyType && t !== enemy && !t.immobile);
        const distance = distanceBetween(enemy, target);
        const away = Math.atan2(enemy.y - target.y, enemy.x - target.x);
        enemy.turretAngle += 0.03;

        if (distance < 220) {
            this.drive(game, enemy, away);
            return;
        }
        let nearest = null;
        let best = Infinity;
        friends.forEach(friend => {
            const d = distanceBetween(enemy, friend);
            if (d < best) {
                best = d;
                nearest = friend;
            }
        });
        if (nearest && best > 130) {
            const route = game.map.routePoint(enemy.x, enemy.y, enemy.size, game.map.field([nearest]));
            if (route) this.drive(game, enemy, Math.atan2(route.y - enemy.y, route.x - enemy.x));
        }
    },

    /**
     * Metronomes track their target and fire strictly on the beat
     */
    emplacement(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        if (distance < enemy.def.aggro) {
            this.aimAt(game, enemy, Math.atan2(target.y - enemy.y, target.x - enemy.x), 0.05);
            enemy.tracking = target;
        } else {
            enemy.tracking = null;
        }
    },

    emplacementBeat(enemy, beatIndex) {
        const game = window.game;
        if (!enemy.alerted || !enemy.tracking || game.hasStatus(enemy, 'sleep')) return;
        // The beat before firing it flashes, so the shot can be read in time
        const phase = beatIndex % enemy.def.beats;
        if (phase === enemy.def.beats - 1) {
            enemy.hurtUntil = game.clock + 80;
        } else if (phase === 0 && game.map.lineClear(enemy.x, enemy.y, enemy.tracking.x, enemy.tracking.y)) {
            Enemies.shoot(game, enemy, enemy.turretAngle);
            if (enemy.pattern) Enemies.ring(game, enemy, enemy.pattern.ring);
        }
    },

    supportBeat(enemy, beatIndex) {
        const game = window.game;
        if (!enemy.alerted || beatIndex % 4 !== 0 || game.hasStatus(enemy, 'sleep')) return;
        let helped = false;
        game.tanks.forEach(other => {
            if (other === enemy || !other.isAlive || !other.enemyType) return;
            if (distanceBetween(other, enemy) < enemy.def.supportRadius) {
                helped = true;
                other.health = Math.min(other.maxHealth, other.health + enemy.def.supportHeal);
                game.giveShield(other, 900, 2);
            }
        });
        if (helped) game.ring(enemy.x, enemy.y, enemy.def.supportRadius, TANK_PALETTES.pink.l, 420);
        if (enemy.pattern) Enemies.ring(game, enemy, enemy.pattern.ring);
    },

    /**
     * Some enemies leave something behind
     */
    onDeath(game, enemy) {
        if (enemy.enemyType === 'crescendo' && !enemy.detonated) this.detonate(game, enemy);
        // Set right at last, it rings once and heads for home
        game.floatText(enemy.x, enemy.y - 8, '\u266A', '#ffd45e', 20);
        window.audioSystem.pianoNote(72 + randomInt(0, 4) * 2, 0.35, 0.4);
        if (Math.random() < 0.16) {
            const options = ['HEALTH', 'HARMONY', 'RAPID_FIRE', 'SPEED', 'SPREAD_SHOT', 'BOUNCING_BULLETS']
                .filter(type => game.powerupsManager.isUseful(type));
            game.powerupsManager.drop(enemy.x, enemy.y, options[randomInt(0, options.length - 1)]);
        }
    }
};

window.Enemies = Enemies;

// =============================================================================
// THE DISSONANCE: CAMPAIGN ENEMIES
// =============================================================================

const ENEMY_BULLET_COLOR = '#ff4d6d';

const ENEMY_TYPES = {
    quaver: {
        name: 'Quaver', style: 'rusher', chassis: 'scout', palette: 'blood', eyes: 'angry',
        size: 30, health: 8, speed: 2.4, fireMs: 1500, bulletSpeed: 4.6, damage: 1, range: 150, aggro: 460,
        swarm: true
    },
    triplet: {
        name: 'Triplet', style: 'skirmisher', chassis: 'triplet', palette: 'bruise', eyes: 'angry',
        size: 38, health: 14, speed: 1.6, fireMs: 1700, bulletSpeed: 4, damage: 1, range: 300, aggro: 520,
        shots: 3, spread: 0.27, pattern: { fan: 5, spread: 0.24 }
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
        swarm: true
    },
    rest: {
        name: 'Rest', style: 'phantom', chassis: 'wisp', palette: 'hush', eyes: 'hollow',
        size: 34, health: 12, speed: 2.2, fireMs: 1400, bulletSpeed: 4.8, damage: 2, range: 230, aggro: 560,
        swarm: true
    },
    fermata: {
        name: 'Fermata', style: 'support', chassis: 'medic', palette: 'pink', eyes: 'sleepy',
        size: 36, health: 16, speed: 1.4, bulletSpeed: 4, damage: 1, aggro: 480, supportRadius: 210, supportHeal: 3,
        pattern: { ring: 6 }
    },
    trill: {
        name: 'Trill', style: 'skirmisher', chassis: 'trill', palette: 'orange', eyes: 'angry',
        size: 38, health: 16, speed: 1.5, fireMs: 2200, bulletSpeed: 5, damage: 1, range: 280, aggro: 520,
        burst: 5, pattern: { burst: 8 }
    },
    // Cannot be hurt until it has been put to sleep, when one shot will finish it
    sforzando: {
        name: 'Sforzando', style: 'wakeful', chassis: 'heavy', palette: 'acid', eyes: 'hollow',
        size: 44, health: 24, speed: 0.9, bulletSpeed: 3.4, damage: 1, aggro: 900,
        wakeful: true, drowsy: 1000, sleepMs: 12000, ringShots: 6
    },
    // The final boss's chorus. Always exactly as tough as The Whole Scale is strong.
    grace: {
        name: 'Grace Note', style: 'rusher', chassis: 'scout', palette: 'ghost', eyes: 'hollow',
        size: 28, fixedHealth: HARMONY_CONFIG.FINALE_DAMAGE, speed: 2.5, fireMs: 1300, bulletSpeed: 4.2,
        damage: 1, range: 170, aggro: 2000
    }
};

const ENEMY_SWARM = {
    SLOTS_PER_TANK: 0.35,   // More of a swarm gets to attack for each tank in the crew
    WAIT_RANGE: 340,        // How far off the rest of a swarm waits for its turn
    SPACING: 76             // Enemies keep this far apart
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
        const crew = 1 + game.mode.extraTanks(game) * CAMPAIGN_CONFIG.ENEMY_SCALING.healthPerTank;
        const health = def.fixedHealth
            ?? Math.ceil(def.health * difficulty.enemyHealthMultiplier * crew * game.mode.crowdToughness(game));
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
            patternScale: difficulty.patternScale || 1,
            doubleTime: !!difficulty.doubleTime && !!def.pattern && !def.pattern.burst,
            bulletLife: difficulty.bulletLifeMs,
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
        if (def.style === 'wakeful') enemy.onBeat = this.wakefulBeat;
        return enemy;
    },

    update(game, enemy, deltaTime) {
        const target = this.chooseTarget(game, enemy);
        this.checkAlert(game, enemy, target);

        if (!enemy.alerted || !target) {
            this.patrol(game, enemy);
            return;
        }
        if (enemy.def.swarm && !enemy.engaged) {
            this.holdBack(game, enemy, target);
            return;
        }
        this[enemy.def.style](game, enemy, target, deltaTime);
    },

    /**
     * A swarm takes turns. Only the few nearest close in and open fire, and the rest
     * wait out of the fight, circling, until one of those places comes free. Called
     * once a beat.
     */
    organizeSwarm(game, difficulty) {
        const crew = game.tanks.filter(tank => tank.isAlive && tank.faction === 'crew' && !tank.inert).length;
        const slots = Math.round(difficulty.swarmSlots * (1 + Math.max(0, crew - 1) * ENEMY_SWARM.SLOTS_PER_TANK));
        const swarm = game.tanks.filter(tank => tank.isAlive && tank.enemyType && tank.def.swarm && tank.alerted);
        const reach = enemy => (enemy.currentTarget ? distanceBetween(enemy, enemy.currentTarget) : Infinity);
        swarm.sort((a, b) => reach(a) - reach(b));
        swarm.forEach((enemy, i) => {
            enemy.engaged = i < slots;
        });
    },

    holdBack(game, enemy, target) {
        const distance = distanceBetween(enemy, target);
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        this.aimAt(game, enemy, angle, 0.06);
        if (game.clock >= enemy.nextStrafeFlip) {
            enemy.strafe *= -1;
            enemy.nextStrafeFlip = game.clock + 1400 + Math.random() * 1400;
        }
        if (distance < ENEMY_SWARM.WAIT_RANGE * 0.8) {
            this.drive(game, enemy, angle + Math.PI + enemy.strafe * 0.6, 0.7);
        } else if (distance > ENEMY_SWARM.WAIT_RANGE * 1.3) {
            this.chase(game, enemy, 0.8);
        } else {
            this.drive(game, enemy, angle + enemy.strafe * Math.PI / 2, 0.35);
        }
    },

    chooseTarget(game, enemy) {
        enemy.currentTarget = game.nearestHostile(enemy, enemy.x, enemy.y);
        return enemy.currentTarget;
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
        let dirX = Math.cos(angle);
        let dirY = Math.sin(angle);

        // Enemies spread out as they go, so that there is always a way between them
        game.tanks.forEach(other => {
            if (other === enemy || !other.isAlive || !other.enemyType) return;
            const dx = enemy.x - other.x;
            const dy = enemy.y - other.y;
            if (Math.abs(dx) > ENEMY_SWARM.SPACING || Math.abs(dy) > ENEMY_SWARM.SPACING) return;
            const distance = Math.hypot(dx, dy);
            if (distance === 0 || distance >= ENEMY_SWARM.SPACING) return;
            const force = (1 - distance / ENEMY_SWARM.SPACING) * 1.4;
            dirX += dx / distance * force;
            dirY += dy / distance * force;
        });

        const length = Math.hypot(dirX, dirY) || 1;
        game.collisions.moveTankWithSliding(
            enemy, enemy.x + dirX / length * speed, enemy.y + dirY / length * speed, Math.atan2(dirY, dirX)
        );
        enemy.moved = true;
    },

    /**
     * Head for the nearest crew member along the shared route
     */
    chase(game, enemy, factor = 1) {
        if (!enemy.currentTarget) return;
        const route = game.map.routePoint(enemy.x, enemy.y, enemy.size, game.map.field([enemy.currentTarget]));
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
            life: enemy.bulletLife,
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
     * A bullet hell is many weak shots, not many strong ones. The extra shots in a
     * pattern hit for half and travel slower than aimed ones, so that there is room
     * to read them and weave through.
     */
    patternShot(enemy, pace) {
        return { speed: enemy.bulletSpeed * pace, size: 10, kind: 'wrong', damage: enemy.damage * 0.5 };
    },

    fan(game, enemy, angle, count, spread) {
        const total = Math.round(count * enemy.patternScale) | 1; // An odd fan keeps one shot aimed
        for (let i = 0; i < total; i++) {
            const offset = (i - (total - 1) / 2) * spread * (count / total);
            this.shoot(game, enemy, angle + offset, offset ? this.patternShot(enemy, 0.72) : {});
        }
    },

    ring(game, enemy, count) {
        const total = Math.round(count * enemy.patternScale);
        const start = Math.random() * Math.PI * 2;
        for (let i = 0; i < total; i++) {
            this.shoot(game, enemy, start + (i / total) * Math.PI * 2, { ...this.patternShot(enemy, 0.62), bounces: 0 });
        }
    },

    fireVolley(game, enemy, angle) {
        const def = enemy.def;
        const pattern = enemy.pattern;
        if (enemy.doubleTime && !enemy.playingBack) {
            // On Fortissimo every pattern comes straight back on the half beat
            game.after(game.beat.msPerBeat / 2, () => {
                if (!enemy.isAlive || game.hasStatus(enemy, 'sleep')) return;
                enemy.playingBack = true;
                this.fireVolley(game, enemy, enemy.turretAngle);
                enemy.playingBack = false;
            });
        }
        if (pattern && pattern.ring) {
            this.ring(game, enemy, pattern.ring);
        } else if (pattern && pattern.fan) {
            this.fan(game, enemy, angle, pattern.fan, pattern.spread);
        } else if (def.burst) {
            const burst = Math.round((pattern ? pattern.burst : def.burst) * enemy.patternScale);
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
     * A Sforzando plods after the crew, and is only ever stopped by a Lullaby
     */
    wakeful(game, enemy, target) {
        this.aimAt(game, enemy, Math.atan2(target.y - enemy.y, target.x - enemy.x), 0.04);
        if (distanceBetween(enemy, target) > 160) this.chase(game, enemy);
    },

    wakefulBeat(enemy, beatIndex) {
        const game = window.game;
        if (beatIndex % 4 === 0 && !game.hasStatus(enemy, 'sleep') && !game.dialog) {
            Enemies.ring(game, enemy, enemy.def.ringShots);
            window.audioSystem.enemyShoot();
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
            if (enemy.pattern && beatIndex % 4 === 0) Enemies.ring(game, enemy, enemy.pattern.ring);
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

// =============================================================================
// BOSSES
// =============================================================================
// Bosses move to the beat. Every attack is painted on the floor before it lands,
// and the warning lasts a whole number of beats, so the music tells you when to
// move. Phases change as a boss's health falls.

const BOSS_TYPES = {
    thump: {
        name: 'Sir Thump', title: 'The Rusty Hammer', palette: 'rust', size: 92, health: 150, speed: 0.8,
        turretLength: 54, restBeats: 3, power: 0.55, slamBeats: 4,
        phases: [
            { below: 1, attacks: ['slam', 'volley'] },
            { below: 0.62, attacks: ['slam', 'volley', 'keyWave'] },
            { below: 0.3, attacks: ['slam', 'keyWave', 'summon', 'volley'], rest: 2 }
        ]
    },
    tremolo: {
        name: 'Madame Tremolo', title: 'The String Spider', palette: 'teal', size: 84, health: 165, speed: 1.3,
        turretLength: 44, restBeats: 2, power: 0.85,
        phases: [
            { below: 1, attacks: ['pluck', 'webShot', 'skitter'] },
            { below: 0.62, attacks: ['pluck', 'spiral', 'webShot', 'skitter'] },
            { below: 0.3, attacks: ['triplePluck', 'spiral', 'summonWeb', 'skitter'], rest: 1 }
        ]
    },
    mute: {
        name: 'The Great Mute', title: 'Keeper of the Felt', palette: 'hush', size: 100, health: 165, speed: 0.75,
        turretLength: 54, restBeats: 3, frontArmor: 1.05, power: 0.6,
        phases: [
            { below: 1, attacks: ['charge', 'hushZone', 'hushOrbs'] },
            { below: 0.62, attacks: ['charge', 'hushZone', 'hushOrbs', 'summonDampers'] },
            { below: 0.3, attacks: ['charge', 'charge', 'hushZone', 'hushOrbs'], rest: 1 }
        ]
    },
    key89: {
        name: 'The Eighty-Ninth Key', title: 'Never Played', palette: 'bruise', size: 88, health: 240, speed: 1.1,
        turretLength: 46, restBeats: 2, power: 1.2, slamBeats: 3,
        phases: [
            { below: 1, attacks: ['slam', 'pluck', 'volley'] },
            { below: 0.66, attacks: ['spiral', 'hushZone', 'pluck', 'summon'] },
            { below: 0.33, attacks: ['triplePluck', 'spiral', 'slam', 'hushOrbs', 'keyWave'], rest: 1 }
        ],
        resolves: true // Cannot be destroyed, only played
    }
};

const Bosses = {
    /**
     * Create a boss, sized to the crew that is facing it
     */
    create(game, type, x, y, difficulty) {
        const def = BOSS_TYPES[type];
        const scaling = CAMPAIGN_CONFIG.BOSS_SCALING;
        const humans = Math.max(1, game.numPlayers);
        const crewFactor = 1 + (humans - 1) * scaling.perExtraPlayer + game.numAIBots * scaling.perAlly;
        const health = Math.round(def.health * difficulty.enemyHealthMultiplier * crewFactor);

        const boss = game.createTank({
            x,
            y,
            name: def.name,
            boss: type,
            def,
            faction: 'dissonance',
            isAI: true,
            palette: def.palette,
            chassis: 'heavy',
            eyes: 'angry',
            size: def.size,
            health,
            maxHealth: health,
            speed: def.speed * difficulty.enemySpeedMultiplier,
            turretLength: def.turretLength,
            frontArmor: def.frontArmor || 0,
            armorAngle: 0,
            bulletSpeed: 4 * difficulty.enemyBulletSpeedMultiplier,
            damage: difficulty.enemyDamageMultiplier * def.power,
            difficulty,
            phase: 0,
            busyUntilBeat: 0,
            attackIndex: 0,
            lastAttack: null,
            spiralAngle: 0,
            charging: null,
            onBeat: this.onBossBeat
        });
        boss.turretAngle = Math.PI / 2;
        game.setStatus(boss, 'spawnProtect', 1000);
        return boss;
    },

    currentPhase(boss) {
        const fraction = boss.health / boss.maxHealth;
        let phase = 0;
        boss.def.phases.forEach((entry, i) => {
            if (fraction <= entry.below) phase = i;
        });
        return phase;
    },

    update(game, boss, deltaTime) {
        if (boss.resolving) {
            boss.turretAngle += 0.01;
            return;
        }

        const phase = this.currentPhase(boss);
        if (phase !== boss.phase) {
            boss.phase = phase;
            game.shake(9);
            game.flash('#ffffff', 160);
            window.audioSystem.bossRoar();
            game.ring(boss.x, boss.y, 260, TANK_PALETTES[boss.palette].h, 500);
            if (game.mode.onBossPhase) game.mode.onBossPhase(game, boss, phase);
        }

        const target = game.nearestHostile(boss, boss.x, boss.y);
        if (boss.charging) {
            this.continueCharge(game, boss);
            return;
        }
        if (boss.leaping || !target) return;

        const wanted = Math.atan2(target.y - boss.y, target.x - boss.x);
        boss.turretAngle += normalizeAngle(wanted - boss.turretAngle) * 0.05;
        if (boss.frontArmor) boss.armorAngle += normalizeAngle(wanted - boss.armorAngle) * 0.018;

        // Between attacks, walk the stage
        if (!boss.rooted) {
            const distance = distanceBetween(boss, target);
            const preferred = boss.boss === 'tremolo' ? 320 : 200;
            if (distance > preferred) {
                const route = game.map.nextStep(boss.x, boss.y, game.map.field([target]));
                if (route) {
                    const angle = Math.atan2(route.y - boss.y, route.x - boss.x);
                    this.step(game, boss, boss.x + Math.cos(angle) * boss.speed, boss.y + Math.sin(angle) * boss.speed);
                    boss.moved = true;
                }
            }
        }
    },

    /**
     * Move a boss, which is too big for the normal tile checks to steer well
     */
    step(game, boss, x, y) {
        const margin = boss.size / 2 + WORLD.TILE;
        boss.x = Math.max(margin, Math.min(game.map.width - margin, x));
        boss.y = Math.max(margin, Math.min(game.map.height - margin, y));
    },

    onBossBeat(boss, beatIndex) {
        const game = window.game;
        if (boss.resolving || boss.charging || boss.leaping) return;
        if (game.hasStatus(boss, 'sleep') || game.hasStatus(boss, 'stun')) return;
        if (beatIndex < boss.busyUntilBeat || game.dialog) return;

        const phase = boss.def.phases[boss.phase];
        const target = game.nearestHostile(boss, boss.x, boss.y);
        if (!target) return;

        // Work through the list, never the same move twice running
        let attack = phase.attacks[boss.attackIndex % phase.attacks.length];
        boss.attackIndex++;
        if (attack === boss.lastAttack && phase.attacks.length > 1) {
            attack = phase.attacks[boss.attackIndex % phase.attacks.length];
            boss.attackIndex++;
        }
        boss.lastAttack = attack;

        const beats = Bosses.attacks[attack](game, boss, target);
        const rest = phase.rest ?? boss.def.restBeats;
        boss.busyUntilBeat = beatIndex + beats + rest;
    },

    beatMs(game) {
        return game.beat.msPerBeat;
    },

    shootFrom(game, boss, angle, overrides = {}) {
        game.spawnBullet({
            x: boss.x + Math.cos(angle) * (boss.size / 2),
            y: boss.y + Math.sin(angle) * (boss.size / 2),
            angle,
            speed: boss.bulletSpeed,
            size: 14,
            damage: 2 * boss.damage,
            owner: boss,
            kind: 'wrong',
            color: ENEMY_BULLET_COLOR,
            ...overrides
        });
    },

    /**
     * A ring of bullets with a gap left in it, always aimed to leave an escape
     */
    radialWithGap(game, boss, count, gapAngle, gapWidth, overrides = {}) {
        const total = this.more(boss, count);
        for (let i = 0; i < total; i++) {
            const angle = (i / total) * Math.PI * 2;
            if (Math.abs(normalizeAngle(angle - gapAngle)) < gapWidth) continue;
            this.shootFrom(game, boss, angle, overrides);
        }
    },

    /**
     * How many shots a pattern has at this difficulty
     */
    more(boss, count) {
        return Math.round(count * boss.difficulty.bulletDensity);
    },

    /**
     * Evenly spread offsets for a fan of this many shots
     */
    fanOffsets(boss, count, spacing) {
        const total = this.more(boss, count);
        return Array.from({ length: total }, (_, i) => (i - (total - 1) / 2) * spacing);
    },

    damageArea(game, boss, x, y, radius, amount) {
        game.tanks.forEach(tank => {
            if (tank.isAlive && game.areHostile(boss, tank) && Math.hypot(tank.x - x, tank.y - y) < radius + tank.size / 2) {
                game.damageTank(tank, amount, { source: boss, type: 'blast' });
            }
        });
    },

    damageLine(game, boss, mark, amount) {
        const { x, y, angle, width } = mark;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        game.tanks.forEach(tank => {
            if (!tank.isAlive || !game.areHostile(boss, tank)) return;
            const dx = tank.x - x;
            const dy = tank.y - y;
            const along = dx * cos + dy * sin;
            const across = Math.abs(-dx * sin + dy * cos);
            if (along >= 0 && along <= mark.length && across < width / 2 + tank.size / 2) {
                game.damageTank(tank, amount, { source: boss, type: 'blast' });
            }
        });
    },

    summon(game, boss, type, count) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random();
            const reach = boss.size / 2 + 50;
            const x = boss.x + Math.cos(angle) * reach;
            const y = boss.y + Math.sin(angle) * reach;
            if (game.map.tankBlocked(x, y, 34)) continue;
            const minion = Enemies.create(game, type, x, y, boss.difficulty);
            minion.alerted = true;
            game.tanks.push(minion);
            game.mode.enemyList.push(minion);
            game.ring(x, y, 40, '#ec8cf8', 300);
        }
    },

    continueCharge(game, boss) {
        const charge = boss.charging;
        const nextX = boss.x + Math.cos(charge.angle) * charge.speed;
        const nextY = boss.y + Math.sin(charge.angle) * charge.speed;
        const margin = boss.size / 2 + WORLD.TILE;
        const hitEdge = nextX < margin || nextY < margin
            || nextX > game.map.width - margin || nextY > game.map.height - margin;
        const hitWall = game.map.blocksBullet(game.map.tileAt(
            nextX + Math.cos(charge.angle) * boss.size / 2,
            nextY + Math.sin(charge.angle) * boss.size / 2
        ));

        if (hitEdge || hitWall) {
            // Running into a wall leaves it dazed, armor down
            boss.charging = null;
            game.shake(12);
            window.audioSystem.slam();
            game.setStatus(boss, 'stun', this.beatMs(game) * 6);
            boss.frontArmorSaved = boss.frontArmor;
            boss.frontArmor = 0;
            boss.damageTaken = 1.5;
            game.floatIcon(boss.x, boss.y - 60, 'star');
            game.after(this.beatMs(game) * 6, () => {
                boss.frontArmor = boss.frontArmorSaved || 0;
                boss.damageTaken = 1;
            });
            return;
        }

        boss.x = nextX;
        boss.y = nextY;
        boss.moved = true;

        // A charge hits each tank once and throws it clear
        game.tanks.forEach(tank => {
            if (!tank.isAlive || charge.struck.has(tank) || !game.areHostile(boss, tank)) return;
            if (distanceBetween(boss, tank) < boss.size / 2 + tank.size / 2) {
                charge.struck.add(tank);
                game.damageTank(tank, 6 * boss.damage, { source: boss, type: 'blast' });
                const side = normalizeAngle(Math.atan2(tank.y - boss.y, tank.x - boss.x) - charge.angle) >= 0 ? 1 : -1;
                game.knockback(tank, charge.angle + side * 1.2, 16);
            }
        });
    },

    // -------------------------------------------------------------------------
    // Attacks. Each returns how many beats it takes.
    // -------------------------------------------------------------------------
    attacks: {
        /**
         * Crouch for a beat, then leap and crash down where the target was standing.
         * The crouch can still be shot, and the mark is on the floor from the start.
         */
        slam(game, boss, target) {
            const beat = Bosses.beatMs(game);
            const margin = boss.size / 2 + WORLD.TILE;
            const x = Math.max(margin, Math.min(game.map.width - margin, target.x));
            const y = Math.max(margin, Math.min(game.map.height - margin, target.y));
            const radius = 120;
            const beats = boss.def.slamBeats || 3;
            const duration = beat * beats;
            boss.leaping = true;
            boss.leapArc = { fromX: boss.x, fromY: boss.y, x, y, start: game.clock, duration, crouch: beat };
            game.after(beat, () => {
                if (boss.leaping) boss.intangible = true;
            });

            game.telegraph({ x, y, radius }, duration, () => {
                boss.x = x;
                boss.y = y;
                boss.leaping = false;
                boss.leapArc = null;
                boss.intangible = false;
                game.shake(14);
                window.audioSystem.slam();
                game.ring(x, y, radius, '#ffb066', 300);
                Bosses.damageArea(game, boss, x, y, radius, 5 * boss.damage);
                Bosses.radialWithGap(game, boss, 12, Math.random() * Math.PI * 2, 0.5, { speed: 3.4 });
            });
            return beats + 1;
        },

        /**
         * Three fans of fire, one on each beat
         */
        volley(game, boss, target) {
            const beat = Bosses.beatMs(game);
            for (let i = 0; i < 3; i++) {
                game.after(i * beat, () => {
                    if (!boss.isAlive) return;
                    const aim = game.nearestHostile(boss, boss.x, boss.y) || target;
                    const angle = Math.atan2(aim.y - boss.y, aim.x - boss.x);
                    Bosses.fanOffsets(boss, 3, 0.2).forEach(offset => Bosses.shootFrom(game, boss, angle + offset));
                    boss.recoilUntil = game.clock + 120;
                    window.audioSystem.enemyShoot();
                });
            }
            return 3;
        },

        /**
         * A wall of bullets sweeps the stage, with a gap to drive through
         */
        keyWave(game, boss, target) {
            const map = game.map;
            const horizontal = Math.abs(target.x - boss.x) > Math.abs(target.y - boss.y);
            const angle = horizontal ? (target.x > boss.x ? 0 : Math.PI) : (target.y > boss.y ? Math.PI / 2 : -Math.PI / 2);
            const span = horizontal ? map.rows : map.cols;
            const gapStart = randomInt(2, span - 6);
            const startAlong = horizontal ? boss.x : boss.y;

            game.after(Bosses.beatMs(game), () => {
                for (let i = 1; i < span - 1; i++) {
                    if (i >= gapStart && i < gapStart + 3) continue;
                    const across = (i + 0.5) * WORLD.TILE;
                    game.spawnBullet({
                        x: horizontal ? startAlong : across,
                        y: horizontal ? across : startAlong,
                        angle,
                        speed: 2.8,
                        size: 16,
                        damage: 2 * boss.damage,
                        owner: boss,
                        kind: 'wrong',
                        color: ENEMY_BULLET_COLOR,
                        life: 5200
                    });
                }
                window.audioSystem.slam();
            });
            return 2;
        },

        summon(game, boss) {
            Bosses.summon(game, boss, 'quaver', 2);
            window.audioSystem.bossRoar();
            return 2;
        },

        /**
         * A string across the whole stage is drawn back and let go
         */
        pluck(game, boss, target) {
            Bosses.attacks.pluckLine(game, boss, target, Math.random() < 0.5);
            return 3;
        },

        triplePluck(game, boss, target) {
            Bosses.attacks.pluckLine(game, boss, target, true);
            Bosses.attacks.pluckLine(game, boss, target, false);
            game.after(Bosses.beatMs(game), () => {
                if (boss.isAlive) Bosses.attacks.pluckLine(game, boss, target, Math.random() < 0.5);
            });
            return 4;
        },

        pluckLine(game, boss, target, horizontal) {
            const map = game.map;
            const mark = horizontal
                ? { x: 0, y: target.y, angle: 0, length: map.width, width: 44 }
                : { x: target.x, y: 0, angle: Math.PI / 2, length: map.height, width: 44 };
            game.telegraph(mark, Bosses.beatMs(game) * 2, (done) => {
                window.audioSystem.pluck();
                game.shake(5);
                game.beam = { ...done, start: game.clock, end: game.clock + 200 };
                Bosses.damageLine(game, boss, done, 5 * boss.damage);
            });
        },

        webShot(game, boss, target) {
            const beat = Bosses.beatMs(game);
            for (let i = 0; i < 2; i++) {
                game.after(i * beat, () => {
                    if (!boss.isAlive) return;
                    const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
                    Bosses.shootFrom(game, boss, angle, {
                        speed: 3.2,
                        size: 20,
                        kind: 'big',
                        drag: 0.99,
                        life: 1800,
                        burstAt: 1,
                        onExpire(bullet) {
                            const pieces = Bosses.more(boss, 6);
                            for (let k = 0; k < pieces; k++) {
                                game.spawnBullet({
                                    x: bullet.x, y: bullet.y, angle: k / pieces * Math.PI * 2, speed: 3,
                                    size: 12, damage: 1.5 * boss.damage, owner: boss, kind: 'wrong',
                                    color: ENEMY_BULLET_COLOR, life: 1400
                                });
                            }
                        }
                    });
                });
            }
            return 3;
        },

        /**
         * A spinning stream with room to weave through it
         */
        spiral(game, boss) {
            const beat = Bosses.beatMs(game);
            const shots = 22;
            boss.rooted = true;
            for (let i = 0; i < shots; i++) {
                game.after(i * beat / 5, () => {
                    if (!boss.isAlive || game.hasStatus(boss, 'sleep')) return;
                    boss.spiralAngle += 0.62;
                    const arms = Bosses.more(boss, 2);
                    for (let arm = 0; arm < arms; arm++) {
                        Bosses.shootFrom(game, boss, boss.spiralAngle + arm * Math.PI * 2 / arms, { speed: 3 });
                    }
                    if (i % 4 === 0) window.audioSystem.enemyShoot();
                    if (i === shots - 1) boss.rooted = false;
                });
            }
            return 5;
        },

        /**
         * Scuttle to a fresh spot
         */
        skitter(game, boss) {
            const map = game.map;
            const point = map.randomOpenPoint(4) || { x: map.width / 2, y: map.height / 2 };
            boss.leaping = true;
            boss.intangible = true;
            boss.leapArc = { fromX: boss.x, fromY: boss.y, x: point.x, y: point.y, start: game.clock, duration: Bosses.beatMs(game) };
            game.after(Bosses.beatMs(game), () => {
                boss.x = point.x;
                boss.y = point.y;
                boss.leaping = false;
                boss.intangible = false;
                boss.leapArc = null;
                Bosses.radialWithGap(game, boss, 8, Math.random() * Math.PI * 2, 0.4, { speed: 2.8 });
            });
            return 2;
        },

        summonWeb(game, boss) {
            Bosses.summon(game, boss, 'triplet', 2);
            window.audioSystem.bossRoar();
            return 2;
        },

        /**
         * Lower the head and charge. Hitting a wall leaves it open to attack.
         */
        charge(game, boss, target) {
            const beat = Bosses.beatMs(game);
            const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
            boss.rooted = true;
            boss.armorAngle = angle;
            boss.turretAngle = angle;
            const mark = {
                x: boss.x, y: boss.y, angle,
                length: Math.hypot(game.map.width, game.map.height), width: boss.size
            };
            game.telegraph(mark, beat * 2, () => {
                boss.rooted = false;
                if (!game.hasStatus(boss, 'sleep')) {
                    boss.charging = { angle, speed: 7.5, struck: new Set() };
                    window.audioSystem.bossRoar();
                }
            });
            return 5;
        },

        /**
         * A patch of silence. Chords and melodies do nothing inside it.
         */
        hushZone(game, boss, target) {
            const beat = Bosses.beatMs(game);
            const { x, y } = target;
            game.telegraph({ x, y, radius: 150 }, beat * 2, () => {
                game.mode.zones.push({ x, y, radius: 150, until: game.clock + beat * 12, born: game.clock });
                window.audioSystem.slam();
            });
            return 2;
        },

        hushOrbs(game, boss, target) {
            const base = Math.atan2(target.y - boss.y, target.x - boss.x);
            Bosses.fanOffsets(boss, 3, 0.7).forEach(offset => {
                Bosses.shootFrom(game, boss, base + offset, {
                    speed: 2.2, size: 18, kind: 'hush', homing: 0.018, life: 4800, color: '#e7d6ff'
                });
            });
            window.audioSystem.telegraph();
            return 3;
        },

        summonDampers(game, boss) {
            Bosses.summon(game, boss, 'rest', 2);
            window.audioSystem.bossRoar();
            return 2;
        }
    }
};

window.Bosses = Bosses;

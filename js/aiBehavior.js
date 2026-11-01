// =============================================================================
// AI BEHAVIOR SYSTEM
// =============================================================================
// Handles AI tank behavior: choosing what to do, getting there around obstacles,
// dodging, aiming ahead of moving targets and using chords.

class AIBehavior {
    constructor(game) {
        this.game = game;
    }

    /**
     * Give a tank its AI state the first time it thinks
     */
    brain(tank) {
        if (!tank.ai) {
            const skillKey = tank.skill || this.game.botSkill || 'NORMAL';
            tank.ai = {
                skill: BOT_SKILLS[skillKey] || BOT_SKILLS.NORMAL,
                goal: null,          // What the tank is currently doing
                target: null,
                targetLockedUntil: 0,
                nextThink: Math.random() * AI_CONFIG.THINK_MS,
                strafe: Math.random() < 0.5 ? 1 : -1,
                nextStrafeFlip: 0,
                aimError: 0,
                nextAimError: 0,
                sightedAt: 0,        // When the current target came into view
                dodge: null,
                dodgeUntil: 0,
                stuckCheckAt: 0,
                stuckX: tank.x,
                stuckY: tank.y,
                unstickUntil: 0,
                unstickAngle: 0,
                steerX: 0,           // The eased version of what the tank wants
                steerY: 0,
                arrived: false,      // Parked at the goal, until it moves off
                regrouping: false    // Heading back to the leader, until close again
            };
        }
        return tank.ai;
    }

    /**
     * Update AI tank behavior
     * @param {Object} tank - AI tank to update
     * @param {number} deltaTime - Time since last tick
     */
    updateAITank(tank, deltaTime) {
        const game = this.game;
        const ai = this.brain(tank);

        if (game.clock >= ai.nextThink) {
            ai.nextThink = game.clock + AI_CONFIG.THINK_MS;
            this.think(tank, ai);
        }

        const threat = this.findIncomingBullet(tank);
        this.useChords(tank, ai, threat);

        const steer = this.steering(tank, ai, threat);
        this.applySteering(tank, ai, steer);
        this.aimAndFire(tank, ai, deltaTime);
    }

    /**
     * Decide what this tank wants, in order of how much it matters right now
     */
    think(tank, ai) {
        const game = this.game;
        ai.target = this.chooseTarget(tank, ai);

        const healthFraction = tank.health / tank.maxHealth;
        const pickup = this.bestPickup(tank, healthFraction);

        if (pickup && (healthFraction < 0.6 || !ai.target || this.distanceTo(tank, ai.target) > AI_CONFIG.ENGAGE_RANGE * 0.6)) {
            ai.goal = { type: 'pickup', x: pickup.x, y: pickup.y };
        } else if (healthFraction < AI_CONFIG.RETREAT_HEALTH && ai.target && this.outnumbered(tank, ai.target)) {
            ai.goal = { type: 'retreat', ...this.findCover(tank, ai.target) };
        } else if (tank.isAIAlly && this.needsToRegroup(tank, ai)) {
            ai.goal = { type: 'regroup', ...this.followSpot(tank) };
        } else if (ai.target) {
            const sees = game.map.lineClear(tank.x, tank.y, ai.target.x, ai.target.y);
            const distance = this.distanceTo(tank, ai.target);
            if (sees && distance < AI_CONFIG.ENGAGE_RANGE) {
                ai.goal = { type: 'fight' };
            } else if (tank.isAIAlly && distance > AI_CONFIG.HUNT_LEASH) {
                // Allies stay with the crew rather than wandering off across the map
                ai.goal = { type: 'regroup', ...this.followSpot(tank) };
            } else {
                ai.goal = { type: 'hunt', x: ai.target.x, y: ai.target.y };
            }
        } else if (tank.isAIAlly) {
            ai.goal = { type: 'regroup', ...this.followSpot(tank) };
        } else {
            ai.goal = null;
        }

        if (game.clock >= ai.nextStrafeFlip) {
            ai.strafe *= -1;
            ai.nextStrafeFlip = game.clock + 900 + Math.random() * 1400;
        }
    }

    /**
     * Pick who to fight. A weakened enemy nearby beats a healthy one, and whoever has
     * just been shooting at us counts for extra. Sticks with a target for a while so
     * that a bot does not twitch between two tanks.
     */
    chooseTarget(tank, ai) {
        const game = this.game;
        const held = ai.target;
        if (held && held.isAlive && game.areHostile(tank, held) && game.clock < ai.targetLockedUntil
            && !game.hasStatus(held, 'hidden')) return held;

        let best = null;
        let bestScore = Infinity;
        game.tanks.forEach(other => {
            if (!other.isAlive || !game.areHostile(tank, other) || game.hasStatus(other, 'hidden')) return;
            let score = distanceBetween(tank, other);
            score *= 0.6 + 0.4 * (other.health / other.maxHealth);
            if (!game.map.lineClear(tank.x, tank.y, other.x, other.y)) score += 260;
            if (other === held) score *= 0.75;
            if (tank.lastAttacker === other) score *= 0.7;
            if (score < bestScore) {
                bestScore = score;
                best = other;
            }
        });

        if (best !== held) ai.sightedAt = game.clock;
        ai.targetLockedUntil = game.clock + AI_CONFIG.TARGET_LOCK_MS;
        return best;
    }

    /**
     * The pickup most worth going for. Only counts ones with a route to them, and
     * measures by that route, so a pickup behind a wall does not hold a tank there.
     */
    bestPickup(tank, healthFraction) {
        const { map } = this.game;
        const range = tank.isAIAlly ? AI_CONFIG.PICKUP_RANGE * 0.6 : AI_CONFIG.PICKUP_RANGE;
        let best = null;
        let bestScore = range;
        this.game.powerups.forEach(powerup => {
            if (powerup.type === 'HEALTH' && healthFraction >= 0.9) return;
            if (powerup.type === 'HARMONY' && tank.meter >= 90) return;
            if (distanceBetween(tank, powerup) > range) return;
            let score = map.routeCost(tank.x, tank.y, map.field([powerup])) * WORLD.TILE;
            if (powerup.type === 'HEALTH') score *= 0.3 + healthFraction * 0.7;
            if (score < bestScore) {
                bestScore = score;
                best = powerup;
            }
        });
        return best;
    }

    /**
     * Is it worth running? A lone enemy near death is still worth finishing.
     */
    outnumbered(tank, target) {
        return target.health / target.maxHealth > tank.health / tank.maxHealth * 0.7;
    }

    /**
     * Find somewhere nearby that the enemy cannot see
     */
    findCover(tank, target) {
        const game = this.game;
        const away = Math.atan2(tank.y - target.y, tank.x - target.x);
        let best = null;
        let bestScore = -Infinity;
        for (let i = 0; i < 8; i++) {
            const angle = away + (i - 3.5) * 0.45;
            for (const reach of [120, 220]) {
                const x = tank.x + Math.cos(angle) * reach;
                const y = tank.y + Math.sin(angle) * reach;
                if (game.map.tankBlocked(x, y, tank.size)) continue;
                const hidden = !game.map.lineClear(target.x, target.y, x, y);
                const score = (hidden ? 300 : 0) + Math.hypot(x - target.x, y - target.y) * 0.3 - reach * 0.1;
                if (score > bestScore) {
                    bestScore = score;
                    best = { x, y };
                }
            }
        }
        return best || { x: tank.x, y: tank.y };
    }

    leaderOf(tank) {
        if (tank.leader && tank.leader.isAlive) return { x: tank.leader.x, y: tank.leader.y };
        const players = this.game.tanks.filter(t => t.isAlive && t.isPlayer);
        if (players.length === 0) {
            // With no humans aboard, the crew heads for the objective on its own
            const mode = this.game.mode;
            return (mode && mode.objectivePoint && mode.objectivePoint(this.game)) || { x: tank.x, y: tank.y };
        }
        return {
            x: players.reduce((sum, p) => sum + p.x, 0) / players.length,
            y: players.reduce((sum, p) => sum + p.y, 0) / players.length
        };
    }

    /**
     * Allies head back once they stray too far and keep going until they are close
     * again, rather than hovering on the line between fighting and following.
     */
    needsToRegroup(tank, ai) {
        const leader = this.leaderOf(tank);
        const distance = Math.hypot(leader.x - tank.x, leader.y - tank.y);
        const limit = CAMPAIGN_CONFIG.AI_ALLIES.followDistance;
        if (distance > limit * 1.4) ai.regrouping = true;
        else if (distance < limit * 0.8) ai.regrouping = false;
        return ai.regrouping;
    }

    /**
     * Each ally keeps its own spot in a ring around the leader, so that they do not
     * all try to park in one place. A spot inside a wall falls back on the leader.
     */
    followSpot(tank) {
        const leader = this.leaderOf(tank);
        const game = this.game;
        if (game.numPlayers === 0 && !tank.leader) return { ...leader, exact: true };

        const crew = game.tanks.filter(other => other.isAlive && other.isAIAlly);
        const place = Math.max(0, crew.indexOf(tank));
        const angle = (place / Math.max(1, crew.length)) * Math.PI * 2 + Math.PI * 0.75;
        const x = leader.x + Math.cos(angle) * AI_CONFIG.FOLLOW_RING;
        const y = leader.y + Math.sin(angle) * AI_CONFIG.FOLLOW_RING;
        const open = !game.map.tankBlocked(x, y, tank.size + 8) && game.map.lineClear(leader.x, leader.y, x, y);
        return open ? { x, y } : { ...leader, stopShort: true };
    }

    distanceTo(tank, other) {
        return Math.hypot(other.x - tank.x, other.y - tank.y);
    }

    /**
     * Look for a shot that is going to hit
     * @returns {Object|null} The most urgent bullet, with how to get out of its way
     */
    findIncomingBullet(tank) {
        const game = this.game;
        let worst = null;
        let soonest = AI_CONFIG.DANGER_LOOKAHEAD_TICKS;
        game.bullets.forEach(bullet => {
            if (!game.bulletHostileTo(bullet, tank)) return;
            const dx = tank.x - bullet.x;
            const dy = tank.y - bullet.y;
            const speedSq = bullet.vx * bullet.vx + bullet.vy * bullet.vy;
            if (speedSq === 0) return;
            const t = (dx * bullet.vx + dy * bullet.vy) / speedSq; // Ticks until closest approach
            if (t < 0 || t > soonest) return;
            const missX = dx - bullet.vx * t;
            const missY = dy - bullet.vy * t;
            if (Math.hypot(missX, missY) > AI_CONFIG.DANGER_RADIUS + tank.size / 2) return;
            soonest = t;
            worst = { bullet, ticks: t, missX, missY };
        });
        return worst;
    }

    /**
     * Add up everything pulling on the tank into one direction to drive
     */
    steering(tank, ai, threat) {
        const game = this.game;
        let x = 0;
        let y = 0;
        const goal = ai.goal;
        const target = ai.target;

        if (goal) {
            if (goal.type === 'fight' && target) {
                // Hold a comfortable range and keep moving sideways. The pull eases
                // off near the range it wants, so that it settles there.
                const distance = this.distanceTo(tank, target);
                const toX = (target.x - tank.x) / (distance || 1);
                const toY = (target.y - tank.y) / (distance || 1);
                const range = AI_CONFIG.STANDOFF_RANGE;
                let along = Math.max(-1, Math.min(1, (distance - range) / 90));
                if (distance < AI_CONFIG.TOO_CLOSE_RANGE) along = -1;
                x += toX * along - toY * ai.strafe * AI_CONFIG.STRAFE_FORCE;
                y += toY * along + toX * ai.strafe * AI_CONFIG.STRAFE_FORCE;
            } else if (goal.x !== undefined && !this.parked(tank, ai, goal)) {
                const route = this.routeTo(tank, goal);
                if (route) {
                    const distance = Math.hypot(route.x - tank.x, route.y - tank.y) || 1;
                    x += (route.x - tank.x) / distance;
                    y += (route.y - tank.y) / distance;
                    // Something in the way that can be shot out of it
                    if (route.crate) ai.breakCrate = route;
                }
            }
        }

        // Step out of the line of incoming fire. Whether a tank notices a shot is
        // settled once per shot, otherwise even the weakest bots would dodge them all.
        if (threat && threat.bullet !== ai.judgedBullet) {
            ai.judgedBullet = threat.bullet;
            ai.dodging = Math.random() < ai.skill.dodge;
        }
        if (threat && ai.dodging) {
            const miss = Math.hypot(threat.missX, threat.missY);
            const bulletSpeed = Math.hypot(threat.bullet.vx, threat.bullet.vy) || 1;
            let awayX = threat.missX / (miss || 1);
            let awayY = threat.missY / (miss || 1);
            if (miss < 4) {
                awayX = -threat.bullet.vy / bulletSpeed * ai.strafe;
                awayY = threat.bullet.vx / bulletSpeed * ai.strafe;
            }
            x += awayX * 1.8;
            y += awayY * 1.8;
        }

        // Get off anything painted on the floor before it lands
        const escape = this.escapeFromMarks(tank, ai);
        x += escape.x * 3;
        y += escape.y * 3;

        // Spread out from friends, so one blast does not catch everyone. A parked
        // tank only shuffles over if it is actually being crowded.
        const personalSpace = ai.arrived ? tank.size + 8 : AI_CONFIG.SEPARATION_RANGE;
        game.tanks.forEach(other => {
            if (other === tank || !other.isAlive || game.areHostile(tank, other)) return;
            const dx = tank.x - other.x;
            const dy = tank.y - other.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 0 && distance < personalSpace) {
                const force = (1 - distance / personalSpace) * AI_CONFIG.SEPARATION_FORCE;
                x += dx / distance * force;
                y += dy / distance * force;
            }
        });

        // Look before driving onto something that hurts
        const length = Math.hypot(x, y);
        if (length > 0.01) {
            const aheadX = tank.x + x / length * 34;
            const aheadY = tank.y + y / length * 34;
            const ahead = game.map.tileAt(aheadX, aheadY);
            const here = game.map.tileAt(tank.x, tank.y);
            if (ahead === TILES.STRING && here !== TILES.STRING && game.stringsActive()) {
                return { x: 0, y: 0 }; // Wait for the string to stop ringing
            }
            if (ahead === TILES.SPIKES && here !== TILES.SPIKES) {
                [x, y] = [-y * ai.strafe, x * ai.strafe]; // Turn aside instead
            }
        }
        return { x, y };
    }

    /**
     * Has this tank reached where it was going? It stays parked until the goal
     * moves well away, which is what stops it shuffling back and forth at the edge
     * of arriving. Pickups have no such edge: a tank drives right over them.
     */
    parked(tank, ai, goal) {
        if (goal.type === 'pickup') {
            ai.arrived = false;
            return false;
        }
        const distance = Math.hypot(goal.x - tank.x, goal.y - tank.y);
        let stop = 40;
        let resume = 90;
        if (goal.exact) {
            stop = 8;
            resume = 24;
        } else if (goal.stopShort) {
            stop = AI_CONFIG.FOLLOW_RING;
            resume = AI_CONFIG.FOLLOW_RING + AI_CONFIG.FOLLOW_RESUME;
        } else if (goal.type === 'regroup') {
            stop = AI_CONFIG.FOLLOW_ARRIVE;
            resume = AI_CONFIG.FOLLOW_RESUME;
        }
        if (ai.arrived && distance > resume) ai.arrived = false;
        else if (!ai.arrived && distance < stop) ai.arrived = true;
        return ai.arrived;
    }

    /**
     * Which way out of a boss's telegraphed attacks and silent zones. As with
     * bullets, each warning is noticed or missed once, according to skill.
     */
    escapeFromMarks(tank, ai) {
        const game = this.game;
        const margin = tank.size;
        let x = 0;
        let y = 0;

        game.telegraphs.forEach(mark => {
            if (!mark.noticed) mark.noticed = new Map();
            if (!mark.noticed.has(tank)) mark.noticed.set(tank, Math.random() < ai.skill.dodge + 0.25);
            if (!mark.noticed.get(tank)) return;

            if (mark.radius) {
                const cx = mark.follow ? mark.follow.x : mark.x;
                const cy = mark.follow ? mark.follow.y : mark.y;
                const distance = Math.hypot(tank.x - cx, tank.y - cy);
                if (distance < mark.radius + margin) {
                    x += (tank.x - cx) / (distance || 1);
                    y += (tank.y - cy) / (distance || 1);
                }
            } else {
                const cos = Math.cos(mark.angle);
                const sin = Math.sin(mark.angle);
                const dx = tank.x - mark.x;
                const dy = tank.y - mark.y;
                const along = dx * cos + dy * sin;
                const across = -dx * sin + dy * cos;
                if (along > -margin && along < mark.length && Math.abs(across) < mark.width / 2 + margin) {
                    const side = across >= 0 ? 1 : -1;
                    x += -sin * side;
                    y += cos * side;
                }
            }
        });

        ((game.mode && game.mode.zones) || []).forEach(zone => {
            const distance = Math.hypot(tank.x - zone.x, tank.y - zone.y);
            if (distance < zone.radius + margin) {
                x += (tank.x - zone.x) / (distance || 1) * 0.5;
                y += (tank.y - zone.y) / (distance || 1) * 0.5;
            }
        });
        return { x, y };
    }

    routeTo(tank, goal) {
        const { map } = this.game;
        const route = map.routePoint(tank.x, tank.y, tank.size, map.field([{ x: goal.x, y: goal.y }]));
        if (route) return route;

        // Already in the same tile as the goal, the last stretch is a straight line
        const sameTile = Math.floor(tank.x / WORLD.TILE) === Math.floor(goal.x / WORLD.TILE)
            && Math.floor(tank.y / WORLD.TILE) === Math.floor(goal.y / WORLD.TILE);
        return sameTile ? { x: goal.x, y: goal.y, crate: false } : null;
    }

    /**
     * Drive, easing toward what the tank wants so that competing pulls settle into
     * one heading rather than shaking it from side to side
     */
    applySteering(tank, ai, steer) {
        const game = this.game;
        const speed = game.speedOf(tank) * ai.skill.speedFactor;

        if (game.clock < ai.unstickUntil) {
            const newX = tank.x + Math.cos(ai.unstickAngle) * speed;
            const newY = tank.y + Math.sin(ai.unstickAngle) * speed;
            game.collisions.moveTankWithSliding(tank, newX, newY, ai.unstickAngle);
            tank.moved = true;
            return;
        }

        const wanted = Math.hypot(steer.x, steer.y);
        const scale = wanted > 1 ? 1 / wanted : 1;
        ai.steerX += (steer.x * scale - ai.steerX) * AI_CONFIG.STEER_EASING;
        ai.steerY += (steer.y * scale - ai.steerY) * AI_CONFIG.STEER_EASING;

        const length = Math.hypot(ai.steerX, ai.steerY);
        const driving = length > AI_CONFIG.STEER_DEADZONE;
        if (driving) {
            const dirX = ai.steerX / length;
            const dirY = ai.steerY / length;
            const pace = speed * Math.min(1, length * 1.4);
            const startX = tank.x;
            const startY = tank.y;
            tank.moveDirection = { x: dirX, y: dirY };
            game.collisions.moveTankWithSliding(tank, tank.x + dirX * pace, tank.y + dirY * pace, Math.atan2(dirY, dirX));
            tank.moved = true;

            // Strafing into a wall gets nowhere, so go the other way
            const blocked = Math.hypot(tank.x - startX, tank.y - startY) < pace * 0.3;
            if (blocked && ai.goal && ai.goal.type === 'fight') {
                ai.strafe *= -1;
                ai.nextStrafeFlip = game.clock + 900;
            }
        } else {
            tank.moveDirection = null;
        }

        if (game.clock >= ai.stuckCheckAt) {
            const travelled = Math.hypot(tank.x - ai.stuckX, tank.y - ai.stuckY);
            if (driving && travelled < 6) this.getUnstuck(tank, ai);
            ai.stuckX = tank.x;
            ai.stuckY = tank.y;
            ai.stuckCheckAt = game.clock + 700;
        }
    }

    /**
     * Not getting anywhere. The middle of the tile is the best bet, as every way
     * out is open from there. Already there, take whichever side has the most room.
     */
    getUnstuck(tank, ai) {
        const { map, clock } = this.game;
        const homeX = (Math.floor(tank.x / WORLD.TILE) + 0.5) * WORLD.TILE;
        const homeY = (Math.floor(tank.y / WORLD.TILE) + 0.5) * WORLD.TILE;
        let angle = Math.atan2(homeY - tank.y, homeX - tank.x);
        if (Math.hypot(homeX - tank.x, homeY - tank.y) < 8) {
            let bestRoom = -1;
            for (let i = 0; i < 8; i++) {
                const candidate = i * Math.PI / 4 + Math.random() * 0.3;
                let room = 0;
                while (room < 6 && !map.tankBlocked(
                    tank.x + Math.cos(candidate) * room * 16,
                    tank.y + Math.sin(candidate) * room * 16,
                    tank.size
                )) room++;
                if (room > bestRoom) {
                    bestRoom = room;
                    angle = candidate;
                }
            }
        }
        ai.unstickAngle = angle;
        ai.unstickUntil = clock + 350;
    }

    /**
     * Where to aim so a shot and a moving target arrive together
     */
    leadTarget(shooter, target, bulletSpeed, amount = 1) {
        const dx = target.x - shooter.x;
        const dy = target.y - shooter.y;
        const vx = target.vx * amount;
        const vy = target.vy * amount;
        const a = vx * vx + vy * vy - bulletSpeed * bulletSpeed;
        const b = 2 * (dx * vx + dy * vy);
        const c = dx * dx + dy * dy;
        const disc = b * b - 4 * a * c;
        let t = Math.hypot(dx, dy) / bulletSpeed;
        if (disc >= 0 && a !== 0) {
            const root = Math.sqrt(disc);
            const t1 = (-b - root) / (2 * a);
            const t2 = (-b + root) / (2 * a);
            const positive = [t1, t2].filter(value => value > 0);
            if (positive.length) t = Math.min(...positive);
        }
        return { x: target.x + vx * t, y: target.y + vy * t };
    }

    aimAndFire(tank, ai, deltaTime) {
        const game = this.game;
        const skill = ai.skill;
        const target = ai.target;

        // With nothing to shoot, clear any crate that is in the way
        if (ai.breakCrate && (!target || !game.map.lineClear(tank.x, tank.y, target.x, target.y))) {
            const crate = ai.breakCrate;
            ai.breakCrate = null;
            const angle = Math.atan2(crate.y - tank.y, crate.x - tank.x);
            this.turnTurret(tank, angle, skill);
            if (Math.abs(normalizeAngle(angle - tank.turretAngle)) < 0.25) this.tryShoot(tank);
            return;
        }
        ai.breakCrate = null;

        if (!target || !target.isAlive) return;

        if (game.clock >= ai.nextAimError) {
            ai.nextAimError = game.clock + 500;
            ai.aimError = (Math.random() - 0.5) * 2 * skill.aimError;
        }

        const aimPoint = this.leadTarget(tank, target, GAME_CONFIG.SHOT.speed, skill.lead);
        const wanted = Math.atan2(aimPoint.y - tank.y, aimPoint.x - tank.x) + ai.aimError;
        this.turnTurret(tank, wanted, skill);

        const clear = game.map.lineClear(tank.x, tank.y, target.x, target.y);
        if (!clear) {
            ai.sightedAt = game.clock;
            return;
        }

        const reacted = game.clock - ai.sightedAt >= skill.reactionMs;
        const aimed = Math.abs(normalizeAngle(wanted - tank.turretAngle)) < 0.14;
        if (reacted && aimed) this.tryShoot(tank);
    }

    turnTurret(tank, wanted, skill) {
        const difference = normalizeAngle(wanted - tank.turretAngle);
        const rate = tank.turretRotationSpeed * skill.turretFactor;
        tank.turretAngle += Math.max(-rate, Math.min(rate, difference));
    }

    tryShoot(tank) {
        if (this.game.clock >= tank.nextShotAt) this.game.fireShot(tank);
    }

    /**
     * Use harmony the way a sensible player would
     */
    useChords(tank, ai, threat) {
        const game = this.game;
        if (game.clock < tank.abilityReadyAt || Math.random() > ai.skill.abilityChance * 0.1) return;
        const healthFraction = tank.health / tank.maxHealth;

        if (healthFraction < 0.5 && Abilities.ready(game, tank, 'heal') && !threat) {
            Abilities.cast(game, tank, 'heal');
        } else if (threat && threat.ticks < 14 && Abilities.ready(game, tank, 'shield') && healthFraction < 0.6) {
            Abilities.cast(game, tank, 'shield');
        } else if (threat && threat.ticks < 10 && Abilities.ready(game, tank, 'dash')) {
            const away = Math.hypot(threat.missX, threat.missY) || 1;
            tank.moveDirection = { x: threat.missX / away || 1, y: threat.missY / away };
            Abilities.cast(game, tank, 'dash');
        } else if (Abilities.ready(game, tank, 'blast')) {
            const close = game.tanks.filter(other => other.isAlive && game.areHostile(tank, other)
                && distanceBetween(tank, other) < HARMONY_CONFIG.BLAST_RADIUS * 0.8).length;
            const shots = game.bullets.filter(bullet => game.bulletHostileTo(bullet, tank)
                && distanceBetween(bullet, tank) < HARMONY_CONFIG.BLAST_RADIUS).length;
            if (close >= 2 || shots >= 6) Abilities.cast(game, tank, 'blast');
        }
    }
}

window.AIBehavior = AIBehavior;

// =============================================================================
// GLOBAL AI BEHAVIOR INSTANCE
// =============================================================================
window.aiBehavior = null;

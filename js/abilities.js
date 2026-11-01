// =============================================================================
// HARMONY: CHORDS, MELODIES AND THE ABILITIES THEY PLAY
// =============================================================================

// Pitches heard when the harmony keys are played
const HARMONY_PITCHES = [64, 65, 66, 67, 68];

/**
 * Listens to one player's harmony keys and works out what they are playing.
 * Two keys struck together are a chord. Keys played in turn are a melody.
 */
class HarmonyInput {
    constructor(game, playerIndex) {
        this.game = game;
        this.playerIndex = playerIndex;
        this.recent = [];     // Keys struck in the last moment, candidates for a chord
        this.melody = [];     // Keys played so far in the current melody
        this.lastPress = 0;
        this.held = new Set();
    }

    /**
     * A harmony key went down
     * @param {number} keyNumber - 1 to 5
     * @param {number} velocity - How hard it was struck
     */
    press(keyNumber, velocity) {
        const now = performance.now();
        const tank = this.game.players[this.playerIndex];
        this.held.add(keyNumber);
        window.audioSystem.pianoNote(HARMONY_PITCHES[keyNumber - 1] + 12, velocity, 0.5);
        if (!tank) return;

        if (now - this.lastPress > HARMONY_CONFIG.MELODY_GAP_MS) this.melody = [];
        this.lastPress = now;

        // A chord needs two keys down at once, struck inside the window. A key that
        // carries on a tune is part of the tune, however quickly it was played.
        this.recent = this.recent.filter(entry => now - entry.time <= HARMONY_CONFIG.CHORD_WINDOW_MS);
        if (!this.continuesTune(tank, keyNumber)) {
            for (const entry of this.recent) {
                const chord = this.held.has(entry.key) ? this.findChord(entry.key, keyNumber) : null;
                if (chord) {
                    this.recent = [];
                    this.melody = [];
                    Abilities.cast(this.game, tank, chord);
                    return;
                }
            }
        }
        this.recent.push({ key: keyNumber, time: now });

        this.melody.push(keyNumber);
        if (this.melody.length > 8) this.melody.shift();
        this.game.noteMelody(tank, this.melody);
    }

    release(keyNumber) {
        this.held.delete(keyNumber);
    }

    /**
     * Would this key be the next note of a tune already under way? It takes two
     * notes played first to count as under way.
     */
    continuesTune(tank, keyNumber) {
        const played = [...this.melody, keyNumber];
        return this.game.knownTunes(tank).some(tune => {
            for (let length = Math.min(tune.length, played.length); length >= 3; length--) {
                const tail = played.slice(-length);
                if (tail.every((key, i) => key === tune[i])) return true;
            }
            return false;
        });
    }

    findChord(a, b) {
        for (const [name, chord] of Object.entries(HARMONY_CONFIG.CHORDS)) {
            const [x, y] = chord.keys;
            if ((a === x && b === y) || (a === y && b === x)) return name;
        }
        return null;
    }

    clear() {
        this.melody = [];
        this.recent = [];
    }
}

const Abilities = {
    /**
     * Try to use a chord or melody
     * @param {Object} game - Game instance
     * @param {Object} tank - Tank using it
     * @param {string} name - Key of a chord or melody
     * @returns {boolean} True if it went off
     */
    cast(game, tank, name) {
        const def = HARMONY_CONFIG.CHORDS[name] || HARMONY_CONFIG.MELODIES[name];
        if (!def || !tank.isAlive) return false;

        const refuse = (icon) => {
            if (tank.isPlayer) {
                game.floatIcon(tank.x, tank.y - 34, icon);
                tank.deniedUntil = { ...tank.deniedUntil, [name]: game.clock + 300 };
                window.audioSystem.denied();
            }
            return false;
        };

        if (!game.abilityAvailable(tank, name)) return refuse('lock');
        if (game.hasStatus(tank, 'silence')) return refuse('hush');
        // The short gap between chords never swallows a melody that took work to play
        if (HARMONY_CONFIG.CHORDS[name] && game.clock < (tank.abilityReadyAt || 0)) return false;
        if (game.clock < (tank.cooldowns[name] || 0)) return refuse('wait');
        if ((tank.meter || 0) < def.cost) return refuse('clef');

        tank.meter -= def.cost;
        tank.abilityReadyAt = game.clock + HARMONY_CONFIG.ABILITY_COOLDOWN_MS;
        tank.cooldowns[name] = game.clock + def.cooldown;
        this[name](game, tank);
        const stats = game.playerStats.get(tank.id);
        if (stats) stats.abilitiesUsed = (stats.abilitiesUsed || 0) + 1;
        if (tank.isPlayer) game.floatIcon(tank.x, tank.y - 40, def.icon);
        return true;
    },

    /**
     * Could this go off right now? Bots check before they commit to anything.
     */
    ready(game, tank, name) {
        const def = HARMONY_CONFIG.CHORDS[name] || HARMONY_CONFIG.MELODIES[name];
        return tank.meter >= def.cost && game.clock >= (tank.cooldowns[name] || 0);
    },

    shield(game, tank) {
        game.giveShield(tank, HARMONY_CONFIG.SHIELD_MS, HARMONY_CONFIG.SHIELD_HITS);
        game.ring(tank.x, tank.y, 40, '#7cc0f5', 300);
        window.audioSystem.chord([64, 67, 71]);
        window.audioSystem.shieldUp();
    },

    dash(game, tank) {
        const move = tank.moveDirection || { x: Math.cos(tank.turretAngle), y: Math.sin(tank.turretAngle) };
        tank.dashX = move.x;
        tank.dashY = move.y;
        tank.dashStruck = new Set();
        game.setStatus(tank, 'dash', HARMONY_CONFIG.DASH_MS);
        window.audioSystem.dash();
    },

    blast(game, tank) {
        const radius = HARMONY_CONFIG.BLAST_RADIUS;
        game.ring(tank.x, tank.y, radius, '#ffb066', 360);
        game.shake(7);
        window.audioSystem.chord([64, 68, 71]);
        window.audioSystem.blast();

        game.bullets.forEach(bullet => {
            if (distanceBetween(bullet, tank) < radius && game.bulletHostileTo(bullet, tank)) bullet.dead = true;
        });
        game.tanks.forEach(other => {
            if (!other.isAlive || !game.areHostile(tank, other)) return;
            const distance = distanceBetween(other, tank);
            if (distance > radius + other.size / 2) return;
            game.damageTank(other, HARMONY_CONFIG.BLAST_DAMAGE, { source: tank, type: 'blast' });
            const angle = Math.atan2(other.y - tank.y, other.x - tank.x);
            game.knockback(other, angle, HARMONY_CONFIG.BLAST_KNOCKBACK);
        });
        game.forEachTileInRadius(tank.x, tank.y, radius * 0.7, (c, r) => {
            if (game.map.at(c, r) === TILES.CRATE) game.damageTile(c, r, CRATE_HEALTH);
        });
    },

    heal(game, tank) {
        tank.tenutoBeats = HARMONY_CONFIG.HEAL_BEATS;
        game.ring(tank.x, tank.y, HARMONY_CONFIG.HEAL_RADIUS, '#a4e87a', 360);
        window.audioSystem.heal();
    },

    /**
     * Each beat of a held Tenuto mends the tank and anyone close by
     */
    holdTenuto(game, tank) {
        tank.tenutoBeats--;
        game.healTank(tank, HARMONY_CONFIG.HEAL_PER_BEAT);
        game.ring(tank.x, tank.y, 44, '#a4e87a', 220);
        game.tanks.forEach(other => {
            if (other !== tank && other.isAlive && other.maxHealth && !game.areHostile(tank, other)
                && !other.inert && distanceBetween(other, tank) < HARMONY_CONFIG.HEAL_RADIUS) {
                game.healTank(other, HARMONY_CONFIG.HEAL_ALLY_PER_BEAT);
            }
        });
    },

    rally(game, tank) {
        for (let i = 0; i < HARMONY_CONFIG.RALLY_COUNT; i++) game.spawnBuddy(tank, i - 0.5);
        window.audioSystem.chord([64, 66, 68]);
    },

    lullaby(game, tank) {
        const radius = HARMONY_CONFIG.LULLABY_RADIUS;
        game.ring(tank.x, tank.y, radius, '#e7d6ff', 700);
        window.audioSystem.chord([68, 67, 66, 65]);
        game.tanks.forEach(other => {
            if (!other.isAlive || !game.areHostile(tank, other)) return;
            if (distanceBetween(other, tank) > radius) return;
            game.setStatus(other, 'sleep', other.boss ? HARMONY_CONFIG.LULLABY_BOSS_MS : HARMONY_CONFIG.LULLABY_MS);
            game.floatText(other.x, other.y - 26, 'zzz', '#e7d6ff');
        });
    },

    echo(game, tank) {
        game.setStatus(tank, 'echo', HARMONY_CONFIG.ECHO_MS);
        game.ring(tank.x, tank.y, 70, '#ffb066', 400);
        window.audioSystem.chord([64, 68, 64, 68]);
    },

    finale(game, tank) {
        game.shake(10);
        game.flash('#ffffff', 300);
        window.audioSystem.chord([64, 65, 66, 67, 68]);
        window.audioSystem.blast();
        game.bullets.forEach(bullet => {
            if (game.bulletHostileTo(bullet, tank)) bullet.dead = true;
        });
        game.tanks.forEach(other => {
            if (other.isAlive && game.areHostile(tank, other)) {
                game.damageTank(other, HARMONY_CONFIG.FINALE_DAMAGE, { source: tank, type: 'blast' });
            }
        });
    }
};

window.HarmonyInput = HarmonyInput;
window.Abilities = Abilities;

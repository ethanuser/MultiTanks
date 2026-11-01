// =============================================================================
// MULTITANKS GAME CONSTANTS
// =============================================================================
// All game parameters that can be easily modified by the user

// =============================================================================
// GAME MODES
// =============================================================================
const GAME_MODES = {
    FFA: 'ffa',
    TDM: 'tdm',
    CAMPAIGN: 'campaign'
};

// =============================================================================
// WORLD SCALE
// =============================================================================
// The world is measured in units, three to each art pixel. The canvas is a real
// low-resolution buffer stretched with image-rendering: pixelated, so everything
// on screen lands on the same pixel grid.
const WORLD = {
    PIXEL: 3,            // World units per art pixel
    TILE: 48,            // World units per tile
    TILE_PX: 16,         // Art pixels per tile
    TARGET_VIEW_H: 270   // Art pixels of height we aim to show at any window size
};

// =============================================================================
// GAME CONFIGURATION
// =============================================================================
const GAME_CONFIG = {
    // Player settings
    MIN_PLAYERS: 0,
    MAX_PLAYERS: 4,
    MIN_AI_BOTS: 0,
    MAX_AI_BOTS: 8,
    MAX_TOTAL_TANKS: 8, // Maximum total tanks (players + AI)

    // Simulation
    TICK_MS: 1000 / 60, // Fixed step, so speed never depends on the monitor
    MAX_FRAME_MS: 200,  // Longest frame we will try to catch up on

    // Map settings (updated by whichever map is loaded)
    MAP_WIDTH: 1440,
    MAP_HEIGHT: 816,

    // Tank settings
    TANK_SIZE: 40,
    TANK_SPEED: 2.3,
    TANK_HEALTH: 24,
    TURRET_LENGTH: 42,
    TURRET_ROTATION_SPEED: 0.05, // radians per tick
    TANK_PUSH_STRENGTH: 0.35,    // How firmly overlapping tanks shove apart
    FRIEND_OVERLAP: 0.24,        // How close tanks on the same side can squeeze
    CORNER_NUDGE: 16,            // How far a tank is eased around a wall corner

    // The cooldown stays under one beat of the fastest song, so that a shot on
    // every beat is always possible
    SHOT: { damage: 2, cooldown: 420, speed: 6.5, size: 9, knockback: 0.8, meter: 3 },
    BULLET_MAX_LIFETIME_MS: 2600,

    // Harmony meter (spent on chords and melodies)
    METER_MAX: 100,
    METER_START: 35,
    METER_PASSIVE_PER_SEC: 2,

    // Rhythm
    BEAT_WINDOW_MS: 120,       // Early or late by this much still counts as on the beat
    BEAT_DAMAGE_BONUS: 1,      // Extra damage for an on-beat shot
    GROOVE_MAX: 4,             // Highest groove streak
    GROOVE_METER_BONUS: 2,     // Extra meter per groove level on an on-beat shot

    // Powerup settings
    POWERUP_DURATION: 12000,
    POWERUP_SPAWN_INTERVAL_MIN: 4000,
    POWERUP_SPAWN_INTERVAL_MAX: 7000,
    POWERUP_MAX_ON_MAP: 6,
    POWERUP_LIFETIME: 18000,
    POWERUP_SIZE: 24,
    POWERUP_HEALTH_BOOST: 8,
    POWERUP_METER_BOOST: 35,
    POWERUP_STAR_MS: 7000,
    POWERUP_SPEED_BONUS: 0.3,   // Per stack
    POWERUP_SPREAD_ANGLE: 0.2,  // radians
    POWERUP_SPREAD_DAMAGE: 0.75,
    POWERUP_BOUNCE_BOUNCES: 3,
    POWERUP_BOUNCE_DAMAGE: 1,   // Extra damage a shot picks up from each bounce
    POWERUP_MAX_STACKS: 3,

    // Powerup types
    POWERUP_TYPES: {
        HEALTH: { icon: 'heart', name: 'Repair', detail: 'Mends 8 health' },
        INVINCIBILITY: { icon: 'star', name: 'Encore', detail: 'Nothing hurts for 7 seconds' },
        SPEED: { icon: 'wing', name: 'Allegro', detail: 'Drive 30% faster' },
        RAPID_FIRE: { icon: 'notes', name: 'Vivace', detail: 'A second shot on the half beat' },
        SPREAD_SHOT: { icon: 'triple', name: 'Triad', detail: 'Three shots in a fan' },
        BOUNCING_BULLETS: { icon: 'spring', name: 'Ricochet', detail: 'Shots bounce, and hit harder for it' },
        HARMONY: { icon: 'clef', name: 'Harmony', detail: 'Fills the gold bar' }
    },
    POWERUP_WEIGHTS: {
        INVINCIBILITY: 1, BOUNCING_BULLETS: 4, SPEED: 5, SPREAD_SHOT: 5,
        RAPID_FIRE: 6, HEALTH: 4, HARMONY: 3
    },

    // Hazards
    SPIKE_DAMAGE: 2,
    SPIKE_INTERVAL_MS: 700,
    STRING_DAMAGE: 3,
    PIT_FALL_DAMAGE: 6,
    BOOST_MULTIPLIER: 1.7,

    // Spawn settings
    SPAWN_DISTANCE_FROM_EDGE: 90, // Distance from map edge for tank spawning

    // Team settings (palette keys, see TANK_PALETTES)
    TEAM_PALETTES: { red: 'coral', blue: 'blue' },

    // Encore: if a match runs long, every tank starts to wear down on the beat
    ENCORE_AFTER_MS: 120000,
    ENCORE_EVERY_BEATS: 2,
    ENCORE_DAMAGE: 1,

    // Arena settings
    ARENA_MIN_COLS: 26,
    ARENA_MIN_ROWS: 15,
    ARENA_CRATE_DENSITY: 0.05,

    // Recordings have no beat that a player can be held to, so while one plays the
    // rhythm bonus is off and hazards count to this tempo instead
    UNSYNCED_BPM: 100
};

// =============================================================================
// AI BOT SKILL
// =============================================================================
const BOT_SKILLS = {
    EASY: { label: 'Easy', mark: 'p', reactionMs: 520, aimError: 0.22, lead: 0.45, dodge: 0.2, abilityChance: 0.25, turretFactor: 0.7, speedFactor: 0.82 },
    NORMAL: { label: 'Normal', mark: 'mf', reactionMs: 300, aimError: 0.1, lead: 0.8, dodge: 0.5, abilityChance: 0.55, turretFactor: 1, speedFactor: 0.95 },
    HARD: { label: 'Hard', mark: 'f', reactionMs: 170, aimError: 0.05, lead: 1, dodge: 0.8, abilityChance: 0.8, turretFactor: 1.25, speedFactor: 1 },
    VIRTUOSO: { label: 'Virtuoso', mark: 'ff', reactionMs: 90, aimError: 0.02, lead: 1, dodge: 0.96, abilityChance: 1, turretFactor: 1.5, speedFactor: 1.05 }
};

const AI_CONFIG = {
    REPATH_MS: 450,              // How often a bot recalculates its route
    THINK_MS: 240,               // How often a bot reconsiders what it is doing
    TARGET_LOCK_MS: 1400,        // Minimum time to stick with a target
    ENGAGE_RANGE: 520,           // Preferred upper range for a gunfight
    STANDOFF_RANGE: 260,         // Bots try to hold about this far from a target
    TOO_CLOSE_RANGE: 130,        // Bots back away from a target inside this range
    RETREAT_HEALTH: 0.34,        // Fraction of health at which a bot disengages
    PICKUP_RANGE: 380,           // How far a bot goes out of its way for a pickup
    DANGER_LOOKAHEAD_TICKS: 34,  // How far ahead a bot predicts bullets
    DANGER_RADIUS: 46,           // A predicted pass this close counts as a threat
    SEPARATION_RANGE: 70,        // Allies keep this far apart
    SEPARATION_FORCE: 0.9,
    STRAFE_FORCE: 0.75,
    STEER_EASING: 0.3,           // How quickly a tank's heading follows what it wants
    STEER_DEADZONE: 0.14,        // Weaker pulls than this leave a tank parked
    FOLLOW_RING: 105,            // How far from the leader allies take up their spots
    FOLLOW_ARRIVE: 24,           // Close enough to a spot to stop
    FOLLOW_RESUME: 80,           // How far a spot must move before setting off again
    HUNT_LEASH: 460              // Allies only go after enemies this close
};

// =============================================================================
// MIDI NOTE MAPPINGS
// =============================================================================
// Based on your keyboard: A=21, A=33, A=45, A=57, A=69, A=81, A=93
// Each octave has 12 semitones, so we map each octave to a player (1-4)

const MIDI_CONFIG = {
    // Base note numbers for each octave (A notes) - only 4 players now
    OCTAVE_BASES: [21, 45, 69, 93],

    // Note offsets from A for each control
    NOTE_OFFSETS: {
        A_SHARP: 1,  // A# - Move Up
        A: 0,        // A - Move Left
        B: 2,        // B - Move Down
        C: 3,        // C - Move Right
        C_SHARP: 4,  // C# - Aim Left
        D: 5,        // D - Shoot
        D_SHARP: 6,  // D# - Aim Right
        E: 7,        // Harmony key 1
        F: 8,        // Harmony key 2
        F_SHARP: 9,  // Harmony key 3
        G: 10,       // Harmony key 4
        G_SHARP: 11  // Harmony key 5
    },

    // Control types
    CONTROL_TYPES: {
        MOVEMENT: 'movement',
        TURRET: 'turret',
        HARMONY: 'harmony'
    },

    // Display name of each control's piano key
    NOTE_LABELS: {
        A: 'A', A_SHARP: 'A#', B: 'B', C: 'C', C_SHARP: 'C#', D: 'D', D_SHARP: 'D#',
        E: 'E', F: 'F', F_SHARP: 'F#', G: 'G', G_SHARP: 'G#'
    }
};

// The five harmony keys, numbered as they are in chords and melodies
const HARMONY_KEYS = ['E', 'F', 'F_SHARP', 'G', 'G_SHARP'];

// =============================================================================
// CHORDS AND MELODIES
// =============================================================================
// Chords are two harmony keys struck together. Melodies are harmony keys played
// one after another. Numbers are positions in HARMONY_KEYS, starting from 1.
const HARMONY_CONFIG = {
    CHORD_WINDOW_MS: 70,     // Keys struck this close together make a chord
    MELODY_GAP_MS: 1600,     // A longer pause than this forgets the melody so far
    ABILITY_COOLDOWN_MS: 400, // Between any two chords. Each also has its own cooldown

    CHORDS: {
        shield: { keys: [1, 4], cost: 30, cooldown: 9000, label: 'Pianissimo', keyHint: 'Q', keyCap: 'Q', icon: 'shield', detail: 'Stops 5 hits, fewer as it fades' },
        dash: { keys: [2, 5], cost: 15, cooldown: 600, label: 'Glissando', keyHint: 'Shift', keyCap: '^', icon: 'wing', detail: 'Slides through shots, gaps and enemies' },
        blast: { keys: [1, 5], cost: 40, cooldown: 6000, label: 'Fortissimo', keyHint: 'E', keyCap: 'E', icon: 'burst', detail: 'Clears shots, throws enemies back' },
        heal: { keys: [2, 4], cost: 50, cooldown: 14000, label: 'Tenuto', keyHint: 'F', keyCap: 'F', icon: 'heart', detail: 'Mends over 3 beats, until you are hit' }
    },

    MELODIES: {
        rally: { keys: [1, 3, 5], cost: 45, cooldown: 6000, label: 'Rising Call', icon: 'notes', effect: 'Summon two little allies', detail: 'Summons two little allies' },
        lullaby: { keys: [5, 4, 3, 2], cost: 50, cooldown: 7000, label: 'Lullaby', icon: 'moon', effect: 'Put enemies to sleep', detail: 'Puts enemies to sleep, even across the room' },
        echo: { keys: [1, 5, 1, 5], cost: 45, cooldown: 6000, label: 'Echo', icon: 'spring', effect: 'Every shot rings three times', detail: 'Every shot rings three times, and bounces' },
        finale: { keys: [1, 2, 3, 4, 5], cost: 80, cooldown: 10000, label: 'The Whole Scale', icon: 'clef', effect: 'A wave across the whole stage', detail: 'Clears every shot and hits every enemy' }
    },

    SHIELD_MS: 8000,         // Nearly the whole cooldown, so it can almost always be up
    SHIELD_HITS: 5,          // Fades one hit at a time, evenly, over its whole length
    DASH_MS: 240,
    DASH_SPEED: 11,
    DASH_DAMAGE: 3,          // To anything it slides through
    BLAST_RADIUS: 190,
    BLAST_DAMAGE: 6,
    BLAST_KNOCKBACK: 9,
    HEAL_BEATS: 3,           // Tenuto mends a little on each beat, until the tank is hit
    HEAL_PER_BEAT: 2,
    HEAL_ALLY_PER_BEAT: 1,
    HEAL_RADIUS: 170,
    RALLY_MS: 20000,
    RALLY_COUNT: 2,
    RALLY_HEALTH: 16,
    LULLABY_MS: 5000,
    LULLABY_BOSS_MS: 2200,
    LULLABY_RADIUS: 520,
    ECHO_MS: 12000,
    ECHO_DELAY_MS: 170,
    ECHO_REPEATS: 2,
    FINALE_DAMAGE: 16
};

// =============================================================================
// TANK PALETTES (for visual distinction)
// =============================================================================
// d = shadow, m = main, l = light, h = highlight
const TANK_PALETTES = {
    blue: { d: '#1f4e9c', m: '#3a86e0', l: '#7cc0f5', h: '#c6ecff' },
    coral: { d: '#a32f3f', m: '#e8555a', l: '#ff9a8b', h: '#ffd9cf' },
    lime: { d: '#2b7a44', m: '#4fc25a', l: '#a4e87a', h: '#e2ffb8' },
    gold: { d: '#a8681a', m: '#eaa52a', l: '#ffd45e', h: '#fff2b0' },
    grape: { d: '#55308f', m: '#8a56d8', l: '#bb95f5', h: '#e7d6ff' },
    teal: { d: '#146b6e', m: '#22b3a6', l: '#6fe6cf', h: '#c8fff0' },
    pink: { d: '#a82a78', m: '#ec5aa8', l: '#ff9fd0', h: '#ffe0f2' },
    orange: { d: '#a8481c', m: '#f07a2c', l: '#ffb066', h: '#ffe2bd' },
    // Dissonance forces
    bruise: { d: '#3b1d5e', m: '#6a2f93', l: '#a050c0', h: '#dc9cf0' },
    rust: { d: '#5c2a22', m: '#9a4a30', l: '#cf7d4a', h: '#f2b98a' },
    hush: { d: '#262038', m: '#453a60', l: '#7566a0', h: '#b5a8d8' },
    acid: { d: '#4a5c10', m: '#8aa620', l: '#c8dc40', h: '#f2ffa0' },
    blood: { d: '#6a1030', m: '#b81f4a', l: '#ec4d6e', h: '#ffb0b8' },
    ghost: { d: '#3a5068', m: '#7096b0', l: '#b0d4e0', h: '#ecffff' },
    ivory: { d: '#a89a80', m: '#d8ccb0', l: '#f2e8d2', h: '#ffffff' },
    white: { d: '#ffffff', m: '#ffffff', l: '#ffffff', h: '#ffffff' }
};

// Order tanks take on when they join a game
const TANK_PALETTE_ORDER = ['blue', 'coral', 'lime', 'gold', 'grape', 'teal', 'pink', 'orange'];
const TANK_COLORS = TANK_PALETTE_ORDER.map(key => TANK_PALETTES[key].m);

// =============================================================================
// GAME STATES
// =============================================================================
const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the note number for a specific player and control
 * @param {number} playerIndex - Player index (0-3)
 * @param {string} control - Control name, one of the MIDI_CONFIG.NOTE_OFFSETS keys
 * @returns {number} MIDI note number
 */
function getNoteForPlayer(playerIndex, control) {
    if (playerIndex < 0 || playerIndex >= MIDI_CONFIG.OCTAVE_BASES.length) {
        throw new Error(`Invalid player index: ${playerIndex}`);
    }

    const baseNote = MIDI_CONFIG.OCTAVE_BASES[playerIndex];
    const offset = MIDI_CONFIG.NOTE_OFFSETS[control];

    if (offset === undefined) {
        throw new Error(`Invalid control: ${control}`);
    }

    return baseNote + offset;
}

/**
 * Get player index from MIDI note number
 * @param {number} noteNumber - MIDI note number
 * @returns {number|null} Player index (0-3) or null if not a valid player note
 */
function getPlayerFromNote(noteNumber) {
    for (let i = 0; i < MIDI_CONFIG.OCTAVE_BASES.length; i++) {
        const baseNote = MIDI_CONFIG.OCTAVE_BASES[i];
        const noteRange = Object.values(MIDI_CONFIG.NOTE_OFFSETS);
        const minNote = baseNote + Math.min(...noteRange);
        const maxNote = baseNote + Math.max(...noteRange);

        if (noteNumber >= minNote && noteNumber <= maxNote) {
            return i;
        }
    }
    return null;
}

/**
 * Get control type from MIDI note number
 * @param {number} noteNumber - MIDI note number
 * @returns {string|null} Control type or null if not a valid control note
 */
function getControlFromNote(noteNumber) {
    const playerIndex = getPlayerFromNote(noteNumber);
    if (playerIndex === null) return null;

    const baseNote = MIDI_CONFIG.OCTAVE_BASES[playerIndex];
    const offset = noteNumber - baseNote;

    // Find the control that matches this offset
    for (const [control, controlOffset] of Object.entries(MIDI_CONFIG.NOTE_OFFSETS)) {
        if (controlOffset === offset) {
            return control;
        }
    }

    return null;
}

/**
 * Check if a control is a movement control
 * @param {string} control - Control type
 * @returns {boolean} True if movement control
 */
function isMovementControl(control) {
    return ['A_SHARP', 'A', 'B', 'C'].includes(control);
}

/**
 * Check if a control is a turret control
 * @param {string} control - Control type
 * @returns {boolean} True if turret control
 */
function isTurretControl(control) {
    return ['C_SHARP', 'D', 'D_SHARP'].includes(control);
}

/**
 * Check if a control is one of the harmony keys used for chords and melodies
 * @param {string} control - Control type
 * @returns {boolean} True if harmony control
 */
function isHarmonyControl(control) {
    return HARMONY_KEYS.includes(control);
}

/**
 * The note of a floor key. White keys are four tiles wide, and the first full one
 * on a map is Middle C.
 * @param {number} column - Map column
 * @returns {number} MIDI note
 */
function keyPitch(column) {
    const scale = [0, 2, 4, 5, 7, 9, 11];
    const key = Math.floor(column / 4) - 1;
    const step = ((key % 7) + 7) % 7;
    return 60 + Math.floor(key / 7) * 12 + scale[step];
}

/**
 * Normalize angle to the [-PI, PI] range
 * @param {number} angle - Angle to normalize
 * @returns {number} Normalized angle
 */
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Distance between two objects with x and y
 */
function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Random whole number from min to max, both included
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Read a saved value, tolerating browsers that block storage
 */
function loadSaved(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
        return fallback;
    }
}

/**
 * Save a value, tolerating browsers that block storage
 */
function storeSaved(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
        // Progress simply will not persist in this browser
    }
}

// =============================================================================
// CAMPAIGN MODE CONFIGURATION
// =============================================================================
const CAMPAIGN_CONFIG = {
    SAVE_KEY: 'multitanks.campaign.v3',

    // Player and ally rules
    AI_ALLIES: {
        maxCount: 8,        // Max total players + AI allies
        followDistance: 240 // Allies regroup on the players past this distance
    },

    LIVES_PER_LEVEL: 2, // Spare tanks per crew member before the level is lost

    // Camera settings
    CAMERA: {
        followSpeed: 0.12 // How quickly the camera catches up
    },

    // Difficulty settings. Pace runs the whole game faster, the tempo of the music
    // and the crew along with everything else. The rest applies to enemies alone.
    DIFFICULTY: {
        EASY: {
            label: 'Piano', mark: 'p', blurb: 'Gentle. Slow enemies, slow fire, soft hits, and plenty of warning.',
            pace: 1, bulletDensity: 0.8,
            enemySpeedMultiplier: 0.74, enemyFireRateMultiplier: 0.6, enemyBulletSpeedMultiplier: 0.78,
            enemyHealthMultiplier: 0.75, enemyDamageMultiplier: 0.75, attackTokens: 1, aimError: 0.18
        },
        MEDIUM: {
            label: 'Mezzo', mark: 'mf', blurb: 'The intended way to hear it. A brisker tempo for everyone.',
            pace: 1.1, bulletDensity: 1,
            enemySpeedMultiplier: 1, enemyFireRateMultiplier: 1, enemyBulletSpeedMultiplier: 1,
            enemyHealthMultiplier: 1, enemyDamageMultiplier: 1, attackTokens: 3, aimError: 0.07
        },
        HARD: {
            label: 'Forte', mark: 'f', blurb: 'The fastest tempo, and the air full of shots.',
            pace: 1.22, bulletDensity: 1.7, patterns: true,
            enemySpeedMultiplier: 1.08, enemyFireRateMultiplier: 1.25, enemyBulletSpeedMultiplier: 1,
            enemyHealthMultiplier: 1.25, enemyDamageMultiplier: 1.1, attackTokens: 7, aimError: 0.03
        }
    },

    // How much a boss's health grows with the size of the crew
    BOSS_SCALING: {
        perExtraPlayer: 0.6,
        perAlly: 0.5
    }
};

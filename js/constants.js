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
// GAME CONFIGURATION
// =============================================================================
const GAME_CONFIG = {
    // Player settings
    MIN_PLAYERS: 0,
    MAX_PLAYERS: 4,
    MIN_AI_BOTS: 0,
    MAX_AI_BOTS: 8,
    MAX_TOTAL_TANKS: 8, // Maximum total tanks (players + AI)
    
    // Map settings
    MAP_COLOR: '#2d5016', // Dark green
    MAP_WIDTH: window.innerWidth,
    MAP_HEIGHT: window.innerHeight,
    
    // Tank settings
    TANK_SIZE: 30,
    TANK_SPEED: 2,
    TANK_HEALTH: 30,
    TURRET_LENGTH: 40,
    TURRET_ROTATION_SPEED: 0.04, // radians per frame
    
    // Shooting settings
    SHOOT_COOLDOWN: 700, // milliseconds
    BULLET_SPEED: 6,
    BULLET_SIZE: 5,
    BULLET_DAMAGE: 1,
    BULLET_MAX_LIFETIME_MS: 5000,
    
    // Obstacle settings
    MIN_OBSTACLES: 15,
    MAX_OBSTACLES: 25,
    ROCK_SIZE_MIN: 20,
    ROCK_SIZE_MAX: 40,
    RECTANGLE_WIDTH_MIN: 30,
    RECTANGLE_WIDTH_MAX: 60,
    RECTANGLE_HEIGHT_MIN: 20,
    RECTANGLE_HEIGHT_MAX: 50,
    
    // Spawn settings
    SPAWN_DISTANCE_FROM_EDGE: 50, // Distance from map edge for tank spawning
    
    // Team settings
    TEAM_COLORS: {
        RED: '#ff4444',
        BLUE: '#9999ff'
    },
    
    // Powerup settings
    POWERUP_DURATION: 15000, // 15 seconds in milliseconds
    POWERUP_SPAWN_INTERVAL_MIN: 1000, // 1 seconds
    POWERUP_SPAWN_INTERVAL_MAX: 3000, // 3 seconds
    POWERUP_CHASE_DISTANCE: 300, // Distance AIs will chase powerups
    POWERUP_SIZE: 15,
    POWERUP_HEALTH_BOOST: 10,
    POWERUP_SPEED_MULTIPLIER: 1.5,
    POWERUP_FIRE_RATE_MULTIPLIER: 2.0,
    POWERUP_SPREAD_ANGLE: 0.2, // radians
    POWERUP_BOUNCE_BOUNCES: 3,
    POWERUP_MAX_STACKS: 4, // Maximum number of stacks for speed, rapid fire, and spread shot powerups
    
    // Powerup types and emojis
    POWERUP_TYPES: {
        HEALTH: { emoji: '❤️', color: '#ff0000', name: 'Health Boost' },
        INVINCIBILITY: { emoji: '🛡️', color: '#ff69b4', name: 'Invincibility' },
        SPEED: { emoji: '🏃', color: '#32cd32', name: 'Speed Boost' },
        RAPID_FIRE: { emoji: '🔥', color: '#4169e1', name: 'Rapid Fire' },
        SPREAD_SHOT: { emoji: '🎯', color: '#9370db', name: 'Spread Shot' },
        BOUNCING_BULLETS: { emoji: '⚡', color: '#ff8c42', name: 'Bouncing Bullets' }
    },
    
    // AI behavior settings
    AI_APPROACH_DISTANCE: 99900, // Distance to approach target to
    AI_ORBIT_SPEED: 0.02, // Speed of orbiting around enemy
    AI_ORBIT_DIRECTION_CHANGE_CHANCE: 0.02, // Chance per frame to change orbit direction (2%)
    AI_ORBIT_DISTANCE: 300, // Distance to maintain from enemy when orbiting
    AI_MIN_ORBIT_DISTANCE: 100, // Minimum distance before attempting to orbit
    AI_RETREAT_DURATION: 800, // How long to retreat when too close (milliseconds)
    AI_AIMING_RANDOMNESS: 0, // Randomness in aiming (radians) - disabled
    AI_SHOT_LEADING_ENABLED: true, // Whether AI should lead shots
    AI_SHOT_LEADING_FACTOR: 20, // How much to lead shots (0-1, higher = more leading)
    AI_SLIDE_SPEED_MULTIPLIER: 0.5, // Speed multiplier for obstacle sliding
    AI_OBSTACLE_GENERATION_MAX_ATTEMPTS: 100, // Max attempts to place obstacles
    AI_POWERUP_CHASE_TIMEOUT: 2000, // How long AI will chase a powerup before giving up (milliseconds)
    AI_POWERUP_COOLDOWN: 5000, // How long AI will ignore powerups after giving up (milliseconds)
    AI_TARGET_LOCK_DURATION_MS: 1000, // Minimum time to stick to a target before switching (FFA/TDM)
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
        D_SHARP: 6   // D# - Aim Right
    },
    
    // Control types
    CONTROL_TYPES: {
        MOVEMENT: 'movement',
        TURRET: 'turret'
    }
};

// =============================================================================
// TANK COLORS (for visual distinction)
// =============================================================================
const TANK_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F'  // Gold
];

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
 * @param {string} control - Control type ('A_SHARP', 'A', 'B', 'C', 'C_SHARP', 'D', 'D_SHARP')
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

// =============================================================================
// CAMPAIGN MODE CONFIGURATION
// =============================================================================
const CAMPAIGN_CONFIG = {
    // Level settings
    TOTAL_LEVELS: 5,
    LEVEL_SELECT_ENABLED: true, // All levels selectable immediately
    
    // Enemy types
    ENEMY_TYPES: {
        CHASER: 'chaser',
        SPREAD_SHOOTER: 'spreadShooter', 
        TURRET: 'turret',
        BOSS: 'boss'
    },
    
    // Enemy configurations
    ENEMIES: {
        CHASER: {
            health: 16,
            speed: 1.5,
            size: 25,
            color: '#ff6b6b',
            fireRate: 0.8, // seconds
            bulletSpeed: 4,
            bulletDamage: 1,
            bulletColor: '#ffff00' // Yellow bullets
        },
        SPREAD_SHOOTER: {
            health: 24,
            speed: 2,
            size: 30,
            color: '#4ecdc4',
            fireRate: 1.5,
            bulletSpeed: 3.5,
            bulletDamage: 1,
            bulletColor: '#ffff00',
            spreadAngle: 0.3, // radians
            bulletCount: 3
        },
        TURRET: {
            health: 32,
            speed: 0, // Stationary
            size: 35,
            color: '#fae964',
            fireRate: 0.7,
            bulletSpeed: 4.5,
            bulletDamage: 1,
            bulletColor: '#ffff00',
            ricochet: true,
            maxBounces: 2
        },
        BOSS: {
            health: 240,
            speed: 1.0,
            size: 50,
            color: '#e91e63',
            fireRate: 0.8,
            bulletSpeed: 5,
            bulletDamage: 2,
            bulletColor: '#ffff00',
            enrageHealth: 120, // 50% health
            enragedFireRate: 0.5,
            radialBullets: 16,
            radialFireRate: 2.0
        }
    },
    
    // Level progression
    LEVELS: {
        1: { chaser: 3, spreadShooter: 1, turret: 2, boss: 0 },
        2: { chaser: 4, spreadShooter: 2, turret: 3, boss: 0 },
        3: { chaser: 5, spreadShooter: 3, turret: 4, boss: 0 },
        4: { chaser: 6, spreadShooter: 4, turret: 5, boss: 0 },
        5: { chaser: 4, spreadShooter: 2, turret: 3, boss: 1 }
    },
    
    // Map scaling per level
    MAP_SCALING: {
        baseWidth: 2000,
        baseHeight: 1000,
        widthGrowth: 200,
        heightGrowth: 150
    },
    
    // Background colors by level (1-5)
    MAP_COLORS: ['#2a4a7a', '#4a2a6a', '#2a6a4a', '#6a4a2a', '#6a2a2a'],

    // Enemy spawn controls
    ENEMY_SPAWN_MARGIN: 150,
    ENEMY_SPAWN_ATTEMPTS: 50,
    ENEMY_SPAWN_MIN_DISTANCE_FROM_PLAYERS: 350,
    ENEMY_FALLBACK_SPAWN_X_FACTOR: 0.7,
    ENEMY_FALLBACK_SPAWN_RANGE_FACTOR: 0.2,

    // Enemy color mapping by type (campaign rendering)
    ENEMY_COLORS: {
        chaser: '#84ff8a',
        spreadShooter: '#d06bff',
        turret: '#ffcf5f',
        boss: '#ff4444'
    },
    
    // Player spawn settings
    PLAYER_SPAWN: {
        x: 100, // Top-left area
        y: 100,
        spacing: 80
    },
    
    // AI Ally settings
    AI_ALLIES: {
        maxCount: 8, // Max total players + AI allies
        followDistance: 400, // Stay within this distance of player average
        targetRange: 9000, // How far they can see enemies (much larger for better engagement)
        fireRate: 1.0,
        bulletSpeed: 5,
        bulletDamage: 1,
        color: '#2196f3' // Blue like players
    },
    
    // Camera settings
    CAMERA: {
        followSpeed: 0.15, // How quickly camera follows players (smooth and responsive)
        zoom: 1.0,
        minDistance: 10, // Minimum distance before camera starts following
        deadZone: 0 // No dead zone - camera always follows smoothly
    },
    
    // Camera player weighting (players influence camera more than allies)
    CAMERA_PLAYER_WEIGHT: 200,
    
    // Difficulty settings (affects enemies only)
    DIFFICULTY: {
        EASY: {
            enemySpeedMultiplier: 0.7,
            enemyFireRateMultiplier: 0.6,
            enemyBulletSpeedMultiplier: 0.8
        },
        MEDIUM: {
            enemySpeedMultiplier: 1.0,
            enemyFireRateMultiplier: 1.0,
            enemyBulletSpeedMultiplier: 1.0
        },
        HARD: {
            enemySpeedMultiplier: 1.4,
            enemyFireRateMultiplier: 1.5,
            enemyBulletSpeedMultiplier: 1.2
        }
    }
};

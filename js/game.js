// =============================================================================
// MULTITANKS GAME ENGINE
// =============================================================================
// Main game logic and state management

/**
 * Keeps time in beats, on the game's own clock. The chiptune sequencer plays from
 * this position, so the beat the game judges is exactly the one being heard.
 */
class BeatClock {
    constructor(bpm) {
        this.bpm = bpm;
        this.position = 0;
    }

    get msPerBeat() {
        return 60000 / this.bpm;
    }

    advance(deltaTime) {
        this.position += deltaTime / this.msPerBeat;
    }
}

class MultiTanksGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameState = GAME_STATES.MENU;
        this.tanks = [];
        this.bullets = [];
        this.players = [];
        this.aiBots = [];
        this.powerups = [];
        this.map = null;
        this.lastTime = 0;
        this.accumulator = 0;
        this.animationId = null;
        this.powerupSpawnTimer = 3000;

        // Game time only moves while the game does, so pausing is always safe
        this.clock = 0;
        this.pace = 1;           // How much faster than real time the game runs
        this.beat = new BeatClock(120);
        this.lastBeatIndex = 0;
        this.beatless = false;   // True while a recording plays
        this.beatHitUntil = 0;   // Lights the beat bar after a shot on the beat
        this.harmonyOff = false; // Arenas can be played with no chords or melodies
        this.enemyBulletCap = Infinity;
        this.mouse = null;       // Where the pointer is, in art pixels on the canvas

        // Game settings
        this.numPlayers = 1;
        this.numAIBots = 3;
        this.gameMode = GAME_MODES.FFA;
        this.botSkill = 'NORMAL';
        this.isPaused = false;
        this.gameEnding = false;
        this.gameStartTime = 0;
        this.gameEndTime = 0;
        this.nextTankId = 100;

        // Team settings
        this.teams = {
            red: [],
            blue: []
        };

        // Statistics tracking
        this.playerStats = new Map();

        // Input tracking
        this.activeControls = new Map(); // Track which controls are currently pressed
        this.harmony = [];

        // Effects
        this.particles = [];
        this.rings = [];
        this.floaters = [];
        this.delayed = [];
        this.telegraphs = [];
        this.shakeAmount = 0;
        this.flashColor = null;
        this.flashUntil = 0;
        this.dialog = null;
        this.banner = null;
        this.keypadGlow = new Map();

        this.camera = { x: 0, y: 0 };

        // Helper modules
        this.renderer = null;
        this.powerupsManager = null;
        this.collisions = null;
    }

    /**
     * Initialize the game
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} numPlayers - Number of human players (1-4)
     * @param {number} numAIBots - Number of AI bots (0-6)
     * @param {string} gameMode - Game mode (FFA or TDM)
     * @param {Object} teamAssignments - Player team assignments for TDM
     * @param {Object} aiTeamDistribution - AI team distribution for TDM
     * @param {string} botSkill - Key into BOT_SKILLS
     */
    async initialize(canvas, numPlayers = 1, numAIBots = 3, gameMode = GAME_MODES.FFA, teamAssignments = {}, aiTeamDistribution = null, botSkill = 'NORMAL') {
        // Reset all controls to clear any stuck keys from previous games
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }

        // Clear active controls to ensure clean state
        this.activeControls.clear();

        // Ensure any prior game loop is stopped before re-initializing
        this.stopGameLoop();

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.numPlayers = Math.max(GAME_CONFIG.MIN_PLAYERS, Math.min(GAME_CONFIG.MAX_PLAYERS, numPlayers));
        this.numAIBots = Math.max(GAME_CONFIG.MIN_AI_BOTS, Math.min(GAME_CONFIG.MAX_AI_BOTS, numAIBots));
        this.gameMode = gameMode;
        this.teamAssignments = teamAssignments;
        this.aiTeamDistribution = aiTeamDistribution;
        this.botSkill = botSkill;
        this.gameStartTime = this.clock;
        this.gameEnding = false;

        // Resolve active game mode
        this.mode = window.modeManager ? window.modeManager.getMode(this.gameMode) : null;

        // Ensure total doesn't exceed maximum
        const totalTanks = this.numPlayers + this.numAIBots;
        if (totalTanks > GAME_CONFIG.MAX_TOTAL_TANKS) {
            this.numAIBots = GAME_CONFIG.MAX_TOTAL_TANKS - this.numPlayers;
        }

        this.handleResize();
        this.harmony = Array.from({ length: 4 }, (_, i) => new HarmonyInput(this, i));

        // Initialize game objects
        if (this.mode && this.mode.assignTeams) {
            this.mode.assignTeams(this);
        }

        // Initialize helper modules
        this.renderer = new GameRenderer(this);
        this.powerupsManager = new GamePowerups(this);
        this.collisions = new GameCollisions(this);
        window.aiBehavior = new AIBehavior(this);

        this.setupMIDIInput();

        if (this.gameMode === GAME_MODES.CAMPAIGN) {
            // The campaign builds its own stages
            this.gameState = GAME_STATES.PAUSED;
            return;
        }

        this.setupArena();
        this.startMusicForArena();
        window.audioSystem.gameStart();
        this.gameState = GAME_STATES.PLAYING;
        this.startGameLoop();
    }

    startMusicForArena() {
        this.lastBeatIndex = 0;
        this.beatless = window.audioSystem.getArenaMusic() === 'recordings';
        if (this.beatless) {
            this.beat = new BeatClock(GAME_CONFIG.UNSYNCED_BPM);
            window.audioSystem.playMusic(this.mode.musicTrack(this), true);
        } else {
            this.beat = new BeatClock(window.audioSystem.playSong(this.mode.song));
        }
    }

    /**
     * Where in the beat the player is hearing right now, which trails the game by
     * however long the sound takes to reach them
     */
    heardBeat() {
        const latencyMs = window.audioSystem.outputLatency() * 1000 * this.pace;
        return this.beat.position - latencyMs / this.beat.msPerBeat;
    }

    /**
     * Is this moment on the beat? The window is real time, so a faster tempo does
     * not also make it narrower.
     */
    isOnBeat() {
        if (this.beatless) return false;
        const position = this.heardBeat();
        const offset = Math.abs(position - Math.round(position)) * this.beat.msPerBeat;
        return offset <= GAME_CONFIG.BEAT_WINDOW_MS * this.pace;
    }

    /**
     * Fit the low-resolution canvas to the window. The world always shows about the
     * same amount of map, whatever the size of the window.
     */
    handleResize() {
        if (!this.canvas) return;
        const scale = Math.max(2, Math.round(window.innerHeight / WORLD.TARGET_VIEW_H));
        this.canvas.width = Math.ceil(window.innerWidth / scale);
        this.canvas.height = Math.ceil(window.innerHeight / scale);
        this.viewScale = scale;
        this.viewW = this.canvas.width;
        this.viewH = this.canvas.height;
        if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * Load a map into the game
     * @param {TileMap} map - The map to play on
     */
    setMap(map) {
        this.map = map;
        MapArt.bake(map);
        GAME_CONFIG.MAP_WIDTH = map.width;
        GAME_CONFIG.MAP_HEIGHT = map.height;
    }

    /**
     * Build the arena for FFA and TDM
     */
    setupArena() {
        const viewCols = Math.floor(this.viewW / WORLD.TILE_PX);
        const viewRows = Math.floor((this.viewH - HUD_TOP_PX - HUD_BOTTOM_PX) / WORLD.TILE_PX);
        this.setMap(ArenaGenerator.generate(viewCols, viewRows, this.arenaTheme || null));
        this.initializeTanks();
        MapArt.bake(this.map); // Spawns clear space around themselves
        this.centerCamera();
    }

    /**
     * Stop any active game loop
     */
    stopGameLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    startGameLoop() {
        this.stopGameLoop();
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Initialize tanks (players + AI bots)
     */
    initializeTanks() {
        this.tanks = [];
        this.players = [];
        this.aiBots = [];

        // Calculate spawn positions via mode
        const spawnPositions = this.mode.calculateSpawnPositions(this);

        // Create human players
        for (let i = 0; i < this.numPlayers; i++) {
            const tank = this.mode.createTank(this, spawnPositions[i], i, false); // false = human player
            this.tanks.push(tank);
            this.players.push(tank);
        }

        // Create AI bots
        for (let i = this.numPlayers; i < this.numPlayers + this.numAIBots; i++) {
            const tank = this.mode.createTank(this, spawnPositions[i], i, true); // true = AI bot
            this.tanks.push(tank);
            this.aiBots.push(tank);
        }

        this.tanks.forEach(tank => {
            tank.turretAngle = Math.atan2(this.map.height / 2 - tank.y, this.map.width / 2 - tank.x);
            tank.angle = tank.turretAngle;
            this.setStatus(tank, 'spawnProtect', 1500);
        });
    }

    /**
     * Create a tank object
     * @param {Object} options - Anything that differs from a standard tank
     * @returns {Object} Tank object
     */
    createTank(options) {
        const tank = {
            id: options.id ?? this.nextTankId++,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            kx: 0,
            ky: 0,
            angle: 0,
            turretAngle: 0,
            health: GAME_CONFIG.TANK_HEALTH,
            maxHealth: GAME_CONFIG.TANK_HEALTH,
            palette: 'blue',
            chassis: 'player',
            eyes: 'cute',
            isAI: false,
            isPlayer: false,
            isAIAlly: false,
            team: null,
            faction: null,
            name: 'Tank',
            nextShotAt: 0,
            size: GAME_CONFIG.TANK_SIZE,
            speed: GAME_CONFIG.TANK_SPEED,
            turretLength: GAME_CONFIG.TURRET_LENGTH,
            turretRotationSpeed: GAME_CONFIG.TURRET_ROTATION_SPEED,
            isAlive: true,

            // Harmony
            meter: GAME_CONFIG.METER_START,
            groove: 0,
            abilityReadyAt: 0,
            cooldowns: {},       // When each chord and melody can be played again
            shieldHits: 0,
            tenutoBeats: 0,
            pendingShot: null,

            // Timed effects
            status: {},
            hurtUntil: 0,
            recoilUntil: 0,
            spikeReadyAt: 0,
            stringHitBeat: -1,
            lastTile: -1,
            lastSafeX: 0,
            lastSafeY: 0,
            distance: 0,

            // Statistics
            shotsFired: 0,
            shotsHit: 0,
            kills: 0,
            deaths: 0,
            deathTime: 0,
            killedBy: null,

            // Powerups (arrays for stacking)
            powerups: {
                invincibility: [],
                speed: [],
                rapidFire: [],
                spreadShot: [],
                bouncingBullets: []
            },

            // AI-specific properties
            ai: null,
            ...options
        };
        tank.lastSafeX = tank.x;
        tank.lastSafeY = tank.y;

        // Initialize statistics
        if (!tank.enemyType && !tank.boss && !tank.isBuddy && !tank.inert) {
            this.playerStats.set(tank.id, {
                name: tank.name,
                isAI: tank.isAI,
                team: tank.team,
                palette: tank.palette,
                shotsFired: 0,
                shotsHit: 0,
                damageDealt: 0,
                kills: 0,
                deaths: 0,
                deathTime: 0,
                killedBy: null,
                killsList: [],
                powerupsCollected: 0,
                abilitiesUsed: 0,
                bestGroove: 0
            });
        }

        return tank;
    }

    /**
     * Summon a little ally for a tank
     * @param {Object} owner - Tank that called for help
     * @param {number} side - Which side of the tank it arrives on, -1 to 1
     */
    spawnBuddy(owner, side = 0) {
        const angle = owner.turretAngle + Math.PI + side * 1.4;
        const x = owner.x + Math.cos(angle) * 40;
        const y = owner.y + Math.sin(angle) * 40;
        const spot = this.map.tankBlocked(x, y, 30) ? { x: owner.x, y: owner.y } : { x, y };
        const buddy = this.createTank({
            ...spot,
            name: `${owner.name}'s Quaver`,
            palette: owner.palette,
            chassis: 'buddy',
            size: 30,
            turretLength: 27,
            health: HARMONY_CONFIG.RALLY_HEALTH,
            maxHealth: HARMONY_CONFIG.RALLY_HEALTH,
            speed: GAME_CONFIG.TANK_SPEED * 1.1,
            shotDamage: HARMONY_CONFIG.RALLY_DAMAGE,
            shotCooldown: HARMONY_CONFIG.RALLY_FIRE_MS,
            fadeEvery: HARMONY_CONFIG.RALLY_FADE_MS,
            fadesAt: this.clock + HARMONY_CONFIG.RALLY_FADE_MS,
            isAI: true,
            isBuddy: true,
            isAIAlly: owner.isPlayer || owner.isAIAlly,
            team: owner.team,
            faction: owner.faction,
            leader: owner,
            turretAngle: owner.turretAngle
        });
        this.tanks.push(buddy);
        this.setStatus(buddy, 'spawnProtect', 800);
        this.ring(spot.x, spot.y, 50, '#ffd45e', 300);
    }

    /**
     * Setup MIDI input handling
     */
    setupMIDIInput() {
        if (window.midiHandler) {
            // Listen for all control events
            window.midiHandler.onControl('all', (controlEvent) => {
                this.handleMIDIControl(controlEvent);
            }, 'game');
        }
    }

    /**
     * Handle MIDI control input
     * @param {Object} controlEvent - Control event from MIDI handler
     */
    handleMIDIControl(controlEvent) {
        const { playerIndex, control, isPressed, velocity, chord } = controlEvent;

        // Releases still count while paused, or keys would stick down
        if (this.isPaused) {
            if (!isPressed) this.activeControls.delete(`${playerIndex}-${control}`);
            return;
        }

        // A dialogue takes over the shoot and harmony keys to turn the page
        if (this.dialog) {
            if (isPressed && (control === 'D' || isHarmonyControl(control))) this.dialog.advance();
            if (!isPressed) this.activeControls.delete(`${playerIndex}-${control}`);
            return;
        }

        // Only handle controls for human players
        if (playerIndex >= this.numPlayers) {
            return;
        }

        const tank = this.players[playerIndex];

        if (chord) {
            if (isPressed && tank) Abilities.cast(this, tank, chord);
            return;
        }

        // Track active controls
        const controlKey = `${playerIndex}-${control}`;
        if (isPressed) {
            this.activeControls.set(controlKey, controlEvent);
        } else {
            this.activeControls.delete(controlKey);
        }

        if (!tank) return;

        if (isHarmonyControl(control)) {
            const keyNumber = HARMONY_KEYS.indexOf(control) + 1;
            if (isPressed) this.harmony[playerIndex].press(keyNumber, velocity || 0.7);
            else this.harmony[playerIndex].release(keyNumber);
        } else if (control === 'D' && isPressed && tank.isAlive) {
            tank.pendingShot = { at: this.clock, onBeat: this.isOnBeat() };
        }
    }

    /**
     * A player has added a note to their melody. Modes get first refusal, which is
     * how melody doors work, then we check it against the known melodies.
     * @param {Object} tank - The player's tank
     * @param {Array<number>} melody - Harmony keys played so far
     */
    noteMelody(tank, melody) {
        const heard = this.mode && this.mode.onMelody ? this.mode.onMelody(this, tank, melody) : false;
        if (heard === true) this.harmony.forEach(input => input.clear());
        if (heard) return;
        for (const [name, def] of Object.entries(HARMONY_CONFIG.MELODIES)) {
            const tail = melody.slice(-def.keys.length);
            if (tail.length === def.keys.length && tail.every((key, i) => key === def.keys[i])) {
                if (Abilities.cast(this, tank, name)) this.harmony[tank.id].clear();
                return;
            }
        }
    }

    /**
     * Every tune this tank could be in the middle of playing right now
     */
    knownTunes(tank) {
        const tunes = Object.entries(HARMONY_CONFIG.MELODIES)
            .filter(([name]) => this.abilityAvailable(tank, name))
            .map(([, melody]) => melody.keys);
        const mode = this.mode;
        if (mode && mode.nearDoor && mode.level.door) tunes.push(mode.level.door.melody);
        return tunes;
    }

    /**
     * Is there any harmony to speak of here? It stays out of sight until then.
     */
    harmonyInPlay() {
        if (this.harmonyOff) return false;
        return !this.mode.knowsHarmony || this.mode.knowsHarmony();
    }

    /**
     * Where the pointer is pointing, in the world
     */
    mouseWorld() {
        return {
            x: this.camera.x + this.mouse.x * WORLD.PIXEL,
            y: this.camera.y + this.mouse.y * WORLD.PIXEL
        };
    }

    abilityAvailable(tank, name) {
        if (this.harmonyOff) return false;
        if (this.mode && this.mode.abilityAvailable) return this.mode.abilityAvailable(this, tank, name);
        return true;
    }

    /**
     * Do these two tanks fight?
     */
    areHostile(a, b) {
        if (a === b) return false;
        if (this.gameMode === GAME_MODES.TDM) return a.team !== b.team;
        if (this.gameMode === GAME_MODES.CAMPAIGN) return a.faction !== b.faction;
        if (a.isBuddy || b.isBuddy) {
            const leaderA = a.leader || a;
            const leaderB = b.leader || b;
            return leaderA !== leaderB;
        }
        return true;
    }

    bulletHostileTo(bullet, tank) {
        if (bullet.ownerTank) return this.areHostile(bullet.ownerTank, tank);
        return bullet.faction !== tank.faction;
    }

    nearestHostile(tank, x, y, range = Infinity) {
        let nearest = null;
        let bestDistance = range;
        this.tanks.forEach(other => {
            if (!other.isAlive || !this.areHostile(tank, other) || this.hasStatus(other, 'hidden')) return;
            // Decoys are there to be looked at
            const pull = other.isBuddy ? HARMONY_CONFIG.RALLY_TAUNT : 1;
            const distance = Math.hypot(other.x - x, other.y - y) * pull;
            if (distance < bestDistance) {
                bestDistance = distance;
                nearest = other;
            }
        });
        return nearest;
    }

    hasStatus(tank, name) {
        return (tank.status[name] || 0) > this.clock;
    }

    setStatus(tank, name, duration) {
        tank.status[name] = this.clock + duration;
    }

    /**
     * A shield that starts out able to take this many hits, and loses them evenly
     * over its length, so it runs out with time even if nothing touches it
     */
    giveShield(tank, duration, hits) {
        this.setStatus(tank, 'shield', duration);
        tank.shieldHits = hits;
        tank.shieldFadeEvery = duration / hits;
        tank.shieldFadesAt = this.clock + tank.shieldFadeEvery;
    }

    fadeShield(tank) {
        if (!tank.shieldHits || this.clock < tank.shieldFadesAt) return;
        tank.shieldFadesAt += tank.shieldFadeEvery;
        tank.shieldHits--;
        if (tank.shieldHits <= 0) tank.status.shield = 0;
    }

    /**
     * Let a shield take a hit, if the tank has one up
     * @returns {boolean} True if the hit was stopped
     */
    absorbHit(tank) {
        if (!this.hasStatus(tank, 'shield')) return false;
        tank.shieldHits--;
        if (tank.shieldHits <= 0) {
            tank.status.shield = 0;
            this.ring(tank.x, tank.y, 44, '#ffffff', 220);
            this.puff(tank.x, tank.y, '#7cc0f5', 8);
        }
        window.audioSystem.shieldBlock();
        return true;
    }

    speedOf(tank) {
        const stacks = tank.powerups ? tank.powerups.speed.length : 0;
        let speed = tank.speed * (1 + stacks * GAME_CONFIG.POWERUP_SPEED_BONUS);
        if (this.hasStatus(tank, 'slow')) speed *= 0.55;
        return speed;
    }

    /**
     * Run something a moment from now, in game time
     */
    after(delay, action) {
        this.delayed.push({ at: this.clock + delay, action });
    }

    /**
     * Update game state
     * @param {number} deltaTime - Time since last tick
     */
    update(deltaTime) {
        this.clock += deltaTime;

        const beatIndex = Math.floor(this.beat.position);
        if (beatIndex !== this.lastBeatIndex) {
            this.lastBeatIndex = beatIndex;
            this.onBeat(beatIndex);
        }

        for (let i = this.delayed.length - 1; i >= 0; i--) {
            if (this.delayed[i].at <= this.clock) {
                const { action } = this.delayed[i];
                this.delayed.splice(i, 1);
                action();
            }
        }

        this.updateTanks(deltaTime);
        this.collisions.separateTanks();
        this.collisions.updateBullets(deltaTime);
        this.powerupsManager.update(deltaTime);
        this.updateTelegraphs();

        if (this.mode.update) this.mode.update(this, deltaTime);
        this.updateCamera();
        this.updateEffects(deltaTime);
        this.checkGameEnd();
    }

    onBeat(beatIndex) {
        if (this.mode.onBeat) this.mode.onBeat(this, beatIndex);
        if (this.gameMode !== GAME_MODES.CAMPAIGN && !this.gameEnding) this.updateEncore(beatIndex);
        this.tanks.forEach(tank => {
            if (tank.isAlive && tank.onBeat) tank.onBeat(tank, beatIndex);
            if (tank.isAlive && tank.tenutoBeats > 0) Abilities.holdTenuto(this, tank);
        });
    }

    /**
     * Matches cannot go on forever. Past the time limit, everyone wears down.
     */
    updateEncore(beatIndex) {
        if (this.clock - this.gameStartTime < GAME_CONFIG.ENCORE_AFTER_MS) return;
        if (!this.encoreStarted) {
            this.encoreStarted = true;
            this.showBanner('Encore!', 'Every tank wears down on the beat. Finish it.', 2600);
            window.audioSystem.bossRoar();
        }
        if (beatIndex % GAME_CONFIG.ENCORE_EVERY_BEATS !== 0) return;
        this.tanks.forEach(tank => {
            if (tank.isAlive) {
                this.ring(tank.x, tank.y, 44, '#ff4d6d', 200);
                this.damageTank(tank, GAME_CONFIG.ENCORE_DAMAGE, { type: 'encore' });
            }
        });
    }

    /**
     * Update all tanks
     * @param {number} deltaTime - Time since last tick
     */
    updateTanks(deltaTime) {
        this.tanks.forEach(tank => {
            if (!tank.isAlive) return;
            const startX = tank.x;
            const startY = tank.y;
            tank.moved = false;

            // Decoys wear away on their own, a little at a time
            if (tank.fadeEvery && this.clock >= tank.fadesAt) {
                tank.fadesAt += tank.fadeEvery;
                tank.health -= 1;
                if (tank.health <= 0) {
                    this.puff(tank.x, tank.y, '#ffd45e', 10);
                    tank.isAlive = false;
                    return;
                }
            }

            this.fadeShield(tank);

            const disabled = this.hasStatus(tank, 'sleep') || this.hasStatus(tank, 'stun');

            if (this.hasStatus(tank, 'dash')) {
                const step = HARMONY_CONFIG.DASH_SPEED;
                this.collisions.moveTankWithSliding(tank, tank.x + tank.dashX * step, tank.y + tank.dashY * step, null);
                tank.moved = true;
                this.dashStrike(tank);
                this.particles.length < 300 && this.addParticle(tank.x, tank.y, 0, 0, TANK_PALETTES[tank.palette].l, 200, 2);
            } else if (!disabled) {
                if (tank.boss) window.Bosses.update(this, tank, deltaTime);
                else if (tank.enemyType) window.Enemies.update(this, tank, deltaTime);
                else if (tank.inert) tank.moved = false;
                else if (tank.isAI) window.aiBehavior.updateAITank(tank, deltaTime);
                else this.updatePlayerTank(tank, deltaTime);
            }

            this.applyKnockback(tank);
            this.applyTileEffects(tank);
            this.collisions.constrainTankToMap(tank);

            tank.vx = tank.x - startX;
            tank.vy = tank.y - startY;
            tank.distance += Math.hypot(tank.vx, tank.vy);
        });

        // Crew stay in the list for the scoreboard, everything else clears away
        this.tanks = this.tanks.filter(tank => tank.isAlive || !(tank.isBuddy || tank.enemyType || tank.boss));
    }

    /**
     * A Glissando hurts whatever it slides through, once each
     */
    dashStrike(tank) {
        this.tanks.forEach(other => {
            if (!other.isAlive || other.intangible || tank.dashStruck.has(other) || !this.areHostile(tank, other)) return;
            if (distanceBetween(tank, other) < (tank.size + other.size) / 2) {
                tank.dashStruck.add(other);
                this.damageTank(other, HARMONY_CONFIG.DASH_DAMAGE, { source: tank, type: 'blast' });
            }
        });
    }

    applyKnockback(tank) {
        if (Math.abs(tank.kx) < 0.05 && Math.abs(tank.ky) < 0.05) {
            tank.kx = 0;
            tank.ky = 0;
            return;
        }
        if (!tank.immobile) {
            this.collisions.moveTankWithSliding(tank, tank.x + tank.kx, tank.y + tank.ky, null);
        }
        tank.kx *= 0.84;
        tank.ky *= 0.84;
    }

    knockback(tank, angle, force) {
        const resist = tank.boss ? 0.15 : (tank.size > 40 ? 0.5 : 1);
        tank.kx += Math.cos(angle) * force * resist;
        tank.ky += Math.sin(angle) * force * resist;
    }

    /**
     * What the ground under a tank does to it
     */
    applyTileEffects(tank) {
        const map = this.map;
        const c = Math.floor(tank.x / WORLD.TILE);
        const r = Math.floor(tank.y / WORLD.TILE);
        const type = map.at(c, r);
        const dashing = this.hasStatus(tank, 'dash');
        const tileIndex = map.index(c, r);

        if (type === TILES.PIT) {
            // A dash carries a tank over a gap. Coming down in one costs health.
            if (!dashing) {
                this.damageTank(tank, GAME_CONFIG.PIT_FALL_DAMAGE, { type: 'hazard' });
                tank.x = tank.lastSafeX;
                tank.y = tank.lastSafeY;
                this.setStatus(tank, 'spawnProtect', 700);
            }
            return;
        }
        if (!dashing && !map.tankBlocked(tank.x, tank.y, tank.size)) {
            tank.lastSafeX = tank.x;
            tank.lastSafeY = tank.y;
        }
        if (tank.boss || tank.immobile) return;

        if (type === TILES.SPIKES && !dashing && this.clock >= tank.spikeReadyAt) {
            tank.spikeReadyAt = this.clock + GAME_CONFIG.SPIKE_INTERVAL_MS;
            this.damageTank(tank, GAME_CONFIG.SPIKE_DAMAGE, { type: 'hazard' });
        } else if (type >= TILES.BOOST_N && type <= TILES.BOOST_W) {
            const [dx, dy] = BOOST_DIRECTIONS[type];
            const push = tank.speed * (GAME_CONFIG.BOOST_MULTIPLIER - 1) + 0.5;
            this.collisions.moveTankWithSliding(tank, tank.x + dx * push, tank.y + dy * push, null);
        } else if (type === TILES.STRING && this.stringsActive() && !dashing) {
            const beatIndex = Math.floor(this.beat.position);
            if (tank.stringHitBeat !== beatIndex) {
                tank.stringHitBeat = beatIndex;
                this.damageTank(tank, GAME_CONFIG.STRING_DAMAGE, { type: 'hazard' });
                window.audioSystem.pluck();
            }
        } else if (type === TILES.KEYPAD && tank.lastTile !== tileIndex) {
            // Floor keys play their note when driven over, if there are any notes
            this.keypadGlow.set(tileIndex, this.clock + 400);
            const silent = this.mode.keysAreSilent && this.mode.keysAreSilent();
            if (!tank.isAI && !silent) window.audioSystem.pianoNote(keyPitch(c), 0.6, 0.5);
        }
        tank.lastTile = tileIndex;
    }

    /**
     * Strings ring on every other beat, and hurt anything touching them while they do
     */
    stringsActive() {
        return Math.floor(this.beat.position) % 2 === 1;
    }

    /**
     * Update player tank based on active controls
     * @param {Object} tank - Tank to update
     * @param {number} deltaTime - Time since last tick
     */
    updatePlayerTank(tank, deltaTime) {
        const playerIndex = tank.id;

        // Check for movement controls
        const moveUp = this.activeControls.has(`${playerIndex}-A_SHARP`);
        const moveLeft = this.activeControls.has(`${playerIndex}-A`);
        const moveDown = this.activeControls.has(`${playerIndex}-B`);
        const moveRight = this.activeControls.has(`${playerIndex}-C`);

        // Check for turret controls
        const aimLeft = this.activeControls.has(`${playerIndex}-C_SHARP`);
        const aimRight = this.activeControls.has(`${playerIndex}-D_SHARP`);
        const holdingFire = this.activeControls.has(`${playerIndex}-D`);

        // Handle movement with diagonal support
        let moveX = 0;
        let moveY = 0;

        if (moveUp) moveY -= 1;
        if (moveDown) moveY += 1;
        if (moveLeft) moveX -= 1;
        if (moveRight) moveX += 1;

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            moveX /= length;
            moveY /= length;
        }

        // Update tank angle based on movement direction
        if (moveX !== 0 || moveY !== 0) {
            const moveAngle = Math.atan2(moveY, moveX);
            const speed = this.speedOf(tank);
            tank.moveDirection = { x: moveX, y: moveY };
            tank.moved = true;

            // Use sliding movement system
            this.collisions.moveTankWithSliding(tank, tank.x + moveX * speed, tank.y + moveY * speed, moveAngle);
        } else {
            tank.moveDirection = null;
        }

        // Handle turret rotation
        if (playerIndex === 0 && this.mouse && Prompts.usesMouse()) {
            const point = this.mouseWorld();
            tank.turretAngle = Math.atan2(point.y - tank.y, point.x - tank.x);
        }
        if (aimLeft) {
            tank.turretAngle -= tank.turretRotationSpeed;
        }
        if (aimRight) {
            tank.turretAngle += tank.turretRotationSpeed;
        }

        // A fresh press stays queued for a moment, so a shot on the beat is not lost
        // to a cooldown that was about to end
        const pending = tank.pendingShot;
        if (pending && this.clock - pending.at > 130) tank.pendingShot = null;

        if ((tank.pendingShot || holdingFire) && this.clock >= tank.nextShotAt) {
            const fresh = tank.pendingShot;
            tank.pendingShot = null;
            if (fresh && !this.beatless) this.scoreRhythm(tank, fresh.onBeat);
            this.fireShot(tank, !!(fresh && fresh.onBeat));
        }
    }

    /**
     * A fresh shot either keeps the groove going or drops it
     */
    scoreRhythm(tank, onBeat) {
        if (onBeat) {
            tank.groove = Math.min(GAME_CONFIG.GROOVE_MAX, tank.groove + 1);
            if (tank.isPlayer) {
                this.beatHitUntil = this.clock + 140;
                window.audioSystem.perfect();
            }
            const stats = this.playerStats.get(tank.id);
            if (stats) stats.bestGroove = Math.max(stats.bestGroove, tank.groove);
        } else {
            tank.groove = 0;
        }
    }

    /**
     * Fire a tank's gun
     * @param {Object} tank - Tank shooting
     * @param {boolean} onBeat - Landed on the beat
     */
    fireShot(tank, onBeat = false) {
        const shot = GAME_CONFIG.SHOT;
        const spreadStacks = tank.powerups.spreadShot.length;
        const count = 1 + spreadStacks * 2;
        const spacing = GAME_CONFIG.POWERUP_SPREAD_ANGLE * (spreadStacks > 1 ? 0.75 : 1);
        const baseDamage = (tank.shotDamage ?? shot.damage) + (onBeat ? (this.beatDamageBonus ?? GAME_CONFIG.BEAT_DAMAGE_BONUS) : 0);
        const damage = spreadStacks > 1 ? Math.round(baseDamage * GAME_CONFIG.POWERUP_SPREAD_DAMAGE) : baseDamage;
        const bounces = tank.powerups.bouncingBullets.length > 0 ? GAME_CONFIG.POWERUP_BOUNCE_BOUNCES : 0;
        const echoing = this.hasStatus(tank, 'echo');
        const pal = TANK_PALETTES[tank.palette];

        // Harmony is only earned when a shot lands, so a shot on the beat carries its
        // bonus with it
        const meter = shot.meter + (onBeat ? 1 + tank.groove * GAME_CONFIG.GROOVE_METER_BONUS : 0);
        this.addMeter(tank, GAME_CONFIG.METER_ON_SHOT * (onBeat ? 2 : 1));

        const shoot = (extraBounces, strength = 1) => {
            if (!tank.isAlive) return;
            for (let i = 0; i < count; i++) {
                const angle = tank.turretAngle + (i - (count - 1) / 2) * spacing;
                this.spawnBullet({
                    x: tank.x + Math.cos(angle) * tank.turretLength,
                    y: tank.y + Math.sin(angle) * tank.turretLength,
                    angle,
                    speed: shot.speed,
                    size: shot.size,
                    damage: Math.max(1, Math.round(damage * strength)),
                    knockback: shot.knockback,
                    meter: Math.round(meter * strength),
                    owner: tank,
                    kind: 'shot',
                    color: onBeat ? '#ffd45e' : pal.l,
                    bounces: bounces + extraBounces,
                    ricochet: bounces > 0
                });
            }
        };
        shoot(echoing ? 1 : 0);
        if (echoing) this.after(HARMONY_CONFIG.ECHO_DELAY_MS, () => shoot(1, HARMONY_CONFIG.ECHO_DAMAGE));

        // Vivace fills in the time after a shot: eighths, then triplets, then sixteenths
        const vivace = tank.powerups.rapidFire.length;
        for (let i = 1; i <= vivace; i++) {
            this.after(this.beat.msPerBeat * i / (vivace + 1), () => {
                shoot(0);
                tank.recoilUntil = this.clock + 80;
                window.audioSystem.shoot(onBeat);
            });
        }

        tank.nextShotAt = this.clock + (tank.shotCooldown ?? shot.cooldown);
        tank.recoilUntil = this.clock + 110;
        tank.muzzleUntil = this.clock + 70;
        tank.shotsFired++;
        const stats = this.playerStats.get(tank.id);
        if (stats) stats.shotsFired++;
        window.audioSystem.shoot(onBeat);
    }

    /**
     * Put a bullet in the world
     * @param {Object} options - Position, angle, speed, damage and owner, plus extras
     */
    spawnBullet(options) {
        const { angle, speed, owner = null } = options;
        if (owner && owner.faction === 'dissonance' && this.bullets.length >= this.enemyBulletCap) return null;
        const bullet = {
            size: 9,
            damage: 1,
            knockback: 0,
            bounces: 0,
            kind: 'shot',
            color: '#ffffff',
            life: GAME_CONFIG.BULLET_MAX_LIFETIME_MS,
            ...options,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ownerTank: owner,
            faction: owner ? owner.faction : options.faction,
            dead: false
        };
        this.bullets.push(bullet);
        return bullet;
    }

    /**
     * Hurt a tank
     * @param {Object} target - Tank being hurt
     * @param {number} amount - Damage
     * @param {Object} options - source tank, the bullet, and the type of damage
     */
    damageTank(target, amount, options = {}) {
        const { source = null, bullet = null, type = 'bullet' } = options;
        if (!target.isAlive || amount <= 0) return;
        if (this.collisions.isTankInvincible(target)) return;
        if (type === 'hazard' && target.boss) return;
        if (type !== 'hazard' && type !== 'encore' && this.absorbHit(target)) return;

        const drowsy = target.def && target.def.drowsy && this.hasStatus(target, 'sleep') ? target.def.drowsy : 1;
        const damage = Math.round(amount * (target.damageTaken ?? 1) * drowsy * 10) / 10;
        target.health -= damage;
        target.tenutoBeats = 0;
        target.hurtUntil = this.clock + 90;
        if (source) target.lastAttacker = source;

        const color = source && source.isPlayer ? '#ffffff' : '#ff9a8b';
        this.floatText(target.x + (Math.random() - 0.5) * 18, target.y - 20, String(Math.ceil(damage)), color, 10);
        this.puff(target.x, target.y, TANK_PALETTES[target.palette].l, 3);

        if (source) {
            // Only shots earn harmony, or chords would pay for themselves
            if (bullet) this.addMeter(source, bullet.meter || 0);
            // What a decoy does counts for whoever called it
            const stats = this.playerStats.get((source.leader || source).id);
            if (stats) stats.damageDealt += damage;
        }
        this.addMeter(target, 1);

        if (target.isPlayer) {
            window.audioSystem.hurt();
            this.shake(3);
        } else {
            window.audioSystem.hit();
        }

        if (target.health <= 0) {
            if (target.boss && target.def.resolves) {
                // This one cannot be beaten, only played
                target.health = 1;
                this.mode.beginResolution(this, target);
                return;
            }
            this.killTank(target, source);
        }
    }

    healTank(tank, amount) {
        const before = tank.health;
        tank.health = Math.min(tank.maxHealth, tank.health + amount);
        if (tank.health > before) {
            this.floatText(tank.x, tank.y - 24, `+${Math.ceil(tank.health - before)}`, '#a4e87a', 10);
        }
    }

    addMeter(tank, amount) {
        if (tank.meter === undefined) return;
        tank.meter = Math.min(GAME_CONFIG.METER_MAX, tank.meter + amount);
    }

    /**
     * Handle tank death
     */
    killTank(tank, source) {
        tank.isAlive = false;
        tank.health = 0;
        tank.deathTime = this.clock;
        tank.killedBy = source ? source.name : 'the stage';

        // Update kill/death statistics
        if (source) {
            source.kills++;
            this.addMeter(source, GAME_CONFIG.METER_ON_KILL);
            const sourceStats = this.playerStats.get((source.leader || source).id);
            if (sourceStats) {
                sourceStats.kills++;
                sourceStats.killsList.push(tank.name);
            }
        }
        const tankStats = this.playerStats.get(tank.id);
        if (tankStats) {
            tankStats.deaths++;
            tankStats.deathTime = tank.deathTime;
            tankStats.killedBy = tank.killedBy;
        }

        this.explode(tank.x, tank.y, tank.palette, tank.size);
        if (tank.isPlayer || tank.isAIAlly) {
            window.audioSystem.death();
            this.shake(6);
        } else {
            window.audioSystem.enemyDeath();
            this.shake(3);
        }
        if (this.mode.onTankKilled) this.mode.onTankKilled(this, tank, source);
    }

    damageTile(c, r, amount) {
        const map = this.map;
        const i = map.index(c, r);
        if (map.tiles[i] !== TILES.CRATE) return;
        map.health[i] = Math.max(0, map.health[i] - amount);
        if (map.health[i] > 0) {
            this.puff((c + 0.5) * WORLD.TILE, (r + 0.5) * WORLD.TILE, '#d8a468', 2);
            return;
        }
        const x = (c + 0.5) * WORLD.TILE;
        const y = (r + 0.5) * WORLD.TILE;
        map.change(c, r, TILES.FLOOR);
        this.puff(x, y, '#b07a44', 12);
        window.audioSystem.crate();
        if (Math.random() < 0.4) {
            this.powerupsManager.drop(x, y, this.powerupsManager.getWeightedRandomType());
        }
    }

    forEachTileInRadius(x, y, radius, action) {
        const left = Math.floor((x - radius) / WORLD.TILE);
        const right = Math.floor((x + radius) / WORLD.TILE);
        const top = Math.floor((y - radius) / WORLD.TILE);
        const bottom = Math.floor((y + radius) / WORLD.TILE);
        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                if (Math.hypot((c + 0.5) * WORLD.TILE - x, (r + 0.5) * WORLD.TILE - y) <= radius) action(c, r);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Telegraphs: the warning shapes painted on the floor before a big attack
    // -------------------------------------------------------------------------

    /**
     * Warn of an attack, then run it
     * @param {Object} shape - circle {x,y,radius} or line {x,y,angle,length,width}
     * @param {number} delay - Warning time in ms
     * @param {Function} action - Runs when the warning ends
     */
    telegraph(shape, delay, action) {
        this.telegraphs.push({ ...shape, start: this.clock, end: this.clock + delay, action });
        window.audioSystem.telegraph();
    }

    updateTelegraphs() {
        for (let i = this.telegraphs.length - 1; i >= 0; i--) {
            const mark = this.telegraphs[i];
            if (this.clock >= mark.end) {
                this.telegraphs.splice(i, 1);
                mark.action(mark);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    addParticle(x, y, vx, vy, color, life, size = 3) {
        this.particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
    }

    puff(x, y, color, count = 4) {
        for (let i = 0; i < count && this.particles.length < 300; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.6 + Math.random() * 2;
            this.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 220 + Math.random() * 200, 3);
        }
    }

    spark(x, y) {
        this.puff(x, y, '#ffffff', 3);
    }

    explode(x, y, paletteKey, size) {
        const pal = TANK_PALETTES[paletteKey];
        const colors = ['#fff2b0', '#ffb066', pal.l, pal.m, '#5a5670'];
        const count = Math.min(46, 20 + size / 2);
        for (let i = 0; i < count && this.particles.length < 300; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 3.6;
            this.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
                colors[i % colors.length], 300 + Math.random() * 420, i % 3 === 0 ? 6 : 3);
        }
        this.ring(x, y, size * 1.5, '#fff2b0', 240);
    }

    ring(x, y, radius, color, duration) {
        this.rings.push({ x, y, radius, color, start: this.clock, end: this.clock + duration });
    }

    floatText(x, y, text, color = '#ffffff', size = 10) {
        if (this.floaters.length > 40) this.floaters.shift();
        this.floaters.push({ x, y, text, color, size, start: this.clock, end: this.clock + 760 });
    }

    floatIcon(x, y, icon) {
        if (this.floaters.length > 40) this.floaters.shift();
        this.floaters.push({ x, y, icon, start: this.clock, end: this.clock + 760 });
    }

    shake(amount) {
        this.shakeAmount = Math.max(this.shakeAmount, amount);
    }

    flash(color, duration) {
        this.flashColor = color;
        this.flashUntil = this.clock + duration;
        this.flashLength = duration;
    }

    /**
     * Show a large line of text across the stage
     */
    showBanner(title, subtitle = '', duration = 2200) {
        this.banner = { title, subtitle, start: this.clock, end: this.clock + duration };
    }

    updateEffects(deltaTime) {
        this.particles = this.particles.filter(particle => {
            particle.life -= deltaTime;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.93;
            particle.vy *= 0.93;
            return particle.life > 0;
        });
        this.rings = this.rings.filter(ring => this.clock < ring.end);
        this.floaters = this.floaters.filter(floater => this.clock < floater.end);
        this.shakeAmount *= 0.86;
        if (this.shakeAmount < 0.3) this.shakeAmount = 0;
        if (this.banner && this.clock > this.banner.end) this.banner = null;
    }

    // -------------------------------------------------------------------------
    // Camera
    // -------------------------------------------------------------------------

    cameraTarget() {
        const alive = list => list.filter(tank => tank.isAlive);
        let group = alive(this.tanks.filter(tank => tank.isPlayer));
        if (group.length === 0) group = alive(this.tanks.filter(tank => tank.isAIAlly));
        if (group.length === 0) group = alive(this.tanks);
        if (group.length === 0) return null;
        return {
            x: group.reduce((sum, tank) => sum + tank.x, 0) / group.length,
            y: group.reduce((sum, tank) => sum + tank.y, 0) / group.length
        };
    }

    clampCamera(x, y) {
        const viewW = this.viewW * WORLD.PIXEL;
        const viewH = this.viewH * WORLD.PIXEL;
        const clamp = (value, viewSize, mapSize, startPad, endPad) => {
            // The HUD bars take up the edges, so the map may scroll out from under them
            const open = viewSize - startPad - endPad;
            if (mapSize <= open) return (mapSize - open) / 2 - startPad; // A small map sits in the middle
            return Math.max(-startPad, Math.min(mapSize - viewSize + endPad, value));
        };
        return {
            x: clamp(x, viewW, this.map.width, 0, 0),
            y: clamp(y, viewH, this.map.height, HUD_TOP_PX * WORLD.PIXEL, HUD_BOTTOM_PX * WORLD.PIXEL)
        };
    }

    centerCamera() {
        const target = this.cameraTarget() || { x: this.map.width / 2, y: this.map.height / 2 };
        this.camera = this.clampCamera(target.x - this.viewW * WORLD.PIXEL / 2, target.y - this.viewH * WORLD.PIXEL / 2);
    }

    updateCamera() {
        const target = this.cameraFocus || this.cameraTarget();
        if (!target) return;
        const wanted = this.clampCamera(
            target.x - this.viewW * WORLD.PIXEL / 2,
            target.y - this.viewH * WORLD.PIXEL / 2
        );
        const speed = CAMPAIGN_CONFIG.CAMERA.followSpeed;
        this.camera.x += (wanted.x - this.camera.x) * speed;
        this.camera.y += (wanted.y - this.camera.y) * speed;
    }

    // -------------------------------------------------------------------------
    // End of game
    // -------------------------------------------------------------------------

    /**
     * Check if game should end
     */
    checkGameEnd() {
        if (!this.gameEnding && this.mode && this.mode.checkGameEnd) {
            this.mode.checkGameEnd(this);
        }
    }

    /**
     * End the game and show statistics
     */
    endGame() {
        if (this.gameEnding) return;
        this.gameEnding = true;
        this.gameEndTime = this.clock;

        // Let the last explosion finish before the results come up
        this.after(900, () => {
            this.gameState = GAME_STATES.GAME_OVER;
            window.audioSystem.playVictory();
            this.showEndGameStats();
        });
    }

    /**
     * Show end game statistics screen
     */
    showEndGameStats() {
        const seconds = Math.round((this.gameEndTime - this.gameStartTime) / 1000);
        window.menu.showResults({
            title: this.determineWinner(),
            tone: 'win',
            subtitle: `Match length ${seconds}s`,
            rows: this.statsRows(),
            buttons: [
                { icon: 'restart', label: 'Play again', primary: true, action: () => this.restartGame() },
                { icon: 'home', label: 'Main menu', action: () => window.menu.returnToMenu() }
            ]
        });
    }

    statsRows() {
        const rows = [];
        this.playerStats.forEach((stats, id) => {
            const tank = this.tanks.find(t => t.id === id);
            rows.push({
                name: stats.name,
                palette: stats.palette,
                alive: tank ? tank.isAlive : false,
                player: !stats.isAI,
                seat: tank && tank.isPlayer ? `P${tank.id + 1}` : null,
                kills: stats.kills,
                damage: Math.round(stats.damageDealt),
                accuracy: stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0,
                groove: stats.bestGroove,
                abilities: stats.abilitiesUsed,
                powerups: stats.powerupsCollected
            });
        });
        // People first, then bots, each by how they did
        return rows.sort((a, b) => b.player - a.player || b.kills - a.kills || b.damage - a.damage);
    }

    /**
     * Determine the winner of the game
     * @returns {string} Winner information
     */
    determineWinner() {
        if (this.gameMode === GAME_MODES.FFA) {
            const aliveTanks = this.tanks.filter(t => t.isAlive && !t.isBuddy);
            if (aliveTanks.length === 1) {
                return `${aliveTanks[0].name} wins!`;
            }
            return 'Draw: nobody left standing';
        } else if (this.gameMode === GAME_MODES.TDM) {
            const redAlive = this.tanks.filter(t => t.isAlive && t.team === 'red').length;
            const blueAlive = this.tanks.filter(t => t.isAlive && t.team === 'blue').length;

            if (redAlive > 0 && blueAlive === 0) {
                return 'Red Team wins!';
            } else if (blueAlive > 0 && redAlive === 0) {
                return 'Blue Team wins!';
            }
            return 'Draw: nobody left standing';
        }
        return '';
    }

    /**
     * Clear all game objects (bullets, powerups, etc.)
     */
    clearGameObjects() {
        this.bullets = [];
        this.powerups = [];
        this.particles = [];
        this.rings = [];
        this.floaters = [];
        this.delayed = [];
        this.telegraphs = [];
        this.powerupSpawnTimer = 3000;
        this.banner = null;
        this.flashUntil = 0;
        this.shakeAmount = 0;
        this.keypadGlow.clear();
        this.cameraFocus = null;
        this.harmony.forEach(input => input.clear());
    }

    /**
     * Restart the game
     */
    restartGame() {
        // Reset all controls to clear any stuck keys
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }

        // Clear active controls to ensure clean state
        this.activeControls.clear();

        // Stop any existing loop before restarting
        this.stopGameLoop();

        // Reset game state
        this.gameState = GAME_STATES.PLAYING;
        this.tanks = [];
        this.players = [];
        this.aiBots = [];
        this.teams = { red: [], blue: [] };
        this.playerStats.clear();
        this.clearGameObjects();
        this.isPaused = false;
        this.encoreStarted = false;

        // Reinitialize with preserved settings
        this.initialize(this.canvas, this.numPlayers, this.numAIBots, this.gameMode, this.teamAssignments, this.aiTeamDistribution, this.botSkill);
    }

    /**
     * Render the game
     */
    render() {
        if (this.renderer) {
            this.renderer.render();
        }
    }

    /**
     * Run one fixed step of the simulation
     */
    tick(deltaTime) {
        if (this.isPaused) return;

        // Music keeps playing through dialogue, so the beat does too
        this.beat.advance(deltaTime);
        window.audioSystem.updateSong(this.beat.position);

        if (this.dialog) {
            this.dialog.update(deltaTime);
            return;
        }
        if (this.gameState === GAME_STATES.PLAYING) this.update(deltaTime);
    }

    /**
     * Main game loop
     * @param {number} currentTime - Current timestamp
     */
    gameLoop(currentTime) {
        const frame = Math.min(currentTime - this.lastTime, GAME_CONFIG.MAX_FRAME_MS);
        this.lastTime = currentTime;
        this.accumulator += frame * this.pace;

        while (this.accumulator >= GAME_CONFIG.TICK_MS) {
            this.tick(GAME_CONFIG.TICK_MS);
            this.accumulator -= GAME_CONFIG.TICK_MS;
        }

        this.render();
        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Pause/unpause the game
     */
    togglePause() {
        this.setPaused(!this.isPaused);
    }

    setPaused(paused) {
        if (this.gameState !== GAME_STATES.PLAYING || this.isPaused === paused) return;
        this.isPaused = paused;
        window.audioSystem.pauseMusic(paused);
        window.midiHandler.resetAllControls();
        if (paused) window.menu.showPause();
        else window.menu.closeOverlay();
    }

    /**
     * Stop the game
     */
    stop() {
        this.gameState = GAME_STATES.MENU;
        this.stopGameLoop();

        // Stop background music
        if (window.audioSystem) {
            window.audioSystem.stopMusic();
        }
    }
}

// =============================================================================
// GLOBAL GAME INSTANCE
// =============================================================================
window.game = null;

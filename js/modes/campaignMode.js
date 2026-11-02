// =============================================================================
// CAMPAIGN MODE
// =============================================================================

const ALLY_NAMES = ['Minim', 'Breve', 'Dolce', 'Sol', 'Mi', 'Fa', 'La', 'Ti'];

/**
 * The player's progress through the story
 */
const CampaignSave = {
    data: null,

    load() {
        const fresh = { completed: [], unlocked: [], rewards: [], lastLevel: '1-1', finished: false };
        this.data = { ...fresh, ...loadSaved(CAMPAIGN_CONFIG.SAVE_KEY, {}) };
        return this.data;
    },

    get() {
        return this.data || this.load();
    },

    store() {
        storeSaved(CAMPAIGN_CONFIG.SAVE_KEY, this.data);
    },

    reset() {
        this.data = null;
        storeSaved(CAMPAIGN_CONFIG.SAVE_KEY, {});
        this.load();
    },

    isComplete(id) {
        return this.get().completed.includes(id);
    },

    hasStarted() {
        return this.get().completed.length > 0;
    },

    /**
     * How many of the piano's notes the crew has sent home so far
     */
    notesHome() {
        return campaignLevels()
            .filter(level => this.isComplete(level.id))
            .reduce((sum, level) => sum + notesInStage(level), 0);
    },

    markComplete(id) {
        const data = this.get();
        if (!data.completed.includes(id)) data.completed.push(id);
        this.store();
    },

    unlock(name) {
        const data = this.get();
        if (!data.unlocked.includes(name)) data.unlocked.push(name);
        this.store();
    },

    addReward(name) {
        const data = this.get();
        if (!data.rewards.includes(name)) data.rewards.push(name);
        this.store();
    },

    hasReward(name) {
        return this.get().rewards.includes(name);
    },

    /**
     * Stages open up one after another. Optional stages open off the path.
     */
    isOpen(level) {
        if (level.optional) return this.isComplete(level.after);
        const main = campaignLevels().filter(entry => !entry.optional);
        const index = main.findIndex(entry => entry.id === level.id);
        return index <= 0 || this.isComplete(main[index - 1].id);
    }
};

const FORK_SHOT = { damage: 3, range: 620, ringEveryBeats: 8, ringShots: 16 };

// What each kind of stage is asking for, at a glance
const OBJECTIVE_ICONS = { reach: 'flag', clear: 'note', collect: 'star', survive: 'wait', defend: 'wait', boss: 'crown' };

const CampaignMode = {
    key: GAME_MODES.CAMPAIGN,
    currentLevelId: '1-1',
    difficulty: 'MEDIUM',
    level: null,
    enemyList: [],
    aiAllies: [],
    notes: [],
    zones: [],
    spawnMarks: [],
    waveSpawns: [],
    doors: [],
    goalTiles: [],
    fork: null,
    bossTank: null,
    attackBudget: 0,
    beatsLeft: 0,
    waveIndex: 0,
    spares: 0,
    finished: false,
    resolving: null,

    musicTrack(game) {
        return null;
    },

    assignTeams(game) {
        // No teams in campaign - all players and AI allies are on same side
        game.teams = { red: [], blue: [] };
    },

    getMaxAIAllies(game) {
        return Math.max(0, CAMPAIGN_CONFIG.AI_ALLIES.maxCount - game.numPlayers);
    },

    findLevel(id) {
        return campaignLevels().find(level => level.id === id) || campaignLevels()[0];
    },

    /**
     * The keys only find their voices once the story is over
     */
    keysAreSilent() {
        return !CampaignSave.get().finished;
    },

    /**
     * The difficulty as it applies to one stage
     */
    stageRules(level, game) {
        const rules = CAMPAIGN_CONFIG.DIFFICULTY[this.difficulty];
        const stage = CAMPAIGN_CONFIG.STAGE_THREAT[level.id] ?? 1;
        const crew = CAMPAIGN_CONFIG.ENEMY_SCALING.smallCrew[this.extraTanks(game)] ?? 1;
        // Forte's patterns make a boss hit as hard as on Fortissimo, so it needs all of the easing
        const eased = rules.patterns && level.boss ? stage : Math.sqrt(Math.min(1, stage));
        const tuned = rules.threatCap === 1 ? Math.min(1, eased) : stage * crew;
        const threat = rules.threatCap === undefined ? 1 : tuned;
        return {
            ...rules,
            enemyHealthMultiplier: rules.enemyHealthMultiplier * Math.sqrt(threat),
            enemyDamageMultiplier: rules.enemyDamageMultiplier * Math.sqrt(threat),
            enemyCount: rules.enemyCount * threat
        };
    },

    /**
     * How many tanks there are in the crew past the first
     */
    extraTanks(game) {
        return Math.max(0, game.numPlayers - 1) + game.numAIBots;
    },

    /**
     * How many enemies there are for each one drawn on the map
     */
    enemyScale(game, difficulty) {
        const scaling = CAMPAIGN_CONFIG.ENEMY_SCALING;
        return difficulty.enemyCount * (1 + this.extraTanks(game) * scaling.countPerTank)
            * (1 + this.crowd(game) * scaling.crowdCount);
    },

    /**
     * How many tanks the crew has past the point where it starts to swamp a stage
     */
    crowd(game) {
        return Math.max(0, this.extraTanks(game) - CAMPAIGN_CONFIG.ENEMY_SCALING.crowdFrom);
    },

    /**
     * How much tougher a big crew makes everything
     */
    crowdToughness(game) {
        return 1 + this.crowd(game) * CAMPAIGN_CONFIG.ENEMY_SCALING.crowdHealth;
    },

    /**
     * The swarm grows with the crew. Anything that fires patterns only grows, and
     * slowly, for a big crew, or bullets would outgrow the crew's firepower.
     */
    enemiesPerMark(game, type, difficulty) {
        if (ENEMY_TYPES[type].swarm) return this.enemyScale(game, difficulty);
        return difficulty.enemyCount * (1 + this.crowd(game) * CAMPAIGN_CONFIG.ENEMY_SCALING.crowdPatterns);
    },

    addEnemy(game, type, x, y, difficulty) {
        const enemy = Enemies.create(game, type, x, y, difficulty);
        this.enemyList.push(enemy);
        game.tanks.push(enemy);
        return enemy;
    },

    /**
     * Has the crew learned anything yet that harmony could pay for?
     */
    knowsHarmony() {
        const known = CampaignSave.get().unlocked;
        return [...Object.keys(HARMONY_CONFIG.CHORDS), ...Object.keys(HARMONY_CONFIG.MELODIES)]
            .some(name => known.includes(name));
    },

    /**
     * Abilities are learned along the way. They stay learned for replays.
     */
    abilityAvailable(game, tank, name) {
        return CampaignSave.get().unlocked.includes(name);
    },

    initializeLevel(game) {
        const level = this.findLevel(this.currentLevelId);
        this.level = level;
        const save = CampaignSave.get();
        save.lastLevel = level.id;
        (level.learn || []).forEach(name => CampaignSave.unlock(name));
        CampaignSave.store();

        // Stop any previous game loop to avoid multiple loops accelerating
        game.stopGameLoop();

        // Reset all controls to clear any stuck keys
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }

        // Clear active controls to ensure clean state
        game.activeControls.clear();

        // Clear all game objects (bullets, powerups, etc.)
        game.clearGameObjects();
        game.playerStats.clear();
        game.gameEnding = false;
        game.isPaused = false;
        game.dialog = null;
        game.gameStartTime = game.clock;
        game.beatDamageBonus = GAME_CONFIG.BEAT_DAMAGE_BONUS + (CampaignSave.hasReward('resin') ? 1 : 0);

        this.enemyList = [];
        this.aiAllies = [];
        this.notes = [];
        this.zones = [];
        this.waveSpawns = [];
        this.doors = [];
        this.goalTiles = [];
        this.fork = null;
        this.bossTank = null;
        this.finished = false;
        this.resolving = null;
        this.waveIndex = 0;
        this.respawning = 0;
        this.nearDoor = null;
        this.rules = this.stageRules(level, game);
        const spares = this.rules.spares;
        this.spares = (spares + (CampaignSave.hasReward('spare') ? 1 : 0)) * Math.max(1, game.numPlayers);
        this.beatsLeft = level.objective.beats || 0;

        const { map, marks } = TileMap.parse(level.map, level.theme || level.world.theme);
        map.decals = level.decals || [];
        game.setMap(map);
        this.readMap(game, map, marks);

        const difficulty = this.rules;
        this.attackBudget = difficulty.attackTokens;
        game.pace = difficulty.pace;
        game.enemyBulletCap = difficulty.bulletCap;
        this.placeCrew(game, marks);
        this.placeEverythingElse(game, marks, difficulty);
        game.centerCamera();

        this.startSong(game, level.song || level.world.song);
        game.gameState = GAME_STATES.PLAYING;

        game.showBanner(`${level.id}  ${level.name}`, level.objective.text, 2600);
        const intro = this.introLines(level);
        if (intro.length) game.dialog = new Dialog(intro, null);
        game.startGameLoop();
    },

    /**
     * Replays skip the talking, the first time through tells the story
     */
    introLines(level) {
        if (CampaignSave.isComplete(level.id)) return [];
        return level.intro || [];
    },

    startSong(game, key) {
        const bpm = window.audioSystem.playSong(key, game.pace);
        game.beat = new BeatClock(bpm);
        game.lastBeatIndex = 0;
    },

    readMap(game, map, marks) {
        // Doors are grouped, so playing one opens the whole gate
        const seen = new Set();
        for (let r = 0; r < map.rows; r++) {
            for (let c = 0; c < map.cols; c++) {
                const type = map.at(c, r);
                if (type === TILES.GOAL) this.goalTiles.push({ c, r });
                if (type !== TILES.DOOR || seen.has(map.index(c, r))) continue;
                const tiles = [];
                const stack = [[c, r]];
                while (stack.length) {
                    const [x, y] = stack.pop();
                    if (map.at(x, y) !== TILES.DOOR || seen.has(map.index(x, y))) continue;
                    seen.add(map.index(x, y));
                    tiles.push({ c: x, r: y });
                    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
                }
                const x = tiles.reduce((sum, t) => sum + t.c + 0.5, 0) / tiles.length * WORLD.TILE;
                const y = tiles.reduce((sum, t) => sum + t.r + 0.5, 0) / tiles.length * WORLD.TILE;
                this.doors.push({ tiles, x, y, open: false });
            }
        }
    },

    placeCrew(game, marks) {
        const starts = marks.filter(mark => mark.char === 'P');
        const spots = this.crewSpots(game, starts, game.numPlayers + game.numAIBots);
        this.startSpots = spots;
        game.tanks = [];
        game.players = [];
        game.aiBots = [];

        const armor = CampaignSave.hasReward('armor') ? 4 : 0;
        const hitSize = GAME_CONFIG.TANK_SIZE * (CAMPAIGN_CONFIG.DIFFICULTY[this.difficulty].crewHitbox || 1);
        const meterStart = GAME_CONFIG.METER_START + (CampaignSave.hasReward('tuned') ? 25 : 0);

        // Create human players
        for (let i = 0; i < game.numPlayers; i++) {
            const health = GAME_CONFIG.TANK_HEALTH + armor;
            const tank = game.createTank({
                id: i,
                ...spots[i],
                palette: TANK_PALETTE_ORDER[i],
                name: i === 0 ? 'Pip' : `Player ${i + 1}`,
                isPlayer: true,
                faction: 'crew',
                hitSize,
                health,
                maxHealth: health,
                meter: meterStart
            });
            game.tanks.push(tank);
            game.players.push(tank);
        }

        // Create AI allies
        const allies = Math.min(game.numAIBots, this.getMaxAIAllies(game));
        for (let i = 0; i < allies; i++) {
            const index = game.numPlayers + i;
            const health = GAME_CONFIG.TANK_HEALTH + armor;
            const ally = game.createTank({
                id: `ally_${i}`,
                ...spots[index],
                palette: TANK_PALETTE_ORDER[index % TANK_PALETTE_ORDER.length],
                name: ALLY_NAMES[i],
                isAI: true,
                isAIAlly: true,
                faction: 'crew',
                hitSize,
                health,
                maxHealth: health,
                skill: game.botSkill
            });
            this.aiAllies.push(ally);
            game.tanks.push(ally);
            game.aiBots.push(ally);
        }

        game.tanks.forEach(tank => game.setStatus(tank, 'spawnProtect', 1500));
    },

    /**
     * Find a free spot for each tank, starting from the start marks
     */
    crewSpots(game, starts, count) {
        const map = game.map;
        const spots = starts.map(mark => ({ x: mark.x, y: mark.y }));
        const taken = new Set(starts.map(mark => map.index(mark.c, mark.r)));
        const anchor = starts[0] || { c: 2, r: 2 };
        for (let radius = 1; spots.length < count && radius < 8; radius++) {
            for (let dy = -radius; dy <= radius && spots.length < count; dy++) {
                for (let dx = -radius; dx <= radius && spots.length < count; dx++) {
                    const c = anchor.c + dx;
                    const r = anchor.r + dy;
                    if (!map.inBounds(c, r) || taken.has(map.index(c, r)) || map.at(c, r) !== TILES.FLOOR) continue;
                    taken.add(map.index(c, r));
                    spots.push({ x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE });
                }
            }
        }
        return spots;
    },

    placeEverythingElse(game, marks, difficulty) {
        // Each mark on the map is good for this many enemies, which can be less than
        // one. Starting the count near one means a stage always has somebody in it.
        let owed = 0.999;
        marks.forEach(mark => {
            if (ENEMY_MARKS[mark.char]) {
                let first = true;
                for (owed += this.enemiesPerMark(game, ENEMY_MARKS[mark.char], difficulty); owed >= 1; owed--) {
                    const spot = first ? mark : this.freeSpotNear(game, mark);
                    this.addEnemy(game, ENEMY_MARKS[mark.char], spot.x, spot.y, difficulty);
                    first = false;
                }
            } else if (mark.char === 'B') {
                const boss = Bosses.create(game, this.level.boss, mark.x, mark.y, difficulty);
                this.bossTank = boss;
                game.tanks.push(boss);
            } else if (mark.char === '*') {
                this.notes.push({ x: mark.x, y: mark.y, taken: false });
            } else if (mark.char === 'H') {
                game.powerupsManager.drop(mark.x, mark.y, 'HEALTH');
                game.powerups[game.powerups.length - 1].expiresAt = Infinity;
            } else if (mark.char === 'E' && this.knowsHarmony()) {
                game.powerupsManager.drop(mark.x, mark.y, 'HARMONY');
                game.powerups[game.powerups.length - 1].expiresAt = Infinity;
            } else if (mark.char === 'S') {
                this.waveSpawns.push({ x: mark.x, y: mark.y });
            } else if (mark.char === 'T') {
                // It has to stand up to whatever the crew is facing
                const health = Math.round(90 * Math.max(1, this.enemyScale(game, difficulty)) * difficulty.enemyDamageMultiplier);
                this.fork = game.createTank({
                    id: 'fork',
                    x: mark.x,
                    y: mark.y,
                    name: 'Tuning Fork',
                    palette: 'ivory',
                    chassis: 'emplacement',
                    eyes: 'sleepy',
                    faction: 'crew',
                    size: 44,
                    health,
                    maxHealth: health,
                    isAI: true,
                    inert: true,
                    immobile: true,
                    keepWhenDead: true,
                    onBeat: (fork, beatIndex) => this.forkBeat(game, fork, beatIndex)
                });
                game.tanks.push(this.fork);
            }
        });
    },

    /**
     * Update stage logic
     * @param {Object} game - Game instance
     * @param {number} deltaTime - Time since last tick
     */
    update(game, deltaTime) {
        this.updateNotes(game);
        this.updateDoors(game);
        this.updateZones(game);
        this.keepCrewTogether(game);
        this.checkObjective(game);
    },

    onBeat(game, beatIndex) {
        const difficulty = this.rules;
        this.attackBudget = Math.min(difficulty.attackTokens * 2, this.attackBudget + difficulty.attackTokens);
        Enemies.organizeSwarm(game, difficulty);

        const type = this.level.objective.type;
        if ((type === 'survive' || type === 'defend') && !this.finished) {
            this.beatsLeft = Math.max(0, this.beatsLeft - 1);
            const waves = this.level.waves;
            const beatsPlayed = this.level.objective.beats - this.beatsLeft;
            if (beatsPlayed % waves.every === 1) this.spawnWave(game);
        }
    },

    spawnWave(game) {
        const sets = this.level.waves.sets;
        const set = sets[Math.min(this.waveIndex, sets.length - 1)];
        this.waveIndex++;
        const difficulty = this.rules;
        let i = 0;
        Object.entries(set).forEach(([type, count]) => {
            const total = Math.max(1, Math.round(count * this.enemiesPerMark(game, type, difficulty)));
            for (let n = 0; n < total; n++) {
                const point = this.waveSpawns[i++ % this.waveSpawns.length];
                this.addEnemy(game, type, point.x, point.y, difficulty).alerted = true;
                game.ring(point.x, point.y, 50, '#ec8cf8', 400);
            }
        });
    },

    updateNotes(game) {
        this.notes.forEach(note => {
            if (note.taken) return;
            const collector = game.tanks.find(tank => tank.isAlive && tank.faction === 'crew' && !tank.inert && !tank.isBuddy
                && Math.hypot(tank.x - note.x, tank.y - note.y) < tank.size / 2 + 20);
            if (collector) {
                note.taken = true;
                const remaining = this.notes.filter(entry => !entry.taken).length;
                game.puff(note.x, note.y, '#ffd45e', 10);
                game.floatText(note.x, note.y - 20, '\u266A'.repeat(Math.max(1, this.notes.length - remaining)), '#ffd45e');
                window.audioSystem.pianoNote(72 + (this.notes.length - remaining) * 2, 0.8);
            }
        });
    },

    updateDoors(game) {
        const crew = game.players.filter(tank => tank.isAlive);
        this.nearDoor = this.doors.find(door => !door.open
            && crew.some(tank => Math.hypot(tank.x - door.x, tank.y - door.y) < 150)) || null;
    },

    updateZones(game) {
        this.zones = this.zones.filter(zone => game.clock < zone.until);
        this.zones.forEach(zone => {
            game.tanks.forEach(tank => {
                if (tank.isAlive && tank.faction === 'crew' && Math.hypot(tank.x - zone.x, tank.y - zone.y) < zone.radius) {
                    game.setStatus(tank, 'silence', 200);
                    game.setStatus(tank, 'slow', 200);
                }
            });
        });
    },

    /**
     * The Tuning Fork stands up for itself: a shot at the nearest wrong note on every
     * beat, and a ring of true notes in all directions every few bars
     */
    forkBeat(game, fork, beatIndex) {
        const shot = (angle) => game.spawnBullet({
            x: fork.x + Math.cos(angle) * 30,
            y: fork.y + Math.sin(angle) * 30,
            angle,
            speed: GAME_CONFIG.SHOT.speed,
            damage: FORK_SHOT.damage * this.rules.enemyHealthMultiplier,
            owner: fork,
            kind: 'shot',
            color: '#ffd45e'
        });
        const target = game.nearestHostile(fork, fork.x, fork.y, FORK_SHOT.range);
        if (target) {
            fork.turretAngle = Math.atan2(target.y - fork.y, target.x - fork.x);
            shot(fork.turretAngle);
        }
        if (beatIndex % FORK_SHOT.ringEveryBeats === 0) {
            for (let i = 0; i < FORK_SHOT.ringShots; i++) shot(i / FORK_SHOT.ringShots * Math.PI * 2);
            game.ring(fork.x, fork.y, 90, '#ffd45e', 300);
        }
    },

    /**
     * Allies catch up if they are left behind, and with more than one player,
     * nobody can drive off the edge of the shared screen.
     */
    keepCrewTogether(game) {
        const leader = window.aiBehavior.leaderOf({ x: 0, y: 0 });
        const humans = game.players.filter(tank => tank.isAlive);
        if (humans.length === 0) this.carryWatchedCrew(game);
        if (humans.length > 0) {
            // Bots cannot dash, so a gap the leader crossed would strand them for good
            const field = game.map.field([leader]);
            this.aiAllies.forEach(ally => {
                if (!ally.isAlive) return;
                const distance = Math.hypot(ally.x - leader.x, ally.y - leader.y);
                const stranded = game.map.routeCost(ally.x, ally.y, field) === Infinity;
                if (distance > 640 || (stranded && distance > 200)) {
                    const spot = this.freeSpotNear(game, leader);
                    ally.x = spot.x;
                    ally.y = spot.y;
                    game.ring(spot.x, spot.y, 40, '#ffffff', 240);
                }
            });
        }
        if (humans.length > 1) {
            const pad = 24;
            const right = game.camera.x + game.viewW * WORLD.PIXEL - pad;
            const bottom = game.camera.y + game.viewH * WORLD.PIXEL - pad;
            humans.forEach(tank => {
                const x = Math.max(game.camera.x + pad, Math.min(right, tank.x));
                const y = Math.max(game.camera.y + pad, Math.min(bottom, tank.y));
                if (!game.map.tankBlocked(x, y, tank.size)) {
                    tank.x = x;
                    tank.y = y;
                }
            });
        }
    },

    /**
     * Bots cannot dash a gap or play a door, so a crew being watched gets carried
     * over anything that needs a human.
     */
    carryWatchedCrew(game) {
        this.doors.forEach(door => {
            if (door.open) return;
            door.open = true;
            door.tiles.forEach(tile => game.map.change(tile.c, tile.r, TILES.FLOOR));
        });
        const goal = this.objectivePoint(game);
        if (!goal) return;
        const { map } = game;
        const field = map.field([goal]);
        this.aiAllies.forEach(ally => {
            if (!ally.isAlive) return;
            const here = map.index(Math.floor(ally.x / WORLD.TILE), Math.floor(ally.y / WORLD.TILE));
            if (field[here] !== Infinity) return;
            let best = null;
            let bestDistance = Infinity;
            for (let r = 0; r < map.rows; r++) {
                for (let c = 0; c < map.cols; c++) {
                    const distance = Math.hypot((c + 0.5) * WORLD.TILE - ally.x, (r + 0.5) * WORLD.TILE - ally.y);
                    if (map.at(c, r) === TILES.FLOOR && field[map.index(c, r)] !== Infinity && distance < bestDistance) {
                        bestDistance = distance;
                        best = { x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE };
                    }
                }
            }
            if (best) {
                ally.x = best.x;
                ally.y = best.y;
                game.ring(best.x, best.y, 40, '#ffffff', 240);
            }
        });
    },

    freeSpotNear(game, point) {
        for (let i = 0; i < 16; i++) {
            const angle = i * 0.9;
            const reach = 50 + i * 8;
            const x = point.x + Math.cos(angle) * reach;
            const y = point.y + Math.sin(angle) * reach;
            if (!game.map.tankBlocked(x, y, GAME_CONFIG.TANK_SIZE)) return { x, y };
        }
        return { x: point.x, y: point.y };
    },

    /**
     * Melody doors open to their tune, and the last boss resolves to one
     */
    onMelody(game, tank, melody) {
        const matches = keys => {
            const tail = melody.slice(-keys.length);
            return tail.length === keys.length && tail.every((key, i) => key === keys[i]);
        };

        if (this.resolving === 'waiting') {
            if (matches(HARMONY_CONFIG.MELODIES.finale.keys)) {
                this.finishResolution(game);
                return true;
            }
            return false;
        }

        const door = this.nearDoor;
        const tune = this.level.door;
        if (door && tune) {
            if (matches(tune.melody)) {
                door.open = true;
                door.tiles.forEach(tile => game.map.change(tile.c, tile.r, TILES.FLOOR));
                game.ring(door.x, door.y, 120, '#ffd45e', 500);
                game.floatText(door.x, door.y - 40, '\u266A\u266A\u266A', '#ffd45e', 20);
                window.audioSystem.door();
                return true;
            }
            // Partway through the door's tune, so no spell should go off and interrupt it
            for (let n = tune.melody.length - 1; n > 0; n--) {
                if (matches(tune.melody.slice(0, n))) return 'playing';
            }
        }
        return false;
    },

    checkObjective(game) {
        if (this.finished) return;
        const { type } = this.level.objective;
        const crewHere = tile => game.tanks.some(tank => tank.isAlive && tank.faction === 'crew' && !tank.inert && !tank.isBuddy
            && Math.floor(tank.x / WORLD.TILE) === tile.c && Math.floor(tank.y / WORLD.TILE) === tile.r);

        if (type === 'reach' && this.goalTiles.some(crewHere)) {
            this.complete(game);
        } else if (type === 'clear' && this.enemyList.every(enemy => !enemy.isAlive)) {
            this.complete(game);
        } else if (type === 'collect' && this.notes.every(note => note.taken)) {
            this.complete(game);
        } else if ((type === 'survive' || type === 'defend') && this.beatsLeft <= 0) {
            this.dismissEnemies(game);
            this.complete(game);
        } else if (type === 'boss' && this.bossTank && !this.bossTank.isAlive) {
            this.complete(game);
        }
    },

    onTankKilled(game, tank, source) {
        if (tank.enemyType) {
            Enemies.onDeath(game, tank);
            return;
        }
        if (tank.boss) {
            game.flash('#ffffff', 400);
            game.shake(16);
            game.bullets = [];
            game.telegraphs = [];
            this.dismissEnemies(game);
            return;
        }
        if (tank === this.fork) {
            this.fail(game, 'The Tuning Fork was broken.');
            return;
        }
        if (tank.isPlayer && !this.finished) {
            if (this.spares > 0) {
                this.spares--;
                this.respawning++;
                game.after(2200, () => this.respawn(game, tank));
                return;
            }
            this.checkDefeat(game);
        } else if (tank.isAIAlly) {
            this.checkDefeat(game);
        }
    },

    /**
     * Whatever is left of the enemy goes with whoever was leading it. A Crescendo
     * going out this way does not get to go off.
     */
    dismissEnemies(game) {
        game.tanks.forEach(tank => {
            if (!tank.isAlive || !tank.enemyType) return;
            tank.detonated = true;
            game.killTank(tank, null);
        });
    },

    /**
     * A stage is only lost once the whole crew is down. Allies fight on without you.
     */
    checkDefeat(game) {
        const standing = this.respawning > 0 || [...game.players, ...this.aiAllies].some(tank => tank.isAlive);
        if (!standing && !this.finished) this.fail(game, 'The crew has fallen silent.');
    },

    respawn(game, tank) {
        this.respawning--;
        if (this.finished) return;
        const friend = game.players.find(other => other.isAlive);
        const spot = friend ? this.freeSpotNear(game, friend) : { x: tank.lastSafeX, y: tank.lastSafeY };
        tank.x = spot.x;
        tank.y = spot.y;
        tank.kx = 0;
        tank.ky = 0;
        tank.health = tank.maxHealth;
        tank.isAlive = true;
        tank.groove = 0;
        game.setStatus(tank, 'spawnProtect', 2000);
        game.ring(spot.x, spot.y, 60, '#ffffff', 320);
        window.audioSystem.gameStart();
    },

    /**
     * The Eighty-Ninth Key cannot be beaten. Once it stops fighting, it has to be played.
     */
    beginResolution(game, boss) {
        if (this.resolving) return;
        this.resolving = 'talking';
        boss.resolving = true;
        boss.intangible = true;
        boss.leaping = false;
        boss.leapArc = null;
        boss.charging = null;
        boss.faction = 'crew'; // It has stopped fighting, so nobody fights it
        game.tanks.forEach(tank => {
            if (tank.ai) tank.ai.target = null;
        });
        game.bullets = [];
        game.telegraphs = [];
        game.delayed = [];
        this.zones = [];
        this.dismissEnemies(game);
        game.flash('#ffffff', 300);
        this.startSong(game, 'resolve');
        game.dialog = new Dialog(RESOLUTION_SCRIPT, () => {
            this.resolving = 'waiting';
            game.showBanner('Play The Whole Scale', Prompts.melody('finale'), 60000);
            // With nobody at the keys, the crew plays it for them
            if (!game.players.some(tank => tank.isAlive)) game.after(1500, () => this.finishResolution(game));
        });
    },

    finishResolution(game) {
        this.resolving = 'done';
        game.banner = null;
        this.finished = true;
        game.flash('#ffffff', 900);
        // The Whole Scale climbs to G sharp and at last lands on the A above it
        [64, 65, 66, 67, 68].forEach((note, i) => {
            game.after(i * 160, () => window.audioSystem.pianoNote(note + 12, 1, 1.6));
        });
        game.after(900, () => {
            window.audioSystem.chord([57, 61, 64, 69, 73, 76, 81], 1);
            if (this.bossTank) {
                this.bossTank.palette = 'gold';
                game.ring(this.bossTank.x, this.bossTank.y, 700, '#ffd45e', 1400);
            }
            this.startSong(game, 'ending');
        });
        game.after(2400, () => {
            const everyNote = CampaignSave.notesHome() + NOTES_IN_MAIN_STAGE >= NOTES_IN_THE_PIANO;
            const lines = [...ENDING_SCRIPT, ...(everyNote ? ENDING_ALL_FOUND : ENDING_SOME_LOST)];
            game.dialog = new Dialog(lines, () => this.finishStage(game));
        });
    },

    complete(game) {
        this.finished = true;
        game.gameEnding = true;
        game.bullets = [];
        game.telegraphs = [];
        window.audioSystem.levelClear();
        game.showBanner('Stage clear!', this.level.name, 2000);
        game.after(1500, () => {
            const outro = CampaignSave.isComplete(this.level.id) ? [] : (this.level.outro || []);
            if (outro.length) game.dialog = new Dialog(outro, () => this.finishStage(game));
            else this.finishStage(game);
        });
    },

    /**
     * Record progress and show the results
     */
    finishStage(game) {
        const level = this.level;
        const firstTime = !CampaignSave.isComplete(level.id);
        CampaignSave.markComplete(level.id);

        const gains = [];
        if (firstTime) {
            gains.push(`${notesInStage(level)} notes came home. ${CampaignSave.notesHome()} of ${NOTES_IN_THE_PIANO} are back.`);
            if (level.road) gains.push(level.road);
        }
        if (level.reward && firstTime) {
            if (typeof level.reward === 'string') {
                CampaignSave.addReward(level.reward);
                const reward = REWARDS[level.reward];
                gains.push(`${reward.name}: ${reward.text}`);
            } else if (level.reward.melody) {
                CampaignSave.unlock(level.reward.melody);
                const melody = HARMONY_CONFIG.MELODIES[level.reward.melody];
                gains.push(`New melody, ${melody.label}: ${Prompts.tune(melody.keys)}. ${melody.effect}.`);
            }
        }

        game.gameState = GAME_STATES.GAME_OVER;

        // The music has only just come back, so at the very end it keeps on playing
        const isFinal = level.id === '4-B';
        if (isFinal) {
            const save = CampaignSave.get();
            save.finished = true;
            CampaignSave.store();
        } else {
            window.audioSystem.stopMusic();
        }

        const seconds = Math.round((game.clock - game.gameStartTime) / 1000);
        window.menu.showResults({
            title: isFinal ? 'The Old Grand sings again' : `${level.name} complete`,
            killsLabel: 'Tuned',
            tone: 'win',
            subtitle: isFinal
                ? 'Thank you for playing The 89th Key.'
                : `${level.world.name}  -  ${seconds}s  -  ${CAMPAIGN_CONFIG.DIFFICULTY[this.difficulty].label}`,
            gains,
            rows: game.statsRows(),
            buttons: [
                { icon: isFinal ? 'map' : 'play', label: isFinal ? 'Back to the map' : 'Continue the road', primary: true, action: () => window.menu.showWorldMap() },
                { icon: 'restart', label: 'Play again', action: () => this.restartLevel(game) }
            ]
        });
    },

    fail(game, reason) {
        if (this.finished) return;
        this.finished = true;
        game.gameEnding = true;
        game.after(1000, () => {
            game.gameState = GAME_STATES.GAME_OVER;
            window.audioSystem.stopMusic();
            window.menu.showResults({
                title: 'The music stopped',
                tone: 'lose',
                subtitle: reason,
                killsLabel: 'Tuned',
                rows: game.statsRows(),
                buttons: [
                    { icon: 'restart', label: 'Try again', primary: true, action: () => this.restartLevel(game) },
                    { icon: 'map', label: 'Back to the map', action: () => window.menu.showWorldMap() }
                ]
            });
        });
    },

    restartLevel(game) {
        // Reset all controls to clear any stuck keys
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }

        // Clear active controls to ensure clean state
        game.activeControls.clear();

        this.initializeLevel(game);
    },

    hudInfo(game) {
        const { objective } = this.level;
        let detail;
        if (objective.type === 'clear') {
            detail = this.enemyList.filter(enemy => enemy.isAlive).length;
        } else if (objective.type === 'collect') {
            detail = `${this.notes.filter(note => note.taken).length}/${this.notes.length}`;
        } else if (objective.type === 'survive' || objective.type === 'defend') {
            detail = this.beatsLeft;
        }
        return {
            title: `${this.level.id}  ${this.level.name}`,
            icon: OBJECTIVE_ICONS[objective.type],
            detail,
            text: objective.text,
            spares: this.spares
        };
    },

    /**
     * Where the player should be heading, for the arrow at the edge of the screen
     */
    objectivePoint(game) {
        const { type } = this.level.objective;
        if (type === 'reach' && this.goalTiles.length) {
            const tile = this.goalTiles[0];
            return { x: (tile.c + 0.5) * WORLD.TILE, y: (tile.r + 0.5) * WORLD.TILE };
        }
        if (type === 'collect') {
            const leader = game.cameraTarget();
            const open = this.notes.filter(note => !note.taken);
            if (!leader || !open.length) return null;
            return open.reduce((best, note) => (distanceBetween(note, leader) < distanceBetween(best, leader) ? note : best));
        }
        if (type === 'clear') {
            const leader = game.cameraTarget();
            const open = this.enemyList.filter(enemy => enemy.isAlive);
            if (!leader || !open.length) return null;
            return open.reduce((best, enemy) => (distanceBetween(enemy, leader) < distanceBetween(best, leader) ? enemy : best));
        }
        return null;
    }
};

window.CampaignSave = CampaignSave;
window.modeManager.register(GAME_MODES.CAMPAIGN, CampaignMode);

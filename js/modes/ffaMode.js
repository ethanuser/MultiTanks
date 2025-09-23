// =============================================================================
// FFA MODE
// =============================================================================

const FFAMode = {
    key: GAME_MODES.FFA,
    musicTrack(game) {
        return 'ffa.mp3';
    },
    assignTeams(game) {
        // No teams in FFA
        game.teams = { red: [], blue: [] };
    },
    calculateSpawnPositions(game) {
        const positions = [];
        const edge = GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE;
        const width = GAME_CONFIG.MAP_WIDTH;
        const height = GAME_CONFIG.MAP_HEIGHT;
        const totalTanks = game.numPlayers + game.numAIBots;
        if (totalTanks <= 4) {
            const cornerPositions = [
                { x: edge, y: edge },
                { x: width - edge, y: edge },
                { x: width - edge, y: height - edge },
                { x: edge, y: height - edge },
            ];
            for (let i = 0; i < totalTanks; i++) positions.push(cornerPositions[i]);
            return positions;
        }
        const perimeterPoints = [];
        for (let x = edge; x <= width - edge; x += 20) perimeterPoints.push({ x, y: edge });
        for (let y = edge; y <= height - edge; y += 20) perimeterPoints.push({ x: width - edge, y });
        for (let x = width - edge; x >= edge; x -= 20) perimeterPoints.push({ x, y: height - edge });
        for (let y = height - edge; y >= edge; y -= 20) perimeterPoints.push({ x: edge, y });
        const step = Math.floor(perimeterPoints.length / totalTanks);
        for (let i = 0; i < totalTanks; i++) positions.push(perimeterPoints[(i * step) % perimeterPoints.length]);
        return positions;
    },
    checkGameEnd(game) {
        const aliveTanks = game.tanks.filter(t => t.isAlive);
        if (aliveTanks.length <= 1) game.endGame();
    },
    hudInfo(game) {
        const aliveTanks = game.tanks.filter(t => t.isAlive).length;
        return { lines: [`Players: ${game.numPlayers} | AI: ${game.numAIBots}`, `Alive: ${aliveTanks}`, 'Mode: FFA'] };
    },
    
    /**
     * Handle bullet vs tank collisions for FFA mode
     * @param {Object} game - Game instance
     * @param {Object} bullet - Bullet object
     * @param {number} bulletIndex - Index of bullet in bullets array
     * @param {Object} tank - Tank object
     * @returns {boolean} True if collision was handled
     */
    handleBulletTankCollision(game, bullet, bulletIndex, tank) {
        // Use common collision logic with FFA-specific options
        const deathSoundType = tank.isAI ? 'ai' : 'player';
        return game.collisions.handleBulletTankCollision(game, bullet, bulletIndex, tank, {
            skipFriendlyFire: false, // No friendly fire in FFA
            soundType: 'hit',
            deathSoundType: deathSoundType
        });
    },
    
    /**
     * Create a tank for FFA mode (no team assignment)
     * @param {Object} game - Game instance
     * @param {Object} position - Spawn position
     * @param {number} playerIndex - Player index (0-7)
     * @param {boolean} isAI - Whether this is an AI bot
     * @returns {Object} Tank object
     */
    createTank(game, position, playerIndex, isAI) {
        const tank = {
            id: playerIndex,
            x: position.x,
            y: position.y,
            angle: Math.random() * Math.PI * 2, // Random initial rotation
            turretAngle: 0,
            health: GAME_CONFIG.TANK_HEALTH,
            maxHealth: GAME_CONFIG.TANK_HEALTH,
            color: TANK_COLORS[playerIndex % TANK_COLORS.length],
            isAI: isAI,
            team: null, // No teams in FFA
            name: isAI ? `Bot ${playerIndex - game.numPlayers + 1}` : `Player ${playerIndex + 1}`,
            lastShot: 0,
            size: GAME_CONFIG.TANK_SIZE,
            speed: GAME_CONFIG.TANK_SPEED,
            turretLength: GAME_CONFIG.TURRET_LENGTH,
            turretRotationSpeed: GAME_CONFIG.TURRET_ROTATION_SPEED,
            isAlive: true,
            
            // Statistics
            shotsFired: 0,
            shotsHit: 0,
            kills: 0,
            deaths: 0,
            timeAlive: 0,
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
            aiTarget: null,
            aiState: 'patrol', // 'patrol', 'chase', 'attack'
            aiTimer: 0,
            aiDirection: Math.random() * Math.PI * 2,
            aiOrbitDirection: Math.random() < 0.5 ? 1 : -1, // 1 for clockwise, -1 for counterclockwise
            aiOrbitAngle: 0, // Current orbit angle around target
            aiRetreatEndTime: 0, // When to stop retreating
            aiLastTargetX: 0, // Last known target X position for movement tracking
            aiLastTargetY: 0, // Last known target Y position for movement tracking
            aiTargetVelocityX: 0, // Target's X velocity
            aiTargetVelocityY: 0, // Target's Y velocity
            aiPowerupChaseStartTime: 0, // When AI started chasing current powerup
            aiCurrentPowerupId: null, // ID of powerup currently being chased
            aiPowerupCooldownEndTime: 0 // When AI can start chasing powerups again
        };
        
        // Initialize statistics
        game.playerStats.set(tank.id, {
            name: tank.name,
            isAI: tank.isAI,
            team: tank.team,
            shotsFired: 0,
            shotsHit: 0,
            enemyHits: 0,
            kills: 0,
            deaths: 0,
            timeAlive: 0,
            deathTime: 0,
            killedBy: null,
            killsList: [],
            killedByList: [],
            powerupsCollected: 0
        });
        
        return tank;
    }
};

window.modeManager.register(GAME_MODES.FFA, FFAMode);



// =============================================================================
// TDM MODE
// =============================================================================

const TDMMode = {
    key: GAME_MODES.TDM,
    musicTrack(game) {
        return 'tdm.mp3';
    },
    assignTeams(game) {
        game.teams = { red: [], blue: [] };
        // Players
        for (let i = 0; i < game.numPlayers; i++) {
            const team = game.teamAssignments[i] || (i % 2 === 0 ? 'red' : 'blue');
            game.teams[team].push(i);
        }
        // AIs (respect provided distribution if any) - assign by indices only
        if (game.numAIBots > 0) {
            let desiredRed = 0;
            let desiredBlue = 0;
            if (game.aiTeamDistribution) {
                // Clamp desired counts to total bots
                desiredRed = Math.max(0, Math.min(game.aiTeamDistribution.red || 0, game.numAIBots));
                desiredBlue = Math.max(0, Math.min(game.aiTeamDistribution.blue || 0, game.numAIBots - desiredRed));
                // If sum is short, fill remainder to the smaller side to avoid off-by-one
                const remaining = game.numAIBots - (desiredRed + desiredBlue);
                if (remaining > 0) {
                    if (desiredRed <= desiredBlue) desiredRed += remaining; else desiredBlue += remaining;
                }
            } else {
                // Default even split
                desiredRed = Math.floor(game.numAIBots / 2);
                desiredBlue = game.numAIBots - desiredRed;
            }
            let redAssigned = 0, blueAssigned = 0;
            for (let i = 0; i < game.numAIBots; i++) {
                const idx = game.numPlayers + i;
                let team;
                if (redAssigned < desiredRed) {
                    team = 'red';
                    redAssigned++;
                } else if (blueAssigned < desiredBlue) {
                    team = 'blue';
                    blueAssigned++;
                } else {
                    // Fallback (shouldn't happen) - balance by current totals
                    team = (redAssigned <= blueAssigned) ? 'red' : 'blue';
                    if (team === 'red') redAssigned++; else blueAssigned++;
                }
                game.teams[team].push(idx);
            }
        }
    },
    calculateSpawnPositions(game) {
        const positions = [];
        const edge = GAME_CONFIG.SPAWN_DISTANCE_FROM_EDGE;
        const width = GAME_CONFIG.MAP_WIDTH;
        const height = GAME_CONFIG.MAP_HEIGHT;
        const leftPositions = this._sidePositions('left', game.teams.red.length, edge, width, height);
        const rightPositions = this._sidePositions('right', game.teams.blue.length, edge, width, height);
        game.teams.red.forEach((tankIndex, i) => { positions[tankIndex] = leftPositions[i]; });
        game.teams.blue.forEach((tankIndex, i) => { positions[tankIndex] = rightPositions[i]; });
        return positions;
    },
    _sidePositions(side, count, edge, width, height) {
        const positions = [];
        const x = side === 'left' ? edge : width - edge;
        const spacing = (height - 2 * edge) / Math.max(1, count - 1);
        for (let i = 0; i < count; i++) positions.push({ x, y: edge + (i * spacing) });
        return positions;
    },
    checkGameEnd(game) {
        const redAlive = game.tanks.filter(t => t.isAlive && t.team === 'red').length;
        const blueAlive = game.tanks.filter(t => t.isAlive && t.team === 'blue').length;
        if (redAlive === 0 || blueAlive === 0) game.endGame();
    },
    hudInfo(game) {
        const redAlive = game.tanks.filter(t => t.isAlive && t.team === 'red').length;
        const blueAlive = game.tanks.filter(t => t.isAlive && t.team === 'blue').length;
        return { lines: [`Red Team: ${redAlive}`, `Blue Team: ${blueAlive}`, 'Mode: TDM'] };
    },
    
    /**
     * Handle bullet vs tank collisions for TDM mode
     * @param {Object} game - Game instance
     * @param {Object} bullet - Bullet object
     * @param {number} bulletIndex - Index of bullet in bullets array
     * @param {Object} tank - Tank object
     * @returns {boolean} True if collision was handled
     */
    handleBulletTankCollision(game, bullet, bulletIndex, tank) {
        // Define friendly fire check for TDM mode
        const friendlyFireCheck = (game, bullet, tank) => {
            const bulletOwner = game.tanks.find(t => t.id === bullet.ownerId);
            return bulletOwner && bulletOwner.team === tank.team;
        };
        
        // Use common collision logic with TDM-specific options
        const deathSoundType = tank.isAI ? 'ai' : 'player';
        return game.collisions.handleBulletTankCollision(game, bullet, bulletIndex, tank, {
            skipFriendlyFire: true,
            friendlyFireCheck: friendlyFireCheck,
            soundType: 'hit',
            deathSoundType: deathSoundType
        });
    },
    
    /**
     * Create a tank with TDM-specific team assignment
     * @param {Object} game - Game instance
     * @param {Object} position - Spawn position
     * @param {number} playerIndex - Player index (0-7)
     * @param {boolean} isAI - Whether this is an AI bot
     * @returns {Object} Tank object
     */
    createTank(game, position, playerIndex, isAI) {
        // Determine team for TDM mode
        let tankTeam = null;
        let tankColor = TANK_COLORS[playerIndex % TANK_COLORS.length];
        let name = isAI ? `Bot ${playerIndex - game.numPlayers + 1}` : `Player ${playerIndex + 1}`;
        
        if (isAI) {
            // For AI, determine team based on distribution
            const aiIndex = playerIndex - game.numPlayers;
            let redAICount = 0;
            let blueAICount = 0;
            
            if (game.aiTeamDistribution) {
                redAICount = game.aiTeamDistribution.red;
                blueAICount = game.aiTeamDistribution.blue;
            } else {
                // Default distribution
                redAICount = Math.floor(game.numAIBots / 2);
                blueAICount = Math.ceil(game.numAIBots / 2);
            }
            
            tankTeam = aiIndex < redAICount ? 'red' : 'blue';
        } else {
            // For players, use custom assignment or default
            tankTeam = game.teamAssignments[playerIndex] || (playerIndex % 2 === 0 ? 'red' : 'blue');
        }
        tankColor = GAME_CONFIG.TEAM_COLORS[tankTeam.toUpperCase()];
        
        const tank = {
            id: playerIndex,
            x: position.x,
            y: position.y,
            angle: Math.random() * Math.PI * 2, // Random initial rotation
            turretAngle: 0,
            health: GAME_CONFIG.TANK_HEALTH,
            maxHealth: GAME_CONFIG.TANK_HEALTH,
            color: tankColor,
            isAI: isAI,
            team: tankTeam,
            name: name,
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

window.modeManager.register(GAME_MODES.TDM, TDMMode);



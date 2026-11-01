// =============================================================================
// TDM MODE
// =============================================================================

const TDMMode = {
    key: GAME_MODES.TDM,
    song: 'arenaTeams',
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
                // Fill in behind the humans so the teams come out even
                const total = game.numPlayers + game.numAIBots;
                desiredRed = Math.max(0, Math.min(game.numAIBots, Math.ceil(total / 2) - game.teams.red.length));
                desiredBlue = game.numAIBots - desiredRed;
            }
            for (let i = 0; i < game.numAIBots; i++) {
                game.teams[i < desiredRed ? 'red' : 'blue'].push(game.numPlayers + i);
            }
        }
    },
    calculateSpawnPositions(game) {
        const positions = [];
        const leftPositions = this._sidePositions(game.map, 'left', game.teams.red.length);
        const rightPositions = this._sidePositions(game.map, 'right', game.teams.blue.length);
        game.teams.red.forEach((tankIndex, i) => { positions[tankIndex] = leftPositions[i]; });
        game.teams.blue.forEach((tankIndex, i) => { positions[tankIndex] = rightPositions[i]; });
        game.map.fields.clear();
        return positions;
    },
    _sidePositions(map, side, count) {
        const positions = [];
        const c = side === 'left' ? 2 : map.cols - 3;
        for (let i = 0; i < count; i++) {
            const r = Math.round(2 + (i + 0.5) * (map.rows - 4) / count);
            map.clearAround(c, r, 1);
            positions.push({ x: (c + 0.5) * WORLD.TILE, y: (r + 0.5) * WORLD.TILE });
        }
        return positions;
    },
    checkGameEnd(game) {
        const redAlive = game.tanks.filter(t => t.isAlive && !t.isBuddy && t.team === 'red').length;
        const blueAlive = game.tanks.filter(t => t.isAlive && !t.isBuddy && t.team === 'blue').length;
        if (redAlive === 0 || blueAlive === 0) game.endGame();
    },
    hudInfo(game) {
        const redAlive = game.tanks.filter(t => t.isAlive && !t.isBuddy && t.team === 'red').length;
        const blueAlive = game.tanks.filter(t => t.isAlive && !t.isBuddy && t.team === 'blue').length;
        return { title: 'Team Battle', icon: 'tank', detail: `${redAlive} : ${blueAlive}` };
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
        const team = game.teams.red.includes(playerIndex) ? 'red' : 'blue';
        return game.createTank({
            id: playerIndex,
            x: position.x,
            y: position.y,
            palette: GAME_CONFIG.TEAM_PALETTES[team],
            isAI: isAI,
            isPlayer: !isAI,
            team,
            name: isAI ? `Bot ${playerIndex - game.numPlayers + 1}` : `Player ${playerIndex + 1}`
        });
    }
};

window.modeManager.register(GAME_MODES.TDM, TDMMode);

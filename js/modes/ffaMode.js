// =============================================================================
// FFA MODE
// =============================================================================

const FFAMode = {
    key: GAME_MODES.FFA,
    song: 'arenaFree',
    musicTrack(game) {
        return 'ffa.mp3';
    },
    assignTeams(game) {
        // No teams in FFA
        game.teams = { red: [], blue: [] };
    },
    calculateSpawnPositions(game) {
        return arenaSpawnPoints(game.map, game.numPlayers + game.numAIBots);
    },
    checkGameEnd(game) {
        const aliveTanks = game.tanks.filter(t => t.isAlive && !t.isBuddy);
        if (aliveTanks.length <= 1) game.endGame();
    },
    hudInfo(game) {
        const aliveTanks = game.tanks.filter(t => t.isAlive && !t.isBuddy).length;
        return { title: 'Free For All', icon: 'tank', detail: aliveTanks };
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
        return game.createTank({
            id: playerIndex,
            x: position.x,
            y: position.y,
            palette: TANK_PALETTE_ORDER[playerIndex % TANK_PALETTE_ORDER.length],
            isAI: isAI,
            isPlayer: !isAI,
            name: isAI ? `Bot ${playerIndex - game.numPlayers + 1}` : `Player ${playerIndex + 1}`
        });
    }
};

window.modeManager.register(GAME_MODES.FFA, FFAMode);

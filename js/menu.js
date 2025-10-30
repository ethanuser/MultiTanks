// =============================================================================
// MENU SYSTEM
// =============================================================================
// Handles main menu, player selection, and MIDI device connection

class MenuSystem {
    constructor() {
        this.currentScreen = 'main'; // 'main', 'playerSelect', 'game'
        this.selectedGameMode = GAME_MODES.FFA;
        this.selectedPlayers = 1;
        this.selectedAIBots = 3;
        this.midiConnected = false;
        this.menuElement = null;
        this.gameElement = null;
        this.teamAssignments = {}; // Store team assignments for TDM
        
        // Campaign settings
        this.selectedCampaignLevel = 1;
        this.selectedCampaignDifficulty = 'MEDIUM';
    }

    /**
     * Initialize the menu system
     */
    initialize() {
        this.createMenuHTML();
        this.setupEventListeners();
        this.updateMIDIStatus();
        // Set default dropdown selections (1 player, 3 bots)
        const playerCountSelect = document.getElementById('playerCount');
        const aiBotCountSelect = document.getElementById('aiBotCount');
        if (playerCountSelect) playerCountSelect.value = String(this.selectedPlayers);
        if (aiBotCountSelect) aiBotCountSelect.value = String(this.selectedAIBots);
        
        // Initialize keyboard fallback by default
        this.initializeKeyboardFallback();
        
        this.updateStartButton();
        this.updateAudioButtonStates();
        // Defer menu music until first user gesture (autoplay policy)
        const startMenuMusicOnce = async () => {
            if (!window.audioSystem) return;
            await window.audioSystem.resume();
            window.audioSystem.playMusic('menu.mp3');
            window.removeEventListener('pointerdown', startMenuMusicOnce);
            window.removeEventListener('keydown', startMenuMusicOnce);
        };
        window.addEventListener('pointerdown', startMenuMusicOnce, { once: true });
        window.addEventListener('keydown', startMenuMusicOnce, { once: true });
    }

    /**
     * Create the menu HTML structure
     */
    createMenuHTML() {
        const body = document.body;
        body.innerHTML = `
            <style>
                .campaign-options {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .campaign-option {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                
                .campaign-option label {
                    font-weight: bold;
                    color: #e6edf3;
                }
                
                .campaign-option input[type="checkbox"] {
                    margin-right: 8px;
                    transform: scale(1.2);
                }
                
                .campaign-option select {
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #444;
                    background: #2a2a2a;
                    color: #e6edf3;
                    font-size: 14px;
                }
                
                .campaign-instructions {
                    margin-top: 20px;
                    padding: 15px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    border-left: 4px solid #2196f3;
                }
                
                .campaign-instructions h3 {
                    color: #2196f3;
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                
                .campaign-instructions ul {
                    margin: 0;
                    padding-left: 20px;
                    color: #e6edf3;
                }
                
                .campaign-instructions li {
                    margin-bottom: 8px;
                    line-height: 1.4;
                }
            </style>
            <div id="menuContainer" class="menu-container">
                <div class="menu-content">
                    <h1 class="game-title">MultiTanks!</h1>
                    <p class="game-subtitle">MIDI-Controlled Tank Battle</p>
                    
                    <!-- Main Menu -->
                    <div id="mainMenu" class="menu-screen active">
                        <div class="menu-section">
                            <h2>🎹 Input Device</h2>
                            <div class="midi-status" id="midiStatus">
                                <p>Checking input support...</p>
                            </div>
                            <button id="connectMidiBtn" class="menu-btn primary">Connect MIDI Device</button>
                            <div class="input-info" id="inputInfo" style="display: none;">
                                <p class="input-method" id="inputMethod"></p>
                                <p class="input-instructions" id="inputInstructions"></p>
                            </div>
                        </div>
                        
                        <div class="menu-section">
                            <h2>Game Mode</h2>
                            <div class="game-mode-selector">
                                <label for="gameMode">Select Game Mode:</label>
                                <select id="gameMode" class="player-select">
                                    <option value="${GAME_MODES.FFA}">Free For All (FFA)</option>
                                    <option value="${GAME_MODES.TDM}">Team Deathmatch (TDM)</option>
                                    <option value="${GAME_MODES.CAMPAIGN}">Campaign Mode</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="menu-section">
                            <h2>🎮 Controls</h2>
                            <div class="controls-info" id="controlsInfo">
                                <div class="control-group" id="midiControls">
                                    <h3>MIDI Keyboard</h3>
                                    <div class="control-subgroup">
                                        <h4>Left Hand (Movement)</h4>
                                        <div class="control-item">A# - Move Up</div>
                                        <div class="control-item">A - Move Left</div>
                                        <div class="control-item">B - Move Down</div>
                                        <div class="control-item">C - Move Right</div>
                                    </div>
                                    <div class="control-subgroup">
                                        <h4>Right Hand (Turret)</h4>
                                        <div class="control-item">C# - Aim Left</div>
                                        <div class="control-item">D# - Aim Right</div>
                                        <div class="control-item">D - Shoot</div>
                                    </div>
                                </div>
                                <div class="control-group" id="keyboardControls" style="display: none;">
                                    <h3>Keyboard (WASD + Arrow Keys)</h3>
                                    <div class="control-subgroup">
                                        <h4>Movement</h4>
                                        <div class="control-item">W / ↑ - Move Up</div>
                                        <div class="control-item">A / ← - Move Left</div>
                                        <div class="control-item">S / ↓ - Move Down</div>
                                        <div class="control-item">D / → - Move Right</div>
                                    </div>
                                    <div class="control-subgroup">
                                        <h4>Turret & Shooting</h4>
                                        <div class="control-item">← - Aim Left</div>
                                        <div class="control-item">→ - Aim Right</div>
                                        <div class="control-item">Space - Shoot</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="menu-section" id="playerSelectionSection">
                            <h2>👥 Player Selection</h2>
                            <div class="player-selector">
                                <label for="playerCount">Number of Players:</label>
                                <select id="playerCount" class="player-select">
                                    <option value="0">0 Players</option>
                                    <option value="1">1 Player</option>
                                    <option value="2">2 Players</option>
                                    <option value="3">3 Players</option>
                                    <option value="4">4 Players</option>
                                </select>
                            </div>
                            
                            <div class="player-selector">
                                <label for="aiBotCount">Number of AI Bots:</label>
                                <select id="aiBotCount" class="player-select">
                                    <option value="0">0 AI Bots</option>
                                    <option value="1">1 AI Bot</option>
                                    <option value="2">2 AI Bots</option>
                                    <option value="3">3 AI Bots</option>
                                    <option value="4">4 AI Bots</option>
                                    <option value="5">5 AI Bots</option>
                                    <option value="6">6 AI Bots</option>
                                    <option value="7">7 AI Bots</option>
                                    <option value="8">8 AI Bots</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Campaign Mode Settings -->
                        <div class="menu-section" id="campaignSettings" style="display: none;">
                            <h2>🎯 Campaign Settings</h2>
                            
                            <div class="player-selector">
                                <label for="campaignPlayerCount">Number of Players:</label>
                                <select id="campaignPlayerCount" class="player-select">
                                    <option value="0">0 Players (AI Only)</option>
                                    <option value="1" selected>1 Player</option>
                                    <option value="2">2 Players</option>
                                    <option value="3">3 Players</option>
                                    <option value="4">4 Players</option>
                                </select>
                            </div>
                            
                            <div class="player-selector">
                                <label for="campaignAIBotCount">Number of AI Allies:</label>
                                <select id="campaignAIBotCount" class="player-select">
                                    <option value="0">0 AI Allies</option>
                                    <option value="1">1 AI Ally</option>
                                    <option value="2">2 AI Allies</option>
                                    <option value="3">3 AI Allies</option>
                                    <option value="4">4 AI Allies</option>
                                    <option value="5">5 AI Allies</option>
                                    <option value="6">6 AI Allies</option>
                                    <option value="7">7 AI Allies</option>
                                    <option value="8">8 AI Allies</option>
                                </select>
                            </div>
                            
                            <div class="player-selector">
                                <label for="campaignLevel">Select Level:</label>
                                <select id="campaignLevel" class="player-select">
                                    <option value="1">Level 1</option>
                                    <option value="2">Level 2</option>
                                    <option value="3">Level 3</option>
                                    <option value="4">Level 4</option>
                                    <option value="5">Level 5</option>
                                </select>
                            </div>
                            
                            <div class="player-selector">
                                <label for="campaignDifficulty">Difficulty:</label>
                                <select id="campaignDifficulty" class="player-select">
                                    <option value="EASY">Easy</option>
                                    <option value="MEDIUM" selected>Medium</option>
                                    <option value="HARD">Hard</option>
                                </select>
                            </div>
                            
                            <div class="campaign-instructions">
                                <h3>📋 Campaign Instructions</h3>
                                <ul>
                                    <li>🎯 <strong>Objective:</strong> Eliminate all enemies to complete each level</li>
                                    <li>🤖 <strong>AI Allies:</strong> Fight alongside you against enemy forces</li>
                                    <li>🎮 <strong>Controls:</strong> Use MIDI keyboard or WASD + Arrow keys</li>
                                    <li>💪 <strong>Power-ups:</strong> Collect stars for special abilities</li>
                                    <li>🏆 <strong>Progression:</strong> Complete all 5 levels to win the campaign</li>
                                    <li>⚔️ <strong>Enemy Types:</strong> Chasers, Spread Shooters, Turrets, and Bosses</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="menu-section">
                            <button id="startGameBtn" class="menu-btn start" disabled>Start Game</button>
                            <div class="audio-controls">
                                <button id="musicToggleBtn" class="menu-btn secondary">🎵 Music: ON</button>
                                <button id="sfxToggleBtn" class="menu-btn secondary">🔊 SFX: ON</button>
                            </div>
                        </div>

                        <!-- Music Attribution -->
                        <div class="menu-section" id="musicAttribution">
                            <h2>🎼 Music Attribution</h2>
                            <ul style="text-align: left; margin: 0 auto; max-width: 640px; line-height: 1.5; color: #e6edf3;">
                                <li><strong>FFA</strong>: "Battlefield" from Super Smash Bros. Brawl</li>
                                <li><strong>TDM</strong>: "Final Destination" from Super Smash Bros. Brawl</li>
                                <li><strong>Menu</strong>: "Main Menu" from Super Smash Bros. Ultimate</li>
                                <li><strong>Levels 1–5</strong>: "Balatro Theme" (from Balatro)</li>
                                <li><strong>Victory</strong>: "Fire Emblem Theme" (arrangement from Super Smash Bros. Brawl)</li>
                            </ul>
                            <p style="margin-top: 10px; font-size: 12px; color: #b0b8c1;">All rights belong to their respective owners. This project is a non-commercial fan work with attribution.</p>
                        </div>
                    </div>
                    
                    <!-- Player Select Screen -->
                    <div id="playerSelectScreen" class="menu-screen">
                        <h2>Player Assignment</h2>
                        <div id="playerAssignment" class="player-assignment">
                            <!-- Player assignments will be generated here -->
                        </div>
                        <button id="confirmPlayersBtn" class="menu-btn primary">Confirm & Start</button>
                        <button id="backToMainBtn" class="menu-btn secondary">Back to Main Menu</button>
                    </div>
                </div>
                
                <!-- Game Canvas (hidden initially) -->
                <canvas id="gameCanvas" class="game-canvas hidden"></canvas>
            </div>
        `;
        
        this.menuElement = document.getElementById('menuContainer');
        this.gameElement = document.getElementById('gameCanvas');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // MIDI connection
        document.getElementById('connectMidiBtn').addEventListener('click', () => {
            this.connectMIDI();
        });
        
        // Player count selection
        document.getElementById('playerCount').addEventListener('change', (e) => {
            this.selectedPlayers = parseInt(e.target.value);
            this.updatePlayerSelectionUI();
            this.updateStartButton();
        });
        
        // AI bot count selection
        document.getElementById('aiBotCount').addEventListener('change', (e) => {
            this.selectedAIBots = parseInt(e.target.value);
            this.updateStartButton();
        });
        
        // Game mode selection
        document.getElementById('gameMode').addEventListener('change', (e) => {
            this.selectedGameMode = e.target.value;
            this.updatePlayerSelectionUI();
            this.updateCampaignSettings();
            this.updateStartButton();
        });
        
        // Campaign settings
        document.getElementById('campaignPlayerCount').addEventListener('change', (e) => {
            this.selectedPlayers = parseInt(e.target.value);
            this.updateCampaignSettings();
            this.updateStartButton();
        });
        
        document.getElementById('campaignAIBotCount').addEventListener('change', (e) => {
            this.selectedAIBots = parseInt(e.target.value);
            this.updateStartButton();
        });
        
        // Initialize campaign settings to default values
        this.selectedPlayers = 1; // Default to 1 player for campaign
        this.selectedAIBots = 3; // Default to 3 AI allies for campaign
        
        document.getElementById('campaignLevel').addEventListener('change', (e) => {
            this.selectedCampaignLevel = parseInt(e.target.value);
        });
        
        document.getElementById('campaignDifficulty').addEventListener('change', (e) => {
            this.selectedCampaignDifficulty = e.target.value;
        });
        
        // Start game
        document.getElementById('startGameBtn').addEventListener('click', () => {
            if (this.selectedGameMode === GAME_MODES.CAMPAIGN) {
                // Skip player assignment for campaign mode
                this.startGame();
            } else {
                this.showPlayerAssignment();
            }
        });
        
        // Confirm players
        document.getElementById('confirmPlayersBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Back to main menu
        document.getElementById('backToMainBtn').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // Music toggle
        document.getElementById('musicToggleBtn').addEventListener('click', () => {
            this.toggleMusic();
        });
        
        // SFX toggle
        document.getElementById('sfxToggleBtn').addEventListener('click', () => {
            this.toggleSFX();
        });
    }

    /**
     * Helper to regenerate AI bot options based on max allowed
     */
    regenerateAIBotOptions(selectEl, maxBots, currentValue) {
        if (!selectEl) return;
        const clampedMax = Math.max(0, maxBots);
        let optionsHTML = '';
        for (let i = 0; i <= clampedMax; i++) {
            optionsHTML += `<option value="${i}">${i} AI ${i === 1 ? 'Bot' : 'Bots'}</option>`;
        }
        selectEl.innerHTML = optionsHTML;
        const clampedValue = Math.max(0, Math.min(currentValue, clampedMax));
        selectEl.value = String(clampedValue);
    }

    /**
     * Connect to MIDI device
     */
    async connectMIDI() {
        const statusElement = document.getElementById('midiStatus');
        const connectBtn = document.getElementById('connectMidiBtn');
        
        try {
            statusElement.innerHTML = '<p>Connecting to MIDI device...</p>';
            connectBtn.disabled = true;
            
            const success = await window.midiHandler.initialize(false); // Disable debug mode
            
            if (success) {
                this.updateInputDisplay();
                this.updateStartButton();
            } else {
                throw new Error('Failed to connect to any input device');
            }
        } catch (error) {
            this.midiConnected = false;
            statusElement.innerHTML = `<p style="color: #ff4444;">❌ Error: ${error.message}</p>`;
            connectBtn.disabled = false;
            this.updateStartButton();
        }
    }

    /**
     * Initialize keyboard fallback by default
     */
    initializeKeyboardFallback() {
        // Initialize MIDI handler with keyboard fallback
        window.midiHandler.initialize(false).then(() => {
            this.updateInputDisplay();
        });
    }

    /**
     * Update input display based on current input method
     */
    updateInputDisplay() {
        const statusElement = document.getElementById('midiStatus');
        const inputInfo = document.getElementById('inputInfo');
        const inputMethod = document.getElementById('inputMethod');
        const inputInstructions = document.getElementById('inputInstructions');
        const midiControls = document.getElementById('midiControls');
        const keyboardControls = document.getElementById('keyboardControls');
        const connectBtn = document.getElementById('connectMidiBtn');
        
        if (window.midiHandler.getConnectionStatus()) {
            const inputMethodText = window.midiHandler.getInputMethod();
            
            statusElement.innerHTML = `<p style="color: #4CAF50;">✅ ${inputMethodText}</p>`;
            inputInfo.style.display = 'block';
            inputMethod.textContent = `Input Method: ${inputMethodText}`;
            
            if (window.midiHandler.isConnected) {
                inputInstructions.textContent = `Connected to ${window.midiHandler.getDeviceCount()} MIDI device(s): ${window.midiHandler.getDeviceNames().join(', ')}`;
                midiControls.style.display = 'block';
                keyboardControls.style.display = 'none';
                connectBtn.textContent = 'MIDI Connected';
            } else {
                inputInstructions.textContent = 'Using keyboard fallback - only single player supported';
                midiControls.style.display = 'none';
                keyboardControls.style.display = 'block';
                connectBtn.textContent = 'Switch to MIDI';
            }
            
            connectBtn.disabled = false;
            this.midiConnected = window.midiHandler.isConnected;
            this.updatePlayerSelectionUI();
            // Ensure start button reflects current input method (keyboard fallback vs MIDI)
            this.updateStartButton();
        }
    }

    /**
     * Update MIDI status on page load
     */
    updateMIDIStatus() {
        const statusElement = document.getElementById('midiStatus');
        
        if (typeof WebMidi === 'undefined') {
            statusElement.innerHTML = '<p style="color: #ff4444;">❌ WebMidi.js not loaded - keyboard fallback available</p>';
        } else {
            statusElement.innerHTML = '<p>Ready to connect MIDI device or use keyboard</p>';
        }
    }

    /**
     * Update start button state
     */
    updateStartButton() {
        const startBtn = document.getElementById('startGameBtn');
        // Allow starting without MIDI when there are 0 human players OR when using keyboard fallback (1 player)
        const isKeyboardFallback = window.midiHandler && window.midiHandler.keyboardFallback;
        const canStartWithoutMidi = this.selectedPlayers === 0 || (this.selectedPlayers === 1 && isKeyboardFallback);
        startBtn.disabled = !(this.midiConnected || canStartWithoutMidi);
    }
    
    /**
     * Update audio button states based on current audio system state
     */
    updateAudioButtonStates() {
        if (window.audioSystem) {
            const musicButton = document.getElementById('musicToggleBtn');
            const sfxButton = document.getElementById('sfxToggleBtn');
            
            if (musicButton) {
                const musicEnabled = window.audioSystem.isMusicEnabled();
                musicButton.textContent = musicEnabled ? '🎵 Music: ON' : '🎵 Music: OFF';
            }
            
            if (sfxButton) {
                const sfxEnabled = window.audioSystem.isEnabled();
                sfxButton.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
            }
        }
    }
    
    /**
     * Update player selection UI based on game mode
     */
    updatePlayerSelectionUI() {
        const playerSection = document.getElementById('playerSelectionSection');
        const playerCountSelect = document.getElementById('playerCount');
        const aiBotCountSelect = document.getElementById('aiBotCount');
        
        // Check if using keyboard fallback (only supports 1 player)
        const isKeyboardFallback = window.midiHandler && window.midiHandler.keyboardFallback;
        
        if (isKeyboardFallback) {
            // Keyboard fallback: only allow 0-1 players
            playerCountSelect.innerHTML = `
                <option value="0">0 Players</option>
                <option value="1">1 Player</option>
            `;
            if (this.selectedPlayers > 1) {
                this.selectedPlayers = 1;
            }
        } else {
            // MIDI mode: allow 0–4 players
            playerCountSelect.innerHTML = `
                <option value="0">0 Players</option>
                <option value="1">1 Player</option>
                <option value="2">2 Players</option>
                <option value="3">3 Players</option>
                <option value="4">4 Players</option>
            `;
        }
        playerCountSelect.value = this.selectedPlayers;
        
        // Cap AI bots so that players + AI <= MAX_TOTAL_TANKS (default 8)
        const maxTotal = (window.GAME_CONFIG && window.GAME_CONFIG.MAX_TOTAL_TANKS) ? window.GAME_CONFIG.MAX_TOTAL_TANKS : 8;
        const maxAIBots = Math.max(0, maxTotal - this.selectedPlayers);
        this.regenerateAIBotOptions(aiBotCountSelect, maxAIBots, this.selectedAIBots);
        this.selectedAIBots = parseInt(aiBotCountSelect.value);
    }

    /**
     * Update campaign settings visibility
     */
    updateCampaignSettings() {
        const campaignSettings = document.getElementById('campaignSettings');
        const playerSection = document.getElementById('playerSelectionSection');
        
        if (this.selectedGameMode === GAME_MODES.CAMPAIGN) {
            campaignSettings.style.display = 'block';
            playerSection.style.display = 'none'; // Hide regular player selection for campaign
            
            // Set default values for campaign settings
            const campaignPlayerCount = document.getElementById('campaignPlayerCount');
            const campaignAIBotCount = document.getElementById('campaignAIBotCount');
            if (campaignPlayerCount) {
                campaignPlayerCount.value = this.selectedPlayers;
            }
            // Cap AI allies so that players + AI <= MAX_TOTAL_TANKS (default 8)
            const maxTotal = (window.GAME_CONFIG && window.GAME_CONFIG.MAX_TOTAL_TANKS) ? window.GAME_CONFIG.MAX_TOTAL_TANKS : 8;
            const maxAIs = Math.max(0, maxTotal - this.selectedPlayers);
            this.regenerateAIBotOptions(campaignAIBotCount, maxAIs, this.selectedAIBots);
            this.selectedAIBots = campaignAIBotCount ? parseInt(campaignAIBotCount.value) : this.selectedAIBots;
        } else {
            campaignSettings.style.display = 'none';
            playerSection.style.display = 'block';
        }
    }

    /**
     * Show player assignment screen
     */
    showPlayerAssignment() {
        document.getElementById('mainMenu').classList.remove('active');
        document.getElementById('playerSelectScreen').classList.add('active');
        
        this.generatePlayerAssignment();
    }

    /**
     * Generate player assignment display
     */
    generatePlayerAssignment() {
        const assignmentElement = document.getElementById('playerAssignment');
        assignmentElement.innerHTML = '';
        
        // Initialize team assignments
        this.teamAssignments = {};
        
        for (let i = 0; i < this.selectedPlayers; i++) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-assignment-item';
            
            // Default team assignment for TDM
            if (this.selectedGameMode === GAME_MODES.TDM) {
                this.teamAssignments[i] = i % 2 === 0 ? 'red' : 'blue';
            }
            
            const teamSelectHTML = this.selectedGameMode === GAME_MODES.TDM ? `
                <div class="team-selection">
                    <label>Team:</label>
                    <select class="team-select" data-player="${i}">
                        <option value="red" ${this.teamAssignments[i] === 'red' ? 'selected' : ''}>Red Team</option>
                        <option value="blue" ${this.teamAssignments[i] === 'blue' ? 'selected' : ''}>Blue Team</option>
                    </select>
                </div>
            ` : '';
            
            playerDiv.innerHTML = `
                <div class="player-info">
                    <div class="player-color" style="background-color: ${this.selectedGameMode === GAME_MODES.TDM ? GAME_CONFIG.TEAM_COLORS[this.teamAssignments[i].toUpperCase()] : TANK_COLORS[i]}"></div>
                    <div class="player-details">
                        <h3>Player ${i + 1}</h3>
                        <p>Octave ${i + 1} (Notes ${MIDI_CONFIG.OCTAVE_BASES[i]}-${MIDI_CONFIG.OCTAVE_BASES[i] + 6})</p>
                        ${teamSelectHTML}
                        <div class="player-controls">
                            <div class="control-note">A# (${getNoteForPlayer(i, 'A_SHARP')}) - Up</div>
                            <div class="control-note">A (${getNoteForPlayer(i, 'A')}) - Left</div>
                            <div class="control-note">B (${getNoteForPlayer(i, 'B')}) - Down</div>
                            <div class="control-note">C (${getNoteForPlayer(i, 'C')}) - Right</div>
                            <div class="control-note">C# (${getNoteForPlayer(i, 'C_SHARP')}) - Aim Left</div>
                            <div class="control-note">D# (${getNoteForPlayer(i, 'D_SHARP')}) - Aim Right</div>
                            <div class="control-note">D (${getNoteForPlayer(i, 'D')}) - Shoot</div>
                        </div>
                    </div>
                </div>
            `;
            assignmentElement.appendChild(playerDiv);
        }
        
        // Show AI info
        if (this.selectedAIBots > 0) {
            const aiDiv = document.createElement('div');
            aiDiv.className = 'player-assignment-item ai';
            
            const aiTeamSelectHTML = this.selectedGameMode === GAME_MODES.TDM ? `
                <div class="ai-team-selection">
                    <label>AI Team Distribution:</label>
                    <div class="ai-team-distribution">
                        <div class="team-dist">
                            <label>Red Team AIs:</label>
                            <input type="number" id="redAICount" min="0" max="${this.selectedAIBots}" value="${Math.floor(this.selectedAIBots / 2)}" class="ai-count-input">
                        </div>
                        <div class="team-dist">
                            <label>Blue Team AIs:</label>
                            <input type="number" id="blueAICount" min="0" max="${this.selectedAIBots}" value="${Math.ceil(this.selectedAIBots / 2)}" class="ai-count-input">
                        </div>
                    </div>
                </div>
            ` : '';
            
            aiDiv.innerHTML = `
                <div class="player-info">
                    <div class="player-color ai-color">🤖</div>
                    <div class="player-details">
                        <h3>AI Bots</h3>
                        <p>${this.selectedAIBots} AI-controlled tanks</p>
                        ${aiTeamSelectHTML}
                    </div>
                </div>
            `;
            assignmentElement.appendChild(aiDiv);
        }
        
        // Add event listeners for team selection
        if (this.selectedGameMode === GAME_MODES.TDM) {
            this.setupTeamSelectionListeners();
        }
    }
    
    /**
     * Setup team selection event listeners
     */
    setupTeamSelectionListeners() {
        // Player team selection
        document.querySelectorAll('.team-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const playerIndex = parseInt(e.target.dataset.player);
                this.teamAssignments[playerIndex] = e.target.value;
                
                // Update player color
                const playerDiv = e.target.closest('.player-assignment-item');
                const colorDiv = playerDiv.querySelector('.player-color');
                colorDiv.style.backgroundColor = GAME_CONFIG.TEAM_COLORS[e.target.value.toUpperCase()];
            });
        });
        
        // AI team distribution
        const redAICount = document.getElementById('redAICount');
        const blueAICount = document.getElementById('blueAICount');
        
        if (redAICount && blueAICount) {
            const updateAIDistribution = () => {
                const redCount = parseInt(redAICount.value) || 0;
                const blueCount = parseInt(blueAICount.value) || 0;
                const total = redCount + blueCount;
                
                if (total > this.selectedAIBots) {
                    // Adjust to not exceed total
                    if (redCount > blueCount) {
                        redAICount.value = this.selectedAIBots - blueCount;
                    } else {
                        blueAICount.value = this.selectedAIBots - redCount;
                    }
                }
            };
            
            redAICount.addEventListener('input', updateAIDistribution);
            blueAICount.addEventListener('input', updateAIDistribution);
        }
    }

    /**
     * Start the game
     */
    async startGame() {
        // Hide menu
        this.menuElement.classList.add('hidden');
        // Stop menu music before starting game
        if (window.audioSystem) {
            window.audioSystem.stopMusic();
        }
        
        // Create a new canvas element dynamically to ensure it's properly rendered
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'gameCanvas';
        newCanvas.className = 'game-canvas';
        newCanvas.width = window.innerWidth;
        newCanvas.height = window.innerHeight;
        newCanvas.style.width = window.innerWidth + 'px';
        newCanvas.style.height = window.innerHeight + 'px';
        
        // Remove old canvas if it exists
        const oldCanvas = document.getElementById('gameCanvas');
        if (oldCanvas) {
            oldCanvas.remove();
        }
        
        // Add new canvas to body
        document.body.appendChild(newCanvas);
        this.gameElement = newCanvas;
        
        // Force a reflow
        newCanvas.offsetHeight;
        
        // Get AI team distribution for TDM
        let aiTeamDistribution = null;
        if (this.selectedGameMode === GAME_MODES.TDM) {
            const redAICount = document.getElementById('redAICount');
            const blueAICount = document.getElementById('blueAICount');
            if (redAICount && blueAICount) {
                aiTeamDistribution = {
                    red: parseInt(redAICount.value) || 0,
                    blue: parseInt(blueAICount.value) || 0
                };
            }
        }
        
        // Persist last used settings for hot-restart (R)
        this.lastSettings = {
            gameMode: this.selectedGameMode,
            players: this.selectedPlayers,
            aiBots: this.selectedAIBots,
            teamAssignments: { ...this.teamAssignments },
            aiTeamDistribution: aiTeamDistribution,
            campaignLevel: this.selectedCampaignLevel,
            campaignDifficulty: this.selectedCampaignDifficulty
        };
        
        // Initialize game
        window.game = new MultiTanksGame();
        
        if (this.selectedGameMode === GAME_MODES.CAMPAIGN) {
            // Campaign mode initialization
            await window.game.initialize(this.gameElement, this.selectedPlayers, this.selectedAIBots, this.selectedGameMode, this.teamAssignments, aiTeamDistribution);
            
            // Set campaign-specific settings
            if (window.game.mode) {
                window.game.mode.currentLevel = this.selectedCampaignLevel;
                window.game.mode.difficulty = this.selectedCampaignDifficulty;
                window.game.mode.initializeLevel(window.game);
            }
        } else {
            // Regular mode initialization
            await window.game.initialize(this.gameElement, this.selectedPlayers, this.selectedAIBots, this.selectedGameMode, this.teamAssignments, aiTeamDistribution);
        }
        
        this.currentScreen = 'game';
    }

    /**
     * Restart with last used settings (used by R hotkey from menu)
     */
    async restartWithLastSettings() {
        if (!this.lastSettings) return;
        
        // Hide menu
        this.menuElement.classList.add('hidden');
        // Stop menu music before starting game
        if (window.audioSystem) {
            window.audioSystem.stopMusic();
        }
        
        // Create a new canvas element dynamically to ensure it's properly rendered
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'gameCanvas';
        newCanvas.className = 'game-canvas';
        newCanvas.width = window.innerWidth;
        newCanvas.height = window.innerHeight;
        newCanvas.style.width = window.innerWidth + 'px';
        newCanvas.style.height = window.innerHeight + 'px';
        
        // Remove old canvas if it exists
        const oldCanvas = document.getElementById('gameCanvas');
        if (oldCanvas) {
            oldCanvas.remove();
        }
        
        // Add new canvas to body
        document.body.appendChild(newCanvas);
        this.gameElement = newCanvas;
        
        // Force a reflow
        newCanvas.offsetHeight;
        
        // Reset controls
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }
        
        const s = this.lastSettings;
        window.game = new MultiTanksGame();
        
        if (s.gameMode === GAME_MODES.CAMPAIGN) {
            await window.game.initialize(this.gameElement, s.players, s.aiBots, s.gameMode, s.teamAssignments, s.aiTeamDistribution);
            if (window.game.mode) {
                window.game.mode.currentLevel = s.campaignLevel;
                window.game.mode.difficulty = s.campaignDifficulty;
                window.game.mode.initializeLevel(window.game);
            }
        } else {
            await window.game.initialize(this.gameElement, s.players, s.aiBots, s.gameMode, s.teamAssignments, s.aiTeamDistribution);
        }
        this.currentScreen = 'game';
    }

    /**
     * Show main menu
     */
    showMainMenu() {
        document.getElementById('playerSelectScreen').classList.remove('active');
        document.getElementById('mainMenu').classList.add('active');
        this.currentScreen = 'main';
    }

    /**
     * Toggle music on/off
     */
    toggleMusic() {
        if (window.audioSystem) {
            const enabled = window.audioSystem.toggleMusic();
            const button = document.getElementById('musicToggleBtn');
            button.textContent = enabled ? '🎵 Music: ON' : '🎵 Music: OFF';
        }
    }
    
    /**
     * Toggle SFX on/off
     */
    toggleSFX() {
        if (window.audioSystem) {
            const enabled = window.audioSystem.toggle();
            const button = document.getElementById('sfxToggleBtn');
            button.textContent = enabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
        }
    }

    /**
     * Return to menu from game
     */
    returnToMenu() {
        if (window.game) {
            window.game.stop();
            window.game = null;
        }
        
        // Reset all controls to clear any stuck keys
        if (window.midiHandler) {
            window.midiHandler.resetAllControls();
        }
        
        // Remove the canvas element
        if (this.gameElement) {
            this.gameElement.remove();
        }
        
        this.menuElement.classList.remove('hidden');
        this.showMainMenu();
    }
}

// =============================================================================
// CSS STYLES
// =============================================================================
const menuStyles = `
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            overflow: hidden;
            margin: 0;
            padding: 0;
        }
        
        .menu-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
        }
        
        .menu-content {
            background: rgba(0, 0, 0, 0.8);
            border-radius: 20px;
            padding: 40px;
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        
        .game-title {
            font-size: 3em;
            color: #4CAF50;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .game-subtitle {
            font-size: 1.2em;
            color: #ccc;
            margin-bottom: 30px;
        }
        
        .menu-screen {
            display: none;
        }
        
        .menu-screen.active {
            display: block;
        }
        
        .menu-section {
            margin: 30px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .menu-section h2 {
            color: #4CAF50;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        
        .midi-status {
            margin: 15px 0;
            padding: 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
        }
        
        .menu-btn {
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 10px;
            min-width: 150px;
        }
        
        .menu-btn.primary {
            background: #4CAF50;
            color: white;
        }
        
        .menu-btn.primary:hover:not(:disabled) {
            background: #45a049;
            transform: translateY(-2px);
        }
        
        .menu-btn.secondary {
            background: #666;
            color: white;
        }
        
        .menu-btn.secondary:hover {
            background: #777;
        }
        
        .menu-btn.start {
            background: #FF6B6B;
            color: white;
            font-size: 18px;
            padding: 20px 40px;
        }
        
        .menu-btn.start:hover:not(:disabled) {
            background: #ff5252;
            transform: translateY(-2px);
        }
        
        .menu-btn:disabled {
            background: #333;
            color: #666;
            cursor: not-allowed;
        }
        
        .audio-controls {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 15px;
        }
        
        .audio-controls .menu-btn {
            min-width: 120px;
        }
        
        .player-selector {
            margin: 15px 0;
        }
        
        .player-selector label {
            display: block;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .player-select {
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #666;
            background: #333;
            color: white;
            font-size: 16px;
        }
        
        .controls-info {
            display: flex;
            justify-content: center;
            margin-top: 15px;
        }
        
        .control-group {
            max-width: 400px;
            width: 100%;
        }
        
        .control-group h3 {
            color: #4CAF50;
            margin-bottom: 10px;
        }
        
        .control-subgroup {
            margin: 10px 0;
        }
        
        .control-subgroup h4 {
            color: #81C784;
            margin-bottom: 5px;
            font-size: 14px;
        }
        
        .control-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 8px;
            margin: 5px 0;
            border-radius: 5px;
            font-family: monospace;
        }
        
        .input-info {
            margin-top: 15px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
        }
        
        .input-method {
            font-weight: bold;
            color: #4CAF50;
            margin-bottom: 5px;
        }
        
        .input-instructions {
            font-size: 12px;
            color: #ccc;
        }
        
        .player-assignment {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .player-assignment-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .player-assignment-item.ai {
            border-color: #FF9800;
        }
        
        .player-info {
            display: flex;
            align-items: flex-start;
            gap: 15px;
        }
        
        .player-color {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        
        .ai-color {
            background: #FF9800;
        }
        
        .player-details h3 {
            color: #4CAF50;
            margin-bottom: 5px;
        }
        
        .player-details p {
            color: #ccc;
            margin-bottom: 10px;
        }
        
        .player-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
        }
        
        .control-note {
            background: rgba(0, 0, 0, 0.3);
            padding: 5px;
            border-radius: 3px;
            font-size: 12px;
            font-family: monospace;
        }
        
        .game-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw !important;
            height: 100vh !important;
            display: block !important;
            background-color: #2d5016;
            z-index: 1000;
            border: none;
            outline: none;
        }
        
        .hidden {
            display: none !important;
        }
        
        @media (max-width: 768px) {
            .menu-content {
                padding: 20px;
                width: 95%;
            }
            
            .game-title {
                font-size: 2em;
            }
            
            .controls-info {
                grid-template-columns: 1fr;
            }
            
            .player-assignment {
                grid-template-columns: 1fr;
            }
            
            .audio-controls {
                flex-direction: column;
                align-items: center;
            }
            
            .audio-controls .menu-btn {
                width: 100%;
                max-width: 200px;
            }
        }
    </style>
`;

// Add styles to document
document.head.insertAdjacentHTML('beforeend', menuStyles);

// =============================================================================
// GLOBAL MENU INSTANCE
// =============================================================================
window.menu = new MenuSystem();

// Global R hotkey to restart current game/level or relaunch last settings
(function setupGlobalRestartHotkey() {
    let lastRestartAt = 0;
    window.addEventListener('keydown', async (e) => {
        if ((e.key === 'r' || e.key === 'R') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const now = Date.now();
            if (now - lastRestartAt < 500) return; // debounce
            lastRestartAt = now;
            
            // Reset MIDI controls immediately
            if (window.midiHandler) {
                window.midiHandler.resetAllControls();
            }
            
            if (window.game) {
                // If campaign, restart current level with same difficulty
                if (window.game.gameMode === GAME_MODES.CAMPAIGN && window.game.mode && window.game.mode.restartLevel) {
                    window.game.mode.restartLevel(window.game);
                } else if (window.game.restartGame) {
                    // Regular modes: use built-in restart (preserves settings)
                    window.game.restartGame();
                }
            } else if (window.menu && window.menu.restartWithLastSettings) {
                // From menu: relaunch last settings
                window.menu.restartWithLastSettings();
            }
        }
    });
})();

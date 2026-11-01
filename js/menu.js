// =============================================================================
// MENU SYSTEM
// =============================================================================
// Handles the menus, match setup, results and MIDI device connection. Every menu
// can be driven with the mouse, the arrow keys or the piano itself.

/**
 * A plain interface icon. It takes the color of the text around it.
 */
function ic(name) {
    return `<i class="ic ic-${name}" aria-hidden="true"></i>`;
}

/**
 * A colored game icon as an image
 */
function picture(name, scale = 2) {
    return `<img class="px" src="${Sprites.toDataURL(Sprites.icon(name), scale)}" alt="">`;
}

/**
 * An icon-only button: its name is in a tooltip, and for screen readers
 */
function iconButton(icon, label, attributes = '', className = 'bar-button') {
    return `<button class="${className}" aria-label="${label}" data-tip="${label}" ${attributes}>${ic(icon)}</button>`;
}

class MenuSystem {
    constructor() {
        this.currentScreen = 'home'; // 'home', 'setup', 'campaign', 'map', 'controls', 'options', 'game'
        this.selectedGameMode = GAME_MODES.FFA;
        this.selectedPlayers = 1;
        this.selectedAIBots = 3;
        this.selectedBotSkill = 'NORMAL';
        this.selectedTheme = null;
        this.midiConnected = false;
        this.menuElement = null;
        this.gameElement = null;
        this.teamAssignments = {}; // Store team assignments for TDM
        this.botRedCount = null;   // How many bots are on red in TDM

        // Campaign settings
        this.selectedCampaignLevel = '1-1';
        this.selectedCampaignDifficulty = 'MEDIUM';
        this.campaignPlayers = 1;
        this.campaignAllies = 1;

        this.worldMap = null;
        this.mapLevel = null;
        this.overlay = null;
        this.litNotes = new Map();
        this.previousScreen = 'home';
    }

    /**
     * Initialize the menu system
     */
    initialize() {
        this.createMenuHTML();
        this.setupEventListeners();
        this.renderSegments();
        this.paintTiles();
        this.startPianoStrip();

        // Initialize keyboard fallback by default
        this.initializeKeyboardFallback();
        this.updateAudioButtonStates();
        this.setupMenuPianoControl();

        // Defer menu music until first user gesture (autoplay policy)
        const startMenuMusicOnce = async () => {
            if (!window.audioSystem) return;
            await window.audioSystem.resume();
            if (!window.game) window.audioSystem.playMenuMusic();
        };
        window.addEventListener('pointerdown', startMenuMusicOnce, { once: true });
        window.addEventListener('keydown', startMenuMusicOnce, { once: true });

        this.focusFirst();
    }

    /**
     * Create the menu HTML structure
     */
    createMenuHTML() {
        const logo = Sprites.toDataURL(Sprites.tankPreview('blue'), 3);
        const field = (icon, label, id) => `
            <div class="field">
                <span class="field-icon" data-tip="${label}" aria-label="${label}">${ic(icon)}</span>
                <div class="segments" id="${id}" role="radiogroup" aria-label="${label}"></div>
            </div>
        `;
        document.body.innerHTML = `
            <style>${Sprites.iconStyles()}</style>
            <div id="menuContainer" class="menu">

                <!-- Home -->
                <div id="homeScreen" class="screen active">
                    <div class="bar">
                        <div class="bar-title">
                            <img src="${logo}" alt="">
                            <h1>MultiTanks</h1>
                        </div>
                        ${iconButton('fullscreen', 'Fullscreen', 'data-fullscreen')}
                        ${iconButton('keys', 'Controls', 'data-go="controls"')}
                        ${iconButton('gear', 'Options', 'data-go="options"')}
                    </div>
                    <div class="tiles">
                        <button class="tile" id="tileCampaign" data-tip="A journey through a silent piano">
                            <canvas id="artCampaign"></canvas>
                            <span class="tile-tag" id="campaignTag"></span>
                            <div class="tile-label"><strong>The 89th Key</strong></div>
                        </button>
                        <button class="tile" id="tileFFA" data-tip="Last tank rolling wins">
                            <canvas id="artFFA"></canvas>
                            <div class="tile-label"><strong>Free For All</strong></div>
                        </button>
                        <button class="tile" id="tileTDM" data-tip="Red against blue">
                            <canvas id="artTDM"></canvas>
                            <div class="tile-label"><strong>Team Battle</strong></div>
                        </button>
                    </div>
                    <div class="piano-strip"><canvas id="pianoStrip"></canvas></div>
                    <div class="status">
                        <div class="status-text">
                            <i class="dot" id="inputDot"></i>
                            <span id="inputIcon"></span>
                            <b id="inputName"></b>
                        </div>
                        ${iconButton('plug', 'Connect a piano', 'id="connectMidiBtn"')}
                    </div>
                </div>

                <!-- Match setup -->
                <div id="setupScreen" class="screen">
                    <div class="bar">
                        <div class="bar-title"><h2 id="setupTitle">Free For All</h2></div>
                        ${iconButton('back', 'Back', 'data-go="home" data-key="Esc"')}
                    </div>
                    <div class="columns">
                        <div class="column">
                            ${field('tank', 'Players', 'segPlayers')}
                            ${field('bot', 'AI bots', 'segBots')}
                            ${field('aim', 'Bot skill', 'segSkill')}
                            ${field('map', 'Stage', 'segTheme')}
                        </div>
                        <div class="column">
                            <div class="roster" id="roster"></div>
                        </div>
                    </div>
                    <div class="start-bar">
                        <button id="startGameBtn" class="start-button"></button>
                    </div>
                </div>

                <!-- Campaign setup -->
                <div id="campaignScreen" class="screen">
                    <div class="bar">
                        <div class="bar-title"><h2>The 89th Key</h2></div>
                        ${iconButton('back', 'Back', 'data-go="home" data-key="Esc"')}
                    </div>
                    <div class="columns">
                        <div class="column">
                            ${field('tank', 'Crew', 'segCrew')}
                            ${field('bot', 'AI allies', 'segAllies')}
                            ${field('wave', 'Difficulty', 'segDifficulty')}
                            <div class="progress-row">
                                <div class="notes" id="campaignNotes"></div>
                                <div class="relics" id="relics"></div>
                            </div>
                        </div>
                        <div class="column">
                            <div class="story-art"><canvas id="artStory"></canvas></div>
                        </div>
                    </div>
                    <div class="start-bar">
                        <button id="campaignStartBtn" class="start-button" aria-label="Play">${ic('play')}</button>
                        ${iconButton('restart', 'Start over', 'id="campaignResetBtn"', 'start-button secondary')}
                    </div>
                </div>

                <!-- World map -->
                <div id="mapScreen" class="screen">
                    <div class="bar">
                        <div class="bar-title"><h2>The Old Grand</h2><div class="notes" id="mapNotes"></div></div>
                        ${iconButton('tank', 'Crew', 'data-go="campaign"')}
                        ${iconButton('home', 'Menu', 'data-go="home" data-key="Esc"')}
                    </div>
                    <div class="map-canvas-wrap"><canvas id="worldMap"></canvas></div>
                    <div class="map-info">
                        <div class="map-info-text">
                            <span id="mapLevelIcon"></span>
                            <strong id="mapLevelName"></strong>
                        </div>
                        <button id="mapPlayBtn" class="start-button" aria-label="Play">${ic('play')}</button>
                    </div>
                </div>

                <!-- Controls -->
                <div id="controlsScreen" class="screen">
                    <div class="bar">
                        <div class="bar-title"><h2>Controls</h2></div>
                        ${iconButton('back', 'Back', 'data-go="home" data-key="Esc"')}
                    </div>
                    <div class="reference" id="controlsPage"></div>
                </div>

                <!-- Options -->
                <div id="optionsScreen" class="screen">
                    <div class="bar">
                        <div class="bar-title"><h2>Options</h2></div>
                        ${iconButton('back', 'Back', 'data-go="home" data-key="Esc"')}
                    </div>
                    <div class="reference">
                        <section class="wide">
                            <div class="option-row">
                                <button class="sound-toggle" id="musicToggleBtn" aria-label="Music" data-tip="Music">${ic('note')}</button>
                                <input type="range" id="musicVolume" min="0" max="100" aria-label="Music volume">
                            </div>
                            <div class="option-row">
                                <button class="sound-toggle" id="sfxToggleBtn" aria-label="Effects" data-tip="Effects">${ic('speaker')}</button>
                                <input type="range" id="sfxVolume" min="0" max="100" aria-label="Effects volume">
                            </div>
                            ${field('note', 'Soundtrack', 'segArenaMusic')}
                            <div class="option-row">
                                ${iconButton('fullscreen', 'Fullscreen', 'data-fullscreen', 'sound-toggle')}
                            </div>
                        </section>
                        <section class="wide credits">
                            <p class="hint">Original score by this game. Smash Bros. soundtrack: "Battlefield", "Final Destination", "Main Menu" and "Fire Emblem Theme", from Super Smash Bros. Brawl and Ultimate. All rights belong to their owners. A non-commercial fan work.</p>
                        </section>
                    </div>
                </div>
            </div>
            <div id="tooltip" class="tooltip" role="tooltip"></div>
        `;

        this.menuElement = document.getElementById('menuContainer');
        document.getElementById('controlsPage').innerHTML = this.controlsMarkup();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.querySelectorAll('[data-go]').forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.go === 'home' || button.dataset.key) window.audioSystem.uiBack();
                else window.audioSystem.select();
                this.showScreen(button.dataset.go);
            });
        });
        this.setupTooltips();

        document.querySelectorAll('[data-fullscreen]').forEach(button => {
            button.addEventListener('click', () => this.toggleFullscreen());
        });
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());

        document.getElementById('connectMidiBtn').addEventListener('click', () => this.connectMIDI());

        document.getElementById('tileCampaign').addEventListener('click', () => this.openCampaign());
        document.getElementById('tileFFA').addEventListener('click', () => this.openSetup(GAME_MODES.FFA));
        document.getElementById('tileTDM').addEventListener('click', () => this.openSetup(GAME_MODES.TDM));

        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());

        document.getElementById('campaignStartBtn').addEventListener('click', () => {
            window.audioSystem.select();
            this.showWorldMap();
        });
        document.getElementById('campaignResetBtn').addEventListener('click', () => this.confirmReset());
        document.getElementById('mapPlayBtn').addEventListener('click', () => this.playMapLevel());
        document.getElementById('worldMap').addEventListener('click', (event) => {
            if (this.worldMap) this.worldMap.clickAt(event.clientX, event.clientY);
        });

        // Music toggle
        document.getElementById('musicToggleBtn').addEventListener('click', () => {
            this.toggleMusic();
        });

        // SFX toggle
        document.getElementById('sfxToggleBtn').addEventListener('click', () => {
            this.toggleSFX();
        });

        const musicVolume = document.getElementById('musicVolume');
        const sfxVolume = document.getElementById('sfxVolume');
        musicVolume.value = Math.round(window.audioSystem.getMusicVolume() * 100);
        sfxVolume.value = Math.round(window.audioSystem.getSfxVolume() * 100);
        musicVolume.addEventListener('input', () => window.audioSystem.setMusicVolume(musicVolume.value / 100));
        sfxVolume.addEventListener('input', () => window.audioSystem.setSfxVolume(sfxVolume.value / 100));

        window.addEventListener('keydown', (event) => this.handleMenuKey(event));

        // The strip of keys along the bottom lights up when played
        window.midiHandler.onNote((note, isPressed, velocity) => {
            if (isPressed) this.litNotes.set(note, velocity);
            else this.litNotes.delete(note);
        });
    }

    // -------------------------------------------------------------------------
    // Tooltips
    // -------------------------------------------------------------------------

    /**
     * Icons say what they do on hover or focus. The first takes a moment, and the
     * next one along shows straight away.
     */
    setupTooltips() {
        const tip = document.getElementById('tooltip');
        let showTimer = null;
        let hideTimer = null;
        let openUntil = 0;
        this.tooltip = tip;

        const place = (target) => {
            tip.innerHTML = target.dataset.key
                ? `${target.dataset.tip} <kbd class="cap">${target.dataset.key}</kbd>`
                : target.dataset.tip;
            tip.classList.add('open');
            const box = target.getBoundingClientRect();
            const width = tip.offsetWidth;
            const height = tip.offsetHeight;
            const below = box.bottom + height + 8 < window.innerHeight;
            const left = Math.max(8, Math.min(window.innerWidth - width - 8, box.left + box.width / 2 - width / 2));
            tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(below ? box.bottom + 6 : box.top - height - 6)}px)`;
            openUntil = Infinity;
        };
        const show = (target) => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
            if (performance.now() < openUntil) place(target);
            else showTimer = setTimeout(() => place(target), 350);
        };
        const hide = () => {
            clearTimeout(showTimer);
            if (openUntil === Infinity) openUntil = performance.now() + 300;
            hideTimer = setTimeout(() => tip.classList.remove('open'), 120);
        };
        this.hideTooltip = () => {
            clearTimeout(showTimer);
            openUntil = 0;
            tip.classList.remove('open');
        };

        document.addEventListener('pointerover', (event) => {
            const target = event.target.closest('[data-tip]');
            if (target && event.pointerType === 'mouse') show(target);
            else hide();
        });
        document.addEventListener('focusin', (event) => {
            const target = event.target.closest('[data-tip]');
            if (target && event.target.matches(':focus-visible')) show(target);
            else hide();
        });
        document.addEventListener('focusout', hide);
    }

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    showScreen(name) {
        if (this.worldMap && name !== 'map') this.worldMap.stop();
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const element = document.getElementById(`${name}Screen`);
        if (element) element.classList.add('active');
        this.currentScreen = name;
        if (name === 'campaign') this.renderCampaignPanel();
        if (name === 'home') {
            this.updateCampaignTag();
            this.paintTiles();
        }
        this.hideTooltip();
        this.focusFirst();
    }

    /**
     * Which buttons can be reached right now
     */
    navigableButtons() {
        const root = this.overlay || document.querySelector('.screen.active');
        if (!root) return [];
        return [...root.querySelectorAll('button:not(:disabled):not([aria-disabled="true"]), input[type="range"]')]
            .filter(element => element.offsetParent !== null);
    }

    focusFirst() {
        const buttons = this.navigableButtons();
        const primary = buttons.find(button => button.dataset.primary) || buttons.find(b => !b.classList.contains('bar-button')) || buttons[0];
        if (primary) primary.focus({ preventScroll: true });
    }

    /**
     * Move focus to the nearest button in a direction
     * @param {number} dx - -1, 0 or 1
     * @param {number} dy - -1, 0 or 1
     */
    moveFocus(dx, dy) {
        const buttons = this.navigableButtons();
        if (buttons.length === 0) return;
        const current = document.activeElement;
        if (!buttons.includes(current)) {
            buttons[0].focus({ preventScroll: true });
            return;
        }
        const from = current.getBoundingClientRect();
        const fromX = from.left + from.width / 2;
        const fromY = from.top + from.height / 2;
        let best = null;
        let bestScore = Infinity;
        buttons.forEach(button => {
            if (button === current) return;
            const box = button.getBoundingClientRect();
            const x = box.left + box.width / 2 - fromX;
            const y = box.top + box.height / 2 - fromY;
            const along = x * dx + y * dy;
            if (along <= 4) return;
            const across = Math.abs(x * dy) + Math.abs(y * dx);
            const score = along + across * 2.5;
            if (score < bestScore) {
                bestScore = score;
                best = button;
            }
        });
        if (best) {
            best.focus({ preventScroll: false });
            window.audioSystem.uiStep(dx + dy > 0 ? 1 : -1);
        }
    }

    activateFocus() {
        const element = document.activeElement;
        if (element && element.tagName === 'BUTTON') element.click();
    }

    menuInputActive() {
        return !window.game || this.overlay;
    }

    handleMenuKey(event) {
        if (!this.menuInputActive()) return;
        if (this.currentScreen === 'map' && !this.overlay) {
            const handled = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[event.code];
            if (handled) {
                event.preventDefault();
                this.worldMap.move(handled);
                return;
            }
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                this.playMapLevel();
                return;
            }
        }
        // A slider keeps left and right for itself, but up and down leave it
        const onSlider = document.activeElement.type === 'range';
        const moves = onSlider
            ? { ArrowUp: [0, -1], ArrowDown: [0, 1] }
            : { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        if (moves[event.code]) {
            event.preventDefault();
            this.moveFocus(...moves[event.code]);
        } else if (event.code === 'Escape' && !this.overlay) {
            const back = document.querySelector('.screen.active [data-go="home"]');
            if (back) back.click();
        }
    }

    /**
     * The piano drives the menus the same way it drives a tank
     */
    setupMenuPianoControl() {
        window.midiHandler.onControl('all', (event) => {
            if (!event.isPressed || !this.menuInputActive()) return;
            if (event.playerIndex !== 0 && !event.noteNumber) return;
            const map = this.currentScreen === 'map' && !this.overlay;
            const slider = document.activeElement.type === 'range' ? document.activeElement : null;
            switch (event.control) {
                case 'A': return map ? this.worldMap.move(-1) : (slider ? this.nudgeSlider(slider, -5) : this.moveFocus(-1, 0));
                case 'C': return map ? this.worldMap.move(1) : (slider ? this.nudgeSlider(slider, 5) : this.moveFocus(1, 0));
                case 'A_SHARP': return this.moveFocus(0, -1);
                case 'B': return this.moveFocus(0, 1);
                case 'D': return map ? this.playMapLevel() : this.activateFocus();
                default: return undefined;
            }
        }, 'menu');
    }

    nudgeSlider(slider, amount) {
        slider.value = Number(slider.value) + amount;
        slider.dispatchEvent(new Event('input'));
    }

    // -------------------------------------------------------------------------
    // Input device
    // -------------------------------------------------------------------------

    /**
     * Connect to MIDI device
     */
    async connectMIDI() {
        const connectBtn = document.getElementById('connectMidiBtn');
        connectBtn.disabled = true;
        await window.midiHandler.initialize(false); // Disable debug mode
        connectBtn.disabled = false;
        this.updateInputDisplay();
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
        const handler = window.midiHandler;
        const connected = handler.isConnected;
        this.midiConnected = connected;
        document.getElementById('inputDot').classList.toggle('on', connected);
        document.getElementById('inputIcon').innerHTML = ic(connected ? 'keys' : 'keyboard');
        document.getElementById('inputName').textContent = connected ? handler.getDeviceNames().join(', ') : '';
        const connect = document.getElementById('connectMidiBtn');
        connect.dataset.tip = connected ? 'Reconnect the piano' : 'Connect a piano, for up to four players';
        if (!connected) {
            this.selectedPlayers = Math.min(this.selectedPlayers, 1);
            this.campaignPlayers = Math.min(this.campaignPlayers, 1);
        }
        this.renderSegments();
        document.getElementById('controlsPage').innerHTML = this.controlsMarkup();
    }

    maxPlayers() {
        return this.midiConnected ? GAME_CONFIG.MAX_PLAYERS : 1;
    }

    // -------------------------------------------------------------------------
    // Setup panels
    // -------------------------------------------------------------------------

    openSetup(mode) {
        window.audioSystem.select();
        this.selectedGameMode = mode;
        this.teamAssignments = {};
        this.botRedCount = null;
        document.getElementById('setupTitle').textContent = mode === GAME_MODES.TDM ? 'Team Battle' : 'Free For All';
        this.renderSegments();
        this.showScreen('setup');
    }

    openCampaign() {
        window.audioSystem.select();
        this.selectedGameMode = GAME_MODES.CAMPAIGN;
        this.renderSegments();
        this.showScreen('campaign');
    }

    /**
     * Fill a row of choices. The row is only built once, so that a single highlight
     * can slide across it, and focus stays put when a choice changes.
     * @param {string} id - Element id of the row
     * @param {Array} options - {value, label or html, tip, disabled}
     * @param {*} selected - Currently selected value
     * @param {Function} onPick - Called with the picked value
     */
    segment(id, options, selected, onPick) {
        const row = document.getElementById(id);
        const signature = options.map(option => String(option.value)).join('|');
        if (row.dataset.signature !== signature) {
            row.dataset.signature = signature;
            row.innerHTML = '<span class="thumb"></span>';
            row.style.setProperty('--count', options.length);
            options.forEach(option => {
                const button = document.createElement('button');
                button.setAttribute('role', 'radio');
                button.innerHTML = option.html || option.label;
                button.addEventListener('click', () => {
                    if (button.getAttribute('aria-disabled') === 'true') {
                        window.audioSystem.denied();
                        return;
                    }
                    window.audioSystem.uiStep(0);
                    row.pick(option.value);
                });
                row.appendChild(button);
            });
        }
        row.pick = onPick;

        const buttons = row.querySelectorAll('button');
        const index = options.findIndex(option => option.value === selected);
        options.forEach((option, i) => {
            const button = buttons[i];
            button.setAttribute('aria-checked', String(i === index));
            button.setAttribute('aria-disabled', String(!!option.disabled));
            if (option.tip) {
                button.dataset.tip = option.tip;
                button.setAttribute('aria-label', option.tip);
            }
        });
        const thumb = row.querySelector('.thumb');
        thumb.hidden = index < 0;
        thumb.style.transform = `translateX(${index * 100}%)`;
    }

    range(min, max) {
        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    renderSegments() {
        const maxPlayers = this.maxPlayers();
        const limit = GAME_CONFIG.MAX_TOTAL_TANKS;

        const needsPiano = 'Connect a piano for more players';
        this.segment('segPlayers', this.range(0, GAME_CONFIG.MAX_PLAYERS).map(n => ({
            value: n, label: String(n), disabled: n > maxPlayers, tip: n > maxPlayers ? needsPiano : `${n} players`
        })), this.selectedPlayers, (value) => {
            this.selectedPlayers = value;
            this.renderSegments();
        });

        this.selectedAIBots = Math.min(this.selectedAIBots, limit - this.selectedPlayers);
        this.segment('segBots', this.range(0, limit).map(n => ({
            value: n, label: String(n), disabled: n > limit - this.selectedPlayers
        })), this.selectedAIBots, (value) => {
            this.selectedAIBots = value;
            this.botRedCount = null;
            this.renderSegments();
        });

        this.segment('segSkill', Object.entries(BOT_SKILLS).map(([value, skill]) => ({
            value, html: `<em>${skill.mark}</em>`, tip: skill.label
        })), this.selectedBotSkill, (value) => {
            this.selectedBotSkill = value;
            this.renderSegments();
        });

        const swatch = key => `<i class="swatch" style="background:${THEMES[key].floor[0]};border-color:${THEMES[key].wall[0]}"></i>`;
        const themes = [{ value: null, html: ic('random'), tip: 'Random' }].concat(ARENA_THEMES.map(value => ({
            value, html: swatch(value), tip: THEMES[value].name
        })));
        this.segment('segTheme', themes, this.selectedTheme, (value) => {
            this.selectedTheme = value;
            this.renderSegments();
        });

        this.segment('segArenaMusic', [
            { value: 'chiptune', label: 'Chiptune', tip: 'The original score, with an exact beat' },
            { value: 'recordings', label: 'Smash Bros.', tip: 'No beat to follow, so no rhythm bonus in arenas' }
        ], window.audioSystem.getArenaMusic(), (value) => {
            window.audioSystem.setArenaMusic(value);
            window.audioSystem.playMenuMusic();
            this.renderSegments();
        });

        this.segment('segCrew', this.range(0, GAME_CONFIG.MAX_PLAYERS).map(n => ({
            value: n, html: n === 0 ? ic('eye') : String(n), disabled: n > maxPlayers,
            tip: n === 0 ? 'Watch the bots play' : (n > maxPlayers ? needsPiano : `${n} players`)
        })), this.campaignPlayers, (value) => {
            this.campaignPlayers = value;
            this.renderSegments();
        });

        const allyLimit = 7;
        this.campaignAllies = Math.min(this.campaignAllies, allyLimit);
        this.segment('segAllies', this.range(0, allyLimit).map(n => ({
            value: n, label: String(n), disabled: n > limit - this.campaignPlayers
        })), this.campaignAllies, (value) => {
            this.campaignAllies = value;
            this.renderSegments();
        });

        this.segment('segDifficulty', Object.entries(CAMPAIGN_CONFIG.DIFFICULTY).map(([value, entry]) => ({
            value, html: `<em>${entry.mark}</em>`, tip: `${entry.label}: ${entry.blurb}`
        })), this.selectedCampaignDifficulty, (value) => {
            this.selectedCampaignDifficulty = value;
            this.renderSegments();
        });

        this.renderRoster();
        this.updateStartButton();
    }

    /**
     * Show everyone in the match. In team games, click a tank to swap sides.
     */
    renderRoster() {
        const roster = document.getElementById('roster');
        const isTeams = this.selectedGameMode === GAME_MODES.TDM;
        roster.innerHTML = '';

        const total = this.selectedPlayers + this.selectedAIBots;
        if (this.botRedCount === null) {
            let reds = this.range(0, this.selectedPlayers - 1).filter(i => this.teamFor(i) === 'red').length;
            if (this.selectedPlayers === 0) reds = 0;
            this.botRedCount = Math.max(0, Math.min(this.selectedAIBots, Math.ceil(total / 2) - reds));
        }
        this.botRedCount = Math.min(this.botRedCount, this.selectedAIBots);

        for (let i = 0; i < total; i++) {
            const isBot = i >= this.selectedPlayers;
            const botIndex = i - this.selectedPlayers;
            const team = isTeams ? (isBot ? (botIndex < this.botRedCount ? 'red' : 'blue') : this.teamFor(i)) : null;
            const palette = team ? GAME_CONFIG.TEAM_PALETTES[team] : TANK_PALETTE_ORDER[i % TANK_PALETTE_ORDER.length];
            const card = document.createElement(isTeams ? 'button' : 'div');
            card.className = `roster-card${team ? ` team-${team}` : ''}`;
            const name = isBot ? `Bot ${botIndex + 1}` : `Player ${i + 1}`;
            if (isTeams) card.dataset.tip = `${name}: swap sides`;
            card.innerHTML = `
                <img src="${Sprites.toDataURL(Sprites.tankPreview(palette), 3)}" alt="${name}">
                <b>${isBot ? `<em>${BOT_SKILLS[this.selectedBotSkill].mark}</em>` : `P${i + 1}`}</b>
            `;
            if (isTeams) {
                card.addEventListener('click', () => {
                    window.audioSystem.select();
                    if (isBot) {
                        // Bots are only counted per side, so swap one across
                        this.botRedCount += team === 'red' ? -1 : 1;
                    } else {
                        this.teamAssignments[i] = team === 'red' ? 'blue' : 'red';
                    }
                    this.renderRoster();
                    this.updateStartButton();
                });
            }
            roster.appendChild(card);
        }
    }

    teamFor(playerIndex) {
        return this.teamAssignments[playerIndex] || (playerIndex % 2 === 0 ? 'red' : 'blue');
    }

    /**
     * Update start button state
     */
    updateStartButton() {
        const startBtn = document.getElementById('startGameBtn');
        const total = this.selectedPlayers + this.selectedAIBots;
        let ready = total >= 2;
        let label = ic('play');
        if (total < 2) label = `${ic('tank')} 2+`;
        if (this.selectedGameMode === GAME_MODES.TDM && ready) {
            let red = this.range(0, this.selectedPlayers - 1).filter(i => this.selectedPlayers > 0 && this.teamFor(i) === 'red').length;
            red += this.botRedCount || 0;
            if (red === 0 || red === total) {
                ready = false;
                label = `${ic('swap')}`;
            }
        }
        startBtn.disabled = !ready;
        startBtn.innerHTML = label;
        startBtn.setAttribute('aria-label', ready ? 'Start' : 'Not enough tanks');
    }

    updateCampaignTag() {
        const tag = document.getElementById('campaignTag');
        tag.innerHTML = CampaignSave.hasStarted() ? `\u266A ${CampaignSave.notesHome()}/${NOTES_IN_THE_PIANO}` : '';
        tag.hidden = !CampaignSave.hasStarted();
    }

    /**
     * Progress through the story, drawn as the piano's 88 keys filling with gold
     */
    paintNotes(id) {
        const home = CampaignSave.notesHome();
        const holder = document.getElementById(id);
        holder.dataset.tip = `${home} of ${NOTES_IN_THE_PIANO} notes home`;
        holder.innerHTML = '<canvas></canvas>';
        const canvas = holder.firstChild;
        const isBlack = note => [1, 3, 6, 8, 10].includes(note % 12);
        const whites = Array.from({ length: 88 }, (_, i) => i + 21).filter(note => !isBlack(note)).length;
        canvas.width = whites * 3;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        let x = 0;
        for (let i = 0; i < 88; i++) {
            const note = i + 21;
            if (isBlack(note)) continue;
            ctx.fillStyle = i < home ? '#ffd45e' : '#f2e8d2';
            ctx.fillRect(x, 0, 2, 10);
            x += 3;
        }
        x = 0;
        for (let i = 0; i < 88; i++) {
            const note = i + 21;
            if (isBlack(note)) {
                ctx.fillStyle = i < home ? '#a8681a' : '#1b1830';
                ctx.fillRect(x - 2, 0, 2, 6);
            } else {
                x += 3;
            }
        }
    }

    renderCampaignPanel() {
        const save = CampaignSave.get();
        const started = CampaignSave.hasStarted();
        document.getElementById('campaignResetBtn').classList.toggle('hidden', !started);
        this.paintNotes('campaignNotes');
        const relicIcons = { armor: 'shield', tuned: 'clef', spare: 'tank', resin: 'spring' };
        document.getElementById('relics').innerHTML = Object.entries(REWARDS).map(([key, reward]) => {
            const found = save.rewards.includes(key);
            return `<span class="relic${found ? ' found' : ''}" data-tip="${found ? `${reward.name}: ${reward.text}` : 'Still hidden'}">${picture(found ? relicIcons[key] : 'lock')}</span>`;
        }).join('');
        this.paintStoryArt();
    }

    confirmReset() {
        this.showResults({
            title: 'Start over?',
            tone: 'lose',
            subtitle: `All ${CampaignSave.notesHome()} notes go back to where they were.`,
            rows: [],
            buttons: [
                { icon: 'cross', label: 'Keep my progress', primary: true, action: () => {} },
                {
                    icon: 'restart',
                    label: 'Start over',
                    action: () => {
                        CampaignSave.reset();
                        this.renderCampaignPanel();
                    }
                }
            ]
        });
    }

    // -------------------------------------------------------------------------
    // World map
    // -------------------------------------------------------------------------

    /**
     * Leave any stage and show the journey so far
     */
    showWorldMap() {
        this.leaveGame();
        this.selectedGameMode = GAME_MODES.CAMPAIGN;
        this.menuElement.classList.remove('hidden');
        this.showScreen('map');
        if (!this.worldMap) {
            this.worldMap = new WorldMap(document.getElementById('worldMap'), (level, open) => this.describeLevel(level, open));
            window.addEventListener('resize', () => {
                if (this.currentScreen === 'map') this.worldMap.resize();
            });
        }
        this.paintNotes('mapNotes');
        this.worldMap.start(this.nextLevelId(), CampaignSave.get().lastLevel);
        this.playMenuMusic();
    }

    /**
     * The first stage still to do, or wherever the player last was
     */
    nextLevelId() {
        const unfinished = campaignLevels().find(level => !level.optional && !CampaignSave.isComplete(level.id));
        return unfinished ? unfinished.id : CampaignSave.get().lastLevel;
    }

    describeLevel(level, open) {
        this.mapLevel = open ? level : null;
        const done = CampaignSave.isComplete(level.id);
        document.getElementById('mapLevelName').textContent = open ? `${level.id}  ${level.name}` : level.id;
        const icons = document.getElementById('mapLevelIcon');
        icons.innerHTML = open ? picture(OBJECTIVE_ICONS[level.objective.type], 3) : picture('lock', 3);
        icons.dataset.tip = open ? `${level.world.place}: ${level.objective.text}` : 'Further down the road';
        const play = document.getElementById('mapPlayBtn');
        play.disabled = !open;
        play.innerHTML = ic(done ? 'restart' : 'play');
        play.setAttribute('aria-label', done ? 'Play again' : 'Play');
    }

    playMapLevel() {
        if (!this.mapLevel) return;
        this.selectedCampaignLevel = this.mapLevel.id;
        this.startGame();
    }

    // -------------------------------------------------------------------------
    // Starting and leaving games
    // -------------------------------------------------------------------------

    createCanvas() {
        // Create a new canvas element dynamically to ensure it's properly rendered
        const newCanvas = document.createElement('canvas');
        newCanvas.id = 'gameCanvas';
        newCanvas.className = 'game-canvas';

        // Remove old canvas if it exists
        const oldCanvas = document.getElementById('gameCanvas');
        if (oldCanvas) {
            oldCanvas.remove();
        }

        // Add new canvas to body
        document.body.appendChild(newCanvas);
        this.gameElement = newCanvas;
        newCanvas.addEventListener('pointerdown', () => {
            if (window.game && window.game.dialog) window.game.dialog.advance();
        });
        return newCanvas;
    }

    /**
     * Start the game
     */
    async startGame() {
        const campaign = this.selectedGameMode === GAME_MODES.CAMPAIGN;
        const players = campaign ? this.campaignPlayers : this.selectedPlayers;
        const bots = campaign ? this.campaignAllies : this.selectedAIBots;
        let aiTeamDistribution = null;
        if (this.selectedGameMode === GAME_MODES.TDM) {
            aiTeamDistribution = { red: this.botRedCount, blue: bots - this.botRedCount };
        }

        // Persist last used settings for hot-restart (R)
        this.lastSettings = {
            gameMode: this.selectedGameMode,
            players,
            aiBots: bots,
            botSkill: this.selectedBotSkill,
            theme: this.selectedTheme,
            teamAssignments: { ...this.teamAssignments },
            aiTeamDistribution,
            campaignLevel: this.selectedCampaignLevel,
            campaignDifficulty: this.selectedCampaignDifficulty
        };
        await this.launch(this.lastSettings);
    }

    /**
     * Restart with last used settings (used by R hotkey from menu)
     */
    async restartWithLastSettings() {
        if (this.lastSettings) await this.launch(this.lastSettings);
    }

    async launch(settings) {
        // Hide menu
        this.menuElement.classList.add('hidden');
        if (this.worldMap) this.worldMap.stop();

        // Stop menu music before starting game
        window.audioSystem.stopMusic();
        await window.audioSystem.resume();
        window.midiHandler.resetAllControls();

        const canvas = this.createCanvas();
        window.game = new MultiTanksGame();
        window.game.arenaTheme = settings.theme;
        this.currentScreen = 'game';

        await window.game.initialize(canvas, settings.players, settings.aiBots, settings.gameMode,
            settings.teamAssignments, settings.aiTeamDistribution, settings.botSkill);

        if (settings.gameMode === GAME_MODES.CAMPAIGN) {
            const mode = window.game.mode;
            mode.currentLevelId = settings.campaignLevel;
            mode.difficulty = settings.campaignDifficulty;
            mode.initializeLevel(window.game);
        }
    }

    closeOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /**
     * Restart whatever is being played
     */
    restartCurrent() {
        const game = window.game;
        this.closeOverlay();
        if (game.gameMode === GAME_MODES.CAMPAIGN) game.mode.restartLevel(game);
        else game.restartGame();
    }

    /**
     * Escape in a game pauses it, and pressing it again carries on. Only the
     * results screen, where there is no game left to return to, leaves.
     */
    handleEscape() {
        const game = window.game;
        if (game.gameState === GAME_STATES.PLAYING) game.togglePause();
        else this.returnToMenu();
    }

    // -------------------------------------------------------------------------
    // Pause
    // -------------------------------------------------------------------------

    showPause() {
        const game = window.game;
        const campaign = game.gameMode === GAME_MODES.CAMPAIGN;
        const info = game.mode.hudInfo ? game.mode.hudInfo(game) : { lines: [] };
        this.closeOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'overlay pause';
        this.overlay = overlay;
        overlay.innerHTML = `
            <div class="overlay-head"><h2>Paused</h2><p>${info.title || ''}</p></div>
            <div class="pause-body">
                <div class="pause-menu">
                    <button class="start-button" data-primary="1" id="pauseResume" aria-label="Resume" data-tip="Resume" data-key="Esc">${ic('play')}</button>
                    <div class="pause-row">
                        ${iconButton('restart', campaign ? 'Restart stage' : 'Restart match', 'id="pauseRestart" data-key="R"', 'pause-item')}
                        ${iconButton(this.fullscreenElement() ? 'shrink' : 'fullscreen', this.fullscreenLabel(), 'data-fullscreen', 'pause-item')}
                        ${iconButton(campaign ? 'map' : 'home', campaign ? 'Back to the map' : 'Main menu', 'id="pauseQuit"', 'pause-item')}
                    </div>
                    <div class="pause-sound">
                        <div class="option-row">${ic('note')}<input type="range" id="pauseMusic" min="0" max="100" aria-label="Music volume"></div>
                        <div class="option-row">${ic('speaker')}<input type="range" id="pauseSfx" min="0" max="100" aria-label="Effects volume"></div>
                    </div>
                </div>
                <div class="reference pause-reference">${this.controlsMarkup()}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#pauseResume').addEventListener('click', () => {
            window.audioSystem.select();
            game.setPaused(false);
        });
        overlay.querySelector('#pauseRestart').addEventListener('click', () => {
            window.audioSystem.select();
            this.restartCurrent();
        });
        overlay.querySelector('#pauseQuit').addEventListener('click', () => {
            window.audioSystem.select();
            this.returnToMenu();
        });
        overlay.querySelector('[data-fullscreen]').addEventListener('click', () => this.toggleFullscreen());

        const music = overlay.querySelector('#pauseMusic');
        const sfx = overlay.querySelector('#pauseSfx');
        music.value = Math.round(window.audioSystem.getMusicVolume() * 100);
        sfx.value = Math.round(window.audioSystem.getSfxVolume() * 100);
        music.addEventListener('input', () => {
            window.audioSystem.setMusicVolume(music.value / 100);
            document.getElementById('musicVolume').value = music.value;
        });
        sfx.addEventListener('input', () => {
            window.audioSystem.setSfxVolume(sfx.value / 100);
            document.getElementById('sfxVolume').value = sfx.value;
        });
        this.focusFirst();
    }

    // -------------------------------------------------------------------------
    // Fullscreen
    // -------------------------------------------------------------------------

    fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    fullscreenLabel() {
        return this.fullscreenElement() ? 'Exit fullscreen' : 'Fullscreen';
    }

    toggleFullscreen() {
        window.audioSystem.select();
        const root = document.documentElement;
        if (this.fullscreenElement()) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            const request = root.requestFullscreen || root.webkitRequestFullscreen;
            const started = request.call(root);
            if (started && started.catch) started.catch(() => {});
        }
    }

    /**
     * Browsers keep Escape for themselves in fullscreen, so leaving it that way
     * mid-game counts as asking to pause.
     */
    onFullscreenChange() {
        document.querySelectorAll('[data-fullscreen]').forEach(button => {
            button.innerHTML = ic(this.fullscreenElement() ? 'shrink' : 'fullscreen');
            button.dataset.tip = this.fullscreenLabel();
            button.setAttribute('aria-label', this.fullscreenLabel());
        });
        if (!this.fullscreenElement() && window.game) window.game.setPaused(true);
    }

    leaveGame() {
        this.closeOverlay();
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
            this.gameElement = null;
        }
    }

    playMenuMusic() {
        window.audioSystem.playMenuMusic();
    }

    /**
     * Return to menu from game
     */
    returnToMenu() {
        const campaign = window.game && window.game.gameMode === GAME_MODES.CAMPAIGN;
        this.leaveGame();
        if (campaign) {
            this.showWorldMap();
            return;
        }
        this.menuElement.classList.remove('hidden');
        this.showScreen('home');
        this.playMenuMusic();
    }

    // -------------------------------------------------------------------------
    // Results
    // -------------------------------------------------------------------------

    /**
     * Show the full-screen results of a match or stage
     * @param {Object} options - title, subtitle, tone, gains, rows and buttons
     */
    showResults({ title, subtitle = '', tone = 'win', gains = [], rows = [], buttons = [], killsLabel = 'Kills' }) {
        this.closeOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        this.overlay = overlay;

        const tableRows = rows.map(row => `
            <tr>
                <td><i class="swatch" style="background:${TANK_PALETTES[row.palette].m}"></i>${row.name}</td>
                <td>${row.kills}</td>
                <td>${row.damage}</td>
                <td>${row.accuracy}%</td>
                <td>${row.groove}</td>
                <td>${row.abilities}</td>
                <td>${row.powerups}</td>
            </tr>
        `).join('');
        const head = (icon, label) => `<th data-tip="${label}" aria-label="${label}">${ic(icon)}</th>`;
        const table = rows.length ? `
            <table class="results">
                <thead><tr>${head('tank', 'Tank')}${head('note', killsLabel)}${head('burst', 'Damage')}${head('aim', 'Accuracy')}${head('wave', 'Best groove')}${head('keys', 'Chords played')}${head('box', 'Pickups')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        ` : '';

        overlay.innerHTML = `
            <div class="overlay-head ${tone}"><h2>${title}</h2><p>${subtitle}</p></div>
            <div class="overlay-body">${gains.map(gain => `<div class="gain">\u266A ${gain}</div>`).join('')}${table}</div>
            <div class="start-bar" id="resultButtons"></div>
        `;
        document.body.appendChild(overlay);

        const bar = overlay.querySelector('#resultButtons');
        buttons.forEach(entry => {
            const button = document.createElement('button');
            button.className = `start-button${entry.primary ? '' : ' secondary'}`;
            button.innerHTML = ic(entry.icon);
            button.dataset.tip = entry.label;
            button.setAttribute('aria-label', entry.label);
            if (entry.primary) button.dataset.primary = '1';
            button.addEventListener('click', () => {
                window.audioSystem.select();
                this.closeOverlay();
                entry.action();
            });
            bar.appendChild(button);
        });
        this.focusFirst();
    }

    // -------------------------------------------------------------------------
    // Sound buttons
    // -------------------------------------------------------------------------

    /**
     * Update audio button states based on current audio system state
     */
    updateAudioButtonStates() {
        const music = window.audioSystem.isMusicEnabled();
        const sound = window.audioSystem.isEnabled();
        const musicButton = document.getElementById('musicToggleBtn');
        const soundButton = document.getElementById('sfxToggleBtn');
        musicButton.classList.toggle('off', !music);
        musicButton.setAttribute('aria-pressed', String(music));
        musicButton.dataset.tip = music ? 'Music on' : 'Music off';
        soundButton.innerHTML = ic(sound ? 'speaker' : 'mute');
        soundButton.classList.toggle('off', !sound);
        soundButton.setAttribute('aria-pressed', String(sound));
        soundButton.dataset.tip = sound ? 'Effects on' : 'Effects off';
    }

    /**
     * Toggle music on/off
     */
    toggleMusic() {
        window.audioSystem.toggleMusic();
        this.updateAudioButtonStates();
    }

    /**
     * Toggle SFX on/off
     */
    toggleSFX() {
        window.audioSystem.toggle();
        this.updateAudioButtonStates();
    }

    // -------------------------------------------------------------------------
    // Art
    // -------------------------------------------------------------------------

    /**
     * The whole reference, in terms of whatever the player has connected. Used by
     * the Controls page and the pause menu.
     */
    controlsMarkup() {
        const piano = Prompts.usingPiano();
        const cap = text => `<kbd class="cap">${text}</kbd>`;
        const combo = (caps, icon, label) => `
            <span class="combo" data-tip="${label}">${caps}${icon ? ic(icon) : ''}<small>${label}</small></span>`;
        const seconds = ms => `${Math.round(ms / 1000)}s`;
        const move = (entry, keys) => `
            <div class="move">
                ${picture(entry.icon)}
                <div class="move-text"><b>${entry.label}</b><small>${entry.detail}</small></div>
                <div class="move-keys">${keys}</div>
                <div class="move-cost" data-tip="Costs ${entry.cost} harmony, ready again after ${seconds(entry.cooldown)}">
                    <span class="meter"><i style="width:${entry.cost}%"></i></span>
                    <small>${ic('clock')}${seconds(entry.cooldown)}</small>
                </div>
            </div>`;
        const chordKeys = chord => (piano
            ? chord.keys.map(key => cap(Prompts.harmonyKey(key))).join('+')
            : cap(chord.keyHint));
        const chords = Object.values(HARMONY_CONFIG.CHORDS).map(chord => move(chord, chordKeys(chord))).join('');
        const melodies = Object.values(HARMONY_CONFIG.MELODIES)
            .map(melody => move(melody, melody.keys.map(key => cap(Prompts.harmonyKey(key))).join(''))).join('');
        const pickups = Object.values(GAME_CONFIG.POWERUP_TYPES).map(type => `
            <div class="pickup">${picture(type.icon)}<div class="move-text"><b>${type.name}</b><small>${type.detail}</small></div></div>
        `).join('');

        return `
            <section class="wide">
                ${piano ? this.pianoDiagram() : `
                    <div class="combos">
                        ${combo(['W', 'A', 'S', 'D'].map(cap).join(''), null, 'Drive')}
                        ${combo(cap(ic('left')) + cap(ic('right')), null, 'Aim')}
                        ${combo(cap('Space'), null, 'Fire')}
                        ${combo([1, 2, 3, 4, 5].map(cap).join(''), null, 'Harmony')}
                    </div>
                `}
                <div class="combos">
                    ${combo(cap('Esc'), null, 'Pause')}
                    ${combo(cap('R'), null, 'Restart')}
                    ${combo(cap('M'), null, 'Mute')}
                </div>
            </section>
            <section class="wide"><div class="moves">${chords}</div></section>
            <section class="wide"><div class="moves">${melodies}</div></section>
            <section class="wide"><div class="pickups">${pickups}</div></section>
            <section class="wide rhythm">
                <div class="beat-demo"><i></i><i></i><b></b><i></i><i></i></div>
                <small>Fire as the marks meet. Shots on the beat hit harder and fill the gold bar.</small>
            </section>
        `;
    }

    /**
     * One player's octave, drawn as real keys
     */
    pianoDiagram() {
        const whites = [
            ['A', 'Left', 'move'], ['B', 'Down', 'move'], ['C', 'Right', 'move'], ['D', 'Shoot', 'fire'],
            ['E', '1', 'harmony'], ['F', '2', 'harmony'], ['G', '4', 'harmony']
        ];
        const blacks = [
            ['A#', 'Up', 'move', 0], ['C#', 'Aim L', 'fire', 2], ['D#', 'Aim R', 'fire', 3],
            ['F#', '3', 'harmony', 5], ['G#', '5', 'harmony', 6]
        ];
        const white = whites.map(([note, action, kind]) =>
            `<div class="key-white ${kind}"><b>${note}</b>${action}</div>`).join('');
        const black = blacks.map(([note, action, kind, after]) =>
            `<div class="key-black ${kind}" style="left:${((after + 1) / whites.length) * 100 - 5}%"><b>${note}</b>${action}</div>`).join('');
        return `
            <div class="keys">${white}${black}</div>
        `;
    }

    /**
     * Paint a scene onto one of the menu canvases
     * @param {string} id - Canvas id
     * @param {string} themeKey - Key into THEMES
     * @param {Function} draw - Adds things to the scene
     */
    paintScene(id, themeKey, draw) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const box = canvas.parentElement.getBoundingClientRect();
        if (!box.width) return;
        const scale = Math.max(2, Math.round(box.height / 150));
        canvas.width = Math.ceil(box.width / scale);
        canvas.height = Math.ceil(box.height / scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const fake = { themeKey, theme: THEMES[themeKey], at: () => TILES.FLOOR };
        const random = MapArt.seeded(id.length * 991);
        for (let r = 0; r * 16 < canvas.height; r++) {
            for (let c = 0; c * 16 < canvas.width; c++) {
                MapArt.floor(ctx, fake, c, r, c * 16, r * 16, random);
            }
        }
        draw(ctx, canvas.width, canvas.height);
    }

    paintTiles() {
        const stamp = (ctx, palette, x, y, chassis = 'player', eyes = 'cute') => {
            ctx.drawImage(Sprites.tankPreview(palette, chassis, eyes), Math.round(x), Math.round(y));
        };

        this.paintScene('artCampaign', 'ivory', (ctx, w, h) => {
            const cx = w * 0.5;
            const cy = h * 0.5;
            [0, 1, 3, 4, 5].forEach(step => {
                const x = 6 + step * (w / 6);
                ctx.fillStyle = '#15121f';
                ctx.fillRect(x + 1, 0, 15, h * 0.42);
                ctx.fillStyle = '#2a2438';
                ctx.fillRect(x, 0, 15, h * 0.42 - 3);
                ctx.fillStyle = '#3f3754';
                ctx.fillRect(x + 3, 0, 2, h * 0.42 - 6);
            });
            ctx.drawImage(portraitSprite('key89'), Math.round(w * 0.5), 8);
            stamp(ctx, 'blue', w * 0.32, cy);
            stamp(ctx, 'gold', w * 0.08, cy + 12, 'buddy');
            stamp(ctx, 'blood', w * 0.72, cy + 22, 'scout', 'angry');
            ctx.drawImage(Sprites.icon('note'), Math.round(w * 0.58), Math.round(cy - 10));
            ctx.drawImage(Sprites.icon('note'), Math.round(w * 0.22), Math.round(cy - 18));
        });

        this.paintScene('artFFA', 'strings', (ctx, w, h) => {
            const cy = h * 0.4;
            stamp(ctx, 'coral', w * 0.06, cy - 20);
            stamp(ctx, 'lime', w * 0.58, cy - 26);
            stamp(ctx, 'gold', w * 0.14, cy + 22);
            stamp(ctx, 'grape', w * 0.52, cy + 20);
            ctx.drawImage(Sprites.bullet('shot', '#ffd45e'), Math.round(w * 0.46), Math.round(cy + 2));
        });

        this.paintScene('artTDM', 'soundboard', (ctx, w, h) => {
            const cy = h * 0.4;
            stamp(ctx, 'coral', w * 0.06, cy - 22);
            stamp(ctx, 'coral', w * 0.03, cy + 18);
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            stamp(ctx, 'blue', w * 0.06, cy - 22);
            stamp(ctx, 'blue', w * 0.03, cy + 18);
            ctx.restore();
            ctx.fillStyle = OUTLINE_COLOR;
            ctx.fillRect(Math.round(w / 2) - 1, 0, 3, h);
        });
    }

    paintStoryArt() {
        this.paintScene('artStory', 'felt', (ctx, w, h) => {
            ctx.fillStyle = '#0f0b18';
            ctx.fillRect(0, 0, w, h);
            const portraits = ['pip', 'tock', 'clef'];
            portraits.forEach((name, i) => ctx.drawImage(portraitSprite(name), 14 + i * 40, h - 42));
            ctx.drawImage(portraitSprite('key89'), w - 48, 10);
            for (let i = 0; i < 26; i++) {
                ctx.fillStyle = i % 3 ? '#3d3550' : '#ffd45e';
                ctx.fillRect((i * 53) % w, (i * 31) % (h - 40), 2, 2);
            }
        });
    }

    /**
     * The piano along the bottom of the home screen, with each player's octave
     * tinted, the keys that are down lit, and a tank rolling along the top.
     */
    startPianoStrip() {
        const canvas = document.getElementById('pianoStrip');
        const ctx = canvas.getContext('2d');
        const first = 21;
        const last = 108;
        const isBlack = note => [1, 3, 6, 8, 10].includes(note % 12);
        const whiteCount = this.range(first, last).filter(note => !isBlack(note)).length;
        const zones = MIDI_CONFIG.OCTAVE_BASES.map((base, i) => ({ base, palette: TANK_PALETTE_ORDER[i] }));

        const draw = (now) => {
            requestAnimationFrame(draw);
            if (this.currentScreen !== 'home' || window.game) return;
            const box = canvas.getBoundingClientRect();
            if (!box.width) return;
            const width = Math.ceil(box.width / 3);
            const height = Math.ceil(box.height / 3);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = '#2a2640';
            ctx.fillRect(0, 0, width, height);

            const keyTop = 12;
            const whiteWidth = width / whiteCount;
            const keyHeight = height - keyTop;
            let cursor = 0;
            const positions = new Map();
            for (let note = first; note <= last; note++) {
                if (isBlack(note)) continue;
                positions.set(note, cursor);
                cursor += whiteWidth;
            }

            const zoneOf = note => zones.find(zone => note >= zone.base && note < zone.base + 12);
            positions.forEach((x, note) => {
                const left = Math.round(x);
                const right = Math.round(x + whiteWidth);
                const zone = zoneOf(note);
                const lit = this.litNotes.has(note);
                ctx.fillStyle = lit ? '#ffd45e' : (zone ? TANK_PALETTES[zone.palette].h : '#f2e8d2');
                ctx.fillRect(left, keyTop, right - left - 1, keyHeight);
                ctx.fillStyle = OUTLINE_COLOR;
                ctx.fillRect(right - 1, keyTop, 1, keyHeight);
            });
            for (let note = first; note <= last; note++) {
                if (!isBlack(note)) continue;
                const x = positions.get(note - 1) + whiteWidth;
                const blackWidth = Math.max(3, Math.round(whiteWidth * 0.62));
                const zone = zoneOf(note);
                ctx.fillStyle = this.litNotes.has(note) ? '#ffd45e' : (zone ? TANK_PALETTES[zone.palette].d : OUTLINE_COLOR);
                ctx.fillRect(Math.round(x - blackWidth / 2), keyTop, blackWidth, Math.round(keyHeight * 0.6));
            }

            // Little tanks trundling along the lid
            const span = width + 50;
            ['blue', 'coral', 'lime'].forEach((palette, i) => {
                const x = ((now / 40 + i * span / 3) % span) - 24;
                const frame = Math.floor(now / 120) % 2;
                ctx.drawImage(Sprites.hull('buddy', palette, 0, frame), Math.round(x), keyTop - 15);
                const y = keyTop - 6;
                drawTankBarrel(ctx, Math.round(x) + 9, y, 0, CHASSIS.buddy, TANK_PALETTES[palette], 'single');
                const dome = Sprites.dome('buddy', palette);
                ctx.drawImage(dome, Math.round(x) + 5, y - 4);
            });
        };
        requestAnimationFrame(draw);
    }
}

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
                window.menu.restartCurrent();
            } else if (window.menu && window.menu.restartWithLastSettings) {
                // From menu: relaunch last settings
                window.menu.restartWithLastSettings();
            }
        }
    });
})();

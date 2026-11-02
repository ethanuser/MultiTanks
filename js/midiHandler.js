// =============================================================================
// MIDI INPUT HANDLER
// =============================================================================
// Handles MIDI input from WebMidi.js and converts to game controls

class MidiHandler {
    constructor() {
        this.isConnected = false;
        this.inputs = [];
        this.controlCallbacks = new Map(); // Map of control events to callback functions
        this.noteListeners = [];           // Hear every key, mapped or not
        this.debugMode = false;
        this.keyboardFallback = false;
        this.aimMode = loadSaved('multitanks.aim', 'mouse');
        this.keyboardMapping = this.createKeyboardMapping();
        this.keyboardBound = false;
        this.heldKeys = new Set();
    }

    /**
     * Initialize MIDI connection
     * @param {boolean} debugMode - Enable debug logging
     * @returns {Promise<boolean>} Success status
     */
    async initialize(debugMode = false) {
        this.debugMode = debugMode;

        // The computer keyboard always works for player 1, piano or not
        this.setupKeyboardListeners();

        try {
            if (typeof WebMidi === 'undefined') {
                this.log('⚠️ WebMidi.js library not loaded, enabling keyboard fallback');
                this.enableKeyboardFallback();
                return true;
            }

            await WebMidi.enable();

            if (WebMidi.inputs.length === 0) {
                this.log('⚠️ No MIDI input devices detected, enabling keyboard fallback');
                this.enableKeyboardFallback();
                return true;
            }

            // Add listeners to all inputs
            WebMidi.inputs.forEach((input, index) => {
                this.log(`🔌 Connected to: ${input.name || `Input ${index + 1}`}`);

                input.removeListener();
                input.addListener('noteon', (e) => this.handleNoteOn(e));
                input.addListener('noteoff', (e) => this.handleNoteOff(e));
            });

            this.isConnected = true;
            this.inputs = Array.from(WebMidi.inputs);
            this.keyboardFallback = false;
            this.log('✅ MIDI initialized successfully!');
            return true;

        } catch (error) {
            this.log(`❌ MIDI Error: ${error.message}, enabling keyboard fallback`);
            this.enableKeyboardFallback();
            return true;
        }
    }

    /**
     * Handle note on events
     * @param {Object} event - WebMidi note on event
     */
    handleNoteOn(event) {
        const noteNumber = event.note.number;
        // How hard the key was struck, from 0 to 1
        const velocity = event.note.attack ?? event.value ?? event.velocity ?? 0.6;

        if (this.debugMode) {
            this.log(`🎹 Note ON: ${noteNumber} (${event.note.name}) - Velocity: ${velocity.toFixed(2)}`);
        }

        this.noteListeners.forEach(listener => listener(noteNumber, true, velocity));
        this.processControl(noteNumber, true, velocity);
    }

    /**
     * Handle note off events
     * @param {Object} event - WebMidi note off event
     */
    handleNoteOff(event) {
        const noteNumber = event.note.number;

        if (this.debugMode) {
            this.log(`🔇 Note OFF: ${noteNumber} (${event.note.name}) - Released`);
        }

        this.noteListeners.forEach(listener => listener(noteNumber, false, 0));
        this.processControl(noteNumber, false, 0);
    }

    /**
     * Process MIDI control input
     * @param {number} noteNumber - MIDI note number
     * @param {boolean} isPressed - Whether the note is pressed or released
     * @param {number} velocity - Note velocity (0-1)
     */
    processControl(noteNumber, isPressed, velocity) {
        const playerIndex = getPlayerFromNote(noteNumber);
        const control = getControlFromNote(noteNumber);

        if (playerIndex === null || control === null) {
            if (this.debugMode) {
                this.log(`🎵 Unknown note: ${noteNumber}`);
            }
            return;
        }

        // Create control event
        const controlEvent = {
            playerIndex: playerIndex,
            control: control,
            isPressed: isPressed,
            velocity: velocity,
            noteNumber: noteNumber,
            timestamp: Date.now()
        };

        // Trigger callbacks
        this.triggerCallbacks(controlEvent);
    }

    /**
     * Register a callback for control events, replacing any under the same tag so
     * that a new game does not stack up on top of the last one's listeners
     * @param {string} eventType - Event type ('movement', 'turret', 'harmony', 'all')
     * @param {Function} callback - Callback function
     * @param {string} tag - Identifies who is listening
     */
    onControl(eventType, callback, tag = null) {
        if (!this.controlCallbacks.has(eventType)) {
            this.controlCallbacks.set(eventType, []);
        }
        const list = this.controlCallbacks.get(eventType);
        if (tag) {
            const existing = list.findIndex(entry => entry.tag === tag);
            if (existing >= 0) list.splice(existing, 1);
        }
        list.push({ callback, tag });
    }

    /**
     * Listen to every note, whether or not it maps to a control
     * @param {Function} listener - Called with (noteNumber, isPressed, velocity)
     */
    onNote(listener) {
        this.noteListeners.push(listener);
    }

    /**
     * Trigger callbacks for a control event
     * @param {Object} controlEvent - Control event object
     */
    triggerCallbacks(controlEvent) {
        const callbacks = this.controlCallbacks.get('all') || [];
        callbacks.forEach(entry => entry.callback(controlEvent));

        // Determine control type and trigger specific callbacks
        let controlType = null;
        if (isMovementControl(controlEvent.control)) {
            controlType = 'movement';
        } else if (isTurretControl(controlEvent.control)) {
            controlType = 'turret';
        } else if (isHarmonyControl(controlEvent.control)) {
            controlType = 'harmony';
        }

        if (controlType) {
            const typeCallbacks = this.controlCallbacks.get(controlType) || [];
            typeCallbacks.forEach(entry => entry.callback(controlEvent));
        }
    }

    /**
     * Get number of connected devices
     * @returns {number} Number of devices
     */
    getDeviceCount() {
        return this.inputs.length;
    }

    /**
     * Get device names
     * @returns {Array<string>} Array of device names
     */
    getDeviceNames() {
        return this.inputs.map(input => input.name || 'Unknown Device');
    }

    /**
     * Log message (only if debug mode is enabled)
     * @param {string} message - Message to log
     */
    log(message) {
        if (this.debugMode) {
            console.log(`[MIDI] ${message}`);
        }
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Debug mode status
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Create keyboard mapping for fallback
     * @returns {Object} Keyboard mapping object
     */
    createKeyboardMapping() {
        return {
            // Player 0 controls (WASD + Arrow keys)
            'KeyW': { player: 0, control: 'A_SHARP' }, // Up
            'KeyA': { player: 0, control: 'A' },       // Left
            'KeyS': { player: 0, control: 'B' },       // Down
            'KeyD': { player: 0, control: 'C' },       // Right
            'ArrowUp': { player: 0, control: 'A_SHARP' },    // Up (alternative)
            'ArrowDown': { player: 0, control: 'B' },        // Down (alternative)
            // Aim, unless the mouse is doing that, when these drive as well
            'ArrowLeft': { player: 0, control: this.aimMode === 'mouse' ? 'A' : 'C_SHARP' },
            'ArrowRight': { player: 0, control: this.aimMode === 'mouse' ? 'C' : 'D_SHARP' },

            'Space': { player: 0, control: 'D' },
            'Enter': { player: 0, control: 'D' }, // Also turns dialogue pages

            // Number keys are the five harmony keys, for playing melodies
            'Digit1': { player: 0, control: 'E' },
            'Digit2': { player: 0, control: 'F' },
            'Digit3': { player: 0, control: 'F_SHARP' },
            'Digit4': { player: 0, control: 'G' },
            'Digit5': { player: 0, control: 'G_SHARP' },

            // Chord shortcuts
            'KeyQ': { player: 0, chord: 'shield' },
            'ShiftLeft': { player: 0, chord: 'dash' },
            'KeyE': { player: 0, chord: 'blast' },
            'KeyF': { player: 0, chord: 'heal' }
        };
    }

    /**
     * Choose how the computer player aims
     * @param {string} mode - 'mouse' or 'keys'
     */
    setAimMode(mode) {
        this.aimMode = mode;
        storeSaved('multitanks.aim', mode);
        this.keyboardMapping = this.createKeyboardMapping();
    }

    /**
     * The mouse button fires, alongside Space and Enter
     */
    pressMouse(isPressed) {
        if (isPressed) this.heldKeys.add('Mouse');
        else this.heldKeys.delete('Mouse');
        if (!isPressed && (this.heldKeys.has('Space') || this.heldKeys.has('Enter'))) return;
        this.emitKeyboard({ player: 0, control: 'D' }, isPressed);
    }

    /**
     * Enable keyboard fallback mode
     */
    enableKeyboardFallback() {
        this.keyboardFallback = true;
        this.isConnected = false;
        this.inputs = [];
        this.log('⌨️ Keyboard fallback enabled');
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardListeners() {
        if (this.keyboardBound) return;
        this.keyboardBound = true;
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        // Keys released while the window is out of focus would otherwise stick
        window.addEventListener('blur', () => this.resetAllControls());
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        const mapping = this.keyboardMapping[event.code];
        if (!mapping || !window.game) return;
        if (event.target && event.target.tagName === 'INPUT') return;

        event.preventDefault();
        if (event.repeat || this.heldKeys.has(event.code)) return;
        this.heldKeys.add(event.code);

        this.emitKeyboard(mapping, true);
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        const mapping = this.keyboardMapping[event.code];
        if (!mapping) return;

        this.heldKeys.delete(event.code);
        if (!window.game) return;

        event.preventDefault();

        // Space, Enter and the mouse share a control: keep firing if another is held
        if (mapping.control === 'D' && ['Space', 'Enter', 'Mouse'].some(code => this.heldKeys.has(code))) return;
        this.emitKeyboard(mapping, false);
    }

    emitKeyboard(mapping, isPressed) {
        this.triggerCallbacks({
            playerIndex: mapping.player,
            control: mapping.control || `CHORD_${mapping.chord}`,
            chord: mapping.chord || null,
            isPressed: isPressed,
            velocity: isPressed ? 0.6 : 0,
            noteNumber: 0, // Not applicable for keyboard
            timestamp: Date.now()
        });
    }

    /**
     * Get connection status (true if MIDI connected OR keyboard fallback active)
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
        return this.isConnected || this.keyboardFallback;
    }

    /**
     * Get input method description
     * @returns {string} Input method description
     */
    getInputMethod() {
        if (this.isConnected) {
            return `MIDI (${this.inputs.length} device${this.inputs.length !== 1 ? 's' : ''})`;
        } else if (this.keyboardFallback) {
            return 'Keyboard';
        } else {
            return 'None';
        }
    }

    /**
     * Reset all controls (send release events for all possible controls)
     * This is useful when the game restarts to clear any stuck keys
     */
    resetAllControls() {
        this.log('🔄 Resetting all controls...');
        this.heldKeys.clear();

        // Send release events for all possible player controls
        for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
            Object.keys(MIDI_CONFIG.NOTE_OFFSETS).forEach(control => {
                this.triggerCallbacks({
                    playerIndex: playerIndex,
                    control: control,
                    isPressed: false,
                    velocity: 0,
                    noteNumber: 0, // Not applicable for reset
                    timestamp: Date.now()
                });
            });
        }

        this.log('✅ All controls reset');
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (typeof WebMidi !== 'undefined' && WebMidi.enabled) {
            WebMidi.inputs.forEach(input => input.removeListener());
        }
        this.isConnected = false;
        this.keyboardFallback = false;
        this.inputs = [];
        this.controlCallbacks.clear();
        this.log('🔌 MIDI disconnected');
    }
}

// =============================================================================
// GLOBAL MIDI HANDLER INSTANCE
// =============================================================================
// Create a global instance that can be used throughout the application
window.midiHandler = new MidiHandler();

// =============================================================================
// PROMPTS
// =============================================================================
// Anything on screen that names a control comes through here, so that it speaks
// in terms of whatever the player actually has under their hands. Text can carry
// tokens like {shoot}, {chord:shield} or {melody:rally}, filled in by fill().
const Prompts = {
    usingPiano() {
        return !!(window.midiHandler && window.midiHandler.isConnected);
    },

    drive() {
        return this.usingPiano() ? 'A, A#, B and C' : 'W A S D';
    },

    /**
     * Is the first player aiming with the mouse? Not while there is a piano to play.
     */
    usesMouse() {
        return !this.usingPiano() && !!window.midiHandler && window.midiHandler.aimMode === 'mouse';
    },

    aim() {
        if (this.usingPiano()) return 'C# and D#';
        return this.usesMouse() ? 'the mouse' : 'the Left and Right arrows';
    },

    shoot() {
        if (this.usingPiano()) return 'D';
        return this.usesMouse() ? 'click or Space' : 'Space';
    },

    /**
     * The key for one of the five harmony keys
     * @param {number} number - 1 to 5
     */
    harmonyKey(number) {
        return this.usingPiano() ? MIDI_CONFIG.NOTE_LABELS[HARMONY_KEYS[number - 1]] : String(number);
    },

    harmonyKeys() {
        return this.usingPiano() ? 'E, F, F#, G and G#' : 'the number keys 1 to 5';
    },

    chord(name) {
        const chord = HARMONY_CONFIG.CHORDS[name];
        if (!this.usingPiano()) return chord.keyHint;
        return `${chord.keys.map(key => this.harmonyKey(key)).join(' + ')} together`;
    },

    tune(keys) {
        return keys.map(key => this.harmonyKey(key)).join(', ');
    },

    melody(name) {
        return this.tune(HARMONY_CONFIG.MELODIES[name].keys);
    },

    fill(text) {
        return text.replace(/\{(\w+)(?::(\w+))?\}/g, (token, kind, name) => {
            if (kind === 'chord') return this.chord(name);
            if (kind === 'melody') return this.melody(name);
            return this[kind] ? this[kind]() : token;
        });
    }
};

window.Prompts = Prompts;

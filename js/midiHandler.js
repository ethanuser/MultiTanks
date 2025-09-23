// =============================================================================
// MIDI INPUT HANDLER
// =============================================================================
// Handles MIDI input from WebMidi.js and converts to game controls

class MidiHandler {
    constructor() {
        this.isConnected = false;
        this.inputs = [];
        this.controlCallbacks = new Map(); // Map of control events to callback functions
        this.debugMode = false;
        this.keyboardFallback = false;
        this.keyboardMapping = this.createKeyboardMapping();
    }

    /**
     * Initialize MIDI connection
     * @param {boolean} debugMode - Enable debug logging
     * @returns {Promise<boolean>} Success status
     */
    async initialize(debugMode = false) {
        this.debugMode = debugMode;
        
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

            // Clear previous listeners
            WebMidi.removeListener();

            // Add listeners to all inputs
            WebMidi.inputs.forEach((input, index) => {
                this.log(`🔌 Connected to: ${input.name || `Input ${index + 1}`}`);
                
                input.addListener('noteon', 'all', (e) => this.handleNoteOn(e));
                input.addListener('noteoff', 'all', (e) => this.handleNoteOff(e));
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
        const velocity = event.velocity;
        
        if (this.debugMode) {
            this.log(`🎹 Note ON: ${noteNumber} (${event.note.name}) - Velocity: ${velocity.toFixed(2)}`);
        }

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
     * Register a callback for control events
     * @param {string} eventType - Event type ('movement', 'turret', 'all')
     * @param {Function} callback - Callback function
     */
    onControl(eventType, callback) {
        if (!this.controlCallbacks.has(eventType)) {
            this.controlCallbacks.set(eventType, []);
        }
        this.controlCallbacks.get(eventType).push(callback);
    }

    /**
     * Trigger callbacks for a control event
     * @param {Object} controlEvent - Control event object
     */
    triggerCallbacks(controlEvent) {
        const callbacks = this.controlCallbacks.get('all') || [];
        callbacks.forEach(callback => callback(controlEvent));

        // Determine control type and trigger specific callbacks
        let controlType = null;
        if (isMovementControl(controlEvent.control)) {
            controlType = 'movement';
        } else if (isTurretControl(controlEvent.control)) {
            controlType = 'turret';
        }

        if (controlType) {
            const typeCallbacks = this.controlCallbacks.get(controlType) || [];
            typeCallbacks.forEach(callback => callback(controlEvent));
        }
    }

    /**
     * Get connection status
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
        return this.isConnected;
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
            'ArrowLeft': { player: 0, control: 'C_SHARP' },  // Aim Left
            'ArrowRight': { player: 0, control: 'D_SHARP' }, // Aim Right
            'Space': { player: 0, control: 'D' },      // Shoot
            'ArrowUp': { player: 0, control: 'A_SHARP' },    // Up (alternative)
            'ArrowDown': { player: 0, control: 'B' },        // Down (alternative)
        };
    }

    /**
     * Enable keyboard fallback mode
     */
    enableKeyboardFallback() {
        this.keyboardFallback = true;
        this.isConnected = false;
        this.inputs = [];
        this.setupKeyboardListeners();
        this.log('⌨️ Keyboard fallback enabled');
    }

    /**
     * Setup keyboard event listeners
     */
    setupKeyboardListeners() {
        // Remove existing listeners
        this.removeKeyboardListeners();
        
        // Add new listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    /**
     * Remove keyboard event listeners
     */
    removeKeyboardListeners() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (!this.keyboardFallback) return;
        
        const mapping = this.keyboardMapping[event.code];
        if (!mapping) return;

        event.preventDefault();
        
        if (this.debugMode) {
            this.log(`⌨️ Key DOWN: ${event.code} - Player ${mapping.player} ${mapping.control}`);
        }

        // Create control event similar to MIDI
        const controlEvent = {
            playerIndex: mapping.player,
            control: mapping.control,
            isPressed: true,
            velocity: 1.0,
            noteNumber: 0, // Not applicable for keyboard
            timestamp: Date.now()
        };

        this.triggerCallbacks(controlEvent);
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        if (!this.keyboardFallback) return;
        
        const mapping = this.keyboardMapping[event.code];
        if (!mapping) return;

        event.preventDefault();
        
        if (this.debugMode) {
            this.log(`⌨️ Key UP: ${event.code} - Player ${mapping.player} ${mapping.control}`);
        }

        // Create control event similar to MIDI
        const controlEvent = {
            playerIndex: mapping.player,
            control: mapping.control,
            isPressed: false,
            velocity: 0,
            noteNumber: 0, // Not applicable for keyboard
            timestamp: Date.now()
        };

        this.triggerCallbacks(controlEvent);
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
            return 'Keyboard (WASD + Arrow Keys)';
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
        
        // Send release events for all possible player controls
        for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
            const controls = ['A_SHARP', 'A', 'B', 'C', 'C_SHARP', 'D', 'D_SHARP'];
            
            controls.forEach(control => {
                const controlEvent = {
                    playerIndex: playerIndex,
                    control: control,
                    isPressed: false,
                    velocity: 0,
                    noteNumber: 0, // Not applicable for reset
                    timestamp: Date.now()
                };
                
                this.triggerCallbacks(controlEvent);
            });
        }
        
        this.log('✅ All controls reset');
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (typeof WebMidi !== 'undefined') {
            WebMidi.removeListener();
        }
        this.removeKeyboardListeners();
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

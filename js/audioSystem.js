// =============================================================================
// AUDIO SYSTEM FOR MULTITANKS
// =============================================================================
// Handles sound effects and background music

const AudioSys = (() => {
    // Audio constants
    const AUDIO_CONFIG = {
        MASTER_GAIN: 0.2,
        TONE_PEAK_GAIN: 0.48,
        TONE2_PEAK_GAIN: 0.48,
        KICK_PEAK_GAIN: 1.44,
        HAT_PEAK_GAIN: 0.4,
        BASS_PEAK_GAIN: 0.64,
        MUSIC_VOLUME: 0.8,
        TONE_ATTACK_TIME: 0.02,
        TONE2_ATTACK_TIME: 0.015,
        KICK_ATTACK_TIME: 0.008,
        HAT_ATTACK_TIME: 0.004,
        BASS_ATTACK_TIME: 0.02,
        TONE_DURATION_OFFSET: 0.02,
        KICK_DURATION: 0.25,
        HAT_DURATION: 0.05,
        BASS_DURATION: 0.25,
        KICK_FREQ_START: 150,
        KICK_FREQ_END: 55,
        HAT_FREQ: 8000,
        KICK_DECAY_TIME: 0.12,
        KICK_DECAY_END: 0.22,
        HAT_DECAY_TIME: 0.03,
        BASS_DECAY_TIME: 0.22
    };
    
    let ctx = null, master = null, gain = AUDIO_CONFIG.MASTER_GAIN, enabled = true;
    let musicEl = null, musicEnabled = true;
    
    function ensure() { 
        if (!ctx) { 
            ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            master = ctx.createGain(); 
            master.gain.value = gain; 
            master.connect(ctx.destination);
        } 
    }
    
    async function resumeContext() {
        ensure();
        if (ctx && ctx.state === 'suspended') {
            try { await ctx.resume(); } catch (_) {}
        }
    }
    
    function playTone(freq, dur = 0.12) { 
        if (!enabled || !ctx || !freq) return; 
        const o = ctx.createOscillator(); 
        const g = ctx.createGain(); 
        o.type = 'sine'; 
        o.frequency.value = freq; 
        g.gain.setValueAtTime(0.0001, ctx.currentTime); 
        g.gain.linearRampToValueAtTime(AUDIO_CONFIG.TONE_PEAK_GAIN, ctx.currentTime + AUDIO_CONFIG.TONE_ATTACK_TIME); 
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); 
        o.connect(g); 
        g.connect(master); 
        o.start(); 
        o.stop(ctx.currentTime + dur + AUDIO_CONFIG.TONE_DURATION_OFFSET); 
    }
    
    function playTone2(freq, dur = 0.1, mul = 0.6) { 
        if (!enabled || !ctx || !freq) return; 
        const o = ctx.createOscillator(); 
        const g = ctx.createGain(); 
        o.type = 'square'; 
        o.frequency.value = freq; 
        g.gain.setValueAtTime(0.0001, ctx.currentTime); 
        g.gain.linearRampToValueAtTime(AUDIO_CONFIG.TONE2_PEAK_GAIN * (mul || 1), ctx.currentTime + AUDIO_CONFIG.TONE2_ATTACK_TIME); 
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); 
        o.connect(g); 
        g.connect(master); 
        o.start(); 
        o.stop(ctx.currentTime + dur + AUDIO_CONFIG.TONE_DURATION_OFFSET); 
    }
    
    function playKick() { 
        if (!enabled || !ctx) return; 
        const o = ctx.createOscillator(); 
        const g = ctx.createGain(); 
        o.type = 'sine'; 
        o.frequency.setValueAtTime(AUDIO_CONFIG.KICK_FREQ_START, ctx.currentTime); 
        o.frequency.exponentialRampToValueAtTime(AUDIO_CONFIG.KICK_FREQ_END, ctx.currentTime + AUDIO_CONFIG.KICK_DECAY_TIME); 
        g.gain.setValueAtTime(0.0001, ctx.currentTime); 
        g.gain.linearRampToValueAtTime(AUDIO_CONFIG.KICK_PEAK_GAIN, ctx.currentTime + AUDIO_CONFIG.KICK_ATTACK_TIME); 
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + AUDIO_CONFIG.KICK_DECAY_END); 
        o.connect(g); 
        g.connect(master); 
        o.start(); 
        o.stop(ctx.currentTime + AUDIO_CONFIG.KICK_DURATION); 
    }
    
    function playHat() { 
        if (!enabled || !ctx) return; 
        const o = ctx.createOscillator(); 
        const g = ctx.createGain(); 
        o.type = 'square'; 
        o.frequency.value = AUDIO_CONFIG.HAT_FREQ; 
        g.gain.setValueAtTime(0.0001, ctx.currentTime); 
        g.gain.linearRampToValueAtTime(AUDIO_CONFIG.HAT_PEAK_GAIN, ctx.currentTime + AUDIO_CONFIG.HAT_ATTACK_TIME); 
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + AUDIO_CONFIG.HAT_DECAY_TIME); 
        o.connect(g); 
        g.connect(master); 
        o.start(); 
        o.stop(ctx.currentTime + AUDIO_CONFIG.HAT_DURATION); 
    }
    
    function playBass(freq) { 
        if (!enabled || !ctx || !freq) return; 
        const o = ctx.createOscillator(); 
        const g = ctx.createGain(); 
        o.type = 'triangle'; 
        o.frequency.value = freq; 
        g.gain.setValueAtTime(0.0001, ctx.currentTime); 
        g.gain.linearRampToValueAtTime(AUDIO_CONFIG.BASS_PEAK_GAIN, ctx.currentTime + AUDIO_CONFIG.BASS_ATTACK_TIME); 
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + AUDIO_CONFIG.BASS_DECAY_TIME); 
        o.connect(g); 
        g.connect(master); 
        o.start(); 
        o.stop(ctx.currentTime + AUDIO_CONFIG.BASS_DURATION); 
    }
    
    // =============================================================================
    // TANK GAME SOUND EFFECTS
    // =============================================================================
    
    function shoot() { 
        playTone(740, 0.1); 
    }
    
    function hit() { 
        playTone(1480, 0.2); 
        playTone2(1480, 0.2, 0.4);
    }
    
    function hurt() { 
        playTone2(220.00, 0.15); 
        playTone2(230.00, 0.2, 0.4); 
    }
    
    function enemyDeath() { 
        // Simulate a crash/explosion: combine a hat, a low kick, and a high-pitched burst
        playHat(1000, 0.08); 
        playKick(); 
        playTone2(2960, 0.18, 0.5); // sharp burst
        playTone(370, 0.22); // low rumble
    }
    
    function death() { 
        playTone2(110.00, 0.3); 
        playTone2(98.00, 0.4, 0.6); 
    }
    
    function powerUp() { 
        // Resonant chord
        playTone(740.0, 0.3); // F#
        playTone(1109.0, 0.3); // C#
        playTone(1480.0, 0.3); // F#
    }
    
    function levelClear() { 
        // Major chord
        playTone(523.25, 0.8); // C
        playTone(659.25, 0.8); // E  
        playTone(783.99, 0.8); // G
    }
    
    function gameStart() {
        // Victory fanfare
        playTone(523.25, 0.2); // C
        playTone(659.25, 0.2); // E
        playTone(783.99, 0.2); // G
        playTone(1046.50, 0.4); // C (octave)
    }
    
    function tankMove() {
        // Subtle movement sound
        playTone(220, 0.05);
    }
    
    function turretRotate() {
        // Subtle turret rotation sound
        playTone(330, 0.03);
    }
    
    // =============================================================================
    // BACKGROUND MUSIC
    // =============================================================================
    
    function _ensureMusic(trackName) { 
        const musicPath = `music/${trackName}`;
        if (!musicEl || musicEl.src !== `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '')}/${musicPath}`) {
            if (musicEl) { 
                musicEl.pause(); 
            }
            musicEl = new Audio(musicPath); 
            musicEl.volume = AUDIO_CONFIG.MUSIC_VOLUME; 
        }
    }
    
    async function playMusic(trackName = 'battle_theme.mp3', shouldLoop = true) { 
        if (!musicEnabled) return; // Don't play music if disabled
        _ensureMusic(trackName); 
        await resumeContext();
        if (musicEl) {
            musicEl.loop = !!shouldLoop;
        }
        try {
            await musicEl.play();
        } catch (_) {
            // Autoplay may be blocked until user gesture; silently ignore
        }
    }
    
    function stopMusic() { 
        if (musicEl) { 
            musicEl.pause(); 
            musicEl.currentTime = 0; 
        } 
    }
    
    function setMusicVolume(volume) {
        if (musicEl) {
            musicEl.volume = Math.max(0, Math.min(1, volume));
        }
    }
    
    function setMasterVolume(volume) {
        gain = Math.max(0, Math.min(1, volume));
        if (master) {
            master.gain.value = gain;
        }
    }
    
    // =============================================================================
    // PUBLIC API
    // =============================================================================
    
    return {
        // Sound effects
        shoot, hit, hurt, enemyDeath, death, powerUp, levelClear, gameStart, tankMove, turretRotate,
        
        // Music
        playMusic, stopMusic, setMusicVolume,
        
        // Audio control
        toggle() { 
            enabled = !enabled; 
            return enabled; 
        },
        toggleMusic() {
            musicEnabled = !musicEnabled;
            if (!musicEnabled && musicEl) {
                musicEl.pause();
            }
            return musicEnabled;
        },
        setMasterVolume,
        resume: resumeContext,
        isEnabled() { 
            return enabled; 
        },
        isMusicEnabled() {
            return musicEnabled;
        },
        
        // Initialization
        init() { 
            ensure(); 
        }
    };
})();

// =============================================================================
// GLOBAL AUDIO SYSTEM INSTANCE
// =============================================================================
window.audioSystem = AudioSys;

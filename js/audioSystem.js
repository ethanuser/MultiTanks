// =============================================================================
// AUDIO SYSTEM FOR MULTITANKS
// =============================================================================
// Handles sound effects, background music and the chiptune sequencer

const NOTE_NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteToFrequency(name) {
    const octave = parseInt(name.slice(-1), 10);
    const semitone = NOTE_NAMES[name.slice(0, -1)];
    return 440 * Math.pow(2, ((octave + 1) * 12 + semitone - 69) / 12);
}

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function noteToMidi(name) {
    const octave = parseInt(name.slice(-1), 10);
    return (octave + 1) * 12 + NOTE_NAMES[name.slice(0, -1)];
}

// Semitones above the root of each kind of chord
const CHORD_SHAPES = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10],
    aug: [0, 4, 8], dim: [0, 3, 6], sus: [0, 5, 7]
};

// Which instrument plays, how loud, and whether it rings on through the echo
const VOICES = {
    piano: { level: 0.2 },
    bell: { level: 0.2, echo: true },
    flute: { level: 0.17, echo: true },
    soft: { level: 0.2, echo: true },
    pulse: { level: 0.1, echo: true },
    thin: { level: 0.075 },
    saw: { level: 0.085, echo: true },
    pluck: { level: 0.13 }
};

const AudioSys = (() => {
    // Audio constants
    const AUDIO_CONFIG = {
        MASTER_GAIN: 0.22,
        CHIP_GAIN: 0.46,
        MUSIC_VOLUME: 0.7,
        SCHEDULE_AHEAD_S: 0.14,
        ECHO_FEEDBACK: 0.32,
        ECHO_LEVEL: 0.24,
        SFX_MIN_GAP_MS: 45
    };

    const saved = loadSaved('multitanks.audio', {});
    let ctx = null, master = null, musicBus = null, echoBus = null, echoDelay = null, noiseBuffer = null;
    let thinWave = null;
    let sfxVolume = saved.sfxVolume ?? 1;
    let musicVolume = saved.musicVolume ?? AUDIO_CONFIG.MUSIC_VOLUME;
    let enabled = saved.enabled ?? true;
    let musicEnabled = saved.musicEnabled ?? true;
    let arenaMusic = saved.arenaMusic ?? 'chiptune';
    let musicEl = null, currentTrack = null;
    let song = null, songStep = -1;
    let freeTimer = null, freeStart = 0;   // Songs that play with no game to keep time
    let uiDegree = 3;
    const lastPlayed = new Map();

    function persist() {
        storeSaved('multitanks.audio', { sfxVolume, musicVolume, enabled, musicEnabled, arenaMusic });
    }

    function ensure() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = AUDIO_CONFIG.MASTER_GAIN * sfxVolume;
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = musicEnabled ? AUDIO_CONFIG.CHIP_GAIN * musicVolume : 0;

        // A limiter, as a full band can add up to more than the speakers can take
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.ratio.value = 6;
        musicBus.connect(limiter);
        limiter.connect(ctx.destination);

        // A dotted echo gives the lead some room, timed to the tempo by playSong
        echoBus = ctx.createGain();
        echoBus.gain.value = AUDIO_CONFIG.ECHO_LEVEL;
        echoDelay = ctx.createDelay(1.5);
        const feedback = ctx.createGain();
        feedback.gain.value = AUDIO_CONFIG.ECHO_FEEDBACK;
        echoBus.connect(echoDelay);
        echoDelay.connect(feedback);
        feedback.connect(echoDelay);
        echoDelay.connect(musicBus);

        // A narrow pulse wave, the classic thin chiptune sound
        const harmonics = 24;
        const real = new Float32Array(harmonics);
        const imag = new Float32Array(harmonics);
        for (let n = 1; n < harmonics; n++) real[n] = Math.sin(Math.PI * n * 0.25) / n;
        thinWave = ctx.createPeriodicWave(real, imag);

        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }

    async function resumeContext() {
        ensure();
        if (ctx && ctx.state === 'suspended') {
            try { await ctx.resume(); } catch (_) {}
        }
    }

    function throttled(name) {
        const now = performance.now();
        if (now - (lastPlayed.get(name) || 0) < AUDIO_CONFIG.SFX_MIN_GAP_MS) return true;
        lastPlayed.set(name, now);
        return false;
    }

    /**
     * Play one synthesized voice
     */
    function voice(bus, type, freq, peak, dur, when = 0, slideTo = 0) {
        if (!ctx || !freq) return;
        const t = ctx.currentTime + when;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    function noise(bus, peak, dur, when = 0, tone = 4000) {
        if (!ctx) return;
        const t = ctx.currentTime + when;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        source.buffer = noiseBuffer;
        filter.type = 'lowpass';
        filter.frequency.value = tone;
        g.gain.setValueAtTime(peak, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        source.connect(filter);
        filter.connect(g);
        g.connect(bus);
        source.start(t);
        source.stop(t + dur + 0.02);
    }

    function sfx(type, freq, peak, dur, when = 0, slideTo = 0) {
        if (enabled) voice(master, type, freq, peak, dur, when, slideTo);
    }

    function sfxNoise(peak, dur, when = 0, tone = 4000) {
        if (enabled) noise(master, peak, dur, when, tone);
    }

    // =============================================================================
    // TANK GAME SOUND EFFECTS
    // =============================================================================

    // A soft struck-string voice for anything played on the piano
    function pianoNote(midi, velocity = 0.7, dur = 0.7) {
        const freq = midiToFrequency(midi);
        sfx('triangle', freq, 0.5 * velocity, dur);
        sfx('sine', freq * 2, 0.22 * velocity, dur * 0.6);
        sfx('sine', freq * 3, 0.08 * velocity, dur * 0.3);
    }

    function shoot(onBeat = false) {
        if (throttled('shoot')) return;
        sfx('square', 587, 0.18, 0.09, 0, 350);
        if (onBeat) sfx('sine', 1174, 0.26, 0.16);
    }

    function enemyShoot() {
        if (throttled('enemyShoot')) return;
        sfx('square', 233, 0.09, 0.08, 0, 160);
    }

    function hit() {
        if (throttled('hit')) return;
        sfx('square', 1200, 0.14, 0.06, 0, 700);
    }

    function hurt() {
        if (throttled('hurt')) return;
        sfx('square', 220, 0.34, 0.15, 0, 130);
        sfx('square', 233, 0.2, 0.15);
    }

    function enemyDeath() {
        sfxNoise(0.5, 0.24, 0, 2600);
        sfx('sine', 150, 0.7, 0.2, 0, 50);
        sfx('square', 880, 0.14, 0.14, 0.04, 220);
    }

    function death() {
        sfxNoise(0.7, 0.4, 0, 1400);
        sfx('square', 196, 0.34, 0.4, 0, 60);
    }

    function powerUp() {
        [659, 880, 1109, 1319].forEach((freq, i) => sfx('square', freq, 0.16, 0.12, i * 0.05));
    }

    function crate() {
        sfxNoise(0.34, 0.1, 0, 900);
        sfx('square', 160, 0.2, 0.08, 0, 90);
    }

    function levelClear() {
        [523, 659, 784, 1047].forEach((freq, i) => sfx('square', freq, 0.3, 0.28, i * 0.09));
        sfx('triangle', 262, 0.5, 0.7, 0.27);
    }

    function gameStart() {
        [392, 523, 659].forEach((freq, i) => sfx('square', freq, 0.2, 0.14, i * 0.08));
    }

    function chord(midiNotes, velocity = 0.8) {
        midiNotes.forEach((note, i) => {
            const freq = midiToFrequency(note);
            sfx('triangle', freq, 0.4 * velocity, 0.9, i * 0.012);
            sfx('sine', freq * 2, 0.16 * velocity, 0.5, i * 0.012);
        });
    }

    function shieldUp() {
        sfx('sine', 440, 0.3, 0.3, 0, 880);
        sfx('sine', 660, 0.2, 0.35, 0.03, 1320);
    }

    function shieldBlock() {
        if (throttled('block')) return;
        sfx('triangle', 1760, 0.18, 0.1);
    }

    function dash() {
        for (let i = 0; i < 5; i++) sfx('triangle', 523 * Math.pow(2, i / 5), 0.14, 0.09, i * 0.028);
    }

    function blast() {
        sfxNoise(0.8, 0.45, 0, 1200);
        sfx('sine', 110, 0.9, 0.4, 0, 36);
    }

    function heal() {
        [523, 659, 784].forEach((freq, i) => sfx('sine', freq, 0.3, 0.5, i * 0.08));
    }

    function denied() {
        if (throttled('denied')) return;
        sfx('square', 140, 0.16, 0.12);
    }

    function perfect() {
        sfx('square', 1568, 0.1, 0.08);
    }

    /**
     * The menus play a scale: moving through them walks up and down it
     * @param {number} direction - Steps up or down
     */
    function uiStep(direction) {
        const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
        uiDegree = Math.max(0, Math.min(scale.length - 1, uiDegree + direction));
        pianoNote(scale[uiDegree], 0.3, 0.3);
    }

    function pop() {
        sfx('square', 660, 0.12, 0.05, 0, 990);
    }

    function select() {
        pianoNote(72, 0.34, 0.3);
        pianoNote(79, 0.24, 0.3);
    }

    function uiBack() {
        pianoNote(67, 0.3, 0.3);
        pianoNote(60, 0.24, 0.35);
    }

    function dialogBlip() {
        if (throttled('blip')) return;
        sfx('square', 440 + Math.random() * 120, 0.04, 0.03);
    }

    function telegraph() {
        if (throttled('telegraph')) return;
        sfx('sawtooth', 110, 0.18, 0.25, 0, 220);
    }

    function slam() {
        sfxNoise(0.7, 0.3, 0, 700);
        sfx('sine', 80, 1, 0.35, 0, 30);
    }

    function pluck() {
        if (throttled('pluck')) return;
        sfx('triangle', 196, 0.26, 0.5);
        sfx('triangle', 392, 0.1, 0.3);
    }

    function door() {
        [262, 330, 392, 523].forEach((freq, i) => sfx('triangle', freq, 0.3, 0.4, i * 0.1));
    }

    function bossRoar() {
        sfx('sawtooth', 70, 0.5, 0.9, 0, 40);
        sfx('square', 74, 0.3, 0.9, 0, 42);
    }

    // =============================================================================
    // SEQUENCER
    // =============================================================================

    /**
     * Turn a tune into a list of notes
     * @returns {Array} {step, midi, length} with both in sixteenth notes
     */
    function parseLine(text) {
        const notes = [];
        text.split('|').forEach((bar, barIndex) => {
            bar.trim().split(/\s+/).forEach((token, i) => {
                const step = barIndex * 16 + i * 2;
                if (token === '~') {
                    if (notes.length) notes[notes.length - 1].length += 2;
                } else if (token !== '.') {
                    notes.push({ step, midi: noteToMidi(token), length: 2 });
                }
            });
        });
        return notes;
    }

    function parseChord(name) {
        const [, root, kind] = name.match(/^([A-G]#?)(.*)$/);
        const pitch = NOTE_NAMES[root];
        const tones = CHORD_SHAPES[kind].map(interval => pitch + interval);
        return { pitch, tones };
    }

    /**
     * Flatten a song into what to play on each sixteenth note. This happens once,
     * when the song starts, which keeps the tick itself cheap.
     */
    function compile(key) {
        const def = SONGS[key];
        const steps = [];
        const add = (step, event) => {
            (steps[step] = steps[step] || []).push(event);
        };
        let loopStart = 0;

        def.form.forEach((sectionName, formIndex) => {
            if (formIndex === def.loop) loopStart = steps.length;
            const section = def.sections[sectionName];
            const shift = section.shift || 0;
            const bars = section.chords.split(' ');
            const base = steps.length;

            if (section.lead) {
                parseLine(section.lead).forEach(note => add(base + note.step, {
                    voice: def.lead, midi: note.midi + shift, length: note.length, part: 'lead'
                }));
            }
            if (section.counter) {
                parseLine(section.counter).forEach(note => add(base + note.step, {
                    voice: def.counter, midi: note.midi + shift, length: note.length, part: 'counter'
                }));
            }

            bars.forEach((name, barIndex) => {
                const barStart = base + barIndex * 16;
                const chords = name.split(',').map(parseChord);
                const chordAt = step => chords[Math.floor(step / (16 / chords.length))];
                const midiOf = (chord, tone, octaveBase) => {
                    const low = chord.pitch >= 7 ? octaveBase - 12 : octaveBase;
                    return low + tone + shift;
                };

                const arp = ARPS[section.arp];
                if (arp) {
                    for (let step = 0; step < 16; step++) {
                        const token = arp[step];
                        if (token === '.') continue;
                        const chord = chordAt(step);
                        const degree = Number(token) - 1;
                        const count = chord.tones.length > 3 ? 3 : chord.tones.length;
                        const tone = chord.tones[degree % count] + 12 * Math.floor(degree / count);
                        add(barStart + step, {
                            voice: def.arp, midi: midiOf(chord, tone, 60), length: 2, part: 'arp',
                            pan: step % 4 < 2 ? -0.35 : 0.35
                        });
                    }
                }

                const bass = BASSES[section.bass] || BASSES.none;
                for (let step = 0; step < 16; step++) {
                    const token = bass[step];
                    if (token === '.' || token === '-') continue;
                    let length = 1;
                    while (step + length < 16 && bass[step + length] === '-') length++;
                    const chord = chordAt(step);
                    const third = chord.tones[1] - chord.pitch;
                    const interval = { 1: 0, 3: third, 5: 7, 8: 12 }[token];
                    add(barStart + step, {
                        voice: 'bass', midi: midiOf(chord, chord.pitch + interval, 48) - 12, length: length + 1, part: 'bass'
                    });
                }

                if (section.pad) {
                    chords.forEach((chord, i) => chord.tones.forEach(tone => add(barStart + i * (16 / chords.length), {
                        voice: 'pad', midi: midiOf(chord, tone, 60), length: 16 / chords.length, part: 'pad'
                    })));
                }

                // The last bar of a section rolls into the next one
                const lastBar = barIndex === bars.length - 1;
                const drums = DRUMS[section.fill && lastBar ? 'fill' : section.drums] || DRUMS.none;
                Object.entries(drums).forEach(([lane, pattern]) => {
                    for (let step = 0; step < 16; step++) {
                        if (pattern[step] === 'x') add(barStart + step, { drum: lane });
                    }
                });
            });
            steps.length = Math.max(steps.length, base + bars.length * 16);
        });

        return { key, bpm: def.bpm, steps, loopStart, total: steps.length };
    }

    /**
     * Play one note of an instrument
     */
    function playVoice(event, when, stepLength) {
        const freq = midiToFrequency(event.midi);
        const duration = event.length * stepLength;
        const voiceInfo = VOICES[event.voice] || {};
        const level = voiceInfo.level || 0;
        const bus = musicBus;
        const send = voiceInfo.echo ? echoBus : null;

        switch (event.voice) {
            case 'bass':
                tone('triangle', freq, 0.42, duration * 0.92, when, { bus });
                break;
            case 'pad':
                tone('triangle', freq, 0.045, duration, when, { bus, attack: 0.08, sustain: true });
                break;
            case 'piano':
                // A toy piano: a struck note with a bright start that fades quickly
                tone('triangle', freq, level, Math.max(0.55, duration * 1.4), when, { bus });
                tone('sine', freq * 2, level * 0.5, 0.3, when, { bus });
                tone('square', freq * 4, level * 0.05, 0.05, when, { bus });
                break;
            case 'bell':
                tone('sine', freq, level, Math.max(0.9, duration), when, { bus, send });
                tone('sine', freq * 3, level * 0.28, 0.32, when, { bus });
                break;
            case 'flute':
                tone('triangle', freq, level, duration, when, { bus, send, attack: 0.03, sustain: true, vibrato: true });
                break;
            case 'soft':
                tone('sine', freq, level, duration, when, { bus, send, attack: 0.04, sustain: true, vibrato: true });
                break;
            case 'pluck':
                tone('triangle', freq, level, Math.min(0.4, duration + 0.15), when, { bus, pan: event.pan });
                break;
            case 'pulse':
                tone('square', freq, level, duration * 0.95, when, { bus, send, sustain: event.length > 4, vibrato: event.length > 4 });
                break;
            case 'thin':
                tone('thin', freq, level, duration * 0.9, when, { bus, pan: event.pan });
                break;
            case 'saw':
                tone('sawtooth', freq, level, duration * 0.95, when, { bus, send, sustain: event.length > 4, vibrato: event.length > 4 });
                break;
            default:
                break;
        }
    }

    /**
     * A shaped tone. Held notes sit level and then let go, the rest fade from the top.
     */
    function tone(type, freq, peak, duration, when, { bus, send = null, attack = 0.005, sustain = false, vibrato = false, pan = 0 }) {
        const t = ctx.currentTime + when;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        if (type === 'thin') o.setPeriodicWave(thinWave);
        else o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        if (sustain) {
            g.gain.setValueAtTime(peak, t + Math.max(attack, duration - 0.06));
            g.gain.linearRampToValueAtTime(0.0001, t + duration);
        } else {
            g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        }

        let wobble = null;
        if (vibrato && duration > 0.35) {
            wobble = ctx.createOscillator();
            const depth = ctx.createGain();
            wobble.frequency.value = 5.5;
            depth.gain.setValueAtTime(0, t);
            depth.gain.linearRampToValueAtTime(freq * 0.007, t + 0.3);
            wobble.connect(depth);
            depth.connect(o.frequency);
            wobble.start(t);
            wobble.stop(t + duration + 0.02);
        }

        o.connect(g);
        if (pan && ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = pan;
            g.connect(panner);
            panner.connect(bus);
        } else {
            g.connect(bus);
        }
        if (send) g.connect(send);
        o.start(t);
        o.stop(t + duration + 0.02);
    }

    function playDrum(lane, when) {
        if (lane === 'k') voice(musicBus, 'sine', 140, 0.75, 0.15, when, 44);
        else if (lane === 's') noise(musicBus, 0.24, 0.1, when, 3200);
        else if (lane === 'h') noise(musicBus, 0.07, 0.03, when, 9000);
        else if (lane === 't') voice(musicBus, 'square', 1300, 0.07, 0.03, when, 900);
    }

    function playStep(step, when) {
        const index = step < song.total ? step : song.loopStart + (step - song.loopStart) % (song.total - song.loopStart);
        const events = song.steps[index];
        if (!events) return;
        const stepLength = 60 / (song.bpm * song.pace) / 4;
        events.forEach(event => {
            if (event.drum) playDrum(event.drum, when);
            else playVoice(event, when, stepLength);
        });
    }

    /**
     * Start a song from the sequencer
     * @param {string} key - Key into SONGS
     * @param {number} pace - How much faster than written to play it
     * @returns {number} The song's tempo as written, which the beat clock counts in
     */
    function playSong(key, pace = 1) {
        ensure();
        stopMusic();
        song = compile(key);
        song.pace = pace;
        songStep = -1;
        currentTrack = null;
        echoDelay.delayTime.value = Math.min(1.4, 45 / (song.bpm * pace)); // A dotted eighth
        return song.bpm;
    }

    /**
     * Play a song with nothing in charge of the beat, as the menus do. Asking for
     * the song already playing leaves it alone, so that it carries on across screens.
     */
    function playFreeSong(key) {
        if (freeTimer && song && song.key === key) return;
        const bpm = playSong(key);
        freeStart = ctx.currentTime + 0.05;
        freeTimer = setInterval(() => updateSong((ctx.currentTime - freeStart) * bpm / 60), 40);
    }

    /**
     * Queue the notes coming up. Called every tick with the game's beat position,
     * which means pausing the game pauses the music in step.
     * @param {number} beatPosition - Current position in beats
     */
    function updateSong(beatPosition) {
        if (!song || !ctx) return;
        const secondsPerBeat = 60 / (song.bpm * song.pace);
        const horizon = beatPosition + AUDIO_CONFIG.SCHEDULE_AHEAD_S / secondsPerBeat;
        let next = Math.max(songStep + 1, Math.ceil(beatPosition * 4));
        while (next / 4 <= horizon) {
            playStep(next, Math.max(0, (next / 4 - beatPosition) * secondsPerBeat));
            songStep = next;
            next++;
        }
    }

    function stopSong() {
        clearInterval(freeTimer);
        freeTimer = null;
        song = null;
        songStep = -1;
    }

    function usingRecordings() {
        return arenaMusic === 'recordings';
    }

    function playMenuMusic() {
        if (usingRecordings()) {
            stopSong();
            if (currentTrack !== 'menu.mp3') playMusic('menu.mp3');
        } else {
            if (currentTrack) stopMusic();
            playFreeSong('menu');
        }
    }

    function playVictory() {
        stopMusic();
        if (usingRecordings()) playMusic('victory.mp3', false);
        else playFreeSong('victory');
    }

    // =============================================================================
    // BACKGROUND MUSIC
    // =============================================================================

    function _ensureMusic(trackName) {
        if (!musicEl || currentTrack !== trackName) {
            if (musicEl) {
                musicEl.pause();
            }
            musicEl = new Audio(`music/${trackName}`);
            musicEl.volume = musicVolume;
            currentTrack = trackName;
        }
    }

    async function playMusic(trackName, shouldLoop = true) {
        stopSong();
        if (!musicEnabled) {
            currentTrack = trackName;
            return; // Don't play music if disabled
        }
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
        stopSong();
        if (musicEl) {
            musicEl.pause();
            musicEl.currentTime = 0;
        }
        currentTrack = null;
    }

    function pauseMusic(paused) {
        if (!musicEl || !currentTrack) return;
        if (paused) musicEl.pause();
        else if (musicEnabled) musicEl.play().catch(() => {});
    }

    /**
     * How long, in seconds, a sound takes to get from here to the player's ears
     */
    function outputLatency() {
        if (!ctx) return 0;
        return ctx.outputLatency || ctx.baseLatency || 0;
    }

    function setMusicVolume(volume) {
        musicVolume = Math.max(0, Math.min(1, volume));
        if (musicEl) musicEl.volume = musicVolume;
        if (musicBus) musicBus.gain.value = musicEnabled ? AUDIO_CONFIG.CHIP_GAIN * musicVolume : 0;
        persist();
    }

    function setSfxVolume(volume) {
        sfxVolume = Math.max(0, Math.min(1, volume));
        if (master) master.gain.value = AUDIO_CONFIG.MASTER_GAIN * sfxVolume;
        persist();
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        // Sound effects
        shoot, enemyShoot, hit, hurt, enemyDeath, death, powerUp, crate, levelClear, gameStart,
        pianoNote, chord, shieldUp, shieldBlock, dash, blast, heal, denied, perfect, pop, select, uiStep, uiBack,
        dialogBlip, telegraph, slam, pluck, door, bossRoar,

        // Music
        playMusic, stopMusic, pauseMusic, outputLatency, setMusicVolume, setSfxVolume,
        playSong, updateSong, stopSong, playMenuMusic, playVictory,

        // Audio control
        toggle() {
            enabled = !enabled;
            persist();
            return enabled;
        },
        toggleMusic() {
            musicEnabled = !musicEnabled;
            if (!musicEnabled && musicEl) {
                musicEl.pause();
            } else if (musicEnabled && musicEl && currentTrack) {
                musicEl.play().catch(() => {});
            }
            if (musicBus) musicBus.gain.value = musicEnabled ? AUDIO_CONFIG.CHIP_GAIN * musicVolume : 0;
            persist();
            return musicEnabled;
        },
        resume: resumeContext,
        getArenaMusic() {
            return arenaMusic;
        },
        setArenaMusic(choice) {
            arenaMusic = choice;
            persist();
        },
        isEnabled() {
            return enabled;
        },
        isMusicEnabled() {
            return musicEnabled;
        },
        getMusicVolume() {
            return musicVolume;
        },
        getSfxVolume() {
            return sfxVolume;
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

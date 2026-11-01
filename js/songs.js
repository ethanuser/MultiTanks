// =============================================================================
// THE SCORE
// =============================================================================
// Original tunes, played by the sequencer in audioSystem.js rather than from a
// recording, so the beat the game judges is exactly the one being heard.
//
// A song is a list of sections, played in the order of its form. When the form
// runs out it goes back to the entry named by loop, skipping any intro.
//
// In a section:
//   chords   One per bar. A comma splits a bar between two chords.
//   lead     The tune, and counter a second line under it. Bars are split by | and
//            have eight notes each. A dot is a rest and ~ holds the note before.
//   arp      A pattern from ARPS. bass from BASSES, drums from DRUMS.
//   pad      Soft held chords under everything.
//   shift    Moves the whole section up by this many semitones.
//
// Every drum pattern marks all four beats, so that the pulse can always be heard.
//
// Two ideas run through the whole score. Pip's theme opens the first world and
// comes home in the ending. The five harmony keys, played straight up, are the
// tune the Eighty-Ninth Key cannot stop humming, and it ends on the A it never
// reaches until someone plays it.

// Sixteen steps to the bar: x plays, a dot rests. Lanes are k kick, s snare,
// h hat and t a wooden tick.
const DRUMS = {
    none: {},
    tick: { t: 'x...x...x...x...' },
    heart: { k: 'x...x...x...x...', t: '..x...x...x...x.' },
    soft: { k: 'x.......x.......', t: '....x.......x...', h: '..x...x...x...x.' },
    four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    bounce: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    drive: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    march: { k: 'x...x...x...x...', s: '....x..x....x.xx', h: '..x...x...x...x.' },
    blast: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    fill: { k: 'x...x...x...x...', s: '....x...x.x.xxxx', h: 'x.x.x.x.........' }
};

// Numbers are chord tones: 1 root, 2 third, 3 fifth, 4 octave, 5 the third above
// that, 6 the fifth above that. A dot rests.
const ARPS = {
    alberti: '1.3.2.3.1.3.2.3.',
    harp: '1234565432123456',
    rise: '1.2.3.4.5.4.3.2.',
    sparkle: '4..3..2..3..5...',
    drift: '1...3...2...3...',
    stairs: '1234123412341234',
    gallop: '1.11.11.3.33.33.',
    bells: '5...4...6...4...',
    triplets: '123123123123123.'
};

// Numbers are 1 root, 3 third, 5 fifth and 8 octave. A dash holds the note.
const BASSES = {
    none: '................',
    walk: '1...3...5...3...',
    bounce: '1.8.5.8.1.8.5.8.',
    long: '1-------5-------',
    heart: '1.1.....5.5.....',
    drive: '1.1.1.1.1.1.1.5.',
    gallop: '1.11.11.1.11.15.',
    pump: '1818181818181818',
    march: '1...1...5...5...'
};

const PIP_CHORDS = 'C F G F,C C F G7 C';
const PIP_THEME = 'E5 . G5 E5 C5 . D5 E5 | F5 . A5 F5 D5 . E5 F5 | G5 . E5 C5 D5 E5 G5 . | A5 G5 E5 D5 C5 . . . | '
    + 'E5 . G5 E5 C6 . B5 A5 | A5 . C6 A5 F5 . G5 A5 | B5 . G5 D5 E5 F5 G5 A5 | G5 . E5 D5 C5 . . .';
const PIP_THEME_UNDER = 'G4 ~ ~ ~ E4 ~ ~ ~ | A4 ~ ~ ~ F4 ~ ~ ~ | B4 ~ ~ ~ G4 ~ ~ ~ | C5 ~ ~ ~ E4 ~ . . | '
    + 'G4 ~ ~ ~ E5 ~ ~ ~ | C5 ~ ~ ~ A4 ~ ~ ~ | D5 ~ ~ ~ B4 ~ ~ ~ | E5 ~ ~ ~ C5 ~ . .';

const STRINGS_A = 'A5 . . . C6 . B5 A5 | F5 . . . A5 . G5 F5 | G5 . . . B5 . A5 G5 | E5 ~ ~ ~ . . . . | '
    + 'A5 . . . E6 . D6 C6 | C6 . . . A5 . G5 A5 | D6 . . . F5 . A5 D6 | B5 . . . G#5 . E5 .';
const STRINGS_UNDER = 'E5 ~ ~ ~ E5 ~ ~ ~ | C5 ~ ~ ~ C5 ~ ~ ~ | D5 ~ ~ ~ D5 ~ ~ ~ | B4 ~ ~ ~ G4 ~ ~ ~ | '
    + 'C5 ~ ~ ~ E5 ~ ~ ~ | A4 ~ ~ ~ C5 ~ ~ ~ | A4 ~ ~ ~ D5 ~ ~ ~ | G#4 ~ ~ ~ B4 ~ ~ ~';

const FELT_A = 'D5 . F5 . A5 ~ ~ . | F5 . D5 . A#4 ~ ~ . | G4 . A#4 . D5 . G5 . | A5 ~ ~ . E5 . C#5 . | '
    + 'D5 . F5 . A5 . D6 . | C6 . A#5 . A5 . F5 . | G5 . F5 . D5 . A#4 . | A4 ~ ~ ~ ~ ~ . .';
const FELT_UNDER = 'A4 ~ ~ ~ ~ ~ ~ ~ | A#4 ~ ~ ~ ~ ~ ~ ~ | D5 ~ ~ ~ ~ ~ ~ ~ | C#5 ~ ~ ~ ~ ~ ~ ~ | '
    + 'A4 ~ ~ ~ ~ ~ ~ ~ | F5 ~ ~ ~ ~ ~ ~ ~ | D5 ~ ~ ~ ~ ~ ~ ~ | E5 ~ ~ ~ C#5 ~ ~ ~';

const BOARD_A = 'E5 F5 E5 . B4 . C5 B4 | E5 F5 G5 . F5 E5 . . | A5 G5 F5 E5 F5 E5 D5 C5 | B4 . . . D#5 . F#5 . | '
    + 'E5 F5 E5 . B5 . C6 B5 | G5 . E5 . C6 . B5 G5 | A5 B5 C6 . D6 . C6 B5 | B5 . A5 . F#5 . D#5 .';

const BOSS_A = 'C5 . C5 D#5 G5 . F5 D#5 | C5 . C5 D#5 G#5 . G5 F5 | D#5 . D#5 G5 A#5 . G#5 G5 | G5 F5 D#5 D5 B4 . G4 . | '
    + 'C5 . C5 D#5 G5 . F5 D#5 | G#5 . G5 . F5 . D#5 . | F5 . G#5 . C6 . A#5 G#5 | G5 . B5 . D6 . . .';

// The five harmony keys, straight up, and the tune they keep trying to finish
const FINAL_A = 'E5 . E5 F5 E5 . B4 . | C5 . C5 D5 C5 . G4 . | A4 . A4 B4 C5 . E5 . | D#5 ~ ~ . B4 ~ ~ . | '
    + 'E5 F5 F#5 G5 G#5 ~ ~ . | E5 F5 F#5 G5 G#5 ~ ~ . | A5 . G5 . E5 . C5 . | B4 . D#5 . F#5 . B5 .';

const ARENA_FREE_A = 'D5 . G5 . B5 . A5 G5 | E5 . G5 . B5 . A5 G5 | C6 . B5 A5 G5 . E5 G5 | A5 ~ . F#5 D5 . . . | '
    + 'D5 . G5 . B5 . D6 . | E6 . D6 B5 G5 . B5 . | C6 . E6 . D6 . C6 B5 | A5 . F#5 . D5 . . .';

const ARENA_TEAMS_A = 'D5 . D5 E5 F5 . D5 . | A5 . G5 F5 E5 . D5 . | F5 . F5 G5 A5 . A#5 . | C6 . A#5 A5 G5 . E5 . | '
    + 'D6 . D6 C6 A5 . F5 . | A5 . G5 F5 G5 . A5 . | A#5 . A5 G5 F5 . G5 A5 | A5 . C#6 . E6 ~ ~ .';

const SONGS = {
    // The menus: Pip's theme, slow, on a music box
    menu: {
        bpm: 92, lead: 'bell', counter: 'soft', arp: 'piano', loop: 1,
        form: ['intro', 'A', 'rest', 'A2'],
        sections: {
            intro: { chords: 'C F C G', arp: 'drift', bass: 'long', drums: 'none', pad: true },
            A: { chords: PIP_CHORDS, lead: PIP_THEME, arp: 'alberti', bass: 'long', drums: 'tick', pad: true },
            rest: {
                chords: 'Am F C G',
                lead: 'E6 ~ ~ . C6 ~ ~ . | A5 ~ ~ . C6 ~ ~ . | G5 ~ ~ . E5 ~ ~ . | D5 ~ ~ ~ ~ ~ . .',
                arp: 'drift', bass: 'long', drums: 'none', pad: true
            },
            A2: { chords: PIP_CHORDS, lead: PIP_THEME, counter: PIP_THEME_UNDER, arp: 'alberti', bass: 'walk', drums: 'tick', pad: true }
        }
    },

    // Winning a match: a quick fanfare, then Pip's theme to go out on
    victory: {
        bpm: 132, lead: 'pulse', counter: 'piano', arp: 'piano', loop: 1,
        form: ['fanfare', 'A'],
        sections: {
            fanfare: {
                chords: 'C F G C',
                lead: 'C5 C5 C5 ~ E5 ~ G5 ~ | A5 A5 A5 ~ C6 ~ A5 ~ | B5 B5 B5 ~ D6 ~ B5 ~ | C6 ~ ~ ~ ~ ~ . .',
                arp: 'none', bass: 'pump', drums: 'march', pad: true
            },
            A: { chords: PIP_CHORDS, lead: PIP_THEME, arp: 'rise', bass: 'bounce', drums: 'four', pad: true }
        }
    },

    // The keys: Pip's theme on a toy piano, bright and bouncing
    ivory: {
        bpm: 116, lead: 'piano', counter: 'thin', arp: 'piano', loop: 1,
        form: ['intro', 'A', 'A2', 'B', 'A2', 'lull', 'B', 'lift'],
        sections: {
            intro: { chords: 'C C', arp: 'alberti', bass: 'bounce', drums: 'tick' },
            A: { chords: PIP_CHORDS, lead: PIP_THEME, arp: 'alberti', bass: 'bounce', drums: 'four', fill: true },
            A2: { chords: PIP_CHORDS, lead: PIP_THEME, counter: PIP_THEME_UNDER, arp: 'rise', bass: 'bounce', drums: 'bounce', fill: true },
            B: {
                chords: 'Am Em F C Dm G Em G',
                lead: 'C6 . B5 A5 E5 . . E5 | G5 . A5 G5 E5 . . . | A5 . G5 F5 C5 . F5 A5 | G5 E5 C5 E5 G5 . . . | '
                    + 'F5 . E5 D5 A4 . D5 F5 | D5 . E5 F5 G5 . B5 . | B5 A5 G5 E5 G5 . E5 . | D5 E5 F5 G5 B5 . D6 .',
                arp: 'rise', bass: 'walk', drums: 'four', pad: true, fill: true
            },
            lull: {
                chords: 'F G Em Am',
                lead: 'C6 ~ ~ . A5 ~ ~ . | D6 ~ ~ . B5 ~ ~ . | E6 ~ ~ . G5 ~ ~ . | C6 . B5 . A5 . G5 .',
                arp: 'sparkle', bass: 'long', drums: 'tick', pad: true
            },
            lift: {
                chords: PIP_CHORDS, lead: PIP_THEME, counter: PIP_THEME_UNDER,
                arp: 'harp', bass: 'pump', drums: 'drive', pad: true, shift: 2
            }
        }
    },

    // The strings: a harp in the dark, with something moving behind it
    strings: {
        bpm: 104, lead: 'flute', counter: 'pluck', arp: 'pluck', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'web', 'B', 'A2'],
        sections: {
            intro: { chords: 'Am F', arp: 'harp', bass: 'long', drums: 'tick', pad: true },
            A: { chords: 'Am F G Em Am F Dm E', lead: STRINGS_A, arp: 'harp', bass: 'walk', drums: 'soft', fill: true },
            A2: { chords: 'Am F G Em Am F Dm E', lead: STRINGS_A, counter: STRINGS_UNDER, arp: 'harp', bass: 'bounce', drums: 'four', pad: true, fill: true },
            B: {
                chords: 'C G Am Em F C Dm E',
                lead: 'E5 G5 C6 . E6 . D6 C6 | D6 . B5 . G5 . A5 B5 | C6 . A5 . E5 . F5 G5 | G5 . E5 . B4 ~ ~ . | '
                    + 'A5 C6 F6 . E6 . C6 A5 | G5 . C6 . E6 ~ ~ . | F6 . E6 D6 A5 . B5 C6 | B5 . G#5 . E5 . E6 .',
                arp: 'rise', bass: 'walk', drums: 'four', pad: true, fill: true
            },
            web: {
                chords: 'Am Am F E',
                counter: 'A5 . A5 . A5 . A5 . | C6 . C6 . C6 . C6 . | C6 . C6 . A5 . A5 . | B5 . B5 . G#5 . G#5 .',
                arp: 'triplets', bass: 'heart', drums: 'heart'
            }
        }
    },

    // The felt: hushed, close, and a heartbeat under it all
    felt: {
        bpm: 92, lead: 'soft', counter: 'bell', arp: 'soft', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'hush', 'B', 'A2'],
        sections: {
            intro: { chords: 'Dm Dm', arp: 'drift', bass: 'heart', drums: 'heart', pad: true },
            A: { chords: 'Dm A# Gm A Dm F Gm A', lead: FELT_A, arp: 'drift', bass: 'heart', drums: 'heart', pad: true },
            A2: { chords: 'Dm A# Gm A Dm F Gm A', lead: FELT_A, counter: FELT_UNDER, arp: 'rise', bass: 'heart', drums: 'soft', pad: true, fill: true },
            B: {
                chords: 'F C Dm Am A# F Gm A',
                lead: 'A5 . C6 . F5 ~ ~ . | G5 . E5 . C5 . E5 G5 | F5 . D5 . A4 . D5 F5 | E5 . C5 . A4 ~ ~ . | '
                    + 'D5 . F5 . A#5 . A5 G5 | A5 . F5 . C5 ~ ~ . | A#4 . D5 . G5 . F5 G5 | A5 . E5 . C#5 . A4 .',
                arp: 'alberti', bass: 'long', drums: 'soft', pad: true
            },
            hush: {
                chords: 'Dm Gm Dm A',
                counter: 'D6 ~ ~ ~ . . A5 . | A#5 ~ ~ ~ . . G5 . | F5 ~ ~ ~ . . D5 . | E5 ~ ~ ~ C#5 ~ ~ ~',
                arp: 'none', bass: 'heart', drums: 'tick', pad: true
            }
        }
    },

    // The soundboard: everything wrong at once, and going faster
    soundboard: {
        bpm: 124, lead: 'pulse', counter: 'thin', arp: 'thin', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'crack', 'B', 'A2'],
        sections: {
            intro: { chords: 'Em Em', bass: 'drive', drums: 'four', arp: 'stairs' },
            A: { chords: 'Em Em Am B Em C Am B', lead: BOARD_A, arp: 'stairs', bass: 'drive', drums: 'drive', fill: true },
            A2: {
                chords: 'Em Em Am B Em C Am B', lead: BOARD_A,
                counter: 'B4 ~ ~ ~ G4 ~ ~ ~ | B4 ~ ~ ~ C5 ~ ~ ~ | E5 ~ ~ ~ C5 ~ ~ ~ | D#5 ~ ~ ~ B4 ~ ~ ~ | '
                    + 'G5 ~ ~ ~ E5 ~ ~ ~ | E5 ~ ~ ~ G5 ~ ~ ~ | E5 ~ ~ ~ A5 ~ ~ ~ | F#5 ~ ~ ~ D#5 ~ ~ ~',
                arp: 'gallop', bass: 'pump', drums: 'blast', fill: true
            },
            B: {
                chords: 'C Am F Em C Am F B',
                lead: 'G5 . G5 A5 G5 . E5 . | C6 . C6 D6 C6 . A5 . | A5 . C6 . F6 . E6 C6 | B5 . G5 . E5 ~ ~ . | '
                    + 'G5 . G5 A5 G5 . E5 G5 | C6 . C6 D6 E6 . D6 C6 | F6 . E6 C6 A5 . C6 . | B5 . D#6 . F#6 ~ ~ .',
                arp: 'stairs', bass: 'bounce', drums: 'drive', pad: true, fill: true
            },
            crack: {
                chords: 'Em F Em F',
                lead: 'B5 ~ ~ . C6 ~ ~ . | C6 ~ ~ . A5 ~ ~ . | B5 ~ ~ . C6 ~ ~ . | F6 ~ ~ . E6 ~ ~ .',
                arp: 'triplets', bass: 'heart', drums: 'march'
            }
        }
    },

    // Every boss but the last
    boss: {
        bpm: 128, lead: 'saw', counter: 'pulse', arp: 'thin', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'stomp', 'B', 'A2'],
        sections: {
            intro: { chords: 'Cm Cm', bass: 'gallop', drums: 'march', arp: 'none' },
            A: { chords: 'Cm G# D# G Cm G# Fm G', lead: BOSS_A, arp: 'stairs', bass: 'gallop', drums: 'drive', fill: true },
            A2: {
                chords: 'Cm G# D# G Cm G# Fm G', lead: BOSS_A,
                counter: 'G4 ~ ~ ~ D#5 ~ ~ ~ | G#4 ~ ~ ~ D#5 ~ ~ ~ | A#4 ~ ~ ~ D#5 ~ ~ ~ | B4 ~ ~ ~ D5 ~ ~ ~ | '
                    + 'G4 ~ ~ ~ D#5 ~ ~ ~ | C5 ~ ~ ~ D#5 ~ ~ ~ | G#4 ~ ~ ~ C5 ~ ~ ~ | B4 ~ ~ ~ G5 ~ ~ ~',
                arp: 'gallop', bass: 'pump', drums: 'blast', fill: true
            },
            B: {
                chords: 'Fm Cm G# D# Fm Cm G# G',
                lead: 'C6 . C6 . A#5 . G#5 . | G5 . G5 . F5 . D#5 . | D#5 . F5 . G#5 . C6 . | A#5 . G5 . D#5 ~ ~ . | '
                    + 'C6 . D#6 . C6 . G#5 . | G5 . C6 . G5 . D#5 . | C6 . A#5 . G#5 . G5 . | B5 ~ ~ . D6 . G6 .',
                arp: 'triplets', bass: 'drive', drums: 'drive', pad: true, fill: true
            },
            stomp: {
                chords: 'Cm Cm G# G',
                arp: 'gallop', bass: 'march', drums: 'march',
                lead: 'C6 ~ ~ . G5 ~ ~ . | D#6 ~ ~ . C6 ~ ~ . | C6 ~ ~ . D#5 ~ ~ . | D6 ~ ~ . B5 ~ ~ .'
            }
        }
    },

    // The Eighty-Ninth Key: the five harmony keys over and over, never reaching A
    final: {
        bpm: 132, lead: 'saw', counter: 'bell', arp: 'thin', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'scale', 'B', 'A2'],
        sections: {
            intro: {
                chords: 'Em Em',
                lead: 'E5 . F5 . F#5 . G5 . | G#5 ~ ~ ~ ~ ~ . .',
                bass: 'long', drums: 'tick', arp: 'none', pad: true
            },
            A: { chords: 'Em C Am B Em Caug Am B', lead: FINAL_A, arp: 'stairs', bass: 'gallop', drums: 'drive', fill: true },
            A2: {
                chords: 'Em C Am B Em Caug Am B', lead: FINAL_A,
                counter: 'B5 ~ ~ ~ G5 ~ ~ ~ | G5 ~ ~ ~ E5 ~ ~ ~ | E5 ~ ~ ~ C6 ~ ~ ~ | B5 ~ ~ ~ F#5 ~ ~ ~ | '
                    + 'B5 ~ ~ ~ ~ ~ ~ ~ | C6 ~ ~ ~ ~ ~ ~ ~ | C6 ~ ~ ~ A5 ~ ~ ~ | D#6 ~ ~ ~ B5 ~ ~ ~',
                arp: 'gallop', bass: 'pump', drums: 'blast', fill: true
            },
            B: {
                chords: 'C G Am Em C G F B',
                lead: 'G5 . E5 . C6 . B5 . | D6 . B5 . G5 ~ ~ . | C6 . A5 . E6 . D6 . | B5 . G5 . E5 ~ ~ . | '
                    + 'E6 . D6 C6 G5 . C6 . | D6 . B5 . G5 . B5 . | A5 . C6 . F6 . E6 D6 | D#6 . B5 . F#5 . D#5 .',
                arp: 'triplets', bass: 'drive', drums: 'drive', pad: true, fill: true
            },
            scale: {
                chords: 'Em Caug Em Caug',
                lead: 'E5 F5 F#5 G5 G#5 ~ ~ . | E5 F5 F#5 G5 G#5 ~ ~ . | E5 F5 F#5 G5 G#5 G5 F#5 F5 | E5 F5 F#5 G5 G#5 ~ ~ .',
                arp: 'none', bass: 'heart', drums: 'march', pad: true
            }
        }
    },

    // Waiting to be played, on a music box, very quietly
    resolve: {
        bpm: 84, lead: 'bell', counter: 'soft', arp: 'bell', loop: 0,
        form: ['A'],
        sections: {
            A: {
                chords: 'A D E A A F#m D E',
                lead: 'C#6 . A5 . E5 ~ ~ . | D6 . A5 . F#5 ~ ~ . | E6 . B5 . G#5 ~ ~ . | A5 ~ ~ ~ ~ ~ . . | '
                    + 'C#6 . E6 . A5 ~ ~ . | C#6 . F#5 . A5 ~ ~ . | D6 . A5 . F#5 . A5 . | G#5 ~ ~ ~ E5 ~ ~ .',
                arp: 'drift', bass: 'long', drums: 'none', pad: true
            }
        }
    },

    // All of it, everything at once: Pip's theme, in the key the last note landed on
    ending: {
        bpm: 120, lead: 'piano', counter: 'pulse', arp: 'piano', loop: 1,
        form: ['swell', 'A', 'A2', 'B', 'lift'],
        sections: {
            swell: {
                chords: 'A D E A',
                lead: 'E5 F5 F#5 G5 G#5 A5 ~ ~ | A5 F#5 D5 F#5 A5 ~ ~ ~ | B5 G#5 E5 G#5 B5 ~ ~ ~ | A5 ~ ~ ~ . . . .',
                arp: 'harp', bass: 'long', drums: 'tick', pad: true
            },
            A: { chords: PIP_CHORDS, lead: PIP_THEME, arp: 'alberti', bass: 'bounce', drums: 'four', pad: true, fill: true, shift: 9 - 12 },
            A2: { chords: PIP_CHORDS, lead: PIP_THEME, counter: PIP_THEME_UNDER, arp: 'harp', bass: 'pump', drums: 'bounce', pad: true, fill: true, shift: 9 - 12 },
            B: {
                chords: 'F#m C#m D A Bm E C#m E',
                lead: 'A5 . G#5 F#5 C#5 . . C#5 | E5 . F#5 E5 C#5 . . . | F#5 . E5 D5 A4 . D5 F#5 | E5 C#5 A4 C#5 E5 . . . | '
                    + 'D5 . C#5 B4 F#4 . B4 D5 | B4 . C#5 D5 E5 . G#5 . | G#5 F#5 E5 C#5 E5 . C#5 . | B4 C#5 D5 E5 G#5 . B5 .',
                arp: 'rise', bass: 'walk', drums: 'bounce', pad: true, fill: true
            },
            lift: { chords: PIP_CHORDS, lead: PIP_THEME, counter: PIP_THEME_UNDER, arp: 'harp', bass: 'pump', drums: 'drive', pad: true, shift: 11 - 12 }
        }
    },

    // Free For All: bright, quick and easy to shoot along to
    arenaFree: {
        bpm: 126, lead: 'pulse', counter: 'thin', arp: 'thin', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'drop', 'B', 'lift'],
        sections: {
            intro: { chords: 'G Em C D', arp: 'rise', bass: 'bounce', drums: 'four', fill: true },
            A: { chords: 'G Em C D G Em C D', lead: ARENA_FREE_A, arp: 'rise', bass: 'bounce', drums: 'bounce', fill: true },
            A2: {
                chords: 'G Em C D G Em C D', lead: ARENA_FREE_A,
                counter: 'B4 ~ ~ ~ D5 ~ ~ ~ | G4 ~ ~ ~ B4 ~ ~ ~ | E5 ~ ~ ~ C5 ~ ~ ~ | D5 ~ ~ ~ A4 ~ ~ ~ | '
                    + 'B4 ~ ~ ~ D5 ~ ~ ~ | B4 ~ ~ ~ G5 ~ ~ ~ | G5 ~ ~ ~ E5 ~ ~ ~ | F#5 ~ ~ ~ A4 ~ ~ ~',
                arp: 'harp', bass: 'pump', drums: 'drive', fill: true
            },
            B: {
                chords: 'C D Bm Em C D G G',
                lead: 'E6 . E6 D6 C6 . G5 . | D6 . D6 C6 A5 . F#5 . | B5 . D6 . F#6 . E6 D6 | E6 . B5 . G5 ~ ~ . | '
                    + 'C6 . E6 . G6 . F#6 E6 | F#6 . D6 . A5 . D6 . | G6 . D6 . B5 . D6 G6 | G6 ~ ~ ~ . . D5 .',
                arp: 'stairs', bass: 'drive', drums: 'drive', pad: true, fill: true
            },
            drop: { chords: 'Em C G D', arp: 'sparkle', bass: 'long', drums: 'heart', pad: true },
            lift: { chords: 'G Em C D G Em C D', lead: ARENA_FREE_A, arp: 'harp', bass: 'pump', drums: 'blast', pad: true, shift: 2 }
        }
    },

    // Team Battle: a march, two sides squaring up
    arenaTeams: {
        bpm: 134, lead: 'saw', counter: 'pulse', arp: 'thin', loop: 1,
        form: ['intro', 'A', 'B', 'A2', 'drums', 'B', 'A2'],
        sections: {
            intro: { chords: 'Dm Dm', arp: 'none', bass: 'march', drums: 'march' },
            A: { chords: 'Dm Dm A# C Dm Dm A# A', lead: ARENA_TEAMS_A, arp: 'gallop', bass: 'march', drums: 'march', fill: true },
            A2: {
                chords: 'Dm Dm A# C Dm Dm A# A', lead: ARENA_TEAMS_A,
                counter: 'A4 ~ ~ ~ F5 ~ ~ ~ | F5 ~ ~ ~ A4 ~ ~ ~ | D5 ~ ~ ~ F5 ~ ~ ~ | E5 ~ ~ ~ C5 ~ ~ ~ | '
                    + 'F5 ~ ~ ~ D5 ~ ~ ~ | F5 ~ ~ ~ D5 ~ ~ ~ | F5 ~ ~ ~ D5 ~ ~ ~ | E5 ~ ~ ~ A4 ~ ~ ~',
                arp: 'stairs', bass: 'gallop', drums: 'blast', fill: true
            },
            B: {
                chords: 'F C Gm Dm F C A# A',
                lead: 'A5 . C6 . F6 . E6 C6 | G5 . C6 . E6 . D6 C6 | A#5 . G5 . D6 . A#5 G5 | A5 . F5 . D5 ~ ~ . | '
                    + 'C6 . A5 . F6 . C6 A5 | G5 . E5 . G5 . C6 . | D6 . A#5 . F5 . A#5 D6 | C#6 . E6 . A6 ~ ~ .',
                arp: 'stairs', bass: 'drive', drums: 'drive', pad: true, fill: true
            },
            drums: { chords: 'Dm Dm', arp: 'none', bass: 'march', drums: 'blast' }
        }
    }
};

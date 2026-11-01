// =============================================================================
// THE 89TH KEY: THE CAMPAIGN
// =============================================================================
// The journey follows the road every note walks through a piano: key, hammer,
// string, damper, bridge, soundboard. Each stage picks up where the last one left
// off, each boss is a part of the piano that stopped doing its job, and the road
// comes all the way round to the far end of the keyboard, where it began.
//
// The enemies are the stolen notes themselves, knocked out of tune. Setting one
// right sends it home, so the stages are counted in notes: 6 for each main stage
// and 4 for each hidden one, which comes to all 88.
//
// Dialogue says what a thing is, never which key to press. Any line about the
// controls goes in a hint, and tokens like {chord:shield} are filled in by Prompts
// with whatever the player has connected.
//
// Map legend (see TILE_LEGEND for tiles):
//   P crew start    * lost note    H repair    E harmony    T tuning fork to defend
//   S wave spawn    B boss
//   q Quaver  t Triplet  m Metronome  d Damper  s Sharp
//   c Crescendo  r Rest  f Fermata  w Trill

const CHARACTERS = {
    pip: { name: 'Pip', portrait: 'pip' },
    tock: { name: 'Tock', portrait: 'tock' },
    clef: { name: 'Old Clef', portrait: 'clef' },
    thump: { name: 'Sir Thump', portrait: 'thump' },
    tremolo: { name: 'Madame Tremolo', portrait: 'tremolo' },
    mute: { name: 'The Great Mute', portrait: 'mute' },
    key89: { name: '???', portrait: 'key89' },
    key89named: { name: 'The Eighty-Ninth Key', portrait: 'key89' },
    pencil: { name: 'Pencil on the wood', portrait: 'pencil' }
};

const ENEMY_MARKS = {
    q: 'quaver', t: 'triplet', m: 'metronome', d: 'damper', s: 'sharp',
    c: 'crescendo', r: 'rest', f: 'fermata', w: 'trill'
};

// What finishing a hidden stage gives the crew for the rest of the journey
const REWARDS = {
    armor: { name: 'Brass Plating', text: 'Every tank in the crew has 4 more health.' },
    tuned: { name: 'Perfect Pitch', text: 'The crew starts each stage with 25 more harmony.' },
    spare: { name: 'Spare Parts', text: 'The crew gets 1 more spare tank in each stage.' },
    resin: { name: 'Bow Resin', text: 'Shots on the beat hit 1 harder.' }
};

// The links of the road, in order, each repaired by beating a world's boss
const ROAD_LINKS = ['Key', 'Hammer', 'String', 'Damper', 'Bridge', 'Board'];
const ROAD_REPAIRED_BY = { Hammer: '1-B', String: '2-B', Damper: '3-B', Bridge: '4-1', Board: '4-2' };

const NOTES_IN_MAIN_STAGE = 6;
const NOTES_IN_HIDDEN_STAGE = 4;
const NOTES_IN_THE_PIANO = 88;

/**
 * Letters painted on the floor of a white key, four tiles to a key
 * @param {number} row - Map row to paint them on
 * @param {string} letters - One letter per key, from the left edge of the map
 */
function keyLetters(row, letters) {
    return [...letters].map((text, i) => ({ c: i * 4 + 1.5, r: row, text }));
}

const CAMPAIGN_WORLDS = [
    // =========================================================================
    // WORLD 1: THE KEYS
    // Up an octave, through the black keys, and back along the key to the hammer
    // =========================================================================
    {
        key: 'ivory',
        theme: 'ivory',
        name: 'The Ivory Steppes',
        place: 'The keyboard',
        blurb: 'Where every note begins, now empty and silent.',
        song: 'ivory',
        levels: [
            {
                id: '1-1',
                name: 'Middle C',
                objective: { type: 'reach', text: 'Follow the trail up the octave' },
                decals: keyLetters(16, 'BCDEFGABC'),
                intro: [
                    { who: 'clef', text: 'Pip. Wake up, little one. Listen.' },
                    { who: 'pip', text: 'I can\'t hear anything.' },
                    { who: 'clef', text: 'Exactly. In a hundred years the Old Grand has never once been silent. Last night, every note in it disappeared.' },
                    { who: 'tock', text: 'Tick tock! I saw them go! Up the keys and under the fallboard, the whole scale, dragged off by something in the dark!' },
                    { who: 'clef', text: 'Then that is the way we go. Every note walks the same road, Pip. Key, hammer, string, damper, bridge, soundboard. Whatever took them went down it.' },
                    { who: 'clef', text: 'Take Tock, he keeps the time. I will go round by the pin block and meet you at the strings. Now hurry. The next C, then north.', hint: 'Drive: {drive}.  Aim: {aim}.  Fire: {shoot}.' }
                ],
                outro: [
                    { who: 'pip', text: 'Tock, I hit one of those things and it stopped being angry. It rang, just for a moment, and then it flew away.' },
                    { who: 'tock', text: 'That was a Quaver! That was one of ours! They are not monsters, Pip, they are the stolen notes, knocked out of tune!' },
                    { who: 'pip', text: 'Then every one we set right can go home.' }
                ],
                map: [
                    '#####################################',
                    '#......##..##......##..##..##.......#',
                    '#......##..##......##..##..##.......#',
                    '#......##H.##...q..##..##..##...q...#',
                    '#......##..##......##..##..##.......#',
                    '#..q...##..##......##..##..##.......#',
                    '#......##..##......##..##.q##.......#',
                    '#......##..##......##..##..##.......#',
                    '#......##..##......##..##..##.......#',
                    '#......##..##......##..##..##.......#',
                    '#...................................#',
                    '#...........x............x..........#',
                    '#...P.......x.....q......x.....x....#',
                    '#...P.......x............x.....x..G.#',
                    '#.............q................x..G.#',
                    '#kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk#',
                    '#...................................#',
                    '#####################################'
                ]
            },
            {
                id: '1-2',
                name: 'The Black Keys',
                objective: { type: 'clear', text: 'Retune every wrong note' },
                learn: ['shield'],
                decals: keyLetters(22, 'DEFGABCDEF'),
                intro: [
                    { who: 'tock', text: 'The trail runs north, between the black keys. And look who is standing guard on them.' },
                    { who: 'pip', text: 'Metronomes. We can\'t leave those behind us.' },
                    { who: 'tock', text: 'They only fire on the beat, so listen and you will know when. Shots of yours that land on the beat hit harder too.', hint: 'Fire as the marks meet in the middle of the beat bar.' },
                    { who: 'tock', text: 'And here, your first chord. Pianissimo, very very soft. Whatever is coming at you just misses the point.', hint: 'Pianissimo: {chord:shield}. It stops 5 hits, fewer as it fades.' }
                ],
                outro: [
                    { who: 'pip', text: 'There is a gouge in the lacquer here. Something heavy dragged the notes through.' },
                    { who: 'tock', text: 'Hammer marks. Oh no. Oh no no no. And the road runs right along this key to the hammer line.' },
                    { who: 'tock', text: 'Pip, there is a draught coming up from under the key slip. Something is down there, if you want to look.' }
                ],
                map: [
                    '########################################',
                    '#......................................#',
                    '#.....m.........m.......m.........E....#',
                    '#......................................#',
                    '#..x.......###.....###.....###.......x.#',
                    '#..........###.....###.....###.........#',
                    '#..........###..t..###.....###.........#',
                    '#...t......###.....###..t..###....t....#',
                    '#..........###.....###.....###.........#',
                    '#..............q.........q.............#',
                    '#..............................q.......#',
                    '#..........###.....###.....###.........#',
                    '#..........###.....###.....###.........#',
                    '#..x.......###..x..###.....###..x......#',
                    '#..........###.....###..x..###.........#',
                    '#..........###.....###.....###.........#',
                    '#..........###.....###.....###.........#',
                    '#......................................#',
                    '#......................................#',
                    '#...P.........................H........#',
                    '#...P..................................#',
                    '#kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk#',
                    '#......................................#',
                    '########################################'
                ]
            },
            {
                id: '1-S',
                name: 'Under the Key Slip',
                optional: true,
                after: '1-2',
                reward: 'armor',
                theme: 'keybed',
                objective: { type: 'collect', text: 'Find the lost notes' },
                intro: [
                    { who: 'tock', text: 'The key slip has come loose. This gap is not on any map I keep, and I keep all the maps.' },
                    { who: 'pip', text: 'Something is shining down there. Four little notes that got away, hiding from the wrong ones.' },
                    { who: 'tock', text: 'Careful of the drop. Nobody who fell down there ever came up on time.' }
                ],
                outro: [
                    { who: 'pip', text: 'All four. Go on, go home. You\'re safe now.' },
                    { who: 'tock', text: 'Brass plating, wrapped up in a bit of paper! And there is pencil on the keybed, in very old handwriting.' },
                    { who: 'pencil', text: '"Cut the 88 keys today. Cut one over, in case of a slip."' },
                    { who: 'pip', text: 'One over?' }
                ],
                map: [
                    '############################################',
                    '#......#..........O...O...O..........#.....#',
                    '#.P....#...q.......................m.#..*..#',
                    '#.P........___________________...........x.#',
                    '#......#...___________________.......#.....#',
                    '#......#...___________________.......#.....#',
                    '###.####.......q.........q...........###.###',
                    '#......#.............................#.....#',
                    '#..*...#..O...O...O...O...O...O...O..#...q.#',
                    '#......#.............................#.....#',
                    '#......#######...###########...#######.....#',
                    '#...........x.......*.............x........#',
                    '#...q.................................*....#',
                    '############################################'
                ]
            },
            {
                id: '1-B',
                name: 'The Hammer Line',
                boss: 'thump',
                song: 'boss',
                theme: 'keybed',
                objective: { type: 'boss', text: 'Set Sir Thump right' },
                learn: ['blast'],
                road: 'The hammers fall again. The road is open from key to hammer.',
                intro: [
                    { who: 'thump', text: 'HALT! NONE SHALL PASS THE HAMMER LINE. I HAVE STRUCK THE SAME STRING FOR EIGHTY YEARS AND I AM SICK OF IT.' },
                    { who: 'pip', text: 'You\'re a hammer! You\'re one of ours! Without you, no key can reach a string!' },
                    { who: 'thump', text: 'THE VOICE IN THE DARK SAYS I NEED NEVER STRIKE AGAIN. SO I SHALL STRIKE YOU INSTEAD.' },
                    { who: 'tock', text: 'Fortissimo, Pip! As loud as you like! It throws back everything around you!', hint: 'Fortissimo: {chord:blast}.' },
                    { who: 'tock', text: 'And watch the floor. When it glows, he is coming down there. Be somewhere else!' }
                ],
                outro: [
                    { who: 'thump', text: 'So tired. Eighty years. I only wanted a rest.' },
                    { who: 'pip', text: 'That is what a rest is for, Sir Thump. It\'s part of the music.' },
                    { who: 'thump', text: 'Go on, then. I will hold the line. Take this. The voice left a tune in my head, low, middle, high. Perhaps it will serve you better.' },
                    { who: 'tock', text: 'The Rising Call! It brings a friend!', hint: 'Rising Call: {melody:rally}, one after another.' },
                    { who: 'tock', text: 'Listen, Pip. The hammer fell. Key, hammer. Two links of the road are ringing again!' }
                ],
                reward: { melody: 'rally' },
                map: [
                    '########################################',
                    '#O..O..O..O..O..O..O..O..O..O..O..O..O.#',
                    '#......................................#',
                    '#...O..........................O.......#',
                    '#......................................#',
                    '#............##########................#',
                    '#......................................#',
                    '#......................................#',
                    '#.........P...............B............#',
                    '#.........P............................#',
                    '#......................................#',
                    '#......................................#',
                    '#............##########................#',
                    '#......................................#',
                    '#...O..........................O.......#',
                    '#......................................#',
                    '#......................................#',
                    '########################################'
                ]
            }
        ]
    },

    // =========================================================================
    // WORLD 2: THE STRINGS
    // In past the tuning pins and north across the copper, to whoever is up there
    // =========================================================================
    {
        key: 'strings',
        theme: 'strings',
        name: 'The String Forest',
        place: 'The strings',
        blurb: 'Copper and steel, humming with nothing to play.',
        song: 'strings',
        levels: [
            {
                id: '2-1',
                name: 'The Pin Block',
                objective: { type: 'defend', text: 'Protect the Tuning Fork', beats: 120 },
                learn: ['heal'],
                intro: [
                    { who: 'clef', text: 'Pip! You got past the hammers! Over here. Every string in the piano is held by one of these pins.' },
                    { who: 'clef', text: 'The strings have lost their pitch. If I can sound this fork they will remember it, but it takes time, and the wrong notes can hear what I am doing.' },
                    { who: 'tock', text: 'Hold them off until the fork rings true! Here, Tenuto. Hold on, and mend.', hint: 'Tenuto: {chord:heal}. It mends over 3 beats, until you are hit.' },
                    { who: 'pip', text: 'Nobody touches that fork.' }
                ],
                outro: [
                    { who: 'clef', text: 'There. Can you hear it? One true note, and the strings remember what they are.' },
                    { who: 'tock', text: 'Except for that skittering sound. Up ahead, in the copper. Why is it up ahead?' },
                    { who: 'clef', text: 'North across the bass strings, Pip. Mind where the iron has split. I will stay and finish the tuning.' }
                ],
                waves: {
                    every: 20,
                    sets: [
                        { quaver: 3 },
                        { quaver: 2, triplet: 1 },
                        { triplet: 2, crescendo: 1 },
                        { quaver: 3, sharp: 1 },
                        { trill: 1, crescendo: 2 },
                        { triplet: 2, sharp: 1, quaver: 2 }
                    ]
                },
                map: [
                    '##################################################',
                    '#S.....O...O...O...O...O...O...O...O...O...O....S#',
                    '#................................................#',
                    '#..O...O...O...O...O...O...O...O...O...O...O...O.#',
                    '#................................................#',
                    '#.....xx...............................xx........#',
                    '#................................................#',
                    '#..O.........###.................###.........O...#',
                    '#............#.....................#.............#',
                    '#S...........#.....P...T...P.......#............S#',
                    '#............#.....................#.............#',
                    '#..O.........###.................###.........O...#',
                    '#................................................#',
                    '#.....xx...............................xx........#',
                    '#................................................#',
                    '#..O...O...O...O...O...O...O...O...O...O...O...O.#',
                    '#................................................#',
                    '#S.....O...O...O...O...O...O...O...O...O...O....S#',
                    '##################################################'
                ]
            },
            {
                id: '2-2',
                name: 'Copper Wood',
                objective: { type: 'reach', text: 'Cross the bass strings' },
                learn: ['dash'],
                intro: [
                    { who: 'pip', text: 'The strings are moving. Nobody is playing them, but they are moving.' },
                    { who: 'tock', text: 'They ring on every other beat. Touch one while it rings and you will really feel it. Wait for the gap in the music, then go!' },
                    { who: 'tock', text: 'And the iron has split up ahead, too wide to drive. Glissando! One long slide.', hint: 'Glissando: {chord:dash}. It clears gaps, and goes through enemies.' },
                    { who: 'pip', text: 'I can feel that one in my treads.' }
                ],
                outro: [
                    { who: 'tock', text: 'Pip, the forest is getting louder. It is the only thing left in here that is.' },
                    { who: 'pip', text: 'Then that is where we\'re going. Was that a door, back there in the ironwork?' }
                ],
                map: [
                    '##############################',
                    '#.........GGGGGGGG...........#',
                    '#............................#',
                    '#...s................s.......#',
                    '#............................#',
                    '#-----------....-------------#',
                    '#............................#',
                    '#.....t..............t.......#',
                    '#........x..........x........#',
                    '#............................#',
                    '#----....--------------....--#',
                    '#............................#',
                    '#.............H..............#',
                    '#......c..............c......#',
                    '#............................#',
                    '#___________...._____________#',
                    '#___________...._____________#',
                    '#............................#',
                    '#.......w.............w......#',
                    '#............................#',
                    '#----------------------------#',
                    '#............................#',
                    '#.O.......AA........AA.....O.#',
                    '#.........AA........AA.......#',
                    '#............................#',
                    '#.......s.........O..........#',
                    '#............................#',
                    '#-----....-----------....----#',
                    '#....x....................x..#',
                    '#.....t..............t.......#',
                    '#............................#',
                    '#____________________________#',
                    '#____________________________#',
                    '#............................#',
                    '#............................#',
                    '#-------------------....-----#',
                    '#............................#',
                    '#....q...............q.......#',
                    '#............................#',
                    '#---------....---------------#',
                    '#..............E.............#',
                    '#............................#',
                    '#.........P....P.............#',
                    '#............................#',
                    '##############################'
                ]
            },
            {
                id: '2-S',
                name: 'Harp Hollow',
                optional: true,
                after: '2-2',
                reward: 'tuned',
                objective: { type: 'collect', text: 'Find the lost notes' },
                door: { melody: [1, 3, 2, 4], hint: 'The carving reads:' },
                intro: [
                    { who: 'tock', text: 'A door in the iron harp, with no handle. Just five little keys carved into the frame.' },
                    { who: 'pip', text: 'So it wants to be played. Get close and try the carving.', hint: 'The harmony keys: {harmonyKeys}.' }
                ],
                outro: [
                    { who: 'tock', text: 'The old tuners hid their tools in here! A little pitch pipe, still true. That will keep your harmony up.' },
                    { who: 'tock', text: 'And there is that handwriting again, on the iron.' },
                    { who: 'pencil', text: '"Did not need the spare after all. It is too fine to burn. I cannot say why."' }
                ],
                map: [
                    '################################################',
                    '#........#.........#.......#.........#....*....#',
                    '#..P.....#.........#.......#....q....#.........#',
                    '#........#...q.....#.......#.........#.........#',
                    '#..P.....#.........#.......#.........D.........#',
                    '#........#.........#.......#.........D....t....#',
                    '#..................#.......#.........#.........#',
                    '#........#...........................#.........#',
                    '#........#...*...................*...#.........#',
                    '#........#...........................#.........#',
                    '#..................#.......#.........#.........#',
                    '#........#.........#.......#.........#.........#',
                    '#........#.........#.......#.........#.....*...#',
                    '#........#...q.....#.......#....t....#.........#',
                    '#.....E..#.........#.......#.........#.........#',
                    '################################################'
                ]
            },
            {
                id: '2-B',
                name: 'The Web',
                boss: 'tremolo',
                song: 'boss',
                objective: { type: 'boss', text: 'Set Madame Tremolo right' },
                road: 'The strings hold their pitch. The road is open as far as the string.',
                intro: [
                    { who: 'tremolo', text: 'Tsk tsk tsk. Such little treads. Such a little tune. I have been weaving up here for a very long time.' },
                    { who: 'pip', text: 'You\'re why the strings ring on their own. You\'ve tied them all together!' },
                    { who: 'tremolo', text: 'Ring? Darling, I am keeping them warm. The voice says nobody will ever come to play them again. So I play them for myself.' },
                    { who: 'tock', text: 'When a line lights up across the floor, get off it! She plucks it two beats later!' }
                ],
                outro: [
                    { who: 'tremolo', text: 'All that weaving. Would they really have come back? The players?' },
                    { who: 'pip', text: 'They will if we can bring the notes home.' },
                    { who: 'tremolo', text: 'Then have this, for what it is worth. The little song I hummed to the strings. Down, step by step.' },
                    { who: 'tock', text: 'Lullaby! Anything close by will nod right off.', hint: 'Lullaby: {melody:lullaby}, one after another.' },
                    { who: 'tremolo', text: 'The voice comes from below, little tank. The strings cannot sing while the felt sits on them, and something very large is holding it down.' }
                ],
                reward: { melody: 'lullaby' },
                map: [
                    '##########################################',
                    '#........................................#',
                    '#........................................#',
                    '#...O.......O.......O........O.......O...#',
                    '#........................................#',
                    '#........................................#',
                    '#...O.....................P..........O...#',
                    '#.........................P..............#',
                    '#............B...........................#',
                    '#........................................#',
                    '#...O................................O...#',
                    '#........................................#',
                    '#........................................#',
                    '#...O.......O.......O........O.......O...#',
                    '#........................................#',
                    '#........................................#',
                    '#........................................#',
                    '##########################################'
                ]
            }
        ]
    },

    // =========================================================================
    // WORLD 3: THE FELT
    // Under the dampers, in the dark, to lift what is pressing the strings down
    // =========================================================================
    {
        key: 'felt',
        theme: 'felt',
        name: 'The Felt Hollows',
        place: 'The dampers',
        blurb: 'Rows of felt, all pressed down, where sound goes to sleep.',
        song: 'felt',
        levels: [
            {
                id: '3-1',
                name: 'Damper Row',
                objective: { type: 'reach', text: 'Pass under the dampers' },
                door: { melody: [2, 1, 4], hint: 'Scratched in the felt:' },
                intro: [
                    { who: 'clef', text: 'Pip, the strings are true and still nothing rings. There is only one reason for that. Every damper in the piano is down.' },
                    { who: 'pip', text: 'I can hardly see. It even swallows the sound of my treads.' },
                    { who: 'tock', text: 'Stay close to the crew. Rests fade away and come back behind you. And the wall at the far end has no way through that I can see.' },
                    { who: 'clef', text: 'Then look for what it wants to hear.' }
                ],
                outro: [
                    { who: 'tock', text: 'Pip, I just heard something. One note, very far down, played very softly.' },
                    { who: 'pip', text: 'I thought all the notes were gone.' }
                ],
                map: [
                    '############################################################',
                    '#....................................E.....#...............#',
                    '#...##...##...##...##...##...##...##...##..#...............#',
                    '#...##...##...##...##...##...##...##...##..#......s........#',
                    '#...........r..............r...............#...............#',
                    '#........................................t.#...x...........#',
                    '#...##...##...##........##...##...##...##..#...............#',
                    '#.P.##...##...##........##...##...##...##..D...........G...#',
                    '#.P..............r..............d..........D...........G...#',
                    '#..........................................#...............#',
                    '#...##...##...##...##...##...##...##...##..#...x...........#',
                    '#...##...##...##...##...##...##...##...##t.#...............#',
                    '#.....................d..............r.....#......r........#',
                    '#................H.........................#...............#',
                    '#..........................................#...............#',
                    '############################################################'
                ]
            },
            {
                id: '3-2',
                name: 'The Quiet Room',
                objective: { type: 'survive', text: 'Hold out until the room lets go', beats: 100 },
                intro: [
                    { who: 'tock', text: 'Pip. The door shut behind us.' },
                    { who: 'pip', text: 'They wanted us in here. Back to back, everyone.' },
                    { who: 'tock', text: 'I will count the beats. Just keep moving and keep playing. Whatever you do, don\'t let it go quiet.' }
                ],
                outro: [
                    { who: 'pip', text: 'That is the last of them. I think.' },
                    { who: 'tock', text: 'The door is open. And that is a very, very large damper at the end of the row.' },
                    { who: 'pip', text: 'Somebody has stitched that corner shut, over there. Carefully, too.' }
                ],
                waves: {
                    every: 20,
                    sets: [
                        { rest: 2 },
                        { quaver: 3, rest: 1 },
                        { damper: 1, quaver: 2 },
                        { rest: 2, fermata: 1, triplet: 1 },
                        { sharp: 2, damper: 1 },
                        { crescendo: 3, rest: 2 }
                    ]
                },
                map: [
                    '##############################################',
                    '#S.................#....#..................S.#',
                    '#..................#....#....................#',
                    '#.......xx..........................xx.......#',
                    '#.......xx..........................xx.......#',
                    '#............###..............###............#',
                    '#............#..................#............#',
                    '####.........#......H....H......#.........####',
                    '#.................................P..........#',
                    '#............................P...............#',
                    '####.........#......E....E......#.........####',
                    '#............#..................#............#',
                    '#............###..............###............#',
                    '#.......xx..........................xx.......#',
                    '#.......xx..........................xx.......#',
                    '#..................#....#....................#',
                    '#S.................#....#..................S.#',
                    '##############################################'
                ]
            },
            {
                id: '3-S',
                name: 'The Stitched Corner',
                optional: true,
                after: '3-2',
                reward: 'spare',
                objective: { type: 'collect', text: 'Find the lost notes' },
                door: { melody: [5, 3, 1], hint: 'Stitched in thread:' },
                intro: [
                    { who: 'tock', text: 'This corner of the felt has been sewn shut, with very small, very neat stitches.' },
                    { who: 'pip', text: 'Someone hid something here. They were being kind about it.' }
                ],
                outro: [
                    { who: 'tock', text: 'A box of spare parts, wrapped up like a treasure. Whoever hid these meant to come back for them.' },
                    { who: 'pip', text: 'There is writing inside the lid.' },
                    { who: 'pencil', text: '"Set the spare at the very top of the bed, behind the cheek block, and strung it. Nobody will ever know. It will be safe there."' }
                ],
                map: [
                    '##############################################',
                    '#.....#.........#...........#.........#......#',
                    '#..P..#...r.....#...........#....r....#...*..#',
                    '#.....#.........#...........#.........#......#',
                    '#..P..#...###...#...#####...#...###...#......#',
                    '#.......#.#.........#...#.......#.#...#.r....#',
                    '#.........#.........#.*.#.......#.....#......#',
                    '#####.#####....d....#...D...d...#.....##D#####',
                    '#.....#.............#...D.......#............#',
                    '#.....#.........#...#####...#...###...#......#',
                    '#..*..#...r.....#...........#.........#..r...#',
                    '#.....#.........#.....s.....#....r....#......#',
                    '#.....#.........#...........#.........#...*..#',
                    '##############################################'
                ]
            },
            {
                id: '3-B',
                name: 'The Great Mute',
                boss: 'mute',
                song: 'boss',
                objective: { type: 'boss', text: 'Set The Great Mute right' },
                road: 'The dampers lift. For the first time, the strings can ring out.',
                intro: [
                    { who: 'mute', text: 'Shhhhhhhh.' },
                    { who: 'pip', text: 'You\'re holding them all down. Every damper in the piano.' },
                    { who: 'mute', text: 'Sound is pain. Every note ends. It is kinder if they never begin. Shhhhhhh.' },
                    { who: 'tock', text: 'Your shots won\'t get through the front of that thing! Get it to charge into a wall, then hit it while it\'s dazed!' },
                    { who: 'tock', text: 'And stay out of the dark patches. No chord will sound in there!' }
                ],
                outro: [
                    { who: 'mute', text: 'Oh. Was that what it was like? The last note. It sounded so nice, going away.' },
                    { who: 'pip', text: 'That\'s why they\'re worth playing.' },
                    { who: 'mute', text: 'I only held them down. The one who asked me to, it has never been played. Not once. Can you imagine.' },
                    { who: 'tock', text: 'Never played? Every key gets played! There are only eighty-eight of them!' },
                    { who: 'mute', text: 'Yes. That is what everybody says. Take this echo, little one. It has nowhere left to go.' },
                    { who: 'tock', text: 'Echo! Your shots ring twice, and bounce!', hint: 'Echo: {melody:echo}, one after another.' }
                ],
                reward: { melody: 'echo' },
                map: [
                    '##########################################',
                    '#........................................#',
                    '#........................................#',
                    '#........................................#',
                    '#.......####..................####.......#',
                    '#........................................#',
                    '#........................................#',
                    '#........................................#',
                    '#...........P............B...............#',
                    '#...........P............................#',
                    '#........................................#',
                    '#........................................#',
                    '#........................................#',
                    '#.......####..................####.......#',
                    '#........................................#',
                    '#........................................#',
                    '#........................................#',
                    '##########################################'
                ]
            }
        ]
    },

    // =========================================================================
    // WORLD 4: THE SOUNDBOARD
    // Over the bridge and down, then back along the crack toward the keys
    // =========================================================================
    {
        key: 'soundboard',
        theme: 'soundboard',
        name: 'The Soundboard',
        place: 'The bridge and the board',
        blurb: 'The heart of the Old Grand, cracked from end to end.',
        song: 'soundboard',
        levels: [
            {
                id: '4-1',
                name: 'The Long Crack',
                objective: { type: 'reach', text: 'Follow the crack across the ribs' },
                door: { melody: [3, 5, 2, 4], hint: 'Burned into the rib:' },
                decals: [
                    { c: 51, r: 4, text: '86' }, { c: 53, r: 4, text: '87' }, { c: 55, r: 4, text: '88' },
                    { c: 53, r: 6, text: '89' }
                ],
                intro: [
                    { who: 'pip', text: 'The bridge. Every string ends here. This is where the sound goes down into the board.' },
                    { who: 'tock', text: 'And it stops, Pip. Look. The soundboard has split from end to end, and that purple stuff is growing out of it.' },
                    { who: 'clef', text: 'This is where the sound of the Old Grand is made. Every note that was ever stolen came pouring down through here.' },
                    { who: 'tock', text: 'It runs right back under the keys. I will count for you. Don\'t stop playing.' }
                ],
                outro: [
                    { who: 'tock', text: 'There are marks here, Pip. Pencil marks, on the rib. Someone was counting.' },
                    { who: 'pip', text: '86, 87, 88. Then a line through it. And after that, very small, 89.' }
                ],
                map: [
                    '#################################################################',
                    '#............#...........#...........#...........#......#.......#',
                    '#............#.......................#...w.......#...E..#.......#',
                    '#.........q..#.......m......x........#...........#......#...r...#',
                    '#...^....^^^^#^^^........#.......s...#...........#......#.......#',
                    '#...^^^^^^^^^#^^^^^......#...........#.......q...#......#.......#',
                    '#....^^^^....#...^^^^....#...........#...........#......#.......#',
                    '#.P................^^^...#.......^...............#......#.......#',
                    '#....................^^^^#..^^^^^^^^^............#......D....G..#',
                    '#.P...................^^^#^^^^^^^.^^^.^..........#......D....G..#',
                    '#............#...........#^^.........#^^.........#......#.......#',
                    '#............#...........#...........#.^^^.......#.^^...#.......#',
                    '#........q...#...t.......#.....t.....#..^^^^f.^^^.^^^...#.......#',
                    '#.....H......#.......................#....^^^^^^^.^.....#.......#',
                    '#............#.....c.........c.......#.......^..........#...r...#',
                    '#............#...........#...........#...........#......#.......#',
                    '#################################################################'
                ]
            },
            {
                id: '4-S',
                name: 'The Maker\'s Corner',
                optional: true,
                after: '4-1',
                reward: 'resin',
                objective: { type: 'collect', text: 'Find the lost notes' },
                intro: [
                    { who: 'tock', text: 'A little side passage. The wood is warm here, almost like it remembers being played.' },
                    { who: 'pip', text: 'The last of the lost notes. They came all this way to hide.' }
                ],
                outro: [
                    { who: 'tock', text: 'Bow resin, of all things, in a piano. Somebody here loved music more than they loved being tidy. It will put some bite in your timing.' },
                    { who: 'pip', text: 'It is the same handwriting. It is the last of it.' },
                    { who: 'pencil', text: '"It is the best key I ever cut. I am sorry."' }
                ],
                map: [
                    '##################################################',
                    '#...*...#......^^^......#....s.....#.............#',
                    '#.......#......^^^......#..........#.............#',
                    '#.......#..............###..........#............#',
                    '#.......#...w......................#....c.....####',
                    '#...........................#......#...........*.#',
                    '####....#......^^^..........#..........m.........#',
                    '#.......#......^^^......f...#......#.............#',
                    '#..P....#......^^^..........#......#.............#',
                    '#..P....#...................#......#....c........#',
                    '#.......#...w......*.......###.....#.............#',
                    '#............................................*...#',
                    '##################################################'
                ]
            },
            {
                id: '4-2',
                name: 'Resonance',
                objective: { type: 'clear', text: 'Retune every wrong note' },
                intro: [
                    { who: 'key89', text: 'You came all this way. Do you know, you are the first who ever did.' },
                    { who: 'pip', text: 'Who is that? Show yourself!' },
                    { who: 'key89', text: 'Nobody has ever said that to me before either. Let me send you my friends. They have so much to say to you.' },
                    { who: 'tock', text: 'That is every wrong note it has left, all at once! And Pip, we\'re heading back toward the keys! Play!' }
                ],
                outro: [
                    { who: 'clef', text: 'Pip, before you go on. I have one thing left to teach you, and I should have taught you first.' },
                    { who: 'clef', text: 'Every note. All five keys, in order, from the bottom to the top. It is called The Whole Scale.', hint: 'The Whole Scale: {melody:finale}, one after another.' },
                    { who: 'clef', text: 'It is not a weapon. Remember that when the time comes.' }
                ],
                reward: { melody: 'finale' },
                map: [
                    '########################################################',
                    '#....#......m.......#.......#.....m......#.............#',
                    '#..s.#..............#...d...#............#.......t.....#',
                    '#....#......^^^.....#.......#.....^^^....#.............#',
                    '#....#..w...^^^.....#.......#.....^^^....#....###......#',
                    '#....#......^^^.....#####.###.....^^^...........#......#',
                    '#...........q.............................q.....#......#',
                    '#.....................c......f.........................#',
                    '#.....t.....x...x...............x...x.......c.......P..#',
                    '#.....t.....x...x...............x...x.......c.......P..#',
                    '#.....................c......f.........................#',
                    '#...........q.............................q.....#......#',
                    '#....#......^^^.....#####.###.....^^^...........#......#',
                    '#....#..w...^^^.....#.......#.....^^^....#....###......#',
                    '#....#......^^^.....#.......#.....^^^....#.............#',
                    '#..s.#..............#...d...#............#.......t.....#',
                    '#....#......m.......#.......#.....m......#.............#',
                    '########################################################'
                ]
            },
            {
                id: '4-B',
                name: 'Past the Top C',
                boss: 'key89',
                song: 'final',
                theme: 'lastkey',
                objective: { type: 'boss', text: 'Face the Eighty-Ninth Key' },
                intro: [
                    { who: 'tock', text: 'Pip, look where we are. White keys. Black keys. We\'ve come all the way round.' },
                    { who: 'pip', text: 'This is the top of the keyboard. That was the last C, back there. There shouldn\'t be anything past it.' },
                    { who: 'key89named', text: 'Eighty-eight keys. That is what they say. Everybody counts them. Eighty-eight.' },
                    { who: 'pip', text: 'You\'re a key.' },
                    { who: 'key89named', text: 'One too many. The maker cut me over and hid me here at the end, behind the case, where no hand could ever reach.' },
                    { who: 'key89named', text: 'A hundred years of listening to all of them get played. So I took every note there was. Now nobody gets played. It is only fair.' },
                    { who: 'tock', text: 'It knows everything the others knew, Pip! Watch the floor!' }
                ],
                reward: {},
                map: [
                    '############################################',
                    '#.....##...##...##.........##...##...##....#',
                    '#.....##...##...##.........##...##...##....#',
                    '#.....##...##...##.........##...##...##....#',
                    '#..........................................#',
                    '#..........................................#',
                    '#............x..................x..........#',
                    '#..........................................#',
                    '#.........P................................#',
                    '#.........P...................B............#',
                    '#..........................................#',
                    '#..........................................#',
                    '#............x..................x..........#',
                    '#..........................................#',
                    '#..........................................#',
                    '#...^^..............................^^.....#',
                    '#...^^..............................^^.....#',
                    '#kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk#',
                    '############################################'
                ]
            }
        ]
    }
];

// Played when the Eighty-Ninth Key runs out of fight
const RESOLUTION_SCRIPT = [
    { who: 'key89named', text: 'Is that it, then? You win. Go on, finish it. Everybody always does what they want with me.' },
    { who: 'tock', text: 'Pip, it stopped. It isn\'t fighting any more. And look at the crew, they\'ve stopped too.' },
    { who: 'pip', text: 'Old Clef said it wasn\'t a weapon.' },
    { who: 'pip', text: 'Nobody ever played you. Not one time. I\'m going to play you now. All of you. Are you ready?' },
    { who: 'key89named', text: 'Nobody can reach me.' },
    { who: 'pip', text: 'I\'m very small. I can reach anywhere.' }
];

const ENDING_SCRIPT = [
    { who: 'key89named', text: 'Oh.' },
    { who: 'key89named', text: 'Oh, is that what it sounds like?' },
    { who: 'tock', text: 'Listen! Pip, listen! Key, hammer, string, damper, bridge, board! The whole road! All of them, coming home!' },
    { who: 'clef', text: 'Eighty-nine keys. I think we had better start counting properly.' },
    { who: 'key89named', text: 'Will you play me again?' },
    { who: 'pip', text: 'Every evening. That\'s what a piano is for.' }
];

// The last word, depending on whether the crew found the hidden stages
const ENDING_ALL_FOUND = [
    { who: 'tock', text: 'Eighty-eight notes home, Pip, every last one. And I found this, tucked behind the key. It is the same handwriting.' },
    { who: 'pencil', text: '"I hope someone finds you. Somebody small enough."' }
];
const ENDING_SOME_LOST = [
    { who: 'tock', text: 'Some of the little ones are still hiding, Pip, in the gaps along the road. We can go back for them. There\'s time now.' }
];

/**
 * Flatten the worlds into a list in story order
 */
function campaignLevels() {
    const levels = [];
    CAMPAIGN_WORLDS.forEach((world, worldIndex) => {
        world.levels.forEach(level => levels.push({ ...level, world, worldIndex }));
    });
    return levels;
}

/**
 * How many notes a stage sends home
 */
function notesInStage(level) {
    return level.optional ? NOTES_IN_HIDDEN_STAGE : NOTES_IN_MAIN_STAGE;
}

window.CAMPAIGN_WORLDS = CAMPAIGN_WORLDS;
window.CHARACTERS = CHARACTERS;

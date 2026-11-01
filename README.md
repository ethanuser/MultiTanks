# MultiTanks

## PLAY HERE: [ethannguyenuser.github.io/MultiTanks](https://ethannguyenuser.github.io/MultiTanks/)

A pixel art tank battle game you can play on a real piano. Up to four players share one keyboard, each driving a tiny tank with their own octave, in a story campaign or in arena battles against each other and AI bots.

## Features
- **The 89th Key:** a 16-stage story campaign across four worlds inside a grand piano, with boss fights, a world map and saved progress
- **Free For All and Team Battle:** mirrored, randomly generated arenas with four themes and four bot skill levels
- **Play it like a piano:** chords trigger abilities, melodies cast spells and open doors, and shots on the beat hit harder
- **MIDI input** for up to four players, with full keyboard controls for one

## Getting Started

### Prerequisites
- A modern desktop browser. Recommended: Chrome/Edge.
- For MIDI input: Web MIDI support (Chrome/Edge). Keyboard fallback works everywhere.
- Tested with a Yamaha Digital Piano P-125 (USB MIDI) for input.

### Run Locally
You can simply clone the repo and open `index.html` directly in your browser (double-click or drag it into a tab). No server required.

If your browser blocks local file access for audio/MIDI, you can optionally use a simple local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.

The menus work with the mouse, the arrow keys, or the piano itself: A and C move left and right, A# and B move up and down, and D selects.

## Controls

Every setting in the menus is an icon: hover or focus one to see what it does. Difficulty and bot skill are dynamics, from p to ff.

Each player has one octave, from A to G#. Player 1 starts at the lowest A on the piano, and each player after that starts two octaves higher.

| Action | Piano | Keyboard |
| --- | --- | --- |
| Drive | A# up, A left, B down, C right | W A S D |
| Aim | C# left, D# right | Left / Right arrows |
| Shoot | D | Space or Enter |
| Harmony keys 1 to 5 | E, F, F#, G, G# | 1 to 5 |

The game talks in terms of whichever you are using: dialogue, hints and the Controls page all name piano keys when a piano is connected, and computer keys when one is not.

### Rhythm
Fire as the marks meet in the middle of the beat bar. On-beat shots hit harder, fill the harmony meter faster and build your groove. Every drum pattern in the score marks all four beats, so the pulse can always be heard.

### Chords
Strike two harmony keys together. Chords spend harmony, the gold bar, which fills as you land hits. Each chord has its own job and its own cooldown, shown along the bottom of the screen.

| Chord | Piano | Keyboard | Harmony | Cooldown | Effect |
| --- | --- | --- | --- | --- | --- |
| Pianissimo | E + G | Q, or 1 + 4 | 30 | 9s | Stops 5 hits of any size at first, fading by one hit every 1.6 seconds |
| Glissando | F + G# | Left Shift, or 2 + 5 | 15 | 0.6s | Slides through shots and gaps, and hurts whatever it hits |
| Fortissimo | E + G# | E, or 1 + 5 | 40 | 6s | Clears nearby shots and throws enemies back |
| Tenuto | F + G | F, or 2 + 4 | 50 | 14s | Mends 2 health on each of 3 beats, until you are hit |

### Melodies
Play harmony keys one after another. In the campaign these are learned along the way, and melody doors have tunes of their own. Once a tune is two notes in, the keys that carry it on can never set off a chord by accident.

| Melody | Keys | Harmony | Cooldown | Effect |
| --- | --- | --- | --- | --- |
| Rising Call | 1 3 5 | 45 | 6s | Summons two little allies |
| Lullaby | 5 4 3 2 | 50 | 7s | Puts enemies to sleep, even across the room |
| Echo | 1 5 1 5 | 45 | 6s | Every shot rings three times, and bounces |
| The Whole Scale | 1 2 3 4 5 | 80 | 10s | Clears every shot and hits every enemy |

### Pickups
| Pickup | Effect |
| --- | --- |
| Repair | Mends 8 health |
| Harmony | Fills the gold bar. Only appears if someone can use it |
| Encore | Nothing hurts for 7 seconds |
| Allegro | Drive 30% faster, per stack |
| Vivace | A second shot on the half beat. Two stacks play triplets, three play sixteenths |
| Triad | Three shots in a fan. Stacks to five and seven |
| Ricochet | Shots bounce three times, and hit 1 harder for each bounce |

### Hotkeys
- Esc or P: Pause. The pause menu has restart, fullscreen, sound, the controls, and the way back to the map or menu
- R: Restart the current game or stage, or relaunch the last settings from the menu
- M: Mute

## Game Modes

### The 89th Key
Pip's crew of tiny tanks live inside the Old Grand. One night all 88 notes in the piano vanish, and they set out to bring the music home.

Every note walks the same road through a piano, so the journey does too: key, hammer, string, damper, bridge, soundboard. Each stage picks up where the last left off, each boss is a part of the piano that stopped doing its job, and the world map is the piano itself, seen from above, lighting up as it is mended. The wrong notes you fight are the stolen ones, and setting one right sends it home. The hidden stages hold the last of the 88, and a story of their own.

Each world has two main stages, a hidden stage with a permanent reward, and a boss. Crew size, AI allies and difficulty are all adjustable, and progress is saved in the browser. Bosses scale to the size of the crew.

| Difficulty | What changes |
| --- | --- |
| Piano | Slow enemies, slow fire, softer hits, and the tempo as written |
| Mezzo | The whole game runs 10% faster, music and crew included |
| Forte | The whole game runs 22% faster, and every enemy fires in patterns, for far more shots in the air |

### Free For All
Last tank rolling wins.

### Team Battle
Red against blue. Click a tank on the setup screen to swap its side.

If an arena match runs past two minutes, the Encore begins: every tank wears down on the beat until someone wins.

## Project Structure
```
MultiTanks/
  index.html
  test_midi.html
  favicon.svg, favicon.png
  css/
    style.css         The interface
  fonts/
    TinyTanks.woff    Built from js/pixelFont.js
  tools/
    build_font.py     Rebuilds the font after a glyph changes
  js/
    constants.js      Game settings and balance
    pixelFont.js      The typeface, drawn by hand
    sprites.js        All pixel art, drawn in code
    tilemap.js        Tile maps, collision, route finding, arena generator
    renderer.js       Drawing the game and HUD
    songs.js          The original score
    audioSystem.js    Sound effects, music and the chiptune sequencer
    game.js           Main engine
    collisions.js     Movement and bullets
    powerups.js       Pickups
    abilities.js      Chords, melodies and what they do
    aiBehavior.js     Bot AI
    enemies.js        Campaign enemies
    bosses.js         Boss attacks and phases
    story.js          The campaign's script and maps
    dialog.js         Dialogue
    overworld.js      World map
    menu.js           Menus and results
    midiHandler.js    MIDI and keyboard input
    modes/
      campaignMode.js
      ffaMode.js
      modeManager.js
      tdmMode.js
  music/
```

The campaign's stages are drawn as rows of characters in `js/story.js`, with a legend at the top of the file, and most balance numbers live in `js/constants.js`. Dialogue never names a key: lines about the controls go in a `hint`, with tokens like `{chord:shield}` that are filled in for whatever the player has connected.

## Music Attribution
- Everything by default: original chiptune score, played by the game's own sequencer so that the beat is exact
- The Smash Bros. soundtrack, if chosen in Options: "Battlefield", "Final Destination" and the "Fire Emblem Theme" arrangement from Super Smash Bros. Brawl, and "Main Menu" from Super Smash Bros. Ultimate. These recordings have no beat the game can follow, so the rhythm bonus is off in arenas while they play

All rights belong to their respective owners. This project is a non‑commercial fan work with attribution.

## Notes
- Autoplay policies: Music starts after the first user gesture (click/keypress).
- MIDI: If no device is connected, the game automatically falls back to keyboard.

## License
This project is provided for educational/non-commercial use. Music and trademarked content remain the property of their respective owners.

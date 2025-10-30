# MultiTanks

Play at [ethannguyenuser.github.io/MultiTanks](https://ethannguyenuser.github.io/MultiTanks/)

MIDI/keyboard-controlled top-down tank battle game with multiple modes: Free For All, Team Deathmatch, and a 5-level Campaign.

## Features
- MIDI input support with keyboard fallback (WASD + Arrow Keys + Space)
- Game modes: FFA, TDM, Campaign (5 levels, adjustable difficulty)
- AI bots and team assignment UI
- Power-ups, audio SFX/Music, restart hotkey

## Getting Started

### Prerequisites
- A modern desktop browser. Recommended: Chrome/Edge.
- For MIDI input: Web MIDI support (Chrome/Edge). Keyboard fallback works everywhere.
- Tested with a Yamaha Digital Piano P-125 (USB MIDI) for input.

### Run Locally
You can simply clone the repo and open `index.html` directly in your browser (double-click or drag it into a tab). No server required.

If your browser blocks local file access for audio/MIDI, you can optionally use a simple local server:

- Python 3:
  ```bash
  python3 -m http.server 8000
  ```
  Then open `http://localhost:8000/index.html` and navigate to the `MultiTanks` folder if needed.

- VS Code Live Server or any static server also works.

Open the page, click “Connect MIDI Device” (or use keyboard fallback), configure players/bots, pick a mode, and Start.

## Controls
- Keyboard movement: W/A/S/D or ↑/←/↓/→
- Aim: ←/→
- Shoot: Space
- MIDI controls (per-player octaves shown in the UI):
  - Left hand (movement): A# Up, A Left, B Down, C Right
  - Right hand (turret): C# Aim Left, D# Aim Right, D Shoot

## Game Modes
- FFA: Every tank for themselves
- TDM: Red vs Blue. Players and AI can be assigned per team in the Player Assignment screen
- Campaign: 5 levels with difficulty selection (Easy/Medium/Hard)

## Hotkeys
- R: Restart current game/level, or relaunch last used settings from the menu

## Project Structure
```
MultiTanks/
  index.html
  test_midi.html
  js/
    aiBehavior.js
    audioSystem.js
    collisions.js
    constants.js
    game.js
    menu.js
    midiHandler.js
    powerups.js
    renderer.js
    modes/
      campaignMode.js
      ffaMode.js
      modeManager.js
      tdmMode.js
  music/
    ffa.mp3
    tdm.mp3
    menu.mp3
    level_1.mp3
    level_2.mp3
    level_3.mp3
    level_4.mp3
    level_5.mp3
    victory.mp3
```

## Music Attribution
- FFA: "Battlefield" from Super Smash Bros. Brawl
- TDM: "Final Destination" from Super Smash Bros. Brawl
- Menu: "Main Menu" from Super Smash Bros. Ultimate
- Levels 1–5: "Balatro Theme" (from Balatro)
- Victory: "Fire Emblem Theme" (arrangement from Super Smash Bros. Brawl)

All rights belong to their respective owners. This project is a non‑commercial fan work with attribution.

## Notes
- Autoplay policies: Music starts after the first user gesture (click/keypress).
- MIDI: If no device is connected, the game automatically falls back to keyboard.

## License
This project is provided for educational/non-commercial use. Music and trademarked content remain the property of their respective owners.

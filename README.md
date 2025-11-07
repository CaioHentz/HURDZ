# HURDZ!

A lightweight, responsive, 2D top-down zombie shooter built with Phaser 3 and Vite. Aim with the mouse and mow down zombies while upgrading your character between runs. 100% client-side, deployable to Vercel, Netlify, or GitHub Pages.

## Features

- Top-down shooter with mouse aim
- Auto-fire weapons (pistol, unlockable shotgun with shorter range)
- Zombies spawn at map edges and chase the player
- Difficulty escalates over time:
  - Faster spawn rates, more zombies
  - Stronger, faster zombies
  - Rare variants appear with increasing probability:
    - Fast zombie: smaller, faster, lower damage but higher contact rate
    - Tank zombie: bigger, slower, 5x HP
- HUD overlay shows:
  - Life (♥)
  - Coins (💰)
  - Kills (☠️)
- Game Over overlay with upgrades:
  - Increase Damage
  - Increase Fire Rate
  - Increase Speed
  - Unlock/select Shotgun
- Pause overlay (ESC to toggle)
- Main menu (Press Space to play) with title “HURDZ!” using Press Start 2P font
- Audio:
  - Softer gunshot sound
  - Satisfying hit/kill impact sounds
  - Difficulty escalation chime (“MAKE IT HARDER!”)
  - Ambient background procedural “music”
- Visuals:
  - Dark grass tile background
  - Blood particle effects on hits
  - Simple, generated placeholder sprites (no external assets)

## Tech Stack

- Phaser 3 (game engine)
- Vite (dev/build tooling)
- JavaScript (ES modules)
- 100% client-side, no server required

## Controls

- Move: WASD or Arrow Keys
- Aim: Mouse
- Pause: ESC
- Start Game: SPACE (in menu)

## Upgrades & Progression

- Earn 10 coins per zombie kill
- Spend coins on the Game Over overlay to buy upgrades
- Upgrades persist via `localStorage`
- Unlock shotgun for wider spread but shorter effective range

## Getting Started

Prerequisites:
- Node.js 18+ recommended

Install dependencies:
```bash
npm install
```

Run the dev server:
```bash
npm run dev
```
Vite will display the local URL (typically `http://localhost:5173/`). Open it in your browser.

## Build & Preview

Create a production build:
```bash
npm run build
```

Preview the build locally:
```bash
npm run preview
```

Build output will be in the `dist/` folder.

## Deploy

Because the game is fully client-side, you can deploy the `dist/` folder on any static hosting:

- Vercel:
  - Use the Vercel CLI or dashboard
  - Project root: repository root
  - Build command: `npm run build`
  - Output directory: `dist`
- Netlify:
  - Build command: `npm run build`
  - Publish directory: `dist`
- GitHub Pages:
  - Push the `dist/` to a branch and configure Pages to serve from it
  - Or use an action to build and deploy automatically

## Project Structure

```
src/
  assets/
    README.txt        # placeholder, all visuals generated programmatically
  scenes/
    MainScene.js      # main gameplay loop
    UIScene.js        # HUD + overlays (Game Over, Pause)
    MenuScene.js      # main menu (title + space to start)
  state.js            # persistent state, upgrades, weapons
  main.js             # Phaser config, scene registration
index.html
package.json
```

## Persistence

- Coins, total kills, upgrades, and unlocked weapons are stored in `localStorage`.
- If needed, you can wipe progress by clearing the browser storage.

## Notes

- Placeholder sprites/textures are generated at runtime (no external images required).
- Audio uses WebAudio API via Phaser’s audio context, no external audio files needed.
- Designed to be lightweight and responsive; resizes to the browser window.

## License

MIT

# voidpulse

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Xyzar29/voidpulse/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Xyzar29/voidpulse/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**VOIDPULSE** is a neon twin-stick arena survival game that runs entirely in the browser — no build step, no assets, no network. Pilot the last ship holding the line against a geometric swarm pouring out of the void: chasers, darts, orbiters, splitters and weavers, and every fifth wave the **VOID TITAN**, a boss that sprays bullet rings, fires aimed fans and charges straight at you.

Clear a wave and you draft one of three upgrades — split cannons, piercing rounds, orbit blades, an aegis shield, dash reactors, repair nanobots and more — and build a ship that can survive the next, harder wave. Chain kills to raise your combo multiplier up to ×8, chase the high score, and see how deep into the void you get.

## How to play

- **Move:** WASD or arrow keys
- **Aim:** mouse — your ship fires on its own
- **Dash:** Shift, Space, or right-click (brief, and it carries you through danger)
- **Pause:** P · **Mute:** M
- Clear each wave to draft an upgrade (click a card or press 1 · 2 · 3). Lose all your hearts and the run ends — press R to fly again.

## Run it

Serve the `game/` folder with any static file server and open it in a desktop browser — or use the bundled one:

```sh
node serve.ts
# then open http://localhost:8080
```

To hand the entry in the way the bounty's grader runs it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The game's source is split by job under `game/src/` — `main.js` owns the state machine and frame loop, `enemies.js` the bestiary, `waves.js` the wave director, `upgrades.js` the draft, `particles.js` the effects, `render.js` the drawing, `audio.js` the synthesised sound effects (WebAudio, no audio files), `input.js` the controls and `config.js` the tuning.

---

<sub>Entered on [make.fun](https://make.fun/?ref=86zc8pnt&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

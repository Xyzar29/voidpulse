// The wave director: turns a wave number into a spawn queue, feeds enemies
// into the arena in a trickle, and runs the boss waves — every fifth wave is
// a VOID TITAN with a slow rain of minions while it lives.

import { ENEMY_TYPES } from './enemies.js';

// Which kinds may appear from which wave on, and their pick weight.
const UNLOCKS = [
  { kind: 'chaser', fromWave: 1, weight: 5 },
  { kind: 'dart', fromWave: 1, weight: 3 },
  { kind: 'orbiter', fromWave: 2, weight: 3 },
  { kind: 'splitter', fromWave: 3, weight: 3 },
  { kind: 'weaver', fromWave: 4, weight: 2 },
];

/** The spawn queue for a normal wave: a points budget spent on unlocked kinds. */
export function compositionFor(wave) {
  if (wave === 1) return ['chaser', 'chaser', 'dart', 'chaser', 'dart', 'chaser', 'chaser'];
  let budget = 7 + wave * 3;
  const queue = [];
  const available = UNLOCKS.filter((entry) => wave >= entry.fromWave);
  while (budget > 0) {
    const totalWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = available[0];
    for (const entry of available) {
      roll -= entry.weight;
      if (roll <= 0) {
        picked = entry;
        break;
      }
    }
    const cost = Math.max(1, ENEMY_TYPES[picked.kind].cost);
    if (cost > budget && queue.length > 0) break;
    queue.push(picked.kind);
    budget -= cost;
  }
  return queue;
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}

export class WaveDirector {
  constructor() {
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.minionTimer = 0;
    this.bossWave = false;
  }

  begin(wave) {
    this.wave = wave;
    this.bossWave = isBossWave(wave);
    this.queue = this.bossWave ? ['titan'] : compositionFor(wave);
    this.spawnTimer = 0.4;
    this.minionTimer = 3.2;
  }

  /**
   * Feed spawns. `spawn(kind)` creates one enemy; `bossAlive` keeps the boss
   * waves raining minions until the titan falls.
   */
  update(dt, bossAlive, spawn) {
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.bossWave ? 0.5 : 0.62;
        spawn(this.queue.shift());
      }
      return;
    }
    if (this.bossWave && bossAlive) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        this.minionTimer = 3.4;
        spawn(Math.random() < 0.6 ? 'chaser' : 'dart');
      }
    }
  }

  /** True when everything this wave will ever spawn has spawned. */
  get exhausted() {
    return this.queue.length === 0;
  }
}

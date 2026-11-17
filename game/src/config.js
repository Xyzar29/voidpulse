// VOIDPULSE tuning: every balance number the game runs on lives here, so the
// feel of a run can be adjusted in one place without touching behaviour code.

export const CONFIG = {
  // Player hull and movement.
  player: {
    radius: 13,
    speed: 268,
    maxHearts: 4,
    heartCap: 7,
    invulnerableSeconds: 1.1,
    dashSeconds: 0.17,
    dashSpeedMultiplier: 3.4,
    dashCooldownSeconds: 2.1,
  },
  // Base weapon before upgrades.
  weapon: {
    shotsPerSecond: 5.2,
    bulletSpeed: 640,
    bulletRadius: 4,
    bulletLifeSeconds: 0.95,
    damage: 1,
  },
  // Score and combo.
  combo: {
    windowSeconds: 3.0,
    stepPerKill: 0.5,
    maxMultiplier: 8,
  },
  // Wave growth: hit points and speed creep up as waves climb.
  scaling: {
    hpGrowthPerWave: 0.16,
    hpGrowthStartsAtWave: 3,
    speedGrowthPerWave: 0.02,
    speedGrowthCap: 1.35,
  },
  // Orbit blade upgrade.
  blade: {
    orbitRadius: 48,
    spinRadiansPerSecond: 3.4,
    radius: 10,
    damagePerSecond: 3,
  },
  // Aegis shield upgrade recharge.
  aegisRechargeSeconds: 18,
};

// One coherent neon palette shared by every module that draws.
export const COLORS = {
  background: '#05060f',
  backgroundDeep: '#020208',
  grid: 'rgba(64, 90, 180, 0.16)',
  player: '#38f5ff',
  playerCore: '#e8feff',
  bullet: '#aefcff',
  heart: '#ff4d6d',
  text: '#d9f6ff',
  textDim: '#7d93b8',
  gold: '#ffd94d',
  chaser: '#ff3d8a',
  dart: '#ff9f2e',
  orbiter: '#b26bff',
  splitter: '#3dff8f',
  mini: '#8fffbe',
  weaver: '#ffe93d',
  titan: '#ff3860',
  enemyBullet: '#ff5d7a',
  blade: '#6bffd8',
  shield: '#6bb8ff',
};

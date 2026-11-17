// The bestiary: five geometric hunters plus the VOID TITAN boss. Each kind is
// a row in ENEMY_TYPES (stats and look) plus a behaviour in updateEnemy, so
// adding a kind never touches the wave director or the renderer.

import { COLORS, CONFIG } from './config.js';

// kind -> base stats. `sides` is the polygon the renderer draws; hp and speed
// are scaled by the wave in spawnEnemy.
export const ENEMY_TYPES = {
  chaser: { radius: 14, hp: 2, speed: 118, score: 50, sides: 3, color: COLORS.chaser, cost: 1 },
  dart: { radius: 10, hp: 1, speed: 208, score: 40, sides: 4, color: COLORS.dart, cost: 1 },
  orbiter: { radius: 15, hp: 3, speed: 132, score: 80, sides: 4, color: COLORS.orbiter, cost: 2 },
  splitter: { radius: 19, hp: 5, speed: 62, score: 100, sides: 5, color: COLORS.splitter, cost: 2 },
  mini: { radius: 8, hp: 1, speed: 168, score: 20, sides: 3, color: COLORS.mini, cost: 0 },
  weaver: { radius: 15, hp: 3, speed: 104, score: 120, sides: 6, color: COLORS.weaver, cost: 3 },
  titan: { radius: 52, hp: 70, speed: 44, score: 2000, sides: 10, color: COLORS.titan, cost: 0 },
};

let nextEnemyId = 1;

export function spawnEnemy(kind, x, y, wave) {
  const base = ENEMY_TYPES[kind];
  const hpScale = 1 + Math.max(0, wave - CONFIG.scaling.hpGrowthStartsAtWave) * CONFIG.scaling.hpGrowthPerWave;
  const speedScale = Math.min(CONFIG.scaling.speedGrowthCap, 1 + wave * CONFIG.scaling.speedGrowthPerWave);
  const hp = kind === 'titan' ? Math.round(base.hp + (wave / 5 - 1) * 45) : Math.max(1, Math.round(base.hp * hpScale));
  nextEnemyId += 1;
  return {
    id: nextEnemyId,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp,
    maxHp: hp,
    speed: base.speed * speedScale * (0.9 + Math.random() * 0.2),
    score: base.score,
    sides: base.sides,
    color: base.color,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.4,
    age: 0,
    spawnIn: 0.55, // telegraph time before the enemy can act or be hit
    flash: 0,
    seed: Math.random() * 1000,
    shootTimer: 1.4 + Math.random() * 1.6,
    attackTimer: 2.2,
    chargeState: 'stalk', // titan only: stalk -> aim -> charge -> recover
    chargeTimer: 0,
    bladeHitAt: -10,
  };
}

/** Edge-of-arena spawn point, just outside the visible field. */
export function edgeSpawnPoint(width, height) {
  const side = Math.floor(Math.random() * 4);
  const margin = 30;
  if (side === 0) return { x: Math.random() * width, y: -margin };
  if (side === 1) return { x: width + margin, y: Math.random() * height };
  if (side === 2) return { x: Math.random() * width, y: height + margin };
  return { x: -margin, y: Math.random() * height };
}

function steer(enemy, targetX, targetY, dt, turnRate = 6) {
  const desired = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  let diff = desired - enemy.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  enemy.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  enemy.vx = Math.cos(enemy.angle) * enemy.speed;
  enemy.vy = Math.sin(enemy.angle) * enemy.speed;
}

/**
 * Advance one enemy. `ctx` carries the player, the arena size, and callbacks
 * for enemy bullets and effects, so this module never imports the game state.
 */
export function updateEnemy(enemy, dt, ctx) {
  enemy.age += dt;
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  if (enemy.spawnIn > 0) {
    enemy.spawnIn -= dt;
    return;
  }
  const { player, width, height } = ctx;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  switch (enemy.kind) {
    case 'chaser':
    case 'mini':
      steer(enemy, player.x, player.y, dt);
      break;
    case 'dart': {
      // Darts commit to a line, overshoot, then swing back around.
      steer(enemy, player.x, player.y, dt, 2.2);
      const burst = 1 + 0.45 * Math.sin(enemy.age * 3.1 + enemy.seed);
      enemy.vx *= burst;
      enemy.vy *= burst;
      break;
    }
    case 'orbiter': {
      // Close to orbit range, then circle the player while drifting inward.
      const orbitRadius = 120;
      if (dist > orbitRadius + 14) {
        steer(enemy, player.x, player.y, dt);
      } else {
        const tangent = Math.atan2(dy, dx) + Math.PI / 2;
        const pull = (dist - orbitRadius) * 1.6;
        enemy.vx = Math.cos(tangent) * enemy.speed + (dx / dist) * pull;
        enemy.vy = Math.sin(tangent) * enemy.speed + (dy / dist) * pull;
        enemy.angle = tangent;
      }
      break;
    }
    case 'splitter':
      steer(enemy, player.x, player.y, dt, 3);
      break;
    case 'weaver': {
      // Sine-wave approach; spits a slow bolt at the player now and then.
      const perpendicular = Math.atan2(dy, dx) + Math.PI / 2;
      const sway = Math.sin(enemy.age * 4 + enemy.seed) * 60;
      steer(enemy, player.x + Math.cos(perpendicular) * sway, player.y + Math.sin(perpendicular) * sway, dt, 4);
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 520) {
        enemy.shootTimer = 2.4 + Math.random() * 1.4;
        ctx.fireEnemyBullet(enemy.x, enemy.y, Math.atan2(dy, dx), 215);
      }
      break;
    }
    case 'titan':
      updateTitan(enemy, dt, ctx, dist);
      break;
    default:
      break;
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Keep everyone inside the arena (spawn points start just outside it).
  enemy.x = Math.max(-40, Math.min(width + 40, enemy.x));
  enemy.y = Math.max(-40, Math.min(height + 40, enemy.y));
}

function updateTitan(enemy, dt, ctx, dist) {
  const { player } = ctx;
  enemy.chargeTimer -= dt;
  if (enemy.chargeState === 'stalk') {
    steer(enemy, player.x, player.y, dt, 2.4);
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = 2.6 + Math.random() * 0.9;
      const roll = Math.random();
      if (roll < 0.45) {
        // Radial burst.
        const count = 14;
        const offset = Math.random() * Math.PI;
        for (let i = 0; i < count; i += 1) {
          ctx.fireEnemyBullet(enemy.x, enemy.y, offset + (i / count) * Math.PI * 2, 168);
        }
        ctx.ring(enemy.x, enemy.y, enemy.color);
      } else if (roll < 0.8) {
        // Aimed fan.
        const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        for (let i = -2; i <= 2; i += 1) ctx.fireEnemyBullet(enemy.x, enemy.y, base + i * 0.16, 265);
      } else {
        enemy.chargeState = 'aim';
        enemy.chargeTimer = 0.55;
        enemy.vx = 0;
        enemy.vy = 0;
      }
    }
  } else if (enemy.chargeState === 'aim') {
    // Telegraph: track the player slowly, then commit.
    const desired = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.angle = desired;
    enemy.vx = 0;
    enemy.vy = 0;
    if (enemy.chargeTimer <= 0) {
      enemy.chargeState = 'charge';
      enemy.chargeTimer = 0.62;
      enemy.vx = Math.cos(desired) * 430;
      enemy.vy = Math.sin(desired) * 430;
      ctx.shake(0.25);
    }
  } else if (enemy.chargeState === 'charge') {
    if (enemy.chargeTimer <= 0) {
      enemy.chargeState = 'recover';
      enemy.chargeTimer = 0.9;
    }
  } else {
    // recover: drift slowly, vulnerable.
    enemy.vx *= 1 - 3 * dt;
    enemy.vy *= 1 - 3 * dt;
    if (enemy.chargeTimer <= 0) enemy.chargeState = 'stalk';
  }
  // The titan's shell rotation is drawn from its age in the renderer; its
  // heading here is set by steer/aim alone.
}

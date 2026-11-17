// VOIDPULSE — a neon twin-stick arena survival game.
// Move with WASD or the arrow keys, aim with the mouse (your ship fires on
// its own), dash with Shift, Space or right-click. Survive the wave, draft
// one of three upgrades, and face the VOID TITAN every fifth wave.
//
// This module owns the game state and the frame loop; the parts with one
// clear job each live in their own files (input, audio, particles, enemies,
// waves, upgrades, render, config).

import { COLORS, CONFIG } from './config.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { ParticleSystem } from './particles.js';
import { ENEMY_TYPES, edgeSpawnPoint, spawnEnemy, updateEnemy } from './enemies.js';
import { WaveDirector, isBossWave } from './waves.js';
import { draftThree, freshBuild } from './upgrades.js';
import { drawBackground, drawBlade, drawBossBar, drawEnemyShape, drawHUD, drawPlayer, makeStarfield, polygonPath } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new SoundBank();
const particles = new ParticleSystem();
const director = new WaveDirector();

let width = 0;
let height = 0;
let stars = [];

function resize() {
  const dpr = Math.min(1.75, window.devicePixelRatio || 1);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = makeStarfield(width, height);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- state

let state = 'title'; // title | playing | upgrade | paused | gameover
let time = 0;
let score = 0;
let best = 0;
let kills = 0;
let wave = 0;
let multiplier = 1;
let comboTimer = 0;
let shakeTrauma = 0;
let hitstop = 0;
let hurtFlash = 0;
let deathTimer = -1;
let banner = null; // { title, sub, color, timer, life }
let offers = [];
let cardRects = [];

try {
  best = Number(localStorage.getItem('voidpulse_best') || 0) || 0;
} catch {
  best = 0;
}

const player = {
  x: 0,
  y: 0,
  angle: 0,
  radius: CONFIG.player.radius,
  hearts: CONFIG.player.maxHearts,
  maxHearts: CONFIG.player.maxHearts,
  invulnerable: 0,
  dashTime: 0,
  dashCooldown: 0,
  dashDirX: 1,
  dashDirY: 0,
  moving: false,
  shieldReady: false,
  shieldTimer: 0,
  dead: false,
};

let build = freshBuild();
let bullets = [];
let enemyBullets = [];
let enemies = [];
let fireTimer = 0;
let bladeAngle = 0;

function addShake(amount) {
  shakeTrauma = Math.min(1, shakeTrauma + amount);
}

function showBanner(title, sub, color = COLORS.text) {
  banner = { title, sub, color, timer: 1.7, life: 1.7 };
}

// ---------------------------------------------------------------- run flow

function startRun() {
  score = 0;
  kills = 0;
  wave = 0;
  multiplier = 1;
  comboTimer = 0;
  bullets = [];
  enemyBullets = [];
  enemies = [];
  build = freshBuild();
  player.hearts = CONFIG.player.maxHearts;
  player.maxHearts = CONFIG.player.maxHearts;
  player.x = width / 2;
  player.y = height / 2;
  player.invulnerable = 0;
  player.dashTime = 0;
  player.dashCooldown = 0;
  player.shieldReady = false;
  player.shieldTimer = 0;
  player.dead = false;
  deathTimer = -1;
  state = 'playing';
  nextWave();
}

function nextWave() {
  wave += 1;
  director.begin(wave);
  if (isBossWave(wave)) {
    showBanner('⚠ VOID TITAN ⚠', 'Something enormous is coming through the void', COLORS.titan);
    sound.alarm();
  } else {
    showBanner(`WAVE ${wave}`, wave === 1 ? 'Hostiles inbound — good hunting' : `${director.queue.length} hostiles inbound`, COLORS.text);
  }
}

function openDraft() {
  offers = draftThree(build, player.hearts, player.maxHearts);
  if (offers.length === 0) {
    nextWave();
    return;
  }
  state = 'upgrade';
}

function applyOffer(offer) {
  offer.apply(build);
  if (build.pendingRepair) {
    build.pendingRepair = false;
    player.maxHearts = Math.min(CONFIG.player.heartCap, player.maxHearts + 1);
    player.hearts = Math.min(player.maxHearts, player.hearts + 2);
  }
  if (offer.id === 'aegis') {
    player.shieldReady = true;
    player.shieldTimer = 0;
  }
  sound.upgrade();
  particles.ring(player.x, player.y, COLORS.gold, 120, 0.5);
  offers = [];
  state = 'playing';
  nextWave();
}

function gameOver() {
  state = 'gameover';
  sound.gameOver();
  if (score > best) {
    best = Math.floor(score);
    try {
      localStorage.setItem('voidpulse_best', String(best));
    } catch {
      // Private modes refuse storage; the best score just lasts the session.
    }
  }
}

// ---------------------------------------------------------------- combat

function spawn(kind) {
  if (kind === 'titan') {
    enemies.push(spawnEnemy('titan', width / 2, -70, wave));
    return;
  }
  const point = edgeSpawnPoint(width, height);
  enemies.push(spawnEnemy(kind, point.x, point.y, wave));
}

function fireEnemyBullet(x, y, angle, speed) {
  enemyBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, life: 4 });
}

function playerShoot(dt) {
  fireTimer -= dt;
  const interval = 1 / (CONFIG.weapon.shotsPerSecond * (1 + build.fireRateBonus));
  if (fireTimer > 0) return;
  fireTimer = Math.max(fireTimer + interval, -interval);
  const count = 1 + build.extraProjectiles;
  const spreadStep = 0.1;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spreadStep;
    const angle = player.angle + offset;
    bullets.push({
      x: player.x + Math.cos(player.angle) * 18,
      y: player.y + Math.sin(player.angle) * 18,
      vx: Math.cos(angle) * CONFIG.weapon.bulletSpeed,
      vy: Math.sin(angle) * CONFIG.weapon.bulletSpeed,
      radius: CONFIG.weapon.bulletRadius,
      life: CONFIG.weapon.bulletLifeSeconds,
      damage: CONFIG.weapon.damage + build.damageBonus,
      pierceLeft: build.pierce,
      hitIds: new Set(),
    });
  }
  sound.shoot();
}

function killEnemy(enemy) {
  kills += 1;
  comboTimer = CONFIG.combo.windowSeconds + build.comboWindowBonus;
  multiplier = Math.min(CONFIG.combo.maxMultiplier, multiplier + CONFIG.combo.stepPerKill);
  const gained = Math.round(enemy.score * multiplier);
  score += gained;
  particles.floatingText(enemy.x, enemy.y - enemy.radius, `+${gained}`, enemy.kind === 'titan' ? COLORS.gold : COLORS.text, enemy.kind === 'titan' ? 26 : 14);
  particles.burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'titan' ? 90 : 16, enemy.kind === 'titan' ? 420 : 280);
  if (enemy.radius >= 19 || enemy.kind === 'titan') particles.ring(enemy.x, enemy.y, enemy.color, enemy.radius * 3.2);
  sound.explode(enemy.kind === 'titan' || enemy.kind === 'splitter');
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 3; i += 1) {
      const mini = spawnEnemy('mini', enemy.x + (Math.random() - 0.5) * 26, enemy.y + (Math.random() - 0.5) * 26, wave);
      mini.spawnIn = 0.22;
      enemies.push(mini);
    }
  }
  if (enemy.kind === 'titan') {
    addShake(0.7);
    hitstop = 0.14;
  } else if (enemy.kind === 'splitter') {
    addShake(0.18);
  }
}

function damagePlayer() {
  if (player.invulnerable > 0 || player.dashTime > 0 || player.dead) return;
  if (build.aegis && player.shieldReady) {
    player.shieldReady = false;
    player.shieldTimer = CONFIG.aegisRechargeSeconds;
    player.invulnerable = 0.7;
    particles.ring(player.x, player.y, COLORS.shield, 80, 0.4);
    particles.floatingText(player.x, player.y - 26, 'SHIELD DOWN', COLORS.shield, 14);
    sound.shieldPop();
    return;
  }
  player.hearts -= 1;
  player.invulnerable = CONFIG.player.invulnerableSeconds;
  hurtFlash = 0.55;
  addShake(0.45);
  particles.burst(player.x, player.y, COLORS.heart, 22, 300);
  sound.hurt();
  if (player.hearts <= 0) {
    player.dead = true;
    deathTimer = 1.0;
    particles.burst(player.x, player.y, COLORS.player, 70, 380, 0.9, 4);
    particles.ring(player.x, player.y, COLORS.player, 170, 0.6);
    sound.explode(true);
    addShake(0.8);
  }
}

// ---------------------------------------------------------------- update

function updatePlayer(dt) {
  const move = input.moveVector();
  player.moving = move.x !== 0 || move.y !== 0;
  player.angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);

  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (build.aegis && !player.shieldReady) {
    player.shieldTimer -= dt;
    if (player.shieldTimer <= 0) {
      player.shieldReady = true;
      particles.ring(player.x, player.y, COLORS.shield, 60, 0.35);
    }
  }

  const dashPressed = input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')
    || input.wasPressed('Space') || input.mouse.rightClicked;
  if (dashPressed && player.dashCooldown <= 0 && player.dashTime <= 0) {
    player.dashTime = CONFIG.player.dashSeconds;
    player.dashCooldown = CONFIG.player.dashCooldownSeconds * (1 - build.dashCooldownBonus);
    if (player.moving) {
      player.dashDirX = move.x;
      player.dashDirY = move.y;
    } else {
      player.dashDirX = Math.cos(player.angle);
      player.dashDirY = Math.sin(player.angle);
    }
    sound.dash();
  }

  let vx = move.x;
  let vy = move.y;
  if (player.dashTime > 0) {
    player.dashTime -= dt;
    vx = player.dashDirX * CONFIG.player.dashSpeedMultiplier;
    vy = player.dashDirY * CONFIG.player.dashSpeedMultiplier;
    particles.ghost(player.x, player.y, player.angle, COLORS.player);
  }
  const speed = CONFIG.player.speed * (1 + build.speedBonus);
  player.x += vx * speed * dt;
  player.y += vy * speed * dt;
  player.x = Math.max(player.radius, Math.min(width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(height - player.radius, player.y));

  if (!player.dead) playerShoot(dt);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < -30 || bullet.x > width + 30 || bullet.y < -30 || bullet.y > height + 30) {
      bullets.splice(i, 1);
    }
  }
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) {
      enemyBullets.splice(i, 1);
      continue;
    }
    const dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);
    if (dist < bullet.radius + player.radius - 2 && !player.dead) {
      enemyBullets.splice(i, 1);
      damagePlayer();
    }
  }
}

function resolveCombat(dt) {
  // Player bolts against enemies.
  for (let bi = bullets.length - 1; bi >= 0; bi -= 1) {
    const bullet = bullets[bi];
    let spent = false;
    for (const enemy of enemies) {
      if (enemy.spawnIn > 0 || enemy.hp <= 0 || bullet.hitIds.has(enemy.id)) continue;
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (dist < bullet.radius + enemy.radius) {
        bullet.hitIds.add(enemy.id);
        enemy.hp -= bullet.damage;
        enemy.flash = 1;
        particles.burst(bullet.x, bullet.y, enemy.color, 4, 160, 0.3, 2.4);
        sound.hit();
        if (bullet.pierceLeft > 0) {
          bullet.pierceLeft -= 1;
        } else {
          spent = true;
        }
        break;
      }
    }
    if (spent) bullets.splice(bi, 1);
  }

  // Orbit blades chew on whatever wanders into their circle.
  if (build.blades > 0) {
    bladeAngle += dt * CONFIG.blade.spinRadiansPerSecond;
    for (let i = 0; i < build.blades; i += 1) {
      const angle = bladeAngle + (i / build.blades) * Math.PI * 2;
      const bx = player.x + Math.cos(angle) * CONFIG.blade.orbitRadius;
      const by = player.y + Math.sin(angle) * CONFIG.blade.orbitRadius;
      for (const enemy of enemies) {
        if (enemy.spawnIn > 0 || enemy.hp <= 0) continue;
        if (Math.hypot(bx - enemy.x, by - enemy.y) < CONFIG.blade.radius + enemy.radius) {
          enemy.hp -= CONFIG.blade.damagePerSecond * dt;
          enemy.flash = Math.max(enemy.flash, 0.5);
        }
      }
    }
  }

  // Contact with the hull.
  if (!player.dead) {
    for (const enemy of enemies) {
      if (enemy.spawnIn > 0 || enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < enemy.radius + player.radius - 2) {
        damagePlayer();
        if (player.dashTime <= 0) {
          // Bounce the enemy off so one touch costs one heart, not all of them.
          const push = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          enemy.x += Math.cos(push) * 26;
          enemy.y += Math.sin(push) * 26;
        }
      }
    }
  }

  // Gentle separation so the swarm reads as individuals, not a blob.
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = (a.radius + b.radius) * 0.82;
      if (dist > 0.01 && dist < min) {
        const push = ((min - dist) / dist) * 0.5;
        a.x -= dx * push * 0.5;
        a.y -= dy * push * 0.5;
        b.x += dx * push * 0.5;
        b.y += dy * push * 0.5;
      }
    }
  }

  // Sweep the dead.
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].hp <= 0) {
      const [dead] = enemies.splice(i, 1);
      killEnemy(dead);
    }
  }
}

function updatePlaying(dt) {
  if (deathTimer > 0) {
    deathTimer -= dt;
    particles.update(dt);
    if (deathTimer <= 0) gameOver();
    return;
  }
  updatePlayer(dt);
  const bossAlive = enemies.some((enemy) => enemy.kind === 'titan');
  director.update(dt, bossAlive, spawn);
  const enemyCtx = {
    player,
    width,
    height,
    fireEnemyBullet,
    ring: (x, y, color) => particles.ring(x, y, color, 110, 0.4),
    shake: addShake,
  };
  for (const enemy of enemies) updateEnemy(enemy, dt, enemyCtx);
  updateBullets(dt);
  resolveCombat(dt);
  particles.update(dt);

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) multiplier = 1;
  }

  if (director.exhausted && enemies.length === 0 && !player.dead) {
    score += 250; // wave-clear bonus
    openDraft();
  }
}

// ---------------------------------------------------------------- drawing

function drawWorld() {
  drawBackground(ctx, stars, width, height, time, Math.min(0.4, (multiplier - 1) / 12));
  for (const bullet of enemyBullets) {
    ctx.save();
    ctx.shadowColor = COLORS.enemyBullet;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.enemyBullet;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const enemy of enemies) drawEnemyShape(ctx, enemy);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of bullets) {
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (build.blades > 0 && !player.dead) {
    for (let i = 0; i < build.blades; i += 1) {
      const angle = bladeAngle + (i / build.blades) * Math.PI * 2;
      drawBlade(ctx, player.x + Math.cos(angle) * CONFIG.blade.orbitRadius, player.y + Math.sin(angle) * CONFIG.blade.orbitRadius, time);
    }
  }
  if (!player.dead) drawPlayer(ctx, player, time);
  particles.draw(ctx);
}

function drawVignetteAndFlash() {
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.42, width / 2, height / 2, Math.max(width, height) * 0.78);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,10,0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const lowHull = state === 'playing' && player.hearts === 1 && !player.dead;
  const flash = Math.max(hurtFlash, lowHull ? 0.14 + 0.1 * Math.sin(time * 5) : 0);
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(255, 30, 60, ${Math.min(0.4, flash * 0.5)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawBanner() {
  if (!banner) return;
  const progress = banner.timer / banner.life;
  const alpha = progress > 0.75 ? (1 - progress) * 4 : Math.min(1, progress * 3);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.textAlign = 'center';
  ctx.fillStyle = banner.color;
  ctx.shadowColor = banner.color;
  ctx.shadowBlur = 22;
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText(banner.title, width / 2, height * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(banner.sub, width / 2, height * 0.3 + 30);
  ctx.restore();
}

function drawTitle() {
  ctx.save();
  ctx.textAlign = 'center';
  // Decorative orbiting polygons behind the logo.
  for (let i = 0; i < 5; i += 1) {
    const angle = time * 0.24 + (i / 5) * Math.PI * 2;
    const x = width / 2 + Math.cos(angle) * 310;
    const y = height * 0.34 + Math.sin(angle) * 105;
    ctx.globalAlpha = 0.38;
    const kinds = ['chaser', 'orbiter', 'splitter', 'weaver', 'dart'];
    const kind = ENEMY_TYPES[kinds[i]];
    ctx.fillStyle = kind.color;
    polygonPath(ctx, x, y, 20, kind.sides, time * 0.8 + i);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.player;
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 34;
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText('VOIDPULSE', width / 2, height * 0.36);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('The void is spawning. Hold the line.', width / 2, height * 0.36 + 40);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '500 16px system-ui, sans-serif';
  const lines = [
    'WASD / Arrow keys — move        Mouse — aim (your ship fires on its own)',
    'Shift / Space / Right-click — dash through danger',
    'Clear each wave, draft an upgrade, and drop the VOID TITAN every 5th wave.',
    'Chain kills to raise your combo multiplier. P pauses · M mutes.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.52 + i * 26));
  const pulse = 0.65 + 0.35 * Math.sin(time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.gold;
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', width / 2, height * 0.52 + 5 * 26);
  ctx.globalAlpha = 1;
  if (best > 0) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${best}`, width / 2, height * 0.52 + 6 * 26);
  }
  ctx.restore();
}

function drawUpgrade() {
  ctx.fillStyle = 'rgba(2, 3, 10, 0.72)';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = '900 36px system-ui, sans-serif';
  ctx.fillText(`WAVE ${wave} CLEARED`, width / 2, height * 0.2);
  ctx.fillStyle = COLORS.text;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText('Draft one upgrade — choose with a click or keys 1 · 2 · 3', width / 2, height * 0.2 + 32);

  const cardWidth = 248;
  const cardHeight = 272;
  const gap = 26;
  const totalWidth = cardWidth * offers.length + gap * (offers.length - 1);
  const startX = (width - totalWidth) / 2;
  const y = height * 0.32;
  cardRects = [];
  offers.forEach((offer, i) => {
    const x = startX + i * (cardWidth + gap);
    cardRects.push({ x, y, w: cardWidth, h: cardHeight, offer });
    const hovered = input.mouse.x >= x && input.mouse.x <= x + cardWidth && input.mouse.y >= y && input.mouse.y <= y + cardHeight;
    ctx.fillStyle = hovered ? 'rgba(24, 40, 74, 0.95)' : 'rgba(10, 16, 34, 0.95)';
    ctx.strokeStyle = hovered ? COLORS.gold : 'rgba(120, 160, 255, 0.4)';
    ctx.lineWidth = hovered ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.fillText(offer.icon, x + cardWidth / 2, y + 78);
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.fillText(offer.name, x + cardWidth / 2, y + 122);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '500 14.5px system-ui, sans-serif';
    wrapText(offer.blurb, x + cardWidth / 2, y + 152, cardWidth - 36, 20);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cardWidth / 2, y + cardHeight - 18);
  });
  ctx.restore();
}

function wrapText(text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, centerX, y);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(6, 2, 8, 0.66)';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.titan;
  ctx.shadowColor = COLORS.titan;
  ctx.shadowBlur = 28;
  ctx.font = '900 62px system-ui, sans-serif';
  ctx.fillText('SIGNAL LOST', width / 2, height * 0.34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(`SCORE ${Math.floor(score)}`, width / 2, height * 0.34 + 52);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText(`Reached wave ${wave} · ${kills} kills`, width / 2, height * 0.34 + 84);
  if (Math.floor(score) >= best && score > 0) {
    ctx.fillStyle = COLORS.gold;
    ctx.fillText('★ NEW BEST ★', width / 2, height * 0.34 + 114);
  } else {
    ctx.fillText(`Best ${best}`, width / 2, height * 0.34 + 114);
  }
  const pulse = 0.65 + 0.35 * Math.sin(time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.player;
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', width / 2, height * 0.34 + 160);
  ctx.restore();
}

function drawPaused() {
  ctx.fillStyle = 'rgba(2, 3, 10, 0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', width / 2, height * 0.46);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Press P to resume', width / 2, height * 0.46 + 34);
  ctx.restore();
}

function draw() {
  ctx.save();
  if (shakeTrauma > 0) {
    const shake = shakeTrauma * shakeTrauma * 15;
    ctx.translate((Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake);
  }
  drawWorld();
  ctx.restore();

  if (state === 'playing' || state === 'upgrade' || state === 'paused') {
    const titan = enemies.find((enemy) => enemy.kind === 'titan');
    drawHUD(ctx, {
      width,
      score,
      multiplier,
      comboFraction: Math.max(0, comboTimer / (CONFIG.combo.windowSeconds + build.comboWindowBonus)),
      wave,
      enemiesLeft: enemies.length + director.queue.length,
      hearts: Math.max(0, player.hearts),
      maxHearts: player.maxHearts,
      dashFraction: 1 - player.dashCooldown / (CONFIG.player.dashCooldownSeconds * (1 - build.dashCooldownBonus)),
      muted: sound.muted,
    });
    drawBossBar(ctx, titan, width);
    drawBanner();
  }
  drawVignetteAndFlash();
  if (state === 'title') drawTitle();
  if (state === 'upgrade') drawUpgrade();
  if (state === 'paused') drawPaused();
  if (state === 'gameover') drawGameOver();
}

// ---------------------------------------------------------------- loop

let lastTimestamp = 0;

function frame(timestamp) {
  requestAnimationFrame(frame);
  const now = timestamp / 1000;
  let dt = Math.min(0.033, now - (lastTimestamp || now));
  lastTimestamp = now;
  time += dt;

  // Global keys first: audio unlock and mute work on every screen.
  if (input.mouse.clicked || input.pressed.size > 0) sound.unlock();
  if (input.wasPressed('KeyM')) sound.toggleMute();

  if (banner) {
    banner.timer -= dt;
    if (banner.timer <= 0) banner = null;
  }
  shakeTrauma = Math.max(0, shakeTrauma - dt * 1.7);
  hurtFlash = Math.max(0, hurtFlash - dt * 1.4);

  if (hitstop > 0) {
    hitstop -= dt;
    dt = 0; // a beat of frozen time on big kills; rendering continues
  }

  if (state === 'title') {
    particles.update(dt);
    if (input.mouse.clicked || input.wasPressed('Enter')) startRun();
  } else if (state === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      state = 'paused';
    } else if (dt > 0) {
      updatePlaying(dt);
    }
  } else if (state === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state = 'playing';
  } else if (state === 'upgrade') {
    particles.update(dt);
    let picked = null;
    if (input.wasPressed('Digit1')) picked = offers[0];
    if (input.wasPressed('Digit2')) picked = offers[1];
    if (input.wasPressed('Digit3')) picked = offers[2];
    if (!picked && input.mouse.clicked) {
      const rect = cardRects.find((r) => input.mouse.x >= r.x && input.mouse.x <= r.x + r.w
        && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h);
      if (rect) picked = rect.offer;
    }
    if (picked) applyOffer(picked);
  } else if (state === 'gameover') {
    particles.update(dt);
    if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.mouse.clicked) startRun();
  }

  draw();
  input.endFrame();
}
requestAnimationFrame(frame);

// Read-only snapshot for automated play-tests and screenshot staging.
window.VOIDPULSE = {
  snapshot() {
    let nearestEnemy = null;
    let nearestDist = Infinity;
    for (const enemy of enemies) {
      if (enemy.spawnIn > 0) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = { x: Math.round(enemy.x), y: Math.round(enemy.y), kind: enemy.kind };
      }
    }
    return {
      state,
      wave,
      score: Math.floor(score),
      kills,
      hearts: player.hearts,
      enemies: enemies.length,
      queued: director.queue.length,
      offers: offers.map((offer) => offer.id),
      player: { x: Math.round(player.x), y: Math.round(player.y) },
      nearestEnemy,
    };
  },
};

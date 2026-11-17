// Everything that draws: the starfield, the ship, the enemy polygons, the
// HUD. Pure canvas 2D with additive glow passes; no images, no fonts to load.

import { COLORS } from './config.js';

export function makeStarfield(width, height) {
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      depth: 0.25 + Math.random() * 0.75,
      size: Math.random() < 0.85 ? 1 : 2,
    });
  }
  return stars;
}

export function drawBackground(ctx, stars, width, height, time, pulse) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.background);
  gradient.addColorStop(1, COLORS.backgroundDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Faint drifting grid.
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const gap = 64;
  const offset = (time * 6) % gap;
  ctx.beginPath();
  for (let x = -gap + offset; x < width + gap; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y < height + gap; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();

  // Parallax stars, twinkling slightly harder as the combo climbs.
  ctx.save();
  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(time * (1 + star.depth) + star.x);
    ctx.globalAlpha = (0.25 + 0.55 * star.depth) * twinkle + pulse * 0.15;
    ctx.fillStyle = '#bfe9ff';
    ctx.fillRect(star.x, (star.y + time * 4 * star.depth) % height, star.size, star.size);
  }
  ctx.restore();
}

export function polygonPath(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowShape(ctx, draw, color, blur = 14) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

export function drawPlayer(ctx, player, time) {
  const blink = player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  if (!blink) {
    // Engine flame.
    const flicker = 8 + Math.sin(time * 42) * 3 + (player.moving ? 5 : 0);
    ctx.fillStyle = 'rgba(255, 160, 60, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-10, 4.5);
    ctx.lineTo(-10 - flicker, 0);
    ctx.lineTo(-10, -4.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = blink ? 0.25 : 1;
  glowShape(ctx, () => {
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-11, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, -10);
    ctx.closePath();
    ctx.fill();
  }, COLORS.player);
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Aegis shield bubble.
  if (player.shieldReady) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 3);
    ctx.strokeStyle = COLORS.shield;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawEnemyShape(ctx, enemy) {
  const rotation = enemy.kind === 'titan'
    ? enemy.age * 0.5
    : enemy.angle + Math.PI / 2 + enemy.age * enemy.spin * 0.3;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.spawnIn > 0) {
    // Spawn telegraph: a hollow warning ring that fills as the enemy arrives.
    const progress = 1 - enemy.spawnIn / 0.55;
    ctx.globalAlpha = 0.25 + progress * 0.5;
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 6, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const flash = enemy.flash > 0.4;
  glowShape(ctx, () => {
    ctx.fillStyle = flash ? '#ffffff' : enemy.color;
    polygonPath(ctx, 0, 0, enemy.radius, enemy.sides, rotation);
    ctx.fill();
  }, enemy.color, enemy.kind === 'titan' ? 26 : 16);
  // Dark core with a bright pupil: reads as a hostile eye at any size.
  ctx.fillStyle = 'rgba(2, 4, 12, 0.85)';
  polygonPath(ctx, 0, 0, enemy.radius * 0.42, enemy.sides, rotation);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bosses and wounded elites show a small health arc.
  if ((enemy.kind === 'titan' || enemy.hp < enemy.maxHp) && enemy.maxHp >= 5) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 8, -Math.PI / 2, -Math.PI / 2 + (enemy.hp / enemy.maxHp) * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBlade(ctx, x, y, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 9);
  glowShape(ctx, () => {
    ctx.fillStyle = COLORS.blade;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-7, -5);
    ctx.closePath();
    ctx.fill();
  }, COLORS.blade, 12);
  ctx.restore();
}

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.3, y, x - size * 0.7, y - size * 1.1, x, y - size * 0.35);
  ctx.bezierCurveTo(x + size * 0.7, y - size * 1.1, x + size * 1.3, y, x, y + size * 0.9);
  ctx.closePath();
}

/** The in-play HUD: score and combo top-left, wave top-centre, hull top-right. */
export function drawHUD(ctx, view) {
  const { width } = view;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('SCORE', 20, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(String(Math.floor(view.score)).padStart(6, '0'), 20, 62);

  if (view.multiplier > 1) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillText(`×${view.multiplier.toFixed(1)} COMBO`, 20, 88);
    ctx.fillStyle = 'rgba(255, 217, 77, 0.25)';
    ctx.fillRect(20, 96, 120, 4);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(20, 96, 120 * view.comboFraction, 4);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('WAVE', width / 2, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText(String(view.wave), width / 2, 60);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`${view.enemiesLeft} HOSTILES LEFT`, width / 2, 82);

  // Hearts.
  ctx.textAlign = 'right';
  for (let i = 0; i < view.maxHearts; i += 1) {
    const x = width - 24 - i * 26;
    ctx.fillStyle = i < view.hearts ? COLORS.heart : 'rgba(255, 77, 109, 0.18)';
    heartPath(ctx, x, 34, 9);
    ctx.fill();
  }
  // Dash readiness pips under the hearts.
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('DASH', width - 20, 76);
  ctx.fillStyle = 'rgba(125, 147, 184, 0.3)';
  ctx.fillRect(width - 140, 82, 120, 5);
  ctx.fillStyle = view.dashFraction >= 1 ? COLORS.player : COLORS.textDim;
  ctx.fillRect(width - 140, 82, 120 * view.dashFraction, 5);

  if (view.muted) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('SOUND OFF (M)', width - 20, 108);
  }
  ctx.restore();
}

/** Boss health bar, pinned under the wave counter while a titan lives. */
export function drawBossBar(ctx, titan, width) {
  if (!titan) return;
  const barWidth = Math.min(520, width * 0.5);
  const x = (width - barWidth) / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.titan;
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillText('V O I D   T I T A N', width / 2, 108);
  ctx.fillStyle = 'rgba(255, 56, 96, 0.22)';
  ctx.fillRect(x, 116, barWidth, 9);
  ctx.fillStyle = COLORS.titan;
  ctx.fillRect(x, 116, barWidth * Math.max(0, titan.hp / titan.maxHp), 9);
  ctx.restore();
}

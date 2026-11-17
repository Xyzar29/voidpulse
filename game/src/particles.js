// Juice: sparks, shockwave rings, dash ghosts and floating score text. One
// pooled system owns them all so a busy screen never allocates per frame.

const MAX_PARTICLES = 900;

export class ParticleSystem {
  constructor() {
    this.sparks = [];
    this.rings = [];
    this.texts = [];
    this.ghosts = [];
  }

  burst(x, y, color, count = 14, speed = 260, life = 0.5, size = 3) {
    for (let i = 0; i < count; i += 1) {
      if (this.sparks.length >= MAX_PARTICLES) return;
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.25 + Math.random() * 0.95);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.5 + Math.random() * 0.8),
        age: 0,
        size: size * (0.6 + Math.random() * 0.9),
        color,
      });
    }
  }

  ring(x, y, color, maxRadius = 90, life = 0.35) {
    this.rings.push({ x, y, color, maxRadius, life, age: 0 });
  }

  floatingText(x, y, text, color = '#d9f6ff', size = 15) {
    this.texts.push({ x, y, text, color, size, age: 0, life: 0.9 });
  }

  ghost(x, y, angle, color) {
    this.ghosts.push({ x, y, angle, color, age: 0, life: 0.28 });
  }

  update(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const p = this.sparks[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.6 * dt;
      p.vy *= 1 - 2.6 * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.age += dt;
      t.y -= 44 * dt;
      if (t.age >= t.life) this.texts.splice(i, 1);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i -= 1) {
      const g = this.ghosts[i];
      g.age += dt;
      if (g.age >= g.life) this.ghosts.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.ghosts) {
      const fade = 1 - g.age / g.life;
      ctx.globalAlpha = fade * 0.35;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16);
      ctx.lineTo(g.x + Math.cos(g.angle + 2.5) * 11, g.y + Math.sin(g.angle + 2.5) * 11);
      ctx.lineTo(g.x + Math.cos(g.angle - 2.5) * 11, g.y + Math.sin(g.angle - 2.5) * 11);
      ctx.closePath();
      ctx.fill();
    }
    for (const p of this.sparks) {
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const r of this.rings) {
      const progress = r.age / r.life;
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxRadius * progress, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const fade = 1 - t.age / t.life;
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      ctx.font = `700 ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

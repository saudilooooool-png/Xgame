import { RESOURCE_DEFS } from './CityResources.js';

/**
 * Objective — rendered as a radar beacon with expanding sonar rings.
 *
 * Visual layers (back → front):
 *   1. Threat ring  — spinning dashed red ring when enemies are close
 *   2. Sonar rings  — two expanding rings at opposite phases; speed ∝ 1/health
 *   3. Static inner ring  — always visible reference circle
 *   4. Health arc   — arc segment showing HP %
 *   5. Core dot + icon
 *   6. Label + HP%  below
 */
export class Objective {
  constructor(x, y, resourceType = 'power') {
    this.x = x;
    this.y = y;
    this._pulse      = 0;
    this._threatRot  = 0;
    this._threatened = false;   // set by Game each frame
    this.setResource(resourceType);
  }

  setResource(resourceType) {
    const def = RESOURCE_DEFS[resourceType] ?? RESOURCE_DEFS.power;
    this.resourceType = resourceType;
    this.health    = def.hp;
    this.maxHealth = def.hp;
    this._color    = def.color;
    this._shadow   = def.shadowColor;
    this._icon     = def.icon;
    this._label    = def.label;
  }

  draw(ctx) {
    const healthPct = this.health / this.maxHealth;

    // Pulse speed: 3× faster at critical health → creates urgency
    const pulseSpeed = healthPct < 0.30 ? 0.11
                     : healthPct < 0.60 ? 0.065
                     : 0.038;
    this._pulse     = (this._pulse     + pulseSpeed)  % (Math.PI * 2);
    this._threatRot = (this._threatRot + 0.025)        % (Math.PI * 2);

    const healthColor = healthPct > 0.60 ? this._color
                      : healthPct > 0.30 ? '#ffaa00'
                      : '#ff3344';

    ctx.save();

    // ── Destroyed state ───────────────────────────────────────────────
    if (this.health <= 0) {
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth   = 1;
      ctx.shadowColor = '#ff3344';
      ctx.shadowBlur  = 6;
      // Ring
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      // X
      ctx.beginPath();
      ctx.moveTo(this.x - 12, this.y - 12); ctx.lineTo(this.x + 12, this.y + 12);
      ctx.moveTo(this.x + 12, this.y - 12); ctx.lineTo(this.x - 12, this.y + 12);
      ctx.stroke();
      // Label
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.5;
      ctx.font        = '9px monospace';
      ctx.fillStyle   = '#ff3344';
      ctx.textAlign   = 'center';
      ctx.fillText(`${this._icon} DESTROYED`, this.x, this.y + 36);
      ctx.restore();
      return;
    }

    // ── Threat ring (spinning dashed) ────────────────────────────────
    if (this._threatened) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this._threatRot);
      ctx.setLineDash([7, 9]);
      ctx.strokeStyle = `rgba(255,60,60,0.65)`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 16;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Sonar expanding rings (two, phase-offset by π) ────────────────
    for (const offset of [0, Math.PI]) {
      const phase = (this._pulse + offset) % (Math.PI * 2);
      const t     = (Math.sin(phase) + 1) / 2;  // 0 → 1
      const ringR = 22 + t * 36;
      const alpha = (1 - t) * 0.60;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = healthColor;
      ctx.lineWidth   = 1.2;
      ctx.shadowColor = healthColor;
      ctx.shadowBlur  = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Static inner reference ring ───────────────────────────────────
    ctx.strokeStyle = healthColor + '33';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 17, 0, Math.PI * 2);
    ctx.stroke();

    // ── Health arc (outer) ────────────────────────────────────────────
    ctx.strokeStyle = healthColor;
    ctx.lineWidth   = 3.5;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur  = 10;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(
      this.x, this.y, 44,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * healthPct
    );
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Track marks on health arc (every 25%)
    ctx.strokeStyle = healthColor + '55';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    for (let i = 1; i <= 3; i++) {
      const a = -Math.PI / 2 + Math.PI * 2 * (i * 0.25);
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40);
      ctx.lineTo(this.x + Math.cos(a) * 49, this.y + Math.sin(a) * 49);
      ctx.stroke();
    }

    // ── Core dot ─────────────────────────────────────────────────────
    ctx.fillStyle   = healthColor;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur  = 22;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // ── Icon ─────────────────────────────────────────────────────────
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 0.92;
    ctx.font        = '15px serif';
    ctx.textAlign   = 'center';
    ctx.fillText(this._icon, this.x, this.y - 4);
    ctx.globalAlpha = 1;

    // ── Label + HP% below beacon ──────────────────────────────────────
    ctx.font        = 'bold 9px monospace';
    ctx.fillStyle   = healthColor;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur  = 4;
    ctx.fillText(`${this._label}  ${Math.ceil(healthPct * 100)}%`, this.x, this.y + 60);
    ctx.shadowBlur  = 0;

    ctx.restore();
  }
}

import { RESOURCE_DEFS } from './CityResources.js';

export class Objective {
  constructor(x, y, resourceType = 'power') {
    this.x = x;
    this.y = y;
    this._pulse = 0;
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
    this._pulse = (this._pulse + 0.04) % (Math.PI * 2);
    const r = 28 + Math.sin(this._pulse) * 4;
    const healthPct = this.health / this.maxHealth;

    // Color shifts from resource color → orange → red as health drops
    const healthColor = healthPct > 0.6 ? this._color
      : healthPct > 0.3 ? '#ffaa00' : '#ff3344';

    const destroyed = this.health <= 0;

    ctx.save();

    if (destroyed) {
      // Destroyed state: dim X mark
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3344';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(this.x - 16, this.y - 16); ctx.lineTo(this.x + 16, this.y + 16);
      ctx.moveTo(this.x + 16, this.y - 16); ctx.lineTo(this.x - 16, this.y + 16);
      ctx.stroke();
      // destroyed label
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ff3344';
      ctx.textAlign = 'center';
      ctx.fillText('مدمر', this.x, this.y + 30);
      ctx.restore();
      return;
    }

    // Outer pulsing ring
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = healthColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Health arc (outside ring)
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 38, -Math.PI / 2,
      -Math.PI / 2 + (2 * Math.PI * healthPct));
    ctx.stroke();

    // Resource icon
    ctx.shadowBlur = 0;
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._icon, this.x, this.y - 46);

    // Resource label
    ctx.font = '10px monospace';
    ctx.fillStyle = this._color + 'bb';
    ctx.fillText(this._label, this.x, this.y - 58);

    // HP% text inside circle
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = healthColor;
    ctx.fillText(Math.ceil(healthPct * 100) + '%', this.x, this.y + 4);

    ctx.restore();
  }
}

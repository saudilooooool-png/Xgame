import { TARGET_TYPES } from './TargetTypes.js';

export class Objective {
  constructor(x, y, targetId = 'military') {
    this.x = x;
    this.y = y;
    const def = TARGET_TYPES[targetId] ?? TARGET_TYPES.military;
    this.health    = def.hp;
    this.maxHealth = def.hp;
    this.targetId  = targetId;
    this._color    = def.color;
    this._shadow   = def.shadowColor;
    this._icon     = def.icon;
    this._label    = def.label;
    this._pulse = 0;
  }

  setTarget(targetId) {
    const def = TARGET_TYPES[targetId] ?? TARGET_TYPES.military;
    this.targetId  = targetId;
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
    const healthColor = healthPct > 0.6 ? this._color
      : healthPct > 0.3 ? '#ffaa00' : '#ff3344';

    ctx.save();
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // inner dot
    ctx.fillStyle = healthColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // health arc
    ctx.strokeStyle = healthColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 38, -Math.PI / 2,
      -Math.PI / 2 + (2 * Math.PI * healthPct));
    ctx.stroke();

    // target type icon above
    ctx.shadowBlur = 0;
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._icon, this.x, this.y - 44);

    // label
    ctx.font = '10px monospace';
    ctx.fillStyle = this._color + 'aa';
    ctx.fillText(this._label, this.x, this.y - 50);

    ctx.restore();
  }
}

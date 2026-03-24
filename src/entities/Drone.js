export class Drone {
  constructor(x, y, type = 'friendly') {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = (Math.random() - 0.5) * 40;
    this.type = type;
    this.target = null; // {x, y} formation target
    this.trail = [];
    this.angle = 0;
    this.maxSpeed = type === 'friendly' ? 130 : 90;

    // Combat stats
    this.hp    = type === 'friendly' ? 100 : 80;
    this.maxHp = this.hp;
    this.fireRange  = type === 'friendly' ? 130 : 90;
    this.fireDamage = type === 'friendly' ? 40  : 25;
    this.fireRate   = type === 'friendly' ? 0.65 : 1.0; // seconds between shots
    this._fireTimer = Math.random() * this.fireRate;     // stagger initial shots
    this.dead = false;

    // ── Customization (friendly only) ───────────────────────────────────
    this._teamColor  = '#00d4ff';   // set by SwarmController.setIdentity()
    this._teamShadow = '#0088bb';
    this._radarShape = 'circle';    // radar blip shape
    this._group      = 'A';         // 'A' or 'B' swarm group

    // ── Veteran system ───────────────────────────────────────────────────
    this._kills      = 0;   // kills this drone has made
    this._wavesAlive = 0;   // waves survived
    this._vet        = 0;   // tier: 0=rookie, 1=veteran, 2=ace
    this._callsign   = null; // assigned on first promotion
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return this.dead;
  }

  /** Scan targets array, return nearest within fireRange or null */
  findTarget(targets) {
    let nearest = null, minD = Infinity;
    for (const t of targets) {
      const dx = t.x - this.x, dy = t.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < this.fireRange * this.fireRange && d2 < minD) {
        minD = d2; nearest = t;
      }
    }
    return nearest;
  }

  /** Advance fire timer. Returns true when a shot fires. */
  tickFire(dt) {
    this._fireTimer -= dt;
    if (this._fireTimer <= 0) {
      this._fireTimer = this.fireRate;
      return true;
    }
    return false;
  }

  update(dt, force) {
    this.vx += force.fx * this.maxSpeed * dt * 60;
    this.vy += force.fy * this.maxSpeed * dt * 60;

    // clamp speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > this.maxSpeed) {
      this.vx = (this.vx / spd) * this.maxSpeed;
      this.vy = (this.vy / spd) * this.maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (spd > 5) this.angle = Math.atan2(this.vy, this.vx);

    // trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
  }

  draw(ctx) {
    // trail
    if (this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = (i / this.trail.length) * 0.3;
        ctx.strokeStyle = this.type === 'friendly'
          ? `rgba(0,200,255,${alpha})`
          : `rgba(255,60,60,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === 'friendly') {
      ctx.fillStyle = '#00d4ff';
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = '#ff3c3c';
      ctx.shadowColor = '#ff3c3c';
      ctx.shadowBlur = 8;
    }

    // arrow shape
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // HP bar (only when damaged)
    if (this.hp < this.maxHp) {
      const bw = 18, bh = 2;
      const bx = this.x - bw / 2, by = this.y - 12;
      const hpColor = this.type === 'friendly' ? '#00d4ff' : '#ff3c3c';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = hpColor;
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
    }
  }
}


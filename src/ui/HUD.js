export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * @param {number} score
   * @param {number} wave
   * @param {CityResources} cityResources
   * @param {number} friendlyCount
   * @param {string} formation
   * @param {number} samples
   * @param {boolean|null} serverStatus
   * @param {number} kills
   * @param {number} losses
   * @param {number} hazardCount
   * @param {boolean} isBossWave
   */
  draw(score, wave, cityResources, friendlyCount, formation,
       samples, serverStatus, kills = 0, losses = 0,
       hazardCount = 0, isBossWave = false) {
    const ctx = this.canvas.ctx;
    ctx.save();

    // ── Top-left stats ────────────────────────────────────────────────────────
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.85)';
    const lines = [
      `WAVE      ${wave}`,
      `SCORE     ${score}`,
      `DRONES    ${friendlyCount}`,
      `FORMATION ${formation.toUpperCase()}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 18, 28 + i * 20));

    // kills / losses
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0,255,136,0.9)';
    ctx.fillText(`⬡ KILLS   ${kills}`, 18, 112);
    ctx.fillStyle = losses > kills ? 'rgba(255,80,80,0.9)' : 'rgba(255,160,80,0.8)';
    ctx.fillText(`✗ LOSSES  ${losses}`, 18, 128);

    // ── City resource bars (left panel, below stats) ──────────────────────────
    const resources = [
      { icon: '⚡', label: 'الكهرباء', value: cityResources.power,  color: '#ffcc00' },
      { icon: '💧', label: 'المياه',   value: cityResources.water,  color: '#00aaff' },
      { icon: '🌾', label: 'الغذاء',   value: cityResources.food,   color: '#88ff44' },
    ];

    const barX = 18, barW = 150, barH = 9;
    let barY = 152;

    ctx.font = '10px monospace';
    for (const res of resources) {
      const pct = Math.max(0, res.value) / 100;
      const barColor = pct > 0.6 ? res.color : pct > 0.3 ? '#ffaa00' : '#ff3344';

      // Label + icon
      ctx.fillStyle = 'rgba(200,220,255,0.7)';
      ctx.fillText(`${res.icon} ${res.label}`, barX, barY - 2);

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);

      // Fill
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, Math.round(barW * pct), barH);

      // Glow on critical
      if (pct <= 0.30) {
        ctx.shadowColor = '#ff3344';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#ff3344';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barW, barH);
      }

      // Percentage text
      ctx.fillStyle = barColor;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(res.value)}%`, barX + barW, barY - 2);
      ctx.textAlign = 'left';

      barY += 26;
    }

    // Cascade warnings
    let warnY = barY + 2;
    ctx.font = 'bold 10px monospace';
    if (cityResources.power <= 0) {
      ctx.fillStyle = 'rgba(255,200,0,0.9)';
      ctx.fillText('⚡→ المياه تنضب!', barX, warnY);
      warnY += 14;
    }
    if (cityResources.water <= 0) {
      ctx.fillStyle = 'rgba(0,170,255,0.9)';
      ctx.fillText('💧→ الغذاء يتلف!', barX, warnY);
      warnY += 14;
    }
    if (cityResources.food <= 0) {
      ctx.fillStyle = 'rgba(136,255,68,0.9)';
      ctx.fillText('🌾→ الطائرات تضعف!', barX, warnY);
      warnY += 14;
    }

    // ── Hazard zones indicator ─────────────────────────────────────────────────
    if (hazardCount > 0) {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,100,0,0.85)';
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 6;
      ctx.fillText(`⚠ HAZARDS ×${hazardCount}`, barX, warnY);
      warnY += 14;
      ctx.shadowBlur = 0;
    }

    // ── Boss wave badge ────────────────────────────────────────────────────────
    if (isBossWave) {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,210,0,0.9)';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 8;
      ctx.fillText('★ BOSS WAVE', barX, warnY);
      ctx.shadowBlur = 0;
    }

    // ── Top-right: data samples & server ─────────────────────────────────────
    const syncDot   = serverStatus === true ? '🟢' : serverStatus === false ? '🔴' : '🟡';
    const syncLabel = serverStatus === true ? 'syncing' : serverStatus === false ? 'offline' : 'connecting';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,255,136,0.7)';
    ctx.fillText(`⬡ ${samples} samples`, this.canvas.width - 16, 28);
    ctx.fillStyle = serverStatus === true ? 'rgba(0,255,136,0.6)' : 'rgba(255,120,50,0.7)';
    ctx.fillText(`${syncDot} server ${syncLabel}`, this.canvas.width - 16, 46);
    ctx.textAlign = 'left';

    ctx.restore();
  }
}

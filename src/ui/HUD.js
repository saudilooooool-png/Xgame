export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
  }

  draw(score, wave, objectiveHealth, friendlyCount, formation, samples, serverStatus, kills = 0, losses = 0, hazardCount = 0, isBossWave = false) {
    const ctx = this.canvas.ctx;
    ctx.save();
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.85)';

    const lines = [
      `WAVE      ${wave}`,
      `SCORE     ${score}`,
      `DRONES    ${friendlyCount}`,
      `FORMATION ${formation.toUpperCase()}`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 18, 28 + i * 20);
    });

    // kills / losses
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0,255,136,0.9)';
    ctx.fillText(`⬡ KILLS   ${kills}`, 18, 112);
    ctx.fillStyle = losses > kills ? 'rgba(255,80,80,0.9)' : 'rgba(255,160,80,0.8)';
    ctx.fillText(`✗ LOSSES  ${losses}`, 18, 128);

    // objective health bar
    const barX = 18, barY = 144, barW = 160, barH = 8;
    const healthColor = objectiveHealth > 60 ? '#00ff88'
      : objectiveHealth > 30 ? '#ffaa00' : '#ff3344';

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barW * objectiveHealth / 100, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = 'rgba(0,212,255,0.6)';
    ctx.font = '11px monospace';
    ctx.fillText('OBJECTIVE', barX, barY - 6);

    // data samples + server status (top right)
    const syncDot = serverStatus === true ? '🟢' : serverStatus === false ? '🔴' : '🟡';
    const syncLabel = serverStatus === true ? 'syncing' : serverStatus === false ? 'offline' : 'connecting';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,255,136,0.7)';
    ctx.fillText(`⬡ ${samples} samples`, this.canvas.width - 16, 28);
    ctx.fillStyle = serverStatus === true ? 'rgba(0,255,136,0.6)' : 'rgba(255,120,50,0.7)';
    ctx.fillText(`${syncDot} server ${syncLabel}`, this.canvas.width - 16, 46);
    ctx.textAlign = 'left';

    // ── Hazard zones indicator ─────────────────────────────────────
    if (hazardCount > 0) {
      const hx = 18, hy = 170;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,100,0,0.85)';
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 6;
      ctx.fillText(`⚠ HAZARDS ×${hazardCount}`, hx, hy);
      ctx.shadowBlur = 0;
    }

    // ── Boss wave badge (top-left, below standard stats) ──────────
    if (isBossWave) {
      const bx = 18, by = hazardCount > 0 ? 188 : 170;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,210,0,0.9)';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 8;
      ctx.fillText('★ BOSS WAVE', bx, by);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

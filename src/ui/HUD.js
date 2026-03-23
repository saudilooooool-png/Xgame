export class HUD {
  constructor(canvas) {
    this.canvas = canvas;
  }

  draw(score, wave, objectiveHealth, friendlyCount, formation, samples) {
    const ctx = this.canvas.ctx;
    ctx.save();
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.85)';

    const lines = [
      `WAVE     ${wave}`,
      `SCORE    ${score}`,
      `DRONES   ${friendlyCount}`,
      `FORMATION ${formation.toUpperCase()}`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 18, 28 + i * 20);
    });

    // objective health bar
    const barX = 18, barY = 120, barW = 160, barH = 8;
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
    ctx.fillText('OBJECTIVE', barX, barY - 4);

    // data samples counter (top right)
    ctx.fillStyle = 'rgba(0,255,136,0.7)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`⬡ ${samples} samples collected`, this.canvas.width - 16, 28);
    ctx.textAlign = 'left';

    ctx.restore();
  }
}

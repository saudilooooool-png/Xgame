import { Canvas } from './Canvas.js';
import { ParticleSystem } from './Particles.js';
import { ScreenShake } from './ScreenShake.js';
import { Audio } from './Audio.js';
import { SwarmController } from '../entities/SwarmController.js';
import { EnemySwarm } from '../entities/EnemySwarm.js';
import { Objective } from '../entities/Objective.js';
import { CityResources } from '../entities/CityResources.js';
import { generateHazards } from '../entities/HazardZone.js';
import { DataCollector } from '../data/DataCollector.js';
import { Commander } from '../ui/Commander.js';
import { HUD } from '../ui/HUD.js';
import { WaveAnnouncer } from '../ui/WaveAnnouncer.js';
import { GameOverScreen } from '../ui/GameOverScreen.js';
import { Agent } from '../ai/Agent.js';
import { UpgradeScreen } from '../ui/UpgradeScreen.js';
import { StartScreen } from '../ui/StartScreen.js';
import { MissionSetupScreen } from '../ui/MissionSetupScreen.js';
import { TARGET_TYPES } from '../entities/TargetTypes.js';
import { getWaveStory } from '../data/StoryLines.js';
import { RadarSweep } from './RadarSweep.js';
import { DroneLab } from '../ui/DroneLab.js';
import { nextVetCallsign } from '../data/PlayerIdentity.js';
import { generateSideMission } from '../events/SideMission.js';
import { EmpTrap } from '../entities/EmpTrap.js';
import { GatlingTower } from '../entities/GatlingTower.js';

export class Game {
  constructor() {
    this.canvas = new Canvas('game-container');
    this.ctx = this.canvas.ctx;

    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.audio = new Audio();

    // ── 3 fixed city objectives ───────────────────────────────────────────────
    this.objectives    = this._buildObjectives();
    this.cityResources = new CityResources();

    this.hazards = [];

    this.playerSwarm   = new SwarmController(20, this.canvas, 'friendly');
    this.enemySwarm    = new EnemySwarm(0, this.canvas, this.objectives);
    this.dataCollector = new DataCollector();
    this.hud           = new HUD(this.canvas);
    this.waveAnnouncer = new WaveAnnouncer();
    this.commander     = new Commander(this.canvas, this.playerSwarm, this.dataCollector, this);

    this.gameOverScreen = new GameOverScreen(() => this._restart());
    this.gameOverScreen.onExport(() => this.dataCollector.download());

    this.upgradeScreen = new UpgradeScreen();

    this.radarSweep = new RadarSweep();

    this.agent  = new Agent(this.playerSwarm, this);
    this.aiMode = false;
    this._awaitingUpgrade = false;

    this.score   = 0;
    this.wave    = 0;
    this.running = true;
    this._lastTime  = 0;
    this._waveDelay = 0;

    // ── Streak & stats ────────────────────────────────────────────────────────
    this._streak          = 0;
    this._maxStreak       = 0;
    this._perfectWave     = true;
    this._bossWavesCleared = 0;

    // ── Player identity (set by DroneLab) ─────────────────────────────────────
    this._playerIdentity = null;

    // ── Deployment phase (before enemies spawn each wave) ─────────────────────
    this._deploymentPhase = 0;

    // ── Side missions ─────────────────────────────────────────────────────────
    this._sideMission           = null;   // active SideMission instance
    this._sideMissionSpawnTimer = 0;      // countdown to spawn attempt
    this._sideMissionTriedThisWave = true; // start true so wave 1 never spawns
    this._nextWaveEnemyMult     = 1.0;    // sabotage reward: reduce next wave count

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab')                         { e.preventDefault(); this._toggleGroup(); }
      if (e.key === 's' || e.key === 'S')         this._splitOrMergeGroups();
      if (e.code === 'Space' || e.key === 'Enter') this._skipDeployment();
      if (e.key === 'e' || e.key === 'E')         this._toggleEmpMode();
      if (e.key === 'g' || e.key === 'G')         this._toggleTowerMode();
    });

    // ── Tutorial hints ────────────────────────────────────────────────────────
    this._clickHintTimer = 4;

    // ── Mission state ─────────────────────────────────────────────────────────
    this._scoreMulti    = 1;
    this._missionApproach = null;
    this._defenseProfile  = null;

    // ── Alert banner ──────────────────────────────────────────────────────────
    this._alertText  = '';
    this._alertTimer = 0;

    // ── Combat tracking ───────────────────────────────────────────────────────
    this.waveKills   = 0;
    this.waveLosses  = 0;
    this.totalKills  = 0;
    this.totalLosses = 0;

    // ── Laser effects ─────────────────────────────────────────────────────────
    this._lasers = [];

    // ── Phase-1 visual FX ─────────────────────────────────────────────────────
    this._scorePopups = [];   // { x, y, text, ttl, maxTtl }
    this._killFeed    = [];   // { text, ttl, maxTtl }
    this._hitFlash    = 0;    // 0-1, decays per frame
    this._vignetteHP  = 1;    // 0-1 smoothed min-objective ratio

    // ── Phase-2 trap system ───────────────────────────────────────────────────
    this._empTraps   = [];    // active EmpTrap instances
    this._empCharges = 3;     // traps available this wave
    this._empMode    = false; // placement mode active

    // ── Phase-3 tower system ──────────────────────────────────────────────────
    this._towers     = [];    // active GatlingTower instances (persist between waves)
    this._towerMode  = false; // placement mode active
    this._mouseX     = 0;     // cursor position for ghost preview
    this._mouseY     = 0;
    this.canvas.el.addEventListener('mousemove', (e) => {
      const r = this.canvas.el.getBoundingClientRect();
      this._mouseX = e.clientX - r.left;
      this._mouseY = e.clientY - r.top;
    });

    // Canvas click — capture phase so we intercept before Commander
    this.canvas.el.addEventListener('click', (e) => this._onCanvasClick(e), true);

    new StartScreen().show().then(() => this._runMissionSetup());
  }

  _buildObjectives() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return [
      new Objective(W * 0.50, H * 0.16, 'power'),  // ⚡ top-center
      new Objective(W * 0.18, H * 0.68, 'water'),  // 💧 left
      new Objective(W * 0.82, H * 0.68, 'food'),   // 🌾 right
    ];
  }

  start() {
    requestAnimationFrame((t) => this._loop(t));
  }

  _restart() {
    this.objectives = this._buildObjectives();
    this.enemySwarm.objectives = this.objectives;
    this.cityResources.reset();
    this.hazards      = [];
    this.score        = 0;
    this.wave         = 0;
    this._streak           = 0;
    this._maxStreak        = 0;
    this._perfectWave      = true;
    this._bossWavesCleared = 0;
    this.waveKills   = 0;
    this.waveLosses  = 0;
    this.totalKills  = 0;
    this.totalLosses = 0;
    this._lasers     = [];
    this._scorePopups = [];
    this._killFeed    = [];
    this._hitFlash    = 0;
    this._vignetteHP  = 1;
    this._empTraps   = [];
    this._empCharges = 3;
    this._empMode    = false;
    this._towers     = [];
    this._towerMode  = false;
    this._alertText  = '';
    this._alertTimer = 0;
    this._clickHintTimer = 4;
    this._sideMission               = null;
    this._sideMissionTriedThisWave  = true;
    this._nextWaveEnemyMult         = 1.0;
    this.particles.particles.length = 0;
    this.playerSwarm.drones.length  = 0;
    this.enemySwarm.drones.length   = 0;
    this.running = true;
    this._runMissionSetup();
  }

  _runMissionSetup() {
    new DroneLab(this._playerIdentity).show().then((identity) => {
      this._playerIdentity = identity;
      this.playerSwarm.setIdentity(identity);

      new MissionSetupScreen().show().then((setup) => {
        this._scoreMulti  = TARGET_TYPES[setup.targetId]?.scoreMulti ?? 1;
        this._scoreMulti *= (1 + (setup.defenseProfile.surpriseBonus ?? 0));

        this.playerSwarm.drones.length = 0;
        for (const [role, count] of Object.entries(setup.loadout)) {
          if (count > 0) this.playerSwarm.reinforce(count, role);
        }
        if (this.playerSwarm.drones.length === 0) {
          this.playerSwarm.reinforce(10, 'standard');
        }

        this.enemySwarm.defenseProfile = setup.defenseProfile;
        this._missionApproach = setup.approach;
        this._defenseProfile  = setup.defenseProfile;
        this._clickHintTimer  = 4;
        this._nextWave();
      });
    });
  }

  // ── Group A/B controls ────────────────────────────────────────────────────

  _toggleGroup() {
    if (!this.running) return;
    this.playerSwarm.activeGroup = this.playerSwarm.activeGroup === 'A' ? 'B' : 'A';
    this._showAlert(`المجموعة ${this.playerSwarm.activeGroup} نشطة`);
  }

  // ── EMP trap placement ────────────────────────────────────────────────────

  _toggleEmpMode() {
    if (!this.running || this._awaitingUpgrade) return;
    if (this._empCharges <= 0) {
      this._showAlert('لا توجد فخاخ EMP متبقية');
      return;
    }
    this._empMode = !this._empMode;
    this.canvas.el.style.cursor = this._empMode ? 'crosshair' : '';
  }

  _onCanvasClick(e) {
    if (!this.running) return;
    const rect = this.canvas.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this._towerMode) {
      e.stopPropagation();
      this._placeTower(x, y);
      return;
    }
    if (this._empMode) {
      if (this._empCharges <= 0) { this._empMode = false; return; }
      e.stopPropagation();
      this._empTraps.push(new EmpTrap(x, y));
      this._empCharges--;
      this._empMode = false;
      this.canvas.el.style.cursor = '';
      this._showAlert(`EMP وُضع ✓  (${this._empCharges} متبقية)`);
    }
  }

  // ── Tower placement ───────────────────────────────────────────────────────

  _toggleTowerMode() {
    if (!this.running || this._awaitingUpgrade) return;
    const MAX_TOWERS = 3;
    if (this._towers.length >= MAX_TOWERS) {
      this._showAlert(`الحد الأقصى ${MAX_TOWERS} أبراج على الخريطة`);
      return;
    }
    if (this.score < GatlingTower.COST) {
      this._showAlert(`مطلوب ${GatlingTower.COST} نقطة لبناء برج`);
      return;
    }
    this._towerMode = !this._towerMode;
    if (this._empMode) { this._empMode = false; }  // cancel EMP mode if active
    this.canvas.el.style.cursor = this._towerMode ? 'crosshair' : '';
  }

  _placeTower(x, y) {
    const MAX_TOWERS = 3;
    if (this._towers.length >= MAX_TOWERS || this.score < GatlingTower.COST) {
      this._towerMode = false;
      this.canvas.el.style.cursor = '';
      return;
    }
    this.score -= GatlingTower.COST;
    this._towers.push(new GatlingTower(x, y));
    this._towerMode = false;
    this.canvas.el.style.cursor = '';
    this._showAlert(`برج Gatling بُني! (${3 - this._towers.length} مواضع متبقية)`);
  }

  _splitOrMergeGroups() {
    if (!this.running) return;
    const allInA = this.playerSwarm.drones.every(d => d._group === 'A');
    if (allInA) {
      this.playerSwarm.splitGroups();
      this._showAlert('السرب مقسّم: A + B  (Tab للتبديل)');
    } else {
      this.playerSwarm.mergeGroups();
      this._showAlert('السرب مدمج في المجموعة A');
    }
  }

  _nextWave() {
    this.wave++;
    this._waveDelay   = 1.5;
    this.waveKills    = 0;
    this.waveLosses   = 0;
    this._perfectWave = true;
    // Replenish EMP charges each wave (base 3, +1 every 5 waves)
    this._empTraps   = [];
    this._empMode    = false;
    this._empCharges = 3 + Math.floor(this.wave / 5);

    this.hazards = generateHazards(
      this.wave, this.canvas.width, this.canvas.height,
      this.objectives
    );

    const isBossWave = this.wave % 5 === 0;
    const story = getWaveStory(this.wave, isBossWave, this.cityResources, this._streak);
    this.waveAnnouncer.announce(this.wave, isBossWave, story, this._streak);
    this.audio.waveStart();

    // Apply sabotage reward from previous wave
    if (this._nextWaveEnemyMult < 1.0) {
      const baseCount = Math.min(10 + this.wave * 3, 40);
      const reduced   = Math.round(baseCount * this._nextWaveEnemyMult);
      this._pendingEnemyOverride = reduced;
      this._nextWaveEnemyMult   = 1.0;
    }

    // Clear last mission and reset spawn timer
    this._sideMission                = null;
    this._sideMissionTriedThisWave   = this.wave < 2;  // wave 1 = skip
    this._sideMissionSpawnTimer      = 8 + Math.random() * 6;  // spawn 8–14s into wave

    // Reinforce player before enemies spawn
    if (this.wave > 1 && this.playerSwarm.drones.length < 20) {
      this.playerSwarm.reinforce(Math.min(5, 20 - this.playerSwarm.drones.length), 'standard');
    }

    // ── Deployment phase: give player 12s to position before enemies spawn ──
    if (this.wave > 1) {
      this._deploymentPhase = 12;
      this._showAlert('📍 وزّع قواتك — Space للبدء');
    } else {
      // Wave 1: no deployment pause, just start
      this.enemySwarm.spawnWave(this.wave, this._pendingEnemyOverride);
      this._pendingEnemyOverride = undefined;
    }
  }

  _skipDeployment() {
    if (this._deploymentPhase <= 0) return;
    this._deploymentPhase = 0;
    this.enemySwarm.spawnWave(this.wave, this._pendingEnemyOverride);
    this._pendingEnemyOverride = undefined;
    this._showAlert('⚔ الهجوم!');
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._update(dt);
    this._draw();
    requestAnimationFrame((t) => this._loop(t));
  }

  toggleAI() {
    this.aiMode = !this.aiMode;
    if (this.aiMode && !this.agent.active) this.agent.load();
  }

  _update(dt) {
    if (this._waveDelay > 0)      this._waveDelay      -= dt;
    if (this._clickHintTimer > 0) this._clickHintTimer  -= dt;
    if (this._alertTimer > 0)     this._alertTimer      -= dt;
    if (this.aiMode) this.agent.update(dt);

    // ── Deployment phase: let player position forces; enemies not yet spawned ──
    if (this._deploymentPhase > 0) {
      this._deploymentPhase -= dt;
      this.playerSwarm.update(dt, []); // move drones with no enemies
      this.particles.update(dt);
      this.waveAnnouncer.update(dt);
      const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
      this.radarSweep.update(dt, cx, cy, this.playerSwarm.drones);
      if (this._deploymentPhase <= 0) {
        this._deploymentPhase = 0;
        this.enemySwarm.spawnWave(this.wave, this._pendingEnemyOverride);
        this._pendingEnemyOverride = undefined;
        this._showAlert('⚔ الهجوم!');
      }
      return;  // skip combat, enemy AI, hazards during deployment
    }

    this._lasers = this._lasers.filter(l => (l.ttl -= dt) > 0);

    this.cityResources.syncFromObjectives(this.objectives);
    this.cityResources.update(dt, this.playerSwarm, this.objectives);

    // Food speed penalty
    const speedMod = this.cityResources.speedModifier();
    if (speedMod < 1.0) {
      for (const d of this.playerSwarm.drones) {
        if (!d._baseMaxSpeed) d._baseMaxSpeed = d.maxSpeed;
        d.maxSpeed = Math.round(d._baseMaxSpeed * speedMod);
      }
    }

    this.playerSwarm.update(dt, this.enemySwarm.drones);
    this.enemySwarm.update(dt, this.playerSwarm.drones);

    // ── Stun freeze: stop stunned enemies after physics update ────────────────
    for (const e of this.enemySwarm.drones) {
      if ((e._stunTimer ?? 0) > 0) {
        e._stunTimer -= dt;
        e.vx = 0;
        e.vy = 0;
        if (e._stunTimer < 0) e._stunTimer = 0;
      }
    }

    // ── EMP traps ─────────────────────────────────────────────────────────────
    for (const t of this._empTraps) t.update(dt, this.enemySwarm.drones);
    this._empTraps = this._empTraps.filter(t => !t.dead);

    // ── Gatling towers ────────────────────────────────────────────────────────
    for (const tower of this._towers) {
      const shot = tower.update(dt, this.enemySwarm.drones);
      if (shot) {
        this._lasers.push({ x1: shot.x1, y1: shot.y1, x2: shot.x2, y2: shot.y2,
                            color: '#ffcc00', ttl: 0.06 });
        if (shot.killed) {
          const role = shot.target.role;
          const color = role === 'commander' ? '#ffaa00'
                      : role === 'kamikaze'  ? '#ff4400'
                      : '#ff3c3c';
          this.particles.explode(shot.target.x, shot.target.y, color,
                                 role === 'commander' ? 18 : 10);
          this.audio.enemyDestroyed();
          const scoreBonus = role === 'commander' ? 50 : role === 'kamikaze' ? 20 : 10;
          const gained = Math.round(scoreBonus * this._scoreMulti);
          this.score += gained;
          this.waveKills++;
          this.totalKills++;
          this._scorePopups.push({ x: shot.target.x, y: shot.target.y,
                                   text: `+${gained}`, ttl: 1.2, maxTtl: 1.2 });
          const feedLabel = role === 'commander' ? '★ COMMANDER' : role.toUpperCase();
          this._killFeed.unshift({ text: `GATLING ${feedLabel}`, ttl: 3.5, maxTtl: 3.5 });
          if (this._killFeed.length > 5) this._killFeed.length = 5;
        }
      }
    }
    // Remove destroyed towers + explosion particles
    const prevCount = this._towers.length;
    this._towers = this._towers.filter(t => {
      if (t.dead) {
        this.particles.explode(t.x, t.y, '#ffcc00', 14);
        this._showAlert('⚠ برج Gatling دُمِّر!');
        return false;
      }
      return true;
    });

    this.particles.update(dt);
    this.shake.update(dt);
    this.waveAnnouncer.update(dt);

    // ── Radar sweep ───────────────────────────────────────────────────
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const allEntities = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    this.radarSweep.update(dt, cx, cy, allEntities);

    // ── Objective threat state (drives spinning danger ring) ──────────
    const THREAT_R2 = 200 * 200;
    for (const obj of this.objectives) {
      obj._threatened = this.enemySwarm.drones.some(e => {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        return dx * dx + dy * dy < THREAT_R2;
      });
    }

    this._applyHazards(dt);
    this._applyAutoRecovery(dt);
    this._updateSideMission(dt);
    this._checkCombat(dt);
    this._checkObjectiveHits();
    this._checkWaveComplete();
    this._checkGameOver();
    this._updateFX(dt);
  }

  // ── Side missions ─────────────────────────────────────────────────────────

  _updateSideMission(dt) {
    // Try to spawn a mission once per wave
    if (!this._sideMissionTriedThisWave && this._deploymentPhase <= 0) {
      this._sideMissionSpawnTimer -= dt;
      if (this._sideMissionSpawnTimer <= 0) {
        this._sideMissionTriedThisWave = true;
        if (Math.random() < 0.42) {
          const result = generateSideMission(this.wave, this.canvas, this.objectives);
          this._sideMission = result.mission;
          this._showAlert(result.label);
        }
      }
    }

    const m = this._sideMission;
    if (!m || m.complete || m.failed) return;

    // Update active mission
    if (m.type === 'escort') {
      m.update(dt, this.playerSwarm.drones, this.enemySwarm.drones);
    } else {
      m.update(dt, this.playerSwarm.drones);
    }

    // React to outcome
    if (m.complete) {
      const r = m.reward;
      this.score += Math.round(r.score * this._scoreMulti);
      if (r.drones > 0) {
        this.playerSwarm.reinforce(r.drones);
        this._showAlert(`✅ مهمة مكتملة! +${r.drones} طائرات`);
      }
      if (r.nextWaveEnemyMult < 1.0) {
        this._nextWaveEnemyMult = r.nextWaveEnemyMult;
        this._showAlert(`💥 تخريب ناجح! الموجة القادمة −42% أعداء`);
      }
      this.particles.explode(
        this.canvas.width / 2, this.canvas.height / 2, '#00ff88', 20,
      );
    } else if (m.failed) {
      this._showAlert('❌ فشلت المهمة');
    }
  }

  // ── Veteran system ────────────────────────────────────────────────────────

  _checkVetPromotions() {
    for (const d of this.playerSwarm.drones) {
      if (d.dead || d._vet >= 2) continue;
      const prev = d._vet;

      if (d._vet < 1 && d._kills >= 3 && d._wavesAlive >= 2) {
        d._vet = 1;
        d._callsign ??= nextVetCallsign();
        d.fireDamage = Math.round(d.fireDamage * 1.15);
        d.maxSpeed   = Math.round(d.maxSpeed   * 1.10);
        this._showAlert(`🎖 ${d._callsign} ترقّى لمخضرم!`);
      } else if (d._vet < 2 && d._kills >= 8 && d._wavesAlive >= 4) {
        d._vet = 2;
        d._callsign ??= nextVetCallsign();
        d.fireDamage = Math.round(d.fireDamage * 1.15);
        d.maxSpeed   = Math.round(d.maxSpeed   * 1.10);
        d.hp = Math.min(d.maxHp, d.hp + 30);  // battle-hardened HP restore
        this._showAlert(`⭐ ${d._callsign} ترقّى لـ ACE!`);
      }
    }
  }

  // ── Recovery ───────────────────────────────────────────────────────────────

  /** Objectives slowly heal when no enemy is within SAFE_RADIUS. */
  _applyAutoRecovery(dt) {
    const SAFE_R2      = 220 * 220;
    const RECOVERY_RATE = 0.45;   // HP/s

    for (const obj of this.objectives) {
      if (obj.health <= 0 || obj.health >= obj.maxHealth) continue;
      const threatened = this.enemySwarm.drones.some(e => {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        return dx * dx + dy * dy < SAFE_R2;
      });
      if (!threatened) {
        obj.health = Math.min(obj.maxHealth, obj.health + RECOVERY_RATE * dt);
      }
    }
  }

  // ── Hazards ────────────────────────────────────────────────────────────────

  _applyHazards(dt) {
    if (!this.hazards.length) return;
    const dpsMulti = this.cityResources.hazardDpsMultiplier();
    const all = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    for (const h of this.hazards) h.applyDamage(all, dt, dpsMulti);
    this.playerSwarm.drones = this.playerSwarm.drones.filter(d => !d.dead);
    this.enemySwarm.drones  = this.enemySwarm.drones.filter(d => !d.dead);
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  _checkCombat(dt) {
    const friendly = this.playerSwarm.drones;
    const enemies  = this.enemySwarm.drones;

    for (const p of friendly) {
      const target = p.findTarget(enemies);
      if (!target) continue;
      if (!p.tickFire(dt)) continue;
      this._lasers.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y,
                          color: '#00d4ff', ttl: 0.08 });
      if (target.takeDamage(p.fireDamage)) {
        if (p._kills !== undefined) p._kills++;   // vet kill tracking
        const role = target.role;
        const color = role === 'commander' ? '#ffaa00'
                    : role === 'kamikaze'  ? '#ff4400'
                    : '#ff3c3c';
        this.particles.explode(target.x, target.y, color, role === 'commander' ? 18 : 10);
        this.audio.enemyDestroyed();
        const scoreBonus = role === 'commander' ? 50 : role === 'kamikaze' ? 20 : 10;
        const gained = Math.round(scoreBonus * this._scoreMulti);
        this.score += gained;
        if (role === 'commander') this._showAlert('⭐ القائد أُسقط! الأعداء أضعف!');
        this.waveKills++;
        this.totalKills++;
        // Score popup
        this._scorePopups.push({ x: target.x, y: target.y, text: `+${gained}`, ttl: 1.2, maxTtl: 1.2 });
        // Kill feed
        const feedLabel = role === 'commander' ? '★ COMMANDER' : role === 'boss' ? '★ BOSS' : role.toUpperCase();
        this._killFeed.unshift({ text: feedLabel, ttl: 3.5, maxTtl: 3.5 });
        if (this._killFeed.length > 5) this._killFeed.length = 5;
      }
    }

    for (const e of enemies) {
      if ((e._stunTimer ?? 0) > 0) continue;   // stunned — can't fire
      const target = e.findTarget(friendly);
      if (!target) continue;
      if (!e.tickFire(dt)) continue;
      this._lasers.push({ x1: e.x, y1: e.y, x2: target.x, y2: target.y,
                          color: '#ff3c3c', ttl: 0.08 });
      if (target.takeDamage(e.fireDamage)) {
        if (target._vet > 0 && target._callsign) {
          this._showAlert(`🎖 ${target._callsign} أُسقط!`);
        }
        this.particles.explode(target.x, target.y, '#00d4ff', 6);
        this.waveLosses++;
        this.totalLosses++;
        this._hitFlash = Math.min(1, this._hitFlash + 0.45);
      }
    }

    this.playerSwarm.drones = friendly.filter(d => !d.dead);
    this.enemySwarm.drones  = enemies.filter(d => !d.dead);
  }

  _checkObjectiveHits() {
    const OBJ_R2  = 30 * 30;
    const enemies = this.enemySwarm.drones;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      for (const obj of this.objectives) {
        if (obj.health <= 0) continue;
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < OBJ_R2) {
          this.particles.explode(e.x, e.y, '#ff8800', 8);
          enemies.splice(j, 1);
          const prevPct = obj.health / obj.maxHealth;
          // Kamikaze deals heavy explosion damage
          const hitDmg = e.role === 'kamikaze' ? 35 : 10;
          obj.health = Math.max(0, obj.health - hitDmg);
          this.shake.trigger(e.role === 'kamikaze' ? 22 : 10, e.role === 'kamikaze' ? 0.55 : 0.35);
          this.audio.objectiveHit();
          if (e.role === 'kamikaze') this._showAlert(`💥 انتحاري! ضرر مضاعف!`);
          this._perfectWave = false;   // wave is no longer perfect

          if (obj.health <= 0 && prevPct > 0) {
            this._showAlert(`💥 ${obj._label} دُمِّرت!`);
          } else if (obj.health / obj.maxHealth <= 0.30 && prevPct > 0.30) {
            this._showAlert(`⚠ ${obj._label} في خطر شديد!`);
          }
          break;
        }
      }
    }
  }

  _showAlert(text) {
    this._alertText  = text;
    this._alertTimer = 3.0;
  }

  // ── Wave complete ──────────────────────────────────────────────────────────

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this._deploymentPhase > 0) return;
    if (this._awaitingUpgrade) return;
    if (this.enemySwarm.drones.length > 0 || this.enemySwarm.spawning) return;

    // ── Wave-clear bonus: heal alive objectives ──────────────────────────────
    const HEAL_PER_WAVE = 8;
    for (const obj of this.objectives) {
      if (obj.health > 0) {
        obj.health = Math.min(obj.maxHealth, obj.health + HEAL_PER_WAVE);
      }
    }

    // ── Streak tracking ──────────────────────────────────────────────────────
    if (this._perfectWave) {
      this._streak++;
      if (this._streak > this._maxStreak) this._maxStreak = this._streak;
      if (this._streak >= 2) {
        this._showAlert(`🔥 سلسلة مثالية ×${this._streak}!`);
      }
    } else {
      this._streak = 0;
    }

    // Track boss waves cleared
    if (this.wave % 5 === 0) this._bossWavesCleared++;

    // Vet progression: increment wavesAlive then check promotions
    for (const d of this.playerSwarm.drones) {
      if (!d.dead) d._wavesAlive = (d._wavesAlive ?? 0) + 1;
    }
    this._checkVetPromotions();

    this.score += Math.round(100 * this.wave * this._scoreMulti);
    this._awaitingUpgrade = true;

    this.upgradeScreen
      .show(this.wave, { kills: this.waveKills, losses: this.waveLosses, score: this.score })
      .then((key) => {
        this._applyUpgrade(key);
        this._awaitingUpgrade = false;
        this._nextWave();
      });
  }

  _applyUpgrade(key) {
    const drones = this.playerSwarm.drones;
    switch (key) {
      case 'craft_interceptor': this.playerSwarm.reinforce(2, 'interceptor'); break;
      case 'craft_gunship':     this.playerSwarm.reinforce(2, 'gunship');     break;
      case 'craft_sentinel':    this.playerSwarm.reinforce(2, 'sentinel');    break;
      case 'drones':            this.playerSwarm.reinforce(5, 'standard');    break;
      case 'firepower':
        for (const d of drones) d.fireDamage = Math.round(d.fireDamage * 1.30);
        break;
      case 'speed':
        for (const d of drones) {
          d._baseMaxSpeed = Math.round((d._baseMaxSpeed ?? d.maxSpeed) * 1.20);
          d.maxSpeed = Math.round(d._baseMaxSpeed * this.cityResources.speedModifier());
        }
        break;
      case 'repair': {
        // Heal the most damaged alive objective by 30 HP
        const alive = this.objectives.filter(o => o.health > 0);
        if (alive.length) {
          const worst = alive.reduce((w, o) => o.health < w.health ? o : w, alive[0]);
          worst.health = Math.min(worst.maxHealth, worst.health + 30);
          this._showAlert(`🔧 تم إصلاح ${worst._label} (+30 HP)`);
        }
        break;
      }
      default: break;
    }
  }

  // ── Threat score ───────────────────────────────────────────────────────────

  threatScore() {
    const enemies = this.enemySwarm.drones;
    if (!enemies.length) return 0;
    const THREAT_R = 250;
    let near = 0;
    for (const e of enemies) {
      for (const obj of this.objectives) {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < THREAT_R * THREAT_R) { near++; break; }
      }
    }
    return near / enemies.length;
  }

  // ── Game over ──────────────────────────────────────────────────────────────

  _checkGameOver() {
    if (!this.cityResources.cityFallen()) return;
    this.running = false;
    this.audio.gameOver();
    setTimeout(() => {
      this.gameOverScreen.show(this.score, this.wave, this.dataCollector.sampleCount, {
        objectivesAlive:   this.objectives.filter(o => o.health > 0).length,
        maxStreak:         this._maxStreak,
        bossWavesCleared:  this._bossWavesCleared,
        totalKills:        this.totalKills,
        totalLosses:       this.totalLosses,
        resources: {
          power: this.cityResources.power,
          water: this.cityResources.water,
          food:  this.cityResources.food,
        },
      });
    }, 600);
  }

  // ── Phase-1 FX update ──────────────────────────────────────────────────────

  _updateFX(dt) {
    // Score popups: rise and fade
    for (const p of this._scorePopups) p.ttl -= dt;
    this._scorePopups = this._scorePopups.filter(p => p.ttl > 0);

    // Kill feed: fade entries
    for (const k of this._killFeed) k.ttl -= dt;
    this._killFeed = this._killFeed.filter(k => k.ttl > 0);

    // Hit flash: decay quickly
    if (this._hitFlash > 0) this._hitFlash = Math.max(0, this._hitFlash - dt * 3);

    // Vignette: smooth toward min-objective health ratio
    const minHP = this.objectives.reduce((m, o) => Math.min(m, o.health / o.maxHealth), 1);
    this._vignetteHP += (minHP - this._vignetteHP) * Math.min(1, dt * 2);
  }

  // ── Phase-1 FX draw ────────────────────────────────────────────────────────

  _drawFX(W, H) {
    const ctx = this.ctx;

    // ── Vignette ──────────────────────────────────────────────────────────────
    // Intensity: 0.10 at full health → 0.60 at 0 HP, boosted by hit flash
    const vigBase = 0.10 + (1 - this._vignetteHP) * 0.50;
    const vigIntensity = Math.min(0.85, vigBase + this._hitFlash * 0.35);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.80);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(${this._hitFlash > 0.1 ? '120,0,0' : '0,0,0'},${vigIntensity.toFixed(2)})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── Hit flash ─────────────────────────────────────────────────────────────
    if (this._hitFlash > 0.02) {
      ctx.save();
      ctx.globalAlpha = this._hitFlash * 0.28;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Score popups ──────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    for (const p of this._scorePopups) {
      const frac = p.ttl / p.maxTtl;                    // 1→0
      const alpha = frac < 0.3 ? frac / 0.3 : 1;        // fade in fast, then...
      const fadeAlpha = frac > 0.3 ? 1 : frac / 0.3;
      const rise = (1 - frac) * 40;                      // floats up 40px
      ctx.globalAlpha = Math.min(alpha, frac) * 0.95;
      ctx.fillStyle = '#ffee55';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - rise);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();

    // ── Kill feed ─────────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const feedX = W - 16;
    let feedY = 72;
    for (const k of this._killFeed) {
      const alpha = Math.min(1, k.ttl / 0.6);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = k.text.startsWith('★') ? '#ffcc00' : '#ff5566';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.fillText(`✕ ${k.text}`, feedX, feedY);
      feedY += 16;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();

    // ── EMP HUD badge ─────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    // Charge pips below kill counter (left side ~y=150)
    const empY = 148;
    ctx.fillStyle = 'rgba(0,210,255,0.55)';
    ctx.fillText('EMP', 18, empY);
    for (let i = 0; i < 3 + Math.floor(this.wave / 5); i++) {
      const filled = i < this._empCharges;
      ctx.fillStyle = filled ? 'rgba(0,230,255,0.85)' : 'rgba(0,80,100,0.4)';
      ctx.shadowColor = filled ? '#00ddff' : 'transparent';
      ctx.shadowBlur  = filled ? 5 : 0;
      ctx.fillRect(44 + i * 12, empY - 9, 8, 8);
    }
    ctx.shadowBlur = 0;
    if (this._empMode) {
      // Pulsing "PLACE EMP" banner
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00eeff';
      ctx.shadowColor = '#00eeff';
      ctx.shadowBlur = 10;
      ctx.fillText('[ انقر لوضع الفخ EMP ]', W / 2, H - 30);
      ctx.shadowBlur = 0;
    } else if (this._empCharges > 0) {
      ctx.globalAlpha = 0.45;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00d4ff';
      ctx.fillText('E = EMP', 18, empY + 12);
    }

    // ── Tower HUD badge ───────────────────────────────────────────────────────
    const towerY = empY + 28;
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,200,0,0.60)';
    ctx.fillText('GTL', 18, towerY);
    // Tower slot pips (max 3)
    for (let i = 0; i < 3; i++) {
      const occupied = i < this._towers.length;
      ctx.fillStyle   = occupied ? 'rgba(255,200,0,0.85)' : 'rgba(80,60,0,0.45)';
      ctx.shadowColor = occupied ? '#ffcc00' : 'transparent';
      ctx.shadowBlur  = occupied ? 5 : 0;
      ctx.fillRect(44 + i * 12, towerY - 9, 8, 8);
    }
    ctx.shadowBlur = 0;
    if (this._towerMode) {
      const pulse2 = 0.6 + 0.4 * Math.sin(Date.now() / 200);
      ctx.globalAlpha = pulse2;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffdd00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.fillText(`[ انقر لبناء برج Gatling  (${GatlingTower.COST} نقطة) ]`, W / 2, H - 30);
      ctx.shadowBlur = 0;
    } else if (this.score >= GatlingTower.COST && this._towers.length < 3) {
      ctx.globalAlpha = 0.45;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('G = برج', 18, towerY + 12);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // 1. Clear + radar background (fixed — not shaken)
    this.canvas.clear();
    this._drawRadarBackground();

    // 2. Game-world elements (screen-shake applied)
    ctx.save();
    this.shake.apply(ctx);

    this._drawCityConnections();
    for (const h of this.hazards) h.draw(ctx);
    for (const t of this._empTraps) t.draw(ctx);
    for (const tw of this._towers) tw.draw(ctx);
    // Ghost preview for tower placement
    if (this._towerMode) {
      const ghost = new GatlingTower(this._mouseX, this._mouseY);
      ghost._angle = -Math.PI / 4;
      ghost.draw(ctx, true);
    }
    for (const obj of this.objectives) obj.draw(ctx);
    this.commander.drawTargetZone(ctx);
    this._drawLasers();
    this.playerSwarm.draw(ctx);
    this.enemySwarm.draw(ctx);
    if (this._sideMission && !this._sideMission.complete && !this._sideMission.failed) {
      this._sideMission.draw(ctx);
    }
    this.particles.draw(ctx);

    ctx.restore();

    // 3. Radar sweep overlay (fixed — not shaken)
    this.radarSweep.draw(ctx, W / 2, H / 2, W, H);

    // 4. FX: vignette + hit flash + score popups + kill feed
    this._drawFX(W, H);

    // 5. UI
    this.waveAnnouncer.draw(ctx, W, H);
    this._drawAlertBanner();
    this._drawClickHint();
    if (this._deploymentPhase > 0) this._drawDeploymentOverlay(ctx, W, H);
    this._drawMissionStatus(ctx, W, H);
    const vetCount = this.playerSwarm.drones.filter(d => !d.dead && d._vet > 0).length;
    this.hud.draw(
      this.score, this.wave,
      this.cityResources,
      this.playerSwarm.drones.length,
      this.playerSwarm.currentFormation,
      this.dataCollector.sampleCount,
      this.dataCollector.serverStatus,
      this.totalKills, this.totalLosses,
      this.hazards.length,
      this.wave % 5 === 0,
      this.playerSwarm.activeGroup,
      vetCount,
      this._playerIdentity?.callsign ?? ''
    );
  }

  _drawCityConnections() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,200,80,0.13)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 14]);
    for (let i = 0; i < this.objectives.length; i++) {
      for (let j = i + 1; j < this.objectives.length; j++) {
        const a = this.objectives[i], b = this.objectives[j];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawAlertBanner() {
    if (this._alertTimer <= 0 || !this._alertText) return;
    const alpha = Math.min(1, this._alertTimer / 1.0);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 22;
    ctx.fillText(this._alertText, this.canvas.width / 2, this.canvas.height / 2 - 44);
    ctx.restore();
  }

  _drawLasers() {
    const ctx = this.ctx;
    ctx.save();
    for (const l of this._lasers) {
      const alpha = l.ttl / 0.08;
      ctx.strokeStyle = l.color.replace(')', `,${alpha * 0.9})`).replace('rgb', 'rgba');
      ctx.lineWidth = 1.5;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawDeploymentOverlay(ctx, W, H) {
    const t    = this._deploymentPhase;
    const FULL = 12;
    const pct  = t / FULL;

    ctx.save();

    // ── Progress bar at top of screen ──────────────────────────────────
    ctx.fillStyle = 'rgba(0,255,100,0.08)';
    ctx.fillRect(0, 0, W, 3);
    ctx.fillStyle = t < 4 ? '#ff6600' : '#00ff88';
    ctx.fillRect(0, 0, W * pct, 3);

    // ── Central countdown banner ────────────────────────────────────────
    const secs = Math.ceil(t);
    ctx.textAlign  = 'center';
    ctx.font       = 'bold 17px monospace';
    ctx.fillStyle  = t < 4 ? 'rgba(255,100,0,0.9)' : 'rgba(0,255,120,0.85)';
    ctx.shadowColor = t < 4 ? '#ff6600' : '#00ff88';
    ctx.shadowBlur  = 14;
    ctx.fillText(`📍 وزّع قواتك — ${secs}s`, W / 2, H - 110);

    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(0,200,80,0.45)';
    ctx.shadowBlur = 0;
    ctx.fillText('انقر لتحريك قواتك  ·  Tab=تبديل A/B  ·  S=تقسيم  ·  Space=ابدأ الآن', W / 2, H - 90);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  _drawMissionStatus(ctx, W, H) {
    const m = this._sideMission;
    if (!m || m.complete || m.failed) return;

    const text  = m.statusText;
    const alpha = 0.75;

    ctx.save();
    ctx.font      = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,255,136,${alpha})`;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 6;
    ctx.fillText(text, W / 2, H - 60);
    ctx.shadowBlur  = 0;
    ctx.textAlign   = 'left';
    ctx.restore();
  }

  _drawClickHint() {
    if (this._clickHintTimer <= 0) return;
    const alpha = Math.min(1, this._clickHintTimer / 1.5);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 12;
    ctx.fillText('🖱  انقر على الشاشة لتحريك الأسراب', this.canvas.width / 2, this.canvas.height - 80);
    ctx.restore();
  }

  /**
   * Radar background — concentric rings, crosshairs, bearing labels, scanlines.
   * Drawn BEFORE the shake transform so it stays fixed on screen.
   */
  _drawRadarBackground() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(W * W + H * H) / 2;

    // CRT scanlines (horizontal, every 3 px)
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // Concentric rings
    ctx.strokeStyle = 'rgba(0,200,80,0.13)';
    ctx.lineWidth   = 1;
    for (const frac of [0.22, 0.44, 0.66, 0.88]) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs (dashed)
    ctx.strokeStyle = 'rgba(0,200,80,0.10)';
    ctx.setLineDash([8, 18]);
    ctx.beginPath(); ctx.moveTo(cx, 0);    ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,  cy);   ctx.lineTo(W, cy); ctx.stroke();
    ctx.setLineDash([]);

    // 45° diagonal lines (very faint)
    ctx.strokeStyle = 'rgba(0,200,80,0.05)';
    const d = maxR * 1.5;
    ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();

    // Tick marks on rings (single path for perf)
    ctx.strokeStyle = 'rgba(0,200,80,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (const frac of [0.22, 0.44, 0.66, 0.88]) {
      const r = maxR * frac;
      for (let deg = 0; deg < 360; deg += 10) {
        const a    = (deg * Math.PI) / 180;
        const tick = deg % 30 === 0 ? 5 : 2.5;
        ctx.moveTo(cx + Math.cos(a) * (r - tick), cy + Math.sin(a) * (r - tick));
        ctx.lineTo(cx + Math.cos(a) * (r + tick), cy + Math.sin(a) * (r + tick));
      }
    }
    ctx.stroke();

    // Bearing labels
    const labelR   = maxR * 0.93;
    const bearings = [
      { a: -Math.PI / 2,      label: 'N',   bold: true },
      { a:  0,                label: 'E',   bold: true },
      { a:  Math.PI / 2,      label: 'S',   bold: true },
      { a:  Math.PI,          label: 'W',   bold: true },
      { a: -Math.PI * 3 / 4,  label: '315' },
      { a: -Math.PI / 4,      label: '045' },
      { a:  Math.PI / 4,      label: '135' },
      { a:  Math.PI * 3 / 4,  label: '225' },
    ];
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (const b of bearings) {
      ctx.font      = b.bold ? 'bold 11px monospace' : '9px monospace';
      ctx.fillStyle = b.bold ? 'rgba(0,220,90,0.60)' : 'rgba(0,200,80,0.30)';
      ctx.fillText(b.label,
        cx + Math.cos(b.a) * labelR,
        cy + Math.sin(b.a) * labelR
      );
    }

    // Centre dot
    ctx.fillStyle   = 'rgba(0,255,100,0.45)';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

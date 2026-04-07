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
import { ScoutIntro } from '../ui/ScoutIntro.js';
import { FORMATION_BOIDS } from '../ai/Formations.js';
import { TARGET_TYPES } from '../entities/TargetTypes.js';
import { waveComposition } from '../entities/EnemyRoles.js';
import { getWaveStory } from '../data/StoryLines.js';
import { RadarSweep } from './RadarSweep.js';
import { DroneLab } from '../ui/DroneLab.js';
import { nextVetCallsign } from '../data/PlayerIdentity.js';
import { generateSideMission } from '../events/SideMission.js';
import { EmpTrap } from '../entities/EmpTrap.js';
import { GatlingTower } from '../entities/GatlingTower.js';
import { EnemyBase } from '../entities/EnemyBase.js';
import { CockpitHUD }   from '../ui/CockpitHUD.js';
import { CockpitShell } from '../ui/CockpitShell.js';
import { ThreeScene }   from '../rendering/ThreeScene.js';

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

    this.radarSweep   = new RadarSweep();
    this.cockpitHUD   = new CockpitHUD(this);
    this.threeScene   = new ThreeScene(this);  // 3-D game world — replaces 2-D visual
    this.cockpitShell = new CockpitShell();    // Three.js cockpit frame — topmost layer

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
    this._deploymentPhase   = 0;
    this._combatStartFlash  = 0;  // brief white flash when combat begins
    this._waveCountdown     = 0;  // 3-2-1 countdown before enemies spawn

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
      if (e.key === 'x' || e.key === 'X')         this._toggleEmpMode();
      if (e.key === 'g' || e.key === 'G')         this._toggleTowerMode();
      if (e.key === 'q' || e.key === 'Q')         this._useSonarCharge('sweep');
      if (e.key === 'w' || e.key === 'W')         this._useSonarCharge('focus');
      if (e.key === 'f' || e.key === 'F')         this._useSonarCharge('stealth');
      // Quick menu & its number selections
      if (e.key === 'r' || e.key === 'R')         this._toggleQuickMenu();
      // ── Formation hotkeys ──────────────────────────────────────────────────
      if (e.key === 'z' || e.key === 'Z') this._setFormation('watch');
      if (e.key === 'c' || e.key === 'C') this._setFormation('dagger');
      if (e.key === 'v' || e.key === 'V') this._setFormation('shield');
      if (e.key === 'b' || e.key === 'B') this._setFormation('net');
      if (e.key === 'n' || e.key === 'N') this._setFormation('point');
      if (this._quickMenuOpen) {
        if (e.key === '1') this._quickAction(1);
        if (e.key === '2') this._quickAction(2);
        if (e.key === '3') this._quickAction(3);
        if (e.key === 'Escape') this._quickMenuOpen = false;
      }
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

    // ── Phase-4 polish ────────────────────────────────────────────────────────
    this._comboCount = 0;    // rapid-kill streak
    this._comboTimer = 0;    // countdown to reset combo (2.5s per kill)
    this._slowMo     = 0;    // 0-1; 1=full slow, decays in real time
    this._timeScale  = 1;    // physics dt multiplier (updated in _loop)
    this._waveWipe            = 0;    // 0-1; plays before upgrade screen
    this._waveCompletionPulse = 0;    // 0-1; green flourish on objectives

    // ── Enemy base ────────────────────────────────────────────────────────────
    this._enemyBase        = null;  // EnemyBase instance (wave 3+)
    this._baseBonusWaves   = 0;     // waves remaining with enemy-count reduction

    // ── Orbital scan (radar escape valve) ────────────────────────────────────
    this._orbitalScan      = 0;     // seconds remaining; when >0 all enemies visible
    this.ORBITAL_SCAN_COST = 200;   // score cost
    this.ORBITAL_SCAN_DUR  = 4;     // seconds of full reveal

    // ── Sonar Warfare charges ─────────────────────────────────────────────────
    this._sonarCharges    = 0;      // stored charges (0–3)
    this.SONAR_MAX        = 3;
    this._sonarFullSweep  = 0;      // seconds remaining: Full Sweep effect
    this._sonarFocusPulse = null;   // { x, y, ttl, maxTtl } active Focus Pulse
    this._sonarStealthDet = 0;      // seconds remaining: Stealth Detect effect

    // ── Quick actions menu ────────────────────────────────────────────────────
    this._quickMenuOpen    = false;

    // ── Scout intro sequence ──────────────────────────────────────────────────
    this._scoutIntro       = null;

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
    this._comboCount = 0;
    this._comboTimer = 0;
    this._slowMo     = 0;
    this._timeScale  = 1;
    this._waveWipe   = 0;
    this._enemyBase        = null;
    this._baseBonusWaves   = 0;
    this._orbitalScan      = 0;
    this._sonarCharges     = 0;
    this._sonarFullSweep   = 0;
    this._sonarFocusPulse  = null;
    this._sonarStealthDet  = 0;
    this._quickMenuOpen    = false;
    this._scoutIntro       = null;
    this._objectiveTier    = 0;
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
    this.cockpitHUD.reset();
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
        this._runScoutIntro().then(() => this._nextWave());
      });
    });
  }

  // ── Scout intro ───────────────────────────────────────────────────────────

  _runScoutIntro() {
    const W = this.canvas.width, H = this.canvas.height;

    // Objectives start compact (tier 1) so the scout shows them in their starting positions
    this._updateObjectivePositions(1);

    // Show a visual preview of the enemy base so the scout can fly over it
    this._enemyBase = new EnemyBase(W * 0.50, H * 0.06, 1);

    this._scoutIntro = new ScoutIntro(this.canvas, this.radarSweep, this.objectives);

    const skipHandler = (e) => {
      if (e.code === 'Space' || e.key === 'Enter') this._scoutIntro?.skip();
    };
    window.addEventListener('keydown', skipHandler);

    return this._scoutIntro.show().then(() => {
      window.removeEventListener('keydown', skipHandler);
      this._scoutIntro = null;
      this._enemyBase  = null;   // real base re-created at wave 3
    });
  }

  // ── Group A/B/C/D controls ────────────────────────────────────────────────

  _toggleGroup() {
    if (!this.running) return;
    const occupied = this.playerSwarm.activeGroups();
    if (occupied.length < 2) return;                     // nothing to cycle
    const cur = this.playerSwarm.activeGroup;
    const idx = occupied.indexOf(cur);
    this.playerSwarm.activeGroup = occupied[(idx + 1) % occupied.length];
    const NAMES = { A: 'ALPHA', B: 'BRAVO', C: 'CHARLIE', D: 'DELTA' };
    const grp   = this.playerSwarm.activeGroup;
    const count = this.playerSwarm.drones.filter(d => !d.dead && d._group === grp).length;
    this.cockpitHUD.showGroupBanner(grp, count);
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
      const occupied = this.playerSwarm.activeGroups();
      this._showAlert(`السرب مقسّم إلى ${occupied.length} مجموعات (Tab للتبديل)`);
    } else {
      this.playerSwarm.mergeGroups();
      this._showAlert('السرب مدمج في المجموعة ALPHA');
    }
  }

  // ── Formation control ─────────────────────────────────────────────────────

  _setFormation(name) {  // sync — FORMATION_BOIDS is a static import
    if (!this.running) return;
    const tz = this.playerSwarm.targetZone;
    this.playerSwarm.setFormation(name, tz?.x, tz?.y);
    const { FORMATION_BOIDS } = this._formationBoids ?? {};
    // Lazy-import label from FORMATION_BOIDS (already in SwarmController module)
    const labels = { watch: 'وتش  WATCH', dagger: 'خنجر DAGGER', shield: 'درع  SHIELD', net: 'شبكة NET', point: 'نقطة POINT' };
    this._showAlert(`⬡ تشكيل: ${labels[name] ?? name.toUpperCase()}`);
    if (FORMATION_BOIDS[name]?.hint) this.cockpitHUD.showFormationHint(FORMATION_BOIDS[name].hint);
    // Force preview redraw immediately
    this.cockpitHUD._lastPreviewFormation = null;
  }

  _nextWave() {
    this.wave++;
    this._updateObjectivePositions(this.wave);
    this._waveDelay   = 1.5;
    this.waveKills    = 0;
    this.waveLosses   = 0;
    this._perfectWave = true;
    // Replenish EMP charges each wave (base 3, +1 every 5 waves)
    this._empTraps   = [];
    this._empMode    = false;
    this._empCharges = 3 + Math.floor(this.wave / 5);
    // Clear active sonar effects on wave start (charges persist)
    this._sonarFocusPulse = null;

    this.hazards = generateHazards(
      this.wave, this.canvas.width, this.canvas.height,
      this.objectives
    );

    const isBossWave = this.wave % 5 === 0;
    const story = getWaveStory(this.wave, isBossWave, this.cityResources, this._streak);
    this.waveAnnouncer.announce(this.wave, isBossWave, story, this._streak);
    this.audio.waveStart();

    // Apply sabotage / base-destruction wave-count reduction
    const activeMult = Math.min(this._nextWaveEnemyMult,
                                this._baseBonusWaves > 0 ? 0.80 : 1.0);
    if (this._baseBonusWaves > 0) this._baseBonusWaves--;
    if (activeMult < 1.0) {
      const baseCount = Math.min(10 + this.wave * 3, 40);
      this._pendingEnemyOverride = Math.round(baseCount * activeMult);
      this._nextWaveEnemyMult   = 1.0;
    }

    // ── Enemy base: spawn fresh each wave on wave 3+ (if not already alive) ──
    if (this.wave >= 3 && (!this._enemyBase || this._enemyBase.dead)) {
      const W = this.canvas.width, H = this.canvas.height;
      this._enemyBase = new EnemyBase(W * 0.50, H * 0.06, this.wave);
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
    const canSkip = this._deploymentPhase > 0 || this._waveCountdown > 0;
    if (!canSkip) return;
    this._deploymentPhase   = 0;
    this._waveCountdown     = 0;
    this._combatStartFlash  = 0.18;
    this.enemySwarm.spawnWave(this.wave, this._pendingEnemyOverride);
    this._pendingEnemyOverride = undefined;
    this._showAlert('⚔ الهجوم!');
  }

  _loop(timestamp) {
    if (!this.running) return;
    const rawDt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    // Slow-mo: always decay with real time so duration is predictable
    if (this._slowMo > 0) {
      this._slowMo   = Math.max(0, this._slowMo - rawDt / 1.8);
      this._timeScale = 0.30 + (1 - this._slowMo) * 0.70;
    } else {
      this._timeScale = 1;
    }

    const dt = rawDt * this._timeScale;
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

    // ── Scout intro: only run radar + scout; skip all combat / spawn logic ────
    if (this._scoutIntro) {
      this._scoutIntro.update(dt);
      if (this._enemyBase) this._enemyBase.update(dt);   // show shield animation
      const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
      this.radarSweep.update(dt, cx, cy, []);             // sweep keeps rotating
      this._updateFX(dt);
      return;
    }

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
        // Start 3-2-1 countdown before spawning
        if (this._waveCountdown <= 0) this._waveCountdown = 3;
      }
      return;  // skip combat, enemy AI, hazards during deployment
    }

    // ── Wave countdown (3-2-1 before enemies spawn) ───────────────────────────
    if (this._waveCountdown > 0) {
      this._waveCountdown -= dt;
      this.playerSwarm.update(dt, []);
      this.particles.update(dt);
      this.waveAnnouncer.update(dt);
      const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
      this.radarSweep.update(dt, cx, cy, this.playerSwarm.drones);
      if (this._waveCountdown <= 0) {
        this._waveCountdown    = 0;
        this._combatStartFlash = 0.18;
        this.enemySwarm.spawnWave(this.wave, this._pendingEnemyOverride);
        this._pendingEnemyOverride = undefined;
        this._showAlert('⚔ الهجوم!');
      }
      return;
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

    // ── Commander spawn alert ────────────────────────────────────────────────
    {
      const cmdNow = this.enemySwarm.drones.some(d => !d.dead && d.role === 'commander');
      if (cmdNow && !this._cmdWasAlive) {
        this._showAlert('★ القائد العدو دخل الميدان — أسقطه!');
        this.shake.trigger(0.4);
      }
      this._cmdWasAlive = cmdNow;
    }

    // ── Boss enrage alert ────────────────────────────────────────────────────
    if (this.enemySwarm._justEnraged) {
      this._showAlert('💢 البوس هائج! سرعة مضاعفة — احذر!');
      this.shake.trigger(0.8);
      this.particles.explode(this.canvas.width / 2, 60, '#ff2200', 20);
    }

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
          this._onEnemyKilled(shot.target.role, shot.target.x, shot.target.y);
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

    // ── Enemy base: update + turret fire ─────────────────────────────
    if (this._enemyBase && !this._enemyBase.dead) {
      this._enemyBase.update(dt);
      const turretShots = this._enemyBase.shootTurrets(this.playerSwarm.drones);
      for (const s of turretShots) {
        this._lasers.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
                            color: '#ff8800', ttl: 0.10 });
        if (s.killed) {
          this.particles.explode(s.target.x, s.target.y, '#00d4ff', 6);
          this.waveLosses++;
          this.totalLosses++;
          this._hitFlash = Math.min(1, this._hitFlash + 0.35);
        }
      }
      this.playerSwarm.drones = this.playerSwarm.drones.filter(d => !d.dead);
    }

    // ── Orbital scan: decay + force-reveal ────────────────────────────
    if (this._orbitalScan > 0) {
      this._orbitalScan -= dt;
      const revealTargets = [...this.enemySwarm.drones];
      if (this._enemyBase && !this._enemyBase.dead) revealTargets.push(this._enemyBase);
      this.radarSweep.forceReveal(revealTargets);
    }

    // ── Sonar Warfare: Full Sweep ──────────────────────────────────────────
    if (this._sonarFullSweep > 0) {
      this._sonarFullSweep -= dt;
      const sweepTargets = [...this.enemySwarm.drones];
      if (this._enemyBase && !this._enemyBase.dead) sweepTargets.push(this._enemyBase);
      this.radarSweep.forceReveal(sweepTargets);
    }

    // ── Sonar Warfare: Focus Pulse ─────────────────────────────────────────
    if (this._sonarFocusPulse) {
      this._sonarFocusPulse.ttl -= dt;
      const fp = this._sonarFocusPulse;
      const pulseTargets = [...this.enemySwarm.drones];
      if (this._enemyBase && !this._enemyBase.dead) pulseTargets.push(this._enemyBase);
      this.radarSweep.forceRevealRadius(pulseTargets, fp.x, fp.y, 160);
      if (fp.ttl <= 0) this._sonarFocusPulse = null;
    }

    // ── Sonar Warfare: Stealth Detect ─────────────────────────────────────
    if (this._sonarStealthDet > 0) {
      this._sonarStealthDet -= dt;
      const stealthTargets = this.enemySwarm.drones.filter(d => d.role === 'stealth' && !d.dead);
      for (const d of stealthTargets) d._revealed = true;
      this.radarSweep.forceReveal(stealthTargets);
    }

    // ── Radar sweep ───────────────────────────────────────────────────
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    const allEntities = [...this.playerSwarm.drones, ...this.enemySwarm.drones];
    if (this._enemyBase && !this._enemyBase.dead) allEntities.push(this._enemyBase);
    this.radarSweep.update(dt, cx, cy, allEntities);

    // ── Objective threat state (drives spinning danger ring) ──────────
    const THREAT_R2 = 200 * 200;
    for (const obj of this.objectives) {
      let count = 0;
      for (const e of this.enemySwarm.drones) {
        const dx = e.x - obj.x, dy = e.y - obj.y;
        if (dx * dx + dy * dy < THREAT_R2) count++;
      }
      obj._threatCount = count;
      obj._threatened  = count > 0;
    }

    this._applyHazards(dt);
    this._applyAutoRecovery(dt);
    this._updateSideMission(dt);
    this._checkCombat(dt);
    this._checkObjectiveHits();
    this._checkWaveComplete();
    this._checkGameOver();
    this._updateFX(dt);
    this.commander.updateRecommendation();
    this.cockpitHUD.update(dt);
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

  // ── Kill pipeline (combo + score + FX) ────────────────────────────────────

  /**
   * Called for every enemy death regardless of source (drone / tower).
   * @param {string} role   enemy role string
   * @param {number} x
   * @param {number} y
   */
  _onEnemyKilled(role, x, y) {
    // ── Combo ────────────────────────────────────────────────────────────────
    this._comboCount++;
    this._comboTimer = 2.5;   // window to extend combo

    // Tier thresholds
    const comboMult = this._comboCount >= 8 ? 2.5
                    : this._comboCount >= 5 ? 2.0
                    : this._comboCount >= 3 ? 1.5
                    : 1.0;

    // Trigger slow-mo at combo 5 (only once per combo chain)
    if (this._comboCount === 5) this._slowMo = 1;

    // ── Score ─────────────────────────────────────────────────────────────────
    const baseBonus = role === 'boss' || role === 'commander' ? 50
                    : role === 'kamikaze' ? 20
                    : 10;
    const gained = Math.round(baseBonus * this._scoreMulti * comboMult);
    this.score += gained;
    this.waveKills++;
    this.totalKills++;

    // ── FX ───────────────────────────────────────────────────────────────────
    const color = role === 'commander' ? '#ffaa00'
                : role === 'kamikaze'  ? '#ff4400'
                : '#ff3c3c';
    this.particles.explode(x, y, color, role === 'commander' ? 18 : 10);
    this.audio.enemyDestroyed();

    // Score popup — show multiplier when combo active
    const popupText = comboMult > 1
      ? `+${gained} ×${comboMult.toFixed(1)}`
      : `+${gained}`;
    const popupColor = comboMult >= 2.5 ? '#ff6600'
                     : comboMult >= 2.0 ? '#ff9900'
                     : comboMult >= 1.5 ? '#ffcc00'
                     : '#ffee55';
    this._scorePopups.push({ x, y, text: popupText, ttl: 1.4, maxTtl: 1.4,
                             color: popupColor });

    // Kill feed
    const feedLabel = role === 'commander' ? '★ COMMANDER'
                    : role === 'boss'      ? '★ BOSS'
                    : role.toUpperCase();
    this._killFeed.unshift({ text: feedLabel, ttl: 3.5, maxTtl: 3.5 });
    if (this._killFeed.length > 5) this._killFeed.length = 5;

    // Special alerts
    if (role === 'commander') this._showAlert('⭐ القائد أُسقط! الأعداء أضعف!');
    if (role === 'base') {
      // Extra boom + wave-count reduction reward
      this.particles.explode(x, y, '#ff8800', 30);
      this.particles.explode(x, y, '#ff3300', 20);
      if (this._enemyBase) {
        this.score += this._enemyBase.scoreReward - gained;  // top up to full reward
        this._baseBonusWaves = 2;
      }
      this._showAlert('💥 القاعدة دُمِّرت! الموجات القادمة أضعف!');
      this.shake.trigger(0.8);
    }
  }

  // ── Combat ─────────────────────────────────────────────────────────────────

  _checkCombat(dt) {
    const friendly = this.playerSwarm.drones;
    // Include the enemy base as an attack target when present and alive
    const enemies = (this._enemyBase && !this._enemyBase.dead)
      ? [...this.enemySwarm.drones, this._enemyBase]
      : this.enemySwarm.drones;

    for (const p of friendly) {
      const target = p.findTarget(enemies);
      if (!target) continue;
      if (!p.tickFire(dt)) continue;
      this._lasers.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y,
                          color: '#00d4ff', ttl: 0.08 });
      if (target.takeDamage(p.fireDamage)) {
        if (p._kills !== undefined) p._kills++;   // vet kill tracking
        this._onEnemyKilled(target.role, target.x, target.y);
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
        // Drone-loss popup: shows at kill location
        this._scorePopups.push({
          x: target.x, y: target.y,
          text: '−١ مسيّرة', ttl: 1.0, maxTtl: 1.0,
          color: '#4488ff',
        });
      }
    }

    this.playerSwarm.drones = friendly.filter(d => !d.dead);
    // Exclude the base (managed separately); filter only real enemy drones
    this.enemySwarm.drones  = enemies.filter(d => !d.dead && d !== this._enemyBase);
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
          obj._damageHighlightTimer = 1.2;   // pulsing ring on hit
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

  // ── Quick action menu (R key) ─────────────────────────────────────────────

  _toggleQuickMenu() {
    if (!this.running) return;
    this._quickMenuOpen = !this._quickMenuOpen;
  }

  /**
   * Execute a quick-menu action by slot number.
   * 1 = reinforce +5 standard   (150 pts)
   * 2 = reinforce +3 heavy      (220 pts)
   * 3 = orbital scan            (ORBITAL_SCAN_COST pts)
   */
  _quickAction(slot) {
    this._quickMenuOpen = false;

    const COSTS = { 1: 150, 2: 220, 3: this.ORBITAL_SCAN_COST };
    const cost  = COSTS[slot] ?? 0;

    if (this.score < cost) {
      this._showAlert(`❌ نقاط غير كافية (مطلوب ${cost})`);
      return;
    }

    if (slot === 1) {
      this.score -= cost;
      this.playerSwarm.reinforce(5, 'standard');
      this._showAlert('+5 طائرات تعزيز أُطلقت!');
    } else if (slot === 2) {
      this.score -= cost;
      this.playerSwarm.reinforce(3, 'heavy');
      this._showAlert('+3 طائرات ثقيلة أُطلقت!');
    } else if (slot === 3) {
      this.score -= cost;
      this._orbitalScan = this.ORBITAL_SCAN_DUR;
      this._showAlert(`🛰 مسح مداري: ${this.ORBITAL_SCAN_DUR}s كشف كامل`);
    }
  }

  // ── Sonar Warfare ─────────────────────────────────────────────────────────

  /**
   * Consume one sonar charge and activate the requested effect.
   * type: 'sweep' | 'focus' | 'stealth'
   */
  _useSonarCharge(type) {
    if (this._sonarCharges <= 0) {
      this._showAlert('⚡ لا توجد شحنات رادار');
      return;
    }
    this._sonarCharges--;
    if (type === 'sweep') {
      this._sonarFullSweep = 3;
      this._showAlert('📡 مسح شامل — كشف كامل 3s');
    } else if (type === 'focus') {
      this._sonarFocusPulse = { x: this._mouseX, y: this._mouseY, ttl: 3, maxTtl: 3 };
      this._showAlert('🔍 نبضة تركيز نشطة');
    } else if (type === 'stealth') {
      this._sonarStealthDet = 8;
      this._showAlert('👁 كشف التخفي — 8s');
    }
  }

  // ── Wave complete ──────────────────────────────────────────────────────────

  _checkWaveComplete() {
    if (this._waveDelay > 0) return;
    if (this._deploymentPhase > 0) return;
    if (this._waveCountdown > 0) return;
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
      // Perfect wave earns a sonar charge (capped at max)
      if (this._sonarCharges < this.SONAR_MAX) {
        this._sonarCharges++;
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
    this._comboCount = 0;   // reset combo on wave clear

    // Wave completion: trigger objective pulse flourish
    this._waveCompletionPulse = 1.0;

    // Wave Wipe: play 750 ms animation then open upgrade screen
    this._waveWipe = 1;
    const waveSnap = { kills: this.waveKills, losses: this.waveLosses, score: this.score };
    setTimeout(() => {
      this.upgradeScreen
        .show(this.wave, waveSnap)
        .then((key) => {
          this._applyUpgrade(key);
          this._awaitingUpgrade = false;
          this._nextWave();
        });
    }, 750);
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

    // Hit flash: decay quickly (uses slowed dt — more dramatic in slow-mo)
    if (this._hitFlash > 0) this._hitFlash = Math.max(0, this._hitFlash - dt * 3);

    // Vignette: smooth toward min-objective health ratio
    const minHP = this.objectives.reduce((m, o) => Math.min(m, o.health / o.maxHealth), 1);
    this._vignetteHP += (minHP - this._vignetteHP) * Math.min(1, dt * 2);

    // Combo timer: reset streak if window expires (uses slowed dt intentionally —
    // slow-mo gives a brief grace period to chain more kills)
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) this._comboCount = 0;
    }

    // Wave wipe: decay in slowed time (looks good as part of the effect)
    if (this._waveWipe > 0) this._waveWipe = Math.max(0, this._waveWipe - dt / 0.75);

    // Combat start flash: decays in real time (very brief)
    if (this._combatStartFlash > 0)
      this._combatStartFlash = Math.max(0, this._combatStartFlash - dt);

    // Wave completion pulse: decays quickly
    if (this._waveCompletionPulse > 0)
      this._waveCompletionPulse = Math.max(0, this._waveCompletionPulse - dt / 0.9);

    // Objective damage highlight rings: decay in real time
    for (const obj of this.objectives) {
      if ((obj._damageHighlightTimer ?? 0) > 0)
        obj._damageHighlightTimer = Math.max(0, obj._damageHighlightTimer - dt);
    }
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

    // ── Objective damage highlight rings ──────────────────────────────────────
    for (const obj of this.objectives) {
      const t = obj._damageHighlightTimer ?? 0;
      if (t <= 0) continue;
      const frac = t / 1.2;
      const beat = 0.4 + 0.6 * Math.sin(Date.now() / 180);
      ctx.save();
      ctx.globalAlpha = beat * frac * 0.55;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Hit flash ─────────────────────────────────────────────────────────────
    if (this._hitFlash > 0.02) {
      ctx.save();
      ctx.globalAlpha = this._hitFlash * 0.28;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Combat start flash ────────────────────────────────────────────────────
    if (this._combatStartFlash > 0.005) {
      ctx.save();
      ctx.globalAlpha = (this._combatStartFlash / 0.18) * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Slow-mo cyan tint ─────────────────────────────────────────────────────
    if (this._slowMo > 0.05) {
      ctx.save();
      ctx.globalAlpha = this._slowMo * 0.12;
      ctx.fillStyle = '#00ddff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Wave wipe (scan line sweeping top→bottom) ──────────────────────────────
    if (this._waveWipe > 0) {
      const prog  = 1 - this._waveWipe;           // 0 → 1 as animation advances
      const scanY = H * Math.pow(prog, 0.8);       // slightly eased
      ctx.save();

      // Tailing glow above scan line
      const trailH = 60 + 40 * this._waveWipe;
      const trailGrad = ctx.createLinearGradient(0, scanY - trailH, 0, scanY + 8);
      trailGrad.addColorStop(0, 'rgba(0,255,180,0)');
      trailGrad.addColorStop(0.7, `rgba(0,255,180,${this._waveWipe * 0.18})`);
      trailGrad.addColorStop(1,   `rgba(0,255,180,${this._waveWipe * 0.40})`);
      ctx.fillStyle = trailGrad;
      ctx.fillRect(0, scanY - trailH, W, trailH + 8);

      // Sharp leading edge
      ctx.strokeStyle = `rgba(80,255,200,${this._waveWipe * 0.95})`;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 24 * this._waveWipe;
      ctx.beginPath();
      ctx.moveTo(0, scanY); ctx.lineTo(W, scanY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Full-screen flash at the very start (prog < 0.15)
      if (prog < 0.15) {
        ctx.globalAlpha = (0.15 - prog) / 0.15 * 0.55;
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(0, 0, W, H);
      }

      // "WAVE CLEARED" text when scan passes center
      if (prog > 0.35 && prog < 0.85) {
        const tAlpha = Math.min((prog - 0.35) / 0.15, (0.85 - prog) / 0.15);
        ctx.globalAlpha = tAlpha * this._waveWipe;
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ffcc';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 20;
        ctx.fillText('WAVE CLEARED', W / 2, H / 2 - 12);
        // Streak sub-label
        if (this._streak >= 2) {
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = '#ffdd44';
          ctx.shadowColor = '#ffcc00';
          ctx.fillText(`🔥 سلسلة مثالية ×${this._streak}`, W / 2, H / 2 + 14);
        }
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // ── Score popups ──────────────────────────────────────────────────────────
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of this._scorePopups) {
      const frac  = p.ttl / p.maxTtl;           // 1 → 0
      const alpha = Math.min(frac * 3, 1) * frac;  // quick fade-in, then fade-out
      const rise  = (1 - frac) * 44;
      const isCombo = p.text.includes('×');
      ctx.font        = isCombo ? 'bold 16px monospace' : 'bold 14px monospace';
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle   = p.color ?? '#ffee55';
      ctx.shadowColor = p.color ?? '#ff8800';
      ctx.shadowBlur  = isCombo ? 12 : 8;
      ctx.fillText(p.text, p.x, p.y - rise);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();

    // ── Wave completion flourish (objectives pulse green) ─────────────────────
    if (this._waveCompletionPulse > 0) {
      const p = this._waveCompletionPulse;                    // 1 → 0
      const beat = Math.abs(Math.sin(p * Math.PI * 5));       // fast pulses
      ctx.save();
      for (const obj of this.objectives) {
        if (obj.health <= 0) continue;
        // Expanding ring
        ctx.globalAlpha = beat * p * 0.55;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur  = 20;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, 52 + (1 - p) * 28, 0, Math.PI * 2);
        ctx.stroke();
        // Fill glow
        ctx.globalAlpha = beat * p * 0.12;
        ctx.fillStyle   = '#00ff88';
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, 52, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Combo badge ───────────────────────────────────────────────────────────
    if (this._comboCount >= 3) {
      const timerFrac = Math.max(0, this._comboTimer / 2.5);  // 1 → 0
      const comboMult = this._comboCount >= 8 ? 2.5
                      : this._comboCount >= 5 ? 2.0
                      : 1.5;
      const badgeColor = this._comboCount >= 8 ? '#ff5500'
                       : this._comboCount >= 5 ? '#ff9900'
                       : '#ffcc00';
      ctx.save();
      ctx.textAlign = 'center';
      // Badge background pill
      const bW = 140, bH = 36, bX = W / 2, bY = H - 62;
      ctx.globalAlpha = 0.82;
      ctx.fillStyle   = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(bX - bW / 2, bY - bH / 2, bW, bH, 8);
      ctx.fill();
      // Combo text
      ctx.globalAlpha = 1;
      ctx.font        = `bold 18px monospace`;
      ctx.fillStyle   = badgeColor;
      ctx.shadowColor = badgeColor;
      ctx.shadowBlur  = 10 + this._comboCount * 0.8;
      ctx.fillText(`COMBO ×${this._comboCount}  ×${comboMult.toFixed(1)}`, bX, bY + 6);
      ctx.shadowBlur = 0;
      // Timer bar below badge
      const barW = bW - 16;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bX - barW / 2, bY + bH / 2 + 2, barW, 3);
      ctx.fillStyle   = badgeColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bX - barW / 2, bY + bH / 2 + 2, barW * timerFrac, 3);
      ctx.globalAlpha = 1;
      ctx.textAlign   = 'left';
      ctx.restore();
    }

    // ── Combo floating multiplier (mid-screen) ────────────────────────────────
    if (this._comboCount >= 5 && this._comboTimer > 0) {
      const timerFrac = Math.min(1, this._comboTimer / 2.5);
      const floatSize = 28 + Math.min(this._comboCount - 5, 10) * 2.5;
      const floatColor = this._comboCount >= 8 ? '#ff5500'
                       : this._comboCount >= 5 ? '#ff9900' : '#ffcc00';
      ctx.save();
      ctx.textAlign   = 'center';
      ctx.globalAlpha = timerFrac * 0.85;
      ctx.font        = `bold ${Math.round(floatSize)}px monospace`;
      ctx.fillStyle   = floatColor;
      ctx.shadowColor = floatColor;
      ctx.shadowBlur  = 18 + this._comboCount;
      ctx.fillText(`×${this._comboCount}`, W / 2, H * 0.33);
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── K/L ratio bar ─────────────────────────────────────────────────────────
    {
      const total = this.waveKills + this.waveLosses;
      if (total > 0) {
        const ratio  = this.waveKills / total;   // 0=all losses, 1=all kills
        const barW   = 120, barH = 4;
        const barX   = W / 2 - barW / 2;
        const barY   = H - 28;
        const color  = ratio >= 0.6 ? '#00ff88' : ratio >= 0.35 ? '#ffcc00' : '#ff4444';
        ctx.save();
        // Track background
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barX, barY, barW, barH);
        // Fill
        ctx.globalAlpha = 0.80;
        ctx.fillStyle   = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 6;
        ctx.fillRect(barX, barY, barW * ratio, barH);
        ctx.shadowBlur = 0;
        // Labels
        ctx.globalAlpha = 0.60;
        ctx.font        = '9px monospace';
        ctx.textAlign   = 'left';
        ctx.fillStyle   = '#00ff88';
        ctx.fillText(`K:${this.waveKills}`, barX, barY - 3);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff5555';
        ctx.fillText(`L:${this.waveLosses}`, barX + barW, barY - 3);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

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
      ctx.fillText('X = EMP', 18, empY + 12);
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

    // ── Sonar Warfare HUD ─────────────────────────────────────────────────────
    const sonarY = towerY + 30;
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(80,200,255,0.60)';
    ctx.fillText('SNR', 18, sonarY);
    for (let i = 0; i < this.SONAR_MAX; i++) {
      const filled = i < this._sonarCharges;
      ctx.fillStyle   = filled ? 'rgba(0,200,255,0.90)' : 'rgba(0,60,90,0.40)';
      ctx.shadowColor = filled ? '#00ccff' : 'transparent';
      ctx.shadowBlur  = filled ? 6 : 0;
      ctx.beginPath();
      ctx.arc(48 + i * 14, sonarY - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (this._sonarFullSweep > 0) {
      const pulse3 = 0.6 + 0.4 * Math.sin(Date.now() / 180);
      ctx.globalAlpha = pulse3;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#00ccff';
      ctx.fillText(`Q ${this._sonarFullSweep.toFixed(1)}s`, 18, sonarY + 12);
    } else if (this._sonarFocusPulse) {
      ctx.globalAlpha = 0.75;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#00ccff';
      ctx.fillText(`W ${this._sonarFocusPulse.ttl.toFixed(1)}s`, 18, sonarY + 12);
    } else if (this._sonarStealthDet > 0) {
      ctx.globalAlpha = 0.75;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#00ccff';
      ctx.fillText(`F ${this._sonarStealthDet.toFixed(1)}s`, 18, sonarY + 12);
    } else if (this._sonarCharges > 0) {
      ctx.globalAlpha = 0.38;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#88ddff';
      ctx.fillText('Q/W/F', 18, sonarY + 12);
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
    this._drawEnemyZones(ctx, W, H);

    // During scout intro: draw only the static world (no player/enemy swarms)
    if (this._scoutIntro) {
      for (const obj of this.objectives) obj.draw(ctx);
      if (this._enemyBase) this._enemyBase.draw(ctx);
      ctx.restore();
      // 3a. Radar
      this.radarSweep.draw(ctx, W / 2, H / 2, W, H);
      // 4a. Scout overlay (drone, trail, comms, title)
      this._scoutIntro.draw(ctx, W, H);
      return;
    }

    for (const h of this.hazards) h.draw(ctx);
    for (const t of this._empTraps) t.draw(ctx);
    for (const tw of this._towers) tw.draw(ctx);
    // Ghost preview for tower placement
    if (this._towerMode) {
      const ghost = new GatlingTower(this._mouseX, this._mouseY);
      ghost._angle = -Math.PI / 4;
      ghost.draw(ctx, true);
    }
    // Ghost preview for EMP placement (shows stun radius)
    if (this._empMode) {
      const EMP_RADIUS = 80;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#00eeff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.shadowColor = '#00eeff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this._mouseX, this._mouseY, EMP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#00eeff';
      ctx.fill();
      ctx.setLineDash([]);
      ctx.restore();
    }
    for (const obj of this.objectives) obj.draw(ctx);
    // HP % label + threat count on each objective
    for (const obj of this.objectives) {
      if (obj.health <= 0) continue;
      const pct = obj.health / obj.maxHealth;
      ctx.save();
      ctx.textAlign = 'center';
      // HP %
      const hpLabel = pct <= 0.30 ? 'CRITICAL' : `${Math.floor(pct * 100)}%`;
      ctx.font = `bold ${pct <= 0.30 ? 10 : 9}px monospace`;
      ctx.fillStyle = pct <= 0.30 ? 'rgba(255,60,60,0.95)' : 'rgba(255,200,80,0.80)';
      ctx.shadowColor = pct <= 0.30 ? '#ff2200' : '#ffaa00';
      ctx.shadowBlur = pct <= 0.30 ? 8 : 4;
      ctx.fillText(hpLabel, obj.x, obj.y + 26);
      // Threat count badge (only when enemies nearby)
      const tc = obj._threatCount ?? 0;
      if (tc > 0) {
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 220);
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = `rgba(255, 80, 0, ${pulse})`;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 8;
        ctx.fillText(`⚠ ×${tc}`, obj.x, obj.y - 44);
      }
      ctx.restore();
    }
    // Draw enemy base (above objectives, below swarms)
    if (this._enemyBase) this._enemyBase.draw(ctx);
    this.commander.drawTargetZone(ctx);
    this._drawLasers();
    this.playerSwarm.draw(ctx);
    this.enemySwarm.draw(ctx);
    if (this._sideMission && !this._sideMission.complete && !this._sideMission.failed) {
      this._sideMission.draw(ctx);
    }
    this.particles.draw(ctx);

    // Focus Pulse ring overlay (world-space)
    if (this._sonarFocusPulse) {
      const fp = this._sonarFocusPulse;
      const frac = fp.ttl / fp.maxTtl;
      ctx.save();
      ctx.strokeStyle = `rgba(0,200,255,${0.45 * frac})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur  = 12 * frac;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();

    // 3. Radar sweep overlay (fixed — not shaken)
    this.radarSweep.draw(ctx, W / 2, H / 2, W, H);

    // 3b. Smart targeting reticle
    this._drawTargetingReticle(ctx, W, H);

    // 3c. Commander danger ring (always visible when enemy commander alive)
    this._drawCommanderDangerRing(ctx);

    // 4. FX: vignette + hit flash + score popups + kill feed
    this._drawFX(W, H);

    // 4b. Mode tint: faint full-screen color when in placement mode
    if (this._empMode) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#00eeff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (this._towerMode) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#ffdd00';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // Sonar Full Sweep tint
    if (this._sonarFullSweep > 0) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#00ccff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 5. UI
    this.waveAnnouncer.draw(ctx, W, H);
    this._drawAlertBanner();
    this._drawClickHint();
    if (this._deploymentPhase > 0) this._drawDeploymentOverlay(ctx, W, H);
    if (this._waveCountdown > 0) this._drawWaveCountdown(ctx, W, H);
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

    // Spatial radar drawn on separate CSS-perspective canvas by CockpitHUD
    this.cockpitHUD.drawRadar(this);
    // Command Cubes menu handled by CockpitHUD DOM overlay (see _quickMenuOpen)
    // Orbital scan HUD indicator
    if (this._orbitalScan > 0)  this._drawOrbitalScanHUD(ctx, W, H);
    // Sonar active effect HUD indicators
    if (this._sonarFullSweep > 0)  this._drawSonarActiveHUD(ctx, W, H, 'sweep');
    if (this._sonarStealthDet > 0) this._drawSonarActiveHUD(ctx, W, H, 'stealth');
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

  _drawCommanderDangerRing(ctx) {
    const commanders = this.enemySwarm.drones.filter(d => !d.dead && d.role === 'commander');
    if (!commanders.length) return;

    const t = Date.now() / 1000;
    for (const cmd of commanders) {
      ctx.save();
      // Three expanding concentric rings with phase offset
      for (let i = 0; i < 3; i++) {
        const phase  = (t * 1.8 + i * 0.55) % 1;          // 0→1 loop
        const radius = 28 + phase * 52;                     // 28→80 px
        const alpha  = (1 - phase) * 0.55;
        ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,130,0,${alpha.toFixed(2)})`;
        ctx.lineWidth   = 2 - phase * 1.2;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur  = 14 * (1 - phase);
        ctx.stroke();
      }

      // Solid inner ring (locked-on indicator)
      const pulse = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.arc(cmd.x, cmd.y, 24, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,160,0,${(pulse * 0.9).toFixed(2)})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 12;
      ctx.stroke();

      // Label
      ctx.font        = 'bold 11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillStyle   = `rgba(255,180,0,${(0.5 + 0.5 * pulse).toFixed(2)})`;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 10;
      ctx.fillText('★ القائد', cmd.x, cmd.y - 30);
      ctx.restore();
    }
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

    // ── Progress bar at top of screen (8px tall, more visible) ────────
    const barColor = t < 4 ? '#ff6600' : '#00ff88';
    ctx.fillStyle = 'rgba(0,255,100,0.10)';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(0, 0, W * pct, 8);
    ctx.shadowBlur = 0;

    // ── Central countdown banner ────────────────────────────────────────
    const secs = Math.ceil(t);
    ctx.textAlign  = 'center';

    // Phase label above the timer
    ctx.font       = 'bold 13px monospace';
    ctx.fillStyle  = 'rgba(0,200,80,0.65)';
    ctx.fillText('— مرحلة الانتشار —', W / 2, H - 130);

    ctx.font       = 'bold 20px monospace';
    ctx.fillStyle  = t < 4 ? 'rgba(255,100,0,0.95)' : 'rgba(0,255,120,0.90)';
    ctx.shadowColor = t < 4 ? '#ff6600' : '#00ff88';
    ctx.shadowBlur  = 20;
    ctx.fillText(`📍 وزّع قواتك — ${secs}s`, W / 2, H - 108);

    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(0,200,80,0.50)';
    ctx.shadowBlur = 0;
    ctx.fillText('انقر لتحريك قواتك  ·  Tab=تبديل A/B  ·  S=تقسيم  ·  Space=ابدأ الآن', W / 2, H - 88);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  _drawWaveCountdown(ctx, W, H) {
    const t = this._waveCountdown;          // 3 → 0
    const num = Math.ceil(t);               // 3, 2, 1
    const scale = 1 + (t % 1) * 0.35;      // pulse: big at tick, shrinks to normal
    const alpha = Math.min(1, t * 0.8);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background dim
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Big pulsing digit
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.font = 'bold 120px monospace';
    ctx.fillStyle = `rgba(255, 80, 0, ${alpha})`;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 40;
    ctx.fillText(num, 0, 0);
    ctx.restore();

    // Label below
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = `rgba(255, 180, 0, ${alpha * 0.85})`;
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 12;
    ctx.fillText('⚔ العدو قادم — Space للإنطلاق الآن', W / 2, H / 2 + 80);

    // Wave composition preview — show when ≤ 2s remaining
    if (t <= 2.0) {
      const fadeIn  = Math.min(1, (2.0 - t) / 0.4);
      const count   = 8 + this.wave * 2;   // approximate count
      const isBoss  = this.wave % 5 === 0;
      const roles   = isBoss ? ['boss'] : waveComposition(this.wave, Math.min(count, 20));
      // Build summary map
      const summary = {};
      for (const r of roles) summary[r] = (summary[r] ?? 0) + 1;
      if (isBoss) summary['boss'] = 1;
      const roleLabels = {
        rusher: 'رشّاش', flanker: 'مُحاصِر', sniper: 'قنّاص',
        stealth: 'خفي', kamikaze: 'انتحاري', commander: 'قائد', boss: '⚡ زعيم',
      };
      const parts = Object.entries(summary)
        .map(([r, c]) => `×${c} ${roleLabels[r] ?? r}`)
        .join('   ');
      ctx.shadowBlur = 0;
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = `rgba(255, 120, 60, ${fadeIn * 0.90})`;
      ctx.fillText('INCOMING', W / 2, H / 2 + 108);
      ctx.font = '10px monospace';
      ctx.fillStyle = `rgba(255, 200, 100, ${fadeIn * 0.75})`;
      ctx.fillText(parts, W / 2, H / 2 + 124);
    }

    ctx.textBaseline = 'alphabetic';
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

  // ── Quick action menu overlay ─────────────────────────────────────────────

  _drawQuickMenu(ctx, W, H) {
    const items = [
      { key: '1', label: '+5 مسيرات عادية',  cost: 150 },
      { key: '2', label: '+3 مسيرات ثقيلة',  cost: 220 },
      { key: '3', label: '🛰 مسح مداري (4s)', cost: this.ORBITAL_SCAN_COST },
    ];
    const pW = 220, pH = 28, pad = 10, headerH = 28;
    const totalH = headerH + items.length * (pH + 4) + pad;
    const pX = W / 2 - pW / 2;
    const pY = H / 2 - totalH / 2;

    ctx.save();
    // Backdrop
    ctx.globalAlpha = 0.88;
    ctx.fillStyle   = 'rgba(0,12,26,0.92)';
    ctx.strokeStyle = 'rgba(0,200,255,0.45)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(pX - pad, pY - pad, pW + pad * 2, totalH + pad, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;
    // Header
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('⚡ قائمة سريعة  [R / Esc للإغلاق]', W / 2, pY + 16);

    // Items
    items.forEach((item, i) => {
      const iy   = pY + headerH + 4 + i * (pH + 4);
      const canAfford = this.score >= item.cost;

      ctx.globalAlpha = canAfford ? 1 : 0.4;
      ctx.fillStyle   = 'rgba(0,30,50,0.85)';
      ctx.strokeStyle = canAfford ? 'rgba(0,200,255,0.35)' : 'rgba(100,100,100,0.2)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(pX, iy, pW, pH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = canAfford ? '#e0f8ff' : '#556677';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`[${item.key}]  ${item.label}`, pX + 8, iy + 18);

      ctx.textAlign = 'right';
      ctx.fillStyle = canAfford ? '#ffcc44' : '#445566';
      ctx.fillText(`${item.cost}pt`, pX + pW - 8, iy + 18);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── Orbital scan HUD indicator ────────────────────────────────────────────

  _drawOrbitalScanHUD(ctx, W, H) {
    const frac  = Math.max(0, this._orbitalScan / this.ORBITAL_SCAN_DUR);
    const alpha = Math.min(1, this._orbitalScan * 2);  // fade in/out

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;

    // Progress arc at top-right corner
    const cx = W - 36, cy = 36, r = 18;
    ctx.strokeStyle = 'rgba(0,255,200,0.25)';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 10;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('🛰', cx, cy + 4);
    ctx.fillText(`${this._orbitalScan.toFixed(1)}s`, cx, cy + 16);

    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
    ctx.restore();
  }

  // ── Sonar active effect HUD (top-right, stacked below orbital scan) ──────

  _drawSonarActiveHUD(ctx, W, H, type) {
    const offset = type === 'stealth' ? 90 : 50;  // stack below orbital scan
    const cx = W - 36, cy = offset, r = 14;
    const ttl = type === 'sweep' ? this._sonarFullSweep : this._sonarStealthDet;
    const dur = type === 'sweep' ? 3 : 8;
    const frac = Math.max(0, ttl / dur);
    const alpha = Math.min(1, ttl * 2);
    const color = '#00ccff';

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;

    ctx.strokeStyle = 'rgba(0,200,255,0.20)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(type === 'sweep' ? '📡' : '👁', cx, cy + 4);
    ctx.fillText(`${ttl.toFixed(1)}s`, cx, cy + 15);

    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
    ctx.restore();
  }

  // ── Smart Targeting Reticle ───────────────────────────────────────────────

  _drawTargetingReticle(ctx, W, H) {
    // Only target radar-detected enemies (consistent with information asymmetry)
    const blips = this.radarSweep._blips;

    let nearest = null, minDist = 88;
    for (const e of this.enemySwarm.drones) {
      if (e.dead || !blips.has(e)) continue;
      const dx = e.x - this._mouseX, dy = e.y - this._mouseY;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    if (!nearest) return;

    const ex = nearest.x, ey = nearest.y;
    const isBoss = nearest.role === 'boss';
    const isCmd  = nearest.role === 'commander';
    const baseR  = isBoss ? 26 : isCmd ? 22 : 18;
    const t      = Date.now() / 1000;
    const r      = baseR * (1 + 0.05 * Math.sin(t * 4));
    const fadeA  = Math.min(1, (88 - minDist) / 35);

    const color  = isBoss ? '#ff4400' : isCmd ? '#ff8800' : '#00ff88';
    const bl     = 9;   // bracket arm length

    ctx.save();
    ctx.globalAlpha = fadeA;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;

    // Four L-bracket corners
    const brackets = [
      [ex - r, ey - r + bl, ex - r, ey - r, ex - r + bl, ey - r],   // TL
      [ex + r - bl, ey - r, ex + r, ey - r, ex + r, ey - r + bl],   // TR
      [ex - r, ey + r - bl, ex - r, ey + r, ex - r + bl, ey + r],   // BL
      [ex + r + bl, ey + r, ex + r, ey + r, ex + r, ey + r - bl],   // BR
    ];
    for (const [x1,y1,x2,y2,x3,y3] of brackets) {
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
      ctx.stroke();
    }

    // Scanning arc (rotates)
    ctx.strokeStyle = `${color}30`;
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.arc(ex, ey, r, -Math.PI / 2, -Math.PI / 2 + (t % (Math.PI * 2)));
    ctx.stroke();

    // Centre dot
    ctx.fillStyle  = color;
    ctx.shadowColor = color; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Data readout — flip side near right panel (262px)
    const onRight = ex + r + 95 < W - 270;
    const dataX   = onRight ? ex + r + 9 : ex - r - 9;
    const align   = onRight ? 'left' : 'right';
    const hp      = Math.floor((nearest.hp / (nearest.maxHp || 1)) * 100);
    const threat  = isBoss ? 'CRITICAL' : isCmd || nearest.role === 'sniper' ? 'HIGH' : 'MODERATE';

    ctx.font      = 'bold 8px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.globalAlpha = fadeA * 0.92;

    const lines = [
      `TARGET: ${nearest.role.toUpperCase()}`,
      `RANGE:  ${Math.round(minDist)}m`,
      `HP:     ${hp}%`,
      `THREAT: ${threat}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, dataX, ey - 18 + i * 12));

    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
    ctx.restore();
  }

  // ── Progressive objective positions ──────────────────────────────────────

  _updateObjectivePositions(wave) {
    const W = this.canvas.width, H = this.canvas.height;

    const TIERS = {
      1: [                            // Waves 1-3: compact triangle — easy start
        [W * 0.50, H * 0.33],
        [W * 0.36, H * 0.56],
        [W * 0.64, H * 0.56],
      ],
      2: [                            // Waves 4-9: medium spread — multi-front
        [W * 0.50, H * 0.22],
        [W * 0.24, H * 0.64],
        [W * 0.76, H * 0.64],
      ],
      3: [                            // Wave 10+: full map — hard
        [W * 0.50, H * 0.14],
        [W * 0.14, H * 0.72],
        [W * 0.86, H * 0.72],
      ],
    };

    const newTier = wave >= 10 ? 3 : wave >= 4 ? 2 : 1;
    const oldTier = this._objectiveTier ?? 0;

    const pos = TIERS[newTier];
    for (let i = 0; i < this.objectives.length; i++) {
      if (!pos[i]) continue;
      this.objectives[i].x = pos[i][0];
      this.objectives[i].y = pos[i][1];
    }

    if (newTier > oldTier) {
      this._objectiveTier = newTier;
      if (newTier === 2) this._showAlert('⚠ الجبهة تتوسع — الأهداف تباعدت!');
      if (newTier === 3) this._showAlert('🚨 جبهة واسعة! وزّع سربك على عدة جبهات!');
    }
  }

  // ── Enemy spawn-zone gradient markers ────────────────────────────────────

  _drawEnemyZones(ctx, W, H) {
    // Only show during active combat phases
    if (this._waveDelay > 0.8 || this._awaitingUpgrade) return;
    if (this._scoutIntro) return;

    const hasEnemies = this.enemySwarm.drones.length > 0;
    const pulse  = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    const baseA  = hasEnemies ? 0.09 + 0.04 * pulse : 0.04;

    ctx.save();

    // Top edge — primary enemy corridor
    const gradT = ctx.createLinearGradient(0, 0, 0, H * 0.22);
    gradT.addColorStop(0, `rgba(255,30,30,${baseA * 2.2})`);
    gradT.addColorStop(1, 'rgba(255,30,30,0)');
    ctx.fillStyle = gradT;
    ctx.fillRect(0, 0, W, H * 0.22);

    // Left edge — flanker corridor
    const gradL = ctx.createLinearGradient(0, 0, W * 0.14, 0);
    gradL.addColorStop(0, `rgba(255,70,20,${baseA * 1.6})`);
    gradL.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, W * 0.14, H);

    // Right edge — flanker corridor
    const gradR = ctx.createLinearGradient(W, 0, W * 0.86, 0);
    gradR.addColorStop(0, `rgba(255,70,20,${baseA * 1.6})`);
    gradR.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(W * 0.86, 0, W * 0.14, H);

    // Edge labels
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,80,80,${0.35 + 0.20 * pulse})`;
    ctx.fillText('▼ منطقة العدو', W / 2, 12);

    ctx.save();
    ctx.translate(9, H / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,100,60,${0.28 + 0.15 * pulse})`;
    ctx.fillText('◄ تهديد جانبي', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(W - 9, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,100,60,${0.28 + 0.15 * pulse})`;
    ctx.fillText('تهديد جانبي ►', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  // ── Mini-map (strategic overview) ────────────────────────────────────────

  _drawMiniMap(ctx, W, H) {
    if (this._scoutIntro || this._awaitingUpgrade) return;

    const mW = 140, mH = 100;
    const mX  = W - mW - 12;
    const mY  = H - mH - 12;
    const sx  = mW / W;
    const sy  = mH / H;
    const toM = (x, y) => ({ x: mX + x * sx, y: mY + y * sy });

    ctx.save();

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle   = 'rgba(0,8,18,0.82)';
    ctx.strokeStyle = 'rgba(0,180,80,0.30)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(mX - 2, mY - 16, mW + 4, mH + 18, 4);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.font      = 'bold 7px monospace';
    ctx.fillStyle = 'rgba(0,220,100,0.50)';
    ctx.textAlign = 'center';
    ctx.fillText('خريطة الجبهات', mX + mW / 2, mY - 4);

    // ── Enemy zone tint (top strip) ───────────────────────────────────────
    ctx.globalAlpha = 0.14;
    ctx.fillStyle   = '#ff4444';
    ctx.fillRect(mX, mY, mW, mH * 0.22);

    // ── Enemy base ────────────────────────────────────────────────────────
    if (this._enemyBase && !this._enemyBase.dead) {
      const mp  = toM(this._enemyBase.x, this._enemyBase.y);
      const col = this._enemyBase._shielded ? '#4488ff' : '#ff6600';
      ctx.globalAlpha = 1;
      ctx.fillStyle   = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 6;
      ctx.fillRect(mp.x - 3, mp.y - 3, 6, 6);
      ctx.shadowBlur  = 0;
    }

    // ── Objectives ────────────────────────────────────────────────────────
    ctx.globalAlpha = 1;
    for (const obj of this.objectives) {
      const mp  = toM(obj.x, obj.y);
      const hp  = obj.health / obj.maxHealth;
      const col = obj.health <= 0 ? '#ff3333'
                : hp > 0.50 ? '#00ff88' : '#ffaa00';
      ctx.fillStyle   = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 7;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.font        = '7px sans-serif';
      ctx.fillStyle   = col;
      ctx.textAlign   = 'left';
      ctx.fillText(obj._icon, mp.x + 5, mp.y + 3);
    }

    // ── Enemy drones (role icons) ─────────────────────────────────────────
    const _roleIcons = {
      rusher: '◆', flanker: '◀', sniper: '▲',
      stealth: '◾', kamikaze: '✕', commander: '★', boss: '⬡',
    };
    for (const e of this.enemySwarm.drones) {
      const mp    = toM(e.x, e.y);
      const isBig = e.role === 'boss' || e.role === 'commander';
      const col   = e._roleColor ?? '#ff4444';
      ctx.globalAlpha = isBig ? 0.95 : 0.72;
      // Dot base
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, isBig ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Role icon (only boss/commander/sniper — others too small)
      if (isBig || e.role === 'sniper' || e.role === 'kamikaze') {
        ctx.font      = `bold ${isBig ? 6 : 5}px monospace`;
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.fillText(_roleIcons[e.role] ?? '●', mp.x, mp.y - (isBig ? 4 : 3));
      }
    }
    ctx.globalAlpha = 1;

    // ── Player drones ─────────────────────────────────────────────────────
    ctx.fillStyle = '#00ccff';
    for (const d of this.playerSwarm.drones) {
      if (d.dead) continue;
      const mp = toM(d.x, d.y);
      ctx.globalAlpha = 0.80;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Radar sweep line (mini) ───────────────────────────────────────────
    const mc  = toM(W / 2, H / 2);
    const mR  = Math.sqrt(mW * mW + mH * mH);
    ctx.strokeStyle = 'rgba(0,255,100,0.35)';
    ctx.lineWidth   = 1;
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(mc.x, mc.y);
    ctx.lineTo(
      mc.x + Math.cos(this.radarSweep.angle) * mR,
      mc.y + Math.sin(this.radarSweep.angle) * mR
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Clip border ───────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,180,80,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.rect(mX, mY, mW, mH);
    ctx.stroke();

    ctx.restore();
  }
}

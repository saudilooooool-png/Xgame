/**
 * ThreeScene — replaces the flat 2D canvas with a live Three.js 3-D world.
 *
 * Architecture
 *  • Opaque WebGL canvas at z-index 10 — sits between the hidden 2-D game
 *    canvas (pure logic) and the DOM cockpit panels (z-index 200 / 300).
 *  • All game logic (physics, collision, AI) still runs on the 2-D canvas.
 *    ThreeScene reads entity positions each frame and drives 3-D meshes.
 *  • Camera: angled perspective (~40° from horizontal) — helicopter cockpit.
 *    2-D coordinates map directly: canvas.x → world.x, canvas.y → world.z
 *
 * Coordinate mapping
 *  drone.x   → mesh.position.x
 *  drone.y   → mesh.position.z   (top of screen = far, bottom = near)
 *  altitude  → mesh.position.y
 */
import * as THREE from 'three';

export class ThreeScene {

  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game    = game;
    this._meshes = new Map();      // entity → THREE.Group
    this._W      = window.innerWidth;
    this._H      = window.innerHeight;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._buildGround();
    this._initMouseParallax();
    window.addEventListener('resize', () => this._resize());
    this._raf();
  }

  // ── Renderer ───────────────────────────────────────────────────────────────

  _initRenderer() {
    const W = this._W, H = this._H;

    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this._renderer.setSize(W, H);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 2.2;

    const cv = this._renderer.domElement;
    cv.id = 'three-game';
    cv.style.cssText = 'position:fixed;inset:0;z-index:10;';

    const container  = document.getElementById('game-container');
    const gameCanvas = container.querySelector('canvas');
    // Place WebGL canvas below the 2-D canvas (z-index 10).
    // The 2-D canvas becomes a transparent overlay (z-index 15, pointer-events none)
    // so lasers, particles, score popups, combo text etc. stay visible.
    if (gameCanvas) {
      gameCanvas.style.cssText = 'position:fixed;inset:0;z-index:15;pointer-events:none;';
      container.insertBefore(cv, gameCanvas);   // WebGL sits behind the 2-D canvas
    } else {
      container.prepend(cv);
    }
  }

  // ── Scene & Camera ─────────────────────────────────────────────────────────

  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x0c1f14);
    // Lighter fog so far objects remain visible
    this._scene.fog = new THREE.FogExp2(0x0c1f14, 0.00015);
  }

  _initCamera() {
    const W = this._W, H = this._H;
    this._camera = new THREE.PerspectiveCamera(52, W / H, 4, 6000);

    // Angled view: lower elevation ~25-30° so objects look truly 3D, not flat ovals
    this._camera.position.set(W / 2, H * 0.45, H * 1.1);
    this._camera.lookAt(W / 2, 0, H * 0.05);

    // Parallax base position
    this._camBase = this._camera.position.clone();
    this._camLook = new THREE.Vector3(W / 2, 0, H * 0.05);

    this._driftX = 0; this._driftY = 0;
    this._tgtX   = 0; this._tgtY   = 0;
  }

  // ── Lighting ───────────────────────────────────────────────────────────────

  _initLights() {
    const W = this._W, H = this._H;

    // ── Ambient (military green — clearly visible base illumination) ─────
    this._scene.add(new THREE.AmbientLight(0x2a5c30, 3.5));

    // ── Moonlight / directional (bright cool light, hard shadows) ────────
    const moon = new THREE.DirectionalLight(0xb8ddd0, 3.8);
    moon.position.set(W * 0.25, 1600, -H * 0.4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near   = 1;
    moon.shadow.camera.far    = 4000;
    moon.shadow.camera.left   = -W;
    moon.shadow.camera.right  = W;
    moon.shadow.camera.top    = H;
    moon.shadow.camera.bottom = -H;
    this._scene.add(moon);

    // ── Secondary fill from opposite side (no hard shadows) ──────────────
    const fill = new THREE.DirectionalLight(0x3a7a50, 1.8);
    fill.position.set(-W * 0.4, 800, H * 0.6);
    this._scene.add(fill);

    // ── Hemisphere (sky dim blue-grey, ground warm green) ────────────────
    this._scene.add(new THREE.HemisphereLight(0x223344, 0x3d6b2f, 2.4));

    // ── Green instrument-glow fill (cockpit screen reflection) ───────────
    const instrFill = new THREE.PointLight(0x00e87a, 1.2, H * 2.4);
    instrFill.position.set(W / 2, 60, H * 0.95);
    this._scene.add(instrFill);
  }

  // ── Ground & Environment ───────────────────────────────────────────────────

  _buildGround() {
    const W = this._W, H = this._H;

    // ── Ground plane — visible military terrain green ─────────────────────
    const groundGeo = new THREE.PlaneGeometry(W * 2, H * 2, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2e5422, roughness: 0.90, metalness: 0.04
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(W / 2, -1, H / 2);
    ground.receiveShadow = true;
    this._scene.add(ground);

    // ── Tactical grid (major cells — clearly visible green lines) ─────────
    const gridSize = Math.max(W, H) * 1.7;
    const gridMain = new THREE.GridHelper(gridSize, 70, 0x3a9960, 0x1d6638);
    gridMain.position.set(W / 2, 0.5, H / 2);
    this._scene.add(gridMain);
    // Store ref for power-dim effect
    this._gridMainMat = gridMain.material[0] ?? gridMain.material;

    // ── Fine grid (minor cells — subtle hint) ────────────────────────────
    const gridFine = new THREE.GridHelper(gridSize, 280, 0x0d3318, 0x081d0c);
    gridFine.position.set(W / 2, 0.3, H / 2);
    this._scene.add(gridFine);

    // ── Sector intersection rings — visible tactical markers ──────────────
    const ringGeo = new THREE.RingGeometry(60, 66, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1a7a3a, side: THREE.DoubleSide });
    const xhMat   = new THREE.LineBasicMaterial({ color: 0x1a6632 });

    for (let xi = 0; xi <= 4; xi++) {
      for (let zi = 0; zi <= 3; zi++) {
        const px = (xi / 4) * W, pz = (zi / 3) * H;
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(px, 1, pz);
        this._scene.add(ring);

        // Cross-hair lines
        const h = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-55, 1, 0), new THREE.Vector3(55, 1, 0)
          ]), xhMat);
        h.position.set(px, 1, pz);
        this._scene.add(h);

        const v = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1, -55), new THREE.Vector3(0, 1, 55)
          ]), xhMat);
        v.position.set(px, 1, pz);
        this._scene.add(v);
      }
    }

    // ── Background city (dark decorative buildings) ──────────────────────
    this._buildCityscape();

    // ── Atmospheric smoke/debris particles ──────────────────────────────
    this._buildAtmosphericParticles();
  }

  _buildCityscape() {
    const W = this._W, H = this._H;
    const rng = (a, b) => a + Math.random() * (b - a);

    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a1c, roughness: 0.88, metalness: 0.18
    });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x003a18,
      emissive: new THREE.Color(0x00cc55),
      emissiveIntensity: 1.4,
      transparent: true, opacity: 0.85
    });

    for (let i = 0; i < 60; i++) {
      const bw = rng(28, 90), bd = rng(28, 90), bh = rng(18, 160);
      const bx = rng(40, W - 40), bz = rng(40, H - 40);

      // Keep open space near objective centres (set later via game.objectives)
      // For now skip the centre region
      if (bx > W * 0.32 && bx < W * 0.68 && bz > H * 0.28 && bz < H * 0.72) continue;

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), blockMat);
      mesh.position.set(bx, bh / 2, bz);
      mesh.castShadow  = true;
      mesh.receiveShadow = true;
      this._scene.add(mesh);

      // Random lit windows on front face
      if (bh > 45 && Math.random() > 0.45) {
        const wm = new THREE.Mesh(
          new THREE.PlaneGeometry(bw * 0.55, bh * 0.45),
          winMat
        );
        wm.position.set(bx, bh * 0.55, bz + bd / 2 + 0.6);
        this._scene.add(wm);
      }
    }
  }

  _buildAtmosphericParticles() {
    const W = this._W, H = this._H;
    const COUNT = 35;
    const positions = new Float32Array(COUNT * 3);
    const velocities = [];

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3    ] = Math.random() * W;
      positions[i * 3 + 1] = Math.random() * 120;
      positions[i * 3 + 2] = Math.random() * H;
      velocities.push({
        x: (Math.random() - 0.5) * 0.18,
        y: 0.08 + Math.random() * 0.14,
        z: (Math.random() - 0.5) * 0.18,
        maxY: 130 + Math.random() * 80
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x445533,
      size: 4.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    this._scene.add(points);

    // Store refs for animation
    this._atmosParticles   = points;
    this._atmosPositions   = positions;
    this._atmosVelocities  = velocities;
    this._atmosW = W;
    this._atmosH = H;
  }

  _animateAtmosphericParticles() {
    if (!this._atmosParticles) return;
    const pos = this._atmosPositions;
    const vel = this._atmosVelocities;
    const W   = this._atmosW;
    const H   = this._atmosH;

    for (let i = 0; i < vel.length; i++) {
      pos[i * 3    ] += vel[i].x;
      pos[i * 3 + 1] += vel[i].y;
      pos[i * 3 + 2] += vel[i].z;

      // Wrap: reset when above maxY, drifted out of bounds
      if (pos[i * 3 + 1] > vel[i].maxY) {
        pos[i * 3    ] = Math.random() * W;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = Math.random() * H;
      }
      if (pos[i * 3] < 0)  pos[i * 3] += W;
      if (pos[i * 3] > W)  pos[i * 3] -= W;
      if (pos[i * 3 + 2] < 0) pos[i * 3 + 2] += H;
      if (pos[i * 3 + 2] > H) pos[i * 3 + 2] -= H;
    }

    this._atmosParticles.geometry.attributes.position.needsUpdate = true;
  }

  // ── Entity mesh factories ──────────────────────────────────────────────────

  _makePlayerDrone() {
    const g = new THREE.Group();

    // Hexagonal flat body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 10, 3.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a4a28, metalness: 0.88, roughness: 0.22 })
    );
    g.add(body);

    // Glow ring (marks as friendly)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11, 1.4, 6, 22),
      new THREE.MeshStandardMaterial({
        color: 0x00e87a, emissive: 0x00e87a, emissiveIntensity: 2.0
      })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    // Forward nose indicator
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0x00ff99, emissive: 0x00ff99, emissiveIntensity: 1.2 })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -13;
    g.add(nose);

    // Per-drone green point light
    const light = new THREE.PointLight(0x00e87a, 1.8, 90);
    light.position.y = 6;
    g.add(light);

    return g;
  }

  _makeEnemyDrone(role) {
    const g = new THREE.Group();

    const boss    = role === 'boss' || role === 'commander';
    const kamikaze = role === 'kamikaze';
    const s       = boss ? 2.4 : kamikaze ? 0.65 : 1.0;
    const bodyCol = boss ? 0x4a0800 : 0x3a0a0a;
    const glowCol = boss ? 0xff6600 : kamikaze ? 0xff00aa : 0xff2200;

    // Angular octahedron body
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(10 * s),
      new THREE.MeshStandardMaterial({ color: bodyCol, metalness: 0.55, roughness: 0.55, emissive: glowCol, emissiveIntensity: 0.3 })
    );
    g.add(body);

    // Transparent glow shell
    const shell = new THREE.Mesh(
      new THREE.OctahedronGeometry(13.5 * s),
      new THREE.MeshStandardMaterial({
        color: glowCol, emissive: glowCol, emissiveIntensity: 0.7,
        transparent: true, opacity: 0.22, depthWrite: false
      })
    );
    g.add(shell);

    // Red/orange point light
    const light = new THREE.PointLight(glowCol, boss ? 4.0 : 2.0, boss ? 200 : 100);
    g.add(light);

    // Store shell ref for spin animation
    g._shell = shell;

    return g;
  }

  // ── Objective tower models (one per resource type) ───────────────────────

  _makeObjectiveTower(obj) {
    const type = obj.resourceType ?? 'power';
    if (type === 'water') return this._makeWaterTower(obj);
    if (type === 'food')  return this._makeFoodTower(obj);
    return this._makePowerTower(obj);
  }

  /** Shared top-beacon + health ring added to every tower group */
  _attachBeacon(g, hex, topY) {
    const healthRing = new THREE.Mesh(
      new THREE.TorusGeometry(44, 4.5, 8, 44),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 3.0 })
    );
    healthRing.rotation.x = Math.PI / 2;
    healthRing.position.y = topY;
    g.add(healthRing);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 12, 8),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 4.5 })
    );
    beacon.position.y = topY + 16;
    g.add(beacon);

    const beaconLight = new THREE.PointLight(hex, 3.5, 280);
    beaconLight.position.y = topY + 16;
    g.add(beaconLight);

    const pulseRingA = new THREE.Mesh(
      new THREE.TorusGeometry(34, 1.2, 6, 36),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.6 })
    );
    pulseRingA.rotation.x = Math.PI / 2;
    pulseRingA.position.y = topY;
    g.add(pulseRingA);

    const pulseRingB = pulseRingA.clone();
    pulseRingB.rotation.z = Math.PI * 0.33;
    g.add(pulseRingB);

    g._healthRing  = healthRing;
    g._beacon      = beacon;
    g._beaconLight = beaconLight;
    g._pulseA      = pulseRingA;
    g._pulseB      = pulseRingB;
  }

  /** ⚡ Power — tall transmission tower with cross-arms */
  _makePowerTower(obj) {
    const g   = new THREE.Group();
    const hex = 0xffcc00;   // gold

    // Base pad
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(52, 58, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2a10, metalness: 0.7, roughness: 0.5 })
    );
    base.position.y = 4.5;
    g.add(base);

    // Central mast — tall and thin
    const tH = 180;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 12, tH, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a4a22, metalness: 0.88, roughness: 0.25,
        emissive: 0x222200, emissiveIntensity: 0.4 })
    );
    mast.position.y = tH / 2 + 9;
    mast.castShadow = true;
    g.add(mast);

    // Cross-arms at two heights
    for (const [yOff, width] of [[tH * 0.45, 90], [tH * 0.72, 60], [tH * 0.92, 36]]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(width, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a3a18, metalness: 0.8, roughness: 0.3 })
      );
      arm.position.y = yOff + 9;
      g.add(arm);

      // Insulator glows at each end
      for (const sign of [-1, 1]) {
        const ins = new THREE.Mesh(
          new THREE.SphereGeometry(4, 6, 4),
          new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.0 })
        );
        ins.position.set(sign * (width / 2 - 4), yOff + 9, 0);
        g.add(ins);
      }
    }

    // Electric spark light (flickers in animation)
    const spark = new THREE.PointLight(hex, 2.5, 180);
    spark.position.y = tH * 0.7 + 9;
    g.add(spark);
    g._sparkLight = spark;
    g._tH = tH;

    this._attachBeacon(g, hex, tH + 9);
    return g;
  }

  /** 💧 Water — squat cylindrical tank on support legs */
  _makeWaterTower(obj) {
    const g   = new THREE.Group();
    const hex = 0x00aaff;   // cyan-blue

    // Base pad
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(52, 58, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x102232, metalness: 0.6, roughness: 0.55 })
    );
    base.position.y = 4.5;
    g.add(base);

    // Four support legs
    for (const [sx, sz] of [[-28,0],[28,0],[0,-28],[0,28]]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 7, 80, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a3040, metalness: 0.75, roughness: 0.4 })
      );
      leg.position.set(sx, 49, sz);
      leg.castShadow = true;
      g.add(leg);
    }

    // Cross-brace ring
    const braceRing = new THREE.Mesh(
      new THREE.TorusGeometry(30, 4, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a3040, metalness: 0.7, roughness: 0.45 })
    );
    braceRing.rotation.x = Math.PI / 2;
    braceRing.position.y = 40;
    g.add(braceRing);

    // Main tank (large sphere-capped cylinder)
    const tH = 100;
    const tankBody = new THREE.Mesh(
      new THREE.CylinderGeometry(48, 48, 55, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a2840, metalness: 0.55, roughness: 0.35,
        emissive: 0x001830, emissiveIntensity: 0.5 })
    );
    tankBody.position.y = tH + 9;
    tankBody.castShadow = true;
    g.add(tankBody);

    // Dome cap on tank
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(48, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0d3050, metalness: 0.6, roughness: 0.3,
        emissive: 0x002244, emissiveIntensity: 0.4 })
    );
    dome.position.y = tH + 36;
    g.add(dome);

    // Water ripple ring at base
    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(55, 2, 6, 32),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.5 })
    );
    ripple.rotation.x = Math.PI / 2;
    ripple.position.y = 2;
    g.add(ripple);
    g._rippleRing = ripple;
    g._tH = tH + 50;

    this._attachBeacon(g, hex, tH + 60);
    return g;
  }

  /** 🌾 Food — low dome greenhouse with farm panels */
  _makeFoodTower(obj) {
    const g   = new THREE.Group();
    const hex = 0x66ff33;   // bright green

    // Wide base platform
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 76, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a3010, metalness: 0.4, roughness: 0.7 })
    );
    base.position.y = 5;
    base.receiveShadow = true;
    g.add(base);

    // Farm panels (6 rectangular plots around center)
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a4a08, roughness: 0.85, metalness: 0.08,
      emissive: 0x0a2204, emissiveIntensity: 0.3
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 18), panelMat);
      panel.position.set(Math.cos(a) * 44, 11, Math.sin(a) * 44);
      panel.rotation.y = a;
      g.add(panel);
    }

    // Central control dome
    const tH = 70;
    const domeBody = new THREE.Mesh(
      new THREE.SphereGeometry(36, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0d2808, metalness: 0.45, roughness: 0.5,
        emissive: 0x062004, emissiveIntensity: 0.3 })
    );
    domeBody.position.y = tH / 2 + 10;
    domeBody.castShadow = true;
    g.add(domeBody);

    // Dome frame rings
    for (const yOff of [0, 18, 32]) {
      const frameRing = new THREE.Mesh(
        new THREE.TorusGeometry(35 - yOff * 0.5, 2, 6, 24),
        new THREE.MeshStandardMaterial({ color: 0x1a4010, metalness: 0.6, roughness: 0.4 })
      );
      frameRing.rotation.x = Math.PI / 2;
      frameRing.position.y = tH / 2 + 10 + yOff;
      g.add(frameRing);
    }

    // Growth light (warm green glow from dome)
    const growLight = new THREE.PointLight(hex, 1.8, 200);
    growLight.position.y = tH / 2 + 40;
    g.add(growLight);
    g._tH = tH + 10;

    this._attachBeacon(g, hex, tH + 20);
    return g;
  }

  // ── Sync game state ────────────────────────────────────────────────────────

  _sync() {
    const g = this.game;
    if (!g) return;

    // Build objective towers on first sync (or after restart clears them)
    if (g.objectives) this._syncObjectives(g.objectives);

    // Player drones
    if (g.playerSwarm?.drones) this._syncDrones(g.playerSwarm.drones, 'player', 22);

    // Enemy drones
    if (g.enemySwarm?.drones) this._syncDrones(g.enemySwarm.drones, 'enemy', 15);

    // Animate objective rings
    this._animateObjectives(g);
  }

  _syncObjectives(objectives) {
    objectives.forEach(obj => {
      if (this._meshes.has(obj)) return;  // already built
      const group = this._makeObjectiveTower(obj);
      group.position.set(obj.x, 0, obj.y);
      this._scene.add(group);
      this._meshes.set(obj, group);
    });
  }

  _syncDrones(drones, type, altitude) {
    for (const drone of drones) {
      if (drone.dead) {
        const m = this._meshes.get(drone);
        if (m) { this._scene.remove(m); this._meshes.delete(drone); }
        continue;
      }

      let mesh = this._meshes.get(drone);
      if (!mesh) {
        mesh = type === 'player'
          ? this._makePlayerDrone()
          : this._makeEnemyDrone(drone.role);
        this._scene.add(mesh);
        this._meshes.set(drone, mesh);
      }

      mesh.position.set(drone.x, altitude, drone.y);

      // Heading from velocity
      if (drone.vx != null && drone.vy != null && (drone.vx || drone.vy)) {
        mesh.rotation.y = Math.atan2(drone.vx, drone.vy);
      }

      // Enemy drones spin
      if (type === 'enemy') {
        mesh.rotation.x += 0.022;
        mesh.rotation.z += 0.016;
        if (mesh._shell) mesh._shell.rotation.y += 0.03;
      }
    }
  }

  _animateObjectives(g) {
    const t = Date.now() * 0.001;

    // ── Grid dim on low Power ─────────────────────────────────────────────────
    if (g.cityResources && this._gridMainMat) {
      const power = g.cityResources.power ?? 100;
      const bright = power > 50 ? 1.0 : 0.25 + (power / 50) * 0.75;
      const r = Math.round(0x3a * bright), gr = Math.round(0x99 * bright), b = Math.round(0x60 * bright);
      this._gridMainMat.color.setRGB(r / 255, gr / 255, b / 255);
    }

    // ── Drone glow tint on low Food ───────────────────────────────────────────
    if (g.cityResources) {
      const food = g.cityResources.food ?? 100;
      const hunger = food < 40 ? (1 - food / 40) : 0;  // 0=full, 1=starving
      if (g.playerSwarm?.drones) {
        for (const drone of g.playerSwarm.drones) {
          const mesh = this._meshes.get(drone);
          if (!mesh) continue;
          // Tint the ring mesh red when hungry
          mesh.traverse(child => {
            if (child.isMesh && child.material?.emissive) {
              const base = new THREE.Color(0x00e87a);
              const red  = new THREE.Color(0xff3300);
              child.material.emissive.copy(base).lerp(red, hunger * 0.6);
            }
          });
        }
      }
    }

    g.objectives?.forEach(obj => {
      const group = this._meshes.get(obj);
      if (!group) return;

      // Health colour: green → amber → red
      const pct = obj.health <= 0 ? 0 : obj.health / obj.maxHealth;
      const hex  = pct > 0.6 ? 0x00e87a : pct > 0.3 ? 0xffaa00 : 0xff3333;
      const col  = new THREE.Color(hex);

      group._healthRing.material.color.set(col);
      group._healthRing.material.emissive.set(col);
      group._beacon.material.color.set(col);
      group._beacon.material.emissive.set(col);
      group._beaconLight.color.set(col);

      // Pulse accent rings
      const urgency = pct < 0.3 ? 4.0 : 1.8;
      const pulse = 0.5 + 0.5 * Math.sin(t * urgency);
      if (group._pulseA) {
        group._pulseA.material.opacity = pulse * 0.7;
        group._pulseA.rotation.y += 0.008;
        group._pulseB.rotation.y -= 0.010;
      }

      // Beacon throb (faster when critical)
      if (group._beacon) {
        const sc = 0.85 + 0.3 * Math.sin(t * (pct < 0.3 ? 5 : 2));
        group._beacon.scale.setScalar(sc);
        group._beaconLight.intensity = 2.5 + 2.0 * Math.sin(t * (pct < 0.3 ? 5 : 2));
      }

      // Power tower: flicker spark light
      if (group._sparkLight) {
        group._sparkLight.intensity = 1.5 + 1.5 * Math.sin(t * 12.3 + obj.x) * Math.sin(t * 7.7);
      }

      // Water tower: ripple ring rotation
      if (group._rippleRing) {
        group._rippleRing.rotation.z += 0.012;
        group._rippleRing.material.opacity = 0.3 + 0.2 * Math.sin(t * 2.5);
      }
    });
  }

  // ── Mouse parallax ─────────────────────────────────────────────────────────

  _initMouseParallax() {
    window.addEventListener('mousemove', e => {
      this._tgtX = (e.clientX / innerWidth  - 0.5) *  55;
      this._tgtY = (e.clientY / innerHeight - 0.5) * -28;
    });
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  _raf() {
    requestAnimationFrame(() => this._raf());

    // Smooth camera drift
    const lp = 0.038;
    this._driftX += (this._tgtX - this._driftX) * lp;
    this._driftY += (this._tgtY - this._driftY) * lp;
    this._camera.position.x = this._camBase.x + this._driftX;
    this._camera.position.y = this._camBase.y + this._driftY;

    this._animateAtmosphericParticles();
    this._sync();
    this._renderer.render(this._scene, this._camera);
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  _resize() {
    const W = innerWidth, H = innerHeight;
    this._W = W; this._H = H;
    this._camera.aspect = W / H;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(W, H);
  }
}

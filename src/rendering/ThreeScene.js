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
    // Hide the original 2-D canvas — logic keeps running, visuals move to WebGL
    if (gameCanvas) {
      gameCanvas.style.visibility = 'hidden';
      container.insertBefore(cv, gameCanvas.nextSibling);
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

  _makeObjectiveTower(obj) {
    const g = new THREE.Group();
    const hex = obj._color ? parseInt(obj._color.replace('#', ''), 16) : 0x00e87a;

    // Octagonal base platform
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(52, 58, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x1c3824, metalness: 0.65, roughness: 0.5 })
    );
    base.position.y = 4.5;
    base.receiveShadow = true;
    g.add(base);

    // Tower column — tall enough to be clearly visible from the new camera angle
    const tH = 160;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(24, 30, tH, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a3020, metalness: 0.78, roughness: 0.38 })
    );
    tower.position.y = tH / 2 + 9;
    tower.castShadow  = true;
    tower.receiveShadow = true;
    g.add(tower);

    // Health ring (changes colour with HP%)
    const healthRing = new THREE.Mesh(
      new THREE.TorusGeometry(44, 4.5, 8, 44),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 3.0 })
    );
    healthRing.rotation.x = Math.PI / 2;
    healthRing.position.y = tH + 12;
    g.add(healthRing);

    // Top beacon sphere
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 12, 8),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 4.5 })
    );
    beacon.position.y = tH + 28;
    g.add(beacon);

    // Beacon light
    const beaconLight = new THREE.PointLight(hex, 3.5, 260);
    beaconLight.position.y = tH + 28;
    g.add(beaconLight);

    // Two counter-rotating accent rings (pulse = living objective)
    const pulseRingA = new THREE.Mesh(
      new THREE.TorusGeometry(34, 1.2, 6, 36),
      new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.6 })
    );
    pulseRingA.rotation.x = Math.PI / 2;
    pulseRingA.position.y = tH + 12;
    g.add(pulseRingA);

    const pulseRingB = pulseRingA.clone();
    pulseRingB.rotation.z = Math.PI * 0.33;
    g.add(pulseRingB);

    // Tag internal refs for updates
    g._healthRing  = healthRing;
    g._beacon      = beacon;
    g._beaconLight = beaconLight;
    g._pulseA      = pulseRingA;
    g._pulseB      = pulseRingB;
    g._tH          = tH;

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
    g.objectives?.forEach(obj => {
      const group = this._meshes.get(obj);
      if (!group) return;

      // Update health colour
      const pct = obj.health / obj.maxHealth;
      const hex  = pct > 0.6 ? 0x00e87a : pct > 0.3 ? 0xffaa00 : 0xff3333;
      const col  = new THREE.Color(hex);

      group._healthRing.material.color.set(col);
      group._healthRing.material.emissive.set(col);
      group._beacon.material.color.set(col);
      group._beacon.material.emissive.set(col);
      group._beaconLight.color.set(col);

      // Pulse accent rings
      const pulse = 0.5 + 0.5 * Math.sin(t * (pct < 0.3 ? 4.0 : 1.8));
      if (group._pulseA) {
        group._pulseA.material.opacity = pulse * 0.7;
        group._pulseA.rotation.y += 0.008;
        group._pulseB.rotation.y -= 0.010;
      }

      // Beacon throb
      if (group._beacon) {
        const sc = 0.85 + 0.3 * Math.sin(t * (pct < 0.3 ? 5 : 2));
        group._beacon.scale.setScalar(sc);
        group._beaconLight.intensity = 2.5 + 2.0 * Math.sin(t * (pct < 0.3 ? 5 : 2));
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

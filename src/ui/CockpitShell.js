/**
 * CockpitShell — Three.js 3D cockpit frame overlaid on the 2D game canvas.
 *
 * Architecture:
 *  • Separate WebGL canvas (alpha:true) floats above the game at z-index 300
 *  • The centre of the Three.js scene is empty → the 2D game shows through
 *  • Cockpit frame geometry (dashboard, pillars, top bar) surrounds the view
 *  • Mouse parallax: camera drifts ±0.10 / ±0.06 with smooth lerp
 *  • Green emissive accent strips + instrument knobs for realism
 */
import * as THREE from 'three';

export class CockpitShell {

  constructor() {
    const W = window.innerWidth, H = window.innerHeight;

    // ── Renderer (transparent background — game canvas shows through) ──────
    this._renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this._renderer.setSize(W, H);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setClearColor(0x000000, 0);      // fully transparent clear

    const cv = this._renderer.domElement;
    cv.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:300;';
    document.getElementById('game-container').appendChild(cv);

    // ── Scene + Camera ────────────────────────────────────────────────────
    this._scene  = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 50);
    this._camera.position.set(0, 0.2, 4);

    // Mouse-parallax state
    this._tx = 0; this._ty = 0;
    this._cx = 0; this._cy = 0;

    this._addLights();
    this._buildFrame();
    this._initMouse();
    this._raf();
    window.addEventListener('resize', () => this._resize());
  }

  // ── Lighting ──────────────────────────────────────────────────────────────

  _addLights() {
    // Soft dark-green ambient
    this._scene.add(new THREE.AmbientLight(0x001408, 5));

    // Green instrument glow rising from dashboard
    const instrGlow = new THREE.PointLight(0x00e87a, 4.0, 8);
    instrGlow.position.set(0, -1.0, 3.6);
    this._scene.add(instrGlow);

    // Cold directional fill from above-back
    const fill = new THREE.DirectionalLight(0x002a14, 1.0);
    fill.position.set(0, 6, 3);
    this._scene.add(fill);

    // Left/right side bounce lights
    const sL = new THREE.PointLight(0x00aa55, 1.2, 6);
    sL.position.set(-3.2, 0.5, 2.5);
    this._scene.add(sL);

    const sR = sL.clone();
    sR.position.x = 3.2;
    this._scene.add(sR);
  }

  // ── Cockpit geometry ──────────────────────────────────────────────────────

  _buildFrame() {
    // ── Materials ──────────────────────────────────────────────────────────
    const metal = new THREE.MeshStandardMaterial({
      color: 0x0b1a0f, metalness: 0.90, roughness: 0.24
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x0e2218, metalness: 0.80, roughness: 0.38,
      emissive: 0x002a14, emissiveIntensity: 0.55
    });
    const glow = new THREE.MeshStandardMaterial({
      color: 0x00e87a, emissive: 0x00e87a,
      emissiveIntensity: 1.8, roughness: 1.0, metalness: 0.0
    });
    const glowRed = new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff3300,
      emissiveIntensity: 1.4, roughness: 1.0, metalness: 0.0
    });

    // ── 1. Bottom Dashboard ───────────────────────────────────────────────
    // Camera at z=4, dashboard at z=1.7 (distance=2.3)
    // Visible half-height at z=1.7 = tan(27.5°)*2.3 ≈ 1.20 → full height 2.40
    // Place dashboard top edge at ~75% down: y = -1.20*0.5 = -0.60
    // Dashboard height=2.0 → center at y = -0.60 - 1.0 = -1.60, but push lower
    this._dash = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 1.6), metal);
    this._dash.position.set(0, -2.20, 1.7);
    this._dash.rotation.x = -0.16;
    this._scene.add(this._dash);

    // Green accent strip — top leading edge of dashboard
    const dashStrip = new THREE.Mesh(new THREE.BoxGeometry(11, 0.055, 0.055), glow);
    dashStrip.position.set(0, -1.12, 2.52);
    this._scene.add(dashStrip);

    // Instrument panel raised surface (darker slab on dashboard)
    const instrPanel = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.80, 0.24), accent);
    instrPanel.position.set(0, -1.52, 2.28);
    this._scene.add(instrPanel);

    // Instrument knobs
    const knobGeo = new THREE.CylinderGeometry(0.058, 0.078, 0.16, 10);
    [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4].forEach(x => {
      const k = new THREE.Mesh(knobGeo, accent);
      k.position.set(x, -1.30, 2.38);
      this._scene.add(k);
    });

    // Indicator light row (3 green, 1 red)
    const indGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.06, 8);
    [[-0.6, glow], [0, glow], [0.6, glow], [1.1, glowRed]].forEach(([x, mat]) => {
      const ind = new THREE.Mesh(indGeo, mat);
      ind.position.set(x, -1.18, 2.44);
      this._scene.add(ind);
    });

    // Dashboard side details (end caps)
    [-4.0, 4.0].forEach(x => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 1.0), accent);
      cap.position.set(x, -1.8, 1.9);
      cap.rotation.x = -0.1;
      this._scene.add(cap);
    });

    // ── 2. Left A-pillar ──────────────────────────────────────────────────
    this._lPillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 8, 0.55), metal);
    this._lPillar.position.set(-3.70, 0.5, 0.85);
    this._lPillar.rotation.z = 0.055;
    this._scene.add(this._lPillar);

    // Left pillar inner-face green glow strip
    const lEdge = new THREE.Mesh(new THREE.BoxGeometry(0.038, 8, 0.038), glow);
    lEdge.position.set(-3.53, 0.5, 1.13);
    this._scene.add(lEdge);

    // ── 3. Right edge trim (thinner — right panel 270px is already there) ─
    this._rTrim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 8, 0.38), metal);
    this._rTrim.position.set(3.52, 0.5, 0.58);
    this._rTrim.rotation.z = -0.04;
    this._scene.add(this._rTrim);

    const rEdge = new THREE.Mesh(new THREE.BoxGeometry(0.030, 8, 0.030), glow);
    rEdge.position.set(3.40, 0.5, 0.78);
    this._scene.add(rEdge);

    // ── 4. Top frame bar ─────────────────────────────────────────────────
    this._topBar = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.42, 0.48), metal);
    this._topBar.position.set(0, 2.62, 0.68);
    this._scene.add(this._topBar);

    // Top bar underside green strip
    const topEdge = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.038, 0.038), glow);
    topEdge.position.set(0, 2.40, 0.92);
    this._scene.add(topEdge);

    // ── 5. Corner bevels (bottom-left / bottom-right) ─────────────────────
    [[-3.45, -1.95, 1.35, 0.24], [3.45, -1.95, 1.35, -0.24]].forEach(
      ([x, y, z, rz]) => {
        const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.70, 0.70), accent);
        bevel.position.set(x, y, z);
        bevel.rotation.z = rz;
        bevel.rotation.x = -0.12;
        this._scene.add(bevel);
      }
    );

    // ── 6. HUD glass screen plane (faint tinted quad over game view) ──────
    // Very subtle green-tinted glass effect in the viewing area
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x001a08,
      transparent: true,
      opacity: 0.04,
      side: THREE.FrontSide,
      depthWrite: false
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.5), glassMat);
    glass.position.set(0, 0.3, 0.1);
    this._scene.add(glass);

    // Vignette edges (4 thin dark quads framing the view)
    const vigMat = new THREE.MeshStandardMaterial({
      color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
    });
    // Top vignette
    const vT = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.9), vigMat);
    vT.position.set(0, 2.15, 0.05);
    this._scene.add(vT);
    // Bottom vignette
    const vB = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.1), vigMat.clone());
    vB.position.set(0, -1.5, 0.05);
    this._scene.add(vB);
    // Left vignette
    const vL = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 5), vigMat.clone());
    vL.position.set(-3.25, 0.3, 0.05);
    this._scene.add(vL);
    // Right vignette
    const vR = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), vigMat.clone());
    vR.position.set(3.20, 0.3, 0.05);
    this._scene.add(vR);
  }

  // ── Mouse parallax ────────────────────────────────────────────────────────

  _initMouse() {
    window.addEventListener('mousemove', e => {
      this._tx = (e.clientX / innerWidth  - 0.5) *  0.12;
      this._ty = (e.clientY / innerHeight - 0.5) * -0.07;
    });
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  _raf() {
    requestAnimationFrame(() => this._raf());

    // Smooth camera drift
    const lp = 0.052;
    this._cx += (this._tx - this._cx) * lp;
    this._cy += (this._ty - this._cy) * lp;
    this._camera.position.x = this._cx;
    this._camera.position.y = 0.2 + this._cy;

    // Subtle dashboard breathing
    if (this._dash) {
      this._dash.position.y = -2.20 + Math.sin(Date.now() * 0.00038) * 0.005;
    }

    this._renderer.render(this._scene, this._camera);
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  _resize() {
    const W = innerWidth, H = innerHeight;
    this._camera.aspect = W / H;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(W, H);
  }
}

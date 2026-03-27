export class StartScreen {
  show() {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.id = 'start-screen';
      el.style.cssText = `
        position: fixed; inset: 0;
        z-index: 300;
        overflow: hidden;
        animation: ssIn 0.6s ease;
      `;

      el.innerHTML = `
        <style>
          @keyframes ssIn  { from { opacity:0 } to { opacity:1 } }
          @keyframes ssOut { to   { opacity:0; pointer-events:none } }
          @keyframes scanMove { from { transform: translateY(0) } to { transform: translateY(4px) } }
          @keyframes newsScroll {
            from { transform: translateX(100%) }
            to   { transform: translateX(-100%) }
          }
          @keyframes droneFloat {
            0%, 100% { transform: translateY(0px) rotate(-2deg); }
            50%       { transform: translateY(-18px) rotate(2deg); }
          }
          @keyframes glowPulse {
            0%, 100% { filter: drop-shadow(0 0 12px #00d4ff) drop-shadow(0 0 30px rgba(0,212,255,0.4)); }
            50%       { filter: drop-shadow(0 0 24px #00d4ff) drop-shadow(0 0 60px rgba(0,212,255,0.7)); }
          }
          @keyframes borderPulse {
            0%, 100% { box-shadow: 0 0 0 1px rgba(0,212,255,0.3), 0 0 20px rgba(0,212,255,0.1) inset; }
            50%       { box-shadow: 0 0 0 1px rgba(0,212,255,0.7), 0 0 40px rgba(0,212,255,0.2) inset; }
          }
          @keyframes titleGlow {
            0%, 100% { text-shadow: 0 0 20px rgba(0,212,255,0.8), 0 0 60px rgba(0,212,255,0.3); }
            50%       { text-shadow: 0 0 40px rgba(0,212,255,1.0), 0 0 100px rgba(0,212,255,0.6), 0 0 140px rgba(0,212,255,0.2); }
          }
          @keyframes btnHoverGlow {
            0%, 100% { box-shadow: 0 0 10px rgba(0,212,255,0.2) inset, 0 2px 8px rgba(0,0,0,0.5); }
            50%       { box-shadow: 0 0 20px rgba(0,212,255,0.35) inset, 0 2px 16px rgba(0,212,255,0.2); }
          }
          @keyframes leaderPulse {
            0%, 100% { background: rgba(0,212,255,0.05); }
            50%       { background: rgba(0,212,255,0.12); }
          }
          @keyframes rankGlow {
            0%, 100% { color: #00e87a; text-shadow: 0 0 8px rgba(0,232,122,0.6); }
            50%       { color: #00ff99; text-shadow: 0 0 16px rgba(0,255,153,0.9); }
          }

          #start-screen-bg {
            position: absolute; inset: 0;
            background:
              radial-gradient(ellipse 80% 60% at 65% 45%, rgba(0,30,60,0.7) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 20% 70%, rgba(0,180,100,0.06) 0%, transparent 60%),
              linear-gradient(160deg, #03080f 0%, #050d18 40%, #02060e 100%);
          }

          /* City silhouette backdrop */
          #start-screen-city {
            position: absolute; bottom: 0; left: 0; right: 0;
            height: 55%;
            background:
              /* Explosion glow spots */
              radial-gradient(circle 120px at 25% 85%, rgba(255,140,0,0.12) 0%, transparent 70%),
              radial-gradient(circle 80px at 72% 90%, rgba(255,60,0,0.10) 0%, transparent 60%),
              /* City silhouette using gradients */
              linear-gradient(to top, rgba(5,10,20,0.95) 0%, transparent 100%);
            pointer-events: none;
          }

          /* Scanline overlay */
          #start-screen-scanlines {
            position: absolute; inset: 0; pointer-events: none; z-index: 1;
            background: repeating-linear-gradient(
              to bottom,
              transparent 0, transparent 3px,
              rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px
            );
          }

          /* Vignette */
          #start-screen-vignette {
            position: absolute; inset: 0; pointer-events: none; z-index: 1;
            background: radial-gradient(ellipse 90% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.65) 100%);
          }

          /* Layout grid */
          #ss-layout {
            position: relative; z-index: 2;
            width: 100%; height: 100%;
            display: grid;
            grid-template-columns: 280px 1fr 300px;
            grid-template-rows: auto 1fr auto;
            gap: 0;
            padding: 20px;
            box-sizing: border-box;
          }

          /* Title bar — spans all columns */
          #ss-title-bar {
            grid-column: 1 / 4;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }

          .ss-arabic-title {
            font-size: clamp(24px, 4.5vw, 48px);
            font-weight: 900;
            color: #00d4ff;
            letter-spacing: 4px;
            direction: rtl;
            animation: titleGlow 3s ease-in-out infinite;
            font-family: 'Courier New', serif;
            text-align: center;
            line-height: 1.2;
          }

          .ss-subtitle {
            font-size: clamp(9px, 1.2vw, 13px);
            color: rgba(0,212,255,0.55);
            letter-spacing: 6px;
            text-transform: uppercase;
            margin-top: 6px;
            font-family: 'Courier New', monospace;
          }

          .ss-title-divider {
            width: 480px; max-width: 90vw;
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(0,212,255,0.6), transparent);
            margin-top: 10px;
          }

          /* Glass panel mixin */
          .ss-glass {
            background: rgba(4, 14, 28, 0.82);
            border: 1px solid rgba(0, 212, 255, 0.28);
            border-radius: 12px;
            backdrop-filter: blur(18px) saturate(1.4);
            -webkit-backdrop-filter: blur(18px) saturate(1.4);
            box-shadow:
              0 0 0 1px rgba(0,212,255,0.08),
              0 0 30px rgba(0,212,255,0.06) inset,
              0 16px 48px rgba(0,0,0,0.7);
            animation: borderPulse 4s ease-in-out infinite;
          }

          /* Left menu panel */
          #ss-menu {
            grid-column: 1;
            grid-row: 2;
            display: flex;
            flex-direction: column;
            padding: 20px 16px;
            gap: 10px;
          }

          .ss-menu-header {
            font-size: 9px;
            letter-spacing: 3px;
            color: rgba(0,212,255,0.5);
            text-transform: uppercase;
            border-bottom: 1px solid rgba(0,212,255,0.15);
            padding-bottom: 10px;
            margin-bottom: 4px;
            font-family: 'Courier New', monospace;
            text-align: center;
          }

          .ss-btn {
            background: rgba(0, 15, 35, 0.75);
            color: #00d4ff;
            border: 1px solid rgba(0,212,255,0.30);
            border-radius: 8px;
            padding: 13px 18px;
            font-size: 13px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            transition: all 0.18s ease;
            -webkit-tap-highlight-color: transparent;
            display: flex;
            align-items: center;
            gap: 10px;
            text-align: left;
            position: relative;
            overflow: hidden;
            animation: btnHoverGlow 4s ease-in-out infinite;
          }

          .ss-btn::before {
            content: '';
            position: absolute; left: 0; top: 0; bottom: 0;
            width: 3px;
            background: rgba(0,212,255,0.5);
            transform: scaleY(0);
            transition: transform 0.18s ease;
            transform-origin: bottom;
          }

          .ss-btn:hover::before { transform: scaleY(1); }

          .ss-btn:hover, .ss-btn:focus {
            background: rgba(0,212,255,0.12);
            border-color: rgba(0,212,255,0.75);
            box-shadow: 0 0 24px rgba(0,212,255,0.25) inset, 0 4px 16px rgba(0,212,255,0.15);
            color: #ffffff;
            transform: translateX(4px);
          }

          .ss-btn-primary {
            background: rgba(0,212,255,0.10);
            border-color: rgba(0,212,255,0.55);
            font-size: 15px;
            padding: 16px 18px;
            color: #ffffff;
            box-shadow: 0 0 20px rgba(0,212,255,0.2) inset;
          }

          .ss-btn-primary:hover {
            background: rgba(0,212,255,0.22);
            box-shadow: 0 0 40px rgba(0,212,255,0.4) inset, 0 0 30px rgba(0,212,255,0.3);
          }

          .ss-btn-icon { font-size: 16px; min-width: 20px; }
          .ss-btn-text { flex: 1; }
          .ss-btn-arabic { font-size: 11px; direction: rtl; color: rgba(0,212,255,0.7); margin-top: 2px; display: block; }

          .ss-version-tag {
            margin-top: auto;
            font-size: 8px;
            color: rgba(0,212,255,0.2);
            letter-spacing: 2px;
            text-align: center;
            font-family: 'Courier New', monospace;
          }

          /* Center drone area */
          #ss-center {
            grid-column: 2;
            grid-row: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            padding: 20px;
          }

          #ss-drone-wrap {
            animation: droneFloat 5s ease-in-out infinite;
          }

          #ss-drone-svg {
            animation: glowPulse 3s ease-in-out infinite;
            width: clamp(180px, 28vw, 340px);
            height: auto;
          }

          .ss-drone-label {
            font-size: 10px;
            color: rgba(0,212,255,0.5);
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-top: 16px;
            font-family: 'Courier New', monospace;
            text-align: center;
          }

          /* HUD crosshair corners around drone */
          .ss-crosshair {
            position: absolute;
            width: 60px; height: 60px;
            pointer-events: none;
          }
          .ss-ch-tl { top: 10px; left: 30px; border-top: 2px solid rgba(0,212,255,0.4); border-left: 2px solid rgba(0,212,255,0.4); }
          .ss-ch-tr { top: 10px; right: 30px; border-top: 2px solid rgba(0,212,255,0.4); border-right: 2px solid rgba(0,212,255,0.4); }
          .ss-ch-bl { bottom: 70px; left: 30px; border-bottom: 2px solid rgba(0,212,255,0.4); border-left: 2px solid rgba(0,212,255,0.4); }
          .ss-ch-br { bottom: 70px; right: 30px; border-bottom: 2px solid rgba(0,212,255,0.4); border-right: 2px solid rgba(0,212,255,0.4); }

          /* Right panels column */
          #ss-right {
            grid-column: 3;
            grid-row: 2;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          /* Player profile card */
          #ss-profile {
            padding: 16px;
          }

          .ss-profile-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .ss-avatar {
            width: 44px; height: 44px;
            background: rgba(0,212,255,0.1);
            border: 2px solid rgba(0,212,255,0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
          }

          .ss-player-name {
            font-size: 14px;
            font-weight: bold;
            color: #ffffff;
            font-family: 'Courier New', monospace;
          }

          .ss-player-rank {
            font-size: 9px;
            color: #00e87a;
            letter-spacing: 2px;
            text-transform: uppercase;
            animation: rankGlow 2.5s ease-in-out infinite;
          }

          .ss-stat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 8px;
          }

          .ss-stat-cell {
            background: rgba(0,212,255,0.05);
            border: 1px solid rgba(0,212,255,0.10);
            border-radius: 6px;
            padding: 6px 8px;
          }

          .ss-stat-val {
            font-size: 16px;
            font-weight: bold;
            color: #00d4ff;
            font-family: 'Courier New', monospace;
          }

          .ss-stat-lbl {
            font-size: 8px;
            color: rgba(0,212,255,0.45);
            letter-spacing: 1px;
            text-transform: uppercase;
            display: block;
            margin-top: 2px;
          }

          /* Leaderboard */
          #ss-leaderboard {
            padding: 16px;
            flex: 1;
          }

          .ss-panel-title {
            font-size: 9px;
            letter-spacing: 3px;
            color: rgba(0,212,255,0.55);
            text-transform: uppercase;
            border-bottom: 1px solid rgba(0,212,255,0.15);
            padding-bottom: 8px;
            margin-bottom: 10px;
            font-family: 'Courier New', monospace;
          }

          .ss-lb-row {
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid rgba(0,212,255,0.06);
            gap: 8px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            transition: background 0.2s;
          }

          .ss-lb-row:hover { animation: leaderPulse 1s ease-in-out infinite; border-radius: 4px; padding-left: 4px; }
          .ss-lb-row:last-child { border-bottom: none; }

          .ss-lb-rank {
            width: 20px; text-align: center;
            font-size: 10px; font-weight: bold;
          }
          .ss-lb-rank-1 { color: #ffd700; }
          .ss-lb-rank-2 { color: #c0c0c0; }
          .ss-lb-rank-3 { color: #cd7f32; }
          .ss-lb-rank-other { color: rgba(0,212,255,0.4); }

          .ss-lb-name {
            flex: 1;
            color: rgba(255,255,255,0.8);
            font-size: 11px;
          }

          .ss-lb-score {
            color: #00e87a;
            font-size: 10px;
            font-weight: bold;
          }

          .ss-lb-wave {
            color: rgba(0,212,255,0.4);
            font-size: 9px;
            width: 32px;
            text-align: right;
          }

          /* News ticker */
          #ss-ticker-bar {
            grid-column: 1 / 4;
            display: flex;
            align-items: center;
            height: 36px;
            background: rgba(0,10,25,0.90);
            border: 1px solid rgba(0,212,255,0.22);
            border-radius: 8px;
            overflow: hidden;
            margin-top: 16px;
            backdrop-filter: blur(10px);
          }

          .ss-ticker-label {
            background: rgba(0,212,255,0.15);
            border-right: 1px solid rgba(0,212,255,0.3);
            padding: 0 14px;
            height: 100%;
            display: flex;
            align-items: center;
            font-size: 9px;
            color: #00d4ff;
            letter-spacing: 2px;
            white-space: nowrap;
            font-family: 'Courier New', monospace;
            flex-shrink: 0;
          }

          .ss-ticker-track {
            flex: 1;
            overflow: hidden;
            height: 100%;
            display: flex;
            align-items: center;
          }

          .ss-ticker-content {
            white-space: nowrap;
            font-size: 11px;
            color: rgba(200,230,255,0.75);
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
            animation: newsScroll 38s linear infinite;
          }

          .ss-ticker-sep { color: rgba(0,212,255,0.4); margin: 0 20px; }

          /* Mobile responsive */
          @media (max-width: 768px) {
            #ss-layout {
              grid-template-columns: 1fr;
              grid-template-rows: auto auto 1fr auto;
              padding: 12px;
            }
            #ss-title-bar { grid-column: 1; }
            #ss-menu { grid-column: 1; grid-row: 2; }
            #ss-center { grid-column: 1; grid-row: 3; min-height: 220px; }
            #ss-right { display: none; }
            #ss-ticker-bar { grid-column: 1; }
          }
        </style>

        <!-- Background layers -->
        <div id="start-screen-bg"></div>
        <div id="start-screen-city"></div>
        <div id="start-screen-scanlines"></div>
        <div id="start-screen-vignette"></div>

        <!-- Main layout -->
        <div id="ss-layout">

          <!-- Title -->
          <div id="ss-title-bar">
            <div class="ss-arabic-title">صراع المسيرات ثلاثي الأبعاد</div>
            <div class="ss-subtitle">3D DRONE WARFARE — TACTICAL COMMAND</div>
            <div class="ss-title-divider"></div>
          </div>

          <!-- Left: Menu panel -->
          <div id="ss-menu" class="ss-glass">
            <div class="ss-menu-header">◈ COMMAND TERMINAL ◈</div>

            <button class="ss-btn ss-btn-primary" id="start-btn">
              <span class="ss-btn-icon">▶</span>
              <span class="ss-btn-text">
                START GAME
                <span class="ss-btn-arabic">ابدأ اللعب</span>
              </span>
            </button>

            <button class="ss-btn">
              <span class="ss-btn-icon">⚙</span>
              <span class="ss-btn-text">
                OPTIONS
                <span class="ss-btn-arabic">الإعدادات</span>
              </span>
            </button>

            <button class="ss-btn">
              <span class="ss-btn-icon">★</span>
              <span class="ss-btn-text">
                ACHIEVEMENTS
                <span class="ss-btn-arabic">الإنجازات</span>
              </span>
            </button>

            <button class="ss-btn">
              <span class="ss-btn-icon">📋</span>
              <span class="ss-btn-text">
                CREDITS
                <span class="ss-btn-arabic">الاعتمادات</span>
              </span>
            </button>

            <button class="ss-btn" style="color:rgba(255,100,100,0.8); border-color:rgba(255,80,80,0.25);">
              <span class="ss-btn-icon">✕</span>
              <span class="ss-btn-text">
                QUIT
                <span class="ss-btn-arabic" style="color:rgba(255,100,100,0.6);">خروج</span>
              </span>
            </button>

            <div class="ss-version-tag">v2.4.1 — BUILD 1339<br>CLASSIFIED SYSTEM</div>
          </div>

          <!-- Center: Drone silhouette -->
          <div id="ss-center">
            <div class="ss-crosshair ss-ch-tl"></div>
            <div class="ss-crosshair ss-ch-tr"></div>
            <div class="ss-crosshair ss-ch-bl"></div>
            <div class="ss-crosshair ss-ch-br"></div>

            <div id="ss-drone-wrap">
              <!-- MQ-9 Reaper style top-down SVG silhouette -->
              <svg id="ss-drone-svg" viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg">
                <!-- Glow filter -->
                <defs>
                  <filter id="droneGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="bodyGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1a3a5c"/>
                    <stop offset="100%" stop-color="#0a1a2e"/>
                  </linearGradient>
                  <linearGradient id="wingGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#0d2540"/>
                    <stop offset="50%" stop-color="#1a3a5c"/>
                    <stop offset="100%" stop-color="#0d2540"/>
                  </linearGradient>
                </defs>

                <!-- Main wing (long swept wing) -->
                <polygon
                  points="170,108 30,120 10,112 20,104 30,96 170,92"
                  fill="url(#wingGrad)" stroke="#00d4ff" stroke-width="1.2" stroke-opacity="0.7"
                  filter="url(#droneGlow)"
                />
                <polygon
                  points="170,108 310,120 330,112 320,104 310,96 170,92"
                  fill="url(#wingGrad)" stroke="#00d4ff" stroke-width="1.2" stroke-opacity="0.7"
                  filter="url(#droneGlow)"
                />

                <!-- Main fuselage body -->
                <ellipse cx="170" cy="100" rx="18" ry="62" fill="url(#bodyGrad)"
                  stroke="#00d4ff" stroke-width="1.5" stroke-opacity="0.85"
                  filter="url(#bodyGlow)"
                />

                <!-- Nose cone -->
                <ellipse cx="170" cy="44" rx="9" ry="14" fill="#0f2a45"
                  stroke="#00d4ff" stroke-width="1.2" stroke-opacity="0.9"
                />

                <!-- Sensor ball (nose) -->
                <circle cx="170" cy="38" r="6" fill="#081828"
                  stroke="#00e87a" stroke-width="1.5"
                />
                <circle cx="170" cy="38" r="3" fill="#00e87a" opacity="0.6"/>

                <!-- V-tail fins -->
                <polygon
                  points="165,158 148,182 158,186 170,164"
                  fill="#0d2540" stroke="#00d4ff" stroke-width="1" stroke-opacity="0.65"
                />
                <polygon
                  points="175,158 192,182 182,186 170,164"
                  fill="#0d2540" stroke="#00d4ff" stroke-width="1" stroke-opacity="0.65"
                />

                <!-- Engine intake / center detail -->
                <rect x="163" y="105" width="14" height="22" rx="3"
                  fill="#061015" stroke="#00d4ff" stroke-width="0.8" stroke-opacity="0.5"
                />

                <!-- Underwing hardpoints (weapons pylons) -->
                <!-- Left wing pylons -->
                <rect x="82" y="100" width="14" height="5" rx="2" fill="#061520" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
                <rect x="84" y="105" width="10" height="14" rx="2" fill="#00d4ff" opacity="0.25" stroke="#00d4ff" stroke-width="0.8"/>

                <rect x="118" y="98" width="14" height="5" rx="2" fill="#061520" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
                <rect x="120" y="103" width="10" height="12" rx="2" fill="#00e87a" opacity="0.2" stroke="#00e87a" stroke-width="0.8"/>

                <!-- Right wing pylons -->
                <rect x="244" y="100" width="14" height="5" rx="2" fill="#061520" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
                <rect x="246" y="105" width="10" height="14" rx="2" fill="#00d4ff" opacity="0.25" stroke="#00d4ff" stroke-width="0.8"/>

                <rect x="208" y="98" width="14" height="5" rx="2" fill="#061520" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
                <rect x="210" y="103" width="10" height="12" rx="2" fill="#00e87a" opacity="0.2" stroke="#00e87a" stroke-width="0.8"/>

                <!-- Nav lights -->
                <circle cx="12" cy="112" r="3.5" fill="#ff3333" opacity="0.9"/>
                <circle cx="12" cy="112" r="6" fill="#ff3333" opacity="0.2"/>
                <circle cx="328" cy="112" r="3.5" fill="#00e87a" opacity="0.9"/>
                <circle cx="328" cy="112" r="6" fill="#00e87a" opacity="0.2"/>

                <!-- Fuselage centerline detail -->
                <line x1="170" y1="50" x2="170" y2="160" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.3" stroke-dasharray="4,4"/>

                <!-- Wing leading edge highlight -->
                <line x1="170" y1="92" x2="30" y2="96" stroke="#00d4ff" stroke-width="0.8" stroke-opacity="0.4"/>
                <line x1="170" y1="92" x2="310" y2="96" stroke="#00d4ff" stroke-width="0.8" stroke-opacity="0.4"/>

                <!-- Targeting reticle around sensor -->
                <circle cx="170" cy="38" r="12" fill="none" stroke="#00e87a" stroke-width="0.8" stroke-opacity="0.5" stroke-dasharray="3,3"/>
              </svg>
            </div>

            <div class="ss-drone-label">MQ-9 REAPER — UNIT ALPHA-1</div>

            <!-- Tactical info below drone -->
            <div style="display:flex; gap:16px; margin-top:18px; font-family:'Courier New',monospace;">
              <div style="text-align:center; font-size:9px; color:rgba(0,212,255,0.5); letter-spacing:1px;">
                <div style="font-size:14px; color:#00e87a; font-weight:bold;">∞</div>WAVE
              </div>
              <div style="text-align:center; font-size:9px; color:rgba(0,212,255,0.5); letter-spacing:1px;">
                <div style="font-size:14px; color:#00d4ff; font-weight:bold;">12</div>DRONES
              </div>
              <div style="text-align:center; font-size:9px; color:rgba(0,212,255,0.5); letter-spacing:1px;">
                <div style="font-size:14px; color:#ffcc44; font-weight:bold;">3</div>OBJECTIVES
              </div>
              <div style="text-align:center; font-size:9px; color:rgba(0,212,255,0.5); letter-spacing:1px;">
                <div style="font-size:14px; color:#00e87a; font-weight:bold;">HD</div>MODE
              </div>
            </div>
          </div>

          <!-- Right column -->
          <div id="ss-right">

            <!-- Player profile card -->
            <div id="ss-profile" class="ss-glass">
              <div class="ss-panel-title">◈ PILOT PROFILE</div>
              <div class="ss-profile-header">
                <div class="ss-avatar">✈</div>
                <div>
                  <div class="ss-player-name">COMMANDER</div>
                  <div class="ss-player-rank">★★★ LIEUTENANT GENERAL</div>
                </div>
              </div>
              <div class="ss-stat-grid">
                <div class="ss-stat-cell">
                  <div class="ss-stat-val">0</div>
                  <span class="ss-stat-lbl">Best Score</span>
                </div>
                <div class="ss-stat-cell">
                  <div class="ss-stat-val">0</div>
                  <span class="ss-stat-lbl">Best Wave</span>
                </div>
                <div class="ss-stat-cell">
                  <div class="ss-stat-val">0</div>
                  <span class="ss-stat-lbl">Kills</span>
                </div>
                <div class="ss-stat-cell">
                  <div class="ss-stat-val">0%</div>
                  <span class="ss-stat-lbl">Win Rate</span>
                </div>
              </div>
            </div>

            <!-- Leaderboard -->
            <div id="ss-leaderboard" class="ss-glass">
              <div class="ss-panel-title">◈ LEADERBOARD</div>

              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-1">①</span>
                <span class="ss-lb-name">ALPHA_DRONE</span>
                <span class="ss-lb-score">48,720</span>
                <span class="ss-lb-wave">W42</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-2">②</span>
                <span class="ss-lb-name">GHOST_CMD</span>
                <span class="ss-lb-score">37,150</span>
                <span class="ss-lb-wave">W38</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-3">③</span>
                <span class="ss-lb-name">STORM_OPS</span>
                <span class="ss-lb-score">29,880</span>
                <span class="ss-lb-wave">W31</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-other">④</span>
                <span class="ss-lb-name">VIPER_SQ</span>
                <span class="ss-lb-score">22,440</span>
                <span class="ss-lb-wave">W25</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-other">⑤</span>
                <span class="ss-lb-name">EAGLE_EYE</span>
                <span class="ss-lb-score">18,660</span>
                <span class="ss-lb-wave">W22</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-other">⑥</span>
                <span class="ss-lb-name">REAPER_7</span>
                <span class="ss-lb-score">14,200</span>
                <span class="ss-lb-wave">W18</span>
              </div>
              <div class="ss-lb-row">
                <span class="ss-lb-rank ss-lb-rank-other">⑦</span>
                <span class="ss-lb-name">TALON_CMD</span>
                <span class="ss-lb-score">11,350</span>
                <span class="ss-lb-wave">W15</span>
              </div>
            </div>

          </div>

          <!-- Bottom: News ticker -->
          <div id="ss-ticker-bar">
            <div class="ss-ticker-label">◈ INTEL FEED</div>
            <div class="ss-ticker-track">
              <div class="ss-ticker-content">
                WAVE 1 INCOMING — PREPARE DEFENSES
                <span class="ss-ticker-sep">◆</span>
                3 CITY RESOURCES REQUIRE PROTECTION: POWER ⚡ · WATER 💧 · FOOD 🌾
                <span class="ss-ticker-sep">◆</span>
                ENEMY DRONES DETECTED ON RADAR — INTERCEPT ADVISED
                <span class="ss-ticker-sep">◆</span>
                FORMATION COMMANDS: ATTACK ▲ · DEFEND ● · SCATTER ✦ · LINE ━ · SHIELD ⬡
                <span class="ss-ticker-sep">◆</span>
                تحذير: المسيرات المعادية تستهدف البنية التحتية للمدينة — جاهز للاعتراض
                <span class="ss-ticker-sep">◆</span>
                COMMANDER: SWARM INTELLIGENCE SYSTEMS ONLINE — ALL UNITS READY
                <span class="ss-ticker-sep">◆</span>
                BOSS WAVE DETECTED EVERY 5TH WAVE — MAXIMUM THREAT CONDITION
                <span class="ss-ticker-sep">◆</span>
              </div>
            </div>
          </div>

        </div>
      `;

      document.body.appendChild(el);

      el.querySelector('#start-btn').addEventListener('click', () => {
        el.style.animation = 'ssOut 0.35s ease forwards';
        setTimeout(() => { el.remove(); resolve(); }, 350);
      });
    });
  }
}

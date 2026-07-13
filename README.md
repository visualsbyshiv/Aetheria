# 🔺 AETHERIA: CYBER MAP (v2.0.0)

A high-fidelity tactical sci-fi cyberpunk multiplayer deployment arena. Integrated with real-time GPS coordinate telemetry, Leaflet radar mapping overlays, and three-dimensional (Three.js) third-person perspective (TPP) camera tracking.

---

## 🚀 Key Features

1. **Cyberpunk Tactical Dashboard**: A premium, frosted-glass dark theme dashboard with modern sci-fi navigation headers, real-time loadout progress meters, and glowing indicators.
2. **Three-Class Pilot System**: Select from custom pilot classes, each updating active ship models, sizes, and colors in the live 3D arena:
   - **Manta (Ares)**: Tanky fighter vessel scaled to **125%** with glowing neon cyan hulls.
   - **Ghost (Athena)**: Sleek stealth fighter scaled to **85%** with vibrant neon pink visors.
   - **Scyla (Athena)**: Balanced explorer vessel scaled to **105%** with holographic golden armor.
3. **Free Fire TPP Camera**: Snappy, behind-the-avatar perspective that tracks coordinates and visors instantly across every rendering tick.
4. **Dynamic Live HUD Stat Bars**: Integrates real-time values for **DAMAGE**, **RANGE**, and **ACCURACY** that dynamically upgrade upon collecting energy orbs, and degrade when damaged by proximity bot hazards.
5. **Interactive Left Sidebar Telemetry**:
   - `📡` **Radar Map Toggle**: Flips viewport between Leaflet GPS maps and virtual 3D engines.
   - `⚡` **Speed Boost Drive**: Temporarily overclocks thruster speed from `5` to `11` for 4 seconds.
   - `👥` **Alliances Panel**: Direct lookup of active pilots and their team relationships in the sector.
   - `⚙️` **Pilot Profile Databank**: View Callsign, active Class, and high score logs.

---

## 🛠️ Technology Stack
* **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism + Keyframe Animations), Vanilla JavaScript (ES6)
* **Graphics Engines**: Three.js WebGL (3D Viewport), Leaflet.js Maps API (Real Radar)
* **Backend**: Node.js, Express, Socket.io (Decentralized coordinate telemetry)
* **Database**: MongoDB/CosmosDB (With Local Memory fallback)

---

## 🎮 Movement & Operations

* **Movement**: Use `W` / `A` / `S` / `D` or `W` / `A` / `R` / `D` layouts (with `R` mapped as Down). Traditional **Arrow Keys** are also supported.
* **Proximity Alliances**: Walk within range of other pilots to interact, send alliance invitations, or engage hostiles.

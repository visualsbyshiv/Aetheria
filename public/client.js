// AETHERIA CLIENT CONTROLLER

// Socket.io Connection
const socket = io();

// Canvas Elements
const gameCanvas = document.getElementById('game-canvas');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// Preview Canvases
const previewMaleCanvas = document.getElementById('canvas-preview-male');
const previewFemaleCanvas = document.getElementById('canvas-preview-female');

// DOM Elements
const loginOverlay = document.getElementById('auth-dashboard');
const authForm = document.getElementById('auth-form');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authErrorBanner = document.getElementById('auth-error-banner');
const signupArchetypeGroup = document.getElementById('signup-archetype-group');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const avatarOptions = document.querySelectorAll('.avatar-option');
const gameView = document.getElementById('game-view');
const realMapContainer = document.getElementById('real-map-container');
const btnToggleMap = document.getElementById('btn-toggle-map');
const pingText = document.getElementById('ping-text');
const onlineCountText = document.getElementById('players-online-count');
const leaderboardList = document.getElementById('leaderboard-list');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const notificationContainer = document.getElementById('game-notifications');

// Proximity HUD Elements
const proximityPrompt = document.getElementById('proximity-prompt');
const promptTargetName = document.getElementById('prompt-target-name');
const promptTargetDist = document.getElementById('prompt-target-dist');
const nearbyPlayersPanel = document.getElementById('hud-nearby-players');
const nearbyPlayersList = document.getElementById('nearby-players-list');

// Team Invitation Dialog Elements
const teamRequestModal = document.getElementById('team-request-modal');
const teamRequestSender = document.getElementById('team-request-sender');
const btnAcceptTeam = document.getElementById('btn-accept-team');
const btnDeclineTeam = document.getElementById('btn-decline-team');

// Mission Objective HUD Elements
const hudMission = document.getElementById('hud-mission');
const missionObjective = document.getElementById('mission-objective');
const missionCompassArrow = document.getElementById('mission-compass-arrow');
const missionTargetInfo = document.getElementById('mission-target-info');

// Game State
let selfId = null;
let players = {};
let orbs = [];
let mapWidth = 2000;
let mapHeight = 2000;
let keys = {};
let isJoined = false;
let closestPlayerId = null;
let pendingSenderId = null;
let isMissionActive = false;
let compassAngle = null;
let realMap = null;
let realMapMarkers = {};
let isRealMapActive = false;
const realMapCenter = [37.7694, -122.4862]; // SF Golden Gate Park Tech Hub Center
const PROXIMITY_RANGE = 100; // in pixels (meters)

// Speed and Physics
let playerSpeed = 5;
const PLAYER_RADIUS = 25;

// Camera System (Viewport offset)
let camera = { x: 0, y: 0 };

// Particle Trail System
let particles = [];

// Latency Tracking
let lastPingTime = Date.now();
let pingValue = 0;

// Starfield particles for menu background and in-game depth
let starfield = [];
const STAR_COUNT = 150;

// Chosen avatar archetype
let selectedGender = 'male';

// -----------------------------------------------------------------------------
// 1. INITIALIZATION & PREVIEWS
// -----------------------------------------------------------------------------

// Populate the background starfield coordinates
function initStarfield() {
  starfield = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    starfield.push({
      x: Math.random() * 2000, // covers game map size
      y: Math.random() * 2000,
      size: Math.random() * 1.8 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.005,
      pulseDir: Math.random() > 0.5 ? 1 : -1
    });
  }
}
initStarfield();

// Resize main canvas
function resizeCanvas() {
  if (isJoined) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    gameCanvas.width = width;
    gameCanvas.height = height;
    
    if (renderer) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
}
window.addEventListener('resize', resizeCanvas);

// Carousel Class Select telemetry mapping
const cyberClasses = [
  {
    name: "NETRUNNER",
    code: "MN-01",
    label: "NETRUNNER // OVERDRIVE",
    gender: "female",
    color: "#00f2fe", // cyan
    classKey: "manta",
    integrity: 40,
    overdrive: 95
  },
  {
    name: "CYBER-SAMURAI",
    code: "SM-02",
    label: "SAMURAI // CRUISE",
    gender: "male",
    color: "#ff00ea", // pink
    classKey: "ghost",
    integrity: 85,
    overdrive: 50
  },
  {
    name: "TECH-DOC",
    code: "TD-03",
    label: "TECH-DOC // RECON",
    gender: "female",
    color: "#ffd700", // gold
    classKey: "scyla",
    integrity: 65,
    overdrive: 75
  }
];

let activeClassIndex = 0;
let isClassLocked = false;

const activeClassCard = document.getElementById("active-class-card");
const activeClassCode = document.getElementById("active-class-code");
const activeClassName = document.getElementById("active-class-name");
const activeClassLabel = document.getElementById("active-class-label");
const btnPrevClass = document.getElementById("btn-prev-class");
const btnNextClass = document.getElementById("btn-next-class");
const btnLockClass = document.getElementById("btn-lock-class");
const badgeLocked = document.getElementById("badge-locked");

// Dynamic Synergy Matrix HUD progress bars (Section 02)
const barIntegrity = document.getElementById("bar-integrity");
const valIntegrity = document.getElementById("val-integrity");
const barOverdrive = document.getElementById("bar-overdrive");
const valOverdrive = document.getElementById("val-overdrive");

function updateCarouselSelection() {
  const cls = cyberClasses[activeClassIndex];
  
  if (activeClassCode) activeClassCode.textContent = cls.code;
  if (activeClassName) activeClassName.textContent = cls.name;
  if (activeClassLabel) activeClassLabel.textContent = cls.label;
  
  // Animate stat bars in Section 02
  if (barIntegrity && valIntegrity) {
    barIntegrity.style.width = `${cls.integrity}%`;
    valIntegrity.textContent = `${cls.integrity}%`;
  }
  if (barOverdrive && valOverdrive) {
    barOverdrive.style.width = `${cls.overdrive}%`;
    valOverdrive.textContent = `${cls.overdrive}%`;
  }
  
  // Set default selection state variables
  selectedGender = cls.gender;
  const pilotClass = cls.classKey;
  
  // If in game session, update Three.js rendering instantly
  if (isJoined && selfId) {
    updatePlayerMeshClass(selfId, pilotClass, selectedGender);
    socket.emit('selectClass', { class: pilotClass, gender: selectedGender });
  }
}

if (btnPrevClass) {
  btnPrevClass.addEventListener("click", () => {
    if (isClassLocked) return;
    activeClassIndex = (activeClassIndex - 1 + cyberClasses.length) % cyberClasses.length;
    updateCarouselSelection();
  });
}

if (btnNextClass) {
  btnNextClass.addEventListener("click", () => {
    if (isClassLocked) return;
    activeClassIndex = (activeClassIndex + 1) % cyberClasses.length;
    updateCarouselSelection();
  });
}

if (btnLockClass) {
  btnLockClass.addEventListener("click", () => {
    isClassLocked = !isClassLocked;
    const cls = cyberClasses[activeClassIndex];
    
    if (isClassLocked) {
      // Apply locks and glowing states
      if (activeClassCard) {
        activeClassCard.classList.remove("locked-cyan", "locked-pink", "locked-gold");
        if (cls.color === "#00f2fe") activeClassCard.classList.add("locked-cyan");
        if (cls.color === "#ff00ea") activeClassCard.classList.add("locked-pink");
        if (cls.color === "#ffd700") activeClassCard.classList.add("locked-gold");
      }
      
      if (badgeLocked) {
        badgeLocked.style.display = "block";
      }
      
      btnLockClass.querySelector("span").textContent = "RELEASE ARCHETYPE LINK";
      
      // Auto trigger login submit click if not yet joined
      if (!isJoined) {
        appendEngineLog(`> ARCHETYPE LOCKED: ${cls.name} Cognitive Link Established.`);
      }
    } else {
      // Release visual glows
      if (activeClassCard) {
        activeClassCard.classList.remove("locked-cyan", "locked-pink", "locked-gold");
      }
      if (badgeLocked) {
        badgeLocked.style.display = "none";
      }
      btnLockClass.querySelector("span").textContent = "LOCK IN NEURAL ARCHETYPE";
      appendEngineLog(`> ARCHETYPE RELEASED: Cognitive Link Severed.`);
    }
  });
}

// Render dynamic avatar shapes on the active class preview canvas in login menu
function startPreviewLoops() {
  let time = 0;
  const activePreviewCanvas = document.getElementById("active-class-preview-canvas");
  
  function renderPreviews() {
    time += 0.05;
    
    if (activePreviewCanvas) {
      const pCtx = activePreviewCanvas.getContext('2d');
      pCtx.clearRect(0, 0, 80, 80);
      
      const cls = cyberClasses[activeClassIndex];
      const avatarName = cls.gender === 'male' ? 'Ares' : 'Athena';
      drawAvatar(pCtx, 40, 40, cls.gender, cls.color, time, avatarName);
    }
    
    requestAnimationFrame(renderPreviews);
  }
  renderPreviews();
}
startPreviewLoops();

// Starfield background animation loop (for the login screen before joining)
const bgStarfieldCanvas = document.getElementById('bg-starfield');
if (bgStarfieldCanvas) {
  const bgCtx = bgStarfieldCanvas.getContext('2d');
  
  function resizeBgCanvas() {
    bgStarfieldCanvas.width = window.innerWidth;
    bgStarfieldCanvas.height = window.innerHeight;
  }
  resizeBgCanvas();
  window.addEventListener('resize', resizeBgCanvas);
  
  function animateBgStarfield() {
    if (isJoined) return; // Stop this background loop once joined (main game loop takes over)
    
    bgCtx.fillStyle = '#060713';
    bgCtx.fillRect(0, 0, bgStarfieldCanvas.width, bgStarfieldCanvas.height);
    
    // Draw background cosmic grid
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    bgCtx.lineWidth = 1;
    const gridSize = 80;
    for (let x = 0; x < bgStarfieldCanvas.width; x += gridSize) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, bgStarfieldCanvas.height);
      bgCtx.stroke();
    }
    for (let y = 0; y < bgStarfieldCanvas.height; y += gridSize) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y);
      bgCtx.lineTo(bgStarfieldCanvas.width, y);
      bgCtx.stroke();
    }

    // Draw twinkling stars
    starfield.forEach(star => {
      // update star brightness
      star.alpha += star.pulseSpeed * star.pulseDir;
      if (star.alpha >= 1 || star.alpha <= 0.2) {
        star.pulseDir *= -1;
      }
      
      bgCtx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      // Scale positions to fit screen bounds for menu background
      const screenX = (star.x * 2) % bgStarfieldCanvas.width;
      const screenY = (star.y * 2) % bgStarfieldCanvas.height;
      bgCtx.beginPath();
      bgCtx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
      bgCtx.fill();
    });
    
    requestAnimationFrame(animateBgStarfield);
  }
  animateBgStarfield();
}

// -----------------------------------------------------------------------------
// 2. AVATAR GRAPHICS RENDERING (CANVAS SHAPES)
// -----------------------------------------------------------------------------

/**
 * Draws the 2D avatar representation on a canvas context
 * @param {CanvasRenderingContext2D} c - Context to draw on
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {string} gender - 'male' or 'female'
 * @param {string} color - Hex/RGB glow color
 * @param {number} angle - Time-based rotation angle/pulse value
 * @param {string} name - Name tag
 */
function drawAvatar(c, x, y, gender, color, angle, name = '') {
  c.save();
  c.translate(x, y);

  // Outer Aura Glow Ring
  c.shadowBlur = 15;
  c.shadowColor = color;
  c.lineWidth = 2;
  
  if (gender === 'male') {
    // ARES: Sleek Angular Shield & Wing Visor
    
    // Draw outer angular frame (rotating subtly)
    c.save();
    c.rotate(angle * 0.1);
    c.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const rx = 32 + Math.sin(angle * 1.5) * 1.5;
      c.lineTo(Math.cos(a) * rx, Math.sin(a) * rx);
    }
    c.closePath();
    c.stroke();
    c.restore();

    // Center Core (Shield Shape)
    c.fillStyle = color;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    
    c.beginPath();
    // Shield path
    c.moveTo(0, -18);
    c.lineTo(15, -10);
    c.lineTo(12, 10);
    c.lineTo(0, 20);
    c.lineTo(-12, 10);
    c.lineTo(-15, -10);
    c.closePath();
    c.fill();
    c.stroke();

    // Visor Accent
    c.shadowBlur = 0; // turn off shadow for tiny elements
    c.fillStyle = '#02030a';
    c.beginPath();
    c.ellipse(0, -2, 8, 3, 0, 0, Math.PI * 2);
    c.fill();
    
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, -2, 6, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    
    // Dual Wing accents sweeping backwards
    c.strokeStyle = color;
    c.lineWidth = 3.5;
    c.shadowBlur = 10;
    c.shadowColor = color;
    
    // Left Wing
    c.beginPath();
    c.moveTo(-15, -5);
    c.quadraticCurveTo(-28, -12, -26, 8);
    c.stroke();
    
    // Right Wing
    c.beginPath();
    c.moveTo(15, -5);
    c.quadraticCurveTo(28, -12, 26, 8);
    c.stroke();

  } else {
    // ATHENA: Elegant Radiant Crown & Aura Rings
    
    // Draw outer orbital aura ring (rotating)
    c.save();
    c.rotate(-angle * 0.2);
    c.strokeStyle = 'rgba(252, 0, 255, 0.2)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, 32, 0, Math.PI * 2);
    c.stroke();
    
    // Orbitting nodes on the ring
    const nodeA = angle * 1.2;
    c.fillStyle = color;
    c.beginPath();
    c.arc(Math.cos(nodeA) * 32, Math.sin(nodeA) * 32, 4, 0, Math.PI * 2);
    c.fill();
    
    c.beginPath();
    c.arc(Math.cos(nodeA + Math.PI) * 32, Math.sin(nodeA + Math.PI) * 32, 4, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Center Core (Elegant oval + diamond pattern)
    c.fillStyle = color;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 14, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Crown Peak (Top decoration)
    c.fillStyle = '#ffffff';
    c.shadowBlur = 10;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(-6, -24);
    c.lineTo(0, -20);
    c.lineTo(6, -24);
    c.closePath();
    c.fill();

    // Glowing Halo Crescent Ring
    c.strokeStyle = color;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, 3, 22, -Math.PI * 0.8, -Math.PI * 0.2, true); // bottom half arc
    c.stroke();
    
    // Star nodes on halo
    c.fillStyle = '#ffffff';
    c.shadowBlur = 0;
    c.beginPath();
    c.arc(Math.cos(-Math.PI * 0.8) * 22, Math.sin(-Math.PI * 0.8) * 22 + 3, 2.5, 0, Math.PI * 2);
    c.arc(Math.cos(-Math.PI * 0.2) * 22, Math.sin(-Math.PI * 0.2) * 22 + 3, 2.5, 0, Math.PI * 2);
    c.fill();
  }

  // Restore context transform before drawing text
  c.restore();

  // Name Tag & Score
  if (name) {
    c.save();
    c.font = 'bold 11px "Orbitron", sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.shadowBlur = 4;
    c.shadowColor = '#000000';
    c.fillText(name, x, y - PLAYER_RADIUS - 12);
    c.restore();
  }
}

// -----------------------------------------------------------------------------
// 3. GAMEPLAY & ENGINE SYSTEM
// -----------------------------------------------------------------------------

// Keyboard Action Listeners
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  
  if (key === 'e') {
    if (document.activeElement === chatInput) return;
    if (closestPlayerId) {
      interact(closestPlayerId);
    }
  }

  if (key === 'f') {
    if (document.activeElement === chatInput) return;
    if (closestPlayerId) {
      sendTeamInvite(closestPlayerId);
    }
  }

  if (['w', 'a', 's', 'd', 'r', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    // If typing in chat input, ignore movement key triggers
    if (document.activeElement === chatInput) return;
    keys[key] = true;
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;
});

// Click listener on floating proximity HUD element (with target split detection)
if (proximityPrompt) {
  proximityPrompt.addEventListener('click', (e) => {
    if (closestPlayerId) {
      // Check if user clicked near F-key or the Team Invite label
      if (e.target.classList.contains('f-key') || e.target.textContent.includes('Team Invite')) {
        sendTeamInvite(closestPlayerId);
      } else {
        interact(closestPlayerId);
      }
    }
  });
}

// Team Alliance Request Modals Click Handlers
if (btnAcceptTeam) {
  btnAcceptTeam.addEventListener('click', () => {
    if (pendingSenderId) {
      socket.emit('acceptTeamInvite', { senderId: pendingSenderId });
      teamRequestModal.classList.add('hidden');
      pendingSenderId = null;
    }
  });
}

if (btnDeclineTeam) {
  btnDeclineTeam.addEventListener('click', () => {
    if (pendingSenderId) {
      socket.emit('declineTeamInvite', { senderId: pendingSenderId });
      teamRequestModal.classList.add('hidden');
      pendingSenderId = null;
    }
  });
}

// Auth Modal controls
const btnPlayArena = document.getElementById('btn-play-arena');
const authModal = document.getElementById('auth-modal');
const btnCloseAuth = document.getElementById('btn-close-auth');

if (btnPlayArena && authModal) {
  btnPlayArena.addEventListener('click', () => {
    if (isJoined) {
      const loginOverlay = document.getElementById('auth-dashboard');
      if (loginOverlay) {
        loginOverlay.classList.add('fade-out');
        setTimeout(() => loginOverlay.classList.add('hidden'), 800);
      }
    } else {
      authModal.classList.remove('hidden');
    }
  });
}

if (btnCloseAuth && authModal) {
  btnCloseAuth.addEventListener('click', () => {
    authModal.classList.add('hidden');
  });
}

// Start game trigger
let authMode = 'login';

if (tabLogin) {
  tabLogin.addEventListener('click', () => {
    authMode = 'login';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    signupArchetypeGroup.classList.add('hidden');
    btnAuthSubmit.querySelector('span').textContent = 'LOG IN';
    authErrorBanner.classList.add('hidden');
  });
}

if (tabSignup) {
  tabSignup.addEventListener('click', () => {
    authMode = 'signup';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupArchetypeGroup.classList.remove('hidden');
    btnAuthSubmit.querySelector('span').textContent = 'CREATE ACCOUNT';
    authErrorBanner.classList.add('hidden');
  });
}

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value.trim();
  
  if (!username || !password) return;
  
  btnAuthSubmit.disabled = true;
  
  if (authMode === 'login') {
    socket.emit('login', { username, password });
  } else {
    socket.emit('signup', { username, password, gender: selectedGender });
  }
});

// Toggle Dual-Map mode (Virtual 3D Arena vs Real-World Leaflet Map)
if (btnToggleMap) {
  btnToggleMap.addEventListener('click', () => {
    isRealMapActive = !isRealMapActive;
    
    if (isRealMapActive) {
      realMapContainer.classList.remove('hidden');
      btnToggleMap.classList.add('active-mode');
      btnToggleMap.querySelector('span').textContent = '🎮 VIRTUAL ARENA';
      
      const me = players[selfId];
      const startCenter = (me && me.lat && me.lng) ? [me.lat, me.lng] : realMapCenter;
      
      // Initialize Leaflet Map once
      if (!realMap) {
        realMap = L.map('real-map-container', {
          zoomControl: true,
          attributionControl: false
        }).setView(startCenter, 16);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          maxZoom: 20
        }).addTo(realMap);
      } else {
        realMap.setView(startCenter, 16);
      }
      
      // Force leaflet refresh layout
      setTimeout(() => {
        realMap.invalidateSize();
      }, 100);
      
    } else {
      realMapContainer.classList.add('hidden');
      btnToggleMap.classList.remove('active-mode');
      btnToggleMap.querySelector('span').textContent = '🌐 REAL RADAR';
      
      // Clear markers when map is hidden
      Object.keys(realMapMarkers).forEach(id => {
        realMap.removeLayer(realMapMarkers[id]);
      });
      realMapMarkers = {};
    }
  });
}

// Socket Events Setup
socket.on('authResponse', (data) => {
  btnAuthSubmit.disabled = false;
  if (data.success) {
    authErrorBanner.classList.add('hidden');
  } else {
    authErrorBanner.textContent = data.message;
    authErrorBanner.classList.remove('hidden');
    playAlertSound();
  }
});

socket.on('init', (data) => {
  selfId = data.selfId;
  players = data.players;
  mapWidth = data.map.width;
  mapHeight = data.map.height;
  
  // Set local interpolation coordinates instantly
  Object.keys(players).forEach(id => {
    players[id].renderX = players[id].x;
    players[id].renderY = players[id].y;
  });

  // Assign orbs from server
  orbs = data.orbs;
  orbs.forEach(orb => {
    orb.pulseVal = Math.random() * Math.PI;
  });

  isJoined = true;
  
  const me = players[selfId];
  if (me && me.stats) {
    updateHUDStats(me.stats);
  }
  
  // Transition views smoothly (fade-out dashboard overlay)
  loginOverlay.classList.add('fade-out');
  gameView.classList.remove('hidden');
  
  // Initialize canvas width/height
  resizeCanvas();
  
  // Initialize 3D WebGL Engine
  initThreeJS();
  createStarfield();
  
  setTimeout(() => {
    loginOverlay.classList.add('hidden');
  }, 800);
  
  // Instantly create and add player meshes to scene on login/spawn
  Object.keys(players).forEach(id => {
    const p = players[id];
    if (p.renderX === undefined || p.renderX === null || isNaN(p.renderX)) p.renderX = p.x || 1000;
    if (p.renderY === undefined || p.renderY === null || isNaN(p.renderY)) p.renderY = p.y || 1000;
    
    const targetColor = getRelationshipColor(p);
    
    try {
      let meshGroup = playerMeshes[id];
      if (!meshGroup) {
        if (p.gender === 'female') {
          meshGroup = createAthenaMesh(targetColor);
        } else {
          meshGroup = createAresMesh(targetColor);
        }
        scene.add(meshGroup);
        playerMeshes[id] = meshGroup;
        meshGroup.position.set(p.renderX, 0, p.renderY);
        console.log('Mesh successfully created for player:', id, meshGroup);
      }
    } catch (err) {
      console.error('Error creating player mesh during init:', id, err);
    }
  });

  startGeolocationTracking();
  
  // Focus main gaming area
  window.focus();
  
  // Start Main Loop
  lastTime = Date.now();
  requestAnimationFrame(gameLoop);
  
  // Start latency tracking
  startPingInterval();
});

socket.on('playerJoined', (player) => {
  if (player.x === undefined || player.x === null || isNaN(player.x)) player.x = 1000;
  if (player.y === undefined || player.y === null || isNaN(player.y)) player.y = 1000;
  players[player.id] = player;
  players[player.id].renderX = player.x;
  players[player.id].renderY = player.y;

  // Instantly add to active WebGL scene if initialized
  if (scene) {
    if (player.renderX === undefined || player.renderX === null || isNaN(player.renderX)) player.renderX = player.x || 1000;
    if (player.renderY === undefined || player.renderY === null || isNaN(player.renderY)) player.renderY = player.y || 1000;
    
    const targetColor = getRelationshipColor(player);
    
    try {
      let meshGroup = playerMeshes[player.id];
      if (!meshGroup) {
        if (player.gender === 'female') {
          meshGroup = createAthenaMesh(targetColor);
        } else {
          meshGroup = createAresMesh(targetColor);
        }
        scene.add(meshGroup);
        playerMeshes[player.id] = meshGroup;
        meshGroup.position.set(player.renderX, 0, player.renderY);
        console.log('Mesh successfully created for joined player:', player.id, meshGroup);
      }
    } catch (err) {
      console.error('Error creating player mesh during playerJoined:', player.id, err);
    }
  }
  
  updateOnlineCount();
  updateLeaderboard();
});

socket.on('playerMoved', (data) => {
  if (players[data.id]) {
    // Update server position targets for smoothing
    players[data.id].x = data.x;
    players[data.id].y = data.y;
    players[data.id].lat = data.lat;
    players[data.id].lng = data.lng;
    if (data.heading !== undefined) {
      players[data.id].heading = data.heading;
      players[data.id].facingAngle = data.heading;
    }
  }
});

socket.on('playerLeft', (id) => {
  if (players[id]) {
    delete players[id];
    
    // Clean up Three.js mesh if active
    if (scene && playerMeshes[id]) {
      scene.remove(playerMeshes[id]);
      playerMeshes[id].traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      delete playerMeshes[id];
    }
    
    updateOnlineCount();
    updateLeaderboard();
  }
});

// Sync Orb Claimed Event
socket.on('orbClaimed', (data) => {
  const { orbId, playerId, score, newOrb } = data;
  
  // Find orb
  const orbIndex = orbs.findIndex(o => o.id === orbId);
  if (orbIndex !== -1) {
    const collectedOrb = orbs[orbIndex];
    // Trigger explosion effect
    spawnOrbExplosion(collectedOrb.x, collectedOrb.y, collectedOrb.color);
    
    // Clear old orb mesh if active
    if (scene && orbMeshes[orbId]) {
      scene.remove(orbMeshes[orbId]);
      orbMeshes[orbId].geometry.dispose();
      orbMeshes[orbId].material.dispose();
      delete orbMeshes[orbId];
    }
    
    // Remove old orb and push new one
    orbs.splice(orbIndex, 1);
    
    newOrb.pulseVal = Math.random() * Math.PI;
    orbs.push(newOrb);
  }
  
  // Update player score
  if (players[playerId]) {
    players[playerId].score = score;
    
    // If it's self, trigger audio & milestone notification
    if (playerId === selfId) {
      playCoinSound();
      if (score % 50 === 0) {
        showLevelUpNotification(`Aether Core Charged! Score: ${score}`);
      }
    }
  }
  
  updateLeaderboard();
});

// Proximity Interaction Socket Event
socket.on('playerInteracted', (data) => {
  const sender = players[data.fromId];
  const beamColor = sender ? sender.color : '#00f2fe';
  spawnInteractionBeam(data.fromId, data.toId, beamColor);
});

// Team invite request received event
socket.on('teamInviteReceived', (data) => {
  pendingSenderId = data.senderId;
  teamRequestSender.textContent = data.senderName;
  teamRequestModal.classList.remove('hidden');
  
  // Flash alert sound
  playAlertSound();
});

// Relationship Alliance status update
socket.on('relationshipUpdate', (data) => {
  const { player1, player2, status } = data;
  
  // Update locally for both players
  const p1 = players[player1];
  const p2 = players[player2];
  
  if (p1 && p2) {
    if (!p1.allies) p1.allies = [];
    if (!p1.enemies) p1.enemies = [];
    if (!p2.allies) p2.allies = [];
    if (!p2.enemies) p2.enemies = [];
    
    const fxColor = status === 'ally' ? '#9EC7FF' : '#A30000';
    
    if (status === 'ally') {
      if (!p1.allies.includes(player2)) p1.allies.push(player2);
      if (!p2.allies.includes(player1)) p2.allies.push(player1);
      
      p1.enemies = p1.enemies.filter(id => id !== player2);
      p2.enemies = p2.enemies.filter(id => id !== player1);
    } else {
      if (!p1.enemies.includes(player2)) p1.enemies.push(player2);
      if (!p2.enemies.includes(player1)) p2.enemies.push(player1);
      
      p1.allies = p1.allies.filter(id => id !== player2);
      p2.allies = p2.allies.filter(id => id !== player1);
    }
    
    // Spawn alliance/hostility sparks at players' rendering coordinates
    spawnRelationshipSpark(player1, player2, fxColor);
  }
});

// Tactical Mission Started Event
socket.on('missionStart', () => {
  isMissionActive = true;
  hudMission.classList.remove('hidden');
  showLevelUpNotification("🔴 ALERT: Hunt and Eliminate Hostiles!");
  playAlertSound();
});

// Tactical Mission Completed Event
socket.on('missionComplete', () => {
  isMissionActive = false;
  hudMission.classList.add('hidden');
  showLevelUpNotification("🏆 VICTORY: Rogue Drone Neutralized!");
  playMissionCompleteSound();
});

// Player or Bot Neutralized Event
socket.on('playerEliminated', (data) => {
  const target = players[data.targetId];
  if (target) {
    // Spawn massive red explosion sparks
    spawnOrbExplosion(target.renderX, target.renderY, '#A30000');
    spawnOrbExplosion(target.renderX, target.renderY, '#A30000');
    
    // Play structural damage explosion chime
    playExplosionSound();
  }
  
  // Update winner score locally
  if (players[data.winnerId]) {
    players[data.winnerId].score = data.winnerScore;
    updateLeaderboard();
  }
});

// Client Respawn placement coordinates reset
socket.on('respawned', (data) => {
  const me = players[selfId];
  if (me) {
    me.x = data.x;
    me.y = data.y;
    me.renderX = data.x;
    me.renderY = data.y;
    me.score = 0;
  }
  
  // Reset players coordinate registry
  players = data.players;
  
  // Show notification
  showLevelUpNotification("⚠️ Neutralized! Quantum Respawn Activated.");
  playAlertSound();
  updateLeaderboard();
});

// Clear relationships on client respawn
socket.on('relationshipReset', (data) => {
  const p = players[data.playerId];
  if (p) {
    p.allies = [];
    p.enemies = [];
    p.color = '#a0a6cc'; // reset to neutral bot/player grey
  }
  
  // Clean references in all other player objects
  Object.keys(players).forEach(id => {
    const other = players[id];
    if (other.allies) other.allies = other.allies.filter(aid => aid !== data.playerId);
    if (other.enemies) other.enemies = other.enemies.filter(eid => eid !== data.playerId);
  });
});

// Real-time Player Stats Uplink updates
socket.on('statsUpdate', (data) => {
  if (data.playerId === selfId) {
    updateHUDStats(data.stats);
  }
});

// Broadcasted Player Class selection changes
socket.on('playerClassChanged', (data) => {
  if (players[data.id]) {
    players[data.id].pilotClass = data.class;
    players[data.id].gender = data.gender;
    if (scene) {
      updatePlayerMeshClass(data.id, data.class, data.gender);
    }
  }
});

// Real-time Combat telemetry alerts
socket.on('playerFiredLaser', (data) => {
  if (players[data.id]) {
    players[data.id].heading = data.heading;
    players[data.id].facingAngle = data.heading;
    fireLaser(data.id);
  }
});

socket.on('playerDeployedShield', (data) => {
  deployShield(data.id);
});

socket.on('botDestroyed', (data) => {
  if (players[data.killerId]) {
    players[data.killerId].score = data.killerScore;
  }
  
  const bot = players[data.botId];
  if (bot) {
    spawnSparks(bot.renderX, bot.renderY, '#ff00ea');
  }
  
  appendEngineLog(`> BOT ELIMINATED: Sector cleared by pilot ${data.killerName}.`);
  updateLeaderboard();
});

// Chat Log Events
socket.on('chatMessage', (msg) => {
  const isScrolledToBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 10;
  
  const msgEl = document.createElement('p');
  
  if (msg.type === 'system') {
    msgEl.className = 'system-message';
    msgEl.innerHTML = `<strong>[SYS]</strong> ${msg.text}`;
  } else if (msg.type === 'pm') {
    msgEl.className = 'pm-message';
    msgEl.innerHTML = `<span class="msg-sender" style="color: #fc00ff">${msg.sender}:</span><span class="msg-text" style="color: #ffc2fc; font-style: italic;">${msg.text}</span>`;
  } else {
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `<span class="msg-sender" style="color: ${msg.color}">${msg.sender}:</span><span class="msg-text">${msg.text}</span>`;
  }
  
  chatMessages.appendChild(msgEl);
  
  // Auto-scroll if player wasn't scrolling up to read old log
  if (isScrolledToBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

// Chat Submit Action
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('sendMessage', text);
    chatInput.value = '';
    // Reset PM placeholder to default when they send a message
    chatInput.placeholder = 'Type a message...';
    // Unfocus input to return controls to movement keys
    chatInput.blur();
  }
});

// -----------------------------------------------------------------------------
// 4. ENERGY ORBS GAMEPLAY LOOP (SERVER SYNCHRONIZED)
// -----------------------------------------------------------------------------

function checkOrbCollisions(me) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const dx = me.renderX - orbs[i].x;
    const dy = me.renderY - orbs[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Collision detect (radius match)
    if (distance < PLAYER_RADIUS + orbs[i].size) {
      // Send claim event to server for verification
      socket.emit('claimOrb', orbs[i].id);
    }
  }
}

// Web Audio API procedural sound generation
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playCoinSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Classic electronic futuristic chime: fast pitch slide
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(1174.66, audioCtx.currentTime + 0.15); // D6
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (err) {
    // Ignore audio failures if browser blocks context
  }
}

function playAlertSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Two-tone space alert chime
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1); // E5
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (err) {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// 5. MAIN RENDER & UPDATE LOOP
// -----------------------------------------------------------------------------

let lastTime = Date.now();
let rotationTime = 0;

function gameLoop() {
  if (!isJoined) return;
  
  const now = Date.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  
  // Track rotation angles for aesthetics
  rotationTime += 0.1;
  
  // 1. UPDATE LOCAL MOVEMENT
  updateLocalPlayer(dt);
  
  // 2. SMOOTH INTERPOLATE ALL OTHER PLAYERS
  interpolateOtherPlayers();
  
  // 3. CHECK COLLIDERS
  const me = players[selfId];
  if (me) {
    checkOrbCollisions(me);
    updateProximity(me);
    if (isMissionActive) {
      updateMissionCompass(me);
    }
  }
  
  // 4. ANIMATE TRAILS & PARTICLES
  updateParticles();
  
  // 5. RENDER EVERYTHING ON CANVAS (Three.js WebGL rendering)
  renderCanvas();
  
  // 7. RENDER MINI RADAR MAP
  renderMinimap();
  
  // 8. RENDER REAL-WORLD LEAFLET RADAR OVERLAY
  if (isRealMapActive) {
    updateRealWorldMap();
  }
  
  requestAnimationFrame(gameLoop);
}

function updateLocalPlayer() {
  const me = players[selfId];
  if (!me) return;
  
  // Sanitize positions to prevent NaN coordinate issues
  if (me.x === undefined || me.x === null || isNaN(me.x)) me.x = 1000;
  if (me.y === undefined || me.y === null || isNaN(me.y)) me.y = 1000;
  if (me.renderX === undefined || me.renderX === null || isNaN(me.renderX)) me.renderX = me.x;
  if (me.renderY === undefined || me.renderY === null || isNaN(me.renderY)) me.renderY = me.y;
  
  let dx = 0;
  let dy = 0;
  
  // WASD / WARD / Arrows (lowercase & supporting R for down movement)
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['r'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  
  if (dx !== 0 || dy !== 0) {
    // Normalize vector to avoid diagonal speed gains
    const length = Math.sqrt(dx * dx + dy * dy);
    const moveX = (dx / length) * playerSpeed;
    const moveY = (dy / length) * playerSpeed;
    
    const oldX = me.x;
    const oldY = me.y;
    
    // Apply displacement
    me.x += moveX;
    me.y += moveY;
    
    // Map bounds checking
    me.x = Math.max(PLAYER_RADIUS, Math.min(mapWidth - PLAYER_RADIUS, me.x));
    me.y = Math.max(PLAYER_RADIUS, Math.min(mapHeight - PLAYER_RADIUS, me.y));
    
    // Client-side prediction instantly updates render coordinates
    me.renderX = me.x;
    me.renderY = me.y;
    
    // If coordinates changed, notify server
    if (me.x !== oldX || me.y !== oldY) {
      socket.emit('playerMove', { x: me.x, y: me.y, heading: me.facingAngle || 0 });
      
      // Add thrust engine particles
      if (Math.random() < 0.4) {
        spawnThrustParticle(me.renderX, me.renderY, -moveX, -moveY, getRelationshipColor(me));
      }
    }
  }

  // Update D-pad Coordinate Display
  let direction = "STANDING BY";
  if (dx > 0 && dy === 0) direction = "MOVING EAST";
  else if (dx < 0 && dy === 0) direction = "MOVING WEST";
  else if (dx === 0 && dy < 0) direction = "MOVING NORTH";
  else if (dx === 0 && dy > 0) direction = "MOVING SOUTH";
  else if (dx > 0 && dy < 0) direction = "MOVING NORTH-EAST";
  else if (dx < 0 && dy < 0) direction = "MOVING NORTH-WEST";
  else if (dx > 0 && dy > 0) direction = "MOVING SOUTH-EAST";
  else if (dx < 0 && dy > 0) direction = "MOVING SOUTH-WEST";

  const coordsOverlay = document.getElementById("hud-coordinates-overlay");
  if (coordsOverlay) {
    const me = players[selfId];
    if (me) {
      coordsOverlay.textContent = `${direction} [X: ${Math.round(me.x)}, Y: ${Math.round(me.y)}]`;
      
      // Set glowing colors based on movement direction
      if (direction !== "STANDING BY") {
        coordsOverlay.style.color = "#ff00ea"; // Glowing Pink on move
        coordsOverlay.style.textShadow = "0 0 10px #ff00ea, 0 0 5px #ff00ea";
      } else {
        coordsOverlay.style.color = "#00f2fe"; // Glowing Cyan when standing still
        coordsOverlay.style.textShadow = "0 0 10px #00f2fe, 0 0 5px #00f2fe";
      }
    }
  }
}

function interpolateOtherPlayers() {
  Object.keys(players).forEach(id => {
    if (id === selfId) return; // Skip self
    
    const p = players[id];
    
    // Initialize render coords if not exists
    if (p.renderX === undefined) p.renderX = p.x;
    if (p.renderY === undefined) p.renderY = p.y;
    
    // Interpolation (lerp) speed coefficient (0.15 makes it very smooth)
    const lerpSpeed = 0.15;
    const dx = p.x - p.renderX;
    const dy = p.y - p.renderY;
    
    p.renderX += dx * lerpSpeed;
    p.renderY += dy * lerpSpeed;
    
    // Spawn subtle movement engine particles behind other players if moving
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (speed > 0.5 && Math.random() < 0.25) {
      spawnThrustParticle(p.renderX, p.renderY, -dx * 0.1, -dy * 0.1, getRelationshipColor(p));
    }
  });
}

function renderCanvas() {
  if (!scene) return; // Wait until Three.js is initialized

  // 1. UPDATE AND SPAWN PLAYER MESHES
  const activeIds = new Set(Object.keys(players));
  
  // Clean up meshes of players who left
  Object.keys(playerMeshes).forEach(id => {
    if (!activeIds.has(id)) {
      scene.remove(playerMeshes[id]);
      playerMeshes[id].traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      delete playerMeshes[id];
    }
  });

  // Render and update existing players
  Object.keys(players).forEach(id => {
    const p = players[id];
    const me = players[selfId];
    
    // Ensure coordinates are initialized
    if (p.renderX === undefined || p.renderX === null || isNaN(p.renderX)) p.renderX = p.x || 1000;
    if (p.renderY === undefined || p.renderY === null || isNaN(p.renderY)) p.renderY = p.y || 1000;

    // Check relative coloring
    const targetColor = getRelationshipColor(p);

    try {
      let meshGroup = playerMeshes[id];
      if (!meshGroup) {
        // Build 3D mesh representation
        if (p.gender === 'female') {
          meshGroup = createAthenaMesh(targetColor);
        } else {
          meshGroup = createAresMesh(targetColor);
        }
        scene.add(meshGroup);
        playerMeshes[id] = meshGroup;
        console.log('Mesh successfully created inside renderCanvas:', id, meshGroup);
        
        // Cache initial coords for heading calculations
        p.lastX = p.renderX;
        p.lastY = p.renderY;
      } else {
      // If color state changes (e.g. alliance invite accepts), dynamically update material color
      meshGroup.traverse(child => {
        if (child.material && child.material.color) {
          const col = new THREE.Color(targetColor);
          child.material.color.copy(col);
          if (child.material.emissive) child.material.emissive.copy(col);
        }
      });
    }

    // Hover floating effect
    const hoverY = 4 + Math.sin(Date.now() * 0.0035 + (p.joinedAt || 0) % 1000) * 1.5;
    meshGroup.position.set(p.renderX, hoverY, p.renderY);

    // Orientation Heading rotation
    const dx = p.renderX - (p.lastX || p.renderX);
    const dz = p.renderY - (p.lastY || p.renderY);
    const speed = Math.sqrt(dx * dx + dz * dz);
    
    if (speed > 0.05) {
      const heading = Math.atan2(dz, dx);
      p.facingAngle = -heading + Math.PI / 2;
      meshGroup.rotation.y = p.facingAngle;
    } else {
      if (p.facingAngle === undefined) {
        p.facingAngle = p.heading || 0;
      }
      
      // Idle rotation for female Athena
      if (p.gender === 'female') {
        p.facingAngle += 0.015;
      }
      meshGroup.rotation.y = p.facingAngle;
    }
    
    // Save last coords
    p.lastX = p.renderX;
    p.lastY = p.renderY;
    } catch (err) {
      console.error('Error rendering player mesh in renderCanvas:', id, err);
    }
  });

  // 1.5. Update and render active combat lasers
  updateLasers();

  // 2. UPDATE AND SPAWN ORB MESHES
  const activeOrbIds = new Set(orbs.map(o => o.id));
  
  // Clean up old orbs
  Object.keys(orbMeshes).forEach(id => {
    if (!activeOrbIds.has(id)) {
      scene.remove(orbMeshes[id]);
      orbMeshes[id].geometry.dispose();
      orbMeshes[id].material.dispose();
      delete orbMeshes[id];
    }
  });

  // Spawn new orbs
  orbs.forEach(orb => {
    let orbMesh = orbMeshes[orb.id];
    if (!orbMesh) {
      const size = orb.size || 3.5;
      const orbGeo = new THREE.SphereGeometry(size, 8, 8);
      const orbMat = new THREE.MeshBasicMaterial({ color: orb.color });
      orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.position.set(orb.x, 3.5, orb.y);
      scene.add(orbMesh);
      orbMeshes[orb.id] = orbMesh;
    }
    
    // Float orbs up/down
    orb.pulseVal += 0.04;
    orbMesh.position.y = 3.5 + Math.sin(orb.pulseVal) * 1.2;
  });

  // 3. UPDATE TACTICAL MISSION ARROWHELPER
  const me = players[selfId];
  if (me && arrowHelper) {
    let closestEnemy = null;
    let minDist = Infinity;
    
    Object.keys(players).forEach(id => {
      if (id === selfId) return;
      const p = players[id];
      if (me.enemies && me.enemies.includes(p.id) && p.renderX !== undefined && p.renderX > -100) {
        const dx = p.renderX - me.renderX;
        const dy = p.renderY - me.renderY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestEnemy = p;
        }
      }
    });

    if (isMissionActive && closestEnemy) {
      const dirX = closestEnemy.renderX - me.renderX;
      const dirZ = closestEnemy.renderY - me.renderY;
      const dirVec = new THREE.Vector3(dirX, 0, dirZ).normalize();
      
      arrowHelper.setDirection(dirVec);
      // Position right above player
      arrowHelper.position.set(me.renderX, 14, me.renderY);
      arrowHelper.visible = true;
    } else {
      arrowHelper.visible = false;
    }
  }

  // 4. PERSPECTIVE CAMERA TRACKING (Follow behind player in 3D)
  if (me) {
    if (me.renderX === 0 && me.renderY === 0) {
      camera.position.set(0, 150, 400);
      camera.lookAt(0, 0, 0);
    } else {
      // Tilted camera position tracking (orbiting at distance)
      const targetCamX = me.renderX;
      const targetCamY = 180; // Elevated height
      const targetCamZ = me.renderY + 140; // Distance behind player
      
      // Snap instantly on first frame to prevent slow travel lag from 0,0,0
      if (camera.position.x === 0 && camera.position.y === 0 && camera.position.z === 0) {
        camera.position.set(targetCamX, targetCamY, targetCamZ);
      } else {
        camera.position.x += (targetCamX - camera.position.x) * 0.1;
        camera.position.y += (targetCamY - camera.position.y) * 0.1;
        camera.position.z += (targetCamZ - camera.position.z) * 0.1;
      }
      
      camera.lookAt(me.renderX, 4, me.renderY);
    }
  }

  // 5. RENDER WEBGL SCENE
  renderer.render(scene, camera);
}

// -----------------------------------------------------------------------------
// 7. RADAR MINI-MAP RENDER
// -----------------------------------------------------------------------------

function renderMinimap() {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Set transparent grid fill
  minimapCtx.fillStyle = 'rgba(2, 3, 10, 0.6)';
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  const scaleX = minimapCanvas.width / mapWidth;
  const scaleY = minimapCanvas.height / mapHeight;

  // Draw boundary border on minimap
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  // Draw Orbs as tiny gray dots (simplified)
  minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  orbs.forEach(o => {
    minimapCtx.fillRect(o.x * scaleX, o.y * scaleY, 1.5, 1.5);
  });

  // Draw other players
  Object.keys(players).forEach(id => {
    const p = players[id];
    if (id === selfId) return; // Skip self for colored highlight
    const me = players[selfId];
    
    const dotColor = getRelationshipColor(p);
    
    minimapCtx.fillStyle = dotColor;
    minimapCtx.beginPath();
    minimapCtx.arc(p.renderX * scaleX, p.renderY * scaleY, 2.5, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Draw local player (flashing white dot)
  const localPlayer = players[selfId];
  if (localPlayer) {
    const pulseAlpha = 0.5 + Math.sin(rotationTime * 1.5) * 0.5;
    minimapCtx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    minimapCtx.beginPath();
    minimapCtx.arc(localPlayer.renderX * scaleX, localPlayer.renderY * scaleY, 3.5, 0, Math.PI * 2);
    minimapCtx.fill();
    
    // Draw crosshair ring around local player
    minimapCtx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    minimapCtx.lineWidth = 0.5;
    minimapCtx.beginPath();
    minimapCtx.arc(localPlayer.renderX * scaleX, localPlayer.renderY * scaleY, 8, 0, Math.PI * 2);
    minimapCtx.stroke();
  }
}

// -----------------------------------------------------------------------------
// 8. PARTICLE TRAIL & FX SYSTEM
// -----------------------------------------------------------------------------

function spawnThrustParticle(x, y, vx, vy, color) {
  // Spawn trail behind engine exhaust
  particles.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    vx: vx * 0.5 + (Math.random() - 0.5) * 0.5,
    vy: vy * 0.5 + (Math.random() - 0.5) * 0.5,
    size: Math.random() * 3 + 2,
    alpha: 0.8,
    decay: Math.random() * 0.03 + 0.02,
    color: color,
    glow: false
  });
}

function spawnOrbExplosion(x, y, color) {
  // Spark effect on collection
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 1.5,
      alpha: 1,
      decay: Math.random() * 0.04 + 0.02,
      color: color,
      glow: true
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    
    if (p.type === 'beam') {
      const fromP = players[p.fromId];
      const toP = players[p.toId];
      
      if (!fromP || !toP) {
        particles.splice(i, 1);
        continue;
      }
      
      p.t += p.speed;
      
      if (p.t >= 1) {
        particles.splice(i, 1);
        continue;
      }
      
      // Interpolate base line from source to destination
      const baseX = fromP.renderX + (toP.renderX - fromP.renderX) * p.t;
      const baseY = fromP.renderY + (toP.renderY - fromP.renderY) * p.t;
      
      // Swirl around in a helix spiral
      p.angle += p.offsetSpeed;
      const spiralRadius = p.offsetRadius * Math.sin(p.t * Math.PI); // peaks in the middle, decays at ends
      
      p.x = baseX + Math.cos(p.angle) * spiralRadius;
      p.y = baseY + Math.sin(p.angle) * spiralRadius;
      p.alpha = Math.sin(p.t * Math.PI) * 0.85; // fades out near characters
      p.size = Math.max(0.5, p.size - 0.01);
      
    } else {
      // Normal physics particle
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      p.size -= 0.05;
      
      if (p.alpha <= 0 || p.size <= 0.2) {
        particles.splice(i, 1);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 9. UI HELPERS & NOTIFICATIONS
// -----------------------------------------------------------------------------

function updateOnlineCount() {
  const count = Object.keys(players).length;
  onlineCountText.textContent = `Players Online: ${count}`;
}

function updateLeaderboard() {
  // Convert players object to array and sort by score descending, then join date ascending
  const sorted = Object.values(players).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt - b.joinedAt;
  });
  
  leaderboardList.innerHTML = '';
  
  // Show top 7 players
  const displayCount = Math.min(sorted.length, 7);
  
  if (sorted.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-list">Searching for lifeforms...</li>';
    return;
  }
  
  for (let i = 0; i < displayCount; i++) {
    const p = sorted[i];
    const li = document.createElement('li');
    if (p.id === selfId) {
      li.className = 'me';
    }
    
    li.innerHTML = `
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name" style="color: ${p.color}">${p.name}</span>
      <span class="lb-score">${p.score}</span>
    `;
    leaderboardList.appendChild(li);
  }
}

function showLevelUpNotification(text) {
  notificationContainer.textContent = text;
  notificationContainer.className = 'fade-in-notification';
  
  // Reset animation after 1.5s
  setTimeout(() => {
    notificationContainer.className = 'fade-out-notification';
  }, 1500);
}

// -----------------------------------------------------------------------------
// 10. LATENCY & HEARTBEAT TIMER
// -----------------------------------------------------------------------------

function startPingInterval() {
  setInterval(() => {
    lastPingTime = Date.now();
    socket.emit('pingTest');
  }, 3000);
}

socket.on('pongTest', () => {
  pingValue = Date.now() - lastPingTime;
  pingText.textContent = `Ping: ${pingValue}ms`;
});

// -----------------------------------------------------------------------------
// 11. PROXIMITY LOGIC AND INTERACTIVE UI HELPERS
// -----------------------------------------------------------------------------

function updateProximity(me) {
  let nearby = [];
  
  // Calculate distances to other players
  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    
    // Safety check for coordinates
    if (p.renderX === undefined || p.renderY === undefined) return;
    
    const dx = me.renderX - p.renderX;
    const dy = me.renderY - p.renderY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= PROXIMITY_RANGE) {
      nearby.push({ id: id, name: p.name, color: p.color, dist: dist });
    }
  });

  // Sort by distance (closest first)
  nearby.sort((a, b) => a.dist - b.dist);

  if (nearby.length > 0) {
    // 1. Show Proximity Prompt for closest target
    const closest = nearby[0];
    closestPlayerId = closest.id;
    
    promptTargetName.textContent = closest.name;
    promptTargetName.style.color = closest.color;
    promptTargetDist.textContent = Math.round(closest.dist);
    
    proximityPrompt.classList.remove('hidden');
    
    // 2. Show and Populate Nearby Pilots Panel
    nearbyPlayersPanel.classList.remove('hidden');
    nearbyPlayersList.innerHTML = '';
    
    nearby.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="nb-info">
          <span class="nb-name" style="color: ${p.color}">${p.name}</span>
          <span class="nb-dist">${Math.round(p.dist)}m</span>
        </div>
        <div class="nb-actions">
          <button class="btn-nearby-interact" data-id="${p.id}">Interact</button>
          <button class="btn-nearby-team" data-id="${p.id}">Invite</button>
        </div>
      `;
      nearbyPlayersList.appendChild(li);
    });
    
    // Bind click listeners on the interact buttons
    const interactBtns = nearbyPlayersList.querySelectorAll('.btn-nearby-interact');
    interactBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        interact(id);
      });
    });

    // Bind click listeners on the team invitation buttons
    const teamBtns = nearbyPlayersList.querySelectorAll('.btn-nearby-team');
    teamBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        sendTeamInvite(id);
      });
    });
    
  } else {
    // Hide panels
    closestPlayerId = null;
    proximityPrompt.classList.add('hidden');
    nearbyPlayersPanel.classList.add('hidden');
  }
}

function interact(targetId) {
  if (players[targetId]) {
    // 1. Emit connection interaction to the server
    socket.emit('interactWith', { targetId: targetId });
    
    // 2. Focus the chat input box and prepopulate it with a whisper
    chatInput.focus();
    chatInput.placeholder = `Talk to ${players[targetId].name}...`;
    // Pre-populate with direct message command format
    chatInput.value = `/msg @${players[targetId].name} `;
  }
}

function sendTeamInvite(targetId) {
  if (players[targetId]) {
    socket.emit('sendTeamInvite', { targetId: targetId });
  }
}

function spawnRelationshipSpark(p1Id, p2Id, color) {
  const p1 = players[p1Id];
  const p2 = players[p2Id];
  if (p1) spawnOrbExplosion(p1.renderX, p1.renderY, color);
  if (p2) spawnOrbExplosion(p2.renderX, p2.renderY, color);
}

function spawnInteractionBeam(fromId, toId, color) {
  for (let i = 0; i < 40; i++) {
    particles.push({
      type: 'beam',
      fromId: fromId,
      toId: toId,
      t: 0,
      speed: 0.015 + Math.random() * 0.015,
      angle: Math.random() * Math.PI * 2,
      offsetRadius: Math.random() * 25 + 10,
      offsetSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.08),
      size: Math.random() * 3.5 + 2,
      color: color,
      alpha: 0,
      glow: true
    });
  }
}

// Computes nearest hostile target coordinates and rotates HUD compass
function updateMissionCompass(me) {
  let closestEnemy = null;
  let minDist = Infinity;
  
  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    
    // Check if player is an active enemy and currently spawned on map
    if (me.enemies && me.enemies.includes(p.id) && p.renderX !== undefined && p.renderX > -100) {
      const dx = p.renderX - me.renderX;
      const dy = p.renderY - me.renderY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist) {
        minDist = dist;
        closestEnemy = p;
      }
    }
  });

  if (closestEnemy) {
    const dx = closestEnemy.renderX - me.renderX;
    const dy = closestEnemy.renderY - me.renderY;
    compassAngle = Math.atan2(dy, dx);
    
    // Rotate the HTML arrow: ▲ points UP (which is -Math.PI/2).
    // Adding Math.PI/2 (90deg) offsets the arrow to point directly towards the target angle.
    const deg = (compassAngle + Math.PI / 2) * (180 / Math.PI);
    missionCompassArrow.style.transform = `rotate(${deg}deg)`;
    
    missionTargetInfo.textContent = `Hostile: ${closestEnemy.name} (${Math.round(minDist)}m)`;
    missionTargetInfo.style.color = '#A30000';
  } else {
    compassAngle = null;
    missionCompassArrow.style.transform = 'rotate(0deg)';
    missionTargetInfo.textContent = 'Hostile: Invite bot & get rejected to create target!';
    missionTargetInfo.style.color = 'var(--text-secondary)';
  }
}

// Procedural Synth: Deep low-frequency bass drop explosion
function playExplosionSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.45);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.55);
  } catch (err) {
    // Ignore audio contexts blocks
  }
}

// Procedural Synth: Rising arpeggio victory chime
function playMissionCompleteSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    // Play C Major ascending arpeggio notes
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
    
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.65);
  } catch (err) {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// 9. THREE.JS 3D WEBGL ENGINE CONSTRUCTORS
// -----------------------------------------------------------------------------

function initThreeJS() {
  try {
    console.log('Initializing Three.js context...');
    
    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030816); // Deep space navy background
    scene.fog = new THREE.FogExp2(0x030816, 0.0015);

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 150, 300);
    camera.lookAt(0, 0, 0);

    // 3. Setup WebGL Renderer
    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // 4. Light Sources
    ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(100, 300, 100);
    scene.add(dirLight);

    // Glowing corner point lights
    const lightWhite = new THREE.PointLight(0xffffff, 1.2, 400);
    lightWhite.position.set(0, 30, 0);
    scene.add(lightWhite);

    const lightSilver = new THREE.PointLight(0x9ec7ff, 1.2, 400);
    lightSilver.position.set(mapWidth, 30, mapHeight);
    scene.add(lightSilver);

    // 5. Futuristic grid floor (neon cyan center lines, tech blue grids)
    gridHelper = new THREE.GridHelper(2000, 80, 0x00f2fe, 0x1f3d7a);
    gridHelper.position.set(1000, 0, 1000);
    scene.add(gridHelper);

    // Semigloss floor plane (navy steel holographic floor)
    const floorGeo = new THREE.PlaneGeometry(2000, 2000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a142c,
      roughness: 0.5,
      metalness: 0.8
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(1000, -0.2, 1000);
    scene.add(floorMesh);

    // 6. Tactical Compass Navigation Arrow Helper
    const origin = new THREE.Vector3(1000, 12, 1000);
    const dir = new THREE.Vector3(1, 0, 0);
    arrowHelper = new THREE.ArrowHelper(dir, origin, 22, 0xA30000, 8, 4);
    arrowHelper.visible = false;
    scene.add(arrowHelper);

    // Border boundaries
    addVisualBoundaries();
    console.log('Three.js initialized successfully.');
  } catch (err) {
    console.error('Fatal error during initThreeJS initialization:', err);
  }
}

function addVisualBoundaries() {
  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide
  });
  
  const wallGeo = new THREE.PlaneGeometry(2000, 50);
  
  // Top Wall
  const wallT = new THREE.Mesh(wallGeo, wallMat);
  wallT.position.set(1000, 25, 0);
  scene.add(wallT);
  
  // Bottom Wall
  const wallB = new THREE.Mesh(wallGeo, wallMat);
  wallB.position.set(1000, 25, 2000);
  scene.add(wallB);
  
  // Left Wall
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.rotation.y = Math.PI / 2;
  wallL.position.set(0, 25, 1000);
  scene.add(wallL);
  
  // Right Wall
  const wallR = new THREE.Mesh(wallGeo, wallMat);
  wallR.rotation.y = Math.PI / 2;
  wallR.position.set(2000, 25, 1000);
  scene.add(wallR);
}

function getRelationshipColor(p) {
  if (!p) return '#FFFFFF';
  const me = players[selfId];
  if (me) {
    if (me.allies && me.allies.includes(p.id)) return '#DCDCDC'; // Silver (Ally) - High Contrast
    if (me.enemies && me.enemies.includes(p.id)) return '#FFFFFF'; // Stark White (Enemy) - High Contrast
  }
  return '#FFFFFF'; // Neutral (Stark White) - High Contrast
}

function createAresMesh(colorStr) {
  try {
    const group = new THREE.Group();
    const color = new THREE.Color(colorStr || '#FFFFFF');
    
    // Materials
    const mainMat = new THREE.MeshBasicMaterial({ color: color });
    const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xff0055 }); // Red glowing visor
    
    // Center body: Sleek pyramid (Cone Geometry)
    const bodyGeo = new THREE.ConeGeometry(8, 22, 4);
    const body = new THREE.Mesh(bodyGeo, mainMat);
    body.rotation.x = Math.PI / 2; // Lie flat along movement axis
    body.position.y = 10;
    group.add(body);
    
    // Wings: Left wing
    const wingGeo = new THREE.BoxGeometry(16, 2, 8);
    const leftWing = new THREE.Mesh(wingGeo, mainMat);
    leftWing.position.set(-10, 10, 2);
    leftWing.rotation.y = 0.4;
    leftWing.rotation.z = -0.2;
    group.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeo, mainMat);
    rightWing.position.set(10, 10, 2);
    rightWing.rotation.y = -0.4;
    rightWing.rotation.z = 0.2;
    group.add(rightWing);
    
    // Visor: Glowing accent on front of nose
    const visorGeo = new THREE.BoxGeometry(6, 2, 2);
    const visor = new THREE.Mesh(visorGeo, neonRedMat);
    visor.position.set(0, 10, -9);
    group.add(visor);
    
    group.position.y = 0;
    return group;
  } catch (err) {
    console.error('Error in createAresMesh:', err);
    return new THREE.Group();
  }
}

function createAthenaMesh(colorStr) {
  try {
    const group = new THREE.Group();
    const color = new THREE.Color(colorStr || '#FFFFFF');
    
    // Materials
    const mainMat = new THREE.MeshBasicMaterial({ color: color });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff00ea }); // Pink glowing halo
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    
    // Center body: Sphere core
    const coreGeo = new THREE.SphereGeometry(7, 16, 16);
    const core = new THREE.Mesh(coreGeo, mainMat);
    core.position.y = 12;
    group.add(core);
    
    // Crown: Spike on top
    const crownGeo = new THREE.ConeGeometry(2.5, 8, 4);
    const crown = new THREE.Mesh(crownGeo, goldMat);
    crown.position.set(0, 19, 0);
    group.add(crown);
    
    // Orbiting Aura Ring (Torus Geometry)
    const ringGeo = new THREE.TorusGeometry(12, 1.2, 8, 32);
    const ring = new THREE.Mesh(ringGeo, neonPinkMat);
    ring.position.set(0, 12, 0);
    ring.rotation.x = Math.PI / 2.5; // Tilted angle
    group.add(ring);
    
    group.position.y = 0;
    return group;
  } catch (err) {
    console.error('Error in createAthenaMesh:', err);
    return new THREE.Group();
  }
}

function createStarfield() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 350;
  const posArray = new Float32Array(starCount * 3);
  const colorArray = new Float32Array(starCount * 3);
  
  const white = new THREE.Color(0xffffff);
  const silver = new THREE.Color(0xdcdcdc);
  
  for (let i = 0; i < starCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 3200;      // X coordinates
    posArray[i+1] = Math.random() * 220 + 40;        // Y (height)
    posArray[i+2] = (Math.random() - 0.5) * 3200;    // Z coordinates
    
    // Randomly select between white and metallic silver
    const c = Math.random() > 0.45 ? white : silver;
    colorArray[i] = c.r;
    colorArray[i+1] = c.g;
    colorArray[i+2] = c.b;
  }
  
  starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  
  const starMat = new THREE.PointsMaterial({
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });
  
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

// Converts relative 2000x2000 arena coords to real-world SF Lat/Lng coordinates
function gameCoordsToLatLng(x, y) {
  const lat = realMapCenter[0] + (y - 1000) * 0.0000035;
  const lng = realMapCenter[1] + (x - 1000) * 0.0000045;
  return [lat, lng];
}

// Real-World GPS mode Leaflet rendering
function updateRealWorldMap() {
  if (!realMap || !isRealMapActive) return;
  
  const activeIds = new Set(Object.keys(players));
  
  // Remove markers for players who disconnected
  Object.keys(realMapMarkers).forEach(id => {
    if (!activeIds.has(id)) {
      realMap.removeLayer(realMapMarkers[id]);
      delete realMapMarkers[id];
    }
  });
  
  // Update/Create markers for all active pilots
  Object.keys(players).forEach(id => {
    const p = players[id];
    if (p.renderX === undefined || p.renderX === null || isNaN(p.renderX) ||
        p.renderY === undefined || p.renderY === null || isNaN(p.renderY)) {
      return;
    }
    const me = players[selfId];
    const [lat, lng] = gameCoordsToLatLng(p.renderX, p.renderY);
    
    // Choose neon color class based on relationship
    let colorClass = 'radar-dot-green'; // Default Green (Neutral)
    let labelText = `${p.name} (Neutral)`;
    
    if (id === selfId) {
      labelText = `${p.name} (You)`;
    }
    
    if (me) {
      if (me.allies && me.allies.includes(id)) {
        colorClass = 'radar-dot-blue'; // Ally Blue
        labelText = `${p.name} (Ally)`;
      } else if (me.enemies && me.enemies.includes(id)) {
        colorClass = 'radar-dot-red'; // Enemy Red
        labelText = `${p.name} (Enemy)`;
      }
    }
    
    let marker = realMapMarkers[id];
    if (!marker) {
      const customIcon = L.divIcon({
        className: 'custom-radar-marker',
        html: `<div class="radar-dot ${colorClass}"></div>`
      });
      
      marker = L.marker([lat, lng], { icon: customIcon }).addTo(realMap);
      marker.bindTooltip(labelText, {
        permanent: false,
        direction: 'top',
        className: 'marker-tooltip-styled'
      });
      
      realMapMarkers[id] = marker;
    } else {
      // Set new coordinate location
      marker.setLatLng([lat, lng]);
      
      // Update HTML classes dynamically
      const el = marker.getElement();
      if (el) {
        const dot = el.querySelector('.radar-dot');
        if (dot) {
          dot.className = `radar-dot ${colorClass}`;
        }
      }
      
      // Update Tooltip details
      marker.setTooltipContent(labelText);
    }
  });
}

// Watch geolocation to track user's real latitude/longitude
let geoWatchId = null;
function startGeolocationTracking() {
  if (navigator.geolocation) {
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Emit GPS updates to server
        socket.emit('gpsUpdate', { lat: lat, lng: lng });

        // Update locally instantly for prediction
        const me = players[selfId];
        if (me) {
          me.lat = lat;
          me.lng = lng;

          // Convert coordinates locally for game-plane alignment
          me.x = Math.max(20, Math.min(mapWidth - 20, 1000 + (lng - realMapCenter[1]) / 0.0000045));
          me.y = Math.max(20, Math.min(mapHeight - 20, 1000 + (lat - realMapCenter[0]) / 0.0000035));

          me.renderX = me.x;
          me.renderY = me.y;
        }
      },
      (err) => {
        console.warn('Geolocation sensor lookup failed:', err.message);
        // Keyboard movement acts as automatic development fallback
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 6000
      }
    );
  } else {
    console.warn('Geolocation not supported by browser.');
  }
}

// -----------------------------------------------------------------------------
// 12. DYNAMIC STATE BINDINGS & SIDEBAR INTERACTIVITY
// -----------------------------------------------------------------------------

// Dynamically updates loadout stats bars & values
function updateHUDStats(stats) {
  if (!stats) return;
  const barDamage = document.getElementById('bar-damage');
  const valDamage = document.getElementById('val-damage');
  const barRange = document.getElementById('bar-range');
  const valRange = document.getElementById('val-range');
  const barAccuracy = document.getElementById('bar-accuracy');
  const valAccuracy = document.getElementById('val-accuracy');
  
  if (barDamage && valDamage) {
    barDamage.style.width = `${stats.damage}%`;
    valDamage.textContent = `${stats.damage}%`;
  }
  if (barRange && valRange) {
    barRange.style.width = `${stats.range}%`;
    valRange.textContent = `${stats.range}%`;
  }
  if (barAccuracy && valAccuracy) {
    barAccuracy.style.width = `${stats.accuracy}%`;
    valAccuracy.textContent = `${stats.accuracy}%`;
  }
}

// Re-creates and resizes 3D player mesh based on their Class / Archetype
function updatePlayerMeshClass(id, className, gender) {
  let meshGroup = playerMeshes[id];
  if (!meshGroup) return;
  
  // Clean up existing meshes
  scene.remove(meshGroup);
  meshGroup.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  
  // Custom colors and scales for different deployment pilot classes
  let color = '#FFFFFF';
  let scale = 1.0;
  
  if (className === 'manta') {
    color = '#00f2fe'; // Neon Cyan
    scale = 1.25; // Large Tanky ship
    meshGroup = createAresMesh(color);
  } else if (className === 'ghost') {
    color = '#ff00ea'; // Glowing Pink
    scale = 0.85; // Sleek small stealth ship
    meshGroup = createAthenaMesh(color);
  } else if (className === 'scyla') {
    color = '#ffd700'; // Golden/Amber
    scale = 1.05; // Balanced medium class
    meshGroup = createAthenaMesh(color);
  } else {
    color = getRelationshipColor(players[id]);
    meshGroup = gender === 'female' ? createAthenaMesh(color) : createAresMesh(color);
  }
  
  meshGroup.scale.set(scale, scale, scale);
  scene.add(meshGroup);
  playerMeshes[id] = meshGroup;
  
  // If it's local player, log success
  if (id === selfId) {
    console.log(`[SUCCESS] Local pilot mesh updated to class: ${className}, scale: ${scale}`);
  }
}

// Populates and directly displays the alliances grid panel on demand
function showAlliancesPanelDirectly() {
  if (!nearbyPlayersPanel) return;
  nearbyPlayersPanel.classList.remove('hidden');
  nearbyPlayersList.innerHTML = '';
  
  const me = players[selfId];
  let count = 0;
  
  Object.keys(players).forEach(id => {
    if (id === selfId) return;
    const p = players[id];
    const relColor = getRelationshipColor(p);
    let relationshipText = 'Neutral';
    
    if (me) {
      if (me.allies && me.allies.includes(p.id)) relationshipText = 'Ally';
      if (me.enemies && me.enemies.includes(p.id)) relationshipText = 'Enemy';
    }
    
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="nb-info">
        <span class="nb-name" style="color: ${relColor}">${p.name} [${relationshipText}]</span>
        <span class="nb-dist">${p.isBot ? 'Bot Drone' : 'Pilot'}</span>
      </div>
      <div class="nb-actions">
        <button class="btn-nearby-interact" data-id="${p.id}">Interact</button>
        <button class="btn-nearby-team" data-id="${p.id}">Invite</button>
      </div>
    `;
    nearbyPlayersList.appendChild(li);
    count++;
  });
  
  if (count === 0) {
    nearbyPlayersList.innerHTML = '<li class="empty-list">No other active pilots in sector.</li>';
  }
  
  // Bind click listeners
  const interactBtns = nearbyPlayersList.querySelectorAll('.btn-nearby-interact');
  interactBtns.forEach(btn => {
    btn.addEventListener('click', () => interact(btn.getAttribute('data-id')));
  });
  
  const teamBtns = nearbyPlayersList.querySelectorAll('.btn-nearby-team');
  teamBtns.forEach(btn => {
    btn.addEventListener('click', () => sendTeamInvite(btn.getAttribute('data-id')));
  });
}

// Bind Sidebar UI Interactive triggers
const sidebarRadar = document.getElementById('sidebar-radar');
const sidebarAlliances = document.getElementById('sidebar-alliances');
const sidebarBoost = document.getElementById('sidebar-boost');
const sidebarSettings = document.getElementById('sidebar-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');

let boostActive = false;

// 1. Radar map toggle uplink
if (sidebarRadar) {
  sidebarRadar.addEventListener('click', () => {
    if (btnToggleMap) btnToggleMap.click();
  });
}

// 2. High-speed boost drive trigger (Overclocks speed for 4s)
if (sidebarBoost) {
  sidebarBoost.addEventListener('click', () => {
    if (boostActive) return;
    boostActive = true;
    playerSpeed = 11; // Overclocked speed (more than double default 5)
    sidebarBoost.style.background = 'rgba(0, 242, 254, 0.2)';
    sidebarBoost.style.borderColor = 'rgba(0, 242, 254, 0.6)';
    
    showLevelUpNotification("⚡ Neural Drive OVERCLOCKED! Thrusters at 220%.");
    
    setTimeout(() => {
      playerSpeed = 5;
      boostActive = false;
      sidebarBoost.style.background = '';
      sidebarBoost.style.borderColor = '';
      showLevelUpNotification("⚡ Neural Drive cooled down. Thrusters returned to 100%.");
    }, 4000);
  });
}

// 3. Alliances panel display toggle
if (sidebarAlliances) {
  sidebarAlliances.addEventListener('click', () => {
    if (nearbyPlayersPanel) {
      if (nearbyPlayersPanel.classList.contains('hidden')) {
        showAlliancesPanelDirectly();
      } else {
        nearbyPlayersPanel.classList.add('hidden');
      }
    }
  });
}

// 4. Pilot profile settings telemetry modal trigger
if (sidebarSettings && settingsModal) {
  sidebarSettings.addEventListener('click', () => {
    const me = players[selfId];
    if (me) {
      document.getElementById('settings-username').textContent = me.name;
      document.getElementById('settings-class').textContent = me.pilotClass || 'manta';
      document.getElementById('settings-highscore').textContent = `${me.score || 0} PTS`;
    }
    settingsModal.classList.remove('hidden');
  });
}

if (btnCloseSettings && settingsModal) {
  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
}

if (btnSaveSettings && settingsModal) {
  btnSaveSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
}

// -----------------------------------------------------------------------------
// 13. PILOT CLASS CAROUSEL, D-PAD & ENGINE TELEMETRY LOGS
// -----------------------------------------------------------------------------

// Active class rendering initial setup
updateCarouselSelection();

// Bind D-pad movement triggers (mouse down & release simulation)
function startDpadMovement(keyName) {
  keys[keyName] = true;
}

function stopDpadMovement(keyName) {
  keys[keyName] = false;
}

const dpadUp = document.getElementById('dpad-up');
const dpadDown = document.getElementById('dpad-down');
const dpadLeft = document.getElementById('dpad-left');
const dpadRight = document.getElementById('dpad-right');

if (dpadUp) {
  dpadUp.addEventListener('mousedown', () => startDpadMovement('w'));
  dpadUp.addEventListener('mouseup', () => stopDpadMovement('w'));
  dpadUp.addEventListener('mouseleave', () => stopDpadMovement('w'));
  dpadUp.addEventListener('touchstart', (e) => { e.preventDefault(); startDpadMovement('w'); });
  dpadUp.addEventListener('touchend', () => stopDpadMovement('w'));
}
if (dpadDown) {
  dpadDown.addEventListener('mousedown', () => startDpadMovement('s'));
  dpadDown.addEventListener('mouseup', () => stopDpadMovement('s'));
  dpadDown.addEventListener('mouseleave', () => stopDpadMovement('s'));
  dpadDown.addEventListener('touchstart', (e) => { e.preventDefault(); startDpadMovement('s'); });
  dpadDown.addEventListener('touchend', () => stopDpadMovement('s'));
}
if (dpadLeft) {
  dpadLeft.addEventListener('mousedown', () => startDpadMovement('a'));
  dpadLeft.addEventListener('mouseup', () => stopDpadMovement('a'));
  dpadLeft.addEventListener('mouseleave', () => stopDpadMovement('a'));
  dpadLeft.addEventListener('touchstart', (e) => { e.preventDefault(); startDpadMovement('a'); });
  dpadLeft.addEventListener('touchend', () => stopDpadMovement('a'));
}
if (dpadRight) {
  dpadRight.addEventListener('mousedown', () => startDpadMovement('d'));
  dpadRight.addEventListener('mouseup', () => stopDpadMovement('d'));
  dpadRight.addEventListener('mouseleave', () => stopDpadMovement('d'));
  dpadRight.addEventListener('touchstart', (e) => { e.preventDefault(); startDpadMovement('d'); });
  dpadRight.addEventListener('touchend', () => stopDpadMovement('d'));
}

// Telemetry Log Box dynamic generator
const engineLogsBox = document.getElementById("engine-logs-box");
const mockCombatLogs = [
  "HACK DETECTED in Sector X-799...",
  "Quantum shield deployed at 94%...",
  "Synapse breach mitigated.",
  "Neural uplink latency synced at 4ms.",
  "EXO-thruster fuel core stabilized.",
  "Telemetry vectors converging on target...",
  "Alliance signal established in Grid A-12.",
  "Intrusion script quarantined in buffer.",
  "Anomaly identified in Leaflet GPS radar feed.",
  "Aetheria core engine reboot completed."
];

function appendEngineLog(text) {
  if (!engineLogsBox) return;
  const p = document.createElement("p");
  p.style.margin = "0";
  p.style.borderLeft = "2px solid rgba(0, 242, 254, 0.4)";
  p.style.paddingLeft = "6px";
  p.innerHTML = `<span style="color: #1f3d7a;">[${new Date().toLocaleTimeString()}]</span> ${text}`;
  engineLogsBox.appendChild(p);
  
  // Smooth scroll to bottom
  engineLogsBox.scrollTop = engineLogsBox.scrollHeight;
}

// Fire continuous telemetry logs every 2 seconds
setInterval(() => {
  if (isJoined) {
    const log = mockCombatLogs[Math.floor(Math.random() * mockCombatLogs.length)];
    appendEngineLog(`> ${log}`);
  }
}, 2000);

// -----------------------------------------------------------------------------
// 14. 3D HOLOGRAM PREVIEW, COMBAT PROJECTILES & SHIELD SYSTEMS
// -----------------------------------------------------------------------------

// Initialize pre-login 3D hologram avatar
let hologramScene, hologramCamera, hologramRenderer, hologramMesh;

function initHologramPreview() {
  const canvas = document.getElementById('hologram-preview-canvas');
  if (!canvas) return;
  
  const width = canvas.clientWidth || 300;
  const height = canvas.clientHeight || 180;
  
  hologramScene = new THREE.Scene();
  hologramCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  hologramCamera.position.set(0, 0, 30);
  
  hologramRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  hologramRenderer.setSize(width, height);
  hologramRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  hologramScene.add(ambient);
  const directional = new THREE.DirectionalLight(0x00f2fe, 1.8);
  directional.position.set(5, 5, 5);
  hologramScene.add(directional);
  
  // Geometry
  const geometry = new THREE.OctahedronGeometry(9, 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00f2fe,
    wireframe: true,
    transparent: true,
    opacity: 0.75
  });
  hologramMesh = new THREE.Mesh(geometry, material);
  hologramScene.add(hologramMesh);
  
  const innerGeom = new THREE.TorusGeometry(5, 1, 8, 24);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xff00ea,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  const innerMesh = new THREE.Mesh(innerGeom, innerMat);
  innerMesh.rotation.x = Math.PI / 2;
  hologramMesh.add(innerMesh);
  
  function animateHologram() {
    if (isJoined) {
      hologramRenderer.dispose();
      return;
    }
    requestAnimationFrame(animateHologram);
    
    hologramMesh.rotation.y += 0.012;
    hologramMesh.rotation.z += 0.006;
    
    // Match carousel select colors
    const cls = cyberClasses[activeClassIndex];
    if (cls) {
      if (cls.color === "#ff00ea") {
        material.color.setHex(0xff00ea);
        innerMat.color.setHex(0x00f2fe);
      } else if (cls.color === "#ffd700") {
        material.color.setHex(0xffd700);
        innerMat.color.setHex(0xff00ea);
      } else {
        material.color.setHex(0x00f2fe);
        innerMat.color.setHex(0xff00ea);
      }
    }
    
    hologramRenderer.render(hologramScene, hologramCamera);
  }
  animateHologram();
}

// Call pre-login hologram loader
initHologramPreview();

// Web Audio API Synthesizer (Zero asset audio)
let audioCtx = null;

function playLaserSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.frequency.setValueAtTime(900, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.18);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  } catch (e) {
    console.warn("Audio Context blocked by browser auto-play policy.");
  }
}

// Laser project storage array
let lasers = [];

function fireLaser(playerId) {
  const p = players[playerId];
  if (!p) return;
  
  const heading = p.facingAngle || 0;
  
  // Laser geometry
  const geometry = new THREE.CylinderGeometry(1.2, 1.2, 16, 6);
  geometry.rotateX(Math.PI / 2);
  
  const targetColor = playerId === selfId ? 0xff00ea : 0x00f2fe;
  const material = new THREE.MeshBasicMaterial({
    color: targetColor,
    transparent: true,
    opacity: 0.95
  });
  
  const laserMesh = new THREE.Mesh(geometry, material);
  laserMesh.position.set(p.renderX, 14, p.renderY);
  
  // Trajectory direction
  const speed = 14;
  const vx = Math.sin(heading) * speed;
  const vz = Math.cos(heading) * speed;
  
  laserMesh.rotation.y = heading;
  scene.add(laserMesh);
  
  lasers.push({
    mesh: laserMesh,
    vx: vx,
    vz: vz,
    playerId: playerId,
    createdAt: Date.now(),
    lifeTime: 1200
  });
  
  // Play sound locally
  if (playerId === selfId) {
    playLaserSound();
  }
}

function updateLasers() {
  const now = Date.now();
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    
    if (now - l.createdAt > l.lifeTime) {
      scene.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
      lasers.splice(i, 1);
      continue;
    }
    
    l.mesh.position.x += l.vx;
    l.mesh.position.z += l.vz;
    
    // Local player hit detection validation
    if (l.playerId === selfId) {
      Object.keys(players).forEach(id => {
        const target = players[id];
        if (target.isBot) {
          const dx = l.mesh.position.x - target.renderX;
          const dz = l.mesh.position.z - target.renderY;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist < 40) {
            socket.emit('botHit', { botId: id });
            
            // Delete laser projectile
            scene.remove(l.mesh);
            l.mesh.geometry.dispose();
            l.mesh.material.dispose();
            lasers.splice(i, 1);
          }
        }
      });
    }
  }
}

// Deploy protective shield bubble
function deployShield(playerId) {
  const p = players[playerId];
  if (!p) return;
  
  const meshGroup = playerMeshes[playerId];
  if (!meshGroup) return;
  
  const geom = new THREE.SphereGeometry(24, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00f2fe,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  
  const shieldMesh = new THREE.Mesh(geom, mat);
  meshGroup.add(shieldMesh);
  
  p.hasShield = true;
  
  setTimeout(() => {
    meshGroup.remove(shieldMesh);
    geom.dispose();
    mat.dispose();
    p.hasShield = false;
  }, 3000);
}

// Bind combat keys & click triggers
function bindCombatControls() {
  const btnLaser = document.getElementById('btn-fire-laser');
  const btnShield = document.getElementById('btn-deploy-shield');
  
  if (btnLaser) {
    btnLaser.addEventListener('click', () => {
      triggerLocalLaserAttack();
    });
  }
  
  if (btnShield) {
    btnShield.addEventListener('click', () => {
      triggerLocalShieldDeploy();
    });
  }
  
  window.addEventListener('keydown', (e) => {
    if (!isJoined) return;
    
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      triggerLocalLaserAttack();
    }
    
    if (e.key.toLowerCase() === 'f') {
      triggerLocalShieldDeploy();
    }
  });
}

function triggerLocalLaserAttack() {
  const me = players[selfId];
  if (!me) return;
  
  const now = Date.now();
  if (me.lastLaserTime && now - me.lastLaserTime < 450) return;
  me.lastLaserTime = now;
  
  fireLaser(selfId);
  socket.emit('fireLaser', { heading: me.facingAngle || 0 });
}

function triggerLocalShieldDeploy() {
  const me = players[selfId];
  if (!me) return;
  
  const now = Date.now();
  if (me.lastShieldTime && now - me.lastShieldTime < 8000) {
    showLevelUpNotification("🛡️ SHIELD CHARGING: Systems cooling down.");
    return;
  }
  me.lastShieldTime = now;
  
  deployShield(selfId);
  socket.emit('deployShield');
  showLevelUpNotification("🛡️ SHIELD ACTIVE: Nanite barrier online!");
}

// Start combat inputs
bindCombatControls();

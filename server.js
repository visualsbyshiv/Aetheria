const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Port and DB URL safety for Microsoft Azure environments
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/aetheria';

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const MAX_ORBS = 60;
const MAX_BOTS = 3;

// Map tech hub center coordinates (SF Golden Gate Park)
const CENTER_LAT = 37.7694;
const CENTER_LNG = -122.4862;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection status state
let isDatabaseConnected = false;

// Connect to MongoDB / CosmosDB
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log('Successfully connected to MongoDB/CosmosDB database.');
    isDatabaseConnected = true;
  })
  .catch(err => {
    console.warn('MongoDB not found on localhost. Automatically activated IN-MEMORY FALLBACK DATABASE.');
    isDatabaseConnected = false;
  });

// User schema structure for persistent logins, scores, and relationship lists
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  gender: { type: String, default: 'male' },
  pilotClass: { type: String, default: 'manta' }, // store active pilot class
  highScore: { type: Number, default: 0 },
  allies: { type: [String], default: [] }, // store user names of allies
  enemies: { type: [String], default: [] }  // store user names of enemies
});

const User = mongoose.model('User', userSchema);

// Pre-populated in-memory test profiles (Fallback for local dev environments without MongoDB running)
const mockUsers = [
  { username: 'admin', password: 'password', gender: 'male', pilotClass: 'manta', highScore: 150, allies: [], enemies: [] },
  { username: 'pilot1', password: 'password', gender: 'female', pilotClass: 'ghost', highScore: 80, allies: [], enemies: [] }
];

// Store active players and AI bots
const players = {};

// Store energy orbs
let orbs = [];

// Color helper
const colors = [
  '#00F2FE', // Neon Cyan
  '#4FACFE', // Ocean Blue
  '#fc00ff', // Neon Pink
  '#c900ff', // Neon Purple
  '#13E28F', // Mint Green
  '#FAD961', // Canary Yellow
  '#F76B1C', // Tangerine
  '#FF5E5B', // Sunset Red
  '#7F00FF'  // Electric Violet
];

// AI Bot names
const BOT_NAMES = ['Aegis-Bot', 'Vortex-Drone', 'Spectre-Bot', 'Nova-Unit', 'Titan-Drone'];

// Helper to spawn a single energy orb
function generateOrb() {
  return {
    id: 'orb_' + Math.random().toString(36).substring(2, 11),
    x: Math.floor(Math.random() * (MAP_WIDTH - 80)) + 40,
    y: Math.floor(Math.random() * (MAP_HEIGHT - 80)) + 40,
    size: Math.floor(Math.random() * 4) + 4,
    color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`
  };
}

// Populate initial orbs
for (let i = 0; i < MAX_ORBS; i++) {
  orbs.push(generateOrb());
}

// Spawn AI Target Bots (acting as real-world simulated coordinates)
function spawnBots() {
  for (let i = 0; i < MAX_BOTS; i++) {
    const id = `bot_${i}`;
    const padding = 200;
    const x = Math.floor(Math.random() * (MAP_WIDTH - padding * 2)) + padding;
    const y = Math.floor(Math.random() * (MAP_HEIGHT - padding * 2)) + padding;
    
    // Project relative coordinates to Lat/Lng for bots
    const botLat = CENTER_LAT + (y - 1000) * 0.0000035;
    const botLng = CENTER_LNG + (x - 1000) * 0.0000045;

    players[id] = {
      id: id,
      name: BOT_NAMES[i],
      gender: Math.random() > 0.5 ? 'male' : 'female',
      x: x,
      y: y,
      lat: botLat,
      lng: botLng,
      color: '#a0a6cc', // Neutral grey for default bots
      score: 0,
      joinedAt: Date.now(),
      allies: [],
      enemies: [],
      isBot: true,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3
    };
  }
}
spawnBots();

// Haversine Formula: Computes real-world distance in meters from GPS latitude/longitude pings
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null || 
      lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Distance helper combining Haversine GPS (meters) and local coordinate fallbacks
function getPlayersDistance(p1, p2) {
  if (p1.lat && p1.lng && p2.lat && p2.lng) {
    return calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
  }
  // Fallback to relative grid distance (meters equivalent on keyboard fallback)
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Permanent DB relationship updates helper
async function saveRelationshipToDatabase(p1Name, p2Name, status) {
  if (!isDatabaseConnected) {
    // Falls back to in-memory profiles
    const user1 = mockUsers.find(u => u.username.toLowerCase() === p1Name.toLowerCase());
    const user2 = mockUsers.find(u => u.username.toLowerCase() === p2Name.toLowerCase());
    if (user1 && user2) {
      if (status === 'ally') {
        if (!user1.allies.includes(user2.username)) user1.allies.push(user2.username);
        if (!user2.allies.includes(user1.username)) user2.allies.push(user1.username);
        user1.enemies = user1.enemies.filter(name => name !== user2.username);
        user2.enemies = user2.enemies.filter(name => name !== user1.username);
      } else {
        if (!user1.enemies.includes(user2.username)) user1.enemies.push(user2.username);
        if (!user2.enemies.includes(user1.username)) user2.enemies.push(user1.username);
        user1.allies = user1.allies.filter(name => name !== user2.username);
        user2.allies = user2.allies.filter(name => name !== user1.username);
      }
    }
    return;
  }

  try {
    const user1 = await User.findOne({ username: p1Name });
    const user2 = await User.findOne({ username: p2Name });

    if (user1 && user2) {
      if (status === 'ally') {
        if (!user1.allies.includes(user2.username)) user1.allies.push(user2.username);
        if (!user2.allies.includes(user1.username)) user2.allies.push(user1.username);
        user1.enemies = user1.enemies.filter(name => name !== user2.username);
        user2.enemies = user2.enemies.filter(name => name !== user1.username);
      } else {
        if (!user1.enemies.includes(user2.username)) user1.enemies.push(user2.username);
        if (!user2.enemies.includes(user1.username)) user2.enemies.push(user1.username);
        user1.allies = user1.allies.filter(name => name !== user2.username);
        user2.allies = user2.allies.filter(name => name !== user1.username);
      }
      await user1.save();
      await user2.save();
    }
  } catch (err) {
    console.error('Error saving relationship to Mongoose database:', err);
  }
}

// Async high score update
function updateHighScoreInDB(username, score) {
  if (!isDatabaseConnected) {
    const user = mockUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user && score > user.highScore) {
      user.highScore = score;
    }
    return;
  }

  User.findOne({ username }).then(user => {
    if (user && score > user.highScore) {
      user.highScore = score;
      user.save();
    }
  }).catch(err => console.error('Error updating Mongoose high score:', err));
}

// AI wandering and Proximity loops (every 100ms)
setInterval(() => {
  const playerIds = Object.keys(players);
  
  // 1. Move Bots
  playerIds.forEach(id => {
    const p = players[id];
    if (p.isBot) {
      if (Math.random() < 0.08) {
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = (Math.random() - 0.5) * 4;
      }
      
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 30 || p.x > MAP_WIDTH - 30) p.vx *= -1;
      if (p.y < 30 || p.y > MAP_HEIGHT - 30) p.vy *= -1;
      
      p.x = Math.max(30, Math.min(MAP_WIDTH - 30, p.x));
      p.y = Math.max(30, Math.min(MAP_HEIGHT - 30, p.y));

      // Keep Lat/Lng synced for bot Haversine checks
      p.lat = CENTER_LAT + (p.y - 1000) * 0.0000035;
      p.lng = CENTER_LNG + (p.x - 1000) * 0.0000045;

      io.emit('playerMoved', {
        id: p.id,
        x: p.x,
        y: p.y,
        lat: p.lat,
        lng: p.lng
      });
    }
  });

  // 2. Proximity Combat & Elimination Loop (based on 100 meters Haversine GPS range check)
  const humanIds = playerIds.filter(id => !players[id].isBot);

  // Proximity damage hazard check (Inflict stats reduction near bot drones or enemies)
  humanIds.forEach(humanId => {
    const human = players[humanId];
    if (!human) return;
    
    playerIds.forEach(otherId => {
      if (humanId === otherId) return;
      const other = players[otherId];
      if (!other) return;
      
      const dx = human.x - other.x;
      const dy = human.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 80) {
        let isHostile = other.isBot || (human.enemies && human.enemies.includes(other.name));
        if (isHostile) {
          if (human.stats) {
            human.stats.health = Math.max(0, human.stats.health - 2);
            human.stats.damage = Math.max(20, human.stats.damage - 1);
            human.stats.accuracy = Math.max(20, human.stats.accuracy - 1);
            
            const pSocket = io.sockets.sockets.get(humanId);
            if (pSocket) {
              pSocket.emit('statsUpdate', {
                playerId: humanId,
                stats: human.stats
              });
            }
          }
        }
      }
    });
  });
  
  humanIds.forEach(humanId => {
    const human = players[humanId];
    if (!human) return;
    
    playerIds.forEach(otherId => {
      if (humanId === otherId) return;
      const other = players[otherId];
      if (!other) return;
      
      const realDist = getPlayersDistance(human, other);
      
      // Proximity check: Trigger combat/elimination when they overlap closer in game space (30px)
      // or come within combat ranges in the real world
      if (human.enemies && human.enemies.includes(other.name) && realDist < 30) {
        eliminatePlayer(humanId, otherId);
      }
    });
  });

}, 100);

// Core elimination resolver
function eliminatePlayer(winnerId, loserId) {
  const winner = players[winnerId];
  const loser = players[loserId];
  if (!winner || !loser) return;

  console.log(`Elimination: ${winner.name} neutralized ${loser.name}`);

  winner.score += loser.isBot ? 50 : 100;
  updateHighScoreInDB(winner.name, winner.score);

  io.emit('playerEliminated', {
    targetId: loserId,
    winnerId: winnerId,
    winnerScore: winner.score
  });

  io.emit('chatMessage', {
    sender: 'System',
    text: `💥 HOSTILITY ENGAGED: ${winner.name} neutralized ${loser.name}!`,
    type: 'system',
    timestamp: Date.now()
  });

  io.to(winnerId).emit('missionComplete');
  if (winner.allies) {
    winner.allies.forEach(allyId => {
      const socketId = Object.keys(players).find(sid => players[sid].name === allyId);
      if (socketId) io.to(socketId).emit('missionComplete');
    });
  }

  if (loser.isBot) {
    loser.x = -9999;
    loser.y = -9999;
    loser.lat = null;
    loser.lng = null;
    
    Object.keys(players).forEach(id => {
      const p = players[id];
      if (p.allies) p.allies = p.allies.filter(name => name !== loser.name);
      if (p.enemies) p.enemies = p.enemies.filter(name => name !== loser.name);
    });
    loser.allies = [];
    loser.enemies = [];

    io.emit('playerLeft', loserId);

    setTimeout(() => {
      const padding = 200;
      loser.x = Math.floor(Math.random() * (MAP_WIDTH - padding * 2)) + padding;
      loser.y = Math.floor(Math.random() * (MAP_HEIGHT - padding * 2)) + padding;
      loser.lat = CENTER_LAT + (loser.y - 1000) * 0.0000035;
      loser.lng = CENTER_LNG + (loser.x - 1000) * 0.0000045;
      loser.color = '#a0a6cc';
      
      io.emit('playerJoined', loser);
    }, 4000);
  } else {
    const padding = 200;
    loser.x = Math.floor(Math.random() * (MAP_WIDTH - padding * 2)) + padding;
    loser.y = Math.floor(Math.random() * (MAP_HEIGHT - padding * 2)) + padding;
    loser.lat = CENTER_LAT + (loser.y - 1000) * 0.0000035;
    loser.lng = CENTER_LNG + (loser.x - 1000) * 0.0000045;
    
    // Clear live lists
    loser.allies = [];
    loser.enemies = [];

    // Clear relationships in DB / Fallback permanently
    if (!isDatabaseConnected) {
      const user = mockUsers.find(u => u.username.toLowerCase() === loser.name.toLowerCase());
      if (user) {
        user.allies = [];
        user.enemies = [];
      }
    } else {
      User.findOneAndUpdate({ username: loser.name }, { allies: [], enemies: [] }).exec();
    }

    // Clear relationships for active players
    Object.keys(players).forEach(id => {
      const p = players[id];
      if (p.allies) p.allies = p.allies.filter(name => name !== loser.name);
      if (p.enemies) p.enemies = p.enemies.filter(name => name !== loser.name);
    });

    io.to(loserId).emit('respawned', {
      x: loser.x,
      y: loser.y,
      players: players
    });

    io.emit('playerMoved', {
      id: loserId,
      x: loser.x,
      y: loser.y,
      lat: loser.lat,
      lng: loser.lng
    });

    io.emit('relationshipReset', {
      playerId: loserId
    });
  }
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('pingTest', () => {
    socket.emit('pongTest');
  });

  // Handle Signup request (saves securely to Mongoose / Falls back to in-memory)
  socket.on('signup', async (data) => {
    const username = data.username ? data.username.trim().substring(0, 15) : '';
    const password = data.password ? data.password.trim() : '';
    const gender = data.gender === 'female' ? 'female' : 'male';
    
    if (username === '' || password === '') {
      socket.emit('authResponse', { success: false, mode: 'signup', message: 'Username and password cannot be empty.' });
      return;
    }
    
    if (!isDatabaseConnected) {
      const exists = mockUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        socket.emit('authResponse', { success: false, mode: 'signup', message: 'Username already taken.' });
        return;
      }
      const newUser = { username, password, gender, highScore: 0, allies: [], enemies: [] };
      mockUsers.push(newUser);
      console.log(`Signup success (Fallback): ${username}`);
      socket.emit('authResponse', { success: true, mode: 'signup', message: 'Signup successful! Welcome pilot.' });
      loginPlayerSocket(socket, newUser);
      return;
    }
    
    try {
      const exists = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
      if (exists) {
        socket.emit('authResponse', { success: false, mode: 'signup', message: 'Username already taken.' });
        return;
      }
      
      const newUser = new User({ username, password, gender });
      await newUser.save();
      
      console.log(`Signup success: ${username}`);
      
      socket.emit('authResponse', { 
        success: true, 
        mode: 'signup', 
        message: 'Signup successful! Welcome pilot.' 
      });
      
      loginPlayerSocket(socket, newUser);
    } catch (err) {
      console.error(err);
      socket.emit('authResponse', { success: false, mode: 'signup', message: 'Database error occurred during registration.' });
    }
  });

  // Handle Login request (queries securely from Mongoose / Falls back to in-memory)
  socket.on('login', async (data) => {
    const username = data.username ? data.username.trim() : '';
    const password = data.password ? data.password.trim() : '';
    
    if (username === '' || password === '') {
      socket.emit('authResponse', { success: false, mode: 'login', message: 'Username and password cannot be empty.' });
      return;
    }
    
    if (!isDatabaseConnected) {
      const user = mockUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (!user) {
        socket.emit('authResponse', { success: false, mode: 'login', message: 'Invalid username or password.' });
        return;
      }
      const alreadyLoggedIn = Object.keys(players).some(id => players[id].name.toLowerCase() === username.toLowerCase());
      if (alreadyLoggedIn) {
        socket.emit('authResponse', { success: false, mode: 'login', message: 'User is already active in the arena!' });
        return;
      }
      console.log(`Login success (Fallback): ${username}`);
      socket.emit('authResponse', { success: true, mode: 'login', message: 'Access granted.' });
      loginPlayerSocket(socket, user);
      return;
    }
    
    try {
      const user = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') }, password });
      if (!user) {
        socket.emit('authResponse', { success: false, mode: 'login', message: 'Invalid username or password.' });
        return;
      }
      
      const alreadyLoggedIn = Object.keys(players).some(id => players[id].name.toLowerCase() === username.toLowerCase());
      if (alreadyLoggedIn) {
        socket.emit('authResponse', { success: false, mode: 'login', message: 'User is already active in the arena!' });
        return;
      }
      
      console.log(`Login success: ${username}`);
      
      socket.emit('authResponse', { 
        success: true, 
        mode: 'login', 
        message: 'Access granted.' 
      });
      
      loginPlayerSocket(socket, user);
    } catch (err) {
      console.error(err);
      socket.emit('authResponse', { success: false, mode: 'login', message: 'Database error occurred during login.' });
    }
  });

  // Helper to register and initialize socket in active player list
  function loginPlayerSocket(targetSocket, dbUser) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const padding = 100;
    const x = Math.floor(Math.random() * (MAP_WIDTH - padding * 2)) + padding;
    const y = Math.floor(Math.random() * (MAP_HEIGHT - padding * 2)) + padding;

    // Project coordinates
    const lat = CENTER_LAT + (y - 1000) * 0.0000035;
    const lng = CENTER_LNG + (x - 1000) * 0.0000045;

    // Load their database relationships into live session arrays
    players[targetSocket.id] = {
      id: targetSocket.id,
      name: dbUser.username,
      gender: dbUser.gender,
      pilotClass: dbUser.pilotClass || 'manta',
      x: x,
      y: y,
      lat: lat,
      lng: lng,
      color: color,
      score: dbUser.highScore,
      joinedAt: Date.now(),
      allies: dbUser.allies || [],
      enemies: dbUser.enemies || [],
      stats: {
        damage: 82,
        range: 75,
        accuracy: 90,
        health: 100
      }
    };

    // Send confirmation
    targetSocket.emit('init', {
      selfId: targetSocket.id,
      players: players,
      orbs: orbs,
      map: {
        width: MAP_WIDTH,
        height: MAP_HEIGHT
      }
    });

    // Broadcast new player details
    targetSocket.broadcast.emit('playerJoined', players[targetSocket.id]);
    
    // System message
    io.emit('chatMessage', {
      sender: 'System',
      text: `${dbUser.username} has entered the arena!`,
      type: 'system',
      timestamp: Date.now()
    });
  }

  // Handle real-world GPS tracker updates from client Geolocation pings
  socket.on('gpsUpdate', (data) => {
    const player = players[socket.id];
    if (player && data.lat && data.lng) {
      player.lat = data.lat;
      player.lng = data.lng;

      // Project GPS coords back onto virtual 2000x2000 arena plane
      player.x = Math.max(20, Math.min(MAP_WIDTH - 20, 1000 + (data.lng - CENTER_LNG) / 0.0000045));
      player.y = Math.max(20, Math.min(MAP_HEIGHT - 20, 1000 + (data.lat - CENTER_LAT) / 0.0000035));

      // Broadcast new projected positioning & real lat/lng coordinates to other clients
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        lat: player.lat,
        lng: player.lng
      });
    }
  });

  // Handle fallback keyboard movement updates
  socket.on('playerMove', (data) => {
    const player = players[socket.id];
    if (player) {
      player.x = Math.max(20, Math.min(MAP_WIDTH - 20, data.x));
      player.y = Math.max(20, Math.min(MAP_HEIGHT - 20, data.y));

      // Sync simulated Lat/Lng coordinates for keyboard fallbacks
      player.lat = CENTER_LAT + (player.y - 1000) * 0.0000035;
      player.lng = CENTER_LNG + (player.x - 1000) * 0.0000045;

      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        lat: player.lat,
        lng: player.lng
      });
    }
  });

  // Handle orb collection validation
  socket.on('claimOrb', (orbId) => {
    const player = players[socket.id];
    if (!player) return;

    const orbIndex = orbs.findIndex(o => o.id === orbId);
    if (orbIndex !== -1) {
      const collectedOrb = orbs[orbIndex];
      const dx = player.x - collectedOrb.x;
      const dy = player.y - collectedOrb.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 50) {
        orbs.splice(orbIndex, 1);
        player.score += 10;
        updateHighScoreInDB(player.name, player.score);
               if (player.stats) {
          player.stats.damage = Math.min(100, player.stats.damage + 2);
          player.stats.range = Math.min(100, player.stats.range + 1);
          player.stats.accuracy = Math.min(100, player.stats.accuracy + 2);
          
          socket.emit('statsUpdate', {
            playerId: socket.id,
            stats: player.stats
          });
        }
        
        const newOrb = generateOrb();
        orbs.push(newOrb);

        io.emit('orbClaimed', {
          orbId: orbId,
          playerId: socket.id,
          score: player.score,
          newOrb: newOrb
        });
      }
    }
  });

  // Handle player pilot class updates and database syncing
  socket.on('selectClass', async (data) => {
    const player = players[socket.id];
    if (player) {
      player.pilotClass = data.class;
      player.gender = data.gender;
      
      if (!isDatabaseConnected) {
        const user = mockUsers.find(u => u.username.toLowerCase() === player.name.toLowerCase());
        if (user) {
          user.pilotClass = data.class;
          user.gender = data.gender;
        }
      } else {
        try {
          await User.findOneAndUpdate(
            { username: player.name }, 
            { pilotClass: data.class, gender: data.gender }
          );
        } catch (err) {
          console.error('Error updating user class in database:', err);
        }
      }
      
      socket.broadcast.emit('playerClassChanged', {
        id: socket.id,
        class: data.class,
        gender: data.gender
      });
      
      console.log(`[STATE] Player ${player.name} updated class to: ${data.class}`);
    }
  });

  // Handle player-to-player proximity interaction
  socket.on('interactWith', (data) => {
    const player = players[socket.id];
    if (!player) return;
    
    const targetPlayer = players[data.targetId];
    if (targetPlayer) {
      const realDist = getPlayersDistance(player, targetPlayer);
      
      // Proximity limit: interactable within 100 meters (real GPS / relative grid fallback)
      if (realDist <= 100) {
        io.emit('playerInteracted', {
          fromId: socket.id,
          toId: data.targetId,
          fromName: player.name,
          toName: targetPlayer.name
        });

        io.emit('chatMessage', {
          sender: 'System',
          text: `${player.name} established a link with ${targetPlayer.name}!`,
          type: 'system',
          timestamp: Date.now()
        });
      }
    }
  });

  // Store pending team requests
  const teamRequests = {};

  // Handle Team invite requests
  socket.on('sendTeamInvite', (data) => {
    const player = players[socket.id];
    const targetPlayer = players[data.targetId];
    
    if (player && targetPlayer) {
      const realDist = getPlayersDistance(player, targetPlayer);
      
      if (realDist <= 100) {
        if (targetPlayer.isBot) {
          const rollAccept = Math.random() > 0.5;
          
          if (!player.allies) player.allies = [];
          if (!player.enemies) player.enemies = [];
          if (!targetPlayer.allies) targetPlayer.allies = [];
          if (!targetPlayer.enemies) targetPlayer.enemies = [];

          if (rollAccept) {
            player.allies.push(targetPlayer.name);
            targetPlayer.allies.push(player.name);
            
            player.enemies = player.enemies.filter(name => name !== targetPlayer.name);
            targetPlayer.enemies = targetPlayer.enemies.filter(name => name !== player.name);
            
            saveRelationshipToDatabase(player.name, targetPlayer.name, 'ally');

            io.emit('relationshipUpdate', {
              player1: socket.id,
              player2: data.targetId,
              status: 'ally'
            });

            io.emit('chatMessage', {
              sender: 'System',
              text: `🤝 ALLIANCE: Target drone ${targetPlayer.name} accepted ${player.name}'s link request!`,
              type: 'system',
              timestamp: Date.now()
            });

            socket.emit('missionStart');
          } else {
            player.enemies.push(targetPlayer.name);
            targetPlayer.enemies.push(player.name);
            
            player.allies = player.allies.filter(name => name !== targetPlayer.name);
            targetPlayer.allies = targetPlayer.allies.filter(name => name !== player.name);

            saveRelationshipToDatabase(player.name, targetPlayer.name, 'enemy');

            io.emit('relationshipUpdate', {
              player1: socket.id,
              player2: data.targetId,
              status: 'enemy'
            });

            io.emit('chatMessage', {
              sender: 'System',
              text: `⚠️ WARNING: Rogue drone ${targetPlayer.name} rejected ${player.name}'s link and turned hostile!`,
              type: 'system',
              timestamp: Date.now()
            });
          }
        } else {
          // Standard player invite
          if (!teamRequests[data.targetId]) {
            teamRequests[data.targetId] = new Set();
          }
          teamRequests[data.targetId].add(socket.id);
          
          io.to(data.targetId).emit('teamInviteReceived', {
            senderId: socket.id,
            senderName: player.name
          });

          socket.emit('chatMessage', {
            sender: 'System',
            text: `Team invitation dispatched to ${targetPlayer.name}.`,
            type: 'system',
            timestamp: Date.now()
          });
        }
      } else {
        socket.emit('chatMessage', {
          sender: 'System',
          text: `${targetPlayer.name} is too far away (${Math.round(realDist)}m). Proximity required: 100m.`,
          type: 'system',
          timestamp: Date.now()
        });
      }
    }
  });

  // Handle Team Accept
  socket.on('acceptTeamInvite', async (data) => {
    const receiverId = socket.id;
    const senderId = data.senderId;
    
    if (teamRequests[receiverId] && teamRequests[receiverId].has(senderId)) {
      const sender = players[senderId];
      const receiver = players[receiverId];
      
      if (sender && receiver) {
        if (!sender.allies) sender.allies = [];
        if (!receiver.allies) receiver.allies = [];
        if (!sender.enemies) sender.enemies = [];
        if (!receiver.enemies) receiver.enemies = [];

        if (!sender.allies.includes(receiver.name)) sender.allies.push(receiver.name);
        if (!receiver.allies.includes(sender.name)) receiver.allies.push(sender.name);
        
        sender.enemies = sender.enemies.filter(name => name !== receiver.name);
        receiver.enemies = receiver.enemies.filter(name => name !== sender.name);
        
        await saveRelationshipToDatabase(sender.name, receiver.name, 'ally');

        io.emit('relationshipUpdate', {
          player1: senderId,
          player2: receiverId,
          status: 'ally'
        });

        io.emit('chatMessage', {
          sender: 'System',
          text: `🤝 TEAM FORMED: ${receiver.name} and ${sender.name} have formed a 2-Person Team!`,
          type: 'system',
          timestamp: Date.now()
        });

        io.to(senderId).emit('missionStart');
        io.to(receiverId).emit('missionStart');
      }
      
      teamRequests[receiverId].delete(senderId);
    }
  });

  // Handle Team Decline
  socket.on('declineTeamInvite', async (data) => {
    const receiverId = socket.id;
    const senderId = data.senderId;
    
    if (teamRequests[receiverId] && teamRequests[receiverId].has(senderId)) {
      const sender = players[senderId];
      const receiver = players[receiverId];
      
      if (sender && receiver) {
        if (!sender.allies) sender.allies = [];
        if (!receiver.allies) receiver.allies = [];
        if (!sender.enemies) sender.enemies = [];
        if (!receiver.enemies) receiver.enemies = [];

        if (!sender.enemies.includes(receiver.name)) sender.enemies.push(receiver.name);
        if (!receiver.enemies.includes(sender.name)) receiver.enemies.push(sender.name);
        
        sender.allies = sender.allies.filter(name => name !== receiver.name);
        receiver.allies = receiver.allies.filter(name => name !== sender.name);
        
        await saveRelationshipToDatabase(sender.name, receiver.name, 'enemy');

        io.emit('relationshipUpdate', {
          player1: senderId,
          player2: receiverId,
          status: 'enemy'
        });

        io.emit('chatMessage', {
          sender: 'System',
          text: `⚠️ ENEMY ENGAGED: ${receiver.name} rejected ${sender.name}'s invite! They are now hostile.`,
          type: 'system',
          timestamp: Date.now()
        });
      }
      
      teamRequests[receiverId].delete(senderId);
    }
  });

  // Handle chat messages
  socket.on('sendMessage', (messageText) => {
    const player = players[socket.id];
    if (player && messageText && messageText.trim() !== '') {
      const trimmedText = messageText.trim();
      
      if (trimmedText.startsWith('/msg @')) {
        const spaceIndex = trimmedText.indexOf(' ', 6);
        if (spaceIndex !== -1) {
          const targetName = trimmedText.substring(6, spaceIndex);
          const privateMsg = trimmedText.substring(spaceIndex + 1).trim();
          
          if (privateMsg !== '') {
            const targetSocketId = Object.keys(players).find(
              id => players[id].name.toLowerCase() === targetName.toLowerCase()
            );
            
            if (targetSocketId) {
              io.to(targetSocketId).emit('chatMessage', {
                sender: `[PM from ${player.name}]`,
                color: player.color,
                text: privateMsg,
                type: 'pm',
                timestamp: Date.now()
              });
              socket.emit('chatMessage', {
                sender: `[PM to ${players[targetSocketId].name}]`,
                color: '#a0a6cc',
                text: privateMsg,
                type: 'pm',
                timestamp: Date.now()
              });
              return;
            } else {
              socket.emit('chatMessage', {
                sender: 'System',
                text: `Player "${targetName}" not found.`,
                type: 'system',
                timestamp: Date.now()
              });
              return;
            }
          }
        }
      }
      
      const sanitizedText = trimmedText.substring(0, 100);
      io.emit('chatMessage', {
        sender: player.name,
        color: player.color,
        text: sanitizedText,
        type: 'user',
        timestamp: Date.now()
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player) {
      const name = player.name;
      
      Object.keys(players).forEach(id => {
        const other = players[id];
        if (other.allies) {
          other.allies = other.allies.filter(allyName => allyName !== name);
        }
        if (other.enemies) {
          other.enemies = other.enemies.filter(enemyName => enemyName !== name);
        }
      });
      
      delete players[socket.id];
      io.emit('playerLeft', socket.id);
      
      io.emit('chatMessage', {
        sender: 'System',
        text: `${name} has left the room.`,
        type: 'system',
        timestamp: Date.now()
      });
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

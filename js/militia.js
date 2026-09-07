// Slime Militia: Pure Real-Time Multiplayer Battleground (Inspired by Mini Militia)
// Features: 100% Human PvP (No Bots!), Room Codes (MILITIA-XXXX), 5-Minute Match Clock, 3 Lives/Respawns,
// Tactical Camouflage Bushes (Hiding Spots), Bouncy Grenades, Jetpack Nitro Flight & Cross-Device WebRTC

class MilitiaGrenade {
  constructor(x, y, vx, vy, ownerId) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ownerId = ownerId;
    this.radius = 13;
    this.timer = 120; // 2 seconds fuse
    this.bounces = 3;
    this.isDead = false;
  }

  update(worldBounds, obstacles) {
    this.timer--;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.14; // gravity arc
    this.vx *= 0.985;

    // Obstacle & Wall bounces
    for (let obs of obstacles) {
      const dx = this.x - obs.x;
      const dy = this.y - obs.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.radius + obs.radius) {
        if (this.bounces > 0) {
          this.bounces--;
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          const dot = this.vx * nx + this.vy * ny;
          this.vx = (this.vx - 2 * dot * nx) * 0.7;
          this.vy = (this.vy - 2 * dot * ny) * 0.7;
          this.x += nx * 4;
          this.y += ny * 4;
          if (window.soundEngine) window.soundEngine.playBubblePop(450);
        }
      }
    }

    // Boundary bounces
    if (this.x < worldBounds.minX + 20 || this.x > worldBounds.maxX - 20) this.vx *= -0.7;
    if (this.y < worldBounds.minY + 20 || this.y > worldBounds.maxY - 20) this.vy *= -0.7;

    if (this.timer <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const flash = this.timer < 30 && (this.timer % 6 < 3);
    ctx.fillStyle = flash ? '#ef4444' : '#10b981';
    ctx.shadowColor = flash ? '#ef4444' : '#10b981';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-2, -this.radius - 4, 4, 4);
    ctx.restore();
  }
}

class MilitiaPowerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'medkit', 'grenades', 'nitro'
    this.radius = 18;
    this.bob = Math.random() * Math.PI;
    this.isDead = false;
  }

  update() {
    this.bob += 0.05;
  }

  draw(ctx) {
    ctx.save();
    const offsetY = Math.sin(this.bob) * 5;
    ctx.translate(this.x, this.y + offsetY);
    ctx.shadowBlur = 15;

    if (this.type === 'medkit') {
      ctx.shadowColor = '#22c55e';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💚', 0, 0);
    } else if (this.type === 'grenades') {
      ctx.shadowColor = '#f59e0b';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', 0, 0);
    } else {
      ctx.shadowColor = '#06b6d4';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 0, 0);
    }
    ctx.restore();
  }
}

// Dedicated Pure-P2P WebRTC Multiplayer Engine for Slime Militia
class MilitiaMultiplayer {
  constructor(game) {
    this.game = game;
    this.channel = null;
    this.peer = null;
    this.peerConnections = [];
    this.roomCode = null;
    this.isHost = false;
    this.playerId = 'militia_' + Math.random().toString(36).substr(2, 6);
    this.players = new Map(); // id -> remote player data
    this.renderers = new Map();
    this.lastBroadcast = 0;
  }

  normalizeCode(code) {
    if (!code) return '';
    let clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.startsWith('MILITIA') && clean.length > 7) {
      clean = clean.substring(7);
    }
    return clean;
  }

  getPeerConfig() {
    return {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          // Free Global TURN Relay for cellular networks & symmetric NATs (Jio, Airtel, Vi, Hotspot)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelay',
            credential: 'openrelay'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelay',
            credential: 'openrelay'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelay',
            credential: 'openrelay'
          }
        ],
        iceCandidatePoolSize: 10
      }
    };
  }

  createRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MILITIA-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomCode = code;
    this.isHost = true;
    this.connect();
    return this.roomCode;
  }

  joinRoom(code) {
    const clean = this.normalizeCode(code);
    this.roomCode = 'MILITIA-' + clean;
    this.isHost = false;
    this.connect();
    return this.roomCode;
  }

  getShareableLink() {
    if (!this.roomCode) return window.location.href;
    const url = new URL(window.location.href);
    url.searchParams.set('militia', this.roomCode);
    return url.toString();
  }

  connect() {
    this.disconnect();
    const cleanCode = this.normalizeCode(this.roomCode);
    if (!cleanCode) return;

    // 1. BroadcastChannel for zero-latency local testing
    try {
      this.channel = new BroadcastChannel('slime_militia_v1_' + cleanCode);
      this.channel.onmessage = (e) => this.handleMessage(e.data);
      this.sendToAll({
        type: 'MILITIA_JOIN',
        id: this.playerId,
        isHost: this.isHost,
        name: this.isHost ? 'Host (Creator)' : 'Squad Friend',
        color: this.game ? this.game.selectedColor : 'azure',
        shape: this.game ? this.game.selectedShape : 'classic'
      });
    } catch (err) {}

    // 2. PeerJS WebRTC for global cross-device multiplayer (works across different networks, cellular & Wi-Fi)
    if (typeof Peer !== 'undefined') {
      try {
        const hostPeerId = 'slimeplay-v2-militia-' + cleanCode.toLowerCase();

        if (this.isHost) {
          this.peer = new Peer(hostPeerId, this.getPeerConfig());
          this.peer.on('open', () => {
            const statusEl = document.getElementById('militia-host-status-text');
            if (statusEl) statusEl.innerText = 'Battle Room is LIVE! Waiting for squad to join...';
          });

          this.peer.on('connection', (conn) => {
            this.peerConnections.push(conn);
            conn.on('open', () => {
              conn.send({
                type: 'MILITIA_ACK',
                id: this.playerId,
                isHost: true,
                color: this.game ? this.game.selectedColor : 'azure',
                shape: this.game ? this.game.selectedShape : 'classic'
              });
            });
            conn.on('data', (data) => {
              this.handleMessage(data);
              // Mesh relay: forward to all other connected peers
              for (let other of this.peerConnections) {
                if (other !== conn && other.open) {
                  try { other.send(data); } catch (e) {}
                }
              }
            });
            conn.on('close', () => {
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            console.log('Militia peer host error:', err.type);
            const statusEl = document.getElementById('militia-host-status-text');
            if (err.type === 'unavailable-id' && statusEl) {
              statusEl.innerText = 'Battle room active! Ready for squad to connect.';
            }
          });
        } else {
          this.peer = new Peer(undefined, this.getPeerConfig());
          this.peer.on('open', () => {
            const guestStatus = document.getElementById('militia-guest-status-text');
            if (guestStatus) guestStatus.innerHTML = `📡 Connecting to Host across network...`;

            const conn = this.peer.connect(hostPeerId, { reliable: true });

            // Watchdog timer: if not open after 6 seconds, inform connecting via global relay
            const connectTimeout = setTimeout(() => {
              if (conn && !conn.open && guestStatus) {
                guestStatus.innerHTML = `🔄 Connecting via Global TURN Relay...`;
              }
            }, 6000);

            conn.on('open', () => {
              clearTimeout(connectTimeout);
              this.peerConnections.push(conn);
              conn.send({
                type: 'MILITIA_JOIN',
                id: this.playerId,
                isHost: false,
                color: this.game ? this.game.selectedColor : 'azure',
                shape: this.game ? this.game.selectedShape : 'classic'
              });
              if (guestStatus) guestStatus.innerHTML = `✅ Connected to Squad! Waiting for host to deploy battle...`;
            });
            conn.on('data', (data) => this.handleMessage(data));
            conn.on('close', () => {
              clearTimeout(connectTimeout);
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            const guestStatus = document.getElementById('militia-guest-status-text');
            if (guestStatus) {
              if (err.type === 'peer-unavailable') {
                guestStatus.innerHTML = `⚠️ Battle Room not found. Make sure host created it!`;
              } else {
                guestStatus.innerHTML = `⚠️ Connecting (${err.type})...`;
              }
            }
          });
        }
      } catch (err) {
        console.warn('Militia PeerJS error:', err);
      }
    }
  }

  sendToAll(data) {
    if (this.channel) {
      try { this.channel.postMessage(data); } catch (e) {}
    }
    for (let conn of this.peerConnections) {
      if (conn && conn.open) {
        try { conn.send(data); } catch (e) {}
      }
    }
  }

  disconnect() {
    if (this.channel) {
      try { this.channel.close(); } catch (e) {}
      this.channel = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.peerConnections = [];
    this.players.clear();
  }

  handleMessage(data) {
    if (!data || data.id === this.playerId) return;

    if (data.type === 'MILITIA_JOIN') {
      this.ensurePlayer(data.id, data.color, data.shape, data.name);
      this.sendToAll({
        type: 'MILITIA_ACK',
        id: this.playerId,
        isHost: this.isHost,
        color: this.game ? this.game.selectedColor : 'azure',
        shape: this.game ? this.game.selectedShape : 'classic'
      });
      if (this.game) this.game.updateLobbyRoster();
    } else if (data.type === 'MILITIA_ACK') {
      this.ensurePlayer(data.id, data.color, data.shape, data.name);
      if (this.game) this.game.updateLobbyRoster();
    } else if (data.type === 'MILITIA_START') {
      if (this.game) {
        this.game.startMatchFromNetwork(data.timer || 300);
      }
    } else if (data.type === 'MILITIA_SYNC') {
      this.ensurePlayer(data.id, data.color, data.shape);
      const p = this.players.get(data.id);
      if (p) {
        p.x += (data.x - p.x) * 0.65;
        p.y += (data.y - p.y) * 0.65;
        p.vx = data.vx;
        p.vy = data.vy;
        p.facingAngle = data.facingAngle;
        p.health = data.health;
        p.lives = data.lives;
        p.inCover = data.inCover;
        p.isJetpacking = data.isJetpacking;
        p.invulnerableTimer = data.invulnerableTimer;
        if (data.color) p.color = data.color;
        if (data.shape) p.shape = data.shape;
      }
    } else if (data.type === 'MILITIA_SHOOT') {
      if (this.game) {
        this.game.projectiles.push(new WaterBubble(data.px, data.py, data.angle, 13.0, data.id, '#f97316'));
        if (window.soundEngine) window.soundEngine.playBubblePop();
      }
    } else if (data.type === 'MILITIA_GRENADE') {
      if (this.game) {
        this.game.grenades.push(new MilitiaGrenade(data.x, data.y, data.vx, data.vy, data.id));
        if (window.soundEngine) window.soundEngine.playBubblePop(550);
      }
    } else if (data.type === 'MILITIA_DAMAGE') {
      if (data.targetId === this.playerId && this.game) {
        this.game.takeDamageFromNetwork(data.amount, data.attackerId);
      }
    } else if (data.type === 'MILITIA_LEFT') {
      this.players.delete(data.id);
      if (this.game) {
        this.game.updateLobbyRoster();
        this.game.particles.addTextPopup(this.game.slime.x, this.game.slime.y - 20, 'Squad player left 🚪', '#f59e0b');
      }
    }
  }

  ensurePlayer(id, color, shape, name) {
    if (!this.players.has(id)) {
      const colors = ['berry', 'honey', 'amethyst', 'matcha', 'azure'];
      const chosenColor = color || colors[this.players.size % colors.length];
      const p = {
        id: id,
        x: -300 + Math.random() * 600,
        y: -200 + Math.random() * 400,
        vx: 0,
        vy: 0,
        facingAngle: 0,
        health: 100,
        lives: 3,
        inCover: false,
        isJetpacking: false,
        invulnerableTimer: 200,
        color: chosenColor,
        shape: shape || 'classic',
        name: name || `Player ${this.players.size + 2}`
      };
      this.players.set(id, p);
    }
  }

  broadcastState(localSlime, hp, lives, inCover, isJetpacking, invulnerableTimer) {
    if (!this.roomCode) return;
    const now = performance.now();
    if (now - this.lastBroadcast < 30) return;
    this.lastBroadcast = now;

    this.sendToAll({
      type: 'MILITIA_SYNC',
      id: this.playerId,
      x: localSlime.x,
      y: localSlime.y,
      vx: localSlime.vx,
      vy: localSlime.vy,
      facingAngle: localSlime.facingAngle,
      health: hp,
      lives: lives,
      inCover: inCover,
      isJetpacking: isJetpacking,
      invulnerableTimer: invulnerableTimer,
      color: localSlime.color,
      shape: localSlime.shape
    });
  }

  broadcastShoot(px, py, angle) {
    this.sendToAll({
      type: 'MILITIA_SHOOT',
      id: this.playerId,
      px, py, angle
    });
  }

  broadcastGrenade(x, y, vx, vy) {
    this.sendToAll({
      type: 'MILITIA_GRENADE',
      id: this.playerId,
      x, y, vx, vy
    });
  }

  broadcastDamage(targetId, amount) {
    this.sendToAll({
      type: 'MILITIA_DAMAGE',
      attackerId: this.playerId,
      targetId,
      amount
    });
  }

  signalStartMatch(duration = 300) {
    this.sendToAll({
      type: 'MILITIA_START',
      id: this.playerId,
      timer: duration
    });
  }
}

// Main Slime Militia Game Controller
class SlimeMilitiaGame {
  constructor() {
    this.canvas = document.getElementById('militia-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.state = 'LOBBY'; // 'LOBBY', 'PLAYING', 'GAMEOVER'
    this.worldBounds = { minX: -1800, maxX: 1800, minY: -1200, maxY: 1200 };

    this.matchDuration = 300; // 5:00 minutes
    this.timerRemaining = 300;
    this.timerInterval = null;

    this.selectedColor = localStorage.getItem('slimeplay_color') || 'azure';
    this.selectedShape = localStorage.getItem('slimeplay_shape') || 'classic';
    this.slime = new SlimePhysics(0, 0, 44, this.selectedColor, this.selectedShape);
    this.playerHealth = 100;
    this.playerLives = 3;
    this.respawnTimer = 0;
    this.invulnerableTimer = 240;
    this.kills = 0;
    this.deaths = 0;
    this.inCover = false;

    this.nitro = 100;
    this.isJetpacking = false;

    this.grenadesCount = 3;
    this.grenadeCooldown = 0;
    this.shootCooldown = 0;

    this.projectiles = [];
    this.grenades = [];
    this.powerups = [];
    this.obstacles = [];
    this.bushes = [];
    this.particles = new CuteParticleSystem();

    this.camera = { x: 0, y: 0, shake: 0 };

    this.keys = { up: false, down: false, left: false, right: false, shoot: false, grenade: false, jetpack: false };
    this.mouse = { screenX: 0, screenY: 0, worldX: 0, worldY: 0, isDown: false };
    this.joystick = { active: false, touchId: null, startX: 0, startY: 0, vx: 0, vy: 0, maxRadius: 46 };

    this.multiplayer = new MilitiaMultiplayer(this);

    this.initBattlefield();
    this.bindEvents();
    this.checkUrlParams();
    this.resize();

    requestAnimationFrame(() => this.loop());
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('militia');
    if (code) {
      const arena1 = document.getElementById('game-arena-wrapper');
      const arena2 = document.getElementById('game-arena-wrapper-2');
      if (arena1 && arena2) {
        arena1.classList.add('hidden');
        arena2.classList.remove('hidden');
        arena2.scrollIntoView({ behavior: 'smooth' });
      }
      const joinInput = document.getElementById('militia-join-input');
      const createBox = document.getElementById('militia-create-box');
      const joinBox = document.getElementById('militia-join-box');
      const tabCreate = document.getElementById('militia-tab-create');
      const tabJoin = document.getElementById('militia-tab-join');
      if (joinInput && createBox && joinBox && tabCreate && tabJoin) {
        joinInput.value = code.toUpperCase();
        createBox.classList.add('hidden');
        joinBox.classList.remove('hidden');
        tabCreate.classList.remove('active');
        tabJoin.classList.add('active');
      }
    }
  }

  initBattlefield() {
    this.obstacles = [];
    this.bushes = [];
    this.powerups = [];

    // Tactical bunkers, sniper towers and platforms
    const bunkerLayout = [
      { x: 0, y: -200, type: 'bunker', radius: 75 },
      { x: 0, y: 200, type: 'bunker', radius: 75 },
      { x: -380, y: 0, type: 'platform', radius: 68 },
      { x: 380, y: 0, type: 'platform', radius: 68 },
      { x: -800, y: -450, type: 'bunker', radius: 80 },
      { x: 800, y: -450, type: 'bunker', radius: 80 },
      { x: -800, y: 450, type: 'bunker', radius: 80 },
      { x: 800, y: 450, type: 'bunker', radius: 80 },
      { x: -1250, y: -250, type: 'platform', radius: 70 },
      { x: 1250, y: -250, type: 'platform', radius: 70 },
      { x: -1250, y: 250, type: 'platform', radius: 70 },
      { x: 1250, y: 250, type: 'platform', radius: 70 },
      { x: -200, y: -520, type: 'crate', radius: 36 },
      { x: 200, y: -520, type: 'crate', radius: 36 },
      { x: -200, y: 520, type: 'crate', radius: 36 },
      { x: 200, y: 520, type: 'crate', radius: 36 }
    ];

    for (let b of bunkerLayout) {
      this.obstacles.push(new CozyObstacle(b.x, b.y, b.type === 'bunker' ? 'block' : 'succulent', b.radius));
    }

    // Camouflage stealth bushes (hiding spots!)
    const bushPositions = [
      { x: -160, y: -100, radius: 58 },
      { x: 160, y: -100, radius: 58 },
      { x: -160, y: 100, radius: 58 },
      { x: 160, y: 100, radius: 58 },
      { x: -550, y: -300, radius: 68 },
      { x: 550, y: -300, radius: 68 },
      { x: -550, y: 300, radius: 68 },
      { x: 550, y: 300, radius: 68 },
      { x: 0, y: -650, radius: 70 },
      { x: 0, y: 650, radius: 70 }
    ];

    for (let b of bushPositions) {
      this.bushes.push({ x: b.x, y: b.y, radius: b.radius });
    }

    // Supply crates
    this.powerups.push(new MilitiaPowerup(-350, -250, 'grenades'));
    this.powerups.push(new MilitiaPowerup(350, -250, 'medkit'));
    this.powerups.push(new MilitiaPowerup(-350, 250, 'nitro'));
    this.powerups.push(new MilitiaPowerup(350, 250, 'grenades'));
    this.powerups.push(new MilitiaPowerup(0, 0, 'medkit'));
  }

  resize() {
    if (!this.canvas) return;
    const wrapper = document.getElementById('game-arena-wrapper-2');
    if (wrapper && wrapper.classList.contains('mobile-fullscreen')) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    } else if (wrapper) {
      this.canvas.width = wrapper.clientWidth;
      this.canvas.height = wrapper.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 100);
      setTimeout(() => this.resize(), 300);
    });

    const wrapper = document.getElementById('game-arena-wrapper-2');
    if (wrapper) {
      wrapper.addEventListener('touchstart', () => this.enterMobileFullscreen(), { passive: true });
      wrapper.addEventListener('click', () => this.enterMobileFullscreen());
    }

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space') {
        if (this.state === 'PLAYING') e.preventDefault();
        this.keys.shoot = true;
      }
      if (e.code === 'KeyQ') this.throwGrenade();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.jetpack = true;
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (e.code === 'Space') this.keys.shoot = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.jetpack = false;
    });

    const updateMilitiaMouse = (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.screenX = e.clientX - rect.left;
      this.mouse.screenY = e.clientY - rect.top;
      this.mouse.worldX = this.mouse.screenX - this.canvas.width / 2 + this.camera.x;
      this.mouse.worldY = this.mouse.screenY - this.canvas.height / 2 + this.camera.y;
    };

    window.addEventListener('mousemove', updateMilitiaMouse);

    if (wrapper) {
      wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('.modal-overlay')) {
          return;
        }
        if (e.button === 3 || e.button === 4) {
          e.preventDefault();
          return;
        }
        if (e.button === 2) {
          e.preventDefault();
          this.throwGrenade();
        } else if (e.button === 0) {
          this.mouse.isDown = true;
          updateMilitiaMouse(e);
          if (this.state === 'PLAYING') {
            this.shootBubble();
          }
        }
      });
      wrapper.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('input')) e.preventDefault();
      });
    }

    window.addEventListener('mouseup', (e) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        return;
      }
      this.mouse.isDown = false;
    });

    this.initMilitiaTouchControls();

    // Host: Generate Room Code Button
    const genRoomBtn = document.getElementById('militia-gen-room-btn');
    if (genRoomBtn) {
      genRoomBtn.addEventListener('click', () => {
        const code = this.multiplayer.createRoom();
        document.getElementById('militia-display-room-code').innerText = code;
        document.getElementById('militia-room-created-box').classList.remove('hidden');
        genRoomBtn.classList.add('hidden');
        this.updateLobbyRoster();
      });
    }

    // Host: Copy Invite Link Button
    const copyLinkBtn = document.getElementById('militia-copy-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const link = this.multiplayer.getShareableLink();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(link).then(() => {
            copyLinkBtn.innerText = 'Copied Link to Clipboard! ✅';
            setTimeout(() => { copyLinkBtn.innerText = 'Copy Invite Link 📋'; }, 2000);
          });
        }
      });
    }

    // Guest: Join Battle Room Button
    const joinBtn = document.getElementById('militia-join-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const input = document.getElementById('militia-join-input');
        const code = input ? input.value : '';
        if (code && code.trim().length >= 4) {
          const statusBox = document.getElementById('militia-guest-status');
          const statusText = document.getElementById('militia-guest-status-text');
          if (statusBox) statusBox.classList.remove('hidden');
          if (statusText) statusText.innerText = `Connecting to Battle Room ${code.trim().toUpperCase()}...`;
          joinBtn.disabled = true;
          joinBtn.innerText = 'Connecting...';
          this.multiplayer.joinRoom(code);
        }
      });
    }

    // Host: Start Battle Match Button
    const startMatchBtn = document.getElementById('militia-start-match-btn');
    if (startMatchBtn) {
      startMatchBtn.addEventListener('click', () => {
        this.multiplayer.signalStartMatch(300);
        this.startMatch();
      });
    }

    const exitFsBtn = document.getElementById('militia-exit-fs-btn');
    if (exitFsBtn) exitFsBtn.addEventListener('click', () => this.exitToHub());

    const restartBtn = document.getElementById('militia-restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', () => this.startMatch());

    const hubHomeBtn = document.getElementById('militia-hub-btn');
    if (hubHomeBtn) hubHomeBtn.addEventListener('click', () => this.exitToHub());

    // Banner tap to enter fullscreen
    const banner = document.getElementById('militia-fs-banner');
    if (banner) {
      banner.addEventListener('click', (e) => {
        e.stopPropagation();
        this.enterMobileFullscreen();
      });
    }
  }

  updateLobbyRoster() {
    const rosterEl = document.getElementById('militia-squad-roster');
    const startBtn = document.getElementById('militia-start-match-btn');
    const startText = document.getElementById('militia-start-btn-text');
    const statusText = document.getElementById('militia-host-status-text');
    const count = (this.multiplayer.players ? this.multiplayer.players.size : 0) + 1;

    if (rosterEl) {
      let html = `<div class="roster-badge host" style="background: #ea580c; color: #fff; padding: 5px 12px; border-radius: 12px; font-weight: 800; font-size: 0.8rem;">👑 You (${this.multiplayer.isHost ? 'Host' : 'You'})</div>`;
      let i = 2;
      for (let [id, p] of this.multiplayer.players) {
        html += `<div class="roster-badge guest" style="background: rgba(255,255,255,0.12); color: #fed7aa; padding: 5px 12px; border-radius: 12px; font-weight: 800; font-size: 0.8rem;">⚔️ Player ${i} (${p.color || 'Fighter'})</div>`;
        i++;
      }
      rosterEl.innerHTML = html;
    }

    if (statusText) {
      statusText.innerHTML = `🎉 <strong>${count} Squad Fighters</strong> in Lobby! Ready when you are!`;
    }

    if (startBtn && startText && this.multiplayer.isHost) {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled-waiting');
      startBtn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
      startText.innerText = `▶ DEPLOY BATTLE (${count} FIGHTERS READY)`;
    }
  }

  initMilitiaTouchControls() {
    const zone = document.getElementById('militia-joystick-zone');
    const virtualStick = document.getElementById('militia-virtual-joystick');
    const knob = document.getElementById('militia-joystick-knob');
    const shootBtn = document.getElementById('militia-touch-shoot');
    const grenadeBtn = document.getElementById('militia-touch-grenade');
    const jetpackBtn = document.getElementById('militia-touch-jetpack');
    const wrapper = document.getElementById('game-arena-wrapper-2');

    if (zone && virtualStick && knob) {
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.joystick.active) return;
        const touch = e.changedTouches[0];
        this.joystick.active = true;
        this.joystick.touchId = touch.identifier;

        const rect = (wrapper || zone).getBoundingClientRect();
        const clientX = touch.clientX - rect.left;
        const clientY = touch.clientY - rect.top;
        this.joystick.startX = clientX;
        this.joystick.startY = clientY;
        this.joystick.vx = 0;
        this.joystick.vy = 0;

        virtualStick.style.left = `${clientX}px`;
        virtualStick.style.top = `${clientY}px`;
        virtualStick.classList.add('active');
        knob.style.transform = `translate(0px, 0px)`;
      }, { passive: false });

      const onMove = (e) => {
        if (!this.joystick.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystick.touchId) {
            e.preventDefault();
            const rect = (wrapper || zone).getBoundingClientRect();
            const clientX = touch.clientX - rect.left;
            const clientY = touch.clientY - rect.top;
            let dx = clientX - this.joystick.startX;
            let dy = clientY - this.joystick.startY;
            const dist = Math.hypot(dx, dy);
            const maxR = this.joystick.maxRadius;
            if (dist > maxR) {
              const angle = Math.atan2(dy, dx);
              dx = Math.cos(angle) * maxR;
              dy = Math.sin(angle) * maxR;
            }
            this.joystick.vx = dx / maxR;
            this.joystick.vy = dy / maxR;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            break;
          }
        }
      };

      const onEnd = (e) => {
        if (!this.joystick.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystick.touchId) {
            this.joystick.active = false;
            this.joystick.touchId = null;
            this.joystick.vx = 0;
            this.joystick.vy = 0;
            virtualStick.classList.remove('active');
            knob.style.transform = `translate(0px, 0px)`;
            break;
          }
        }
      };

      zone.addEventListener('touchmove', onMove, { passive: false });
      zone.addEventListener('touchend', onEnd, { passive: false });
      zone.addEventListener('touchcancel', onEnd, { passive: false });
    }

    if (shootBtn) {
      shootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.shoot = true; }, { passive: false });
      shootBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.shoot = false; }, { passive: false });
    }
    if (grenadeBtn) {
      grenadeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.throwGrenade(); }, { passive: false });
    }
    if (jetpackBtn) {
      jetpackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.jetpack = true; }, { passive: false });
      jetpackBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.jetpack = false; }, { passive: false });
    }
  }

  isMobileDevice() {
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmall = window.innerWidth <= 768;
    return isMobileUA || isSmall;
  }

  enterMobileFullscreen() {
    if (!this.isMobileDevice()) return;
    const wrapper = document.getElementById('game-arena-wrapper-2');
    if (wrapper && !wrapper.classList.contains('mobile-fullscreen')) {
      wrapper.classList.add('mobile-fullscreen');
      document.documentElement.classList.add('in-mobile-fullscreen');
      document.body.classList.add('in-mobile-fullscreen');
      this.resize();
      setTimeout(() => this.resize(), 80);
      setTimeout(() => this.resize(), 250);
    }
  }

  exitMobileFullscreen() {
    const wrapper = document.getElementById('game-arena-wrapper-2');
    if (wrapper) {
      wrapper.classList.remove('mobile-fullscreen');
    }
    document.documentElement.classList.remove('in-mobile-fullscreen');
    document.body.classList.remove('in-mobile-fullscreen');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.documentElement.style.position = '';
    document.body.style.position = '';
    document.documentElement.style.height = '';
    document.body.style.height = '';
    document.body.style.touchAction = '';
    this.resize();
  }

  exitToHub() {
    this.state = 'LOBBY';
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.exitMobileFullscreen();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    document.documentElement.classList.remove('in-mobile-fullscreen');
    document.body.classList.remove('in-mobile-fullscreen');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.documentElement.style.position = '';
    document.body.style.position = '';
    document.documentElement.style.height = '';
    document.body.style.height = '';
    document.body.style.touchAction = '';

    document.getElementById('militia-gameover-modal').classList.add('hidden');
    document.getElementById('militia-start-modal').classList.remove('hidden');

    this.keys = { up: false, down: false, left: false, right: false, shoot: false, grenade: false, jetpack: false };
    this.mouse.isDown = false;
    this.shootCooldown = 0;

    const wrapper2 = document.getElementById('game-arena-wrapper-2');
    if (wrapper2) wrapper2.classList.add('hidden');

    const hub = document.getElementById('arcade-games-hub') || document.getElementById('arena-section');
    if (hub) {
      hub.classList.remove('hidden');
      setTimeout(() => {
        hub.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }

  startMatchFromNetwork(duration = 300) {
    this.matchDuration = duration;
    this.startMatch();
  }

  startMatch() {
    if (window.soundEngine) window.soundEngine.init();
    this.state = 'PLAYING';
    this.timerRemaining = this.matchDuration; // 5:00
    this.playerHealth = 100;
    this.playerLives = 3;
    this.respawnTimer = 0;
    this.invulnerableTimer = 240;
    this.kills = 0;
    this.deaths = 0;
    this.nitro = 100;
    this.grenadesCount = 3;
    this.projectiles = [];
    this.grenades = [];

    document.getElementById('militia-start-modal').classList.add('hidden');
    document.getElementById('militia-gameover-modal').classList.add('hidden');
    this.enterMobileFullscreen();
    this.resize();

    this.initBattlefield();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state === 'PLAYING') {
        this.timerRemaining--;
        this.updateHUD();
        if (this.timerRemaining <= 0) {
          this.endMatch('TIME EXPIRED! ⏱️');
        }
      }
    }, 1000);

    this.updateHUD();
  }

  throwGrenade() {
    if (this.state !== 'PLAYING' || this.grenadesCount <= 0 || this.grenadeCooldown > 0) return;
    this.grenadesCount--;
    this.grenadeCooldown = 40;

    let aimAngle;
    if (this.joystick && this.joystick.active && (this.joystick.vx !== 0 || this.joystick.vy !== 0)) {
      aimAngle = Math.atan2(this.joystick.vy, this.joystick.vx);
    } else if (this.mouse && this.mouse.worldX !== undefined && !isNaN(this.mouse.worldX)) {
      aimAngle = Math.atan2(this.mouse.worldY - this.slime.y, this.mouse.worldX - this.slime.x);
    } else {
      aimAngle = this.slime.facingAngle || 0;
    }

    const speed = 11.5;
    const vx = Math.cos(aimAngle) * speed;
    const vy = Math.sin(aimAngle) * speed;
    this.grenades.push(new MilitiaGrenade(this.slime.x, this.slime.y, vx, vy, 'local'));
    this.multiplayer.broadcastGrenade(this.slime.x, this.slime.y, vx, vy);

    if (window.soundEngine) window.soundEngine.playBubblePop(600);
    this.updateHUD();
  }

  shootBubble() {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = 13;

    let aimAngle;
    if (this.joystick && this.joystick.active && (this.joystick.vx !== 0 || this.joystick.vy !== 0)) {
      aimAngle = Math.atan2(this.joystick.vy, this.joystick.vx);
    } else if (this.mouse && this.mouse.worldX !== undefined && !isNaN(this.mouse.worldX)) {
      aimAngle = Math.atan2(this.mouse.worldY - this.slime.y, this.mouse.worldX - this.slime.x);
    } else {
      aimAngle = this.slime.facingAngle || 0;
    }

    const px = this.slime.x + Math.cos(aimAngle) * 44;
    const py = this.slime.y + Math.sin(aimAngle) * 44;
    this.projectiles.push(new WaterBubble(px, py, aimAngle, 13.5, 'local', '#38bdf8'));
    this.multiplayer.broadcastShoot(px, py, aimAngle);
    this.slime.triggerPop(aimAngle);

    if (window.soundEngine) window.soundEngine.playBubblePop();
  }

  takeDamageFromNetwork(amount, attackerId) {
    if (this.invulnerableTimer > 0 || this.playerLives <= 0 || this.respawnTimer > 0) return;
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.camera.shake = 10;
    this.particles.addTextPopup(this.slime.x, this.slime.y - 18, `-${amount} HP! 💥`, '#ef4444');

    if (this.playerHealth <= 0) {
      this.playerLives--;
      this.deaths++;
      if (this.playerLives <= 0) {
        this.endMatch('ELIMINATED! 💀');
      } else {
        this.respawnTimer = 180;
        this.particles.addTextPopup(this.slime.x, this.slime.y - 28, `Lost 1 Life! (${this.playerLives} Left) ❤️`, '#f59e0b');
      }
    }
    this.updateHUD();
  }

  update() {
    if (this.state !== 'PLAYING') return;

    this.mouse.worldX = this.mouse.screenX - this.canvas.width / 2 + this.camera.x;
    this.mouse.worldY = this.mouse.screenY - this.canvas.height / 2 + this.camera.y;

    let moveX = 0;
    let moveY = 0;
    if (this.keys.up) moveY -= 1;
    if (this.keys.down) moveY += 1;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;

    if (this.joystick.active) {
      moveX += this.joystick.vx;
      moveY += this.joystick.vy;
    }

    let speedMult = 1.0;
    if (this.keys.jetpack && this.nitro > 0 && (moveX !== 0 || moveY !== 0)) {
      speedMult = 1.9;
      this.nitro = Math.max(0, this.nitro - 0.45);
      this.isJetpacking = true;
    } else {
      this.isJetpacking = false;
      this.nitro = Math.min(100, this.nitro + 0.16);
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        this.playerHealth = 100;
        this.invulnerableTimer = 220;
        this.slime.x = -600 + Math.random() * 1200;
        this.slime.y = -400 + Math.random() * 800;
        this.slime.vx = 0;
        this.slime.vy = 0;
      }
    } else {
      if (this.invulnerableTimer > 0) this.invulnerableTimer--;

      const baseSpeed = 5.8 * speedMult;
      this.slime.update(moveX, moveY, this.mouse.worldX, this.mouse.worldY, this.obstacles, this.worldBounds, baseSpeed);

      // Check if hiding in camouflage bushes
      this.inCover = false;
      for (let bush of this.bushes) {
        const dist = Math.hypot(this.slime.x - bush.x, this.slime.y - bush.y);
        if (dist < bush.radius + 12) {
          this.inCover = true;
          break;
        }
      }

      const coverBadge = document.getElementById('militia-cover-badge');
      if (coverBadge) {
        if (this.inCover) coverBadge.classList.remove('hidden');
        else coverBadge.classList.add('hidden');
      }

      if ((this.keys.shoot || this.mouse.isDown) && this.shootCooldown <= 0) {
        this.shootBubble();
      }
    }

    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.grenadeCooldown > 0) this.grenadeCooldown--;

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(this.worldBounds);

      // Obstacle collision
      for (let obs of this.obstacles) {
        if (Math.hypot(p.x - obs.x, p.y - obs.y) < p.radius + obs.radius) {
          p.isDead = true;
          break;
        }
      }

      // Check collision with remote human squad members
      if (p.ownerId === 'local' && !p.isDead) {
        for (let [id, remoteP] of this.multiplayer.players) {
          if (remoteP.lives > 0 && (!remoteP.invulnerableTimer || remoteP.invulnerableTimer <= 0)) {
            const dist = Math.hypot(p.x - remoteP.x, p.y - remoteP.y);
            if (dist < p.radius + (remoteP.radius || 42)) {
              p.isDead = true;
              this.multiplayer.broadcastDamage(id, 18);
              this.particles.spawnBubbleBurst(p.x, p.y, '#f97316', 16);
              this.particles.addTextPopup(p.x, p.y - 12, 'HIT! 🎯', '#fb923c');
              remoteP.health = Math.max(0, remoteP.health - 18);
              if (remoteP.health <= 0) {
                this.kills++;
                this.updateHUD();
                this.particles.addTextPopup(p.x, p.y - 24, '+1 SQUAD KILL! ⚔️', '#22c55e');
              }
              break;
            }
          }
        }
      }

      if (p.isDead) this.projectiles.splice(i, 1);
    }

    // Update grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(this.worldBounds, this.obstacles);

      if (g.isDead) {
        this.camera.shake = 16;
        this.particles.spawnBubbleBurst(g.x, g.y, '#f59e0b', 32);
        if (window.soundEngine) window.soundEngine.playBubbleBurst();

        // Blast radius AoE damage (110px radius)
        const blastRadius = 110;
        if (g.ownerId === 'local') {
          for (let [id, remoteP] of this.multiplayer.players) {
            if (remoteP.lives > 0 && (!remoteP.invulnerableTimer || remoteP.invulnerableTimer <= 0)) {
              const dist = Math.hypot(g.x - remoteP.x, g.y - remoteP.y);
              if (dist < blastRadius) {
                this.multiplayer.broadcastDamage(id, 45);
                this.particles.addTextPopup(remoteP.x, remoteP.y - 20, 'GRENADE BLAST! 💣 -45 HP', '#ef4444');
                remoteP.health = Math.max(0, remoteP.health - 45);
                if (remoteP.health <= 0) {
                  this.kills++;
                  this.updateHUD();
                }
              }
            }
          }
        }

        // Local self-damage from own/other grenades if close
        if (this.invulnerableTimer <= 0 && this.respawnTimer <= 0) {
          const selfDist = Math.hypot(g.x - this.slime.x, g.y - this.slime.y);
          if (selfDist < blastRadius) {
            this.takeDamageFromNetwork(35, g.ownerId);
          }
        }

        this.grenades.splice(i, 1);
      }
    }

    // Update powerups
    for (let p of this.powerups) {
      p.update();
      if (!p.isDead && Math.hypot(this.slime.x - p.x, this.slime.y - p.y) < this.slime.radius + p.radius) {
        p.isDead = true;
        if (p.type === 'medkit') {
          this.playerHealth = Math.min(100, this.playerHealth + 35);
          this.particles.addTextPopup(this.slime.x, this.slime.y - 20, '+35 MEDKIT HP! 💚', '#22c55e');
        } else if (p.type === 'grenades') {
          this.grenadesCount = Math.min(6, this.grenadesCount + 2);
          this.particles.addTextPopup(this.slime.x, this.slime.y - 20, '+2 GRENADES! 💣', '#f59e0b');
        } else {
          this.nitro = 100;
          this.particles.addTextPopup(this.slime.x, this.slime.y - 20, 'NITRO RECHARGED! 🚀', '#06b6d4');
        }
        setTimeout(() => { p.isDead = false; }, 16000);
        this.updateHUD();
      }
    }

    // Broadcast local state across WebRTC mesh
    this.multiplayer.broadcastState(this.slime, this.playerHealth, this.playerLives, this.inCover, this.isJetpacking, this.invulnerableTimer);

    // Smooth camera tracking
    this.camera.x += (this.slime.x - this.camera.x) * 0.12;
    this.camera.y += (this.slime.y - this.camera.y) * 0.12;
    if (this.camera.shake > 0) this.camera.shake *= 0.88;
  }

  endMatch(outcomeTitle) {
    this.state = 'GAMEOVER';
    if (this.timerInterval) clearInterval(this.timerInterval);

    const titleEl = document.getElementById('militia-outcome-title');
    const killsEl = document.getElementById('militia-final-kills');
    const deathsEl = document.getElementById('militia-final-deaths');
    const scoreEl = document.getElementById('militia-final-score');
    const modal = document.getElementById('militia-gameover-modal');

    if (titleEl) titleEl.innerText = outcomeTitle;
    if (killsEl) killsEl.innerText = this.kills.toString();
    if (deathsEl) deathsEl.innerText = this.deaths.toString();
    if (scoreEl) scoreEl.innerText = (this.kills * 100 - this.deaths * 25).toString();

    if (modal) modal.classList.remove('hidden');
    if (window.soundEngine) {
      if (this.playerLives > 0) window.soundEngine.playVictory();
      else window.soundEngine.playSquished();
    }
  }

  updateHUD() {
    const timerEl = document.getElementById('militia-timer-display');
    if (timerEl) {
      const mins = Math.floor(this.timerRemaining / 60);
      const secs = this.timerRemaining % 60;
      timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      if (this.timerRemaining <= 30) timerEl.style.color = '#ef4444';
      else timerEl.style.color = '#fbbf24';
    }

    const livesEl = document.getElementById('militia-lives-display');
    if (livesEl) {
      let hearts = '';
      for (let i = 0; i < 3; i++) {
        hearts += i < this.playerLives ? '❤️ ' : '🖤 ';
      }
      livesEl.innerText = hearts;
    }

    const hpVal = document.getElementById('militia-hp-val');
    const hpFill = document.getElementById('militia-hp-fill');
    if (hpVal) hpVal.innerText = `${this.playerHealth} / 100`;
    if (hpFill) {
      hpFill.style.width = `${Math.max(0, this.playerHealth)}%`;
      if (this.playerHealth > 50) hpFill.style.backgroundColor = '#10b981';
      else if (this.playerHealth > 25) hpFill.style.backgroundColor = '#f59e0b';
      else hpFill.style.backgroundColor = '#ef4444';
    }

    const nitroFill = document.getElementById('militia-nitro-fill');
    if (nitroFill) nitroFill.style.width = `${Math.max(0, this.nitro)}%`;

    const gCount = document.getElementById('militia-grenades-count');
    if (gCount) gCount.innerText = `x${this.grenadesCount}`;

    const kVal = document.getElementById('militia-kills-hud');
    if (kVal) kVal.innerText = this.kills.toString();
  }

  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1.5;
    const step = 80;
    for (let x = this.worldBounds.minX; x <= this.worldBounds.maxX; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, this.worldBounds.minY);
      ctx.lineTo(x, this.worldBounds.maxY);
      ctx.stroke();
    }
    for (let y = this.worldBounds.minY; y <= this.worldBounds.maxY; y += step) {
      ctx.beginPath();
      ctx.moveTo(this.worldBounds.minX, y);
      ctx.lineTo(this.worldBounds.maxX, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;
    ctx.translate(this.canvas.width / 2 - this.camera.x + shakeX, this.canvas.height / 2 - this.camera.y + shakeY);

    // Dark tactical warfare floor
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.worldBounds.minX, this.worldBounds.minY, this.worldBounds.maxX - this.worldBounds.minX, this.worldBounds.maxY - this.worldBounds.minY);
    this.drawGrid(ctx);

    // Obstacles & bunkers
    for (let obs of this.obstacles) {
      obs.draw(ctx);
    }

    // Powerups
    for (let p of this.powerups) {
      if (!p.isDead) p.draw(ctx);
    }

    // Projectiles
    for (let proj of this.projectiles) {
      proj.draw(ctx);
    }

    // Grenades
    for (let g of this.grenades) {
      g.draw(ctx);
    }

    // Render Remote Squad Players
    for (let [id, p] of this.multiplayer.players) {
      if (p.lives > 0) {
        ctx.save();
        const dist = Math.hypot(p.x - this.slime.x, p.y - this.slime.y);
        const isCamouflaged = p.inCover && dist > 160;

        if (isCamouflaged) {
          ctx.globalAlpha = 0.08; // Camouflage stealth hiding!
        } else if (p.inCover) {
          ctx.globalAlpha = 0.55; // Spotted in close range!
        }

        let ren = this.multiplayer.renderers.get(id);
        if (!ren) {
          ren = new SlimePhysics(p.x, p.y, 42, p.color || 'berry', p.shape || 'classic');
          this.multiplayer.renderers.set(id, ren);
        }
        ren.x = p.x;
        ren.y = p.y;
        ren.vx = p.vx;
        ren.vy = p.vy;
        ren.facingAngle = p.facingAngle;
        if (p.color) ren.setColor(p.color);
        if (p.shape) ren.setShape(p.shape);

        ren.draw(ctx, p.x + Math.cos(p.facingAngle) * 50, p.y + Math.sin(p.facingAngle) * 50);

        // Jetpack thrust particles
        if (p.isJetpacking) {
          ctx.fillStyle = '#06b6d4';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(p.x, p.y + 24, 9 + Math.random() * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Shield aura
        if (p.invulnerableTimer > 0) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 42 + 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Overhead Player Name & Lives (only if not camouflaged)
        if (!isCamouflaged) {
          ctx.save();
          ctx.translate(p.x, p.y - 60);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          ctx.roundRect(-42, -10, 84, 20, 8);
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`★ ${p.name || 'Friend'}`, 0, 0);

          // Lives hearts
          let hearts = '';
          for (let h = 0; h < 3; h++) hearts += h < p.lives ? '❤️' : '🖤';
          ctx.font = '10px sans-serif';
          ctx.fillText(hearts, 0, 16);
          ctx.restore();
        }

        ctx.restore();
      }
    }

    // Local Player Slime
    if (this.respawnTimer <= 0) {
      ctx.save();
      if (this.inCover) {
        ctx.globalAlpha = 0.45; // Local player visual feedback when hiding
      }
      this.slime.draw(ctx, this.mouse.worldX, this.mouse.worldY);

      if (this.invulnerableTimer > 0) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(this.slime.x, this.slime.y, this.slime.radius + 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.isJetpacking) {
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(this.slime.x, this.slime.y + 24, 11 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Respawning in ${Math.ceil(this.respawnTimer / 60)}s...`, this.slime.x, this.slime.y);
    }

    // Camouflage Bushes
    for (let bush of this.bushes) {
      ctx.save();
      ctx.fillStyle = 'rgba(22, 101, 52, 0.88)';
      ctx.shadowColor = 'rgba(20, 83, 45, 0.6)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(bush.x, bush.y, bush.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.beginPath();
      ctx.arc(bush.x - 12, bush.y - 10, bush.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles & Popups
    this.particles.drawParticles(ctx);

    ctx.restore();
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
}

window.SlimeMilitiaGame = SlimeMilitiaGame;
window.addEventListener('DOMContentLoaded', () => {
  window.militiaGame = new SlimeMilitiaGame();
});

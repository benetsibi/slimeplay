// Real-Time Multiplayer Sync using HTML5 BroadcastChannel & WebRTC (PeerJS)
class SlimeMultiplayer {
  constructor(game) {
    this.game = game;
    this.channel = null;
    this.peer = null;
    this.peerConnections = [];
    this.roomCode = null;
    this.isHost = false;
    this.playerId = 'slime_' + Math.random().toString(36).substr(2, 6);
    this.otherPlayer = null;
    this.otherPlayers = new Map(); // Support 2+ players
    this.lastBroadcast = 0;
  }

  normalizeCode(code) {
    if (!code) return '';
    let clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.startsWith('SLIME') && clean.length > 5) {
      clean = clean.substring(5);
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
    let code = 'SLIME-';
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
    this.roomCode = 'SLIME-' + clean;
    this.isHost = false;
    this.connect();
    return this.roomCode;
  }

  getShareableLink() {
    if (!this.roomCode) return window.location.href;
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomCode);
    return url.toString();
  }

  connect() {
    // 1. Clean previous connections
    this.disconnect();

    const cleanCode = this.normalizeCode(this.roomCode);
    if (!cleanCode) return;

    // 2. Setup Local BroadcastChannel (instant zero-latency sync on same machine/browser tabs)
    try {
      this.channel = new BroadcastChannel('slimeplay_v2_' + cleanCode);
      this.channel.onmessage = (e) => this.handleMessage(e.data);
      this.sendToAll({
        type: 'PLAYER_JOINED',
        id: this.playerId,
        isHost: this.isHost,
        time: Date.now()
      });
    } catch (err) {
      console.warn('BroadcastChannel notice:', err);
    }

    // 3. Setup Global Internet WebRTC via PeerJS (works across different networks, cellular & Wi-Fi)
    if (typeof Peer !== 'undefined') {
      try {
        const hostPeerId = 'slimeplay-v2-room-' + cleanCode.toLowerCase();

        if (this.isHost) {
          this.peer = new Peer(hostPeerId, this.getPeerConfig());

          this.peer.on('open', (id) => {
            const statusEl = document.getElementById('lobby-status-text');
            if (statusEl) statusEl.innerText = 'Room is LIVE! Waiting for friends to join with code...';
          });

          this.peer.on('connection', (conn) => {
            this.peerConnections.push(conn);
            conn.on('open', () => {
              conn.send({
                type: 'PLAYER_ACK',
                id: this.playerId,
                isHost: true
              });
            });
            conn.on('data', (data) => {
              this.handleMessage(data);
              // Relay to all other connected peers for 2+ players!
              for (let otherConn of this.peerConnections) {
                if (otherConn !== conn && otherConn.open) {
                  try { otherConn.send(data); } catch(e) {}
                }
              }
            });
            conn.on('close', () => {
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            console.log('PeerJS host notice:', err.type);
            const statusEl = document.getElementById('lobby-status-text');
            if (err.type === 'unavailable-id' && statusEl) {
              statusEl.innerText = 'Room code active! Ready for friends to connect.';
            }
          });
        } else {
          // Joining Guest
          this.peer = new Peer(undefined, this.getPeerConfig());

          this.peer.on('open', () => {
            const guestText = document.getElementById('guest-status-text');
            if (guestText) guestText.innerHTML = `📡 Connecting to Host across network...`;

            const conn = this.peer.connect(hostPeerId, { reliable: true });

            // Watchdog timer: If not open after 6 seconds, notify connecting via relay
            const connectTimeout = setTimeout(() => {
              if (conn && !conn.open && guestText) {
                guestText.innerHTML = `🔄 Connecting via Global TURN Relay...`;
              }
            }, 6000);

            conn.on('open', () => {
              clearTimeout(connectTimeout);
              this.peerConnections.push(conn);
              conn.send({
                type: 'PLAYER_JOINED',
                id: this.playerId,
                isHost: false,
                time: Date.now()
              });
              if (guestText) guestText.innerHTML = `✅ Connected to Room! Launching with host...`;
            });
            conn.on('data', (data) => this.handleMessage(data));
            conn.on('close', () => {
              clearTimeout(connectTimeout);
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            console.log('PeerJS guest notice:', err.type);
            const guestText = document.getElementById('guest-status-text');
            if (guestText) {
              if (err.type === 'peer-unavailable') {
                guestText.innerHTML = `⚠️ Room <strong>${this.roomCode}</strong> not found. Make sure host created it!`;
              } else {
                guestText.innerHTML = `⚠️ Connecting (${err.type})...`;
              }
            }
          });
        }
      } catch (err) {
        console.warn('PeerJS WebRTC notice:', err);
      }
    }
  }

  sendToAll(data) {
    // Send over BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(data);
      } catch (e) {}
    }

    // Send over WebRTC DataConnections
    if (this.peerConnections && this.peerConnections.length > 0) {
      for (let i = 0; i < this.peerConnections.length; i++) {
        const conn = this.peerConnections[i];
        if (conn && conn.open) {
          try {
            conn.send(data);
          } catch (e) {}
        }
      }
    }
  }

  disconnect() {
    if (this.channel) {
      try {
        this.channel.close();
      } catch(e) {}
      this.channel = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.peerConnections = [];
    this.otherPlayer = null;
    this.otherPlayers.clear();
  }

  broadcastState(playerSlime) {
    if (!this.roomCode) return;
    const now = performance.now();
    if (now - this.lastBroadcast < 30) return;
    this.lastBroadcast = now;

    this.sendToAll({
      type: 'SYNC_STATE',
      id: this.playerId,
      x: playerSlime.x,
      y: playerSlime.y,
      vx: playerSlime.vx,
      vy: playerSlime.vy,
      facingAngle: playerSlime.facingAngle,
      mouthOpenness: playerSlime.mouthOpenness,
      squishX: playerSlime.squishX,
      squishY: playerSlime.squishY,
      health: this.game ? this.game.playerHealth : 100,
      color: playerSlime.color,
      shape: playerSlime.shape
    });
  }

  broadcastShoot(px, py, angle) {
    if (!this.roomCode) return;
    this.sendToAll({
      type: 'SHOOT_BUBBLE',
      id: this.playerId,
      px, py, angle
    });
  }

  signalStartGame() {
    this.sendToAll({
      type: 'START_GAME_NOW',
      id: this.playerId
    });
  }

  broadcastPlayerDied() {
    if (!this.roomCode) return;
    this.sendToAll({
      type: 'PLAYER_DIED',
      id: this.playerId
    });
  }

  broadcastPlayerLeft() {
    if (!this.roomCode) return;
    this.sendToAll({
      type: 'PLAYER_LEFT',
      id: this.playerId
    });
  }

  handleMessage(data) {
    if (!data || data.id === this.playerId) return;

    if (data.type === 'PLAYER_JOINED') {
      this.ensureOtherPlayer(data.id);
      this.sendToAll({
        type: 'PLAYER_ACK',
        id: this.playerId,
        isHost: this.isHost
      });
      if (this.game && this.game.onSecondPlayerJoined) {
        this.game.onSecondPlayerJoined(data);
      }
    } else if (data.type === 'PLAYER_ACK') {
      this.ensureOtherPlayer(data.id);
      if (this.game && this.game.onGuestJoinedAck) {
        this.game.onGuestJoinedAck(data);
      }
    } else if (data.type === 'START_GAME_NOW') {
      if (this.game) {
        this.game.configureArena('multi');
        this.game.requestArenaFullscreen();
        this.game.startGame();
      }
    } else if (data.type === 'SYNC_STATE') {
      this.ensureOtherPlayer(data.id, data.color, data.shape);
      const op = this.otherPlayers.get(data.id) || this.otherPlayer;
      if (op) {
        op.x += (data.x - op.x) * 0.6;
        op.y += (data.y - op.y) * 0.6;
        op.vx = data.vx;
        op.vy = data.vy;
        op.facingAngle = data.facingAngle;
        op.mouthOpenness = data.mouthOpenness;
        op.squishX = data.squishX;
        op.squishY = data.squishY;
        op.health = data.health;
        if (data.color) op.color = data.color;
        if (data.shape) op.shape = data.shape;

        // ONLY trigger game over if other player's health depleted AND match has been active > 3s
        if (typeof data.health === 'number' && data.health <= 0 && this.game && this.game.state === 'PLAYING' && this.game.survivalTime > 3.0) {
          this.game.triggerGameOverMulti(true);
        }
      }
    } else if (data.type === 'PLAYER_DIED') {
      // The other player died! You won! Only if match has been running > 2s
      if (this.game && this.game.state === 'PLAYING' && this.game.survivalTime > 2.0) {
        this.game.triggerGameOverMulti(true);
      }
    } else if (data.type === 'SHOOT_BUBBLE') {
      if (this.game && this.game.projectiles) {
        this.game.projectiles.push(new WaterBubble(data.px, data.py, data.angle, 9.5));
        window.soundEngine.playBubblePop();
      }
    } else if (data.type === 'PLAYER_LEFT') {
      this.otherPlayers.delete(data.id);
      if (this.otherPlayer && this.otherPlayer.id === data.id) {
        this.otherPlayer = null;
      }
      if (this.game && this.game.state === 'PLAYING') {
        this.game.particles.addTextPopup(this.game.slime.x, this.game.slime.y - 20, 'Friend left the game 🚪', '#f59e0b');
      }
    }
  }

  ensureOtherPlayer(id = 'default', color = null, shape = null) {
    if (!this.otherPlayers.has(id)) {
      const colors = ['berry', 'azure', 'honey', 'amethyst', 'matcha'];
      const chosenColor = color || colors[this.otherPlayers.size % colors.length];
      const p = {
        id: id,
        x: 60 + (this.otherPlayers.size + 1) * 40,
        y: 60 + (this.otherPlayers.size + 1) * 40,
        vx: 0,
        vy: 0,
        radius: 44,
        facingAngle: 0,
        mouthOpenness: 0,
        squishX: 1.0,
        squishY: 1.0,
        health: 100,
        color: chosenColor,
        shape: shape || 'classic',
        name: `Player ${this.otherPlayers.size + 2}`
      };
      this.otherPlayers.set(id, p);
      if (!this.otherPlayer) {
        this.otherPlayer = p;
      }
      if (this.game && this.game.onPlayerRosterUpdated) {
        this.game.onPlayerRosterUpdated();
      }
    }
  }

  drawOtherPlayer(ctx) {
    if (!this.otherPlayers || this.otherPlayers.size === 0) return;

    if (!this.renderers) {
      this.renderers = new Map();
    }

    for (let [id, p] of this.otherPlayers) {
      let ren = this.renderers.get(id);
      if (!ren) {
        ren = new SlimePhysics(p.x, p.y, p.radius || 44, p.color || 'berry', p.shape || 'classic');
        this.renderers.set(id, ren);
      }
      ren.x = p.x;
      ren.y = p.y;
      ren.vx = p.vx;
      ren.vy = p.vy;
      ren.facingAngle = p.facingAngle;
      ren.mouthOpenness = p.mouthOpenness;
      ren.squishX = p.squishX;
      ren.squishY = p.squishY;
      if (p.color) ren.setColor(p.color);
      if (p.shape) ren.setShape(p.shape);

      ren.draw(ctx, p.x, p.y);

      // Overhead Player Badge
      ctx.save();
      ctx.translate(p.x, p.y - (p.radius || 44) - 22);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(-48, -12, 96, 24, 12);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Outfit", "Nunito", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★ ' + (p.name || 'Friend'), 0, 0);

      const hpW = 54;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(-hpW/2, 16, hpW, 6, 3);
      ctx.fill();

      const hpRatio = Math.max(0, Math.min(1, (p.health || 100) / 100));
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.beginPath();
      ctx.roundRect(-hpW/2, 16, hpW * hpRatio, 6, 3);
      ctx.fill();

      ctx.restore();
    }
  }
}

window.SlimeMultiplayer = SlimeMultiplayer;

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
    this.lastBroadcast = 0;
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
    this.roomCode = code.trim().toUpperCase();
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

    // 2. Setup Local BroadcastChannel (instant zero-latency sync on same machine/browser tabs)
    try {
      this.channel = new BroadcastChannel('slimeplay_room_' + this.roomCode);
      this.channel.onmessage = (e) => this.handleMessage(e.data);
      this.sendToAll({
        type: 'PLAYER_JOINED',
        id: this.playerId,
        isHost: this.isHost,
        time: Date.now()
      });
    } catch (err) {
      console.warn('BroadcastChannel not available', err);
    }

    // 3. Setup Global Internet WebRTC via PeerJS (direct P2P across devices without custom backend)
    if (typeof Peer !== 'undefined') {
      try {
        const sanitizedCode = this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const hostPeerId = 'slimeplay-room-' + sanitizedCode;

        if (this.isHost) {
          this.peer = new Peer(hostPeerId, {
            debug: 0
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
            conn.on('data', (data) => this.handleMessage(data));
            conn.on('close', () => {
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            // If ID already taken on cloud signaling, continue gracefully with local sync
            console.log('PeerJS signaling notice:', err.type);
          });
        } else {
          // Joining Guest
          this.peer = new Peer(undefined, {
            debug: 0
          });

          this.peer.on('open', () => {
            const conn = this.peer.connect(hostPeerId, { reliable: false });
            conn.on('open', () => {
              this.peerConnections.push(conn);
              conn.send({
                type: 'PLAYER_JOINED',
                id: this.playerId,
                isHost: false,
                time: Date.now()
              });
            });
            conn.on('data', (data) => this.handleMessage(data));
            conn.on('close', () => {
              this.peerConnections = this.peerConnections.filter(c => c !== conn);
            });
          });

          this.peer.on('error', (err) => {
            console.log('PeerJS guest notice:', err.type);
          });
        }
      } catch (err) {
        console.warn('PeerJS WebRTC initialization skipped:', err);
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
      this.sendToAll({
        type: 'PLAYER_LEFT',
        id: this.playerId
      });
      this.channel.close();
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
      health: this.game.playerHealth,
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

  handleMessage(data) {
    if (!data || data.id === this.playerId) return;

    if (data.type === 'PLAYER_JOINED') {
      this.ensureOtherPlayer();
      this.sendToAll({
        type: 'PLAYER_ACK',
        id: this.playerId,
        isHost: this.isHost
      });
      if (this.game && this.game.onSecondPlayerJoined) {
        this.game.onSecondPlayerJoined(data);
      }
    } else if (data.type === 'PLAYER_ACK') {
      this.ensureOtherPlayer();
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
      this.ensureOtherPlayer();
      if (this.otherPlayer) {
        this.otherPlayer.x += (data.x - this.otherPlayer.x) * 0.6;
        this.otherPlayer.y += (data.y - this.otherPlayer.y) * 0.6;
        this.otherPlayer.vx = data.vx;
        this.otherPlayer.vy = data.vy;
        this.otherPlayer.facingAngle = data.facingAngle;
        this.otherPlayer.mouthOpenness = data.mouthOpenness;
        this.otherPlayer.squishX = data.squishX;
        this.otherPlayer.squishY = data.squishY;
        this.otherPlayer.health = data.health;
        if (data.color) this.otherPlayer.color = data.color;
        if (data.shape) this.otherPlayer.shape = data.shape;
      }
    } else if (data.type === 'SHOOT_BUBBLE') {
      if (this.game && this.game.projectiles) {
        this.game.projectiles.push(new WaterBubble(data.px, data.py, data.angle, 9.5));
        window.soundEngine.playBubblePop();
      }
    } else if (data.type === 'PLAYER_LEFT') {
      this.otherPlayer = null;
    }
  }

  ensureOtherPlayer() {
    if (!this.otherPlayer) {
      this.otherPlayer = {
        x: 60,
        y: 60,
        vx: 0,
        vy: 0,
        radius: 44,
        facingAngle: 0,
        mouthOpenness: 0,
        squishX: 1.0,
        squishY: 1.0,
        health: 100,
        color: this.isHost ? 'berry' : 'matcha',
        shape: 'classic',
        name: this.isHost ? 'Friend Slime' : 'Host Slime'
      };
    }
  }

  drawOtherPlayer(ctx) {
    if (!this.otherPlayer) return;
    const p = this.otherPlayer;
    const r = p.radius;

    if (!this.otherRenderer) {
      this.otherRenderer = new SlimePhysics(p.x, p.y, r, p.color || (this.isHost ? 'berry' : 'matcha'), p.shape || 'classic');
    }
    this.otherRenderer.x = p.x;
    this.otherRenderer.y = p.y;
    this.otherRenderer.vx = p.vx;
    this.otherRenderer.vy = p.vy;
    this.otherRenderer.facingAngle = p.facingAngle;
    this.otherRenderer.mouthOpenness = p.mouthOpenness;
    this.otherRenderer.squishX = p.squishX;
    this.otherRenderer.squishY = p.squishY;
    if (p.color) this.otherRenderer.setColor(p.color);
    if (p.shape) this.otherRenderer.setShape(p.shape);

    this.otherRenderer.draw(ctx, p.x, p.y);

    // Overhead Player Badge
    ctx.save();
    ctx.translate(p.x, p.y - r - 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-44, -12, 88, 24, 12);
    ctx.fill();

    ctx.fillStyle = '#d946ef';
    ctx.font = 'bold 12px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ ' + p.name, 0, 0);

    const hpW = 50;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-hpW/2, 16, hpW, 5, 3);
    ctx.fill();

    const hpRatio = Math.max(0, Math.min(1, (p.health || 100) / 100));
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath();
    ctx.roundRect(-hpW/2, 16, hpW * hpRatio, 5, 3);
    ctx.fill();

    ctx.restore();
  }
}

window.SlimeMultiplayer = SlimeMultiplayer;

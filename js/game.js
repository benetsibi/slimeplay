// Main Game Controller for Cute 3D Gelatin Slime Adventure (slimeplay)
class CuteSlimeGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Game Mode: 'single' or 'multi'
    this.gameMode = 'single';

    // World arena configuration (Single: 2800x2800, Multi: Giant 4800x4800)
    this.worldBounds = {
      minX: -1400,
      maxX: 1400,
      minY: -1400,
      maxY: 1400
    };

    // Camera
    this.camera = {
      x: 0,
      y: 0,
      shake: 0
    };

    // State: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.state = 'START';
    this.score = 0;
    this.friendsSaved = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.survivalTime = 0;
    this.highScore = parseInt(localStorage.getItem('cozy_slime_high_score') || '0', 10);

    // 100 HP Slime Health System & Revive (< 50 HP triggers +10 every 10s until 100 HP)
    this.maxHealth = 100;
    this.playerHealth = 100;
    this.reviveThreshold = 50;
    this.isEmergencyReviving = false;
    this.peacefulMoveTimer = 0;

    // Slime Appearance Customization (Default: Matcha & Classic)
    this.selectedColor = localStorage.getItem('slimeplay_color') || 'matcha';
    this.selectedShape = localStorage.getItem('slimeplay_shape') || 'classic';
    this.previewSlime = null;

    // Difficulty & Speed Levels
    this.difficulty = 'cozy';
    this.speedConfigs = {
      cozy: { slimeSpeed: 5.2, enemySpeedMult: 1.0, bubbleSpeed: 9.5, spawnRateMult: 1.0 },
      speedy: { slimeSpeed: 7.2, enemySpeedMult: 1.35, bubbleSpeed: 12.5, spawnRateMult: 1.3 },
      frenzy: { slimeSpeed: 8.8, enemySpeedMult: 1.7, bubbleSpeed: 15.0, spawnRateMult: 1.65 }
    };
    this.waitingCountdown = null;

    // Multiplayer Engine
    this.multiplayer = new SlimeMultiplayer(this);

    // Systems
    this.particles = new CuteParticleSystem();
    this.particles.initAmbientDust(this.worldBounds, 85);

    // Player Slime (Cute 3D Gelatin Creature with customized color & shape)
    this.slime = new SlimePhysics(0, 0, 44, this.selectedColor, this.selectedShape);

    // Entity lists
    this.projectiles = [];
    this.enemies = [];
    this.obstacles = [];

    // Spawning controls (gentle pacing)
    this.spawnTimer = 0;
    this.spawnInterval = 180;
    this.shootCooldown = 0;

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false
    };
    this.mouse = {
      screenX: window.innerWidth / 2,
      screenY: window.innerHeight / 2,
      worldX: 0,
      worldY: 0,
      isDown: false
    };

    // Mobile Dynamic Floating Joystick State
    this.joystick = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      vx: 0, // -1 to 1 normalized
      vy: 0, // -1 to 1 normalized
      maxRadius: 46
    };

    this.initWorld();
    this.bindEvents();
    this.checkUrlRoomParams();
    this.resize();

    // Start render loop
    requestAnimationFrame(() => this.loop());
  }

  // Check if URL has ?room=SLIME-XXXX for instant friend joining
  checkUrlRoomParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const multiTab = document.getElementById('select-multi-tab');
      const singleTab = document.getElementById('select-single-tab');
      const multiBox = document.getElementById('multi-mode-options');
      const singleBox = document.getElementById('single-mode-box');
      const joinInput = document.getElementById('join-code-input');

      if (multiTab && singleTab && multiBox && singleBox && joinInput) {
        multiTab.classList.add('active');
        singleTab.classList.remove('active');
        multiBox.classList.remove('hidden');
        singleBox.classList.add('hidden');
        joinInput.value = roomParam.toUpperCase();

        // Scroll smoothly to game arena
        const arenaSec = document.getElementById('arena-section');
        if (arenaSec) arenaSec.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // Set arena size according to single or multiplayer mode
  configureArena(mode = 'single') {
    this.gameMode = mode;
    if (mode === 'multi') {
      // Giant expanded map for exploration & chase!
      this.worldBounds = { minX: -2400, maxX: 2400, minY: -2400, maxY: 2400 };
    } else {
      this.worldBounds = { minX: -1400, maxX: 1400, minY: -1400, maxY: 1400 };
    }
    this.initWorld();
  }

  initWorld() {
    this.obstacles = [];
    const b = this.worldBounds;
    const types = ['block', 'succulent', 'macaron', 'block'];
    const count = this.gameMode === 'multi' ? 95 : 48;

    for (let i = 0; i < count; i++) {
      let x, y, distToSpawn;
      let attempts = 0;
      do {
        x = b.minX + 120 + Math.random() * (b.maxX - b.minX - 240);
        y = b.minY + 120 + Math.random() * (b.maxY - b.minY - 240);
        distToSpawn = Math.hypot(x, y);
        attempts++;
      } while (distToSpawn < 240 && attempts < 50);

      const type = types[Math.floor(Math.random() * types.length)];
      const radius = type === 'succulent' ? (36 + Math.random() * 14) : (32 + Math.random() * 16);
      this.obstacles.push(new CozyObstacle(x, y, type, radius));
    }
  }

  resize() {
    if (!this.canvas) return;
    const arenaBox = document.getElementById('game-arena-wrapper');
    if (arenaBox && arenaBox.classList.contains('mobile-fullscreen')) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    } else if (arenaBox) {
      this.canvas.width = arenaBox.clientWidth;
      this.canvas.height = arenaBox.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
    if (this.minimapCanvas) {
      this.minimapCanvas.width = 115;
      this.minimapCanvas.height = 115;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 100);
      setTimeout(() => this.resize(), 300);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (this.isMobileDevice()) this.resize();
      });
    }

    // Automatic Mobile Fullscreen: touching or clicking the arena enters full screen on iPhone / mobile
    const arenaWrapper = document.getElementById('game-arena-wrapper');
    if (arenaWrapper) {
      arenaWrapper.addEventListener('touchstart', (e) => {
        if (this.isMobileDevice()) {
          this.enterMobileFullscreenIfApplicable();
        }
      }, { passive: true });

      arenaWrapper.addEventListener('click', (e) => {
        if (this.isMobileDevice()) {
          this.enterMobileFullscreenIfApplicable();
        }
      });

      // Scroll isolation: prevent webpage scrolling when scrolling inside the arena wrapper
      arenaWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
      }, { passive: false });
    }

    // Mobile Fullscreen Banner tap handler
    const mobileFsBanner = document.getElementById('mobile-fs-banner');
    if (mobileFsBanner) {
      mobileFsBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        this.enterMobileFullscreenIfApplicable();
      });
      mobileFsBanner.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        this.enterMobileFullscreenIfApplicable();
      }, { passive: true });
    }

    // Mobile Exit Fullscreen Button tap handler
    const mobileExitBtn = document.getElementById('mobile-exit-fs-btn');
    if (mobileExitBtn) {
      mobileExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exitMobileFullscreen();
      });
      mobileExitBtn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        this.exitMobileFullscreen();
      }, { passive: true });
    }

    // Fullscreen change listener to resize canvas properly
    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => this.resize(), 100);
      const fsBtn = document.getElementById('fullscreen-btn');
      if (fsBtn) {
        fsBtn.innerHTML = document.fullscreenElement ? '⤓' : '⤢';
      }
    });

    // Keyboard controls (Arrow keys and WASD)
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space') {
        if (this.state === 'PLAYING') e.preventDefault();
        this.keys.shoot = true;
      }
      if (e.code === 'KeyP') {
        this.togglePause();
      }
      if (e.code === 'KeyV') {
        this.triggerGameOverMulti(true);
      }
      if (e.code === 'KeyL') {
        this.triggerGameOverMulti(false);
      }
      if (e.code === 'KeyH') {
        if (this.playerHealth > 50 && !this.isEmergencyReviving) {
          this.playerHealth = 50;
          this.isEmergencyReviving = true;
          this.particles.addTextPopup(this.slime.x, this.slime.y - 18, 'HP Set to 50 (Reviving until 100 HP!) ⚠️', '#f59e0b');
        } else if (this.isEmergencyReviving) {
          this.playerHealth = Math.min(this.maxHealth, this.playerHealth + 10);
          this.triggerHealReviveAlert(10);
          this.particles.addTextPopup(this.slime.x, this.slime.y - 18, `+10 HP Revived! (${this.playerHealth}/100) 💚`, '#22c55e');
          this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#4ade80', 25);
          if (this.playerHealth >= this.maxHealth) {
            this.isEmergencyReviving = false;
            this.peacefulMoveTimer = 0;
          }
        }
        this.updateHUD();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (e.code === 'Space') this.keys.shoot = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.screenX = e.clientX - rect.left;
      this.mouse.screenY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.mouse.isDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });

    // Touch support for mobile
    this.initTouchControls();

    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const muted = window.soundEngine.toggleMute();
        soundBtn.innerHTML = muted ? '🔇' : '🔊';
      });
    }

    // Fullscreen toggle button
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Pause & Resume buttons
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeGame());
    }

    // Pause Stop Game Button
    const pauseStopBtn = document.getElementById('pause-stop-btn');
    if (pauseStopBtn) {
      pauseStopBtn.addEventListener('click', () => this.stopGame());
    }

    // Home buttons
    const hudHomeBtn = document.getElementById('hud-home-btn');
    if (hudHomeBtn) {
      hudHomeBtn.addEventListener('click', () => this.goToHome());
    }

    const pauseHomeBtn = document.getElementById('pause-home-btn');
    if (pauseHomeBtn) {
      pauseHomeBtn.addEventListener('click', () => this.goToHome());
    }

    const gameOverHomeBtn = document.getElementById('game-over-home-btn');
    if (gameOverHomeBtn) {
      gameOverHomeBtn.addEventListener('click', () => this.goToHome());
    }

    // Single Player Play Button
    const singlePlayBtn = document.getElementById('start-single-btn');
    if (singlePlayBtn) {
      singlePlayBtn.addEventListener('click', () => {
        this.configureArena('single');
        this.requestArenaFullscreen();
        this.startGame();
      });
    }

    // Hero Play Now CTA Button
    const heroPlayNowBtn = document.getElementById('hero-play-btn');
    if (heroPlayNowBtn) {
      heroPlayNowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const arenaSec = document.getElementById('arena-section');
        if (arenaSec) arenaSec.scrollIntoView({ behavior: 'smooth' });
        this.configureArena('single');
        this.requestArenaFullscreen();
        this.startGame();
      });
    }

    // Speed & Difficulty Level Chips Selector
    document.querySelectorAll('.speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const speed = chip.dataset.speed;
        this.setDifficulty(speed);
      });
    });

    // Multiplayer Buttons
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => {
        const code = this.multiplayer.createRoom();
        document.getElementById('display-room-code').innerText = code;
        document.getElementById('room-created-box').classList.remove('hidden');
        document.getElementById('multi-mode-options').classList.add('hidden');

        // Reset waiting status: host cannot enter until friend joins!
        const statusEl = document.getElementById('lobby-status-text');
        if (statusEl) statusEl.innerText = 'Waiting for friend to join with code...';
        const startHostBtn = document.getElementById('start-multi-host-btn');
        if (startHostBtn) {
          startHostBtn.disabled = true;
          startHostBtn.classList.add('disabled-waiting');
        }
        const startText = document.getElementById('start-multi-text');
        if (startText) startText.innerText = 'WAITING FOR FRIEND TO JOIN...';
      });
    }

    const startMultiHostBtn = document.getElementById('start-multi-host-btn');
    if (startMultiHostBtn) {
      startMultiHostBtn.addEventListener('click', () => {
        // Manual override if needed
        if (this.waitingCountdown) {
          clearInterval(this.waitingCountdown);
          this.waitingCountdown = null;
        }
        this.multiplayer.signalStartGame();
        this.configureArena('multi');
        this.requestArenaFullscreen();
        this.startGame();
      });
    }

    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => {
        const input = document.getElementById('join-code-input');
        const code = input ? input.value : '';
        if (code && code.trim().length >= 4) {
          const guestStatus = document.getElementById('guest-join-status');
          const guestText = document.getElementById('guest-status-text');
          if (guestStatus) guestStatus.classList.remove('hidden');
          if (guestText) guestText.innerText = `Connecting to room ${code.trim().toUpperCase()}...`;
          joinRoomBtn.disabled = true;
          joinRoomBtn.innerText = 'Connecting...';

          this.multiplayer.joinRoom(code);
        } else {
          alert('Please enter a valid room code (e.g. SLIME-XXXX)');
        }
      });
    }

    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', () => {
        const shareLink = this.multiplayer.getShareableLink();
        navigator.clipboard.writeText(shareLink).then(() => {
          copyCodeBtn.innerText = 'Link Copied! ✓';
          setTimeout(() => { copyCodeBtn.innerText = 'Copy Share Link 📋'; }, 2500);
        });
      });
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.requestArenaFullscreen();
        this.restartGame();
      });
    }

    // Auto-detect ?room= in URL so opening a friend's shared link automatically fills room code!
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const joinInput = document.getElementById('join-code-input');
      if (joinInput) joinInput.value = roomParam.trim().toUpperCase();
      const singleTab = document.getElementById('select-single-tab');
      const multiTab = document.getElementById('select-multi-tab');
      const singleBox = document.getElementById('single-mode-box');
      const multiBox = document.getElementById('multi-mode-options');
      if (singleTab && multiTab && singleBox && multiBox) {
        multiTab.classList.add('active');
        singleTab.classList.remove('active');
        singleBox.classList.add('hidden');
        multiBox.classList.remove('hidden');
      }
    }

    // Slime Customization in Pause Menu
    this.initCustomizerListeners();
  }

  initCustomizerListeners() {
    // 1. Color Swatches
    const colorBtns = document.querySelectorAll('#pause-color-picker .color-swatch-btn');
    const colorBadge = document.getElementById('active-color-name');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const color = btn.dataset.color;
        this.selectedColor = color;
        localStorage.setItem('slimeplay_color', color);
        if (this.slime) this.slime.setColor(color);
        if (colorBadge) {
          const pal = window.SLIME_PALETTES ? window.SLIME_PALETTES[color] : null;
          colorBadge.innerText = pal ? pal.name : color;
        }
        if (window.soundEngine) window.soundEngine.playBubblePop(700);
        this.renderPausePreview();
      });
    });

    // 2. Shape Buttons
    const shapeBtns = document.querySelectorAll('#pause-shape-picker .shape-btn');
    const shapeBadge = document.getElementById('active-shape-name');
    const shapeNames = {
      classic: 'Classic (Default)',
      cat: 'Neko Cat Slime',
      bunny: 'Bunny Mochi',
      star: 'Star Prince'
    };
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const shape = btn.dataset.shape;
        this.selectedShape = shape;
        localStorage.setItem('slimeplay_shape', shape);
        if (this.slime) this.slime.setShape(shape);
        if (shapeBadge) shapeBadge.innerText = shapeNames[shape] || shape;
        if (window.soundEngine) window.soundEngine.playBubblePop(880);
        this.renderPausePreview();
      });
    });
  }

  syncCustomizerUI() {
    // Sync active state for colors
    const colorBtns = document.querySelectorAll('#pause-color-picker .color-swatch-btn');
    const colorBadge = document.getElementById('active-color-name');
    colorBtns.forEach(b => {
      const isMatch = b.dataset.color === this.selectedColor;
      b.classList.toggle('active', isMatch);
    });
    if (colorBadge && window.SLIME_PALETTES && window.SLIME_PALETTES[this.selectedColor]) {
      colorBadge.innerText = window.SLIME_PALETTES[this.selectedColor].name;
    }

    // Sync active state for shapes
    const shapeBtns = document.querySelectorAll('#pause-shape-picker .shape-btn');
    const shapeBadge = document.getElementById('active-shape-name');
    const shapeNames = {
      classic: 'Classic (Default)',
      cat: 'Neko Cat Slime',
      bunny: 'Bunny Mochi',
      star: 'Star Prince'
    };
    shapeBtns.forEach(b => {
      const isMatch = b.dataset.shape === this.selectedShape;
      b.classList.toggle('active', isMatch);
    });
    if (shapeBadge) {
      shapeBadge.innerText = shapeNames[this.selectedShape] || this.selectedShape;
    }
  }

  renderPausePreview() {
    const canvas = document.getElementById('pause-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.previewSlime) {
      this.previewSlime = new SlimePhysics(canvas.width / 2, canvas.height / 2 + 6, 26, this.selectedColor, this.selectedShape);
    } else {
      this.previewSlime.x = canvas.width / 2;
      this.previewSlime.y = canvas.height / 2 + 6;
      this.previewSlime.setColor(this.selectedColor);
      this.previewSlime.setShape(this.selectedShape);
    }

    this.previewSlime.jigglePhase += 0.08;
    this.previewSlime.bobPhase += 0.06;
    this.previewSlime.draw(ctx, this.previewSlime.x, this.previewSlime.y);
  }

  // Request fullscreen on game arena container when entering game
  requestArenaFullscreen() {
    if (this.isMobileDevice()) {
      this.enterMobileFullscreenIfApplicable();
      return;
    }
    const elem = document.getElementById('game-arena-wrapper');
    if (elem && elem.requestFullscreen && !document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    }
  }

  toggleFullscreen() {
    if (this.isMobileDevice()) {
      const arenaBox = document.getElementById('game-arena-wrapper');
      if (arenaBox && arenaBox.classList.contains('mobile-fullscreen')) {
        this.exitMobileFullscreen();
      } else {
        this.enterMobileFullscreenIfApplicable();
      }
      return;
    }

    const elem = document.getElementById('game-arena-wrapper');
    if (!document.fullscreenElement) {
      if (elem && elem.requestFullscreen) elem.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  // Mobile Device Detection & Touch Control Systems (100% Reliable for iPhone & Android)
  isMobileDevice() {
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isNarrow = window.innerWidth <= 950;
    return isMobileUA || (hasTouch && (isNarrow || navigator.maxTouchPoints > 1)) || isNarrow;
  }

  enterMobileFullscreenIfApplicable() {
    if (!this.isMobileDevice()) return;
    const arenaBox = document.getElementById('game-arena-wrapper');
    if (arenaBox && !arenaBox.classList.contains('mobile-fullscreen')) {
      arenaBox.classList.add('mobile-fullscreen');
      document.documentElement.classList.add('in-mobile-fullscreen');
      document.body.classList.add('in-mobile-fullscreen');
      document.body.style.overflow = 'hidden';
      // Trigger multiple resizes to adjust as iOS Safari toolbar settles
      this.resize();
      setTimeout(() => this.resize(), 60);
      setTimeout(() => this.resize(), 200);
      setTimeout(() => this.resize(), 500);
    }
  }

  exitMobileFullscreen() {
    const arenaBox = document.getElementById('game-arena-wrapper');
    if (arenaBox && arenaBox.classList.contains('mobile-fullscreen')) {
      arenaBox.classList.remove('mobile-fullscreen');
      document.documentElement.classList.remove('in-mobile-fullscreen');
      document.body.classList.remove('in-mobile-fullscreen');
      document.body.style.overflow = '';
      this.resize();
      setTimeout(() => this.resize(), 60);
      setTimeout(() => this.resize(), 200);
    }
  }

  initTouchControls() {
    const zone = document.getElementById('joystick-zone');
    const virtualStick = document.getElementById('virtual-joystick');
    const knob = document.getElementById('joystick-knob');
    const shootActionBtn = document.getElementById('touch-shoot-action-btn');
    const arenaBox = document.getElementById('game-arena-wrapper');

    if (zone && virtualStick && knob) {
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.joystick.active) return;
        const touch = e.changedTouches[0];
        this.joystick.active = true;
        this.joystick.touchId = touch.identifier;

        const rect = (arenaBox || zone).getBoundingClientRect();
        const clientX = touch.clientX - rect.left;
        const clientY = touch.clientY - rect.top;

        this.joystick.startX = clientX;
        this.joystick.startY = clientY;
        this.joystick.currentX = clientX;
        this.joystick.currentY = clientY;
        this.joystick.vx = 0;
        this.joystick.vy = 0;

        virtualStick.style.left = `${clientX}px`;
        virtualStick.style.top = `${clientY}px`;
        virtualStick.classList.add('active');
        knob.style.transform = `translate(0px, 0px)`;
      }, { passive: false });

      const onTouchMove = (e) => {
        if (!this.joystick.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystick.touchId) {
            e.preventDefault();
            const rect = (arenaBox || zone).getBoundingClientRect();
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
            this.joystick.currentX = this.joystick.startX + dx;
            this.joystick.currentY = this.joystick.startY + dy;

            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            break;
          }
        }
      };

      const onTouchEnd = (e) => {
        if (!this.joystick.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystick.touchId) {
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

      zone.addEventListener('touchmove', onTouchMove, { passive: false });
      zone.addEventListener('touchend', onTouchEnd, { passive: false });
      zone.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }

    if (shootActionBtn) {
      shootActionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys.shoot = true;
        shootActionBtn.classList.add('active');
      }, { passive: false });

      shootActionBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys.shoot = false;
        shootActionBtn.classList.remove('active');
      }, { passive: false });

      shootActionBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        this.keys.shoot = false;
        shootActionBtn.classList.remove('active');
      }, { passive: false });
    }
  }

  // Set Speed & Difficulty Level
  setDifficulty(speed) {
    if (!this.speedConfigs[speed]) return;
    this.difficulty = speed;
    if (this.slime) {
      this.slime.speed = this.speedConfigs[speed].slimeSpeed;
    }
    document.querySelectorAll('.speed-chip').forEach(c => {
      if (c.dataset.speed === speed) c.classList.add('active');
      else c.classList.remove('active');
    });
  }

  // Triggered when second player connects to Host
  onSecondPlayerJoined(peerData) {
    if (this.waitingCountdown) return;

    if (window.soundEngine && window.soundEngine.playHealRevive) {
      window.soundEngine.playHealRevive();
    }

    const statusEl = document.getElementById('lobby-status-text');
    const startHostBtn = document.getElementById('start-multi-host-btn');
    const startText = document.getElementById('start-multi-text');

    if (startHostBtn) {
      startHostBtn.disabled = false;
      startHostBtn.classList.remove('disabled-waiting');
    }

    let count = 3;
    const updateCountdown = () => {
      if (statusEl) statusEl.innerHTML = `🎉 Friend Connected! Entering Arena in <strong>${count}s...</strong>`;
      if (startText) startText.innerText = `STARTING IN ${count}...`;
      if (count <= 0) {
        clearInterval(this.waitingCountdown);
        this.waitingCountdown = null;
        this.multiplayer.signalStartGame();
        this.configureArena('multi');
        this.requestArenaFullscreen();
        this.startGame();
      }
      count--;
    };

    updateCountdown();
    this.waitingCountdown = setInterval(updateCountdown, 1000);
  }

  // Triggered when Guest receives Host acknowledgement
  onGuestJoinedAck(data) {
    const guestText = document.getElementById('guest-status-text');
    if (guestText) guestText.innerHTML = `✅ Connected to Host! Waiting for launch...`;
  }

  startGame() {
    window.soundEngine.init();
    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('game-over-modal').classList.add('hidden');
    this.enterMobileFullscreenIfApplicable();
    this.resize();
    this.resetState();
    this.state = 'PLAYING';
  }

  restartGame() {
    window.soundEngine.init();
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    this.enterMobileFullscreenIfApplicable();
    this.resetState();
    this.state = 'PLAYING';
  }

  stopGame() {
    if (this.gameMode === 'multi' && this.multiplayer) {
      this.multiplayer.broadcastPlayerLeft();
    }
    this.goToHome();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pause-modal').classList.remove('hidden');
      const pBtn = document.getElementById('pause-btn');
      if (pBtn) pBtn.innerHTML = '▶';
      this.syncCustomizerUI();
      this.renderPausePreview();
    } else if (this.state === 'PAUSED') {
      this.resumeGame();
    }
  }

  resumeGame() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pause-modal').classList.add('hidden');
      const pBtn = document.getElementById('pause-btn');
      if (pBtn) pBtn.innerHTML = '⏸️';
    }
  }

  goToHome() {
    this.state = 'START';
    this.exitMobileFullscreen();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('start-modal').classList.remove('hidden');
    const pBtn = document.getElementById('pause-btn');
    if (pBtn) pBtn.innerHTML = '⏸️';
    this.resetState();
  }

  resetState() {
    this.slime = new SlimePhysics(0, 0, 44, this.selectedColor, this.selectedShape);
    this.playerHealth = this.maxHealth;
    this.isEmergencyReviving = false;
    this.peacefulMoveTimer = 0;
    this.projectiles = [];
    this.enemies = [];
    this.score = 0;
    this.friendsSaved = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.survivalTime = 0;
    this.spawnTimer = 0;
    this.spawnInterval = this.gameMode === 'multi' ? 140 : 180;

    const titleEl = document.getElementById('game-over-title');
    const subEl = document.getElementById('game-over-subtitle');
    const restartBtn = document.getElementById('restart-btn');
    if (titleEl) {
      titleEl.innerText = 'SQUISHED! 🥺';
      titleEl.style.color = '#ef4444';
    }
    if (subEl) {
      subEl.innerText = "Your cute slime got popped! Don't worry, you can try again.";
    }
    if (restartBtn) {
      restartBtn.innerText = 'Play Again 🔄';
    }

    this.updateHUD();
  }

  triggerPlayerSquished() {
    if (this.gameMode === 'multi' && this.multiplayer) {
      this.multiplayer.broadcastPlayerDied();
      this.triggerGameOverMulti(false);
      return;
    }

    this.state = 'GAMEOVER';
    window.soundEngine.playSquished();
    this.camera.shake = 12;

    const titleEl = document.getElementById('game-over-title');
    const subEl = document.getElementById('game-over-subtitle');
    if (titleEl) {
      titleEl.innerText = 'SQUISHED! 🥺';
      titleEl.style.color = '#ef4444';
    }
    if (subEl) {
      subEl.innerText = "Your cute slime got popped! Don't worry, you can try again.";
    }

    this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#84e444', 40);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cozy_slime_high_score', this.highScore.toString());
    }

    setTimeout(() => {
      document.getElementById('final-score').innerText = this.score.toLocaleString();
      document.getElementById('final-kills').innerText = this.friendsSaved.toString();
      document.getElementById('final-time').innerText = Math.floor(this.survivalTime) + 's';
      document.getElementById('final-best').innerText = this.highScore.toLocaleString();
      document.getElementById('game-over-modal').classList.remove('hidden');
    }, 500);
  }

  triggerGameOverMulti(isVictory) {
    this.state = 'GAMEOVER';
    this.camera.shake = 12;

    const titleEl = document.getElementById('game-over-title');
    const subEl = document.getElementById('game-over-subtitle');
    const restartBtn = document.getElementById('restart-btn');

    if (isVictory) {
      if (window.soundEngine && window.soundEngine.playVictory) {
        window.soundEngine.playVictory();
      }
      if (titleEl) {
        titleEl.innerText = 'YOU WON! 🏆';
        titleEl.style.color = '#22c55e';
      }
      if (subEl) {
        subEl.innerText = 'The other player got squished! You survived and claimed victory!';
      }
      this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#22c55e', 50);
    } else {
      if (window.soundEngine && window.soundEngine.playSquished) {
        window.soundEngine.playSquished();
      }
      if (titleEl) {
        titleEl.innerText = 'YOU LOST / DIED 💀';
        titleEl.style.color = '#ef4444';
      }
      if (subEl) {
        subEl.innerText = 'You were squished! Player 2 survives as champion!';
      }
      this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#ef4444', 40);
    }

    if (restartBtn) {
      restartBtn.innerText = 'Play Again 🔄';
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cozy_slime_high_score', this.highScore.toString());
    }

    setTimeout(() => {
      document.getElementById('final-score').innerText = this.score.toLocaleString();
      document.getElementById('final-kills').innerText = this.friendsSaved.toString();
      document.getElementById('final-time').innerText = Math.floor(this.survivalTime) + 's';
      document.getElementById('final-best').innerText = this.highScore.toLocaleString();
      document.getElementById('game-over-modal').classList.remove('hidden');
    }, 450);
  }

  shootBubble() {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = 18;

    let aimAngle;
    if (this.joystick.active && (this.joystick.vx !== 0 || this.joystick.vy !== 0)) {
      aimAngle = Math.atan2(this.joystick.vy, this.joystick.vx);
    } else if (this.isMobileDevice()) {
      aimAngle = this.slime.facingAngle || 0;
    } else {
      aimAngle = Math.atan2(this.mouse.worldY - this.slime.y, this.mouse.worldX - this.slime.x);
    }

    const mouthDist = this.slime.radius + 8;
    const px = this.slime.x + Math.cos(aimAngle) * mouthDist;
    const py = this.slime.y + Math.sin(aimAngle) * mouthDist;

    const bubbleSpeed = this.speedConfigs[this.difficulty].bubbleSpeed;
    this.projectiles.push(new WaterBubble(px, py, aimAngle, bubbleSpeed));
    this.slime.triggerPop(aimAngle);

    this.multiplayer.broadcastShoot(px, py, aimAngle);
    window.soundEngine.playBubblePop();
  }

  spawnCuteEnemy() {
    const spawnDist = 650 + Math.random() * 200;
    const angle = Math.random() * Math.PI * 2;
    const ex = this.slime.x + Math.cos(angle) * spawnDist;
    const ey = this.slime.y + Math.sin(angle) * spawnDist;

    const b = this.worldBounds;
    const clampedX = Math.max(b.minX + 80, Math.min(b.maxX - 80, ex));
    const clampedY = Math.max(b.minY + 80, Math.min(b.maxY - 80, ey));

    const types = ['dustbunny'];
    if (this.score > 300) types.push('acorn');
    if (this.score > 700) types.push('starpuff');
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const enemy = new CuteEnemy(clampedX, clampedY, chosenType);
    enemy.speed *= this.speedConfigs[this.difficulty].enemySpeedMult;
    this.enemies.push(enemy);
  }

  updateHUD() {
    const scoreEl = document.getElementById('hud-score');
    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();

    const killsEl = document.getElementById('hud-kills');
    if (killsEl) killsEl.innerText = this.friendsSaved.toString();

    const comboEl = document.getElementById('hud-combo');
    if (comboEl) {
      comboEl.innerText = 'x' + this.combo;
      comboEl.style.color = this.combo > 1 ? '#ff7e67' : '#58c930';
    }

    const hpValEl = document.getElementById('hud-health-val');
    if (hpValEl) hpValEl.innerText = `${this.playerHealth} / ${this.maxHealth}`;

    const hpBarEl = document.getElementById('hud-health-bar-fill');
    if (hpBarEl) {
      const pct = Math.max(0, (this.playerHealth / this.maxHealth) * 100);
      hpBarEl.style.width = pct + '%';
      if (pct > 50) hpBarEl.style.backgroundColor = '#58c930';
      else if (pct > 25) hpBarEl.style.backgroundColor = '#f59e0b';
      else hpBarEl.style.backgroundColor = '#ef4444';
    }

    // Update 10-Second Peaceful Movement Regen Meter (Active when health drops to <= 50 until 100 HP is regained)
    const regenFill = document.getElementById('hud-regen-bar-fill');
    if (regenFill) {
      if (this.isEmergencyReviving && this.playerHealth < this.maxHealth && this.playerHealth > 0) {
        const progress = Math.min(100, (this.peacefulMoveTimer / 10.0) * 100);
        regenFill.style.width = `${progress}%`;
        regenFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      } else {
        regenFill.style.width = '0%';
      }
    }
  }

  // Trigger Green Theme Vignette Pulse & Revive Alert Toast when health restores
  triggerHealReviveAlert(healAmount = 10) {
    // 1. Green Theme Glow Vignette Overlay
    const vignette = document.getElementById('heal-vignette');
    if (vignette) {
      vignette.classList.remove('active');
      void vignette.offsetWidth; // force DOM reflow
      vignette.classList.add('active');
      setTimeout(() => vignette.classList.remove('active'), 2000);
    }

    // 2. Revive Alert Banner Toast
    const toast = document.getElementById('revive-toast');
    if (toast) {
      const badge = toast.querySelector('span:last-child');
      if (badge) badge.innerText = `+${healAmount} HP`;
      toast.classList.remove('visible');
      void toast.offsetWidth; // force DOM reflow
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2600);
    }

    // 3. HUD Health Bar Emerald Halo Pulse
    const healthGroup = document.getElementById('health-hud-group');
    if (healthGroup) {
      healthGroup.classList.remove('healing-pulse');
      void healthGroup.offsetWidth; // force DOM reflow
      healthGroup.classList.add('healing-pulse');
      setTimeout(() => healthGroup.classList.remove('healing-pulse'), 1400);
    }

    // 4. Harmonious Angelic Healing Chime Sound
    if (window.soundEngine && window.soundEngine.playHealRevive) {
      window.soundEngine.playHealRevive();
    }
  }

  update() {
    this.mouse.worldX = this.mouse.screenX - this.canvas.width / 2 + this.camera.x;
    this.mouse.worldY = this.mouse.screenY - this.canvas.height / 2 + this.camera.y;

    if (this.state !== 'PLAYING') {
      this.slime.update(0, 0, this.mouse.worldX, this.mouse.worldY, this.obstacles, this.worldBounds);
      this.particles.update(this.worldBounds);
      return;
    }

    this.survivalTime += 0.016;

    // Movement
    let moveX = 0;
    let moveY = 0;
    if (this.keys.up) moveY -= 1;
    if (this.keys.down) moveY += 1;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;

    if (this.joystick && this.joystick.active) {
      moveX += this.joystick.vx;
      moveY += this.joystick.vy;
      const mag = Math.hypot(moveX, moveY);
      if (mag > 1) {
        moveX /= mag;
        moveY /= mag;
      }
    }

    const isMoving = (moveX !== 0 || moveY !== 0);
    if (isMoving && Math.random() < 0.035) {
      window.soundEngine.playSquish(0.95 + Math.random() * 0.15);
    }

    this.slime.update(moveX, moveY, this.mouse.worldX, this.mouse.worldY, this.obstacles, this.worldBounds);

    // 10 Seconds Safe Movement = Revive Regeneration! (Triggered when HP drops to <= 50, continues until 100 HP is reached)
    if (this.playerHealth <= 50 && this.playerHealth > 0) {
      this.isEmergencyReviving = true;
    }

    if (this.isEmergencyReviving && this.playerHealth < this.maxHealth && this.playerHealth > 0) {
      if (isMoving) {
        this.peacefulMoveTimer += 0.016;
        if (this.peacefulMoveTimer >= 10.0) {
          this.peacefulMoveTimer = 0;
          const healAmount = 10;
          this.playerHealth = Math.min(this.maxHealth, this.playerHealth + healAmount);
          this.triggerHealReviveAlert(healAmount);
          this.particles.addTextPopup(this.slime.x, this.slime.y - 18, `+${healAmount} HP Revived! (${this.playerHealth}/100) 💚`, '#22c55e');
          this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#4ade80', 25);
          if (this.playerHealth >= this.maxHealth) {
            this.isEmergencyReviving = false;
            this.peacefulMoveTimer = 0;
          }
          this.updateHUD();
        }
      }
    } else {
      if (this.playerHealth >= this.maxHealth) {
        this.isEmergencyReviving = false;
      }
      this.peacefulMoveTimer = 0;
    }

    // Keep HUD regen meter smoothly updated
    if (this.frameCounter % 6 === 0) {
      const regenFill = document.getElementById('hud-regen-bar-fill');
      if (regenFill) {
        if (this.isEmergencyReviving && this.playerHealth < this.maxHealth && this.playerHealth > 0) {
          const progress = Math.min(100, (this.peacefulMoveTimer / 10.0) * 100);
          regenFill.style.width = `${progress}%`;
        } else {
          regenFill.style.width = '0%';
        }
      }
    }

    // Broadcast state to other player
    this.multiplayer.broadcastState(this.slime);

    // Shooting
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.keys.shoot || this.mouse.isDown) {
      this.shootBubble();
    }

    // Update Bubbles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(this.worldBounds, this.obstacles);

      // Hit cute enemy check
      for (let enemy of this.enemies) {
        if (enemy.isDead) continue;
        const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
        if (dist < proj.radius + enemy.radius) {
          proj.isDead = true;
          enemy.takeDamage();

          if (enemy.isDead) {
            this.friendsSaved++;
            const points = enemy.scoreVal * this.combo;
            this.score += points;
            this.combo++;
            this.comboTimer = 220;

            window.soundEngine.playEnemyDie();
            this.particles.spawnBubbleBurst(enemy.x, enemy.y, enemy.color, 20);
            this.particles.addTextPopup(enemy.x, enemy.y - 10, `+${points}`, '#16a34a');
          } else {
            this.particles.spawnBubbleBurst(proj.x, proj.y, '#93c5fd', 10);
          }
          break;
        }
      }

      if (proj.isDead) {
        this.particles.spawnBubbleBurst(proj.x, proj.y, '#93c5fd', 6);
        this.projectiles.splice(i, 1);
      }
    }

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // Enemies update & 15-Hit Player Damage Detection
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(this.slime.x, this.slime.y, this.obstacles, this.enemies);

      const distToPlayer = Math.hypot(enemy.x - this.slime.x, enemy.y - this.slime.y);
      const hitDist = this.slime.radius * 0.78 + enemy.radius * 0.78;

      if (distToPlayer < hitDist) {
        if (this.slime.takeHit()) {
          const dmg = 2; // -2 HP when colliding with an enemy
          this.playerHealth = Math.max(0, this.playerHealth - dmg);
          if (this.playerHealth <= 50 && this.playerHealth > 0) {
            this.isEmergencyReviving = true;
          }
          this.peacefulMoveTimer = 0; // Reset safe movement timer on taking damage
          this.camera.shake = 6;
          window.soundEngine.playSquish(1.3);
          this.particles.addTextPopup(this.slime.x, this.slime.y - 16, `-${dmg} HP`, '#ef4444');
          this.particles.spawnBubbleBurst(this.slime.x, this.slime.y, '#ef4444', 8);

          if (this.playerHealth <= 0) {
            this.triggerPlayerSquished();
            break;
          }
        }
      }
    }

    // Enemy spawning (scales with difficulty)
    this.spawnTimer++;
    const maxEnemies = this.gameMode === 'multi' ? 26 : 16;
    const spawnRateMult = (this.speedConfigs && this.speedConfigs[this.difficulty]) ? this.speedConfigs[this.difficulty].spawnRateMult : 1.0;
    const currentInterval = Math.max(50, Math.floor((this.spawnInterval - Math.floor(this.score / 400) * 8) / spawnRateMult));
    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      if (this.enemies.length < maxEnemies) {
        this.spawnCuteEnemy();
      }
    }

    this.particles.update(this.worldBounds);

    // Camera follow
    this.camera.x += (this.slime.x - this.camera.x) * 0.08;
    this.camera.y += (this.slime.y - this.camera.y) * 0.08;

    if (this.camera.shake > 0) {
      this.camera.shake *= 0.85;
      if (this.camera.shake < 0.1) this.camera.shake = 0;
    }

    this.updateHUD();
  }

  // Dynamic Living Tabletop Background with Honey Oak Planks & Animated Sunbeam Caustics
  drawBackground(ctx) {
    const b = this.worldBounds;
    const cx = this.camera.x;
    const cy = this.camera.y;

    const plankW = 160;
    const startX = Math.floor((cx - this.canvas.width / 2) / plankW) * plankW;
    const endX = startX + this.canvas.width + plankW * 2;
    const startY = cy - this.canvas.height / 2 - 50;
    const endY = cy + this.canvas.height / 2 + 50;

    // 1. Alternating Rich Honey-Oak Wood Planks
    for (let x = startX; x <= endX; x += plankW) {
      const plankIndex = Math.floor(x / plankW);
      ctx.fillStyle = (plankIndex % 2 === 0) ? '#f5e7d3' : '#ebdcc5';
      ctx.fillRect(x, startY, plankW, endY - startY);

      // Fine wood grain streaks
      ctx.strokeStyle = 'rgba(195, 155, 115, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + plankW * 0.3, startY);
      ctx.lineTo(x + plankW * 0.3, endY);
      ctx.moveTo(x + plankW * 0.7, startY);
      ctx.lineTo(x + plankW * 0.7, endY);
      ctx.stroke();

      // Beveled seam between planks (shadow line + light bevel line)
      ctx.strokeStyle = 'rgba(135, 95, 60, 0.28)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 2, startY);
      ctx.lineTo(x + 2, endY);
      ctx.stroke();
    }

    // 2. Animated Soft Sunlight Caustics / Sunbeams drifting across table
    ctx.save();
    const time = this.survivalTime || 0;
    const sunOffset = Math.sin(time * 0.4) * 40;
    const sunGrad = ctx.createLinearGradient(
      cx - 400 + sunOffset, cy - 300,
      cx + 400 + sunOffset, cy + 300
    );
    sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0)');
    sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.1)');
    sunGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.16)');
    sunGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.1)');
    sunGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(cx - this.canvas.width / 2, cy - this.canvas.height / 2, this.canvas.width, this.canvas.height);
    ctx.restore();

    // 3. Tabletop Boundaries with Polished Beveled Frame
    ctx.save();
    // Inner table soft drop shadow around perimeter
    ctx.strokeStyle = 'rgba(120, 80, 45, 0.25)';
    ctx.lineWidth = 16;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // Crisp white tabletop border line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // Warm outer rim
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(b.minX - 5, b.minY - 5, b.maxX - b.minX + 10, b.maxY - b.minY + 10);
    ctx.restore();
  }

  drawMinimap() {
    if (!this.minimapCtx) return;
    const mCtx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const b = this.worldBounds;
    const worldW = b.maxX - b.minX;
    const worldH = b.maxY - b.minY;

    mCtx.clearRect(0, 0, w, h);

    mCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    mCtx.beginPath();
    mCtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    mCtx.fill();

    const toMapX = (wx) => ((wx - b.minX) / worldW) * (w - 18) + 9;
    const toMapY = (wy) => ((wy - b.minY) / worldH) * (h - 18) + 9;

    mCtx.fillStyle = '#cbd5e1';
    for (let obs of this.obstacles) {
      mCtx.beginPath();
      mCtx.arc(toMapX(obs.x), toMapY(obs.y), 2.0, 0, Math.PI * 2);
      mCtx.fill();
    }

    mCtx.fillStyle = '#c084fc';
    for (let e of this.enemies) {
      mCtx.beginPath();
      mCtx.arc(toMapX(e.x), toMapY(e.y), 2.5, 0, Math.PI * 2);
      mCtx.fill();
    }

    if (this.multiplayer && this.multiplayer.otherPlayer) {
      const op = this.multiplayer.otherPlayer;
      mCtx.fillStyle = '#ff6b81';
      mCtx.beginPath();
      mCtx.arc(toMapX(op.x), toMapY(op.y), 4.5, 0, Math.PI * 2);
      mCtx.fill();
    }

    mCtx.fillStyle = '#58c930';
    mCtx.beginPath();
    mCtx.arc(toMapX(this.slime.x), toMapY(this.slime.y), 4.8, 0, Math.PI * 2);
    mCtx.fill();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;

    ctx.translate(
      this.canvas.width / 2 - this.camera.x + shakeX,
      this.canvas.height / 2 - this.camera.y + shakeY
    );

    // 1. Tabletop oak background
    this.drawBackground(ctx);

    // 2. Ambient sunbeam dust motes
    this.particles.drawDust(ctx);

    // 3. Cute obstacles
    for (let obs of this.obstacles) {
      obs.draw(ctx);
    }

    // 4. Water bubbles
    for (let proj of this.projectiles) {
      proj.draw(ctx);
    }

    // 5. Gentle enemies
    for (let enemy of this.enemies) {
      enemy.draw(ctx);
    }

    // 6. Second Player (Multiplayer)
    this.multiplayer.drawOtherPlayer(ctx);

    // 7. Local Slime Player
    if (this.state !== 'GAMEOVER') {
      this.slime.draw(ctx, this.mouse.worldX, this.mouse.worldY);
    }

    // 8. Particles & popups
    this.particles.drawParticles(ctx);

    ctx.restore();

    // 9. Minimap
    this.drawMinimap();
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.slimeGame = new CuteSlimeGame();
});

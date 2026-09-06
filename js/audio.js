// Cozy & Playful Audio Engine for Cute Slime Adventure using Web Audio API
class CozySoundFX {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.melodyTimer = null;
    this.isMusicPlaying = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.isMusicPlaying && !this.isMuted) {
      this.startCheerfulMusic();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Cute squishy jelly hop sound
  playSquish(pitch = 1.0) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(140 * pitch, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  // Cute water bubble pop sound when shooting from mouth
  playBubblePop() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // Revive / Health Regenerated Chime (Sweet upward angelic sparkle)
  playHealRevive() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      chords.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.12, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.35);
      });
    } catch (e) {}
  }

  // Adorable Enemy Die Sound (Cute squeaky "poof" + sparkle chimes)
  playEnemyDie() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;

      const squeakOsc = this.ctx.createOscillator();
      const squeakGain = this.ctx.createGain();
      squeakOsc.type = 'sine';
      squeakOsc.frequency.setValueAtTime(650, now);
      squeakOsc.frequency.exponentialRampToValueAtTime(1250, now + 0.06);
      squeakOsc.frequency.exponentialRampToValueAtTime(300, now + 0.14);

      squeakGain.gain.setValueAtTime(0.15, now);
      squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      squeakOsc.connect(squeakGain);
      squeakGain.connect(this.ctx.destination);
      squeakOsc.start(now);
      squeakOsc.stop(now + 0.14);

      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);
        gain.gain.setValueAtTime(0.1, now + idx * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.16);
      });
    } catch (e) {}
  }

  // Cute soft "squished" sound on player touch
  playSquished() {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // Soothing acoustic kalimba background melody
  startCheerfulMusic() {
    if (this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;

    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    let step = 0;

    const playNote = () => {
      if (this.isMuted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const noteIndex = [0, 2, 4, 3, 1, 5, 3, 2][step % 8];
        const freq = scale[noteIndex];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
        step++;
      } catch (e) {}
    };

    this.melodyTimer = setInterval(playNote, 600);
  }
}

window.soundEngine = new CozySoundFX();

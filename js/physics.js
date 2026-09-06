// Authentic 3D Gelatin Slime Physics & Rendering (Customizable Palettes & 3D Shapes)
const SLIME_PALETTES = {
  matcha: {
    name: 'Matcha',
    side: ['#86efac', '#4ade80', '#22c55e', '#15803d', 'rgba(21, 128, 61, 0.35)'],
    dome: ['#dcfce7', '#86efac', '#34d399', '#10b981', '#047857', 'rgba(6, 78, 59, 0.95)'],
    coreWhite: 'rgba(255, 255, 255, 0.38)',
    coreMid: 'rgba(134, 239, 172, 0.25)',
    coreEdge: 'rgba(34, 197, 94, 0)',
    rimStroke: 'rgba(220, 252, 231, 0.85)',
    bottomRim: 'rgba(187, 247, 208, 0.82)',
    blush: 'rgba(235, 215, 110, 0.88)',
    trail: 'rgba(99, 196, 52, '
  },
  berry: {
    name: 'Berry',
    side: ['#fbcfe8', '#f472b6', '#ec4899', '#be185d', 'rgba(190, 24, 93, 0.35)'],
    dome: ['#fdf2f8', '#fbcfe8', '#f472b6', '#db2777', '#9d174d', 'rgba(131, 24, 67, 0.95)'],
    coreWhite: 'rgba(255, 255, 255, 0.42)',
    coreMid: 'rgba(244, 114, 182, 0.28)',
    coreEdge: 'rgba(236, 72, 153, 0)',
    rimStroke: 'rgba(251, 207, 232, 0.85)',
    bottomRim: 'rgba(249, 168, 212, 0.82)',
    blush: 'rgba(254, 226, 226, 0.92)',
    trail: 'rgba(236, 72, 153, '
  },
  azure: {
    name: 'Azure',
    side: ['#bae6fd', '#38bdf8', '#0284c7', '#0369a1', 'rgba(3, 105, 161, 0.35)'],
    dome: ['#f0f9ff', '#bae6fd', '#38bdf8', '#0284c7', '#075985', 'rgba(12, 74, 110, 0.95)'],
    coreWhite: 'rgba(255, 255, 255, 0.45)',
    coreMid: 'rgba(56, 189, 248, 0.28)',
    coreEdge: 'rgba(2, 132, 199, 0)',
    rimStroke: 'rgba(186, 230, 253, 0.85)',
    bottomRim: 'rgba(125, 211, 252, 0.82)',
    blush: 'rgba(254, 240, 138, 0.88)',
    trail: 'rgba(56, 189, 248, '
  },
  honey: {
    name: 'Honey',
    side: ['#fef08a', '#facc15', '#eab308', '#ca8a04', 'rgba(202, 138, 4, 0.35)'],
    dome: ['#fefce8', '#fef08a', '#facc15', '#d97706', '#b45309', 'rgba(146, 64, 14, 0.95)'],
    coreWhite: 'rgba(255, 255, 255, 0.45)',
    coreMid: 'rgba(250, 204, 21, 0.3)',
    coreEdge: 'rgba(234, 179, 8, 0)',
    rimStroke: 'rgba(254, 240, 138, 0.85)',
    bottomRim: 'rgba(253, 224, 71, 0.82)',
    blush: 'rgba(254, 202, 202, 0.9)',
    trail: 'rgba(245, 158, 11, '
  },
  amethyst: {
    name: 'Amethyst',
    side: ['#e9d5ff', '#c084fc', '#9333ea', '#6b21a8', 'rgba(107, 33, 168, 0.35)'],
    dome: ['#faf5ff', '#e9d5ff', '#c084fc', '#9333ea', '#581c87', 'rgba(59, 7, 100, 0.95)'],
    coreWhite: 'rgba(255, 255, 255, 0.42)',
    coreMid: 'rgba(192, 132, 252, 0.28)',
    coreEdge: 'rgba(147, 51, 234, 0)',
    rimStroke: 'rgba(233, 213, 255, 0.85)',
    bottomRim: 'rgba(216, 180, 254, 0.82)',
    blush: 'rgba(254, 240, 138, 0.88)',
    trail: 'rgba(147, 51, 234, '
  }
};

class SlimePhysics {
  constructor(x, y, radius = 44, color = 'matcha', shape = 'classic') {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.speed = 4.2;

    // Appearance & Customization (Default: Matcha & Classic)
    this.color = SLIME_PALETTES[color] ? color : 'matcha';
    this.palette = SLIME_PALETTES[this.color];
    this.shape = ['classic', 'cat', 'bunny', 'star'].includes(shape) ? shape : 'classic';

    // Jelly squish & jiggle physics
    this.squishX = 1.0;
    this.squishY = 1.0;
    this.jigglePhase = 0;
    this.jiggleAmp = 0;
    this.facingAngle = 0;
    this.targetAngle = 0;

    // Face & health animations
    this.mouthOpenness = 0;
    this.blinkProgress = 0;
    this.blinkTimer = 0;
    this.bobPhase = 0;
    this.invulnerableTimer = 0; // i-frames when hit

    // Water dew droplets trail
    this.trail = [];
  }

  setColor(colorName) {
    if (SLIME_PALETTES[colorName]) {
      this.color = colorName;
      this.palette = SLIME_PALETTES[colorName];
    }
  }

  setShape(shapeName) {
    if (['classic', 'cat', 'bunny', 'star'].includes(shapeName)) {
      this.shape = shapeName;
    }
  }

  wobble(intensity = 0.35) {
    this.jiggleAmp = Math.min(0.5, this.jiggleAmp + intensity);
  }

  triggerPop(angle) {
    this.mouthOpenness = 1.0;
    this.vx -= Math.cos(angle) * 2.8;
    this.vy -= Math.sin(angle) * 2.8;
    this.wobble(0.4);
  }

  takeHit() {
    if (this.invulnerableTimer > 0) return false;
    this.invulnerableTimer = 45; // ~0.75s invulnerability
    this.wobble(0.5);
    return true;
  }

  update(moveX, moveY, aimX, aimY, obstacles, bounds) {
    this.bobPhase += 0.07;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer--;
    }

    // 1. Movement Acceleration
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      const nx = moveX / len;
      const ny = moveY / len;
      this.vx += nx * 0.65;
      this.vy += ny * 0.65;

      const curSpeed = Math.hypot(this.vx, this.vy);
      if (curSpeed > this.speed) {
        this.vx = (this.vx / curSpeed) * this.speed;
        this.vy = (this.vy / curSpeed) * this.speed;
      }
    } else {
      this.vx *= 0.86;
      this.vy *= 0.86;
    }

    this.x += this.vx;
    this.y += this.vy;

    // 2. Facing direction towards aim or movement
    if (aimX !== undefined && aimY !== undefined) {
      this.targetAngle = Math.atan2(aimY - this.y, aimX - this.x);
    } else if (Math.hypot(this.vx, this.vy) > 0.2) {
      this.targetAngle = Math.atan2(this.vy, this.vx);
    }

    let dAngle = this.targetAngle - this.facingAngle;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    this.facingAngle += dAngle * 0.15;

    // 3. Dynamic Soft-Body Squash & Stretch + Harmonic Jiggle
    const velMag = Math.hypot(this.vx, this.vy);
    const targetSquishX = 1.0 + (Math.abs(this.vx) - Math.abs(this.vy)) * 0.035;
    const targetSquishY = 1.0 + (Math.abs(this.vy) - Math.abs(this.vx)) * 0.035;

    this.jigglePhase += 0.25;
    this.jiggleAmp *= 0.91;
    const jiggleOffset = Math.sin(this.jigglePhase) * this.jiggleAmp;

    this.squishX += (targetSquishX + jiggleOffset - this.squishX) * 0.2;
    this.squishY += (targetSquishY - jiggleOffset - this.squishY) * 0.2;

    if (this.mouthOpenness > 0) {
      this.mouthOpenness = Math.max(0, this.mouthOpenness - 0.08);
    }

    this.blinkTimer++;
    if (this.blinkTimer > 180 + Math.random() * 90) {
      this.blinkTimer = 0;
      this.blinkProgress = 1.0;
    }
    if (this.blinkProgress > 0) {
      this.blinkProgress = Math.max(0, this.blinkProgress - 0.14);
    }

    // 4. Obstacle Collision & Squish Response
    if (obstacles) {
      for (let obs of obstacles) {
        const dx = this.x - obs.x;
        const dy = this.y - obs.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.radius * 0.85 + obs.radius;
        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          this.x += nx * overlap * 0.7;
          this.y += ny * overlap * 0.7;
          this.vx += nx * 0.4;
          this.vy += ny * 0.4;
          this.wobble(0.25);
        }
      }
    }

    // World arena boundaries
    if (bounds) {
      const margin = this.radius + 8;
      if (this.x < bounds.minX + margin) { this.x = bounds.minX + margin; this.vx *= -0.4; this.wobble(0.2); }
      if (this.x > bounds.maxX - margin) { this.x = bounds.maxX - margin; this.vx *= -0.4; this.wobble(0.2); }
      if (this.y < bounds.minY + margin) { this.y = bounds.minY + margin; this.vy *= -0.4; this.wobble(0.2); }
      if (this.y > bounds.maxY - margin) { this.y = bounds.maxY - margin; this.vy *= -0.4; this.wobble(0.2); }
    }

    // 5. Water droplet trail
    if (Math.random() < 0.25 && velMag > 0.8) {
      this.trail.push({
        x: this.x + (Math.random() - 0.5) * 24,
        y: this.y + (Math.random() - 0.5) * 24,
        r: 3 + Math.random() * 3,
        alpha: 0.5,
        decay: 0.015
      });
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].alpha -= this.trail[i].decay;
      if (this.trail[i].alpha <= 0) this.trail.splice(i, 1);
    }
  }

  draw(ctx, aimX, aimY) {
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const r = this.radius;
    const pal = this.palette || SLIME_PALETTES.matcha;

    // 1. Dew droplets on floor
    for (let drop of this.trail) {
      ctx.save();
      ctx.fillStyle = `${pal.trail}${drop.alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Drop Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(75, 50, 30, 0.24)';
    ctx.filter = 'blur(6px)';
    ctx.beginPath();
    ctx.ellipse(
      this.x, this.y + r * 0.52,
      r * 1.35 * Math.abs(this.squishX),
      r * 0.48 * Math.abs(this.squishY),
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.squishX, this.squishY);

    const vel = Math.hypot(this.vx, this.vy);
    const wobble = Math.sin(this.jigglePhase * 1.8) * (2.5 + vel * 0.4);
    const domeWobble = Math.cos(this.jigglePhase * 1.6) * (2.8 + vel * 0.5);

    // Shared Dome Gradient
    const domeGrad = ctx.createRadialGradient(
      -r * 0.28 + this.vx * 0.5, -r * 0.38 + this.vy * 0.5, r * 0.08,
      0, 2, r * 1.25
    );
    domeGrad.addColorStop(0, pal.dome[0]);
    domeGrad.addColorStop(0.2, pal.dome[1]);
    domeGrad.addColorStop(0.5, pal.dome[2]);
    domeGrad.addColorStop(0.78, pal.dome[3]);
    domeGrad.addColorStop(0.93, pal.dome[4]);
    domeGrad.addColorStop(1, pal.dome[5]);

    // ---------------- Shape Accessory (Back / Top Layer) ----------------
    if (this.shape === 'cat') {
      // Cute 3D Gelatin Cat Ears
      const earTilt = -this.vx * 0.08 + Math.sin(this.jigglePhase * 1.5) * 0.06;
      // Left Ear
      ctx.save();
      ctx.translate(-r * 0.46, -r * 0.72);
      ctx.rotate(earTilt - 0.22);
      ctx.beginPath();
      ctx.moveTo(-11, 10);
      ctx.quadraticCurveTo(-14, -20, 0, -28);
      ctx.quadraticCurveTo(14, -18, 9, 10);
      ctx.closePath();
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = pal.rimStroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Translucent soft pink inner ear
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.quadraticCurveTo(-7, -13, 0, -19);
      ctx.quadraticCurveTo(8, -12, 5, 6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(251, 113, 133, 0.45)';
      ctx.fill();
      ctx.restore();

      // Right Ear
      ctx.save();
      ctx.translate(r * 0.46, -r * 0.72);
      ctx.rotate(earTilt + 0.22);
      ctx.beginPath();
      ctx.moveTo(-9, 10);
      ctx.quadraticCurveTo(-14, -18, 0, -28);
      ctx.quadraticCurveTo(14, -20, 11, 10);
      ctx.closePath();
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = pal.rimStroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Translucent inner ear
      ctx.beginPath();
      ctx.moveTo(-5, 6);
      ctx.quadraticCurveTo(-8, -12, 0, -19);
      ctx.quadraticCurveTo(7, -13, 6, 6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(251, 113, 133, 0.45)';
      ctx.fill();
      ctx.restore();

    } else if (this.shape === 'bunny') {
      // Floppy Bouncy Gelatin Bunny Ears
      const bunnySway = -this.vx * 0.12 + Math.sin(this.bobPhase * 1.4) * 0.08;
      // Left Ear
      ctx.save();
      ctx.translate(-r * 0.34, -r * 0.85);
      ctx.rotate(bunnySway - 0.14);
      ctx.beginPath();
      ctx.ellipse(0, -22, 9, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = pal.rimStroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -22, 5, 19, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.42)';
      ctx.fill();
      ctx.restore();

      // Right Ear
      ctx.save();
      ctx.translate(r * 0.34, -r * 0.85);
      ctx.rotate(bunnySway + 0.14);
      ctx.beginPath();
      ctx.ellipse(0, -22, 9, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = pal.rimStroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -22, 5, 19, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.42)';
      ctx.fill();
      ctx.restore();

    } else if (this.shape === 'star') {
      // Twinkling Golden Star Crown
      ctx.save();
      const starBob = Math.sin(this.bobPhase * 1.8) * 3;
      ctx.translate(0, -r * 1.05 + starBob);
      // Golden glowing aura
      const starGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      starGlow.addColorStop(0, 'rgba(253, 224, 71, 0.7)');
      starGlow.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // 5-Point 3D Star
      const numPoints = 5;
      const outerR = 14;
      const innerR = 6.5;
      ctx.beginPath();
      for (let p = 0; p < numPoints * 2; p++) {
        const rad = p * (Math.PI / numPoints) - Math.PI / 2;
        const curR = p % 2 === 0 ? outerR : innerR;
        const sx = Math.cos(rad) * curR;
        const sy = Math.sin(rad) * curR;
        if (p === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Top facet highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Side Lobes with Animated Harmonic Jelly Wobble
    ctx.save();
    const sideGrad = ctx.createRadialGradient(0, 8, r * 0.2, 0, 10, r * 1.5);
    sideGrad.addColorStop(0, pal.side[0]);
    sideGrad.addColorStop(0.35, pal.side[1]);
    sideGrad.addColorStop(0.7, pal.side[2]);
    sideGrad.addColorStop(0.92, pal.side[3]);
    sideGrad.addColorStop(1, pal.side[4]);

    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.ellipse(0, 10 + wobble * 0.3, r * (1.38 + wobble * 0.02), r * (0.62 - wobble * 0.02), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Main 3D Gelatin Dome Body with Wave Deformation
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-r * 0.85 - domeWobble * 0.5, 12);
    ctx.bezierCurveTo(
      -r * (0.95 + domeWobble * 0.03), -r * (1.18 - domeWobble * 0.04),
      r * (0.95 - domeWobble * 0.03), -r * (1.18 + domeWobble * 0.04),
      r * 0.85 + domeWobble * 0.5, 12
    );
    ctx.quadraticCurveTo(0, 18 + wobble * 0.4, -r * 0.85 - domeWobble * 0.5, 12);
    ctx.closePath();
    ctx.fillStyle = domeGrad;
    ctx.fill();

    // Glowing 3D Subsurface Inner Jelly Core
    const corePulse = Math.sin(this.jigglePhase * 0.9) * 2;
    const coreGrad = ctx.createRadialGradient(
      -r * 0.1, -r * 0.15, 2,
      0, 0, r * 0.7 + corePulse
    );
    coreGrad.addColorStop(0, pal.coreWhite);
    coreGrad.addColorStop(0.45, pal.coreMid);
    coreGrad.addColorStop(1, pal.coreEdge);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, -2, r * 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = pal.rimStroke;
    ctx.stroke();

    // 5. Signature 3D Window Reflection (Follows movement angle tilt)
    ctx.save();
    const reflTilt = -0.24 + (this.vx * 0.04);
    ctx.translate(-r * 0.32 + this.vx * 0.3, -r * 0.42 + this.vy * 0.3);
    ctx.rotate(reflTilt);
    ctx.scale(0.85, 0.72);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    const paneW = 7.5;
    const paneH = 6.5;
    const gap = 3.0;

    ctx.beginPath();
    ctx.rect(-paneW - gap/2, -paneH - gap/2, paneW, paneH);
    ctx.rect(gap/2, -paneH - gap/2, paneW, paneH);
    ctx.rect(-paneW - gap/2, gap/2, paneW, paneH);
    ctx.rect(gap/2, gap/2, paneW, paneH);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glossy Specular arc on upper curve
    ctx.save();
    ctx.beginPath();
    ctx.arc(r * 0.2 + this.vx * 0.2, -r * 0.26 + this.vy * 0.2, r * 0.42, 1.22 * Math.PI, 1.82 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.stroke();
    ctx.restore();

    // Bottom contact rim refraction highlight
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 12, r * 0.78, r * 0.22, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = pal.bottomRim;
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // dome

    // 6. Cute Kawaii Face
    ctx.save();
    ctx.translate(0, 1);
    const faceRot = Math.sin(this.facingAngle) * 0.12;
    ctx.rotate(faceRot);

    // Eyebrows
    ctx.strokeStyle = '#14280b';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-13, -15, 6, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13, -15, 6, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();

    // Eyes
    const eyeScaleY = Math.max(0.08, 1.0 - this.blinkProgress);
    const eyeW = 5.5;
    const eyeH = 8.5;

    // Left Eye
    ctx.save();
    ctx.translate(-13, -6);
    ctx.scale(1.0, eyeScaleY);
    ctx.fillStyle = '#14280b';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW, eyeH, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (this.shape === 'star') {
      // Diamond star eye glint
      ctx.beginPath();
      ctx.moveTo(-1.5, -4.5);
      ctx.lineTo(0.5, -3);
      ctx.lineTo(-1.5, -1.5);
      ctx.lineTo(-3.5, -3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-1.5, -3, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(1.8, 2.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right Eye
    ctx.save();
    ctx.translate(13, -6);
    ctx.scale(1.0, eyeScaleY);
    ctx.fillStyle = '#14280b';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW, eyeH, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (this.shape === 'star') {
      // Diamond star eye glint
      ctx.beginPath();
      ctx.moveTo(-1.5, -4.5);
      ctx.lineTo(0.5, -3);
      ctx.lineTo(-1.5, -1.5);
      ctx.lineTo(-3.5, -3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-1.5, -3, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(1.8, 2.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Blushing Cheeks
    ctx.fillStyle = pal.blush;
    ctx.beginPath();
    ctx.ellipse(-18, 2, 6.5, 4, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, 2, 6.5, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers for Neko Cat shape
    if (this.shape === 'cat') {
      ctx.strokeStyle = '#14280b';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      // Left whiskers
      ctx.beginPath();
      ctx.moveTo(-21, -1);
      ctx.lineTo(-30, -3);
      ctx.moveTo(-21, 3);
      ctx.lineTo(-29, 6);
      ctx.stroke();
      // Right whiskers
      ctx.beginPath();
      ctx.moveTo(21, -1);
      ctx.lineTo(30, -3);
      ctx.moveTo(21, 3);
      ctx.lineTo(29, 6);
      ctx.stroke();
    }

    // Smiling Mouth
    ctx.save();
    ctx.translate(0, 3);

    if (this.mouthOpenness > 0.1) {
      const popR = 5.5 + this.mouthOpenness * 5;
      ctx.fillStyle = '#14280b';
      ctx.beginPath();
      ctx.arc(0, 0, popR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff7e67';
      ctx.beginPath();
      ctx.arc(0, 2, popR * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'cat') {
      // Kitty :3 mouth
      ctx.strokeStyle = '#14280b';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-3, 0, 3.2, 0.2 * Math.PI, 1.0 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, 0, 3.2, 0.0 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#14280b';
      ctx.beginPath();
      ctx.moveTo(-7, -2);
      ctx.quadraticCurveTo(0, 8, 7, -2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ff7e67';
      ctx.beginPath();
      ctx.arc(0, 3.2, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
    ctx.restore();
  }
}

window.SLIME_PALETTES = SLIME_PALETTES;
window.SlimePhysics = SlimePhysics;

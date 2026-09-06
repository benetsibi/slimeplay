// Cozy & Cute Entities: Water Bubbles, Gentle Enemies, Cute Toy Obstacles

// 1. Water Bubble Projectile (Popped from Slime Mouth)
class WaterBubble {
  constructor(x, y, angle, speed = 8.5) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 8.5;
    this.life = 1.0;
    this.decay = 0.015;
    this.isDead = false;
    this.trail = [];
  }

  update(bounds, obstacles) {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;

    // Little sparkle trail
    if (Math.random() < 0.4) {
      this.trail.push({ x: this.x, y: this.y, r: 2.5 + Math.random() * 2, life: 1.0 });
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= 0.09;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    if (this.life <= 0 ||
        this.x < bounds.minX || this.x > bounds.maxX ||
        this.y < bounds.minY || this.y > bounds.maxY) {
      this.isDead = true;
    }

    // Collision with obstacles
    if (obstacles) {
      for (let obs of obstacles) {
        const dist = Math.hypot(this.x - obs.x, this.y - obs.y);
        if (dist < obs.radius + this.radius) {
          this.isDead = true;
          break;
        }
      }
    }
  }

  draw(ctx) {
    // Sparkle trail
    for (let t of this.trail) {
      ctx.save();
      ctx.fillStyle = `rgba(130, 220, 255, ${t.life * 0.5})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * t.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Iridescent 3D Water Bubble
    ctx.save();
    ctx.translate(this.x, this.y);

    // Drop shadow
    ctx.fillStyle = 'rgba(70, 45, 25, 0.12)';
    ctx.beginPath();
    ctx.ellipse(0, 10, this.radius * 0.9, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bubble body gradient
    const grad = ctx.createRadialGradient(-2, -3, 1, 0, 0, this.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, 'rgba(180, 240, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(120, 210, 255, 0.5)');
    grad.addColorStop(1, 'rgba(150, 180, 255, 0.85)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Bubble rim outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Glint highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 2. Cute, Slow & Gentle Enemies
class CuteEnemy {
  constructor(x, y, type = 'dustbunny') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.isDead = false;
    this.animTime = Math.random() * 100;

    // Much slower, gentler speeds!
    if (type === 'dustbunny') {
      this.radius = 22;
      this.speed = 0.85 + Math.random() * 0.25; // Gentle and relaxed
      this.health = 1;
      this.color = '#c4b5fd'; // Soft pastel lavender
      this.scoreVal = 100;
    } else if (type === 'acorn') {
      this.radius = 24;
      this.speed = 0.7 + Math.random() * 0.2;
      this.health = 2;
      this.color = '#f59e0b'; // Soft amber
      this.scoreVal = 200;
    } else { // starpuff
      this.radius = 20;
      this.speed = 0.8 + Math.random() * 0.2;
      this.health = 1;
      this.color = '#f472b6'; // Pastel pink
      this.scoreVal = 150;
    }
  }

  update(playerX, playerY, obstacles, otherEnemies) {
    this.animTime += 0.05;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    const nx = dx / dist;
    const ny = dy / dist;

    // Gentle floating locomotion
    const bob = Math.sin(this.animTime * 2) * 0.3;
    this.vx += (nx * (this.speed + bob) - this.vx) * 0.04;
    this.vy += (ny * (this.speed + bob) - this.vy) * 0.04;

    // Obstacle avoidance
    if (obstacles) {
      for (let obs of obstacles) {
        const odx = this.x - obs.x;
        const ody = this.y - obs.y;
        const odist = Math.hypot(odx, ody);
        const minDist = this.radius + obs.radius + 6;
        if (odist < minDist && odist > 0.001) {
          const push = minDist - odist;
          this.x += (odx / odist) * push * 0.35;
          this.y += (ody / odist) * push * 0.35;
        }
      }
    }

    // Gentle separation between friends
    if (otherEnemies) {
      for (let other of otherEnemies) {
        if (other === this || other.isDead) continue;
        const edx = this.x - other.x;
        const edy = this.y - other.y;
        const edist = Math.hypot(edx, edy);
        const minDist = this.radius + other.radius;
        if (edist < minDist && edist > 0.001) {
          const push = (minDist - edist) * 0.15;
          this.x += (edx / edist) * push;
          this.y += (edy / edist) * push;
        }
      }
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  takeDamage() {
    this.health--;
    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Soft drop shadow on floor
    ctx.fillStyle = 'rgba(70, 45, 25, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.7, this.radius * 0.85, this.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const hop = Math.sin(this.animTime * 3) * 3;
    ctx.translate(0, hop);

    if (this.type === 'dustbunny') {
      // 1. Spiky Shadow Thorn Prowler
      const spikeRot = this.animTime * 1.2;
      const spikeCount = 10;

      // Sharp radiating needle thorns
      ctx.save();
      ctx.rotate(spikeRot);
      ctx.fillStyle = '#7f1d1d';
      for (let i = 0; i < spikeCount; i++) {
        const ang = (i / spikeCount) * Math.PI * 2;
        const spikeLen = this.radius * (1.38 + Math.sin(this.animTime * 4 + i) * 0.18);
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-3.5, -this.radius * 0.6);
        ctx.lineTo(0, -spikeLen);
        ctx.lineTo(3.5, -this.radius * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Menacing Dark Core Body with Crimson Rim
      const bodyGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, this.radius);
      bodyGrad.addColorStop(0, '#3b0764');
      bodyGrad.addColorStop(0.7, '#1e1b4b');
      bodyGrad.addColorStop(1, '#991b1b');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Sharp, Angry Glowing Amber/Crimson Eyes
      ctx.save();
      // Left eye (angry slanted)
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-3, -1);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();

      // Left pupil (vertical dangerous slit)
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(-7, -1, 1.2, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Right eye (angry slanted)
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(11, -5);
      ctx.lineTo(3, -1);
      ctx.lineTo(9, 3);
      ctx.closePath();
      ctx.fill();

      // Right pupil
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(7, -1, 1.2, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Menacing furrowed brow lines
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.lineTo(-2, -3);
      ctx.moveTo(12, -7);
      ctx.lineTo(2, -3);
      ctx.stroke();

      // Sharp fanged snarl
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, 7);
      ctx.lineTo(-3, 9);
      ctx.lineTo(0, 7);
      ctx.lineTo(3, 9);
      ctx.lineTo(5, 7);
      ctx.stroke();
      ctx.restore();

    } else if (this.type === 'acorn') {
      // 2. Heavy Armored Bramble Beetle with Sharp Horns
      const pinch = Math.sin(this.animTime * 6) * 0.15;

      // Heavy Horns / Mandibles
      ctx.save();
      ctx.fillStyle = '#451a03';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;

      // Left Mandible
      ctx.save();
      ctx.rotate(-0.35 + pinch);
      ctx.beginPath();
      ctx.moveTo(-6, -this.radius * 0.6);
      ctx.quadraticCurveTo(-this.radius * 0.9, -this.radius * 1.5, -4, -this.radius * 1.65);
      ctx.quadraticCurveTo(-this.radius * 0.5, -this.radius * 1.2, -2, -this.radius * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Right Mandible
      ctx.save();
      ctx.rotate(0.35 - pinch);
      ctx.beginPath();
      ctx.moveTo(6, -this.radius * 0.6);
      ctx.quadraticCurveTo(this.radius * 0.9, -this.radius * 1.5, 4, -this.radius * 1.65);
      ctx.quadraticCurveTo(this.radius * 0.5, -this.radius * 1.2, 2, -this.radius * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      // Armored Carapace Body
      const beetleGrad = ctx.createRadialGradient(0, 2, 2, 0, 4, this.radius);
      beetleGrad.addColorStop(0, '#92400e');
      beetleGrad.addColorStop(0.65, '#451a03');
      beetleGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = beetleGrad;
      ctx.beginPath();
      ctx.ellipse(0, 4, this.radius, this.radius * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();

      // Danger Carapace Seam & Spikes
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius * 0.6);
      ctx.lineTo(0, this.radius * 1.15);
      ctx.stroke();

      // Side carapace razor plates
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.9, 0);
      ctx.lineTo(-this.radius * 1.25, 4);
      ctx.lineTo(-this.radius * 0.85, 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(this.radius * 0.9, 0);
      ctx.lineTo(this.radius * 1.25, 4);
      ctx.lineTo(this.radius * 0.85, 10);
      ctx.closePath();
      ctx.fill();

      // Glowing Fierce Toxic Eyes
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-7, -3, 4.5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(7, -3, 4.5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(-7, -3, 1.4, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(7, -3, 1.4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // 3. Crimson Razor Fiend with Spinning Saw Blades
      const bladeRot = this.animTime * 2.5;
      const blades = 6;

      ctx.save();
      ctx.rotate(bladeRot);
      ctx.fillStyle = '#9d174d';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.8;

      // Razor-sharp curved scythe blades
      for (let i = 0; i < blades; i++) {
        const ang = (i / blades) * Math.PI * 2;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius * 0.45);
        ctx.quadraticCurveTo(this.radius * 0.8, -this.radius * 0.8, this.radius * 1.4, -this.radius * 0.2);
        ctx.lineTo(this.radius * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Pulsing Dark Magenta Core
      const corePulse = Math.sin(this.animTime * 5) * 1.5;
      const fiendGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * 0.85);
      fiendGrad.addColorStop(0, '#f43f5e');
      fiendGrad.addColorStop(0.5, '#831843');
      fiendGrad.addColorStop(1, '#370617');
      ctx.fillStyle = fiendGrad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.82 + corePulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Menacing Fierce Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(2, 0);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#881337';
      ctx.beginPath();
      ctx.arc(-5, 0, 1.4, 0, Math.PI * 2);
      ctx.arc(5, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// 3. Cozy Cute Obstacles (Toy Building Blocks & Potted Succulents)
class CozyObstacle {
  constructor(x, y, type = 'block', radius = 42) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = radius;
    this.blockColor = ['#fca5a5', '#93c5fd', '#fde047', '#86efac'][Math.floor(Math.random() * 4)];
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Realistic soft drop shadow
    ctx.fillStyle = 'rgba(70, 45, 25, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.75, this.radius * 1.1, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.type === 'succulent') {
      // Cute Potted Mini Succulent
      // Terracotta clay pot
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, 8, this.radius * 0.75, 0, Math.PI);
      ctx.fill();

      // Pot rim
      ctx.fillStyle = '#c2410c';
      ctx.fillRect(-this.radius * 0.78, 4, this.radius * 1.56, 7);

      // Chubby round green succulent leaves
      ctx.fillStyle = '#22c55e';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const lx = Math.cos(a) * (this.radius * 0.45);
        const ly = Math.sin(a) * (this.radius * 0.45) - 4;
        ctx.beginPath();
        ctx.arc(lx, ly, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center bright bud & pink flower
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(0, -4, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'macaron') {
      // Delicious Cute Macaron
      // Top Shell
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(0, -6, this.radius * 0.85, this.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cream filling
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.radius * 0.8, -4, this.radius * 1.6, 6);

      // Bottom Shell
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(0, 4, this.radius * 0.85, this.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-8, -9, 8, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Pastel Wooden Toy Building Block (3D Beveled Cube)
      const s = this.radius * 1.35;
      ctx.fillStyle = this.blockColor;
      
      // Rounded block body
      ctx.beginPath();
      ctx.roundRect(-s/2, -s/2, s, s, 14);
      ctx.fill();

      // 3D Top bevel highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-s/2 + 3, -s/2 + 3, s - 6, s/2, [12, 12, 0, 0]);
      ctx.fill();

      // Friendly subtle letter or star on toy block
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 22px "Nunito", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
    }

    ctx.restore();
  }
}

// 4. Sparkling Water Bubble Particle System
class CuteParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingDust = [];
    this.textPopups = [];
  }

  initAmbientDust(bounds, count = 65) {
    this.floatingDust = [];
    for (let i = 0; i < count; i++) {
      this.floatingDust.push({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        r: 1.5 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        alpha: 0.25 + Math.random() * 0.45,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  spawnBubbleBurst(x, y, color = '#60a5fa', count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 3.5,
        color: color,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.02
      });
    }
  }

  addTextPopup(x, y, text, color = '#16a34a') {
    this.textPopups.push({
      x, y, text, color,
      vy: -1.2,
      life: 1.0,
      decay: 0.025
    });
  }

  update(bounds) {
    // Ambient dust motes
    for (let d of this.floatingDust) {
      d.x += d.vx;
      d.y += d.vy;
      d.pulse += 0.02;
      if (d.x < bounds.minX) d.x = bounds.maxX;
      if (d.x > bounds.maxX) d.x = bounds.minX;
      if (d.y < bounds.minY) d.y = bounds.maxY;
      if (d.y > bounds.maxY) d.y = bounds.minY;
    }

    // Active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Text popups
    for (let i = this.textPopups.length - 1; i >= 0; i--) {
      const t = this.textPopups[i];
      t.y += t.vy;
      t.life -= t.decay;
      if (t.life <= 0) this.textPopups.splice(i, 1);
    }
  }

  drawDust(ctx) {
    for (let d of this.floatingDust) {
      const pulseAlpha = d.alpha * (0.6 + 0.4 * Math.sin(d.pulse));
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (let p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let t of this.textPopups) {
      ctx.save();
      ctx.globalAlpha = t.life;
      ctx.font = 'bold 18px "Nunito", sans-serif';
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}

window.WaterBubble = WaterBubble;
window.CuteEnemy = CuteEnemy;
window.CozyObstacle = CozyObstacle;
window.CuteParticleSystem = CuteParticleSystem;

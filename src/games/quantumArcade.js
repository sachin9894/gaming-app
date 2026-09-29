// Interactive Real-Time Cyber Arcade Game Engine for all 20 games
import { sound } from '../sound.js';
import confetti from 'canvas-confetti';

export class QuantumArcadeGame {
  constructor(containerElement, gameData, onGameOverCallback, onScoreUpdateCallback) {
    this.container = containerElement;
    this.gameData = gameData;
    this.onGameOver = onGameOverCallback;
    this.onScoreUpdate = onScoreUpdateCallback;

    this.score = 0;
    this.energy = 100;
    this.isRunning = false;

    this.player = {
      x: 0,
      y: 0,
      size: 24,
      speed: 6,
      color: gameData.color || '#00f3ff'
    };

    this.lasers = [];
    this.enemies = [];
    this.particles = [];
    this.keys = {};

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.resize();
    this.player.x = this.canvas.width / 2;
    this.player.y = this.canvas.height - 70;

    // Controls
    this.boundKeyDown = (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Enter') {
        this.fireAction();
      }
    };
    this.boundKeyUp = (e) => {
      this.keys[e.key] = false;
    };
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Mouse / Touch Controls
    this.boundPointerMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX !== undefined) {
        this.player.x = clientX - rect.left;
        if (clientY !== undefined) {
          this.player.y = Math.max(80, Math.min(this.canvas.height - 30, clientY - rect.top));
        }
      }
    };

    this.boundPointerDown = () => {
      this.fireAction();
    };

    this.canvas.addEventListener('mousemove', this.boundPointerMove);
    this.canvas.addEventListener('touchmove', this.boundPointerMove);
    this.canvas.addEventListener('mousedown', this.boundPointerDown);
    this.canvas.addEventListener('touchstart', this.boundPointerDown);

    this.boundResize = this.resize.bind(this);
    window.addEventListener('resize', this.boundResize);

    this.isRunning = true;
    this.spawnTimer = 0;
    this.animate();
  }

  resize() {
    if (!this.container || !this.canvas) return;
    this.canvas.width = this.container.clientWidth || 800;
    this.canvas.height = this.container.clientHeight || 500;
  }

  fireAction() {
    if (!this.isRunning) return;
    sound.playLaser();

    // Spawn 2 parallel cyber plasma bolts
    this.lasers.push({
      x: this.player.x - 12,
      y: this.player.y - 15,
      vy: -14,
      color: this.player.color
    });
    this.lasers.push({
      x: this.player.x + 12,
      y: this.player.y - 15,
      vy: -14,
      color: this.player.color
    });
  }

  spawnEnemy() {
    const size = 26 + Math.random() * 22;
    const x = Math.random() * (this.canvas.width - size * 2) + size;
    const colors = ['#ff007f', '#ffe600', '#9d00ff', '#00ff88'];
    this.enemies.push({
      x,
      y: -size,
      size,
      vy: 2.5 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      color: colors[Math.floor(Math.random() * colors.length)],
      health: 2
    });
  }

  createBurst(x, y, color) {
    sound.playExplosion();
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 4 + 2,
        life: 1.0,
        color
      });
    }
  }

  update() {
    if (!this.isRunning) return;

    // Keyboard motion
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.player.x -= this.player.speed;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.player.x += this.player.speed;
    }
    if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
      this.player.y -= this.player.speed;
    }
    if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
      this.player.y += this.player.speed;
    }

    // Keep player in bounds
    this.player.x = Math.max(20, Math.min(this.canvas.width - 20, this.player.x));
    this.player.y = Math.max(40, Math.min(this.canvas.height - 20, this.player.y));

    // Spawn enemies
    this.spawnTimer++;
    if (this.spawnTimer % 35 === 0) {
      this.spawnEnemy();
    }

    // Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y += l.vy;

      // Check laser hit enemy
      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dist = Math.hypot(l.x - e.x, l.y - e.y);
        if (dist < e.size) {
          e.health--;
          hit = true;
          this.createBurst(l.x, l.y, l.color);
          if (e.health <= 0) {
            this.createBurst(e.x, e.y, e.color);
            this.enemies.splice(j, 1);
            this.score += 75;
            sound.playCoin();
          }
          break;
        }
      }

      if (hit || l.y < -20) {
        this.lasers.splice(i, 1);
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy;
      e.rot += e.rotSpeed;

      // Check collision with player
      const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      if (dist < e.size + this.player.size) {
        this.createBurst(this.player.x, this.player.y, '#ff0055');
        this.enemies.splice(i, 1);
        this.energy -= 25;
        sound.playExplosion();

        if (this.energy <= 0) {
          this.endGame();
          return;
        }
      }

      if (e.y > this.canvas.height + 40) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.score += 1;
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, `${Math.max(0, this.energy)}% ENERGY`);
    }
  }

  draw() {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background gradient with grid
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#040711');
    grad.addColorStop(1, '#0a1226');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Glowing Cyber Grid Lines
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
    this.ctx.lineWidth = 1;
    const step = 40;
    const offset = (Date.now() * 0.06) % step;
    for (let y = offset; y < h; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }
    for (let x = 0; x < w; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }

    // Draw Lasers
    this.lasers.forEach((l) => {
      this.ctx.save();
      this.ctx.fillStyle = l.color;
      this.ctx.shadowColor = l.color;
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(l.x - 2, l.y, 4, 18);
      this.ctx.restore();
    });

    // Draw Enemies
    this.enemies.forEach((e) => {
      this.ctx.save();
      this.ctx.translate(e.x, e.y);
      this.ctx.rotate(e.rot);
      this.ctx.strokeStyle = e.color;
      this.ctx.fillStyle = 'rgba(10, 20, 40, 0.8)';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = e.color;
      this.ctx.shadowBlur = 10;

      // Polygon shape
      this.ctx.beginPath();
      this.ctx.moveTo(0, -e.size);
      this.ctx.lineTo(e.size, 0);
      this.ctx.lineTo(0, e.size);
      this.ctx.lineTo(-e.size, 0);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Inner Core
      this.ctx.fillStyle = e.color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, e.size * 0.35, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });

    // Draw Particles
    this.particles.forEach((p) => {
      this.ctx.save();
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw Player Craft
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.shadowColor = this.player.color;
    this.ctx.shadowBlur = 16;
    this.ctx.strokeStyle = this.player.color;
    this.ctx.fillStyle = '#071124';
    this.ctx.lineWidth = 2.5;

    // Futuristic Fighter Jet silhouette
    this.ctx.beginPath();
    this.ctx.moveTo(0, -24);
    this.ctx.lineTo(20, 18);
    this.ctx.lineTo(8, 12);
    this.ctx.lineTo(0, 20);
    this.ctx.lineTo(-8, 12);
    this.ctx.lineTo(-20, 18);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Thruster flame
    const flameH = 14 + Math.random() * 8;
    this.ctx.fillStyle = '#ffe600';
    this.ctx.shadowColor = '#ffaa00';
    this.ctx.beginPath();
    this.ctx.moveTo(-5, 18);
    this.ctx.lineTo(0, 18 + flameH);
    this.ctx.lineTo(5, 18);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  animate() {
    if (!this.isRunning) return;
    this.animId = requestAnimationFrame(this.animate.bind(this));
    this.update();
    this.draw();
  }

  endGame() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.onGameOver) {
      this.onGameOver(this.score, Math.max(0, this.energy));
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.boundPointerMove);
      this.canvas.removeEventListener('touchmove', this.boundPointerMove);
      this.canvas.removeEventListener('mousedown', this.boundPointerDown);
      this.canvas.removeEventListener('touchstart', this.boundPointerDown);
      this.canvas.remove();
    }
  }
}

import * as THREE from 'three';
import { sound } from '../sound.js';

export class NeonTunnel3DGame {
  constructor(containerElement, onGameOverCallback, onScoreUpdateCallback) {
    this.container = containerElement;
    this.onGameOver = onGameOverCallback;
    this.onScoreUpdate = onScoreUpdateCallback;

    this.isRunning = false;
    this.score = 0;
    this.playerAngle = 0;
    this.speed = 0.8;
    this.tunnelRadius = 4.5;
    this.obstacles = [];
    this.keys = {};
    this.isPaused = false;

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    const width = Math.max(300, this.container.clientWidth || 800);
    const height = Math.max(200, this.container.clientHeight || 500);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050410, 0.035);

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 500);
    this.camera.position.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // Tunnel Rings
    this.tunnelRings = [];
    const ringGeo = new THREE.RingGeometry(this.tunnelRadius - 0.05, this.tunnelRadius, 24);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff007f : 0x00f3ff,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.position.z = -i * 3;
      this.scene.add(ring);
      this.tunnelRings.push(ring);
    }

    // Player Craft
    const craftGeo = new THREE.ConeGeometry(0.35, 0.9, 3);
    const craftMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    this.playerMesh = new THREE.Mesh(craftGeo, craftMat);
    this.playerMesh.rotation.x = Math.PI / 2;
    this.scene.add(this.playerMesh);

    // Controls
    this.boundKeyDown = (e) => {
      this.keys[e.key] = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        sound.playUiBeep(520, 'triangle');
      }
    };
    this.boundKeyUp = (e) => {
      this.keys[e.key] = false;
    };
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    this.boundResize = () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', this.boundResize);

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.boundResize());
      this.resizeObserver.observe(this.container);
    }

    this.isRunning = true;
    this.spawnTimer = 0;
    this.animate();
  }

  spawnBarrier() {
    const angle = Math.random() * Math.PI * 2;
    const arcLength = Math.PI * 0.9; // Barrier covers almost half tunnel
    const geo = new THREE.RingGeometry(0.5, this.tunnelRadius + 0.1, 16, 1, angle, arcLength);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const barrier = new THREE.Mesh(geo, mat);
    barrier.position.z = -120;
    barrier.userData = { angleStart: angle, angleEnd: angle + arcLength };
    this.scene.add(barrier);
    this.obstacles.push(barrier);
  }

  update() {
    if (!this.isRunning) return;

    // Player controls
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.playerAngle += 0.055;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.playerAngle -= 0.055;
    }

    // Position player along tunnel wall
    const px = Math.cos(this.playerAngle) * (this.tunnelRadius - 0.7);
    const py = Math.sin(this.playerAngle) * (this.tunnelRadius - 0.7);
    this.playerMesh.position.set(px, py, -4);
    this.playerMesh.rotation.z = this.playerAngle - Math.PI / 2;

    // Animate tunnel rings
    this.tunnelRings.forEach(ring => {
      ring.position.z += this.speed;
      ring.rotation.z += 0.005;
      if (ring.position.z > 2) {
        ring.position.z = -118;
      }
    });

    // Spawn barriers
    this.spawnTimer++;
    if (this.spawnTimer % 35 === 0) {
      this.spawnBarrier();
    }

    // Update barriers
    const normPlayerAngle = ((this.playerAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const b = this.obstacles[i];
      b.position.z += this.speed;

      // Check collision when barrier crosses player Z
      if (b.position.z >= -4.5 && b.position.z <= -3.5) {
        let aStart = b.userData.angleStart % (Math.PI * 2);
        let aEnd = b.userData.angleEnd % (Math.PI * 2);
        let hit = false;

        if (aStart < aEnd) {
          hit = (normPlayerAngle >= aStart && normPlayerAngle <= aEnd);
        } else {
          hit = (normPlayerAngle >= aStart || normPlayerAngle <= aEnd);
        }

        if (hit) {
          sound.playExplosion();
          this.endGame();
          return;
        }
      }

      if (b.position.z > 5) {
        this.scene.remove(b);
        this.obstacles.splice(i, 1);
        this.score += 25;
      }
    }

    this.score += 1;
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, Math.floor(this.score / 20));
    }
  }

  animate() {
    if (!this.isRunning) return;
    this.animId = requestAnimationFrame(this.animate.bind(this));
    if (this.isPaused) return;
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  endGame() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.onGameOver) {
      this.onGameOver(this.score, Math.floor(this.score / 20));
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}

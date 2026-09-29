import * as THREE from 'three';
import { sound } from '../sound.js';

export class SpaceBlaster3DGame {
  constructor(containerElement, onGameOverCallback, onScoreUpdateCallback) {
    this.container = containerElement;
    this.onGameOver = onGameOverCallback;
    this.onScoreUpdate = onScoreUpdateCallback;

    this.isRunning = false;
    this.score = 0;
    this.shields = 100;
    this.asteroids = [];
    this.lasers = [];
    this.particles = [];

    this.crosshair = { x: 0, y: 0 };
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02040b, 0.015);

    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 800);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 900; i++) {
      starCoords.push(
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 500,
        -Math.random() * 400
      );
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 1.2 });
    this.starfield = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.starfield);

    // Cockpit Crosshair Plane
    const chGeo = new THREE.RingGeometry(0.3, 0.35, 16);
    const chMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, side: THREE.DoubleSide });
    this.crosshairMesh = new THREE.Mesh(chGeo, chMat);
    this.crosshairMesh.position.set(0, 0, 1.5);
    this.scene.add(this.crosshairMesh);

    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(10, 20, 15);
    this.scene.add(sunLight);

    const ambLight = new THREE.AmbientLight(0x334466, 0.8);
    this.scene.add(ambLight);

    // Mouse / Touch Aiming & Shooting
    this.boundMouseMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX !== undefined && clientY !== undefined) {
        this.crosshair.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.crosshair.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      }
    };

    this.boundClick = () => {
      if (this.isRunning) this.fireLaser();
    };

    this.container.addEventListener('mousemove', this.boundMouseMove);
    this.container.addEventListener('touchmove', this.boundMouseMove);
    this.container.addEventListener('click', this.boundClick);
    this.container.addEventListener('touchstart', this.boundClick);

    this.boundResize = () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.boundResize);

    this.spawnTimer = 0;
    this.isRunning = true;
    this.animate();
  }

  fireLaser() {
    sound.playLaser();
    // Dual Laser Cannons
    [-0.8, 0.8].forEach(offsetX => {
      const geo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
      const laser = new THREE.Mesh(geo, mat);
      laser.rotation.x = Math.PI / 2;
      laser.position.set(offsetX, -0.6, 3.5);

      // Trajectory vector toward crosshair
      const targetPos = new THREE.Vector3(this.crosshair.x * 12, this.crosshair.y * 8, -60);
      const dir = targetPos.clone().sub(laser.position).normalize();
      laser.userData = { direction: dir, speed: 2.5 };
      this.scene.add(laser);
      this.lasers.push(laser);
    });
  }

  spawnAsteroid() {
    const radius = 1.2 + Math.random() * 1.5;
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x775599,
      roughness: 0.9,
      metalness: 0.2
    });
    const asteroid = new THREE.Mesh(geo, mat);

    const posX = (Math.random() - 0.5) * 28;
    const posY = (Math.random() - 0.5) * 18;
    asteroid.position.set(posX, posY, -120);
    asteroid.userData = {
      rotX: (Math.random() - 0.5) * 0.04,
      rotY: (Math.random() - 0.5) * 0.04,
      speedZ: 0.6 + Math.random() * 0.4,
      radius: radius
    };
    this.scene.add(asteroid);
    this.asteroids.push(asteroid);
  }

  createExplosion(pos) {
    sound.playExplosion();
    const particleCount = 20;
    const geo = new THREE.BufferGeometry();
    const coords = [];
    const vels = [];

    for (let i = 0; i < particleCount; i++) {
      coords.push(pos.x, pos.y, pos.z);
      vels.push(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff007f, size: 0.5, transparent: true, opacity: 1 });
    const pMesh = new THREE.Points(geo, mat);
    this.scene.add(pMesh);
    this.particles.push({ mesh: pMesh, vels, life: 1 });
  }

  update() {
    if (!this.isRunning) return;

    // Crosshair follows pointer
    this.crosshairMesh.position.x = this.crosshair.x * 2.2;
    this.crosshairMesh.position.y = this.crosshair.y * 1.6;
    this.crosshairMesh.rotation.z += 0.02;

    // Spawn asteroids
    this.spawnTimer++;
    if (this.spawnTimer % 40 === 0) {
      this.spawnAsteroid();
    }

    // Update lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.position.addScaledVector(l.userData.direction, l.userData.speed);

      // Check laser vs asteroid hit
      let hit = false;
      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        const a = this.asteroids[j];
        if (l.position.distanceTo(a.position) < a.userData.radius + 0.6) {
          this.createExplosion(a.position);
          this.scene.remove(a);
          this.asteroids.splice(j, 1);
          hit = true;
          this.score += 100;
          sound.playCoin();
          break;
        }
      }

      if (hit || l.position.z < -100) {
        this.scene.remove(l);
        this.lasers.splice(i, 1);
      }
    }

    // Update asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const a = this.asteroids[i];
      a.position.z += a.userData.speedZ;
      a.rotation.x += a.userData.rotX;
      a.rotation.y += a.userData.rotY;

      // Check collision with ship/cockpit
      if (a.position.z > 3.0) {
        if (Math.abs(a.position.x) < 3.5 && Math.abs(a.position.y) < 2.5) {
          this.createExplosion(a.position);
          this.shields -= 35;
          sound.playExplosion();
          if (this.shields <= 0) {
            this.endGame();
            return;
          }
        }
        this.scene.remove(a);
        this.asteroids.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const pos = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.vels.length / 3; j++) {
        pos[j * 3] += p.vels[j * 3];
        pos[j * 3 + 1] += p.vels[j * 3 + 1];
        pos[j * 3 + 2] += p.vels[j * 3 + 2];
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;
      p.life -= 0.05;
      p.mesh.material.opacity = p.life;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, Math.max(0, this.shields));
    }
  }

  animate() {
    if (!this.isRunning) return;
    this.animId = requestAnimationFrame(this.animate.bind(this));
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  endGame() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.onGameOver) {
      this.onGameOver(this.score, Math.max(0, this.shields));
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.container.removeEventListener('mousemove', this.boundMouseMove);
    this.container.removeEventListener('touchmove', this.boundMouseMove);
    this.container.removeEventListener('click', this.boundClick);
    this.container.removeEventListener('touchstart', this.boundClick);
    window.removeEventListener('resize', this.boundResize);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}

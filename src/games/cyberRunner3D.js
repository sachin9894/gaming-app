import * as THREE from 'three';
import { sound } from '../sound.js';
import confetti from 'canvas-confetti';

export class CyberRunner3DGame {
  constructor(containerElement, onGameOverCallback, onScoreUpdateCallback) {
    this.container = containerElement;
    this.onGameOver = onGameOverCallback;
    this.onScoreUpdate = onScoreUpdateCallback;

    this.isRunning = false;
    this.score = 0;
    this.coins = 0;
    this.speed = 0.55;
    this.maxSpeed = 1.3;

    this.lanes = [-2.8, 0, 2.8];
    this.currentLane = 1; // Center
    this.targetX = 0;

    this.isJumping = false;
    this.jumpVelocity = 0;
    this.gravity = 0.016;

    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050814);
    this.scene.fog = new THREE.FogExp2(0x050814, 0.022);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 3.8, 7.5);
    this.camera.lookAt(0, 1.2, -6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f3ff, 2.0);
    dirLight.position.set(5, 12, 10);
    this.scene.add(dirLight);

    const magentaLight = new THREE.PointLight(0xff007f, 3.5, 40);
    magentaLight.position.set(-8, 5, -10);
    this.scene.add(magentaLight);

    // 3. Futuristic Highway Grid
    const trackWidth = 9;
    const trackLength = 120;
    const trackGeo = new THREE.PlaneGeometry(trackWidth, trackLength, 18, 60);
    const trackMat = new THREE.MeshBasicMaterial({
      color: 0x071126,
      wireframe: false
    });
    this.track = new THREE.Mesh(trackGeo, trackMat);
    this.track.rotation.x = -Math.PI / 2;
    this.track.position.z = -trackLength / 2 + 10;
    this.scene.add(this.track);

    // Cyber Highway Grid Lines
    const gridHelper = new THREE.GridHelper(trackLength, 40, 0x00f3ff, 0x112b4c);
    gridHelper.position.y = 0.02;
    gridHelper.position.z = -trackLength / 2 + 10;
    this.scene.add(gridHelper);
    this.gridHelper = gridHelper;

    // Side Neon Railings
    const railGeo = new THREE.BoxGeometry(0.2, 0.6, trackLength);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-trackWidth / 2, 0.3, -trackLength / 2 + 10);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(trackWidth / 2, 0.3, -trackLength / 2 + 10);
    this.scene.add(leftRail);
    this.scene.add(rightRail);

    // 4. Cyber Hovercraft (Player)
    this.playerGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.ConeGeometry(0.8, 1.8, 4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x004466,
      roughness: 0.2,
      metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.rotation.y = Math.PI / 4;
    body.position.y = 0.5;
    this.playerGroup.add(body);

    // Wings
    const wingGeo = new THREE.BoxGeometry(2.2, 0.1, 0.6);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 0.5, 0.2);
    this.playerGroup.add(wing);

    // Thruster Glow
    const thrusterGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    this.thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    this.thruster.position.set(0, 0.5, 1.0);
    this.playerGroup.add(this.thruster);

    this.playerGroup.position.set(0, 0, 2);
    this.scene.add(this.playerGroup);

    // Controls setup
    this.boundKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);

    this.boundResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundResize);

    this.spawnTimer = 0;
    this.isRunning = true;
    this.animate();
  }

  handleKeyDown(e) {
    if (!this.isRunning) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      this.moveLane(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      this.moveLane(1);
    } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
      this.jump();
    }
  }

  moveLane(dir) {
    const nextLane = this.currentLane + dir;
    if (nextLane >= 0 && nextLane < this.lanes.length) {
      this.currentLane = nextLane;
      this.targetX = this.lanes[this.currentLane];
      sound.playUiBeep(450, 'sine');
    }
  }

  jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.jumpVelocity = 0.32;
      sound.playJump();
    }
  }

  spawnObstacle() {
    const laneIndex = Math.floor(Math.random() * this.lanes.length);
    const posX = this.lanes[laneIndex];

    const type = Math.random() > 0.4 ? 'cube' : 'barrier';
    let mesh;

    if (type === 'cube') {
      const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff0055,
        emissive: 0x880022,
        roughness: 0.3
      });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(posX, 0.8, -70);
    } else {
      const geo = new THREE.CylinderGeometry(0.2, 0.2, 4.5, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(posX, 1.4, -70);
    }

    this.scene.add(mesh);
    this.obstacles.push(mesh);
  }

  spawnCoin() {
    const laneIndex = Math.floor(Math.random() * this.lanes.length);
    const posX = this.lanes[laneIndex];

    const geo = new THREE.TorusGeometry(0.45, 0.15, 8, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    const coin = new THREE.Mesh(geo, mat);
    coin.position.set(posX, 1.0, -70);
    this.scene.add(coin);
    this.collectibles.push(coin);
  }

  createExplosion(pos) {
    sound.playExplosion();
    const particleCount = 25;
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions.push(pos.x, pos.y, pos.z);
      velocities.push(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.2) * 0.4 + 0.1,
        (Math.random() - 0.5) * 0.4
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.3,
      transparent: true,
      opacity: 1
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);
    this.particles.push({ system: pSystem, velocities, life: 1.0 });
  }

  update() {
    if (!this.isRunning) return;

    // Smooth horizontal lane transition
    this.playerGroup.position.x += (this.targetX - this.playerGroup.position.x) * 0.2;
    // Bank roll tilt
    this.playerGroup.rotation.z = -(this.playerGroup.position.x - this.targetX) * 0.35;

    // Jump Physics
    if (this.isJumping) {
      this.playerGroup.position.y += this.jumpVelocity;
      this.jumpVelocity -= this.gravity;
      if (this.playerGroup.position.y <= 0) {
        this.playerGroup.position.y = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
      }
    }

    // Thruster pulse
    const scale = 1 + Math.sin(Date.now() * 0.02) * 0.25;
    this.thruster.scale.set(scale, scale, scale);

    // Scroll Grid
    if (this.gridHelper) {
      this.gridHelper.position.z += this.speed;
      if (this.gridHelper.position.z > 10) {
        this.gridHelper.position.z = -50;
      }
    }

    // Spawn Obstacles & Coins
    this.spawnTimer += 1;
    if (this.spawnTimer % 45 === 0) {
      if (Math.random() > 0.4) {
        this.spawnObstacle();
      } else {
        this.spawnCoin();
      }
    }

    // Accelerate speed gradually
    if (this.speed < this.maxSpeed) {
      this.speed += 0.00008;
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.position.z += this.speed;

      // Check collision
      const dx = Math.abs(obs.position.x - this.playerGroup.position.x);
      const dy = Math.abs(obs.position.y - this.playerGroup.position.y);
      const dz = Math.abs(obs.position.z - this.playerGroup.position.z);

      if (dx < 1.1 && dy < 1.2 && dz < 1.1) {
        // Collision happened
        this.createExplosion(this.playerGroup.position);
        this.endGame();
        return;
      }

      // Cleanup passed obstacles
      if (obs.position.z > 10) {
        this.scene.remove(obs);
        this.obstacles.splice(i, 1);
        this.score += 15;
      }
    }

    // Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const coin = this.collectibles[i];
      coin.position.z += this.speed;
      coin.rotation.y += 0.08;
      coin.rotation.x += 0.04;

      const dx = Math.abs(coin.position.x - this.playerGroup.position.x);
      const dy = Math.abs(coin.position.y - this.playerGroup.position.y);
      const dz = Math.abs(coin.position.z - this.playerGroup.position.z);

      if (dx < 1.2 && dy < 1.5 && dz < 1.2) {
        sound.playCoin();
        this.coins += 1;
        this.score += 50;
        this.scene.remove(coin);
        this.collectibles.splice(i, 1);
        continue;
      }

      if (coin.position.z > 10) {
        this.scene.remove(coin);
        this.collectibles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const pos = p.system.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length / 3; j++) {
        pos[j * 3] += p.velocities[j * 3];
        pos[j * 3 + 1] += p.velocities[j * 3 + 1];
        pos[j * 3 + 2] += p.velocities[j * 3 + 2];
      }
      p.system.geometry.attributes.position.needsUpdate = true;
      p.life -= 0.04;
      p.system.material.opacity = p.life;
      if (p.life <= 0) {
        this.scene.remove(p.system);
        this.particles.splice(i, 1);
      }
    }

    this.score += 1;
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, this.coins);
    }
  }

  animate() {
    if (!this.isRunning) return;
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  endGame() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.onGameOver) {
      this.onGameOver(this.score, this.coins);
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}

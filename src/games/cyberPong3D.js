import * as THREE from 'three';
import { sound } from '../sound.js';

export class CyberPong3DGame {
  constructor(containerElement, onGameOverCallback, onScoreUpdateCallback) {
    this.container = containerElement;
    this.onGameOver = onGameOverCallback;
    this.onScoreUpdate = onScoreUpdateCallback;

    this.playerScore = 0;
    this.aiScore = 0;
    this.isRunning = false;
    this.isPaused = false;

    this.tableWidth = 10;
    this.tableLength = 16;
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    const width = Math.max(300, this.container.clientWidth || 800);
    const height = Math.max(200, this.container.clientHeight || 500);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060914, 0.03);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
    this.camera.position.set(0, 11, 13);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // Grid Floor / Hologram Table
    const tableGeo = new THREE.PlaneGeometry(this.tableWidth, this.tableLength);
    const tableMat = new THREE.MeshBasicMaterial({ color: 0x091428, side: THREE.DoubleSide });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.rotation.x = -Math.PI / 2;
    this.scene.add(table);

    const grid = new THREE.GridHelper(this.tableLength, 16, 0x00f3ff, 0x163459);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Glowing Side Rails
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, this.tableLength), railMat);
    leftRail.position.set(-this.tableWidth / 2, 0.25, 0);
    this.scene.add(leftRail);

    const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, this.tableLength), railMat);
    rightRail.position.set(this.tableWidth / 2, 0.25, 0);
    this.scene.add(rightRail);

    // Center dividing line
    const centerLine = new THREE.Mesh(new THREE.BoxGeometry(this.tableWidth, 0.05, 0.2), new THREE.MeshBasicMaterial({ color: 0xff007f }));
    centerLine.position.y = 0.03;
    this.scene.add(centerLine);

    // Player Paddle (Cyan)
    const paddleGeo = new THREE.BoxGeometry(2.4, 0.4, 0.6);
    this.playerPaddle = new THREE.Mesh(paddleGeo, new THREE.MeshBasicMaterial({ color: 0x00f3ff }));
    this.playerPaddle.position.set(0, 0.25, 6.8);
    this.scene.add(this.playerPaddle);

    // AI Paddle (Magenta)
    this.aiPaddle = new THREE.Mesh(paddleGeo, new THREE.MeshBasicMaterial({ color: 0xff007f }));
    this.aiPaddle.position.set(0, 0.25, -6.8);
    this.scene.add(this.aiPaddle);

    // Photon Puck (Glowing Yellow Sphere)
    const puckGeo = new THREE.SphereGeometry(0.4, 16, 16);
    this.puck = new THREE.Mesh(puckGeo, new THREE.MeshBasicMaterial({ color: 0xffe600 }));
    this.puck.position.set(0, 0.35, 0);
    this.scene.add(this.puck);

    this.puckVel = { x: 0.12, z: 0.18 };

    // Mouse / Touch Drag Controls
    this.boundMouseMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX !== undefined) {
        const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.playerPaddle.position.x = Math.max(-3.5, Math.min(3.5, normX * 4.5));
      }
    };

    this.container.addEventListener('mousemove', this.boundMouseMove);
    this.container.addEventListener('touchmove', this.boundMouseMove);

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
    this.animate();
  }

  resetPuck() {
    this.puck.position.set(0, 0.35, 0);
    this.puckVel = {
      x: (Math.random() - 0.5) * 0.18,
      z: Math.random() > 0.5 ? 0.2 : -0.2
    };
  }

  update() {
    if (!this.isRunning) return;

    // Move Puck
    this.puck.position.x += this.puckVel.x;
    this.puck.position.z += this.puckVel.z;

    // Side Wall Bounces
    const halfW = this.tableWidth / 2 - 0.5;
    if (this.puck.position.x <= -halfW || this.puck.position.x >= halfW) {
      this.puckVel.x = -this.puckVel.x;
      sound.playUiBeep(400, 'square');
    }

    // AI Tracking
    const aiTargetX = this.puck.position.x;
    this.aiPaddle.position.x += (aiTargetX - this.aiPaddle.position.x) * 0.085;
    this.aiPaddle.position.x = Math.max(-3.5, Math.min(3.5, this.aiPaddle.position.x));

    // Collision with Player Paddle
    if (this.puck.position.z >= 6.4 && this.puck.position.z <= 7.0) {
      if (Math.abs(this.puck.position.x - this.playerPaddle.position.x) < 1.4) {
        this.puckVel.z = -Math.abs(this.puckVel.z) * 1.05;
        this.puckVel.x += (this.puck.position.x - this.playerPaddle.position.x) * 0.1;
        sound.playUiBeep(700, 'triangle');
      }
    }

    // Collision with AI Paddle
    if (this.puck.position.z <= -6.4 && this.puck.position.z >= -7.0) {
      if (Math.abs(this.puck.position.x - this.aiPaddle.position.x) < 1.4) {
        this.puckVel.z = Math.abs(this.puckVel.z) * 1.05;
        sound.playUiBeep(600, 'triangle');
      }
    }

    // Goal Conditions
    if (this.puck.position.z > 8.0) {
      // AI scores
      this.aiScore++;
      sound.playExplosion();
      this.checkWinner();
      this.resetPuck();
    } else if (this.puck.position.z < -8.0) {
      // Player scores
      this.playerScore++;
      sound.playCoin();
      this.checkWinner();
      this.resetPuck();
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.playerScore, this.aiScore);
    }
  }

  checkWinner() {
    if (this.playerScore >= 5 || this.aiScore >= 5) {
      this.isRunning = false;
      if (this.onGameOver) {
        this.onGameOver(this.playerScore * 200, this.playerScore >= 5 ? 'VICTORY' : 'DEFEAT');
      }
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

  destroy() {
    this.isRunning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.container.removeEventListener('mousemove', this.boundMouseMove);
    this.container.removeEventListener('touchmove', this.boundMouseMove);
    window.removeEventListener('resize', this.boundResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.remove();
    }
  }
}

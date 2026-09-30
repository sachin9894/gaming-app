import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { sound } from './sound.js';
import { INITIAL_GAMES, INITIAL_LEADERBOARD, INITIAL_CHAT } from './gamesData.js';
import { AdminControlPanel } from './admin.js';
import { CyberRunner3DGame } from './games/cyberRunner3D.js';
import { NeonTunnel3DGame } from './games/neonTunnel3D.js';
import { SpaceBlaster3DGame } from './games/spaceBlaster3D.js';
import { CyberPong3DGame } from './games/cyberPong3D.js';
import { QuantumArcadeGame } from './games/quantumArcade.js';

// State Management
const appState = {
  games: JSON.parse(localStorage.getItem('nexus3d_games')) || INITIAL_GAMES,
  userCoins: parseInt(localStorage.getItem('nexus3d_coins')) || 2500,
  leaderboard: JSON.parse(localStorage.getItem('nexus3d_leaderboard')) || INITIAL_LEADERBOARD,
  chat: INITIAL_CHAT,
  announcement: localStorage.getItem('nexus3d_announcement') || 'Season 1 Cyber Championship is LIVE! Win 50,000 Cyber Coins!',
  serverOnline: localStorage.getItem('nexus3d_serverOnline') !== null ? JSON.parse(localStorage.getItem('nexus3d_serverOnline')) : true,
  activeFilter: 'all',
  searchQuery: '',
  currentGameInstance: null,
  activeGameData: null,
  totalSessions: parseInt(localStorage.getItem('nexus3d_sessions')) || 42890,
  highScores: JSON.parse(localStorage.getItem('nexus3d_highscores')) || {},
  isGamePaused: false,
  recentGames: JSON.parse(localStorage.getItem('nexus3d_recent_games')) || ['cyber-runner-3d', 'space-blaster-3d', 'neon-tunnel-3d']
};

// PWA deferred prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// -------------------------------------------------------------
// 1. FULL-SCREEN LOBBY AMBIENT 3D / 2D CANVAS
// -------------------------------------------------------------
function initLobbyAmbient() {
  const canvas = document.getElementById('lobby-ambient-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const count = Math.min(50, Math.floor(width / 28));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.8 + 0.8,
      color: i % 3 === 0 ? '#00f0ff' : (i % 3 === 1 ? '#a855f7' : '#38bdf8'),
      alpha: Math.random() * 0.45 + 0.2
    });
  }

  function draw() {
    // Only animate when lobby is active to conserve 100% device power for active 3D games
    if (document.body.classList.contains('state-lobby-active')) {
      ctx.clearRect(0, 0, width, height);

      // Faint ambient cyber grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 70;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw floating nodes & laser connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 95) {
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 95) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// -------------------------------------------------------------
// 2. 3D HERO SPOTLIGHT INTERACTION
// -------------------------------------------------------------
function initHero3D() {
  const canvas = document.getElementById('hero-bg-canvas');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / 560, 0.1, 1000);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Floating Quantum Energy Orbs
  const orbs = [];
  const orbGeo = new THREE.SphereGeometry(0.3, 12, 12);
  for (let i = 0; i < 35; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00f0ff : 0xa855f7,
      wireframe: true
    });
    const orb = new THREE.Mesh(orbGeo, mat);
    orb.position.set(
      (Math.random() - 0.5) * 36,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 15
    );
    orb.userData = {
      vy: (Math.random() - 0.5) * 0.02,
      vx: (Math.random() - 0.5) * 0.02,
      rot: (Math.random() - 0.5) * 0.03
    };
    scene.add(orb);
    orbs.push(orb);
  }

  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  function animateHero() {
    requestAnimationFrame(animateHero);

    if (document.body.classList.contains('state-lobby-active')) {
      orbs.forEach((o) => {
        o.position.y += o.userData.vy;
        o.position.x += o.userData.vx;
        o.rotation.x += o.userData.rot;
        o.rotation.y += o.userData.rot;

        if (o.position.y > 10 || o.position.y < -10) o.userData.vy *= -1;
        if (o.position.x > 18 || o.position.x < -18) o.userData.vx *= -1;
      });

      camera.position.x += (mouseX * 3 - camera.position.x) * 0.04;
      camera.position.y += (mouseY * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
  }
  animateHero();

  window.addEventListener('resize', () => {
    if (!canvas || !canvas.parentElement) return;
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

// -------------------------------------------------------------
// 3. RENDER FEATURED 3D TITLES
// -------------------------------------------------------------
function renderFeaturedGames() {
  const container = document.getElementById('featured-games-container');
  if (!container) return;

  const featured = appState.games.filter((g) => g.featured);
  const displayGames = featured.length >= 2 ? featured : appState.games.slice(0, 4);

  container.innerHTML = displayGames.map((game) => {
    const isEnabled = game.enabled !== false && appState.serverOnline !== false;
    const coverImg = game.image || '/cover-runner.jpg';

    return `
      <div class="featured-game-card ${isEnabled ? '' : 'disabled-game'}" data-game-id="${game.id}">
        <div class="featured-card-cover-wrap">
          <img src="${coverImg}" class="featured-card-img" alt="${game.title}" loading="lazy">
          <span class="featured-card-badge">${game.badge || 'WEBGL'}</span>
          <span class="featured-card-fps">60 FPS</span>
        </div>
        <div class="featured-card-body">
          <div>
            <h3 class="featured-card-title">${game.title}</h3>
            <p class="featured-card-desc">${game.description}</p>
          </div>
          <div class="featured-card-footer">
            <span class="game-card-rating">⭐ ${game.rating} • ${game.plays}</span>
            <button class="btn-play-card ${isEnabled ? '' : 'btn-disabled'}" ${isEnabled ? '' : 'disabled'} data-play-id="${game.id}">
              ${isEnabled ? '⚡ PLAY NOW' : 'OFFLINE'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.featured-game-card').forEach((card) => {
    card.addEventListener('click', () => {
      const gId = card.dataset.gameId;
      const game = appState.games.find((g) => g.id === gId);
      if (game && game.enabled !== false && appState.serverOnline !== false) {
        startTransitionToGame(game);
      }
    });
  });
}

// -------------------------------------------------------------
// 4. RENDER RECENTLY PLAYED MISSIONS
// -------------------------------------------------------------
function renderRecentlyPlayed() {
  const container = document.getElementById('recent-games-container');
  if (!container) return;

  const recentList = (appState.recentGames || [])
    .map((id) => appState.games.find((g) => g.id === id))
    .filter(Boolean);

  if (recentList.length === 0) {
    container.innerHTML = `
      <div class="recent-empty-card">
        <span>🎮 No recent missions logged yet. Launch any title below to start playing!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = recentList.map((game) => {
    const isEnabled = game.enabled !== false && appState.serverOnline !== false;
    const coverImg = game.image || '/cover-runner.jpg';

    return `
      <div class="recent-game-card" data-recent-id="${game.id}">
        <img src="${coverImg}" class="recent-card-thumb" alt="${game.title}" loading="lazy">
        <div class="recent-card-info">
          <div class="recent-card-title">${game.title}</div>
          <div class="recent-card-meta">⭐ ${game.rating} • ${(game.category || 'Arcade').toUpperCase()}</div>
        </div>
        <button class="btn-play-card" style="padding: 0.25rem 0.65rem; font-size: 0.72rem;" data-play-id="${game.id}">
          Launch
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.recent-game-card').forEach((card) => {
    card.addEventListener('click', () => {
      const gId = card.dataset.recentId;
      const game = appState.games.find((g) => g.id === gId);
      if (game && game.enabled !== false && appState.serverOnline !== false) {
        startTransitionToGame(game);
      }
    });
  });
}

function recordRecentlyPlayed(gameId) {
  if (!gameId) return;
  const filtered = (appState.recentGames || []).filter((id) => id !== gameId);
  filtered.unshift(gameId);
  appState.recentGames = filtered.slice(0, 6);
  localStorage.setItem('nexus3d_recent_games', JSON.stringify(appState.recentGames));
  renderRecentlyPlayed();
}

// -------------------------------------------------------------
// 5. RENDER 20 GAMES VAULT ARCHIVE
// -------------------------------------------------------------
function renderGamesCatalog() {
  const container = document.getElementById('games-grid-container');
  if (!container) return;

  const filtered = appState.games.filter((g) => {
    const matchesCategory = appState.activeFilter === 'all' || g.category === appState.activeFilter;
    const matchesSearch = !appState.searchQuery || 
      g.title.toLowerCase().includes(appState.searchQuery.toLowerCase()) || 
      g.description.toLowerCase().includes(appState.searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: var(--border-glass);">
        <div style="font-size: 2rem; margin-bottom: 0.4rem;">🔍</div>
        <h4 style="color: #fff; margin-bottom: 0.2rem; font-family: var(--font-title);">No Games Found</h4>
        <p style="font-size: 0.78rem;">No matches for "${appState.searchQuery}". Try a different keyword.</p>
      </div>
    `;
    const totalGamesEl = document.getElementById('stat-total-games');
    if (totalGamesEl) totalGamesEl.innerText = `0 Games`;
    return;
  }

  container.innerHTML = filtered.map((game) => {
    const isEnabled = game.enabled !== false && appState.serverOnline !== false;
    const coverImg = game.image || '/cover-runner.jpg';

    return `
      <div class="game-card ${isEnabled ? '' : 'disabled-game'}" data-game-id="${game.id}">
        <div class="game-card-cover-wrap">
          <img src="${coverImg}" class="game-card-img" alt="${game.title}" loading="lazy">
          <span class="game-badge">${isEnabled ? game.badge : 'OFFLINE'}</span>
        </div>

        <div class="game-card-content">
          <div>
            <h3 class="game-card-title">${game.title}</h3>
            <p class="game-card-desc">${game.description}</p>
          </div>

          <div class="game-card-footer">
            <span class="game-card-rating">⭐ ${game.rating}</span>
            <button class="btn-play-card ${isEnabled ? '' : 'btn-disabled'}" ${isEnabled ? '' : 'disabled'} data-play-id="${game.id}">
              ${isEnabled ? 'Play' : 'Offline'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const gId = card.dataset.gameId;
      const game = appState.games.find((g) => g.id === gId);
      if (game && game.enabled !== false && appState.serverOnline !== false) {
        startTransitionToGame(game);
      }
    });
  });

  const totalGamesEl = document.getElementById('stat-total-games');
  if (totalGamesEl) totalGamesEl.innerText = `${filtered.length} of ${appState.games.length} Games`;
}

// -------------------------------------------------------------
// 6. LOBBY → GAME SEAMLESS HYPERSPACE WARP TRANSITION
// -------------------------------------------------------------
let transitionTimeout = null;

function startTransitionToGame(game) {
  if (!game || game.enabled === false || appState.serverOnline === false) return;

  // Warp laser sound effect
  if (sound && sound.playWarp) {
    sound.playWarp();
  } else {
    sound.playUiBeep(700, 'sine');
  }

  const portal = document.getElementById('view-portal-transition');
  const portalTitle = document.getElementById('portal-game-title');
  const portalTip = document.getElementById('portal-game-tip');
  const progressFill = document.getElementById('portal-progress-fill');
  const lobbyView = document.getElementById('view-lobby');
  const arenaView = document.getElementById('view-game-arena');

  if (portalTitle) portalTitle.innerText = game.title.toUpperCase();
  if (portalTip) portalTip.innerText = `Preparing 60 FPS WebGL Stage • ${game.controls || 'Ready Pilot'}`;

  // Reset and restart progress bar animation
  if (progressFill) {
    progressFill.style.animation = 'none';
    void progressFill.offsetWidth;
    progressFill.style.animation = 'portalLoadFill 0.42s ease-out forwards';
  }

  // Show transition overlay
  if (portal) portal.classList.remove('hidden');

  if (transitionTimeout) clearTimeout(transitionTimeout);
  transitionTimeout = setTimeout(() => {
    // 1. Hide Lobby
    if (lobbyView) {
      lobbyView.classList.add('hidden');
      lobbyView.classList.remove('active-view');
    }

    // 2. Hide Transition
    if (portal) portal.classList.add('hidden');

    // 3. Show Dedicated Game Arena
    if (arenaView) {
      arenaView.classList.remove('hidden');
      arenaView.classList.add('active-view');
    }

    // 4. Update body state
    document.body.classList.remove('state-lobby-active');
    document.body.classList.add('state-game-active');

    // 5. Launch Game and log history
    launchGame(game);
    recordRecentlyPlayed(game.id);
  }, 440);
}

function returnToLobby() {
  sound.playUiBeep(450, 'sine');

  // 1. Destroy running game instance cleanly
  if (appState.currentGameInstance && appState.currentGameInstance.destroy) {
    appState.currentGameInstance.destroy();
    appState.currentGameInstance = null;
  }
  appState.isGamePaused = false;

  // 2. Exit fullscreen if active
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }

  // 3. Hide in-game overlays
  const pauseOverlay = document.getElementById('game-pause-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  if (pauseOverlay) pauseOverlay.classList.add('hidden');
  if (gameOverOverlay) gameOverOverlay.classList.add('hidden');

  // 4. Hide Game Arena
  const arenaView = document.getElementById('view-game-arena');
  if (arenaView) {
    arenaView.classList.add('hidden');
    arenaView.classList.remove('active-view');
  }

  // 5. Show Full-Screen Lobby
  const lobbyView = document.getElementById('view-lobby');
  if (lobbyView) {
    lobbyView.classList.remove('hidden');
    lobbyView.classList.add('active-view');
  }

  // 6. Set body state back to lobby
  document.body.classList.remove('state-game-active');
  document.body.classList.add('state-lobby-active');

  // 7. Refresh recent list & scroll to top of lobby
  renderRecentlyPlayed();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// 7. LAUNCH 3D GAME IN ARENA (PRESERVING ALL MECHANICS & SCORES)
// -------------------------------------------------------------
function formatControlsHint(hint) {
  if (!hint) {
    return `<span class="kbd-badge">◀</span> <span class="kbd-badge">▶</span> Steer <span class="kbd-sep">•</span> <span class="kbd-badge">SPACE</span> Action <span class="kbd-sep">•</span> <span class="kbd-badge">P</span> Pause <span class="kbd-sep">•</span> <span class="kbd-badge">ESC</span> Lobby`;
  }
  return hint
    .replace(/(Left\/Right|Arrows|WASD)/gi, '<span class="kbd-badge">$1</span>')
    .replace(/(Space|Click|Tap|Drag|Enter)/gi, '<span class="kbd-badge">$1</span>')
    + ` <span class="kbd-sep">•</span> <span class="kbd-badge">P</span> Pause <span class="kbd-sep">•</span> <span class="kbd-badge">ESC</span> Lobby`;
}

function launchGame(game) {
  appState.activeGameData = game;
  appState.isGamePaused = false;
  appState.totalSessions++;
  localStorage.setItem('nexus3d_sessions', appState.totalSessions.toString());

  const titleEl = document.getElementById('modal-game-title');
  const badgeEl = document.getElementById('modal-game-badge');
  const canvasContainer = document.getElementById('game-canvas-container');
  const controlsHint = document.getElementById('game-controls-hint');
  const hudScore = document.getElementById('hud-score-val');
  const hudBest = document.getElementById('hud-best-val');
  const hudSub = document.getElementById('hud-sub-val');
  const hudSubLabel = document.getElementById('hud-sub-label');
  const pauseOverlay = document.getElementById('game-pause-overlay');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const pauseGameName = document.getElementById('pause-game-name');

  const bestScore = appState.highScores[game.id] || 0;

  if (titleEl) titleEl.innerText = game.title;
  if (badgeEl) badgeEl.innerText = (game.category || 'CYBER').toUpperCase();
  if (pauseGameName) pauseGameName.innerText = game.title;

  if (hudScore) hudScore.innerText = '0';
  if (hudBest) hudBest.innerText = bestScore.toLocaleString();
  if (hudSub) hudSub.innerText = '0 🪙';
  if (hudSubLabel) {
    if (game.playableType === 'threejs-blaster') hudSubLabel.innerText = 'SHIELD';
    else if (game.playableType === 'threejs-pong') hudSubLabel.innerText = 'VERSUS';
    else hudSubLabel.innerText = 'REWARD';
  }

  if (controlsHint) {
    controlsHint.innerHTML = formatControlsHint(game.controls);
  }

  // Ensure overlays are hidden
  if (pauseOverlay) pauseOverlay.classList.add('hidden');
  if (gameOverOverlay) gameOverOverlay.classList.add('hidden');

  // Clean previous instance
  if (appState.currentGameInstance && appState.currentGameInstance.destroy) {
    appState.currentGameInstance.destroy();
    appState.currentGameInstance = null;
  }

  if (canvasContainer) {
    canvasContainer.innerHTML = '';
  }

  // Wait for layout pass so container dimensions are 100% computed
  requestAnimationFrame(() => {
    if (game.playableType === 'threejs-runner') {
      appState.currentGameInstance = new CyberRunner3DGame(
        canvasContainer,
        onGameOverHandler,
        (score, coins) => {
          if (hudScore) hudScore.innerText = score.toLocaleString();
          if (hudSub) hudSub.innerText = `${coins} 🪙`;
          if (score > (appState.highScores[game.id] || 0)) {
            if (hudBest) hudBest.innerText = score.toLocaleString();
          }
        }
      );
    } else if (game.playableType === 'threejs-tunnel') {
      appState.currentGameInstance = new NeonTunnel3DGame(
        canvasContainer,
        onGameOverHandler,
        (score, bonus) => {
          if (hudScore) hudScore.innerText = score.toLocaleString();
          if (hudSub) hudSub.innerText = `${bonus} 🪙`;
          if (score > (appState.highScores[game.id] || 0)) {
            if (hudBest) hudBest.innerText = score.toLocaleString();
          }
        }
      );
    } else if (game.playableType === 'threejs-blaster') {
      appState.currentGameInstance = new SpaceBlaster3DGame(
        canvasContainer,
        onGameOverHandler,
        (score, shields) => {
          if (hudScore) hudScore.innerText = score.toLocaleString();
          if (hudSub) hudSub.innerText = `${shields}%`;
          if (score > (appState.highScores[game.id] || 0)) {
            if (hudBest) hudBest.innerText = score.toLocaleString();
          }
        }
      );
    } else if (game.playableType === 'threejs-pong') {
      appState.currentGameInstance = new CyberPong3DGame(
        canvasContainer,
        onGameOverHandler,
        (playerScore, aiScore) => {
          if (hudScore) hudScore.innerText = `YOU: ${playerScore}`;
          if (hudSub) hudSub.innerText = `AI: ${aiScore}`;
        }
      );
    } else {
      appState.currentGameInstance = new QuantumArcadeGame(
        canvasContainer,
        game,
        onGameOverHandler,
        (score, status) => {
          if (hudScore) hudScore.innerText = score.toLocaleString();
          if (hudSub) hudSub.innerText = typeof status === 'number' ? `${status}%` : status;
          if (score > (appState.highScores[game.id] || 0)) {
            if (hudBest) hudBest.innerText = score.toLocaleString();
          }
        }
      );
    }
  });

  setupMobileTouchControls();
}

function toggleGamePause() {
  if (!appState.currentGameInstance) return;
  if (appState.isGamePaused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function pauseGame() {
  if (!appState.currentGameInstance || appState.isGamePaused) return;
  appState.isGamePaused = true;
  if (appState.currentGameInstance.pause) {
    appState.currentGameInstance.pause();
  }
  sound.playUiBeep(450, 'sine');
  const pauseOverlay = document.getElementById('game-pause-overlay');
  if (pauseOverlay) pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (!appState.currentGameInstance) return;
  appState.isGamePaused = false;
  if (appState.currentGameInstance.resume) {
    appState.currentGameInstance.resume();
  }
  sound.playUiBeep(650, 'sine');
  const pauseOverlay = document.getElementById('game-pause-overlay');
  if (pauseOverlay) pauseOverlay.classList.add('hidden');
}

function setupMobileTouchControls() {
  const leftBtn = document.getElementById('touch-left-btn');
  const actionBtn = document.getElementById('touch-action-btn');
  const rightBtn = document.getElementById('touch-right-btn');

  function bindPress(btn, key) {
    if (!btn) return;
    btn.onpointerdown = (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    };
    btn.onpointerup = (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    };
    btn.onpointerleave = () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    };
  }

  bindPress(leftBtn, 'ArrowLeft');
  bindPress(rightBtn, 'ArrowRight');
  bindPress(actionBtn, ' ');
}

function onGameOverHandler(finalScore, bonus) {
  sound.playExplosion();
  const game = appState.activeGameData;
  const gameId = game ? game.id : 'unknown';
  const earnedCoins = Math.max(50, Math.floor(finalScore / 8));
  addCoins(earnedCoins);
  submitScoreToLeaderboard(finalScore);

  const prevBest = appState.highScores[gameId] || 0;
  const isNewRecord = finalScore > prevBest;
  if (isNewRecord) {
    appState.highScores[gameId] = finalScore;
    localStorage.setItem('nexus3d_highscores', JSON.stringify(appState.highScores));
  }

  // Update Game Over Overlay
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const titleEl = document.getElementById('game-over-title');
  const scoreEl = document.getElementById('game-over-score');
  const coinsEl = document.getElementById('game-over-coins');
  const bestEl = document.getElementById('game-over-best');
  const recordAlert = document.getElementById('new-record-alert');

  if (titleEl && game) titleEl.innerText = game.title.toUpperCase();
  if (scoreEl) scoreEl.innerText = finalScore.toLocaleString();
  if (coinsEl) coinsEl.innerText = `+${earnedCoins} 🪙`;
  if (bestEl) bestEl.innerText = (isNewRecord ? finalScore : prevBest).toLocaleString();

  if (recordAlert) {
    if (isNewRecord && finalScore > 0) {
      recordAlert.classList.remove('hidden');
    } else {
      recordAlert.classList.add('hidden');
    }
  }

  setTimeout(() => {
    confetti({ particleCount: 85, spread: 80, origin: { y: 0.6 } });
    if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
  }, 250);
}

// -------------------------------------------------------------
// 8. SOCIAL HUB: LIVE CYBER CHAT & LEADERBOARDS
// -------------------------------------------------------------
function renderChat() {
  const container = document.getElementById('chat-messages-box');
  if (!container) return;

  container.innerHTML = appState.chat.map((msg) => `
    <div class="chat-bubble">
      <div class="chat-bubble-user" style="color: ${msg.color || 'var(--neon-blue)'}">
        <span>${msg.user}</span>
        <span style="color: var(--text-muted); font-size: 0.68rem;">${msg.time}</span>
      </div>
      <div>${msg.text}</div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function initChatSystem() {
  renderChat();

  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;

      sound.playUiBeep(650, 'triangle');
      appState.chat.push({
        user: 'You (Player_1)',
        text: val,
        time: 'Just now',
        color: '#00ffaa'
      });
      input.value = '';
      renderChat();

      // Automated simulated reactive reply
      setTimeout(() => {
        const botReplies = [
          'GG! Nice score on the cyber track! 🔥',
          'Who wants to challenge in Mecha Brawl?',
          'Make sure to install the APK for 60fps haptics!',
          'Claim your daily quest coins!'
        ];
        const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];
        appState.chat.push({
          user: 'Cyborg_Echo',
          text: randomReply,
          time: 'Just now',
          color: '#00f0ff'
        });
        sound.playUiBeep(500, 'sine');
        renderChat();
      }, 1600);
    });
  }

  // Periodic simulated live chatter every 22 seconds
  setInterval(() => {
    const liveNames = ['Matrix_Hero', 'NeonGhost', 'PixelPhantom', 'ZeroPulse', 'ViperQueen'];
    const liveTexts = [
      'Just broke 45,000 points in Cyber Runner! 🏆',
      'The space blaster laser sound is super crisp!',
      'Server ping is under 15ms today, super smooth.',
      'Just unlocked the holographic neon badge!'
    ];
    const randName = liveNames[Math.floor(Math.random() * liveNames.length)];
    const randText = liveTexts[Math.floor(Math.random() * liveTexts.length)];

    appState.chat.push({
      user: randName,
      text: randText,
      time: 'Just now',
      color: '#a855f7'
    });
    if (appState.chat.length > 25) appState.chat.shift();
    renderChat();
  }, 22000);
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list-box');
  if (!container) return;

  container.innerHTML = appState.leaderboard.map((item) => `
    <div class="lb-item">
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span class="lb-item-rank">#${item.rank}</span>
        <span>${item.avatar}</span>
        <div>
          <strong style="color: #fff;">${item.name}</strong>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${item.badge}</div>
        </div>
      </div>
      <div style="font-family: var(--font-title); font-weight: 700; color: var(--neon-blue);">
        ${item.score.toLocaleString()} PTS
      </div>
    </div>
  `).join('');
}

function submitScoreToLeaderboard(score) {
  if (score < 500) return;
  const existingIndex = appState.leaderboard.findIndex((i) => i.name === 'You (Player_1)');
  if (existingIndex !== -1) {
    if (score > appState.leaderboard[existingIndex].score) {
      appState.leaderboard[existingIndex].score = score;
    }
  } else {
    appState.leaderboard.push({
      rank: appState.leaderboard.length + 1,
      name: 'You (Player_1)',
      score: score,
      badge: '⚡ Cyber Prodigy',
      avatar: '👑'
    });
  }

  appState.leaderboard.sort((a, b) => b.score - a.score);
  appState.leaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  localStorage.setItem('nexus3d_leaderboard', JSON.stringify(appState.leaderboard));
  renderLeaderboard();
}

// -------------------------------------------------------------
// 9. COINS & REWARDS SYSTEM
// -------------------------------------------------------------
function addCoins(amount) {
  appState.userCoins += amount;
  localStorage.setItem('nexus3d_coins', appState.userCoins.toString());
  updateCoinsDisplay();
}

function updateCoinsDisplay() {
  const coinEl = document.getElementById('player-coins-val');
  if (coinEl) {
    coinEl.innerText = appState.userCoins.toLocaleString();
  }
}

// -------------------------------------------------------------
// 10. APK EXPORT & DOWNLOAD HANDLER
// -------------------------------------------------------------
function initApkModal() {
  const modal = document.getElementById('apk-modal');
  const openBtn = document.getElementById('open-apk-modal-btn');
  const closeBtn = document.getElementById('apk-close-btn');
  const pwaInstallBtn = document.getElementById('pwa-install-trigger-btn');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      sound.playUiBeep(600, 'sine');
      modal.classList.remove('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sound.playUiBeep(400, 'sine');
      modal.classList.add('hidden');
    });
  }

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      sound.playUiBeep(700, 'sine');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          confetti({ particleCount: 100 });
          alert('Nexus App successfully installed to your device!');
        }
        deferredPrompt = null;
      } else {
        alert('To install on Android:\n\n1. In Chrome, tap the 3 dots (⋮) in the top-right corner.\n2. Tap "Install app" or "Add to Home screen".\n\nAndroid will automatically compile and install the full native app on your phone with zero errors!');
      }
    });
  }
}

// -------------------------------------------------------------
// 11. INITIALIZE APPLICATION & EVENT BUS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Sound Toggle
  const audioBtn = document.getElementById('audio-toggle-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      audioBtn.innerText = isMuted ? '🔇' : '🎵';
      audioBtn.style.color = isMuted ? 'var(--neon-purple)' : 'var(--neon-blue)';
    });
  }

  // Brand click returns to top of lobby
  const brandHome = document.getElementById('brand-home-btn');
  if (brandHome) {
    brandHome.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Hero Quick Play Button
  const quickPlayBtn = document.getElementById('hero-quick-play-btn');
  if (quickPlayBtn) {
    quickPlayBtn.addEventListener('click', () => {
      const runner = appState.games.find((g) => g.id === 'cyber-runner-3d') || appState.games[0];
      if (runner) startTransitionToGame(runner);
    });
  }

  // Hero Browse Vault Link
  const browseVaultBtn = document.getElementById('hero-browse-vault-btn');
  if (browseVaultBtn) {
    browseVaultBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const vaultSec = document.getElementById('vault-section');
      if (vaultSec) vaultSec.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Daily Quest Reward
  const dailyQuestBtn = document.getElementById('hero-daily-quest-btn');
  const dailyQuestTrigger = document.getElementById('daily-quest-trigger');

  function claimDailyReward() {
    sound.playVictory();
    confetti({ particleCount: 100, spread: 70 });
    addCoins(500);
    alert('🎉 Daily Cyber Reward Claimed!\n+500 Cyber Coins added to your balance.');
    if (dailyQuestBtn) {
      dailyQuestBtn.innerText = '✅ Claimed';
      dailyQuestBtn.disabled = true;
    }
    if (dailyQuestTrigger) {
      dailyQuestTrigger.innerText = '✅ Claimed (+500)';
    }
  }

  if (dailyQuestBtn) dailyQuestBtn.addEventListener('click', claimDailyReward);
  if (dailyQuestTrigger) dailyQuestTrigger.addEventListener('click', claimDailyReward);

  // Sync Category Filter Pills (both Header nav and Vault bar)
  const allNavPills = document.querySelectorAll('.header-center-nav .nav-pill, .vault-categories-row .cat-pill');
  allNavPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const filter = pill.dataset.filter;
      appState.activeFilter = filter;
      sound.playUiBeep(500, 'sine');

      allNavPills.forEach((p) => {
        if (p.dataset.filter === filter) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      renderGamesCatalog();
    });
  });

  // Real-time Game Search Input
  const searchInput = document.getElementById('game-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value.trim();
      renderGamesCatalog();
    });
  }

  // Clear Recent History
  const clearRecentBtn = document.getElementById('clear-recent-btn');
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', () => {
      sound.playUiBeep(400, 'sine');
      appState.recentGames = [];
      localStorage.removeItem('nexus3d_recent_games');
      renderRecentlyPlayed();
    });
  }

  // Slide-out Chat Drawer
  const toggleChatBtn = document.getElementById('toggle-chat-btn');
  const chatDrawer = document.getElementById('chat-drawer');
  const chatBackdrop = document.getElementById('chat-drawer-backdrop');
  const closeChatDrawer = document.getElementById('close-chat-drawer');

  function openChatDrawer() {
    sound.playUiBeep(550, 'sine');
    if (chatDrawer) chatDrawer.classList.add('open');
    if (chatBackdrop) chatBackdrop.classList.add('open');
  }
  function hideChatDrawer() {
    sound.playUiBeep(400, 'sine');
    if (chatDrawer) chatDrawer.classList.remove('open');
    if (chatBackdrop) chatBackdrop.classList.remove('open');
  }

  if (toggleChatBtn) toggleChatBtn.addEventListener('click', openChatDrawer);
  if (closeChatDrawer) closeChatDrawer.addEventListener('click', hideChatDrawer);
  if (chatBackdrop) chatBackdrop.addEventListener('click', hideChatDrawer);

  // Slide-out Leaderboard Drawer
  const toggleLbBtn = document.getElementById('toggle-lb-btn');
  const lbDrawer = document.getElementById('lb-drawer');
  const lbBackdrop = document.getElementById('lb-drawer-backdrop');
  const closeLbDrawer = document.getElementById('close-lb-drawer');

  function openLbDrawer() {
    sound.playUiBeep(550, 'sine');
    if (lbDrawer) lbDrawer.classList.add('open');
    if (lbBackdrop) lbBackdrop.classList.add('open');
  }
  function hideLbDrawer() {
    sound.playUiBeep(400, 'sine');
    if (lbDrawer) lbDrawer.classList.remove('open');
    if (lbBackdrop) lbBackdrop.classList.remove('open');
  }

  if (toggleLbBtn) toggleLbBtn.addEventListener('click', openLbDrawer);
  if (closeLbDrawer) closeLbDrawer.addEventListener('click', hideLbDrawer);
  if (lbBackdrop) lbBackdrop.addEventListener('click', hideLbDrawer);

  // Dedicated Game Arena Controls & Navigation
  const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
  const gameRestartBtn = document.getElementById('game-restart-btn');
  const hudPauseBtn = document.getElementById('hud-pause-btn');
  const pauseResumeBtn = document.getElementById('pause-resume-btn');
  const pauseRestartBtn = document.getElementById('pause-restart-btn');
  const pauseExitBtn = document.getElementById('pause-exit-btn');
  const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
  const gameoverExitBtn = document.getElementById('gameover-exit-btn');
  const gameAudioToolBtn = document.getElementById('game-audio-tool-btn');
  const gameFullscreenToolBtn = document.getElementById('game-fullscreen-tool-btn');

  // Back to Lobby button
  if (backToLobbyBtn) backToLobbyBtn.addEventListener('click', returnToLobby);
  if (pauseExitBtn) pauseExitBtn.addEventListener('click', returnToLobby);
  if (gameoverExitBtn) gameoverExitBtn.addEventListener('click', returnToLobby);

  // Restart buttons
  if (gameRestartBtn) {
    gameRestartBtn.addEventListener('click', () => {
      if (appState.activeGameData) launchGame(appState.activeGameData);
    });
  }
  if (pauseRestartBtn) {
    pauseRestartBtn.addEventListener('click', () => {
      if (appState.activeGameData) launchGame(appState.activeGameData);
    });
  }
  if (gameoverRestartBtn) {
    gameoverRestartBtn.addEventListener('click', () => {
      if (appState.activeGameData) launchGame(appState.activeGameData);
    });
  }

  // Pause / Resume buttons
  if (hudPauseBtn) hudPauseBtn.addEventListener('click', toggleGamePause);
  if (pauseResumeBtn) pauseResumeBtn.addEventListener('click', resumeGame);

  // In-Game Audio Toggle
  if (gameAudioToolBtn) {
    gameAudioToolBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      gameAudioToolBtn.innerText = isMuted ? '🔇 Muted' : '🎵 Sound';
      gameAudioToolBtn.style.color = isMuted ? 'var(--neon-purple)' : 'var(--neon-blue)';
      const mainAudioBtn = document.getElementById('audio-toggle-btn');
      if (mainAudioBtn) {
        mainAudioBtn.innerText = isMuted ? '🔇' : '🎵';
        mainAudioBtn.style.color = isMuted ? 'var(--neon-purple)' : 'var(--neon-blue)';
      }
    });
  }

  // In-Game Fullscreen Toggle
  if (gameFullscreenToolBtn) {
    gameFullscreenToolBtn.addEventListener('click', () => {
      const arena = document.getElementById('view-game-arena');
      if (!document.fullscreenElement) {
        if (arena && arena.requestFullscreen) {
          arena.requestFullscreen().catch(() => {});
        }
        gameFullscreenToolBtn.innerText = '⛶ Minimize';
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        gameFullscreenToolBtn.innerText = '⛶ Maximize';
      }
    });
  }

  // Keyboard Shortcuts (P = Pause, ESC = Return to Lobby, Space = Restart after Game Over)
  window.addEventListener('keydown', (e) => {
    const arenaView = document.getElementById('view-game-arena');
    if (!arenaView || arenaView.classList.contains('hidden')) return;

    const gameOverOverlay = document.getElementById('game-over-overlay');
    const isGameOver = gameOverOverlay && !gameOverOverlay.classList.contains('hidden');

    if (e.key === 'p' || e.key === 'P') {
      if (!isGameOver) {
        toggleGamePause();
      }
    } else if (e.key === 'Escape') {
      returnToLobby();
    } else if (e.key === ' ' && isGameOver) {
      e.preventDefault();
      if (appState.activeGameData) launchGame(appState.activeGameData);
    }
  });

  // Setup Admin Panel
  const adminPanel = new AdminControlPanel(appState, () => {
    renderFeaturedGames();
    renderRecentlyPlayed();
    renderGamesCatalog();
    updateCoinsDisplay();
    const banner = document.getElementById('announcement-banner');
    if (banner && appState.announcement) {
      banner.innerHTML = `<span>📢 <strong>GLOBAL SERVER NOTICE:</strong> ${appState.announcement}</span>`;
    }
  });

  // Dedicated Operator Access Link
  const discreteAdminLink = document.getElementById('discrete-admin-link');
  if (discreteAdminLink) {
    discreteAdminLink.addEventListener('click', (e) => {
      e.preventDefault();
      adminPanel.open();
    });
  }

  // Admin Shortcut: Ctrl + Shift + A
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      adminPanel.open();
    }
  });

  if (window.location.hash === '#admin') {
    adminPanel.open();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') {
      adminPanel.open();
    }
  });

  // Init Lobby Canvas, 3D Hero, and Sections
  initLobbyAmbient();
  initHero3D();
  renderFeaturedGames();
  renderRecentlyPlayed();
  renderGamesCatalog();
  renderLeaderboard();
  initChatSystem();
  updateCoinsDisplay();
  initApkModal();
});

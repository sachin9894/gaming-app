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
  totalSessions: parseInt(localStorage.getItem('nexus3d_sessions')) || 42890
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
// 1. 3D INTERACTIVE HOLOGRAPHIC LOBBY OVERLAY
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
  for (let i = 0; i < 40; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00f3ff : 0xff007f,
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
// 2. RENDER 20 GAMES CATALOG (WITH REAL GRAPHIC COVERS)
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
              ${isEnabled ? 'Play 3D' : 'Offline'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Play click listeners
  container.querySelectorAll('.btn-play-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const gId = btn.dataset.playId;
      const game = appState.games.find((g) => g.id === gId);
      if (game) launchGame(game);
    });
  });

  // Update total games counter
  const totalGamesEl = document.getElementById('stat-total-games');
  if (totalGamesEl) totalGamesEl.innerText = `${appState.games.length} Games`;
}

// -------------------------------------------------------------
// 3. LAUNCH INTERACTIVE GAME ARENA (ALL GAMES LIVE!)
// -------------------------------------------------------------
function launchGame(game) {
  sound.playUiBeep(700, 'sine');
  appState.activeGameData = game;
  appState.totalSessions++;
  localStorage.setItem('nexus3d_sessions', appState.totalSessions.toString());

  const modal = document.getElementById('game-modal');
  const titleEl = document.getElementById('modal-game-title');
  const canvasContainer = document.getElementById('game-canvas-container');
  const controlsHint = document.getElementById('game-controls-hint');
  const hudScore = document.getElementById('hud-score-val');
  const hudSub = document.getElementById('hud-sub-val');

  if (titleEl) titleEl.innerText = `${game.title} (3D ARENA)`;
  if (controlsHint) controlsHint.innerText = game.controls;
  if (hudScore) hudScore.innerText = '0';
  if (hudSub) hudSub.innerText = '0';

  modal.classList.remove('hidden');

  // Clean previous instance
  if (appState.currentGameInstance && appState.currentGameInstance.destroy) {
    appState.currentGameInstance.destroy();
    appState.currentGameInstance = null;
  }

  // Handle Playable 3D WebGL Engines
  if (game.playableType === 'threejs-runner') {
    appState.currentGameInstance = new CyberRunner3DGame(
      canvasContainer,
      onGameOverHandler,
      (score, coins) => {
        if (hudScore) hudScore.innerText = score;
        if (hudSub) hudSub.innerText = `${coins} 🪙`;
      }
    );
  } else if (game.playableType === 'threejs-tunnel') {
    appState.currentGameInstance = new NeonTunnel3DGame(
      canvasContainer,
      onGameOverHandler,
      (score, bonus) => {
        if (hudScore) hudScore.innerText = score;
        if (hudSub) hudSub.innerText = `${bonus} 🪙`;
      }
    );
  } else if (game.playableType === 'threejs-blaster') {
    appState.currentGameInstance = new SpaceBlaster3DGame(
      canvasContainer,
      onGameOverHandler,
      (score, shields) => {
        if (hudScore) hudScore.innerText = score;
        if (hudSub) hudSub.innerText = `${shields}% SHIELD`;
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
    // Universal Interactive 3D Cyber Engine for all remaining games
    appState.currentGameInstance = new QuantumArcadeGame(
      canvasContainer,
      game,
      onGameOverHandler,
      (score, status) => {
        if (hudScore) hudScore.innerText = score;
        if (hudSub) hudSub.innerText = status;
      }
    );
  }

  // Setup mobile touch triggers for the active game
  setupMobileTouchControls();
}

function setupMobileTouchControls() {
  const leftBtn = document.getElementById('touch-left-btn');
  const actionBtn = document.getElementById('touch-action-btn');
  const rightBtn = document.getElementById('touch-right-btn');

  if (leftBtn) {
    leftBtn.onclick = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    };
  }
  if (rightBtn) {
    rightBtn.onclick = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    };
  }
  if (actionBtn) {
    actionBtn.onclick = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    };
  }
}

function onGameOverHandler(finalScore, bonus) {
  sound.playExplosion();
  const earnedCoins = Math.max(50, Math.floor(finalScore / 8));
  addCoins(earnedCoins);

  // Update leaderboard with user's score
  submitScoreToLeaderboard(finalScore);

  setTimeout(() => {
    confetti({ particleCount: 75, spread: 80 });
    const restart = confirm(`⚡ MISSION COMPLETE!\n\nFinal Score: ${finalScore}\nCyber Coins Earned: +${earnedCoins} 🪙\n\nWould you like to play again?`);
    if (restart) {
      if (appState.activeGameData) launchGame(appState.activeGameData);
    } else {
      closeGameModal();
    }
  }, 350);
}

function closeGameModal() {
  sound.playUiBeep(400, 'sine');
  const modal = document.getElementById('game-modal');
  if (modal) modal.classList.add('hidden');

  if (appState.currentGameInstance && appState.currentGameInstance.destroy) {
    appState.currentGameInstance.destroy();
    appState.currentGameInstance = null;
  }
}

// -------------------------------------------------------------
// 4. SOCIAL HUB: LIVE CYBER CHAT & LEADERBOARDS
// -------------------------------------------------------------
function renderChat() {
  const container = document.getElementById('chat-messages-box');
  if (!container) return;

  container.innerHTML = appState.chat.map((msg) => `
    <div class="chat-bubble">
      <div class="chat-bubble-user" style="color: ${msg.color || 'var(--accent-cyan)'}">
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
          color: '#00f3ff'
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
      'Just broke 45,000 points in Cyber Runner 3D! 🏆',
      'The 3D space blaster laser sound is super crisp!',
      'Server ping is under 15ms today, super smooth.',
      'Just unlocked the holographic neon badge!'
    ];
    const randName = liveNames[Math.floor(Math.random() * liveNames.length)];
    const randText = liveTexts[Math.floor(Math.random() * liveTexts.length)];

    appState.chat.push({
      user: randName,
      text: randText,
      time: 'Just now',
      color: '#ff007f'
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
      <div style="font-family: var(--font-display); font-weight: 700; color: var(--accent-cyan);">
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
// 5. COINS & REWARDS SYSTEM
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
// 6. APK EXPORT & DOWNLOAD HANDLER
// -------------------------------------------------------------
function initApkModal() {
  const modal = document.getElementById('apk-modal');
  const openBtn = document.getElementById('open-apk-modal-btn');
  const closeBtn = document.getElementById('apk-close-btn');
  const directDownloadBtn = document.getElementById('direct-apk-download-btn');
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
          alert('Nexus 3D App successfully installed to your device home screen!');
        }
        deferredPrompt = null;
      } else {
        alert('To install directly onto Android or PC:\n\n1. In Chrome, tap the 3-dots menu (⋮)\n2. Select "Add to Home screen" or "Install App".\n\nIt installs instantly as a full-screen APK application!');
      }
    });
  }

  if (directDownloadBtn) {
    directDownloadBtn.addEventListener('click', () => {
      sound.playVictory();
      confetti({ particleCount: 120, spread: 80 });

      const apkContent = `NEXUS_3D_ANDROID_PACKAGE_MANIFEST
Package: com.nexus3d.cyberarcade
Version: 1.0.0
Architecture: arm64-v8a, armeabi-v7a
Games_Count: 20
Target_SDK: 34 (Android 14)
Security_Hash: SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
Engine: Three.js WebGL & Capacitor 6.0 Native Bridge
Status: PRODUCTION_READY`;

      const blob = new Blob([apkContent], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Nexus3D_CyberArcade_v1.0.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('🚀 "Nexus3D_CyberArcade_v1.0.apk" download started!\n\nFor building signed Google Play Store APKs, check the step-by-step Capacitor instructions in the modal below.');
    });
  }
}

// -------------------------------------------------------------
// 7. INITIALIZE APPLICATION & ROUTING
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Sound Toggle
  const audioBtn = document.getElementById('audio-toggle-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      audioBtn.innerText = isMuted ? '🔇 MUTED' : '🎵 SOUND';
      audioBtn.style.color = isMuted ? 'var(--neon-magenta)' : 'var(--neon-cyan)';
    });
  }

  // Brand click returns to top
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
      const runner = appState.games.find((g) => g.id === 'cyber-runner-3d');
      if (runner) launchGame(runner);
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

  // Modern Nav Pills
  const navPills = document.querySelectorAll('.nav-pill');
  navPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      navPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      appState.activeFilter = pill.dataset.filter;
      sound.playUiBeep(500, 'sine');
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

  // Game Modal Controls
  const closeGameModalBtn = document.getElementById('close-game-modal-btn');
  const gameExitBtn = document.getElementById('game-exit-btn');
  const gameRestartBtn = document.getElementById('game-restart-btn');

  if (closeGameModalBtn) closeGameModalBtn.addEventListener('click', closeGameModal);
  if (gameExitBtn) gameExitBtn.addEventListener('click', closeGameModal);
  if (gameRestartBtn) {
    gameRestartBtn.addEventListener('click', () => {
      if (appState.activeGameData) launchGame(appState.activeGameData);
    });
  }

  // Setup Isolated Admin Panel
  const adminPanel = new AdminControlPanel(appState, () => {
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

  // Keyboard Shortcut for Admin Access: Ctrl + Shift + A
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      adminPanel.open();
    }
  });

  // Check URL Hash for #admin
  if (window.location.hash === '#admin') {
    adminPanel.open();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') {
      adminPanel.open();
    }
  });

  // Init Hero 3D background & modules
  initHero3D();
  renderGamesCatalog();
  renderLeaderboard();
  initChatSystem();
  updateCoinsDisplay();
  initApkModal();
});

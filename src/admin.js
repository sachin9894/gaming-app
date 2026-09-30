// NEXUS 3D Admin Control Panel System
import { sound } from './sound.js';

export class AdminControlPanel {
  constructor(appState, onDataUpdatedCallback) {
    this.appState = appState;
    this.onDataUpdated = onDataUpdatedCallback;
    this.isAuthenticated = false;
    this.adminPin = '7777';

    this.initElements();
  }

  initElements() {
    this.modal = document.getElementById('admin-modal');
    this.authView = document.getElementById('admin-auth-view');
    this.dashboardView = document.getElementById('admin-dashboard-view');
    this.pinInput = document.getElementById('admin-pin-input');
    this.loginBtn = document.getElementById('admin-login-btn');
    this.closeBtn = document.getElementById('admin-close-btn');

    this.setupListeners();
  }

  setupListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.loginBtn) {
      this.loginBtn.addEventListener('click', () => this.handleLogin());
    }

    if (this.pinInput) {
      this.pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    // Quick demo login button
    const quickBtn = document.getElementById('admin-quick-fill');
    if (quickBtn) {
      quickBtn.addEventListener('click', () => {
        this.pinInput.value = this.adminPin;
        this.handleLogin();
      });
    }

    // Broadcast Announcement Form
    const broadcastBtn = document.getElementById('broadcast-submit-btn');
    if (broadcastBtn) {
      broadcastBtn.addEventListener('click', () => this.publishBroadcast());
    }

    // Add New Game Form
    const addGameBtn = document.getElementById('add-game-submit-btn');
    if (addGameBtn) {
      addGameBtn.addEventListener('click', () => this.addNewGame());
    }

    // Maintenance Mode Toggle
    const maintToggle = document.getElementById('admin-server-toggle');
    if (maintToggle) {
      maintToggle.addEventListener('change', (e) => {
        this.appState.serverOnline = e.target.checked;
        this.saveAndNotify();
      });
    }
  }

  open() {
    sound.playUiBeep(650, 'sine');
    if (this.modal) {
      this.modal.classList.remove('hidden');
      if (!this.isAuthenticated) {
        this.authView.classList.remove('hidden');
        this.dashboardView.classList.add('hidden');
        if (this.pinInput) this.pinInput.focus();
      } else {
        this.renderDashboard();
      }
    }
  }

  close() {
    sound.playUiBeep(400, 'sine');
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }

  handleLogin() {
    const val = this.pinInput ? this.pinInput.value.trim() : '';
    if (val === this.adminPin) {
      this.isAuthenticated = true;
      sound.playVictory();
      this.authView.classList.add('hidden');
      this.dashboardView.classList.remove('hidden');
      this.renderDashboard();
    } else {
      sound.playExplosion();
      alert('Access Denied: Invalid Security Pin. Try default: 7777');
      if (this.pinInput) {
        this.pinInput.value = '';
        this.pinInput.focus();
      }
    }
  }

  renderDashboard() {
    this.renderStats();
    this.renderGamesManager();
    this.renderUsersManager();
  }

  renderStats() {
    const activeEl = document.getElementById('admin-stat-active');
    const playsEl = document.getElementById('admin-stat-plays');
    const coinsEl = document.getElementById('admin-stat-coins');
    const maintCheckbox = document.getElementById('admin-server-toggle');

    if (activeEl) activeEl.innerText = (1420 + Math.floor(Math.random() * 80)).toLocaleString();
    if (playsEl) playsEl.innerText = (this.appState.totalSessions || 42890).toLocaleString();
    if (coinsEl) coinsEl.innerText = (this.appState.userCoins + 500000).toLocaleString();
    if (maintCheckbox) maintCheckbox.checked = this.appState.serverOnline !== false;
  }

  renderGamesManager() {
    const container = document.getElementById('admin-games-list');
    if (!container) return;

    container.innerHTML = this.appState.games.map((game) => {
      const isEnabled = game.enabled !== false;
      return `
        <div class="admin-game-row ${isEnabled ? '' : 'disabled-row'}">
          <div class="game-meta">
            <span class="game-icon">${game.icon}</span>
            <div>
              <div class="game-title">${game.title}</div>
              <div class="game-subtitle">${game.fps} • ${game.difficulty}</div>
            </div>
          </div>
          <div class="game-actions">
            <label class="switch-label">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} data-game-id="${game.id}" class="game-toggle-checkbox">
              <span class="status-badge ${isEnabled ? 'status-active' : 'status-disabled'}">
                ${isEnabled ? 'LIVE' : 'OFFLINE'}
              </span>
            </label>
            <button class="btn-sm btn-featured" data-featured-id="${game.id}">
              ${game.featured ? '⭐ Featured' : '☆ Feature'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach toggle listeners
    container.querySelectorAll('.game-toggle-checkbox').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const gId = e.target.dataset.gameId;
        const targetGame = this.appState.games.find(g => g.id === gId);
        if (targetGame) {
          targetGame.enabled = e.target.checked;
          sound.playUiBeep(e.target.checked ? 600 : 300);
          this.saveAndNotify();
          this.renderGamesManager();
        }
      });
    });

    // Attach feature toggle listeners
    container.querySelectorAll('.btn-featured').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const gId = e.target.dataset.featuredId;
        const targetGame = this.appState.games.find(g => g.id === gId);
        if (targetGame) {
          targetGame.featured = !targetGame.featured;
          sound.playUiBeep(750);
          this.saveAndNotify();
          this.renderGamesManager();
        }
      });
    });
  }

  renderUsersManager() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    const mockUsers = [
      { id: 'usr_1', name: 'CyberViper_X', coins: 4890, banned: false, role: 'VIP' },
      { id: 'usr_2', name: 'NeonSamurai', coins: 3410, banned: false, role: 'Pro' },
      { id: 'usr_3', name: 'QuantumGamer', coins: 2150, banned: false, role: 'Member' },
      { id: 'usr_4', name: 'SpamBot_99', coins: 10, banned: true, role: 'Banned' }
    ];

    container.innerHTML = mockUsers.map(u => `
      <div class="admin-user-row">
        <div class="user-meta">
          <strong>${u.name}</strong>
          <span class="user-role badge-${u.role.toLowerCase()}">${u.role}</span>
        </div>
        <div class="user-actions">
          <span class="coin-tag">🪙 ${u.coins}</span>
          <button class="btn-sm btn-give-coins" data-user="${u.name}">+500 🪙</button>
          <button class="btn-sm ${u.banned ? 'btn-unban' : 'btn-ban'}" data-user="${u.name}">
            ${u.banned ? 'Unban' : 'Ban'}
          </button>
        </div>
      </div>
    `).join('');

    // Attach user actions
    container.querySelectorAll('.btn-give-coins').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playCoin();
        alert(`Awarded 500 Cyber Coins to ${btn.dataset.user}!`);
      });
    });

    container.querySelectorAll('.btn-ban, .btn-unban').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playUiBeep(350);
        alert(`Updated account status for ${btn.dataset.user}`);
      });
    });
  }

  publishBroadcast() {
    const input = document.getElementById('broadcast-input');
    if (!input || !input.value.trim()) return;

    this.appState.announcement = input.value.trim();
    sound.playVictory();
    alert('Global Broadcast message updated and live!');
    input.value = '';
    this.saveAndNotify();
  }

  addNewGame() {
    const titleInput = document.getElementById('new-game-title');
    const catInput = document.getElementById('new-game-category');
    const iconInput = document.getElementById('new-game-icon');
    const descInput = document.getElementById('new-game-desc');

    if (!titleInput || !titleInput.value.trim()) {
      alert('Please enter a game title');
      return;
    }

    const newGame = {
      id: 'custom-' + Date.now(),
      title: titleInput.value.trim(),
      category: catInput ? catInput.value : 'action',
      badge: 'NEW',
      icon: iconInput && iconInput.value ? iconInput.value : '🎮',
      color: '#00f3ff',
      plays: '0',
      rating: '5.0',
      description: descInput && descInput.value ? descInput.value : 'Newly added futuristic game.',
      controls: 'Keyboard & Touch responsive',
      playableType: 'simulation',
      difficulty: 'Medium',
      featured: true,
      enabled: true,
      fps: '60 FPS'
    };

    this.appState.games.unshift(newGame);
    sound.playVictory();
    alert(`Game "${newGame.title}" successfully added to catalog!`);

    titleInput.value = '';
    if (descInput) descInput.value = '';

    this.saveAndNotify();
    this.renderGamesManager();
  }

  saveAndNotify() {
    localStorage.setItem('nexus3d_games', JSON.stringify(this.appState.games));
    localStorage.setItem('nexus3d_announcement', this.appState.announcement || '');
    localStorage.setItem('nexus3d_serverOnline', JSON.stringify(this.appState.serverOnline));

    if (this.onDataUpdated) {
      this.onDataUpdated();
    }
  }
}

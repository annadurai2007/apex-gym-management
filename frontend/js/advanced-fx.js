/* ==========================================================================
   APEX FITNESS CLUB - ADVANCED FX & INTERACTIVE SUITE
   3D Tilt, Web Audio Sound Engine, Command Palette (Ctrl+K), Animated Counters
   ========================================================================== */

// 1. Web Audio API Sound Engine (100% Pure Synthetic Audio, Zero External Assets)
const SoundFX = {
  ctx: null,
  enabled: localStorage.getItem('apex_sound_enabled') !== 'false',

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },

  playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.05) {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio suppressed or unsupported
    }
  },

  tap() {
    this.playTone(720, 'triangle', 0.05, 0.04);
  },

  hover() {
    this.playTone(420, 'sine', 0.04, 0.015);
  },

  success() {
    if (!this.enabled) return;
    try {
      this.init();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.15, 0.06), idx * 70);
      });
    } catch {}
  },

  open() {
    this.playTone(280, 'sine', 0.12, 0.03);
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('apex_sound_enabled', this.enabled ? 'true' : 'false');
    this.updateTogglePill();
    if (this.enabled) this.success();
    if (window.UI) {
      UI.showToast(this.enabled ? 'Sound FX Enabled' : 'Sound FX Muted', 'info');
    }
  },

  updateTogglePill() {
    document.querySelectorAll('.sound-toggle-btn').forEach(btn => {
      btn.innerHTML = this.enabled 
        ? '<i data-lucide="volume-2" style="width: 14px; height: 14px;"></i> <span class="sound-btn-text">Audio</span>' 
        : '<i data-lucide="volume-x" style="width: 14px; height: 14px;"></i> <span class="sound-btn-text">Muted</span>';
      if (this.enabled) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    if (window.lucide) lucide.createIcons();
  }
};

// 2. 3D Card Physics Tilt
function init3DCardTilt() {
  const cards = document.querySelectorAll('.plan-card, .feature-card, .trans-card, .trainer-card, .stat-card, .tilt-card');

  cards.forEach(card => {
    card.classList.add('tilt-card');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -7;
      const rotateY = ((x - centerX) / centerX) * 7;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
      
      // Update spotlight CSS variables
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });
}

// 3. Smooth Animated Metric Counters
function initMetricCounters() {
  const counterElements = document.querySelectorAll('.dock-value, .stat-value, .metric-number, .trans-metric-val');

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const text = el.innerText.trim();
        const cleanNumber = parseFloat(text.replace(/[^0-9.-]+/g, ''));

        if (!isNaN(cleanNumber) && cleanNumber > 0 && !el.getAttribute('data-counted')) {
          el.setAttribute('data-counted', 'true');
          const isDecimal = text.includes('.');
          const duration = 1200; // ms
          const startTime = performance.now();

          function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentVal = cleanNumber * easeProgress;

            if (text.startsWith('$')) {
              el.textContent = `$${Math.round(currentVal).toLocaleString()}`;
            } else if (text.endsWith('%')) {
              el.innerHTML = `${Math.round(currentVal)}<span>%</span>`;
            } else if (isDecimal) {
              el.textContent = currentVal.toFixed(1);
            } else {
              el.textContent = Math.round(currentVal).toLocaleString();
            }

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              el.innerHTML = text; // restore exact markup and spans
            }
          }

          requestAnimationFrame(updateCounter);
        }
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  counterElements.forEach(el => observer.observe(el));
}

// 4. Button Ripple Effect & Audio Trigger
function initButtonRipples() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .nav-item, .zone-tab-btn, .billing-opt-btn');
    if (btn) {
      SoundFX.tap();

      const rect = btn.getBoundingClientRect();
      const circle = document.createElement('span');
      circle.className = 'ripple-span';
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;

      const existingRipple = btn.querySelector('.ripple-span');
      if (existingRipple) existingRipple.remove();

      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    }
  });

  // Soft hover audio
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('.nav-item, .zone-tab-btn, .plan-card, .billing-opt-btn')) {
      SoundFX.hover();
    }
  });
}

// 5. Global Command Palette (Ctrl + K / Cmd + K)
const CommandPalette = {
  commands: [
    { title: 'Public Sanctuary Landing Page', badge: 'Public', url: '/' },
    { title: 'Interactive Facility Zones', badge: 'Public', url: '/#zones' },
    { title: 'Membership Access Tiers', badge: 'Public', url: '/#memberships' },
    { title: 'Master Coaches Directory', badge: 'Public', url: '/#coaches' },
    { title: 'Biometrics & Caloric Engine', badge: 'Tool', url: '/#calculator' },
    { title: '1-Day VIP Pass Reservation', badge: 'Action', url: '/#vip-pass' },
    { title: 'Sign In / Account Access', badge: 'Auth', url: '/login' },
    { title: 'Admin: Executive Overview', badge: 'Admin', url: '/admin' },
    { title: 'Admin: Member Management', badge: 'Admin', view: 'members' },
    { title: 'Admin: Attendance Desk Scanner', badge: 'Admin', view: 'attendance' },
    { title: 'Admin: Billing & Payments Ledger', badge: 'Admin', view: 'payments' },
    { title: 'Admin: Workout Routine Builder', badge: 'Admin', view: 'workouts' },
    { title: 'Admin: Nutrition Blueprints', badge: 'Admin', view: 'diets' },
    { title: 'Admin: Export CSV Reports', badge: 'Admin', view: 'reports' },
    { title: 'Member Portal: Weekly Workout Routine', badge: 'Member', tab: 'workouts' },
    { title: 'Member Portal: Nutrition Blueprint', badge: 'Member', tab: 'diets' },
    { title: 'Member Portal: Attendance Streak', badge: 'Member', tab: 'attendance' },
    { title: 'Member Portal: Invoices & Receipts', badge: 'Member', tab: 'billing' }
  ],

  init() {
    this.createDom();
    this.bindShortcuts();
  },

  createDom() {
    if (document.getElementById('command-palette-backdrop')) return;

    const div = document.createElement('div');
    div.id = 'command-palette-backdrop';
    div.className = 'command-palette-backdrop';
    div.innerHTML = `
      <div class="command-palette-dialog" onclick="event.stopPropagation()">
        <div class="palette-input-wrap">
          <i data-lucide="search" style="color: var(--accent-primary); width: 20px; height: 20px;"></i>
          <input type="text" id="palette-search-input" class="palette-search-input" placeholder="Type a destination or action..." autocomplete="off">
          <span class="palette-kbd-shortcut">ESC</span>
        </div>
        <div class="palette-results-list" id="palette-results-list"></div>
      </div>
    `;

    document.body.appendChild(div);

    div.addEventListener('click', () => this.close());
    const input = document.getElementById('palette-search-input');
    input.addEventListener('input', (e) => this.renderResults(e.target.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter') {
        const first = document.querySelector('.palette-result-item');
        if (first) first.click();
      }
    });
  },

  bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.open();
      }
      if (e.key === 'Escape') {
        this.close();
      }
    });
  },

  open() {
    SoundFX.open();
    const modal = document.getElementById('command-palette-backdrop');
    if (!modal) return;
    modal.classList.add('active');
    const input = document.getElementById('palette-search-input');
    input.value = '';
    this.renderResults('');
    setTimeout(() => input.focus(), 50);
    if (window.lucide) lucide.createIcons();
  },

  close() {
    const modal = document.getElementById('command-palette-backdrop');
    if (modal) modal.classList.remove('active');
  },

  renderResults(query) {
    const list = document.getElementById('palette-results-list');
    if (!list) return;

    const filtered = this.commands.filter(c => 
      c.title.toLowerCase().includes(query.toLowerCase()) || 
      c.badge.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No commands matched your query.</div>';
      return;
    }

    list.innerHTML = filtered.map((c, idx) => `
      <div class="palette-result-item ${idx === 0 ? 'selected' : ''}" onclick="CommandPalette.execute(${idx})">
        <div class="item-meta">
          <i data-lucide="compass" style="width: 16px; height: 16px;"></i>
          <span>${c.title}</span>
        </div>
        <span class="palette-badge">${c.badge}</span>
      </div>
    `).join('');

    this.activeList = filtered;
    if (window.lucide) lucide.createIcons();
  },

  execute(index) {
    const cmd = this.activeList && this.activeList[index];
    if (!cmd) return;
    this.close();

    if (cmd.view && typeof window.switchView === 'function') {
      window.switchView(cmd.view);
    } else if (cmd.tab && typeof window.switchMemberTab === 'function') {
      window.switchMemberTab(cmd.tab);
    } else if (cmd.url) {
      window.location.href = cmd.url;
    }
  }
};

// Initialize All Advanced FX on Load
document.addEventListener('DOMContentLoaded', () => {
  SoundFX.init();
  SoundFX.updateTogglePill();
  init3DCardTilt();
  initMetricCounters();
  initButtonRipples();
  CommandPalette.init();
});

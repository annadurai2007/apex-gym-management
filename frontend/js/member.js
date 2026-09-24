/* ==========================================================================
   APEX FITNESS CLUB - MEMBER PORTAL CONTROLLER
   Personalized Dashboard, Countdown, Workouts, Diets, Invoices, Profile
   ========================================================================== */

let MemberState = {
  profile: null,
  activeTab: 'overview'
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth(['member'])) return;

  setupMemberNavigation();
  setupNotifications();
  await loadMemberProfile();
  UI.refreshIcons();
});

function setupMemberNavigation() {
  const navItems = document.querySelectorAll('.member-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchMemberTab(tab);
    });
  });

  const mobileToggle = document.getElementById('member-mobile-sidebar-toggle');
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      backdrop?.classList.toggle('active');
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('active');
    });
  }

  document.getElementById('member-logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const confirmed = await UI.confirm('Log Out', 'Are you sure you want to end your session?', 'Log Out', true);
    if (confirmed) Auth.logout();
  });
}

function switchMemberTab(tabName) {
  MemberState.activeTab = tabName;

  // Auto-close mobile drawer on tab switch
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && window.innerWidth <= 1024) {
    sidebar.classList.remove('mobile-open');
    backdrop?.classList.remove('active');
  }

  document.querySelectorAll('.member-nav-item').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.member-tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabName}` ? 'block' : 'none';
  });

  if (tabName === 'workouts') loadMemberWorkouts();
  if (tabName === 'diets') loadMemberDiets();
  if (tabName === 'billing') loadMemberPayments();
  if (tabName === 'attendance') loadMemberAttendance();
  if (tabName === 'profile') populateMemberProfileForm();

  UI.refreshIcons();
}

async function loadMemberProfile() {
  const res = await apiFetch('/auth/me');
  if (res.success && res.data) {
    const user = res.data;
    MemberState.profile = user.profile;

    if (!user.profile) {
      UI.showToast('Member profile details missing. Please contact staff.', 'warning');
      return;
    }

    const p = user.profile;

    // Greeting
    const greetingName = document.getElementById('member-greeting-name');
    if (greetingName) greetingName.textContent = p.full_name;

    const topbarName = document.getElementById('member-topbar-name');
    if (topbarName) topbarName.textContent = p.full_name;

    if (p.photo_url) {
      document.querySelectorAll('.user-pill-avatar').forEach(img => img.src = p.photo_url);
    }

    // Member Code & Plan
    document.getElementById('member-badge-code').textContent = p.member_code;
    document.getElementById('member-plan-name').textContent = p.plan_name || 'No Active Plan';
    
    // Status Badge
    const statusBadge = document.getElementById('member-status-badge');
    statusBadge.textContent = p.status;
    statusBadge.className = `badge badge-${p.status === 'active' ? 'success' : 'danger'}`;

    // Expiry Countdown
    setupCountdown(p.plan_expiry);

    // Trainer Card
    const trainerBox = document.getElementById('member-trainer-info');
    if (trainerBox) {
      if (p.trainer_name) {
        trainerBox.innerHTML = `
          <div style="display: flex; gap: 16px; align-items: center;">
            <img src="${p.trainer_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" style="width: 54px; height: 54px; border-radius: var(--radius-full); object-fit: cover;" alt="${p.trainer_name}">
            <div>
              <h4 style="font-size: 1.1rem; color: #FFF; margin-bottom: 2px;">${p.trainer_name}</h4>
              <div style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600;">${p.trainer_specialization || 'Personal Coach'}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Phone: ${p.trainer_phone || '—'}</div>
            </div>
          </div>
        `;
      } else {
        trainerBox.innerHTML = '<p class="text-muted" style="font-size: 0.9rem;">No dedicated trainer assigned. Visit the front desk to book a coach.</p>';
      }
    }

    // Load initial stats
    loadMemberAttendance();
  }
}

function setupCountdown(expiryDateStr) {
  const daysEl = document.getElementById('countdown-days-val');
  const labelEl = document.getElementById('countdown-status-text');
  if (!daysEl || !labelEl) return;

  if (!expiryDateStr) {
    daysEl.textContent = '0';
    labelEl.textContent = 'No active plan';
    return;
  }

  const expiry = new Date(expiryDateStr);
  const today = new Date();
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    daysEl.textContent = diffDays;
    labelEl.textContent = `Days remaining (Expires ${UI.formatDate(expiryDateStr)})`;
  } else {
    daysEl.textContent = '0';
    labelEl.textContent = `Expired on ${UI.formatDate(expiryDateStr)}`;
    daysEl.style.color = 'var(--status-error)';
  }
}

/* --------------------------------------------------------------------------
   WORKOUT PLANS TAB
--------------------------------------------------------------------------- */
async function loadMemberWorkouts() {
  if (!MemberState.profile) return;
  const container = document.getElementById('member-workout-view');
  if (!container) return;

  const res = await apiFetch(`/workouts/member/${MemberState.profile.id}`);
  if (res.success && res.data) {
    const w = res.data;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grouped = w.grouped_by_day || {};

    container.innerHTML = `
      <div class="card card-glow" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <h3 style="font-size: 1.35rem; color: #FFF; margin-bottom: 4px;">${w.name}</h3>
            <div style="color: var(--accent-primary); font-size: 0.88rem; font-weight: 600;">
              Goal: ${w.goal} &bull; Difficulty: ${w.difficulty} &bull; ${w.duration_weeks} Weeks
            </div>
          </div>
          <span class="badge badge-lime">Assigned Routine</span>
        </div>
        <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 20px;">${w.description || ''}</p>

        <div class="routine-days-tabs" id="routine-days-nav">
          ${days.map((d, i) => `
            <button class="day-tab-btn ${i === 0 ? 'active' : ''}" onclick="selectRoutineDay('${d}', this)">
              ${d}
            </button>
          `).join('')}
        </div>

        <div id="routine-exercises-list"></div>
      </div>
    `;

    // Store grouped exercises globally for tab switching
    window.currentRoutineGrouped = grouped;
    renderRoutineDay('Monday');
    UI.refreshIcons();
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No Workout Plan Assigned</div>
        <div class="empty-state-desc">Your trainer has not assigned an active workout routine yet. Check back soon!</div>
      </div>
    `;
  }
}

function selectRoutineDay(day, btn) {
  document.querySelectorAll('#routine-days-nav .day-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRoutineDay(day);
}

function renderRoutineDay(day) {
  const container = document.getElementById('routine-exercises-list');
  if (!container) return;

  const exercises = (window.currentRoutineGrouped && window.currentRoutineGrouped[day]) || [];
  if (exercises.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); padding: 24px; border-radius: var(--radius-md); text-align: center; color: var(--text-muted);">
        <i data-lucide="coffee" style="width: 32px; height: 32px; color: var(--accent-primary); margin-bottom: 8px;"></i>
        <div style="font-weight: 700; color: #FFF;">Rest & Recovery Day</div>
        <div style="font-size: 0.85rem;">Allow muscle fibers to repair and rehydrate.</div>
      </div>
    `;
    UI.refreshIcons();
    return;
  }

  container.innerHTML = exercises.map(ex => `
    <div class="exercise-item-card">
      <div style="display: flex; align-items: center; gap: 14px;">
        <input type="checkbox" style="width: 18px; height: 18px; accent-color: var(--accent-primary); cursor: pointer;">
        <div>
          <h4 style="font-size: 1.05rem; color: #FFF; margin-bottom: 2px;">${ex.exercise_name}</h4>
          <span class="badge badge-info" style="font-size: 0.72rem;">${ex.muscle_group}</span>
          ${ex.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Note: ${ex.notes}</div>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--accent-primary);">
          ${ex.sets} sets &times; ${ex.reps}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Rest: ${ex.rest_seconds}s</div>
      </div>
    </div>
  `).join('');
  UI.refreshIcons();
}

/* --------------------------------------------------------------------------
   DIET PLANS TAB
--------------------------------------------------------------------------- */
async function loadMemberDiets() {
  if (!MemberState.profile) return;
  const container = document.getElementById('member-diet-view');
  if (!container) return;

  const res = await apiFetch(`/diets/member/${MemberState.profile.id}`);
  if (res.success && res.data) {
    const d = res.data;
    container.innerHTML = `
      <div class="card card-glow" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.35rem; color: #FFF; margin-bottom: 4px;">${d.name}</h3>
            <div style="color: var(--accent-primary); font-size: 0.88rem; font-weight: 600;">Goal: ${d.goal}</div>
          </div>
          <span class="badge badge-lime">Active Nutrition Plan</span>
        </div>
        <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 24px;">${d.description || ''}</p>

        <!-- Macros Grid -->
        <div class="macros-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 32px;">
          <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Calories</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #FFF; font-family: var(--font-heading);">${d.calorie_target}</div>
            <div style="font-size: 0.75rem; color: var(--accent-primary);">Daily Target</div>
          </div>
          <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Protein</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #22C55E; font-family: var(--font-heading);">${d.protein_g}g</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">contractile fuel</div>
          </div>
          <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Carbs</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #38BDF8; font-family: var(--font-heading);">${d.carbs_g}g</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">glycogen energy</div>
          </div>
          <div style="background: var(--bg-card); padding: 16px; border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Fats</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #F59E0B; font-family: var(--font-heading);">${d.fats_g}g</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">hormone support</div>
          </div>
        </div>

        <!-- Meals Timeline -->
        <h4 style="font-size: 1.1rem; color: #FFF; margin-bottom: 16px;">Scheduled Meal Timetable</h4>
        <div class="meal-timeline">
          ${(d.meals || []).map(m => `
            <div class="meal-card">
              <span class="meal-timing-pill">${m.timing}</span>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <h4 style="font-size: 1.1rem; color: #FFF;">${m.meal_name}</h4>
                  <span class="font-mono text-lime" style="font-weight: 700;">${m.calories} kcal</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${m.meal_type}</div>
                <p style="font-size: 0.88rem; color: var(--text-secondary); margin-top: 8px;">${m.instructions || ''}</p>
                <div class="meal-macros-badges">
                  <span class="badge badge-info">P: ${m.protein_g}g</span>
                  <span class="badge badge-warning">C: ${m.carbs_g}g</span>
                  <span class="badge badge-lime">F: ${m.fats_g}g</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    UI.refreshIcons();
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No Nutrition Blueprint Assigned</div>
        <div class="empty-state-desc">Your trainer has not assigned an active nutrition plan yet. Check back soon!</div>
      </div>
    `;
  }
}

/* --------------------------------------------------------------------------
   ATTENDANCE TAB
--------------------------------------------------------------------------- */
async function loadMemberAttendance() {
  if (!MemberState.profile) return;

  const res = await apiFetch(`/attendance/member/${MemberState.profile.id}`);
  if (res.success && res.data) {
    const { records, total_checkins } = res.data;

    const streakEl = document.getElementById('member-total-checkins');
    if (streakEl) streakEl.textContent = total_checkins;

    const tbody = document.getElementById('member-attendance-tbody');
    if (tbody) {
      if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center" style="padding: 24px;">No check-in history yet.</td></tr>';
      } else {
        tbody.innerHTML = records.map(r => `
          <tr>
            <td>${UI.formatDate(r.date)}</td>
            <td class="font-mono text-lime">${UI.formatTime(r.check_in_time)}</td>
            <td class="font-mono">${r.check_out_time ? UI.formatTime(r.check_out_time) : '<span class="badge badge-warning">Active In Gym</span>'}</td>
            <td><span class="badge badge-success">${r.status}</span></td>
          </tr>
        `).join('');
      }
    }
  }
}

/* --------------------------------------------------------------------------
   PAYMENTS & INVOICES TAB
--------------------------------------------------------------------------- */
async function loadMemberPayments() {
  const tbody = document.getElementById('member-payments-tbody');
  if (!tbody) return;

  const res = await apiFetch('/payments');
  if (res.success && res.data) {
    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No payment transactions found.</td></tr>';
    } else {
      tbody.innerHTML = res.data.map(p => `
        <tr>
          <td class="font-mono text-lime" style="font-weight: 700;">${p.invoice_no}</td>
          <td>${UI.formatDate(p.payment_date)}</td>
          <td style="font-weight: 700; color: #FFF;">${UI.formatCurrency(p.amount)}</td>
          <td><span class="badge badge-info">${p.payment_method.toUpperCase()}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewReceiptModal(${p.id})">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> View Receipt
            </button>
          </td>
        </tr>
      `).join('');
    }
    UI.refreshIcons();
  }
}

async function viewReceiptModal(paymentId) {
  const res = await apiFetch(`/payments/${paymentId}/receipt`);
  if (!res.success || !res.data) {
    UI.showToast('Failed to load receipt', 'error');
    return;
  }

  const { payment, gym_info } = res.data;
  const container = document.getElementById('member-receipt-container');
  if (!container) return;

  container.innerHTML = `
    <div class="printable-receipt">
      <div class="receipt-header">
        <div>
          <h2 class="receipt-title">${gym_info.name}</h2>
          <div style="font-size: 0.85rem; color: #666;">${gym_info.tagline}</div>
          <div style="font-size: 0.8rem; color: #777;">${gym_info.address}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 1.1rem; color: #000;">OFFICIAL RECEIPT</div>
          <div class="font-mono" style="font-size: 1rem; color: #111; font-weight: 700;">${payment.invoice_no}</div>
          <div style="font-size: 0.82rem; color: #666;">Date: ${UI.formatDate(payment.payment_date)}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; padding: 12px; background: #F8F9FA; border-radius: 6px;">
        <div style="font-size: 0.78rem; text-transform: uppercase; color: #777;">Billed To:</div>
        <div style="font-weight: 700; font-size: 1.05rem; color: #111;">${payment.member_name}</div>
        <div style="font-size: 0.85rem; color: #555;">Member ID: ${payment.member_code}</div>
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Method</th>
            <th>Transaction ID</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${payment.plan_name ? `${payment.plan_name} Membership` : (payment.notes || 'Gym Membership')}</strong></td>
            <td>${payment.payment_method.toUpperCase()}</td>
            <td class="font-mono">${payment.transaction_id || 'CASH'}</td>
            <td style="text-align: right; font-weight: 700;">${UI.formatCurrency(payment.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="receipt-total">
        Total Paid: ${UI.formatCurrency(payment.amount)} USD
      </div>
    </div>
  `;

  UI.openModal('modal-member-receipt');
}

/* --------------------------------------------------------------------------
   PROFILE TAB
--------------------------------------------------------------------------- */
function populateMemberProfileForm() {
  const p = MemberState.profile;
  if (!p) return;
  const form = document.getElementById('member-profile-form');
  if (!form) return;

  form.phone.value = p.phone || '';
  form.emergency_contact.value = p.emergency_contact || '';
  form.address.value = p.address || '';
}

async function handleMemberProfileUpdate(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    phone: form.phone.value.trim(),
    emergency_contact: form.emergency_contact.value.trim(),
    address: form.address.value.trim()
  };

  const res = await apiFetch(`/members/${MemberState.profile.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    UI.showToast('Profile information updated successfully', 'success');
    await loadMemberProfile();
  } else {
    UI.showToast(res.message || 'Update failed', 'error');
  }
}

async function handleMemberPasswordChange(e) {
  e.preventDefault();
  const form = e.target;
  const current_password = form.current_password.value;
  const new_password = form.new_password.value;
  const confirm_password = form.confirm_password.value;

  if (new_password !== confirm_password) {
    UI.showToast('New passwords do not match', 'warning');
    return;
  }

  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password })
  });

  if (res.success) {
    UI.showToast('Password changed successfully!', 'success');
    form.reset();
  } else {
    UI.showToast(res.message || 'Password update failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   NOTIFICATIONS
--------------------------------------------------------------------------- */
async function setupNotifications() {
  document.getElementById('member-notif-btn')?.addEventListener('click', () => {
    loadNotificationsList();
    UI.openDrawer('member-notif-drawer');
  });

  const res = await apiFetch('/notifications');
  if (res.success && res.data) {
    const count = res.data.unread_count;
    const badge = document.getElementById('member-notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}

async function loadNotificationsList() {
  const container = document.getElementById('member-notif-list');
  if (!container) return;

  const res = await apiFetch('/notifications');
  if (res.success && res.data) {
    const list = res.data.notifications;
    if (list.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding: 24px;">No notifications</p>';
    } else {
      container.innerHTML = list.map(n => `
        <div style="padding: 14px; border-bottom: 1px solid var(--border-subtle); background: ${n.is_read ? 'transparent' : 'var(--accent-subtle)'};">
          <div style="font-weight: 700; color: #FFF; font-size: 0.9rem; margin-bottom: 2px;">${n.title}</div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 4px;">${n.message}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${UI.formatDate(n.created_at)}</div>
        </div>
      `).join('');
    }
  }
}

async function markAllNotificationsRead() {
  await apiFetch('/notifications/read-all', { method: 'PUT' });
  const badge = document.getElementById('member-notif-badge');
  if (badge) badge.style.display = 'none';
  loadNotificationsList();
}

function openMemberMyQrPassModal() {
  const profile = MemberState.profile;
  if (!profile) {
    UI.showToast('Loading profile credentials...', 'info');
    return;
  }

  UI.openModal('modal-member-my-qr-pass');
  const photo = document.getElementById('my-qr-pass-photo');
  const name = document.getElementById('my-qr-pass-name');
  const code = document.getElementById('my-qr-pass-code');
  const plan = document.getElementById('my-qr-pass-plan');
  const qrContainer = document.getElementById('my-qr-pass-container');

  if (photo) photo.src = profile.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';
  if (name) name.textContent = profile.full_name || 'Member';
  if (code) code.textContent = profile.member_code || 'APX-XXXX';
  if (plan) plan.textContent = profile.membership ? profile.membership.plan_name : 'Active Gym Membership';

  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    const payload = `APEX:MEMBER:${profile.member_code}`;
    new QRCode(qrContainer, {
      text: payload,
      width: 150,
      height: 150,
      colorDark: '#090B0A',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H
    });
  }
  UI.refreshIcons();
}

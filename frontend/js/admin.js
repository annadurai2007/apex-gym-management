/* ==========================================================================
   APEX FITNESS CLUB - ADMIN DASHBOARD CONTROLLER
   Full Comprehensive Management Suite (CRUD, Analytics, Live Check-in)
   ========================================================================== */

// State Management
const AdminState = {
  currentView: 'overview',
  members: { page: 1, limit: 10, total: 0, search: '', status: 'all' },
  payments: { page: 1, limit: 10, total: 0, search: '', status: 'all', method: 'all' },
  attendance: { page: 1, limit: 15, search: '', from: '', to: '' },
  plans: [],
  trainers: [],
  charts: { revenue: null, attendance: null, plans: null },
  trainerAttendance: { from: '', to: '', search: '', page: 1, limit: 20 },
  trainerScanner: null,
  isTrainerScanning: false,
  memberScanner: null,
  isMemberScanning: false
};

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce Admin/Staff/Trainer authorization
  if (!Auth.requireAuth(['admin', 'staff', 'trainer'])) return;

  setupNavigation();
  setupSidebarToggle();
  setupNotifications();
  
  // Load base data
  await loadPlansCache();
  await loadTrainersCache();
  
  // Initialize Default View
  switchView('overview');
  UI.refreshIcons();
});

/* --------------------------------------------------------------------------
   NAVIGATION & VIEW ROUTING
--------------------------------------------------------------------------- */
function filterNavigationByPermissions() {
  const user = Auth.getUser();
  if (!user) return;
  const isSuperAdmin = user.role === 'admin';

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    const requiredPermission = item.getAttribute('data-permission');
    if (!requiredPermission || isSuperAdmin) {
      item.style.display = '';
    } else {
      const allowed = Auth.hasPermission(requiredPermission);
      item.style.display = allowed ? '' : 'none';
    }
  });

  // Clean up category headers if all child items are hidden
  document.querySelectorAll('.sidebar-nav .nav-category').forEach(cat => {
    let nextEl = cat.nextElementSibling;
    let hasVisibleSibling = false;
    while (nextEl && !nextEl.classList.contains('nav-category')) {
      if (nextEl.classList.contains('nav-item') && nextEl.style.display !== 'none') {
        hasVisibleSibling = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    cat.style.display = hasVisibleSibling ? '' : 'none';
  });
}

function setupNavigation() {
  filterNavigationByPermissions();

  const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const confirmed = await UI.confirm('Log Out', 'Are you sure you want to end your administrative session?', 'Log Out', true);
      if (confirmed) {
        Auth.logout();
      }
    });
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-collapse-btn');
  const sidebar = document.getElementById('main-sidebar');
  const mobileToggle = document.getElementById('mobile-sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      setTimeout(() => resizeCharts(), 300);
    });
  }

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
}

function switchView(viewName) {
  // Permission guard for restricted views
  const user = Auth.getUser();
  const isSuperAdmin = user && user.role === 'admin';
  const targetNav = document.querySelector(`.sidebar-nav .nav-item[data-view="${viewName}"]`);
  if (targetNav && !isSuperAdmin) {
    const reqPerm = targetNav.getAttribute('data-permission');
    if (reqPerm && !Auth.hasPermission(reqPerm)) {
      UI.showToast(`Access Restricted: Missing capability '${reqPerm}'`, 'warning');
      if (viewName !== 'overview') {
        switchView('overview');
      }
      return;
    }
  }

  AdminState.currentView = viewName;

  // Auto-close mobile drawer on view switch
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && window.innerWidth <= 1024) {
    sidebar.classList.remove('mobile-open');
    backdrop?.classList.remove('active');
  }

  // Update nav active states
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Page Title
  const titles = {
    overview: 'Executive Dashboard',
    members: 'Member Management',
    trainers: 'Trainer & Staff Directory',
    plans: 'Membership Plans & Pricing',
    attendance: 'Attendance & Check-In Desk',
    'trainer-attendance': 'Trainer QR Attendance Desk',
    payments: 'Billing & Payment Ledger',
    workouts: 'Workout Routine Templates',
    diets: 'Nutrition & Diet Blueprints',
    reports: 'Business Reports & CSV Exports',
    permissions: 'Role Permissions Matrix',
    settings: 'System & Profile Settings'
  };
  const titleEl = document.getElementById('current-page-title');
  if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';

  // If leaving trainer attendance view, stop camera scanner
  if (viewName !== 'trainer-attendance' && AdminState.isTrainerScanning) {
    stopCameraScanner();
  }

  // If leaving member attendance view, stop member camera scanner
  if (viewName !== 'attendance' && AdminState.isMemberScanning) {
    stopMemberCameraScanner();
  }

  // Toggle view containers
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.style.display = sec.id === `view-${viewName}` ? 'block' : 'none';
  });

  // Load view-specific data
  switch (viewName) {
    case 'overview':
      loadOverviewDashboard();
      break;
    case 'members':
      loadMembersTable();
      break;
    case 'trainers':
      loadTrainersView();
      break;
    case 'plans':
      loadPlansView();
      break;
    case 'attendance':
      loadAttendanceView();
      break;
    case 'trainer-attendance':
      loadTrainerAttendanceView();
      break;
    case 'payments':
      loadPaymentsView();
      break;
    case 'workouts':
      loadWorkoutsView();
      break;
    case 'diets':
      loadDietsView();
      break;
    case 'reports':
      loadReportsView();
      break;
    case 'permissions':
      PermissionsModule.load();
      break;
    case 'settings':
      loadSettingsView();
      break;
  }

  UI.refreshIcons();
}

/* --------------------------------------------------------------------------
   CACHES FOR PLANS & TRAINERS (Used in dropdowns)
--------------------------------------------------------------------------- */
async function loadPlansCache() {
  const res = await apiFetch('/plans?include_inactive=true');
  if (res.success && res.data) {
    AdminState.plans = res.data;
  }
}

async function loadTrainersCache() {
  const res = await apiFetch('/trainers');
  if (res.success && res.data) {
    AdminState.trainers = res.data;
  }
}

/* --------------------------------------------------------------------------
   1. OVERVIEW DASHBOARD & CHARTS
--------------------------------------------------------------------------- */
async function loadOverviewDashboard() {
  // 1. Fetch Stats
  const statsRes = await apiFetch('/dashboard/stats');
  if (statsRes.success && statsRes.data) {
    const s = statsRes.data;
    document.getElementById('stat-total-members').textContent = s.total_members;
    document.getElementById('stat-active-members').textContent = s.active_members;
    document.getElementById('stat-today-attendance').textContent = s.today_attendance;
    document.getElementById('stat-monthly-rev').textContent = UI.formatCurrency(s.monthly_revenue);
    document.getElementById('stat-pending-dues').textContent = UI.formatCurrency(s.pending_payments_amount);
    document.getElementById('stat-expiring-soon').textContent = s.expiring_soon_count;
    document.getElementById('stat-active-trainers').textContent = s.active_trainers;
  }

  // 2. Fetch Charts Data
  const chartsRes = await apiFetch('/dashboard/charts');
  if (chartsRes.success && chartsRes.data) {
    renderDashboardCharts(chartsRes.data);
  }

  // 3. Fetch Recent Activity
  const actRes = await apiFetch('/dashboard/recent-activity');
  if (actRes.success && actRes.data) {
    renderRecentActivity(actRes.data);
  }
  UI.refreshIcons();
}

function renderDashboardCharts(chartData) {
  // 1. Revenue Chart (Line)
  const revCtx = document.getElementById('chart-revenue');
  if (revCtx) {
    if (AdminState.charts.revenue) AdminState.charts.revenue.destroy();
    
    AdminState.charts.revenue = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: chartData.revenue_chart.labels,
        datasets: [{
          label: 'Revenue ($)',
          data: chartData.revenue_chart.data,
          borderColor: '#C6FF00',
          backgroundColor: 'rgba(198, 255, 0, 0.08)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#C6FF00',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#141715',
            titleColor: '#FFFFFF',
            bodyColor: '#C6FF00',
            borderColor: 'rgba(198,255,0,0.3)',
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#A1A6A2' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#A1A6A2', callback: v => `$${v}` } }
        }
      }
    });
  }

  // 2. Attendance Trends Chart (Bar)
  const attCtx = document.getElementById('chart-attendance');
  if (attCtx) {
    if (AdminState.charts.attendance) AdminState.charts.attendance.destroy();

    AdminState.charts.attendance = new Chart(attCtx, {
      type: 'bar',
      data: {
        labels: chartData.attendance_chart.labels,
        datasets: [{
          label: 'Daily Check-ins',
          data: chartData.attendance_chart.data,
          backgroundColor: '#22C55E',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#A1A6A2' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#A1A6A2', stepSize: 1 } }
        }
      }
    });
  }

  // 3. Plan Distribution Chart (Doughnut)
  const planCtx = document.getElementById('chart-plans');
  if (planCtx) {
    if (AdminState.charts.plans) AdminState.charts.plans.destroy();

    AdminState.charts.plans = new Chart(planCtx, {
      type: 'doughnut',
      data: {
        labels: chartData.plan_chart.labels,
        datasets: [{
          data: chartData.plan_chart.data,
          backgroundColor: ['#C6FF00', '#22C55E', '#38BDF8', '#F59E0B'],
          borderColor: '#141715',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#C8CEC9', font: { size: 12 } } }
        },
        cutout: '70%'
      }
    });
  }
}

function resizeCharts() {
  if (AdminState.charts.revenue) AdminState.charts.revenue.resize();
  if (AdminState.charts.attendance) AdminState.charts.attendance.resize();
  if (AdminState.charts.plans) AdminState.charts.plans.resize();
}

function renderRecentActivity(data) {
  // Recent Members Table
  const rmTbody = document.getElementById('overview-recent-members');
  if (rmTbody) {
    if (data.recent_members.length === 0) {
      rmTbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No registrations yet</td></tr>';
    } else {
      rmTbody.innerHTML = data.recent_members.map(m => `
        <tr>
          <td>
            <div class="user-cell">
              <img src="${m.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="user-avatar" alt="${m.full_name}">
              <div class="user-cell-meta">
                <span class="user-cell-name">${m.full_name}</span>
                <span class="user-cell-sub">${m.member_code}</span>
              </div>
            </div>
          </td>
          <td>${m.email}</td>
          <td>${UI.formatDate(m.joining_date)}</td>
          <td><span class="badge badge-${m.status === 'active' ? 'success' : m.status === 'expired' ? 'danger' : 'warning'}">${m.status}</span></td>
        </tr>
      `).join('');
    }
  }

  // Recent Payments Table
  const rpTbody = document.getElementById('overview-recent-payments');
  if (rpTbody) {
    if (data.recent_payments.length === 0) {
      rpTbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No recent payments</td></tr>';
    } else {
      rpTbody.innerHTML = data.recent_payments.map(p => `
        <tr>
          <td class="font-mono text-lime">${p.invoice_no}</td>
          <td>${p.member_name}</td>
          <td style="font-weight: 700; color: #FFF;">${UI.formatCurrency(p.amount)}</td>
          <td><span class="badge badge-${p.status === 'paid' ? 'success' : 'warning'}">${p.payment_method}</span></td>
        </tr>
      `).join('');
    }
  }

  // Expiring Soon List
  const expContainer = document.getElementById('overview-expiring-list');
  if (expContainer) {
    if (data.expiring_soon.length === 0) {
      expContainer.innerHTML = '<p class="text-muted" style="padding: 12px 0;">No memberships expiring within the next 14 days.</p>';
    } else {
      expContainer.innerHTML = data.expiring_soon.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div style="font-weight: 600; color: #FFF;">${item.full_name} <span class="font-mono text-muted">(${item.member_code})</span></div>
            <div style="font-size: 0.8rem; color: var(--status-warning);">Expires: ${UI.formatDate(item.end_date)} (${item.days_remaining} days left)</div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="openRenewModal(${item.member_id}, '${item.full_name}')">Renew</button>
        </div>
      `).join('');
    }
  }
}

/* --------------------------------------------------------------------------
   2. MEMBER MANAGEMENT
--------------------------------------------------------------------------- */
async function loadMembersTable() {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;

  tbody.innerHTML = UI.renderTableSkeleton(6, 6);

  const { page, limit, search, status } = AdminState.members;
  const res = await apiFetch(`/members?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${status}`);

  if (res.success && res.data) {
    AdminState.members.total = res.pagination.total;
    renderMembersRows(res.data);
    renderPagination('members-pagination', res.pagination, (newPage) => {
      AdminState.members.page = newPage;
      loadMembersTable();
    });
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">${res.message || 'Failed to load members'}</td></tr>`;
  }
  UI.refreshIcons();
}

function renderMembersRows(members) {
  const tbody = document.getElementById('members-table-body');
  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-title">No members found</div>
            <div class="empty-state-desc">Try clearing filters or search terms, or register a new member.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members.map(m => `
    <tr>
      <td>
        <div class="user-cell">
          <img src="${m.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="user-avatar" alt="${m.full_name}">
          <div class="user-cell-meta">
            <span class="user-cell-name">${m.full_name}</span>
            <span class="user-cell-sub font-mono">${m.member_code} &bull; ${m.phone}</span>
          </div>
        </div>
      </td>
      <td>${m.email}</td>
      <td>
        <div><strong style="color: #FFF;">${m.current_plan || 'No Active Plan'}</strong></div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">Expires: ${UI.formatDate(m.plan_expiry)}</div>
      </td>
      <td>${m.trainer_name || '<span class="text-muted">Unassigned</span>'}</td>
      <td>
        <span class="badge badge-${m.status === 'active' ? 'success' : m.status === 'expired' ? 'danger' : 'warning'}">
          ${m.status}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-secondary" onclick="viewMemberProfile(${m.id})" title="View Full Profile">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
          </button>
          <button class="btn btn-sm btn-secondary" onclick="openEditMemberModal(${m.id})" title="Edit Member">
            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteMemberAction(${m.id}, '${m.full_name}')" title="Delete Member">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Setup Member Search & Filters
document.getElementById('member-search-input')?.addEventListener('input', (e) => {
  AdminState.members.search = e.target.value;
  AdminState.members.page = 1;
  loadMembersTable();
});

document.getElementById('member-status-filter')?.addEventListener('change', (e) => {
  AdminState.members.status = e.target.value;
  AdminState.members.page = 1;
  loadMembersTable();
});

function openAddMemberModal() {
  populateSelectOptions('add-member-plan', AdminState.plans.map(p => ({ value: p.id, label: `${p.name} ($${p.price})` })), 'Select Membership Plan');
  populateSelectOptions('add-member-trainer', AdminState.trainers.map(t => ({ value: t.id, label: `${t.full_name} (${t.specialization})` })), 'Assign Personal Trainer (Optional)');
  document.getElementById('add-member-form').reset();
  UI.openModal('modal-add-member');
  UI.refreshIcons();
}

async function handleAddMemberSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    full_name: form.full_name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    gender: form.gender.value,
    date_of_birth: form.date_of_birth.value || null,
    emergency_contact: form.emergency_contact.value.trim(),
    address: form.address.value.trim(),
    plan_id: form.plan_id.value || null,
    trainer_id: form.trainer_id.value || null,
    password: form.password.value || 'Member@123'
  };

  const res = await apiFetch('/members', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    UI.showToast(`Member ${payload.full_name} created successfully!`, 'success');
    UI.closeModal('modal-add-member');
    loadMembersTable();
    loadOverviewDashboard();
  } else {
    UI.showToast(res.message || 'Failed to add member', 'error');
  }
}

async function openEditMemberModal(memberId) {
  const res = await apiFetch(`/members/${memberId}`);
  if (!res.success || !res.data) {
    UI.showToast('Failed to fetch member details', 'error');
    return;
  }
  const m = res.data;
  const form = document.getElementById('edit-member-form');
  form.member_id.value = m.id;
  form.full_name.value = m.full_name || '';
  form.email.value = m.email || '';
  form.phone.value = m.phone || '';
  form.gender.value = m.gender || 'male';
  form.date_of_birth.value = m.date_of_birth ? m.date_of_birth.split('T')[0] : '';
  form.emergency_contact.value = m.emergency_contact || '';
  form.address.value = m.address || '';
  form.status.value = m.status || 'active';

  UI.openModal('modal-edit-member');
}

async function handleEditMemberSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const memberId = form.member_id.value;
  const payload = {
    full_name: form.full_name.value.trim(),
    phone: form.phone.value.trim(),
    gender: form.gender.value,
    date_of_birth: form.date_of_birth.value || null,
    emergency_contact: form.emergency_contact.value.trim(),
    address: form.address.value.trim(),
    status: form.status.value
  };

  const res = await apiFetch(`/members/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    UI.showToast('Member profile updated successfully', 'success');
    UI.closeModal('modal-edit-member');
    loadMembersTable();
  } else {
    UI.showToast(res.message || 'Update failed', 'error');
  }
}

async function deleteMemberAction(memberId, name) {
  const confirmed = await UI.confirm(
    'Delete Member Account',
    `Are you sure you want to permanently delete ${name}? This will remove all their attendance and membership records.`,
    'Delete Member',
    true
  );

  if (confirmed) {
    const res = await apiFetch(`/members/${memberId}`, { method: 'DELETE' });
    if (res.success) {
      UI.showToast(`Member ${name} deleted successfully`, 'success');
      loadMembersTable();
      loadOverviewDashboard();
    } else {
      UI.showToast(res.message || 'Deletion failed', 'error');
    }
  }
}

async function viewMemberProfile(memberId) {
  const res = await apiFetch(`/members/${memberId}`);
  if (!res.success || !res.data) {
    UI.showToast('Unable to load member profile', 'error');
    return;
  }
  const m = res.data;
  const panel = document.getElementById('member-drawer-content');
  if (!panel) return;

  panel.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
      <img src="${m.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" style="width: 72px; height: 72px; border-radius: var(--radius-full); object-fit: cover; border: 2px solid var(--accent-primary);" alt="${m.full_name}">
      <div>
        <h3 style="font-size: 1.4rem; color: #FFF; margin-bottom: 4px;">${m.full_name}</h3>
        <span class="badge badge-lime font-mono">${m.member_code}</span>
        <span class="badge badge-${m.status === 'active' ? 'success' : 'danger'}">${m.status}</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: var(--bg-card); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
      <div>
        <div class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Email</div>
        <div style="color: #FFF; font-size: 0.88rem;">${m.email}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Phone</div>
        <div style="color: #FFF; font-size: 0.88rem;">${m.phone}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Emergency Contact</div>
        <div style="color: #FFF; font-size: 0.88rem;">${m.emergency_contact || 'None'}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size: 0.75rem; text-transform: uppercase;">Joining Date</div>
        <div style="color: #FFF; font-size: 0.88rem;">${UI.formatDate(m.joining_date)}</div>
      </div>
    </div>

    <h4 style="font-size: 1rem; margin-bottom: 12px; color: var(--accent-primary);">Assigned Trainer</h4>
    <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-md); margin-bottom: 24px; border: 1px solid var(--border-subtle);">
      ${m.trainer ? `
        <div style="font-weight: 600; color: #FFF;">${m.trainer.full_name}</div>
        <div style="font-size: 0.82rem; color: var(--text-muted);">${m.trainer.specialization} &bull; ${m.trainer.phone}</div>
      ` : '<span class="text-muted">No personal trainer assigned</span>'}
    </div>

    <h4 style="font-size: 1rem; margin-bottom: 12px; color: var(--accent-primary);">Active Programs</h4>
    <div style="background: var(--bg-card); padding: 14px; border-radius: var(--radius-md); margin-bottom: 24px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px;">
      <div><strong>Workout Routine:</strong> ${m.workout_plan ? m.workout_plan.name : '<span class="text-muted">None</span>'}</div>
      <div><strong>Diet Blueprint:</strong> ${m.diet_plan ? m.diet_plan.name : '<span class="text-muted">None</span>'}</div>
    </div>

    <h4 style="font-size: 1rem; margin-bottom: 12px; color: var(--accent-primary);">Recent Check-Ins (Last 5)</h4>
    <div style="margin-bottom: 24px;">
      ${m.recent_attendance && m.recent_attendance.length > 0 ? `
        <table class="data-table" style="font-size: 0.82rem;">
          <thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            ${m.recent_attendance.slice(0, 5).map(a => `
              <tr>
                <td>${UI.formatDate(a.date)}</td>
                <td>${UI.formatTime(a.check_in_time)}</td>
                <td>${UI.formatTime(a.check_out_time)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="text-muted">No attendance logs yet.</p>'}
    </div>

    <div style="display: flex; gap: 12px; margin-top: 16px;">
      <button class="btn btn-primary" style="flex: 1;" onclick="openRenewModal(${m.id}, '${m.full_name}')">Assign / Renew Plan</button>
      <button class="btn btn-secondary" onclick="UI.closeDrawer('member-detail-drawer')">Close</button>
    </div>
  `;

  UI.openDrawer('member-detail-drawer');
}

/* --------------------------------------------------------------------------
   3. TRAINERS MANAGEMENT
--------------------------------------------------------------------------- */
async function loadTrainersView() {
  const container = document.getElementById('trainers-grid-container');
  if (!container) return;

  const res = await apiFetch('/trainers');
  if (res.success && res.data) {
    AdminState.trainers = res.data;
    container.innerHTML = res.data.map(t => `
      <div class="card card-glow" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 16px;">
            <img src="${t.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" style="width: 60px; height: 60px; border-radius: var(--radius-full); object-fit: cover;" alt="${t.full_name}">
            <div>
              <h3 style="font-size: 1.25rem; color: #FFF; margin-bottom: 2px;">${t.full_name}</h3>
              <div style="font-size: 0.85rem; color: var(--accent-primary); font-weight: 600;">${t.specialization}</div>
            </div>
          </div>
          <p class="text-muted" style="font-size: 0.88rem; line-height: 1.5; margin-bottom: 16px;">${t.bio || 'Dedicated elite fitness master coach.'}</p>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem; color: var(--text-secondary); background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); margin-bottom: 16px;">
            <div><i data-lucide="mail" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${t.email}</div>
            <div><i data-lucide="phone" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${t.phone}</div>
            <div><i data-lucide="calendar" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${t.schedule}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
          <span class="badge badge-lime">${t.assigned_members_count || 0} Active Clients</span>
          <button class="btn btn-sm btn-secondary" onclick="openAssignTrainerModal(${t.id}, '${t.full_name}')">Assign Client</button>
        </div>
      </div>
    `).join('');
    UI.refreshIcons();
  }
}

function openAddTrainerModal() {
  document.getElementById('add-trainer-form').reset();
  UI.openModal('modal-add-trainer');
}

async function handleAddTrainerSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    full_name: form.full_name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    specialization: form.specialization.value.trim(),
    experience_years: parseInt(form.experience_years.value, 10) || 1,
    schedule: form.schedule.value.trim(),
    bio: form.bio.value.trim(),
    photo_url: form.photo_url.value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
  };

  const res = await apiFetch('/trainers', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast(`Trainer ${payload.full_name} registered successfully!`, 'success');
    UI.closeModal('modal-add-trainer');
    await loadTrainersCache();
    loadTrainersView();
  } else {
    UI.showToast(res.message || 'Failed to add trainer', 'error');
  }
}

function openAssignTrainerModal(trainerId, trainerName) {
  const form = document.getElementById('assign-trainer-form');
  form.trainer_id.value = trainerId;
  document.getElementById('assign-trainer-name-display').textContent = trainerName;

  // Populate active members
  apiFetch('/members?limit=100').then(res => {
    if (res.success && res.data) {
      populateSelectOptions('assign-member-select', res.data.map(m => ({ value: m.id, label: `${m.full_name} (${m.member_code})` })), 'Choose Member');
      UI.openModal('modal-assign-trainer');
    }
  });
}

async function handleAssignTrainerSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    trainer_id: form.trainer_id.value,
    member_id: form.member_id.value,
    notes: form.notes.value.trim()
  };

  const res = await apiFetch('/trainers/assign', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast('Member assigned to trainer successfully!', 'success');
    UI.closeModal('modal-assign-trainer');
    loadTrainersView();
  } else {
    UI.showToast(res.message || 'Assignment failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   4. MEMBERSHIP PLANS MANAGEMENT
--------------------------------------------------------------------------- */
async function loadPlansView() {
  const container = document.getElementById('plans-grid-container');
  if (!container) return;

  const res = await apiFetch('/plans?include_inactive=true');
  if (res.success && res.data) {
    AdminState.plans = res.data;
    container.innerHTML = res.data.map(p => `
      <div class="card ${p.badge ? 'card-glow' : ''}" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.3rem; color: #FFF;">${p.name}</h3>
              <span class="font-mono text-muted" style="font-size: 0.8rem;">${p.code}</span>
            </div>
            ${p.badge ? `<span class="badge badge-lime">${p.badge}</span>` : ''}
          </div>
          <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 16px;">
            <span style="font-size: 2.2rem; font-weight: 800; color: #FFF; font-family: var(--font-heading);">$${Math.round(p.price)}</span>
            <span class="text-muted" style="font-size: 0.85rem;">/ ${p.duration_months} mo</span>
          </div>
          <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 16px;">${p.description || 'Standard access.'}</p>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 24px;">
            ${(p.features_list || []).map(f => `<li><i data-lucide="check" style="width: 14px; height: 14px; color: var(--accent-primary);"></i> ${f}</li>`).join('')}
          </ul>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
          <span class="badge badge-${p.is_active ? 'success' : 'danger'}">${p.is_active ? 'Active' : 'Inactive'}</span>
          <button class="btn btn-sm btn-secondary" onclick="openEditPlanModal(${p.id})">Edit Plan</button>
        </div>
      </div>
    `).join('');
    UI.refreshIcons();
  }
}

function openAddPlanModal() {
  document.getElementById('add-plan-form').reset();
  UI.openModal('modal-add-plan');
}

async function handleAddPlanSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const featuresText = form.features.value;
  const featuresArr = featuresText.split('\n').map(s => s.trim()).filter(Boolean);

  const payload = {
    name: form.name.value.trim(),
    code: form.code.value.trim().toUpperCase(),
    duration_months: parseInt(form.duration_months.value, 10),
    price: parseFloat(form.price.value),
    badge: form.badge.value.trim() || null,
    description: form.description.value.trim(),
    features: featuresArr
  };

  const res = await apiFetch('/plans', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast(`Plan ${payload.name} created!`, 'success');
    UI.closeModal('modal-add-plan');
    await loadPlansCache();
    loadPlansView();
  } else {
    UI.showToast(res.message || 'Creation failed', 'error');
  }
}

async function openEditPlanModal(planId) {
  const res = await apiFetch(`/plans/${planId}`);
  if (!res.success || !res.data) return;
  const p = res.data;
  const form = document.getElementById('edit-plan-form');
  form.plan_id.value = p.id;
  form.name.value = p.name;
  form.duration_months.value = p.duration_months;
  form.price.value = p.price;
  form.badge.value = p.badge || '';
  form.description.value = p.description || '';
  form.features.value = (p.features_list || []).join('\n');
  form.is_active.value = p.is_active ? '1' : '0';

  UI.openModal('modal-edit-plan');
}

async function handleEditPlanSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const planId = form.plan_id.value;
  const featuresArr = form.features.value.split('\n').map(s => s.trim()).filter(Boolean);

  const payload = {
    name: form.name.value.trim(),
    duration_months: parseInt(form.duration_months.value, 10),
    price: parseFloat(form.price.value),
    badge: form.badge.value.trim() || null,
    description: form.description.value.trim(),
    features: featuresArr,
    is_active: form.is_active.value === '1'
  };

  const res = await apiFetch(`/plans/${planId}`, { method: 'PUT', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast('Plan updated successfully', 'success');
    UI.closeModal('modal-edit-plan');
    await loadPlansCache();
    loadPlansView();
  } else {
    UI.showToast(res.message || 'Update failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   5. ATTENDANCE MANAGEMENT (Students & Members: Live QR + Roll-Call + Edit)
--------------------------------------------------------------------------- */

let memberHudDismissTimer = null;
let lastMemberScanTimestamp = 0;

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function loadAttendanceView() {
  await Promise.all([
    loadTodayAttendance(),
    loadAttendanceHistory()
  ]);
  UI.refreshIcons();
}

async function loadTodayAttendance() {
  const tbody = document.getElementById('today-attendance-tbody');
  if (!tbody) return;

  const res = await apiFetch('/attendance/today');
  if (res.success && res.data) {
    const records = res.data;
    
    // Aggregate Desk Summary Stats
    let presentCount = 0;
    let absentCount = 0;
    let completedCount = 0;

    records.forEach(r => {
      if (r.status === 'absent') {
        absentCount++;
      } else if (r.status === 'completed' || r.check_out_time) {
        completedCount++;
        presentCount++;
      } else {
        presentCount++;
      }
    });

    const elPresent = document.getElementById('member-stat-present');
    const elAbsent = document.getElementById('member-stat-absent');
    const elCompleted = document.getElementById('member-stat-completed');
    const elTotal = document.getElementById('member-stat-total');

    if (elPresent) elPresent.textContent = presentCount;
    if (elAbsent) elAbsent.textContent = absentCount;
    if (elCompleted) elCompleted.textContent = completedCount;
    if (elTotal) elTotal.textContent = AdminState.members.total || (records.length + 5);

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center" style="padding: 24px;">No member attendance recorded yet today. Scan QR badge or click "Mark Attendance".</td></tr>';
    } else {
      tbody.innerHTML = records.map(r => {
        let statusBadge = '';
        if (r.status === 'absent') {
          statusBadge = '<span class="badge badge-absent" style="display:inline-flex; align-items:center; gap:5px;"><i data-lucide="user-x" style="width:12px; height:12px;"></i> Absent</span>';
        } else if (r.status === 'late') {
          statusBadge = '<span class="badge badge-late">Late Arrival</span>';
        } else if (r.check_out_time || r.status === 'completed') {
          statusBadge = '<span class="badge badge-success" style="display:inline-flex; align-items:center; gap:5px;"><i data-lucide="check" style="width:12px; height:12px;"></i> Completed</span>';
        } else {
          statusBadge = '<span class="badge badge-lime" style="display:inline-flex; align-items:center; gap:5px;"><span class="status-pulse-dot"></span> Present</span>';
        }

        const checkInFormatted = r.check_in_time ? `<strong class="text-lime font-mono">${UI.formatTime(r.check_in_time)}</strong>` : '<span class="text-muted">—</span>';
        const checkOutFormatted = r.check_out_time ? `<span class="font-mono">${UI.formatTime(r.check_out_time)}</span>` : (r.status === 'present' ? '<span class="badge badge-warning" style="font-size: 0.72rem;">Active</span>' : '<span class="text-muted">—</span>');

        return `
          <tr>
            <td>
              <div class="user-cell">
                <img src="${r.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="user-avatar" alt="${r.full_name}">
                <div class="user-cell-meta">
                  <span class="user-cell-name">${r.full_name}</span>
                  <span class="user-cell-sub font-mono">${r.member_code} &bull; ${r.plan_name || 'Member'}</span>
                </div>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td>${checkInFormatted}</td>
            <td>${checkOutFormatted}</td>
            <td class="notes-cell" title="${escapeAttr(r.notes || '')}">${r.notes || '<span class="text-muted">—</span>'}</td>
            <td class="action-cell">
              <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end;">
                ${(!r.check_out_time && r.status === 'present') ? `
                  <button class="btn btn-sm btn-outline" onclick="handleCheckOutAction(${r.id})" title="Record Check-Out">Check Out</button>
                ` : ''}
                <button class="btn btn-sm btn-secondary btn-action-edit" onclick="openEditAttendanceModal(${r.id}, '${escapeAttr(r.full_name)}', '${r.member_code}', '${r.date}', '${r.status}', '${r.check_in_time || ''}', '${r.check_out_time || ''}', '${escapeAttr(r.notes || '')}')" title="Edit Record">
                  <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Edit
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
    UI.refreshIcons();
  }
}

async function loadAttendanceHistory() {
  const tbody = document.getElementById('attendance-history-tbody');
  if (!tbody) return;

  const { from, to, search, page, limit } = AdminState.attendance;
  const res = await apiFetch(`/attendance/history?page=${page}&limit=${limit}&from=${from}&to=${to}&search=${encodeURIComponent(search)}`);

  if (res.success && res.data) {
    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No historical records found.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(r => {
      let statusBadge = '';
      if (r.status === 'absent') {
        statusBadge = '<span class="badge badge-absent">Absent</span>';
      } else if (r.status === 'late') {
        statusBadge = '<span class="badge badge-late">Late</span>';
      } else {
        statusBadge = '<span class="badge badge-success">Present</span>';
      }

      return `
        <tr>
          <td>${UI.formatDate(r.date)}</td>
          <td>
            <span style="color: #FFF; font-weight: 600;">${r.full_name}</span>
            <span class="font-mono text-muted" style="font-size: 0.8rem;"> (${r.member_code})</span>
          </td>
          <td>${statusBadge}</td>
          <td class="font-mono text-lime">${r.check_in_time ? UI.formatTime(r.check_in_time) : '—'}</td>
          <td class="font-mono">${r.check_out_time ? UI.formatTime(r.check_out_time) : '—'}</td>
          <td class="notes-cell" title="${escapeAttr(r.notes || '')}">${r.notes || '<span class="text-muted">—</span>'}</td>
          <td class="action-cell">
            <button class="btn btn-sm btn-outline btn-action-edit" onclick="openEditAttendanceModal(${r.id}, '${escapeAttr(r.full_name)}', '${r.member_code}', '${r.date}', '${r.status}', '${r.check_in_time || ''}', '${r.check_out_time || ''}', '${escapeAttr(r.notes || '')}')" title="Edit Record">
              <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Edit
            </button>
          </td>
        </tr>
      `;
    }).join('');
    UI.refreshIcons();
  }
}

function filterAttendanceHistory() {
  const fromInput = document.getElementById('attendance-history-from');
  const toInput = document.getElementById('attendance-history-to');
  AdminState.attendance.from = fromInput ? fromInput.value : '';
  AdminState.attendance.to = toInput ? toInput.value : '';
  AdminState.attendance.page = 1;
  loadAttendanceHistory();
}

async function handleQuickCheckIn(e) {
  e.preventDefault();
  const input = document.getElementById('quick-checkin-input');
  const code = input.value.trim().toUpperCase();

  if (!code) {
    UI.showToast('Please enter member code or scan badge', 'warning');
    return;
  }

  processMemberScan(code);
  input.value = '';
}

async function handleCheckOutAction(attendanceId) {
  const res = await apiFetch('/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({ attendance_id: attendanceId })
  });

  if (res.success) {
    UI.showToast('Check-out time logged successfully', 'success');
    loadTodayAttendance();
    loadAttendanceHistory();
  } else {
    UI.showToast(res.message || 'Check-out failed', 'error');
  }
}

// --------------------------------------------------------------------------
// ROLL-CALL: MARK ATTENDANCE (PRESENT / ABSENT / LATE)
// --------------------------------------------------------------------------

async function openMarkAttendanceModal() {
  const select = document.getElementById('mark-member-select');
  const dateInput = document.getElementById('mark-date-input');
  const timeInput = document.getElementById('mark-checkin-time');
  const statusSelect = document.getElementById('mark-status-select');
  const notesInput = document.getElementById('mark-notes-input');

  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (timeInput) timeInput.value = new Date().toTimeString().slice(0, 8);
  if (statusSelect) statusSelect.value = 'present';
  if (notesInput) notesInput.value = '';

  // Load active members for selection
  if (select) {
    select.innerHTML = '<option value="">Loading members...</option>';
    const res = await apiFetch('/members?limit=100&status=active');
    if (res.success && res.data) {
      select.innerHTML = '<option value="">Select Member / Student</option>' +
        res.data.map(m => `<option value="${m.id}">${m.full_name} (${m.member_code})</option>`).join('');
    }
  }

  toggleMarkStatusFields();
  UI.openModal('modal-mark-attendance');
}

function toggleMarkStatusFields() {
  const status = document.getElementById('mark-status-select')?.value;
  const timeFields = document.getElementById('mark-time-fields');
  if (timeFields) {
    if (status === 'absent') {
      timeFields.style.display = 'none';
    } else {
      timeFields.style.display = 'grid';
    }
  }
}

async function handleMarkAttendanceSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const memberId = form.member_id.value;
  const status = form.status.value;
  const dateVal = form.date.value;
  const inTime = form.check_in_time ? form.check_in_time.value : null;
  const outTime = form.check_out_time ? form.check_out_time.value : null;
  const notes = form.notes.value.trim();

  if (!memberId) {
    UI.showToast('Please select a member', 'warning');
    return;
  }

  const payload = {
    member_id: parseInt(memberId),
    status: status,
    date: dateVal,
    check_in_time: status === 'absent' ? null : (inTime || null),
    check_out_time: status === 'absent' ? null : (outTime || null),
    notes: notes
  };

  const res = await apiFetch('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    if (window.SoundFX && typeof SoundFX.success === 'function') SoundFX.success();
    UI.showToast(res.message, 'success');
    UI.closeModal('modal-mark-attendance');
    loadTodayAttendance();
    loadAttendanceHistory();
  } else {
    UI.showToast(res.message || 'Failed to mark attendance', 'error');
  }
}

// --------------------------------------------------------------------------
// EDIT ATTENDANCE RECORD MODAL
// --------------------------------------------------------------------------

function openEditAttendanceModal(id, memberName, memberCode, date, status, inTime, outTime, notes) {
  const idEl = document.getElementById('edit-attendance-id');
  const nameEl = document.getElementById('edit-attendance-member-name');
  const codeEl = document.getElementById('edit-attendance-member-code');
  const dateEl = document.getElementById('edit-attendance-date');
  const statusEl = document.getElementById('edit-attendance-status');
  const inTimeEl = document.getElementById('edit-attendance-in-time');
  const outTimeEl = document.getElementById('edit-attendance-out-time');
  const notesEl = document.getElementById('edit-attendance-notes');

  if (idEl) idEl.value = id;
  if (nameEl) nameEl.textContent = memberName;
  if (codeEl) codeEl.textContent = memberCode;
  if (dateEl) dateEl.textContent = `Date: ${date}`;
  if (statusEl) statusEl.value = status || 'present';
  if (inTimeEl) inTimeEl.value = inTime || '';
  if (outTimeEl) outTimeEl.value = outTime || '';
  if (notesEl) notesEl.value = notes || '';

  toggleEditStatusFields();
  UI.openModal('modal-edit-attendance');
}

function toggleEditStatusFields() {
  const status = document.getElementById('edit-attendance-status')?.value;
  const timeFields = document.getElementById('edit-time-fields');
  if (timeFields) {
    if (status === 'absent') {
      timeFields.style.display = 'none';
    } else {
      timeFields.style.display = 'grid';
    }
  }
}

async function handleEditAttendanceSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-attendance-id')?.value;
  if (!id) return;

  const status = document.getElementById('edit-attendance-status')?.value;
  const inTime = document.getElementById('edit-attendance-in-time')?.value;
  const outTime = document.getElementById('edit-attendance-out-time')?.value;
  const notes = document.getElementById('edit-attendance-notes')?.value.trim();

  const payload = {
    status: status,
    check_in_time: status === 'absent' ? null : (inTime || null),
    check_out_time: status === 'absent' ? null : (outTime || null),
    notes: notes
  };

  const res = await apiFetch(`/attendance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    UI.showToast('Attendance record updated successfully', 'success');
    UI.closeModal('modal-edit-attendance');
    loadTodayAttendance();
    loadAttendanceHistory();
  } else {
    UI.showToast(res.message || 'Update failed', 'error');
  }
}

async function handleDeleteAttendanceClick() {
  const id = document.getElementById('edit-attendance-id')?.value;
  if (!id) return;

  const confirmed = await UI.confirm('Delete Attendance Log', 'Are you sure you want to permanently delete this attendance record?', 'Delete', true);
  if (confirmed) {
    const res = await apiFetch(`/attendance/${id}`, { method: 'DELETE' });
    if (res.success) {
      UI.showToast('Attendance log deleted', 'info');
      UI.closeModal('modal-edit-attendance');
      loadTodayAttendance();
      loadAttendanceHistory();
    } else {
      UI.showToast(res.message || 'Delete failed', 'error');
    }
  }
}

// --------------------------------------------------------------------------
// MEMBER OPTICAL QR SCANNER & HUD CONTROLLER
// --------------------------------------------------------------------------

function simulateMemberScan(memberCode) {
  processMemberScan(memberCode);
}

async function processMemberScan(rawCode) {
  const now = Date.now();
  if (now - lastMemberScanTimestamp < 1200) return;
  lastMemberScanTimestamp = now;

  let code = rawCode.trim();
  if (code.startsWith('APEX:MEMBER:')) {
    code = code.replace('APEX:MEMBER:', '');
  }

  try {
    const res = await apiFetch('/attendance/scan', {
      method: 'POST',
      body: JSON.stringify({ member_code: code })
    });

    if (res && res.success) {
      if (window.SoundFX && typeof SoundFX.success === 'function') SoundFX.success();
      showMemberHud(res.data);
      UI.showToast(res.message, res.data.action === 'already_completed' ? 'info' : 'success', res.data.full_name);
      loadTodayAttendance();
      loadAttendanceHistory();
      loadOverviewDashboard();
    } else {
      if (window.SoundFX && typeof SoundFX.playTone === 'function') SoundFX.playTone(220, 'sawtooth', 0.25, 0.08);
      UI.showToast(res ? res.message : 'Scan recognition failed', 'error', 'Check-In Rejected');
    }
  } catch (err) {
    console.error('Member scan error:', err);
    UI.showToast('Network error processing member scan', 'error');
  }
}

function showMemberHud(data) {
  const card = document.getElementById('member-scan-hud-card');
  if (!card) return;

  const actionPill = document.getElementById('member-hud-action-pill');
  const avatar = document.getElementById('member-hud-avatar');
  const name = document.getElementById('member-hud-name');
  const meta = document.getElementById('member-hud-meta');
  const inTime = document.getElementById('member-hud-in-time');
  const outTime = document.getElementById('member-hud-out-time');
  const statusEl = document.getElementById('member-hud-status');
  const footerMsg = document.getElementById('member-hud-footer-message');

  if (actionPill) {
    actionPill.className = 'hud-action-badge';
    if (data.action === 'check_in') {
      actionPill.textContent = 'CHECK-IN (IN-TIME LOGGED)';
    } else if (data.action === 'check_out') {
      actionPill.classList.add('out-time');
      actionPill.textContent = 'CHECK-OUT (WORKOUT DONE)';
    } else {
      actionPill.classList.add('already-completed');
      actionPill.textContent = 'SESSION ALREADY LOGGED';
    }
  }

  if (avatar) avatar.src = data.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';
  if (name) name.textContent = data.full_name || 'Member';
  if (meta) meta.textContent = `${data.member_code || ''} • ${data.plan_name || 'Active Member'}`;
  if (inTime) inTime.textContent = data.in_time || '—';
  if (outTime) outTime.textContent = data.out_time || '—';
  if (statusEl) statusEl.textContent = data.action === 'check_in' ? 'Present' : (data.action === 'check_out' ? 'Completed' : 'Completed');
  if (footerMsg) {
    footerMsg.innerHTML = `<i data-lucide="check-circle" style="width:14px; height:14px; display:inline;"></i> ${
      data.action === 'check_in' ? 'Check-in verified. Turnstile unlocked.' :
      data.action === 'check_out' ? 'Check-out verified. Great workout today!' :
      'Session already recorded for today.'
    }`;
    UI.refreshIcons();
  }

  card.style.display = 'block';

  if (memberHudDismissTimer) clearTimeout(memberHudDismissTimer);
  memberHudDismissTimer = setTimeout(() => {
    hideMemberHud();
  }, 10000);
}

function hideMemberHud() {
  const card = document.getElementById('member-scan-hud-card');
  if (card) card.style.display = 'none';
  if (memberHudDismissTimer) {
    clearTimeout(memberHudDismissTimer);
    memberHudDismissTimer = null;
  }
}

async function toggleMemberCameraScanner() {
  if (AdminState.isMemberScanning) {
    stopMemberCameraScanner();
  } else {
    startMemberCameraScanner();
  }
}

async function startMemberCameraScanner() {
  const toggleBtn = document.getElementById('btn-toggle-member-camera');
  const viewportBox = document.getElementById('member-scanner-box');
  const idlePrompt = document.getElementById('member-scanner-idle-prompt');
  const statusPill = document.getElementById('member-camera-status-pill');

  if (!window.Html5Qrcode) {
    UI.showToast('HTML5 QR Scanner engine not loaded. Please verify internet connectivity.', 'warning');
    return;
  }

  try {
    if (!AdminState.memberScanner) {
      AdminState.memberScanner = new Html5Qrcode('member-qr-reader');
    }

    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

    await AdminState.memberScanner.start(
      { facingMode: 'user' },
      config,
      (decodedText) => {
        processMemberScan(decodedText);
      },
      (errorMessage) => {}
    );

    AdminState.isMemberScanning = true;
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i data-lucide="camera-off" style="width: 14px; height: 14px;"></i> Stop Camera';
      toggleBtn.classList.remove('btn-outline');
      toggleBtn.classList.add('btn-secondary');
    }
    if (viewportBox) viewportBox.classList.add('scanning');
    if (idlePrompt) idlePrompt.style.display = 'none';
    if (statusPill) statusPill.innerHTML = '<span class="status-pulse-dot"></span> Member Camera Active — Hold QR Pass in viewfinder';
    UI.refreshIcons();
    UI.showToast('Member optical camera scanner activated', 'info');
  } catch (err) {
    console.warn('Member camera access denied or unavailable:', err);
    AdminState.isMemberScanning = false;
    UI.showToast('Camera unavailable. Use 1-Click Simulation Badges or type code below.', 'warning', 'Camera Notice');
    if (viewportBox) viewportBox.classList.remove('scanning');
    if (idlePrompt) idlePrompt.style.display = 'flex';
  }
}

async function stopMemberCameraScanner() {
  if (AdminState.memberScanner && AdminState.isMemberScanning) {
    try {
      await AdminState.memberScanner.stop();
    } catch (e) {
      console.warn('Error stopping member camera:', e);
    }
  }

  AdminState.isMemberScanning = false;
  const toggleBtn = document.getElementById('btn-toggle-member-camera');
  const viewportBox = document.getElementById('member-scanner-box');
  const idlePrompt = document.getElementById('member-scanner-idle-prompt');
  const statusPill = document.getElementById('member-camera-status-pill');

  if (toggleBtn) {
    toggleBtn.innerHTML = '<i data-lucide="camera" style="width: 14px; height: 14px;"></i> Start Camera';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-outline');
  }
  if (viewportBox) viewportBox.classList.remove('scanning');
  if (idlePrompt) idlePrompt.style.display = 'flex';
  if (statusPill) statusPill.innerHTML = '<i data-lucide="info" style="width: 13px; height: 13px;"></i> Scans Member QR Passes automatically';
  UI.refreshIcons();
}

// --------------------------------------------------------------------------
// MEMBER / STUDENT DIGITAL QR PASSES
// --------------------------------------------------------------------------

async function openMemberBadgesModal() {
  UI.openModal('modal-member-badges');
  const grid = document.getElementById('member-badges-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">Loading verified member passes...</div>';

  const res = await apiFetch('/members/badges');
  if (res && res.success && res.data) {
    const members = res.data;
    if (members.length === 0) {
      grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">No active members found.</div>';
      return;
    }

    grid.innerHTML = members.map((m, idx) => `
      <div class="trainer-digital-badge" id="member-badge-card-${idx}">
        <div class="badge-brand-mark">APEX &bull; MEMBER ACCESS PASS</div>
        <img src="${m.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="badge-trainer-photo" alt="${m.full_name}">
        <div class="badge-trainer-fullname">${m.full_name}</div>
        <div class="badge-trainer-specialty">${m.plan_name || 'Active Subscription'}</div>
        <div class="badge-qr-container" id="member-qr-target-${idx}"></div>
        <div class="badge-code-label">${m.member_code}</div>
        <div style="margin-top: 10px; font-size: 0.72rem; color: var(--text-muted); font-mono;">${m.email || ''}</div>
      </div>
    `).join('');

    setTimeout(() => {
      members.forEach((m, idx) => {
        const qrEl = document.getElementById(`member-qr-target-${idx}`);
        if (qrEl && window.QRCode) {
          qrEl.innerHTML = '';
          new QRCode(qrEl, {
            text: m.qr_payload || `APEX:MEMBER:${m.member_code}`,
            width: 128,
            height: 128,
            colorDark: '#090B0A',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      });
    }, 50);

    UI.refreshIcons();
  } else {
    grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">Failed to load member passes.</div>';
  }
}

function printMemberBadges() {
  window.print();
}

/* --------------------------------------------------------------------------
   6. PAYMENTS & INVOICES MANAGEMENT
--------------------------------------------------------------------------- */
async function loadPaymentsView() {
  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;

  const { page, limit, search, status, method } = AdminState.payments;
  const res = await apiFetch(`/payments?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${status}&method=${method}`);

  if (res.success && res.data) {
    AdminState.payments.total = res.pagination.total;
    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td class="font-mono text-lime" style="font-weight: 700;">${p.invoice_no}</td>
        <td>
          <div style="font-weight: 600; color: #FFF;">${p.member_name}</div>
          <div class="font-mono text-muted" style="font-size: 0.78rem;">${p.member_code}</div>
        </td>
        <td>${UI.formatDate(p.payment_date)}</td>
        <td style="font-weight: 800; color: #FFF; font-size: 1rem;">${UI.formatCurrency(p.amount)}</td>
        <td><span class="badge badge-info">${p.payment_method}</span></td>
        <td><span class="badge badge-${p.status === 'paid' ? 'success' : 'warning'}">${p.status}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewReceiptModal(${p.id})">
            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Receipt
          </button>
        </td>
      </tr>
    `).join('');

    renderPagination('payments-pagination', res.pagination, (newPage) => {
      AdminState.payments.page = newPage;
      loadPaymentsView();
    });
    UI.refreshIcons();
  }
}

function openRecordPaymentModal() {
  // Populate members
  apiFetch('/members?limit=100').then(res => {
    if (res.success && res.data) {
      populateSelectOptions('payment-member-select', res.data.map(m => ({ value: m.id, label: `${m.full_name} (${m.member_code})` })), 'Choose Member');
      document.getElementById('record-payment-form').reset();
      UI.openModal('modal-record-payment');
    }
  });
}

async function handleRecordPaymentSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    member_id: form.member_id.value,
    amount: parseFloat(form.amount.value),
    payment_method: form.payment_method.value,
    payment_date: form.payment_date.value || new Date().toISOString().split('T')[0],
    notes: form.notes.value.trim() || 'Offline payment settled'
  };

  const res = await apiFetch('/payments', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast(`Payment of $${payload.amount} recorded successfully!`, 'success');
    UI.closeModal('modal-record-payment');
    loadPaymentsView();
    loadOverviewDashboard();
  } else {
    UI.showToast(res.message || 'Payment recording failed', 'error');
  }
}

async function viewReceiptModal(paymentId) {
  const res = await apiFetch(`/payments/${paymentId}/receipt`);
  if (!res.success || !res.data) {
    UI.showToast('Failed to load receipt', 'error');
    return;
  }

  const { payment, gym_info } = res.data;
  const container = document.getElementById('receipt-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="printable-receipt" id="printable-receipt-area">
      <div class="receipt-header">
        <div>
          <h2 class="receipt-title">${gym_info.name}</h2>
          <div style="font-size: 0.85rem; color: #666;">${gym_info.tagline}</div>
          <div style="font-size: 0.8rem; color: #777; margin-top: 4px;">${gym_info.address}</div>
          <div style="font-size: 0.8rem; color: #777;">Tel: ${gym_info.phone} | Email: ${gym_info.email}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: #000;">OFFICIAL RECEIPT</div>
          <div class="font-mono" style="font-size: 1rem; color: #111; font-weight: 700; margin-top: 4px;">${payment.invoice_no}</div>
          <div style="font-size: 0.82rem; color: #666; margin-top: 4px;">Date: ${UI.formatDate(payment.payment_date)}</div>
          <div style="font-size: 0.82rem; color: #666;">Tax ID: ${gym_info.tax_id}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; padding: 12px; background: #F8F9FA; border-radius: 6px;">
        <div style="font-size: 0.78rem; text-transform: uppercase; color: #777;">Billed To:</div>
        <div style="font-weight: 700; font-size: 1.05rem; color: #111;">${payment.member_name}</div>
        <div style="font-size: 0.85rem; color: #555;">Member ID: ${payment.member_code} | Email: ${payment.member_email}</div>
        <div style="font-size: 0.85rem; color: #555;">Phone: ${payment.member_phone || '—'}</div>
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Payment Method</th>
            <th>Transaction Reference</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${payment.plan_name ? `${payment.plan_name} Membership` : (payment.notes || 'Gym Membership Fee')}</strong></td>
            <td>${payment.payment_method.toUpperCase()}</td>
            <td class="font-mono">${payment.transaction_id || 'OFFLINE-CASH'}</td>
            <td style="text-align: right; font-weight: 700;">${UI.formatCurrency(payment.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="receipt-total">
        Total Paid: ${UI.formatCurrency(payment.amount)} USD
      </div>

      <div style="border-top: 1px dashed #CCC; padding-top: 14px; text-align: center; font-size: 0.78rem; color: #888;">
        Thank you for choosing APEX FITNESS CLUB. Please keep this receipt for your records.
      </div>
    </div>
  `;

  UI.openModal('modal-receipt');
}

function printCurrentReceipt() {
  window.print();
}

/* --------------------------------------------------------------------------
   7. RENEW MEMBERSHIP MODAL
--------------------------------------------------------------------------- */
function openRenewModal(memberId, memberName) {
  document.getElementById('renew-member-id').value = memberId;
  document.getElementById('renew-member-name-display').textContent = memberName;
  populateSelectOptions('renew-plan-select', AdminState.plans.map(p => ({ value: p.id, label: `${p.name} ($${p.price} / ${p.duration_months} mo)` })), 'Select Plan');
  UI.openModal('modal-renew-plan');
}

async function handleRenewSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    member_id: form.member_id.value,
    plan_id: form.plan_id.value,
    payment_method: form.payment_method.value
  };

  const res = await apiFetch('/memberships/assign', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    UI.showToast(`Membership activated through ${UI.formatDate(res.data.end_date)}!`, 'success');
    UI.closeModal('modal-renew-plan');
    UI.closeDrawer('member-detail-drawer');
    loadMembersTable();
    loadOverviewDashboard();
  } else {
    UI.showToast(res.message || 'Renewal failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   8. WORKOUTS MANAGEMENT
--------------------------------------------------------------------------- */
async function loadWorkoutsView() {
  const container = document.getElementById('workouts-list-container');
  if (!container) return;

  const res = await apiFetch('/workouts');
  if (res.success && res.data) {
    container.innerHTML = res.data.map(w => `
      <div class="card card-glow" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.3rem; color: #FFF; margin-bottom: 4px;">${w.name}</h3>
            <div style="font-size: 0.85rem; color: var(--accent-primary); font-weight: 600;">Goal: ${w.goal} &bull; ${w.difficulty} &bull; ${w.duration_weeks} Weeks</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openAssignWorkoutModal(${w.id}, '${w.name}')">Assign to Member</button>
        </div>
        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 16px;">${w.description || ''}</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
          ${(w.exercises || []).slice(0, 6).map(ex => `
            <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-size: 0.82rem;">
              <div style="font-weight: 600; color: #FFF;">${ex.exercise_name}</div>
              <div class="text-muted">${ex.day_of_week} &bull; ${ex.sets} sets x ${ex.reps}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
    UI.refreshIcons();
  }
}

function openAddWorkoutModal() {
  document.getElementById('add-workout-form').reset();
  document.getElementById('workout-exercises-rows').innerHTML = '';
  addExerciseRow(); // start with 1 row
  UI.openModal('modal-add-workout');
}

function addExerciseRow() {
  const container = document.getElementById('workout-exercises-rows');
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <select class="form-select ex-day" style="width: 140px;">
      <option value="Monday">Monday</option>
      <option value="Tuesday">Tuesday</option>
      <option value="Wednesday">Wednesday</option>
      <option value="Thursday">Thursday</option>
      <option value="Friday">Friday</option>
      <option value="Saturday">Saturday</option>
      <option value="Sunday">Sunday</option>
    </select>
    <input type="text" class="form-input ex-name" placeholder="Exercise Name (e.g. Bench Press)" required>
    <input type="text" class="form-input ex-muscle" placeholder="Target Muscle" style="width: 140px;">
    <input type="number" class="form-input ex-sets" placeholder="Sets" value="3" style="width: 80px;">
    <input type="text" class="form-input ex-reps" placeholder="Reps" value="10-12" style="width: 90px;">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

async function handleAddWorkoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const exRows = document.querySelectorAll('#workout-exercises-rows .form-row');
  const exercises = [];
  exRows.forEach(row => {
    exercises.push({
      day_of_week: row.querySelector('.ex-day').value,
      exercise_name: row.querySelector('.ex-name').value.trim(),
      muscle_group: row.querySelector('.ex-muscle').value.trim() || 'General',
      sets: parseInt(row.querySelector('.ex-sets').value, 10) || 3,
      reps: row.querySelector('.ex-reps').value.trim() || '10-12'
    });
  });

  const payload = {
    name: form.name.value.trim(),
    goal: form.goal.value.trim(),
    difficulty: form.difficulty.value,
    duration_weeks: parseInt(form.duration_weeks.value, 10) || 8,
    description: form.description.value.trim(),
    exercises
  };

  const res = await apiFetch('/workouts', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast(`Workout routine "${payload.name}" created!`, 'success');
    UI.closeModal('modal-add-workout');
    loadWorkoutsView();
  } else {
    UI.showToast(res.message || 'Creation failed', 'error');
  }
}

function openAssignWorkoutModal(planId, planName) {
  document.getElementById('assign-workout-plan-id').value = planId;
  document.getElementById('assign-workout-plan-name').textContent = planName;
  apiFetch('/members?limit=100').then(res => {
    if (res.success && res.data) {
      populateSelectOptions('assign-workout-member-select', res.data.map(m => ({ value: m.id, label: `${m.full_name} (${m.member_code})` })), 'Select Member');
      UI.openModal('modal-assign-workout');
    }
  });
}

async function handleAssignWorkoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    member_id: form.member_id.value,
    plan_id: form.plan_id.value,
    notes: form.notes.value.trim()
  };

  const res = await apiFetch('/workouts/assign', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast('Workout routine assigned successfully!', 'success');
    UI.closeModal('modal-assign-workout');
  } else {
    UI.showToast(res.message || 'Assignment failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   9. DIETS MANAGEMENT
--------------------------------------------------------------------------- */
async function loadDietsView() {
  const container = document.getElementById('diets-list-container');
  if (!container) return;

  const res = await apiFetch('/diets');
  if (res.success && res.data) {
    container.innerHTML = res.data.map(d => `
      <div class="card card-glow" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.3rem; color: #FFF; margin-bottom: 4px;">${d.name}</h3>
            <div style="font-size: 0.85rem; color: var(--accent-primary); font-weight: 600;">
              Goal: ${d.goal} &bull; Target: ${d.calorie_target} kcal (${d.protein_g}g Protein, ${d.carbs_g}g Carbs, ${d.fats_g}g Fat)
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="openAssignDietModal(${d.id}, '${d.name}')">Assign to Member</button>
        </div>
        <p class="text-muted" style="font-size: 0.88rem; margin-bottom: 16px;">${d.description || ''}</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${(d.meals || []).map(m => `
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge badge-lime" style="margin-right: 8px;">${m.timing}</span>
                <strong style="color: #FFF;">${m.meal_name}</strong> (${m.meal_type})
                <div class="text-muted" style="font-size: 0.8rem; margin-top: 4px;">${m.instructions || ''}</div>
              </div>
              <span class="text-lime font-mono" style="font-weight: 700;">${m.calories} kcal</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
    UI.refreshIcons();
  }
}

function openAddDietModal() {
  document.getElementById('add-diet-form').reset();
  document.getElementById('diet-meals-rows').innerHTML = '';
  addMealRow();
  UI.openModal('modal-add-diet');
}

function addMealRow() {
  const container = document.getElementById('diet-meals-rows');
  const div = document.createElement('div');
  div.className = 'form-row';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <select class="form-select meal-type" style="width: 140px;">
      <option value="Breakfast">Breakfast</option>
      <option value="Mid-Morning Snack">Snack</option>
      <option value="Lunch">Lunch</option>
      <option value="Evening Snack">Snack</option>
      <option value="Dinner">Dinner</option>
    </select>
    <input type="text" class="form-input meal-name" placeholder="Meal Name (e.g. Oatmeal & Eggs)" required>
    <input type="text" class="form-input meal-timing" placeholder="08:00 AM" style="width: 100px;">
    <input type="number" class="form-input meal-calories" placeholder="Calories" value="450" style="width: 100px;">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(div);
}

async function handleAddDietSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const mealRows = document.querySelectorAll('#diet-meals-rows .form-row');
  const meals = [];
  mealRows.forEach(row => {
    meals.push({
      meal_type: row.querySelector('.meal-type').value,
      meal_name: row.querySelector('.meal-name').value.trim(),
      timing: row.querySelector('.meal-timing').value.trim() || '08:00 AM',
      calories: parseInt(row.querySelector('.meal-calories').value, 10) || 400
    });
  });

  const payload = {
    name: form.name.value.trim(),
    goal: form.goal.value.trim(),
    calorie_target: parseInt(form.calorie_target.value, 10) || 2400,
    protein_g: parseInt(form.protein_g.value, 10) || 160,
    carbs_g: parseInt(form.carbs_g.value, 10) || 220,
    fats_g: parseInt(form.fats_g.value, 10) || 60,
    description: form.description.value.trim(),
    meals
  };

  const res = await apiFetch('/diets', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast(`Diet plan "${payload.name}" created!`, 'success');
    UI.closeModal('modal-add-diet');
    loadDietsView();
  } else {
    UI.showToast(res.message || 'Creation failed', 'error');
  }
}

function openAssignDietModal(planId, planName) {
  document.getElementById('assign-diet-plan-id').value = planId;
  document.getElementById('assign-diet-plan-name').textContent = planName;
  apiFetch('/members?limit=100').then(res => {
    if (res.success && res.data) {
      populateSelectOptions('assign-diet-member-select', res.data.map(m => ({ value: m.id, label: `${m.full_name} (${m.member_code})` })), 'Select Member');
      UI.openModal('modal-assign-diet');
    }
  });
}

async function handleAssignDietSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    member_id: form.member_id.value,
    plan_id: form.plan_id.value,
    notes: form.notes.value.trim()
  };

  const res = await apiFetch('/diets/assign', { method: 'POST', body: JSON.stringify(payload) });
  if (res.success) {
    UI.showToast('Diet blueprint assigned successfully!', 'success');
    UI.closeModal('modal-assign-diet');
  } else {
    UI.showToast(res.message || 'Assignment failed', 'error');
  }
}

/* --------------------------------------------------------------------------
   10. REPORTS & CSV EXPORTS
--------------------------------------------------------------------------- */
async function loadReportsView() {
  const res = await apiFetch('/reports/summary');
  if (res.success && res.data) {
    const s = res.data;
    const revMethodTbody = document.getElementById('report-revenue-method-tbody');
    if (revMethodTbody) {
      revMethodTbody.innerHTML = (s.revenue_by_method || []).map(r => `
        <tr>
          <td style="text-transform: uppercase; font-weight: 600; color: #FFF;">${r.payment_method}</td>
          <td>${r.count}</td>
          <td style="color: var(--accent-primary); font-weight: 700;">${UI.formatCurrency(r.total)}</td>
        </tr>
      `).join('');
    }

    const planRevTbody = document.getElementById('report-top-plans-tbody');
    if (planRevTbody) {
      planRevTbody.innerHTML = (s.top_plans || []).map(p => `
        <tr>
          <td style="font-weight: 600; color: #FFF;">${p.name}</td>
          <td>${p.subscriber_count}</td>
          <td style="color: var(--accent-primary); font-weight: 700;">${UI.formatCurrency(p.total_revenue)}</td>
        </tr>
      `).join('');
    }
  }
}

function exportPaymentsCsv() {
  window.location.href = `${CONFIG.API_BASE_URL}/reports/export/payments`;
}

function exportAttendanceCsv() {
  window.location.href = `${CONFIG.API_BASE_URL}/reports/export/attendance`;
}

/* --------------------------------------------------------------------------
   11. SETTINGS & PROFILE
--------------------------------------------------------------------------- */
function loadSettingsView() {
  const user = Auth.getUser();
  if (user) {
    document.getElementById('settings-admin-email').value = user.email;
  }
}

async function handleChangePassword(e) {
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
    UI.showToast(res.message || 'Failed to update password', 'error');
  }
}

/* --------------------------------------------------------------------------
   NOTIFICATIONS DRAWER & HELPERS
--------------------------------------------------------------------------- */
async function setupNotifications() {
  const notifBtn = document.getElementById('notif-bell-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      loadNotificationsDrawer();
      UI.openDrawer('notifications-drawer');
    });
  }
  // Check unread count
  const res = await apiFetch('/notifications');
  if (res.success && res.data) {
    const count = res.data.unread_count;
    const badge = document.getElementById('topbar-notif-badge');
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

async function loadNotificationsDrawer() {
  const container = document.getElementById('notifications-drawer-list');
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
  const badge = document.getElementById('topbar-notif-badge');
  if (badge) badge.style.display = 'none';
  loadNotificationsDrawer();
}

function populateSelectOptions(selectId, items, placeholder = 'Select Option') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>` + 
    items.map(it => `<option value="${it.value}">${it.label}</option>`).join('');
}

function renderPagination(containerId, pagination, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container || pagination.pages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = `<div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end; padding: 16px 0;">`;
  html += `<span class="text-muted" style="font-size: 0.82rem; margin-right: 8px;">Page ${pagination.page} of ${pagination.pages} (${pagination.total} total)</span>`;
  
  if (pagination.page > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="window['${containerId}_change'](${pagination.page - 1})">Previous</button>`;
  }
  if (pagination.page < pagination.pages) {
    html += `<button class="btn btn-sm btn-secondary" onclick="window['${containerId}_change'](${pagination.page + 1})">Next</button>`;
  }
  html += `</div>`;

  window[`${containerId}_change`] = onPageChange;
  container.innerHTML = html;
}

/* ==========================================================================
   TRAINER QR ATTENDANCE STATION CONTROLLER
   Dual-Scan IN-TIME & OUT-TIME Engine with Holographic HUD
   ========================================================================== */

let hudDismissTimer = null;
let lastScanTimestamp = 0;

async function loadTrainerAttendanceView() {
  await Promise.all([
    loadTrainerTodayRoster(),
    loadTrainerAttendanceHistory()
  ]);
  UI.refreshIcons();
}

async function loadTrainerTodayRoster() {
  const tbody = document.getElementById('trainer-today-tbody');
  if (!tbody) return;

  const res = await apiFetch('/attendance/trainers/today');
  if (res && res.success && res.data) {
    const { summary, roster } = res.data;

    // Update Stat Cards
    const elActive = document.getElementById('trainer-stat-active');
    const elCompleted = document.getElementById('trainer-stat-completed');
    const elAwaiting = document.getElementById('trainer-stat-awaiting');
    const elTotal = document.getElementById('trainer-stat-total');

    if (elActive) elActive.textContent = summary.active_shifts || 0;
    if (elCompleted) elCompleted.textContent = summary.completed_shifts || 0;
    if (elAwaiting) elAwaiting.textContent = summary.not_present || 0;
    if (elTotal) elTotal.textContent = summary.total_trainers || 0;

    if (!roster || roster.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No active trainers found in database.</td></tr>`;
      return;
    }

    tbody.innerHTML = roster.map(r => {
      let statusBadge = '';
      let actionBtn = '';

      if (r.status === 'present') {
        statusBadge = `<span class="badge badge-lime" style="display:inline-flex; align-items:center; gap:6px;"><span class="status-pulse-dot"></span> On Shift</span>`;
        actionBtn = `<button class="btn btn-sm btn-outline" onclick="simulateTrainerScan('${r.trainer_code}')" title="Scan to clock out">
          <i data-lucide="log-out" style="width: 13px; height: 13px;"></i> Clock Out
        </button>`;
      } else if (r.status === 'completed') {
        statusBadge = `<span class="badge badge-success"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Completed</span>`;
        actionBtn = `<span class="text-muted" style="font-size: 0.8rem;">Shift Finished</span>`;
      } else if (r.status === 'late') {
        statusBadge = `<span class="badge badge-warning">Late Entry</span>`;
        actionBtn = `<button class="btn btn-sm btn-outline" onclick="simulateTrainerScan('${r.trainer_code}')">Clock Out</button>`;
      } else {
        statusBadge = `<span class="badge badge-outline" style="color: var(--text-muted); border-color: rgba(255,255,255,0.15);">Awaiting Arrival</span>`;
        actionBtn = `<button class="btn btn-sm btn-secondary" onclick="simulateTrainerScan('${r.trainer_code}')" title="Scan to clock in">
          <i data-lucide="log-in" style="width: 13px; height: 13px;"></i> Clock In
        </button>`;
      }

      const formattedIn = r.in_time ? `<span class="font-mono text-lime" style="font-weight: 700;">${r.in_time}</span>` : '<span class="text-muted">—</span>';
      const formattedOut = r.out_time ? `<span class="font-mono">${r.out_time}</span>` : (r.status === 'present' ? '<span class="badge badge-warning" style="font-size: 0.72rem;">Active</span>' : '<span class="text-muted">—</span>');
      const duration = r.total_hours !== null && r.total_hours !== undefined 
        ? `<strong class="font-mono text-lime">${r.total_hours} hrs</strong>` 
        : (r.status === 'present' ? '<span class="text-muted font-mono" style="font-size: 0.8rem;">Tracking...</span>' : '<span class="text-muted">—</span>');

      return `
        <tr>
          <td>
            <div class="user-cell">
              <img src="${r.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="user-avatar" alt="${r.full_name}">
              <div class="user-cell-meta">
                <span class="user-cell-name">${r.full_name}</span>
                <span class="user-cell-sub font-mono">${r.trainer_code} &bull; ${r.specialization || 'Fitness Coach'}</span>
              </div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>${formattedIn}</td>
          <td>${formattedOut}</td>
          <td>${duration}</td>
          <td style="text-align: right;">${actionBtn}</td>
        </tr>
      `;
    }).join('');

    UI.refreshIcons();
  }
}

async function loadTrainerAttendanceHistory() {
  const tbody = document.getElementById('trainer-history-tbody');
  if (!tbody) return;

  const { from, to, page, limit } = AdminState.trainerAttendance;
  let url = `/attendance/trainers/history?page=${page}&limit=${limit}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const res = await apiFetch(url);
  if (res && res.success && res.data) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No historical shift logs found for this filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(r => `
      <tr>
        <td>${UI.formatDate(r.date)}</td>
        <td>
          <div style="font-weight: 600; color: #FFF;">${r.full_name}</div>
          <div class="font-mono text-muted" style="font-size: 0.78rem;">${r.trainer_code}</div>
        </td>
        <td>
          <span class="badge ${r.status === 'completed' ? 'badge-success' : (r.status === 'present' ? 'badge-lime' : 'badge-outline')}">
            ${r.status}
          </span>
        </td>
        <td class="font-mono text-lime">${r.in_time || '—'}</td>
        <td class="font-mono">${r.out_time || '—'}</td>
        <td class="font-mono">${r.total_hours !== null && r.total_hours !== undefined ? `${r.total_hours} hrs` : '—'}</td>
      </tr>
    `).join('');
  }
}

function filterTrainerHistory() {
  const fromInput = document.getElementById('trainer-history-from');
  const toInput = document.getElementById('trainer-history-to');
  AdminState.trainerAttendance.from = fromInput ? fromInput.value : '';
  AdminState.trainerAttendance.to = toInput ? toInput.value : '';
  AdminState.trainerAttendance.page = 1;
  loadTrainerAttendanceHistory();
}

async function exportTrainerAttendanceCsv() {
  const { from, to } = AdminState.trainerAttendance;
  let url = `/attendance/trainers/history?limit=1000`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const res = await apiFetch(url);
  if (res && res.success && res.data && res.data.length > 0) {
    const headers = ['Date', 'Trainer Code', 'Trainer Name', 'Status', 'In Time', 'Out Time', 'Total Hours'];
    const rows = res.data.map(r => [
      r.date,
      r.trainer_code,
      `"${(r.full_name || '').replace(/"/g, '""')}"`,
      r.status,
      r.in_time || '',
      r.out_time || '',
      r.total_hours !== null && r.total_hours !== undefined ? r.total_hours : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apex_trainer_shifts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.showToast('Trainer shifts exported to CSV', 'success');
  } else {
    UI.showToast('No shift records available to export', 'info');
  }
}

// --------------------------------------------------------------------------
// MULTI-MODAL QR SCANNER & HUD CONTROLLER
// --------------------------------------------------------------------------

function handleManualTrainerScan(e) {
  e.preventDefault();
  const input = document.getElementById('manual-trainer-code-input');
  if (!input) return;
  const code = input.value.trim();
  if (!code) {
    UI.showToast('Please enter a Trainer Code or scan a badge', 'warning');
    return;
  }
  processTrainerScan(code);
  input.value = '';
}

function simulateTrainerScan(trainerCode) {
  processTrainerScan(trainerCode);
}

async function processTrainerScan(rawCode) {
  // Prevent debounced double-triggers within 1.2 seconds
  const now = Date.now();
  if (now - lastScanTimestamp < 1200) {
    return;
  }
  lastScanTimestamp = now;

  let code = rawCode.trim();
  if (code.startsWith('APEX:TRAINER:')) {
    code = code.replace('APEX:TRAINER:', '');
  }

  try {
    const res = await apiFetch('/attendance/trainers/scan', {
      method: 'POST',
      body: JSON.stringify({ trainer_code: code })
    });

    if (res && res.success) {
      if (window.SoundFX && typeof SoundFX.success === 'function') {
        SoundFX.success();
      }

      showTrainerHud(res.data);
      UI.showToast(res.message, res.data.action === 'already_completed' ? 'info' : 'success', res.data.trainer.full_name);
      loadTrainerTodayRoster();
      loadTrainerAttendanceHistory();
    } else {
      if (window.SoundFX && typeof SoundFX.playTone === 'function') {
        SoundFX.playTone(220, 'sawtooth', 0.25, 0.08);
      }
      UI.showToast(res ? res.message : 'Scan recognition failed', 'error', 'Scan Rejected');
    }
  } catch (err) {
    console.error('Trainer scan error:', err);
    UI.showToast('Network error processing trainer scan', 'error');
  }
}

function showTrainerHud(data) {
  const card = document.getElementById('trainer-scan-hud-card');
  if (!card) return;

  const trainer = data.trainer || {};
  const action = data.action;

  const actionPill = document.getElementById('hud-action-pill');
  const avatar = document.getElementById('hud-trainer-avatar');
  const name = document.getElementById('hud-trainer-name');
  const meta = document.getElementById('hud-trainer-meta');
  const inTime = document.getElementById('hud-in-time');
  const outTime = document.getElementById('hud-out-time');
  const totalHours = document.getElementById('hud-total-hours');
  const statusMsg = document.getElementById('hud-status-message');

  if (actionPill) {
    actionPill.className = 'hud-action-badge';
    if (action === 'check_in') {
      actionPill.textContent = 'CHECK-IN (IN-TIME RECORDED)';
    } else if (action === 'check_out') {
      actionPill.classList.add('out-time');
      actionPill.textContent = 'CHECK-OUT (OUT-TIME RECORDED)';
    } else if (action === 'already_completed') {
      actionPill.classList.add('already-completed');
      actionPill.textContent = 'SHIFT ALREADY COMPLETED';
    }
  }

  if (avatar) avatar.src = trainer.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';
  if (name) name.textContent = trainer.full_name || 'Master Coach';
  if (meta) meta.textContent = `${trainer.trainer_code || ''} • ${trainer.specialization || 'Fitness Specialist'}`;
  if (inTime) inTime.textContent = data.in_time || '—';
  if (outTime) outTime.textContent = data.out_time || '—';
  if (totalHours) {
    totalHours.textContent = data.total_hours !== null && data.total_hours !== undefined ? `${data.total_hours} hrs` : (action === 'check_in' ? 'Tracking' : '—');
  }
  if (statusMsg) {
    statusMsg.innerHTML = `<i data-lucide="check-circle" style="width:14px; height:14px; display:inline;"></i> ${
      action === 'check_in' ? 'Shift started. In-time verified and stored.' :
      action === 'check_out' ? `Shift ended. Total duration logged: ${data.total_hours} hrs.` :
      'Shift was completed earlier today.'
    }`;
    UI.refreshIcons();
  }

  card.style.display = 'block';

  // Clear previous timer and auto-hide after 10 seconds
  if (hudDismissTimer) clearTimeout(hudDismissTimer);
  hudDismissTimer = setTimeout(() => {
    hideTrainerHud();
  }, 10000);
}

function hideTrainerHud() {
  const card = document.getElementById('trainer-scan-hud-card');
  if (card) card.style.display = 'none';
  if (hudDismissTimer) {
    clearTimeout(hudDismissTimer);
    hudDismissTimer = null;
  }
}

// --------------------------------------------------------------------------
// CAMERA SCANNER ENGINE (Html5Qrcode)
// --------------------------------------------------------------------------

async function toggleCameraScanner() {
  if (AdminState.isTrainerScanning) {
    stopCameraScanner();
  } else {
    startCameraScanner();
  }
}

async function startCameraScanner() {
  const readerEl = document.getElementById('trainer-qr-reader');
  const toggleBtn = document.getElementById('btn-toggle-camera');
  const viewportBox = document.querySelector('.scanner-viewport-box');
  const idlePrompt = document.getElementById('scanner-idle-prompt');
  const statusPill = document.getElementById('camera-status-pill');

  if (!window.Html5Qrcode) {
    UI.showToast('HTML5 QR Scanner engine not loaded. Please verify internet connectivity.', 'warning');
    return;
  }

  try {
    if (!AdminState.trainerScanner) {
      AdminState.trainerScanner = new Html5Qrcode('trainer-qr-reader');
    }

    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

    await AdminState.trainerScanner.start(
      { facingMode: 'user' },
      config,
      (decodedText) => {
        // Scanned QR code successfully
        processTrainerScan(decodedText);
      },
      (errorMessage) => {
        // Continuous scan tick, ignore parse noise
      }
    );

    AdminState.isTrainerScanning = true;
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i data-lucide="camera-off" style="width: 14px; height: 14px;"></i> Stop Camera';
      toggleBtn.classList.remove('btn-outline');
      toggleBtn.classList.add('btn-secondary');
    }
    if (viewportBox) viewportBox.classList.add('scanning');
    if (idlePrompt) idlePrompt.style.display = 'none';
    if (statusPill) statusPill.innerHTML = '<span class="status-pulse-dot"></span> Camera Active — Hold Trainer QR in viewfinder';
    UI.refreshIcons();
    UI.showToast('Optical camera scanner activated', 'info');
  } catch (err) {
    console.warn('Webcam start failed or permission denied:', err);
    AdminState.isTrainerScanning = false;
    UI.showToast('Camera access denied or unavailable. Use the 1-Click Simulation Badges or enter Code below.', 'warning', 'Camera Notice');
    if (viewportBox) viewportBox.classList.remove('scanning');
    if (idlePrompt) idlePrompt.style.display = 'flex';
  }
}

async function stopCameraScanner() {
  if (AdminState.trainerScanner && AdminState.isTrainerScanning) {
    try {
      await AdminState.trainerScanner.stop();
    } catch (e) {
      console.warn('Error stopping camera:', e);
    }
  }

  AdminState.isTrainerScanning = false;
  const toggleBtn = document.getElementById('btn-toggle-camera');
  const viewportBox = document.querySelector('.scanner-viewport-box');
  const idlePrompt = document.getElementById('scanner-idle-prompt');
  const statusPill = document.getElementById('camera-status-pill');

  if (toggleBtn) {
    toggleBtn.innerHTML = '<i data-lucide="camera" style="width: 14px; height: 14px;"></i> Start Camera';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-outline');
  }
  if (viewportBox) viewportBox.classList.remove('scanning');
  if (idlePrompt) idlePrompt.style.display = 'flex';
  if (statusPill) statusPill.innerHTML = '<i data-lucide="info" style="width: 13px; height: 13px;"></i> Scans QR badges automatically when presented';
  UI.refreshIcons();
}

// --------------------------------------------------------------------------
// TRAINER DIGITAL IDENTITY QR BADGES
// --------------------------------------------------------------------------

async function openTrainerBadgesModal() {
  UI.openModal('modal-trainer-badges');
  const grid = document.getElementById('trainer-badges-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">Loading verified trainer badges...</div>';

  const res = await apiFetch('/trainers/badges');
  if (res && res.success && res.data) {
    const badges = res.data;
    if (badges.length === 0) {
      grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">No trainers registered. Add trainers to generate badges.</div>';
      return;
    }

    grid.innerHTML = badges.map((b, idx) => `
      <div class="trainer-digital-badge" id="badge-card-${idx}">
        <div class="badge-brand-mark">APEX &bull; MASTER CREDENTIAL</div>
        <img src="${b.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'}" class="badge-trainer-photo" alt="${b.full_name}">
        <div class="badge-trainer-fullname">${b.full_name}</div>
        <div class="badge-trainer-specialty">${b.specialization || 'Fitness Professional'}</div>
        <div class="badge-qr-container" id="qr-target-${idx}"></div>
        <div class="badge-code-label">${b.trainer_code}</div>
        <div style="margin-top: 10px; font-size: 0.72rem; color: var(--text-muted); font-mono;">${b.email || ''}</div>
      </div>
    `).join('');

    // Generate crisp QR code inside each container using QRCode library
    setTimeout(() => {
      badges.forEach((b, idx) => {
        const qrEl = document.getElementById(`qr-target-${idx}`);
        if (qrEl && window.QRCode) {
          qrEl.innerHTML = '';
          new QRCode(qrEl, {
            text: b.qr_payload || `APEX:TRAINER:${b.trainer_code}`,
            width: 128,
            height: 128,
            colorDark: '#090B0A',
            colorLight: '#FFFFFF',
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      });
    }, 50);

    UI.refreshIcons();
  } else {
    grid.innerHTML = '<div class="text-center text-muted" style="padding: 30px;">Failed to load badges.</div>';
  }
}

function printTrainerBadges() {
  window.print();
}

/* ==========================================================================
   ROLE PERMISSIONS MATRIX CONTROLLER
   ========================================================================== */
const PermissionsModule = {
  definitions: [],
  matrix: { staff: [], trainer: [], member: [] },
  pendingChanges: { staff: {}, trainer: {}, member: {} },

  async load() {
    const tbody = document.getElementById('permissions-matrix-tbody');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted" style="padding: 40px;">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          Loading permissions matrix...
        </td>
      </tr>
    `;

    try {
      const res = await apiFetch('/auth/permissions');
      if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 30px;">Failed to load permissions: ${res.message}</td></tr>`;
        return;
      }

      this.definitions = res.data.definitions || [];
      this.matrix = res.data.matrix || { staff: [], trainer: [], member: [] };
      this.pendingChanges = { staff: {}, trainer: {}, member: {} };
      this.render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding: 30px;">Error loading permissions: ${err.message}</td></tr>`;
    }
  },

  render() {
    const tbody = document.getElementById('permissions-matrix-tbody');
    if (!tbody) return;

    // Group definitions by category
    const grouped = {};
    this.definitions.forEach(perm => {
      const cat = perm.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(perm);
    });

    let html = '';
    const user = Auth.getUser();
    const isAdmin = user && user.role === 'admin';

    for (const [category, perms] of Object.entries(grouped)) {
      html += `
        <tr class="perm-category-header">
          <td colspan="5" style="padding: 10px 18px;">
            <i data-lucide="layers" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i>
            ${category}
          </td>
        </tr>
      `;

      perms.forEach(p => {
        const staffChecked = this.isGranted('staff', p.key);
        const trainerChecked = this.isGranted('trainer', p.key);
        const memberChecked = this.isGranted('member', p.key);
        const disabledAttr = isAdmin ? '' : 'disabled';

        html += `
          <tr style="border-bottom: 1px solid var(--border-subtle);">
            <td style="padding: 14px 18px;">
              <div style="font-weight: 600; color: #FFF; font-size: 0.9rem;">
                ${p.name}
                <span class="perm-key-badge">${p.key}</span>
              </div>
              <div class="perm-desc">${p.desc || ''}</div>
            </td>

            <!-- Admin (Always Full Superuser) -->
            <td style="text-align: center; vertical-align: middle; padding: 12px;">
              <div class="perm-locked-cell" title="Root Admin privileges are permanently active">
                <i data-lucide="check-circle-2" style="width: 18px; height: 18px; color: var(--accent-primary);"></i>
                <span style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-secondary);">ROOT</span>
              </div>
            </td>

            <!-- Staff -->
            <td style="text-align: center; vertical-align: middle; padding: 12px;">
              <label class="perm-switch" title="Staff permission toggle">
                <input type="checkbox" ${staffChecked ? 'checked' : ''} ${disabledAttr}
                  onchange="PermissionsModule.toggle('staff', '${p.key}', this.checked)"
                  data-role="staff" data-key="${p.key}">
                <span class="perm-slider"></span>
              </label>
            </td>

            <!-- Trainer -->
            <td style="text-align: center; vertical-align: middle; padding: 12px;">
              <label class="perm-switch" title="Trainer permission toggle">
                <input type="checkbox" ${trainerChecked ? 'checked' : ''} ${disabledAttr}
                  onchange="PermissionsModule.toggle('trainer', '${p.key}', this.checked)"
                  data-role="trainer" data-key="${p.key}">
                <span class="perm-slider"></span>
              </label>
            </td>

            <!-- Member -->
            <td style="text-align: center; vertical-align: middle; padding: 12px;">
              <label class="perm-switch" title="Member permission toggle">
                <input type="checkbox" ${memberChecked ? 'checked' : ''} ${disabledAttr}
                  onchange="PermissionsModule.toggle('member', '${p.key}', this.checked)"
                  data-role="member" data-key="${p.key}">
                <span class="perm-slider"></span>
              </label>
            </td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = html;
    UI.refreshIcons();
  },

  isGranted(role, key) {
    if (this.pendingChanges[role] && this.pendingChanges[role][key] !== undefined) {
      return this.pendingChanges[role][key];
    }
    const currentList = this.matrix[role] || [];
    return currentList.includes(key);
  },

  toggle(role, key, isGranted) {
    if (!this.pendingChanges[role]) this.pendingChanges[role] = {};
    this.pendingChanges[role][key] = isGranted;
  },

  async saveChanges() {
    const user = Auth.getUser();
    if (!user || user.role !== 'admin') {
      UI.showToast('Only administrators can update the permissions matrix', 'error');
      return;
    }

    const updates = [];
    for (const role of ['staff', 'trainer', 'member']) {
      const roleChanges = this.pendingChanges[role] || {};
      for (const [key, isGranted] of Object.entries(roleChanges)) {
        updates.push({ role, permission_key: key, is_granted: isGranted });
      }
    }

    if (updates.length === 0) {
      UI.showToast('No permission changes have been made.', 'info');
      return;
    }

    const btn = document.getElementById('btn-save-permissions');
    if (btn) btn.disabled = true;

    try {
      const res = await apiFetch('/auth/permissions', {
        method: 'PUT',
        body: JSON.stringify({ updates })
      });

      if (res.success) {
        UI.showToast(`Permissions updated: ${res.data.updated_count} policy rules saved.`, 'success');
        await this.load();
      } else {
        UI.showToast(res.message || 'Failed to update permissions', 'error');
      }
    } catch (err) {
      UI.showToast(`Error saving matrix: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async resetToDefaults() {
    const user = Auth.getUser();
    if (!user || user.role !== 'admin') {
      UI.showToast('Only administrators can reset permissions', 'error');
      return;
    }

    const confirmed = await UI.confirm(
      'Reset Permissions',
      'Reset Staff, Trainer, and Member access permissions back to system defaults?',
      'Reset Defaults',
      true
    );
    if (!confirmed) return;

    const defaultStaff = [
      "members:view", "members:create", "members:edit",
      "attendance:view", "attendance:checkin", "attendance:checkout", "attendance:edit", "badges:view",
      "trainers:view", "trainer_attendance:manage",
      "plans:view", "payments:view", "payments:create",
      "workouts:view", "diets:view"
    ];
    const defaultTrainer = [
      "members:view", "attendance:view", "attendance:checkin", "attendance:checkout", "badges:view",
      "trainers:view", "trainer_attendance:manage",
      "plans:view", "workouts:view", "workouts:manage",
      "diets:view", "diets:manage"
    ];
    const defaultMember = [];

    const updates = [];
    this.definitions.forEach(p => {
      updates.push({ role: 'staff', permission_key: p.key, is_granted: defaultStaff.includes(p.key) });
      updates.push({ role: 'trainer', permission_key: p.key, is_granted: defaultTrainer.includes(p.key) });
      updates.push({ role: 'member', permission_key: p.key, is_granted: defaultMember.includes(p.key) });
    });

    try {
      const res = await apiFetch('/auth/permissions', {
        method: 'PUT',
        body: JSON.stringify({ updates })
      });
      if (res.success) {
        UI.showToast('Role permissions matrix restored to defaults.', 'success');
        await this.load();
      } else {
        UI.showToast(res.message || 'Reset failed', 'error');
      }
    } catch (err) {
      UI.showToast(`Reset error: ${err.message}`, 'error');
    }
  }
};


/**
 * MFI Management & Agreement Management System
 * Production Frontend Application Core & Router
 */

// ==========================================
// 1. GLOBAL STATE & UI UTILITIES
// ==========================================
const AppState = {
  currentUser: null,
  currentRoute: null,
  charts: {},
  cachedMfis: []
};

const UI = {
  toast(type = 'success', title = 'Success', message = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (message && (
      message.toLowerCase().includes('forbidden') ||
      message.toLowerCase().includes('permission') ||
      message.toLowerCase().includes('privilege') ||
      message.toLowerCase().includes('not possess') ||
      message.toLowerCase().includes('access denied') ||
      message.toLowerCase().includes('unexpected token')
    )) {
      message = 'You are not a privileged user to perform this action.';
      if (type === 'danger') title = 'Access Denied';
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'danger') {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  showToast(message, type = 'info') {
    const toastType = type === 'error' ? 'danger' : type;
    const title = toastType === 'danger' ? 'Error' : (toastType === 'success' ? 'Success' : 'Notification');
    UI.toast(toastType, title, message);
  },

  confirm(message, onConfirm, { title = 'Please Confirm Action', confirmText = 'Confirm', isDanger = false } = {}) {
    const modal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('global-modal-title');
    const modalBody = document.getElementById('global-modal-body');
    const modalFooter = document.getElementById('global-modal-footer');
    const modalDialog = document.getElementById('global-modal-dialog');

    modalDialog.className = 'modal-dialog modal-sm';
    modalTitle.textContent = title;
    modalBody.innerHTML = `
      <div style="font-size: 14px; color: #334155; line-height: 1.6;">${message}</div>
    `;

    modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
    `;

    document.getElementById('modal-confirm-btn').onclick = () => {
      UI.closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };

    modal.classList.add('show');
  },

  showModal({ title, bodyHtml, footerHtml = '', size = '' }) {
    const modal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('global-modal-title');
    const modalBody = document.getElementById('global-modal-body');
    const modalFooter = document.getElementById('global-modal-footer');
    const modalDialog = document.getElementById('global-modal-dialog');

    modalDialog.className = `modal-dialog ${size ? 'modal-' + size : ''}`;
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalFooter.innerHTML = footerHtml || '<button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>';

    modal.classList.add('show');
  },

  closeModal() {
    const modal = document.getElementById('global-modal');
    if (modal) modal.classList.remove('show');
  },

  formatCurrency(val) {
    const num = parseFloat(val || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  async parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    let data = {};
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
    } else {
      const text = await res.text();
      data = { message: text };
    }

    if (!res.ok) {
      if (res.status === 403 || (data && data.message && (
        data.message.toLowerCase().includes('forbidden') ||
        data.message.toLowerCase().includes('permission') ||
        data.message.toLowerCase().includes('privilege') ||
        data.message.toLowerCase().includes('not possess') ||
        data.message.toLowerCase().includes('access denied')
      ))) {
        throw new Error('You are not a privileged user to perform this action.');
      }
      if (res.status === 401) {
        throw new Error('Authentication required. Please sign in to continue.');
      }
      const msg = (data && data.message && !data.message.includes('<!DOCTYPE')) ? data.message : `Request failed with status ${res.status}`;
      throw new Error(msg);
    }

    return data;
  },

  formatDate(val) {
    if (!val) return 'N/A';
    if (val instanceof Date) {
      return !isNaN(val.getTime()) ? val.toISOString().split('T')[0] : 'N/A';
    }
    if (typeof val === 'number' || (/^\d+$/.test(String(val).trim()) && String(val).trim().length >= 10)) {
      const num = Number(val);
      const d = new Date(num > 1e11 ? num : num * 1000);
      return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(val);
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return str;
  },

  formatDateForInput(val) {
    if (!val || val === 'N/A') return '';
    const formatted = UI.formatDate(val);
    return formatted === 'N/A' ? '' : formatted;
  },

  formatDateTime(val) {
    if (!val) return 'N/A';
    if (typeof val === 'object' && !(val instanceof Date)) {
      return 'N/A';
    }
    let d;
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'number' || (/^\d+$/.test(String(val).trim()) && String(val).trim().length >= 10)) {
      const num = Number(val);
      d = new Date(num > 1e11 ? num : num * 1000);
    } else {
      const str = String(val).trim();
      d = new Date(str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str);
      if (isNaN(d.getTime())) {
        d = new Date(str);
      }
    }
    if (isNaN(d.getTime())) return typeof val === 'string' ? val : 'N/A';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  can(permission) {
    if (!AppState.currentUser) return false;
    if (AppState.currentUser.role === 'Super Admin' || AppState.currentUser.role_id === 1) return true;
    return Array.isArray(AppState.currentUser.permissions) && AppState.currentUser.permissions.includes(permission);
  },

  createPaginationHTML(pagination, onPageClick) {
    if (!pagination) return '';
    return UI.renderPagination(pagination, onPageClick);
  },

  renderPagination({ total, page, limit, totalPages }, onPageClick) {
    if (totalPages <= 1) {
      return `<div class="pagination-wrapper"><div class="pagination-info">Showing ${total} records</div></div>`;
    }

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    let pagesHtml = '';
    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      pagesHtml += `
        <button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}" onclick="${onPageClick}(${p})">${p}</button>
      `;
    }

    return `
      <div class="pagination-wrapper">
        <div class="pagination-info">Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${total}</strong> records</div>
        <div class="pagination-controls">
          <button class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled' : ''} onclick="${onPageClick}(${page - 1})">Prev</button>
          ${pagesHtml}
          <button class="btn btn-sm btn-secondary" ${page >= totalPages ? 'disabled' : ''} onclick="${onPageClick}(${page + 1})">Next</button>
        </div>
      </div>
    `;
  },

  destroyCharts() {
    Object.keys(AppState.charts).forEach(key => {
      if (AppState.charts[key]) {
        AppState.charts[key].destroy();
      }
    });
    AppState.charts = {};
  }
};

// ==========================================
// 2. CLIENT ROUTER & DISPATCHER
// ==========================================
class Router {
  static init() {
    // Intercept internal link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('/') && !link.getAttribute('target') && !link.getAttribute('download')) {
        const href = link.getAttribute('href');
        // Ignore api links
        if (!href.startsWith('/api/')) {
          e.preventDefault();
          Router.navigate(href);
        }
      }
    });

    window.addEventListener('popstate', () => {
      Router.resolve(window.location.pathname);
    });

    // Mobile nav toggle
    const toggleBtn = document.getElementById('mobile-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        UI.confirm('Are you sure you want to sign out?', async () => {
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          } catch (err) {
            window.location.href = '/login';
          }
        }, { title: 'Sign Out Confirmation' });
      });
    }

    // Clock
    setInterval(() => {
      const el = document.getElementById('header-datetime');
      if (el) el.textContent = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    }, 1000);

    // Initial resolve
    Router.resolve(window.location.pathname);
  }

  static navigate(path) {
    window.history.pushState({}, '', path);
    Router.resolve(path);
  }

  static async resolve(path) {
    UI.destroyCharts();

    // Close mobile nav
    document.getElementById('sidebar')?.classList.remove('open');

    // Update active nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      const route = item.getAttribute('data-route');
      if (route === path || (route !== '/dashboard' && path.startsWith(route))) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Fetch user if not loaded
    if (!AppState.currentUser) {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        AppState.currentUser = data.user;

        document.getElementById('sidebar-user-name').textContent = data.user.name;
        document.getElementById('sidebar-user-role').textContent = data.user.role;
        document.getElementById('sidebar-user-avatar').textContent = data.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      } catch (err) {
        window.location.href = '/login';
        return;
      }
    }

    AppState.currentRoute = path;
    const viewport = document.getElementById('main-viewport');
    viewport.innerHTML = '<div style="text-align: center; padding: 60px;"><div style="display:inline-block; width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#1a56db; border-radius:50%; animation:spin 0.8s linear infinite;"></div><div style="margin-top:12px; color:#64748b; font-size:13px;">Loading module...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    // Route matching
    try {
      if (path === '/' || path === '/dashboard') {
        Router.updateBreadcrumbs(['Home', 'Dashboard']);
        await DashboardView.render(viewport);
      } else if (path === '/teams') {
        Router.updateBreadcrumbs(['Home', 'Team Management', 'Team List']);
        await TeamListView.render(viewport);
      } else if (path === '/teams/create') {
        Router.updateBreadcrumbs(['Home', 'Team Management', 'Add Team']);
        await TeamListView.render(viewport);
        TeamListView.openModal();
      } else if (path.startsWith('/teams/') && path.endsWith('/edit')) {
        const id = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'Team Management', `Edit Team #${id}`]);
        await TeamListView.render(viewport);
        TeamListView.openModal(id);
      } else if (path === '/team-members') {
        Router.updateBreadcrumbs(['Home', 'Team Management', 'Team Member List']);
        await TeamMemberListView.render(viewport);
      } else if (path === '/team-members/create') {
        Router.updateBreadcrumbs(['Home', 'Team Management', 'Add Team Member']);
        await TeamMemberListView.render(viewport);
        TeamMemberListView.openModal();
      } else if (path.startsWith('/team-members/') && path.endsWith('/edit')) {
        const id = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'Team Management', `Edit Member #${id}`]);
        await TeamMemberListView.render(viewport);
        TeamMemberListView.openModal(id);
      } else if (path === '/mfi') {
        Router.updateBreadcrumbs(['Home', 'MFI Management', 'MFI List']);
        await MfiListView.render(viewport);
      } else if (path === '/mfi/create') {
        Router.updateBreadcrumbs(['Home', 'MFI Management', 'Add MFI']);
        await MfiFormView.render(viewport);
      } else if (path.startsWith('/mfi/') && path.endsWith('/edit')) {
        const id = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'MFI Management', `Edit MFI #${id}`]);
        await MfiFormView.render(viewport, id);
      } else if (path.startsWith('/mfi/')) {
        const id = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'MFI Management', 'MFI Profile']);
        await MfiProfileView.render(viewport, id);
      } else if (path === '/branches') {
        Router.updateBreadcrumbs(['Home', 'Branch Management', 'Branch List']);
        await BranchListView.render(viewport);
      } else if (path === '/branches/create') {
        Router.updateBreadcrumbs(['Home', 'Branch Management', 'Add Branch']);
        await BranchFormView.render(viewport);
      } else if (path.startsWith('/branches/') && path.endsWith('/edit')) {
        const id = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'Branch Management', `Edit Branch #${id}`]);
        await BranchFormView.render(viewport, id);
      } else if (path === '/agreements') {
        Router.updateBreadcrumbs(['Home', 'Agreement Management', 'Agreement / Renewal List']);
        await AgreementListView.render(viewport);
      } else if (path === '/agreements/create') {
        Router.updateBreadcrumbs(['Home', 'Agreement Management', 'Add Renewal']);
        await AgreementFormView.render(viewport);
      } else if (path === '/users') {
        Router.updateBreadcrumbs(['Home', 'Administration', 'User Management']);
        await UsersView.render(viewport);
      } else if (path === '/roles') {
        Router.updateBreadcrumbs(['Home', 'Administration', 'Roles & Permissions']);
        await RolesView.render(viewport);
      } else if (path === '/audit-logs') {
        Router.updateBreadcrumbs(['Home', 'Administration', 'User Audit Trail']);
        await AuditLogsView.render(viewport);
      } else if (path === '/migration') {
        Router.updateBreadcrumbs(['Home', 'Administration', 'Data Migration']);
        await MigrationView.render(viewport);
      } else if (path.startsWith('/reports/')) {
        const repType = path.split('/')[2];
        Router.updateBreadcrumbs(['Home', 'Reports', repType.replace('-', ' ').toUpperCase()]);
        await ReportsView.render(viewport, repType);
      } else {
        viewport.innerHTML = `
          <div class="empty-state">
            <h2 class="empty-state-title">404 — Page Not Found</h2>
            <p class="empty-state-text">The page you requested does not exist or has been relocated.</p>
            <a href="/dashboard" class="btn btn-primary">Return to Dashboard</a>
          </div>
        `;
      }
    } catch (err) {
      console.error('Route error:', err);
      viewport.innerHTML = `
        <div class="card p-6" style="padding: 24px; border-left: 4px solid var(--danger);">
          <h3 style="color: var(--danger); font-weight: 700; margin-bottom: 6px;">Error Loading Page</h3>
          <p style="color: var(--text-muted); font-size: 13px;">${err.message || 'An unexpected error occurred while rendering the page.'}</p>
          <div style="margin-top: 16px;">
            <button class="btn btn-secondary" onclick="Router.resolve(AppState.currentRoute)">Retry</button>
          </div>
        </div>
      `;
    }
  }

  static updateBreadcrumbs(crumbs) {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    let html = '';
    crumbs.forEach((c, idx) => {
      if (idx === crumbs.length - 1) {
        html += `<span class="current-crumb">${c}</span>`;
      } else {
        html += `<a href="/dashboard">${c}</a> <span>/</span> `;
      }
    });
    container.innerHTML = html;
  }
}

// ==========================================
// 3. DASHBOARD VIEW (7 Charts + 10 Metric Cards)
// ==========================================
// ==========================================
// 3. DASHBOARD VIEW (Interactive Executive Dashboard & Live Sync)
// ==========================================
const DashboardView = {
  pollInterval: null,
  countdownInterval: null,
  secondsRemaining: 30,

  async render(container) {
    if (DashboardView.pollInterval) clearInterval(DashboardView.pollInterval);
    if (DashboardView.countdownInterval) clearInterval(DashboardView.countdownInterval);

    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('Failed to load dashboard data.');
    const { data } = await res.json();

    const { cards, charts, recent_activities, renewal_alerts } = data;

    // Calculate percentage metrics
    const mfiActivePct = cards.total_mfi > 0 ? Math.round((cards.active_mfi / cards.total_mfi) * 100) : 0;
    const branchActivePct = cards.total_branches > 0 ? Math.round((cards.active_branches / cards.total_branches) * 100) : 0;

    container.innerHTML = `
      <!-- Executive Dashboard Live Header & Sync Controls -->
      <div class="dashboard-header-bar">
        <div class="dashboard-title-area">
          <h1 class="page-title">Executive Dashboard</h1>
          <div class="live-pulse-badge">
            <span class="pulse-dot-green"></span>
            <span>Live Sync Active</span>
          </div>
        </div>

        <div class="dashboard-controls">
          <span class="sync-timer-label">Auto-syncing in <strong id="sync-countdown">30</strong>s</span>
          <button class="btn btn-secondary btn-sm" id="dash-refresh-btn" onclick="DashboardView.manualRefresh()" title="Fetch Real-Time Data">
            <svg class="btn-icon-spin" id="dash-refresh-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      <!-- 10 Enhanced Interactive Stat Cards Grid -->
      <div class="stats-grid">
        <!-- 1. Total MFI -->
        <a href="/mfi" class="stat-card-enhanced stat-card-blue">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M11 11h2M11 15h2M16 11h2M16 15h2M2 7l10-4 10 4"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-up">Total Registered</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-total-mfi">${cards.total_mfi}</div>
            <div class="stat-title-main">Total MFIs</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 100%; background: #2563eb;"></div>
          </div>
        </a>

        <!-- 2. Active MFI -->
        <a href="/mfi?status=active" class="stat-card-enhanced stat-card-green">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-up">${mfiActivePct}% Active</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-active-mfi">${cards.active_mfi}</div>
            <div class="stat-title-main">Active MFIs</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: ${mfiActivePct}%; background: #10b981;"></div>
          </div>
        </a>

        <!-- 3. Inactive MFI -->
        <a href="/mfi?status=inactive" class="stat-card-enhanced stat-card-red">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-neutral">${100 - mfiActivePct}% Inactive</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-inactive-mfi">${cards.inactive_mfi}</div>
            <div class="stat-title-main">Inactive MFIs</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: ${100 - mfiActivePct}%; background: #ef4444;"></div>
          </div>
        </a>

        <!-- 4. Total Branches -->
        <a href="/branches" class="stat-card-enhanced stat-card-purple">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-up">Network Total</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-total-branches">${cards.total_branches}</div>
            <div class="stat-title-main">Total Branches</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 100%; background: #8b5cf6;"></div>
          </div>
        </a>

        <!-- 5. Active Branches -->
        <a href="/branches?status=active" class="stat-card-enhanced stat-card-green">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-up">${branchActivePct}% Operational</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-active-branches">${cards.active_branches}</div>
            <div class="stat-title-main">Active Branches</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: ${branchActivePct}%; background: #10b981;"></div>
          </div>
        </a>

        <!-- 6. Inactive Branches -->
        <a href="/branches?status=inactive" class="stat-card-enhanced stat-card-red">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-neutral">${100 - branchActivePct}% Suspended</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-inactive-branches">${cards.inactive_branches}</div>
            <div class="stat-title-main">Inactive Branches</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: ${100 - branchActivePct}%; background: #ef4444;"></div>
          </div>
        </a>

        <!-- 7. Branch Offices -->
        <a href="/branches?branch_type=Branch Office" class="stat-card-enhanced stat-card-cyan">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-cyan">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-neutral">Field Units</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-branch-offices">${cards.branch_offices}</div>
            <div class="stat-title-main">Branch Offices</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 75%; background: #06b6d4;"></div>
          </div>
        </a>

        <!-- 8. Area Offices -->
        <a href="/branches?branch_type=Area Office" class="stat-card-enhanced stat-card-amber">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-neutral">Regional Hubs</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-area-offices">${cards.area_offices}</div>
            <div class="stat-title-main">Area Offices</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 55%; background: #f59e0b;"></div>
          </div>
        </a>

        <!-- 9. Zone Offices -->
        <a href="/branches?branch_type=Zone Office" class="stat-card-enhanced stat-card-purple">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-neutral">Zone HQ</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-zone-offices">${cards.zone_offices}</div>
            <div class="stat-title-main">Zone Offices</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 40%; background: #8b5cf6;"></div>
          </div>
        </a>

        <!-- 10. Renewal Alerts -->
        <a href="/reports/renewal-due" class="stat-card-enhanced stat-card-amber">
          <div class="stat-card-top">
            <div class="stat-icon-box stat-icon-gradient-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            </div>
            <span class="stat-trend-badge trend-badge-warn">${cards.expiring_soon} Action Required</span>
          </div>
          <div>
            <div class="stat-number-main" id="card-expiring-soon">${cards.expiring_soon}</div>
            <div class="stat-title-main">Renewal Alerts</div>
          </div>
          <div class="progress-mini-bar">
            <div class="progress-mini-fill" style="width: 90%; background: #f59e0b;"></div>
          </div>
        </a>
      </div>

      <!-- Charts Grid Row 1: Status Distributions -->
      <div class="charts-grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. MFI Operational Status Distribution</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-mfi-status"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">2. Branch Operational Status Distribution</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-branch-status"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Grid Row 2: Branch Types & MFI Branch Count -->
      <div class="charts-grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">3. Branch Type Distribution Breakdown</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-branch-types"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">4. MFI-wise Branch Allocation</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-mfi-branches"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Grid Row 3: Renewal Trend Line -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">5. Agreement Renewal & Average Rate Trend (By Year)</h3>
        </div>
        <div class="card-body">
          <div class="chart-container" style="position: relative; height: 280px;">
            <canvas id="chart-renewal-trend"></canvas>
          </div>
        </div>
      </div>

      <!-- Charts Grid Row 4: Fee Comparison Bars -->
      <div class="charts-grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">6. MFI-wise License Fee per Branch</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-license-fees"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">7. MFI-wise O&M Fee per Branch</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="position: relative; height: 260px;">
              <canvas id="chart-om-fees"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-Time Activity Feed & Quick Actions Row -->
      <div class="charts-grid-2">
        <!-- Live Audit Activity Feed Widget -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Live System Audit Activity</h3>
            <a href="/audit-logs" class="btn btn-sm btn-secondary">View Full Log</a>
          </div>
          <div class="card-body" id="dash-activity-list">
            ${DashboardView.renderActivitiesHTML(recent_activities)}
          </div>
        </div>

        <!-- System Quick Action Shortcuts -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quick Action Shortcuts</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <a href="/mfi/create" class="btn btn-primary" style="justify-content: center; padding: 14px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span>Add New MFI</span>
              </a>
              <a href="/branches/create" class="btn btn-secondary" style="justify-content: center; padding: 14px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span>Add Branch</span>
              </a>
              <a href="/agreements/create" class="btn btn-secondary" style="justify-content: center; padding: 14px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Add Agreement</span>
              </a>
              <a href="/migration" class="btn btn-secondary" style="justify-content: center; padding: 14px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Data Migration</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Chart.js instances with rich gradient fills
    DashboardView.initCharts(charts);

    // Setup live polling timer (every 30s)
    DashboardView.secondsRemaining = 30;
    DashboardView.countdownInterval = setInterval(() => {
      if (AppState.currentRoute !== '/dashboard') {
        clearInterval(DashboardView.countdownInterval);
        if (DashboardView.pollInterval) clearInterval(DashboardView.pollInterval);
        return;
      }
      DashboardView.secondsRemaining--;
      const el = document.getElementById('sync-countdown');
      if (el) el.textContent = DashboardView.secondsRemaining;
      if (DashboardView.secondsRemaining <= 0) {
        DashboardView.secondsRemaining = 30;
        DashboardView.manualRefresh(true);
      }
    }, 1000);
  },

  renderActivitiesHTML(activities) {
    if (!activities || activities.length === 0) {
      return `<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">No recent audit activity.</div>`;
    }
    return activities.map(act => {
      const userInitial = (act.user_name || 'System').substring(0, 2).toUpperCase();
      return `
        <div class="widget-feed-item">
          <div class="feed-avatar">${userInitial}</div>
          <div class="feed-content">
            <div class="feed-title">${act.description || act.action}</div>
            <div class="feed-meta">By <strong>${act.user_name || 'System'}</strong> • ${act.created_at_formatted || 'Recently'}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  async manualRefresh(isSilent = false) {
    const icon = document.getElementById('dash-refresh-icon');
    if (icon) icon.classList.add('spin-active');

    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) return;
      const { data } = await res.json();
      const { cards, charts, recent_activities } = data;

      // Update Card values smoothly
      const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      updateEl('card-total-mfi', cards.total_mfi);
      updateEl('card-active-mfi', cards.active_mfi);
      updateEl('card-inactive-mfi', cards.inactive_mfi);
      updateEl('card-total-branches', cards.total_branches);
      updateEl('card-active-branches', cards.active_branches);
      updateEl('card-inactive-branches', cards.inactive_branches);
      updateEl('card-branch-offices', cards.branch_offices);
      updateEl('card-area-offices', cards.area_offices);
      updateEl('card-zone-offices', cards.zone_offices);
      updateEl('card-expiring-soon', cards.expiring_soon);

      // Update Audit feed
      const activityEl = document.getElementById('dash-activity-list');
      if (activityEl) activityEl.innerHTML = DashboardView.renderActivitiesHTML(recent_activities);

      // Update Chart datasets
      if (AppState.charts.mfiStatus) {
        AppState.charts.mfiStatus.data.datasets[0].data = charts.mfi_status.data;
        AppState.charts.mfiStatus.update();
      }
      if (AppState.charts.branchStatus) {
        AppState.charts.branchStatus.data.datasets[0].data = charts.branch_status.data;
        AppState.charts.branchStatus.update();
      }
      if (AppState.charts.branchTypes) {
        AppState.charts.branchTypes.data.datasets[0].data = charts.branch_types.data;
        AppState.charts.branchTypes.update();
      }
      if (AppState.charts.mfiBranches) {
        AppState.charts.mfiBranches.data.labels = charts.mfi_branch_counts.labels;
        AppState.charts.mfiBranches.data.datasets[0].data = charts.mfi_branch_counts.data;
        AppState.charts.mfiBranches.update();
      }
      if (AppState.charts.renewalTrend) {
        AppState.charts.renewalTrend.data.labels = charts.renewal_trend.labels;
        AppState.charts.renewalTrend.data.datasets[0].data = charts.renewal_trend.data;
        AppState.charts.renewalTrend.data.datasets[1].data = charts.renewal_trend.avg_license;
        AppState.charts.renewalTrend.update();
      }
      if (AppState.charts.licenseFees) {
        AppState.charts.licenseFees.data.labels = charts.mfi_fees.labels;
        AppState.charts.licenseFees.data.datasets[0].data = charts.mfi_fees.license_fees;
        AppState.charts.licenseFees.update();
      }
      if (AppState.charts.omFees) {
        AppState.charts.omFees.data.labels = charts.mfi_fees.labels;
        AppState.charts.omFees.data.datasets[0].data = charts.mfi_fees.om_fees;
        AppState.charts.omFees.update();
      }

      if (!isSilent) UI.showToast('Dashboard metrics updated in real-time!', 'success');
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setTimeout(() => {
        if (icon) icon.classList.remove('spin-active');
      }, 600);
    }
  },

  initCharts(charts) {
    // 1. MFI Active vs Inactive (Doughnut with cutout & vibrant colors)
    const ctx1 = document.getElementById('chart-mfi-status')?.getContext('2d');
    if (ctx1) {
      AppState.charts.mfiStatus = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: charts.mfi_status.labels,
          datasets: [{
            data: charts.mfi_status.data,
            backgroundColor: ['#10b981', '#ef4444'],
            hoverBackgroundColor: ['#059669', '#dc2626'],
            borderWidth: 3,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', weight: '600' } } }
          }
        }
      });
    }

    // 2. Branch Active vs Inactive (Doughnut)
    const ctx2 = document.getElementById('chart-branch-status')?.getContext('2d');
    if (ctx2) {
      AppState.charts.branchStatus = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: charts.branch_status.labels,
          datasets: [{
            data: charts.branch_status.data,
            backgroundColor: ['#10b981', '#ef4444'],
            hoverBackgroundColor: ['#059669', '#dc2626'],
            borderWidth: 3,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', weight: '600' } } }
          }
        }
      });
    }

    // 3. Branch Type Distribution (Polar Area / Doughnut)
    const ctx3 = document.getElementById('chart-branch-types')?.getContext('2d');
    if (ctx3) {
      AppState.charts.branchTypes = new Chart(ctx3, {
        type: 'polarArea',
        data: {
          labels: charts.branch_types.labels,
          datasets: [{
            data: charts.branch_types.data,
            backgroundColor: ['rgba(6, 182, 212, 0.75)', 'rgba(245, 158, 11, 0.75)', 'rgba(139, 92, 246, 0.75)'],
            borderColor: ['#06b6d4', '#f59e0b', '#8b5cf6'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', weight: '600' } } }
          }
        }
      });
    }

    // 4. MFI Branch Count (Bar Chart with Canvas Linear Gradient)
    const ctx4 = document.getElementById('chart-mfi-branches')?.getContext('2d');
    if (ctx4) {
      const grad4 = ctx4.createLinearGradient(0, 0, 0, 260);
      grad4.addColorStop(0, '#3b82f6');
      grad4.addColorStop(1, '#1d4ed8');

      AppState.charts.mfiBranches = new Chart(ctx4, {
        type: 'bar',
        data: {
          labels: charts.mfi_branch_counts.labels,
          datasets: [{
            label: 'Total Branches',
            data: charts.mfi_branch_counts.data,
            backgroundColor: grad4,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
        }
      });
    }

    // 5. Renewal Trend (Smooth Cubic Bezier Area Chart)
    const ctx5 = document.getElementById('chart-renewal-trend')?.getContext('2d');
    if (ctx5) {
      const grad5 = ctx5.createLinearGradient(0, 0, 0, 280);
      grad5.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
      grad5.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

      AppState.charts.renewalTrend = new Chart(ctx5, {
        type: 'line',
        data: {
          labels: charts.renewal_trend.labels,
          datasets: [
            {
              label: 'Renewals Signed',
              data: charts.renewal_trend.data,
              borderColor: '#2563eb',
              backgroundColor: grad5,
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: '#2563eb',
              pointRadius: 4,
              yAxisID: 'y'
            },
            {
              label: 'Avg License Fee per Branch',
              data: charts.renewal_trend.avg_license,
              borderColor: '#10b981',
              borderDash: [5, 5],
              tension: 0.4,
              borderWidth: 2,
              pointRadius: 0,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, font: { family: 'Inter', weight: '600' } } }
          },
          scales: {
            y: { type: 'linear', display: true, position: 'left', beginAtZero: true, grid: { color: '#f1f5f9' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 6. License Fee per MFI (Cyan Gradient Bar)
    const ctx6 = document.getElementById('chart-license-fees')?.getContext('2d');
    if (ctx6) {
      const grad6 = ctx6.createLinearGradient(0, 0, 0, 260);
      grad6.addColorStop(0, '#06b6d4');
      grad6.addColorStop(1, '#0284c7');

      AppState.charts.licenseFees = new Chart(ctx6, {
        type: 'bar',
        data: {
          labels: charts.mfi_fees.labels,
          datasets: [{
            label: 'License Fee per Branch',
            data: charts.mfi_fees.license_fees,
            backgroundColor: grad6,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
        }
      });
    }

    // 7. O&M Fee per MFI (Amber Gradient Bar)
    const ctx7 = document.getElementById('chart-om-fees')?.getContext('2d');
    if (ctx7) {
      const grad7 = ctx7.createLinearGradient(0, 0, 0, 260);
      grad7.addColorStop(0, '#f59e0b');
      grad7.addColorStop(1, '#d97706');

      AppState.charts.omFees = new Chart(ctx7, {
        type: 'bar',
        data: {
          labels: charts.mfi_fees.labels,
          datasets: [{
            label: 'O&M Fee per Branch',
            data: charts.mfi_fees.om_fees,
            backgroundColor: grad7,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
        }
      });
    }
  }
};

// ==========================================
// 3.5. TEAM & TEAM MEMBER MODULE VIEWS
// ==========================================
const TeamListView = {
  state: { page: 1, limit: 10, search: '', status: '' },

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Team Management</h1>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="TeamListView.openModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Team</span>
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="team-search" class="form-control" placeholder="Search by Team Name or Team ID..." value="${TeamListView.state.search}">
          </div>

          <select id="team-status-filter" class="form-select" style="width: 140px;">
            <option value="">All Statuses</option>
            <option value="active" ${TeamListView.state.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${TeamListView.state.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>

          <button class="btn btn-secondary" onclick="TeamListView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="TeamListView.resetFilters()">Reset</button>
        </div>
      </div>

      <!-- Team Data Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>Name of Team</th>
                <th>Team ID</th>
                <th>Team Leader</th>
                <th>Total Members</th>
                <th>Remarks</th>
                <th>Status</th>
                <th style="text-align: right; width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody id="team-table-body">
              <tr><td colspan="8" style="text-align:center; padding: 30px;">Loading teams...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="team-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('team-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') TeamListView.applyFilters();
    });

    await TeamListView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, status } = TeamListView.state;
    const url = `/api/teams?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch teams');

      TeamListView.renderTable(data.data);
      TeamListView.renderPagination(data.pagination);
    } catch (err) {
      UI.toast('danger', 'Error loading teams', err.message);
    }
  },

  renderTable(teams) {
    const tbody = document.getElementById('team-table-body');
    if (!tbody) return;

    if (!teams || teams.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">No teams found</div>
            <div style="font-size: 13px;">Click "Add Team" above to create your first team.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = teams.map(team => `
      <tr>
        <td><strong>${team.sl}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${team.team_name}</div>
        </td>
        <td>
          <span class="badge badge-neutral" style="font-weight: 600; font-family: monospace;">${team.team_code}</span>
        </td>
        <td>
          ${team.leader_name !== '—' ? `<span style="font-weight: 600; color: var(--primary);"><span style="color: #f59e0b;">★</span> ${team.leader_name}</span>` : `<span style="color: var(--text-muted);">Not assigned</span>`}
        </td>
        <td>
          <span class="badge badge-secondary" style="font-size: 12px;">${team.total_members} member${team.total_members === 1 ? '' : 's'}</span>
        </td>
        <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted);">
          ${team.remarks || '—'}
        </td>
        <td>
          <span class="badge ${team.status === 'active' ? 'badge-active' : 'badge-inactive'}">
            ${team.status.toUpperCase()}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn btn-icon btn-secondary btn-sm" title="Edit Team" onclick="TeamListView.openModal(${team.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon btn-secondary btn-sm" title="Toggle Active Status" onclick="TeamListView.toggleStatus(${team.id}, '${team.status === 'active' ? 'inactive' : 'active'}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
            <button class="btn btn-icon btn-danger btn-sm" title="Delete Team" onclick="TeamListView.deleteTeam(${team.id}, '${team.team_name.replace(/'/g, "\\'")}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderPagination(pagination) {
    const box = document.getElementById('team-pagination-box');
    if (!box || !pagination) return;
    box.innerHTML = UI.renderPagination(pagination, 'TeamListView.changePage');
  },

  changePage(p) {
    TeamListView.state.page = p;
    TeamListView.fetchData();
  },

  applyFilters() {
    TeamListView.state.page = 1;
    TeamListView.state.search = document.getElementById('team-search').value;
    TeamListView.state.status = document.getElementById('team-status-filter').value;
    TeamListView.fetchData();
  },

  resetFilters() {
    TeamListView.state.page = 1;
    TeamListView.state.search = '';
    TeamListView.state.status = '';
    document.getElementById('team-search').value = '';
    document.getElementById('team-status-filter').value = '';
    TeamListView.fetchData();
  },

  async openModal(id = null) {
    const isEdit = !!id;
    let team = { team_name: '', team_code: '', remarks: '', status: 'active' };

    if (isEdit) {
      try {
        const res = await fetch(`/api/teams/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load team');
        team = data.data;
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
        return;
      }
    }

    const bodyHtml = `
      <form id="team-entry-form" onsubmit="TeamListView.saveTeam(event, ${id})">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label class="form-label" for="modal_team_name">Name of team <span class="required-star">*</span></label>
            <input type="text" id="modal_team_name" class="form-control" required placeholder="e.g. Implementation Team Alpha" value="${team.team_name}">
            <div class="invalid-feedback" id="err-modal_team_name"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_team_code">Team ID <span class="required-star">*</span></label>
            <input type="text" id="modal_team_code" class="form-control" required placeholder="e.g. TM-001" value="${team.team_code}">
            <div class="form-hint">Unique identifier for the team.</div>
            <div class="invalid-feedback" id="err-modal_team_code"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_team_remarks">Remarks</label>
            <textarea id="modal_team_remarks" class="form-control" rows="3" placeholder="Operational notes, coverage, or remarks...">${team.remarks || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_team_status">Status</label>
            <select id="modal_team_status" class="form-select">
              <option value="active" ${team.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${team.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button type="button" class="btn btn-primary" id="save-team-btn" onclick="document.getElementById('team-entry-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))">${isEdit ? 'Save Changes' : 'Create Team'}</button>
    `;

    UI.showModal({
      title: isEdit ? 'Edit Team' : 'Add New Team',
      bodyHtml,
      footerHtml,
      size: 'md'
    });

    setTimeout(() => {
      const input = document.getElementById('modal_team_name');
      if (input) input.focus();
    }, 150);
  },

  async saveTeam(e, id) {
    e.preventDefault();
    const isEdit = !!id;
    const team_name = document.getElementById('modal_team_name').value.trim();
    const team_code = document.getElementById('modal_team_code').value.trim();
    const remarks = document.getElementById('modal_team_remarks').value.trim();
    const status = document.getElementById('modal_team_status').value;

    if (!team_name || !team_code) {
      UI.toast('warning', 'Validation Error', 'Team name and Team ID are required.');
      return;
    }

    const saveBtn = document.getElementById('save-team-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const url = isEdit ? `/api/teams/${id}` : '/api/teams';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_name, team_code, remarks, status })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Operation failed');

      UI.toast('success', 'Success', data.message);
      UI.closeModal();
      TeamListView.fetchData();
    } catch (err) {
      UI.toast('danger', 'Error Saving Team', err.message);
      if (saveBtn) saveBtn.disabled = false;
    }
  },

  async toggleStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/teams/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status update failed');
      UI.toast('success', 'Status Updated', data.message);
      TeamListView.fetchData();
    } catch (err) {
      UI.toast('danger', 'Error', err.message);
    }
  },

  async deleteTeam(id, name) {
    UI.confirm(
      `Are you sure you want to delete team "<strong>${name}</strong>"? All member associations will remain intact.`,
      async () => {
        try {
          const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Delete failed');
          UI.toast('success', 'Team Removed', data.message);
          TeamListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Error', err.message);
        }
      },
      { title: 'Delete Team', confirmText: 'Delete', isDanger: true }
    );
  },

  export(format) {
    const { search, status } = TeamListView.state;
    window.location.href = `/api/teams/export?format=${format}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
  }
};

const TeamMemberListView = {
  state: { page: 1, limit: 10, search: '', team_id: '', status: '' },

  async render(container) {
    let teams = [];
    try {
      const res = await fetch('/api/teams/all');
      const data = await res.json();
      if (data.success) teams = data.data;
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Team Member Management</h1>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="TeamMemberListView.openModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="member-search" class="form-control" placeholder="Search by Member Name or Member ID..." value="${TeamMemberListView.state.search}">
          </div>

          <select id="member-team-filter" class="form-select" style="width: 200px;">
            <option value="">All Teams</option>
            ${teams.map(t => `<option value="${t.id}" ${TeamMemberListView.state.team_id == t.id ? 'selected' : ''}>${t.team_name}</option>`).join('')}
          </select>

          <select id="member-status-filter" class="form-select" style="width: 140px;">
            <option value="">All Statuses</option>
            <option value="active" ${TeamMemberListView.state.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${TeamMemberListView.state.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>

          <button class="btn btn-secondary" onclick="TeamMemberListView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="TeamMemberListView.resetFilters()">Reset</button>
        </div>
      </div>

      <!-- Team Members Data Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>Team member Name</th>
                <th>Team Member ID</th>
                <th>Team Name</th>
                <th>Role / Leader</th>
                <th>Status</th>
                <th style="text-align: right; width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody id="member-table-body">
              <tr><td colspan="7" style="text-align:center; padding: 30px;">Loading team members...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="member-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('member-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') TeamMemberListView.applyFilters();
    });

    await TeamMemberListView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, team_id, status } = TeamMemberListView.state;
    const url = `/api/team-members?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&team_id=${encodeURIComponent(team_id)}&status=${encodeURIComponent(status)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch team members');

      TeamMemberListView.renderTable(data.data);
      TeamMemberListView.renderPagination(data.pagination);
    } catch (err) {
      UI.toast('danger', 'Error loading members', err.message);
    }
  },

  renderTable(members) {
    const tbody = document.getElementById('member-table-body');
    if (!tbody) return;

    if (!members || members.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 4px;">No team members found</div>
            <div style="font-size: 13px;">Click "Add Team Member" above to register personnel.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = members.map(m => `
      <tr>
        <td><strong>${m.sl}</strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${m.member_name}</div>
        </td>
        <td>
          <span class="badge badge-neutral" style="font-weight: 600; font-family: monospace;">${m.member_code}</span>
        </td>
        <td>
          ${m.team_name ? `<span style="font-weight: 500;">${m.team_name} <span style="color: var(--text-muted); font-size: 11px;">(${m.team_code})</span></span>` : `<span style="color: var(--text-muted);">Unassigned</span>`}
        </td>
        <td>
          ${m.is_team_leader ? `<span class="badge badge-active" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600;">★ Team Leader</span>` : `<span class="badge badge-neutral">Team Member</span>`}
        </td>
        <td>
          <span class="badge ${m.status === 'active' ? 'badge-active' : 'badge-inactive'}">
            ${m.status.toUpperCase()}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn btn-icon btn-secondary btn-sm" title="Edit Member" onclick="TeamMemberListView.openModal(${m.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon btn-secondary btn-sm" title="Toggle Active Status" onclick="TeamMemberListView.toggleStatus(${m.id}, '${m.status === 'active' ? 'inactive' : 'active'}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
            <button class="btn btn-icon btn-danger btn-sm" title="Delete Member" onclick="TeamMemberListView.deleteMember(${m.id}, '${m.member_name.replace(/'/g, "\\'")}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderPagination(pagination) {
    const box = document.getElementById('member-pagination-box');
    if (!box || !pagination) return;
    box.innerHTML = UI.renderPagination(pagination, 'TeamMemberListView.changePage');
  },

  changePage(p) {
    TeamMemberListView.state.page = p;
    TeamMemberListView.fetchData();
  },

  applyFilters() {
    TeamMemberListView.state.page = 1;
    TeamMemberListView.state.search = document.getElementById('member-search').value;
    TeamMemberListView.state.team_id = document.getElementById('member-team-filter').value;
    TeamMemberListView.state.status = document.getElementById('member-status-filter').value;
    TeamMemberListView.fetchData();
  },

  resetFilters() {
    TeamMemberListView.state.page = 1;
    TeamMemberListView.state.search = '';
    TeamMemberListView.state.team_id = '';
    TeamMemberListView.state.status = '';
    document.getElementById('member-search').value = '';
    document.getElementById('member-team-filter').value = '';
    document.getElementById('member-status-filter').value = '';
    TeamMemberListView.fetchData();
  },

  async openModal(id = null) {
    const isEdit = !!id;
    let member = { member_name: '', member_code: '', team_id: '', is_team_leader: false, status: 'active' };

    let teams = [];
    try {
      const teamRes = await fetch('/api/teams/all');
      const teamData = await teamRes.json();
      if (teamData.success) teams = teamData.data;
    } catch (e) {
      console.error(e);
    }

    if (isEdit) {
      try {
        const res = await fetch(`/api/team-members/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load member');
        member = data.data;
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
        return;
      }
    }

    const bodyHtml = `
      <form id="member-entry-form" onsubmit="TeamMemberListView.saveMember(event, ${id})">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label class="form-label" for="modal_member_name">Team member Name <span class="required-star">*</span></label>
            <input type="text" id="modal_member_name" class="form-control" required placeholder="Team Member" value="${member.member_name}">
            <div class="invalid-feedback" id="err-modal_member_name"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_member_code">Team Member ID <span class="required-star">*</span></label>
            <input type="text" id="modal_member_code" class="form-control" required placeholder="e.g. MEM-101" value="${member.member_code}">
            <div class="form-hint">Unique identifier for this team member.</div>
            <div class="invalid-feedback" id="err-modal_member_code"></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_team_id">Team Name <span class="required-star">*</span></label>
            <select id="modal_team_id" class="form-select" required>
              <option value="">-- Select Team --</option>
              ${teams.map(t => `<option value="${t.id}" ${member.team_id == t.id ? 'selected' : ''}>${t.team_name} (${t.team_code})</option>`).join('')}
            </select>
            <div class="invalid-feedback" id="err-modal_team_id"></div>
          </div>

          <div class="form-group" style="padding: 12px 14px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <label class="form-label" for="modal_is_team_leader" style="margin-bottom: 2px; cursor: pointer;">Is team Leader?</label>
                <div class="form-hint" style="margin-top: 0;">Check if this member is the designated team leader (Yes/No)</div>
              </div>
              <input type="checkbox" id="modal_is_team_leader" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);" ${member.is_team_leader ? 'checked' : ''}>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="modal_member_status">Status</label>
            <select id="modal_member_status" class="form-select">
              <option value="active" ${member.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${member.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button type="button" class="btn btn-primary" id="save-member-btn" onclick="document.getElementById('member-entry-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))">${isEdit ? 'Save Changes' : 'Create Member'}</button>
    `;

    UI.showModal({
      title: isEdit ? 'Edit Team Member' : 'Add New Team Member',
      bodyHtml,
      footerHtml,
      size: 'md'
    });

    setTimeout(() => {
      const input = document.getElementById('modal_member_name');
      if (input) input.focus();
    }, 150);
  },

  async saveMember(e, id) {
    e.preventDefault();
    const isEdit = !!id;
    const member_name = document.getElementById('modal_member_name').value.trim();
    const member_code = document.getElementById('modal_member_code').value.trim();
    const team_id = document.getElementById('modal_team_id').value;
    const is_team_leader = document.getElementById('modal_is_team_leader').checked;
    const status = document.getElementById('modal_member_status').value;

    if (!member_name || !member_code || !team_id) {
      UI.toast('warning', 'Validation Error', 'Name, ID, and Team selection are required.');
      return;
    }

    const saveBtn = document.getElementById('save-member-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const url = isEdit ? `/api/team-members/${id}` : '/api/team-members';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_name, member_code, team_id, is_team_leader, status })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Operation failed');

      UI.toast('success', 'Success', data.message);
      UI.closeModal();
      TeamMemberListView.fetchData();
    } catch (err) {
      UI.toast('danger', 'Error Saving Member', err.message);
      if (saveBtn) saveBtn.disabled = false;
    }
  },

  async toggleStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/team-members/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status update failed');
      UI.toast('success', 'Status Updated', data.message);
      TeamMemberListView.fetchData();
    } catch (err) {
      UI.toast('danger', 'Error', err.message);
    }
  },

  async deleteMember(id, name) {
    UI.confirm(
      `Are you sure you want to remove team member "<strong>${name}</strong>"?`,
      async () => {
        try {
          const res = await fetch(`/api/team-members/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Delete failed');
          UI.toast('success', 'Member Removed', data.message);
          TeamMemberListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Error', err.message);
        }
      },
      { title: 'Delete Team Member', confirmText: 'Delete', isDanger: true }
    );
  },

  export(format) {
    const { search, team_id, status } = TeamMemberListView.state;
    window.location.href = `/api/team-members/export?format=${format}&search=${encodeURIComponent(search)}&team_id=${encodeURIComponent(team_id)}&status=${encodeURIComponent(status)}`;
  }
};

// ==========================================
// 4. MFI MODULE VIEWS (List, Form, Profile View)
// ==========================================
const MfiListView = {
  state: { page: 1, limit: 10, search: '', status: '', team_member_id: '', team_leader_id: '', is_head_office_billable: '' },

  async render(container) {
    let filterOptions = { assignedMembers: [], assignedLeaders: [] };
    try {
      const res = await fetch('/api/mfis/filter-options');
      const data = await res.json();
      if (data.success) {
        filterOptions = data.data;
      }
    } catch (e) {
      console.error('Error loading MFI filter options:', e);
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Microfinance Institutions (MFI)</h1>
        </div>
        <div class="page-actions">
          <a href="/mfi/create" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add MFI</span>
          </a>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="mfi-search" class="form-control" placeholder="Search by MFI Name or Short Code..." value="${MfiListView.state.search}">
          </div>

          <select id="mfi-status-filter" class="form-select" style="width: 140px;">
            <option value="">All Statuses</option>
            <option value="active" ${MfiListView.state.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${MfiListView.state.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>

          <select id="mfi-team-member-filter" class="form-select" style="width: 180px;">
            <option value="">All Team Members</option>
            ${filterOptions.assignedMembers.map(m => `
              <option value="${m.id}" ${MfiListView.state.team_member_id == m.id ? 'selected' : ''}>${m.member_name} (${m.member_code})</option>
            `).join('')}
          </select>

          <select id="mfi-team-leader-filter" class="form-select" style="width: 180px;">
            <option value="">All Team Leaders</option>
            ${filterOptions.assignedLeaders.map(l => `
              <option value="${l.id}" ${MfiListView.state.team_leader_id == l.id ? 'selected' : ''}>${l.member_name} (${l.member_code})</option>
            `).join('')}
          </select>

          <select id="mfi-hob-filter" class="form-select" style="width: 160px;">
            <option value="">Head Office Billable</option>
            <option value="yes" ${MfiListView.state.is_head_office_billable === 'yes' ? 'selected' : ''}>YES</option>
            <option value="no" ${MfiListView.state.is_head_office_billable === 'no' ? 'selected' : ''}>NO</option>
          </select>

          <button class="btn btn-secondary" onclick="MfiListView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="MfiListView.resetFilters()">Reset</button>
        </div>
      </div>

      <!-- MFI Data Table Container -->
      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>MFI Full Name</th>
                <th>Short Name</th>
                <th>Establish Date</th>
                <th>Initial Agreement</th>
                <th>Agreement Expire Date</th>
                <th>Branches</th>
                <th>Current License Fee</th>
                <th>Current O&M Fee</th>
                <th>Status</th>
                <th style="text-align: right; width: 140px;">Actions</th>
              </tr>
            </thead>
            <tbody id="mfi-table-body">
              <tr><td colspan="11" style="text-align:center; padding: 30px;">Loading records...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="mfi-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('mfi-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') MfiListView.applyFilters();
    });

    await MfiListView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, status, team_member_id, team_leader_id, is_head_office_billable } = MfiListView.state;
    const url = `/api/mfis?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&team_member_id=${encodeURIComponent(team_member_id || '')}&team_leader_id=${encodeURIComponent(team_leader_id || '')}&is_head_office_billable=${encodeURIComponent(is_head_office_billable || '')}`;
    const res = await fetch(url);
    const result = await res.json();

    const tbody = document.getElementById('mfi-table-body');
    const paginationBox = document.getElementById('mfi-pagination-box');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11">
            <div class="empty-state">
              <h3 class="empty-state-title">No MFI Records Found</h3>
              <p class="empty-state-text">No records match your filter criteria.</p>
              <a href="/mfi/create" class="btn btn-primary btn-sm">Register New MFI</a>
            </div>
          </td>
        </tr>
      `;
      paginationBox.innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(mfi => `
      <tr>
        <td><strong>${mfi.sl}</strong></td>
        <td>
          <a href="/mfi/${mfi.id}" style="font-weight: 600; color: var(--primary);">${mfi.full_name}</a>
        </td>
        <td><span class="badge badge-neutral" style="font-weight:700;">${mfi.short_name}</span></td>
        <td>${UI.formatDate(mfi.establish_date)}</td>
        <td>${UI.formatDate(mfi.initial_agreement_date)}</td>
        <td>${mfi.agreement_expire_date ? UI.formatDate(mfi.agreement_expire_date) : '<span style="color:var(--text-muted);">Not Set</span>'}</td>
        <td><a href="/branches?mfi_id=${mfi.id}" class="badge badge-current">${mfi.total_branches} Branches</a></td>
        <td><strong>${UI.formatCurrency(mfi.current_license_fee)}</strong></td>
        <td><strong>${UI.formatCurrency(mfi.current_om_fee)}</strong></td>
        <td>
          <span class="badge ${mfi.status === 'active' ? 'badge-active' : 'badge-inactive'}">
            <span class="badge-dot"></span>
            ${mfi.status.toUpperCase()}
          </span>
        </td>
        <td class="table-actions-cell">
          <div class="table-actions-group">
            <a href="/mfi/${mfi.id}" class="action-btn action-btn-view" title="View Profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            <a href="/mfi/${mfi.id}/edit" class="action-btn action-btn-edit" title="Edit MFI">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button class="action-btn action-btn-status ${mfi.status === 'active' ? 'is-active' : 'is-inactive'}" onclick="MfiListView.toggleStatus(${mfi.id}, '${mfi.status === 'active' ? 'inactive' : 'active'}')" title="${mfi.status === 'active' ? 'Deactivate MFI' : 'Activate MFI'}">
              ${mfi.status === 'active' 
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' 
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>'}
            </button>
            <button class="action-btn action-btn-delete" onclick="MfiListView.deleteMfi(${mfi.id}, '${escape(mfi.short_name)}')" title="Delete MFI">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    paginationBox.innerHTML = UI.renderPagination(result.pagination, 'MfiListView.goToPage');
  },

  applyFilters() {
    MfiListView.state.search = document.getElementById('mfi-search').value.trim();
    MfiListView.state.status = document.getElementById('mfi-status-filter').value;
    MfiListView.state.team_member_id = document.getElementById('mfi-team-member-filter')?.value || '';
    MfiListView.state.team_leader_id = document.getElementById('mfi-team-leader-filter')?.value || '';
    MfiListView.state.is_head_office_billable = document.getElementById('mfi-hob-filter')?.value || '';
    MfiListView.state.page = 1;
    MfiListView.fetchData();
  },

  resetFilters() {
    document.getElementById('mfi-search').value = '';
    document.getElementById('mfi-status-filter').value = '';
    if (document.getElementById('mfi-team-member-filter')) document.getElementById('mfi-team-member-filter').value = '';
    if (document.getElementById('mfi-team-leader-filter')) document.getElementById('mfi-team-leader-filter').value = '';
    if (document.getElementById('mfi-hob-filter')) document.getElementById('mfi-hob-filter').value = '';
    MfiListView.state.search = '';
    MfiListView.state.status = '';
    MfiListView.state.team_member_id = '';
    MfiListView.state.team_leader_id = '';
    MfiListView.state.is_head_office_billable = '';
    MfiListView.state.page = 1;
    MfiListView.fetchData();
  },

  goToPage(p) {
    MfiListView.state.page = p;
    MfiListView.fetchData();
  },

  toggleStatus(id, newStatus) {
    UI.confirm(
      `Are you sure you want to <strong>${newStatus}</strong> this MFI?`,
      async () => {
        try {
          const res = await fetch(`/api/mfis/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          UI.toast('success', 'Status Updated', data.message);
          MfiListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Update Failed', err.message);
        }
      },
      { title: 'Confirm Status Change' }
    );
  },

  deleteMfi(id, nameEscaped) {
    const name = unescape(nameEscaped);
    UI.confirm(
      `Are you sure you want to delete MFI <strong>${name}</strong>?<br>
       <span style="color:var(--danger); font-size:12px;">
         ⚠️ Deletion is only allowed if the MFI has <strong>no existing branches</strong>.<br>
         All branch records must be deleted first.
       </span>`,
      async () => {
        try {
          const res = await fetch(`/api/mfis/${id}`, { method: 'DELETE' });
          const data = await res.json();

          if (res.status === 409) {
            // Branch block — show actionable error with link to branch list
            UI.toast('danger', 'Cannot Delete MFI', data.message);
            // Show a follow-up modal guiding the user
            setTimeout(() => {
              UI.confirm(
                `<strong>${name}</strong> still has branch offices linked to it.<br><br>
                 Please go to the <strong>Branch List</strong> and delete all branches for this MFI first, then try again.`,
                () => { Router.navigate(`/branches?mfi_id=${id}`); },
                { title: 'Branches Must Be Deleted First', confirmText: 'Go to Branch List', isDanger: false }
              );
            }, 300);
            return;
          }

          if (!res.ok) throw new Error(data.message);
          UI.toast('success', 'MFI Deleted', data.message);
          MfiListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete Microfinance Institution', confirmText: 'Delete MFI', isDanger: true }
    );
  },

  export(format) {
    const { search, status } = MfiListView.state;
    window.open(`/api/mfis/export?format=${format}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`, '_blank');
  }
};

const MfiFormView = {
  async render(container, id = null) {
    let isEdit = !!id;
    let mfi = {
      full_name: '',
      short_name: '',
      establish_date: '',
      initial_agreement_date: '',
      agreement_expire_date: '',
      initial_license_fee: 0,
      initial_om_fee: 0,
      initial_branch_count: 0,
      is_head_office_billable: false,
      team_id: '',
      team_member_id: '',
      status: 'active'
    };

    // 1. Fetch teams for dropdown
    let teams = [];
    try {
      const teamsRes = await fetch('/api/teams/all');
      const teamsData = await teamsRes.json();
      if (teamsData.success) teams = teamsData.data;
    } catch (e) {
      console.error('Error fetching teams:', e);
    }

    if (isEdit) {
      const res = await fetch(`/api/mfis/${id}`);
      if (!res.ok) throw new Error('Failed to load MFI.');
      const data = await res.json();
      mfi = data.data.mfi;
    }

    container.innerHTML = `
      <div class="form-page-wrapper">
        <div class="page-header">
          <div>
            <h1 class="page-title">${isEdit ? `Edit MFI: ${mfi.short_name}` : 'Add New Microfinance Institution'}</h1>
          </div>
          <div class="page-actions">
            <a href="/mfi" class="btn btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              <span>Back to MFI List</span>
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">MFI Master Registration Form</h3>
          </div>
          <div class="card-body">
            <form id="mfi-form">
              <!-- Form Grid 1 -->
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="full_name">MFI Full Name <span class="required-star">*</span></label>
                  <input type="text" id="full_name" class="form-control" required placeholder="MFI Name" value="${mfi.full_name}">
                  <div class="form-hint">Enter the complete registered legal name of the MFI.</div>
                  <div class="invalid-feedback" id="err-full_name"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="short_name">MFI Short Name <span class="required-star">*</span></label>
                  <input type="text" id="short_name" class="form-control" required placeholder="MFI short name" value="${mfi.short_name}">
                  <div class="form-hint">Enter a unique abbreviation (e.g. SSS). Used for autocomplete &amp; quick searches.</div>
                  <div class="invalid-feedback" id="err-short_name"></div>
                </div>
              </div>

              <!-- Form Grid 2 -->
              <div class="form-grid-3">
                <div class="form-group">
                  <label class="form-label" for="establish_date">MFI Establish Date <span class="required-star">*</span></label>
                  <input type="date" id="establish_date" class="form-control" required value="${UI.formatDateForInput(mfi.establish_date)}">
                  <div class="invalid-feedback" id="err-establish_date"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="initial_agreement_date">Initial Agreement Date <span class="required-star">*</span></label>
                  <input type="date" id="initial_agreement_date" class="form-control" ${isEdit ? 'disabled' : 'required'} value="${UI.formatDateForInput(mfi.initial_agreement_date)}">
                  <div class="form-hint">${isEdit ? 'Managed in Agreement History' : 'Cannot be earlier than establish date'}</div>
                  <div class="invalid-feedback" id="err-initial_agreement_date"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="agreement_expire_date">Agreement Expire Date</label>
                  <input type="date" id="agreement_expire_date" class="form-control" value="${UI.formatDateForInput(mfi.agreement_expire_date)}">
                  <div class="form-hint">Expiry date of agreement. Used for Renewal Alerts.</div>
                  <div class="invalid-feedback" id="err-agreement_expire_date"></div>
                </div>
              </div>

              <!-- Form Grid 3: Team and Team Member (Cascading Dynamic Selection) -->
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="mfi_team_id">Team Name</label>
                  <select id="mfi_team_id" class="form-select">
                    <option value="">-- Select Team --</option>
                    ${teams.map(t => `<option value="${t.id}" ${mfi.team_id == t.id ? 'selected' : ''}>${t.team_name} (${t.team_code})</option>`).join('')}
                  </select>
                  <div class="form-hint">Select the operational team managing this MFI.</div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="mfi_team_member_id">Team Member</label>
                  <select id="mfi_team_member_id" class="form-select" ${!mfi.team_id ? 'disabled' : ''}>
                    <option value="">${mfi.team_id ? '-- Select Team Member --' : '-- Select a team first --'}</option>
                  </select>
                  <div class="form-hint">Dynamically loaded based on selected team.</div>
                </div>
              </div>

              <!-- Fee & Initial Branch Section (Only on create or display on edit) -->
              <div class="form-grid-3" style="${isEdit ? 'opacity: 0.7; pointer-events: none;' : ''}">
                <div class="form-group">
                  <label class="form-label" for="initial_license_fee">License Fee per Branch <span class="required-star">*</span></label>
                  <input type="number" step="0.01" min="0" id="initial_license_fee" class="form-control" value="${mfi.initial_license_fee || 0}">
                  <div class="invalid-feedback" id="err-initial_license_fee"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="initial_om_fee">O&M Fee per Branch <span class="required-star">*</span></label>
                  <input type="number" step="0.01" min="0" id="initial_om_fee" class="form-control" value="${mfi.initial_om_fee || 0}">
                  <div class="invalid-feedback" id="err-initial_om_fee"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="initial_branch_count">Initial Branch Count</label>
                  <input type="number" min="0" id="initial_branch_count" class="form-control" value="${mfi.initial_branch_count || 0}">
                </div>
              </div>

              <!-- Form Grid 4: Status and Head Office Billable -->
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="mfi_status">MFI Status <span class="required-star">*</span></label>
                  <select id="mfi_status" class="form-select">
                    <option value="active" ${mfi.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${mfi.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="is_head_office_billable">Is Head office Billable? <span class="required-star">*</span></label>
                  <select id="is_head_office_billable" class="form-select">
                    <option value="no" ${!mfi.is_head_office_billable ? 'selected' : ''}>No</option>
                    <option value="yes" ${mfi.is_head_office_billable ? 'selected' : ''}>Yes</option>
                  </select>
                </div>
              </div>

              <!-- Form Grid 5: Grace Period for O&M -->
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="om_grace_period_months">Grace Period for O &amp; M</label>
                  <input type="number" id="om_grace_period_months" class="form-control"
                    placeholder="e.g. 3 or -2"
                    value="${mfi.om_grace_period_months !== null && mfi.om_grace_period_months !== undefined ? mfi.om_grace_period_months : ''}">
                  <div class="form-hint">Enter a whole number. Positive = future months (e.g. 3 = +3 months). Leave blank for none.</div>
                  <div class="invalid-feedback" id="err-om_grace_period_months"></div>
                </div>
              </div>

              <div class="form-row-actions">
                <button type="submit" id="save-mfi-btn" class="btn btn-primary btn-lg">
                  <span>${isEdit ? 'Save Changes' : 'Create MFI'}</span>
                </button>
                <a href="/mfi" class="btn btn-secondary btn-lg">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Cascading Team Member Loader
    const teamSelect = document.getElementById('mfi_team_id');
    const memberSelect = document.getElementById('mfi_team_member_id');

    async function loadTeamMembers(teamId, selectedMemberId = null) {
      if (!teamId) {
        memberSelect.innerHTML = '<option value="">-- Select a team first --</option>';
        memberSelect.disabled = true;
        return;
      }
      memberSelect.disabled = true;
      memberSelect.innerHTML = '<option value="">Loading members...</option>';
      try {
        const res = await fetch(`/api/team-members/by-team/${teamId}`);
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.length === 0) {
            memberSelect.innerHTML = '<option value="">No members found for this team</option>';
            memberSelect.disabled = true;
          } else {
            memberSelect.innerHTML = '<option value="">-- Select Team Member --</option>' +
              data.data.map(m => `<option value="${m.id}" ${selectedMemberId == m.id ? 'selected' : ''}>${m.member_name} (${m.member_code})${m.is_team_leader ? ' ★ Leader' : ''}</option>`).join('');
            memberSelect.disabled = false;
          }
        }
      } catch (e) {
        console.error('Error loading team members:', e);
        memberSelect.innerHTML = '<option value="">Error loading members</option>';
      }
    }

    teamSelect.addEventListener('change', (e) => {
      loadTeamMembers(e.target.value);
    });

    if (mfi.team_id) {
      await loadTeamMembers(mfi.team_id, mfi.team_member_id);
    }

    // Form submit listener
    document.getElementById('mfi-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous error messages
      document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
      document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));

      const full_name = document.getElementById('full_name').value.trim();
      const short_name = document.getElementById('short_name').value.trim();
      const establish_date = document.getElementById('establish_date').value;
      const initial_agreement_date = document.getElementById('initial_agreement_date').value;
      const agreement_expire_date = document.getElementById('agreement_expire_date').value || null;
      const initial_license_fee = document.getElementById('initial_license_fee').value;
      const initial_om_fee = document.getElementById('initial_om_fee').value;
      const initial_branch_count = document.getElementById('initial_branch_count').value;
      const team_id = document.getElementById('mfi_team_id').value || null;
      const team_member_id = document.getElementById('mfi_team_member_id').value || null;
      const status = document.getElementById('mfi_status').value;
      const is_head_office_billable = document.getElementById('is_head_office_billable').value === 'yes';
      const omGracePeriodRaw = document.getElementById('om_grace_period_months').value.trim();
      const om_grace_period_months = omGracePeriodRaw !== '' ? parseInt(omGracePeriodRaw, 10) : null;

      // Validation
      let hasError = false;
      if (!full_name) {
        document.getElementById('err-full_name').textContent = 'MFI Full Name is required.';
        document.getElementById('full_name').classList.add('is-invalid');
        hasError = true;
      }
      if (!short_name) {
        document.getElementById('err-short_name').textContent = 'MFI Short Name is required.';
        document.getElementById('short_name').classList.add('is-invalid');
        hasError = true;
      }
      if (!establish_date) {
        document.getElementById('err-establish_date').textContent = 'Establish Date is required.';
        document.getElementById('establish_date').classList.add('is-invalid');
        hasError = true;
      }

      if (!isEdit && establish_date && initial_agreement_date && initial_agreement_date < establish_date) {
        document.getElementById('err-initial_agreement_date').textContent = 'Agreement Date should not normally be earlier than Establish Date.';
        document.getElementById('initial_agreement_date').classList.add('is-invalid');
        hasError = true;
      }

      // Validate create-only fields
      if (!isEdit) {
        if (!initial_agreement_date) {
          document.getElementById('err-initial_agreement_date').textContent = 'Initial Agreement Date is required.';
          document.getElementById('initial_agreement_date').classList.add('is-invalid');
          hasError = true;
        }
        const licFee = parseFloat(initial_license_fee);
        if (initial_license_fee === '' || isNaN(licFee) || licFee < 0) {
          document.getElementById('err-initial_license_fee').textContent = 'License Fee must be a valid non-negative number.';
          document.getElementById('initial_license_fee').classList.add('is-invalid');
          hasError = true;
        }
        const omFee = parseFloat(initial_om_fee);
        if (initial_om_fee === '' || isNaN(omFee) || omFee < 0) {
          document.getElementById('err-initial_om_fee').textContent = 'O&M Fee must be a valid non-negative number.';
          document.getElementById('initial_om_fee').classList.add('is-invalid');
          hasError = true;
        }
      }

      if (hasError) return;


      const payload = {
        full_name,
        short_name,
        establish_date,
        initial_agreement_date,
        agreement_expire_date,
        initial_license_fee,
        initial_om_fee,
        initial_branch_count,
        team_id: team_id ? parseInt(team_id, 10) : null,
        team_member_id: team_member_id ? parseInt(team_member_id, 10) : null,
        is_head_office_billable,
        om_grace_period_months,
        status
      };

      const saveBtn = document.getElementById('save-mfi-btn');
      saveBtn.disabled = true;

      try {
        const url = isEdit ? `/api/mfis/${id}` : '/api/mfis';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Validation error');

        UI.toast('success', 'MFI Saved', data.message);
        Router.navigate('/mfi');
      } catch (err) {
        // Try to map server error to the correct field
        const msg = err.message || '';
        let mapped = false;
        const fieldMap = [
          { pattern: /full.?name/i,          field: 'full_name' },
          { pattern: /short.?name/i,         field: 'short_name' },
          { pattern: /establish.?date/i,     field: 'establish_date' },
          { pattern: /initial.?agreement.?date/i, field: 'initial_agreement_date' },
          { pattern: /expire.?date/i,        field: 'agreement_expire_date' },
          { pattern: /license.?fee/i,        field: 'initial_license_fee' },
          { pattern: /o.*m.?fee|om.?fee/i,   field: 'initial_om_fee' },
          { pattern: /grace.?period/i,       field: 'om_grace_period_months' },
        ];
        fieldMap.forEach(({ pattern, field }) => {
          if (pattern.test(msg)) {
            const el = document.getElementById(field);
            const errEl = document.getElementById(`err-${field}`);
            if (el && errEl) { el.classList.add('is-invalid'); errEl.textContent = msg; mapped = true; }
          }
        });
        if (!mapped) UI.toast('danger', 'Error Saving MFI', msg);
        saveBtn.disabled = false;
      }
    });
  }
};

const MfiProfileView = {
  async render(container, id) {
    const res = await fetch(`/api/mfis/${id}`);
    if (!res.ok) throw new Error('Failed to load MFI profile.');
    const { data } = await res.json();

    const { mfi, currentFee, branchSummary, agreementHistory, branches } = data;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 class="page-title">${mfi.full_name}</h1>
            <span class="badge ${mfi.status === 'active' ? 'badge-active' : 'badge-inactive'}">${mfi.status.toUpperCase()}</span>
          </div>
          <p class="page-subtitle">Short Code: <strong>${mfi.short_name}</strong> | Established: ${UI.formatDate(mfi.establish_date)}</p>
        </div>
        <div class="page-actions">
          <a href="/mfi/${id}/edit" class="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Edit MFI</span>
          </a>
          <a href="/agreements/create?mfi_id=${id}" class="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Renewal Agreement</span>
          </a>
          <a href="/branches/create?mfi_id=${id}" class="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Branch</span>
          </a>
        </div>
      </div>

      <!-- Top Row: Basic Information & Current Resolved Fee Cards -->
      <div class="charts-grid-2">
        <!-- 1. Basic Information -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">1. Basic Information</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; font-size: 13px;">
              <div>
                <div style="color: var(--text-muted);">Full Name:</div>
                <div style="font-weight: 600; margin-top: 2px;">${mfi.full_name}</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Short Name:</div>
                <div style="font-weight: 600; margin-top: 2px;"><span class="badge badge-neutral">${mfi.short_name}</span></div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Establish Date:</div>
                <div style="font-weight: 600; margin-top: 2px;">${UI.formatDate(mfi.establish_date)}</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Initial Agreement Date:</div>
                <div style="font-weight: 600; margin-top: 2px;">${UI.formatDate(mfi.initial_agreement_date)}</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Agreement Expire Date:</div>
                <div style="font-weight: 600; margin-top: 2px;">
                  ${mfi.agreement_expire_date ? `<span class="badge ${new Date(mfi.agreement_expire_date) <= new Date() ? 'badge-inactive' : 'badge-neutral'}">${UI.formatDate(mfi.agreement_expire_date)}</span>` : '<span style="color: var(--text-muted);">Not Set</span>'}
                </div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Initial Branch Count:</div>
                <div style="font-weight: 600; margin-top: 2px;">${mfi.initial_branch_count}</div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Is Head Office Billable:</div>
                <div style="font-weight: 600; margin-top: 2px;">
                  <span class="badge ${mfi.is_head_office_billable ? 'badge-active' : 'badge-neutral'}">${mfi.is_head_office_billable ? 'YES' : 'NO'}</span>
                </div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Grace Period for O &amp; M:</div>
                <div style="font-weight: 600; margin-top: 2px;">
                  ${(mfi.om_grace_period_months !== null && mfi.om_grace_period_months !== undefined)
                    ? `<span class="badge badge-neutral">${mfi.om_grace_period_months > 0 ? '+' : ''}${mfi.om_grace_period_months} Month${Math.abs(mfi.om_grace_period_months) !== 1 ? 's' : ''}</span>`
                    : '<span style="color: var(--text-muted);">Not Set</span>'}
                </div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Assigned Team:</div>
                <div style="font-weight: 600; margin-top: 2px;">
                  ${mfi.team_name ? `<span class="badge badge-neutral" style="font-weight:600;">${mfi.team_name} (${mfi.team_code})</span>` : '<span style="color: var(--text-muted);">Unassigned</span>'}
                </div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Assigned Key Member:</div>
                <div style="font-weight: 600; margin-top: 2px;">
                  ${mfi.team_member_name ? `<span class="badge badge-active" style="font-weight:600;">${mfi.team_member_name} (${mfi.team_member_code})</span>` : '<span style="color: var(--text-muted);">Unassigned</span>'}
                </div>
              </div>
              <div>
                <div style="color: var(--text-muted);">Status:</div>
                <div style="font-weight: 600; margin-top: 2px;"><span class="badge ${mfi.status === 'active' ? 'badge-active' : 'badge-inactive'}">${mfi.status.toUpperCase()}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Current Applicable Fee (Dynamic Service Resolution) -->
        <div class="card" style="border-left: 4px solid var(--primary);">
          <div class="card-header">
            <h3 class="card-title">2. Current Applicable Support Fees</h3>
            <span class="badge badge-current">Active Effective Rate</span>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
              <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">License Fee per Branch</div>
                <div style="font-size: 22px; font-weight: 700; color: var(--primary); margin-top: 4px;">${UI.formatCurrency(currentFee.license_fee_per_branch)}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Per branch</div>
              </div>

              <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">O&M Fee per Branch</div>
                <div style="font-size: 22px; font-weight: 700; color: var(--warning); margin-top: 4px;">${UI.formatCurrency(currentFee.om_fee_per_branch)}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Per branch / monthly</div>
              </div>
            </div>

            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span>Effective Date: <strong>${UI.formatDate(currentFee.agreement_date)}</strong></span>
              <span>Agreement Expire Date: <strong>${currentFee.agreement_expire_date ? UI.formatDate(currentFee.agreement_expire_date) : 'Not Set'}</strong></span>
            </div>
            ${currentFee.remarks ? `<div style="margin-top:4px; font-size: 12px; color: var(--text-muted);">Remarks: <em>${currentFee.remarks}</em></div>` : ''}
          </div>
        </div>
      </div>

      <!-- 3. Branch Summary Cards -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">3. Branch Network Summary</h3>
        </div>
        <div class="card-body">
          <div class="stats-grid" style="margin-bottom: 0;">
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Total Branches</div>
                <div class="stat-value">${branchSummary.total}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Active Branches</div>
                <div class="stat-value" style="color: var(--success);">${branchSummary.active}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Inactive Branches</div>
                <div class="stat-value" style="color: var(--danger);">${branchSummary.inactive}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Branch Offices</div>
                <div class="stat-value">${branchSummary.branch_offices}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Area Offices</div>
                <div class="stat-value">${branchSummary.area_offices}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-info">
                <div class="stat-label">Zone Offices</div>
                <div class="stat-value">${branchSummary.zone_offices}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Agreement History (Strict Historical Audit & Applicability Highlighting) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">4. Agreement & Renewal History</h3>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Preserves complete historical fee evolution. Newest effective date displayed first.</div>
          </div>
          <a href="/agreements/create?mfi_id=${id}" class="btn btn-primary btn-sm">Add Renewal</a>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Agreement / Effective Date</th>
                <th>License Fee</th>
                <th>O&M Fee</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created Date</th>
                <th style="text-align: right; width: 100px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${agreementHistory.length === 0 ? '<tr><td colspan="8" style="text-align:center;">No agreements recorded.</td></tr>' : ''}
              ${agreementHistory.map(agr => `
                <tr class="${agr.is_current ? 'table-highlight-row' : ''}">
                  <td>
                    <strong>${UI.formatDate(agr.agreement_date)}</strong>
                  </td>
                  <td><strong>${UI.formatCurrency(agr.license_fee_per_branch)}</strong></td>
                  <td><strong>${UI.formatCurrency(agr.om_fee_per_branch)}</strong></td>
                  <td style="color: var(--text-muted);">${agr.remarks || '—'}</td>
                  <td>
                    ${agr.is_current ? '<span class="badge badge-active"><span class="badge-dot"></span> Currently Applicable</span>' : ''}
                    ${agr.is_upcoming ? '<span class="badge badge-upcoming"><span class="badge-dot"></span> Upcoming</span>' : ''}
                    ${agr.is_historical ? '<span class="badge badge-neutral">Historical</span>' : ''}
                  </td>
                  <td>${agr.creator_name || 'System'}</td>
                  <td style="color: var(--text-light);">${UI.formatDate(agr.created_at)}</td>
                  <td class="table-actions-cell">
                    <div class="table-actions-group">
                      <button class="action-btn action-btn-edit" onclick="MfiProfileView.openEditAgreementModal(${agr.id}, ${id})" title="Edit Agreement">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="action-btn action-btn-delete" onclick="MfiProfileView.deleteAgreement(${agr.id}, '${UI.formatDate(agr.agreement_date)}', ${id})" title="Delete Agreement">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 5. Branches Belonging to This MFI -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">5. Branches Master List (${branches.length})</h3>
          <a href="/branches/create?mfi_id=${id}" class="btn btn-secondary btn-sm">Add Branch</a>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Branch Code</th>
                <th>Branch Name</th>
                <th>Branch Type</th>
                <th>Opening Date</th>
                <th>Software Start Date</th>
                <th>Billable Month</th>
                <th>Status</th>
                <th style="text-align: right; width: 120px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${branches.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 24px;">No branches created under this MFI yet.</td></tr>' : ''}
              ${branches.map(b => `
                <tr>
                  <td><strong>${b.branch_code}</strong></td>
                  <td>${b.branch_name}</td>
                  <td><span class="badge badge-neutral">${b.branch_type}</span></td>
                  <td>${UI.formatDate(b.branch_opening_date)}</td>
                  <td>${UI.formatDate(b.software_start_date)}</td>
                  <td><strong>${b.billable_month}</strong></td>
                  <td><span class="badge ${b.status === 'active' ? 'badge-active' : 'badge-inactive'}">${b.status.toUpperCase()}</span></td>
                  <td class="table-actions-cell">
                    <div class="table-actions-group">
                      <a href="/branches/${b.id}/edit" class="action-btn action-btn-edit" title="Edit Branch">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </a>
                      <button class="action-btn action-btn-status ${b.status === 'active' ? 'is-active' : 'is-inactive'}" onclick="MfiProfileView.toggleBranchStatus(${b.id}, '${b.status === 'active' ? 'inactive' : 'active'}', ${id})" title="${b.status === 'active' ? 'Deactivate Branch' : 'Activate Branch'}">
                        ${b.status === 'active'
                          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>'}
                      </button>
                      <button class="action-btn action-btn-delete" onclick="MfiProfileView.deleteBranch(${b.id}, '${escape(b.branch_name)}', ${id})" title="Delete Branch">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async openEditAgreementModal(agrId, mfiId) {
    try {
      const res = await fetch(`/api/agreements/${agrId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load agreement');
      const agr = data.data;

      const bodyHtml = `
        <form id="modal-agr-profile-edit-form">
          <div class="form-group">
            <label class="form-label" for="edit_p_agr_date">Agreement Effective Date <span class="required-star">*</span></label>
            <input type="date" id="edit_p_agr_date" class="form-control" required value="${UI.formatDateForInput(agr.agreement_date)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit_p_agr_expire_date">Agreement Expire Date</label>
            <input type="date" id="edit_p_agr_expire_date" class="form-control" value="${UI.formatDateForInput(agr.agreement_expire_date)}">
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="edit_p_license_fee">License Fee per Branch <span class="required-star">*</span></label>
              <input type="number" step="0.01" min="0" id="edit_p_license_fee" class="form-control" required value="${agr.license_fee_per_branch}">
            </div>
            <div class="form-group">
              <label class="form-label" for="edit_p_om_fee">O&M Fee per Branch <span class="required-star">*</span></label>
              <input type="number" step="0.01" min="0" id="edit_p_om_fee" class="form-control" required value="${agr.om_fee_per_branch}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit_p_remarks">Remarks</label>
            <textarea id="edit_p_remarks" class="form-control">${agr.remarks || ''}</textarea>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-p-agr-save-btn">Save Changes</button>
      `;

      UI.showModal({ title: `Edit Agreement #${agr.id}`, bodyHtml, footerHtml });

      document.getElementById('modal-p-agr-save-btn').onclick = async () => {
        const agreement_date = document.getElementById('edit_p_agr_date').value;
        const agreement_expire_date = document.getElementById('edit_p_agr_expire_date').value || null;
        const license_fee_per_branch = parseFloat(document.getElementById('edit_p_license_fee').value);
        const om_fee_per_branch = parseFloat(document.getElementById('edit_p_om_fee').value);
        const remarks = document.getElementById('edit_p_remarks').value;

        if (!agreement_date || isNaN(license_fee_per_branch) || isNaN(om_fee_per_branch)) {
          UI.toast('danger', 'Validation', 'Please provide valid agreement date and fee values.');
          return;
        }

        try {
          const updateRes = await fetch(`/api/agreements/${agrId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agreement_date, agreement_expire_date, license_fee_per_branch, om_fee_per_branch, remarks })
          });
          const updateData = await updateRes.json();
          if (!updateRes.ok) throw new Error(updateData.message);

          UI.closeModal();
          UI.toast('success', 'Agreement Updated', updateData.message);
          Router.handleRoute();
        } catch (err) {
          UI.toast('danger', 'Update Failed', err.message);
        }
      };
    } catch (err) {
      UI.toast('danger', 'Error', err.message);
    }
  },

  deleteAgreement(agrId, date, mfiId) {
    UI.confirm(
      `Are you sure you want to delete the agreement dated <strong>${date}</strong>?<br><span style="color:var(--danger); font-size:12px;">Note: You cannot delete the only agreement record for an MFI.</span>`,
      async () => {
        try {
          const res = await fetch(`/api/agreements/${agrId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          UI.toast('success', 'Agreement Deleted', data.message);
          Router.handleRoute();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete Agreement Record', confirmText: 'Delete Agreement', isDanger: true }
    );
  },

  toggleBranchStatus(branchId, newStatus, mfiId) {
    UI.confirm(`Change branch status to <strong>${newStatus}</strong>?`, async () => {
      try {
        const res = await fetch(`/api/branches/${branchId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        UI.toast('success', 'Status Updated', data.message);
        Router.handleRoute();
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    });
  },

  deleteBranch(branchId, branchNameEscaped, mfiId) {
    const branchName = unescape(branchNameEscaped);
    UI.confirm(
      `Are you sure you want to delete branch <strong>${branchName}</strong>?<br><span style="color:var(--danger); font-size:12px;">This will remove the branch record from the system.</span>`,
      async () => {
        try {
          const res = await fetch(`/api/branches/${branchId}`, { method: 'DELETE' });
          const data = await UI.parseResponse(res);
          UI.toast('success', 'Branch Deleted', data.message);
          Router.handleRoute();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete Branch Office', confirmText: 'Delete Branch', isDanger: true }
    );
  }
};

// ==========================================
// 5. BRANCH MODULE VIEWS (List, Form)
// ==========================================
const BranchListView = {
  state: { page: 1, limit: 10, search: '', mfi_id: '', branch_type: '', status: '', team_id: '', team_member_id: '', pending_billable: '', from_date: '', to_date: '' },

  async render(container) {
    // Fetch MFIs for dropdown filter
    const mfiRes = await fetch('/api/mfis/autocomplete');
    const mfiData = await mfiRes.json();
    AppState.cachedMfis = mfiData.data || [];

    // Fetch assigned teams (only teams with at least one MFI)
    let assignedTeams = [];
    try {
      const teamRes = await fetch('/api/teams/assigned');
      const teamData = await teamRes.json();
      assignedTeams = teamData.data || [];
    } catch (e) { console.warn('Could not load assigned teams', e); }

    // Fetch assigned team members (only members linked to MFIs with branches)
    let assignedMembers = [];
    try {
      const memberRes = await fetch('/api/teams/members/assigned');
      const memberData = await memberRes.json();
      assignedMembers = memberData.data || [];
    } catch (e) { console.warn('Could not load assigned members', e); }

    // Parse query params if navigated with ?mfi_id=...
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mfi_id')) BranchListView.state.mfi_id = urlParams.get('mfi_id');
    if (urlParams.get('branch_type')) BranchListView.state.branch_type = urlParams.get('branch_type');
    if (urlParams.get('status')) BranchListView.state.status = urlParams.get('status');
    if (urlParams.get('team_id')) BranchListView.state.team_id = urlParams.get('team_id');
    if (urlParams.get('team_member_id')) BranchListView.state.team_member_id = urlParams.get('team_member_id');
    if (urlParams.get('pending_billable')) BranchListView.state.pending_billable = urlParams.get('pending_billable');
    if (urlParams.get('from_date')) BranchListView.state.from_date = urlParams.get('from_date');
    if (urlParams.get('to_date')) BranchListView.state.to_date = urlParams.get('to_date');

    const hasAdvancedActive = BranchListView.state.team_id || BranchListView.state.team_member_id || BranchListView.state.pending_billable === '1' || BranchListView.state.from_date || BranchListView.state.to_date;
    const activeAdvCount = [BranchListView.state.team_id, BranchListView.state.team_member_id, BranchListView.state.pending_billable === '1' ? '1' : '', BranchListView.state.from_date, BranchListView.state.to_date].filter(Boolean).length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Branch Offices Management</h1>
        </div>
        <div class="page-actions">
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="BranchListView.export('xlsx')">Excel</button>
            <button class="btn btn-secondary" onclick="BranchListView.export('csv')">CSV</button>
            <button class="btn btn-secondary" onclick="BranchListView.export('pdf')">PDF</button>
          </div>
          <a href="/branches/create" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Branch</span>
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <!-- Row 1: primary filters -->
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="branch-search" class="form-control" placeholder="Search by Branch Name, Code, or MFI..." value="${BranchListView.state.search}">
          </div>

          <select id="branch-mfi-filter" class="form-select" style="width: 200px;">
            <option value="">All MFIs</option>
            ${AppState.cachedMfis.map(m => `
              <option value="${m.id}" ${BranchListView.state.mfi_id == m.id ? 'selected' : ''}>${m.short_name} - ${m.full_name}</option>
            `).join('')}
          </select>

          <select id="branch-type-filter" class="form-select" style="width: 150px;">
            <option value="">All Office Types</option>
            <option value="Branch Office" ${BranchListView.state.branch_type === 'Branch Office' ? 'selected' : ''}>Branch Office</option>
            <option value="Area Office" ${BranchListView.state.branch_type === 'Area Office' ? 'selected' : ''}>Area Office</option>
            <option value="Zone Office" ${BranchListView.state.branch_type === 'Zone Office' ? 'selected' : ''}>Zone Office</option>
          </select>

          <select id="branch-status-filter" class="form-select" style="width: 130px;">
            <option value="">All Status</option>
            <option value="active" ${BranchListView.state.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${BranchListView.state.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>

          <!-- Advanced Filters toggle button -->
          <button id="branch-adv-toggle-btn" onclick="BranchListView.toggleAdvanced()" style="display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:6px; border:1.5px solid ${hasAdvancedActive ? 'var(--primary,#1a56db)' : 'var(--border-color,#e2e8f0)'}; background:${hasAdvancedActive ? 'rgba(26,86,219,0.07)' : '#fff'}; font-size:13px; font-weight:500; color:${hasAdvancedActive ? 'var(--primary,#1a56db)' : 'var(--text-muted,#64748b)'}; cursor:pointer; transition:all 0.2s;" title="Toggle advanced filters">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Advanced Filters
            ${hasAdvancedActive
              ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--primary,#1a56db);color:#fff;font-size:10px;font-weight:700;">${activeAdvCount}</span>`
              : ''}
          </button>

          <button class="btn btn-secondary" onclick="BranchListView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="BranchListView.resetFilters()">Reset</button>
        </div>

        <!-- Row 2: Advanced filters — hidden by default, revealed by toggle -->
        <div id="branch-advanced-panel" style="display:${hasAdvancedActive ? 'flex' : 'none'}; flex-wrap:wrap; align-items:center; gap:10px; margin-top:10px; padding:12px 14px; background:#f8fafc; border:1px solid var(--border-color,#e2e8f0); border-radius:8px; animation: fadeIn 0.18s ease;">
          <span style="font-size:12px; font-weight:600; color:var(--text-muted,#64748b); text-transform:uppercase; letter-spacing:0.5px; margin-right:4px;">Advanced:</span>

          <select id="branch-team-filter" class="form-select" style="width: 180px;">
            <option value="">All Teams</option>
            ${assignedTeams.length === 0
              ? '<option disabled>— No teams assigned to any MFI —</option>'
              : assignedTeams.map(t => `<option value="${t.id}" ${BranchListView.state.team_id == t.id ? 'selected' : ''}>${t.team_name} (${t.team_code})</option>`).join('')
            }
          </select>

          <select id="branch-member-filter" class="form-select" style="width: 200px;">
            <option value="">All Team Members</option>
            ${assignedMembers.length === 0
              ? '<option disabled>— No members linked to branches —</option>'
              : assignedMembers.map(m => `<option value="${m.id}" ${BranchListView.state.team_member_id == m.id ? 'selected' : ''}>${m.member_name} (${m.member_code})</option>`).join('')
            }
          </select>

          <label id="branch-pending-billable-toggle" style="display:inline-flex; align-items:center; gap:7px; cursor:pointer; padding:7px 14px; border-radius:6px; border:1.5px solid ${BranchListView.state.pending_billable === '1' ? 'var(--warning,#d97706)' : 'var(--border-color,#e2e8f0)'}; background:${BranchListView.state.pending_billable === '1' ? 'rgba(217,119,6,0.08)' : '#fff'}; font-size:13px; font-weight:500; color:${BranchListView.state.pending_billable === '1' ? 'var(--warning,#d97706)' : 'var(--text-secondary,#475569)'}; user-select:none; transition:all 0.2s;" title="Shows only Branch Office type branches whose first bill date (Software Start + Grace Period) has not yet arrived">
            <input type="checkbox" id="branch-pending-billable" style="display:none;" ${BranchListView.state.pending_billable === '1' ? 'checked' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            Pending Billable Branch
            <span style="font-size:10px; opacity:0.7; font-weight:400;">(Branch Office only)</span>
          </label>

          <div style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:4px 8px; border:1px solid var(--border-color,#e2e8f0); border-radius:6px;">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary,#475569);">From:</span>
            <input type="date" id="branch-from-date" class="form-control" style="width: 135px; padding: 4px 6px; font-size: 12px;" value="${BranchListView.state.from_date}" title="Software Start Date From">
          </div>

          <div style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:4px 8px; border:1px solid var(--border-color,#e2e8f0); border-radius:6px;">
            <span style="font-size:12px; font-weight:600; color:var(--text-secondary,#475569);">To:</span>
            <input type="date" id="branch-to-date" class="form-control" style="width: 135px; padding: 4px 6px; font-size: 12px;" value="${BranchListView.state.to_date}" title="Software Start Date To">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>MFI</th>
                <th>Branch Name</th>
                <th>Branch Code</th>
                <th>Branch Opening Date</th>
                <th>Software Start Date</th>
                <th>Billable Month</th>
                <th>Branch Type</th>
                <th>Status</th>
                <th style="text-align: right; width: 120px;">Actions</th>
              </tr>
            </thead>
            <tbody id="branch-table-body">
              <tr><td colspan="10" style="text-align:center; padding: 30px;">Loading branches...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="branch-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('branch-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') BranchListView.applyFilters();
    });

    ['branch-mfi-filter', 'branch-type-filter', 'branch-status-filter', 'branch-team-filter', 'branch-member-filter', 'branch-from-date', 'branch-to-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => BranchListView.applyFilters());
      }
    });

    // Pending billable toggle visual feedback
    const pendingCheckbox = document.getElementById('branch-pending-billable');
    const pendingLabel = document.getElementById('branch-pending-billable-toggle');
    if (pendingCheckbox && pendingLabel) {
      pendingCheckbox.addEventListener('change', () => {
        const checked = pendingCheckbox.checked;
        pendingLabel.style.borderColor = checked ? 'var(--warning,#d97706)' : 'var(--border-color,#e2e8f0)';
        pendingLabel.style.background = checked ? 'rgba(217,119,6,0.08)' : '#fff';
        pendingLabel.style.color = checked ? 'var(--warning,#d97706)' : 'var(--text-secondary,#475569)';
        BranchListView.applyFilters();
      });
      pendingLabel.addEventListener('click', () => {
        pendingCheckbox.checked = !pendingCheckbox.checked;
        pendingCheckbox.dispatchEvent(new Event('change'));
      });
    }

    await BranchListView.fetchData();
  },

  toggleAdvanced() {
    const panel = document.getElementById('branch-advanced-panel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
    const btn = document.getElementById('branch-adv-toggle-btn');
    if (btn) {
      const hasActive = BranchListView.state.team_id || BranchListView.state.team_member_id || BranchListView.state.pending_billable === '1' || BranchListView.state.from_date || BranchListView.state.to_date;
      btn.style.borderColor = (hasActive || !isVisible) ? 'var(--primary,#1a56db)' : 'var(--border-color,#e2e8f0)';
      btn.style.background = (hasActive || !isVisible) ? 'rgba(26,86,219,0.07)' : '#fff';
      btn.style.color = (hasActive || !isVisible) ? 'var(--primary,#1a56db)' : 'var(--text-muted,#64748b)';
    }
  },

  async fetchData() {
    const { page, limit, search, mfi_id, branch_type, status, team_id, team_member_id, pending_billable, from_date, to_date } = BranchListView.state;
    const url = `/api/branches?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&mfi_id=${encodeURIComponent(mfi_id)}&branch_type=${encodeURIComponent(branch_type)}&status=${encodeURIComponent(status)}&team_id=${encodeURIComponent(team_id)}&team_member_id=${encodeURIComponent(team_member_id)}&pending_billable=${encodeURIComponent(pending_billable)}&from_date=${encodeURIComponent(from_date)}&to_date=${encodeURIComponent(to_date)}`;
    const res = await fetch(url);
    const result = await res.json();

    const tbody = document.getElementById('branch-table-body');
    const paginationBox = document.getElementById('branch-pagination-box');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state">
              <h3 class="empty-state-title">No Branches Found</h3>
              <p class="empty-state-text">No branch records match the filter criteria.</p>
              <a href="/branches/create" class="btn btn-primary btn-sm">Add New Branch</a>
            </div>
          </td>
        </tr>
      `;
      paginationBox.innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(b => `
      <tr>
        <td><strong>${b.sl}</strong></td>
        <td>
          <a href="/mfi/${b.mfi_id}" style="font-weight: 600; color: var(--primary);">
            <span class="badge badge-neutral" style="font-weight: 700;">${b.mfi_short_name}</span>
          </a>
        </td>
        <td style="font-weight: 600;">${b.branch_name}</td>
        <td><code>${b.branch_code}</code></td>
        <td>${b.branch_opening_date_formatted}</td>
        <td>${b.software_start_date_formatted}</td>
        <td><strong>${b.billable_month}</strong></td>
        <td><span class="badge badge-neutral">${b.branch_type}</span></td>
        <td>
          <span class="badge ${b.status === 'active' ? 'badge-active' : 'badge-inactive'}">
            <span class="badge-dot"></span>
            ${b.status.toUpperCase()}
          </span>
        </td>
        <td class="table-actions-cell">
          <div class="table-actions-group">
            <a href="/branches/${b.id}/edit" class="action-btn action-btn-edit" title="Edit Branch">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button class="action-btn action-btn-status ${b.status === 'active' ? 'is-active' : 'is-inactive'}" onclick="BranchListView.toggleStatus(${b.id}, '${b.status === 'active' ? 'inactive' : 'active'}')" title="${b.status === 'active' ? 'Deactivate Branch' : 'Activate Branch'}">
              ${b.status === 'active'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>'}
            </button>
            <button class="action-btn action-btn-delete" onclick="BranchListView.deleteBranch(${b.id}, '${escape(b.branch_name)}')" title="Delete Branch">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    paginationBox.innerHTML = UI.renderPagination(result.pagination, 'BranchListView.goToPage');
  },

  applyFilters() {
    BranchListView.state.search = document.getElementById('branch-search').value.trim();
    BranchListView.state.mfi_id = document.getElementById('branch-mfi-filter').value;
    BranchListView.state.branch_type = document.getElementById('branch-type-filter').value;
    BranchListView.state.status = document.getElementById('branch-status-filter').value;
    BranchListView.state.team_id = document.getElementById('branch-team-filter').value;
    BranchListView.state.team_member_id = document.getElementById('branch-member-filter').value;
    BranchListView.state.pending_billable = document.getElementById('branch-pending-billable').checked ? '1' : '';
    const fromEl = document.getElementById('branch-from-date');
    BranchListView.state.from_date = fromEl ? fromEl.value : '';
    const toEl = document.getElementById('branch-to-date');
    BranchListView.state.to_date = toEl ? toEl.value : '';
    BranchListView.state.page = 1;
    BranchListView.fetchData();
  },

  resetFilters() {
    document.getElementById('branch-search').value = '';
    document.getElementById('branch-mfi-filter').value = '';
    document.getElementById('branch-type-filter').value = '';
    document.getElementById('branch-status-filter').value = '';
    const teamFilter = document.getElementById('branch-team-filter');
    if (teamFilter) teamFilter.value = '';
    const memberFilter = document.getElementById('branch-member-filter');
    if (memberFilter) memberFilter.value = '';
    const pendingCb = document.getElementById('branch-pending-billable');
    if (pendingCb) { pendingCb.checked = false; pendingCb.dispatchEvent(new Event('change')); }
    const fromEl = document.getElementById('branch-from-date');
    if (fromEl) fromEl.value = '';
    const toEl = document.getElementById('branch-to-date');
    if (toEl) toEl.value = '';
    BranchListView.state = { page: 1, limit: 10, search: '', mfi_id: '', branch_type: '', status: '', team_id: '', team_member_id: '', pending_billable: '', from_date: '', to_date: '' };
    BranchListView.fetchData();
  },

  goToPage(p) {
    BranchListView.state.page = p;
    BranchListView.fetchData();
  },

  toggleStatus(id, newStatus) {
    UI.confirm(
      `Change status of this branch to <strong>${newStatus}</strong>?`,
      async () => {
        try {
          const res = await fetch(`/api/branches/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          UI.toast('success', 'Branch Status Updated', data.message);
          BranchListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Error', err.message);
        }
      }
    );
  },

  deleteBranch(id, nameEscaped) {
    const name = unescape(nameEscaped);
    UI.confirm(
      `Are you sure you want to delete branch <strong>${name}</strong>?<br><span style="color:var(--danger); font-size:12px;">This will remove the branch record from the system.</span>`,
      async () => {
        try {
          const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
          const data = await UI.parseResponse(res);
          UI.toast('success', 'Branch Deleted', data.message);
          BranchListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete Branch Office', confirmText: 'Delete Branch', isDanger: true }
    );
  },

  export(format) {
    const { search, mfi_id, branch_type, status, team_id, team_member_id, pending_billable, from_date, to_date } = BranchListView.state;
    window.open(`/api/branches/export?format=${format}&search=${encodeURIComponent(search)}&mfi_id=${encodeURIComponent(mfi_id)}&branch_type=${encodeURIComponent(branch_type)}&status=${encodeURIComponent(status)}&team_id=${encodeURIComponent(team_id)}&team_member_id=${encodeURIComponent(team_member_id)}&pending_billable=${encodeURIComponent(pending_billable)}&from_date=${encodeURIComponent(from_date)}&to_date=${encodeURIComponent(to_date)}`, '_blank');
  }
};

const BranchFormView = {
  async render(container, id = null) {
    let isEdit = !!id;
    let branch = {
      mfi_id: '',
      branch_name: '',
      branch_code: '',
      branch_opening_date: '',
      software_start_date: '',
      billable_month: new Date().toISOString().substring(0, 7),
      branch_type: 'Branch Office',
      status: 'active'
    };

    // Pre-selected MFI if given in query params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mfi_id')) branch.mfi_id = urlParams.get('mfi_id');

    if (isEdit) {
      const res = await fetch(`/api/branches/${id}`);
      if (!res.ok) throw new Error('Failed to load branch details.');
      const data = await res.json();
      branch = data.data;
    }

    // Load MFIs for autocomplete
    const mfiRes = await fetch('/api/mfis/autocomplete');
    const mfiData = await mfiRes.json();
    const mfis = mfiData.data || [];

    const selectedMfi = mfis.find(m => m.id == branch.mfi_id);

    container.innerHTML = `
      <div class="form-page-wrapper">
        <div class="page-header">
          <div>
            <h1 class="page-title">${isEdit ? `Edit Branch: ${branch.branch_name}` : 'Add New Branch'}</h1>
            <p class="page-subtitle">${isEdit ? 'Update branch configuration and operating dates' : 'Register a new institutional branch under an MFI'}</p>
          </div>
          <div class="page-actions">
            <a href="/branches" class="btn btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              <span>Back to Branch List</span>
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Branch Master Form</h3>
          </div>
          <div class="card-body">
            <form id="branch-form">
              <!-- Searchable MFI Selection (BRD Requirement) -->
              <div class="form-group">
                <label class="form-label" for="mfi_autocomplete_input">Select MFI (Search by short name or full name) <span class="required-star">*</span></label>
                <div class="autocomplete-wrapper">
                  <input type="text" id="mfi_autocomplete_input" class="form-control" placeholder="Type first 3 letters or MFI name (e.g. SSS)..." value="${selectedMfi ? `${selectedMfi.short_name} — ${selectedMfi.full_name}` : ''}" autocomplete="off">
                  <input type="hidden" id="mfi_id" value="${branch.mfi_id || ''}">
                  <div class="autocomplete-menu" id="mfi-autocomplete-dropdown"></div>
                </div>
                <div class="invalid-feedback" id="err-mfi_id"></div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="branch_name">Branch Name <span class="required-star">*</span></label>
                  <input type="text" id="branch_name" class="form-control" required placeholder="e.g. Mirzapur Branch" value="${branch.branch_name}">
                  <div class="invalid-feedback" id="err-branch_name"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="branch_code">Branch Code <span class="required-star">*</span></label>
                  <input type="text" id="branch_code" class="form-control" required placeholder="e.g. 1003" value="${branch.branch_code}">
                  <div class="form-hint">Must be unique within the selected MFI.</div>
                  <div class="invalid-feedback" id="err-branch_code"></div>
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group">
                  <label class="form-label" for="branch_opening_date">Branch Opening Date <span class="required-star">*</span></label>
                  <input type="date" id="branch_opening_date" class="form-control" required value="${UI.formatDate(branch.branch_opening_date)}">
                  <div class="invalid-feedback" id="err-branch_opening_date"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="software_start_date">Software Start Date <span class="required-star">*</span></label>
                  <input type="date" id="software_start_date" class="form-control" required value="${UI.formatDate(branch.software_start_date)}">
                  <div class="invalid-feedback" id="err-software_start_date"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="billable_month">Billable Month <span class="required-star">*</span></label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="month" id="billable_month" class="form-control"
                      value="${branch.billable_month || ''}"
                      style="font-weight: 700; color: var(--primary); flex:1;">
                    <button type="button" id="btn-recalc-billable" onclick="BranchFormView.recomputeBillableMonth(true)"
                      style="white-space:nowrap; padding:8px 14px; border-radius:6px; border:1.5px solid var(--border-color,#e2e8f0); background:#fff; font-size:12px; font-weight:600; color:var(--text-secondary,#475569); cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;"
                      title="Recalculate from Software Start Date &amp; MFI Grace Period">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      Recalculate
                    </button>
                  </div>
                  <div class="form-hint">Auto-calculated from Software Start Date + Grace Period (Day ≤ 15 = same month; Day &gt; 15 = next month). You may override manually.</div>
                  <div class="invalid-feedback" id="err-billable_month"></div>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="branch_type">Branch Type <span class="required-star">*</span></label>
                  <select id="branch_type" class="form-select">
                    <option value="Branch Office" ${branch.branch_type === 'Branch Office' ? 'selected' : ''}>Branch Office</option>
                    <option value="Area Office" ${branch.branch_type === 'Area Office' ? 'selected' : ''}>Area Office</option>
                    <option value="Zone Office" ${branch.branch_type === 'Zone Office' ? 'selected' : ''}>Zone Office</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="branch_status">Status <span class="required-star">*</span></label>
                  <select id="branch_status" class="form-select">
                    <option value="active" ${branch.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${branch.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
              </div>

              <div class="form-row-actions">
                <button type="submit" id="save-branch-btn" class="btn btn-primary btn-lg">
                  <span>${isEdit ? 'Update Branch' : 'Create Branch'}</span>
                </button>
                <a href="/branches" class="btn btn-secondary btn-lg">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Setup autocomplete logic
    BranchFormView.initMfiAutocomplete(mfis);

    // Track if user manually edits the billable month
    document.getElementById('billable_month').addEventListener('input', (e) => {
      e.target.dataset.manual = 'true';
    });

    // Auto-compute billable month when software_start_date changes
    document.getElementById('software_start_date').addEventListener('change', () => {
      BranchFormView.recomputeBillableMonth(false);
    });

    // If editing — populate grace period on the hidden field from loaded branch
    if (isEdit && branch.mfi_id) {
      // Fetch grace period for the already-selected MFI
      fetch(`/api/mfis/${branch.mfi_id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            document.getElementById('mfi_id').dataset.grace = d.data.mfi.om_grace_period_months ?? 0;
            BranchFormView.recomputeBillableMonth(true);
          }
        })
        .catch(() => {});
    }

    // Form submit listener
    document.getElementById('branch-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
      document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));

      const mfi_id = document.getElementById('mfi_id').value;
      const branch_name = document.getElementById('branch_name').value.trim();
      const branch_code = document.getElementById('branch_code').value.trim();
      const branch_opening_date = document.getElementById('branch_opening_date').value;
      const software_start_date = document.getElementById('software_start_date').value;
      const billable_month = document.getElementById('billable_month').value;
      const branch_type = document.getElementById('branch_type').value;
      const status = document.getElementById('branch_status').value;

      let hasError = false;
      if (!mfi_id) {
        document.getElementById('err-mfi_id').textContent = 'Please select a valid MFI.';
        document.getElementById('mfi_autocomplete_input').classList.add('is-invalid');
        hasError = true;
      }
      if (!branch_name) {
        document.getElementById('err-branch_name').textContent = 'Branch Name is required.';
        document.getElementById('branch_name').classList.add('is-invalid');
        hasError = true;
      }
      if (!branch_code) {
        document.getElementById('err-branch_code').textContent = 'Branch Code is required.';
        document.getElementById('branch_code').classList.add('is-invalid');
        hasError = true;
      }
      if (!branch_opening_date) {
        document.getElementById('err-branch_opening_date').textContent = 'Branch Opening Date is required.';
        document.getElementById('branch_opening_date').classList.add('is-invalid');
        hasError = true;
      }
      if (!software_start_date) {
        document.getElementById('err-software_start_date').textContent = 'Software Start Date is required.';
        document.getElementById('software_start_date').classList.add('is-invalid');
        hasError = true;
      }
      if (!billable_month) {
        document.getElementById('err-billable_month').textContent = 'Billable Month is required.';
        document.getElementById('billable_month').classList.add('is-invalid');
        hasError = true;
      }

      if (hasError) return;

      const payload = {
        mfi_id: parseInt(mfi_id),
        branch_name,
        branch_code,
        branch_opening_date,
        software_start_date,
        billable_month,
        branch_type,
        status
      };

      const saveBtn = document.getElementById('save-branch-btn');
      saveBtn.disabled = true;

      try {
        const url = isEdit ? `/api/branches/${id}` : '/api/branches';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Validation error');

        UI.toast('success', 'Branch Saved', data.message);
        Router.navigate('/branches');
      } catch (err) {
        const msg = err.message || '';
        let mapped = false;
        const fieldMap = [
          { pattern: /branch.?name/i,         field: 'branch_name' },
          { pattern: /branch.?code/i,          field: 'branch_code' },
          { pattern: /opening.?date/i,         field: 'branch_opening_date' },
          { pattern: /software.?start/i,       field: 'software_start_date' },
          { pattern: /billable.?month/i,       field: 'billable_month' },
          { pattern: /mfi/i,                   field: 'mfi_autocomplete_input' },
        ];
        fieldMap.forEach(({ pattern, field }) => {
          if (pattern.test(msg)) {
            const el = document.getElementById(field);
            const errId = field === 'mfi_autocomplete_input' ? 'err-mfi_id' : `err-${field}`;
            const errEl = document.getElementById(errId);
            if (el && errEl) { el.classList.add('is-invalid'); errEl.textContent = msg; mapped = true; }
          }
        });
        if (!mapped) UI.toast('danger', 'Error Saving Branch', msg);
        saveBtn.disabled = false;
      }
    });
  },

  initMfiAutocomplete(mfis) {
    const input = document.getElementById('mfi_autocomplete_input');
    const hiddenId = document.getElementById('mfi_id');
    const menu = document.getElementById('mfi-autocomplete-dropdown');

    if (!input || !menu) return;

    let debounceTimer;

    const doSearch = async () => {
      const q = input.value.trim();
      try {
        const res = await fetch(`/api/mfis/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const matches = data.data || [];

        if (matches.length === 0) {
          menu.innerHTML = '<div class="autocomplete-empty">No matching MFI found</div>';
        } else {
          menu.innerHTML = matches.map(m => `
            <div class="autocomplete-item" data-id="${m.id}" data-grace="${m.om_grace_period_months ?? 0}" data-name="${m.short_name} — ${m.full_name}">
              <div style="font-weight: 600; color: var(--primary);">${m.short_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${m.full_name}</div>
            </div>
          `).join('');
        }
        menu.classList.add('show');
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      }
    };

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      if (!input.value.trim()) {
        hiddenId.value = '';
      }
      debounceTimer = setTimeout(doSearch, 200);
    });

    input.addEventListener('focus', () => {
      doSearch();
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;

      hiddenId.value = item.dataset.id;
      hiddenId.dataset.grace = item.dataset.grace ?? 0;
      input.value = item.dataset.name;
      input.classList.remove('is-invalid');
      menu.classList.remove('show');
      BranchFormView.recomputeBillableMonth(false);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
      }
    });
  },

  /**
   * Mirrors server-side computeBillableMonth logic in the browser.
   * Rule: day <= 15 → current month is full month; day > 15 → skip to next month.
   * Then add MFI om_grace_period_months.
   */
  /**
   * Recomputes the billable month and optionally forces a UI update.
   * @param {boolean} forceUpdate - If true, always overwrite the field value (e.g., Recalculate button).
   *                                If false (default), only set if the field is currently empty.
   */
  recomputeBillableMonth(forceUpdate = false) {
    const softwareStartEl = document.getElementById('software_start_date');
    const billableEl      = document.getElementById('billable_month');
    const mfiIdEl         = document.getElementById('mfi_id');

    if (!softwareStartEl || !billableEl) return;

    const dateVal = softwareStartEl.value;
    if (!dateVal) {
      if (forceUpdate) {
        billableEl.value = '';
        billableEl.dataset.manual = 'false';
      }
      return;
    }

    // Do not auto-compute if the user has manually edited, UNLESS explicitly forced
    if (!forceUpdate && billableEl.dataset.manual === 'true') {
      return;
    }

    const date  = new Date(dateVal + 'T00:00:00'); // parse as local date
    const day   = date.getDate();
    const grace = parseInt(mfiIdEl?.dataset?.grace || '0', 10) || 0;

    // Step 1: determine base month (0-indexed)
    let baseYear  = date.getFullYear();
    let baseMonth = date.getMonth(); // 0-indexed

    if (day > 15) {
      // Partial month — skip to next month
      baseMonth += 1;
      if (baseMonth > 11) { baseMonth = 0; baseYear += 1; }
    }

    // Step 2: add grace period (handles negative grace too)
    baseMonth += grace;
    baseYear  += Math.floor(baseMonth / 12);
    baseMonth  = ((baseMonth % 12) + 12) % 12;

    const yyyy = String(baseYear).padStart(4, '0');
    const mm   = String(baseMonth + 1).padStart(2, '0');
    const computed = `${yyyy}-${mm}`;

    billableEl.value = computed;
    if (forceUpdate) {
        billableEl.dataset.manual = 'false';
    }
  }
};

// ==========================================
// 6. AGREEMENT & RENEWAL VIEWS (List, Form)
// ==========================================
const AgreementListView = {
  state: { page: 1, limit: 10, search: '', mfi_id: '', start_date: '', end_date: '' },

  async render(container) {
    const mfiRes = await fetch('/api/mfis/autocomplete');
    const mfiData = await mfiRes.json();
    AppState.cachedMfis = mfiData.data || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Agreement & Renewal Management</h1>
        </div>
        <div class="page-actions">
          <a href="/agreements/create" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add Renewal Agreement</span>
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="agr-search" class="form-control" placeholder="Search MFI or remarks..." value="${AgreementListView.state.search}">
          </div>

          <select id="agr-mfi-filter" class="form-select" style="width: 200px;">
            <option value="">All MFIs</option>
            ${AppState.cachedMfis.map(m => `
              <option value="${m.id}" ${AgreementListView.state.mfi_id == m.id ? 'selected' : ''}>${m.short_name} - ${m.full_name}</option>
            `).join('')}
          </select>

          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; color:var(--text-muted);">From:</span>
            <input type="date" id="agr-start-date" class="form-control" style="width:140px;" value="${AgreementListView.state.start_date}">
          </div>

          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; color:var(--text-muted);">To:</span>
            <input type="date" id="agr-end-date" class="form-control" style="width:140px;" value="${AgreementListView.state.end_date}">
          </div>

          <button class="btn btn-secondary" onclick="AgreementListView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="AgreementListView.resetFilters()">Reset</button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>MFI</th>
                <th>Agreement / Renewal Date</th>
                <th>Agreement Expire Date</th>
                <th>License Fee per Branch</th>
                <th>O&M Fee per Branch</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Created By</th>
                <th>Created Date</th>
                <th style="text-align: right; width: 100px;">Actions</th>
              </tr>
            </thead>
            <tbody id="agr-table-body">
              <tr><td colspan="11" style="text-align:center; padding: 30px;">Loading agreements...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="agr-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('agr-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') AgreementListView.applyFilters();
    });

    await AgreementListView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, mfi_id, start_date, end_date } = AgreementListView.state;
    const url = `/api/agreements?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&mfi_id=${encodeURIComponent(mfi_id)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
    const res = await fetch(url);
    const result = await res.json();

    const tbody = document.getElementById('agr-table-body');
    const paginationBox = document.getElementById('agr-pagination-box');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11">
            <div class="empty-state">
              <h3 class="empty-state-title">No Agreements Found</h3>
              <p class="empty-state-text">No agreement records match your search criteria.</p>
              <a href="/agreements/create" class="btn btn-primary btn-sm">Record Agreement Renewal</a>
            </div>
          </td>
        </tr>
      `;
      paginationBox.innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(a => `
      <tr>
        <td><strong>${a.sl}</strong></td>
        <td>
          <a href="/mfi/${a.mfi_id}" style="font-weight: 600; color: var(--primary);">
            <span class="badge badge-neutral" style="font-weight: 700;">${a.mfi_short_name}</span>
            ${a.mfi_full_name}
          </a>
        </td>
        <td><strong>${a.agreement_date_formatted}</strong></td>
        <td>${a.agreement_expire_date ? UI.formatDate(a.agreement_expire_date) : '<span style="color:var(--text-muted);">Not Set</span>'}</td>
        <td><strong style="color: var(--primary);">${UI.formatCurrency(a.license_fee_per_branch)}</strong></td>
        <td><strong style="color: var(--warning);">${UI.formatCurrency(a.om_fee_per_branch)}</strong></td>
        <td>
          ${a.is_upcoming ? '<span class="badge badge-upcoming"><span class="badge-dot"></span> Upcoming</span>' : '<span class="badge badge-neutral">Active / Historical</span>'}
        </td>
        <td style="color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${a.remarks || '—'}</td>
        <td>${a.creator_name || 'System'}</td>
        <td style="color: var(--text-light);">${a.created_at_formatted}</td>
        <td class="table-actions-cell">
          <div class="table-actions-group">
            <button class="action-btn action-btn-edit" onclick="AgreementListView.openEditModal(${a.id})" title="Edit Agreement">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn action-btn-delete" onclick="AgreementListView.deleteAgreement(${a.id}, '${a.agreement_date_formatted}', '${escape(a.mfi_short_name)}')" title="Delete Agreement">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    paginationBox.innerHTML = UI.renderPagination(result.pagination, 'AgreementListView.goToPage');
  },

  applyFilters() {
    AgreementListView.state.search = document.getElementById('agr-search').value.trim();
    AgreementListView.state.mfi_id = document.getElementById('agr-mfi-filter').value;
    AgreementListView.state.start_date = document.getElementById('agr-start-date').value;
    AgreementListView.state.end_date = document.getElementById('agr-end-date').value;
    AgreementListView.state.page = 1;
    AgreementListView.fetchData();
  },

  resetFilters() {
    document.getElementById('agr-search').value = '';
    document.getElementById('agr-mfi-filter').value = '';
    document.getElementById('agr-start-date').value = '';
    document.getElementById('agr-end-date').value = '';
    AgreementListView.state = { page: 1, limit: 10, search: '', mfi_id: '', start_date: '', end_date: '' };
    AgreementListView.fetchData();
  },

  goToPage(p) {
    AgreementListView.state.page = p;
    AgreementListView.fetchData();
  },

  async openEditModal(id) {
    try {
      const res = await fetch(`/api/agreements/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load agreement');
      const agr = data.data;

      const bodyHtml = `
        <form id="modal-agr-edit-form">
          <div class="form-group">
            <label class="form-label">MFI</label>
            <input type="text" class="form-control" disabled value="${agr.mfi_short_name} — ${agr.mfi_full_name}">
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="edit_agr_date">Agreement Effective Date <span class="required-star">*</span></label>
              <input type="date" id="edit_agr_date" class="form-control" required value="${UI.formatDateForInput(agr.agreement_date)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="edit_agr_expire_date">Agreement Expire Date</label>
              <input type="date" id="edit_agr_expire_date" class="form-control" value="${UI.formatDateForInput(agr.agreement_expire_date)}">
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="edit_license_fee">License Fee per Branch <span class="required-star">*</span></label>
              <input type="number" step="0.01" min="0" id="edit_license_fee" class="form-control" required value="${agr.license_fee_per_branch}">
            </div>
            <div class="form-group">
              <label class="form-label" for="edit_om_fee">O&M Fee per Branch <span class="required-star">*</span></label>
              <input type="number" step="0.01" min="0" id="edit_om_fee" class="form-control" required value="${agr.om_fee_per_branch}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit_remarks">Agreement Remarks / Terms</label>
            <textarea id="edit_remarks" class="form-control">${agr.remarks || ''}</textarea>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-agr-save-btn">Save Changes</button>
      `;

      UI.showModal({ title: `Edit Agreement Renewal #${agr.id}`, bodyHtml, footerHtml });

      document.getElementById('modal-agr-save-btn').onclick = async () => {
        const agreement_date = document.getElementById('edit_agr_date').value;
        const agreement_expire_date = document.getElementById('edit_agr_expire_date').value || null;
        const license_fee_per_branch = parseFloat(document.getElementById('edit_license_fee').value);
        const om_fee_per_branch = parseFloat(document.getElementById('edit_om_fee').value);
        const remarks = document.getElementById('edit_remarks').value;

        if (!agreement_date || isNaN(license_fee_per_branch) || isNaN(om_fee_per_branch)) {
          UI.toast('danger', 'Validation', 'Please provide valid agreement date and fee values.');
          return;
        }

        try {
          const updateRes = await fetch(`/api/agreements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agreement_date, agreement_expire_date, license_fee_per_branch, om_fee_per_branch, remarks })
          });
          const updateData = await updateRes.json();
          if (!updateRes.ok) throw new Error(updateData.message);

          UI.closeModal();
          UI.toast('success', 'Agreement Updated', updateData.message);
          AgreementListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Update Failed', err.message);
        }
      };
    } catch (err) {
      UI.toast('danger', 'Error', err.message);
    }
  },

  deleteAgreement(id, date, mfiNameEscaped) {
    const mfiName = unescape(mfiNameEscaped);
    UI.confirm(
      `Are you sure you want to delete the agreement dated <strong>${date}</strong> for <strong>${mfiName}</strong>?<br><span style="color:var(--danger); font-size:12px;">Note: You cannot delete the only agreement record for an MFI.</span>`,
      async () => {
        try {
          const res = await fetch(`/api/agreements/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          UI.toast('success', 'Agreement Deleted', data.message);
          AgreementListView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete Agreement Record', confirmText: 'Delete Agreement', isDanger: true }
    );
  },

  export(format) {
    const { search, mfi_id, start_date, end_date } = AgreementListView.state;
    window.open(`/api/agreements/export?format=${format}&search=${encodeURIComponent(search)}&mfi_id=${encodeURIComponent(mfi_id)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`, '_blank');
  }
};

const AgreementFormView = {
  async render(container) {
    const mfiRes = await fetch('/api/mfis/autocomplete');
    const mfiData = await mfiRes.json();
    const mfis = mfiData.data || [];

    const urlParams = new URLSearchParams(window.location.search);
    const preMfiId = urlParams.get('mfi_id') || '';
    const selectedMfi = mfis.find(m => m.id == preMfiId);

    container.innerHTML = `
      <div class="form-page-wrapper">
        <div class="page-header">
          <div>
            <h1 class="page-title">Record Agreement Renewal</h1>
            <p class="page-subtitle">Create a new agreement term with revised License and O&M fee structures</p>
          </div>
          <div class="page-actions">
            <a href="/agreements" class="btn btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              <span>Back to Agreements</span>
            </a>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Agreement Renewal Form</h3>
          </div>
          <div class="card-body">
            <form id="agreement-form">
              <!-- Autocomplete Search for MFI (BRD: First 3 letters, full name, short name) -->
              <div class="form-group">
                <label class="form-label" for="agr_mfi_autocomplete">Select MFI <span class="required-star">*</span></label>
                <div class="autocomplete-wrapper">
                  <input type="text" id="agr_mfi_autocomplete" class="form-control" placeholder="Search by typing (e.g. SSS or Social Services)..." value="${selectedMfi ? `${selectedMfi.short_name} — ${selectedMfi.full_name}` : ''}" autocomplete="off">
                  <input type="hidden" id="agr_mfi_id" value="${preMfiId}">
                  <div class="autocomplete-menu" id="agr-mfi-dropdown"></div>
                </div>
                <div class="form-hint">Search works with first 3 letters, short name, or full name.</div>
                <div class="invalid-feedback" id="err-agr_mfi_id"></div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="agreement_date">Agreement / Renewal Effective Date <span class="required-star">*</span></label>
                  <input type="date" id="agreement_date" class="form-control" required value="${new Date().toISOString().substring(0, 10)}">
                  <div class="form-hint">Effective date of agreement.</div>
                  <div class="invalid-feedback" id="err-agreement_date"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="agreement_expire_date">Agreement Expire Date</label>
                  <input type="date" id="agreement_expire_date" class="form-control">
                  <div class="form-hint">Date when this agreement expires. Triggers Renewal Alert when past.</div>
                  <div class="invalid-feedback" id="err-agreement_expire_date"></div>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="license_fee_per_branch">License Fee per Branch <span class="required-star">*</span></label>
                  <input type="number" step="0.01" min="0" id="license_fee_per_branch" class="form-control" required placeholder="0.00">
                  <div class="invalid-feedback" id="err-license_fee_per_branch"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="om_fee_per_branch">O&M Fee per Branch <span class="required-star">*</span></label>
                  <input type="number" step="0.01" min="0" id="om_fee_per_branch" class="form-control" required placeholder="0.00">
                  <div class="invalid-feedback" id="err-om_fee_per_branch"></div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="remarks">Agreement Remarks / Terms</label>
                <textarea id="remarks" class="form-control" placeholder="e.g. Bi-annual renewal signed with adjusted support SLA"></textarea>
              </div>

              <div class="form-row-actions">
                <button type="submit" id="save-agr-btn" class="btn btn-primary btn-lg">
                  <span>Save Agreement Renewal</span>
                </button>
                <a href="/agreements" class="btn btn-secondary btn-lg">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Initialize Autocomplete
    AgreementFormView.initMfiAutocomplete(mfis);

    // Form submit listener
    document.getElementById('agreement-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
      document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));

      const mfi_id = document.getElementById('agr_mfi_id').value;
      const agreement_date = document.getElementById('agreement_date').value;
      const agreement_expire_date = document.getElementById('agreement_expire_date').value || null;
      const license_fee_per_branch = document.getElementById('license_fee_per_branch').value;
      const om_fee_per_branch = document.getElementById('om_fee_per_branch').value;
      const remarks = document.getElementById('remarks').value;

      let hasError = false;
      if (!mfi_id) {
        document.getElementById('err-agr_mfi_id').textContent = 'Please select a valid MFI.';
        document.getElementById('agr_mfi_autocomplete').classList.add('is-invalid');
        hasError = true;
      }
      if (!agreement_date) {
        document.getElementById('err-agreement_date').textContent = 'Agreement Renewal Date is required.';
        document.getElementById('agreement_date').classList.add('is-invalid');
        hasError = true;
      }
      if (!license_fee_per_branch || parseFloat(license_fee_per_branch) < 0) {
        document.getElementById('err-license_fee_per_branch').textContent = 'License Fee cannot be negative.';
        document.getElementById('license_fee_per_branch').classList.add('is-invalid');
        hasError = true;
      }
      if (!om_fee_per_branch || parseFloat(om_fee_per_branch) < 0) {
        document.getElementById('err-om_fee_per_branch').textContent = 'O&M Fee cannot be negative.';
        document.getElementById('om_fee_per_branch').classList.add('is-invalid');
        hasError = true;
      }

      if (hasError) return;

      const payload = {
        mfi_id: parseInt(mfi_id),
        agreement_date,
        agreement_expire_date,
        license_fee_per_branch: parseFloat(license_fee_per_branch),
        om_fee_per_branch: parseFloat(om_fee_per_branch),
        remarks
      };

      const saveBtn = document.getElementById('save-agr-btn');
      saveBtn.disabled = true;

      try {
        const res = await fetch('/api/agreements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Validation error');

        UI.toast('success', 'Agreement Saved', data.message);
        Router.navigate(`/mfi/${mfi_id}`);
      } catch (err) {
        const msg = err.message || '';
        let mapped = false;
        const fieldMap = [
          { pattern: /mfi/i,                         field: 'agr_mfi_autocomplete', errId: 'err-agr_mfi_id' },
          { pattern: /agreement.?date|renewal.?date/i, field: 'agreement_date',       errId: 'err-agreement_date' },
          { pattern: /license.?fee/i,                field: 'license_fee_per_branch', errId: 'err-license_fee_per_branch' },
          { pattern: /o.*m.?fee|om.?fee/i,            field: 'om_fee_per_branch',     errId: 'err-om_fee_per_branch' },
        ];
        fieldMap.forEach(({ pattern, field, errId }) => {
          if (pattern.test(msg)) {
            const el = document.getElementById(field);
            const errEl = document.getElementById(errId || `err-${field}`);
            if (el && errEl) { el.classList.add('is-invalid'); errEl.textContent = msg; mapped = true; }
          }
        });
        if (!mapped) UI.toast('danger', 'Error Saving Agreement', msg);
        saveBtn.disabled = false;
      }
    });
  },

  initMfiAutocomplete(mfis) {
    const input = document.getElementById('agr_mfi_autocomplete');
    const hiddenId = document.getElementById('agr_mfi_id');
    const menu = document.getElementById('agr-mfi-dropdown');

    if (!input || !menu) return;

    let debounceTimer;

    const doSearch = async () => {
      const q = input.value.trim();
      try {
        const res = await fetch(`/api/mfis/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const matches = data.data || [];

        if (matches.length === 0) {
          menu.innerHTML = '<div class="autocomplete-empty">No matching MFI found</div>';
        } else {
          menu.innerHTML = matches.map(m => `
            <div class="autocomplete-item" data-id="${m.id}" data-name="${m.short_name} — ${m.full_name}">
              <div style="font-weight: 600; color: var(--primary);">${m.short_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${m.full_name}</div>
            </div>
          `).join('');
        }
        menu.classList.add('show');
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      }
    };

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      if (!input.value.trim()) {
        hiddenId.value = '';
      }
      debounceTimer = setTimeout(doSearch, 200);
    });

    input.addEventListener('focus', () => {
      doSearch();
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;

      hiddenId.value = item.dataset.id;
      input.value = item.dataset.name;
      input.classList.remove('is-invalid');
      menu.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
      }
    });
  }
};

// ==========================================
// 7. USER & ROLE MANAGEMENT VIEWS
// ==========================================
const UsersView = {
  state: { page: 1, limit: 10, search: '', role_id: '', status: '' },

  async render(container) {
    const rolesRes = await fetch('/api/roles');
    const rolesData = await rolesRes.json();
    const roles = rolesData.data || [];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">User Accounts</h1>
          <p class="page-subtitle">Manage administrative staff, role assignments, and authentication status</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="UsersView.openAddModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add User</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="user-search" class="form-control" placeholder="Search by Name, Login ID, Email..." value="${UsersView.state.search}">
          </div>

          <select id="user-role-filter" class="form-select" style="width: 160px;">
            <option value="">All Roles</option>
            ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
          </select>

          <select id="user-status-filter" class="form-select" style="width: 130px;">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button class="btn btn-secondary" onclick="UsersView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="UsersView.resetFilters()">Reset</button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>Full Name</th>
                <th>Login ID</th>
                <th>Email</th>
                <th>Mobile Number</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr><td colspan="9" style="text-align:center; padding: 30px;">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="users-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('user-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') UsersView.applyFilters();
    });

    await UsersView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, role_id, status } = UsersView.state;
    const url = `/api/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&role_id=${encodeURIComponent(role_id)}&status=${encodeURIComponent(status)}`;
    const res = await fetch(url);
    const result = await res.json();

    const tbody = document.getElementById('users-table-body');
    const paginationBox = document.getElementById('users-pagination-box');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px;">No user records found.</td></tr>`;
      paginationBox.innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(u => `
      <tr>
        <td><strong>${u.sl}</strong></td>
        <td style="font-weight: 600;">${u.name}</td>
        <td><code>${u.login_id}</code></td>
        <td>${u.email || '—'}</td>
        <td>${u.mobile || '—'}</td>
        <td><span class="badge badge-current">${u.role_name || 'No Role'}</span></td>
        <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${u.status.toUpperCase()}</span></td>
        <td style="color: var(--text-muted);">${u.last_login_at_formatted}</td>
        <td class="table-actions-cell">
          <div class="table-actions-group">
            <button class="action-btn action-btn-edit" onclick="UsersView.openEditModal(${u.id})" title="Edit User">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn action-btn-pwd" onclick="UsersView.openResetPasswordModal(${u.id}, '${u.login_id}')" title="Reset Password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </button>
            <button class="action-btn action-btn-status ${u.status === 'active' ? 'is-active' : 'is-inactive'}" onclick="UsersView.toggleStatus(${u.id}, '${u.status === 'active' ? 'inactive' : 'active'}')" title="${u.status === 'active' ? 'Deactivate User' : 'Activate User'}">
              ${u.status === 'active'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>'}
            </button>
            ${u.id === 1 ? '' : `
              <button class="action-btn action-btn-delete" onclick="UsersView.deleteUser(${u.id}, '${escape(u.login_id)}')" title="Delete User">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            `}
          </div>
        </td>
      </tr>
    `).join('');

    paginationBox.innerHTML = UI.renderPagination(result.pagination, 'UsersView.goToPage');
  },

  applyFilters() {
    UsersView.state.search = document.getElementById('user-search').value.trim();
    UsersView.state.role_id = document.getElementById('user-role-filter').value;
    UsersView.state.status = document.getElementById('user-status-filter').value;
    UsersView.state.page = 1;
    UsersView.fetchData();
  },

  resetFilters() {
    document.getElementById('user-search').value = '';
    document.getElementById('user-role-filter').value = '';
    document.getElementById('user-status-filter').value = '';
    UsersView.state = { page: 1, limit: 10, search: '', role_id: '', status: '' };
    UsersView.fetchData();
  },

  goToPage(p) {
    UsersView.state.page = p;
    UsersView.fetchData();
  },

  async openAddModal() {
    const rolesRes = await fetch('/api/roles');
    const rolesData = await rolesRes.json();
    const roles = rolesData.data || [];

    const bodyHtml = `
      <form id="modal-user-form">
        <div class="form-group">
          <label class="form-label" for="modal_user_name">Full Name <span class="required-star">*</span></label>
          <input type="text" id="modal_user_name" class="form-control" required placeholder="Full Name">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="modal_user_login">Login ID <span class="required-star">*</span></label>
            <input type="text" id="modal_user_login" class="form-control" required placeholder="User ID" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label" for="modal_user_role">Role <span class="required-star">*</span></label>
            <select id="modal_user_role" class="form-select" required>
              <option value="" disabled selected>Select Role</option>
              ${roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="modal_user_email">Email</label>
            <input type="email" id="modal_user_email" class="form-control" placeholder="email@gmail.com">
          </div>
          <div class="form-group">
            <label class="form-label" for="modal_user_mobile">Mobile Number</label>
            <input type="text" id="modal_user_mobile" class="form-control" placeholder="+8801700000000">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="modal_user_pass">Password <span class="required-star">*</span></label>
            <input type="password" id="modal_user_pass" class="form-control" required minlength="6" placeholder="••••••••" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label" for="modal_user_pass_confirm">Confirm Password <span class="required-star">*</span></label>
            <input type="password" id="modal_user_pass_confirm" class="form-control" required minlength="6" placeholder="••••••••" autocomplete="new-password">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-user-save-btn">Create User</button>
    `;

    UI.showModal({ title: 'Add New User Account', bodyHtml, footerHtml });

    document.getElementById('modal-user-save-btn').onclick = async () => {
      const name = document.getElementById('modal_user_name').value.trim();
      const login_id = document.getElementById('modal_user_login').value.trim();
      const role_id = document.getElementById('modal_user_role').value;
      const email = document.getElementById('modal_user_email').value.trim();
      const mobile = document.getElementById('modal_user_mobile').value.trim();
      const password = document.getElementById('modal_user_pass').value;
      const confirm_password = document.getElementById('modal_user_pass_confirm').value;

      if (!name || !login_id || !role_id || !password) {
        UI.toast('danger', 'Validation', 'Name, Login ID, Role, and Password are required.');
        return;
      }

      if (password !== confirm_password) {
        UI.toast('danger', 'Validation', 'Passwords do not match.');
        return;
      }

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, login_id, role_id, email, mobile, password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        UI.closeModal();
        UI.toast('success', 'User Created', data.message);
        UsersView.fetchData();
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    };
  },

  async openEditModal(id) {
    const userRes = await fetch(`/api/users/${id}`);
    const userData = await userRes.json();
    const user = userData.data;

    const rolesRes = await fetch('/api/roles');
    const rolesData = await rolesRes.json();
    const roles = rolesData.data || [];

    const bodyHtml = `
      <form id="modal-user-edit-form">
        <div class="form-group">
          <label class="form-label" for="edit_user_name">Full Name <span class="required-star">*</span></label>
          <input type="text" id="edit_user_name" class="form-control" required value="${user.name}">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit_user_login">Login ID <span class="required-star">*</span></label>
            <input type="text" id="edit_user_login" class="form-control" required value="${user.login_id}">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit_user_role">Role <span class="required-star">*</span></label>
            <select id="edit_user_role" class="form-select">
              ${roles.map(r => `<option value="${r.id}" ${user.role_id == r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit_user_email">Email</label>
            <input type="email" id="edit_user_email" class="form-control" value="${user.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit_user_mobile">Mobile Number</label>
            <input type="text" id="edit_user_mobile" class="form-control" value="${user.mobile || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit_user_status">Status</label>
          <select id="edit_user_status" class="form-select">
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-user-edit-save">Save Changes</button>
    `;

    UI.showModal({ title: `Edit User: ${user.login_id}`, bodyHtml, footerHtml });

    document.getElementById('modal-user-edit-save').onclick = async () => {
      const name = document.getElementById('edit_user_name').value.trim();
      const login_id = document.getElementById('edit_user_login').value.trim();
      const role_id = document.getElementById('edit_user_role').value;
      const email = document.getElementById('edit_user_email').value.trim();
      const mobile = document.getElementById('edit_user_mobile').value.trim();
      const status = document.getElementById('edit_user_status').value;

      try {
        const res = await fetch(`/api/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, login_id, role_id, email, mobile, status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        UI.closeModal();
        UI.toast('success', 'User Updated', data.message);
        UsersView.fetchData();
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    };
  },

  openResetPasswordModal(id, login_id) {
    const bodyHtml = `
      <div class="form-group">
        <label class="form-label" for="reset_new_pass">New Password <span class="required-star">*</span></label>
        <input type="password" id="reset_new_pass" class="form-control" minlength="6" placeholder="Enter at least 6 characters">
      </div>
      <div class="form-group">
        <label class="form-label" for="reset_confirm_pass">Confirm New Password <span class="required-star">*</span></label>
        <input type="password" id="reset_confirm_pass" class="form-control" minlength="6" placeholder="Re-enter password">
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="modal-reset-btn">Reset Password</button>
    `;

    UI.showModal({ title: `Reset Password for '${login_id}'`, bodyHtml, footerHtml });

    document.getElementById('modal-reset-btn').onclick = async () => {
      const new_password = document.getElementById('reset_new_pass').value;
      const confirm_password = document.getElementById('reset_confirm_pass').value;

      if (!new_password || new_password.length < 6) {
        UI.toast('danger', 'Validation', 'Password must be at least 6 characters.');
        return;
      }
      if (new_password !== confirm_password) {
        UI.toast('danger', 'Validation', 'Passwords do not match.');
        return;
      }

      try {
        const res = await fetch(`/api/users/${id}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        UI.closeModal();
        UI.toast('success', 'Password Reset', data.message);
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    };
  },

  toggleStatus(id, newStatus) {
    UI.confirm(`Change account status to <strong>${newStatus}</strong>?`, async () => {
      try {
        const res = await fetch(`/api/users/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        UI.toast('success', 'Status Changed', data.message);
        UsersView.fetchData();
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    });
  },

  deleteUser(id, loginIdEscaped) {
    const loginId = unescape(loginIdEscaped);
    UI.confirm(
      `Are you sure you want to permanently delete user account <strong>${loginId}</strong>?<br><span style="color:var(--danger); font-size:12px;">This action cannot be undone.</span>`,
      async () => {
        try {
          const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          UI.toast('success', 'User Deleted', data.message);
          UsersView.fetchData();
        } catch (err) {
          UI.toast('danger', 'Delete Failed', err.message);
        }
      },
      { title: 'Delete User Account', confirmText: 'Delete User', isDanger: true }
    );
  }
};

const RolesView = {
  async render(container) {
    const [rolesRes, permsRes] = await Promise.all([
      fetch('/api/roles'),
      fetch('/api/roles/permissions')
    ]);

    const { data: roles } = await rolesRes.json();
    const { data: { grouped: permGroups } } = await permsRes.json();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Role & Permission Management</h1>
          <p class="page-subtitle">Configure module-level access and operational authorization policies (RBAC)</p>
        </div>
      </div>

      <!-- Roles Overview Cards -->
      <div class="stats-grid">
        ${roles.map(r => `
          <div class="stat-card" style="border-left: 4px solid var(--primary);">
            <div class="stat-info">
              <div class="stat-label">Role Definition</div>
              <div class="stat-value" style="font-size: 18px;">${r.name}</div>
              <div class="stat-sub">${r.description}</div>
              <div style="margin-top: 10px;">
                <span class="badge badge-current">${r.permission_count} Permissions</span>
                ${r.name !== 'Super Admin' ? `
                  <button class="btn btn-secondary btn-sm" style="margin-left: 8px;" onclick="RolesView.editPermissions(${r.id}, '${r.name}')">Edit Permissions</button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Matrix Display -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Role Permission Matrix</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Module / Permission</th>
                ${roles.map(r => `<th style="text-align:center;">${r.name}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.keys(permGroups).map(mod => `
                <tr style="background-color: #f1f5f9; font-weight: 700;">
                  <td colspan="${roles.length + 1}" style="text-transform: uppercase; color: var(--primary);">
                    Module: ${mod}
                  </td>
                </tr>
                ${permGroups[mod].map(p => `
                  <tr>
                    <td><code>${p.name}</code> — <span style="color:var(--text-muted); font-size:12px;">Action: ${p.action}</span></td>
                    ${roles.map(r => {
                      const has = r.id === 1 || r.permission_ids.includes(p.id);
                      return `
                        <td style="text-align: center;">
                          ${has 
                            ? '<span style="color:var(--success); font-size:18px;">✓</span>' 
                            : '<span style="color:var(--text-light); font-size:16px;">—</span>'}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async editPermissions(roleId, roleName) {
    const [rolesRes, permsRes] = await Promise.all([
      fetch('/api/roles'),
      fetch('/api/roles/permissions')
    ]);
    const { data: roles } = await rolesRes.json();
    const { data: { grouped: permGroups } } = await permsRes.json();

    const role = roles.find(r => r.id === roleId);
    const assignedIds = role ? role.permission_ids : [];

    let checkboxesHtml = '';
    Object.keys(permGroups).forEach(mod => {
      checkboxesHtml += `
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: #1e3a8a; margin-bottom: 8px;">
            ${mod}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${permGroups[mod].map(p => `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="checkbox" name="role_perm" value="${p.id}" ${assignedIds.includes(p.id) ? 'checked' : ''}>
                <span><code>${p.name}</code></span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    });

    const bodyHtml = `
      <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Toggle permissions for role <strong>${roleName}</strong>:</p>
        ${checkboxesHtml}
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-role-perms-btn">Save Permissions</button>
    `;

    UI.showModal({ title: `Configure Permissions: ${roleName}`, bodyHtml, footerHtml, size: 'lg' });

    document.getElementById('save-role-perms-btn').onclick = async () => {
      const selected = Array.from(document.querySelectorAll('input[name="role_perm"]:checked')).map(cb => parseInt(cb.value, 10));

      try {
        const res = await fetch(`/api/roles/${roleId}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permission_ids: selected })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        UI.closeModal();
        UI.toast('success', 'Permissions Updated', data.message);
        RolesView.render(document.getElementById('main-viewport'));
      } catch (err) {
        UI.toast('danger', 'Error', err.message);
      }
    };
  }
};

// ==========================================
// 8. AUDIT TRAIL VIEW
// ==========================================
const AuditLogsView = {
  state: { page: 1, limit: 15, search: '', module: '', action: '', start_date: '', end_date: '' },

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">User Audit Trail</h1>
          <p class="page-subtitle">Immutable chronological log of all administrative actions, data changes, and authentication events</p>
        </div>
        <div class="page-actions">
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="AuditLogsView.export('xlsx')">Excel</button>
            <button class="btn btn-secondary" onclick="AuditLogsView.export('csv')">CSV</button>
            <button class="btn btn-secondary" onclick="AuditLogsView.export('pdf')">PDF</button>
          </div>
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="audit-search" class="form-control" placeholder="Search description, user, IP..." value="${AuditLogsView.state.search}">
          </div>

          <select id="audit-module-filter" class="form-select" style="width: 140px;">
            <option value="">All Modules</option>
            <option value="auth">Auth</option>
            <option value="mfi">MFI</option>
            <option value="branch">Branch</option>
            <option value="agreement">Agreement</option>
            <option value="user">User</option>
            <option value="role">Role</option>
          </select>

          <select id="audit-action-filter" class="form-select" style="width: 140px;">
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="renew">Renew</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
          </select>

          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; color:var(--text-muted);">From:</span>
            <input type="date" id="audit-start-date" class="form-control" style="width:140px;" value="${AuditLogsView.state.start_date}">
          </div>

          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; color:var(--text-muted);">To:</span>
            <input type="date" id="audit-end-date" class="form-control" style="width:140px;" value="${AuditLogsView.state.end_date}">
          </div>

          <button class="btn btn-secondary" onclick="AuditLogsView.applyFilters()">Filter</button>
          <button class="btn btn-ghost" onclick="AuditLogsView.resetFilters()">Reset</button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 50px;">SL</th>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Record ID</th>
                <th>IP Address</th>
                <th>Description</th>
                <th style="text-align: right;">Diff</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <tr><td colspan="9" style="text-align:center; padding: 30px;">Loading audit trail...</td></tr>
            </tbody>
          </table>
        </div>
        <div id="audit-pagination-box" class="card-footer"></div>
      </div>
    `;

    document.getElementById('audit-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') AuditLogsView.applyFilters();
    });

    await AuditLogsView.fetchData();
  },

  async fetchData() {
    const { page, limit, search, module, action, start_date, end_date } = AuditLogsView.state;
    const url = `/api/audit-logs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&module=${encodeURIComponent(module)}&action=${encodeURIComponent(action)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
    const res = await fetch(url);
    const result = await res.json();

    const tbody = document.getElementById('audit-table-body');
    const paginationBox = document.getElementById('audit-pagination-box');

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px;">No audit trail events recorded matching the criteria.</td></tr>`;
      paginationBox.innerHTML = '';
      return;
    }

    tbody.innerHTML = result.data.map(log => `
      <tr>
        <td><strong>${log.sl}</strong></td>
        <td style="color: var(--text-muted); white-space: nowrap;">${log.created_at_formatted}</td>
        <td>
          <strong>${log.user_name || 'System'}</strong>
          ${log.user_login_id ? `<div style="font-size:11px; color:var(--text-light);">${log.user_login_id}</div>` : ''}
        </td>
        <td><span class="badge badge-neutral">${log.module.toUpperCase()}</span></td>
        <td><span class="badge badge-current">${log.action.toUpperCase()}</span></td>
        <td>${log.record_id ? `<code>#${log.record_id}</code>` : '—'}</td>
        <td><code style="font-size: 11px;">${log.ip_address || '127.0.0.1'}</code></td>
        <td style="font-size: 13px;">${log.description || '—'}</td>
        <td style="text-align: right;">
          ${(log.old_value || log.new_value) ? `
            <button class="btn btn-secondary btn-sm" onclick="AuditLogsView.showDiff(${log.id}, '${escape(log.old_value || '')}', '${escape(log.new_value || '')}')">View Diff</button>
          ` : '—'}
        </td>
      </tr>
    `).join('');

    paginationBox.innerHTML = UI.renderPagination(result.pagination, 'AuditLogsView.goToPage');
  },

  applyFilters() {
    AuditLogsView.state.search = document.getElementById('audit-search').value.trim();
    AuditLogsView.state.module = document.getElementById('audit-module-filter').value;
    AuditLogsView.state.action = document.getElementById('audit-action-filter').value;
    AuditLogsView.state.start_date = document.getElementById('audit-start-date').value;
    AuditLogsView.state.end_date = document.getElementById('audit-end-date').value;
    AuditLogsView.state.page = 1;
    AuditLogsView.fetchData();
  },

  resetFilters() {
    document.getElementById('audit-search').value = '';
    document.getElementById('audit-module-filter').value = '';
    document.getElementById('audit-action-filter').value = '';
    document.getElementById('audit-start-date').value = '';
    document.getElementById('audit-end-date').value = '';
    AuditLogsView.state = { page: 1, limit: 15, search: '', module: '', action: '', start_date: '', end_date: '' };
    AuditLogsView.fetchData();
  },

  goToPage(p) {
    AuditLogsView.state.page = p;
    AuditLogsView.fetchData();
  },

  showDiff(id, oldEscaped, newEscaped) {
    const oldStr = unescape(oldEscaped);
    const newStr = unescape(newEscaped);

    let oldJson = null;
    let newJson = null;
    try { if (oldStr) oldJson = JSON.parse(oldStr); } catch (e) {}
    try { if (newStr) newJson = JSON.parse(newStr); } catch (e) {}

    const bodyHtml = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div>
          <div style="font-weight: 700; font-size: 12px; color: var(--danger); margin-bottom: 6px; text-transform: uppercase;">Prior State (Old Value)</div>
          <pre style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 11px; max-height: 300px; overflow: auto;">${oldJson ? JSON.stringify(oldJson, null, 2) : (oldStr || 'None')}</pre>
        </div>
        <div>
          <div style="font-weight: 700; font-size: 12px; color: var(--success); margin-bottom: 6px; text-transform: uppercase;">Updated State (New Value)</div>
          <pre style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 11px; max-height: 300px; overflow: auto;">${newJson ? JSON.stringify(newJson, null, 2) : (newStr || 'None')}</pre>
        </div>
      </div>
    `;

    UI.showModal({ title: `Audit Payload Diff — Log #${id}`, bodyHtml, size: 'lg' });
  },

  export(format) {
    const { search, module, action, start_date, end_date } = AuditLogsView.state;
    window.open(`/api/audit-logs/export?format=${format}&search=${encodeURIComponent(search)}&module=${encodeURIComponent(module)}&action=${encodeURIComponent(action)}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`, '_blank');
  }
};

// ==========================================
// 9. REPORTS VIEW (MFI, Branch, Agreement, Renewal Due)
// ==========================================
const ReportsView = {
  async render(container, type) {
    if (type === 'mfi') {
      await ReportsView.renderMfiReport(container);
    } else if (type === 'branch') {
      await ReportsView.renderBranchReport(container);
    } else if (type === 'agreement-history') {
      await ReportsView.renderAgreementHistoryReport(container);
    } else if (type === 'renewal-due') {
      await ReportsView.renderRenewalDueReport(container);
    }
  },

  async renderMfiReport(container) {
    const res = await fetch('/api/reports/mfi');
    const { data } = await res.json();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Microfinance Institutions Master Report</h1>
          <p class="page-subtitle">Consolidated operational capacity and projected monthly support fee billing</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>Print Report</span>
          </button>
          <button class="btn btn-primary" onclick="MfiListView.export('xlsx')">Export Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>SL</th>
                <th>MFI Full Name</th>
                <th>Short Code</th>
                <th>Establish Date</th>
                <th>Active Branches</th>
                <th>License Fee</th>
                <th>O&M Fee</th>
                <th>Projected Monthly Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(m => `
                <tr>
                  <td><strong>${m.sl}</strong></td>
                  <td style="font-weight: 600;">${m.full_name}</td>
                  <td><span class="badge badge-neutral">${m.short_name}</span></td>
                  <td>${m.establish_date}</td>
                  <td><strong>${m.active_branches}</strong></td>
                  <td>${UI.formatCurrency(m.current_license_fee)}</td>
                  <td>${UI.formatCurrency(m.current_om_fee)}</td>
                  <td><strong style="color: var(--primary); font-size: 14px;">${UI.formatCurrency(m.monthly_projected_total)}</strong></td>
                  <td><span class="badge ${m.status === 'active' ? 'badge-active' : 'badge-inactive'}">${m.status.toUpperCase()}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async renderBranchReport(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Branch Network Infrastructure Report</h1>
          <p class="page-subtitle">Master branch audit, deployment milestones, and office categorization</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="window.print()">Print</button>
          <button class="btn btn-primary" onclick="BranchListView.export('xlsx')">Export Excel</button>
        </div>
      </div>
    `;
    await BranchListView.render(container);
  },

  async renderAgreementHistoryReport(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Agreement & Fee Evolution History Report</h1>
          <p class="page-subtitle">Historical audit trail of all signed institutional support agreements</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="window.print()">Print</button>
          <button class="btn btn-primary" onclick="AgreementListView.export('xlsx')">Export Excel</button>
        </div>
      </div>
    `;
    await AgreementListView.render(container);
  },

  async renderRenewalDueReport(container) {
    const res = await fetch('/api/reports/renewal-due');
    const { data: alerts } = await res.json();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Agreement Renewal Due & Expiry Report</h1>
          <p class="page-subtitle">Agreements expired, pending renewal, or scheduled for renewal within 30, 60, and 90 days</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="window.print()">Print</button>
        </div>
      </div>

      <!-- Renewal Due Alert Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card" style="border-left: 4px solid var(--danger);">
          <div class="stat-info">
            <div class="stat-label">Renewal Overdue / Expired</div>
            <div class="stat-value" style="color: var(--danger);">${alerts.expired.length}</div>
            <div class="stat-sub">Requires Immediate Action</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid var(--warning);">
          <div class="stat-info">
            <div class="stat-label">Due Within 30 Days</div>
            <div class="stat-value" style="color: var(--warning);">${alerts.within_30.length}</div>
            <div class="stat-sub">Upcoming Pipeline</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid var(--info);">
          <div class="stat-info">
            <div class="stat-label">Due In 31 to 60 Days</div>
            <div class="stat-value" style="color: var(--info);">${alerts.within_60.length}</div>
            <div class="stat-sub">Upcoming Pipeline</div>
          </div>
        </div>

        <div class="stat-card" style="border-left: 4px solid var(--primary);">
          <div class="stat-info">
            <div class="stat-label">Due In 61 to 90 Days</div>
            <div class="stat-value" style="color: var(--primary);">${alerts.within_90.length}</div>
            <div class="stat-sub">Advance Planning</div>
          </div>
        </div>
      </div>

      <!-- Overdue / Expired Agreements Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="color: var(--danger);">Overdue Agreements / Renewal Required</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>MFI</th>
                <th>Agreement Date</th>
                <th>Agreement Expire Date</th>
                <th>License Fee</th>
                <th>O&M Fee</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.expired.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 20px;">No overdue agreements.</td></tr>' : ''}
              ${alerts.expired.map(item => `
                <tr>
                  <td><strong>${item.mfi.short_name} — ${item.mfi.full_name}</strong></td>
                  <td>${item.agreement ? UI.formatDate(item.agreement.agreement_date) : 'No prior agreement'}</td>
                  <td><strong style="color: var(--danger);">${item.mfi.agreement_expire_date ? UI.formatDate(item.mfi.agreement_expire_date) : (item.agreement && item.agreement.agreement_expire_date ? UI.formatDate(item.agreement.agreement_expire_date) : 'Not Set')}</strong></td>
                  <td>${item.agreement ? UI.formatCurrency(item.agreement.license_fee_per_branch) : '—'}</td>
                  <td>${item.agreement ? UI.formatCurrency(item.agreement.om_fee_per_branch) : '—'}</td>
                  <td><span class="badge badge-inactive">Renewal Overdue</span></td>
                  <td style="text-align: right;">
                    <a href="/agreements/create?mfi_id=${item.mfi.id}" class="btn btn-primary btn-sm">Renew Agreement</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Upcoming Scheduled Renewals Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Upcoming Scheduled Agreement Renewals</h3>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>MFI</th>
                <th>Effective Renewal Date</th>
                <th>Agreement Expire Date</th>
                <th>Days Remaining</th>
                <th>License Fee</th>
                <th>O&M Fee</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.all_upcoming.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 20px;">No upcoming renewals scheduled in advance.</td></tr>' : ''}
              ${alerts.all_upcoming.map(item => `
                <tr>
                  <td><strong>${item.mfi.short_name} — ${item.mfi.full_name}</strong></td>
                  <td><strong>${UI.formatDate(item.agreement.agreement_date)}</strong></td>
                  <td>${item.mfi.agreement_expire_date ? UI.formatDate(item.mfi.agreement_expire_date) : (item.agreement && item.agreement.agreement_expire_date ? UI.formatDate(item.agreement.agreement_expire_date) : 'Not Set')}</td>
                  <td><span class="badge badge-upcoming">In ${item.days_until_effective} Days</span></td>
                  <td>${UI.formatCurrency(item.agreement.license_fee_per_branch)}</td>
                  <td>${UI.formatCurrency(item.agreement.om_fee_per_branch)}</td>
                  <td><span class="badge badge-upcoming">Upcoming Term</span></td>
                  <td style="text-align: right;">
                    <a href="/mfi/${item.mfi.id}" class="btn btn-secondary btn-sm">View Profile</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};

// ==========================================
// 9. DATA MIGRATION VIEW MODULE
// ==========================================
const MigrationView = {
  activeTab: 'mfi', // 'mfi' or 'branch'
  parsedData: null,
  validationResult: null,

  async render(container) {
    if (!UI.can('migration.import')) {
      container.innerHTML = UI.renderAccessDenied('You do not have permission to access the Data Migration module.');
      return;
    }

    MigrationView.parsedData = null;
    MigrationView.validationResult = null;

    container.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
        <div>
          <h1 class="page-title" style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin:0;">Data Migration Hub</h1>
          <p class="page-subtitle" style="font-size: 13px; color: var(--text-muted); margin-top:4px;">Download database templates, validate CSV/Excel data, and batch import MFI & Branch records.</p>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div style="display:flex; gap:12px; border-bottom: 2px solid var(--border-color, #e2e8f0); margin-bottom: 24px;">
        <button class="tab-btn ${MigrationView.activeTab === 'mfi' ? 'active' : ''}" id="tab-btn-mfi" onclick="MigrationView.switchTab('mfi')" style="padding:10px 20px; font-weight:600; background:none; border:none; border-bottom: 3px solid ${MigrationView.activeTab === 'mfi' ? 'var(--primary, #1a56db)' : 'transparent'}; color: ${MigrationView.activeTab === 'mfi' ? 'var(--primary, #1a56db)' : 'var(--text-secondary, #475569)'}; cursor:pointer;">
          🏦 MFI Migration
        </button>
        <button class="tab-btn ${MigrationView.activeTab === 'branch' ? 'active' : ''}" id="tab-btn-branch" onclick="MigrationView.switchTab('branch')" style="padding:10px 20px; font-weight:600; background:none; border:none; border-bottom: 3px solid ${MigrationView.activeTab === 'branch' ? 'var(--primary, #1a56db)' : 'transparent'}; color: ${MigrationView.activeTab === 'branch' ? 'var(--primary, #1a56db)' : 'var(--text-secondary, #475569)'}; cursor:pointer;">
          🏢 Branch Office Migration
        </button>
      </div>

      <!-- Main Content Container -->
      <div id="migration-panel-content">
        ${MigrationView.renderTabContent()}
      </div>
    `;

    MigrationView.bindEvents();
  },

  switchTab(tab) {
    MigrationView.activeTab = tab;
    MigrationView.parsedData = null;
    MigrationView.validationResult = null;
    
    document.getElementById('tab-btn-mfi').style.borderBottomColor = tab === 'mfi' ? 'var(--primary, #1a56db)' : 'transparent';
    document.getElementById('tab-btn-mfi').style.color = tab === 'mfi' ? 'var(--primary, #1a56db)' : 'var(--text-secondary, #475569)';
    
    document.getElementById('tab-btn-branch').style.borderBottomColor = tab === 'branch' ? 'var(--primary, #1a56db)' : 'transparent';
    document.getElementById('tab-btn-branch').style.color = tab === 'branch' ? 'var(--primary, #1a56db)' : 'var(--text-secondary, #475569)';

    const panel = document.getElementById('migration-panel-content');
    if (panel) {
      panel.innerHTML = MigrationView.renderTabContent();
      MigrationView.bindEvents();
    }
  },

  renderTabContent() {
    const isMfi = MigrationView.activeTab === 'mfi';
    const typeLabel = isMfi ? 'MFI Master' : 'Branch Office';
    const templateBaseUrl = isMfi ? '/api/migration/template/mfi' : '/api/migration/template/branch';

    return `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="font-size:16px; font-weight:700;">Step 1: Download ${typeLabel} Standard Template</h3>
        </div>
        <div class="card-body" style="padding:20px;">
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
            Download pre-formatted data entry template aligned with database schema constraints. Fill in row details and preserve column header titles.
          </p>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button onclick="MigrationView.downloadTemplate('${MigrationView.activeTab}', 'xlsx')" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Excel Template (.xlsx)
            </button>
            <button onclick="MigrationView.downloadTemplate('${MigrationView.activeTab}', 'csv')" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download CSV Template (.csv)
            </button>
          </div>
          <div style="margin-top:16px; padding:12px 16px; background:rgba(26,86,219,0.04); border-left:4px solid var(--primary, #1a56db); border-radius:4px; font-size:12px; color:var(--text-secondary);">
            <strong>Schema Requirements:</strong><br>
            ${isMfi ? `
              • <strong>Full Name *</strong>: Official MFI organization title.<br>
              • <strong>Short Name *</strong>: Unique short identifier code (e.g. SSS, ASA, BURO).<br>
              • <strong>Initial Agreement Date *</strong>: Format YYYY-MM-DD.<br>
              • <strong>Agreement Expire Date</strong>: Optional, format YYYY-MM-DD.<br>
              • <strong>Initial License & O&M Fees</strong>: Numeric values.<br>
              • <em>Note: Importing an MFI automatically generates its initial agreement record.</em>
            ` : `
              • <strong>MFI Short Name *</strong>: Must match an existing MFI short name in system.<br>
              • <strong>Branch Name * & Code *</strong>: Code must be unique per MFI.<br>
              • <strong>Software Start Date *</strong>: Format YYYY-MM-DD.<br>
              • <strong>Billable Month</strong>: Optional (Format YYYY-MM). If empty, auto-computed from software start date + MFI grace period.<br>
              • <strong>Branch Type</strong>: Branch Office, Area Office, or Zone Office.
            `}
          </div>
        </div>
      </div>

      <!-- Step 2: Upload File -->
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <h3 class="card-title" style="font-size:16px; font-weight:700;">Step 2: Upload Populated ${typeLabel} Migration File</h3>
        </div>
        <div class="card-body" style="padding:24px;">
          <div id="dropzone" style="border: 2px dashed var(--border-color, #cbd5e1); border-radius: 8px; padding: 36px 20px; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s ease;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #1a56db)" stroke-width="2" style="margin-bottom:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <h4 style="font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">Drag and Drop your CSV or Excel file here</h4>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">Supports .csv or .xlsx formatted files</p>
            <input type="file" id="migration-file-input" accept=".csv, .xlsx" style="display:none;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('migration-file-input').click()">Browse Computer</button>
          </div>
        </div>
      </div>

      <!-- Step 3: Validation Preview Container -->
      <div id="validation-report-container"></div>
    `;
  },

  bindEvents() {
    const fileInput = document.getElementById('migration-file-input');
    const dropzone = document.getElementById('dropzone');

    if (!fileInput || !dropzone) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--primary, #1a56db)';
      dropzone.style.background = 'rgba(26,86,219,0.04)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-color, #cbd5e1)';
      dropzone.style.background = '#f8fafc';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-color, #cbd5e1)';
      dropzone.style.background = '#f8fafc';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        MigrationView.handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        MigrationView.handleFileSelected(e.target.files[0]);
      }
    });
  },

  async handleFileSelected(file) {
    UI.toast('info', 'Processing File', `Uploading and validating ${file.name}...`);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result.split(',')[1];
        const isMfi = MigrationView.activeTab === 'mfi';
        const endpoint = isMfi ? '/api/migration/validate/mfi' : '/api/migration/validate/branch';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64Data, fileName: file.name })
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.message || 'Validation request failed.');
        }

        MigrationView.validationResult = result;
        MigrationView.renderValidationReport(result);
        UI.toast('success', 'Validation Complete', `Parsed ${result.total} records (${result.validCount} ready, ${result.invalidCount} errors).`);
      } catch (err) {
        console.error('File validation error:', err);
        UI.toast('danger', 'Validation Error', err.message);
      }
    };
    reader.onerror = () => {
      UI.toast('danger', 'File Read Error', 'Failed to read file contents.');
    };
    reader.readAsDataURL(file);
  },

  parseCSVText(text) {
    const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

      const rowObj = {};
      headers.forEach((h, idx) => {
        let key = h;
        if (key.includes('mfi_short') || key.includes('mfi')) key = 'mfi_short_name';
        else if (key.includes('full_name') || key.includes('full')) key = 'full_name';
        else if (key.includes('short_name') || key.includes('short')) key = 'short_name';
        else if (key.includes('branch_name')) key = 'branch_name';
        else if (key.includes('branch_code') || key.includes('code')) key = 'branch_code';
        else if (key.includes('establish')) key = 'establish_date';
        else if (key.includes('initial_agreement') || key.includes('agreement_date')) key = 'initial_agreement_date';
        else if (key.includes('expire')) key = 'agreement_expire_date';
        else if (key.includes('license')) key = 'initial_license_fee';
        else if (key.includes('om_fee') || key.includes('o_m_fee')) key = 'initial_om_fee';
        else if (key.includes('branch_count') || key.includes('count')) key = 'initial_branch_count';
        else if (key.includes('grace')) key = 'om_grace_period_months';
        else if (key.includes('opening')) key = 'branch_opening_date';
        else if (key.includes('software_start') || key.includes('software')) key = 'software_start_date';
        else if (key.includes('billable')) key = 'billable_month';
        else if (key.includes('branch_type') || key.includes('type')) key = 'branch_type';
        else if (key.includes('status')) key = 'status';

        rowObj[key] = values[idx] !== undefined ? values[idx] : '';
      });

      rows.push(rowObj);
    }

    return rows;
  },

  async validateRows(rows) {
    const isMfi = MigrationView.activeTab === 'mfi';
    const endpoint = isMfi ? '/api/migration/validate/mfi' : '/api/migration/validate/branch';

    const container = document.getElementById('validation-report-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;">
          <div style="display:inline-block; width:28px; height:28px; border:3px solid #e2e8f0; border-top-color:#1a56db; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
          <div style="margin-top:8px; font-size:13px; color:#64748b;">Validating ${rows.length} records against database constraints...</div>
        </div>
      `;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        UI.showToast(result.message || 'Validation failed.', 'error');
        return;
      }

      MigrationView.validationResult = result;
      MigrationView.renderValidationReport(result);
    } catch (err) {
      console.error('Validation request error:', err);
      UI.showToast('Validation request failed: ' + err.message, 'error');
    }
  },

  renderValidationReport(result = MigrationView.validationResult) {
    const container = document.getElementById('validation-report-container');
    if (!container || !result || !Array.isArray(result.rows)) return;

    const isMfi = MigrationView.activeTab === 'mfi';
    const validRows = result.rows.filter(r => r.isValid);

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 class="card-title" style="font-size:16px; font-weight:700;">Step 3: Validation Preview & Import Action</h3>
            <span style="font-size:12px; color:var(--text-muted);">Review validation status before committing to database</span>
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-secondary" onclick="MigrationView.switchTab('${MigrationView.activeTab}')">Upload New File</button>
            <button class="btn btn-primary" id="commit-import-btn" ${validRows.length === 0 ? 'disabled' : ''} onclick="MigrationView.commitImport()">
              🚀 Commit & Import ${validRows.length} Valid Records
            </button>
          </div>
        </div>

        <div class="card-body" style="padding:20px;">
          <!-- Validation Summary Metrics Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
            <div style="padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
              <div style="font-size:12px; color:var(--text-muted); font-weight:600;">Total Records Parsed</div>
              <div style="font-size:24px; font-weight:700; color:var(--text-primary); margin-top:4px;">${result.total}</div>
            </div>
            <div style="padding:16px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:8px;">
              <div style="font-size:12px; color:#047857; font-weight:600;">Ready for Import</div>
              <div style="font-size:24px; font-weight:700; color:#047857; margin-top:4px;">${result.validCount}</div>
            </div>
            <div style="padding:16px; background:${result.invalidCount > 0 ? 'rgba(239,68,68,0.06)' : '#f8fafc'}; border:1px solid ${result.invalidCount > 0 ? 'rgba(239,68,68,0.2)' : '#e2e8f0'}; border-radius:8px;">
              <div style="font-size:12px; color:${result.invalidCount > 0 ? '#b91c1c' : 'var(--text-muted)'}; font-weight:600;">Validation Errors</div>
              <div style="font-size:24px; font-weight:700; color:${result.invalidCount > 0 ? '#b91c1c' : 'var(--text-primary)'}; margin-top:4px;">${result.invalidCount}</div>
            </div>
          </div>

          <!-- Table of Rows -->
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th style="width:60px;">Row #</th>
                  <th>Record Identifiers</th>
                  <th>Details & Dates</th>
                  <th>Validation Status</th>
                  <th>Validation Remarks / Errors</th>
                </tr>
              </thead>
              <tbody>
                ${result.rows.map(r => `
                  <tr style="${!r.isValid ? 'background: rgba(239,68,68,0.02);' : ''}">
                    <td><strong>#${r.rowNumber}</strong></td>
                    <td>
                      ${isMfi ? `
                        <strong>${r.data.short_name || '—'}</strong><br>
                        <span style="font-size:12px; color:var(--text-muted);">${r.data.full_name || '—'}</span>
                      ` : `
                        <strong>${r.data.branch_name || '—'} (${r.data.branch_code || '—'})</strong><br>
                        <span style="font-size:12px; color:var(--text-muted);">MFI: ${r.data.mfi_short_name || '—'}</span>
                      `}
                    </td>
                    <td>
                      ${isMfi ? `
                        <span style="font-size:12px;">Agreement: ${r.data.initial_agreement_date || '—'}</span><br>
                        <span style="font-size:12px; color:var(--text-muted);">Fee: BDT ${r.data.initial_license_fee} / ${r.data.initial_om_fee}</span>
                      ` : `
                        <span style="font-size:12px;">Software Start: ${r.data.software_start_date || '—'}</span><br>
                        <span style="font-size:12px; color:var(--text-muted);">Billable Month: ${r.data.billable_month || 'Auto-computed'} (${r.data.branch_type})</span>
                      `}
                    </td>
                    <td>
                      ${r.isValid ? `
                        <span class="badge badge-active" style="background:rgba(16,185,129,0.12); color:#047857; font-weight:600;">✓ Ready</span>
                      ` : `
                        <span class="badge badge-inactive" style="background:rgba(239,68,68,0.12); color:#b91c1c; font-weight:600;">✕ Error</span>
                      `}
                    </td>
                    <td>
                      ${r.isValid ? `
                        <span style="font-size:12px; color:#047857;">Validation passed cleanly.</span>
                      ` : `
                        <ul style="margin:0; padding-left:16px; font-size:12px; color:#b91c1c;">
                          ${r.errors.map(err => `<li>${err}</li>`).join('')}
                        </ul>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async commitImport() {
    if (!MigrationView.validationResult) return;

    const isMfi = MigrationView.activeTab === 'mfi';
    const validRows = MigrationView.validationResult.rows.filter(r => r.isValid);
    if (validRows.length === 0) {
      UI.showToast('No valid rows available to import.', 'error');
      return;
    }

    const endpoint = isMfi ? '/api/migration/import/mfi' : '/api/migration/import/branch';

    UI.confirm(`Are you sure you want to import ${validRows.length} valid ${isMfi ? 'MFI' : 'Branch'} records into the database?`, async () => {
      const btn = document.getElementById('commit-import-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Importing records...';
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: validRows })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          UI.showToast(data.message || 'Import failed.', 'error');
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `🚀 Commit & Import ${validRows.length} Valid Records`;
          }
          return;
        }

        UI.showToast(data.message, 'success');

        setTimeout(() => {
          Router.navigate(isMfi ? '/mfi' : '/branches');
        }, 1200);
      } catch (err) {
        console.error('Import error:', err);
        UI.showToast('Import failed: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `🚀 Commit & Import ${validRows.length} Valid Records`;
        }
      }
    }, { title: `Confirm ${isMfi ? 'MFI' : 'Branch'} Migration Import` });
  },

  async downloadTemplate(type, format) {
    try {
      UI.showToast(`Generating ${type.toUpperCase()} template (${format.toUpperCase()})...`, 'info');
      const res = await fetch(`/api/migration/template/${type}?format=${format}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        UI.showToast(errData.message || 'Failed to download template', 'error');
        return;
      }
      const blob = await res.blob();
      const filename = `${type}_migration_template.${format}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      UI.showToast(`Template download started: ${filename}`, 'success');
    } catch (err) {
      console.error('Template download error:', err);
      UI.showToast('Failed to download template: ' + err.message, 'error');
    }
  }
};
window.MigrationView = MigrationView;

// ==========================================
// 10. APP INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});

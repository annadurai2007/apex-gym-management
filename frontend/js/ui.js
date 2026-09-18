/* ==========================================================================
   APEX FITNESS CLUB - UI CONTROLLER & UTILITIES
   Toasts, Confirmation Dialogs, Modals, Drawers, Formatters
   ========================================================================== */

const UI = {
  /**
   * Display toast alert
   * @param {string} message 
   * @param {'success'|'error'|'warning'|'info'} type 
   * @param {string} title 
   * @param {number} duration ms
   */
  showToast(message, type = 'info', title = null, duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const titles = {
      success: title || 'Success',
      error: title || 'Error',
      warning: title || 'Notice',
      info: title || 'Information'
    };

    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-body">
        <div class="toast-title">${titles[type]}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  /**
   * Prompts user with a styled confirmation modal dialog
   * @param {string} title 
   * @param {string} message 
   * @param {string} confirmBtnText 
   * @param {boolean} isDanger 
   * @returns {Promise<boolean>}
   */
  confirm(title, message, confirmBtnText = 'Confirm', isDanger = false) {
    return new Promise((resolve) => {
      let modal = document.getElementById('apex-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'apex-confirm-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 420px;">
            <div class="modal-header">
              <h3 id="apex-confirm-title" style="font-size: 1.15rem;">Confirmation</h3>
              <button class="btn-icon" id="apex-confirm-close-x">&times;</button>
            </div>
            <div class="modal-body">
              <p id="apex-confirm-msg" style="color: var(--text-secondary); font-size: 0.95rem;"></p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="apex-confirm-cancel">Cancel</button>
              <button class="btn" id="apex-confirm-ok">Confirm</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      document.getElementById('apex-confirm-title').textContent = title;
      document.getElementById('apex-confirm-msg').textContent = message;
      
      const okBtn = document.getElementById('apex-confirm-ok');
      okBtn.textContent = confirmBtnText;
      okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

      const cleanup = (result) => {
        modal.classList.remove('active');
        resolve(result);
      };

      okBtn.onclick = () => cleanup(true);
      document.getElementById('apex-confirm-cancel').onclick = () => cleanup(false);
      document.getElementById('apex-confirm-close-x').onclick = () => cleanup(false);

      modal.classList.add('active');
    });
  },

  /**
   * Open modal by ID
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Close modal by ID
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * Open Drawer
   */
  openDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (drawer) {
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Close Drawer
   */
  closeDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (drawer) {
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * Format Currency ($ USD)
   */
  formatCurrency(amount) {
    const val = parseFloat(amount) || 0;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  /**
   * Format ISO Date string to readable text (e.g. 'Oct 15, 2026')
   */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  },

  /**
   * Format 24h Time to 12h format
   */
  formatTime(timeStr) {
    if (!timeStr) return '—';
    try {
      const parts = timeStr.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  },

  /**
   * Refresh Lucide icons on dynamic DOM change
   */
  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  /**
   * Generate Table Skeleton Rows
   */
  renderTableSkeleton(columns = 5, rows = 5) {
    let html = '';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let c = 0; c < columns; c++) {
        html += `<td><div class="skeleton skeleton-text" style="width: ${c === 0 ? '60%' : '80%'};"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  }
};

// Global click handler to close modals and drawers when clicking overlay backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
  if (e.target.classList.contains('drawer-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* ==========================================================================
   APEX FITNESS CLUB - AUTHENTICATION & ROLE MANAGEMENT
   ========================================================================== */

const Auth = {
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE_USER_KEY)) || null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  hasPermission(permissionKey) {
    const user = this.getUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permissionKey);
    }
    return false;
  },

  setSession(token, user) {
    localStorage.setItem(CONFIG.STORAGE_TOKEN_KEY, token);
    localStorage.setItem(CONFIG.STORAGE_USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(CONFIG.STORAGE_TOKEN_KEY);
    localStorage.removeItem(CONFIG.STORAGE_USER_KEY);
  },

  async login(email, password) {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (result.success && result.data && result.data.token) {
      this.setSession(result.data.token, result.data.user);
      return { success: true, user: result.data.user };
    } else {
      return { success: false, message: result.message || 'Login failed' };
    }
  },

  logout() {
    this.clearSession();
    window.location.href = '/login';
  },

  /**
   * Route Guard: ensure user is authenticated and has permitted role.
   * If not permitted, redirects to proper dashboard or login.
   */
  requireAuth(allowedRoles = []) {
    if (!this.isAuthenticated()) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }

    const currentRole = this.getRole();
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
      UI.showToast(`Access Denied: Your account role (${currentRole}) cannot access this portal.`, 'error');
      setTimeout(() => {
        if (currentRole === 'member') {
          window.location.href = '/member';
        } else {
          window.location.href = '/admin';
        }
      }, 1000);
      return false;
    }

    // Populate user profile info in topbars if elements exist
    this.renderUserProfilePill();
    return true;
  },

  renderUserProfilePill() {
    const user = this.getUser();
    if (!user) return;

    const nameEls = document.querySelectorAll('.user-pill-name');
    const roleEls = document.querySelectorAll('.user-pill-role');
    const avatarEls = document.querySelectorAll('.user-pill-avatar');

    let displayName = user.email.split('@')[0];
    let photoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80';

    if (user.role === 'member' && user.profile) {
      displayName = user.profile.full_name || displayName;
      photoUrl = user.profile.photo_url || photoUrl;
    } else if ((user.role === 'trainer' || user.role === 'staff') && user.profile) {
      displayName = user.profile.full_name || displayName;
      photoUrl = user.profile.photo_url || photoUrl;
    } else if (user.role === 'admin') {
      displayName = 'Apex Administrator';
    }

    nameEls.forEach(el => el.textContent = displayName);
    roleEls.forEach(el => el.textContent = user.role);
    avatarEls.forEach(el => el.src = photoUrl);
  }
};

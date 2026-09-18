/* ==========================================================================
   APEX FITNESS CLUB - CONFIGURATION & API CLIENT
   ========================================================================== */

const CONFIG = {
  // Universal relative API endpoint when served from Flask/Gunicorn or any cloud domain
  API_BASE_URL: (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? (window.location.port === '3000' || window.location.port === '5500' ? 'http://127.0.0.1:5000/api' : '/api')
    : 'http://127.0.0.1:5000/api',
  STORAGE_TOKEN_KEY: 'apex_auth_token',
  STORAGE_USER_KEY: 'apex_user_data'
};

/**
 * Universal Fetch wrapper with JWT header injection & automatic error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${CONFIG.API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const headers = options.headers || {};
  const token = localStorage.getItem(CONFIG.STORAGE_TOKEN_KEY);

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set default Content-Type to application/json if sending a JSON body
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, fetchOptions);

    // If 401 Unauthorized, handle expired session
    if (response.status === 401) {
      const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname === '/login';
      const isLanding = window.location.pathname.endsWith('/') || window.location.pathname.includes('index.html');
      
      if (!isAuthPage && !isLanding) {
        localStorage.removeItem(CONFIG.STORAGE_TOKEN_KEY);
        localStorage.removeItem(CONFIG.STORAGE_USER_KEY);
        window.location.href = '/login';
        return { success: false, message: 'Session expired. Please log in again.' };
      }
    }

    // Handle CSV or file blob responses
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
      const blob = await response.blob();
      return { success: true, blob };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        message: data.message || `Request failed with status ${response.status}`,
        errors: data.errors
      };
    }

    return data;
  } catch (err) {
    console.error(`API Fetch Error [${endpoint}]:`, err);
    return {
      success: false,
      message: 'Unable to connect to backend server. Please ensure the Python server is running.'
    };
  }
}

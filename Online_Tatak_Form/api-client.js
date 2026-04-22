const API_BASE_URL = 'http://localhost:3002';

/**
 * Returns the currently stored JWT token from browser storage.
 */
function getAuthToken() {
    return localStorage.getItem('tatak_token');
}

/**
 * Clears saved auth data and sends the user back to the login page.
 * This is used whenever the backend reports an invalid or expired token.
 */
function clearAuthAndRedirect() {
    localStorage.removeItem('tatak_token');
    localStorage.removeItem('tatak_role');
    // replace() avoids leaving a broken protected page in browser history.
    window.location.replace('login.html');
}

/**
 * Centralized fetch helper for calling backend APIs with JWT auth.
 * It also auto-redirects to login when token is invalid (401/403).
 */
async function apiRequest(path, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    // Auto-logout if the token is missing/expired/invalid.
    if (response.status === 401 || response.status === 403) {
        clearAuthAndRedirect();
        throw new Error('Unauthorized');
    }

    const responseText = await response.text();
    let payload = {};
    try {
        payload = JSON.parse(responseText);
    } catch (e) {}

    if (!response.ok) {
        console.error('API Error Response:', responseText);
        const message = payload.message || payload.error || `Request failed (${response.status})`;
        throw new Error(message);
    }

    return payload;
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';

    toast.innerHTML = `
        <i class="fas fa-${icon} toast-icon"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

window.TatakApi = {
    API_BASE_URL,
    getAuthToken,
    clearAuthAndRedirect,
    apiRequest,
    showToast
};


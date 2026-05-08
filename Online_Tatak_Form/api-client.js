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
    localStorage.removeItem('admin_last_section');
    localStorage.removeItem('officer_last_section');
    setPendingToast('You have been signed out.', 'info');
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

/**
 * Stores a message to be shown after the next page load.
 */
function setPendingToast(message, type = 'info') {
    sessionStorage.setItem('tatak_pending_toast', JSON.stringify({ message, type }));
}

/**
 * Checks for and displays any pending toasts from a previous session.
 */
function checkPendingToast() {
    const pending = sessionStorage.getItem('tatak_pending_toast');
    if (pending) {
        const { message, type } = JSON.parse(pending);
        sessionStorage.removeItem('tatak_pending_toast');
        // Slightly longer delay to ensure dashboard scripts have finished initial rendering
        setTimeout(() => showToast(message, type), 500);
    }
}

function showToast(message, type = 'info') {
    // Inject styles if missing
    if (!document.getElementById('tatak-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'tatak-toast-styles';
        style.innerHTML = `
            .toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
            .toast { background: white; color: #1e293b; padding: 12px 20px; border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; align-items: center; gap: 12px; min-width: 280px; border-left: 4px solid #3b82f6; animation: toastSlideIn 0.3s ease forwards; font-family: 'Inter', sans-serif; font-size: 14px; }
            .toast.success { border-left-color: #10b981; }
            .toast.error { border-left-color: #ef4444; }
            .toast.info { border-left-color: #3b82f6; }
            .toast.hiding { animation: toastSlideOut 0.3s ease forwards; }
            .toast-icon { font-size: 18px; }
            .toast.success .toast-icon { color: #10b981; }
            .toast.error .toast-icon { color: #ef4444; }
            @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes toastSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

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
    showToast,
    setPendingToast
};

// Auto-check for pending toasts on every load
checkPendingToast();


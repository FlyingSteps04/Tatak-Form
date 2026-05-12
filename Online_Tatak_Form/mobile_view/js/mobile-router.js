/**
 * Shared mobile routing and authentication logic
 */
const MobileRouter = {
    init() {
        this.checkAuth();
        this.setupLogout();
    },

    checkAuth() {
        const token = localStorage.getItem('tatak_token');
        const role = localStorage.getItem('tatak_role');
        const currentPath = window.location.pathname;

        if (!token && !currentPath.includes('index.html')) {
            window.location.href = 'index.html';
        }

        if (token && currentPath.includes('index.html')) {
            this.redirectByRole(role);
        }
    },

    redirectByRole(role) {
        if (role === 'Admin') window.location.href = 'admin.html';
        else if (role === 'Officer') window.location.href = 'officer.html';
        else if (role === 'Student') window.location.href = 'student.html';
    },

    setupLogout() {
        const logoutBtn = document.getElementById('mobileLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('tatak_token');
                localStorage.removeItem('tatak_role');
                localStorage.removeItem('tatak_user_name');
                window.location.href = 'index.html';
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => MobileRouter.init());

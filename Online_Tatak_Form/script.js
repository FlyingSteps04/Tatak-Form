const observerOptions = { threshold: 0.15 };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

document.addEventListener('DOMContentLoaded', () => {
    const roleButtons = document.querySelectorAll('.role-tab');
    const usernameLabel = document.getElementById('usernameLabel');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginForm = document.getElementById('loginForm');

    let currentRole = 'student'; 

    roleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            roleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentRole = button.getAttribute('data-role');

            if (loginForm) {
                loginForm.style.opacity = '0';
                setTimeout(() => {
                    updateUI(currentRole);
                    // Clear all typed credentials whenever the user switches role tabs.
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                    loginForm.style.opacity = '1';
                    loginForm.style.transition = 'opacity 0.3s ease';
                }, 50);
            }
        });
    });

    function updateUI(role) {
        if (!usernameLabel || !usernameInput) return;
        if (role === 'admin') {
            usernameLabel.innerText = 'Admin Email';
            usernameInput.placeholder = 'admin@uc.edu.ph';
        } else if (role === 'officer') {
            usernameLabel.innerText = 'Officer Username';
            usernameInput.placeholder = 'Enter officer Username';
        } else {
            usernameLabel.innerText = 'ID Number';
            usernameInput.placeholder = 'e.g. 20241234';
        }
    }

    /**
     * Sends the login request to the backend and, if successful,
     * stores the JWT token and redirects the user based on their role.
     */
    async function handleLogin(identifier, password) {
        try {
            const response = await fetch(`${window.TatakApi.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    identifier,
                    password
                })
            });

            if (!response.ok) {
                // Apply subtle error styling
                const form = document.getElementById('loginForm');
                if (form) {
                    form.classList.add('shake');
                    setTimeout(() => form.classList.remove('shake'), 400);
                }

                document.querySelectorAll('.input-field').forEach(field => {
                    field.classList.add('error-state');
                });

                // Always show the same deceptive message for security
                window.TatakApi.showToast('Incorrect Username or Password!', 'error');
                return;
            }

            const data = await response.json();

            // Save token and role
            localStorage.setItem('tatak_token', data.token);
            localStorage.setItem('tatak_role', data.role);

            // Redirect user based on role
            if (data.role === 'Admin') {
                window.location.href = 'admin-dashboard.html';
            } else if (data.role === 'Officer') {
                window.location.href = 'officer-dashboard.html';
            } else if (data.role === 'Student') {
                window.location.href = 'student-dashboard.html';
            } else {
                window.TatakApi.showToast('Logged in, but role is not recognized. Please contact support.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            window.TatakApi.showToast('Unable to connect to the server. Please make sure the backend is running.', 'error');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredUser = usernameInput.value;
            const enteredPass = passwordInput.value;
            handleLogin(enteredUser, enteredPass);
        });
    }

    // Clear error state when typing
    [usernameInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                document.querySelectorAll('.input-field').forEach(field => {
                    field.classList.remove('error-state');
                });
            });
        }
    });

    // Password Toggle Logic
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            // Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle the eye icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }
});


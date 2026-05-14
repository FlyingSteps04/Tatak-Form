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
    // Mobile Menu Toggle
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMenu = document.getElementById('closeMenu');

    if (hamburger && mobileMenu && closeMenu) {
        window.toggleMenu = () => {
            const isActive = mobileMenu.classList.toggle('active');
            hamburger.classList.toggle('active'); // Optional: for hamburger animation
            document.body.style.overflow = isActive ? 'hidden' : 'auto';
        };

        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        closeMenu.addEventListener('click', toggleMenu);

        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (mobileMenu.classList.contains('active') && !mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
                toggleMenu();
            }
        });

        // Close menu on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                toggleMenu();
            }
        });
    }

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
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

    async function handleLogin(identifier, password, expectedRole) {
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
                const form = document.getElementById('loginForm');
                if (form) {
                    form.classList.add('shake');
                    setTimeout(() => form.classList.remove('shake'), 400);
                }
                document.querySelectorAll('.input-field').forEach(field => {
                    field.classList.add('error-state');
                });
                window.TatakApi.showToast('Incorrect Username or Password!', 'error');
                return;
            }

            const data = await response.json();

            // Security Check: Verify if the account role matches the selected tab
            // Case-insensitive comparison for flexibility
            const actualRole = (data.role || '').toLowerCase();
            const targetRole = (expectedRole || '').toLowerCase();

            if (actualRole !== targetRole) {
                window.TatakApi.showToast(`Access Denied: This account is registered as an ${data.role}, not a ${expectedRole}.`, 'error');
                return;
            }

            // Save token and role
            localStorage.setItem('tatak_token', data.token);
            localStorage.setItem('tatak_role', data.role);

            // Set pending toast for dashboard
            window.TatakApi.setPendingToast(`Login Successful! Welcome, ${data.role}.`, 'success');

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
            handleLogin(enteredUser, enteredPass, currentRole);
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
    // Load Top Performing Org for Landing Page
    async function loadTopPerformingOrg() {
        const card = document.getElementById('landing-top-org-card');
        const logoWrap = document.getElementById('landing-top-logo-wrap');
        const acronymEl = document.getElementById('landing-top-name');
        const fullEl = document.getElementById('landing-top-full');
        const membersEl = document.getElementById('landing-top-members');
        const eventsEl = document.getElementById('landing-top-events');

        if (!card) return;

        try {
            // Using apiRequest helper is more robust. skipRedirect: true avoids auto-login redirect for landing page.
            console.log('Fetching top org from:', `${window.TatakApi.API_BASE_URL}/top-performing-org`);
            const result = await window.TatakApi.apiRequest('/top-performing-org', { skipRedirect: true });

            if (result && result.data) {
                const org = result.data;
                
                // Helper to get initials (e.g., "UC College of Computer Studies" -> "UCCS")
                const getInitials = (str) => {
                    if (!str) return '??';
                    // Filter out common small words for better initials
                    const words = str.split(' ').filter(w => !['of', 'the', 'and', '&', 'at'].includes(w.toLowerCase()));
                    if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
                    return words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
                };

                const acronym = org.acronym || getInitials(org.name);

                if (logoWrap) {
                    if (org.logo) {
                        const logoUrl = window.TatakApi.formatImageUrl(org.logo);
                        logoWrap.innerHTML = `<img src="${logoUrl}" alt="Logo" onerror="this.src='655609284_1426759675272887_2726655014418430573_n.png'">`;
                    } else {
                        logoWrap.innerHTML = `<div class="org-logo-circle" style="width: 100%; height: 100%; background: var(--uc-yellow); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.5rem;">${acronym}</div>`;
                    }
                }

                if (acronymEl) acronymEl.innerText = acronym;
                if (fullEl) fullEl.innerText = org.name || 'Top Performing Organization';
                if (membersEl) membersEl.innerText = org.members_count || 0;
                if (eventsEl) eventsEl.innerText = org.events_count || 0;

                // Make sure card is visible
                if (card) {
                    card.style.opacity = '1';
                    card.style.display = 'block';
                }
            } else {
                console.warn('No top performing organization found in database.');
                // Show a default state instead of hiding
                if (fullEl) fullEl.innerText = 'Student Organization Showcase';
                if (card) {
                    card.style.opacity = '1';
                    card.style.display = 'block';
                }
            }
        } catch (err) {
            console.warn('Top org showcase fetch failed, showing fallback:', err);
            // Ensure card stays visible even on error
            if (card) {
                card.style.opacity = '1';
                card.style.display = 'block';
                if (fullEl) fullEl.innerText = 'Smart Attendance System Community';
                if (acronymEl) acronymEl.innerText = 'SAS';
            }
        }
    }

    loadTopPerformingOrg();
});


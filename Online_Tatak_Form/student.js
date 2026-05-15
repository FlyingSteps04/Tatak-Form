document.addEventListener('DOMContentLoaded', () => {
    // Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.querySelector('.sidebar-overlay');

    if (menuToggle && sidebar) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.style.display = 'block';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';
        });

        // Close sidebar on link click
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.style.display = 'none';
            });
        });
    }
    // --- AUTH CHECK ---
    const token = window.TatakApi.getAuthToken();
    const role = localStorage.getItem('tatak_role');
    
    if (!token || (role !== 'Student' && role !== 'Officer' && role !== 'Admin')) {
        console.warn('Unauthorized access attempt. Redirecting to login.');
        window.location.replace('login.html');
        return;
    }

    const formatImageUrl = window.TatakApi.formatImageUrl;

    const modal = document.getElementById('logoutModal');
    const stayBtn = document.getElementById('stayLoggedIn');
    const confirmBtn = document.getElementById('confirmLogout');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const topbarLogout = document.getElementById('topbarLogout');
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllRead');
    let studentNotificationsCache = { unread: [], read: [] };
    let allHistoryRows = []; // Cache for search functionality

    const navOverview = document.getElementById('nav-overview');
    const navEvents = document.getElementById('nav-events');
    const navHistory = document.getElementById('nav-history');
    const navReports = document.getElementById('nav-reports');

    const sectionOverview = document.getElementById('section-overview');
    const sectionEvents = document.getElementById('section-events');
    const sectionHistory = document.getElementById('section-history');
    const sectionReports = document.getElementById('section-reports');

    const historyContainer = document.querySelector('.history-list');
    const attendedPill = document.querySelector('.attended-pill');
    const absentPill = document.querySelector('.absent-pill');
    const ratePill = document.querySelector('.rate-pill');

    const startScanBtn = document.getElementById('start-scan-btn');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    const defaultView = document.getElementById('scan-default-view');
    const activeView = document.getElementById('scan-active-view');
    
    let html5QrCode;

    // Expose start scanner function globally
    window.startQRScan = () => {
        // Switch to Overview section first since that's where the reader div is
        resetNavigation();
        if (navOverview) navOverview.classList.add('active');
        if (sectionOverview) sectionOverview.style.display = 'block';
        
        // Scroll to the scanner section
        const scannerSection = document.querySelector('.qr-instructions');
        if (scannerSection) scannerSection.scrollIntoView({ behavior: 'smooth' });

        // Trigger the scan button click
        if (startScanBtn) startScanBtn.click();
    };

    startScanBtn.addEventListener('click', () => {
        // Toggle UI views
        defaultView.style.display = 'none';
        activeView.style.display = 'block';

        // Initialize the QR Code reader on the 'reader' div
        html5QrCode = new Html5Qrcode("reader");

    const showScanResult = (success, message, extra = {}) => {
        const modal = document.getElementById('scanResultModal');
        const icon = document.getElementById('scanResultIcon');
        const title = document.getElementById('scanResultTitle');
        const msg = document.getElementById('scanResultMessage');
        const status = document.getElementById('scanResultStatus');
        const distRow = document.getElementById('scanResultDistanceRow');
        const dist = document.getElementById('scanResultDistance');
        const venueRow = document.getElementById('scanResultVenueRow');
        const venue = document.getElementById('scanResultVenue');

        if (success) {
            icon.style.background = 'rgba(16, 185, 129, 0.1)';
            icon.style.color = '#10b981';
            icon.innerHTML = '<i class="fas fa-check-circle"></i>';
            title.textContent = 'Success!';
            title.style.color = '#1e293b';
            status.textContent = 'CONFIRMED';
            status.style.color = '#10b981';
            distRow.style.display = 'none';
            venueRow.style.display = 'none';
        } else {
            icon.style.background = 'rgba(239, 68, 68, 0.1)';
            icon.style.color = '#ef4444';
            icon.innerHTML = '<i class="fas fa-times-circle"></i>';
            title.textContent = 'Scan Failed';
            title.style.color = '#ef4444';
            status.textContent = 'REJECTED';
            status.style.color = '#ef4444';
            
            if (extra.venue) {
                venueRow.style.display = 'flex';
                venue.textContent = extra.venue;
            } else {
                venueRow.style.display = 'none';
            }

            if (extra.distance) {
                distRow.style.display = 'flex';
                dist.textContent = extra.distance;
            } else {
                distRow.style.display = 'none';
            }
        }

        msg.textContent = message;
        modal.style.display = 'flex';
    };

    // Function to run when a QR code is successfully scanned
    const onScanSuccess = (decodedText, decodedResult) => {
        stopScanner(); // Stop camera immediately
        
        let qrData;
        try {
            qrData = JSON.parse(decodedText);
        } catch (e) {
            showScanResult(false, "Invalid QR Code format. Please scan a valid event code.");
            return;
        }

        // 2. Get User Location and Send to Backend
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const payload = {
                    event_token: qrData.event_token,
                    user_latitude: position.coords.latitude,
                    user_longitude: position.coords.longitude
                };

                try {
                    const response = await window.TatakApi.apiRequest('/attendance/scan', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    
                    if (response.success) {
                        showScanResult(true, response.message || "Your attendance has been recorded successfully.");
                    } else {
                        showScanResult(false, response.error || "Attendance verification failed.", { 
                            distance: response.distance,
                            venue: response.venue
                        });
                    }
                } catch (err) {
                    showScanResult(false, err.message || "Connection error. Please try again.");
                }
            }, (geoError) => {
                showScanResult(false, "Location access denied. You must enable GPS to verify attendance.");
            });
        } else {
            showScanResult(false, "Your browser does not support geolocation.");
        }
    };

        // Configuration for the scanner
        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0 
        };

        // Start the camera (preferring the back camera for mobile devices)
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch((err) => {
                console.error("Error starting QR Code scanner:", err);
                alert("Could not access the camera. Please ensure you have granted camera permissions.");
                stopScanner();
            });
    });

    // 3. Cancel Scan Button Logic
    cancelScanBtn.addEventListener('click', () => {
        stopScanner();
    });

    // 4. Helper function to stop the camera and reset UI
    function stopScanner() {
        if (html5QrCode) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                resetUI();
            }).catch((err) => {
                console.error("Failed to stop the scanner:", err);
                resetUI(); // Force UI reset even if stop fails
            });
        } else {
            resetUI();
        }
    }

    function resetUI() {
        activeView.style.display = 'none';
        defaultView.style.display = 'block';
    }

    /**
     * Verifies that the user is logged in as a Student.
     * If there is no token or the role is not Student, redirect back to the login page.
     */
    function ensureStudentAuthenticated() {
        const token = localStorage.getItem('tatak_token');
        const role = localStorage.getItem('tatak_role');

        if (!token || role !== 'Student') {
            window.TatakApi.clearAuthAndRedirect();
        }
    }

    /**
     * Logs the user out by clearing the token and role and sending them to the login page.
     */
    function performLogout() {
        window.TatakApi.clearAuthAndRedirect();
    }

    /**
     * Simple helper to hide all sections and remove active state from all nav items.
     */
    /**
     * Resets all navigation states.
     */
    const resetNavigation = () => {
        [sectionOverview, sectionEvents, sectionHistory, sectionReports].forEach(sec => {
            if (sec) sec.style.display = 'none';
        });
        
        [navOverview, navEvents, navHistory, navReports].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
    };

    /**
     * Shows a specific section and persists the state.
     */
    window.showSection = (sectionId) => {
        resetNavigation();
        
        const title = document.getElementById('dynamic-title');
        const sub = document.getElementById('dynamic-subtitle');

        if (sectionId === 'nav-overview') {
            if (navOverview) navOverview.classList.add('active');
            if (sectionOverview) sectionOverview.style.display = 'block';
            // Title will be updated by loadUserInfo with the student's name
            if (sub) sub.textContent = 'Friday, February 27, 2026 • 2nd Semester A.Y. 2025–2026';
            loadOverview();
        } 
        else if (sectionId === 'nav-events') {
            if (navEvents) navEvents.classList.add('active');
            if (sectionEvents) sectionEvents.style.display = 'block';
            if (title) title.textContent = 'Events';
            if (sub) sub.textContent = 'Discover and participate in university events';
            loadEvents();
        }
        else if (sectionId === 'nav-history') {
            if (navHistory) navHistory.classList.add('active');
            if (sectionHistory) sectionHistory.style.display = 'block';
            if (title) title.textContent = 'My Attendance History';
            if (sub) sub.textContent = 'Review your participation across all events';
            loadStudentAttendance();
        }
        else if (sectionId === 'nav-reports') {
            if (navReports) navReports.classList.add('active');
            if (sectionReports) sectionReports.style.display = 'block';
            if (title) title.textContent = 'Reports & Certificates';
            if (sub) sub.textContent = 'Download official certificates and track your progress';
            loadStudentReports();
        }

        localStorage.setItem('student_last_section', sectionId);
    };

    /**
     * Converts attendance status text into CSS class names used by the design.
     */
    function getStatusClass(status) {
        if (status === 'Present') return 'attended';
        if (status === 'Absent') return 'absent';
        return 'attended';
    }

    /**
     * Builds the markup for one attendance history row from backend data.
     */
    function buildHistoryRow(item) {
        const statusClass = getStatusClass(item.status);
        const iconClass = item.status === 'Absent' ? 'danger' : 'success';
        const icon = item.status === 'Absent' ? 'fa-user-times' : 'fa-check';
        const safeEventName = item.event_name || 'Unnamed event';
        const safeDate = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'No schedule';

        return `
            <div class="history-row">
                <div class="event-info">
                    <div class="status-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                    <span class="event-name">${safeEventName}</span>
                </div>
                <span class="event-dt">${safeDate}</span>
                <span class="status-badge ${statusClass}">${item.status}</span>
            </div>
        `;
    }

    /**
     * Refreshes the summary pills (attended, absent, rate) based on real API values.
     */
    function renderHistorySummary(rows) {
        const attendedCount = rows.filter((item) => item.status === 'Present' || item.status === 'Late').length;
        const absentCount = rows.filter((item) => item.status === 'Absent').length;
        const rate = rows.length ? Math.round((attendedCount / rows.length) * 100) : 0;

        if (attendedPill) attendedPill.textContent = `${attendedCount} Attended`;
        if (absentPill) absentPill.textContent = `${absentCount} absent`;
        if (ratePill) ratePill.textContent = `${rate}% rate`;
    }

    /**
     * Renders a single event card for either Active or Upcoming grids.
     */
    function renderEventCard(event, status = 'active') {
        const isUpcoming = status === 'upcoming';
        const isPast = status === 'past';
        const badgeClass = isUpcoming ? 'upcoming' : (isPast ? 'closed' : 'open');
        const badgeText = isUpcoming ? 'Upcoming' : (isPast ? 'Closed' : 'Open Now');
        const dateStr = new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = new Date(event.start_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        // Calculate progress for active events (arbitrary visualization for now)
        const progress = isUpcoming ? 0 : (isPast ? 100 : 85); 

        return `
            <div class="event-card card animate-in">
                <div class="card-header">
                    <h3>${event.name}</h3>
                    <div class="badge-container">
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        ${!isUpcoming && !isPast ? '<span class="closes-hint">In progress</span>' : ''}
                    </div>
                </div>
                <p class="${isUpcoming ? 'event-date' : 'event-time'}">${dateStr} • ${timeStr}</p>
                ${!isUpcoming && !isPast ? `
                    <div class="progress-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>
                    <div class="card-footer">
                        <span class="expiry-text">Verified Attendance</span>
                        <button class="btn-confirm" onclick="window.startQRScan()"><i class="fas fa-qrcode"></i> Scan QR</button>
                    </div>
                ` : `
                    <div class="divider"></div>
                    <div class="card-footer upcoming-footer">
                        <span class="open-time">${isPast ? 'Event Ended' : 'Opens ' + timeStr}</span>
                    </div>
                `}
            </div>
        `;
    }

    /**
     * Loads events and distributes them into active and upcoming containers.
     */
    async function loadEvents() {
        const activeGrid = document.getElementById('active-events-grid');
        const upcomingGrid = document.getElementById('upcoming-events-grid');
        const pastGrid = document.getElementById('past-events-grid');
        
        try {
            console.log('Fetching events...');
            const response = await window.TatakApi.apiRequest('/events');
            console.log('Events response:', response);
            
            const allEvents = Array.isArray(response.data) ? response.data.filter(e => e.approval_status === 'Approved') : [];
            
            const now = new Date();
            const activeEvents = allEvents.filter(e => new Date(e.start_date) <= now && (!e.end_date || new Date(e.end_date) >= now));
            const upcomingEvents = allEvents.filter(e => new Date(e.start_date) > now);
            const pastEvents = allEvents.filter(e => e.end_date && new Date(e.end_date) < now);

            if (activeGrid) {
                activeGrid.innerHTML = activeEvents.length 
                    ? activeEvents.map(e => renderEventCard(e, 'active')).join('')
                    : '<p style="grid-column: 1/-1; color: #7a829a; padding: 20px;">No events currently happening.</p>';
            }

            if (upcomingGrid) {
                upcomingGrid.innerHTML = upcomingEvents.length
                    ? upcomingEvents.map(e => renderEventCard(e, 'upcoming')).join('')
                    : '<p style="grid-column: 1/-1; color: #7a829a; padding: 20px;">No upcoming events scheduled.</p>';
            }

            if (pastGrid) {
                pastGrid.innerHTML = pastEvents.length
                    ? pastEvents.map(e => renderEventCard(e, 'past')).join('')
                    : '<p style="grid-column: 1/-1; color: #7a829a; padding: 20px;">No past events found.</p>';
            }

            return { activeEvents, upcomingEvents, pastEvents };
        } catch (err) {
            console.error('Error loading events:', err);
        }
    }

    /**
     * Updates the Overview section with real stats and the "Next Event" card.
     */
    async function loadOverview() {
        const nextEventContainer = document.getElementById('overview-next-event');
        const statsContainer = document.getElementById('overview-stats');

        try {
            // 1. Fetch History for Stats
            const historyData = await window.TatakApi.apiRequest('/attendance/users');
            const rows = Array.isArray(historyData.data) ? historyData.data : [];
            const attendedCount = rows.filter((item) => item.status === 'Present' || item.status === 'Late').length;
            const absentCount = rows.filter((item) => item.status === 'Absent').length;
            const rate = rows.length ? Math.round((attendedCount / rows.length) * 100) : 0;

            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="circular-progress" style="background: conic-gradient(var(--sidebar-bg) ${rate}%, #edf2f7 0);"><span class="percent" style="background: white; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">${rate}%</span></div>
                    <div class="stat-boxes">
                        <div class="stat-box attended"><strong>${attendedCount}</strong><span>Attended</span></div>
                        <div class="stat-box missed"><strong>${absentCount}</strong><span>Missed</span></div>
                    </div>
                `;
            }

            // 2. Fetch Events for "Next Event"
            const eventResponse = await window.TatakApi.apiRequest('/events');
            const approvedEvents = Array.isArray(eventResponse.data) ? eventResponse.data.filter(e => e.approval_status === 'Approved') : [];
            const now = new Date();
            
            // Prioritize active events, then closest upcoming
            let nextEvent = approvedEvents.find(e => new Date(e.start_date) <= now && (!e.end_date || new Date(e.end_date) >= now));
            if (!nextEvent) {
                nextEvent = approvedEvents.filter(e => new Date(e.start_date) > now).sort((a,b) => new Date(a.start_date) - new Date(b.start_date))[0];
            }

            if (nextEventContainer) {
                if (nextEvent) {
                    const isUpcoming = new Date(nextEvent.start_date) > now;
                    const isPast = nextEvent.end_date && new Date(nextEvent.end_date) < now;
                    const badgeClass = isUpcoming ? 'upcoming' : (isPast ? 'closed' : 'open');
                    const badgeText = isUpcoming ? 'Coming Up' : (isPast ? 'Closed' : 'Open Now');
                    
                    nextEventContainer.innerHTML = `
                        <div class="card-header">
                            <h3>${nextEvent.name}</h3>
                            <span class="badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <p class="event-time">${new Date(nextEvent.start_date).toLocaleString()}</p>
                        <div class="progress-container"><div class="progress-bar" style="width: ${isUpcoming ? 0 : 100}%;"></div></div>
                        <div class="card-footer">
                            <span class="expiry-text">${isUpcoming ? 'Get ready!' : 'Scan now to attend'}</span>
                            ${!isUpcoming ? '<button class="btn-confirm" onclick="window.startQRScan()"><i class="fas fa-qrcode"></i> Scan QR</button>' : ''}
                        </div>
                    `;
                } else {
                    nextEventContainer.innerHTML = `<h3>No Events Scheduled</h3><p class="event-time">Check back later for updates.</p>`;
                }
            }
        } catch (err) {
            console.error('Error refreshing overview:', err);
        }
    }

    /**
     * Loads the logged-in student's information and updates the UI.
     */
    async function loadUserInfo() {
        try {
            const res = await window.TatakApi.apiRequest('/auth/me');
            const user = res;
            if (user) {
                // Update Welcome Text
                const welcomeTitle = document.getElementById('dynamic-title');
                if (welcomeTitle) welcomeTitle.innerHTML = `Hello, <span class="highlight" style="color: #f59e0b; text-transform: uppercase;">${user.fname || 'Student'}</span>`;
                
                // Update Profile Avatar
                const profileAvatar = document.querySelector('.profile-avatar');
                if (profileAvatar && user.profile_picture) {
                    profileAvatar.src = formatImageUrl(user.profile_picture);
                    profileAvatar.style.objectFit = 'cover';
                    profileAvatar.style.borderRadius = '50%';
                }
            }
        } catch (err) {
            console.error('Error loading user info:', err);
        }
    }

    /**
     * Refreshes the entire dashboard data.
     */
    async function refreshDashboard() {
        await Promise.all([loadUserInfo(), loadOverview(), loadEvents(), loadStudentAttendance()]);
    }

    /**
     * Loads student attendance history from backend and renders it into History section.
     */
    async function loadStudentAttendance() {
        try {
            const data = await window.TatakApi.apiRequest('/attendance/users');
            allHistoryRows = Array.isArray(data.data) ? data.data : [];

            renderHistorySummary(allHistoryRows);
            renderHistoryRows(allHistoryRows);
        } catch (err) {
            console.error('Error loading attendance history', err);
        }
    }

    /**
     * Renders history rows into the history container.
     */
    function renderHistoryRows(rows) {
        if (!historyContainer) return;
        const header = `
            <div class="history-header">
                <span>EVENT</span>
                <span>DATE & TIME</span>
                <span>STATUS</span>
            </div>
        `;
        
        if (!rows.length) {
            historyContainer.innerHTML = `${header}<div class="history-row" style="grid-template-columns: 1fr;"><span class="event-name" style="text-align: center; color: #a3aed0;">No matching attendance records found.</span></div>`;
        } else {
            historyContainer.innerHTML = header + rows.map(buildHistoryRow).join('');
        }
    }

    // Initial auth check when the dashboard loads.
    ensureStudentAuthenticated();

    // Logout modal helpers.
    const showModal = (e) => {
        if (e) e.preventDefault();
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    };

    const hideModal = () => {
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    if (sidebarLogout) sidebarLogout.addEventListener('click', showModal);
    if (topbarLogout) topbarLogout.addEventListener('click', showModal);
    if (stayBtn) stayBtn.addEventListener('click', hideModal);
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            performLogout();
        });
    }

    // Navigation between sections.
    if (navOverview) navOverview.addEventListener('click', () => showSection('nav-overview'));
    if (navEvents) navEvents.addEventListener('click', () => showSection('nav-events'));
    if (navHistory) navHistory.addEventListener('click', () => showSection('nav-history'));
    if (navReports) navReports.addEventListener('click', () => showSection('nav-reports'));

    // History Search functionality
    const historySearchInput = document.getElementById('historySearchInput');
    if (historySearchInput) {
        historySearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allHistoryRows.filter(row => 
                (row.event_name || '').toLowerCase().includes(term) ||
                (row.status || '').toLowerCase().includes(term) ||
                (row.timestamp && new Date(row.timestamp).toLocaleString().toLowerCase().includes(term))
            );
            renderHistoryRows(filtered);
        });
    }

    const updateNotificationBadgeUI = () => {
        if (!notificationBadge) return;
        const count = studentNotificationsCache.unread.length;
        if (count > 0) {
            notificationBadge.innerText = count > 9 ? '9+' : String(count);
            notificationBadge.style.display = 'inline-flex';
        } else {
            notificationBadge.style.display = 'none';
        }
    };

    const buildNotificationItem = (notification, unread = false) => {
        return `
            <button type="button" class="notification-item ${unread ? 'unread' : ''}" data-id="${notification.notification_id}">
                <p class="notification-title">${notification.title || 'Notification'}</p>
                <p class="notification-message">${notification.message || ''}</p>
                <div class="notification-meta">
                    <span>${notification.type || 'System'}</span>
                    <span>${new Date(notification.created_at).toLocaleString()}</span>
                </div>
            </button>
        `;
    };

    const renderStudentNotifications = () => {
        if (!notificationList) return;
        if (markAllReadBtn) {
            markAllReadBtn.style.display = studentNotificationsCache.unread.length ? 'inline-flex' : 'none';
        }

        if (!studentNotificationsCache.unread.length && !studentNotificationsCache.read.length) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
            return;
        }

        let html = '';
        if (studentNotificationsCache.unread.length) {
            html += '<div class="notification-section-label">New</div>';
            html += studentNotificationsCache.unread.map(item => buildNotificationItem(item, true)).join('');
        }
        if (studentNotificationsCache.read.length) {
            html += '<div class="notification-section-label">Earlier</div>';
            html += studentNotificationsCache.read.map(item => buildNotificationItem(item, false)).join('');
        }

        notificationList.innerHTML = html;
        notificationList.querySelectorAll('.notification-item').forEach(button => {
            button.addEventListener('click', async () => {
                const id = button.dataset.id;
                if (!id) return;
                await markStudentNotificationRead(id);
            });
        });
    };

    const hideStudentNotifications = () => {
        if (notificationDropdown) notificationDropdown.style.display = 'none';
    };

    /**
     * Loads student attendance history and renders it as certificates.
     */
    async function loadStudentReports() {
        const container = document.getElementById('section-reports');
        if (!container) return;

        // Initialize structure if needed
        let listContainer = document.getElementById('student-certificates-list');
        if (!listContainer) {
            container.innerHTML = `
                <div class="white-container">
                    <div style="margin-bottom: 25px;">
                        <h3 style="margin: 0; color: #1e293b;">My Certificates</h3>
                        <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Download your attendance certificates for attended events.</p>
                    </div>
                    <div id="student-certificates-list">
                        <p style="text-align: center; padding: 40px; color: #94a3b8;">Loading history...</p>
                    </div>
                </div>`;
            listContainer = document.getElementById('student-certificates-list');
        }

        try {
            const res = await window.TatakApi.apiRequest('/attendance/users');
            const history = Array.isArray(res.data) ? res.data : [];
            const attendedEvents = history.filter(h => h.status === 'Present' || h.status === 'Late');

            if (attendedEvents.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #94a3b8;">You haven\'t attended any events yet.</p>';
                return;
            }

            listContainer.innerHTML = attendedEvents.map(item => {
                const dateStr = new Date(item.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const certId = `CERT-${item.event_id}-${new Date(item.timestamp).getTime().toString().slice(-4)}`;
                
                return `
                    <div class="cert-row" style="display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid #f1f5f9; gap: 20px;">
                        <div style="width: 48px; height: 48px; background: #f0fdf4; color: #16a34a; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                            <i class="fas fa-certificate"></i>
                        </div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: #1e293b; font-size: 16px;">${item.event_name || 'Event Attendance'}</h4>
                            <p style="margin: 4px 0; color: #64748b; font-size: 13px;">Attended on ${dateStr}</p>
                            <div style="display: flex; gap: 10px; margin-top: 8px;">
                                <span class="badge-mini" style="background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${item.status}</span>
                                <span style="font-size: 11px; color: #94a3b8;">Verify ID: ${certId}</span>
                            </div>
                        </div>
                        <button class="btn-download" 
                                data-event-name="${(item.event_name || 'Event').replace(/'/g, "&apos;")}" 
                                data-details="Attended on ${dateStr}"
                                data-cert-id="${certId}"
                                style="background: var(--sidebar-bg); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">Claim PDF</button>
                    </div>
                `;
            }).join('');

            listContainer.querySelectorAll('.btn-download').forEach(button => {
                button.addEventListener('click', () => {
                    const eventName = button.dataset.eventName;
                    const details = button.dataset.details;
                    const certificateId = button.dataset.certId;
                    const recipient = document.getElementById('student-name')?.innerText || 'Student';
                    downloadCertificate({ 
                        recipient, 
                        eventName, 
                        details, 
                        certificateId, 
                        issuer: 'University of Cebu', 
                        date: new Date().toLocaleDateString() 
                    });
                });
            });
        } catch (err) {
            listContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #ef4444;">Error loading certificates.</p>';
        }
    }

    const downloadCertificate = ({ recipient = 'Student', eventName = 'Attendance Event', details = '', certificateId = 'CERT-000', issuer = 'University of Cebu', date = '' } = {}) => {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error('jsPDF library not available');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFillColor('#f8fafc');
        doc.rect(0, 0, pageWidth, 612, 'F');
        doc.setFontSize(28);
        doc.setTextColor('#1e3a8a');
        doc.text('CERTIFICATE OF PARTICIPATION', pageWidth / 2, 120, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor('#475569');
        doc.text('This certificate is proudly presented to', pageWidth / 2, 170, { align: 'center' });

        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#1f2937');
        doc.text(recipient, pageWidth / 2, 230, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`For attending and participating in: ${eventName}`, pageWidth / 2, 280, { align: 'center' });
        doc.text(`Details: ${details}`, pageWidth / 2, 305, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor('#4b5563');
        doc.text(`Certificate ID: ${certificateId}`, pageWidth / 2, 345, { align: 'center' });
        doc.text(`Issuer: ${issuer}${date ? ` • ${date}` : ''}`, pageWidth / 2, 365, { align: 'center' });

        doc.setDrawColor('#cbd5e1');
        doc.setLineWidth(1.5);
        doc.line(80, 450, pageWidth - 80, 450);
        doc.setFontSize(12);
        doc.setTextColor('#64748b');
        doc.text('This certificate is issued by the University of Cebu and is valid for official attendance proof purposes.', pageWidth / 2, 475, { align: 'center' });

        const fileName = `${certificateId.replace(/\s+/g, '_') || 'certificate'}.pdf`;
        doc.save(fileName);
    };

    const setupStudentCertificateButtons = () => {
        document.querySelectorAll('.btn-download').forEach(button => {
            button.addEventListener('click', () => {
                const row = button.closest('.cert-row');
                const eventName = row.querySelector('h3')?.innerText || 'Event Attendance';
                const details = row.querySelector('p')?.innerText || '';
                const certificateId = row.querySelector('.cert-id')?.innerText?.split('•')[0]?.trim().replace('Certificate ID:', '').trim() || `CERT-${Date.now()}`;
                const recipient = document.querySelector('.top-bar .welcome-text h1')?.innerText.replace('Hello,', '').trim() || 'Student';
                downloadCertificate({ recipient, eventName, details, certificateId, issuer: 'University of Cebu', date: new Date().toLocaleDateString() });
            });
        });
    };

    const toggleStudentNotifications = async () => {
        if (!notificationDropdown) return;
        const isOpen = notificationDropdown.style.display === 'block';
        if (isOpen) {
            hideStudentNotifications();
            return;
        }
        await loadStudentNotifications();
        notificationDropdown.style.display = 'block';
    };

    const loadStudentNotifications = async () => {
        if (!notificationList) return;
        try {
            const res = await window.TatakApi.apiRequest('/notifications');
            studentNotificationsCache.unread = res.unread || [];
            studentNotificationsCache.read = res.read || [];
            updateNotificationBadgeUI();
            renderStudentNotifications();
        } catch (err) {
            console.error('Error loading notifications:', err);
            if (notificationList) notificationList.innerHTML = '<div class="notification-empty">Unable to load notifications.</div>';
        }
    };

    const markStudentNotificationRead = async (id) => {
        try {
            await window.TatakApi.apiRequest(`/notifications/${id}`, { method: 'PUT' });
            await loadStudentNotifications();
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    };

    const markAllStudentNotificationsRead = async () => {
        if (!studentNotificationsCache.unread.length) return;
        try {
            await Promise.all(studentNotificationsCache.unread.map(notification => window.TatakApi.apiRequest(`/notifications/${notification.notification_id}`, { method: 'PUT' })));
            await loadStudentNotifications();
        } catch (err) {
            console.error('Error marking all notifications read:', err);
        }
    };

    if (notificationBell) {
        notificationBell.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleStudentNotifications();
        });
    }
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await markAllStudentNotificationsRead();
        });
    }
    window.addEventListener('click', (e) => {
        if (notificationDropdown && notificationDropdown.style.display === 'block' && !notificationDropdown.contains(e.target) && notificationBell && !notificationBell.contains(e.target)) {
            hideStudentNotifications();
        }
    });

    // Initial authentication check then load profile
    ensureStudentAuthenticated();
    loadUserInfo().then(async () => {
        const lastSection = localStorage.getItem('student_last_section') || 'nav-overview';
        showSection(lastSection);
        
        if (typeof loadStudentNotifications === 'function') {
            loadStudentNotifications();
        }
        setupStudentCertificateButtons();
    });

    // Global click handler for closing logout modal by clicking outside.
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
    // Check for pending notifications
    if (window.TatakApi && window.TatakApi.checkPendingToast) {
        window.TatakApi.checkPendingToast();
    }
});

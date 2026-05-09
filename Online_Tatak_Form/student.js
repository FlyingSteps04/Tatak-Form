document.addEventListener('DOMContentLoaded', () => {
    const formatImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('/uploads')) {
            return `${window.TatakApi.API_BASE_URL}${url}`;
        }
        return url;
    };

    const modal = document.getElementById('logoutModal');
    const stayBtn = document.getElementById('stayLoggedIn');
    const confirmBtn = document.getElementById('confirmLogout');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const topbarLogout = document.getElementById('topbarLogout');

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
    const resetNavigation = () => {
        [sectionOverview, sectionEvents, sectionHistory, sectionReports].forEach(sec => {
            if (sec) sec.style.display = 'none';
        });
        
        [navOverview, navEvents, navHistory, navReports].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
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
                const welcomeH1 = document.querySelector('.welcome-text h1');
                if (welcomeH1) welcomeH1.innerHTML = `Hello, <span class="highlight" style="color: #f59e0b; text-transform: uppercase;">${user.fname || 'Student'}</span>`;
                
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
            const rows = Array.isArray(data.data) ? data.data : [];

            renderHistorySummary(rows);

            if (historyContainer) {
                const header = `
                    <div class="history-header">
                        <span>EVENT</span>
                        <span>DATE & TIME</span>
                        <span>STATUS</span>
                    </div>
                `;
                if (!rows.length) {
                    historyContainer.innerHTML = `${header}<div class="history-row"><span class="event-name">No attendance records yet.</span></div>`;
                } else {
                    historyContainer.innerHTML = header + rows.map(buildHistoryRow).join('');
                }
            }
        } catch (err) {
            console.error('Error loading attendance history', err);
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
    if (navOverview) {
        navOverview.addEventListener('click', () => {
            resetNavigation();
            navOverview.classList.add('active');
            if (sectionOverview) sectionOverview.style.display = 'block';
            loadOverview();
        });
    }

    if (navEvents) {
        navEvents.addEventListener('click', () => {
            resetNavigation();
            navEvents.classList.add('active');
            if (sectionEvents) sectionEvents.style.display = 'block';
            loadEvents();
        });
    }

    if (navHistory) {
        navHistory.addEventListener('click', () => {
            resetNavigation(); 
            navHistory.classList.add('active');
            if (sectionHistory) sectionHistory.style.display = 'block';

            // When user visits History, load attendance from backend.
            loadStudentAttendance();
        });
    }

    if (navReports) {
        navReports.addEventListener('click', () => {
            resetNavigation();
            navReports.classList.add('active');
            if (sectionReports) sectionReports.style.display = 'block';
        });
    }

    // Initial Dashboard Refresh
    refreshDashboard();

    // Global click handler for closing logout modal by clicking outside.
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
    // Check for pending notifications
    if (window.TatakApi && window.TatakApi.checkPendingToast) {
        window.TatakApi.checkPendingToast();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('logoutModal');
    const stayBtn = document.getElementById('stayLoggedIn');
    const confirmBtn = document.getElementById('confirmLogout');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const topbarLogout = document.getElementById('topbarLogout');

    const navOverview = document.getElementById('nav-overview');
    const navActiveEvents = document.getElementById('nav-active-events');
    const navUpcoming = document.getElementById('nav-upcoming'); 
    const navHistory = document.getElementById('nav-history');
    const navReports = document.getElementById('nav-reports');

    const sectionOverview = document.getElementById('section-overview');
    const sectionActiveEvents = document.getElementById('section-active-events');
    const sectionUpcoming = document.getElementById('section-upcoming');
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
        [sectionOverview, sectionActiveEvents, sectionUpcoming, sectionHistory, sectionReports].forEach(sec => {
            if (sec) sec.style.display = 'none';
        });
        
        [navOverview, navActiveEvents, navUpcoming, navHistory, navReports].forEach(nav => {
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
        });
    }

    if (navActiveEvents) {
        navActiveEvents.addEventListener('click', () => {
            resetNavigation();
            navActiveEvents.classList.add('active');
            if (sectionActiveEvents) sectionActiveEvents.style.display = 'block';
        });
    }

    if (navUpcoming) {
        navUpcoming.addEventListener('click', () => {
            resetNavigation();
            navUpcoming.classList.add('active');
            if (sectionUpcoming) sectionUpcoming.style.display = 'block';
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

    // Global click handler for closing logout modal by clicking outside.
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
});

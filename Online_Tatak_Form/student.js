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

    // 2. Start Scan Button Logic
    startScanBtn.addEventListener('click', () => {
        // Toggle UI views
        defaultView.style.display = 'none';
        activeView.style.display = 'block';

        // Initialize the QR Code reader on the 'reader' div
        html5QrCode = new Html5Qrcode("reader");

        // Function to run when a QR code is successfully scanned
        // Function to run when a QR code is successfully scanned
const onScanSuccess = (decodedText, decodedResult) => {
    stopScanner(); // Stop camera immediately
    alert(`Attendance Sucess!`); // Optional: show raw data for debugging
    // 1. Parse the scanned QR data

    console.log("Decoded QR Data:", decodedText); // Debug log to see raw QR content
    let qrData;
    try {
        qrData = JSON.parse(decodedText);
    } catch (e) {
        alert("Invalid QR Code format.");
        return;
    }

    // 2. Get User Location and Send to Backend
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const payload = {
                event_token: qrData.event_token, // From QR code
                user_latitude: position.coords.latitude,
                user_longitude: position.coords.longitude
            };

            try {
                // Call your API (Assuming window.TatakApi.apiRequest is your helper)
                const response = await window.TatakApi.apiRequest('/attendance/scan', {
    method: 'POST',
    body: JSON.stringify(payload)
});
                
                if (response.success) {
                    alert(`Success: ${response.message}`);
                    // Optional: reload history to show new record
                    //loadStudentAttendance(); 
                } else {
                    alert(`Error: ${response.error}`);
                }
            } catch (err) {
                // alert("Failed to process attendance. Please try again.");
                // console.error("Scan API Error:", err);

            }
        }, (geoError) => {
           // console.error("Geolocation Error:", geoError);
            alert("Location access is required to verify attendance.");
        });
    } else {
        alert("Your browser does not support Geolocation.");
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

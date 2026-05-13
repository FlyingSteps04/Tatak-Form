document.addEventListener('DOMContentLoaded', () => {
    const formatImageUrl = window.TatakApi.formatImageUrl;

    const logoutModal = document.getElementById('logoutModal');
    // Updated to match the new HTML IDs
    const officerEventModal = document.getElementById('officerEventModal'); 
    const officerEventForm = document.getElementById('officerEventForm');
    const officerEventModalTitle = document.getElementById('officerEventModalTitle');
    const officerEventIdInput = document.getElementById('officerEventId');

    const stayBtn = document.getElementById('stayLoggedIn');
    const confirmBtn = document.getElementById('confirmLogout');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const topbarLogout = document.querySelector('.logout-circle');
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllRead');
    let officerNotificationsCache = { unread: [], read: [] };

    // Updated button references for the new Add Event modal
    const closeOfficerEventTopBtn = document.getElementById('closeOfficerEventTopBtn');
    const cancelOfficerEventBtn = document.getElementById('cancelOfficerEventBtn');

    const createEventBtn = document.querySelector('.btn-create-event');
    const officerEventsGrid = document.getElementById('officerEventsGrid');

    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const attendanceFooterText = document.getElementById('attendanceFooterText');
    const eventSelect = document.getElementById('eventSelect');
    
    // Edit Attendance Modal Elements
    const editAttendanceModal = document.getElementById('editAttendanceModal');
    const editStudentName = document.getElementById('editStudentName');
    const editAttendanceIdInput = document.getElementById('editAttendanceId');
    const editAttendanceStatusSelect = document.getElementById('editAttendanceStatus');
    const editAttendanceReasonInput = document.getElementById('editAttendanceReason');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    // Cache of all loaded rows for client-side search filtering
    let _allAttendanceRows = [];

    // The organization_id of the currently logged-in officer (fetched on init)
    let _officerOrgId = null;

    const navMapping = {
        'nav-overview': { section: 'section-overview', title: 'Hello, Officer' },
        'nav-events': { section: 'section-events', title: 'Manage Event' },
        'nav-attendance': { section: 'section-attendance', title: 'Attendance Tracking' },
        'nav-reports': { section: 'section-reports', title: 'Generated Reports' }
    };

    const dynamicTitle = document.getElementById('dynamic-title');

    /**
     * Verifies that the current user is logged in as an Officer (or Admin),
     * and redirects back to login if not.
     */
    function ensureOfficerAuthenticated() {
        const token = localStorage.getItem('tatak_token');
        const role = localStorage.getItem('tatak_role');

        if (!token || (role !== 'Officer' && role !== 'Admin')) {
            window.TatakApi.clearAuthAndRedirect();
        }
    }

    /**
     * Fetches the logged-in officer's profile to determine their organization.
     * Stores organization_id in _officerOrgId for event filtering.
     */
    async function loadOfficerProfile() {
        try {
            const res = await window.TatakApi.apiRequest('/officers/me');
            const profile = res.data || res;
            _officerOrgId = profile.organization_id || profile.org_id || null;

            // Also update the sidebar name/role and avatars
            const nameEl = document.querySelector('.officer-name');
            const roleEl = document.querySelector('.officer-role');
            const widgetAvatar = document.querySelector('.widget-avatar');
            const profileAvatar = document.querySelector('.profile-avatar');

            if (nameEl && profile.fname) nameEl.textContent = profile.fname;
            const dynamicTitle = document.getElementById('dynamic-title');
            if (dynamicTitle && profile.fname) {
                dynamicTitle.innerHTML = `HELLO, <span class="highlight">${profile.fname.toUpperCase()}</span>`;
            }
            if (roleEl) {
                const orgName = profile.organization_name || profile.org_name || '';
                const position = profile.position || profile.role || 'Officer';
                roleEl.textContent = orgName ? `${orgName} - ${position}` : position;
            }
            
            if (profile.profile_picture) {
                const fullPicUrl = formatImageUrl(profile.profile_picture);
                if (widgetAvatar) {
                    widgetAvatar.src = fullPicUrl;
                    widgetAvatar.style.objectFit = 'cover';
                }
                if (profileAvatar) {
                    profileAvatar.src = fullPicUrl;
                    profileAvatar.style.objectFit = 'cover';
                }
            }
        } catch (err) {
            // /officers/me may not exist — fall back to no filtering
            console.warn('Could not load officer profile, showing all events.', err);
            _officerOrgId = null;
        }
    }

    /**
     * Filters an array of events to only those belonging to the officer's org.
     * If _officerOrgId is null (profile fetch failed), returns all events.
     */
    function filterByOfficerOrg(events) {
        if (!_officerOrgId) return events;
        return events.filter(e =>
            String(e.organization_id) === String(_officerOrgId) ||
            String(e.org_id)          === String(_officerOrgId)
        );
    }

    /**
     * Logs the user out by clearing stored auth info and sending them to the login page.
     */
    function performLogout() {
        window.TatakApi.clearAuthAndRedirect();
    }

    /**
     * Returns the CSS class suffix for a given status string.
     */
    function getStatusClass(status) {
        const s = (status || '').toLowerCase();
        if (s === 'late' || s === 'excused') return 'late';
        if (s === 'absent') return 'absent';
        return 'present'; // Present, Attended, or any other = green
    }

    /**
     * Returns a display label for a status value.
     */
    function getStatusLabel(status) {
        const s = (status || '').toLowerCase();
        if (s === 'late') return 'Late';
        if (s === 'absent') return 'Absent';
        if (s === 'excused') return 'Excused';
        return 'Present';
    }

    const updateNotificationBadgeUI = () => {
        if (!notificationBadge) return;
        const count = officerNotificationsCache.unread.length;
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

    const renderOfficerNotifications = () => {
        if (!notificationList) return;
        if (markAllReadBtn) {
            markAllReadBtn.style.display = officerNotificationsCache.unread.length ? 'inline-flex' : 'none';
        }

        if (!officerNotificationsCache.unread.length && !officerNotificationsCache.read.length) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
            return;
        }

        let html = '';
        if (officerNotificationsCache.unread.length) {
            html += '<div class="notification-section-label">New</div>';
            html += officerNotificationsCache.unread.map(item => buildNotificationItem(item, true)).join('');
        }
        if (officerNotificationsCache.read.length) {
            html += '<div class="notification-section-label">Earlier</div>';
            html += officerNotificationsCache.read.map(item => buildNotificationItem(item, false)).join('');
        }

        notificationList.innerHTML = html;
        notificationList.querySelectorAll('.notification-item').forEach(button => {
            button.addEventListener('click', async () => {
                const id = button.dataset.id;
                if (!id) return;
                await markOfficerNotificationRead(id);
            });
        });
    };

    const hideOfficerNotifications = () => {
        if (notificationDropdown) notificationDropdown.style.display = 'none';
    };

    const toggleOfficerNotifications = async () => {
        if (!notificationDropdown) return;
        const isOpen = notificationDropdown.style.display === 'block';
        if (isOpen) {
            hideOfficerNotifications();
            return;
        }
        await loadOfficerNotifications();
        notificationDropdown.style.display = 'block';
    };

    const loadOfficerNotifications = async () => {
        if (!notificationList) return;
        try {
            const res = await window.TatakApi.apiRequest('/notifications');
            officerNotificationsCache.unread = res.unread || [];
            officerNotificationsCache.read = res.read || [];
            updateNotificationBadgeUI();
            renderOfficerNotifications();
        } catch (err) {
            console.error('Error loading officer notifications:', err);
            if (notificationList) notificationList.innerHTML = '<div class="notification-empty">Unable to load notifications.</div>';
        }
    };

    const markOfficerNotificationRead = async (id) => {
        try {
            await window.TatakApi.apiRequest(`/notifications/${id}`, { method: 'PUT' });
            await loadOfficerNotifications();
        } catch (err) {
            console.error('Failed to mark notification read:', err);
        }
    };

    const markAllOfficerNotificationsRead = async () => {
        if (!officerNotificationsCache.unread.length) return;
        try {
            await Promise.all(officerNotificationsCache.unread.map(notification => window.TatakApi.apiRequest(`/notifications/${notification.notification_id}`, { method: 'PUT' })));
            await loadOfficerNotifications();
        } catch (err) {
            console.error('Failed to mark all notifications read:', err);
        }
    };

    /**
     * Loads and renders dynamic reports for the officer's organization.
     */
    async function loadOfficerReports() {
        const container = document.getElementById('section-reports');
        if (!container) return;

        // Create inner container if it doesn't exist to match design
        let listContainer = container.querySelector('.white-container');
        if (!listContainer) {
            container.innerHTML = `<div class="white-container">
                <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0; color: #1e293b;">Organization Reports</h3>
                    <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Download attendance summaries for your events.</p>
                </div>
                <div id="officer-reports-list">
                    <p style="text-align: center; padding: 40px; color: #94a3b8;">Loading events...</p>
                </div>
            </div>`;
            listContainer = container.querySelector('#officer-reports-list');
        } else {
            // If it already has the structure, just target the list
            listContainer = document.getElementById('officer-reports-list') || listContainer;
        }

        try {
            const res = await window.TatakApi.apiRequest('/events');
            const allEvents = Array.isArray(res.data) ? res.data : [];
            const events = filterByOfficerOrg(allEvents);

            if (events.length === 0) {
                listContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #94a3b8;">No events found for your organization.</p>';
                return;
            }

            listContainer.innerHTML = events.map(event => {
                const dateStr = new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const certId = `REP-${event.event_id}-${new Date(event.start_date).getTime().toString().slice(-4)}`;
                
                return `
                    <div class="cert-row" style="display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid #f1f5f9; gap: 20px;">
                        <div style="width: 48px; height: 48px; background: #eff6ff; color: #3b82f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                            <i class="far fa-file-pdf"></i>
                        </div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: #1e293b; font-size: 16px;">${event.name}</h4>
                            <p style="margin: 4px 0; color: #64748b; font-size: 13px;">${dateStr} • ${event.location || 'TBA'}</p>
                            <div style="display: flex; gap: 10px; margin-top: 8px;">
                                <span class="badge-mini" style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Attendance Summary</span>
                                <span style="font-size: 11px; color: #94a3b8;">ID: ${certId}</span>
                            </div>
                        </div>
                        <button class="btn-download-record" 
                                data-event-name="${event.name.replace(/'/g, "&apos;")}" 
                                data-details="${dateStr} • ${event.location || 'Main Campus'}"
                                data-cert-id="${certId}"
                                style="background: #1e293b; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">Download</button>
                    </div>
                `;
            }).join('');

            listContainer.querySelectorAll('.btn-download-record').forEach(button => {
                button.addEventListener('click', () => {
                    const eventName = button.dataset.eventName;
                    const details = button.dataset.details;
                    const certificateId = button.dataset.certId;
                    const recipient = document.querySelector('.officer-name')?.innerText || 'Officer';
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
            listContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #ef4444;">Error loading events.</p>';
        }
    }

    const downloadCertificate = ({ recipient = 'Officer', eventName = 'Attendance Event', details = '', certificateId = 'CERT-000', issuer = 'University of Cebu', date = '' } = {}) => {
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

    const setupOfficerCertificateButtons = () => {
        document.querySelectorAll('.btn-download-record, .btn-generate-new, .btn-generate-main').forEach(button => {
            button.addEventListener('click', () => {
                const row = button.closest('.record-item');
                const title = row?.querySelector('h4')?.innerText || 'Event Attendance';
                const details = row?.querySelector('p')?.innerText || '';
                const certificateId = `CERT-${new Date().getTime()}`;
                const recipient = document.querySelector('.top-bar .welcome-text h1')?.innerText.replace('Hello,', '').trim() || 'Officer';
                downloadCertificate({ recipient, eventName: title, details, certificateId, issuer: 'University of Cebu', date: new Date().toLocaleDateString() });
            });
        });
    };

    if (notificationBell) {
        notificationBell.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleOfficerNotifications();
        });
    }
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await markAllOfficerNotificationsRead();
        });
    }
    window.addEventListener('click', (e) => {
        if (notificationDropdown && notificationDropdown.style.display === 'block' && !notificationDropdown.contains(e.target) && notificationBell && !notificationBell.contains(e.target)) {
            hideOfficerNotifications();
        }
    });

    /**
     * Gets the first letter(s) of a name for the avatar circle.
     */
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return parts[0][0].toUpperCase();
    }

    /**
     * Renders the attendance rows into the table.
     * @param {Array} rows - The attendance data rows to display.
     */
    function renderAttendanceTable(rows) {
        if (!attendanceTableBody) return;

        if (!rows || !rows.length) {
            attendanceTableBody.innerHTML = `
                <tr class="att-empty-row">
                    <td colspan="5">
                        <div class="att-empty-inner">
                            <i class="fas fa-users-slash"></i>
                            <p>No attendance records yet for this event.</p>
                        </div>
                    </td>
                </tr>`;
            if (attendanceFooterText) attendanceFooterText.textContent = 'No records found';
            return;
        }

        attendanceTableBody.innerHTML = rows.map((item) => {
            const fullName  = item.fname || 'Unknown Student';
            const idNumber  = item.stud_id_number || item.student_id_number || 'N/A';
            const course    = item.course || item.program || 'BSIT-3'; // Default to match UI
            const status    = item.status || 'Present';
            const statusCls = getStatusClass(status);
            const initials  = getInitials(fullName);
            
            // Real logic: (Attended Events / Total Past Events) * 100
            const attended = parseInt(item.attended_count) || 0;
            const total = parseInt(item.total_passed_events) || 1; // Avoid division by zero
            const attendanceRate = Math.min(100, Math.round((attended / total) * 100));
            
            const progressColor = attendanceRate > 80 ? '#10b981' : (attendanceRate > 50 ? '#f59e0b' : '#ef4444');

            const avatarContent = item.profile_picture 
                ? `<img src="${formatImageUrl(item.profile_picture)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                : initials;

            return `
            <tr>
                <td>
                    <div class="att-student-cell">
                        <div class="att-avatar" style="overflow: hidden; display: flex; align-items: center; justify-content: center;">${avatarContent}</div>
                        <span class="att-student-name">${fullName}</span>
                    </div>
                </td>
                <td class="text-center"><span class="att-id-badge">${idNumber}</span></td>
                <td class="text-center"><span class="att-course-tag">${course}</span></td>
                <td class="text-center"><span class="att-status-pill att-status-${statusCls}">${getStatusLabel(status)}</span></td>
                <td class="text-center">
                    <div style="width: 100px; margin: 0 auto;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                            <span style="color: #64748b;">Attendance</span>
                            <span style="font-weight: 700; color: #1e293b;">${attendanceRate}%</span>
                        </div>
                        <div style="height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
                            <div style="width: ${attendanceRate}%; height: 100%; background: ${progressColor}; border-radius: 10px;"></div>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <button class="att-action-btn" title="Edit Attendance" onclick="window.openEditAttendanceModal(${item.attendance_id}, '${fullName.replace(/'/g, "\\'")}', '${status}')">
                        <i class="far fa-edit"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (attendanceFooterText) {
            attendanceFooterText.textContent = `Showing ${rows.length} of ${_allAttendanceRows.length} students`;
        }
    }

    /**
     * Loads attendance records for a given event ID and paints them in the table.
     */
    async function loadEventAttendance(eventId) {
        if (!eventId) return;

        if (attendanceTableBody) {
            attendanceTableBody.innerHTML = `
                <tr class="att-empty-row">
                    <td colspan="5">
                        <div class="att-empty-inner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading attendance records...</p>
                        </div>
                    </td>
                </tr>`;
        }
        if (attendanceFooterText) attendanceFooterText.textContent = 'Loading...';

        try {
            const data = await window.TatakApi.apiRequest(`/attendance/personnel/${eventId}`);
            _allAttendanceRows = Array.isArray(data.data) ? data.data : [];
            renderAttendanceTable(_allAttendanceRows);
        } catch (err) {
            console.error('Error loading event attendance', err);
            if (attendanceTableBody) {
                attendanceTableBody.innerHTML = `
                    <tr class="att-empty-row">
                        <td colspan="5">
                            <div class="att-empty-inner">
                                <i class="fas fa-exclamation-circle"></i>
                                <p>Failed to load attendance records. Please try again.</p>
                            </div>
                        </td>
                    </tr>`;
            }
        }
    }

    /**
     * Loads all events and binds them to the event selector in the modal.
     */
    async function loadEventsIntoSelector() {
        if (!eventSelect) return;

        try {
            const data = await window.TatakApi.apiRequest('/events');
            const allEvents = Array.isArray(data.data) ? data.data : [];
            const events = filterByOfficerOrg(allEvents);

            if (!events.length) {
                eventSelect.innerHTML = '<option disabled selected>No events for your organization</option>';
                if (attendanceTableBody) {
                    attendanceTableBody.innerHTML = `
                        <tr class="att-empty-row">
                            <td colspan="5">
                                <div class="att-empty-inner">
                                    <i class="fas fa-calendar-times"></i>
                                    <p>No events found for your organization.</p>
                                </div>
                            </td>
                        </tr>`;
                }
                if (attendanceFooterText) attendanceFooterText.textContent = 'No events available';
                return;
            }

            eventSelect.innerHTML = events.map((event) => `
                <option value="${event.event_id || event.id}">${event.name}</option>
            `).join('');

            const firstEventId = eventSelect.value;
            if (firstEventId) {
                await loadEventAttendance(firstEventId);
            }
        } catch (err) {
            console.error('Error loading events', err);
        }
    }

    /**
     * Loads dynamic data for the Officer Overview section.
     */
    async function loadOfficerOverview() {
        try {
            // 1. Fetch Events — filtered to officer's org
            const eventsRes = await window.TatakApi.apiRequest('/events').catch(() => ({ data: [] }));
            const allEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
            const events = filterByOfficerOrg(allEvents);
            
            // 2. Fetch students confirmed — filtered to officer's org
            let totalStudentsConfirmed = 0;
            if (_officerOrgId) {
                const summaryRes = await window.TatakApi.apiRequest(`/attendance/summary/org/${_officerOrgId}`).catch(() => ({ data: {} }));
                const summary = summaryRes.data || {};
                totalStudentsConfirmed = (Number(summary.present_count) || 0) + (Number(summary.late_count) || 0);
            }

            // Stats Grid
            document.getElementById('officer-overview-total-events').innerText = events.length;
            document.getElementById('officer-overview-total-students').innerText = totalStudentsConfirmed;
            // Assuming reports are tracked or static for now
            document.getElementById('officer-overview-total-reports').innerText = '0'; 

            // Time logic
            const now = new Date();
            
            // Separate events
            const upcomingEvents = events.filter(e => new Date(e.start_date) > now).sort((a,b) => new Date(a.start_date) - new Date(b.start_date));
            const activeEvents = events.filter(e => {
                const s = new Date(e.start_date);
                const end = e.end_date ? new Date(e.end_date) : new Date(s.getTime() + 4 * 60 * 60 * 1000);
                return now >= s && now <= end;
            });
            const pastEvents = events.filter(e => {
                const s = new Date(e.start_date);
                const end = e.end_date ? new Date(e.end_date) : new Date(s.getTime() + 4 * 60 * 60 * 1000);
                return now > end;
            });

            // 3. Populate Live Hero Card
            const heroCard = document.getElementById('officer-overview-hero-card');
            const targetLiveEvent = activeEvents[0] || upcomingEvents[0];
            // SILENT RELOAD: Don't show loading spinner if we already have content
            const hasExistingContent = heroCard && heroCard.innerHTML.trim() !== '';
            
            if (targetLiveEvent && heroCard) {
                heroCard.style.display = 'block';
                const isLive = activeEvents.length > 0;
                
                heroCard.innerHTML = `
                    <div class="live-status-header">
                        <div class="live-indicator">
                            <span class="dot" style="background: ${isLive ? '#ff4757' : '#ffa502'};"></span>
                            ${isLive ? 'Live Attendance' : 'Upcoming'} <span class="live-tag" style="background: ${isLive ? 'rgba(255, 71, 87, 0.2)' : 'rgba(255, 165, 2, 0.2)'}; color: ${isLive ? '#ff4757' : '#ffa502'};">${isLive ? 'Live' : 'Soon'}</span>
                        </div>
                    </div>
                    <h2 class="hero-title">${targetLiveEvent.name}</h2>
                    <p class="hero-subtitle">${targetLiveEvent.location || 'TBA'} • ${new Date(targetLiveEvent.start_date).toLocaleDateString()}</p>
                    <div class="hero-stats">
                        <span class="current-count">--</span><span class="total-count">/--</span>
                    </div>
                    <div class="hero-progress-wrapper">
                        <div class="hero-progress-bar">
                            <div class="hero-progress-fill" style="width: 0%;"></div>
                        </div>
                        <p class="hero-progress-meta">Fetching attendance...</p>
                    </div>
                    <div class="hero-btn-group">
                        <button class="btn-time-limit"><i class="far fa-clock"></i> Details</button>
                        ${isLive ? '<button class="btn-close-live"><i class="fas fa-times"></i> Close</button>' : ''}
                    </div>
                `;

                // Fetch actual counts for the hero card to make it dynamic
                try {
                    const eventId = targetLiveEvent.event_id || targetLiveEvent.id;
                    const attRes = await window.TatakApi.apiRequest(`/attendance/personnel/${eventId}`);
                    const attList = Array.isArray(attRes.data) ? attRes.data : [];
                    const presentCount = attList.filter(a => a.status === 'Present' || a.status === 'Late').length;
                    const expected = targetLiveEvent.expected_attendance || 0;
                    const percent = expected > 0 ? Math.round((presentCount / expected) * 100) : 0;
                    
                    const countEl = heroCard.querySelector('.current-count');
                    const totalEl = heroCard.querySelector('.total-count');
                    const fillEl = heroCard.querySelector('.hero-progress-fill');
                    const metaEl = heroCard.querySelector('.hero-progress-meta');
                    
                    if (countEl) countEl.innerText = presentCount;
                    if (totalEl) totalEl.innerText = expected > 0 ? `/${expected}` : '/--';
                    if (fillEl) fillEl.style.width = `${percent}%`;
                    if (metaEl) metaEl.innerText = expected > 0 ? `${percent}% of expected attendance reached` : 'Expected attendance not set';

                    // Attach button listeners
                    const detailsBtn = heroCard.querySelector('.btn-time-limit');
                    const closeBtn = heroCard.querySelector('.btn-close-live');

                    if (detailsBtn) {
                        detailsBtn.onclick = () => {
                            window.openEventDetails({
                                ...targetLiveEvent,
                                attendancePercent: percent,
                                presentCount: presentCount
                            });
                        };
                    }
                    if (closeBtn) {
                        closeBtn.onclick = () => {
                            window.openCloseEventConfirmation(targetLiveEvent.event_id || targetLiveEvent.id);
                        };
                    }
                } catch (e) {
                    const metaEl = heroCard.querySelector('.hero-progress-meta');
                    if (metaEl) metaEl.innerText = 'Attendance data unavailable';
                }
            } else if (heroCard) {
                heroCard.style.display = 'none';
            }

            // 4. Populate My Events (nearest 3)
            const myEventsContainer = document.getElementById('officer-overview-my-events');
            if (myEventsContainer) {
                const combinedEvents = [...activeEvents, ...upcomingEvents, ...pastEvents].slice(0, 3);
                
                if (combinedEvents.length === 0) {
                    myEventsContainer.innerHTML = '<p style="padding: 20px; color: #a0a0a0;">No events assigned to you yet.</p>';
                } else {
                    myEventsContainer.innerHTML = combinedEvents.map(ev => {
                        let badgeHtml = '';
                        const s = new Date(ev.start_date);
                        const end = ev.end_date ? new Date(ev.end_date) : new Date(s.getTime() + 4 * 60 * 60 * 1000);
                        
                        if (now >= s && now <= end) badgeHtml = '<span class="badge badge-open">Open</span>';
                        else if (now < s) badgeHtml = '<span class="badge badge-upcoming">Upcoming</span>';
                        else badgeHtml = '<span class="badge badge-closed">Closed</span>';
                        
                        return `
                            <div class="event-item-row" style="margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                                <div class="event-info">
                                    <h4 style="margin: 0; color: #1e293b; font-size: 14px;">${ev.name}</h4>
                                    <p style="margin: 4px 0; color: #64748b; font-size: 11px; line-height: 1.4;">${ev.location || 'TBA'} • ${s.toLocaleDateString()}</p>
                                </div>
                                <div class="event-badges" style="display: flex; align-items: center;">
                                    ${badgeHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 5. Populate Recent Check-ins
            const recentCheckinsContainer = document.getElementById('officer-overview-recent-checkins');
            const recentCheckinsHeader = document.querySelector('.list-container:nth-child(2) .list-header');
            
            if (recentCheckinsContainer && recentCheckinsHeader) {
                // Add event filter if not already there
                let filterSelect = document.getElementById('overview-checkin-filter');
                if (!filterSelect) {
                    const selectHtml = `
                        <select id="overview-checkin-filter" style="font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; color: #64748b; outline: none; max-width: 150px;">
                            ${events.map(ev => `<option value="${ev.event_id || ev.id}" ${targetLiveEvent && (ev.event_id || ev.id) === (targetLiveEvent.event_id || targetLiveEvent.id) ? 'selected' : ''}>${ev.name}</option>`).join('')}
                        </select>
                    `;
                    recentCheckinsHeader.insertAdjacentHTML('beforeend', selectHtml);
                    filterSelect = document.getElementById('overview-checkin-filter');
                    
                    filterSelect.addEventListener('change', async (e) => {
                        const eventId = e.target.value;
                        const eventName = e.target.options[e.target.selectedIndex].text;
                        renderRecentCheckins(eventId, eventName);
                    });
                }

                async function renderRecentCheckins(eventId, eventName) {
                    recentCheckinsContainer.innerHTML = '<p style="padding: 20px; color: #a0a0a0; font-size: 12px;"><i class="fas fa-spinner fa-spin"></i> Loading check-ins...</p>';
                    try {
                        const eventAttendanceRes = await window.TatakApi.apiRequest(`/attendance/personnel/${eventId}`).catch(() => ({ data: [] }));
                        const eventAttendance = Array.isArray(eventAttendanceRes.data) ? eventAttendanceRes.data : [];
                        
                        if (eventAttendance.length === 0) {
                            recentCheckinsContainer.innerHTML = `<p style="padding: 20px; color: #a0a0a0; font-size: 12px;">No check-ins yet for <strong>${eventName}</strong>.</p>`;
                        } else {
                            // Show latest 5
                            const recent5 = eventAttendance.slice(0, 5);
                            recentCheckinsContainer.innerHTML = recent5.map(rec => {
                                const initials = getInitials(rec.fname || 'U');
                                const status = rec.status || 'Present';
                                
                                let statusBg = '#dcfce7'; // Present (Green)
                                let statusColor = '#16a34a';
                                
                                if (status === 'Absent') {
                                    statusBg = '#fee2e2'; // Red
                                    statusColor = '#ef4444';
                                } else if (status === 'Late' || status === 'Excused') {
                                    statusBg = '#fef3c7'; // Yellow
                                    statusColor = '#f59e0b';
                                }

                                const avatarContent = rec.profile_picture
                                    ? `<img src="${formatImageUrl(rec.profile_picture)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                                    : initials;

                                return `
                                    <div class="checkin-user-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                                        <div class="user-profile" style="display: flex; gap: 10px; align-items: center;">
                                            <div style="width: 32px; height: 32px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #3b82f6; font-size: 11px; overflow: hidden;">
                                                ${avatarContent}
                                            </div>
                                            <div class="user-text">
                                                <h4 style="margin: 0; color: #1e293b; font-size: 13px;">${rec.fname || 'Unknown Student'}</h4>
                                                <p style="margin: 2px 0 0; color: #64748b; font-size: 11px;">${rec.stud_id_number || rec.student_id_number || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div class="user-actions">
                                            <span class="badge-status attended" style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">${status}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        }
                    } catch (err) {
                        recentCheckinsContainer.innerHTML = '<p style="padding: 20px; color: #ef4444; font-size: 12px;">Error loading check-ins.</p>';
                    }
                }

                // Initial load
                if (filterSelect.value) {
                    renderRecentCheckins(filterSelect.value, filterSelect.options[filterSelect.selectedIndex].text);
                } else if (targetLiveEvent) {
                    renderRecentCheckins(targetLiveEvent.event_id || targetLiveEvent.id, targetLiveEvent.name);
                }
            }

        } catch (err) {
            console.error('Failed to load officer overview', err);
        }
    }

    /**
     * Hides all dashboard sections and removes active style from nav items.
     */
    const resetNavigation = () => {
        Object.values(navMapping).forEach(item => {
            const sec = document.getElementById(item.section);
            if (sec) sec.style.display = 'none';
        });

        Object.keys(navMapping).forEach(id => {
            const nav = document.getElementById(id);
            if (nav) nav.classList.remove('active');
        });
    };

    /**
     * Switches the dashboard to a specific section and persists the state.
     */
    window.showSection = (id) => {
        if (!navMapping[id]) return;

        resetNavigation();

        const navBtn = document.getElementById(id);
        if (navBtn) navBtn.classList.add('active');

        const sectionId = navMapping[id].section;
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'block';

        const sectionTitle = navMapping[id].title;
        if (dynamicTitle) {
            if (id === 'nav-overview') {
                const nameEl = document.querySelector('.officer-name');
                const name = nameEl ? nameEl.textContent.trim().toUpperCase() : '';
                dynamicTitle.innerHTML = name ? `HELLO, <span class="highlight">${name}</span>` : sectionTitle;
            } else {
                dynamicTitle.textContent = sectionTitle;
            }
        }

        // Persist the current section
        localStorage.setItem('officer_last_section', id);

        // Load section-specific data
        if (id === 'nav-attendance') {
            loadEventsIntoSelector();
        } else if (id === 'nav-overview') {
            loadOfficerOverview();
        } else if (id === 'nav-events') {
            loadManageEvents();
        } else if (id === 'nav-reports') {
            loadOfficerReports();
        }
    };

    // Initial authentication check then profile load.
    ensureOfficerAuthenticated();
    
    // Hide all sections immediately to prevent flash before state restoration
    resetNavigation();
    
    // Load officer profile early so _officerOrgId is ready before any event fetches.
    loadOfficerProfile();
    
    // Wire up "View all" link in My Events to switch to Events tab
    const viewAllEventsBtn = document.getElementById('officer-overview-my-events-link');
    if (viewAllEventsBtn) {
        viewAllEventsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('nav-events').click();
        });
    }

    // Edit Attendance Logic
    window.openEditAttendanceModal = (attendanceId, studentName, currentStatus) => {
        if (editStudentName) editStudentName.textContent = studentName;
        if (editAttendanceIdInput) editAttendanceIdInput.value = attendanceId;
        if (editAttendanceStatusSelect) editAttendanceStatusSelect.value = currentStatus || 'Present';
        if (editAttendanceReasonInput) editAttendanceReasonInput.value = ''; // Clear previous
        openModal(editAttendanceModal);
    };

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal(editAttendanceModal));
    
    if (confirmEditBtn) {
        confirmEditBtn.addEventListener('click', async () => {
            const attendanceId = editAttendanceIdInput.value;
            const status = editAttendanceStatusSelect.value;
            const remarks = editAttendanceReasonInput.value;

            if (!attendanceId) return;

            confirmEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            confirmEditBtn.disabled = true;

            try {
                const res = await window.TatakApi.apiRequest(`/attendance/${attendanceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        status: status,
                        remarks: remarks
                    })
                });

                if (res.success) {
                    closeModal(editAttendanceModal);
                    // Refresh the table
                    if (eventSelect && eventSelect.value) {
                        loadEventAttendance(eventSelect.value);
                    }
                    
                    // Show success notification after a tiny delay
                    setTimeout(() => {
                        const successModal = document.getElementById('successModal');
                        if (successModal) {
                            document.getElementById('successModalTitle').textContent = 'Attendance Updated';
                            document.getElementById('successModalMessage').textContent = 'The student status has been successfully updated.';
                            openModal(successModal);
                        }
                    }, 100);
                } else {
                    window.TatakApi.showToast(res.error || 'Failed to update attendance', 'error');
                }
            } catch (err) {
                console.error('Error updating attendance:', err);
                window.TatakApi.showToast('An error occurred while updating attendance.', 'error');
            } finally {
                confirmEditBtn.innerHTML = 'Update Attendance';
                confirmEditBtn.disabled = false;
            }
        });
    }

    /**
     * Helper to open any modal by element or ID.
     */
    function openModal(modalElement) {
        if (typeof modalElement === 'string') modalElement = document.getElementById(modalElement);
        if (modalElement) {
            modalElement.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    window.openModal = openModal;

    /**
     * Helper to close any modal by element or ID.
     */
    function closeModal(modalElement) {
        if (typeof modalElement === 'string') modalElement = document.getElementById(modalElement);
        if (modalElement) {
            modalElement.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    window.closeModal = closeModal;

    /**
     * Unified helper to show the Success Modal with custom content.
     */
    function showSuccessModal(title, message) {
        const successModal = document.getElementById('successModal');
        const successTitle = document.getElementById('successModalTitle');
        const successMsg = document.getElementById('successModalMessage');
        
        if (successModal) {
            if (successTitle) successTitle.textContent = title;
            if (successMsg) successMsg.textContent = message;
            openModal(successModal);
        } else {
            window.TatakApi.showToast(title, 'success');
        }
    }
    window.showSuccessModal = showSuccessModal;

    /**
     * Checks for any pending success modals from a previous page session (reload-resilience).
     */
    function checkPendingSuccessModal() {
        const pending = sessionStorage.getItem('officer_pending_success');
        if (pending) {
            try {
                const { title, message } = JSON.parse(pending);
                sessionStorage.removeItem('officer_pending_success');
                // Show after a delay to ensure initial section loading doesn't interfere
                setTimeout(() => showSuccessModal(title, message), 600);
            } catch (e) {
                sessionStorage.removeItem('officer_pending_success');
            }
        }
    }

    /**
     * Opens the detailed view for an event from the hero card.
     */
    window.openEventDetails = (eventData) => {
        const modal = document.getElementById('eventDetailsModal');
        if (!modal) return;

        document.getElementById('detailsEventName').textContent = eventData.name || 'Unnamed Event';
        
        const dateObj = new Date(eventData.start_date);
        document.getElementById('detailsEventDate').textContent = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const startTime = eventData.start_time || (eventData.start_date ? new Date(eventData.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00');
        const endTime = eventData.end_time || (eventData.end_date ? new Date(eventData.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00');
        document.getElementById('detailsEventTime').textContent = `${startTime} - ${endTime}`;
        
        document.getElementById('detailsEventLocation').textContent = eventData.location || 'No location specified';
        document.getElementById('detailsEventDescription').textContent = eventData.description || 'No description available for this event.';

        // Populate attendance stats if available
        const percent = eventData.attendancePercent || 0;
        const present = eventData.presentCount || 0;
        const expected = eventData.expected_attendance || 0;

        document.getElementById('detailsAttendancePercent').textContent = `${percent}%`;
        document.getElementById('detailsProgressBar').style.width = `${percent}%`;
        document.getElementById('detailsAttendanceCounts').innerHTML = `<i class="fas fa-users" style="font-size: 10px;"></i> ${present} / ${expected} expected attendees confirmed`;

        openModal(modal);
    };

    /**
     * Opens the confirmation modal to close an event.
     */
    window.openCloseEventConfirmation = (eventId) => {
        const modal = document.getElementById('closeEventModal');
        const confirmBtn = document.getElementById('confirmCloseEventBtn');
        if (!modal || !confirmBtn) return;

        // Clone and replace button to remove old listeners
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        newBtn.addEventListener('click', async () => {
            newBtn.disabled = true;
            newBtn.innerText = 'Closing...';
            
            try {
                // To "close" an event, we update its end_date to now
                const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const res = await window.TatakApi.apiRequest(`/events/${eventId}/close`, {
                    method: 'PATCH'
                });

                closeModal(modal);
                
                if (res.success) {
                    showSuccessModal('Attendance Closed', 'The event attendance has been successfully ended.');
                    loadOfficerOverview();
                    loadManageEvents(true);
                } else {
                    window.TatakApi.showToast(res.error || 'Failed to close event', 'error');
                }
            } catch (err) {
                console.error(err);
                window.TatakApi.showToast('An error occurred.', 'error');
                closeModal(modal);
            }
        });

        openModal(modal);
    };

    /**
     * Loads and renders events for the "Manage Events" tab.
     */
    async function loadManageEvents(isSilent = false) {
        if (!officerEventsGrid) return;
        if (!isSilent) officerEventsGrid.innerHTML = '<p style="color: #64748b; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading events...</p>';

        try {
            const data = await window.TatakApi.apiRequest('/events');
            const allEvents = Array.isArray(data.data) ? data.data : [];
            const events = filterByOfficerOrg(allEvents);

            if (!events.length) {
                officerEventsGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; padding: 40px; text-align: center; color: #94a3b8;"><i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 10px; color: #cbd5e1;"></i><p>No events created yet.</p></div>';
                return;
            }

            const now = new Date();
            officerEventsGrid.innerHTML = events.map(ev => {
                const s = new Date(ev.start_date);
                const end = ev.end_date ? new Date(ev.end_date) : new Date(s.getTime() + 4 * 60 * 60 * 1000);
                
                let badgeClass = 'badge-closed';
                let badgeText = 'Closed';
                if (ev.approval_status && ev.approval_status.toLowerCase() === 'pending') { 
                    badgeClass = 'badge-pending'; 
                    badgeText = 'Pending'; 
                }
                else if (now >= s && now <= end) { badgeClass = 'badge-open'; badgeText = 'Open'; }
                else if (now < s) { badgeClass = 'badge-upcoming'; badgeText = 'Upcoming'; }

                // Determine local date and time for form population
                const localDate = s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0');
                const startTimeInput = s.getHours().toString().padStart(2, '0') + ':' + s.getMinutes().toString().padStart(2, '0');
                const endTimeInput = ev.end_date ? (new Date(ev.end_date).getHours().toString().padStart(2, '0') + ':' + new Date(ev.end_date).getMinutes().toString().padStart(2, '0')) : '';
                
                // 12-hour display format
                const startTimeDisplay = window.TatakApi.formatTime12h(s);
                const endTimeDisplay = ev.end_date ? window.TatakApi.formatTime12h(end) : 'TBA';

                const safeName = (ev.name||'').replace(/'/g, "\\'");
                const safeLoc = (ev.location||'').replace(/'/g, "\\'");
                const safeDesc = (ev.description||'').replace(/'/g, "\\'");

                return `
                    <div class="event-card">
                        <div class="card-top" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
                            <div style="flex: 1;">
                                <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">${ev.name}</h3>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                                <span class="badge ${badgeClass}" style="white-space: nowrap;">${badgeText}</span>
                                <div class="card-header-actions" style="display: flex; gap: 6px;">
                                    <button class="icon-qr" onclick="window.showEventQR('${ev.qr_code}', '${safeName}')" style="background: #e0e7ff; border: none; color: #4338ca; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Show QR"><i class="fas fa-qrcode" style="font-size: 14px;"></i></button>
                                    <button class="icon-edit" onclick="window.openOfficerEditEvent('${ev.event_id}', '${safeName}', '${localDate}', '${safeLoc}', '${startTimeInput}', '${endTimeInput}', '${safeDesc}', ${ev.expected_attendance || 0})" style="background: #f1f5f9; border: none; color: #3b82f6; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="far fa-edit" style="font-size: 14px;"></i></button>
                                    <button class="icon-delete" onclick="window.deleteOfficerEvent('${ev.event_id}')" style="background: #fee2e2; border: none; color: #ef4444; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Delete Event"><i class="far fa-trash-alt" style="font-size: 14px;"></i></button>
                                </div>
                            </div>
                        </div>
                        <p class="event-meta" style="margin-top: 15px;">${ev.location || 'TBA'} • ${s.toLocaleDateString()} • ${startTimeDisplay} - ${endTimeDisplay}</p>
                        <div class="progress-container" style="margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <p style="font-size: 12px; color: #64748b; margin: 0;">Attendance Tracking</p>
                                <span style="font-size: 12px; font-weight: 600; color: #0f172a;">-- / --</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading manage events:', err);
            officerEventsGrid.innerHTML = '<p style="color: #ef4444;">Failed to load events.</p>';
        }
    }

    // Expose edit function to global scope for the inline onclick handler
    window.openOfficerEditEvent = (id, name, date, venue, startStr, endStr, desc, capacity) => {
        officerEventModalTitle.textContent = 'Edit Event';
        officerEventIdInput.value = id;
        document.getElementById('officerEventName').value = name;
        document.getElementById('officerEventDate').value = date;
        document.getElementById('officerEventVenue').value = venue;
        document.getElementById('officerEventStartTime').value = startStr;
        document.getElementById('officerEventEndTime').value = endStr || '';
        document.getElementById('officerEventDesc').value = desc || '';
        const capEl = document.getElementById('officerEventCapacity');
        if (capEl) capEl.value = capacity || '';
        openModal(officerEventModal);
    };

    window.deleteOfficerEvent = (eventId) => {
        const modal = document.getElementById('deleteConfirmModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        
        if (!modal || !confirmBtn) {
            // Fallback to native if modal missing
            if (confirm('Are you sure you want to delete this event?')) {
                performDeletion(eventId);
            }
            return;
        }

        openModal(modal);
        
        // Remove old listeners to avoid multiple deletions
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent bubbling to window backdrop handlers
            newConfirmBtn.disabled = true;
            newConfirmBtn.innerText = 'Deleting...';
            
            // Close confirm modal first to avoid overlapping transitions
            closeModal(modal);
            
            await performDeletion(eventId);
        });
    };

    async function performDeletion(eventId) {
        try {
            const response = await window.TatakApi.apiRequest(`/events/${eventId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                // Set pending success modal for reload-resilience
                sessionStorage.setItem('officer_pending_success', JSON.stringify({
                    title: 'Event Deleted',
                    message: 'The event and all associated records have been successfully removed.'
                }));

                // Fallback for immediate display if no reload happens
                showSuccessModal('Event Deleted', 'The event and all associated records have been successfully removed.');
                
                // Refresh data
                setTimeout(() => {
                    loadManageEvents(true);
                    loadOfficerOverview();
                }, 500);
            } else {
                window.TatakApi.showToast(response.error || 'Failed to delete event', 'error');
            }
        } catch (err) {
            console.error('Error deleting event:', err);
            window.TatakApi.showToast('An error occurred during deletion', 'error');
        }
    }

    if (sidebarLogout) sidebarLogout.addEventListener('click', () => openModal(logoutModal));
    if (topbarLogout) topbarLogout.addEventListener('click', () => openModal(logoutModal));
    if (stayBtn) stayBtn.addEventListener('click', () => closeModal(logoutModal));
    
    // QR Modal Logic
    window.showEventQR = (qrUrl, eventName) => {
        const modal = document.getElementById('qrDisplayModal');
        const img = document.getElementById('qrDisplayImg');
        const title = document.getElementById('qrModalEventName');
        
        if (!qrUrl) {
            window.TatakApi.showToast('QR code not generated for this event yet.', 'info');
            return;
        }

        // Handle path formatting (backend saves /qr/token.png, but frontend might need full URL)
        const baseUrl = window.TatakApi.API_BASE_URL || 'http://localhost:3002';
        const fullUrl = qrUrl.startsWith('http') ? qrUrl : baseUrl + qrUrl;
        
        img.src = fullUrl;
        title.textContent = eventName;
        openModal(modal);
    };

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            performLogout();
        });
    }

    // Modal Triggers Update
    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => {
            officerEventModalTitle.textContent = 'Create New Event';
            officerEventIdInput.value = '';
            officerEventForm.reset();
            openModal(officerEventModal);
        });
    }

    const closeOfficerEvent = () => closeModal(officerEventModal);
    if (closeOfficerEventTopBtn) closeOfficerEventTopBtn.addEventListener('click', closeOfficerEvent);
    if (cancelOfficerEventBtn) cancelOfficerEventBtn.addEventListener('click', closeOfficerEvent);

    // Handle the Event Form Submission (Create or Edit)
    if (officerEventForm) {
        officerEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const eventId = officerEventIdInput.value;
            const name = document.getElementById('officerEventName').value;
            const date = document.getElementById('officerEventDate').value;
            const venue = document.getElementById('officerEventVenue').value;
            const startTime = document.getElementById('officerEventStartTime').value;
            const endTime = document.getElementById('officerEventEndTime').value;
            const desc = document.getElementById('officerEventDesc').value;
            const capacity = document.getElementById('officerEventCapacity')?.value;

            // Combine date and time for backend
            // Combine date and time and convert to ISO (UTC) to prevent timezone drift
            const startDate = new Date(`${date}T${startTime}:00`).toISOString();
            const endDate = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null;

            const payload = {
                name: name,
                description: desc,
                start_date: startDate,
                end_date: endDate,
                location: venue,
                organization_id: _officerOrgId, // automatically assign to officer's org
                expected_attendance: capacity ? parseInt(capacity) : null
            };

            const submitBtn = document.getElementById('saveOfficerEventBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            try {
                let response;
                if (eventId) {
                    // Update
                    response = await window.TatakApi.apiRequest(`/events/${eventId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create
                    response = await window.TatakApi.apiRequest('/events', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
                
                if (response.success) {
                    closeModal(officerEventModal);
                    officerEventForm.reset();

                    const title = eventId ? 'Event Updated' : 'Event Created';
                    const msg = eventId ?
                        'The event details have been successfully updated.' :
                        'Your new event has been submitted and is awaiting approval.';

                    // Set pending success modal for reload-resilience
                    sessionStorage.setItem('officer_pending_success', JSON.stringify({
                        title: title,
                        message: msg
                    }));

                    // Show Success Modal after a tiny delay for clean transition
                    setTimeout(() => {
                        showSuccessModal(title, msg);
                        
                        // Refresh data silently
                        setTimeout(() => {
                            loadManageEvents(true);
                            loadOfficerOverview();
                        }, 500);
                    }, 100);
                } else {
                    window.TatakApi.showToast(response.error || 'Could not save event', 'error');
                }
            } catch (err) {
                console.error('Submission failed:', err);
                window.TatakApi.showToast('An error occurred while saving the event.', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    if (eventSelect) {
        eventSelect.addEventListener('change', (e) => {
            loadEventAttendance(e.target.value);
        });
    }

    // --- Live Search Filtering ---
    const studentSearchInput = document.getElementById('studentSearch');
    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', () => {
            const query = studentSearchInput.value.trim().toLowerCase();
            if (!query) {
                renderAttendanceTable(_allAttendanceRows);
                return;
            }
            const filtered = _allAttendanceRows.filter(item => {
                const name = (item.fname || item.full_name || '').toLowerCase();
                const id   = (item.stud_id_number || item.student_id_number || item.id_number || '').toLowerCase();
                return name.includes(query) || id.includes(query);
            });
            renderAttendanceTable(filtered);
        });
    }


    // Global click handler for closing modals by clicking outside.
    window.addEventListener('click', (e) => {
        // Close logout modal when clicking on backdrop
        if (e.target === logoutModal) closeModal(logoutModal);
        
        // Close officer event modal when clicking on backdrop
        if (e.target === officerEventModal) closeModal(officerEventModal);
    });

    // Prevent modal content clicks from bubbling up to avoid conflicts
    document.addEventListener('click', (e) => {
        const successModal = document.getElementById('successModal');
        if (successModal && successModal.contains(e.target)) {
            const modalContent = successModal.querySelector('.confirm-modal-content');
            if (modalContent && modalContent.contains(e.target)) {
                e.stopPropagation();
            }
        }
    });

    Object.keys(navMapping).forEach(id => {
        const navBtn = document.getElementById(id);
        if (navBtn) {
            navBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showSection(id);
            });
        }
    });

    // Initial Section Load — respects persistence or defaults to Overview
    loadOfficerProfile().then(async () => {
        const lastSection = localStorage.getItem('officer_last_section') || 'nav-overview';
        showSection(lastSection);
        
        if (typeof loadOfficerNotifications === 'function') {
            await loadOfficerNotifications();
        }

        // Check for reload-resilient success modals
        checkPendingSuccessModal();
    });
    if (typeof setupOfficerCertificateButtons === 'function') {
        setupOfficerCertificateButtons();
    }
    // Check for pending notifications
    if (window.TatakApi && window.TatakApi.checkPendingToast) {
        window.TatakApi.checkPendingToast();
    }
});

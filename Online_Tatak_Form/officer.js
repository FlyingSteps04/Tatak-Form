document.addEventListener('DOMContentLoaded', () => {
    const formatImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('/uploads')) {
            return `${window.TatakApi.API_BASE_URL}${url}`;
        }
        return url;
    };

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
            if (roleEl && profile.role) roleEl.textContent = profile.role;
            
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
            
            // 2. Fetch students confirmed (from attendance summary if exists, or fallback to an estimate/fetch)
            const attendanceRes = await window.TatakApi.apiRequest('/attendance/summary').catch(() => ({ data: [] }));
            const attendance = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
            const totalStudentsConfirmed = attendance.filter(a => a.status === 'Present' || a.status === 'Late').length || 0;

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

    // Initial authentication check then profile load.
    ensureOfficerAuthenticated();
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
                    
                    // Show success notification for attendance
                    const successModal = document.getElementById('successModal');
                    if (successModal) {
                        document.getElementById('successModalTitle').textContent = 'Attendance Updated';
                        document.getElementById('successModalMessage').textContent = 'The student status has been successfully updated.';
                        openModal(successModal);
                    }
                } else {
                    alert('Failed to update attendance: ' + (res.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Error updating attendance:', err);
                alert('An error occurred while updating attendance.');
            } finally {
                confirmEditBtn.innerHTML = 'Update Attendance';
                confirmEditBtn.disabled = false;
            }
        });
    }

    window.openModal = (modalElement) => {
        if (typeof modalElement === 'string') modalElement = document.getElementById(modalElement);
        if (modalElement) {
            modalElement.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = (modalElement) => {
        if (typeof modalElement === 'string') modalElement = document.getElementById(modalElement);
        if (modalElement) {
            modalElement.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };

    /**
     * Loads and renders events for the "Manage Events" tab.
     */
    async function loadManageEvents() {
        if (!officerEventsGrid) return;
        officerEventsGrid.innerHTML = '<p style="color: #64748b;">Loading events...</p>';

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

                // Determine start and end times for form population
                const startTime = s.toTimeString().slice(0, 5); // "HH:MM"
                const endTime = ev.end_date ? new Date(ev.end_date).toTimeString().slice(0, 5) : '';
                const dateStr = s.toISOString().split('T')[0];
                
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
                                    <button class="icon-edit" onclick="window.openOfficerEditEvent('${ev.event_id}', '${safeName}', '${dateStr}', '${safeLoc}', '${startTime}', '${endTime}', '${safeDesc}', ${ev.expected_attendance || 0})" style="background: #f1f5f9; border: none; color: #3b82f6; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="far fa-edit" style="font-size: 14px;"></i></button>
                                    <button class="icon-delete" onclick="alert('Delete functionality coming soon')" style="background: #fee2e2; border: none; color: #ef4444; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="far fa-trash-alt" style="font-size: 14px;"></i></button>
                                </div>
                            </div>
                        </div>
                        <p class="event-meta" style="margin-top: 15px;">${ev.location || 'TBA'} • ${s.toLocaleDateString()} • ${startTime}</p>
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

    if (sidebarLogout) sidebarLogout.addEventListener('click', () => openModal(logoutModal));
    if (topbarLogout) topbarLogout.addEventListener('click', () => openModal(logoutModal));
    if (stayBtn) stayBtn.addEventListener('click', () => closeModal(logoutModal));
    
    // QR Modal Logic
    window.showEventQR = (qrUrl, eventName) => {
        const modal = document.getElementById('qrDisplayModal');
        const img = document.getElementById('qrDisplayImg');
        const title = document.getElementById('qrModalEventName');
        
        if (!qrUrl) {
            alert('QR code not generated for this event yet.');
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
            const startDate = `${date}T${startTime}:00`;
            const endDate = endTime ? `${date}T${endTime}:00` : null;

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
                    loadManageEvents(); // Refresh the grid
                    
                    // Show Success Modal
                    const successModal = document.getElementById('successModal');
                    const successTitle = document.getElementById('successModalTitle');
                    const successMsg = document.getElementById('successModalMessage');
                    if (successModal) {
                        successTitle.textContent = eventId ? 'Event Updated' : 'Event Created';
                        successMsg.textContent = eventId ? 
                            'The event details have been successfully updated.' : 
                            'Your new event has been submitted and is awaiting approval.';
                        openModal(successModal);
                    }
                } else {
                    alert(`Error: ${response.error || 'Could not save event'}`);
                }
            } catch (err) {
                console.error('Submission failed:', err);
                alert('An error occurred while saving the event.');
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


    window.addEventListener('click', (e) => {
        if (e.target === logoutModal) closeModal(logoutModal);
        if (e.target === officerEventModal) closeModal(officerEventModal);
    });

    Object.keys(navMapping).forEach(id => {
        const navBtn = document.getElementById(id);
        if (navBtn) {
            navBtn.addEventListener('click', () => {
                resetNavigation();

                navBtn.classList.add('active');

                const sectionId = navMapping[id].section;
                const section = document.getElementById(sectionId);
                if (section) section.style.display = 'block';

                if (dynamicTitle) dynamicTitle.textContent = navMapping[id].title;

                // When the tabs are opened, load their specific data
                if (id === 'nav-attendance') {
                    loadEventsIntoSelector();
                } else if (id === 'nav-overview') {
                    loadOfficerOverview();
                } else if (id === 'nav-events') {
                    loadManageEvents();
                }
            });
        }
    });

    // Initial Overview Load — run after profile resolves so org filtering is ready
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.id === 'nav-overview') {
        loadOfficerProfile().then(() => loadOfficerOverview());
    }
    // Check for pending notifications
    if (window.TatakApi && window.TatakApi.checkPendingToast) {
        window.TatakApi.checkPendingToast();
    }
});
document.addEventListener('DOMContentLoaded', () => {

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
    
    // Void Modal Elements
    const voidAttendanceModal = document.getElementById('voidAttendanceModal');
    const voidStudentName = document.getElementById('voidStudentName');
    const voidAttendanceIdInput = document.getElementById('voidAttendanceId');
    const confirmVoidBtn = document.getElementById('confirmVoidBtn');
    const cancelVoidBtn = document.getElementById('cancelVoidBtn');

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

            // Also update the sidebar name/role if elements exist
            const nameEl = document.querySelector('.officer-name');
            const roleEl = document.querySelector('.officer-role');
            if (nameEl && profile.fname) nameEl.textContent = profile.fname;
            if (roleEl && profile.role) roleEl.textContent = profile.role;
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
        if (s === 'late') return 'late';
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
            const attendanceRate = Math.round((attended / total) * 100);
            
            const progressColor = attendanceRate > 80 ? '#10b981' : (attendanceRate > 50 ? '#f59e0b' : '#ef4444');

            return `
            <tr>
                <td>
                    <div class="att-student-cell">
                        <div class="att-avatar">${initials}</div>
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
                    <button class="att-action-btn" title="Void Attendance" onclick="window.openVoidAttendanceModal(${item.attendance_id}, '${fullName.replace(/'/g, "\\'")}')">
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
                        else if (now < s) badgeHtml = '<span class="badge badge-upcoming" style="background: rgba(255, 165, 2, 0.2); color: #ffa502;">Upcoming</span>';
                        else badgeHtml = '<span class="badge badge-closed">Closed</span>';
                        
                        return `
                            <div class="event-item-row" style="margin-bottom: 15px;">
                                <div class="event-info">
                                    <h4 style="margin: 0; color: #fff;">${ev.name}</h4>
                                    <p style="margin: 5px 0; color: #a0a0a0; font-size: 12px;">${ev.location || 'TBA'} • ${s.toLocaleDateString()}</p>
                                </div>
                                <div class="event-badges" style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                                    ${badgeHtml}
                                    <button onclick="window.showEventQR('${ev.qr_code}', '${ev.name.replace(/'/g, "\\'")}')" style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 10px; display: flex; align-items: center; gap: 4px;"><i class="fas fa-qrcode"></i> Show QR</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 5. Populate Recent Check-ins
            const recentCheckinsContainer = document.getElementById('officer-overview-recent-checkins');
            if (recentCheckinsContainer) {
                if (targetLiveEvent) {
                    const eventAttendanceRes = await window.TatakApi.apiRequest(`/attendance/personnel/${targetLiveEvent.event_id || targetLiveEvent.id}`).catch(() => ({ data: [] }));
                    const eventAttendance = Array.isArray(eventAttendanceRes.data) ? eventAttendanceRes.data : [];
                    
                    if (eventAttendance.length === 0) {
                        recentCheckinsContainer.innerHTML = '<p style="padding: 20px; color: #a0a0a0;">No check-ins yet for ' + targetLiveEvent.name + '.</p>';
                    } else {
                        // Show latest 5
                        const recent5 = eventAttendance.slice(0, 5);
                        recentCheckinsContainer.innerHTML = recent5.map(rec => {
                            return `
                                <div class="checkin-user-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <div class="user-profile" style="display: flex; gap: 10px; align-items: center;">
                                        <div style="width: 35px; height: 35px; background: #2b2b40; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #7f56d9;">
                                            ${(rec.fname || 'U').charAt(0)}
                                        </div>
                                        <div class="user-text">
                                            <h4 style="margin: 0; color: #fff; font-size: 14px;">${rec.fname || 'Unknown Student'}</h4>
                                            <p style="margin: 3px 0 0; color: #a0a0a0; font-size: 12px;">${rec.student_id_number || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div class="user-actions">
                                        <span class="badge-status attended" style="background: rgba(46, 213, 115, 0.2); color: #2ed573; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${rec.status || 'Present'}</span>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                } else {
                    recentCheckinsContainer.innerHTML = '<p style="padding: 20px; color: #a0a0a0;">No active events to show check-ins.</p>';
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

    // Void Attendance Logic
    window.openVoidAttendanceModal = (attendanceId, studentName) => {
        if (voidStudentName) voidStudentName.textContent = studentName;
        if (voidAttendanceIdInput) voidAttendanceIdInput.value = attendanceId;
        openModal(voidAttendanceModal);
    };

    if (cancelVoidBtn) cancelVoidBtn.addEventListener('click', () => closeModal(voidAttendanceModal));
    
    if (confirmVoidBtn) {
        confirmVoidBtn.addEventListener('click', async () => {
            const attendanceId = voidAttendanceIdInput.value;
            if (!attendanceId) return;

            confirmVoidBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Voiding...';
            confirmVoidBtn.disabled = true;

            try {
                const res = await window.TatakApi.apiRequest(`/attendance/${attendanceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'Absent' }) // Voiding basically means marking as absent
                });

                if (res.success) {
                    closeModal(voidAttendanceModal);
                    // Refresh the table
                    if (eventSelect && eventSelect.value) {
                        loadEventAttendance(eventSelect.value);
                    }
                } else {
                    alert('Failed to void attendance: ' + (res.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Error voiding attendance:', err);
                alert('An error occurred while voiding attendance.');
            } finally {
                confirmVoidBtn.innerHTML = 'Yes, Void it';
                confirmVoidBtn.disabled = false;
            }
        });
    }

    window.openModal = (modalElement) => {
        if (modalElement) {
            modalElement.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = (modalElement) => {
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
                if (now >= s && now <= end) { badgeClass = 'badge-open'; badgeText = 'Open'; }
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
                                <span class="badge ${badgeClass}" style="white-space: nowrap; ${badgeText==='Upcoming'?'background: rgba(255, 165, 2, 0.2); color: #ffa502;':''}">${badgeText}</span>
                                <div class="card-header-actions" style="display: flex; gap: 6px;">
                                    <button class="icon-qr" onclick="window.showEventQR('${ev.qr_code}', '${safeName}')" style="background: #e0e7ff; border: none; color: #4338ca; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Show QR"><i class="fas fa-qrcode" style="font-size: 14px;"></i></button>
                                    <button class="icon-edit" onclick="window.openOfficerEditEvent(${ev.event_id}, '${safeName}', '${dateStr}', '${safeLoc}', '${startTime}', '${endTime}', '${safeDesc}')" style="background: #f1f5f9; border: none; color: #3b82f6; cursor: pointer; padding: 7px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="far fa-edit" style="font-size: 14px;"></i></button>
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
    window.openOfficerEditEvent = (id, name, date, venue, startStr, endStr, desc) => {
        officerEventModalTitle.textContent = 'Edit Event';
        officerEventIdInput.value = id;
        document.getElementById('officerEventName').value = name;
        document.getElementById('officerEventDate').value = date;
        document.getElementById('officerEventVenue').value = venue;
        document.getElementById('officerEventStartTime').value = startStr;
        document.getElementById('officerEventEndTime').value = endStr || '';
        document.getElementById('officerEventDesc').value = desc || '';
        // Note: capacity isn't tracked in backend events table currently, skipping for now
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

            // Combine date and time for backend
            const startDate = `${date}T${startTime}:00`;
            const endDate = endTime ? `${date}T${endTime}:00` : null;

            const payload = {
                name: name,
                description: desc,
                start_date: startDate,
                end_date: endDate,
                location: venue,
                organization_id: _officerOrgId // automatically assign to officer's org
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
});
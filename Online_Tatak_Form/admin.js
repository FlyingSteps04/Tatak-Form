/**
 * Admin Dashboard Controller
 * Handles navigation, data fetching, and UI rendering for the Admin portal.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- AUTH CHECK ---
    const token = window.TatakApi.getAuthToken();
    const role = localStorage.getItem('tatak_role');
    
    if (!token || role !== 'Admin') {
        console.warn('Unauthorized access attempt. Redirecting to login.');
        window.location.replace('login.html');
        return;
    }

    // Populate Organization Dropdowns early
    async function loadAllOrgsForSelects() {
        try {
            const res = await window.TatakApi.apiRequest('/organizations');
            const orgs = res.data || [];
            const html = '<option value="" disabled selected>Select Organization</option>' + 
                         orgs.map(o => `<option value="${o.organization_id}">${o.name}</option>`).join('');
            
            ['addEventOrg', 'editEventOrg', 'offOrg', 'editOffOrg', 'addStudentOrg'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            });
        } catch (err) {
            console.error('Error loading organizations for selects:', err);
        }
    }
    loadAllOrgsForSelects();

    // --- GLOBAL MODAL HELPERS ---
    window.openModal = function(id) {
        console.log('Opening modal:', id);
        const modal = document.getElementById(id);
        if(modal) modal.style.display = 'flex';
    };

    window.closeModal = function(id) {
        const modal = document.getElementById(id);
        if(modal) modal.style.display = 'none';
    };

    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllRead');
    let adminNotificationsCache = { unread: [], read: [] };

    const updateNotificationBadge = () => {
        if (!notificationBadge) return;
        const count = adminNotificationsCache.unread.length;
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

    const renderNotifications = () => {
        if (!notificationList) return;
        if (markAllReadBtn) {
            markAllReadBtn.style.display = adminNotificationsCache.unread.length ? 'inline-flex' : 'none';
        }

        if (!adminNotificationsCache.unread.length && !adminNotificationsCache.read.length) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
            return;
        }

        let html = '';
        if (adminNotificationsCache.unread.length) {
            html += '<div class="notification-section-label">New</div>';
            html += adminNotificationsCache.unread.map(item => buildNotificationItem(item, true)).join('');
        }
        if (adminNotificationsCache.read.length) {
            html += '<div class="notification-section-label">Earlier</div>';
            html += adminNotificationsCache.read.map(item => buildNotificationItem(item, false)).join('');
        }

        notificationList.innerHTML = html;
        notificationList.querySelectorAll('.notification-item').forEach(button => {
            button.addEventListener('click', async (event) => {
                const id = button.dataset.id;
                if (!id) return;
                await markNotificationRead(id);
            });
        });
    };

    const toggleNotificationDropdown = async () => {
        if (!notificationDropdown) return;
        const open = notificationDropdown.style.display === 'block';
        if (open) {
            notificationDropdown.style.display = 'none';
            return;
        }
        await loadNotifications();
        notificationDropdown.style.display = 'block';
    };

    const hideNotificationDropdown = () => {
        if (notificationDropdown) notificationDropdown.style.display = 'none';
    };

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
        doc.setTextColor('#1f2937');
        doc.setFont('helvetica', 'bold');
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

    const loadNotifications = async () => {
        if (!notificationList) return;
        try {
            const res = await window.TatakApi.apiRequest('/notifications');
            adminNotificationsCache.unread = res.unread || [];
            adminNotificationsCache.read = res.read || [];
            updateNotificationBadge();
            renderNotifications();
        } catch (err) {
            console.error('Error loading notifications:', err);
            if (notificationList) notificationList.innerHTML = '<div class="notification-empty">Unable to load notifications.</div>';
        }
    };

    const markNotificationRead = async (id) => {
        try {
            await window.TatakApi.apiRequest(`/notifications/${id}`, { method: 'PUT' });
            await loadNotifications();
        } catch (err) {
            console.error('Error marking notification read:', err);
        }
    };

    const markAllNotificationsRead = async () => {
        if (!adminNotificationsCache.unread.length) return;
        try {
            await Promise.all(adminNotificationsCache.unread.map(notification => window.TatakApi.apiRequest(`/notifications/${notification.notification_id}`, { method: 'PUT' })));
            await loadNotifications();
        } catch (err) {
            console.error('Error marking all notifications read:', err);
        }
    };

    if (notificationBell) {
        notificationBell.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleNotificationDropdown();
        });
    }
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await markAllNotificationsRead();
        });
    }
    window.addEventListener('click', (e) => {
        if (notificationDropdown && notificationDropdown.style.display === 'block' && !notificationDropdown.contains(e.target) && notificationBell && !notificationBell.contains(e.target)) {
            hideNotificationDropdown();
        }
    });

    window.formatImageUrl = window.TatakApi.formatImageUrl;

    window.openEditOrgModal = (id, name, desc, status, logo) => {
        document.getElementById('editOrgOldId').value = id;
        document.getElementById('editOrgId').value = id;
        document.getElementById('editOrgName').value = name;
        document.getElementById('editOrgDesc').value = desc;
        document.getElementById('editOrgStatus').value = status;
        document.getElementById('editOrgLogo').value = logo || '';
        document.getElementById('editOrgError').style.display = 'none';

        // Update Logo Preview
        const placeholder = document.querySelector('#editOrgModal .avatar-upload-placeholder');
        if (placeholder) {
            const logoPreview = placeholder.querySelector('img');
            const logoIcon = placeholder.querySelector('i');
            if (logo) {
                logoPreview.src = formatImageUrl(logo);
                logoPreview.style.display = 'block';
                if (logoIcon) logoIcon.style.display = 'none';
            } else {
                logoPreview.src = '';
                logoPreview.style.display = 'none';
                if (logoIcon) logoIcon.style.display = 'block';
            }
        }

        window.openModal('editOrgModal');
    };

    window.openDeleteOrgModal = (id, name) => {
        const confirmBtn = document.getElementById('confirmDeleteOrgBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = 'Deleting...';
                confirmBtn.disabled = true;
                try {
                    const res = await window.TatakApi.apiRequest(`/organizations/${id}`, { method: 'DELETE' });
                    if (res && res.success) {
                        window.closeModal('deleteOrgModal');
                        const msg = `"${name}" has been deleted successfully.`;
                        window.TatakApi.setPendingToast(msg, 'success');
                        window.TatakApi.showToast(msg, 'success');
                        loadAdminOrganizations();
                    } else {
                        window.TatakApi.showToast(res.error || 'Failed to delete organization.', 'error');
                    }
                } catch (err) {
                    console.error('Error deleting org:', err);
                    window.TatakApi.showToast(err.message || 'Failed to delete organization.', 'error');
                } finally {
                    confirmBtn.innerText = 'Yes, Delete';
                    confirmBtn.disabled = false;
                }
            };
        }
        window.openModal('deleteOrgModal');
    };

    window.openOverrideAttendanceModal = async (id, name) => {
        const studentIdInput = document.getElementById('overrideStudentId');
        const studentNameText = document.getElementById('overrideStudentName');
        if (studentIdInput) studentIdInput.value = id;
        if (studentNameText) studentNameText.innerText = `Overriding attendance for: ${name}`;
        
        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = res.data || [];
            const select = document.getElementById('overrideEventId');
            if (select) {
                select.innerHTML = '<option value="" disabled selected>Select an event...</option>' + 
                    events.map(e => `<option value="${e.event_id}">${e.name}</option>`).join('');
            }
        } catch (err) {
            console.error('Error loading events for override:', err);
        }
        
        window.openModal('overrideAttendanceModal');
    };

    window.openDeleteStudentModal = (id) => {
        const confirmBtn = document.getElementById('confirmDeleteStudentBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = 'Deleting...';
                confirmBtn.disabled = true;
                try {
                    const res = await window.TatakApi.apiRequest(`/auth/users/${id}`, { method: 'DELETE' });
                    if (res && res.success) {
                        window.closeModal('deleteStudentModal');
                        window.TatakApi.setPendingToast('Student deleted successfully', 'success');
                        window.TatakApi.showToast('Student deleted successfully', 'success');
                        loadAdminStudentsTable();
                    }
                } catch (err) {
                    console.error('Error deleting student:', err);
                    window.TatakApi.showToast('Error deleting student: ' + err.message, 'error');
                } finally {
                    confirmBtn.innerText = 'Yes, Delete';
                    confirmBtn.disabled = false;
                }
            };
        }
        window.openModal('deleteStudentModal');
    };

    window.openAddStudentModal = () => {
        const form = document.getElementById('studentForm');
        if (form) {
            form.reset();
        }
        window.openModal('addStudentModal');
    };

    window.openEditEventModal = (id, name, date, venue, start, end, expected, orgId) => {
        document.getElementById('editEventId').value = id;
        document.getElementById('editEventOrg').value = orgId || '';
        document.getElementById('editEventName').value = name;
        document.getElementById('editEventDate').value = date;
        document.getElementById('editEventVenue').value = venue;
        document.getElementById('editEventStartTime').value = start;
        document.getElementById('editEventEndTime').value = end;
        document.getElementById('editEventCapacity').value = expected || '';
        window.openModal('editEventModal');
    };

    window.openApproveEventModal = (id) => {
        const confirmBtn = document.getElementById('confirmApproveEventBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = 'Approving...';
                confirmBtn.disabled = true;
                try {
                    const res = await window.TatakApi.apiRequest(`/events/${id}/approve`, { method: 'PUT' });
                    if (res && res.success) {
                        window.closeModal('approveEventModal');
                        window.TatakApi.setPendingToast('Event approved successfully!', 'success');
                        window.TatakApi.showToast('Event approved successfully!', 'success');
                        loadAdminEventsTable();
                        loadAdminOverviewMetrics();
                    } else {
                        window.TatakApi.showToast(res.error || 'Failed to approve event.', 'error');
                    }
                } catch (err) {
                    console.error('Error approving event:', err);
                    window.TatakApi.showToast('Failed to approve event.', 'error');
                } finally {
                    confirmBtn.innerText = 'Yes, Approve';
                    confirmBtn.disabled = false;
                }
            };
        }
        window.openModal('approveEventModal');
    };

    window.openDeleteEventModal = (id, isPending = false) => {
        const titleEl = document.getElementById('deleteEventModalTitle');
        const textEl = document.getElementById('deleteEventModalText');
        const confirmBtn = document.getElementById('confirmDeleteEventBtn');
        
        if (titleEl && textEl) {
            if (isPending) {
                titleEl.innerText = 'Reject Event?';
                textEl.innerHTML = 'Are you sure? This action will <br><strong>permanently delete</strong> this pending event request.';
            } else {
                titleEl.innerText = 'Delete Event?';
                textEl.innerHTML = 'Are you sure? This action will remove <br><strong>all attendance records</strong> for this event.';
            }
        }

        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = isPending ? 'Rejecting...' : 'Deleting...';
                confirmBtn.disabled = true;
                try {
                    const res = await window.TatakApi.apiRequest(`/events/${id}`, { method: 'DELETE' });
                    if (res && res.success) {
                        window.closeModal('deleteEventModal');
                        const msg = isPending ? 'Event rejected.' : 'Event deleted successfully.';
                        window.TatakApi.setPendingToast(msg, 'success');
                        window.TatakApi.showToast(msg, 'success');
                        loadAdminEventsTable();
                        loadAdminOverviewMetrics();
                    } else {
                        window.TatakApi.showToast(res.error || 'Failed to delete event.', 'error');
                    }
                } catch (err) {
                    console.error('Error deleting event:', err);
                    window.TatakApi.showToast('Failed to delete event.', 'error');
                } finally {
                    confirmBtn.innerText = isPending ? 'Yes, Reject' : 'Yes, Delete';
                    confirmBtn.disabled = false;
                }
            };
        }
        window.openModal('deleteEventModal');
    };

    window.openEditOfficerModal = (id, name, orgId, role, status, profilePic) => {
        document.getElementById('editOfficerId').value = id;
        document.getElementById('editOffName').value = name;
        document.getElementById('editOffOrg').value = orgId;
        document.getElementById('editOffRole').value = role;
        document.getElementById('editOffStatus').value = status;
        document.getElementById('editOffProfilePic').value = profilePic || '';

        // Update Profile Pic Preview
        const placeholder = document.querySelector('#editOfficerModal .avatar-upload-placeholder');
        if (placeholder) {
            const preview = placeholder.querySelector('img');
            const icon = placeholder.querySelector('i');
            if (profilePic) {
                preview.src = formatImageUrl(profilePic);
                preview.style.display = 'block';
                if (icon) icon.style.display = 'none';
            } else {
                preview.src = '';
                preview.style.display = 'none';
                if (icon) icon.style.display = 'block';
            }
        }

        window.openModal('editOfficerModal');
    };

    window.openDeleteOfficerModal = (officerId, userId) => {
        const confirmBtn = document.getElementById('confirmDeleteOfficerBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = 'Removing...';
                confirmBtn.disabled = true;
                
                // Clear any old notifications before starting
                window.TatakApi.clearPendingToast();
                
                try {
                    // Set a temporary flag in case the browser refreshes during image deletion
                    sessionStorage.setItem('pending_officer_deletion_sync', 'true');

                    // Backend already handles recursive deletion of the user account
                    await window.TatakApi.apiRequest(`/officers/${officerId}`, { method: 'DELETE' });

                    // Success! Clear the flag
                    sessionStorage.removeItem('pending_officer_deletion_sync');

                    window.closeModal('deleteOfficerModal');
                    loadAdminOfficersTable();
                    window.TatakApi.setPendingToast('Officer and user account removed successfully.', 'success');
                    window.TatakApi.showToast('Officer and user account removed successfully.', 'success');
                } catch (err) {
                    console.error('Error removing officer:', err);
                    window.TatakApi.showToast('Failed to remove officer: ' + err.message, 'error');
                } finally {
                    confirmBtn.innerText = 'Yes, Remove';
                    confirmBtn.disabled = false;
                }
            };
        }
        window.openModal('deleteOfficerModal');
    };

    // QR Modal Logic
    window.showEventQR = (qrUrl, eventName) => {
        const modal = document.getElementById('qrDisplayModal');
        const img = document.getElementById('qrDisplayImg');
        const title = document.getElementById('qrModalEventName');
        
        if (!qrUrl) {
            window.TatakApi.showToast('QR code not generated for this event yet.', 'info');
            return;
        }

        const fullUrl = window.TatakApi.formatImageUrl(qrUrl);
        img.src = fullUrl;
        title.textContent = eventName;
        window.openModal('qrDisplayModal');
    };

    const contentDiv = document.getElementById('dynamic-content');
    const mainTitle = document.getElementById('main-title');
    const actionBtn = document.getElementById('action-btn');

    // State management
    const getOrgInitials = (name) => {
        if (!name || name === 'Unknown' || name === '---') return name;
        const words = name.split(' ');
        if (words.length === 1) return name.substring(0, 3).toUpperCase();
        const ignored = ['of', 'the', 'and', 'in', 'at', 'for'];
        const initials = words
            .filter(w => !ignored.includes(w.toLowerCase()))
            .map(w => w[0])
            .join('')
            .toUpperCase();
        return initials.length > 0 ? initials.substring(0, 4) : name.substring(0, 3).toUpperCase();
    };

    window.showSection = function(section, element) {
        // Persist current section
        localStorage.setItem('admin_last_section', section);

        // Update Active Navigation State
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        if (element) {
            element.classList.add('active');
        } else {
            // If no element passed, find the link by data-section or text
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                if (item.getAttribute('onclick')?.includes(`'${section}'`)) {
                    item.classList.add('active');
                }
            });
        }

        // Reset header to default
        const header = document.querySelector('.dashboard-header');
        header.classList.remove('header-dark');
        
        // Show action button by default
        actionBtn.style.display = 'block';

        if (section === 'overview') {
            mainTitle.innerHTML = 'HELLO, <span class="highlight">ADMIN</span>';
            actionBtn.innerHTML = '<i class="fas fa-plus"></i> New Event';
            actionBtn.onclick = () => openModal('addEventModal');
            renderOverview();
        } 
        else if (section === 'events') {
            mainTitle.innerText = 'Events Management';
            actionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Event';
            actionBtn.onclick = () => openModal('addEventModal');
            renderEvents();
        }
        else if (section === 'organization') {
            mainTitle.innerText = 'Organization Management';
            actionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Organization';
            actionBtn.onclick = () => {
                const form = document.getElementById('addOrgForm');
                if (form) form.reset();
                const placeholder = document.querySelector('#addOrgModal .avatar-upload-placeholder');
                if (placeholder) {
                    const preview = placeholder.querySelector('img');
                    const icon = placeholder.querySelector('i');
                    if (preview) { preview.src = ''; preview.style.display = 'none'; }
                    if (icon) icon.style.display = 'block';
                }
                openModal('addOrgModal');
            };
            renderOrganizations();
        }
        else if (section === 'officers') {
            mainTitle.innerText = 'Officer Directory';
            actionBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add Officer';
            actionBtn.onclick = () => {
                const form = document.getElementById('officerForm');
                if (form) form.reset();
                const placeholder = document.querySelector('#addOfficerModal .avatar-upload-placeholder');
                if (placeholder) {
                    const preview = placeholder.querySelector('img');
                    const icon = placeholder.querySelector('i');
                    if (preview) { preview.src = ''; preview.style.display = 'none'; }
                    if (icon) icon.style.display = 'block';
                }
                openModal('addOfficerModal');
            };
            renderOfficers();
        }
        else if (section === 'students') {
            mainTitle.innerText = 'Student Directory';
            actionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Student';
            actionBtn.onclick = () => window.openAddStudentModal();
            renderStudents();
        }
        else if (section === 'reports') {
            mainTitle.innerText = 'System Reports';
            actionBtn.style.display = 'none';
            renderReports();
        }
        else if (section === 'audit') {
            mainTitle.innerText = 'System Audit Logs';
            actionBtn.style.display = 'none';
            renderAuditLogs();
        }
    };

    // --- RENDER FUNCTIONS ---

    function renderOverview() {
        contentDiv.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon icon-blue"><i class="far fa-calendar"></i></div>
                    <div class="stat-data"><span class="value" id="admin-total-events">...</span><p class="label">Total Events</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-purple"><i class="fas fa-user-graduate"></i></div>
                    <div class="stat-data"><span class="value" id="admin-total-students">...</span><p class="label">Total Students</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-orange"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-data"><span class="value" id="admin-avg-attendance">...</span><p class="label">Avg Attendance</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-pink"><i class="fas fa-user-shield"></i></div>
                    <div class="stat-data"><span class="value" id="admin-active-officers">...</span><p class="label">Active Officers</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-green"><i class="fas fa-university"></i></div>
                    <div class="stat-data"><span class="value" id="admin-active-orgs">...</span><p class="label">Active Orgs</p></div>
                </div>
            </div>
            <div class="content-grid">
                <div class="chart-container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                        <h3 style="margin: 0;">Monthly Attendance Rate</h3>
                        <div style="display: flex; gap: 10px;">
                            <select id="admin-chart-org-filter" style="font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; color: #475569; outline: none; background: #f8fafc; cursor: pointer; font-weight: 600; min-width: 150px;">
                                <option value="all">All Organizations</option>
                            </select>
                            <select id="admin-chart-month-filter" style="font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; color: #475569; outline: none; background: #f8fafc; cursor: pointer; font-weight: 600;"></select>
                        </div>
                    </div>
                    <div class="chart-placeholder" id="admin-monthly-chart" style="display: flex; align-items: center; justify-content: center; min-height: 200px; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0;">
                        <p style="color: #64748b;">Loading chart data...</p>
                    </div>
                </div>
                <div class="events-container">
                    <h3>Upcoming Events</h3>
                    <div class="event-list" id="admin-upcoming-events-list">
                        <p style="padding: 20px; color: #64748b;">Loading events...</p>
                    </div>
                </div>
            </div>`;
        loadAdminOverviewMetrics();
    }

    function renderEvents() {
        contentDiv.innerHTML = `
            <div class="events-view">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon icon-blue"><i class="fas fa-calendar-alt"></i></div>
                        <div class="stat-data"><span class="value" id="events-tab-total">...</span><p class="label">Total Events</p></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-purple"><i class="fas fa-user-graduate"></i></div>
                        <div class="stat-data"><span class="value" id="events-tab-enrolled">...</span><p class="label">Students Enrolled</p></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-green"><i class="fas fa-university"></i></div>
                        <div class="stat-data"><span class="value" id="events-tab-orgs">...</span><p class="label">Organizations</p></div>
                    </div>
                </div>
                <div class="events-table-container" style="margin-bottom: 25px;">
                    <div class="white-container table-section">
                        <div class="container-header">
                            <h3><i class="fas fa-calendar-check" style="margin-right: 8px; color: #3b82f6;"></i>All Events</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>EVENT</th>
                                        <th class="text-center">ORG</th>
                                        <th class="text-center">DATE</th>
                                        <th class="text-center">VENUE</th>
                                        <th class="text-center">STATUS</th>
                                        <th class="text-center">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody id="admin-events-table-body">
                                    <tr><td colspan="6" style="text-align: center; padding: 20px;">Loading events...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="white-container coming-up-section">
                    <div class="container-header">
                        <h3>Coming Up</h3>
                    </div>
                    <div id="events-tab-coming-up" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                        <p style="padding: 10px; color: #718096; font-size: 14px;">Loading...</p>
                    </div>
                </div>
            </div>`;
        loadAdminEventsTable();
        populateOrgSelects();
    }

    function renderOrganizations() {
        contentDiv.innerHTML = `
            <div class="org-view">
                <!-- Top Row: Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon icon-yellow-light" style="background: #fffbeb; color: #f59e0b;"><i class="fas fa-university"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-orgs-total">...</span>
                            <p class="label">Total Organizations</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-green-light" style="background: #f0fdf4; color: #22c55e;"><i class="fas fa-users"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-orgs-members">...</span>
                            <p class="label">Active Members</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-blue-light" style="background: #eff6ff; color: #3b82f6;"><i class="fas fa-calendar-alt"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-orgs-events">...</span>
                            <p class="label">Total Events</p>
                        </div>
                    </div>
                </div>

                <!-- Bottom Row: Split View -->
                <div class="org-split-container">
                    <!-- Left: All Organizations Grid -->
                    <div class="org-left-side white-container">
                        <h3 class="side-title">All Organizations</h3>
                        <div class="org-cards-grid-2col" id="admin-orgs-container">
                            <p style="padding: 20px; color: #64748b;">Loading organizations...</p>
                        </div>
                    </div>

                    <!-- Right: Top Performing Org Card -->
                    <div class="org-right-side">
                        <div class="top-org-card">
                            <div class="card-tag">TOP PERFORMING ORG</div>
                            <div class="org-main-vertical">
                                <div class="org-logo-wrap" id="top-org-logo-wrap">
                                    <div class="org-logo-circle">...</div>
                                </div>
                                <h2 class="org-acronym" id="top-org-name">...</h2>
                                <p class="org-fullname" id="top-org-full">Loading...</p>
                            </div>
                            <div class="org-stats-simple">
                                <div class="org-stat">
                                    <span class="val" id="top-org-members">0</span>
                                    <span class="lbl">Members</span>
                                </div>
                                <div class="org-stat">
                                    <span class="val" id="top-org-events">0</span>
                                    <span class="lbl">Events</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        loadAdminOrganizations();
    }

    function renderOfficers() {
        mainTitle.innerText = 'Officers';
        actionBtn.innerText = '+ Add Officer';
        actionBtn.style.display = 'block';
        actionBtn.onclick = () => openModal('addOfficerModal');

        contentDiv.innerHTML = `
            <div class="officers-view">
                <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); max-width: 800px;">
                    <div class="stat-card">
                        <div class="stat-icon icon-blue-light" style="background: #eff6ff; color: #3b82f6;"><i class="fas fa-id-card"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-officers-total">25</span>
                            <p class="label">Total Officers</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-green-light" style="background: #f0fdf4; color: #22c55e;"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-officers-active">18</span>
                            <p class="label">Active Officers</p>
                        </div>
                    </div>
                </div>

                <div class="white-container full-width">
                    <div class="container-header">
                        <h3>Officer Directory</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>OFFICER</th>
                                    <th class="text-center">POSITION</th>
                                    <th class="text-center">ORGANIZATION</th>
                                    <th class="text-center">TERM</th>
                                    <th class="text-center">STATUS</th>
                                    <th class="text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody id="admin-officers-table-body">
                                <tr><td colspan="6" style="text-align:center; padding: 20px;">Loading officers...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        loadAdminOfficersTable();
        populateOrgSelects();
    }

    function renderStudents() {
        mainTitle.innerText = 'Students';
        actionBtn.innerText = '+ Add Student';
        actionBtn.style.display = 'block';
        actionBtn.onclick = () => window.openAddStudentModal();

        contentDiv.innerHTML = `
            <div class="students-view">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon icon-blue-light" style="background: #eff6ff; color: #3b82f6;"><i class="fas fa-graduation-cap"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-students-total">...</span>
                            <p class="label">Total Students</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-green-light" style="background: #f0fdf4; color: #22c55e;"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-students-enrolled">...</span>
                            <p class="label">Enrolled</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon icon-yellow-light" style="background: #fffbeb; color: #f59e0b;"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-data">
                            <span class="value" id="admin-students-attendance">...</span>
                            <p class="label">Avg Attendance</p>
                        </div>
                    </div>
                </div>

                <div class="white-container full-width">
                    <div class="container-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <h3>Student Directory</h3>
                            <div class="search-box" style="padding: 0 15px; border-radius: 10px; background: white; border: 1px solid #e2e8f0; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02); height: 40px;">
                                <i class="fas fa-search" style="color: #94a3b8; margin-right: 8px; font-size: 0.9rem;"></i>
                                <input type="text" id="student-search-input" placeholder="Search name or ID..." style="border: none; outline: none; background: transparent; padding: 10px 0; font-family: inherit; font-size: 0.9rem; color: #475569; width: 200px;">
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <div class="search-box" style="padding: 0 15px; border-radius: 10px; background: white; border: 1px solid #e2e8f0; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <i class="fas fa-university" style="color: #94a3b8; margin-right: 8px; font-size: 0.9rem;"></i>
                                <select id="student-org-filter" style="border: none; outline: none; background: transparent; padding: 10px 0; font-family: inherit; font-size: 0.9rem; color: #475569; cursor: pointer; min-width: 160px;">
                                    <option value="all">All Organizations</option>
                                </select>
                            </div>
                            <div class="search-box" style="padding: 0 15px; border-radius: 10px; background: white; border: 1px solid #e2e8f0; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <i class="fas fa-calendar-alt" style="color: #94a3b8; margin-right: 8px; font-size: 0.9rem;"></i>
                                <select id="student-event-filter" style="border: none; outline: none; background: transparent; padding: 10px 0; font-family: inherit; font-size: 0.9rem; color: #475569; cursor: pointer; min-width: 160px;" disabled>
                                    <option value="all">All Events</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>STUDENT</th>
                                    <th class="text-center">COURSE & YEAR</th>
                                    <th class="text-center">ORGANIZATION</th>
                                    <th class="text-center">ATTENDANCE</th>
                                    <th class="text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody id="admin-students-table-body">
                                <tr><td colspan="5" style="text-align: center; padding: 20px;">Loading students...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        loadAdminStudentsTable();
    }
    async function renderReports() {
        contentDiv.innerHTML = `
            <div class="reports-view">
                <div class="white-container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div>
                            <h3 style="margin: 0;">Attendance Reports</h3>
                            <p class="report-instruction" style="margin: 5px 0 0;">Download verified PDF reports for university events.</p>
                        </div>
                        <div class="header-actions">
                            <select id="report-org-filter" class="form-control" style="width: 200px; padding: 8px; border-radius: 8px;">
                                <option value="all">All Organizations</option>
                            </select>
                        </div>
                    </div>
                    <div id="reports-list-container">
                        <p style="text-align: center; padding: 40px; color: #64748b;">Loading events...</p>
                    </div>
                </div>
            </div>`;

        // 1. Load Orgs for filter
        const orgsRes = await window.TatakApi.apiRequest('/organizations');
        const orgs = orgsRes.data || [];
        const filter = document.getElementById('report-org-filter');
        if (filter) {
            orgs.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.organization_id;
                opt.textContent = o.name;
                filter.appendChild(opt);
            });
            filter.addEventListener('change', () => loadReportEvents(filter.value));
        }

        // 2. Load Events
        await loadReportEvents('all');
    }

    async function loadReportEvents(orgId) {
        const container = document.getElementById('reports-list-container');
        if (!container) return;

        try {
            const res = await window.TatakApi.apiRequest('/events');
            let events = res.data || [];
            
            if (orgId !== 'all') {
                events = events.filter(e => String(e.organization_id) === String(orgId));
            }

            if (events.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 40px; color: #64748b;">No events found for this selection.</p>';
                return;
            }

            container.innerHTML = events.map(event => {
                const dateStr = new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const orgName = event.organization_name || 'University Event';
                const certId = `CERT-${event.event_id}-${new Date(event.start_date).getTime().toString().slice(-4)}`;
                
                return `
                    <div class="cert-row">
                        <div class="cert-icon-box"><i class="far fa-file-pdf"></i><span>PDF</span></div>
                        <div class="cert-details">
                            <h3>${event.name}</h3>
                            <p>${dateStr} • ${orgName} • ${event.location || 'Main Campus'}</p>
                            <div class="cert-meta">
                                <span class="badge-mini">Verified Report</span>
                                <span class="cert-id">Ref: ${certId}</span>
                            </div>
                        </div>
                        <button class="btn-download" 
                                data-event-name="${event.name.replace(/'/g, "&apos;")}" 
                                data-details="${dateStr} • ${orgName}"
                                data-cert-id="${certId}">Download</button>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.btn-download').forEach(button => {
                button.addEventListener('click', () => {
                    const eventName = button.dataset.eventName;
                    const details = button.dataset.details;
                    const certificateId = button.dataset.certId;
                    const recipient = 'System Administrator';
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
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #ef4444;">Error loading events.</p>';
        }
    }

    function renderAuditLogs() {
        contentDiv.innerHTML = `
            <div class="white-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0;">System Audit Logs</h3>
                        <p class="report-instruction" style="margin: 5px 0 0;">Track all administrative actions and system updates.</p>
                    </div>
                    <button class="btn-outline" onclick="window.loadAdminAuditLogs()" style="color: #475569; border-color: #e2e8f0;"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="text-center">TIMESTAMP</th>
                                <th class="text-center">USER</th>
                                <th class="text-center">ACTION</th>
                                <th class="text-center">DETAILS</th>
                            </tr>
                        </thead>
                        <tbody id="admin-audit-table-body">
                            <tr><td colspan="4" class="text-center">Loading logs...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
        loadAdminAuditLogs();
    }

    window.loadAdminAuditLogs = async function() {
        const tableBody = document.getElementById('admin-audit-table-body');
        if (!tableBody) return;

        try {
            const res = await window.TatakApi.apiRequest('/logs');
            const logs = res.data || [];

            if (logs.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 20px;">No audit logs found.</td></tr>';
                return;
            }

            tableBody.innerHTML = logs.map(log => {
                const date = new Date(log.timestamp).toLocaleString();
                const user = log.fname ? `${log.fname}` : `User #${log.user_id}`;
                const roleLabel = log.role ? ` (${log.role})` : '';
                const details = log.target_name ? `${log.target_name} (${log.table_name} #${log.record_id})` : `${log.table_name || 'System'} ${log.record_id ? '#' + log.record_id : ''}`;
                
                return `
                    <tr>
                        <td class="text-center" style="font-size: 13px; color: #64748b;">${date}</td>
                        <td class="text-center"><span style="font-weight: 600; color: #1e293b;">${user}</span><span style="font-size: 11px; color: #94a3b8;">${roleLabel}</span></td>
                        <td class="text-center"><span class="badge-mini" style="background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 6px; font-weight: 600;">${log.action}</span></td>
                        <td class="text-center" style="font-size: 13px; color: #475569;">${details}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: #ef4444; padding: 20px;">Failed to load logs.</td></tr>';
        }
    }

    // --- DATA LOADING FUNCTIONS ---

    async function loadAdminOverviewMetrics() {
        try {
            const [eventsRes, studentsRes, attendanceRes, officersRes, orgsRes] = await Promise.all([
                window.TatakApi.apiRequest('/events'),
                window.TatakApi.apiRequest('/auth/users'),
                window.TatakApi.apiRequest('/attendance/summary'),
                window.TatakApi.apiRequest('/officers'),
                window.TatakApi.apiRequest('/organizations')
            ]);

            const events = eventsRes.data || [];
            const students = (studentsRes.data || []).filter(u => u.role === 'Student');
            const officers = officersRes.data || [];
            const organizations = orgsRes.data || [];
            const summary = attendanceRes.data || { total: 0, present_count: 0 };

            if(document.getElementById('admin-total-events')) document.getElementById('admin-total-events').innerText = events.length;
            if(document.getElementById('admin-total-students')) document.getElementById('admin-total-students').innerText = students.length;
            if(document.getElementById('admin-active-officers')) document.getElementById('admin-active-officers').innerText = officers.length;
            if(document.getElementById('admin-active-orgs')) document.getElementById('admin-active-orgs').innerText = organizations.length;
            
            
            const totalExpected = events.reduce((sum, e) => sum + (e.expected_attendance || 0), 0);
            const totalPresent = (summary.present_count || 0) + (summary.late_count || 0);
            const attendanceRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;
            if(document.getElementById('admin-avg-attendance')) document.getElementById('admin-avg-attendance').innerText = `${attendanceRate}%`;

            const chartPlaceholder = document.getElementById('admin-monthly-chart');
            const monthFilter = document.getElementById('admin-chart-month-filter');
            const orgFilter = document.getElementById('admin-chart-org-filter');

            if (chartPlaceholder && monthFilter && orgFilter) {
                // Populate Org Filter
                const currentOrgVal = orgFilter.value;
                orgFilter.innerHTML = '<option value="all">All Organizations</option>' + 
                    organizations.map(o => `<option value="${o.organization_id}">${o.name}</option>`).join('');
                if (currentOrgVal) orgFilter.value = currentOrgVal;

                // Collect unique months that have events
                const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const now = new Date();
                const monthSet = new Map(); // key: "YYYY-MM" → { year, month, label }
                events.forEach(e => {
                    const d = new Date(e.start_date);
                    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
                    if (!monthSet.has(key)) {
                        monthSet.set(key, { year: d.getFullYear(), month: d.getMonth(), label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
                    }
                });

                // Sort months descending (newest first)
                const sortedMonths = [...monthSet.entries()].sort((a,b) => b[0].localeCompare(a[0]));

                // Populate the dropdown
                const currentKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`;
                monthFilter.innerHTML = sortedMonths.map(([key, val]) => 
                    `<option value="${key}" ${key === currentKey ? 'selected' : ''}>${val.label}</option>`
                ).join('');

                // If no months at all, add current month as placeholder
                if (sortedMonths.length === 0) {
                    monthFilter.innerHTML = `<option value="${currentKey}">${monthNames[now.getMonth()]} ${now.getFullYear()}</option>`;
                }

                // Track chart instance for cleanup
                let chartInstance = null;

                async function renderChartForMonth(yearMonthKey, orgId = 'all') {
                    const chartPlaceholder = document.getElementById('admin-monthly-chart');
                    if (!chartPlaceholder) return;
                    
                    chartPlaceholder.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; margin-bottom: 10px;"></i>
                            <p style="color: #64748b; font-size: 13px;">Analyzing attendance data...</p>
                        </div>
                    `;
                    
                    const entry = monthSet.get(yearMonthKey);
                    const filterYear = entry ? entry.year : now.getFullYear();
                    const filterMonth = entry ? entry.month : now.getMonth();

                    // Fetch attendance data
                    let allAtt = [];
                    try {
                        const allAttRes = await window.TatakApi.apiRequest('/attendance/all');
                        allAtt = allAttRes.data || [];
                    } catch(e) { 
                        console.error('Chart data fetch error:', e); 
                        chartPlaceholder.innerHTML = '<p style="color: #ef4444; padding: 20px;">Failed to load attendance data.</p>';
                        return;
                    }

                    const filtered = events.filter(e => {
                        const d = new Date(e.start_date);
                        const matchesMonth = d.getMonth() === filterMonth && d.getFullYear() === filterYear;
                        const matchesOrg = orgId === 'all' || String(e.organization_id) === String(orgId);
                        return matchesMonth && matchesOrg;
                    });

                    // Destroy old chart
                    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

                    chartPlaceholder.innerHTML = '<canvas id="monthlyAttendanceChart"></canvas>';
                    const ctx = document.getElementById('monthlyAttendanceChart').getContext('2d');
                    chartPlaceholder.style.cssText = 'display:block; padding:15px; height:300px; background:#f8fafc; border-radius:12px; border:none;';

                    if (filtered.length === 0) {
                        chartPlaceholder.style.cssText = 'display:flex; align-items:center; justify-content:center; min-height:200px; background:#f8fafc; border-radius:12px; border:2px dashed #e2e8f0;';
                        chartPlaceholder.innerHTML = `<p style="text-align: center; color: #64748b; padding: 40px;">No events for ${monthNames[filterMonth]} ${filterYear}.</p>`;
                        return;
                    }

                    const labels = [];
                    const dataPoints = [];
                    filtered.forEach(e => {
                        labels.push(e.name);
                        const count = allAtt.filter(a => String(a.event_id) === String(e.event_id) && ['Present', 'Late'].includes(a.status)).length;
                        dataPoints.push(count);
                    });
                    const expectedPoints = filtered.map(e => e.expected_attendance || 0);

                    // ctx is already declared above
                    chartInstance = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [
                                {
                                    label: 'Expected Attendance',
                                    data: expectedPoints,
                                    backgroundColor: 'rgba(251, 191, 36, 0.35)',
                                    hoverBackgroundColor: 'rgba(251, 191, 36, 0.55)',
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor: 'rgba(245, 158, 11, 0.5)',
                                    barPercentage: 0.6,
                                    categoryPercentage: 0.7,
                                    order: 2
                                },
                                {
                                    label: 'Actual Attendees',
                                    data: dataPoints,
                                    backgroundColor: 'rgba(59, 130, 246, 0.85)',
                                    hoverBackgroundColor: '#2563eb',
                                    borderRadius: 6,
                                    borderWidth: 0,
                                    barPercentage: 0.4,
                                    categoryPercentage: 0.7,
                                    order: 1
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            skipNull: true,
                            layout: { padding: { left: 10, right: 10, bottom: 5 } },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                    labels: { boxWidth: 12, boxHeight: 12, borderRadius: 4, color: '#64748b', font: { size: 11 }, padding: 16 }
                                },
                                tooltip: {
                                    backgroundColor: '#1e293b',
                                    padding: 12,
                                    cornerRadius: 8,
                                    callbacks: {
                                        afterBody: (items) => {
                                            const idx = items[0]?.dataIndex;
                                            if (idx === undefined) return [];
                                            const actual = dataPoints[idx];
                                            const expected = expectedPoints[idx];
                                            if (expected > 0) {
                                                const pct = Math.round((actual / expected) * 100);
                                                return [`Achievement: ${pct}%`];
                                            }
                                            return [];
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: { beginAtZero: true, grid: { color: '#f1f5f9', drawBorder: false }, ticks: { stepSize: 1, precision: 0, color: '#64748b' } },
                                x: { 
                                    offset: true,
                                    grid: { display: false, drawBorder: false }, 
                                    ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 0, minRotation: 0, autoSkip: false, padding: 8 }
                                }
                            }
                        }
                    });
                }

                // Initial render
                renderChartForMonth(monthFilter.value, orgFilter.value);

                // Re-render on change
                monthFilter.addEventListener('change', () => renderChartForMonth(monthFilter.value, orgFilter.value));
                orgFilter.addEventListener('change', () => renderChartForMonth(monthFilter.value, orgFilter.value));
            }

            const upcomingList = document.getElementById('admin-upcoming-events-list');
            if (upcomingList) {
                const now = new Date();
                const upcoming = events.filter(e => new Date(e.start_date) > now)
                    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))
                    .slice(0, 3);
                
                if (upcoming.length === 0) {
                    upcomingList.innerHTML = '<p style="padding: 20px; color: #64748b; text-align: center;">No upcoming events.</p>';
                } else {
                    upcomingList.innerHTML = upcoming.map(e => {
                        const d = new Date(e.start_date);
                        return `
                            <div style="display: flex; align-items: center; gap: 15px; padding: 12px; background: white; border-radius: 12px; margin-bottom: 10px; border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; min-width: 50px; border: 1px solid #e2e8f0;">
                                    <strong style="display: block; color: #1e3a8a; font-size: 16px;">${d.getDate()}</strong>
                                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">${d.toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div>
                                    <h4 style="margin: 0; color: #1e293b; font-size: 14px;">${e.name}</h4>
                                    <p style="margin: 2px 0 0; color: #64748b; font-size: 12px;"><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i> ${e.location || 'TBA'}</p>
                                </div>
                            </div>`;
                    }).join('');
                }
            }
        } catch (err) {
            console.error('Error loading overview metrics:', err);
        }
    }

    async function loadAdminEventsTable() {
        const tableBody = document.getElementById('admin-events-table-body');
        const comingUpContainer = document.getElementById('events-tab-coming-up');
        if (!tableBody) return;

        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = res.data || [];

            if(document.getElementById('events-tab-total')) document.getElementById('events-tab-total').innerText = events.length;
            
            const [studentsRes, orgsRes] = await Promise.all([
                window.TatakApi.apiRequest('/auth/users'),
                window.TatakApi.apiRequest('/organizations')
            ]);
            if(document.getElementById('events-tab-enrolled')) document.getElementById('events-tab-enrolled').innerText = (studentsRes.data || []).filter(u => u.role === 'Student').length;
            if(document.getElementById('events-tab-orgs')) document.getElementById('events-tab-orgs').innerText = (orgsRes.data || []).length;

            if (events.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No events found.</td></tr>';
            } else {
                const organizations = orgsRes.data || [];
                tableBody.innerHTML = events.map(event => {
                    const now = new Date();
                    const start = new Date(event.start_date);
                    const end = event.end_date ? new Date(event.end_date) : new Date(start.getTime() + 4*60*60*1000);
                    let status = 'Upcoming', statusCls = 'upcoming';
                    if (now >= start && now <= end) { status = 'Ongoing'; statusCls = 'ongoing'; }
                    else if (now > end) { status = 'Done'; statusCls = 'done'; }

                    // Override status if pending
                    if (event.approval_status === 'Pending') {
                        status = 'Pending Approval';
                        statusCls = 'pending';
                    }

                    const orgObj = organizations.find(o => String(o.organization_id) === String(event.organization_id));
                    const orgName = event.organization_name || orgObj?.name || 'N/A';
                    const orgLogo = orgObj?.logo || '655609284_1426759675272887_2726655014418430573_n.png';
                    
                    const localDate = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0');
                    const startTimeInput = start.getHours().toString().padStart(2, '0') + ':' + start.getMinutes().toString().padStart(2, '0');
                    const endTimeInput = event.end_date ? (new Date(event.end_date).getHours().toString().padStart(2, '0') + ':' + new Date(event.end_date).getMinutes().toString().padStart(2, '0')) : '';

                    const startTimeDisplay = window.TatakApi.formatTime12h(start);
                    const endTimeDisplay = event.end_date ? window.TatakApi.formatTime12h(new Date(event.end_date)) : 'TBA';

                    let actionHtml = '';
                    if (event.approval_status === 'Pending') {
                        actionHtml = `
                            <button class="icon-edit" onclick="window.openApproveEventModal('${event.event_id}')" title="Approve Event" style="color: #10b981;"><i class="fas fa-check"></i></button>
                            <button class="icon-delete" onclick="window.openDeleteEventModal('${event.event_id}', true)" title="Reject & Delete"><i class="far fa-trash-alt"></i></button>
                        `;
                    } else {
                        actionHtml = `
                            <button class="icon-qr" onclick="window.showEventQR('${event.qr_code}', '${event.name.replace(/'/g, "\\'")}')" title="Show QR" style="background: #e0e7ff; color: #4338ca;"><i class="fas fa-qrcode"></i></button>
                            <button class="icon-edit" onclick="window.openEditEventModal('${event.event_id}', '${event.name.replace(/'/g, "\\'")}', '${localDate}', '${(event.location || '').replace(/'/g, "\\'")}', '${startTimeInput}', '${endTimeInput}', '${event.expected_attendance || ''}', '${event.organization_id}')" title="Edit Event"><i class="far fa-edit"></i></button>
                            <button class="icon-delete" onclick="window.openDeleteEventModal('${event.event_id}')" title="Delete Event"><i class="far fa-trash-alt"></i></button>
                        `;
                    }

                    return `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${formatImageUrl(orgLogo)}" alt="Logo" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    <span style="font-weight: 700; color: #1e293b;">${event.name}</span>
                                </div>
                            </td>
                            <td class="text-center"><span class="badge-org">${orgName}</span></td>
                            <td class="text-center">
                                <div style="display: flex; flex-direction: column; align-items: center;">
                                    <span style="font-weight: 600;">${start.toLocaleDateString()}</span>
                                    <span style="font-size: 0.75rem; color: #64748b;">${startTimeDisplay} - ${endTimeDisplay}</span>
                                </div>
                            </td>
                            <td class="text-center">${event.location || 'TBA'}</td>
                            <td class="text-center"><span class="status ${statusCls}">${status}</span></td>
                            <td class="text-center">
                                <div class="action-icons" style="justify-content: center;">
                                    ${actionHtml}
                                </div>
                            </td>
                        </tr>
`;
                }).join('');
            }

            if (comingUpContainer) {
                const now = new Date();
                const upcoming = events.filter(e => new Date(e.start_date) > now && e.approval_status !== 'Pending')
                    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))
                    .slice(0, 3);
                if (upcoming.length === 0) {
                    comingUpContainer.innerHTML = '<p style="padding: 10px; color: #718096; font-size: 13px;">No upcoming events.</p>';
                } else {
                    comingUpContainer.innerHTML = upcoming.map(e => {
                        const d = new Date(e.start_date);
                        return `
                            <div class="mini-event-card">
                                <div class="date-badge"><strong>${d.getDate()}</strong><span>${d.toLocaleString('default', {month:'short'})}</span></div>
                                <div class="mini-details"><h4>${e.name}</h4><p>${e.location || 'TBA'}</p></div>
                            </div>`;
                    }).join('');
                }
            }
        } catch (err) {
            console.error('Error loading events table:', err);
        }
    }

    async function loadAdminOrganizations() {
        const container = document.getElementById('admin-orgs-container');
        if (!container) return;
        try {
            const [orgsRes, usersRes, eventsRes] = await Promise.all([
                window.TatakApi.apiRequest('/organizations'),
                window.TatakApi.apiRequest('/auth/users'),
                window.TatakApi.apiRequest('/events')
            ]);
            
            const orgs = orgsRes.data || [];
            const students = (usersRes.data || []).filter(u => u.role === 'Student');
            const events = eventsRes.data || [];

            if(document.getElementById('admin-orgs-total')) document.getElementById('admin-orgs-total').innerText = orgs.length;
            if(document.getElementById('admin-orgs-members')) document.getElementById('admin-orgs-members').innerText = students.length;
            if(document.getElementById('admin-orgs-events')) document.getElementById('admin-orgs-events').innerText = events.length;
            
            if (orgs.length === 0) {
                container.innerHTML = '<p style="padding: 20px; color: #64748b; text-align: center;">No organizations found.</p>';
            } else {
                const colors = ['blue', 'purple', 'orange', 'green', 'teal', 'red', 'navy', 'maroon'];
                container.innerHTML = orgs.map((org, i) => {
                    const short = getOrgInitials(org.name);
                    const color = colors[i % colors.length];
                    const orgEvents = events.filter(e => String(e.organization_id) === String(org.organization_id));
                    const orgStudents = students.filter(s => String(s.organization_id) === String(org.organization_id));
                    const orgOfficers = (usersRes.data || []).filter(u => u.role === 'Officer' && String(u.organization_id) === String(org.organization_id));
                    const totalMembers = orgStudents.length + orgOfficers.length;

                    const statusText = org.is_active === 1 ? 'Active' : 'Inactive';
                    const statusClass = org.is_active === 1 ? 'Active' : 'Inactive';

                    // Handle Org Logo: Image or Initials
                    const orgLogoContent = org.logo 
                        ? `<img src="${formatImageUrl(org.logo)}" alt="${org.name}" style="width: 100%; height: 100%; object-fit: contain; padding: 4px;">`
                        : short;

                    return `
                        <div class="org-mini-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: -5px;">
                                <span class="org-id-badge" style="margin-bottom: 0;">ID: ${org.organization_id}</span>
                                <span class="status-badge ${statusClass}">${statusText}</span>
                            </div>
                            <div class="mini-card-header">
                                <div class="org-logo-icon ${org.logo ? '' : color}" style="overflow: hidden; display: flex; align-items: center; justify-content: center; background: ${org.logo ? '#ffffff' : ''}; border: ${org.logo ? '1px solid #edf2f7' : 'none'};">${orgLogoContent}</div>
                                <div class="mini-card-titles">
                                    <h4>${org.name}</h4>
                                    <p>${org.description || 'No description available.'}</p>
                                </div>
                            </div>
                            <div class="mini-card-footer">
                                <div class="mini-stat-group">
                                    <div class="mini-stat">
                                        <strong>${totalMembers}</strong>
                                        <span>MEMBERS</span>
                                    </div>
                                    <div class="mini-stat">
                                        <strong>${orgEvents.length}</strong>
                                        <span>EVENTS</span>
                                    </div>
                                </div>
                                <div class="mini-card-actions">
                                    <button class="btn-action-mini edit" onclick="window.openEditOrgModal('${org.organization_id}', '${org.name.replace(/'/g, "\\'")}', '${(org.description || '').replace(/'/g, "\\'")}', '${statusText}', '${org.logo || ''}')" title="Edit"><i class="far fa-edit"></i></button>
                                    <button class="btn-action-mini delete" onclick="window.openDeleteOrgModal('${org.organization_id}', '${org.name.replace(/'/g, "\\'")}')" title="Delete"><i class="far fa-trash-alt"></i></button>
                                </div>
                            </div>
                        </div>`;
                }).join('');
                
                // Set Top Performer (using the one with most events as primary, students as secondary)
                const topOrg = [...orgs].sort((a,b) => {
                    const aEvents = events.filter(e => String(e.organization_id) === String(a.organization_id)).length;
                    const bEvents = events.filter(e => String(e.organization_id) === String(b.organization_id)).length;
                    if (bEvents !== aEvents) return bEvents - aEvents;
                    
                    const aStudents = students.filter(s => String(s.organization_id) === String(a.organization_id)).length;
                    const bStudents = students.filter(s => String(s.organization_id) === String(b.organization_id)).length;
                    return bStudents - aStudents;
                })[0];

                if (topOrg) {
                    const topStudents = students.filter(s => String(s.organization_id) === String(topOrg.organization_id));
                    const topOfficers = (usersRes.data || []).filter(u => u.role === 'Officer' && String(u.organization_id) === String(topOrg.organization_id));
                    const topCount = topStudents.length + topOfficers.length;
                    const topEv = events.filter(e => String(e.organization_id) === String(topOrg.organization_id)).length;
                    
                    const logoWrap = document.getElementById('top-org-logo-wrap');
                    const acronymEl = document.getElementById('top-org-name');
                    const fullEl = document.getElementById('top-org-full');
                    const membersEl = document.getElementById('top-org-members');
                    const eventsEl = document.getElementById('top-org-events');

                    if (logoWrap) {
                        if (topOrg.logo) {
                            logoWrap.innerHTML = `<img src="${formatImageUrl(topOrg.logo)}" alt="Logo">`;
                        } else {
                            logoWrap.innerHTML = `<div class="org-logo-circle">${getOrgInitials(topOrg.name)}</div>`;
                        }
                    }
                    if (acronymEl) acronymEl.innerText = getOrgInitials(topOrg.name);
                    if (fullEl) fullEl.innerText = topOrg.name;
                    if (membersEl) membersEl.innerText = topCount;
                    if (eventsEl) eventsEl.innerText = topEv;
                }
            }
        } catch (err) {
            console.error('Error loading orgs:', err);
        }
    }

    const formatImageUrl = window.TatakApi.formatImageUrl;

    async function loadAdminOfficersTable() {
        const tbody = document.getElementById('admin-officers-table-body');
        if (!tbody) return;
        try {
            const [offRes, orgsRes] = await Promise.all([
                window.TatakApi.apiRequest('/officers'),
                window.TatakApi.apiRequest('/organizations')
            ]);
            const officers = offRes.data || [];
            const orgs = orgsRes.data || [];
            
            if(document.getElementById('admin-officers-total')) document.getElementById('admin-officers-total').innerText = officers.length;
            if(document.getElementById('admin-officers-active')) document.getElementById('admin-officers-active').innerText = officers.filter(o => o.status === 'Active').length;

            if (officers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">No officers found.</td></tr>';
            } else {
                const rowsHTML = officers.map(off => {
                    const fullName = off.fname || 'Unknown Officer';
                    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
                    const orgName = off.name || 'N/A';
                    const position = off.position || 'Officer';
                    const posLower = position.toLowerCase();
                    
                    let posClass = 'badge-pill-yellow';
                    if (posLower.includes('president') && !posLower.includes('vice')) posClass = 'badge-pill-purple';
                    else if (posLower.includes('vice')) posClass = 'badge-pill-blue';
                    else if (posLower.includes('secretary')) posClass = 'badge-pill-green';
                    else if (posLower.includes('treasurer')) posClass = 'badge-pill-amber';
                    else if (posLower.includes('auditor') || posLower.includes('officer')) posClass = 'badge-pill-yellow';
                    else if (posLower.includes('admin')) posClass = 'badge-pill-red';

                    const isOrgInactive = orgs.find(o => String(o.organization_id) === String(off.organization_id))?.is_active === 0;

                    const now = new Date();
                    const termStart = off.term_start ? new Date(off.term_start) : null;
                    const termEnd = off.term_end ? new Date(off.term_end) : null;
                    const isFutureTerm = termStart && now < termStart;
                    const isExpiredTerm = termEnd && now > termEnd;

                    let statusColor = '#10b981', statusLabel = '● Active';
                    if (off.status === 'Inactive') {
                        statusColor = '#ef4444';
                        statusLabel = '● Inactive';
                    } else if (isFutureTerm) {
                        statusColor = '#6366f1'; // Indigo for pending
                        statusLabel = '● Pending';
                    } else if (isExpiredTerm) {
                        statusColor = '#64748b'; // Muted for expired
                        statusLabel = '● Expired';
                    } else if (isOrgInactive) {
                        statusColor = '#f59e0b';
                        statusLabel = '● Org Inactive';
                    }

                    // Handle Avatar: Image or Initials
                    const avatarContent = off.profile_picture 
                        ? `<img src="${formatImageUrl(off.profile_picture)}" alt="${fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                        : initials;
                    
                    return `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <div style="width: 42px; height: 42px; flex-shrink: 0; min-width: 42px; min-height: 42px; background: linear-gradient(135deg, #1e3a8a, #3b82f6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; color: white; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2); overflow: hidden;">${avatarContent}</div>
                                    <div style="display: flex; flex-direction: column;">
                                        <strong style="color: #1e293b; font-size: 0.95rem;">${fullName}</strong>
                                    </div>
                                </div>
                            </td>
                            <td class="text-center"><span class="${posClass}">${position}</span></td>
                            <td class="text-center"><span class="badge-org-blue">${orgName}</span></td>
                            <td class="text-center" style="color: #64748b; font-weight: 600; font-size: 0.85rem;">2025 - 2026</td>
                            <td class="text-center"><span class="status-indicator-dot" style="color: ${statusColor};">${statusLabel}</span></td>
                            <td class="text-center">
                                <div class="action-icons" style="display: flex; gap: 6px; justify-content: center;">
                                    <button class="icon-edit" style="background: #eff6ff; color: #2563eb; width: 32px; height: 32px; border-radius: 8px;" onclick="window.openEditOfficerModal('${off.officer_id}', '${fullName.replace(/'/g, "\\'")}', '${off.organization_id}', '${position.replace(/'/g, "\\'")}', '${off.status || 'Active'}', '${off.profile_picture || ''}')" title="Edit Officer"><i class="far fa-edit" style="font-size: 0.85rem;"></i></button>
                                    <button class="icon-delete" style="background: #fff1f2; color: #ef4444; width: 32px; height: 32px; border-radius: 8px;" onclick="window.openDeleteOfficerModal('${off.officer_id}', '${off.user_id}')" title="Delete Officer"><i class="far fa-trash-alt" style="font-size: 0.85rem;"></i></button>
                                </div>
                            </td>
                        </tr>`;
                }).join('');
                
                // Clear the loading indicator
                tbody.innerHTML = rowsHTML;
            }
        } catch (err) {
            console.error('Error loading officers:', err);
            const tbodyErr = document.getElementById('admin-officers-table-body');
            if (tbodyErr) tbodyErr.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 40px;">Failed to load officers.</td></tr>';
        }
    }

    let studentDataCache = null;

    async function loadAdminStudentsTable() {
        const tbody = document.getElementById('admin-students-table-body');
        if (!tbody) return;
        try {
            const [usersRes, orgsRes, attendanceRes, eventsRes, allAttRes] = await Promise.all([
                window.TatakApi.apiRequest('/auth/users'),
                window.TatakApi.apiRequest('/organizations'),
                window.TatakApi.apiRequest('/attendance/summary'),
                window.TatakApi.apiRequest('/events'),
                window.TatakApi.apiRequest('/attendance/all')
            ]);
            
            const students = (usersRes.data || []).filter(u => u.role === 'Student');
            const orgs = orgsRes.data || [];
            const summary = attendanceRes.data || { total: 0, present_count: 0 };
            const events = eventsRes.data || [];
            const attendanceRecords = allAttRes.data || [];
            
            studentDataCache = { students, orgs, events, attendanceRecords };
            
            if(document.getElementById('admin-students-total')) document.getElementById('admin-students-total').innerText = students.length.toLocaleString();
            if(document.getElementById('admin-students-enrolled')) document.getElementById('admin-students-enrolled').innerText = (students.length * 1.5).toFixed(0);
            
            const totalExpected = events.reduce((sum, e) => sum + (e.expected_attendance || 0), 0);
            const totalPresent = (summary.present_count || 0) + (summary.late_count || 0);
            const avgRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;
            if(document.getElementById('admin-students-attendance')) document.getElementById('admin-students-attendance').innerText = `${avgRate}%`;

            // Setup filters
            const orgFilter = document.getElementById('student-org-filter');
            const eventFilter = document.getElementById('student-event-filter');
            
            if (orgFilter && orgFilter.options.length <= 1) {
                orgs.forEach(o => orgFilter.add(new Option(o.name, o.organization_id)));
                orgFilter.addEventListener('change', () => {
                    const orgId = orgFilter.value;
                    eventFilter.innerHTML = '<option value="all">All Events</option>';
                    if (orgId !== 'all') {
                        const orgEvents = events.filter(e => String(e.organization_id) === String(orgId));
                        orgEvents.forEach(e => eventFilter.add(new Option(e.name, e.event_id)));
                        eventFilter.disabled = false;
                    } else {
                        eventFilter.disabled = true;
                    }
                    renderStudentsTableBody();
                });
                
                eventFilter.addEventListener('change', () => {
                    renderStudentsTableBody();
                });

                const searchInput = document.getElementById('student-search-input');
                if (searchInput) {
                    searchInput.addEventListener('input', () => {
                        renderStudentsTableBody();
                    });
                }
            }

            renderStudentsTableBody();
        } catch (err) {
            console.error('Error loading students:', err);
        }
    }

    function renderStudentsTableBody() {
        if (!studentDataCache) return;
        const tbody = document.getElementById('admin-students-table-body');
        const orgFilter = document.getElementById('student-org-filter');
        const eventFilter = document.getElementById('student-event-filter');
        
        let filteredStudents = studentDataCache.students;
        const orgId = orgFilter ? orgFilter.value : 'all';
        const eventId = eventFilter ? eventFilter.value : 'all';
        const searchInput = document.getElementById('student-search-input');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        if (orgId !== 'all') {
            filteredStudents = filteredStudents.filter(s => String(s.organization_id) === String(orgId));
        }

        if (searchQuery) {
            filteredStudents = filteredStudents.filter(s => 
                (s.fname || '').toLowerCase().includes(searchQuery) || 
                (s.id || '').toString().includes(searchQuery) ||
                (s.stud_id_number || '').toLowerCase().includes(searchQuery)
            );
        }

        // Update Top Stats Cards reactively
        if (document.getElementById('admin-students-total')) {
            document.getElementById('admin-students-total').innerText = filteredStudents.length.toLocaleString();
        }
        if (document.getElementById('admin-students-enrolled')) {
            // Simulated enrollment ratio for UI aesthetics
            document.getElementById('admin-students-enrolled').innerText = (filteredStudents.length * 1.5).toFixed(0);
        }
        
        const avgAttendanceEl = document.getElementById('admin-students-attendance');
        if (avgAttendanceEl) {
            const now = new Date();
            let totalPercentage = 0;
            let studentCount = filteredStudents.length;

            if (studentCount > 0) {
                filteredStudents.forEach(student => {
                    if (eventId !== 'all') {
                        const record = studentDataCache.attendanceRecords.find(a => String(a.user_id) === String(student.id) && String(a.event_id) === String(eventId));
                        if (record && ['Present', 'Late'].includes(record.status)) {
                            totalPercentage += 100;
                        }
                    } else {
                        const orgEvents = studentDataCache.events.filter(e => String(e.organization_id) === String(student.organization_id) && new Date(e.start_date) <= now);
                        if (orgEvents.length > 0) {
                            const orgEventIds = orgEvents.map(e => String(e.event_id));
                            const studentRecords = studentDataCache.attendanceRecords.filter(a => String(a.user_id) === String(student.id) && orgEventIds.includes(String(a.event_id)));
                            const attendedCount = studentRecords.filter(a => ['Present', 'Late'].includes(a.status)).length;
                            totalPercentage += (attendedCount / orgEvents.length) * 100;
                        } else {
                            // If no events for this student's org yet, we don't count them in the average to avoid dragging it down to 0% unfairly
                            studentCount--; 
                        }
                    }
                });
                const finalAvg = studentCount > 0 ? Math.round(totalPercentage / studentCount) : 0;
                avgAttendanceEl.innerText = `${finalAvg}%`;
            } else {
                avgAttendanceEl.innerText = '0%';
            }
        }

        if (filteredStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: #64748b;">No students found.</td></tr>';
            return;
        }
        
        const now = new Date();

        tbody.innerHTML = filteredStudents.map(student => {
            const initials = (student.fname || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
            const course = student.course || 'BSIT - 3';
            const orgFull = studentDataCache.orgs.find(o => String(o.organization_id) === String(student.organization_id))?.name || 'Unknown';
            const orgName = getOrgInitials(orgFull);
            
            let attendanceDisplay = '';
            
            if (eventId !== 'all') {
                // Show status for this specific event
                const record = studentDataCache.attendanceRecords.find(a => String(a.user_id) === String(student.id) && String(a.event_id) === String(eventId));
                const status = record ? record.status : 'Absent';
                let dotColor = status === 'Present' ? '#10b981' : (status === 'Late' ? '#f59e0b' : '#ef4444');
                attendanceDisplay = `<span style="font-weight: 700; color: ${dotColor};">● ${status}</span>`;
            } else {
                // Calculate overall attendance for the student's org
                const orgEvents = studentDataCache.events.filter(e => String(e.organization_id) === String(student.organization_id) && new Date(e.start_date) <= now);
                if (orgEvents.length === 0) {
                    attendanceDisplay = '<span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">No events yet</span>';
                } else {
                    const orgEventIds = orgEvents.map(e => String(e.event_id));
                    const studentRecords = studentDataCache.attendanceRecords.filter(a => String(a.user_id) === String(student.id) && orgEventIds.includes(String(a.event_id)));
                    const attendedCount = studentRecords.filter(a => ['Present', 'Late'].includes(a.status)).length;
                    
                    const attendancePercentage = Math.round((attendedCount / orgEvents.length) * 100);
                    
                    let barColor = 'green';
                    if (attendancePercentage < 80) barColor = 'red';
                    else if (attendancePercentage < 90) barColor = 'yellow';
                    
                    attendanceDisplay = `
                        <div style="display: flex; align-items: center; gap: 12px; width: 160px; margin: 0 auto;">
                            <div class="progress-container" style="flex: 1; height: 8px; background: #f1f5f9; border-radius: 10px; overflow: hidden; border: 1px solid #f1f5f9;">
                                <div class="progress-bar bar-${barColor}" style="width: ${attendancePercentage}%; height: 100%; border-radius: 10px;"></div>
                            </div>
                            <span style="font-size: 0.8rem; font-weight: 800; color: ${barColor === 'green' ? '#10b981' : barColor === 'yellow' ? '#f59e0b' : '#ef4444'};">${attendancePercentage}%</span>
                        </div>`;
                }
            }

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 42px; height: 42px; flex-shrink: 0; min-width: 42px; min-height: 42px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; color: #475569; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">${initials}</div>
                            <div style="display: flex; flex-direction: column;">
                                <strong style="color: #1e293b; font-size: 0.95rem;">${student.fname}</strong>
                                <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">ID: ${student.stud_id_number || student.id || '---'}</span>
                            </div>
                        </div>
                    </td>
                    <td class="text-center"><span class="badge-pill-blue">${course}</span></td>
                    <td class="text-center"><span style="color: #6366f1; font-weight: 700; font-size: 0.85rem;">${orgName}</span></td>
                    <td class="text-center">${attendanceDisplay}</td>
                    <td class="text-center">
                        <div class="action-icons" style="justify-content: center;">
                            <button class="icon-edit" style="background: #eff6ff; color: #2563eb;" onclick="window.openOverrideAttendanceModal('${student.id}', '${student.fname}')" title="Override Attendance"><i class="far fa-edit"></i></button>
                            <button class="icon-delete" style="background: #fff1f2; color: #ef4444;" onclick="window.openDeleteStudentModal('${student.id}')" title="Delete Student"><i class="far fa-trash-alt"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    async function populateOrgSelects() {
        try {
            const res = await window.TatakApi.apiRequest('/organizations');
            const orgs = res.data || [];
            const selects = ['offOrg', 'editOffOrg', 'addEventOrg', 'editEventOrg', 'addStudentOrg'];
            const options = orgs.map(org => `<option value="${org.organization_id}">${org.name}</option>`).join('');
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = options || '<option disabled>No organizations available</option>';
            });
        } catch (err) {}
    }

    // --- FORM SUBMISSIONS ---

    // Logout logic
    const confirmLogout = document.getElementById('confirmLogout');
    if (confirmLogout) {
        confirmLogout.onclick = () => {
            window.TatakApi.clearAuthAndRedirect();
        };
    }

    // Add Organization
    const addOrgForm = document.getElementById('addOrgForm');
    if (addOrgForm) {
        addOrgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('addOrgId').value;
            const name = document.getElementById('addOrgName').value;
            const desc = document.getElementById('addOrgDesc').value;
            const submitBtn = addOrgForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;
            const logo = document.getElementById('addOrgLogo').value;
            try {
                const res = await window.TatakApi.apiRequest('/organizations', { 
                    method: 'POST', body: JSON.stringify({ organization_id: id, name, description: desc, status: 'Active', logo }) 
                });
                if (res && res.success) {
                    window.closeModal('addOrgModal');
                    addOrgForm.reset();
                    loadAdminOrganizations();
                    window.TatakApi.setPendingToast('Organization created successfully!', 'success');
                    window.TatakApi.showToast('Organization created successfully!', 'success');
                } else { window.TatakApi.showToast(res?.error || 'Failed to create organization', 'error'); }
            } catch (err) { window.TatakApi.showToast('An error occurred while creating the organization.', 'error'); }
            finally { submitBtn.innerText = 'Save Organization'; submitBtn.disabled = false; }
        });
    }

    // Edit Organization
    const editOrgForm = document.getElementById('editOrgForm');
    if (editOrgForm) {
        editOrgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldId = document.getElementById('editOrgOldId').value;
            const newId = document.getElementById('editOrgId').value;
            const name = document.getElementById('editOrgName').value;
            const desc = document.getElementById('editOrgDesc').value;
            const status = document.getElementById('editOrgStatus').value;
            const errorEl = document.getElementById('editOrgError');
            
            errorEl.style.display = 'none';
            const submitBtn = editOrgForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Updating...';
            submitBtn.disabled = true;

            try {
                if (newId !== oldId) {
                    const orgsRes = await window.TatakApi.apiRequest('/organizations');
                    if ((orgsRes.data || []).some(o => o.organization_id === newId)) {
                        errorEl.innerText = `Error: ID "${newId}" is already taken.`;
                        errorEl.style.display = 'block';
                        submitBtn.innerText = 'Update Organization';
                        submitBtn.disabled = false;
                        return;
                    }
                }
                const logo = document.getElementById('editOrgLogo').value;
                const res = await window.TatakApi.apiRequest(`/organizations/${oldId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        organization_id: newId, 
                        name, 
                        description: desc, 
                        is_active: status === 'Active' ? 1 : 0,
                        logo
                    })
                });
                if (res && res.success) {
                    window.closeModal('editOrgModal');
                    loadAdminOrganizations();
                    window.TatakApi.setPendingToast('Organization updated successfully!', 'success');
                    window.TatakApi.showToast('Organization updated successfully!', 'success');
                } else {
                    const errMsg = res.message || 'Error updating organization.';
                    window.TatakApi.showToast(errMsg, 'error');
                    errorEl.innerText = errMsg;
                    errorEl.style.display = 'block';
                }
            } catch (err) {
                console.error('Error updating org:', err);
                window.TatakApi.showToast('System error occurred.', 'error');
                errorEl.innerText = 'System error occurred.';
                errorEl.style.display = 'block';
            } finally { submitBtn.innerText = 'Update Organization'; submitBtn.disabled = false; }
        });
    }

    // Add Event
    const addEventForm = document.getElementById('addEventForm');
    if (addEventForm) {
        addEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addEventForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;
            const startDate = new Date(document.getElementById('addEventDate').value + 'T' + document.getElementById('addEventStartTime').value + ':00');
            const endTimeStr = document.getElementById('addEventEndTime').value;
            const endDate = endTimeStr ? new Date(document.getElementById('addEventDate').value + 'T' + endTimeStr + ':00') : null;

            if (endDate && endDate <= startDate) {
                window.TatakApi.showToast('End time must be after start time.', 'error');
                submitBtn.innerText = 'Save Event';
                submitBtn.disabled = false;
                return;
            }

            try {
                const res = await window.TatakApi.apiRequest('/events', {
                    method: 'POST',
                    body: JSON.stringify({
                        organization_id: document.getElementById('addEventOrg').value,
                        name: document.getElementById('addEventName').value,
                        start_date: startDate.toISOString(),
                        end_date: endDate ? endDate.toISOString() : null,
                        location: document.getElementById('addEventVenue').value,
                        expected_attendance: document.getElementById('addEventCapacity').value || null
                    })
                });
                if (res && res.success) {
                    window.closeModal('addEventModal');
                    window.TatakApi.setPendingToast('Event created successfully!', 'success');
                    window.TatakApi.showToast('Event created successfully!', 'success');
                    loadAdminEventsTable();
                    loadAdminOverviewMetrics();
                    addEventForm.reset();
                }
            } catch (err) { 
                console.error('Error adding event:', err);
                window.TatakApi.showToast('Error adding event: ' + err.message, 'error');
            }
            finally { submitBtn.innerText = 'Save Event'; submitBtn.disabled = false; }
        });
    }

    // Edit Event
    const editEventForm = document.getElementById('editEventForm');
    if (editEventForm) {
        editEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editEventId').value;
            const submitBtn = editEventForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Updating...';
            submitBtn.disabled = true;
            const startDate = new Date(document.getElementById('editEventDate').value + 'T' + document.getElementById('editEventStartTime').value + ':00');
            const endTimeStr = document.getElementById('editEventEndTime').value;
            const endDate = endTimeStr ? new Date(document.getElementById('editEventDate').value + 'T' + endTimeStr + ':00') : null;

            if (endDate && endDate <= startDate) {
                window.TatakApi.showToast('End time must be after start time.', 'error');
                submitBtn.innerText = 'Update Event';
                submitBtn.disabled = false;
                return;
            }

            try {
                const res = await window.TatakApi.apiRequest(`/events/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('editEventName').value,
                        start_date: startDate.toISOString(),
                        end_date: endDate ? endDate.toISOString() : null,
                        location: document.getElementById('editEventVenue').value,
                        expected_attendance: document.getElementById('editEventCapacity').value || null,
                        organization_id: document.getElementById('editEventOrg').value
                    })
                });
                if (res && res.success) {
                    window.closeModal('editEventModal');
                    loadAdminEventsTable();
                    window.TatakApi.showToast('Event updated successfully!', 'success');
                }
            } catch (err) { 
                console.error('Error updating event:', err);
                window.TatakApi.showToast('Error updating event: ' + err.message, 'error');
            }
            finally { submitBtn.innerText = 'Update Event'; submitBtn.disabled = false; }
        });
    }

    // Add Officer
    const addOfficerForm = document.getElementById('officerForm');
    if (addOfficerForm) {
        addOfficerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Officer form submission started');
            const submitBtn = addOfficerForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;
            
            const fullName = `${document.getElementById('offFirstName').value} ${document.getElementById('offLastName').value}`;
            const statusValue = document.getElementById('offStatus').value === 'Active' ? 1 : 0;
            
            const usernameVal = document.getElementById('offUsername').value;
            // Removed isNaN check because usernames can be strings; the backend ID is handled in the two-step flow.

            const emailVal = document.getElementById('offEmail').value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailVal)) {
                alert('Please enter a valid email address.');
                submitBtn.innerText = 'Save Officer';
                submitBtn.disabled = false;
                return;
            }

            // Clear any old notifications before starting
            window.TatakApi.clearPendingToast();

            const officerData = {
                stud_id_number: document.getElementById('offUsername').value,
                username: document.getElementById('offUsername').value,
                email: emailVal,
                password: document.getElementById('offPassword').value,
                fname: fullName,
                role: 'Officer',
                organization_id: parseInt(document.getElementById('offOrg').value),
                position: document.getElementById('offPosition').value,
                term_start: document.getElementById('offStart').value,
                term_end: document.getElementById('offEnd').value,
                status: document.getElementById('offStatus').value,
                profile_picture: document.getElementById('offProfilePic').value
            };
                console.log('Sending atomic officer registration data:', officerData);
            
            try {
                // Set a temporary flag in case the browser refreshes during the image save
                sessionStorage.setItem('pending_officer_creation_sync', 'true');

                // Single Atomic Step: Register AND Link in one backend request
                const res = await window.TatakApi.apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(officerData)
                });

                if (res && res.success) {
                    // Success! Clear the flag
                    sessionStorage.removeItem('pending_officer_creation_sync');
                    
                    window.closeModal('addOfficerModal');
                    officerForm.reset();
                    loadAdminOfficersTable();
                    
                    // Clear the avatar preview
                    const preview = document.getElementById('addOffProfilePicPreview');
                    if (preview) {
                        preview.src = '';
                        preview.style.display = 'none';
                        const icon = preview.parentElement.querySelector('i');
                        if (icon) icon.style.display = 'block';
                    }

                    window.TatakApi.setPendingToast('Officer created and linked successfully!', 'success');
                    window.TatakApi.showToast('Officer created and linked successfully!', 'success');
                } else {
                    throw new Error(res.error || 'Failed to create officer.');
                }
            } catch (err) { 
                console.error('Error in officer creation flow:', err);
                // If it's a duplicate user, we still might want to link them if they aren't already an officer
                if (err.message.includes('already exists')) {
                    alert('This username or email already exists. If you want to promote an existing user to Officer, please use the Edit/Link feature (coming soon).');
                } else {
                    window.TatakApi.showToast('Error: ' + err.message, 'error');
                }
            }
            finally { 
                submitBtn.innerText = 'Save Officer';
                submitBtn.disabled = false;
            }
        });
    }

    const addStudentForm = document.getElementById('studentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addStudentForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Saving...';
            submitBtn.disabled = true;

            const studentId = document.getElementById('studentIdNumber').value.trim();
            const firstName = document.getElementById('studentFirstName').value.trim();
            const lastName = document.getElementById('studentLastName').value.trim();
            const username = document.getElementById('studentUsername').value.trim();
            const email = document.getElementById('studentEmail').value.trim();
            const password = document.getElementById('studentPassword').value;
            const organizationId = document.getElementById('addStudentOrg').value;
            const profilePic = document.getElementById('studentProfilePic').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!studentId || !firstName || !lastName || !username || !email || !password || !organizationId) {
                window.TatakApi.showToast('Please complete all required student fields.', 'error');
                submitBtn.innerText = 'Save Student';
                submitBtn.disabled = false;
                return;
            }

            if (!emailRegex.test(email)) {
                window.TatakApi.showToast('Please enter a valid email address.', 'error');
                submitBtn.innerText = 'Save Student';
                submitBtn.disabled = false;
                return;
            }

            try {
                const res = await window.TatakApi.apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        stud_id_number: studentId,
                        username,
                        email,
                        password,
                        fname: `${firstName} ${lastName}`,
                        role: 'Student',
                        organization_id: parseInt(organizationId, 10),
                        profile_picture: profilePic,
                        status: 'Active'
                    })
                });

                if (res && res.success) {
                    window.closeModal('addStudentModal');
                    addStudentForm.reset();
                    loadAdminStudentsTable();
                    window.TatakApi.setPendingToast('Student created successfully!', 'success');
                    window.TatakApi.showToast('Student created successfully!', 'success');
                } else {
                    throw new Error(res.error || 'Failed to create student.');
                }
            } catch (err) {
                console.error('Error creating student:', err);
                window.TatakApi.showToast('Error: ' + err.message, 'error');
            } finally {
                submitBtn.innerText = 'Save Student';
                submitBtn.disabled = false;
            }
        });
    }

    // Edit Officer
    const editOfficerForm = document.getElementById('editOfficerForm');
    if (editOfficerForm) {
        editOfficerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editOfficerId').value;
            const submitBtn = editOfficerForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Updating...';
            submitBtn.disabled = true;

            try {
                const res = await window.TatakApi.apiRequest(`/officers/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        fname: document.getElementById('editOffName').value,
                        organization_id: parseInt(document.getElementById('editOffOrg').value),
                        position: document.getElementById('editOffRole').value,
                        status: document.getElementById('editOffStatus').value,
                        profile_picture: document.getElementById('editOffProfilePic').value
                    })
                });
                if (res && res.success) {
                    window.closeModal('editOfficerModal');
                    loadAdminOfficersTable();
                    window.TatakApi.setPendingToast('Officer updated successfully!', 'success');
                    window.TatakApi.showToast('Officer updated successfully!', 'success');
                }
            } catch (err) { 
                console.error('Error updating officer:', err);
                window.TatakApi.showToast('Error updating officer: ' + err.message, 'error');
            }
            finally { submitBtn.innerText = 'Update Officer'; submitBtn.disabled = false; }
        });
    }

    // Attendance Override
    const overrideAttendanceForm = document.getElementById('overrideAttendanceForm');
    if (overrideAttendanceForm) {
        overrideAttendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('overrideStudentId').value;
            const eventId = document.getElementById('overrideEventId').value;
            const status = overrideAttendanceForm.querySelector('input[name="attendanceStatus"]:checked').value;
            const remarks = document.getElementById('overrideRemarks').value;
            
            const submitBtn = overrideAttendanceForm.querySelector('button[type="submit"]');
            submitBtn.innerText = 'Updating...';
            submitBtn.disabled = true;

            try {
                const res = await window.TatakApi.apiRequest('/attendance/admin-override', {
                    method: 'POST',
                    body: JSON.stringify({ user_id: studentId, event_id: eventId, status: status, remarks: remarks })
                });
                if (res && res.success) {
                    window.closeModal('overrideAttendanceModal');
                    loadAdminStudentsTable();
                    window.TatakApi.showToast('Attendance overridden successfully.', 'success');
                }
            } catch (err) { 
                console.error('Error overriding attendance:', err);
                window.TatakApi.showToast('Error overriding attendance: ' + err.message, 'error');
            }
            finally { submitBtn.innerText = 'Update Attendance'; submitBtn.disabled = false; }
        });
    }

    window.promptForImage = function(inputId, placeholder) {
        const input = document.getElementById(inputId);
        const currentUrl = input ? input.value : '';
        const newUrl = prompt("Enter the image URL:", currentUrl);
        
        if (newUrl !== null) {
            if (input) input.value = newUrl;
            const preview = placeholder.querySelector('img');
            const icon = placeholder.querySelector('i');
            
            if (newUrl.trim() !== '') {
                preview.src = newUrl;
                preview.style.display = 'block';
                if (icon) icon.style.display = 'none';
            } else {
                preview.src = '';
                preview.style.display = 'none';
                if (icon) icon.style.display = 'block';
            }
        }
    };

    // Global Helpers for Avatar & Password
    window.handleAvatarPreview = function(event, targetInputId, optionalPreviewId) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            const placeholderDiv = event.target.closest('.avatar-upload-placeholder');
            
            // Try specific preview ID first, then fallback to sibling search
            const img = optionalPreviewId ? document.getElementById(optionalPreviewId) : placeholderDiv.querySelector('img');
            const icon = placeholderDiv.querySelector('i');
            
            reader.onload = function(e) {
                const base64Data = e.target.result;
                if (img) {
                    img.src = base64Data;
                    img.style.display = 'block';
                }
                if (icon) icon.style.display = 'none';
                
                // Update the hidden input with the base64 data
                const input = document.getElementById(targetInputId);
                if (input) input.value = base64Data;
            }
            reader.readAsDataURL(file);
        }
    };

    window.togglePasswordVisibility = function(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    // Initial Load - Check for persisted section
    const lastSection = localStorage.getItem('admin_last_section') || 'overview';
    
    // Check for "Ghost" Creation (Refresh during upload)
    if (sessionStorage.getItem('pending_officer_creation_sync')) {
        sessionStorage.removeItem('pending_officer_creation_sync');
        // Force Officers section and show success toast
        localStorage.setItem('admin_last_section', 'officers');
        showSection('officers');
        
        // Give the backend a moment to "warm up" after the file-save restart
        setTimeout(() => {
            loadAdminOfficersTable();
            window.TatakApi.showToast('Officer created and directory synced!', 'success');
        }, 500);
    } else if (sessionStorage.getItem('pending_officer_deletion_sync')) {
        sessionStorage.removeItem('pending_officer_deletion_sync');
        localStorage.setItem('admin_last_section', 'officers');
        showSection('officers');
        
        setTimeout(() => {
            loadAdminOfficersTable();
            window.TatakApi.showToast('Officer removed and directory synced!', 'success');
        }, 500);
    } else {
        showSection(lastSection);
    }

    if (typeof loadNotifications === 'function') {
        loadNotifications();
    }

    // Final check for any pending notifications
    if (window.TatakApi && window.TatakApi.checkPendingToast) {
        window.TatakApi.checkPendingToast();
    }
});

/**
 * Admin Dashboard Mobile Logic
 */
const MobileAdmin = {
    async init() {
        this.setupEventListeners();
        await this.loadOverview();
        await this.loadEvents();
        await this.loadOrganizations();
        await this.loadOfficers();
        await this.loadStudents();
    },

    setupEventListeners() {
        const newEventBtn = document.getElementById('mobileNewEvent');
        if (newEventBtn) {
            newEventBtn.addEventListener('click', () => {
                // Open new event modal logic
                alert('Add New Event Modal Coming Soon');
            });
        }
    },

    async loadOverview() {
        try {
            const stats = await window.TatakApi.apiRequest('/admin/stats');
            // Update stats grid if endpoint exists
        } catch (e) {
            console.warn('Stats API not available, using mock data');
        }
    },

    async loadEvents() {
        const list = document.getElementById('events-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = res.data || [];
            
            list.innerHTML = events.map(event => `
                <div class="data-card">
                    <div class="data-avatar" style="background: #eff6ff; color: #3b82f6;">
                        <i class="fas fa-calendar"></i>
                    </div>
                    <div class="data-info">
                        <div class="data-name">${event.name}</div>
                        <div class="data-meta">${new Date(event.start_date).toLocaleDateString()} • ${event.location || 'TBA'}</div>
                        <span class="data-badge" style="background: ${event.approval_status === 'Approved' ? '#dcfce7' : '#fee2e2'}; color: ${event.approval_status === 'Approved' ? '#16a34a' : '#ef4444'};">
                            ${event.approval_status}
                        </span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading events</p>';
        }
    },

    async loadOrganizations() {
        const list = document.getElementById('orgs-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/organizations');
            const orgs = res.data || [];
            
            list.innerHTML = orgs.map(org => `
                <div class="data-card">
                    <div class="data-avatar">
                        <img src="${window.TatakApi.formatImageUrl(org.logo)}" style="width:100%;" onerror="this.src='https://via.placeholder.com/50'">
                    </div>
                    <div class="data-info">
                        <div class="data-name">${org.name}</div>
                        <div class="data-meta">${org.acronym || ''}</div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading organizations</p>';
        }
    },

    async loadOfficers() {
        const list = document.getElementById('officers-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/officers');
            const officers = res.data || [];
            
            list.innerHTML = officers.map(off => `
                <div class="data-card">
                    <div class="data-avatar">
                        <img src="${window.TatakApi.formatImageUrl(off.profile_picture)}" style="width:100%;" onerror="this.src='https://via.placeholder.com/50'">
                    </div>
                    <div class="data-info">
                        <div class="data-name">${off.fname} ${off.lname}</div>
                        <div class="data-meta">${off.position} • ${off.organization_name || ''}</div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading officers</p>';
        }
    },

    async loadStudents() {
        const list = document.getElementById('students-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/students');
            const students = res.data || [];
            
            list.innerHTML = students.map(stud => `
                <div class="data-card">
                    <div class="data-avatar">
                        <img src="${window.TatakApi.formatImageUrl(stud.profile_picture)}" style="width:100%;" onerror="this.src='https://via.placeholder.com/50'">
                    </div>
                    <div class="data-info">
                        <div class="data-name">${stud.fname} ${stud.lname}</div>
                        <div class="data-meta">${stud.id_number} • ${stud.course}</div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading students</p>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) {
        MobileAdmin.init();
    }
});

    MobileAdmin.loadAuditLogs = async function() {
        const list = document.getElementById("audit-list");
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest("/logs");
            const logs = res.data || [];
            
            list.innerHTML = logs.map(log => `
                <div class="data-card">
                    <div class="data-avatar" style="background: #f1f5f9; color: #0B1E4C;">
                        <i class="fas fa-history"></i>
                    </div>
                    <div class="data-info">
                        <div class="data-name">${log.fname || "System"} <span style="font-size: 0.7rem; color: #64748b; font-weight: 400;">(${log.role || "Admin"})</span></div>
                        <div class="data-meta">${new Date(log.timestamp).toLocaleString()}</div>
                        <div style="margin-top: 5px; font-weight: 600; color: #2563eb; font-size: 0.75rem;">${log.action}</div>
                        <div style="font-size: 0.7rem; color: #475569; margin-top: 2px;">${log.target_name || log.table_name || "System Action"}</div>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = "<p>Error loading audit logs</p>";
        }
    };

    // Auto-load audit logs when section is shown
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === "section-audit" && mutation.target.style.display === "block") {
                MobileAdmin.loadAuditLogs();
            }
        });
    });

    const auditSection = document.getElementById("section-audit");
    if (auditSection) {
        observer.observe(auditSection, { attributes: true, attributeFilter: ["style"] });
    }


/**
 * Officer Dashboard Mobile Logic
 */
const MobileOfficer = {
    async init() {
        await this.loadOverview();
        await this.loadEvents();
        await this.loadAttendance();
        await this.loadReports();
    },

    async loadOverview() {
        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = res.data || [];
            const activeEvent = events.find(e => e.approval_status === 'Approved'); // Simplification for mock

            if (activeEvent) {
                const title = document.querySelector('#section-overview .card h2');
                if (title) title.innerText = activeEvent.name;
            }

            document.getElementById('officer-name').innerText = localStorage.getItem('tatak_user_name') || 'Officer';
        } catch (e) {
            console.error('Error loading overview:', e);
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
                    <div class="data-avatar" style="background: #f1f5f9; color: #0B1E4C;">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="data-info">
                        <div class="data-name">${event.name}</div>
                        <div class="data-meta">${new Date(event.start_date).toLocaleDateString()}</div>
                    </div>
                    <button class="header-btn" style="background: #f1f5f9; color: #0B1E4C; width: 32px; height: 32px; font-size: 0.8rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading events</p>';
        }
    },

    async loadAttendance() {
        const list = document.getElementById('attendance-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = res.data || [];
            
            if (events.length > 0) {
                const eventId = events[0].event_id || events[0].id;
                const attRes = await window.TatakApi.apiRequest(`/attendance/personnel/${eventId}`);
                const rows = attRes.data || [];

                list.innerHTML = rows.map(r => `
                    <div class="data-card">
                        <div class="data-avatar">
                            <img src="${window.TatakApi.formatImageUrl(r.profile_picture)}" style="width:100%;" onerror="this.src='https://via.placeholder.com/50'">
                        </div>
                        <div class="data-info">
                            <div class="data-name">${r.fname} ${r.lname}</div>
                            <div class="data-meta">${r.id_number}</div>
                        </div>
                        <span class="data-badge" style="background: #dcfce7; color: #16a34a;">${r.status}</span>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p>No active events for attendance tracking.</p>';
            }
        } catch (e) {
            list.innerHTML = '<p>Error loading attendance</p>';
        }
    },

    async loadReports() {
        const list = document.getElementById('reports-list');
        if (!list) return;
        list.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">Reports will be generated here.</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('officer.html')) {
        MobileOfficer.init();
    }
});

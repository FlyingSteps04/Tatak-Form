/**
 * Student Dashboard Mobile Logic
 */
const MobileStudent = {
    async init() {
        await this.loadOverview();
        await this.loadEvents();
        await this.loadHistory();
        await this.loadReports();
    },

    async loadOverview() {
        try {
            const history = await window.TatakApi.apiRequest('/attendance/users');
            const rows = history.data || [];
            const attended = rows.filter(r => r.status === 'Present' || r.status === 'Late').length;
            const missed = rows.filter(r => r.status === 'Absent').length;

            const attendedEl = document.querySelector('.stat-card:nth-child(1) .stat-value');
            const missedEl = document.querySelector('.stat-card:nth-child(2) .stat-value');

            if (attendedEl) attendedEl.innerText = attended;
            if (missedEl) missedEl.innerText = missed;

            // Recent activity
            const recent = document.getElementById('recent-activities');
            if (recent) {
                recent.innerHTML = rows.slice(0, 3).map(r => `
                    <div class="data-card">
                        <div class="data-avatar" style="background: ${r.status === 'Present' ? '#dcfce7' : '#fee2e2'}; color: ${r.status === 'Present' ? '#16a34a' : '#ef4444'};">
                            <i class="fas ${r.status === 'Present' ? 'fa-check' : 'fa-times'}"></i>
                        </div>
                        <div class="data-info">
                            <div class="data-name">${r.event_name}</div>
                            <div class="data-meta">${new Date(r.timestamp).toLocaleDateString()}</div>
                        </div>
                        <span class="data-badge" style="background: ${r.status === 'Present' ? '#dcfce7' : '#fee2e2'}; color: ${r.status === 'Present' ? '#16a34a' : '#ef4444'};">
                            ${r.status}
                        </span>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Error loading overview:', e);
        }
    },

    async loadEvents() {
        const list = document.getElementById('events-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/events');
            const events = (res.data || []).filter(e => e.approval_status === 'Approved');
            
            list.innerHTML = events.map(event => `
                <div class="card" style="padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <h4 style="font-weight: 700; color: #0B1E4C;">${event.name}</h4>
                        <span class="data-badge" style="background: #eff6ff; color: #3b82f6;">UPCOMING</span>
                    </div>
                    <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 15px;">
                        <i class="far fa-calendar-alt"></i> ${new Date(event.start_date).toLocaleDateString()} • <i class="fas fa-map-marker-alt"></i> ${event.location || 'TBA'}
                    </p>
                    <button class="btn-primary" style="padding: 8px; font-size: 0.8rem;">View Details</button>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading events</p>';
        }
    },

    async loadHistory() {
        const list = document.getElementById('history-list');
        if (!list) return;

        try {
            const res = await window.TatakApi.apiRequest('/attendance/users');
            const rows = res.data || [];
            
            list.innerHTML = rows.map(r => `
                <div class="data-card">
                    <div class="data-avatar" style="background: ${r.status === 'Present' ? '#dcfce7' : r.status === 'Late' ? '#fef3c7' : '#fee2e2'}; color: ${r.status === 'Present' ? '#16a34a' : r.status === 'Late' ? '#d97706' : '#ef4444'};">
                        <i class="fas ${r.status === 'Present' ? 'fa-check-circle' : r.status === 'Late' ? 'fa-clock' : 'fa-times-circle'}"></i>
                    </div>
                    <div class="data-info">
                        <div class="data-name">${r.event_name}</div>
                        <div class="data-meta">${new Date(r.timestamp).toLocaleDateString()} • ${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                    <span class="data-badge" style="background: ${r.status === 'Present' ? '#dcfce7' : r.status === 'Late' ? '#fef3c7' : '#fee2e2'}; color: ${r.status === 'Present' ? '#16a34a' : r.status === 'Late' ? '#d97706' : '#ef4444'}; font-weight: 800;">
                        ${r.status.toUpperCase()}
                    </span>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p>Error loading history</p>';
        }
    },

    async loadReports() {
        const list = document.getElementById('reports-list');
        if (!list) return;
        list.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">No certificates available yet.</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('student.html')) {
        MobileStudent.init();
    }
});

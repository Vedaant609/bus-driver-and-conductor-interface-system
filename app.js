const API_URL = 'http://localhost:5000/api';
const FARE_PER_KM = 2; // ₹2 per km

// =============== BUS CRASH ANIMATION ===============
function triggerBusCrash() {
    const container = document.querySelector('.bus-animation-container');
    const movingBus = document.querySelector('.moving-bus');
    if (!container || !movingBus) return;

    // Add crash class to trigger CSS animations
    container.classList.add('crash-active');

    // Create crash effects container
    const crashFx = document.createElement('div');
    crashFx.className = 'crash-effects';

    // Create sparks
    for (let i = 0; i < 12; i++) {
        const spark = document.createElement('div');
        spark.className = 'crash-spark';
        spark.style.setProperty('--spark-angle', `${Math.random() * 360}deg`);
        spark.style.setProperty('--spark-distance', `${40 + Math.random() * 80}px`);
        spark.style.setProperty('--spark-delay', `${Math.random() * 0.3}s`);
        spark.style.setProperty('--spark-size', `${3 + Math.random() * 5}px`);
        crashFx.appendChild(spark);
    }

    // Create debris pieces
    const debrisColors = ['#9333ea', '#6b21a8', '#eab308', '#c4b5fd', '#475569'];
    for (let i = 0; i < 8; i++) {
        const debris = document.createElement('div');
        debris.className = 'crash-debris';
        debris.style.setProperty('--debris-x', `${-60 + Math.random() * 120}px`);
        debris.style.setProperty('--debris-y', `${-30 + Math.random() * -80}px`);
        debris.style.setProperty('--debris-rot', `${Math.random() * 720}deg`);
        debris.style.setProperty('--debris-delay', `${Math.random() * 0.2}s`);
        debris.style.background = debrisColors[Math.floor(Math.random() * debrisColors.length)];
        crashFx.appendChild(debris);
    }

    // Create smoke cloud
    const smokeCloud = document.createElement('div');
    smokeCloud.className = 'crash-smoke-cloud';
    crashFx.appendChild(smokeCloud);

    // Create "CRASH!" text
    const crashText = document.createElement('div');
    crashText.className = 'crash-text';
    crashText.textContent = 'CRASH!';
    crashFx.appendChild(crashText);

    container.appendChild(crashFx);

    // Screen shake effect on the login card
    const loginCard = document.querySelector('.login-card');
    if (loginCard) loginCard.classList.add('screen-shake');

    // Reset everything after animation completes
    setTimeout(() => {
        container.classList.remove('crash-active');
        if (loginCard) loginCard.classList.remove('screen-shake');
        crashFx.remove();
    }, 3000);
}

// Distance map between consecutive stops (in km)
// Key format: "FromStop|ToStop" => distance in km
const DISTANCE_MAP = {
    // Route Alpha (Station A route)
    'Station A|Market Road': 6,
    'Market Road|City Park': 7,
    'City Park|Central Mall': 5,
    'Central Mall|River Side': 8,
    'River Side|Old Town': 6,
    'Old Town|University': 9,
    'University|Stadium': 7,
    'Stadium|Bus Depot': 5,
    'Bus Depot|Station A': 10,
    // Route Beta (Station B route)
    'Station B|Garden View': 6,
    'Garden View|Library': 7,
    'Library|Post Office': 5
};

// Build reverse map too (for bidirectional lookup)
Object.keys(DISTANCE_MAP).forEach(key => {
    const [a, b] = key.split('|');
    DISTANCE_MAP[`${b}|${a}`] = DISTANCE_MAP[key];
});

/**
 * Calculate total distance between two stops along the route.
 * Uses the distance map for known consecutive pairs,
 * falls back to a default of 5 km per segment for unknown pairs.
 */
function getRouteDistance(stops, fromIndex, toIndex) {
    if (fromIndex >= toIndex) return 0;
    let totalDistance = 0;
    for (let i = fromIndex; i < toIndex; i++) {
        const fromName = stops[i];
        const toName = stops[i + 1];
        const key = `${fromName}|${toName}`;
        totalDistance += DISTANCE_MAP[key] || 5; // default 5km if not in map
    }
    return totalDistance;
}

// =============== STATE MANAGEMENT ===============
let appState = {
    currentUser: JSON.parse(localStorage.getItem('transitProUser')) || null,
    theme: localStorage.getItem('transitProTheme') || 'dark',
    adminData: { routes: [], revenue: 0, tickets: 0, staffCount: 0, drivers: [], conductors: [] },
    busData: { bus_id: '', route_name: '', revenue: 0, stops: [], active_passengers: [] }
};

function saveUser() {
    if (appState.currentUser) {
        localStorage.setItem('transitProUser', JSON.stringify(appState.currentUser));
    } else {
        localStorage.removeItem('transitProUser');
    }
}

// =============== DOM ELEMENTS ===============
const themeToggleBtn = document.getElementById('theme-toggle');
const userInfo = document.getElementById('user-info');
const userRoleBadge = document.getElementById('user-role-badge');
const logoutBtn = document.getElementById('logout-btn');
const toastContainer = document.getElementById('toast-container');

const views = {
    login: document.getElementById('view-login'),
    admin: document.getElementById('view-admin'),
    conductor: document.getElementById('view-conductor'),
    driver: document.getElementById('view-driver')
};

const loginUsernameInput = document.getElementById('username');
const loginPasswordInput = document.getElementById('password');
const loginSubmitBtn = document.getElementById('login-submit');

// Admin Core
const statsElements = {
    revenue: document.getElementById('total-revenue'),
    tickets: document.getElementById('total-tickets'),
    staff: document.getElementById('total-staff')
};

// Admin Assignments & Analytics
const assignDate = document.getElementById('assign-date');
const assignRoute = document.getElementById('assign-route');
const assignDriver = document.getElementById('assign-driver');
const assignConductor = document.getElementById('assign-conductor');
const assignBusId = document.getElementById('assign-bus-id');
const assignBtn = document.getElementById('assign-btn');
const analyticsDate = document.getElementById('analytics-date');
const analyticsList = document.getElementById('analytics-list');

// Admin Directory Panels
const activeStaffCard = document.getElementById('active-staff-card');
const liveOpsPanel = document.getElementById('live-operations-panel');
const opsList = document.getElementById('operations-list');

const totalStaffCard = document.getElementById('total-staff-card');
const allStaffPanel = document.getElementById('all-staff-panel');
const allStaffList = document.getElementById('all-staff-list');

// Admin Form Actions
const addStaffName = document.getElementById('new-staff-name');
const addStaffUsername = document.getElementById('new-staff-username');
const addStaffPassword = document.getElementById('new-staff-password');
const addStaffRole = document.getElementById('new-staff-role');
const addStaffBtn = document.getElementById('add-staff-btn');

const openRouteModalBtn = document.getElementById('open-route-modal-btn');
const routeModal = document.getElementById('route-builder-modal');
const closeRouteModalBtn = document.getElementById('close-route-modal');

const builderRouteName = document.getElementById('builder-route-name');
const builderStopName = document.getElementById('builder-stop-name');
const addStopBtn = document.getElementById('add-stop-btn');
const builderStopsList = document.getElementById('builder-stops-list');
const emptyStopsMsg = document.getElementById('empty-stops-msg');
const saveRouteBtn = document.getElementById('save-route-btn');
let tempRouteStops = [];

// Conductor Elements
const conductorBusId = document.getElementById('conductor-bus');
const conductorRevenue = document.getElementById('conductor-revenue');
const conductorStopsContainer = document.getElementById('conductor-stops');
const conductorResetBtn = document.getElementById('conductor-reset-btn');

const adminResetModal = document.getElementById('admin-reset-modal');
const closeAdminResetModal = document.getElementById('close-admin-reset-modal');
const confirmAdminResetBtn = document.getElementById('confirm-admin-reset-btn');
const resetModalBusId = document.getElementById('reset-modal-bus-id');
const resetModalRouteId = document.getElementById('reset-modal-route-id');
const resetModalDriverId = document.getElementById('reset-modal-driver-id');
const resetModalConductorId = document.getElementById('reset-modal-conductor-id');
let currentResetBusId = null;

const tPassenger = document.getElementById('ticket-passenger');
const tPick = document.getElementById('ticket-pick');
const tDrop = document.getElementById('ticket-drop');
const tFare = document.getElementById('ticket-fare');
const tCount = document.getElementById('ticket-count');
const issueTicketBtn = document.getElementById('issue-ticket-btn');
const passCount = document.getElementById('passenger-count');
const passList = document.getElementById('active-passengers-list');

// Driver Elements
const driverBusId = document.getElementById('driver-bus');
const driverStopsContainer = document.getElementById('driver-stops');


// =============== INITIALIZATION ===============
function init() {
    lucide.createIcons();
    document.documentElement.setAttribute('data-theme', appState.theme);

    const today = new Date().toISOString().split('T')[0];
    if (assignDate) assignDate.value = today;
    if (analyticsDate) analyticsDate.value = today;

    if (appState.currentUser) {
        fetchData().then(() => {
            showView(appState.currentUser.role.toLowerCase());
            startPolling();
        });
    } else { showView('login'); }

    bindEvents();
}

let pollInterval;
let previousStateHash = '';
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(fetchData, 1500);
}

// =============== API CALLS ===============
async function fetchData() {
    if (!appState.currentUser) return;
    try {
        if (appState.currentUser.role === 'Admin') {
            const res = await fetch(`${API_URL}/admin/data`);
            const data = await res.json();
            appState.adminData.revenue = data.total_revenue;
            appState.adminData.tickets = data.total_tickets;
            appState.adminData.staffCount = data.total_staff;
            appState.adminData.routes = data.routes;
            updateAdminView();
            fetchAnalytics();

            if (appState.adminData.drivers.length === 0) fetchUsersForDropdowns();
            else populateAdminDropdowns();
            if (!liveOpsPanel.classList.contains('hidden')) fetchActiveStaff();
            if (!allStaffPanel.classList.contains('hidden')) fetchAllStaff();

        } else if (appState.currentUser.role === 'Conductor' || appState.currentUser.role === 'Driver') {
            const res = await fetch(`${API_URL}/sync?user_id=${appState.currentUser.id}&role=${appState.currentUser.role}`);
            const data = await res.json();

            if (data.error) appState.busData = { bus_id: "Off Duty", route_name: "Not Assigned", revenue: 0, stops: [], active_passengers: [] };
            else appState.busData = data;

            const currentHash = JSON.stringify(appState.busData);
            if (currentHash !== previousStateHash) {
                previousStateHash = currentHash;
                if (appState.currentUser.role === 'Conductor') updateConductorView();
                if (appState.currentUser.role === 'Driver') updateDriverView();
            }
        }
    } catch (e) { }
}

async function fetchUsersForDropdowns() {
    try {
        const ures = await fetch(`${API_URL}/admin/users`);
        const udata = await ures.json();
        appState.adminData.drivers = udata.drivers;
        appState.adminData.conductors = udata.conductors;
        populateAdminDropdowns();
    } catch (e) { }
}

async function fetchAnalytics() {
    if (!analyticsDate || !analyticsDate.value) return;
    try {
        const res = await fetch(`${API_URL}/admin/analytics?date=${analyticsDate.value}`);
        const data = await res.json();

        analyticsList.innerHTML = '';
        if (data.analytics.length === 0) {
            analyticsList.innerHTML = '<div class="text-muted" style="padding: 1rem;">No data found.</div>';
            return;
        }

        data.analytics.forEach(route => {
            const el = document.createElement('div');
            el.className = 'stop-item';
            el.innerHTML = `
                <div class="stop-info"><span class="stop-name">${route.route_name}</span></div>
                <div style="text-align: right;">
                    <div style="color: var(--green-success); font-weight: bold;">₹${route.revenue}</div>
                    <div class="text-muted">${route.ticket_count} tickets</div>
                </div>
            `;
            analyticsList.appendChild(el);
        });
    } catch (e) { }
}

async function fetchActiveStaff() {
    try {
        const res = await fetch(`${API_URL}/admin/active_staff`);
        const data = await res.json();
        opsList.innerHTML = '';
        if (data.active_operations.length === 0) {
            opsList.innerHTML = '<div class="text-muted" style="padding: 1rem;">No active buses right now.</div>';
            return;
        }
        data.active_operations.forEach(op => {
            const isComplete = op.is_complete;
            const resetBtnHTML = `<button class="btn btn-outline admin-reset-bus-btn" data-bus="${op.bus_id}" style="padding: 0.25rem 0.5rem; color: var(--yellow-primary); border-color: var(--yellow-primary); font-size: 0.8rem;">Reset</button>`;

            opsList.innerHTML += `
                <div class="stop-item">
                    <div class="stop-info">
                        <span class="stop-index" style="width: auto; border-radius: 8px; padding: 0 0.5rem; background: ${isComplete ? 'var(--green-success)' : 'var(--yellow-primary)'}; color: #000;">${op.bus_id}</span>
                        <div style="display:flex; flex-direction: column;">
                            <span class="stop-name">${op.route_name}</span>
                            <span class="text-muted" style="font-size: 0.9em;">Driver: ${op.driver || 'N/A'} | Cond: ${op.conductor || 'N/A'}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <i data-lucide="${isComplete ? 'check-circle' : 'activity'}" style="color: var(--green-success);"></i>
                        ${resetBtnHTML}
                    </div>
                </div>`;
        });
        document.querySelectorAll('.admin-reset-bus-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const busId = e.currentTarget.dataset.bus;
                openAdminResetModal(busId);
            });
        });
        lucide.createIcons();
    } catch (e) { }
}

async function fetchAllStaff() {
    try {
        const res = await fetch(`${API_URL}/admin/all_staff`);
        const data = await res.json();
        allStaffList.innerHTML = '';
        if (data.staff.length === 0) {
            allStaffList.innerHTML = '<div class="text-muted" style="padding: 1rem;">No staff found.</div>';
            return;
        }
        data.staff.forEach(s => {
            const assignmentState = s.bus_id ? `<span style="color: var(--green-success); font-weight: bold;">Active in ${s.bus_id}</span>` : `<span class="text-muted">Off Duty</span>`;
            const icon = s.role === 'Driver' ? 'steering-wheel' : 'ticket';
            allStaffList.innerHTML += `
                <div class="stop-item">
                    <div class="stop-info">
                        <div class="stat-icon" style="width: 40px; height: 40px;"><i data-lucide="${icon}"></i></div>
                        <div style="display:flex; flex-direction: column;">
                            <span class="stop-name">${s.full_name} <span class="text-muted" style="font-size: 0.8em; margin-left: 0.5rem;">[${s.username}]</span></span>
                            <span class="text-secondary" style="font-size: 0.9em;">${s.role} • ${assignmentState}</span>
                        </div>
                    </div>
                </div>`;
        });
        lucide.createIcons();
    } catch (e) { }
}

// =============== EVENT LISTENERS ===============
function bindEvents() {
    themeToggleBtn.addEventListener('click', () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', appState.theme);
        localStorage.setItem('transitProTheme', appState.theme);
    });

    loginSubmitBtn.addEventListener('click', async () => {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!username || !password) { showToast('Enter both ID and Password', 'error'); return; }

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Logging in...';
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                appState.currentUser = data.user;
                saveUser();
                await fetchData();
                showToast(`Welcome, ${data.user.full_name}`, 'success');
                loginPasswordInput.value = '';
                showView(appState.currentUser.role.toLowerCase());
                startPolling();
            } else { showToast(data.error, 'error'); triggerBusCrash(); }
        } catch (e) { showToast('Connection failed', 'error'); triggerBusCrash(); }
        finally { loginSubmitBtn.disabled = false; loginSubmitBtn.textContent = 'Login'; }
    });

    logoutBtn.addEventListener('click', () => {
        appState.currentUser = null;
        saveUser();
        if (pollInterval) clearInterval(pollInterval);
        lastDropdownStopsHash = '';
        currentRouteStopNames = [];
        previousStateHash = '';
        showView('login');
        showToast('Logged out', 'success');
    });

    // Admin Events
    if (analyticsDate) analyticsDate.addEventListener('change', fetchAnalytics);

    if (activeStaffCard) activeStaffCard.addEventListener('click', () => {
        liveOpsPanel.classList.toggle('hidden');
        if (!liveOpsPanel.classList.contains('hidden')) {
            opsList.innerHTML = '<div class="text-muted" style="padding: 1rem;">Loading...</div>';
            fetchActiveStaff();
        }
    });

    if (totalStaffCard) totalStaffCard.addEventListener('click', () => {
        allStaffPanel.classList.toggle('hidden');
        if (!allStaffPanel.classList.contains('hidden')) {
            allStaffList.innerHTML = '<div class="text-muted" style="padding: 1rem;">Loading...</div>';
            fetchAllStaff();
        }
    });

    if (assignBtn) assignBtn.addEventListener('click', async () => {
        const d = assignDate.value, r_id = assignRoute.value, b_id = assignBusId.value.trim().toUpperCase();
        const c_id = assignConductor.value, d_id = assignDriver.value;

        if (!d || !r_id || !b_id || !c_id || !d_id) { showToast('Fill all assignment fields completely', 'error'); return; }

        try {
            const res = await fetch(`${API_URL}/admin/assign`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: d, route_id: parseInt(r_id), bus_id: b_id, driver_id: parseInt(d_id), conductor_id: parseInt(c_id) })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Assignment Locked!`, 'success');
                assignBusId.value = '';
                fetchData();
            } else showToast(data.error, 'error');
        } catch (e) { }
    });

    // Admin Add Staff
    if (addStaffBtn) addStaffBtn.addEventListener('click', async () => {
        const fname = addStaffName.value.trim();
        const uname = addStaffUsername.value.trim();
        const pwd = addStaffPassword.value.trim();
        const role = addStaffRole.value;

        if (!fname || !uname || !pwd || !role) { showToast('Fill all staff fields', 'error'); return; }
        try {
            const res = await fetch(`${API_URL}/admin/staff`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fname, username: uname, password: pwd, role: role })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Staff ${fname} Added!`, 'success');
                addStaffName.value = '';
                addStaffUsername.value = '';
                addStaffPassword.value = '';
                appState.adminData.drivers = []; // force reload dropdowns
                fetchData();
            } else showToast(data.error, 'error');
        } catch (e) { }
    });

    // Route Builder Modal Toggle
    if (openRouteModalBtn) {
        openRouteModalBtn.addEventListener('click', () => {
            tempRouteStops = [];
            builderRouteName.value = '';
            builderStopName.value = '';
            renderBuilderStops();
            routeModal.classList.add('active');
        });
    }

    if (closeRouteModalBtn) closeRouteModalBtn.addEventListener('click', () => routeModal.classList.remove('active'));

    if (closeAdminResetModal) closeAdminResetModal.addEventListener('click', () => adminResetModal.classList.remove('active'));
    if (confirmAdminResetBtn) confirmAdminResetBtn.addEventListener('click', async () => {
        if (!currentResetBusId) return;
        
        let newRouteId = resetModalRouteId.value;
        let isReversed = false;
        
        if (newRouteId === "REVERSE") {
            newRouteId = null;
            isReversed = true;
        } else if (newRouteId === "") {
            newRouteId = null;
            isReversed = false;
        } else {
            newRouteId = parseInt(newRouteId);
            isReversed = false;
        }

        const newDriverId = resetModalDriverId.value ? parseInt(resetModalDriverId.value) : null;
        const newConductorId = resetModalConductorId.value ? parseInt(resetModalConductorId.value) : null;
        try {
            const res = await fetch(`${API_URL}/admin/reset_bus`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bus_id: currentResetBusId, route_id: newRouteId, driver_id: newDriverId, conductor_id: newConductorId, is_reversed: isReversed })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Bus ${currentResetBusId} Reset!`, 'success');
                adminResetModal.classList.remove('active');
                if (!liveOpsPanel.classList.contains('hidden')) fetchActiveStaff();
                fetchData();
            } else showToast(data.error, 'error');
        } catch (e) { }
    });

    if (routeModal) {
        routeModal.addEventListener('click', (e) => {
            if (e.target === routeModal) routeModal.classList.remove('active');
        });
    }

    if (addStopBtn) addStopBtn.addEventListener('click', () => {
        const val = builderStopName.value.trim();
        if (val) {
            tempRouteStops.push(val);
            renderBuilderStops();
            builderStopName.value = '';
            builderStopName.focus();
        }
    });

    if (builderStopName) builderStopName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addStopBtn.click();
        }
    });

    if (saveRouteBtn) saveRouteBtn.addEventListener('click', async () => {
        const rName = builderRouteName.value.trim();
        if (!rName) { showToast('Enter a Route Name', 'error'); return; }
        if (tempRouteStops.length < 2) { showToast('A route needs at least 2 stops', 'error'); return; }

        try {
            const res = await fetch(`${API_URL}/admin/route`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: rName, stops: tempRouteStops })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Route saved successfully!', 'success');
                routeModal.classList.remove('active');

                // Clear and force reload routes in assignment dropdown
                assignRoute.innerHTML = '<option value="">Select Route</option>';
                appState.adminData.routes = [];
                fetchData();
            } else showToast(data.error, 'error');
        } catch (e) { }
    });

    if (conductorResetBtn) conductorResetBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to reverse the route and start a new journey? This will complete all active tickets.")) return;
        try {
            const res = await fetch(`${API_URL}/action/reset_journey`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: appState.currentUser.id })
            });
            const data = await res.json();
            if (data.success) { showToast('Route Reversed & Reset!', 'success'); fetchData(); }
            else showToast(data.error, 'error');
        } catch (e) { }
    });

    // Conductor Ticketing
    if (issueTicketBtn) issueTicketBtn.addEventListener('click', async () => {
        if (!tPassenger.value || !tPick.value || !tDrop.value || !tFare.value) { showToast('Please fill out all fields', 'error'); return; }
        try {
            const count = tCount ? (parseInt(tCount.value) || 1) : 1;
            const singleFare = parseFloat(tFare.value) / count;
            const payload = {
                user_id: appState.currentUser.id, passenger_name: tPassenger.value,
                pick_stop_index: tPick.value, drop_stop_index: tDrop.value,
                fare: singleFare, ticket_count: count
            };
            const res = await fetch(`${API_URL}/action/ticket`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Tickets Booked!`, 'success');
                tPassenger.value = '';
                if (tCount) tCount.value = 1;
                calculateFare();
                fetchData();
            } else { showToast(data.error, 'error'); }
        } catch (e) { }
    });
}

// Route Builder DOM function
function renderBuilderStops() {
    if (!builderStopsList) return;
    builderStopsList.innerHTML = '';

    if (tempRouteStops.length === 0) {
        if (emptyStopsMsg) builderStopsList.appendChild(emptyStopsMsg);
        return;
    }

    tempRouteStops.forEach((stop, index) => {
        const item = document.createElement('div');
        item.className = 'stop-item';
        item.style.padding = '0.75rem';
        item.innerHTML = `
            <div class="stop-info">
                <span class="stop-index" style="width: 25px; height: 25px; font-size: 0.8rem;">${index + 1}</span>
                <span class="stop-name" style="font-size: 1rem;">${stop}</span>
            </div>
            <button class="btn-icon" data-index="${index}" style="color: var(--red-alert);"><i data-lucide="trash-2"></i></button>
        `;
        builderStopsList.appendChild(item);
    });

    builderStopsList.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            tempRouteStops.splice(idx, 1);
            renderBuilderStops();
        });
    });
    lucide.createIcons();
}

function attachCancelListeners() {
    document.querySelectorAll('.cancel-tkt-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const tid = e.target.closest('button').dataset.id;
            try {
                const res = await fetch(`${API_URL}/action/cancel_ticket`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: appState.currentUser.id, ticket_id: tid })
                });
                const data = await res.json();
                if (data.success) { showToast('Ticket Cancelled', 'error'); fetchData(); }
                else showToast(data.error, 'error');
            } catch (e) { }
        });
    });
}

function openAdminResetModal(busId) {
    currentResetBusId = busId;
    resetModalBusId.textContent = busId;
    resetModalRouteId.innerHTML = '<option value="">Same Route (Forward)</option>';
    resetModalRouteId.innerHTML += '<option value="REVERSE">Same Route (Reversed)</option>';
    appState.adminData.routes.forEach(r => {
        resetModalRouteId.innerHTML += `<option value="${r.id}">${r.name}</option>`;
    });
    
    resetModalDriverId.innerHTML = '<option value="">Same Driver</option>';
    appState.adminData.drivers.forEach(d => {
        resetModalDriverId.innerHTML += `<option value="${d.id}">${d.full_name}</option>`;
    });
    
    resetModalConductorId.innerHTML = '<option value="">Same Conductor</option>';
    appState.adminData.conductors.forEach(c => {
        resetModalConductorId.innerHTML += `<option value="${c.id}">${c.full_name}</option>`;
    });
    
    adminResetModal.classList.add('active');
}

// =============== VIEW MANAGEMENT ===============
function showView(viewId) {
    Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
    if (views[viewId]) views[viewId].classList.add('active');

    if (appState.currentUser) {
        userInfo.style.display = 'flex';
        userRoleBadge.textContent = appState.currentUser.role;
    } else {
        userInfo.style.display = 'none';
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateAdminView() {
    statsElements.revenue.textContent = `₹${appState.adminData.revenue}`;
    statsElements.tickets.textContent = appState.adminData.tickets;
    statsElements.staff.textContent = appState.adminData.staffCount;
}

function populateAdminDropdowns() {
    if (assignRoute && appState.adminData.routes.length > 0 && assignRoute.options.length !== appState.adminData.routes.length + 1) {
        const val = assignRoute.value;
        assignRoute.innerHTML = '<option value="">Select Route</option>';
        appState.adminData.routes.forEach(r => assignRoute.innerHTML += `<option value="${r.id}">${r.name}</option>`);
        assignRoute.value = val;
    }
    if (assignDriver && appState.adminData.drivers.length > 0 && assignDriver.options.length !== appState.adminData.drivers.length + 1) {
        const val = assignDriver.value;
        assignDriver.innerHTML = '<option value="">Select Driver</option>';
        appState.adminData.drivers.forEach(d => assignDriver.innerHTML += `<option value="${d.id}">${d.full_name}</option>`);
        assignDriver.value = val;
    }
    if (assignConductor && appState.adminData.conductors.length > 0 && assignConductor.options.length !== appState.adminData.conductors.length + 1) {
        const val = assignConductor.value;
        assignConductor.innerHTML = '<option value="">Select Conductor</option>';
        appState.adminData.conductors.forEach(c => assignConductor.innerHTML += `<option value="${c.id}">${c.full_name}</option>`);
        assignConductor.value = val;
    }
}

// Cache the current stop names for fare calculation
let currentRouteStopNames = [];
let lastDropdownStopsHash = '';

function calculateFare() {
    if (!tPick || !tDrop || !tFare) return;
    const pickVal = tPick.value;
    const dropVal = tDrop.value;
    if (pickVal === '' || dropVal === '') {
        tFare.value = '';
        return;
    }
    const pickIdx = parseInt(pickVal);
    const dropIdx = parseInt(dropVal);
    if (dropIdx > pickIdx && currentRouteStopNames.length > 0) {
        const distance = getRouteDistance(currentRouteStopNames, pickIdx, dropIdx);
        let count = 1;
        if (tCount) count = parseInt(tCount.value) || 1;
        tFare.value = (distance * FARE_PER_KM * count).toFixed(2);
    } else {
        tFare.value = '';
    }
}

function handlePickChange() {
    const pIdx = parseInt(tPick.value);
    Array.from(tDrop.options).forEach(opt => {
        if (!opt.value) return;
        opt.disabled = parseInt(opt.value) <= pIdx;
    });
    // If current drop is now invalid, reset it
    if (tDrop.value && parseInt(tDrop.value) <= pIdx) {
        tDrop.value = '';
    }
    calculateFare();
}

function handleDropChange() {
    calculateFare();
}

function populateTicketingDropdowns(stops) {
    if (!tPick || !tDrop) return;

    // Build a hash of the current stops to avoid unnecessary DOM rebuilds
    const stopsHash = stops.map(s => `${s.index}:${s.name}:${s.visited}`).join(',');
    if (stopsHash === lastDropdownStopsHash) return; // No change, skip rebuild
    lastDropdownStopsHash = stopsHash;

    // Cache stop names for distance-based fare calculation
    currentRouteStopNames = stops.map(s => s.name);

    const prevPick = tPick.value, prevDrop = tDrop.value;

    tPick.innerHTML = '<option value="">Select Boarding Point...</option>';
    tDrop.innerHTML = '<option value="">Select Destination...</option>';

    stops.forEach(s => {
        if (!s.visited) tPick.innerHTML += `<option value="${s.index}">${s.name}</option>`;
        tDrop.innerHTML += `<option value="${s.index}">${s.name}</option>`;
    });

    if (prevPick) tPick.value = prevPick;
    if (prevDrop) tDrop.value = prevDrop;

    // Disable drop options that are at or before the current pick
    if (tPick.value) {
        const pIdx = parseInt(tPick.value);
        Array.from(tDrop.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = parseInt(opt.value) <= pIdx;
        });
    }

    // Remove old listeners and rebind (safe for repeated calls)
    tPick.removeEventListener('change', handlePickChange);
    tDrop.removeEventListener('change', handleDropChange);
    tPick.addEventListener('change', handlePickChange);
    tDrop.addEventListener('change', handleDropChange);
    if (tCount) {
        tCount.removeEventListener('input', calculateFare);
        tCount.addEventListener('input', calculateFare);
    }
}

function updateConductorView() {
    const busHeader = appState.busData.route_name ? `${appState.busData.bus_id} (${appState.busData.route_name})` : appState.busData.bus_id;
    conductorBusId.textContent = busHeader;
    conductorRevenue.textContent = `₹${appState.busData.revenue}`;

    if (appState.busData.bus_id === 'Off Duty') {
        conductorStopsContainer.innerHTML = '<div class="text-muted">You have no active assignment for today.</div>';
        return;
    }

    populateTicketingDropdowns(appState.busData.stops);

    const allVisited = appState.busData.stops.every(s => s.visited);
    if (conductorResetBtn) conductorResetBtn.style.display = allVisited ? 'flex' : 'none';

    let nextUnvisitedIdx = -1;
    for (let i = 0; i < appState.busData.stops.length; i++) {
        if (!appState.busData.stops[i].visited) {
            nextUnvisitedIdx = appState.busData.stops[i].index;
            break;
        }
    }

    const stopsDOM = appState.busData.stops.map(stop => {
        const checkedHTML = stop.visited ? `<i data-lucide="check"></i>` : '';
        const isNextUnvisited = (stop.index === nextUnvisitedIdx);
        const disabledClass = (!stop.visited && !isNextUnvisited) ? 'disabled-stop' : '';

        return `
            <div class="stop-item ${stop.visited ? 'visited' : ''} ${disabledClass}" data-index="${stop.index}" style="${disabledClass ? 'opacity: 0.5; pointer-events: none;' : ''}">
                <div class="stop-info">
                    <span class="stop-index">${stop.index + 1}</span>
                    <span class="stop-name">${stop.name}</span>
                </div>
                <div class="stop-checkbox">${checkedHTML}</div>
            </div>`;
    }).join('');

    conductorStopsContainer.innerHTML = stopsDOM;

    conductorStopsContainer.querySelectorAll('.stop-item:not(.visited):not(.disabled-stop)').forEach(item => {
        item.addEventListener('click', async () => {
            const idx = item.dataset.index;
            const res = await fetch(`${API_URL}/action/stop`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: appState.currentUser.id, stop_index: parseInt(idx) })
            });
            const data = await res.json();
            if (data.error) showToast(data.error, 'error');
            fetchData();
        });
    });

    const active = appState.busData.active_passengers || [];
    passCount.textContent = `${active.length} / 20 Seats`;
    passList.innerHTML = active.length === 0 ? '<div class="text-muted" style="padding: 1rem;">No active passengers.</div>' : '';

    active.forEach(p => {
        const dropStop = appState.busData.stops.find(s => s.index === p.drop_stop_index);
        passList.innerHTML += `
            <div class="stop-item" style="border-left: 4px solid var(--purple-accent);">
                <div class="stop-info">
                    <span class="stop-index" style="background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary);">Seat ${p.seat_number}</span>
                    <div style="display:flex; flex-direction: column;">
                        <span class="stop-name">${p.passenger_name}</span>
                        <span class="text-secondary" style="font-size: 0.85em;">Drop: ${dropStop ? dropStop.name : 'Unknown'} • Fare: ₹${p.fare}</span>
                    </div>
                </div>
                <button class="btn btn-outline cancel-tkt-btn" data-id="${p.id}" style="padding: 0.25rem 0.5rem; color: var(--red-danger); border-color: var(--red-danger);">
                    <i data-lucide="x-circle" style="width: 16px;"></i>
                </button>
            </div>`;
    });

    attachCancelListeners(); lucide.createIcons();
}

function updateDriverView() {
    const busHeader = appState.busData.route_name ? `${appState.busData.bus_id} (${appState.busData.route_name})` : appState.busData.bus_id;
    driverBusId.textContent = busHeader;

    if (appState.busData.bus_id === 'Off Duty') {
        driverStopsContainer.innerHTML = '<div class="text-muted">You have no active assignment for today.</div>';
        return;
    }

    const stopsDOM = appState.busData.stops.map(stop => {
        const isAlighting = !stop.visited && stop.alighting > 0;
        let alertHTML = isAlighting ? `
            <div class="passenger-alert"><i data-lucide="users"></i><span>${stop.alighting} dropping</span></div>
        ` : '';
        return `
            <div class="stop-item ${stop.visited ? 'visited' : ''} ${isAlighting ? 'alighting' : ''}">
                <div class="stop-info">
                    <span class="stop-index">${stop.index + 1}</span>
                    <span class="stop-name">${stop.name}</span>
                </div>
                ${alertHTML}
            </div>`;
    }).join('');

    driverStopsContainer.innerHTML = stopsDOM;
    lucide.createIcons();
}

// Boot
init();

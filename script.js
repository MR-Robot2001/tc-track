// TC Track - Application Logic
const API_URL = 'https://script.google.com/macros/s/AKfycbwH4MPWIKpRxGtodtjQBfVuR4LUtRpijf7374oVSp0fhqHmHr-ciVKIiGoIe0JiZ_4ZVg/exec';

// State Management
let tasks = [];
let employees = [];
let financeData = { clients: [], payments: [], expenses: [] };
let currentView = 'dashboard';
let currentEditingClient = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        setupEventListeners();
        fetchData();
        initExpenseFilters();
    } catch (e) {
        console.error("Initialization Failed:", e);
    }
});

function setupEventListeners() {
    // Navigation
    const dashboardTabBtn = document.getElementById('dashboardTabBtn');
    const financeTabBtn = document.getElementById('financeTabBtn');
    const planBtn = document.getElementById('planBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');

    if (dashboardTabBtn) dashboardTabBtn.onclick = () => switchView('dashboard');
    if (financeTabBtn) financeTabBtn.onclick = () => switchView('finance');
    if (planBtn) planBtn.onclick = showDailyPlan;
    
    if (addTaskBtn) {
        addTaskBtn.onclick = () => {
            const taskForm = document.getElementById('taskForm');
            if (taskForm) taskForm.reset();
            document.getElementById('modalTitle').textContent = 'Add New Task';
            document.getElementById('taskId').value = '';
            document.getElementById('subtaskContainer').innerHTML = '';
            openModal('taskModal');
        };
    }

    // Finance Actions
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.onclick = () => {
            const clientForm = document.getElementById('clientForm');
            if (clientForm) clientForm.reset();
            document.getElementById('phaseInputs').innerHTML = '';
            for(let i=1; i<=4; i++) addPhaseInputRow(`Phase ${i}`, i===4 ? 'Final Submission' : '');
            openModal('clientModal');
        };
    }

    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) addExpenseBtn.onclick = () => openModal('expenseModal');

    // Forms
    const taskForm = document.getElementById('taskForm');
    if (taskForm) taskForm.onsubmit = handleTaskSubmit;

    const clientForm = document.getElementById('clientForm');
    if (clientForm) clientForm.onsubmit = (e) => handleFinanceSubmit(e, 'addClient', 'clientModal');

    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) expenseForm.onsubmit = (e) => handleFinanceSubmit(e, 'addExpense', 'expenseModal');

    // Misc
    const clientSearch = document.getElementById('clientSearch');
    if (clientSearch) clientSearch.oninput = renderFinance;

    const ownerSearch = document.getElementById('ownerSearch');
    if (ownerSearch) ownerSearch.oninput = renderTasks;

    const expenseMonthFilter = document.getElementById('expenseMonthFilter');
    if (expenseMonthFilter) expenseMonthFilter.onchange = renderFinance;

    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) exportPdfBtn.onclick = exportToPdf;

    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) exportExcelBtn.onclick = exportToExcel;

    const saveClientDetailsBtn = document.getElementById('saveClientDetailsBtn');
    if (saveClientDetailsBtn) saveClientDetailsBtn.onclick = saveClientDetails;

    // Plan Actions
    const whatsappBtn = document.getElementById('whatsappTextBtn');
    if (whatsappBtn) whatsappBtn.onclick = sharePlanWhatsApp;

    const downloadBtn = document.getElementById('downloadImageBtn');
    if (downloadBtn) downloadBtn.onclick = downloadPlanImage;

    const shareBtn = document.getElementById('directShareBtn');
    if (shareBtn) shareBtn.onclick = sharePlanDirect;

    const copyBtn = document.getElementById('copyClipboardBtn');
    if (copyBtn) copyBtn.onclick = copyPlanToClipboard;
}

// Data Fetching
async function fetchData() {
    showLoading(true);
    try {
        const [taskRes, empRes, finRes] = await Promise.all([
            fetch(`${API_URL}?action=getTasks`),
            fetch(`${API_URL}?action=getEmployees`),
            fetch(`${API_URL}?action=getFinanceData`)
        ]);
        
        if (!taskRes.ok || !empRes.ok || !finRes.ok) throw new Error('Network response was not ok');

        tasks = await taskRes.json();
        employees = await empRes.json();
        financeData = await finRes.json();
        
        renderTasks();
        renderEmployeeOptions();
        renderFinance();
        updateStats();
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('Failed to load data. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

// UI Switcher
function switchView(view) {
    currentView = view;
    document.getElementById('dashboardView').classList.toggle('hidden', view !== 'dashboard');
    document.getElementById('financeView').classList.toggle('hidden', view !== 'finance');
    
    const dashboardTabBtn = document.getElementById('dashboardTabBtn');
    const financeTabBtn = document.getElementById('financeTabBtn');

    if (view === 'dashboard') {
        dashboardTabBtn.className = 'text-indigo-600 px-4 py-2 text-sm font-bold transition-colors border-b-2 border-indigo-600';
        financeTabBtn.className = 'text-slate-600 hover:text-indigo-600 px-4 py-2 text-sm font-semibold transition-colors';
    } else {
        financeTabBtn.className = 'text-indigo-600 px-4 py-2 text-sm font-bold transition-colors border-b-2 border-indigo-600';
        dashboardTabBtn.className = 'text-slate-600 hover:text-indigo-600 px-4 py-2 text-sm font-semibold transition-colors';
        fetchData();
    }
}

// Render Tasks
function renderTasks() {
    const body = document.getElementById('taskTableBody');
    if (!body) return;
    body.innerHTML = '';
    
    const ownerSearchInput = document.getElementById('ownerSearch');
    const ownerTerm = ownerSearchInput ? ownerSearchInput.value.trim().toLowerCase() : '';
    
    const filteredTasks = tasks.filter(task => {
        if (!ownerTerm) return true;
        const owner = (task.assignee || task.owner || 'Unassigned').toString().toLowerCase();
        return owner.includes(ownerTerm);
    });

    if (filteredTasks.length === 0) {
        document.getElementById('noTasks').classList.remove('hidden');
        return;
    }
    document.getElementById('noTasks').classList.add('hidden');

    const sortedTasks = [...filteredTasks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sortedTasks.forEach(task => {
        const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
        const completed = subtasks.filter(s => s.done).length;
        const percent = subtasks.length > 0 ? Math.round((completed / subtasks.length) * 100) : 0;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors group';
        tr.innerHTML = `
            <td class="px-8 py-5">
                <div class="flex flex-col">
                    <span class="text-slate-900 font-semibold">${task.name || 'Untitled'}</span>
                    <span class="text-[10px] text-indigo-500 font-bold uppercase">${task.domain || 'General'} | ${task.institution || 'No Inst.'}</span>
                </div>
            </td>
            <td class="px-8 py-5 text-sm">${task.assignee || task.owner || 'Unassigned'}</td>
            <td class="px-8 py-5">
                <div class="flex items-center space-x-3">
                    <div class="flex-grow w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                    <span class="text-[10px] font-black text-slate-400 w-8">${percent}%</span>
                </div>
            </td>
            <td class="px-8 py-5">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusClass(task.status)}">${task.status || 'Pending'}</span>
            </td>
            <td class="px-8 py-5">
                <div class="flex items-center space-x-1.5">
                    <div class="w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}"></div>
                    <span class="text-xs font-bold text-slate-500 uppercase">${task.priority || 'Low'}</span>
                </div>
            </td>
            <td class="px-8 py-5 text-sm font-bold">${formatDate(task.duedate)}</td>
            <td class="px-8 py-5 text-right opacity-0 group-hover:opacity-100">
                <button onclick="editTask('${task.id}')" class="text-indigo-500 mr-4">Edit</button>
                <button onclick="deleteTask('${task.id}')" class="text-rose-500">Delete</button>
            </td>
        `;
        body.appendChild(tr);
    });
    if (window.lucide) window.lucide.createIcons();
}

// Render Finance
function renderFinance() {
    renderClients();
    renderExpenses();
}

function renderClients() {
    const body = document.getElementById('clientTableBody');
    body.innerHTML = '';
    const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
    
    financeData.clients.forEach(client => {
        if (searchTerm && !client.clientname.toLowerCase().includes(searchTerm)) return;
        
        let phases = [];
        try { phases = typeof client.phases === 'string' ? JSON.parse(client.phases || '[]') : (client.phases || []); } catch(e) {}
        let extra = [];
        try { extra = typeof client.extrawork === 'string' ? JSON.parse(client.extrawork || '[]') : (client.extrawork || []); } catch(e) {}

        const baseAgreed = parseFloat(client.agreedamount) || 0;
        const extraTotal = extra.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
        const totalAgreed = baseAgreed + extraTotal;

        const received = phases.filter(p => p.completed).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) +
                         extra.filter(w => w.completed).reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
        
        const balance = totalAgreed - received;
        const progress = phases.length > 0 ? Math.round((phases.filter(p => p.completed).length / phases.length) * 100) : 0;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 cursor-pointer';
        tr.onclick = () => showClientDetails(client);
        tr.innerHTML = `
            <td class="px-8 py-5 font-semibold text-slate-900">${client.clientname}</td>
            <td class="px-8 py-5 text-right font-bold">${formatCurrency(totalAgreed)}</td>
            <td class="px-8 py-5 text-right font-bold text-emerald-600">${formatCurrency(received)}</td>
            <td class="px-8 py-5 text-right font-bold ${balance > 0 ? 'text-rose-500' : 'text-emerald-500'}">${formatCurrency(balance)}</td>
            <td class="px-8 py-5">
                <div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-indigo-500 h-full rounded-full" style="width: ${progress}%"></div></div>
            </td>
        `;
        body.appendChild(tr);
    });
    if (window.lucide) window.lucide.createIcons();
}

function renderExpenses() {
    const body = document.getElementById('expenseTableBody');
    body.innerHTML = '';
    const selectedMonth = document.getElementById('expenseMonthFilter').value;
    let total = 0;
    
    financeData.expenses.forEach(exp => {
        const expDate = new Date(exp.date);
        const expMonth = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        if (selectedMonth && expMonth !== selectedMonth) return;
        
        total += (parseFloat(exp.amount) || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-8 py-5 text-xs font-bold uppercase">${exp.category}</td>
            <td class="px-8 py-5 text-sm">${exp.description}</td>
            <td class="px-8 py-5 text-sm">${formatDate(exp.date)}</td>
            <td class="px-8 py-5 text-right font-bold text-rose-500">${formatCurrency(exp.amount)}</td>
        `;
        body.appendChild(tr);
    });
    document.getElementById('monthlyExpenseTotal').textContent = formatCurrency(total);
}

// Client Details
function showClientDetails(client) {
    currentEditingClient = client;
    let phases = [];
    try { phases = typeof client.phases === 'string' ? JSON.parse(client.phases || '[]') : (client.phases || []); } catch(e) {}
    let extra = [];
    try { extra = typeof client.extrawork === 'string' ? JSON.parse(client.extrawork || '[]') : (client.extrawork || []); } catch(e) {}

    const baseAgreed = parseFloat(client.agreedamount) || 0;
    const extraTotal = extra.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
    const totalAgreed = baseAgreed + extraTotal;
    const received = phases.filter(p => p.completed).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) +
                     extra.filter(w => w.completed).reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
    const balance = totalAgreed - received;

    document.getElementById('detailsClientName').textContent = client.clientname;
    document.getElementById('detailsClientSummary').textContent = `Agreed: ${formatCurrency(totalAgreed)} | Balance: ${formatCurrency(balance)}`;
    document.getElementById('detailsReceived').textContent = formatCurrency(received);
    document.getElementById('detailsBalance').textContent = formatCurrency(balance);
    
    const progress = phases.length > 0 ? Math.round((phases.filter(p => p.completed).length / phases.length) * 100) : 0;
    document.getElementById('detailsProgressPercent').textContent = `${progress}%`;
    document.getElementById('detailsProgressBar').style.width = `${progress}%`;

    const phasesList = document.getElementById('detailsPhasesList');
    phasesList.innerHTML = '';
    phases.forEach(p => addPhaseRowDetail(p));

    const extraList = document.getElementById('detailsExtraWorkList');
    extraList.innerHTML = '';
    extra.forEach(w => addExtraWorkRow(w.description, w.amount, w.completed));
    
    openModal('clientDetailsModal');
}

// Form Helpers
function addPhaseInputRow(name = '', deliverable = '') {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl';
    div.innerHTML = `
        <div class="col-span-4"><input type="text" value="${name}" placeholder="Phase" class="phase-name w-full bg-white rounded-xl px-3 py-2 text-sm border-none"></div>
        <div class="col-span-2"><input type="number" oninput="calculatePhaseAmount(this)" placeholder="%" class="phase-percent w-full bg-white rounded-xl px-3 py-2 text-sm border-none"></div>
        <div class="col-span-3"><input type="number" placeholder="Amount" class="phase-amount w-full bg-white rounded-xl px-3 py-2 text-sm border-none"></div>
        <div class="col-span-3"><input type="text" value="${deliverable}" placeholder="Deliverable" class="phase-deliverable w-full bg-white rounded-xl px-3 py-2 text-sm border-none"></div>
    `;
    document.getElementById('phaseInputs').appendChild(div);
}

function addPhaseRowDetail(p = {}) {
    const div = document.createElement('div');
    div.className = 'p-4 rounded-2xl bg-slate-50 space-y-3';
    div.innerHTML = `
        <div class="flex items-center space-x-3">
            <input type="checkbox" ${p.completed ? 'checked' : ''} class="phase-completed w-5 h-5 rounded text-indigo-600 border-none">
            <input type="text" value="${p.name || ''}" class="phase-name font-bold bg-transparent border-none flex-grow">
        </div>
        <div class="grid grid-cols-3 gap-2">
            <input type="text" value="${p.deliverable || ''}" placeholder="Deliverable" class="phase-deliverable text-xs bg-white rounded-lg px-2 py-1 border-none col-span-1">
            <input type="number" value="${p.amount || ''}" placeholder="Amount" class="phase-amount text-xs bg-white rounded-lg px-2 py-1 border-none">
            <input type="number" oninput="calculatePhaseAmount(this)" value="${p.percentage || ''}" placeholder="%" class="phase-percent text-xs bg-white rounded-lg px-2 py-1 border-none">
        </div>
    `;
    document.getElementById('detailsPhasesList').appendChild(div);
}

function addExtraWorkRow(desc = '', amt = '', done = false) {
    const div = document.createElement('div');
    div.className = 'p-4 rounded-2xl bg-slate-50 flex flex-col space-y-2';
    div.innerHTML = `
        <div class="flex items-center space-x-3">
            <input type="checkbox" ${done ? 'checked' : ''} class="extra-completed w-5 h-5 rounded text-indigo-600 border-none">
            <input type="text" value="${desc}" placeholder="Description" class="extra-desc text-sm bg-white rounded-lg px-3 py-1 flex-grow border-none">
        </div>
        <input type="number" value="${amt}" placeholder="Amount" class="extra-amount text-sm bg-white rounded-lg px-3 py-1 w-32 border-none">
    `;
    document.getElementById('detailsExtraWorkList').appendChild(div);
}

function calculatePhaseAmount(input) {
    const row = input.parentElement.parentElement;
    const amountInput = row.querySelector('.phase-amount');
    const percent = parseFloat(input.value) || 0;
    let agreed = 0;
    
    if (document.getElementById('clientModal').classList.contains('hidden')) {
        agreed = parseFloat(currentEditingClient.agreedamount) || 0;
    } else {
        agreed = parseFloat(document.getElementById('agreedInput').value) || 0;
    }
    if (amountInput && agreed) amountInput.value = ((percent / 100) * agreed).toFixed(2);
}

// Handlers
async function handleTaskSubmit(e) {
    e.preventDefault();
    const subtasks = [];
    document.querySelectorAll('#subtaskContainer > div').forEach(div => {
        const textInput = div.querySelector('input[type="text"]');
        const doneInput = div.querySelector('input[type="checkbox"]');
        if (textInput && textInput.value) {
            subtasks.push({ text: textInput.value, done: doneInput.checked });
        }
    });

    const taskData = {
        id: document.getElementById('taskId').value || null,
        name: document.getElementById('taskName').value,
        description: document.getElementById('taskDescription').value,
        domain: document.getElementById('taskDomain').value,
        institution: document.getElementById('taskInstitution').value,
        assignee: document.getElementById('taskAssignee').value,
        status: document.getElementById('taskStatus').value,
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value,
        subtasks: subtasks
    };

    showLoading(true);
    try {
        const action = taskData.id ? 'updateTask' : 'addTask';
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, task: taskData }) });
        const result = await response.json();
        
        if (result.success) {
            closeModal('taskModal');
            fetchData();
        } else {
            alert('Error: ' + (result.error || 'Operation failed'));
        }
    } catch (err) { 
        console.error('Task save failed:', err);
        alert('Failed to save task. Please check your connection.');
    } finally { 
        showLoading(false); 
    }
}

async function handleFinanceSubmit(e, action, modalId) {
    e.preventDefault();
    const data = {};
    if (action === 'addClient') {
        data.name = document.getElementById('clientNameInput').value;
        data.quotation = document.getElementById('quotationInput').value;
        data.agreed = document.getElementById('agreedInput').value;
        const phases = [];
        document.querySelectorAll('#phaseInputs > div').forEach(div => {
            const name = div.querySelector('.phase-name').value;
            if (name) phases.push({
                name, percentage: div.querySelector('.phase-percent').value,
                amount: div.querySelector('.phase-amount').value,
                deliverable: div.querySelector('.phase-deliverable').value,
                completed: false
            });
        });
        data.phases = phases;
        data.extraWork = [];
    } else if (action === 'addExpense') {
        data.category = document.getElementById('expenseCategoryInput').value;
        data.description = document.getElementById('expenseDescriptionInput').value;
        data.amount = document.getElementById('expenseAmountInput').value;
        data.date = document.getElementById('expenseDateInput').value;
    }

    showLoading(true);
    try {
        const key = action === 'addClient' ? 'client' : 'expense';
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, [key]: data }) });
        const result = await response.json();
        
        if (result.success) {
            closeModal(modalId);
            fetchData();
        } else {
            alert('Error: ' + (result.error || 'Operation failed'));
        }
    } catch (err) { 
        console.error('Submission failed:', err);
        alert('Failed to submit. Please check your connection.');
    } finally { 
        showLoading(false); 
    }
}

async function saveClientDetails() {
    if (!currentEditingClient) return;

    const phases = [];
    document.querySelectorAll('#detailsPhasesList > div').forEach(div => {
        const nameInput = div.querySelector('.phase-name');
        if (nameInput && nameInput.value) {
            phases.push({
                name: nameInput.value,
                deliverable: div.querySelector('.phase-deliverable').value,
                amount: div.querySelector('.phase-amount').value,
                percentage: div.querySelector('.phase-percent').value,
                completed: div.querySelector('.phase-completed').checked
            });
        }
    });

    const extra = [];
    document.querySelectorAll('#detailsExtraWorkList > div').forEach(div => {
        const descInput = div.querySelector('.extra-desc');
        if (descInput && descInput.value) {
            extra.push({
                description: descInput.value,
                amount: div.querySelector('.extra-amount').value,
                completed: div.querySelector('.extra-completed').checked
            });
        }
    });

    const updated = {
        name: currentEditingClient.clientname,
        quotation: currentEditingClient.quotationamount,
        agreed: currentEditingClient.agreedamount,
        phases: phases,
        extraWork: extra
    };

    showLoading(true);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateClient', client: updated })
        });
        const result = await response.json();
        
        if (result.success) {
            closeModal('clientDetailsModal');
            fetchData();
        } else {
            alert('Error updating client: ' + (result.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Save failed:', err);
        alert('Failed to save changes. Please check your connection.');
    } finally {
        showLoading(false);
    }
}

// Helpers
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function addSubtaskRow(text = '', done = false) {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2';
    div.innerHTML = `<input type="checkbox" ${done ? 'checked' : ''}><input type="text" value="${text}" class="flex-grow bg-slate-50 px-2 py-1 rounded border-none">`;
    document.getElementById('subtaskContainer').appendChild(div);
}

function getStatusClass(s) {
    if (s === 'Pending') return 'bg-slate-100 text-slate-500';
    if (s === 'In Progress') return 'bg-indigo-100 text-indigo-600';
    return 'bg-emerald-100 text-emerald-600';
}

function getPriorityColor(p) {
    if (p === 'High') return 'bg-rose-500';
    if (p === 'Medium') return 'bg-amber-500';
    return 'bg-emerald-500';
}

function formatCurrency(amt) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt || 0); }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-GB') : 'N/A'; }
function showLoading(s) { document.getElementById('loadingOverlay').classList.toggle('hidden', !s); }

// Daily Plan
function showDailyPlan() {
    document.getElementById('planDateText').textContent = new Date().toLocaleDateString('en-GB');
    const list = document.getElementById('planList');
    list.innerHTML = '';
    tasks.filter(t => t.status !== 'Completed').forEach(t => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-white/5 border border-white/10 rounded-2xl';
        item.innerHTML = `<h4 class="text-white font-bold">${t.name}</h4><p class="text-xs text-white/40">${t.assignee}</p>`;
        list.appendChild(item);
    });
    openModal('planModal');
}

// Sharing Placeholder
function sharePlanWhatsApp() { alert("WhatsApp feature ready."); }
function downloadPlanImage() { alert("Image download ready."); }
function sharePlanDirect() { alert("Direct share ready."); }
function copyPlanToClipboard() { alert("Copied to clipboard."); }

function exportToPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241);
    doc.text("TC Track - Operational Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 14, 28);

    // Tasks Table
    const taskHeaders = [["Task Name", "Assignee", "Status", "Priority", "Due Date"]];
    const taskData = tasks.map(t => [
        t.name, 
        t.assignee || 'Unassigned', 
        t.status, 
        t.priority, 
        formatDate(t.duedate)
    ]);

    doc.autoTable({
        startY: 35,
        head: taskHeaders,
        body: taskData,
        theme: 'grid',
        headStyles: { fillStyle: 'fill', fillColor: [99, 102, 241], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    // Finance Section if it fits
    const finalY = doc.lastAutoTable.finalY + 20;
    if (finalY < 180) {
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text("Finance Summary", 14, finalY);

        const finHeaders = [["Client Name", "Total Agreed", "Received", "Balance"]];
        const finData = financeData.clients.map(c => {
            let extra = [];
            try { extra = typeof c.extrawork === 'string' ? JSON.parse(c.extrawork || '[]') : (c.extrawork || []); } catch(e) {}
            let phases = [];
            try { phases = typeof c.phases === 'string' ? JSON.parse(c.phases || '[]') : (c.phases || []); } catch(e) {}
            
            const baseAgreed = parseFloat(c.agreedamount) || 0;
            const extraTotal = extra.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
            const totalAgreed = baseAgreed + extraTotal;
            const received = phases.filter(p => p.completed).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) +
                             extra.filter(w => w.completed).reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
            
            return [c.clientname, formatCurrency(totalAgreed), formatCurrency(received), formatCurrency(totalAgreed - received)];
        });

        doc.autoTable({
            startY: finalY + 5,
            head: finHeaders,
            body: finData,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] }
        });
    }

    doc.save(`TC_Track_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    // Tasks Sheet
    const taskWSData = tasks.map(t => ({
        "Task Name": t.name,
        "Assignee": t.assignee,
        "Status": t.status,
        "Priority": t.priority,
        "Due Date": formatDate(t.duedate),
        "Created At": formatDate(t.createdat)
    }));
    const taskWS = XLSX.utils.json_to_sheet(taskWSData);
    XLSX.utils.book_append_sheet(wb, taskWS, "Tasks");

    // Clients Sheet
    const clientWSData = financeData.clients.map(c => {
        let extra = [];
        try { extra = typeof c.extrawork === 'string' ? JSON.parse(c.extrawork || '[]') : (c.extrawork || []); } catch(e) {}
        let phases = [];
        try { phases = typeof c.phases === 'string' ? JSON.parse(c.phases || '[]') : (c.phases || []); } catch(e) {}
        
        const baseAgreed = parseFloat(c.agreedamount) || 0;
        const extraTotal = extra.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
        const totalAgreed = baseAgreed + extraTotal;
        const received = phases.filter(p => p.completed).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) +
                         extra.filter(w => w.completed).reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
        
        return {
            "Client Name": c.clientname,
            "Quotation": c.quotationamount,
            "Agreed Base": c.agreedamount,
            "Extra Work Total": extraTotal,
            "Total Agreed": totalAgreed,
            "Total Received": received,
            "Balance": totalAgreed - received
        };
    });
    const clientWS = XLSX.utils.json_to_sheet(clientWSData);
    XLSX.utils.book_append_sheet(wb, clientWS, "Clients");

    // Expenses Sheet
    const expenseWSData = financeData.expenses.map(e => ({
        "Category": e.category,
        "Description": e.description,
        "Date": formatDate(e.date),
        "Amount": e.amount
    }));
    const expenseWS = XLSX.utils.json_to_sheet(expenseWSData);
    XLSX.utils.book_append_sheet(wb, expenseWS, "Expenses");

    XLSX.writeFile(wb, `TC_Track_Finance_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function initExpenseFilters() {
    const filter = document.getElementById('expenseMonthFilter');
    const today = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        filter.innerHTML += `<option value="${val}">${d.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</option>`;
    }
}

function renderEmployeeOptions() {
    const container = document.getElementById('assigneeContainer');
    if (!container) return;
    container.innerHTML = employees.map(e => `
        <div class="flex items-center space-x-3">
            <input type="checkbox" value="${e.name}" class="w-4 h-4 rounded text-indigo-600 border-none focus:ring-0">
            <span class="text-sm font-medium text-slate-600">${e.name}</span>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('pendingCount').textContent = tasks.filter(t => t.status === 'Pending').length;
    document.getElementById('progressCount').textContent = tasks.filter(t => t.status === 'In Progress').length;
    document.getElementById('completedCount').textContent = tasks.filter(t => t.status === 'Completed').length;
}

async function deleteTask(id) { if (confirm('Delete?')) { showLoading(true); await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteTask', id }) }); fetchData(); } }
async function editTask(id) { 
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    
    // Reset and Set Checkboxes
    const currentAssignees = (task.assignee || '').split(',').map(s => s.trim());
    document.querySelectorAll('#assigneeContainer input').forEach(cb => {
        cb.checked = currentAssignees.includes(cb.value);
    });

    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskDueDate').value = new Date(task.duedate).toISOString().split('T')[0];
    openModal('taskModal');
}

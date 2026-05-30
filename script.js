// Replace with your Google Apps Script Web App URL after deployment
const API_URL = 'https://script.google.com/macros/s/AKfycbygXBACSjsnkg-3w1lPhqwu9UF9zfJxi1TRv3ovA7Pp3ejqCe0p9yxyrhXM7i06bBFW6A/exec';

let tasks = [];
let employees = [];
let financeData = { clients: [], payments: [], expenses: [] };
let currentView = 'dashboard';
let currentEditingClient = null;

// DOM Elements
const taskTableBody = document.getElementById('taskTableBody');
const noTasks = document.getElementById('noTasks');
const taskModal = document.getElementById('taskModal');
const planModal = document.getElementById('planModal');
const taskForm = document.getElementById('taskForm');
const loadingOverlay = document.getElementById('loadingOverlay');

// Finance Elements
const dashboardView = document.getElementById('dashboardView');
const financeView = document.getElementById('financeView');
const dashboardTabBtn = document.getElementById('dashboardTabBtn');
const financeTabBtn = document.getElementById('financeTabBtn');
const clientTableBody = document.getElementById('clientTableBody');
const expenseTableBody = document.getElementById('expenseTableBody');
const expenseMonthFilter = document.getElementById('expenseMonthFilter');
const monthlyExpenseTotal = document.getElementById('monthlyExpenseTotal');

// Counters
const pendingCount = document.getElementById('pendingCount');
const progressCount = document.getElementById('progressCount');
const completedCount = document.getElementById('completedCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
    initExpenseFilters();
});

function setupEventListeners() {
    dashboardTabBtn.onclick = () => switchView('dashboard');
    financeTabBtn.onclick = () => switchView('finance');
    
    document.getElementById('addClientBtn').onclick = () => {
        document.getElementById('clientForm').reset();
        document.getElementById('phaseInputs').innerHTML = '';
        // Default 4 phases
        for(let i=1; i<=4; i++) addPhaseInputRow(`Phase ${i}`, i===4 ? 'Final Submission' : '');
        openModal('clientModal');
    };
    document.getElementById('addPaymentBtn').onclick = () => openModal('paymentModal');
    document.getElementById('addExpenseBtn').onclick = () => openModal('expenseModal');
    document.getElementById('closeModal').onclick = () => closeModal('taskModal');
    document.getElementById('addTaskBtn').onclick = () => {
        document.getElementById('modalTitle').textContent = 'Add New Task';
        taskForm.reset();
        document.getElementById('taskId').value = '';
        document.getElementById('subtaskContainer').innerHTML = '';
        openModal('taskModal');
    };
    
    document.getElementById('clientForm').onsubmit = (e) => handleFinanceSubmit(e, 'addClient', 'clientModal');
    document.getElementById('paymentForm').onsubmit = (e) => handleFinanceSubmit(e, 'addPayment', 'paymentModal');
    document.getElementById('expenseForm').onsubmit = (e) => handleFinanceSubmit(e, 'addExpense', 'expenseModal');
    
    document.getElementById('addSubtaskBtn').onclick = () => addSubtaskRow();
    
    document.getElementById('clientSearch').oninput = (e) => renderFinance();
    expenseMonthFilter.onchange = () => renderFinance();
    
    document.getElementById('exportPdfBtn').onclick = exportToPdf;
    document.getElementById('exportExcelBtn').onclick = exportToExcel;
    
    document.getElementById('saveClientDetailsBtn').onclick = saveClientDetails;
}

function switchView(view) {
    currentView = view;
    dashboardView.classList.toggle('hidden', view !== 'dashboard');
    financeView.classList.toggle('hidden', view !== 'finance');
    
    dashboardTabBtn.className = view === 'dashboard' ? 'text-indigo-600 px-4 py-2 text-sm font-bold transition-colors border-b-2 border-indigo-600' : 'text-slate-600 hover:text-indigo-600 px-4 py-2 text-sm font-semibold transition-colors';
    financeTabBtn.className = view === 'finance' ? 'text-indigo-600 px-4 py-2 text-sm font-bold transition-colors border-b-2 border-indigo-600' : 'text-slate-600 hover:text-indigo-600 px-4 py-2 text-sm font-semibold transition-colors';
    
    if (view === 'finance') fetchData();
}

// Fetch all data
async function fetchData() {
    showLoading(true);
    try {
        const [taskRes, empRes, finRes] = await Promise.all([
            fetch(`${API_URL}?action=getTasks`),
            fetch(`${API_URL}?action=getEmployees`),
            fetch(`${API_URL}?action=getFinanceData`)
        ]);
        
        tasks = await taskRes.json();
        employees = await empRes.json();
        financeData = await finRes.json();
        
        renderTasks();
        renderEmployeeOptions();
        renderFinance();
        updateStats();
        updateFinanceSelectors();
    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        showLoading(false);
    }
}

// UI Rendering - Tasks
function renderTasks() {
    taskTableBody.innerHTML = '';
    if (tasks.length === 0) {
        noTasks.classList.remove('hidden');
        return;
    }
    noTasks.classList.add('hidden');

    // Sort by name
    const sortedTasks = [...tasks].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sortedTasks.forEach(task => {
        const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
        const completedSubtasks = subtasks.filter(s => s.done).length;
        const progressPercent = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors group';
        tr.innerHTML = `
            <td class="px-8 py-5">
                <div class="flex flex-col max-w-xs">
                    <span class="text-slate-900 font-semibold truncate" title="${task.name}">${task.name}</span>
                    <span class="text-[10px] text-indigo-500 font-bold uppercase tracking-tight mt-0.5">${task.domain || 'General'} | ${task.institution || 'No Inst.'}</span>
                    <span class="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">${task.description || 'No description'}</span>
                    ${subtasks.length > 0 ? `
                    <div class="mt-2 w-full bg-slate-100 rounded-full h-1">
                        <div class="bg-indigo-500 h-1 rounded-full" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="text-[9px] font-bold text-slate-400 uppercase mt-1">${completedSubtasks}/${subtasks.length} Checkpoints</span>
                    ` : ''}
                </div>
            </td>
            <td class="px-8 py-5">
                <div class="flex items-center space-x-2">
                    <div class="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                        ${(task.assignee || 'U').charAt(0)}
                    </div>
                    <span class="text-sm font-medium text-slate-600">${task.assignee || 'Unassigned'}</span>
                </div>
            </td>
            <td class="px-8 py-5">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${getStatusClass(task.status)}">
                    ${task.status === 'In Progress' ? 'Active' : task.status}
                </span>
            </td>
            <td class="px-8 py-5">
                <div class="flex items-center space-x-1.5">
                    <div class="w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}"></div>
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">${task.priority}</span>
                </div>
            </td>
            <td class="px-8 py-5">
                <div class="flex flex-col">
                    <span class="text-sm tabular-nums text-slate-700 font-bold">${formatDate(task.duedate)}</span>
                    <span class="text-[9px] text-slate-400 uppercase font-bold">Created: ${formatDate(task.createdat)}</span>
                </div>
            </td>
            <td class="px-8 py-5 text-right">
                <div class="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editTask('${task.id}')" class="p-2 hover:bg-indigo-50 text-indigo-500 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onclick="deleteTask('${task.id}')" class="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        taskTableBody.appendChild(tr);
    });
}

// UI Rendering - Finance
function renderFinance() {
    renderClients();
    renderExpenses();
}

function renderClients() {
    clientTableBody.innerHTML = '';
    const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
    
    const sortedClients = [...financeData.clients].sort((a, b) => a.clientname.localeCompare(b.clientname));
    
    sortedClients.forEach(client => {
        if (searchTerm && !client.clientname.toLowerCase().includes(searchTerm)) return;
        
        const clientPayments = financeData.payments.filter(p => p.clientname === client.clientname);
        const totalReceived = clientPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const balance = (parseFloat(client.agreedamount) || 0) - totalReceived;
        
        // Calculate Progress
        let phases = [];
        try { phases = typeof client.phases === 'string' ? JSON.parse(client.phases || '[]') : (client.phases || []); } catch(e) {}
        const completedPhases = phases.filter(p => p.completed).length;
        const progressPercent = phases.length > 0 ? Math.round((completedPhases / phases.length) * 100) : 0;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors group cursor-pointer';
        tr.onclick = () => showClientDetails(client, clientPayments);
        tr.innerHTML = `
            <td class="px-8 py-5">
                <span class="text-slate-900 font-semibold">${client.clientname}</span>
            </td>
            <td class="px-8 py-5 text-right font-medium text-slate-400">
                ${formatCurrency(client.quotationamount)}
            </td>
            <td class="px-8 py-5 text-right font-bold text-slate-700">
                ${formatCurrency(client.agreedamount)}
            </td>
            <td class="px-8 py-5 text-right font-bold text-emerald-600">
                ${formatCurrency(totalReceived)}
            </td>
            <td class="px-8 py-5 text-right font-bold ${balance > 0 ? 'text-rose-500' : 'text-emerald-500'}">
                ${formatCurrency(balance)}
            </td>
            <td class="px-8 py-5">
                <div class="flex flex-col w-24">
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-500 h-full rounded-full" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="text-[9px] font-bold text-slate-400 uppercase mt-1">${completedPhases}/${phases.length} Phases</span>
                </div>
            </td>
        `;
        clientTableBody.appendChild(tr);
    });
}

function renderExpenses() {
    expenseTableBody.innerHTML = '';
    const selectedMonth = expenseMonthFilter.value; // YYYY-MM
    let total = 0;
    
    financeData.expenses.forEach(exp => {
        const expDate = new Date(exp.date);
        const expMonth = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (selectedMonth && expMonth !== selectedMonth) return;
        
        total += (parseFloat(exp.amount) || 0);
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors';
        tr.innerHTML = `
            <td class="px-8 py-5"><span class="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase">${exp.category}</span></td>
            <td class="px-8 py-5 text-sm">${exp.description}</td>
            <td class="px-8 py-5 text-sm text-slate-400">${formatDate(exp.date)}</td>
            <td class="px-8 py-5 text-right font-bold text-rose-500">${formatCurrency(exp.amount)}</td>
        `;
        expenseTableBody.appendChild(tr);
    });
    
    monthlyExpenseTotal.textContent = formatCurrency(total);
}

// Modal Helpers
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function addSubtaskRow(text = '', done = false) {
    const container = document.getElementById('subtaskContainer');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 group';
    div.innerHTML = `
        <input type="checkbox" ${done ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500">
        <input type="text" value="${text}" placeholder="Checkpoint description" class="flex-grow bg-slate-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 transition-all font-medium">
        <button type="button" onclick="this.parentElement.remove()" class="text-slate-300 hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    container.appendChild(div);
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskDomain').value = task.domain || '';
    document.getElementById('taskInstitution').value = task.institution || '';
    document.getElementById('taskAssignee').value = task.assignee;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority;
    
    const subtaskContainer = document.getElementById('subtaskContainer');
    subtaskContainer.innerHTML = '';
    if (Array.isArray(task.subtasks)) {
        task.subtasks.forEach(s => addSubtaskRow(s.text, s.done));
    }
    
    if (task.duedate) {
        const date = new Date(task.duedate);
        document.getElementById('taskDueDate').value = date.toISOString().split('T')[0];
    }
    
    openModal('taskModal');
}

taskForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    
    const subtasks = [];
    document.querySelectorAll('#subtaskContainer > div').forEach(div => {
        const text = div.querySelector('input[type="text"]').value;
        const done = div.querySelector('input[type="checkbox"]').checked;
        if (text) subtasks.push({ text, done });
    });

    const taskData = {
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
        const action = id ? 'updateTask' : 'addTask';
        const payload = id ? { action, task: { ...taskData, id } } : { action, task: taskData };
        
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        closeModal('taskModal');
        fetchData();
    } catch (error) {
        console.error('Error saving task:', error);
    } finally {
        showLoading(false);
    }
};

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
            const percentage = div.querySelector('.phase-percent').value;
            const amount = div.querySelector('.phase-amount').value;
            const deliverable = div.querySelector('.phase-deliverable').value;
            if (name) {
                phases.push({ name, percentage, amount, deliverable, completed: false });
            }
        });
        data.phases = phases;
        data.extraWork = [];
    } else if (action === 'addPayment') {
        data.clientName = document.getElementById('paymentClientSelect').value;
        data.amount = document.getElementById('paymentAmountInput').value;
        data.date = document.getElementById('paymentDateInput').value;
    } else if (action === 'addExpense') {
        data.category = document.getElementById('expenseCategoryInput').value;
        data.description = document.getElementById('expenseDescriptionInput').value;
        data.amount = document.getElementById('expenseAmountInput').value;
        data.date = document.getElementById('expenseDateInput').value;
    }

    showLoading(true);
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, [action.replace('add', '').toLowerCase()]: data }) });
        closeModal(modalId);
        e.target.reset();
        fetchData();
    } catch (error) {
        console.error('Error saving finance item:', error);
    } finally {
        showLoading(false);
    }
}

function addPhaseInputRow(name = '', deliverable = '') {
    const container = document.getElementById('phaseInputs');
    const div = document.createElement('div');
    div.className = 'grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-2xl group relative';
    div.innerHTML = `
        <div class="md:col-span-3">
            <label class="text-[9px] font-bold text-slate-400 uppercase ml-1">Phase Name</label>
            <input type="text" value="${name}" placeholder="Phase 1" class="phase-name w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="md:col-span-2">
            <label class="text-[9px] font-bold text-slate-400 uppercase ml-1">%</label>
            <input type="number" step="0.01" placeholder="25" class="phase-percent w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="md:col-span-2">
            <label class="text-[9px] font-bold text-slate-400 uppercase ml-1">Amount</label>
            <input type="number" placeholder="0.00" class="phase-amount w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="md:col-span-4">
            <label class="text-[9px] font-bold text-slate-400 uppercase ml-1">Deliverable</label>
            <input type="text" value="${deliverable}" placeholder="Scope Submission" class="phase-deliverable w-full bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="md:col-span-1 flex justify-center pb-2">
            <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-slate-300 hover:text-rose-500 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    `;
    container.appendChild(div);
}

// Client Detail Modal Functions
function showClientDetails(client, payments) {
    currentEditingClient = client;
    const received = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const balance = (parseFloat(client.agreedamount) || 0) - received;

    document.getElementById('detailsClientName').textContent = client.clientname;
    document.getElementById('detailsClientSummary').textContent = `Agreed: ${formatCurrency(client.agreedamount)} | Quotation: ${formatCurrency(client.quotationamount)}`;
    document.getElementById('detailsReceived').textContent = formatCurrency(received);
    document.getElementById('detailsBalance').textContent = formatCurrency(balance);

    let phases = [];
    try { phases = typeof client.phases === 'string' ? JSON.parse(client.phases || '[]') : (client.phases || []); } catch(e) {}

    const completedPhases = phases.filter(p => p.completed).length;
    const progressPercent = phases.length > 0 ? Math.round((completedPhases / phases.length) * 100) : 0;

    document.getElementById('detailsProgressPercent').textContent = `${progressPercent}%`;
    document.getElementById('detailsProgressBar').style.width = `${progressPercent}%`;

    const phasesList = document.getElementById('detailsPhasesList');
    phasesList.innerHTML = '';
    phases.forEach((phase) => {
        addPhaseRowDetail(phase);
    });

    let extraWork = [];
    try { extraWork = typeof client.extrawork === 'string' ? JSON.parse(client.extrawork || '[]') : (client.extrawork || []); } catch(e) {}

    const extraList = document.getElementById('detailsExtraWorkList');
    extraList.innerHTML = '';
    extraWork.forEach((work) => {
        addExtraWorkRow(work.description, work.amount, work.completed);
    });

    if (extraWork.length === 0) {
        extraList.innerHTML = '<p class="text-center text-slate-300 py-10 text-sm italic">No extra work recorded.</p>';
    }

    openModal('clientDetailsModal');
}

function addPhaseRowDetail(phase = {}) {
    const container = document.getElementById('detailsPhasesList');
    const div = document.createElement('div');
    div.className = `p-4 rounded-2xl border transition-all ${phase.completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`;
    div.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-grow">
                    <input type="checkbox" ${phase.completed ? 'checked' : ''} class="phase-completed w-5 h-5 rounded-lg text-emerald-600 border-slate-300 focus:ring-emerald-500">
                    <input type="text" value="${phase.name || ''}" placeholder="Phase Name" class="phase-name font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0 w-full">
                </div>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-slate-300 hover:text-rose-500 transition-colors ml-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[9px] font-bold text-slate-400 uppercase block mb-1">Deliverable</label>
                    <input type="text" value="${phase.deliverable || ''}" placeholder="Scope Submission" class="phase-deliverable w-full bg-slate-50 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase block mb-1">Amount</label>
                        <input type="number" value="${phase.amount || ''}" placeholder="0.00" class="phase-amount w-full bg-slate-50 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-400 uppercase block mb-1">%</label>
                        <input type="number" value="${phase.percentage || ''}" placeholder="25" class="phase-percent w-full bg-slate-50 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500">
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(div);
}

async function saveClientDetails() {
    const phases = [];
    document.querySelectorAll('#detailsPhasesList > div').forEach(div => {
        const name = div.querySelector('.phase-name').value;
        const deliverable = div.querySelector('.phase-deliverable').value;
        const amount = div.querySelector('.phase-amount').value;
        const percentage = div.querySelector('.phase-percent').value;
        const completed = div.querySelector('.phase-completed').checked;
        if (name) {
            phases.push({ name, deliverable, amount, percentage, completed });
        }
    });

    const extraWork = [];
    document.querySelectorAll('#detailsExtraWorkList > div').forEach(div => {
        const description = div.querySelector('.extra-desc').value;
        const amount = div.querySelector('.extra-amount').value;
        const completed = div.querySelector('.extra-completed').checked;
        if (description) {
            extraWork.push({ description, amount, completed });
        }
    });

    const updatedClient = {
        name: currentEditingClient.clientname,
        quotation: currentEditingClient.quotationamount,
        agreed: currentEditingClient.agreedamount,
        phases: phases,
        extraWork: extraWork
    };

    showLoading(true);
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'updateClient', client: updatedClient }) 
        });
        closeModal('clientDetailsModal');
        fetchData();
    } catch (error) {
        console.error('Error updating client:', error);
    } finally {
        showLoading(false);
    }
}

function updatePhaseStatus(index, completed) {
    // This is now handled by saveClientDetails since we made the UI editable
}

function addExtraWorkRow(desc = '', amount = '', completed = false) {
    const container = document.getElementById('detailsExtraWorkList');
    if (container.querySelector('p.italic')) container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-4 rounded-2xl flex flex-col space-y-3';
    div.innerHTML = `
        <div class="flex items-center space-x-3">
            <input type="checkbox" ${completed ? 'checked' : ''} class="extra-completed w-5 h-5 rounded-lg text-indigo-600 border-slate-300 focus:ring-indigo-500">
            <input type="text" value="${desc}" placeholder="Description of extra work" class="extra-desc flex-grow bg-white border-none rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500">
        </div>
        <div class="flex items-center justify-between pl-8">
            <div class="flex items-center space-x-2">
                <span class="text-xs font-bold text-slate-400 uppercase">Amount:</span>
                <input type="number" value="${amount}" placeholder="0.00" class="extra-amount w-24 bg-white border-none rounded-xl px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500">
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-rose-500 hover:text-rose-700 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `;
    container.appendChild(div);
}

// Export Functionality
function exportToPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Thesis Consultants - Finance Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Clients Table
    doc.setFontSize(14);
    doc.text('Client Revenue Ledger', 14, 45);
    
    const clientRows = financeData.clients.map(c => {
        const payments = financeData.payments.filter(p => p.clientname === c.clientname);
        const received = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const balance = (parseFloat(c.agreedamount) || 0) - received;
        return [c.clientname, formatCurrency(c.quotationamount), formatCurrency(c.agreedamount), formatCurrency(received), formatCurrency(balance)];
    });

    doc.autoTable({
        startY: 50,
        head: [['Client Name', 'Quotation', 'Agreed', 'Received', 'Balance']],
        body: clientRows,
    });

    // Expenses Table
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text('Miscellaneous Expenses', 14, finalY);
    
    const expenseRows = financeData.expenses.map(e => [e.category, e.description, formatDate(e.date), formatCurrency(e.amount)]);
    
    doc.autoTable({
        startY: finalY + 5,
        head: [['Category', 'Description', 'Date', 'Amount']],
        body: expenseRows,
    });

    doc.save(`TC-Finance-Report-${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    // Clients Sheet
    const clientData = financeData.clients.map(c => {
        const payments = financeData.payments.filter(p => p.clientname === c.clientname);
        const received = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        return {
            'Client Name': c.clientname,
            'Quotation': parseFloat(c.quotationamount),
            'Agreed': parseFloat(c.agreedamount),
            'Received': received,
            'Balance': parseFloat(c.agreedamount) - received
        };
    });
    const clientWs = XLSX.utils.json_to_sheet(clientData);
    XLSX.utils.book_append_sheet(wb, clientWs, "Clients");
    
    // Expenses Sheet
    const expenseData = financeData.expenses.map(e => ({
        'Category': e.category,
        'Description': e.description,
        'Date': formatDate(e.date),
        'Amount': parseFloat(e.amount)
    }));
    const expenseWs = XLSX.utils.json_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, expenseWs, "Expenses");
    
    XLSX.writeFile(wb, `TC-Finance-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Helpers
function initExpenseFilters() {
    const today = new Date();
    expenseMonthFilter.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        expenseMonthFilter.appendChild(opt);
    }
}

function updateFinanceSelectors() {
    const select = document.getElementById('paymentClientSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Client</option>';
    financeData.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.clientname;
        opt.textContent = c.clientname;
        select.appendChild(opt);
    });
}

function renderEmployeeOptions() {
    const select = document.getElementById('taskAssignee');
    if (!select) return;
    select.innerHTML = '<option value="">Select Assignee</option>';
    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.name;
        opt.textContent = emp.name;
        select.appendChild(opt);
    });
}

function updateStats() {
    pendingCount.textContent = tasks.filter(t => t.status === 'Pending').length;
    progressCount.textContent = tasks.filter(t => t.status === 'In Progress').length;
    completedCount.textContent = tasks.filter(t => t.status === 'Completed').length;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

function getStatusClass(status) {
    switch (status) {
        case 'Pending': return 'bg-slate-100 text-slate-500';
        case 'In Progress': return 'bg-indigo-100 text-indigo-600';
        case 'Completed': return 'bg-emerald-100 text-emerald-600';
        default: return 'bg-slate-100 text-slate-500';
    }
}

function getPriorityColor(priority) {
    switch (priority) {
        case 'High': return 'bg-rose-500';
        case 'Medium': return 'bg-amber-500';
        case 'Low': return 'bg-emerald-500';
        default: return 'bg-slate-500';
    }
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    showLoading(true);
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteTask', id }) });
        fetchData();
    } catch (error) { console.error('Error deleting task:', error); }
    finally { showLoading(false); }
}

// Plan for the Day
document.getElementById('planBtn').onclick = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('planDateText').textContent = `${day}-${month}-${year}`;
    
    const planList = document.getElementById('planList');
    planList.innerHTML = '';
    
    const activeTasks = tasks.filter(t => t.status !== 'Completed');
    
    if (activeTasks.length === 0) {
        planList.innerHTML = '<p class="text-center text-white/40 py-10 font-medium">No active initiatives for today.</p>';
    } else {
        activeTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'flex items-center space-x-4 bg-white/5 border border-white/10 p-5 rounded-2xl';
            item.innerHTML = `
                <div class="w-2 h-10 rounded-full ${getPriorityColor(task.priority)}"></div>
                <div class="flex-grow">
                    <h4 class="font-bold text-white text-lg leading-tight">${task.name}</h4>
                    <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">${task.domain || 'General'} | ${task.institution || 'No Inst.'}</p>
                    <p class="text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">${task.assignee}</p>
                </div>
                <div class="text-[10px] font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 uppercase tracking-widest border border-indigo-500/30">
                    ${task.status === 'In Progress' ? 'Active' : task.status}
                </div>
            `;
            planList.appendChild(item);
        });
    }
    
    openModal('planModal');
};

document.getElementById('closePlanModal').onclick = () => closeModal('planModal');

// WhatsApp Sharing
document.getElementById('whatsappTextBtn').onclick = () => {
    const activeTasks = tasks.filter(t => t.status !== 'Completed');
    let text = `*Thesis Consultants - Plan for ${formatDate(new Date())}*\n\n`;
    
    if (activeTasks.length === 0) {
        text += "No active tasks today!";
    } else {
        activeTasks.forEach((t, i) => {
            text += `${i + 1}. *${t.name}* (${t.assignee}) - ${t.status}\n`;
        });
    }
    
    text += `\n_Developed by Werwoods Intelligence_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

document.getElementById('downloadImageBtn').onclick = () => {
    const area = document.getElementById('planCaptureArea');
    html2canvas(area).then(canvas => {
        const link = document.createElement('a');
        link.download = `TC-Plan-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
};

document.getElementById('directShareBtn').onclick = async () => {
    const area = document.getElementById('planCaptureArea');
    const canvas = await html2canvas(area);
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `TC-Plan-${new Date().toISOString().split('T')[0]}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Thesis Consultants - Daily Plan',
                    text: 'Here is the plan for today.'
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            alert('Your browser does not support direct file sharing. Please use the "Download" or "Copy to Clipboard" options.');
        }
    });
};

document.getElementById('copyClipboardBtn').onclick = async () => {
    const area = document.getElementById('planCaptureArea');
    const canvas = await html2canvas(area);
    canvas.toBlob(async (blob) => {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Image copied to clipboard!');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            alert('Failed to copy.');
        }
    });
};

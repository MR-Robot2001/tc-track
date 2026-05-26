// Replace with your Google Apps Script Web App URL after deployment
const API_URL = 'https://script.google.com/macros/s/AKfycbyQJ65GPlB8AZ4SY3FQsX27UfdM8y23Ryv53FdOaoYiaggaDhVC8Uihmo228gws87Sa9g/exec';

let tasks = [];
let employees = [];

// DOM Elements
const taskTableBody = document.getElementById('taskTableBody');
const noTasks = document.getElementById('noTasks');
const taskModal = document.getElementById('taskModal');
const planModal = document.getElementById('planModal');
const taskForm = document.getElementById('taskForm');
const loadingOverlay = document.getElementById('loadingOverlay');

// Counters
const pendingCount = document.getElementById('pendingCount');
const progressCount = document.getElementById('progressCount');
const completedCount = document.getElementById('completedCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
        alert('Please configure your Google Apps Script Web App URL in script.js');
    }
    fetchData();
});

// Fetch all data
async function fetchData() {
    showLoading(true);
    try {
        // In a real scenario, these would be two parallel fetch calls
        const taskRes = await fetch(`${API_URL}?action=getTasks`);
        tasks = await taskRes.json();
        
        const empRes = await fetch(`${API_URL}?action=getEmployees`);
        employees = await empRes.json();
        
        renderTasks();
        renderEmployeeOptions();
        updateStats();
    } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback for testing/demo if API is not yet linked
        if (API_URL.includes('YOUR_APPS')) {
            loadMockData();
        }
    } finally {
        showLoading(false);
    }
}

function loadMockData() {
    tasks = [
        { id: '1', name: 'Draft Methodology', assignee: 'Alice', status: 'In Progress', priority: 'High', duedate: '2024-05-30' },
        { id: '2', name: 'Literature Review', assignee: 'Bob', status: 'Completed', priority: 'Medium', duedate: '2024-05-28' },
        { id: '3', name: 'Data Analysis', assignee: 'Charlie', status: 'Pending', priority: 'High', duedate: '2024-06-05' }
    ];
    employees = [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' }
    ];
    renderTasks();
    renderEmployeeOptions();
    updateStats();
}

// UI Rendering
function renderTasks() {
    taskTableBody.innerHTML = '';
    if (tasks.length === 0) {
        noTasks.classList.remove('hidden');
        return;
    }
    noTasks.classList.add('hidden');

    tasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/80 transition-colors group';
        tr.innerHTML = `
            <td class="px-8 py-5">
                <div class="flex flex-col">
                    <span class="text-slate-900 font-semibold">${task.name}</span>
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: ${task.id.substring(0, 8)}</span>
                </div>
            </td>
            <td class="px-8 py-5">
                <div class="flex items-center space-x-2">
                    <div class="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                        ${task.assignee.charAt(0)}
                    </div>
                    <span class="text-sm font-medium text-slate-600">${task.assignee}</span>
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
                <span class="text-sm tabular-nums text-slate-500 font-medium">${formatDate(task.duedate)}</span>
            </td>
            <td class="px-8 py-5 text-right">
                <div class="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editTask('${task.id}')" class="p-2 hover:bg-indigo-50 text-indigo-500 rounded-lg transition-colors" title="Edit Initiative">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onclick="deleteTask('${task.id}')" class="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors" title="Delete Entry">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        taskTableBody.appendChild(tr);
    });
}

function renderEmployeeOptions() {
    const select = document.getElementById('taskAssignee');
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

// Modal Logic
document.getElementById('addTaskBtn').onclick = () => {
    document.getElementById('modalTitle').textContent = 'Add New Task';
    taskForm.reset();
    document.getElementById('taskId').value = '';
    taskModal.classList.remove('hidden');
};

document.getElementById('closeModal').onclick = () => taskModal.classList.add('hidden');

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('taskAssignee').value = task.assignee;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskPriority').value = task.priority;
    
    // Format date for input[type="date"]
    if (task.duedate) {
        const date = new Date(task.duedate);
        document.getElementById('taskDueDate').value = date.toISOString().split('T')[0];
    }
    
    taskModal.classList.remove('hidden');
}

// CRUD Operations
taskForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const taskData = {
        name: document.getElementById('taskName').value,
        assignee: document.getElementById('taskAssignee').value,
        status: document.getElementById('taskStatus').value,
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value
    };

    showLoading(true);
    try {
        const action = id ? 'updateTask' : 'addTask';
        const payload = id ? { action, task: { ...taskData, id } } : { action, task: taskData };
        
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        taskModal.classList.add('hidden');
        fetchData();
    } catch (error) {
        console.error('Error saving task:', error);
        // Mock update if no API
        if (id) {
            const idx = tasks.findIndex(t => t.id === id);
            tasks[idx] = { ...tasks[idx], ...taskData };
        } else {
            tasks.push({ ...taskData, id: Date.now().toString() });
        }
        taskModal.classList.add('hidden');
        renderTasks();
        updateStats();
    } finally {
        showLoading(false);
    }
};

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    showLoading(true);
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteTask', id })
        });
        fetchData();
    } catch (error) {
        console.error('Error deleting task:', error);
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
        updateStats();
    } finally {
        showLoading(false);
    }
}

// Plan for the Day
document.getElementById('planBtn').onclick = () => {
    const today = new Date();
    document.getElementById('planDateText').textContent = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
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
                    <p class="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">${task.assignee}</p>
                </div>
                <div class="text-[10px] font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 uppercase tracking-widest border border-indigo-500/30">
                    ${task.status === 'In Progress' ? 'Active' : task.status}
                </div>
            `;
            planList.appendChild(item);
        });
    }
    
    planModal.classList.remove('hidden');
};

document.getElementById('closePlanModal').onclick = () => planModal.classList.add('hidden');

// WhatsApp Sharing
document.getElementById('whatsappTextBtn').onclick = () => {
    const activeTasks = tasks.filter(t => t.status !== 'Completed');
    let text = `*Thesis Consultants - Plan for ${new Date().toLocaleDateString()}*\n\n`;
    
    if (activeTasks.length === 0) {
        text += "No active tasks today!";
    } else {
        activeTasks.forEach((t, i) => {
            text += `${i + 1}. *${t.name}* (${t.assignee}) - ${t.status}\n`;
        });
    }
    
    text += `\n_Developed by Werwoods_`;
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
                alert('Sharing failed. Try downloading the image instead.');
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
            alert('Image copied to clipboard! You can now paste (Ctrl+V) it directly into WhatsApp.');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            alert('Failed to copy. Your browser might not support copying images to the clipboard.');
        }
    });
};

// Helpers
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

function getPriorityBorder(priority) {
    switch (priority) {
        case 'High': return 'border-rose-500';
        case 'Medium': return 'border-amber-500';
        case 'Low': return 'border-emerald-500';
        default: return 'border-indigo-500';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

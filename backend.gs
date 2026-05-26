/**
 * TC Track - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Create a Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Create two sheets: "Tasks" and "Employees".
 * 5. Add headers to "Tasks": ID, Name, Assignee, Status, Priority, Due Date, Created At
 * 6. Add headers to "Employees": Name, Email, WhatsApp
 * 7. Deploy as a Web App (Access: Anyone).
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const TASKS_SHEET = "Tasks";
const EMPLOYEES_SHEET = "Employees";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getTasks") {
    return jsonResponse(getTasks());
  } else if (action === "getEmployees") {
    return jsonResponse(getEmployees());
  }
  
  return jsonResponse({ error: "Invalid action" });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === "addTask") {
    return jsonResponse(addTask(data.task));
  } else if (action === "updateTask") {
    return jsonResponse(updateTask(data.task));
  } else if (action === "deleteTask") {
    return jsonResponse(deleteTask(data.id));
  }
  
  return jsonResponse({ error: "Invalid action" });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTasks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header.toLowerCase().replace(" ", "")] = row[i];
    });
    return obj;
  });
}

function getEmployees() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMPLOYEES_SHEET);
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // Remove headers
  return rows.map(row => ({ name: row[0], email: row[1], whatsapp: row[2] }));
}

function addTask(task) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const id = Utilities.getUuid();
  const createdAt = new Date();
  sheet.appendRow([id, task.name, task.assignee, task.status, task.priority, task.dueDate, createdAt]);
  return { success: true, id: id };
}

function updateTask(task) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === task.id) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[task.name, task.assignee, task.status, task.priority, task.dueDate]]);
      return { success: true };
    }
  }
  return { success: false, error: "Task not found" };
}

function deleteTask(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Task not found" };
}

/**
 * Trigger this function daily (e.g., 8:00 AM - 9:00 AM)
 */
function sendDailyEmails() {
  const tasks = getTasks();
  const employees = getEmployees();
  const today = new Date().toLocaleDateString();
  
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  
  if (pendingTasks.length === 0) return;
  
  let taskListHtml = "<ul>";
  pendingTasks.forEach(t => {
    taskListHtml += `<li><strong>${t.name}</strong> - Assigned to: ${t.assignee} (Priority: ${t.priority})</li>`;
  });
  taskListHtml += "</ul>";
  
  const htmlBody = `
    <h2>Thesis Consultants - Daily Plan (${today})</h2>
    <p>Good morning! Here is the plan for today:</p>
    ${taskListHtml}
    <br>
    <p>Please update your progress on the <a href="YOUR_GITHUB_PAGES_URL">TC Track Dashboard</a>.</p>
    <p><em>Developed by Werwoods</em></p>
  `;
  
  employees.forEach(emp => {
    if (emp.email) {
      MailApp.sendEmail({
        to: emp.email,
        subject: `Daily Plan - Thesis Consultants (${today})`,
        htmlBody: htmlBody
      });
    }
  });
}

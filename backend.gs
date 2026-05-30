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
const CLIENTS_SHEET = "Finance_Clients";
const PAYMENTS_SHEET = "Finance_Payments";
const EXPENSES_SHEET = "Finance_Expenses";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getTasks") {
    return jsonResponse(getTasks());
  } else if (action === "getEmployees") {
    return jsonResponse(getEmployees());
  } else if (action === "getFinanceData") {
    return jsonResponse(getFinanceData());
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
  } else if (action === "addClient") {
    return jsonResponse(addClient(data.client));
  } else if (action === "updateClient") {
    return jsonResponse(updateClient(data.client));
  } else if (action === "addPayment") {
    return jsonResponse(addPayment(data.payment));
  } else if (action === "addExpense") {
    return jsonResponse(addExpense(data.expense));
  } else if (action === "deleteFinanceItem") {
    return jsonResponse(deleteFinanceItem(data.sheet, data.row));
  }
  
  return jsonResponse({ error: "Invalid action" });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTasks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      let key = header.toLowerCase().replace(/\s/g, "");
      if (key === "subtasks" && val) {
        try { val = JSON.parse(val); } catch(e) { val = []; }
      }
      obj[key] = val;
    });
    return obj;
  });
}

function getEmployees() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMPLOYEES_SHEET);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // Remove headers
  return rows.map(row => ({ name: row[0], email: row[1], whatsapp: row[2] }));
}

function getFinanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const clientsSheet = ss.getSheetByName(CLIENTS_SHEET);
  const paymentsSheet = ss.getSheetByName(PAYMENTS_SHEET);
  const expensesSheet = ss.getSheetByName(EXPENSES_SHEET);
  
  const clients = clientsSheet ? getSheetData(clientsSheet) : [];
  const payments = paymentsSheet ? getSheetData(paymentsSheet) : [];
  const expenses = expensesSheet ? getSheetData(expensesSheet) : [];
  
  return { clients, payments, expenses };
}

function getSheetData(sheet) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return rows.map((row, index) => {
    let obj = { _row: index + 2 };
    headers.forEach((header, i) => {
      let key = header.toLowerCase().replace(/\s/g, "");
      obj[key] = row[i];
    });
    return obj;
  });
}

function addTask(task) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const id = Utilities.getUuid();
  const createdAt = new Date();
  // Headers: ID, Name, Assignee, Status, Priority, Due Date, Created At, Description, Subtasks, Domain, Institution
  sheet.appendRow([
    id, 
    task.name, 
    task.assignee, 
    task.status, 
    task.priority, 
    task.dueDate, 
    createdAt, 
    task.description || "", 
    JSON.stringify(task.subtasks || []),
    task.domain || "",
    task.institution || ""
  ]);
  return { success: true, id: id };
}

function updateTask(task) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TASKS_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === task.id) {
      // ID, Name, Assignee, Status, Priority, Due Date, Created At, Description, Subtasks, Domain, Institution
      const range = sheet.getRange(i + 1, 2, 1, 10); // Name to Institution
      range.setValues([[
        task.name, 
        task.assignee, 
        task.status, 
        task.priority, 
        task.dueDate, 
        data[i][6], // Keep original Created At
        task.description || "", 
        JSON.stringify(task.subtasks || []),
        task.domain || "",
        task.institution || ""
      ]]);
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

function addClient(client) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CLIENTS_SHEET);
    sheet.appendRow(["Client Name", "Quotation Amount", "Agreed Amount", "Phases", "Extra Work"]);
  }
  sheet.appendRow([
    client.name, 
    client.quotation, 
    client.agreed, 
    JSON.stringify(client.phases || []),
    JSON.stringify(client.extraWork || [])
  ]);
  return { success: true };
}

function updateClient(client) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === client.name) {
      // Client Name, Quotation Amount, Agreed Amount, Phases, Extra Work
      const range = sheet.getRange(i + 1, 1, 1, 5);
      range.setValues([[
        client.name,
        client.quotation,
        client.agreed,
        JSON.stringify(client.phases || []),
        JSON.stringify(client.extraWork || [])
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: "Client not found" };
}

function addPayment(payment) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAYMENTS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(PAYMENTS_SHEET);
    sheet.appendRow(["Client Name", "Amount", "Date"]);
  }
  sheet.appendRow([payment.clientName, payment.amount, payment.date]);
  return { success: true };
}

function addExpense(expense) {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPENSES_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(EXPENSES_SHEET);
    sheet.appendRow(["Category", "Amount", "Date", "Description"]);
  }
  sheet.appendRow([expense.category, expense.amount, expense.date, expense.description]);
  return { success: true };
}

function deleteFinanceItem(sheetName, row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (sheet) {
    sheet.deleteRow(row);
    return { success: true };
  }
  return { success: false };
}

/**
 * Refactored to send personalized emails
 */
function sendDailyEmails() {
  const tasks = getTasks();
  const employees = getEmployees();
  const today = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
  
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  if (pendingTasks.length === 0) return;
  
  // Create global summary
  let summaryHtml = "<h3>Operational Summary (All Staff)</h3><ul>";
  const stats = {};
  pendingTasks.forEach(t => {
    stats[t.assignee] = (stats[t.assignee] || 0) + 1;
  });
  for (const [name, count] of Object.entries(stats)) {
    summaryHtml += `<li><strong>${name}</strong>: ${count} pending tasks</li>`;
  }
  summaryHtml += `<li><strong>TOTAL PENDING</strong>: ${pendingTasks.length}</li></ul>`;

  // Send personalized emails
  employees.forEach(emp => {
    if (!emp.email) return;
    
    const myTasks = pendingTasks.filter(t => t.assignee === emp.name);
    if (myTasks.length === 0) return; // Only send if they have tasks
    
    let myTaskListHtml = "<h3>Your Assigned Tasks</h3><ul>";
    myTasks.forEach(t => {
      let dueDateDisplay = "N/A";
      if (t.duedate) {
        dueDateDisplay = t.duedate instanceof Date ? t.duedate.toLocaleDateString('en-GB') : new Date(t.duedate).toLocaleDateString('en-GB');
      }
      myTaskListHtml += `<li><strong>${t.name}</strong> (Priority: ${t.priority}, Due: ${dueDateDisplay})</li>`;
    });
    myTaskListHtml += "</ul>";
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #6366f1;">Thesis Consultants - Your Daily Briefing (${today})</h2>
        <p>Good morning <strong>${emp.name}</strong>, here are your active initiatives:</p>
        ${myTaskListHtml}
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        ${summaryHtml}
        <br>
        <p>Update your progress here: <a href="https://mr-robot2001.github.io/tc-track/" style="color: #6366f1;">TC Track Dashboard</a></p>
        <p style="font-size: 11px; color: #999;"><em>Developed by Werwoods Intelligence</em></p>
      </div>
    `;
    
    MailApp.sendEmail({
      to: emp.email,
      subject: `Daily Task Briefing - ${emp.name} (${today})`,
      htmlBody: htmlBody
    });
  });
}

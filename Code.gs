/**
 * Google Sheets REST API Web App
 * Provides API endpoints for goals, habit_stack, and daily_log tabs
 */

// Global variables
const SPREADSHEET_ID = '1aHsAKI_evClx-V9nKNmfQnia9Ti0sMZB2wfr_ar1t5w'; // Enter your Google Sheet ID here
const SHEET_NAMES = {
  GOALS: 'goals',
  HABIT_STACK: 'habit_stack',
  DAILY_LOG: 'daily_log'
};

// Expected column structures
const EXPECTED_COLUMNS = {
  GOALS: ['user_id', 'week_start', 'goal_1', 'goal_2', 'goal_3', 'goal_4', 'goal_5'],
  HABIT_STACK: ['user_id', 'habit_1', 'habit_2', 'habit_3', 'habit_4', 'habit_5', 'updated_at'],
  DAILY_LOG: ['user_id', 'date', 'habit_1_result', 'habit_2_result', 'habit_3_result', 'habit_4_result', 'habit_5_result', 'reflection']
};

/**
 * Validates that the sheet has the expected columns
 * @param {Array} headers - Actual headers from the sheet
 * @param {Array} expectedColumns - Expected column names
 * @param {string} sheetName - Name of the sheet being validated
 * @throws {Error} If required columns are missing
 */
function validateColumns(headers, expectedColumns, sheetName) {
  const missingColumns = expectedColumns.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns in ${sheetName} sheet: ${missingColumns.join(', ')}`);
  }
}

/**
 * Handles GET requests to the web app
 * @param {Object} e - Event object containing request parameters
 * @return {TextOutput} JSON response
 */
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    const userId = params.user_id;
    const weekStart = params.week_start;
    const date = params.date;
    
    let result = {};
    
    if (!action) {
      throw new Error('No action specified');
    }
    
    switch (action) {
      case 'getGoals':
        result = getGoals(userId, weekStart);
        break;
      case 'getHabitStack':
        result = getHabitStack(userId);
        break;
      case 'getDailyLog':
        result = getDailyLog(userId, date);
        break;
      default:
        throw new Error('Invalid action specified');
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles POST requests to the web app
 * @param {Object} e - Event object containing request parameters and payload
 * @return {TextOutput} JSON response
 */
function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    const payload = JSON.parse(e.postData.contents);
    
    let result = {};
    
    if (!action) {
      throw new Error('No action specified');
    }
    
    switch (action) {
      case 'addGoal':
        result = addGoal(payload);
        break;
      case 'addHabitStack':
        result = addHabitStack(payload);
        break;
      case 'addDailyLog':
        result = addDailyLog(payload);
        break;
      default:
        throw new Error('Invalid action specified');
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Gets goals for a specific user and optional week
 * @param {string} userId - User ID to filter by
 * @param {string} weekStart - Optional week start date (YYYY-MM-DD) to filter by
 * @return {Object} Goals data
 */
function getGoals(userId, weekStart) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.GOALS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.GOALS, SHEET_NAMES.GOALS);
  
  const userIdIndex = headers.indexOf('user_id');
  const weekStartIndex = headers.indexOf('week_start');
  
  const goals = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Filter by userId and optionally by weekStart
    if ((!userId || row[userIdIndex] === userId) && 
        (!weekStart || row[weekStartIndex] === weekStart)) {
      const goal = {};
      for (let j = 0; j < headers.length; j++) {
        goal[headers[j]] = row[j];
      }
      goals.push(goal);
    }
  }
  
  return { 
    success: true,
    data: goals 
  };
}

/**
 * Gets habit stack for a specific user
 * @param {string} userId - User ID to filter by
 * @return {Object} Habit stack data
 */
function getHabitStack(userId) {
  if (!userId) {
    throw new Error('user_id is required for getHabitStack');
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.HABIT_STACK);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.HABIT_STACK, SHEET_NAMES.HABIT_STACK);
  
  const userIdIndex = headers.indexOf('user_id');
  
  // For habit stack, we typically want the most recent entry for the user
  let mostRecentEntry = null;
  let mostRecentDate = null;
  const updatedAtIndex = headers.indexOf('updated_at');
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[userIdIndex] === userId) {
      const updatedAt = row[updatedAtIndex];
      if (!mostRecentDate || (updatedAt && new Date(updatedAt) > new Date(mostRecentDate))) {
        mostRecentDate = updatedAt;
        
        const habit = {};
        for (let j = 0; j < headers.length; j++) {
          habit[headers[j]] = row[j];
        }
        mostRecentEntry = habit;
      }
    }
  }
  
  if (!mostRecentEntry) {
    return {
      success: true,
      data: [] // No habit stack found for this user
    };
  }
  
  return { 
    success: true,
    data: [mostRecentEntry] 
  };
}

/**
 * Gets daily log entries for a specific user and optional date
 * @param {string} userId - User ID to filter by
 * @param {string} date - Optional date (YYYY-MM-DD) to filter by
 * @return {Object} Daily log data
 */
function getDailyLog(userId, date) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.DAILY_LOG);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.DAILY_LOG, SHEET_NAMES.DAILY_LOG);
  
  const userIdIndex = headers.indexOf('user_id');
  const dateIndex = headers.indexOf('date');
  
  const logs = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Filter by userId and optionally by date
    if ((!userId || row[userIdIndex] === userId) && 
        (!date || row[dateIndex] === date)) {
      const log = {};
      for (let j = 0; j < headers.length; j++) {
        log[headers[j]] = row[j];
      }
      logs.push(log);
    }
  }
  
  return { 
    success: true,
    data: logs 
  };
}

/**
 * Adds a new goal to the goals sheet
 * @param {Object} goalData - Goal data to add
 * @return {Object} Result with success status and added goal
 */
function addGoal(goalData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.GOALS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.GOALS, SHEET_NAMES.GOALS);
  
  // Validate required fields
  if (!goalData.user_id) {
    throw new Error('user_id is required');
  }
  
  if (!goalData.week_start) {
    throw new Error('week_start is required in YYYY-MM-DD format');
  }
  
  const rowData = [];
  for (const header of headers) {
    rowData.push(goalData[header] || '');
  }
  
  sheet.appendRow(rowData);
  
  return { 
    success: true,
    data: goalData 
  };
}

/**
 * Adds a new habit stack item to the habit_stack sheet
 * @param {Object} habitData - Habit stack data to add
 * @return {Object} Result with success status and added habit
 */
function addHabitStack(habitData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.HABIT_STACK);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.HABIT_STACK, SHEET_NAMES.HABIT_STACK);
  
  // Validate required fields
  if (!habitData.user_id) {
    throw new Error('user_id is required');
  }
  
  // Add updated_at timestamp if not provided
  if (!habitData.updated_at) {
    habitData.updated_at = new Date().toISOString();
  }
  
  const rowData = [];
  for (const header of headers) {
    rowData.push(habitData[header] || '');
  }
  
  sheet.appendRow(rowData);
  
  return { 
    success: true,
    data: habitData 
  };
}

/**
 * Adds a new daily log entry to the daily_log sheet
 * @param {Object} logData - Daily log data to add
 * @return {Object} Result with success status and added log
 */
function addDailyLog(logData) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAMES.DAILY_LOG);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Validate columns
  validateColumns(headers, EXPECTED_COLUMNS.DAILY_LOG, SHEET_NAMES.DAILY_LOG);
  
  // Validate required fields
  if (!logData.user_id) {
    throw new Error('user_id is required');
  }
  
  if (!logData.date) {
    throw new Error('date is required in YYYY-MM-DD format');
  }
  
  const rowData = [];
  for (const header of headers) {
    rowData.push(logData[header] || '');
  }
  
  sheet.appendRow(rowData);
  
  return { 
    success: true,
    data: logData 
  };
} 
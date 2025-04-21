/**
 * Process Goals API
 * Receives user goals, stores them in Google Sheets, and generates a habit stack
 */

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Google Sheets API endpoint from our deployment
const SHEETS_API_URL = process.env.SHEETS_API_URL || 'https://script.google.com/macros/s/AKfycbzX3k709iAZ1k0LN-EU_0UwJjDoGRPvXhpG0fUsYGH7_aHg6-OMB44cvbzuMRKRq90sRA/exec';

/**
 * Store user goals in the goals sheet
 * @param {Object} goalData - User goals data including user_id, week_start, and goal fields
 * @returns {Object} - Response from Google Sheets API
 */
async function storeGoals(goalData) {
  try {
    // Validate input
    if (!goalData || typeof goalData !== 'object') {
      throw new Error('Invalid goal data provided');
    }
    
    if (!goalData.user_id || !goalData.week_start) {
      throw new Error('Goal data must include user_id and week_start');
    }
    
    // Create payload for the goals sheet
    const payload = {
      user_id: goalData.user_id,
      week_start: goalData.week_start
    };
    
    // Map goal_1 through goal_5 fields
    for (let i = 1; i <= 5; i++) {
      const goalKey = `goal_${i}`;
      payload[goalKey] = goalData[goalKey] || '';
    }
    
    // Send to Google Sheets
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(
        `${SHEETS_API_URL}?action=addGoal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        throw new Error(`Google Sheets API error: ${response.status} ${statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data) {
        throw new Error('Empty response from Google Sheets API');
      }
      
      return data;
    } catch (apiError) {
      if (apiError.name === 'AbortError') {
        // Request timed out
        console.error('Google Sheets API timeout:', apiError);
        throw new Error('Google Sheets API request timed out');
      } else if (apiError.type === 'invalid-json') {
        // JSON parse error
        console.error('Invalid JSON from Google Sheets API:', apiError);
        throw new Error('Invalid response format from Google Sheets API');
      } else if (!apiError.response && apiError.message.includes('fetch failed')) {
        // Network error
        console.error('Google Sheets API network error:', apiError);
        throw new Error('Google Sheets API did not respond. Network or server issue.');
      } else {
        // Other errors
        console.error('Google Sheets API error:', apiError.message);
        throw new Error(`Google Sheets API error: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error storing goals:', error);
    throw error;
  }
}

/**
 * Generate habit stack from user goals using GPT-4
 * @param {Array} goals - Array of user goals (1-5 items)
 * @param {String} userId - User identifier
 * @returns {Object} - Habit stack with 2-3 habits
 */
async function generateHabitStackFromGoals(goals, userId) {
  try {
    // Validate input
    if (!Array.isArray(goals) || goals.length === 0 || goals.length > 5) {
      throw new Error('Goals must be an array with 1-5 items');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }
    
    // Format goals for the prompt
    const formattedGoals = goals.map((goal, index) => `${index + 1}. ${goal}`).join('\n');
    
    // Create prompt for GPT-4
    const prompt = `
I need to create a 2-3 step morning habit stack for a user based on their goals. 
Each habit should take under 5 minutes and support the overall intent of their goals.

USER'S GOALS:
${formattedGoals}

Please provide a short, targeted habit stack that would help them progress toward these goals.
Format your response as a JSON object with the following structure:
{
  "habit_1": "Brief description of habit 1 (under 5 minutes)",
  "habit_2": "Brief description of habit 2 (under 5 minutes)",
  "habit_3": "Brief description of habit 3 (under 5 minutes)" (optional)
}
Ensure each habit description is brief but clear, actionable, and takes less than 5 minutes to complete.
`;

    // Call OpenAI API
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4', // or 'gpt-4-turbo' depending on availability
            messages: [
              { 
                role: 'system', 
                content: 'You are a productivity assistant that creates short, actionable habit stacks.' 
              },
              { 
                role: 'user', 
                content: prompt 
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          }),
          signal: controller.signal
        }
      );
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        const errorBody = await response.text().catch(() => 'No error details');
        throw new Error(`OpenAI API error: ${response.status} ${statusText} - ${errorBody}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data || !data.choices || !data.choices[0]) {
        throw new Error('Unexpected OpenAI API response format');
      }
      
      // Extract the habit stack from the response
      const habitStackText = data.choices[0].message.content.trim();
      
      if (!habitStackText) {
        throw new Error('Empty response from OpenAI API');
      }
      
      // Parse the JSON response - handle potential JSON within markdown code blocks
      let habitStack;
      try {
        // First try direct JSON parsing
        habitStack = JSON.parse(habitStackText);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = habitStackText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            habitStack = JSON.parse(jsonMatch[1].trim());
          } catch (innerParseError) {
            console.error('Failed to parse JSON from code block:', innerParseError);
            throw new Error('Failed to parse GPT-4 response as JSON');
          }
        } else {
          console.error('Failed to parse JSON and no code block found:', parseError);
          throw new Error('Failed to parse GPT-4 response as JSON');
        }
      }
      
      // Ensure we have at least 2 habits
      if (!habitStack || !habitStack.habit_1 || !habitStack.habit_2) {
        throw new Error('GPT-4 response does not contain the required habit structure');
      }
      
      // Add user_id and updated_at fields
      habitStack.user_id = userId;
      habitStack.updated_at = new Date().toISOString();
      
      return habitStack;
    } catch (apiError) {
      if (apiError.name === 'AbortError') {
        // Request timed out
        console.error('OpenAI API timeout:', apiError);
        throw new Error('OpenAI API request timed out');
      } else if (apiError.type === 'invalid-json') {
        // JSON parse error
        console.error('Invalid JSON from OpenAI API:', apiError);
        throw new Error('Invalid response format from OpenAI API');
      } else if (!apiError.response && apiError.message.includes('fetch failed')) {
        // Network error
        console.error('OpenAI API network error:', apiError);
        throw new Error('OpenAI API did not respond. Network or server issue.');
      } else {
        // Try to detect rate limit or quota errors
        if (apiError.message.includes('rate limit')) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (apiError.message.includes('quota') || apiError.message.includes('insufficient_quota')) {
          throw new Error('OpenAI API quota exceeded.');
        }
        
        // Other errors
        console.error('OpenAI API error:', apiError.message);
        throw new Error(`OpenAI API error: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error generating habit stack:', error);
    throw error;
  }
}

/**
 * Store habit stack in Google Sheets via our API
 * @param {Object} habitStack - Habit stack to store
 * @returns {Object} - Response from Google Sheets API
 */
async function storeHabitStack(habitStack) {
  try {
    // Validate input
    if (!habitStack || typeof habitStack !== 'object') {
      throw new Error('Invalid habit stack provided');
    }
    
    if (!habitStack.user_id) {
      throw new Error('Habit stack must include user_id');
    }
    
    if (!habitStack.habit_1 || !habitStack.habit_2) {
      throw new Error('Habit stack must include at least habit_1 and habit_2');
    }
    
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(
        `${SHEETS_API_URL}?action=addHabitStack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(habitStack),
          signal: controller.signal
        }
      );
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        throw new Error(`Google Sheets API error: ${response.status} ${statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data) {
        throw new Error('Empty response from Google Sheets API');
      }
      
      return data;
    } catch (apiError) {
      if (apiError.name === 'AbortError') {
        // Request timed out
        console.error('Google Sheets API timeout:', apiError);
        throw new Error('Google Sheets API request timed out');
      } else if (apiError.type === 'invalid-json') {
        // JSON parse error
        console.error('Invalid JSON from Google Sheets API:', apiError);
        throw new Error('Invalid response format from Google Sheets API');
      } else if (!apiError.response && apiError.message.includes('fetch failed')) {
        // Network error
        console.error('Google Sheets API network error:', apiError);
        throw new Error('Google Sheets API did not respond. Network or server issue.');
      } else {
        // Other errors
        console.error('Google Sheets API error:', apiError.message);
        throw new Error(`Google Sheets API error: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error storing habit stack:', error);
    throw error;
  }
}

// Main endpoint to process goals
router.post('/process-goals', async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
    }
    
    const { user_id, week_start, goals, goal_1, goal_2, goal_3, goal_4, goal_5 } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: user_id',
        code: 'MISSING_USER_ID'
      });
    }
    
    if (!week_start) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: week_start',
        code: 'MISSING_WEEK_START'
      });
    }
    
    // Check week_start is in valid date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format for week_start. Expected YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT'
      });
    }
    
    // Determine goals from either the 'goals' array or individual goal fields
    let goalsList = [];
    
    if (Array.isArray(goals) && goals.length > 0) {
      goalsList = goals.slice(0, 5); // Take maximum 5 goals
    } else {
      // Collect from individual goal fields
      [goal_1, goal_2, goal_3, goal_4, goal_5].forEach(goal => {
        if (goal) goalsList.push(goal);
      });
    }
    
    if (goalsList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No goals provided',
        code: 'MISSING_GOALS'
      });
    }
    
    // Validate goal content
    for (let i = 0; i < goalsList.length; i++) {
      if (typeof goalsList[i] !== 'string' || goalsList[i].trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: `Goal at index ${i} is empty or invalid`,
          code: 'INVALID_GOAL'
        });
      }
    }
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
        code: 'API_CONFIG_ERROR'
      });
    }
    
    // Check for Google Sheets API URL
    if (!SHEETS_API_URL) {
      console.error('Google Sheets API URL not configured');
      return res.status(500).json({
        success: false,
        error: 'Google Sheets API URL not configured',
        code: 'API_CONFIG_ERROR'
      });
    }
    
    // Prepare data for storing goals in the goals sheet
    const goalData = {
      user_id,
      week_start
    };
    
    // Map goals to goal_1 through goal_5 fields
    goalsList.forEach((goal, index) => {
      goalData[`goal_${index + 1}`] = goal;
    });
    
    try {
      // 1. Store goals in the goals sheet
      const goalStorageResult = await storeGoals(goalData);
      
      // 2. Generate habit stack from goals
      const habitStack = await generateHabitStackFromGoals(goalsList, user_id);
      
      // 3. Store habit stack in the habit_stack sheet
      const habitStorageResult = await storeHabitStack(habitStack);
      
      // Return combined results
      res.json({
        success: true,
        goals_storage: goalStorageResult,
        habit_stack: habitStack,
        habit_storage: habitStorageResult
      });
    } catch (processingError) {
      console.error('Error in processing pipeline:', processingError);
      
      // Determine specific error type and appropriate status code
      let statusCode = 500;
      let errorCode = 'PROCESSING_ERROR';
      
      if (processingError.message.includes('Google Sheets')) {
        errorCode = 'GOOGLE_SHEETS_ERROR';
      } else if (processingError.message.includes('OpenAI') || 
                processingError.message.includes('GPT-4')) {
        errorCode = 'OPENAI_API_ERROR';
        
        // Handle specific OpenAI errors
        if (processingError.message.includes('rate limit')) {
          statusCode = 429;
          errorCode = 'RATE_LIMIT_ERROR';
        } else if (processingError.message.includes('quota')) {
          statusCode = 402;
          errorCode = 'QUOTA_ERROR';
        }
      }
      
      return res.status(statusCode).json({
        success: false,
        error: 'Error processing goals',
        details: processingError.message,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('Unexpected error processing goals:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

export default router; 
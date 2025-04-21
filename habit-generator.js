const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Google Sheets API endpoint from our deployment
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbzX3k709iAZ1k0LN-EU_0UwJjDoGRPvXhpG0fUsYGH7_aHg6-OMB44cvbzuMRKRq90sRA/exec';

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
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the habit stack from the response
    const habitStackText = response.data.choices[0].message.content.trim();
    
    // Parse the JSON response - handle potential JSON within markdown code blocks
    let habitStack;
    try {
      // First try direct JSON parsing
      habitStack = JSON.parse(habitStackText);
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = habitStackText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        habitStack = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error('Failed to parse GPT-4 response as JSON');
      }
    }
    
    // Ensure we have at least 2 habits
    if (!habitStack.habit_1 || !habitStack.habit_2) {
      throw new Error('GPT-4 response does not contain the required habit structure');
    }
    
    // Add user_id and updated_at fields
    habitStack.user_id = userId;
    habitStack.updated_at = new Date().toISOString();
    
    return habitStack;
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
    const response = await axios.post(
      `${SHEETS_API_URL}?action=addHabitStack`,
      habitStack,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error storing habit stack:', error);
    throw error;
  }
}

// Main endpoint to generate and store habit stack
app.post('/generate-habit-stack', async (req, res) => {
  try {
    const { goals, user_id } = req.body;
    
    if (!goals || !user_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: goals and user_id' 
      });
    }
    
    // Generate habit stack from goals
    const habitStack = await generateHabitStackFromGoals(goals, user_id);
    
    // Store habit stack in Google Sheets
    const storageResult = await storeHabitStack(habitStack);
    
    // Return the result
    res.json({
      success: true,
      habit_stack: habitStack,
      storage_result: storageResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Habit stack generator running on port ${PORT}`);
}); 
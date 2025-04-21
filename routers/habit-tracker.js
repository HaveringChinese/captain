/**
 * Habit Tracker Router
 * Handles endpoints for daily habit tracking and speech synthesis
 */

import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create router
const router = express.Router();

// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || process.env.GOOGLE_APPS_SCRIPT_URL;

// Fish Audio API settings
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_API_URL = 'https://api.fishaudio.com/v1/tts';
const FISH_AUDIO_VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || 'default';

/**
 * Get habit stack for a specific user
 * GET /api/habit-stack
 * User ID is taken from the authenticated user
 */
router.get('/habit-stack', async (req, res) => {
  try {
    // Get user ID from authenticated user
    const user_id = req.user.id;
    
    // Check for Google Apps Script URL
    if (!GOOGLE_SCRIPT_URL) {
      console.error('Google Apps Script URL not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Google Apps Script URL not configured',
        code: 'CONFIG_ERROR'
      });
    }
    
    console.log('GOOGLE_SCRIPT_URL:', GOOGLE_SCRIPT_URL);
    console.log('Constructed URL:', `${GOOGLE_SCRIPT_URL}?action=getHabitStack&user_id=${user_id}`);
    
    try {
      // Call Google Apps Script web app to get habit stack
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getHabitStack&user_id=${user_id}`, {
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        console.error(`Google Apps Script error: ${response.status} ${statusText}`);
        throw new Error(`Failed to fetch habit stack: ${response.status} ${statusText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Invalid JSON response from Google Apps Script');
      }
      
      // Validate data format
      if (!data) {
        throw new Error('Empty response from Google Apps Script');
      }
      
      // Check for API error responses
      if (data.error) {
        console.error('Google Apps Script returned error:', data.error);
        return res.status(500).json({
          success: false,
          error: 'Error from Google Apps Script',
          details: data.error,
          code: 'GOOGLE_SCRIPT_ERROR'
        });
      }
      
      return res.json(data);
    } catch (apiError) {
      console.error('API request error:', apiError);
      
      // Determine error type for better client feedback
      let errorCode = 'API_ERROR';
      let statusCode = 500;
      let errorMessage = apiError.message || 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('ECONNRESET') || 
          errorMessage.includes('ETIMEDOUT')) {
        errorCode = 'CONNECTION_ERROR';
        errorMessage = 'Could not connect to Google Apps Script. Please try again later.';
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        errorMessage = 'Request to Google Apps Script timed out. Please try again later.';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('Error fetching habit stack:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch habit stack',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Submit daily log to Google Sheets
 * POST /api/daily-log
 * Body: { date, responses, reflection }
 * User ID is taken from the authenticated user
 */
router.post('/daily-log', async (req, res) => {
  try {
    // Check for valid request body
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
    }
    
    // Create payload with authenticated user ID
    const payload = {
      ...req.body,
      user_id: req.user.id
    };
    
    if (!payload.date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: date',
        code: 'MISSING_DATE'
      });
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT'
      });
    }
    
    // Check for Google Apps Script URL
    if (!GOOGLE_SCRIPT_URL) {
      console.error('Google Apps Script URL not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Google Apps Script URL not configured',
        code: 'CONFIG_ERROR'
      });
    }
    
    try {
      // Call Google Apps Script web app to save daily log
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=addDailyLog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        console.error(`Google Apps Script error: ${response.status} ${statusText}`);
        throw new Error(`Failed to submit daily log: ${response.status} ${statusText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Invalid JSON response from Google Apps Script');
      }
      
      // Validate data format
      if (!data) {
        throw new Error('Empty response from Google Apps Script');
      }
      
      // Check for API error responses
      if (data.error) {
        console.error('Google Apps Script returned error:', data.error);
        return res.status(500).json({
          success: false,
          error: 'Error from Google Apps Script',
          details: data.error,
          code: 'GOOGLE_SCRIPT_ERROR'
        });
      }
      
      return res.json(data);
    } catch (apiError) {
      console.error('API request error:', apiError);
      
      // Determine error type for better client feedback
      let errorCode = 'API_ERROR';
      let statusCode = 500;
      let errorMessage = apiError.message || 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('ECONNRESET') || 
          errorMessage.includes('ETIMEDOUT')) {
        errorCode = 'CONNECTION_ERROR';
        errorMessage = 'Could not connect to Google Apps Script. Please try again later.';
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        errorMessage = 'Request to Google Apps Script timed out. Please try again later.';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('Error submitting daily log:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit daily log',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Get TTS configuration
 * GET /api/tts-config
 */
router.get('/tts-config', (req, res) => {
  try {
    return res.json({
      success: true,
      useFishAudio: !!FISH_AUDIO_API_KEY,
      fishAudioVoiceId: FISH_AUDIO_VOICE_ID || 'default'
    });
  } catch (error) {
    console.error('Error getting TTS config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get TTS configuration',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Proxy endpoint for Fish Audio API
 * POST /api/tts/fish-audio
 * Body: { text }
 * User ID is taken from the authenticated user (for logging/tracking)
 */
router.post('/tts/fish-audio', async (req, res) => {
  try {
    // Check for valid request body
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
    }
    
    const { text } = req.body;
    const userId = req.user.id; // Get authenticated user ID for potential logging
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: text',
        code: 'MISSING_TEXT'
      });
    }
    
    if (!FISH_AUDIO_API_KEY) {
      console.error('Fish Audio API key not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Fish Audio API key not configured',
        code: 'CONFIG_ERROR'
      });
    }
    
    try {
      // Call Fish Audio API
      const response = await fetch(FISH_AUDIO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`
        },
        body: JSON.stringify({
          text,
          voice_id: FISH_AUDIO_VOICE_ID || 'default'
        }),
        timeout: 15000 // 15 second timeout for audio generation
      });
      
      // Log the TTS request for auditing/tracking
      console.log(`TTS request from user ${userId}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown error';
        console.error(`Fish Audio API error: ${response.status} ${statusText}`);
        
        // Determine appropriate response based on status code
        let errorCode = 'FISH_AUDIO_ERROR';
        let statusCode = response.status || 500;
        
        if (statusCode === 429) {
          errorCode = 'RATE_LIMIT_ERROR';
          return res.status(statusCode).json({
            success: false,
            error: 'Fish Audio API rate limit exceeded',
            code: errorCode
          });
        } else if (statusCode === 401 || statusCode === 403) {
          errorCode = 'AUTH_ERROR';
          return res.status(statusCode).json({
            success: false,
            error: 'Authentication error with Fish Audio API',
            code: errorCode
          });
        }
        
        throw new Error(`Fish Audio API error: ${response.status} ${statusText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing JSON response from Fish Audio API:', parseError);
        throw new Error('Invalid JSON response from Fish Audio API');
      }
      
      // Validate data format
      if (!data) {
        throw new Error('Empty response from Fish Audio API');
      }
      
      // Verify the audio_url is present
      if (!data.audio_url) {
        console.error('Fish Audio API response missing audio_url:', data);
        throw new Error('Fish Audio API response missing audio URL');
      }
      
      res.json({
        success: true,
        ...data
      });
    } catch (apiError) {
      console.error('Fish Audio API request error:', apiError);
      
      // Determine error type for better client feedback
      let errorCode = 'API_ERROR';
      let statusCode = 500;
      let errorMessage = apiError.message || 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('ECONNRESET') || 
          errorMessage.includes('ETIMEDOUT')) {
        errorCode = 'CONNECTION_ERROR';
        errorMessage = 'Could not connect to Fish Audio API. Please try again later.';
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        errorMessage = 'Request to Fish Audio API timed out. Please try again later.';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }
  } catch (error) {
    console.error('Error with Fish Audio TTS:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate speech',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

export default router; 
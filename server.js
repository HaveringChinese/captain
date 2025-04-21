/**
 * Voice Goals and Habit Stack Generator API Server
 * Consolidated server implementation
 */

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// Import route handlers
import processGoalsRouter from './process-goals.js';
import habitTrackerRouter from './routers/habit-tracker.js';
import createMotivationalPrompt from './motivational-prompts.js';
import authRoutes from './auth/authRoutes.js';
import User from './auth/userModel.js';
import { authenticate, validateUserId } from './auth/authMiddleware.js';

// Load environment variables
dotenv.config();

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // true allows any origin
  credentials: true // needed for cookies
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve JavaScript modules directly from root for frontend use
app.use('/tts-service.js', express.static(path.join(__dirname, 'tts-service.js')));
app.use('/voice-goals-input.js', express.static(path.join(__dirname, 'voice-goals-input.js')));
app.use('/daily-habit-tracker.js', express.static(path.join(__dirname, 'daily-habit-tracker.js')));

// Authentication routes
app.use('/api/auth', authRoutes);

// API routes using imported routers
// Add authentication middleware to API routes
app.use('/api', processGoalsRouter);

// Add authentication and user validation to habit tracker routes
app.use('/api', authenticate, habitTrackerRouter);

// Endpoint for generating motivational feedback
app.post('/api/motivational-feedback', authenticate, validateUserId, async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
    }
    
    // Instead of expecting a pre-built prompt, expect the habit data
    const { 
      habits, 
      responses, 
      streaks, 
      reflection,
      streak,
      totalDays,
      user_id 
    } = req.body;
    
    // Ensure user_id matches authenticated user
    if (user_id && user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource',
        code: 'PERMISSION_DENIED'
      });
    }
    
    // Validate required fields
    if (!habits || !responses || !Array.isArray(habits) || !Array.isArray(responses) || habits.length === 0 || responses.length !== habits.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid habits and responses arrays are required',
        code: 'INVALID_HABIT_DATA'
      });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured in environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured',
        code: 'API_CONFIG_ERROR'
      });
    }
    
    try {
      // Create the prompt using the consolidated function
      const habitData = {
        habits,
        responses,
        streaks: streaks || [],
        reflection: reflection || '',
        streak: streak || 0,
        totalDays: totalDays || 0
      };
      
      // Generate the prompt
      const promptData = createMotivationalPrompt(habitData);
      
      // Log for debugging (optional)
      console.log('Generated motivational prompt for user:', req.user.id);
      
      // Call OpenAI with the generated prompt
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: promptData.system
          },
          {
            role: 'user',
            content: promptData.user
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });
      
      // Check if the response has the expected structure
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Unexpected response format from OpenAI API');
      }
      
      const feedback = response.choices[0].message.content.trim();
      
      // Return success response
      res.json({
        success: true,
        feedback
      });
      
    } catch (apiError) {
      // Handle specific OpenAI API errors
      console.error('OpenAI API error:', apiError);
      let statusCode = 500;
      let errorCode = 'OPENAI_API_ERROR';
      
      // Attempt to detect rate limit or quota errors
      if (apiError.message && apiError.message.includes('rate limit')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT_ERROR';
      } else if (apiError.message && apiError.message.includes('quota')) {
        statusCode = 402;
        errorCode = 'QUOTA_ERROR';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: 'Failed to generate feedback',
        details: apiError.message,
        code: errorCode
      });
    }
    
  } catch (error) {
    // Generic error handler for unexpected errors
    console.error('Error generating motivational feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate feedback',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'voice-goals-demo.html'));
});

app.get('/habit-checkin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/habit-checkin.html'));
});

// Add login and register pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/register.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`View the demo at http://localhost:${PORT}`);
}); 
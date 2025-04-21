# Daily Habit Tracker

A voice-powered daily habit check-in system that helps users track their progress with habit stacks. This system allows users to verbally respond to daily habit prompts, provides audio feedback, and logs the responses to Google Sheets.

## Features

- **Voice-Driven Interaction**: Speak your responses ("yes", "no", or "skip") to daily habit check-in questions
- **Text-to-Speech Feedback**: Habits are read aloud using Fish Audio API (or Web Speech API as fallback)
- **Daily Progress Tracking**: Record your daily progress for each habit in your stack
- **Reflection Capture**: Add an optional verbal reflection on your day's progress
- **Google Sheets Integration**: All data is stored in Google Sheets for easy tracking and analysis

## System Components

The habit tracker consists of several integrated components:

1. **Frontend JavaScript Module** (`daily-habit-tracker.js`):
   - Manages the voice interaction flow
   - Speaks habits using TTS
   - Listens for verbal responses
   - Processes and submits daily logs

2. **Node.js Backend** (`update-server.js`):
   - Provides API endpoints for fetching habit stacks and submitting logs
   - Proxies Fish Audio API requests to protect API keys
   - Connects to Google Apps Script for Google Sheets integration

3. **Google Apps Script** (`google-apps-script-daily-log.js`):
   - Provides web API to access Google Sheets
   - Retrieves habit stacks for specific users and dates
   - Logs daily progress to the spreadsheet
   - Handles data validation and formatting

4. **Demo Interface** (`daily-habit-tracker-demo.html`):
   - Provides a user interface for the habit tracker
   - Demonstrates the voice interaction flow
   - Shows visual feedback of the habit tracking process

## Setup Instructions

### 1. Google Sheets Setup

1. Create a new Google Sheet with two tabs: `habit_stack` and `daily_log`

2. Set up the `habit_stack` tab with these columns:
   - `user_id`: Unique identifier for each user
   - `week_start`: Date marking the start of the week (Sunday in YYYY-MM-DD format)
   - `habit_1` through `habit_5`: The habit descriptions

3. Set up the `daily_log` tab with these columns:
   - `user_id`: Unique identifier for each user
   - `date`: The date of the log entry (YYYY-MM-DD format)
   - `habit_1_response` through `habit_5_response`: User responses ("yes", "no", or "skip")
   - `reflection`: Optional user reflection text

### 2. Google Apps Script Setup

1. In your Google Sheet, go to **Extensions** > **Apps Script**

2. Create a new script file and paste the contents of `google-apps-script-daily-log.js`

3. Update the `SPREADSHEET_ID` constant with your Google Sheet's ID (found in its URL)

4. Deploy the script as a web app:
   - Click **Deploy** > **New deployment**
   - Select **Web app** as the type
   - Set **Who has access** to appropriate level (anyone for public use)
   - Click **Deploy** and copy the web app URL

### 3. Node.js Backend Setup

1. Add the Google Apps Script web app URL to your environment variables:
   ```
   GOOGLE_SCRIPT_URL=your_google_apps_script_web_app_url_here
   ```

2. If using Fish Audio API, add your API key to environment variables:
   ```
   FISH_AUDIO_API_KEY=your_fish_audio_api_key_here
   FISH_AUDIO_VOICE_ID=your_preferred_voice_id
   ```

3. Import the habit tracker router in your server.js file:
   ```javascript
   import habitTrackerRouter from './update-server.js';
   app.use('/api', habitTrackerRouter);
   ```

### 4. Frontend Integration

1. Add the `daily-habit-tracker.js` module to your project

2. Create a UI that incorporates the tracker, or use the demo HTML as a starting point

3. Initialize the tracker with appropriate options:
   ```javascript
   const habitTracker = new DailyHabitTracker({
     habitStackEndpoint: '/api/habit-stack',
     dailyLogEndpoint: '/api/daily-log',
     userId: 'your_user_id',
     // Add other options and callbacks as needed
   });
   ```

## Usage

1. Start the habit tracking session:
   ```javascript
   habitTracker.startDailyCheck();
   ```

2. The system will:
   - Fetch the user's current habit stack from Google Sheets
   - Read each habit aloud using TTS
   - Listen for verbal responses ("yes", "no", or "skip")
   - Record responses in memory
   - Ask for an optional verbal reflection
   - Submit all data to Google Sheets

## API Reference

### DailyHabitTracker Class

```javascript
const tracker = new DailyHabitTracker({
  // API endpoints
  habitStackEndpoint: '/api/habit-stack',
  dailyLogEndpoint: '/api/daily-log',
  
  // User identification
  userId: 'user123',
  
  // DOM elements (optional)
  startButtonId: 'startButton',
  statusElementId: 'status',
  habitListElementId: 'habitList',
  reflectionElementId: 'reflection',
  
  // Callbacks
  onStart: () => {},
  onComplete: (result) => {},
  onHabitRead: (habit) => {},
  onHabitResponse: (habit, response) => {},
  onStatusUpdate: (message) => {},
  onError: (error) => {}
});
```

### Backend API Endpoints

- **GET /api/habit-stack**: Get habit stack for a user and date
  - Query params: `user_id`, `date` (YYYY-MM-DD)
  
- **POST /api/daily-log**: Submit daily log
  - Body: `{ user_id, date, responses: { habit_1: "yes", ... }, reflection }`
  
- **GET /api/tts-config**: Get TTS configuration
  
- **POST /api/tts/fish-audio**: Proxy for Fish Audio API
  - Body: `{ text }`

## Customization

### Custom TTS Provider

The system is designed to work with multiple TTS providers. By default, it supports:

1. Fish Audio API (preferred for quality)
2. Web Speech API (fallback)

To add support for another TTS provider, extend the TTSService class with a new provider implementation.

### Additional Habit Response Options

The current system recognizes "yes", "no", and "skip" responses. You can modify the `handleSpeechResult` method in the `DailyHabitTracker` class to support additional response types if needed.

## Troubleshooting

- **Browser Support**: Make sure you're using a browser that supports the Web Speech API (Chrome, Edge, Safari)
- **Microphone Access**: Allow microphone access when prompted by the browser
- **Google Sheets Issues**: Check that your Google Apps Script is deployed correctly and accessible
- **API Connectivity**: Verify all API endpoints are configured correctly

## Privacy & Security Considerations

- The system processes voice data in the browser using the Web Speech API
- Voice data is not stored but the transcribed responses are sent to Google Sheets
- Fish Audio API communications are proxied through your server to protect API keys 
# Voice Goals to Habit Stack Generator

A web application that uses the Web Speech API to capture voice input of user goals, processes them with GPT-4, and generates a habit stack. Both the goals and habit stack are stored in Google Sheets.

## Overview

This application combines several technologies:

1. **Voice Input**: Uses the Web Speech API to record and transcribe the user's voice
2. **Natural Language Processing**: Extracts 1-5 goals from the voice transcript
3. **AI-Generated Habits**: Sends the goals to GPT-4 to create a 2-3 step habit stack
4. **Data Storage**: Stores both goals and habits in Google Sheets via the Google Apps Script API

## Project Structure

- `voice-goals-input.js`: Frontend JavaScript module for voice recognition
- `voice-goals-demo.html`: Demo interface for the voice input module
- `server.js`: Main server file that handles routing
- `process-goals.js`: API endpoint for processing goals and generating habit stacks
- `.env`: Environment variables configuration
- `package.json`: Node.js dependencies

## Prerequisites

- Node.js and npm installed
- OpenAI API key
- Google Sheet set up with the goals and habit_stack tabs
- Google Apps Script API deployed (see README.md for the Google Apps Script setup)
- Modern browser with Web Speech API support (Chrome recommended)

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
4. Update the `.env` file with your OpenAI API key and Google Sheets API URL
5. Start the server:
   ```
   npm start
   ```
6. Open your browser to http://localhost:3000

## How It Works

### Voice Processing

1. User clicks "Start Recording" and speaks their goals
2. The Web Speech API captures and transcribes the speech
3. The transcript is processed to extract distinct goals

### Goal Processing

1. The extracted goals are sent to the backend API
2. Goals are stored in the "goals" tab of the Google Sheet
3. Goals are sent to GPT-4 to generate a habit stack
4. The habit stack is stored in the "habit_stack" tab
5. The complete results are returned to the frontend

## API Endpoints

### Process Goals

```
POST /api/process-goals
```

Request body:
```json
{
  "user_id": "user123",
  "week_start": "2023-08-01",
  "goals": [
    "Read 12 books this year",
    "Exercise 3 times a week",
    "Learn Spanish"
  ]
}
```

Response:
```json
{
  "success": true,
  "goals_storage": {
    "success": true,
    "data": {
      "user_id": "user123",
      "week_start": "2023-08-01",
      "goal_1": "Read 12 books this year",
      "goal_2": "Exercise 3 times a week",
      "goal_3": "Learn Spanish",
      "goal_4": "",
      "goal_5": ""
    }
  },
  "habit_stack": {
    "user_id": "user123",
    "habit_1": "Read one page from a book",
    "habit_2": "Do 10 jumping jacks",
    "habit_3": "Practice one Spanish word or phrase",
    "updated_at": "2023-08-01T12:34:56.789Z"
  },
  "habit_storage": {
    "success": true,
    "data": {
      "user_id": "user123",
      "habit_1": "Read one page from a book",
      "habit_2": "Do 10 jumping jacks",
      "habit_3": "Practice one Spanish word or phrase",
      "updated_at": "2023-08-01T12:34:56.789Z"
    }
  }
}
```

## Browser Support

The Voice Goals to Habit Stack Generator relies on the Web Speech API, which has varying levels of support across browsers:

- Chrome: Full support
- Edge: Good support
- Firefox: Partial support
- Safari: Limited support

For the best experience, use Google Chrome or Microsoft Edge.

## Next Steps and Improvements

- Add user authentication
- Implement historical goal and habit tracking
- Add visualizations for progress over time
- Improve voice recognition for different accents
- Add mobile-responsive UI 
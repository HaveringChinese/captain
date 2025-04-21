# Frontend JavaScript Modules

This directory contains the frontend JavaScript modules used in the Voice Goals to Habit Stack application.

## Files

- **habit-voice-feedback.js**: Module that handles text-to-speech feedback for habit stacks. It formats habit stack data for speech, manages playback controls, and handles fallback text display.

## Features

- Communicates with the TTS service
- Manages UI state for audio playback
- Provides error handling and fallbacks
- Formats habit stack data for natural-sounding speech

## Integration

These modules are loaded via ES modules in the voice-goals-demo.html file:

```javascript
import HabitVoiceFeedback from './public/js/habit-voice-feedback.js';
```

## Directory Structure

```
public/
  ├── js/
  │   ├── habit-voice-feedback.js
  │   └── README.md
  └── ... (other static assets)
``` 
# Voice Feedback for Habit Stacks

This module adds spoken feedback to the habit stack generator, using text-to-speech (TTS) to read the generated habit stack out loud. This creates a more engaging and personalized experience for users.

## Features

- Uses Fish Audio API with custom voice clone as the primary TTS provider
- Falls back to Web Speech API if Fish Audio fails
- Handles errors gracefully with visual fallbacks
- Provides a modular architecture for easy swapping of TTS providers
- Aligns with behavior change principles:
  - Goal setting via voice input
  - Self-monitoring via Google Sheet storage
  - Feedback/reinforcement via spoken habit stack

## Implementation

The voice feedback system consists of three main components:

### 1. TTS Service (tts-service.js)

A modular service that provides a unified interface for different TTS providers:

- `TTSService`: Main service that manages providers and handles playback
- `FishAudioProvider`: Primary provider using Fish Audio API with custom voice
- `WebSpeechProvider`: Fallback provider using built-in browser TTS

### 2. Habit Voice Feedback (habit-voice-feedback.js)

A module that generates spoken feedback from habit stacks:

- Formats habit stack data for natural-sounding speech
- Manages UI state for playback controls
- Handles error cases with text fallbacks
- Provides hooks for custom behavior

### 3. Server Integration (server.js)

Backend support for securely using the Fish Audio API:

- Proxy endpoint to protect API key
- Configuration endpoint for frontend initialization
- Environment variable management

## Security Considerations

- Fish Audio API key is never exposed to the frontend
- All API calls to Fish Audio are made through a server proxy
- Configuration is dynamically provided to the frontend

## Usage

```javascript
// Initialize the voice feedback module
const habitVoiceFeedback = new HabitVoiceFeedback({
  playButtonId: 'playHabitButton',
  stopButtonId: 'stopHabitButton',
  feedbackTextId: 'feedbackText',
  statusElementId: 'audioStatus'
});

// When a habit stack is generated, pass it to the feedback module
habitVoiceFeedback.setHabitStack(habitStackData);

// Play the habit stack feedback
habitVoiceFeedback.playHabitStack();
```

## Configuration

### Environment Variables

```
# Fish Audio API (for text-to-speech with custom voice)
FISH_AUDIO_API_KEY=your_fish_audio_api_key_here
FISH_AUDIO_VOICE_ID=your_custom_voice_id_here
```

### Customizing the Feedback

The feedback text can be customized by extending the `HabitVoiceFeedback` class and overriding the `getFeedbackText` method:

```javascript
class CustomHabitVoiceFeedback extends HabitVoiceFeedback {
  getFeedbackText() {
    // Custom text formatting logic here
    return customFormattedText;
  }
}
```

## Browser Compatibility

- **Fish Audio API**: Works in all modern browsers that support fetch and audio playback
- **Web Speech API**: Varies by browser
  - Chrome: Full support
  - Edge: Good support
  - Firefox: Partial support
  - Safari: Limited support

## Extension Points

The system is designed to be extended in various ways:

1. **Additional TTS providers**: Add new provider classes to `tts-service.js`
2. **Custom voice models**: Update the Fish Audio configuration
3. **Different feedback formats**: Customize the text generation in `habit-voice-feedback.js`
4. **Additional audio effects**: Extend the audio handling in `TTSService`

## Demo

The demo showcases how voice input can be combined with spoken feedback to create a seamless, voice-driven experience for setting goals and receiving personalized habit recommendations. 
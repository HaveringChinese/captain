# Adding Confirmation and Editing to Voice Input System

## Overview

This document outlines the changes needed to enhance the voice goals system with:
1. Confirmation of transcribed goals before sending to the backend
2. Ability to edit goals if the transcription is incorrect
3. TTS feedback to read back detected goals for verification

## Implementation Plan

### 1. Add Confirmation Step

Modify the `VoiceGoalsInput` class to:
- Pause after transcription before sending to backend
- Add a confirmation state to the workflow
- Use TTS to read back detected goals

```javascript
// In voice-goals-input.js
handleEnd(event) {
  this.isListening = false;
  this.onStopListening(event);
  
  // Get the final transcript
  const finalTranscript = this.lastResults.join(' ');
  
  // Process the transcript into goals
  if (finalTranscript.trim().length > 0) {
    const goals = this.processTranscriptIntoGoals(finalTranscript);
    
    // Instead of sending immediately, call a confirmation method
    this.requestConfirmation(finalTranscript, goals);
  }
}

// New method for confirmation
requestConfirmation(transcript, goals) {
  // Call back with the processed goals, but don't send to backend yet
  this.onFinalResult({
    transcript: transcript,
    goals: goals,
    requiresConfirmation: true
  });
}

// Add a new method to send when confirmed
sendConfirmedGoals(goals) {
  // Now send to backend when user confirms
  this.sendGoalsToBackend(goals)
    .then(response => {
      this.onResult(response);
    })
    .catch(error => {
      this.onError({
        error: 'process_error',
        message: 'Error processing goals: ' + error.message
      });
    });
}
```

### 2. Update UI for Editing

Modify the HTML/UI to:
- Display editable goal fields
- Add confirmation and edit buttons
- Show a clear confirmation state

```html
<!-- In voice-goals-demo.html, add to the goals section -->
<div class="goals">
  <h3>Detected Goals</h3>
  <div id="goalsConfirmation" style="display: none;">
    <p>I detected these goals. Are they correct?</p>
    <div id="editableGoals">
      <!-- Goals will be added here as editable inputs -->
    </div>
    <div class="confirmation-controls">
      <button id="confirmGoalsButton">Yes, Proceed</button>
      <button id="editGoalsButton">Edit Goals</button>
    </div>
  </div>
  <ul id="goalsList"></ul>
</div>
```

### 3. Use TTS for Confirmation

Use the existing TTS system to read back detected goals:

```javascript
// In voice-goals-demo.html, update the onFinalResult handler

onFinalResult: (result) => {
  // Display the detected goals
  goalsList.innerHTML = '';
  editableGoalsDiv.innerHTML = '';
  
  result.goals.forEach((goal, index) => {
    // Add to regular display
    const li = document.createElement('li');
    li.textContent = goal;
    goalsList.appendChild(li);
    
    // Add as editable field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = goal;
    input.className = 'editable-goal';
    input.id = `goal-${index}`;
    editableGoalsDiv.appendChild(input);
  });
  
  if (result.requiresConfirmation) {
    // Show confirmation UI
    goalsConfirmationDiv.style.display = 'block';
    
    // Read back goals for confirmation
    const confirmationText = 'I detected these goals: ' + 
      result.goals.map((goal, i) => `Goal ${i+1}: ${goal}`).join('. ') +
      '. Are these correct?';
    
    habitVoiceFeedback.speakText(confirmationText);
  }
}
```

### 4. Add Confirmation Handlers

Add event handlers for the confirmation buttons:

```javascript
// In voice-goals-demo.html
confirmGoalsButton.addEventListener('click', () => {
  // Hide confirmation UI
  goalsConfirmationDiv.style.display = 'none';
  
  // Get the goals (potentially edited)
  const confirmedGoals = Array.from(
    document.querySelectorAll('.editable-goal')
  ).map(input => input.value.trim()).filter(Boolean);
  
  // Send the confirmed goals
  voiceGoalsInput.sendConfirmedGoals(confirmedGoals);
  
  // Show loading
  loadingElement.style.display = 'block';
});

editGoalsButton.addEventListener('click', () => {
  // Focus on first goal for editing
  document.querySelector('.editable-goal')?.focus();
});
```

### 5. Add Method to HabitVoiceFeedback

Add a method to speak any text, not just habit stacks:

```javascript
// In habit-voice-feedback.js
async speakText(text) {
  if (!this.isInitialized) {
    await this.initialize();
  }
  
  if (!text) {
    return;
  }
  
  try {
    await this.ttsService.speak(text);
  } catch (error) {
    console.error('Failed to speak text:', error);
    this.onError(error);
  }
}
```

## User Flow After Implementation

1. User speaks their goals
2. Speech is transcribed and processed into distinct goals
3. System displays goals in editable format
4. TTS reads back: "I detected these goals: Goal 1: [goal]. Goal 2: [goal]. Are these correct?"
5. User can either:
   - Confirm the goals are correct and proceed
   - Edit the goals directly in the interface before confirming
6. After confirmation, goals are sent to backend for habit stack generation
7. Habit stack is generated and presented with TTS as before

## Benefits

- Reduces errors from speech recognition mistakes
- Provides explicit user control over the input
- Increases user confidence in the system
- Creates a more interactive, conversational experience 
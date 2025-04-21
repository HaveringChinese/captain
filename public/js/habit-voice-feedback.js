/**
 * Habit Voice Feedback Module
 * Provides spoken feedback of habit stacks using TTS
 */

import { TTSService, WebSpeechProvider, FishAudioProvider } from '/tts-service.js';

class HabitVoiceFeedback {
  /**
   * Factory method to create and initialize a new HabitVoiceFeedback instance
   * @param {Object} options - Configuration options
   * @returns {Promise<HabitVoiceFeedback>} - Promise resolving to initialized instance
   */
  static async create(options = {}) {
    const instance = new HabitVoiceFeedback(options);
    await instance.initialize();
    return instance;
  }

  /**
   * Constructor for HabitVoiceFeedback
   * Note: This does not initialize the TTS service. 
   * Call initialize() after instantiation or use static create() method instead.
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.ttsService = null;
    this.habitStack = null;
    this.onError = options.onError || console.error;
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.isInitialized = false;
    
    // Default DOM element IDs
    this.elements = {
      playButton: options.playButtonId ? document.getElementById(options.playButtonId) : null,
      stopButton: options.stopButtonId ? document.getElementById(options.stopButtonId) : null,
      feedbackText: options.feedbackTextId ? document.getElementById(options.feedbackTextId) : null,
      statusElement: options.statusElementId ? document.getElementById(options.statusElementId) : null
    };
    
    // Configuration
    this.apiEndpoint = options.apiEndpoint || '/api/tts';
    this.userId = options.userId || null;
    this.authService = options.authService || null;
    this.voice = options.voice || null;
    
    // Callbacks
    this.onBeforeSpeak = options.onBeforeSpeak || (() => {});
    this.onAfterSpeak = options.onAfterSpeak || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onAuthRequired = options.onAuthRequired || (() => {
      this.onError({ 
        error: 'auth_required', 
        message: 'Authentication required. Please login first.' 
      });
    });

    // State
    this.status = 'idle';
    this.audio = null;
    this.canceller = null;
    this.currentHabitIndex = -1;
    
    // Note: initialization is no longer automatic
    // Call initialize() explicitly or use the static create() method
  }
  
  /**
   * Initialize the voice feedback module
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   * @throws {Error} If initialization fails
   */
  async initialize() {
    if (this.isInitialized) {
      return; // Already initialized
    }

    try {
      // Fetch TTS configuration from server
      const response = await fetch('/api/tts-config');
      if (!response.ok) {
        throw new Error('Failed to fetch TTS configuration');
      }
      
      const config = await response.json();
      
      // Create WebSpeech provider
      const webSpeechProvider = new WebSpeechProvider({
        voiceName: 'Google US English',
        fallbackVoiceName: 'en-US',
        onError: (error) => this.handleTTSError(error)
      });
      
      // Initialize providers array
      const providers = [webSpeechProvider];
      
      // Add Fish Audio provider if available
      if (config.useFishAudio) {
        const fishAudioProvider = new FishAudioProvider({
          proxyEndpoint: '/api/tts/fish-audio',
          voiceId: config.fishAudioVoiceId,
          onError: (error) => this.handleTTSError(error)
        });
        providers.push(fishAudioProvider);
      }
      
      // Initialize TTS service
      this.ttsService = new TTSService({
        providers: providers,
        defaultProvider: 'WebSpeech',
        onStart: () => this.handleTTSStart(),
        onEnd: () => this.handleTTSEnd(),
        onError: (error) => this.handleTTSError(error),
        onSuccess: () => this.handleTTSSuccess()
      });
      
      this.isInitialized = true;
      this.setupUI();
      
      return this; // Return this for method chaining
    } catch (error) {
      console.error('Failed to initialize voice feedback:', error);
      this.onError(error);
      throw error; // Re-throw to allow caller to handle initialization failures
    }
  }
  
  /**
   * Ensure the service is initialized
   * @private
   * @returns {Promise<void>} Promise that resolves when initialization is confirmed
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  /**
   * Set up UI controls if provided
   */
  setupUI() {
    if (this.elements.playButton) {
      this.elements.playButton.addEventListener('click', () => this.playHabitStack());
      this.elements.playButton.disabled = !this.habitStack;
    }
    
    if (this.elements.stopButton) {
      this.elements.stopButton.addEventListener('click', () => this.stopPlayback());
      this.elements.stopButton.disabled = true;
    }
  }
  
  /**
   * Set the habit stack to be used for feedback
   * @param {Object} habitStack - Habit stack object
   */
  setHabitStack(habitStack) {
    this.habitStack = habitStack;
    
    if (this.elements.playButton) {
      this.elements.playButton.disabled = !habitStack;
    }
    
    // Prepare the feedback text
    this.updateFeedbackText();
  }
  
  /**
   * Update the feedback text element with habit stack information
   */
  updateFeedbackText() {
    if (!this.elements.feedbackText || !this.habitStack) {
      return;
    }
    
    const habits = [];
    for (let i = 1; i <= 5; i++) {
      const habitKey = `habit_${i}`;
      if (this.habitStack[habitKey]) {
        habits.push(this.habitStack[habitKey]);
      }
    }
    
    if (habits.length === 0) {
      this.elements.feedbackText.textContent = 'No habits found in the habit stack.';
      return;
    }
    
    // Create feedback text
    let feedbackText = 'Based on your goals, here is your habit stack:';
    
    habits.forEach((habit, index) => {
      feedbackText += `\n${index + 1}. ${habit}`;
    });
    
    this.elements.feedbackText.textContent = feedbackText;
  }
  
  /**
   * Get formatted feedback text for TTS
   * @returns {string} - Formatted text for TTS
   */
  getFeedbackText() {
    if (!this.habitStack) {
      return '';
    }
    
    const habits = [];
    for (let i = 1; i <= 5; i++) {
      const habitKey = `habit_${i}`;
      if (this.habitStack[habitKey]) {
        habits.push(this.habitStack[habitKey]);
      }
    }
    
    if (habits.length === 0) {
      return 'No habits found in the habit stack.';
    }
    
    // Create feedback text with pauses for better TTS quality
    let feedbackText = 'Based on your goals, here is your habit stack. ';
    
    habits.forEach((habit, index) => {
      feedbackText += `Habit ${index + 1}. ${habit}. `;
    });
    
    feedbackText += 'Incorporate these habits into your morning routine to help achieve your goals.';
    
    return feedbackText;
  }
  
  /**
   * Play the habit stack feedback using TTS
   */
  async playHabitStack() {
    await this.ensureInitialized();
    
    if (!this.habitStack) {
      this.updateStatus('No habit stack available to play');
      return;
    }
    
    const feedbackText = this.getFeedbackText();
    if (!feedbackText) {
      this.updateStatus('No feedback text available');
      return;
    }
    
    try {
      await this.ttsService.speak(feedbackText);
    } catch (error) {
      console.error('Failed to play habit stack:', error);
      this.onError(error);
      
      // Show text as fallback
      this.updateStatus('Audio playback failed. Showing text feedback instead.');
      this.updateFeedbackText();
    }
  }
  
  /**
   * Speak arbitrary text using TTS
   * @param {string} text - The text to speak
   */
  async speakText(text) {
    await this.ensureInitialized();
    
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
  
  /**
   * Stop TTS playback
   */
  stopPlayback() {
    if (this.ttsService) {
      this.ttsService.stop();
    }
  }
  
  /**
   * Handle TTS start event
   */
  handleTTSStart() {
    this.updateStatus('Playing habit stack feedback...');
    this.onStart();
    
    if (this.elements.playButton) {
      this.elements.playButton.disabled = true;
    }
    
    if (this.elements.stopButton) {
      this.elements.stopButton.disabled = false;
    }
  }
  
  /**
   * Handle TTS end event
   */
  handleTTSEnd() {
    this.updateStatus('');
    this.onEnd();
    
    if (this.elements.playButton) {
      this.elements.playButton.disabled = false;
    }
    
    if (this.elements.stopButton) {
      this.elements.stopButton.disabled = true;
    }
  }
  
  /**
   * Handle TTS success event
   */
  handleTTSSuccess() {
    this.updateStatus('Habit stack feedback played successfully');
  }
  
  /**
   * Handle TTS error event
   * @param {Error} error - The error that occurred
   */
  handleTTSError(error) {
    console.error('TTS Error:', error);
    
    // Extract the error message
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Log detailed error information
    console.error('Full error details:', {
      name: error.name,
      message: errorMessage,
      stack: error.stack
    });
    
    // Map technical errors to user-friendly messages
    let userMessage = 'There was a problem generating audio feedback. Please try again later.';
    
    if (error.name === 'AbortError' || errorMessage.includes('timed out')) {
      userMessage = 'The request timed out. Please check your connection and try again.';
    } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
      userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('Authentication required') || error.message.includes('auth_required')) {
      userMessage = 'Authentication required. Please log in first.';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      userMessage = 'You have reached your usage limit. Please try again later.';
    } else if (error.message.includes('voice') && error.message.includes('not found')) {
      userMessage = 'The selected voice is not available. Please choose a different voice.';
    } else if (error.message.includes('Bad request')) {
      userMessage = 'There was an issue with the request. Please try a different habit or refresh the page.';
    } else if (error.message.includes('Server is busy')) {
      userMessage = 'Our servers are currently busy. Please try again in a few moments.';
    } else if (error.message.includes('Internal server error') || error.message.includes('Server error')) {
      userMessage = 'Our system is experiencing issues. The team has been notified and is working on a fix.';
    }
    
    // Update status with more user-friendly message
    this.updateStatus('error', userMessage);
    
    // Notify through callback
    this.onError({
      error: error.name || 'tts_error',
      message: userMessage,
      technical_details: errorMessage
    });
    
    // Reset state
    this.audio = null;
    this.canceller = null;
    
    // Update UI if we have elements
    if (this.elements) {
      if (this.elements.status) {
        this.elements.status.textContent = userMessage;
        this.elements.status.classList.add('error');
      }
      
      if (this.elements.playButton) {
        this.elements.playButton.disabled = false;
      }
      
      if (this.elements.stopButton) {
        this.elements.stopButton.disabled = true;
      }
      
      if (this.elements.spinner) {
        this.elements.spinner.style.display = 'none';
      }
    }
  }
  
  /**
   * Update status message
   * @param {string} message - Status message to display
   */
  updateStatus(message) {
    if (this.elements.statusElement) {
      this.elements.statusElement.textContent = message;
    }
  }

  /**
   * Get current user ID from auth service or options
   * @returns {string|null} The user ID or null if not available
   */
  getUserId() {
    // Try to get user ID from auth service first
    if (this.authService && typeof this.authService.getUserId === 'function') {
      const authUserId = this.authService.getUserId();
      if (authUserId) {
        return authUserId;
      }
    }
    
    // Fall back to options-provided userId
    return this.userId;
  }
  
  /**
   * Check if authenticated before performing an action
   * @returns {boolean} Whether the user is authenticated
   */
  checkAuthentication() {
    const userId = this.getUserId();
    
    if (!userId) {
      this.onAuthRequired();
      this.updateStatus('error', 'Authentication required. Please login first.');
      return false;
    }
    
    return true;
  }

  /**
   * Request TTS for a habit
   * @param {Object} habit - The habit object
   * @returns {Promise} - Promise resolving to the audio URL
   */
  async requestTTS(habit) {
    await this.ensureInitialized();
    
    if (!this.checkAuthentication()) {
      return null;
    }

    const userId = this.getUserId();
    
    try {
      this.updateStatus('processing', `Generating feedback for: ${habit.name}`);
      
      const controller = new AbortController();
      this.canceller = controller;
      
      // Set up authentication headers
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (this.authService && typeof this.authService.getAuthHeaders === 'function') {
        Object.assign(headers, this.authService.getAuthHeaders());
      }
      
      // Only select voice parameters if available
      const voiceParams = this.voice ? {
        voice_id: this.voice.id || '',
        voice_name: this.voice.name || '',
        voice_provider: this.voice.provider || 'system'
      } : {};
      
      // Prepare request payload
      const payload = {
        user_id: userId,
        habit: habit,
        ...voiceParams
      };
      
      // Set a timeout
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle authentication errors specifically
        if (response.status === 401) {
          this.onAuthRequired();
          throw new Error('Authentication required. Please log in first.');
        }
        
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (response.status === 400) {
          throw new Error(`Bad request: ${errorData.error || 'Invalid input'}`);
        } else if (response.status === 429) {
          throw new Error('Server is busy. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${errorData.error || 'Internal server error'}`);
        } else {
          throw new Error(`API error (${response.status}): ${errorData.error || response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      if (data && data.success === false) {
        throw new Error(data.error || 'Unknown API error');
      }
      
      return data.audio_url;
      
    } catch (error) {
      this.handleTTSError(error);
      return null;
    }
  }
}

export default HabitVoiceFeedback; 
/**
 * Daily Habit Tracker Module
 * Fetches today's habits, asks for verbal confirmation, and logs results to Google Sheets
 */

import { TTSService, WebSpeechProvider, FishAudioProvider } from './tts-service.js';

class DailyHabitTracker {
  constructor(options = {}) {
    // API endpoints
    this.habitStackEndpoint = options.habitStackEndpoint || '/api/habit-stack';
    this.dailyLogEndpoint = options.dailyLogEndpoint || '/api/daily-log';
    
    // User identification
    this.userId = options.userId || null;
    this.authService = options.authService || null;
    
    // Callbacks
    this.onStart = options.onStart || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onHabitRead = options.onHabitRead || (() => {});
    this.onHabitResponse = options.onHabitResponse || (() => {});
    this.onError = options.onError || console.error;
    this.onStatusUpdate = options.onStatusUpdate || console.log;
    this.onAuthRequired = options.onAuthRequired || (() => {
      this.handleError('Authentication required. Please login first.');
    });
    
    // DOM elements
    this.elements = {
      startButton: options.startButtonId ? document.getElementById(options.startButtonId) : null,
      statusElement: options.statusElementId ? document.getElementById(options.statusElementId) : null,
      habitListElement: options.habitListElementId ? document.getElementById(options.habitListElementId) : null,
      reflectionElement: options.reflectionElementId ? document.getElementById(options.reflectionElementId) : null
    };
    
    // State variables
    this.habitStack = null;
    this.responses = {};
    this.currentHabitIndex = 0;
    this.isProcessing = false;
    this.reflection = '';
    this.date = new Date();
    this.ttsService = null;
    this.recognition = null;
    
    // Initialize
    this.initTTS();
    this.initSpeechRecognition();
    this.setupEventListeners();
  }
  
  /**
   * Initialize the TTS service
   */
  async initTTS() {
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
        onError: (error) => this.handleError(error)
      });
      
      // Initialize providers array
      const providers = [webSpeechProvider];
      
      // Add Fish Audio provider if available
      if (config.useFishAudio) {
        const fishAudioProvider = new FishAudioProvider({
          proxyEndpoint: '/api/tts/fish-audio',
          voiceId: config.fishAudioVoiceId,
          onError: (error) => this.handleError(error)
        });
        providers.push(fishAudioProvider);
      }
      
      // Initialize TTS service with providers
      this.ttsService = new TTSService({
        providers: providers,
        defaultProvider: 'WebSpeech',
        onError: (error) => this.handleError(error)
      });
    } catch (error) {
      this.handleError('Failed to initialize TTS service: ' + error.message);
    }
  }
  
  /**
   * Initialize speech recognition
   */
  initSpeechRecognition() {
    // Initialize SpeechRecognition with browser compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.handleError('Speech recognition is not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    // Set up event handlers
    this.recognition.onresult = this.handleSpeechResult.bind(this);
    this.recognition.onerror = this.handleSpeechError.bind(this);
    this.recognition.onend = this.handleSpeechEnd.bind(this);
  }
  
  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {
    if (this.elements.startButton) {
      this.elements.startButton.addEventListener('click', () => this.startDailyCheck());
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
      return false;
    }
    
    return true;
  }
  
  /**
   * Start the daily habit check
   */
  async startDailyCheck() {
    if (this.isProcessing) return;
    
    // Check if user is authenticated
    if (!this.checkAuthentication()) {
      return;
    }
    
    this.isProcessing = true;
    this.onStart();
    this.updateStatus('Starting daily habit check...');
    
    try {
      // Fetch habit stack for today
      await this.fetchHabitStack();
      
      // Reset responses
      this.responses = {};
      this.currentHabitIndex = 0;
      
      // Process first habit
      this.processNextHabit();
    } catch (error) {
      this.handleError('Failed to start daily check: ' + error.message);
      this.isProcessing = false;
    }
  }
  
  /**
   * Fetch the habit stack for today from Google Sheets via API
   */
  async fetchHabitStack() {
    try {
      this.updateStatus('Fetching your habits for today...');
      
      const formattedDate = this.formatDate(this.date);
      const userId = this.getUserId();
      
      // Check if we have valid endpoint and user ID
      if (!this.habitStackEndpoint) {
        throw new Error('Habit stack API endpoint is not configured');
      }
      
      if (!userId) {
        throw new Error('User ID is not set. Please login first.');
      }
      
      try {
        // Set up authentication headers
        const headers = {};
        if (this.authService && typeof this.authService.getAuthHeaders === 'function') {
          Object.assign(headers, this.authService.getAuthHeaders());
        }
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
        
        const response = await fetch(
          `${this.habitStackEndpoint}?user_id=${userId}&date=${formattedDate}`,
          { 
            headers,
            credentials: 'include',
            signal: controller.signal 
          }
        );
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle authentication errors specifically
          if (response.status === 401) {
            this.onAuthRequired();
            throw new Error('Authentication required. Please log in first.');
          }
          
          // Try to get error details from the response
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          // Handle different HTTP status codes with user-friendly messages
          if (response.status === 400) {
            throw new Error(`Invalid request: ${errorData.error || 'Missing required parameters'}`);
          } else if (response.status === 404) {
            throw new Error('No habit stack found for today. Please create goals first.');
          } else if (response.status === 429) {
            throw new Error('Server is busy. Please try again later.');
          } else if (response.status >= 500) {
            throw new Error(`Server error: ${errorData.error || 'Internal server error'}`);
          } else {
            throw new Error(`API error (${response.status}): ${errorData.error || response.statusText}`);
          }
        }
        
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Invalid response format from server');
        }
        
        // Check for error in the response body (some APIs return 200 with error in body)
        if (data && data.success === false) {
          throw new Error(data.error || 'Unknown API error');
        }
        
        if (!data.habit_stack) {
          throw new Error('No habit stack found for today. Please create goals first.');
        }
        
        this.habitStack = data.habit_stack;
        
        // Display habit stack if UI element exists
        if (this.elements.habitListElement) {
          this.elements.habitListElement.innerHTML = '';
          for (let i = 1; i <= 5; i++) {
            const habitKey = `habit_${i}`;
            if (this.habitStack[habitKey]) {
              const li = document.createElement('li');
              li.textContent = this.habitStack[habitKey];
              li.dataset.habit = habitKey;
              li.className = 'habit-item';
              this.elements.habitListElement.appendChild(li);
            }
          }
        }
        
        this.updateStatus('Habits loaded for today.');
        return this.habitStack;
      } catch (networkError) {
        // Handle network/fetch specific errors
        if (networkError.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (networkError.message.includes('NetworkError') || 
                   networkError.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else {
          // Rethrow the error we caught above
          throw networkError;
        }
      }
    } catch (error) {
      this.handleError('Error fetching habit stack: ' + error.message);
      // Show error in UI
      this.updateStatus('Error: ' + error.message);
      throw error;
    }
  }
  
  /**
   * Process the next habit in the stack
   */
  async processNextHabit() {
    if (!this.habitStack) {
      this.updateStatus('No habit stack available.');
      this.isProcessing = false;
      return;
    }
    
    // Get all available habits
    const habits = [];
    for (let i = 1; i <= 5; i++) {
      const habitKey = `habit_${i}`;
      if (this.habitStack[habitKey]) {
        habits.push({ key: habitKey, text: this.habitStack[habitKey] });
      }
    }
    
    // Check if we've processed all habits
    if (this.currentHabitIndex >= habits.length) {
      // All habits processed, ask for reflection
      this.askForReflection();
      return;
    }
    
    const currentHabit = habits[this.currentHabitIndex];
    
    // Highlight current habit in UI if available
    if (this.elements.habitListElement) {
      const habitItems = this.elements.habitListElement.querySelectorAll('.habit-item');
      habitItems.forEach(item => {
        item.classList.remove('current');
        if (item.dataset.habit === currentHabit.key) {
          item.classList.add('current');
        }
      });
    }
    
    // Speak the habit
    this.updateStatus(`Habit ${this.currentHabitIndex + 1}: ${currentHabit.text}`);
    this.onHabitRead(currentHabit);
    
    try {
      // Speak the habit with a prompt for response
      await this.speakText(`Did you complete this habit today: ${currentHabit.text}? Please respond with yes, no, or skip.`);
      
      // Listen for response after speech is done
      this.listenForResponse(currentHabit);
    } catch (error) {
      this.handleError('Error processing habit: ' + error.message);
      // Move to next habit despite error
      this.currentHabitIndex++;
      this.processNextHabit();
    }
  }
  
  /**
   * Speak text using TTS
   * @param {string} text - Text to speak
   */
  async speakText(text) {
    if (!this.ttsService) {
      await this.initTTS();
    }
    
    if (!text) return;
    
    try {
      await this.ttsService.speak(text);
    } catch (error) {
      this.handleError('Failed to speak text: ' + error.message);
      throw error;
    }
  }
  
  /**
   * Listen for verbal response to current habit
   * @param {Object} currentHabit - The current habit being processed
   */
  listenForResponse(currentHabit) {
    if (!this.recognition) {
      this.handleError('Speech recognition not initialized');
      return;
    }
    
    this.updateStatus('Listening for your response...');
    
    // Set recognition mode for current context
    this.recognitionContext = {
      type: 'habit',
      habit: currentHabit
    };
    
    // Start listening
    try {
      this.recognition.start();
    } catch (error) {
      this.handleError('Error starting speech recognition: ' + error.message);
      
      // Move to next habit despite error
      this.currentHabitIndex++;
      this.processNextHabit();
    }
  }
  
  /**
   * Handle speech recognition result
   * @param {Event} event - The speech recognition result event
   */
  handleSpeechResult(event) {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim().toLowerCase();
    
    if (this.recognitionContext.type === 'habit') {
      // Handle habit response
      const currentHabit = this.recognitionContext.habit;
      let response = '';
      
      // Process the response
      if (transcript.includes('yes') || transcript.includes('yeah') || transcript.includes('yep')) {
        response = 'yes';
      } else if (transcript.includes('no') || transcript.includes('nope') || transcript.includes('nah')) {
        response = 'no';
      } else if (transcript.includes('skip')) {
        response = 'skip';
      } else {
        // Unrecognized response, ask again
        this.speakText('Sorry, I didn\'t understand. Please say yes, no, or skip.').then(() => {
          this.listenForResponse(currentHabit);
        });
        return;
      }
      
      // Record response
      this.responses[currentHabit.key] = response;
      this.updateStatus(`Recorded: ${response} for ${currentHabit.text}`);
      this.onHabitResponse(currentHabit, response);
      
      // Update UI if available
      if (this.elements.habitListElement) {
        const habitItem = this.elements.habitListElement.querySelector(`[data-habit="${currentHabit.key}"]`);
        if (habitItem) {
          habitItem.classList.remove('current');
          habitItem.classList.add(`response-${response}`);
        }
      }
      
      // Move to next habit
      this.currentHabitIndex++;
      this.processNextHabit();
    } else if (this.recognitionContext.type === 'reflection') {
      // Handle reflection response
      this.reflection = transcript;
      this.updateStatus('Reflection recorded.');
      
      // Update UI if available
      if (this.elements.reflectionElement) {
        this.elements.reflectionElement.textContent = this.reflection;
      }
      
      // Submit log with reflection
      this.submitDailyLog();
    }
  }
  
  /**
   * Ask for optional reflection
   */
  async askForReflection() {
    this.updateStatus('All habits processed. Would you like to add a reflection?');
    
    try {
      await this.speakText('All habits are done for today. Would you like to add any reflection on your progress? If so, please speak after the beep. Otherwise, say skip.');
      
      // Set recognition context for reflection
      this.recognitionContext = {
        type: 'reflection'
      };
      
      // Start listening
      this.recognition.start();
    } catch (error) {
      this.handleError('Error asking for reflection: ' + error.message);
      // Submit log without reflection
      this.submitDailyLog();
    }
  }
  
  /**
   * Submit daily log to Google Sheets
   */
  async submitDailyLog() {
    try {
      // Check if still authenticated
      if (!this.checkAuthentication()) {
        return;
      }
      
      this.updateStatus('Submitting your daily log...');
      
      // Validate required data
      const userId = this.getUserId();
      
      if (!userId) {
        throw new Error('User ID is not set. Please login first.');
      }
      
      if (!this.dailyLogEndpoint) {
        throw new Error('Daily log API endpoint is not configured');
      }
      
      if (Object.keys(this.responses).length === 0) {
        throw new Error('No habit responses to submit');
      }
      
      const formattedDate = this.formatDate(this.date);
      
      // Prepare payload
      const payload = {
        user_id: userId,
        date: formattedDate,
        responses: this.responses,
        reflection: this.reflection || ''
      };
      
      try {
        // Set up authentication headers
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (this.authService && typeof this.authService.getAuthHeaders === 'function') {
          Object.assign(headers, this.authService.getAuthHeaders());
        }
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
        
        const response = await fetch(this.dailyLogEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle authentication errors specifically
          if (response.status === 401) {
            this.onAuthRequired();
            throw new Error('Authentication required. Please log in first.');
          }
          
          // Try to get error details from the response
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          // Handle different HTTP status codes with user-friendly messages
          if (response.status === 400) {
            throw new Error(`Invalid request: ${errorData.error || 'Missing required parameters'}`);
          } else if (response.status === 429) {
            throw new Error('Server is busy. Please try again later.');
          } else if (response.status >= 500) {
            throw new Error(`Server error: ${errorData.error || 'Internal server error'}`);
          } else {
            throw new Error(`API error (${response.status}): ${errorData.error || response.statusText}`);
          }
        }
        
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Invalid response format from server');
        }
        
        // Check for error in the response body (some APIs return 200 with error in body)
        if (data && data.success === false) {
          throw new Error(data.error || 'Unknown API error');
        }
        
        this.updateStatus('Daily log submitted successfully!');
        await this.speakText('Thank you! Your daily log has been saved.');
        
        this.onComplete({
          responses: this.responses,
          reflection: this.reflection,
          success: true
        });
        
        this.isProcessing = false;
        return data;
      } catch (networkError) {
        // Handle network/fetch specific errors
        if (networkError.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (networkError.message.includes('NetworkError') || 
                   networkError.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else {
          // Rethrow the error we caught above
          throw networkError;
        }
      }
    } catch (error) {
      this.handleError('Error submitting daily log: ' + error.message);
      // Show error in UI
      this.updateStatus('Error: ' + error.message);
      
      this.onComplete({
        responses: this.responses,
        reflection: this.reflection,
        success: false,
        error: error.message
      });
      
      this.isProcessing = false;
      throw error;
    }
  }
  
  /**
   * Handle speech recognition error
   * @param {Event} event - The speech recognition error event
   */
  handleSpeechError(event) {
    this.handleError('Speech recognition error: ' + event.error);
    
    if (this.recognitionContext.type === 'habit') {
      // Move to next habit despite error
      this.currentHabitIndex++;
      this.processNextHabit();
    } else if (this.recognitionContext.type === 'reflection') {
      // Submit log without reflection
      this.submitDailyLog();
    }
  }
  
  /**
   * Handle speech recognition end
   * @param {Event} event - The speech recognition end event
   */
  handleSpeechEnd(event) {
    // This is just a cleanup function in case recognition ends unexpectedly
    if (this.isProcessing) {
      // If we're still processing and recognition ended without a result
      if (this.recognitionContext.type === 'habit' && !this.responses[this.recognitionContext.habit.key]) {
        this.updateStatus('No response detected. Trying again...');
        
        // Try again for the current habit
        this.listenForResponse(this.recognitionContext.habit);
      }
    }
  }
  
  /**
   * Update status in UI and logging
   * @param {string} message - Status message
   */
  updateStatus(message) {
    if (this.elements.statusElement) {
      this.elements.statusElement.textContent = message;
    }
    
    this.onStatusUpdate(message);
  }
  
  /**
   * Handle errors
   * @param {string|Error} error - Error message or object
   */
  handleError(error) {
    // Extract the message if error is an Error object
    const errorMessage = error instanceof Error ? error.message : error;
    
    // Log detailed error information to console for debugging
    console.error('Habit tracker error:', errorMessage);
    
    // Create a user-friendly version of the error message
    let userMessage = errorMessage;
    
    // Map technical errors to user-friendly messages
    if (errorMessage.includes('NetworkError') || 
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('network error')) {
      userMessage = 'Network connection issue. Please check your internet connection and try again.';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      userMessage = 'Request timed out. The server is taking too long to respond. Please try again later.';
    } else if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
      userMessage = 'Server error. Our system is having issues. Please try again later.';
    } else if (errorMessage.includes('404') || errorMessage.includes('Not found')) {
      userMessage = 'The resource was not found. This might be because you need to create goals first.';
    } else if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('Authentication')) {
      userMessage = 'Authentication error. Please log in again or contact support.';
    } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
      userMessage = 'Received an invalid response from the server. Please try again.';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    }
    
    // Update status with user-friendly message
    this.updateStatus(`Error: ${userMessage}`);
    
    // Call error callback with both technical details and user-friendly message
    this.onError({ 
      message: userMessage,
      technicalDetails: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Format date as YYYY-MM-DD
   * @param {Date} date - Date to format
   * @returns {string} - Formatted date string
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}

export default DailyHabitTracker; 
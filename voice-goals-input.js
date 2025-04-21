/**
 * Voice Goals Input Module
 * Uses Web Speech API to capture voice input and send goals to backend
 */

class VoiceGoalsInput {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || '/api/process-goals';
    this.userId = null;  // Initialize userId as null
    this.authService = options.authService || null;
    this.maxGoals = options.maxGoals || 5;
    this.onStartListening = options.onStartListening || (() => {});
    this.onStopListening = options.onStopListening || (() => {});
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onFinalResult = options.onFinalResult || (() => {});
    this.onAuthRequired = options.onAuthRequired || (() => {
      this.onError({ 
        error: 'auth_required', 
        message: 'Authentication required. Please login first.' 
      });
    });
    this.language = options.language || 'en-US';
    
    // Initialize speech recognition
    this.initSpeechRecognition();
    
    // State variables
    this.isListening = false;
    this.lastResults = [];
    
    // Get userId from options (for backward compatibility)
    if (options.userId) {
      this.userId = options.userId;
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
   * Initialize the SpeechRecognition object
   */
  initSpeechRecognition() {
    // Initialize SpeechRecognition with browser compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      this.onError({ 
        error: 'browser_not_supported', 
        message: 'Speech recognition is not supported in this browser' 
      });
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;
    
    // Set up event handlers
    this.recognition.onstart = this.handleStart.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
  }
  
  /**
   * Start listening for voice input
   */
  startListening() {
    // Check if user is authenticated
    const userId = this.getUserId();
    if (!userId) {
      this.onAuthRequired();
      return;
    }
    
    if (!this.recognition) {
      this.onError({ 
        error: 'recognition_not_initialized', 
        message: 'Speech recognition is not initialized' 
      });
      return;
    }
    
    if (this.isListening) {
      return;
    }
    
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.onError({ 
        error: 'start_error', 
        message: 'Error starting speech recognition' 
      });
    }
  }
  
  /**
   * Stop listening for voice input
   */
  stopListening() {
    if (!this.recognition || !this.isListening) {
      return;
    }
    
    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      this.onError({ 
        error: 'stop_error', 
        message: 'Error stopping speech recognition' 
      });
    }
  }
  
  /**
   * Process the final transcript into goals
   * @param {string} transcript - The transcript to process
   * @returns {Array} - Array of goals extracted from the transcript
   */
  processTranscriptIntoGoals(transcript) {
    // Split the transcript by common delimiters
    let goals = [];
    
    // Try to split by "and", "also", or numbers followed by periods/parentheses
    const splitPatterns = [
      /\s+and\s+/i,
      /\s*,\s*/,
      /\s+also\s+/i,
      /\s*\.\s*/,
      /\s*\d+[\.\)]\s*/,
      /\s+next\s+/i,
      /\s+finally\s+/i,
      /\s+lastly\s+/i
    ];
    
    // If we have clear number markers, use them for splitting
    if (/\d+[\.\)]/.test(transcript)) {
      // The text likely has numbered goals
      const numberedFormat = transcript.replace(/(\d+[\.\)])([^,\.\d\)]+)/g, '___SPLIT___$1$2');
      goals = numberedFormat.split('___SPLIT___').filter(Boolean);
      
      // Clean up the goals (remove leading numbers and spaces)
      goals = goals.map(goal => goal.replace(/^\s*\d+[\.\)]\s*/, '').trim());
    } else {
      // Otherwise try various delimiters
      for (const pattern of splitPatterns) {
        if (goals.length === 0 || goals.length === 1) {
          goals = transcript.split(pattern).filter(Boolean);
        } else {
          break;
        }
      }
    }
    
    // Clean up the goals
    goals = goals.map(goal => goal.trim())
                 .filter(goal => goal.length > 0)
                 .slice(0, this.maxGoals);
    
    // If we couldn't split it, treat the whole transcript as one goal
    if (goals.length === 0 && transcript.trim().length > 0) {
      goals = [transcript.trim()];
    }
    
    return goals;
  }
  
  /**
   * Send the goals to the backend
   * @param {Array} goals - The array of goals to send
   * @returns {Promise} - Promise resolving to the backend response
   */
  async sendGoalsToBackend(goals) {
    try {
      // Validate input
      if (!Array.isArray(goals) || goals.length === 0) {
        throw new Error('Goals must be a non-empty array');
      }
      
      // Check authentication
      const userId = this.getUserId();
      
      if (!userId) {
        this.onAuthRequired();
        throw new Error('Authentication required. Please login first.');
      }
      
      // Ensure API endpoint is set
      if (!this.apiEndpoint) {
        throw new Error('API endpoint is not configured');
      }
      
      const currentDate = new Date();
      const weekStart = new Date(currentDate);
      
      // Set to the start of the current week (Sunday)
      const day = currentDate.getDay();
      weekStart.setDate(currentDate.getDate() - day);
      
      // Format as YYYY-MM-DD
      const weekStartFormatted = weekStart.toISOString().split('T')[0];
      
      const payload = {
        user_id: userId,
        week_start: weekStartFormatted,
        goals: goals
      };
      
      // For the goals Google Sheet tab, map the goals to the appropriate columns
      goals.forEach((goal, index) => {
        if (index < this.maxGoals) {
          payload[`goal_${index + 1}`] = goal;
        }
      });
      
      try {
        // Set up authentication headers
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (this.authService && typeof this.authService.getAuthHeaders === 'function') {
          Object.assign(headers, this.authService.getAuthHeaders());
        }
        
        // Make the API request with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
        
        const response = await fetch(this.apiEndpoint, {
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
          
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          // Handle different HTTP status codes
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
        
        // Parse the response
        const data = await response.json();
        
        // Check for error in the response body (some APIs return 200 with error in body)
        if (data && data.success === false) {
          throw new Error(data.error || 'Unknown API error');
        }
        
        return data;
        
      } catch (networkError) {
        // Handle different types of fetch errors
        if (networkError.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (networkError.message.includes('NetworkError') || 
                  networkError.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        } else {
          // Rethrow the error we caught above or other fetch errors
          throw networkError;
        }
      }
    } catch (error) {
      console.error('Error sending goals to backend:', error);
      this.onError({ 
        error: 'backend_error', 
        message: 'Error sending goals to backend: ' + error.message 
      });
      throw error;
    }
  }
  
  /**
   * Event handler for when speech recognition starts
   * @param {Event} event - The start event
   */
  handleStart(event) {
    this.lastResults = [];
    this.onStartListening(event);
  }
  
  /**
   * Event handler for when speech recognition ends
   * @param {Event} event - The end event
   */
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
  
  /**
   * Request confirmation for the detected goals
   * @param {string} transcript - The final transcript
   * @param {Array} goals - The processed goals
   */
  requestConfirmation(transcript, goals) {
    // Call back with the processed goals, but don't send to backend yet
    this.onFinalResult({
      transcript: transcript,
      goals: goals,
      requiresConfirmation: true
    });
  }
  
  /**
   * Send confirmed goals to the backend
   * @param {Array} goals - The confirmed goals
   */
  sendConfirmedGoals(goals) {
    // Check if user is authenticated first
    const userId = this.getUserId();
    if (!userId) {
      this.onAuthRequired();
      return;
    }
    
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
  
  /**
   * Event handler for speech recognition results
   * @param {Event} event - The result event
   */
  handleResult(event) {
    // Get the transcript
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      
      if (result.isFinal) {
        finalTranscript += transcript;
        this.lastResults.push(transcript.trim());
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Callback with the interim results
    this.onResult({
      interimTranscript,
      finalTranscript,
      completeTranscript: this.lastResults.join(' ') + ' ' + interimTranscript
    });
  }
  
  /**
   * Event handler for speech recognition errors
   * @param {Event} event - The error event
   */
  handleError(event) {
    this.isListening = false;
    console.error('Speech recognition error:', event.error);
    
    this.onError({
      error: event.error,
      message: 'Speech recognition error: ' + event.error
    });
  }
}

// Export the module
export default VoiceGoalsInput; 
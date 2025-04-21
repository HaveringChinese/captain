/**
 * MotivationalFeedback
 * 
 * Utilizes GPT to generate personalized motivational feedback based on habit tracking data
 */

export class MotivationalFeedback {
  /**
   * Creates a new MotivationalFeedback instance
   * @param {Object} options Configuration options
   * @param {Object} options.ttsService TTSService instance for speaking feedback
   * @param {string} options.apiEndpoint Endpoint for GPT feedback generation API
   * @param {Function} options.onGenerationStart Callback when feedback generation starts
   * @param {Function} options.onGenerationComplete Callback when feedback is generated
   * @param {Function} options.onGenerationError Callback when generation fails
   * @param {Function} options.onSpeakStart Callback when speaking starts
   * @param {Function} options.onSpeakComplete Callback when speaking completes
   * @param {Function} options.onSpeakError Callback when speaking fails
   */
  constructor(options = {}) {
    this.ttsService = options.ttsService;
    this.apiEndpoint = options.apiEndpoint || '/api/motivational-feedback';
    
    // Callbacks
    this.onGenerationStart = options.onGenerationStart || (() => {});
    this.onGenerationComplete = options.onGenerationComplete || (() => {});
    this.onGenerationError = options.onGenerationError || (() => {});
    this.onSpeakStart = options.onSpeakStart || (() => {});
    this.onSpeakComplete = options.onSpeakComplete || (() => {});
    this.onSpeakError = options.onSpeakError || (() => {});
    
    // State
    this.latestFeedback = null;
  }
  
  /**
   * Extract feedback from the API response
   * @private
   * @param {Object} response The API response
   * @returns {string} The extracted feedback
   */
  _extractFeedbackFromResponse(response) {
    try {
      // Handle different response formats
      if (typeof response === 'string') {
        return response;
      }
      
      if (response && typeof response === 'object') {
        // If the response has a feedback property
        if (response.feedback) {
          return response.feedback;
        }
        
        // If the response has content or message properties
        if (response.content) {
          return response.content;
        }
        
        if (response.message) {
          return response.message;
        }
      }
      
      // If we couldn't extract feedback in a known format
      return JSON.stringify(response);
    } catch (error) {
      console.error('Error extracting feedback from response:', error);
      return 'Sorry, I couldn\'t generate proper feedback at this time.';
    }
  }
  
  /**
   * Generate motivational feedback based on habit data
   * @param {Object} habitData The habit tracking data
   * @returns {Promise<string>} The generated feedback
   */
  async generateFeedback(habitData) {
    try {
      this.onGenerationStart();
      
      // For demo purposes, we'll simulate an API call with a timed mock response
      // In a real implementation, you would make an actual API call to GPT
      
      // Log the habit data (for debugging purposes)
      console.log('Sending habit data for feedback generation:', habitData);
      
      // Simulate API call with setTimeout
      return new Promise((resolve) => {
        setTimeout(() => {
          // Mock response based on completion rate
          const completed = habitData.responses.filter(r => r === 'yes').length;
          const total = habitData.responses.length;
          const completionRate = (completed / total) * 100;
          
          let feedback;
          
          if (completionRate >= 80) {
            // High completion rate
            feedback = `Fantastic job today! You completed ${completed} out of ${total} habits, including your ${habitData.habits[0]} and ${habitData.habits[1]}. That ${habitData.streaks[0]}-day meditation streak is impressive! For the habits you missed, remember that consistency matters more than perfection. Your reflection shows thoughtfulness about your progress. Tomorrow is another opportunity to build on today's success.`;
          } else if (completionRate >= 50) {
            // Medium completion rate
            feedback = `You're making solid progress! Completing ${completed} out of ${total} habits shows your commitment. I notice you've maintained a ${Math.max(...habitData.streaks)}-day streak with one of your practices - that consistency is building a strong foundation. For the habits that were challenging today, consider what specific obstacles you faced and how you might adapt tomorrow.`;
          } else {
            // Low completion rate
            feedback = `I see today had some challenges, but showing up is half the battle. You still managed to complete ${completed} important habits despite the difficulties. Even small steps forward matter. Looking at your reflection, I can tell you're aware of what's happening. Consider focusing on just one or two key habits tomorrow to rebuild momentum. What small win can you aim for?`;
          }
          
          this.latestFeedback = feedback;
          this.onGenerationComplete(feedback);
          resolve(feedback);
        }, 1500); // Simulate API delay
      });
      
      /* In a real implementation with an actual API call:
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Send the raw habit data - the server will construct the prompt
          habits: habitData.habits,
          responses: habitData.responses,
          streaks: habitData.streaks || [],
          reflection: habitData.reflection || '',
          streak: habitData.streak || 0,
          totalDays: habitData.totalDays || 0,
          userId: habitData.userId  // If tracking by user
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const feedback = this._extractFeedbackFromResponse(data);
      
      this.latestFeedback = feedback;
      this.onGenerationComplete(feedback);
      return feedback;
      */
      
    } catch (error) {
      console.error('Error generating feedback:', error);
      this.onGenerationError(error);
      throw error;
    }
  }
  
  /**
   * Speak the latest generated feedback using TTS
   * @returns {Promise<void>}
   */
  async speakFeedback() {
    if (!this.latestFeedback) {
      const error = new Error('No feedback available to speak');
      this.onSpeakError(error);
      throw error;
    }
    
    if (!this.ttsService) {
      const error = new Error('TTS service not available');
      this.onSpeakError(error);
      throw error;
    }
    
    try {
      this.onSpeakStart();
      
      await this.ttsService.speak(this.latestFeedback, {
        onComplete: () => this.onSpeakComplete(),
        onError: (error) => this.onSpeakError(error)
      });
      
    } catch (error) {
      console.error('Error speaking feedback:', error);
      this.onSpeakError(error);
      throw error;
    }
  }
  
  /**
   * Stop speaking if currently in progress
   */
  stopSpeaking() {
    if (this.ttsService) {
      this.ttsService.stop();
    }
  }
} 
/**
 * Text-to-Speech Service with multiple provider support
 */

/**
 * Main TTS Service class that manages multiple text-to-speech providers
 */
export class TTSService {
  /**
   * Create a new TTSService with the specified providers
   * @param {Object} options Configuration options
   * @param {Array} options.providers Array of TTS provider instances
   * @param {string} options.defaultProvider Name of the default provider to use
   * @param {Function} options.onProviderChange Callback when provider changes
   */
  constructor(options = {}) {
    this.providers = {};
    this.providerNames = [];
    this.currentProviderIndex = 0;
    this.isPlaying = false;
    
    // Add providers
    if (options.providers && Array.isArray(options.providers)) {
      options.providers.forEach(provider => {
        if (provider && provider.name) {
          this.providers[provider.name] = provider;
          this.providerNames.push(provider.name);
        }
      });
    }
    
    // Set default provider if specified and exists
    if (options.defaultProvider && this.providerNames.includes(options.defaultProvider)) {
      this.currentProviderIndex = this.providerNames.indexOf(options.defaultProvider);
    }
    
    // Callbacks
    this.onProviderChange = options.onProviderChange || (() => {});
  }
  
  /**
   * Get the current provider instance
   * @returns {Object} The current provider
   */
  getCurrentProvider() {
    if (this.providerNames.length === 0) {
      return null;
    }
    
    const providerName = this.providerNames[this.currentProviderIndex];
    return this.providers[providerName];
  }
  
  /**
   * Switch to the next available provider
   * @returns {boolean} True if switched successfully, false otherwise
   */
  switchToNextProvider() {
    if (this.providerNames.length <= 1) {
      return false;
    }
    
    const prevProvider = this.getCurrentProvider();
    
    // Move to next provider
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerNames.length;
    
    const newProvider = this.getCurrentProvider();
    
    if (this.onProviderChange) {
      this.onProviderChange(prevProvider, newProvider);
    }
    
    return true;
  }
  
  /**
   * Check if service has any available providers
   * @returns {boolean} True if has providers, false otherwise
   */
  hasProviders() {
    return this.providerNames.length > 0;
  }
  
  /**
   * Speak text using the current provider
   * @param {string} text Text to speak
   * @param {Object} options Options for speech
   * @param {Function} options.onComplete Callback when speech completes
   * @param {Function} options.onError Callback when error occurs
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    if (!text) {
      throw new Error('No text provided for speech');
    }
    
    if (!this.hasProviders()) {
      throw new Error('No TTS providers available');
    }
    
    this.stop();
    this.isPlaying = true;
    
    const onComplete = options.onComplete || (() => {});
    const onError = options.onError || (() => {});
    
    try {
      await this.tryCurrentProvider(text, onComplete, onError);
    } catch (error) {
      console.error(`Error with provider ${this.getCurrentProvider()?.name}:`, error);
      
      // Try switching to next provider
      if (this.switchToNextProvider()) {
        try {
          await this.tryCurrentProvider(text, onComplete, onError);
        } catch (secondError) {
          console.error(`Error with fallback provider ${this.getCurrentProvider()?.name}:`, secondError);
          this.isPlaying = false;
          onError(secondError);
        }
      } else {
        this.isPlaying = false;
        onError(error);
      }
    }
  }
  
  /**
   * Try to speak using the current provider
   * @private
   * @param {string} text Text to speak
   * @param {Function} onComplete Success callback
   * @param {Function} onError Error callback
   * @returns {Promise<void>}
   */
  async tryCurrentProvider(text, onComplete, onError) {
    const provider = this.getCurrentProvider();
    
    if (!provider) {
      throw new Error('No TTS provider available');
    }
    
    // Handle audio element for providers like Fish Audio
    if (provider.getAudioElement) {
      const audioElement = await provider.speak(text);
      this.handleAudioElement(audioElement, onComplete, onError);
    } else {
      // For providers like WebSpeech that handle their own events
      await provider.speak(text, {
        onComplete: () => {
          this.isPlaying = false;
          onComplete();
        },
        onError: (error) => {
          this.isPlaying = false;
          onError(error);
        }
      });
    }
  }
  
  /**
   * Handle audio element playback
   * @private
   * @param {HTMLAudioElement} audioElement The audio element to play
   * @param {Function} onComplete Success callback
   * @param {Function} onError Error callback
   */
  handleAudioElement(audioElement, onComplete, onError) {
    if (!audioElement) {
      onError(new Error('No audio element returned from provider'));
      return;
    }
    
    // Store reference to current audio
    this.currentAudio = audioElement;
    
    // Set up event listeners
    audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.currentAudio = null;
      onComplete();
    });
    
    audioElement.addEventListener('error', (event) => {
      console.error('Audio playback error:', event);
      this.isPlaying = false;
      this.currentAudio = null;
      onError(new Error('Audio playback error'));
    });
    
    // Start playback
    audioElement.play().catch(error => {
      console.error('Error playing audio:', error);
      this.isPlaying = false;
      this.currentAudio = null;
      onError(error);
    });
  }
  
  /**
   * Stop current speech
   */
  stop() {
    const provider = this.getCurrentProvider();
    
    if (provider && this.isPlaying) {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      
      if (provider.stop) {
        provider.stop();
      }
      
      this.isPlaying = false;
    }
  }
}

/**
 * Fish Audio API provider for TTS
 */
export class FishAudioProvider {
  /**
   * Create a new Fish Audio provider
   * @param {Object} options Configuration options
   * @param {string} options.proxyEndpoint Server endpoint for Fish Audio API proxy
   * @param {string} options.voiceId Voice ID to use (if not using default)
   */
  constructor(options = {}) {
    this.name = 'FishAudio';
    this.proxyEndpoint = options.proxyEndpoint || '/api/tts/fish-audio';
    this.voiceId = options.voiceId || null;
    this.audioElement = null;
  }
  
  /**
   * Check if Fish Audio API can be used
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async isAvailable() {
    try {
      const response = await fetch('/api/tts-config');
      if (!response.ok) return false;
      
      const config = await response.json();
      return config.useFishAudio;
    } catch (error) {
      console.error('Error checking Fish Audio availability:', error);
      return false;
    }
  }
  
  /**
   * Convert text to speech using Fish Audio API
   * @param {string} text Text to convert to speech
   * @returns {Promise<HTMLAudioElement>} Audio element with the speech
   */
  async speak(text) {
    if (!text) {
      throw new Error('No text provided for speech');
    }
    
    try {
      const response = await fetch(this.proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Fish Audio API error: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.audio_url) {
        throw new Error('No audio URL returned from Fish Audio API');
      }
      
      // Create audio element with the returned audio URL
      const audio = new Audio(data.audio_url);
      this.audioElement = audio;
      
      return audio;
    } catch (error) {
      console.error('Fish Audio API error:', error);
      throw error;
    }
  }
  
  /**
   * Get the current audio element
   * @returns {HTMLAudioElement|null} The current audio element
   */
  getAudioElement() {
    return this.audioElement;
  }
  
  /**
   * Stop current speech
   */
  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }
}

/**
 * Web Speech API provider for TTS
 */
export class WebSpeechProvider {
  /**
   * Create a new Web Speech provider
   * @param {Object} options Configuration options
   * @param {string} options.voiceName Preferred voice name
   * @param {string} options.lang Language code (e.g., 'en-US')
   * @param {number} options.pitch Voice pitch (0 to 2)
   * @param {number} options.rate Speech rate (0.1 to 10)
   * @param {number} options.volume Volume (0 to 1)
   */
  constructor(options = {}) {
    this.name = 'WebSpeech';
    this.voiceName = options.voiceName || null;
    this.lang = options.lang || 'en-US';
    this.pitch = options.pitch || 1;
    this.rate = options.rate || 1;
    this.volume = options.volume || 1;
    
    // Initialize speech synthesis
    this.synth = window.speechSynthesis;
    this.utterance = null;
    
    // Find available voices
    this.voices = [];
    this.loadVoices();
    
    // Some browsers need a delay to load voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = this.loadVoices.bind(this);
    }
  }
  
  /**
   * Load available voices
   */
  loadVoices() {
    this.voices = this.synth.getVoices();
  }
  
  /**
   * Find best matching voice
   * @private
   * @returns {SpeechSynthesisVoice|null} Best matching voice
   */
  findVoice() {
    if (!this.voices || this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    
    if (this.voices.length === 0) {
      return null;
    }
    
    // If voice name specified, try to find it
    if (this.voiceName) {
      const exactMatch = this.voices.find(voice => 
        voice.name.toLowerCase() === this.voiceName.toLowerCase());
      
      if (exactMatch) return exactMatch;
      
      const partialMatch = this.voices.find(voice => 
        voice.name.toLowerCase().includes(this.voiceName.toLowerCase()));
      
      if (partialMatch) return partialMatch;
    }
    
    // Try to find a voice matching the language
    const langMatch = this.voices.find(voice => 
      voice.lang.toLowerCase() === this.lang.toLowerCase());
    
    if (langMatch) return langMatch;
    
    // Default to first voice
    return this.voices[0];
  }
  
  /**
   * Find voice with retries if voices aren't loaded yet
   * @param {number} maxRetries Maximum number of retries (default: 5)
   * @param {number} retryDelay Delay between retries in ms (default: 100)
   * @returns {Promise<SpeechSynthesisVoice|null>} Found voice or null if not available after retries
   */
  async findVoiceWithRetry(maxRetries = 5, retryDelay = 100) {
    // Try to find a voice immediately first
    let voice = this.findVoice();
    if (voice) return voice;
    
    // If no voices found, try reloading with retries
    let retries = 0;
    
    while (!voice && retries < maxRetries) {
      // Wait for a short delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Reload voices and try again
      this.loadVoices();
      voice = this.findVoice();
      
      retries++;
      
      // Increase delay slightly for each retry (exponential backoff)
      retryDelay = Math.min(retryDelay * 1.5, 1000);
    }
    
    // Log warning if no voice found after retries
    if (!voice) {
      console.warn(`WebSpeechProvider: No voice found after ${maxRetries} retries`);
    } else {
      console.info(`WebSpeechProvider: Voice "${voice.name}" found after ${retries} retries`);
    }
    
    return voice;
  }
  
  /**
   * Check if Web Speech API is available
   * @returns {boolean} True if available, false otherwise
   */
  isAvailable() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }
  
  /**
   * Convert text to speech using Web Speech API
   * @param {string} text Text to convert to speech
   * @param {Object} options Options for speech
   * @param {Function} options.onComplete Callback when speech completes
   * @param {Function} options.onError Callback when error occurs
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Web Speech API not supported in this browser');
    }
    
    if (!text) {
      throw new Error('No text provided for speech');
    }
    
    return new Promise(async (resolve, reject) => {
      const onComplete = options.onComplete || (() => {});
      const onError = options.onError || (() => {});
      
      try {
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find voice with retries if not available immediately
        const voice = await this.findVoiceWithRetry();
        
        // Set voice and properties
        if (voice) {
          utterance.voice = voice;
        } else {
          console.warn('WebSpeechProvider: Using default voice (no matching voice found)');
        }
        
        utterance.lang = this.lang;
        utterance.pitch = this.pitch;
        utterance.rate = this.rate;
        utterance.volume = this.volume;
        
        // Set event handlers
        utterance.onend = () => {
          this.utterance = null;
          onComplete();
          resolve();
        };
        
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          this.utterance = null;
          const error = new Error(`Speech synthesis error: ${event.error}`);
          onError(error);
          reject(error);
        };
        
        // Store current utterance and speak
        this.utterance = utterance;
        
        // Use cancel() first to clear any pending speeches to avoid Chrome bug
        this.synth.cancel();
        
        // Some browsers (especially mobile ones) need a brief pause after cancel
        setTimeout(() => {
          this.synth.speak(utterance);
        }, 50);
        
      } catch (error) {
        console.error('Error initializing speech:', error);
        this.utterance = null;
        onError(error);
        reject(error);
      }
    });
  }
  
  /**
   * Stop current speech
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.utterance = null;
    }
  }
} 
/**
 * Authentication Module for Client-Side
 * Handles authentication-related functionality for the frontend
 */

class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = null;
    this.initialized = false;
    this.authListeners = [];
  }
  
  /**
   * Initialize the auth service and check authentication status
   * @returns {Promise<boolean>} Whether the user is authenticated
   */
  async init() {
    if (this.initialized) {
      return this.isAuthenticated();
    }
    
    try {
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.authenticated) {
        this.user = data.user;
        
        // Ensure token is in localStorage if it wasn't already
        if (!this.token && data.token) {
          localStorage.setItem('authToken', data.token);
          this.token = data.token;
        }
        
        this.notifyListeners(true);
      } else {
        this.clearAuth();
      }
      
      this.initialized = true;
      return this.isAuthenticated();
    } catch (error) {
      console.error('Auth check error:', error);
      this.clearAuth();
      this.initialized = true;
      return false;
    }
  }
  
  /**
   * Register a new user
   * @param {Object} userData User registration data
   * @param {string} userData.name User's name
   * @param {string} userData.email User's email
   * @param {string} userData.password User's password
   * @returns {Promise<Object>} Registration result
   */
  async register(userData) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        this.token = data.token;
      }
      
      this.user = data.user;
      this.notifyListeners(true);
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
  
  /**
   * Log in a user
   * @param {Object} credentials User login credentials
   * @param {string} credentials.email User's email
   * @param {string} credentials.password User's password
   * @returns {Promise<Object>} Login result
   */
  async login(credentials) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        this.token = data.token;
      }
      
      this.user = data.user;
      this.notifyListeners(true);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  /**
   * Log out the current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      this.clearAuth();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear auth on frontend even if server logout fails
      this.clearAuth();
    }
  }
  
  /**
   * Clear authentication state
   */
  clearAuth() {
    localStorage.removeItem('authToken');
    this.token = null;
    this.user = null;
    this.notifyListeners(false);
  }
  
  /**
   * Get the current user profile
   * @returns {Promise<Object>} User profile
   */
  async getProfile() {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    
    try {
      const response = await fetch('/api/auth/profile', {
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get profile');
      }
      
      this.user = data.user;
      return data.user;
    } catch (error) {
      console.error('Get profile error:', error);
      if (error.message === 'Unauthorized' || error.message.includes('Invalid token')) {
        this.clearAuth();
      }
      throw error;
    }
  }
  
  /**
   * Check if the user is authenticated
   * @returns {boolean} Whether the user is authenticated
   */
  isAuthenticated() {
    return !!this.user && !!this.token;
  }
  
  /**
   * Get authentication headers for API requests
   * @returns {Object} Headers object with Authorization
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Add an authentication state change listener
   * @param {Function} listener Function to call when auth state changes
   * @returns {Function} Function to remove the listener
   */
  onAuthChange(listener) {
    this.authListeners.push(listener);
    
    // Call immediately with current state
    if (this.initialized) {
      listener(this.isAuthenticated());
    }
    
    // Return function to remove listener
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of an authentication state change
   * @param {boolean} isAuthenticated Whether the user is authenticated
   */
  notifyListeners(isAuthenticated) {
    this.authListeners.forEach(listener => {
      try {
        listener(isAuthenticated);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }
  
  /**
   * Get the current user's ID
   * @returns {string|null} User ID or null if not authenticated
   */
  getUserId() {
    return this.user ? this.user.id : null;
  }
}

// Create singleton instance
const authService = new AuthService();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  authService.init();
});

export default authService; 
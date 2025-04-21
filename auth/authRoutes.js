/**
 * Authentication Routes
 * Handles user registration, login, and profile management
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import User from './userModel.js';
import { generateToken, authenticate } from './authMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    try {
      const user = await User.create(email, password, name);
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Set token as cookie (for web clients)
      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      // Return user info and token (for API clients)
      res.status(201).json({
        success: true,
        user,
        token
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating user',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/auth/login
 * @description Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Find user by email
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Create user object without password
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate JWT token
    const token = generateToken(userWithoutPassword);
    
    // Set token as cookie (for web clients)
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    // Return user info and token (for API clients)
    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in',
      details: error.message,
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @description Logout a user
 * @access Public
 */
router.post('/logout', (req, res) => {
  // Clear token cookie
  res.clearCookie('token');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route GET /api/auth/profile
 * @description Get current user profile
 * @access Private
 */
router.get('/profile', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * @route GET /api/auth/check
 * @description Check if user is authenticated
 * @access Public
 */
router.get('/check', async (req, res) => {
  const token = req.cookies.token || 
                (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null);
  
  if (!token) {
    return res.json({
      authenticated: false
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.json({
        authenticated: false
      });
    }
    
    return res.json({
      authenticated: true,
      user
    });
  } catch (error) {
    return res.json({
      authenticated: false
    });
  }
});

export default router; 
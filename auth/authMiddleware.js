/**
 * Authentication Middleware
 * Provides functions to verify JWT tokens and protect routes
 */

import jwt from 'jsonwebtoken';
import User from './userModel.js';

// Secret key for JWT - should be in .env file
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object (without password)
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Authentication middleware to protect routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export async function authenticate(req, res, next) {
  // Get token from Authorization header or cookies
  const token = getTokenFromRequest(req);
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user',
        code: 'INVALID_USER'
      });
    }
    
    // Add user to request object for use in route handlers
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Get token from request (either from Authorization header or cookies)
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
function getTokenFromRequest(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Validate user ID matches authenticated user or user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export async function validateUserId(req, res, next) {
  const requestedUserId = req.params.userId || req.query.user_id || req.body.user_id;
  
  // Skip validation if no user ID in request
  if (!requestedUserId) {
    return next();
  }
  
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Allow if user is requesting their own data or is admin
  if (req.user.id === requestedUserId || req.user.email === 'admin@example.com') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'You do not have permission to access this resource',
    code: 'PERMISSION_DENIED'
  });
}

export default {
  authenticate,
  validateUserId,
  generateToken
}; 
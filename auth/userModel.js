/**
 * User Model
 * Provides database access for user authentication and management using Vercel Postgres.
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '@vercel/postgres';

// Check required environment variables
if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL environment variable is required');
  process.exit(1);
}

/**
 * User model for authentication
 */
class User {
  /**
   * Create a new user
   * @param {string} email - User's email
   * @param {string} password - User's password (will be hashed)
   * @param {string} name - User's display name
   * @returns {Object} The created user object (without password)
   */
  static async create(email, password, name) {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Generate a unique user ID
      const userId = uuidv4();
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Set name to email username if not provided
      const userName = name || email.split('@')[0];
      
      // Insert user into database
      const result = await sql`
        INSERT INTO users (id, email, password_hash, name)
        VALUES (${userId}, ${email}, ${hashedPassword}, ${userName})
        RETURNING id, email, name, created_at
      `;
      
      // Return the newly created user
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
  
  /**
   * Find a user by their ID
   * @param {string} userId - The user ID to find
   * @returns {Object|null} The user object or null if not found
   */
  static async findById(userId) {
    if (!userId) return null;
    
    try {
      const result = await sql`
        SELECT id, email, name, created_at
        FROM users
        WHERE id = ${userId}
      `;
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }
  
  /**
   * Find a user by their email
   * @param {string} email - The email to search for
   * @returns {Object|null} The user object with password_hash or null if not found
   */
  static async findByEmail(email) {
    if (!email) return null;
    
    try {
      const result = await sql`
        SELECT id, email, password_hash, name, created_at
        FROM users
        WHERE email = ${email}
      `;
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Convert password_hash column name to password for compatibility with existing code
      const user = result.rows[0];
      return {
        ...user,
        password: user.password_hash
      };
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }
  
  /**
   * Verify a password against a user's stored password
   * @param {string} password - The password to verify
   * @param {string} hashedPassword - The stored hashed password
   * @returns {Promise<boolean>} Whether the password matches
   */
  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
  
  /**
   * Get all users (for admin purposes)
   * @returns {Array} Array of users without passwords
   */
  static async getAllUsers() {
    try {
      const result = await sql`
        SELECT id, email, name, created_at
        FROM users
      `;
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }
}

export default User; 
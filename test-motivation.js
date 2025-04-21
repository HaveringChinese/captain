/**
 * Test script for the motivational feedback feature
 * 
 * This script tests the backend API endpoints for generating
 * motivational feedback and text-to-speech conversion.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

// Test data
const testHabitData = {
  habits: [
    "Morning meditation",
    "Daily exercise",
    "Healthy lunch",
    "Reading before bed",
    "Daily journaling"
  ],
  responses: ["yes", "no", "yes", "yes", "no"],
  streaks: [4, 0, 7, 2, 0],
  reflection: "I'm making progress on meditation and healthy eating. Still struggling with exercise and journaling - need to find better times for these."
};

/**
 * Test the motivational feedback API
 */
async function testMotivationalFeedback() {
  console.log('Testing Motivational Feedback API...');
  
  try {
    // Call the API with habit data directly - the server will construct the prompt
    const response = await fetch(`${BASE_URL}/api/motivational-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testHabitData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API error (${response.status}): ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    console.log('\n✅ Motivational Feedback API response:');
    console.log('-'.repeat(50));
    console.log(data.feedback);
    console.log('-'.repeat(50));
    
    return data.feedback;
  } catch (error) {
    console.error('\n❌ Motivational Feedback API test failed:', error);
    return null;
  }
}

/**
 * Test the TTS API
 */
async function testTTS(text) {
  console.log('\nTesting TTS API...');
  
  if (!text) {
    text = "This is a test of the text-to-speech service. If you can hear this message, the TTS feature is working correctly.";
  }
  
  try {
    // Check if Fish Audio API key is configured
    if (!process.env.FISH_AUDIO_API_KEY) {
      console.warn('\n⚠️ No Fish Audio API key found in .env file');
    }
    
    // Call the Fish Audio TTS API
    const response = await fetch(`${BASE_URL}/api/tts/fish-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API error (${response.status}): ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    
    if (!data.audio_url) {
      throw new Error('No audio URL returned from TTS API');
    }
    
    console.log('\n✅ TTS API response:');
    console.log(`Audio URL: ${data.audio_url}`);
    
    // Save the URL to a local file for testing purposes
    await fs.writeFile(
      path.join(__dirname, 'tts-test-result.txt'),
      `TTS Test Result\n${new Date().toISOString()}\n\nAudio URL: ${data.audio_url}\n`
    );
    
    console.log('Audio URL saved to tts-test-result.txt');
    
    return data.audio_url;
  } catch (error) {
    console.error('\n❌ TTS API test failed:', error);
    
    // If Fish Audio API fails, recommend Web Speech API
    console.log('\n🔍 The Fish Audio API test failed. Consider using the Web Speech API fallback in the browser.');
    return null;
  }
}

/**
 * Check if the server is running
 */
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/tts-config`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is running. TTS config:', data);
      return true;
    } else {
      console.error(`❌ Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Server check failed: ${error.message}`);
    console.log(`\nMake sure your server is running on ${BASE_URL}`);
    console.log('Run the server with: npm run dev');
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('='.repeat(50));
  console.log('MOTIVATIONAL FEEDBACK FEATURE - TEST SCRIPT');
  console.log('='.repeat(50));
  
  // Check if server is running
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    return;
  }
  
  // Test both APIs
  const feedback = await testMotivationalFeedback();
  
  if (feedback) {
    await testTTS(feedback);
  }
  
  console.log('\n='.repeat(50));
  console.log('TEST COMPLETE');
  console.log('='.repeat(50));
}

// Run the tests
runTests().catch(console.error); 
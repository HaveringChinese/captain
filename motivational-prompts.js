/**
 * Motivational Prompts Module
 * Contains utilities for generating prompts for the GPT motivational feedback system
 */

/**
 * Categorizes habits based on user responses
 * 
 * @param {Array} habits - Array of habit descriptions
 * @param {Array} responses - Array of responses ('yes', 'no', 'skip')
 * @returns {Object} Categorized habits
 */
function categorizeHabits(habits, responses) {
  const categorized = {
    completed: [],
    notCompleted: [],
    skipped: []
  };
  
  habits.forEach((habit, index) => {
    const response = responses[index];
    
    if (response === 'yes') {
      categorized.completed.push(habit);
    } else if (response === 'no') {
      categorized.notCompleted.push(habit);
    } else if (response === 'skip') {
      categorized.skipped.push(habit);
    }
  });
  
  return categorized;
}

/**
 * Creates a prompt for generating motivational feedback
 * 
 * @param {Object} habitData - Habit tracking data
 * @param {Array} habitData.habits - Array of habit descriptions
 * @param {Array} habitData.responses - Array of responses ('yes', 'no', 'skip')
 * @param {Array} [habitData.streaks] - Array of streak counts for each habit
 * @param {string} [habitData.reflection] - User's reflection text
 * @param {number} [habitData.streak] - Overall streak count (optional)
 * @param {number} [habitData.totalDays] - Total tracking days (optional)
 * @returns {Object} Formatted prompt with system and user message
 */
function createMotivationalPrompt(habitData) {
  const { 
    habits, 
    responses, 
    streaks = [], 
    reflection = '', 
    streak = 0, 
    totalDays = 0 
  } = habitData;
  
  // Calculate completion rate
  const completed = responses.filter(r => r === 'yes').length;
  const total = responses.length;
  const completionRate = (total > 0) ? (completed / total) * 100 : 0;
  
  // System prompt
  const systemPrompt = `
You are a motivational behavior change coach specializing in habit formation.
Your job is to provide brief, personalized, and motivational feedback to a user about their habit tracking.
Keep your response conversational, supportive, and under 100 words.
Focus on reinforcing progress, providing gentle encouragement for missed habits, and emphasizing consistency over perfection.
Your feedback should be specific to the habits they've completed or missed.
Avoid generic platitudes and instead focus on the specific data provided.
`;

  // User prompt with habit data
  let userPrompt = `
Here's my habit tracking data for today:

Habits tracked today:
`;

  // Add habits with their statuses and streaks if available
  userPrompt += habits.map((habit, index) => {
    const response = responses[index];
    const streakInfo = streaks[index] > 0 
      ? `(${streaks[index]} day streak)` 
      : '(no streak)';
      
    return `- ${habit} ${streakInfo}: ${response.toUpperCase()}`;
  }).join('\n');

  userPrompt += `\n\nCompletion rate: ${completionRate.toFixed(0)}%`;
  
  // Add streak info if available
  if (streak > 0) {
    userPrompt += `\nCurrent streak: ${streak} days`;
  }
  
  if (totalDays > 0) {
    userPrompt += `\nTotal tracking days: ${totalDays}`;
  }
  
  // Add user reflection if available
  if (reflection && reflection.trim()) {
    userPrompt += `\n\nUser's reflection: "${reflection.trim()}"`;
  }
  
  userPrompt += `\n\nPlease provide a short, encouraging message that:
1. Acknowledges their specific progress (which habits they completed and any streaks)
2. Provides genuine encouragement about areas they struggled with
3. Uses a supportive, personal tone (no generic phrases like "Keep up the good work!")
4. Focuses on their efforts rather than just results
5. Is concise (80-100 words maximum)

The feedback should make the user feel understood and motivated, not judged.`;
  
  return {
    system: systemPrompt.trim(),
    user: userPrompt.trim()
  };
}

export default createMotivationalPrompt; 
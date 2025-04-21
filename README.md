# Google Sheets REST API

A Google Apps Script web app that provides a REST API for interacting with Google Sheets data. This API allows you to perform GET and POST operations on three tabs: goals, habit_stack, and daily_log.

## Sheet Structure

The API is designed for sheets with the following column structure:

### Goals Tab
`user_id`, `week_start`, `goal_1`, `goal_2`, `goal_3`, `goal_4`, `goal_5`

### Habit Stack Tab
`user_id`, `habit_1`, `habit_2`, `habit_3`, `habit_4`, `habit_5`, `updated_at`

### Daily Log Tab
`user_id`, `date`, `habit_1_result`, `habit_2_result`, `habit_3_result`, `habit_4_result`, `habit_5_result`, `reflection`

## Setup Instructions

1. Create a new Google Sheet with three tabs: "goals", "habit_stack", and "daily_log"
2. Add the column headers to each tab as specified above
3. Open the Google Scripts editor (Extensions > Apps Script)
4. Copy the contents of Code.gs into the script editor
5. Set your Spreadsheet ID in the SPREADSHEET_ID constant (found in the URL of your spreadsheet)
6. Deploy as a web app:
   - Click "Deploy" > "New deployment"
   - Select "Web app" as the type
   - Set "Execute as" to "Me"
   - Set "Who has access" to the appropriate level (anyone, domain, etc.)
   - Click "Deploy" and copy the web app URL

## Version 1 on Apr 21, 2025, 11:37 AM
Deployment ID
AKfycbzX3k709iAZ1k0LN-EU_0UwJjDoGRPvXhpG0fUsYGH7_aHg6-OMB44cvbzuMRKRq90sRA

Web app URL:
https://script.google.com/macros/s/AKfycbzX3k709iAZ1k0LN-EU_0UwJjDoGRPvXhpG0fUsYGH7_aHg6-OMB44cvbzuMRKRq90sRA/exec 

## API Endpoints

### GET Requests

Base URL: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

#### Get Goals
```
GET ?action=getGoals&user_id=USER_ID&week_start=YYYY-MM-DD
```
- `user_id` is optional. If not provided, returns all goals.
- `week_start` is optional. If provided, filters goals to the specific week.

#### Get Habit Stack
```
GET ?action=getHabitStack&user_id=USER_ID
```
- `user_id` is required.
- Returns the most recent habit stack for the user based on the `updated_at` field.

#### Get Daily Log
```
GET ?action=getDailyLog&user_id=USER_ID&date=YYYY-MM-DD
```
- `user_id` is optional. If not provided, returns all logs.
- `date` is optional. If provided, filters logs to the specific date.

### POST Requests

#### Add Goal
```
POST ?action=addGoal
Body: {
  "user_id": "user123",
  "week_start": "2023-07-23",
  "goal_1": "Read 2 chapters",
  "goal_2": "Exercise 3 times",
  "goal_3": "Meditate daily",
  "goal_4": "Call parents",
  "goal_5": "Complete project milestone"
}
```
- `user_id` and `week_start` are required fields.

#### Add Habit Stack Item
```
POST ?action=addHabitStack
Body: {
  "user_id": "user123",
  "habit_1": "Drink water",
  "habit_2": "Take vitamins",
  "habit_3": "Review goals",
  "habit_4": "Stretch",
  "habit_5": "Plan day",
  "updated_at": "2023-07-23T08:00:00Z"
}
```
- `user_id` is required.
- `updated_at` is optional and will be set to the current time if not provided.

#### Add Daily Log Entry
```
POST ?action=addDailyLog
Body: {
  "user_id": "user123",
  "date": "2023-07-23",
  "habit_1_result": "completed",
  "habit_2_result": "completed",
  "habit_3_result": "skipped",
  "habit_4_result": "completed",
  "habit_5_result": "completed",
  "reflection": "Good day overall, struggled with habit 3"
}
```
- `user_id` and `date` are required fields.

## Example Usage

### JavaScript Fetch Example

```javascript
// GET example - Get habit stack for a user
fetch('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=getHabitStack&user_id=user123')
  .then(response => response.json())
  .then(data => console.log(data));

// GET example - Get goals for a specific week
fetch('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=getGoals&user_id=user123&week_start=2023-07-23')
  .then(response => response.json())
  .then(data => console.log(data));

// POST example - Add new daily log
fetch('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=addDailyLog', {
  method: 'POST',
  body: JSON.stringify({
    user_id: 'user123',
    date: '2023-07-23',
    habit_1_result: 'completed',
    habit_2_result: 'completed',
    habit_3_result: 'skipped',
    habit_4_result: 'completed',
    habit_5_result: 'completed',
    reflection: 'Good day overall, struggled with habit 3'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```
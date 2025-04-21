# Habit Stack Generator

A Node.js service that generates personalized habit stacks based on user goals using GPT-4 and stores them in Google Sheets.

## Features

- Receives 1-5 user goals via REST API
- Sends goals to GPT-4 with a structured prompt
- Returns a 2-3 step habit stack with each habit taking under 5 minutes
- Stores the habit stack in a Google Sheet via the Google Apps Script API
- Error handling and validation

## Prerequisites

- Node.js and npm installed
- OpenAI API key
- Google Sheet set up with the habit_stack tab
- Google Apps Script API deployed (see the main README.md)

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
4. Update the `.env` file with your OpenAI API key
5. Start the server:
   ```
   npm start
   ```

## API Endpoints

### Generate Habit Stack

```
POST /generate-habit-stack
```

Request body:
```json
{
  "user_id": "user123",
  "goals": [
    "Read 12 books this year",
    "Exercise 3 times a week",
    "Learn Spanish",
    "Meditate daily",
    "Write a blog post each month"
  ]
}
```

Response:
```json
{
  "success": true,
  "habit_stack": {
    "user_id": "user123",
    "habit_1": "Read one page from a book",
    "habit_2": "Do 10 jumping jacks",
    "habit_3": "Practice one Spanish word or phrase",
    "updated_at": "2023-08-01T12:34:56.789Z"
  },
  "storage_result": {
    "success": true,
    "data": {
      "user_id": "user123",
      "habit_1": "Read one page from a book",
      "habit_2": "Do 10 jumping jacks",
      "habit_3": "Practice one Spanish word or phrase",
      "updated_at": "2023-08-01T12:34:56.789Z"
    }
  }
}
```

## Error Handling

The API will return appropriate error messages with the following HTTP status codes:

- 400: Bad Request - Missing required fields or invalid data format
- 500: Internal Server Error - Issues with OpenAI API or Google Sheets API

## Example Usage

Using curl:

```bash
curl -X POST http://localhost:3000/generate-habit-stack \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "goals": [
      "Read 12 books this year",
      "Exercise 3 times a week",
      "Learn Spanish"
    ]
  }'
```

Using JavaScript fetch:

```javascript
fetch('http://localhost:3000/generate-habit-stack', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 'user123',
    goals: [
      'Read 12 books this year',
      'Exercise 3 times a week',
      'Learn Spanish'
    ]
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
``` 
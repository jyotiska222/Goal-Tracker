# Goal Tracker 🎯

A comprehensive productivity application for managing personal goals and habits across multiple time scales. Track monthly, weekly, and daily goals, organize them with tags, and monitor your habits with detailed statistics.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [How to Use](#-how-to-use)
- [Code Logic & Rules](#-code-logic--rules)
- [API Documentation](#-api-documentation)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### User Authentication
- **Google OAuth Integration**: Secure login using Google accounts
- **Session Management**: Automatic session validation and restoration from localStorage
- **Timezone Detection**: Automatic timezone detection and management per user

### Goal Management
- **Multi-Level Goals**: Create goals at three different time scales
  - **Monthly Goals**: Long-term objectives for each month
  - **Weekly Goals**: Medium-term goals organized by week number
  - **Daily Goals**: Short-term actionable tasks for specific dates
- **Goal Hierarchy**: Weekly goals can have monthly goals as parents; daily goals can have weekly or monthly goals as parents
- **Goal Completion Tracking**: Mark goals as complete with visual indicators
- **Goal Details Modal**: View comprehensive goal information including parent goal and reschedule history count
- **Reschedule Tracking**: Automatically tracks when goals are rescheduled to different dates/weeks
- **Tag Organization**: Organize goals using color-coded custom tags
- **Flexible Editing**: Edit, update, or delete goals at any time

### Habit Tracking
- **Daily Habit Logging**: Track habit completion on a daily basis
- **Habit Statistics**: View completion rates, streaks, and historical data
- **Calendar View**: Visual habit tracking with date-specific records
- **Tag Association**: Link habits to custom tags for better organization

### Organization & Customization
- **Custom Tags**: Create unlimited tags with custom colors for categorization
- **Color Coding**: Visual distinction between different tags and goal types
- **Date Navigation**: Easily navigate between dates to view and manage goals
- **Expandable Sections**: Collapsible tag and habit sections for clean UI

### System Features
- **Real-Time Weather**: Display current weather and forecasts
- **System Health Checks**: Monitor backend connectivity and database status
- **Toast Notifications**: User-friendly feedback for all actions
- **Loading States**: Visual indicators during data fetching operations
- **Date/Time Display**: Current date and time display with automatic updates

---

## 🛠 Tech Stack

### Frontend
- **React 18**: User interface framework
- **Vite**: Modern build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Beautiful icon library
- **Axios** (implied): HTTP client for API requests
- **Context API**: State management for toasts and global state

### Backend
- **Flask 3.0.0**: Python web framework
- **Flask-CORS 4.0.0**: Cross-Origin Resource Sharing support
- **Flask-Limiter**: Rate limiting for API endpoints
- **PyMongo 4.6.0**: MongoDB driver for Python
- **Google OAuth 2.0**: Authentication library
- **python-dotenv 1.0.0**: Environment variable management
- **PyTZ**: Timezone handling

### Database
- **MongoDB**: NoSQL database with connection pooling and indexing
- **Collections**: users, tags, monthly_goals, weekly_goals, daily_goals, habits

### Deployment
- **Vercel** (Frontend): Serverless deployment platform
- **Gunicorn**: WSGI HTTP Server for production

---

## 📁 Project Structure

```
Goal-Tracker/
├── frontend/                          # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx              # Google OAuth login component
│   │   │   ├── NavBar.jsx            # Navigation bar
│   │   │   ├── Toast.jsx             # Toast notification component
│   │   │   └── ToastContainer.jsx    # Toast container wrapper
│   │   ├── context/
│   │   │   └── ToastContext.jsx      # Global toast state management
│   │   ├── utils/
│   │   │   ├── timezoneHelper.js     # Timezone conversion utilities
│   │   │   ├── toastConfigs.js       # Toast configuration presets
│   │   │   └── toastHelper.js        # Toast creation helpers
│   │   ├── App.jsx                   # Main application component
│   │   ├── main.jsx                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── package.json                  # Frontend dependencies
│   ├── vite.config.js                # Vite configuration
│   ├── vercel.json                   # Vercel deployment config
│   └── README.md                     # Frontend documentation
│
├── backend/                           # Flask application
│   ├── app.py                        # Main Flask application
│   ├── requirements.txt              # Python dependencies
│   ├── verify_improvements.py        # Testing/verification script
│   └── .env                          # Environment variables (not committed)
│
└── README.md                         # This file
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js 16+** (for frontend)
- **Python 3.8+** (for backend)
- **MongoDB Atlas account** (cloud database)
- **Google OAuth credentials**
- **Git**

### Backend Setup

#### 1. Navigate to Backend Directory
```bash
cd backend
```

#### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Create `.env` File
```env
# MongoDB Configuration
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/goaltracker?retryWrites=true&w=majority

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here

# CORS Configuration (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-frontend-domain.com
```

#### 5. Run Backend
```bash
python app.py
```
Backend will run on `http://localhost:5000`

### Frontend Setup

#### 1. Navigate to Frontend Directory
```bash
cd frontend
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Create `.env.local` File
```env
VITE_API_BASE=http://localhost:5000
```

#### 4. Run Development Server
```bash
npm run dev
```
Frontend will run on `http://localhost:5173`

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized origins and redirect URIs:
   - http://localhost:5173 (dev)
   - https://your-domain.com (production)
6. Copy the Client ID to your `.env` file

### MongoDB Setup

1. Create account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user with password
4. Add IP whitelist (include your development IP and server IPs)
5. Copy connection string to `MONGO_URI` in `.env`

---

## 📖 How to Use

### User Workflow

#### 1. **Sign In**
- Click "Login with Google"
- Authenticate with your Google account
- System automatically creates a user profile if new
- Timezone is automatically detected from your location

#### 2. **Create Tags**
- Click the "+" button next to Tags
- Enter tag name and select a color
- Tags are used to organize and categorize goals and habits

#### 3. **Create Monthly Goals**
- Click "+" in Monthly Goals section
- Enter goal title
- Select month and year
- Assign a tag (optional)
- Goals become sub-parents for weekly and daily goals

#### 4. **Create Weekly Goals**
- Click "+" in Weekly Goals section
- Enter goal title
- Select the week (auto-calculated from current date)
- Optionally link to a monthly goal (parent)
- Inherit tag from parent if applicable

#### 5. **Create Daily Goals**
- Click "+" in Daily Goals section
- Enter goal title
- Select specific date using date picker
- Optionally link to a weekly goal
- Inherit tag from parent if applicable

#### 6. **Track Completion**
- Check the checkbox next to any goal to mark complete
- Completed goals show strikethrough styling
- Completion status is synced to the server
- Unchecking removes the completed status

#### 7. **Track Habits**
- Create a new habit with a name and tag
- Click calendar dates next to the habit to log daily completion
- Visual indicators show completion status
- View statistics to track consistency and streaks

#### 8. **Monitor Progress**
- Navigate between dates using the date picker
- View weather and system status at the top
- Observe toast notifications for all actions
- Review habit statistics in the habit report view

---

## 💻 Code Logic & Rules

### Frontend Logic

#### 1. **State Management**
- **React Hooks**: useState for local component state
- **Context API**: Global toast notifications via `ToastContext`
- **LocalStorage**: Persistent user session (`goalTrackerUser`)
- **Default Timezone**: UTC, overridden by user preference

#### 2. **Authentication Flow**
```
User Click Login → Google OAuth → Verify Token → Create User (if new)
→ Save to LocalStorage → Display Dashboard
```

#### 3. **Goal Hierarchy Rules**
- Monthly goals are **independent** (no parent)
- Weekly goals **can have** a monthly goal as parent
- Daily goals **can have** a weekly goal as parent
- Tag inheritance: Child goals can inherit parent's tag if no tag is specified
- Deletion: Deleting a parent does NOT cascade to children

#### 4. **Date Handling**
- All dates stored in **ISO format** (YYYY-MM-DD)
- All times stored in **UTC** with timezone info
- Client converts to user's local timezone for display
- Week numbers calculated using ISO 8601 standard
- Month/year extracted from goal dates

#### 5. **Goal Completion State**
- Goals have boolean `completed` property
- Visual indication: strikethrough text + reduced opacity
- Status is immediately synced to server
- No validation prevents completing/uncompleting at any time

#### 6. **Habit Tracking**
```
Habit
├── Basic Info: name, tagId, userId
├── Daily Logs: Object keyed by date (YYYY-MM-DD)
│   └── Each date: completion count or boolean
└── Statistics: Calculated from logs
```

#### 7. **Toast Notification System**
- Uses Context API for global state
- Types: success, error, warning, info
- Auto-dismiss after 3-5 seconds
- Can be manually updated or dismissed
- Prevents duplicate notifications

#### 8. **System Health Monitoring**
- Backend connectivity check every 30 seconds
- Database connectivity check every 2 minutes
- Changes marked as saved when synced
- Status displayed in UI header

### Backend Logic

#### 1. **Authentication & Authorization**
```python
Flow:
POST /api/auth/google
├── Verify Google ID Token
├── Extract user info (email, name, picture)
├── Check if user exists in DB
├── Create new user if not exists
└── Return user object with ID
```

Rules:
- Google OAuth is the **ONLY** authentication method
- Token verification required for every auth request
- User ID must be valid ObjectId format
- Invalid tokens return 400 Bad Request

#### 2. **Rate Limiting**
- **Global**: 200 per day, 50 per hour (default)
- **Health Checks**: 300 per hour (monitoring can be frequent)
- **Database Checks**: 60 per hour (stricter for diagnostics)
- **Auth Endpoint**: 10 per minute (prevent brute force)
- **Read Operations**: 100 per minute per IP
- **Write Operations**: 30 per minute per IP (stricter to prevent spam)
- **Habit Toggle**: 60 per minute (frequent but not excessive)

Headers: Sent in response with current limit status

#### 3. **Data Validation**
```python
Required Fields by Endpoint:
- Tags: name, userId, color (default: #3b82f6)
- Monthly Goals: title, userId, month, year, tagId (optional)
- Weekly Goals: title, userId, weekNumber, year, weekStart, weekEnd
- Daily Goals: title, userId, date, parentId (optional)
- Habits: name, userId, tagId (optional)
```

Rules:
- All user IDs must be valid ObjectId format (`ObjectId.is_valid()`)
- Empty fields are filtered out before DB update
- String fields trimmed and validated
- Color codes validated as valid hex colors
- Timezone validated against pytz database

#### 4. **Database Indexing Strategy**
All collections optimized with indexes for fast queries:

```python
users:
  - (username) - unique
  - (timezone)

tags:
  - (userId)
  - (userId, createdAt DESC)

monthly_goals:
  - (userId)
  - (userId, year DESC, month DESC)
  - (userId, createdAt DESC)

weekly_goals:
  - (userId)
  - (userId, year DESC, weekNumber DESC)
  - (userId, parentId)
  - (userId, createdAt DESC)

daily_goals:
  - (userId)
  - (userId, date DESC)
  - (userId, parentId)
  - (userId, createdAt DESC)

habits:
  - (userId)
  - (userId, createdAt DESC)
```

#### 5. **Timezone Handling**
```python
Rule: Store all times in UTC, convert on retrieval
Flow:
1. User input (local time) → convert_to_utc() → Store in DB
2. DB (UTC) → convert_to_user_timezone() → Return to frontend

Caching:
- User timezones cached in memory for 1 hour
- Reduces DB queries for timezone lookups
- Cache invalidated on timezone update
```

#### 6. **Error Handling**
```python
Error Types:
- 400: Bad Request (invalid data or missing fields)
- 401: Unauthorized (auth required)
- 404: Not Found (resource doesn't exist)
- 429: Rate Limited (too many requests)
- 500: Internal Server Error (unexpected error)

MongoDB Errors Handled:
- ServerSelectionTimeoutError: Connection timeout
- ConnectionFailure: Network issues
- OperationFailure: Invalid operations
```

#### 7. **CRUD Operation Pattern**
All CRUD operations follow this pattern:
```python
1. Extract data from request.json
2. Validate required fields and formats
3. Convert ObjectIds if needed
4. Execute DB operation
5. Serialize response (convert ObjectId to string)
6. Return JSON response with status code
```

#### 8. **Tag Inheritance for Goals**
```python
Rule: Child goals can inherit tag from parent

When creating a goal with parentId and no tagId:
1. Check if parentId exists and is valid
2. Fetch parent goal's tagId
3. Assign parent's tagId to child goal
4. If parent doesn't have tag, child remains untagged
```

#### 9. **Habit Statistics Calculation**
```python
Stats Include:
- Total days logged
- Completion count
- Completion percentage
- Current streak
- Longest streak
- First completion date
- Last completion date
```

#### 10. **Health Check Endpoints**
```
/health → Basic liveness check
/api/health → API availability
/api/database-check → Database connectivity + diagnostics
  Returns: connection status, ping time, index status
```

---

## 🔌 API Documentation

### Authentication

#### Google OAuth Login
```
POST /api/auth/google
Content-Type: application/json

Request:
{
  "token": "google_id_token"
}

Response (200):
{
  "id": "user_id_string",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "image_url",
  "timezone": "America/New_York"
}

Errors:
400: Missing or invalid token
500: Token verification failed
```

### Tags

#### Get All Tags
```
GET /api/tags/<user_id>?page=1&limit=50

Response (200):
{
  "tags": [
    {
      "id": "tag_id",
      "name": "Work",
      "color": "#3b82f6",
      "userId": "user_id",
      "createdAt": "2024-01-04T10:30:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 50
}
```

#### Create Tag
```
POST /api/tags
Content-Type: application/json

Request:
{
  "name": "Health",
  "color": "#10b981",
  "userId": "user_id"
}

Response (201):
{
  "id": "new_tag_id",
  "name": "Health",
  "color": "#10b981",
  "userId": "user_id",
  "createdAt": "2024-01-04T10:30:00.000Z"
}
```

#### Update Tag
```
PUT /api/tags/<tag_id>
Content-Type: application/json

Request:
{
  "name": "Health & Fitness",
  "color": "#06b6d4"
}

Response (200): Updated tag object
```

#### Delete Tag
```
DELETE /api/tags/<tag_id>

Response (200): { "message": "Tag deleted successfully" }
Response (404): Tag not found
```

### Monthly Goals

#### Get Monthly Goals
```
GET /api/goals/monthly/<user_id>?page=1&limit=50

Response (200):
{
  "goals": [
    {
      "id": "goal_id",
      "title": "Complete project",
      "month": 1,
      "year": 2024,
      "tagId": "tag_id",
      "userId": "user_id",
      "completed": false,
      "createdAt": "2024-01-04T10:30:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 50
}
```

#### Create Monthly Goal
```
POST /api/goals/monthly
Content-Type: application/json

Request:
{
  "title": "Learn Python",
  "month": 1,
  "year": 2024,
  "tagId": "tag_id",
  "userId": "user_id"
}

Response (201): Created goal object
```

#### Update Monthly Goal
```
PUT /api/goals/monthly/<goal_id>
Content-Type: application/json

Request:
{
  "title": "Learn Advanced Python",
  "completed": true
}

Response (200): Updated goal object
```

#### Delete Monthly Goal
```
DELETE /api/goals/monthly/<goal_id>

Response (200): { "message": "Goal deleted successfully" }
```

### Weekly Goals

#### Get Weekly Goals
```
GET /api/goals/weekly/<user_id>?page=1&limit=50

Response (200):
{
  "goals": [
    {
      "id": "goal_id",
      "title": "Finish module 3",
      "weekNumber": 1,
      "year": 2024,
      "weekStart": "2024-01-01",
      "weekEnd": "2024-01-07",
      "parentId": "parent_goal_id",
      "tagId": "tag_id",
      "userId": "user_id",
      "completed": false,
      "createdAt": "2024-01-04T10:30:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 50
}
```

#### Create Weekly Goal
```
POST /api/goals/weekly
Content-Type: application/json

Request:
{
  "title": "Complete assignments",
  "weekNumber": 1,
  "year": 2024,
  "weekStart": "2024-01-01",
  "weekEnd": "2024-01-07",
  "parentId": "parent_goal_id",  // optional
  "tagId": "tag_id",              // optional (inherited from parent if not provided)
  "userId": "user_id"
}

Response (201): Created goal object
```

#### Update Weekly Goal
```
PUT /api/goals/weekly/<goal_id>

Request: Same fields as create (all optional)

Response (200): Updated goal object
```

#### Delete Weekly Goal
```
DELETE /api/goals/weekly/<goal_id>

Response (200): { "message": "Goal deleted successfully" }
```

### Daily Goals

#### Get Daily Goals
```
GET /api/goals/daily/<user_id>?page=1&limit=50

Response (200):
{
  "goals": [
    {
      "id": "goal_id",
      "title": "Complete task",
      "date": "2024-01-04",
      "parentId": "parent_goal_id",
      "tagId": "tag_id",
      "userId": "user_id",
      "completed": false,
      "createdAt": "2024-01-04T10:30:00.000Z"
    }
  ],
  "total": 20,
  "page": 1,
  "limit": 50
}
```

#### Create Daily Goal
```
POST /api/goals/daily
Content-Type: application/json

Request:
{
  "title": "Review code",
  "date": "2024-01-04",
  "parentId": "parent_goal_id",  // optional
  "tagId": "tag_id",              // optional (inherited from parent if not provided)
  "userId": "user_id"
}

Response (201): Created goal object
```

#### Update Daily Goal
```
PUT /api/goals/daily/<goal_id>

Request: Same fields as create (all optional)

Response (200): Updated goal object
```

#### Delete Daily Goal
```
DELETE /api/goals/daily/<goal_id>

Response (200): { "message": "Goal deleted successfully" }
```

### Habits

#### Get Habits
```
GET /api/habits/<user_id>?page=1&limit=50

Response (200):
{
  "habits": [
    {
      "id": "habit_id",
      "name": "Morning Exercise",
      "tagId": "tag_id",
      "userId": "user_id",
      "logs": {
        "2024-01-04": true,
        "2024-01-03": true
      },
      "createdAt": "2024-01-04T10:30:00.000Z"
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 50
}
```

#### Create Habit
```
POST /api/habits
Content-Type: application/json

Request:
{
  "name": "Meditation",
  "tagId": "tag_id",  // optional
  "userId": "user_id"
}

Response (201): Created habit object
```

#### Update Habit
```
PUT /api/habits/<habit_id>
Content-Type: application/json

Request:
{
  "name": "Daily Meditation",
  "tagId": "new_tag_id"
}

Response (200): Updated habit object
```

#### Toggle Habit (Log Completion)
```
POST /api/habits/<habit_id>/toggle/<date>
Content-Type: application/json

Request:
{
  "completed": true  // or false to unlog
}

Response (200):
{
  "id": "habit_id",
  "name": "Meditation",
  "logs": {
    "2024-01-04": true
  }
}
```

#### Get Habit Statistics
```
GET /api/habits/<habit_id>/stats

Response (200):
{
  "id": "habit_id",
  "name": "Meditation",
  "totalLogged": 25,
  "completionRate": 80.65,
  "currentStreak": 5,
  "longestStreak": 12,
  "firstLogged": "2023-12-10",
  "lastLogged": "2024-01-04"
}
```

#### Delete Habit
```
DELETE /api/habits/<habit_id>

Response (200): { "message": "Habit deleted successfully" }
```

### User

#### Update Timezone
```
PUT /api/user/<user_id>/timezone
Content-Type: application/json

Request:
{
  "timezone": "America/New_York"
}

Response (200):
{
  "id": "user_id",
  "timezone": "America/New_York",
  "updatedAt": "2024-01-04T10:30:00.000Z"
}
```

### System Health

#### Health Check
```
GET /health

Response (200): { "status": "ok" }
```

#### API Health
```
GET /api/health

Response (200): { "status": "api running" }
```

#### Database Check
```
GET /api/database-check

Response (200):
{
  "status": "healthy",
  "database": "connected",
  "databaseWorking": true,
  "connectionTime": "15ms",
  "collections": ["users", "tags", "monthly_goals", "weekly_goals", "daily_goals", "habits"],
  "indexes": "created",
  "timestamp": "2024-01-04T10:30:00.000Z"
}
```

---

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```env
# MongoDB Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/goaltracker?retryWrites=true&w=majority

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-domain.com

# Optional: Flask Configuration
FLASK_ENV=production
DEBUG=False
```

#### Frontend (.env.local)
```env
# API Configuration
VITE_API_BASE=http://localhost:5000

# Optional: Google Client ID (if used in frontend)
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### Flask Configuration
- **Debug Mode**: Disabled in production
- **Host**: 0.0.0.0 (all interfaces)
- **Port**: 5000
- **Threaded**: True (for concurrent requests)

### MongoDB Connection Pool
- **Max Pool Size**: 50 connections
- **Min Pool Size**: 10 connections
- **Max Idle Time**: 45 seconds
- **Server Selection Timeout**: 15 seconds
- **Connection Timeout**: 15 seconds
- **Socket Timeout**: 15 seconds
- **Retry Writes**: Enabled
- **Write Concern**: Majority (w='majority')

---

## 🚀 Deployment

### Backend Deployment (Production)

#### Using Gunicorn
```bash
# Install gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Run with more workers for high traffic
gunicorn -w 8 -b 0.0.0.0:5000 --timeout 60 app:app
```

#### Environment Variables for Production
```env
FLASK_ENV=production
MONGO_URI=your_production_mongo_uri
GOOGLE_CLIENT_ID=your_production_google_client_id
CORS_ORIGINS=https://your-domain.com
```

### Frontend Deployment (Vercel)

#### Configuration (vercel.json)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_BASE": "@vite_api_base"
  }
}
```

#### Environment Variables in Vercel
- `VITE_API_BASE`: Your backend URL (e.g., https://api.your-domain.com)

#### Deploy Command
```bash
vercel deploy
```

### Docker (Optional)

#### Backend Dockerfile
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app.py .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

#### Frontend Dockerfile
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
CMD ["serve", "-s", "dist", "-l", "3000"]
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. **MongoDB Connection Fails**
```
Error: ServerSelectionTimeoutError

Solutions:
1. Check MONGO_URI is correct in .env
2. Add your IP to MongoDB Atlas whitelist
3. Verify credentials are URL-encoded (use https://www.urlencoder.org/)
4. Check network connectivity (firewall/proxy)
5. Verify cluster is not paused in MongoDB Atlas
```

#### 2. **Google OAuth Token Verification Fails**
```
Error: ValueError - Invalid token

Solutions:
1. Verify GOOGLE_CLIENT_ID is correct
2. Check Google Console has the redirect URI registered
3. Ensure token hasn't expired (tokens expire in ~1 hour)
4. Verify request is POST with proper Content-Type
```

#### 3. **CORS Errors**
```
Error: Cross-Origin Request Blocked

Solutions:
1. Check CORS_ORIGINS in backend .env includes your frontend URL
2. Include trailing slash if needed: http://localhost:5173/
3. Restart backend after changing CORS_ORIGINS
4. Check browser console for exact error origin
```

#### 4. **Rate Limiting Blocks Requests**
```
Error: 429 Too Many Requests

Solutions:
1. Wait before retrying (varies by endpoint)
2. Check rate limit headers in response
3. Adjust rate limits in app.py if needed (development)
4. Use Redis for distributed rate limiting in production
```

#### 5. **Frontend Can't Connect to Backend**
```
Error: API_BASE is undefined or incorrect

Solutions:
1. Check .env.local has VITE_API_BASE set
2. Verify backend is running on correct port
3. Check firewall allows connections
4. Test with: curl http://localhost:5000/health
```

#### 6. **Timezone Issues**
```
Goals appearing on wrong date

Solutions:
1. Check user timezone is set correctly
2. Verify system time is accurate
3. Check MongoDB stores ISO format dates
4. Test timezone conversion: /api/user/<id>/timezone
```

#### 7. **Database Indexes Not Created**
```
Slow queries on large datasets

Solutions:
1. Run: db.createIndex(...) for each index in app.py
2. Check MongoDB logs for index creation errors
3. Verify indexes exist: db.collection.getIndexes()
4. Restart app to recreate missing indexes
```

### Debugging Tips

#### Enable Flask Debug Logging
```python
# In app.py
logging.basicConfig(level=logging.DEBUG)
```

#### Check MongoDB Connection
```bash
mongosh "your_connection_string"
> db.adminCommand({ping: 1})
```

#### Test API Endpoints
```bash
# Test health
curl http://localhost:5000/health

# Test database
curl http://localhost:5000/api/database-check

# Test with data
curl -X GET http://localhost:5000/api/tags/<user_id>
```

#### Monitor Network Requests
Use browser DevTools Network tab to:
- Check request/response bodies
- Monitor status codes
- Review timing and size
- Check headers (especially Rate-Limit-*)

---

## 📝 Code Standards & Best Practices

### Frontend
- Use functional components with hooks
- Keep components under 400 lines
- Extract complex logic to utilities
- Use Context API for global state
- Implement proper error boundaries
- Debounce rapid operations (e.g., goal updates)

### Backend
- Use decorators for consistent error handling
- Validate all user inputs
- Use connection pooling for database
- Implement proper logging with levels
- Cache frequently accessed data (e.g., timezones)
- Use database indexes for all query fields

### Database
- Always use indexes for common queries
- Store all times in UTC internally
- Use string IDs in JSON (not ObjectId)
- Implement pagination for large result sets
- Use projection to fetch only needed fields

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🤝 Support

For issues, questions, or feature requests:
1. Check the Troubleshooting section above
2. Review the API documentation
3. Check GitHub issues (if using GitHub)
4. Contact the development team

---

## 🎯 Future Enhancements

Planned features for future releases:
- [ ] Recurring goals and habits
- [ ] Goal reminders and notifications
- [ ] Social sharing of achievements
- [ ] Advanced analytics and insights
- [ ] Mobile app (React Native)
- [ ] Offline support with sync
- [ ] Integration with calendar apps
- [ ] Team/collaborative goals
- [ ] Goal templates
- [ ] AI-powered goal suggestions

---

**Last Updated**: January 4, 2026
**Version**: 1.0.0

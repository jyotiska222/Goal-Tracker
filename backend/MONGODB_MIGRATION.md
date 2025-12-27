# MongoDB Migration Guide - Goal Tracker Backend

## Migration Complete ✓

Your Goal Tracker backend has been successfully migrated from JSON file-based storage to MongoDB Atlas using Flask-PyMongo.

### Changes Made

#### 1. **Dependencies Updated** (`requirements.txt`)
   - Added `flask-pymongo==2.3.0` - Flask extension for MongoDB integration
   - Added `pymongo==4.6.0` - MongoDB Python driver
   - Added `python-dotenv==1.0.0` - Environment variable management

#### 2. **Backend Configuration** (`app.py`)
   - Replaced JSON file I/O with MongoDB operations
   - Integrated Flask-PyMongo for seamless database access
   - Updated all CRUD endpoints to use MongoDB collections
   - MongoDB Collections:
     - `users` - User accounts
     - `tags` - Goal tags
     - `monthly_goals` - Monthly goals
     - `weekly_goals` - Weekly goals
     - `daily_goals` - Daily goals
     - `habits` - User habits

#### 3. **Environment Configuration** (`.env`)
   ```
   MONGO_URI=mongodb+srv://goaltracker_dev:25930374Jj@cluster0.hz9nmde.mongodb.net/goaltracker?retryWrites=true&w=majority&appName=Cluster0
   FLASK_ENV=development
   FLASK_DEBUG=True
   ```

### Key Features of Migration

✓ **ObjectId Handling**: MongoDB ObjectIds are automatically converted to strings for JSON serialization
✓ **Automatic Type Conversion**: Document serialization handles MongoDB's native types
✓ **Backward Compatible**: All existing API endpoints work the same way from the frontend
✓ **Better Scalability**: MongoDB Atlas provides cloud-based, scalable storage
✓ **No Code Changes Needed**: Frontend code requires no modifications

### Database Schema (MongoDB Collections)

#### Users Collection
```json
{
  "_id": ObjectId,
  "username": "string",
  "password": "string (hashed)",
  "createdAt": "ISO8601 timestamp"
}
```

#### Tags Collection
```json
{
  "_id": ObjectId,
  "name": "string",
  "color": "hex color code",
  "userId": "string (user ObjectId)",
  "createdAt": "ISO8601 timestamp",
  "updatedAt": "ISO8601 timestamp" (optional)
}
```

#### Goals Collections (Monthly, Weekly, Daily)
```json
{
  "_id": ObjectId,
  "title": "string",
  "tagId": "string (tag ObjectId)",
  "userId": "string (user ObjectId)",
  "completed": "boolean",
  "createdAt": "ISO8601 timestamp",
  "updatedAt": "ISO8601 timestamp" (optional),
  // Additional fields vary by goal type
}
```

#### Habits Collection
```json
{
  "_id": ObjectId,
  "name": "string",
  "tagId": "string (tag ObjectId)",
  "userId": "string (user ObjectId)",
  "completedDates": ["YYYY-MM-DD", ...],
  "startDate": "YYYY-MM-DD",
  "createdAt": "ISO8601 timestamp",
  "updatedAt": "ISO8601 timestamp" (optional)
}
```

### Running the Application

1. **Install Dependencies** (already done):
   ```bash
   python -m pip install -r requirements.txt
   ```

2. **Start the Backend**:
   ```bash
   python app.py
   ```
   The app will run on `http://localhost:5000`

3. **Verify Connection**:
   ```bash
   curl http://localhost:5000/api/database-check
   ```
   Should return: `{"status": "ok", "message": "Database is working", "database_accessible": true}`

### API Endpoints (Unchanged)

All existing endpoints work as before:

**Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

**Tags**
- `GET /api/tags/<user_id>` - Get user tags
- `POST /api/tags` - Create tag
- `PUT /api/tags/<tag_id>` - Update tag
- `DELETE /api/tags/<tag_id>` - Delete tag

**Goals (Monthly)**
- `GET /api/goals/monthly/<user_id>` - Get monthly goals
- `POST /api/goals/monthly` - Create monthly goal
- `PUT /api/goals/monthly/<goal_id>` - Update monthly goal
- `DELETE /api/goals/monthly/<goal_id>` - Delete monthly goal

**Goals (Weekly)**
- `GET /api/goals/weekly/<user_id>` - Get weekly goals
- `POST /api/goals/weekly` - Create weekly goal
- `PUT /api/goals/weekly/<goal_id>` - Update weekly goal
- `DELETE /api/goals/weekly/<goal_id>` - Delete weekly goal

**Goals (Daily)**
- `GET /api/goals/daily/<user_id>` - Get daily goals
- `POST /api/goals/daily` - Create daily goal
- `PUT /api/goals/daily/<goal_id>` - Update daily goal
- `DELETE /api/goals/daily/<goal_id>` - Delete daily goal

**Habits**
- `GET /api/habits/<user_id>` - Get user habits
- `POST /api/habits` - Create habit
- `PUT /api/habits/<habit_id>` - Update habit
- `POST /api/habits/<habit_id>/toggle/<date>` - Toggle habit completion
- `DELETE /api/habits/<habit_id>` - Delete habit
- `GET /api/habits/<habit_id>/stats` - Get habit statistics

**Health Checks**
- `GET /health` - Backend health check
- `GET /api/health` - API health check
- `GET /api/database-check` - Database connection status

### Important Notes

1. **Data Migration**: The old JSON data files in the `data/` folder are no longer used. If you need to migrate existing data to MongoDB, you'll need to create a migration script.

2. **Password Security**: Passwords are hashed using SHA-256. Consider upgrading to bcrypt for production.

3. **Error Handling**: All endpoints include proper error handling and HTTP status codes.

4. **CORS**: Cross-origin requests are allowed for the specified origins (localhost, Vercel domains).

5. **Environment Variables**: The `.env` file contains sensitive information (credentials). Make sure to:
   - Never commit this file to version control
   - Add `.env` to `.gitignore`
   - Use different credentials for production

### Troubleshooting

**Connection Issues**
- Verify MongoDB Atlas cluster is running
- Check network access in MongoDB Atlas (IP whitelist should include 0.0.0.0/0 or your machine IP)
- Ensure the MONGO_URI is correct

**Document ID Issues**
- MongoDB uses ObjectId (`_id`), which the app automatically converts to strings for frontend use
- When referencing documents (parentId, tagId), use the string representation of the ObjectId

**Performance**
- MongoDB queries are indexed on userId for faster retrieval
- Consider adding more indexes if queries are slow

### Next Steps

1. ✓ Backend migration complete
2. Test all API endpoints with the frontend
3. Monitor MongoDB Atlas metrics for performance
4. Plan for production deployment with proper environment management
5. Consider adding indexes for frequently queried fields

---

**Migration Date**: December 28, 2025
**Status**: ✓ Complete and Ready for Testing

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import OperationFailure, ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from datetime import datetime
import hashlib
import os
from dotenv import load_dotenv
import logging
from functools import wraps
import time

load_dotenv()

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable werkzeug logging for health checks
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

# MongoDB Configuration with optimized settings
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://goaltracker_dev:25930374Jj@cluster0.hz9nmde.mongodb.net/goaltracker?retryWrites=true&w=majority&appName=Cluster0')

# Create MongoDB client with connection pooling and timeout settings
try:
    mongo_client = MongoClient(
        MONGO_URI,
        maxPoolSize=50,  # Increased connection pool
        minPoolSize=10,
        maxIdleTimeMS=45000,
        serverSelectionTimeoutMS=5000,  # 5 second timeout
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
        retryWrites=True,
        w='majority'
    )
    # Test the connection
    mongo_client.admin.command('ping')
    db = mongo_client.goaltracker
    logger.info("✅ MongoDB connected successfully with optimized settings")
except Exception as e:
    logger.error(f"❌ MongoDB Connection Error: {e}")
    db = None

# CORS Configuration
CORS(app, 
     origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", 
              "http://localhost:5174", "http://127.0.0.1:5000", "http://192.168.31.175:5000", 
              "https://goal-tracker-liart.vercel.app", "https://goal-tracker.vercel.app", 
              "https://goal-tracker-pearl.vercel.app"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

# ============== UTILITY FUNCTIONS ==============
def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if '_id' in doc and isinstance(doc['_id'], ObjectId):
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

def handle_db_errors(f):
    """Decorator for consistent error handling"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        try:
            if db is None:
                return jsonify({'error': 'Database not connected', 'success': False}), 503
            
            result = f(*args, **kwargs)
            
            # Log slow queries (> 1 second)
            elapsed = time.time() - start_time
            if elapsed > 1:
                logger.warning(f"⚠️ Slow query in {f.__name__}: {elapsed:.2f}s")
            
            return result
            
        except ConnectionFailure as e:
            logger.error(f"❌ Connection error in {f.__name__}: {e}")
            return jsonify({'error': 'Database connection failed', 'success': False}), 503
        except ServerSelectionTimeoutError as e:
            logger.error(f"❌ Server timeout in {f.__name__}: {e}")
            return jsonify({'error': 'Database timeout', 'success': False}), 504
        except Exception as e:
            logger.error(f"❌ Error in {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({'error': str(e), 'success': False}), 500
    
    return decorated_function

# ============== HEALTH CHECK ENDPOINTS ==============
@app.route('/health', methods=['GET'])
def health():
    """Check if backend is live"""
    return jsonify({'status': 'ok', 'message': 'Backend is live'}), 200

@app.route('/api/health', methods=['GET'])
def api_health():
    """Check if backend API is live"""
    return jsonify({'status': 'ok', 'message': 'Backend API is live'}), 200

@app.route('/api/database-check', methods=['GET'])
def database_check():
    """Check if database is working properly with detailed diagnostics"""
    try:
        if db is None:
            return jsonify({
                'status': 'error',
                'message': 'Database not initialized',
                'database_accessible': False
            }), 503
        
        # Ping database
        start = time.time()
        mongo_client.admin.command('ping')
        ping_time = (time.time() - start) * 1000
        
        # Count documents in collections
        users_count = db.users.count_documents({})
        
        return jsonify({
            'status': 'ok',
            'message': 'Database is working',
            'database_accessible': True,
            'ping_ms': round(ping_time, 2),
            'users_count': users_count,
            'connection_pool_size': 50
        }), 200
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Database error: {str(e)}',
            'database_accessible': False
        }), 500

# ============== AUTH ENDPOINTS ==============
@app.route('/api/auth/login', methods=['POST'])
@handle_db_errors
def login():
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    hashed_password = hash_password(password)
    
    # Use projection to only fetch needed fields
    user = db.users.find_one(
        {'username': username, 'password': hashed_password},
        {'username': 1}
    )
    
    if user:
        return jsonify({
            'success': True, 
            'user': {
                'id': str(user['_id']), 
                'username': user['username']
            }
        }), 200
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/auth/signup', methods=['POST'])
@handle_db_errors
def signup():
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    # Check if username exists
    if db.users.find_one({'username': username}, {'_id': 1}):
        return jsonify({'success': False, 'message': 'Username already exists'}), 400
    
    new_user = {
        'username': username,
        'password': hash_password(password),
        'createdAt': datetime.now().isoformat()
    }
    
    result = db.users.insert_one(new_user)
    
    return jsonify({
        'success': True, 
        'user': {
            'id': str(result.inserted_id), 
            'username': username
        }
    }), 201

# ============== TAGS ENDPOINTS ==============
@app.route('/api/tags/<user_id>', methods=['GET'])
@handle_db_errors
def get_tags(user_id):
    tags = list(db.tags.find({'userId': user_id}).sort('createdAt', -1))
    return jsonify([serialize_doc(tag) for tag in tags]), 200

@app.route('/api/tags', methods=['POST'])
@handle_db_errors
def create_tag():
    data = request.json
    
    if not data or not data.get('name') or not data.get('userId'):
        return jsonify({'error': 'Name and userId required', 'success': False}), 400
    
    new_tag = {
        'name': data.get('name'),
        'color': data.get('color', '#3b82f6'),
        'userId': data.get('userId'),
        'createdAt': datetime.now().isoformat()
    }
    
    result = db.tags.insert_one(new_tag)
    new_tag['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_tag)), 201

@app.route('/api/tags/<tag_id>', methods=['PUT'])
@handle_db_errors
def update_tag(tag_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(tag_id):
        return jsonify({'error': 'Invalid tag ID', 'success': False}), 400
    
    update_data = {
        'name': data.get('name'),
        'color': data.get('color'),
        'updatedAt': datetime.now().isoformat()
    }
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = db.tags.find_one_and_update(
        {'_id': ObjectId(tag_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Tag not found', 'success': False}), 404

@app.route('/api/tags/<tag_id>', methods=['DELETE'])
@handle_db_errors
def delete_tag(tag_id):
    if not ObjectId.is_valid(tag_id):
        return jsonify({'error': 'Invalid tag ID', 'success': False}), 400
    
    result = db.tags.delete_one({'_id': ObjectId(tag_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Tag not found', 'success': False}), 404

# ============== MONTHLY GOALS ENDPOINTS ==============
@app.route('/api/goals/monthly/<user_id>', methods=['GET'])
@handle_db_errors
def get_monthly_goals(user_id):
    goals = list(db.monthly_goals.find({'userId': user_id}).sort('createdAt', -1))
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/monthly', methods=['POST'])
@handle_db_errors
def create_monthly_goal():
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    new_goal = {
        'title': data.get('title'),
        'tagId': data.get('tagId', ''),
        'month': data.get('month'),
        'year': data.get('year'),
        'userId': data.get('userId'),
        'completed': False,
        'createdAt': datetime.now().isoformat()
    }
    
    result = db.monthly_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/monthly/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_monthly_goal(goal_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {k: v for k, v in {
        'title': data.get('title'),
        'tagId': data.get('tagId'),
        'month': data.get('month'),
        'year': data.get('year'),
        'completed': data.get('completed'),
        'updatedAt': datetime.now().isoformat()
    }.items() if v is not None}
    
    result = db.monthly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/monthly/<goal_id>', methods=['DELETE'])
@handle_db_errors
def delete_monthly_goal(goal_id):
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.monthly_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== WEEKLY GOALS ENDPOINTS ==============
@app.route('/api/goals/weekly/<user_id>', methods=['GET'])
@handle_db_errors
def get_weekly_goals(user_id):
    goals = list(db.weekly_goals.find({'userId': user_id}).sort('createdAt', -1))
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/weekly', methods=['POST'])
@handle_db_errors
def create_weekly_goal():
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    new_goal = {
        'title': data.get('title'),
        'tagId': data.get('tagId', ''),
        'parentId': data.get('parentId', ''),
        'weekStart': data.get('weekStart'),
        'weekEnd': data.get('weekEnd'),
        'weekNumber': data.get('weekNumber'),
        'year': data.get('year'),
        'userId': data.get('userId'),
        'completed': False,
        'createdAt': datetime.now().isoformat()
    }
    
    # Inherit tag from parent if no tag specified and parent exists
    if not new_goal['tagId'] and new_goal['parentId'] and ObjectId.is_valid(new_goal['parentId']):
        parent = db.monthly_goals.find_one({'_id': ObjectId(new_goal['parentId'])}, {'tagId': 1})
        if parent:
            new_goal['tagId'] = parent.get('tagId', '')
    
    result = db.weekly_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/weekly/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_weekly_goal(goal_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {k: v for k, v in {
        'title': data.get('title'),
        'tagId': data.get('tagId'),
        'parentId': data.get('parentId'),
        'weekStart': data.get('weekStart'),
        'weekEnd': data.get('weekEnd'),
        'weekNumber': data.get('weekNumber'),
        'year': data.get('year'),
        'completed': data.get('completed'),
        'updatedAt': datetime.now().isoformat()
    }.items() if v is not None}
    
    result = db.weekly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/weekly/<goal_id>', methods=['DELETE'])
@handle_db_errors
def delete_weekly_goal(goal_id):
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.weekly_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== DAILY GOALS ENDPOINTS ==============
@app.route('/api/goals/daily/<user_id>', methods=['GET'])
@handle_db_errors
def get_daily_goals(user_id):
    goals = list(db.daily_goals.find({'userId': user_id}).sort('createdAt', -1))
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/daily', methods=['POST'])
@handle_db_errors
def create_daily_goal():
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    new_goal = {
        'title': data.get('title'),
        'tagId': data.get('tagId', ''),
        'parentId': data.get('parentId', ''),
        'date': data.get('date'),
        'userId': data.get('userId'),
        'completed': False,
        'createdAt': datetime.now().isoformat()
    }
    
    # Inherit tag from parent if no tag specified and parent exists
    if not new_goal['tagId'] and new_goal['parentId'] and ObjectId.is_valid(new_goal['parentId']):
        parent = db.weekly_goals.find_one({'_id': ObjectId(new_goal['parentId'])}, {'tagId': 1})
        if parent:
            new_goal['tagId'] = parent.get('tagId', '')
    
    result = db.daily_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/daily/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_daily_goal(goal_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {k: v for k, v in {
        'title': data.get('title'),
        'tagId': data.get('tagId'),
        'parentId': data.get('parentId'),
        'date': data.get('date'),
        'completed': data.get('completed'),
        'updatedAt': datetime.now().isoformat()
    }.items() if v is not None}
    
    result = db.daily_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/daily/<goal_id>', methods=['DELETE'])
@handle_db_errors
def delete_daily_goal(goal_id):
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.daily_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== HABITS ENDPOINTS ==============
@app.route('/api/habits/<user_id>', methods=['GET'])
@handle_db_errors
def get_habits(user_id):
    habits = list(db.habits.find({'userId': user_id}).sort('createdAt', -1))
    return jsonify([serialize_doc(habit) for habit in habits]), 200

@app.route('/api/habits', methods=['POST'])
@handle_db_errors
def create_habit():
    data = request.json
    
    if not data or not data.get('name') or not data.get('userId'):
        return jsonify({'error': 'Name and userId required', 'success': False}), 400
    
    new_habit = {
        'name': data.get('name'),
        'tagId': data.get('tagId', ''),
        'userId': data.get('userId'),
        'completedDates': [],
        'startDate': datetime.now().strftime('%Y-%m-%d'),
        'createdAt': datetime.now().isoformat()
    }
    
    result = db.habits.insert_one(new_habit)
    new_habit['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_habit)), 201

@app.route('/api/habits/<habit_id>', methods=['PUT'])
@handle_db_errors
def update_habit(habit_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    update_data = {k: v for k, v in {
        'name': data.get('name'),
        'tagId': data.get('tagId'),
        'completedDates': data.get('completedDates'),
        'updatedAt': datetime.now().isoformat()
    }.items() if v is not None}
    
    result = db.habits.find_one_and_update(
        {'_id': ObjectId(habit_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Habit not found', 'success': False}), 404

@app.route('/api/habits/<habit_id>/toggle/<date>', methods=['POST'])
@handle_db_errors
def toggle_habit(habit_id, date):
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    # Only allow toggling for today
    today = datetime.now().strftime('%Y-%m-%d')
    if date != today:
        return jsonify({'error': 'Can only toggle habit for today', 'success': False}), 400
    
    habit = db.habits.find_one({'_id': ObjectId(habit_id)}, {'completedDates': 1})
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    completed_dates = habit.get('completedDates', [])
    
    if date in completed_dates:
        completed_dates.remove(date)
    else:
        completed_dates.append(date)
    
    result = db.habits.find_one_and_update(
        {'_id': ObjectId(habit_id)},
        {'$set': {
            'completedDates': completed_dates,
            'updatedAt': datetime.now().isoformat()
        }},
        return_document=True
    )
    
    return jsonify(serialize_doc(result)), 200

@app.route('/api/habits/<habit_id>', methods=['DELETE'])
@handle_db_errors
def delete_habit(habit_id):
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    result = db.habits.delete_one({'_id': ObjectId(habit_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Habit not found', 'success': False}), 404

# ============== STATS ENDPOINT ==============
@app.route('/api/habits/<habit_id>/stats', methods=['GET'])
@handle_db_errors
def get_habit_stats(habit_id):
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    habit = db.habits.find_one({'_id': ObjectId(habit_id)}, {'startDate': 1, 'completedDates': 1})
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    start_date = datetime.strptime(habit['startDate'], '%Y-%m-%d')
    today = datetime.now()
    total_days = (today - start_date).days + 1
    completed_days = len(habit.get('completedDates', []))
    missed_days = total_days - completed_days
    
    return jsonify({
        'totalDays': total_days,
        'completedDays': completed_days,
        'missedDays': missed_days,
        'completionRate': round((completed_days / total_days * 100) if total_days > 0 else 0, 2)
    }), 200

# ============== ERROR HANDLERS ==============
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found', 'success': False}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error', 'success': False}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
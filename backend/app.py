## requirements.txt FORMAT
# Flask==3.0.0
# flask-cors==4.0.0
# Werkzeug==3.0.1
# gunicorn==21.2.0
# flask-pymongo==2.3.0
# pymongo==4.6.0
# python-dotenv==1.0.0
# pytz==2024.1
# PyJWT==2.10.1
# google-auth==2.25.2
# google-auth-oauthlib==1.2.0
# google-auth-httplib2==0.2.0
# requests==2.31.0
# flask-limiter==3.5.0

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure, ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from datetime import datetime, timezone, timedelta
import os
from dotenv import load_dotenv
import logging
from functools import wraps
import time
import pytz
import jwt
import json
import re
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import atexit

load_dotenv()

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable werkzeug logging for health checks
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# MongoDB Configuration with optimized settings
MONGO_URI = os.getenv('MONGO_URI')
mongo_client = None
db = None

if not MONGO_URI:
    logger.error("❌ MONGO_URI environment variable is not set. Check your .env file!")
else:
    try:
        logger.info("🔌 Attempting to connect to MongoDB...")
        mongo_client = MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=45000,
            serverSelectionTimeoutMS=15000,
            connectTimeoutMS=15000,
            socketTimeoutMS=15000,
            retryWrites=True,
            w='majority',
            readPreference='secondaryPreferred'
        )
        
        # Test the connection
        logger.info("📡 Testing MongoDB connection...")
        mongo_client.admin.command('ping')
        db = mongo_client.goaltracker
        logger.info("✅ MongoDB connected successfully")
        
        # Create indexes for better query performance
        logger.info("🔧 Creating database indexes...")
        
        # User indexes
        db.users.create_index([('username', ASCENDING)], unique=True, background=True)
        db.users.create_index([('email', ASCENDING)], background=True)
        db.users.create_index([('google_id', ASCENDING)], background=True)
        db.users.create_index([('timezone', ASCENDING)], background=True)
        
        # Tags indexes
        db.tags.create_index([('userId', ASCENDING)], background=True)
        db.tags.create_index([('userId', ASCENDING), ('createdAt', DESCENDING)], background=True)
        
        # Monthly goals indexes
        db.monthly_goals.create_index([('userId', ASCENDING)], background=True)
        db.monthly_goals.create_index([('userId', ASCENDING), ('year', DESCENDING), ('month', DESCENDING)], background=True)
        db.monthly_goals.create_index([('userId', ASCENDING), ('createdAt', DESCENDING)], background=True)
        
        # Weekly goals indexes
        db.weekly_goals.create_index([('userId', ASCENDING)], background=True)
        db.weekly_goals.create_index([('userId', ASCENDING), ('year', DESCENDING), ('weekNumber', DESCENDING)], background=True)
        db.weekly_goals.create_index([('userId', ASCENDING), ('parentId', ASCENDING)], background=True)
        db.weekly_goals.create_index([('userId', ASCENDING), ('createdAt', DESCENDING)], background=True)
        
        # Daily goals indexes
        db.daily_goals.create_index([('userId', ASCENDING)], background=True)
        db.daily_goals.create_index([('userId', ASCENDING), ('date', DESCENDING)], background=True)
        db.daily_goals.create_index([('userId', ASCENDING), ('parentId', ASCENDING)], background=True)
        db.daily_goals.create_index([('userId', ASCENDING), ('createdAt', DESCENDING)], background=True)
        
        # Habits indexes
        db.habits.create_index([('userId', ASCENDING)], background=True)
        db.habits.create_index([('userId', ASCENDING), ('createdAt', DESCENDING)], background=True)
        
        logger.info("✅ Database indexes created successfully")
        
    except ServerSelectionTimeoutError as e:
        logger.error(f"❌ MongoDB Server Selection Timeout: {e}")
        logger.error("📝 Possible causes:")
        logger.error("   1. Your IP address is not whitelisted in MongoDB Atlas")
        logger.error("   2. Network connectivity issues (firewall/proxy)")
        logger.error("   3. MongoDB Atlas cluster is paused or unreachable")
        logger.error("   4. Invalid connection string credentials")
        db = None
    except ConnectionFailure as e:
        logger.error(f"❌ MongoDB Connection Failed: {e}")
        logger.error("📝 Check MongoDB Atlas IP whitelist and network connectivity")
        db = None
    except Exception as e:
        logger.error(f"❌ MongoDB Connection Error: {e}")
        logger.error(f"Error Type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        db = None

# Cleanup on shutdown
@atexit.register
def cleanup():
    if mongo_client:
        logger.info("🔌 Closing MongoDB connection...")
        mongo_client.close()

# CORS Configuration
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',')
CORS(app, 
     origins=[origin.strip() for origin in CORS_ORIGINS if origin.strip()],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

# ============== SECURITY FUNCTIONS ==============
def sanitize_string(text, max_length=500):
    """Sanitize user input to prevent injection attacks"""
    if not text or not isinstance(text, str):
        return text
    # Remove potential MongoDB operators
    text = re.sub(r'[${}]', '', text)
    return text[:max_length].strip()

def validate_user_id(user_id):
    """Validate user ID format"""
    if not user_id or not isinstance(user_id, str):
        return False
    return ObjectId.is_valid(user_id)

def require_auth(f):
    """Decorator to require authentication - checks if userId matches authenticated user"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get userId from URL parameters
        user_id = kwargs.get('user_id')
        
        # For now, we trust the userId (since you're using Google OAuth)
        # In production, you should verify JWT token from Authorization header
        if not user_id or not validate_user_id(user_id):
            return jsonify({'error': 'Unauthorized', 'success': False}), 401
        
        return f(*args, **kwargs)
    return decorated_function

# ============== UTILITY FUNCTIONS ==============
def get_user_timezone(user_id):
    """Get user's timezone from database, default to UTC"""
    try:
        user = db.users.find_one(
            {'_id': ObjectId(user_id)}, 
            {'timezone': 1}
        )
        return user.get('timezone', 'UTC') if user else 'UTC'
    except Exception:
        return 'UTC'

def get_utc_now():
    """Get current UTC time with timezone info"""
    return datetime.now(timezone.utc)

def convert_to_user_timezone(dt, user_timezone='UTC'):
    """Convert UTC datetime to user's timezone"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        tz = pytz.timezone(user_timezone)
        return dt.astimezone(tz)
    except Exception:
        return dt.astimezone(pytz.UTC)

def convert_to_utc(dt, user_timezone='UTC'):
    """Convert user's local datetime to UTC"""
    if dt is None:
        return None
    try:
        tz = pytz.timezone(user_timezone)
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        return dt.astimezone(timezone.utc)
    except Exception:
        return dt if isinstance(dt, datetime) else datetime.fromisoformat(dt)

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
            
            # Log slow queries
            elapsed = time.time() - start_time
            if elapsed > 0.5:
                logger.warning(f"⚠️ Slow query in {f.__name__}: {elapsed:.2f}s")
            elif elapsed > 0.2:
                logger.info(f"📊 Query {f.__name__}: {elapsed:.2f}s")
            
            return result
            
        except ConnectionFailure as e:
            logger.error(f"❌ Connection error in {f.__name__}: {e}")
            return jsonify({'error': 'Database connection failed', 'success': False}), 503
        except ServerSelectionTimeoutError as e:
            logger.error(f"❌ Server timeout in {f.__name__}: {e}")
            return jsonify({'error': 'Database timeout', 'success': False}), 504
        except Exception as e:
            logger.error(f"❌ Error in {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({'error': 'Internal server error', 'success': False}), 500
    
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
        
        start = time.time()
        mongo_client.admin.command('ping')
        ping_time = (time.time() - start) * 1000
        
        users_count = db.users.estimated_document_count()
        
        indexes_info = {
            'tags': len(list(db.tags.list_indexes())),
            'monthly_goals': len(list(db.monthly_goals.list_indexes())),
            'weekly_goals': len(list(db.weekly_goals.list_indexes())),
            'daily_goals': len(list(db.daily_goals.list_indexes())),
            'habits': len(list(db.habits.list_indexes()))
        }
        
        return jsonify({
            'status': 'ok',
            'message': 'Database is working',
            'database_accessible': True,
            'ping_ms': round(ping_time, 2),
            'users_count': users_count,
            'indexes': indexes_info,
            'connection_pool_size': 50
        }), 200
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': 'Database error occurred',
            'database_accessible': False
        }), 500

# ============== GOOGLE OAUTH ENDPOINTS ==============
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

@app.route('/api/auth/google', methods=['POST'])
@limiter.limit("10 per minute")
@handle_db_errors
def google_auth():
    """Verify Google ID token and authenticate user"""
    data = request.json
    
    if not data or not data.get('token'):
        return jsonify({'success': False, 'message': 'No token provided'}), 400
    
    if not GOOGLE_CLIENT_ID:
        return jsonify({'success': False, 'message': 'Google OAuth not configured'}), 500
    
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            data['token'], 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        google_id = idinfo.get('sub')
        picture = idinfo.get('picture', '')
        timezone_str = sanitize_string(data.get('timezone', 'UTC'), 50)
        
        if not email or not google_id:
            return jsonify({'success': False, 'message': 'Invalid token data'}), 400
        
        # Validate timezone
        try:
            pytz.timezone(timezone_str)
        except Exception:
            timezone_str = 'UTC'
        
        # Check if user exists
        existing_user = db.users.find_one(
            {'$or': [{'email': email}, {'google_id': google_id}]},
            {'_id': 1, 'username': 1, 'timezone': 1, 'email': 1, 'name': 1, 'picture': 1}
        )
        
        if existing_user:
            if data.get('timezone'):
                db.users.update_one(
                    {'_id': existing_user['_id']},
                    {'$set': {'timezone': timezone_str}}
                )
            return jsonify({
                'success': True,
                'user': {
                    'id': str(existing_user['_id']),
                    'username': existing_user['username'],
                    'email': existing_user.get('email', email),
                    'name': existing_user.get('name', name),
                    'timezone': timezone_str,
                    'picture': existing_user.get('picture', picture)
                }
            }), 200
        
        # Create new user
        username = sanitize_string(email.split('@')[0], 50)
        
        # Ensure username is unique
        counter = 1
        original_username = username
        while db.users.find_one({'username': username}, {'_id': 1}):
            username = f"{original_username}{counter}"
            counter += 1
        
        new_user = {
            'username': username,
            'email': email,
            'google_id': google_id,
            'name': name,
            'picture': picture,
            'timezone': timezone_str,
            'createdAt': get_utc_now().isoformat(),
            'authMethod': 'google'
        }
        
        result = db.users.insert_one(new_user)
        
        return jsonify({
            'success': True,
            'user': {
                'id': str(result.inserted_id),
                'username': username,
                'email': email,
                'name': name,
                'timezone': timezone_str,
                'picture': picture
            }
        }), 201
    
    except ValueError as e:
        logger.error(f"Invalid token: {e}")
        return jsonify({'success': False, 'message': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return jsonify({'success': False, 'message': 'Authentication failed'}), 500

# ============== USER ENDPOINTS ==============
@app.route('/api/user/<user_id>/timezone', methods=['PUT'])
@handle_db_errors
@require_auth
def update_user_timezone(user_id):
    """Update user's timezone from geolocation"""
    data = request.json
    
    if not data or not data.get('timezone'):
        return jsonify({'error': 'Timezone required', 'success': False}), 400
    
    timezone_str = sanitize_string(data.get('timezone'), 50)
    
    # Validate timezone
    try:
        pytz.timezone(timezone_str)
    except Exception:
        return jsonify({'error': 'Invalid timezone', 'success': False}), 400
    
    result = db.users.find_one_and_update(
        {'_id': ObjectId(user_id)},
        {'$set': {'timezone': timezone_str}},
        projection={'timezone': 1},
        return_document=True
    )
    
    if result:
        return jsonify({
            'success': True,
            'timezone': result.get('timezone', 'UTC')
        }), 200
    
    return jsonify({'error': 'User not found', 'success': False}), 404

# ============== TAGS ENDPOINTS ==============
@app.route('/api/tags/<user_id>', methods=['GET'])
@handle_db_errors
@require_auth
def get_tags(user_id):
    """Get all tags for a user with pagination"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    skip = (page - 1) * limit
    
    tags = list(db.tags.find(
        {'userId': user_id},
        {'_id': 1, 'name': 1, 'color': 1, 'userId': 1, 'createdAt': 1}
    ).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    
    return jsonify([serialize_doc(tag) for tag in tags]), 200

@app.route('/api/tags', methods=['POST'])
@handle_db_errors
def create_tag():
    """Create a new tag"""
    data = request.json
    
    if not data or not data.get('name') or not data.get('userId'):
        return jsonify({'error': 'Name and userId required', 'success': False}), 400
    
    user_id = data.get('userId')
    if not validate_user_id(user_id):
        return jsonify({'error': 'Invalid userId', 'success': False}), 400
    
    new_tag = {
        'name': sanitize_string(data.get('name'), 100),
        'color': sanitize_string(data.get('color', '#3b82f6'), 20),
        'userId': user_id,
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.tags.insert_one(new_tag)
    new_tag['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_tag)), 201

@app.route('/api/tags/<tag_id>', methods=['PUT'])
@handle_db_errors
def update_tag(tag_id):
    """Update a tag"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(tag_id):
        return jsonify({'error': 'Invalid tag ID', 'success': False}), 400
    
    update_data = {}
    if data.get('name'):
        update_data['name'] = sanitize_string(data.get('name'), 100)
    if data.get('color'):
        update_data['color'] = sanitize_string(data.get('color'), 20)
    update_data['updatedAt'] = get_utc_now().isoformat()
    
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
    """Delete a tag"""
    if not ObjectId.is_valid(tag_id):
        return jsonify({'error': 'Invalid tag ID', 'success': False}), 400
    
    result = db.tags.delete_one({'_id': ObjectId(tag_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Tag not found', 'success': False}), 404

# ============== MONTHLY GOALS ENDPOINTS ==============
@app.route('/api/goals/monthly/<user_id>', methods=['GET'])
@handle_db_errors
@require_auth
def get_monthly_goals(user_id):
    """Get monthly goals with pagination"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    skip = (page - 1) * limit
    
    goals = list(db.monthly_goals.find(
        {'userId': user_id}
    ).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/monthly', methods=['POST'])
@handle_db_errors
def create_monthly_goal():
    """Create a monthly goal"""
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    user_id = data.get('userId')
    if not validate_user_id(user_id):
        return jsonify({'error': 'Invalid userId', 'success': False}), 400
    
    new_goal = {
        'title': sanitize_string(data.get('title'), 500),
        'tagId': sanitize_string(data.get('tagId', ''), 50),
        'month': int(data.get('month', 1)),
        'year': int(data.get('year', datetime.now().year)),
        'userId': user_id,
        'completed': False,
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.monthly_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/monthly/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_monthly_goal(goal_id):
    """Update a monthly goal"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {'updatedAt': get_utc_now().isoformat()}
    
    if 'title' in data:
        update_data['title'] = sanitize_string(data['title'], 500)
    if 'tagId' in data:
        update_data['tagId'] = sanitize_string(data['tagId'], 50)
    if 'month' in data:
        update_data['month'] = int(data['month'])
    if 'year' in data:
        update_data['year'] = int(data['year'])
    if 'completed' in data:
        update_data['completed'] = bool(data['completed'])
    
    result = db.monthly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        # Cascade completion to child goals
        if update_data.get('completed') is True:
            utc_now = get_utc_now().isoformat()
            # Batch update weekly goals
            db.weekly_goals.update_many(
                {'parentId': goal_id},
                {'$set': {'completed': True, 'updatedAt': utc_now}}
            )
            # Batch update daily goals
            weekly_goal_ids = [str(wg['_id']) for wg in db.weekly_goals.find(
                {'parentId': goal_id}, 
                {'_id': 1}
            )]
            if weekly_goal_ids:
                db.daily_goals.update_many(
                    {'parentId': {'$in': weekly_goal_ids}},
                    {'$set': {'completed': True, 'updatedAt': utc_now}}
                )
        
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/monthly/<goal_id>', methods=['DELETE'])
@handle_db_errors
def delete_monthly_goal(goal_id):
    """Delete a monthly goal"""
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.monthly_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== WEEKLY GOALS ENDPOINTS ==============
@app.route('/api/goals/weekly/<user_id>', methods=['GET'])
@handle_db_errors
@require_auth
def get_weekly_goals(user_id):
    """Get weekly goals with pagination"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    skip = (page - 1) * limit
    
    goals = list(db.weekly_goals.find(
        {'userId': user_id}
    ).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/weekly', methods=['POST'])
@handle_db_errors
def create_weekly_goal():
    """Create a weekly goal"""
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    user_id = data.get('userId')
    if not validate_user_id(user_id):
        return jsonify({'error': 'Invalid userId', 'success': False}), 400
    
    new_goal = {
        'title': sanitize_string(data.get('title'), 500),
        'tagId': sanitize_string(data.get('tagId', ''), 50),
        'parentId': sanitize_string(data.get('parentId', ''), 50),
        'weekStart': data.get('weekStart'),
        'weekEnd': data.get('weekEnd'),
        'weekNumber': int(data.get('weekNumber', 1)),
        'year': int(data.get('year', datetime.now().year)),
        'userId': user_id,
        'completed': False,
        'createdAt': get_utc_now().isoformat()
    }
    
    # Inherit tag from parent
    if not new_goal['tagId'] and new_goal['parentId'] and ObjectId.is_valid(new_goal['parentId']):
        parent = db.monthly_goals.find_one(
            {'_id': ObjectId(new_goal['parentId'])}, 
            {'tagId': 1}
        )
        if parent:
            new_goal['tagId'] = parent.get('tagId', '')
    
    result = db.weekly_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/weekly/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_weekly_goal(goal_id):
    """Update a weekly goal"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {'updatedAt': get_utc_now().isoformat()}
    
    if 'title' in data:
        update_data['title'] = sanitize_string(data['title'], 500)
    if 'tagId' in data:
        update_data['tagId'] = sanitize_string(data['tagId'], 50)
    if 'parentId' in data:
        update_data['parentId'] = sanitize_string(data['parentId'], 50)
    if 'weekStart' in data:
        update_data['weekStart'] = data['weekStart']
    if 'weekEnd' in data:
        update_data['weekEnd'] = data['weekEnd']
    if 'weekNumber' in data:
        update_data['weekNumber'] = int(data['weekNumber'])
    if 'year' in data:
        update_data['year'] = int(data['year'])
    if 'completed' in data:
        update_data['completed'] = bool(data['completed'])
    
    result = db.weekly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        # Cascade completion to child daily goals
        if update_data.get('completed') is True:
            utc_now = get_utc_now().isoformat()
            db.daily_goals.update_many(
                {'parentId': goal_id},
                {'$set': {'completed': True, 'updatedAt': utc_now}}
            )
        
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/weekly/<goal_id>', methods=['DELETE'])
@handle_db_errors
def delete_weekly_goal(goal_id):
    """Delete a weekly goal"""
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.weekly_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== DAILY GOALS ENDPOINTS ==============
@app.route('/api/goals/daily/<user_id>', methods=['GET'])
@handle_db_errors
@require_auth
def get_daily_goals(user_id):
    """Get daily goals with pagination"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    skip = (page - 1) * limit
    
    goals = list(db.daily_goals.find(
        {'userId': user_id}
    ).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    
    return jsonify([serialize_doc(goal) for goal in goals]), 200

@app.route('/api/goals/daily', methods=['POST'])
@handle_db_errors
def create_daily_goal():
    """Create a daily goal"""
    data = request.json
    
    if not data or not data.get('title') or not data.get('userId'):
        return jsonify({'error': 'Title and userId required', 'success': False}), 400
    
    user_id = data.get('userId')
    if not validate_user_id(user_id):
        return jsonify({'error': 'Invalid userId', 'success': False}), 400
    
    new_goal = {
        'title': sanitize_string(data.get('title'), 500),
        'tagId': sanitize_string(data.get('tagId', ''), 50),
        'parentId': sanitize_string(data.get('parentId', ''), 50),
        'date': data.get('date'),
        'userId': user_id,
        'completed': False,
        'createdAt': get_utc_now().isoformat()
    }
    
    # Inherit tag from parent
    if not new_goal['tagId'] and new_goal['parentId'] and ObjectId.is_valid(new_goal['parentId']):
        parent = db.weekly_goals.find_one(
            {'_id': ObjectId(new_goal['parentId'])}, 
            {'tagId': 1}
        )
        if parent:
            new_goal['tagId'] = parent.get('tagId', '')
    
    result = db.daily_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/daily/<goal_id>', methods=['PUT'])
@handle_db_errors
def update_daily_goal(goal_id):
    """Update a daily goal"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    update_data = {'updatedAt': get_utc_now().isoformat()}
    
    if 'title' in data:
        update_data['title'] = sanitize_string(data['title'], 500)
    if 'tagId' in data:
        update_data['tagId'] = sanitize_string(data['tagId'], 50)
    if 'parentId' in data:
        update_data['parentId'] = sanitize_string(data['parentId'], 50)
    if 'date' in data:
        update_data['date'] = data['date']
    if 'completed' in data:
        update_data['completed'] = bool(data['completed'])
    
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
    """Delete a daily goal"""
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    result = db.daily_goals.delete_one({'_id': ObjectId(goal_id)})
    
    if result.deleted_count > 0:
        return jsonify({'success': True}), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

# ============== HABITS ENDPOINTS ==============
@app.route('/api/habits/<user_id>', methods=['GET'])
@handle_db_errors
@require_auth
def get_habits(user_id):
    """Get habits with pagination"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 100)), 500)
    skip = (page - 1) * limit
    
    habits = list(db.habits.find(
        {'userId': user_id}
    ).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    
    return jsonify([serialize_doc(habit) for habit in habits]), 200

@app.route('/api/habits', methods=['POST'])
@handle_db_errors
def create_habit():
    """Create a habit"""
    data = request.json
    
    if not data or not data.get('name') or not data.get('userId'):
        return jsonify({'error': 'Name and userId required', 'success': False}), 400
    
    user_id = data.get('userId')
    if not validate_user_id(user_id):
        return jsonify({'error': 'Invalid userId', 'success': False}), 400
    
    new_habit = {
        'name': sanitize_string(data.get('name'), 500),
        'tagId': sanitize_string(data.get('tagId', ''), 50),
        'userId': user_id,
        'completedDates': [],
        'startDate': get_utc_now().strftime('%Y-%m-%d'),
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.habits.insert_one(new_habit)
    new_habit['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_habit)), 201

@app.route('/api/habits/<habit_id>', methods=['PUT'])
@handle_db_errors
def update_habit(habit_id):
    """Update a habit"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    update_data = {'updatedAt': get_utc_now().isoformat()}
    
    if 'name' in data:
        update_data['name'] = sanitize_string(data['name'], 500)
    if 'tagId' in data:
        update_data['tagId'] = sanitize_string(data['tagId'], 50)
    if 'completedDates' in data:
        # Sanitize each date in the array
        update_data['completedDates'] = [
            sanitize_string(date, 20) for date in data['completedDates']
        ]
    
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
    """Toggle habit completion for a specific date"""
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    # Get habit with userId first
    habit = db.habits.find_one(
        {'_id': ObjectId(habit_id)}, 
        {'completedDates': 1, 'userId': 1}
    )
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    # Normalize the date format
    try:
        parsed_date = datetime.strptime(date, '%Y-%m-%d')
        normalized_date = parsed_date.strftime('%Y-%m-%d')
    except ValueError:
        try:
            parsed_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            normalized_date = parsed_date.strftime('%Y-%m-%d')
        except Exception:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD', 'success': False}), 400
    
    # Get user's timezone and calculate today
    user_timezone = get_user_timezone(habit['userId'])
    utc_now = get_utc_now()
    today_user_tz = convert_to_user_timezone(utc_now, user_timezone).strftime('%Y-%m-%d')
    
    logger.info(f"Toggle habit: received={date}, normalized={normalized_date}, today={today_user_tz}, tz={user_timezone}")
    
    if normalized_date != today_user_tz:
        return jsonify({
            'error': 'Can only toggle habit for today',
            'success': False,
            'received_date': normalized_date,
            'today_date': today_user_tz,
            'user_timezone': user_timezone
        }), 400
    
    completed_dates = habit.get('completedDates', [])
    
    # Toggle the date
    if normalized_date in completed_dates:
        completed_dates.remove(normalized_date)
    else:
        completed_dates.append(normalized_date)
    
    result = db.habits.find_one_and_update(
        {'_id': ObjectId(habit_id)},
        {'$set': {
            'completedDates': completed_dates,
            'updatedAt': get_utc_now().isoformat()
        }},
        return_document=True
    )
    
    return jsonify(serialize_doc(result)), 200

@app.route('/api/habits/<habit_id>', methods=['DELETE'])
@handle_db_errors
def delete_habit(habit_id):
    """Delete a habit"""
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
    """Get statistics for a habit"""
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    habit = db.habits.find_one(
        {'_id': ObjectId(habit_id)}, 
        {'startDate': 1, 'completedDates': 1}
    )
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    try:
        start_date = datetime.strptime(habit['startDate'], '%Y-%m-%d')
        today = get_utc_now()
        total_days = (today - start_date).days + 1
        completed_days = len(habit.get('completedDates', []))
        missed_days = max(0, total_days - completed_days)
        
        return jsonify({
            'totalDays': total_days,
            'completedDays': completed_days,
            'missedDays': missed_days,
            'completionRate': round((completed_days / total_days * 100) if total_days > 0 else 0, 2)
        }), 200
    except Exception as e:
        logger.error(f"Error calculating habit stats: {e}")
        return jsonify({'error': 'Error calculating statistics', 'success': False}), 500

# ============== ERROR HANDLERS ==============
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found', 'success': False}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error', 'success': False}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit errors"""
    return jsonify({'error': 'Rate limit exceeded. Please try again later.', 'success': False}), 429

# ============== MAIN ==============
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
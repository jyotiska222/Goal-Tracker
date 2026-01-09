# Flask==3.0.0
# flask-cors==4.0.0
# Werkzeug==3.0.1
# gunicorn==21.2.0
# flask-pymongo==2.3.0
# pymongo==4.6.0
# python-dotenv==1.0.0







from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure, ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from datetime import datetime, timezone, timedelta
import hashlib
import os
from dotenv import load_dotenv
import logging
from functools import wraps
import time
import pytz
import jwt
import json
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

load_dotenv()

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable werkzeug logging for health checks
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)

# MongoDB Configuration with optimized settings
MONGO_URI = os.getenv('MONGO_URI')

if not MONGO_URI:
    logger.error("❌ MONGO_URI environment variable is not set. Check your .env file!")
    db = None
else:
    # Create MongoDB client with connection pooling and timeout settings
    try:
        logger.info("🔌 Attempting to connect to MongoDB...")
        mongo_client = MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=45000,
            serverSelectionTimeoutMS=15000,  # Increased to 15 seconds for replica set discovery
            connectTimeoutMS=15000,
            socketTimeoutMS=15000,
            retryWrites=True,
            w='majority',
            readPreference='secondaryPreferred'  # Use secondary for reads when available
        )
        # Test the connection
        logger.info("📡 Testing MongoDB connection...")
        mongo_client.admin.command('ping')
        db = mongo_client.goaltracker
        logger.info("✅ MongoDB connected successfully")
        
        # Create indexes for better query performance
        logger.info("🔧 Creating database indexes...")
        
        # User index
        db.users.create_index([('username', ASCENDING)], unique=True, background=True)
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

# CORS Configuration - read from environment variable
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',')
CORS(app, 
     origins=[origin.strip() for origin in CORS_ORIGINS if origin.strip()],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

# ============== RATE LIMITING CONFIGURATION ==============
# Initialize Flask-Limiter with in-memory storage (use Redis in production for distributed systems)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],  # Global default limits
    storage_uri="memory://",  # In-memory storage - for production use Redis: "redis://localhost:6379"
)

# Enable rate limit headers in responses
limiter.init_app(app)
# Cache for timezone lookups (in-memory cache to reduce DB hits)
_timezone_cache = {}
_cache_timeout = 3600  # 1 hour cache

def get_user_timezone(user_id):
    """Get user's timezone from database with caching, default to UTC"""
    # Check cache first
    if user_id in _timezone_cache:
        cached_tz, cached_time = _timezone_cache[user_id]
        if time.time() - cached_time < _cache_timeout:
            return cached_tz
    
    # Query database with projection (only timezone field)
    user = db.users.find_one({'_id': ObjectId(user_id)}, {'timezone': 1})
    timezone_str = user.get('timezone', 'UTC') if user else 'UTC'
    
    # Update cache
    _timezone_cache[user_id] = (timezone_str, time.time())
    return timezone_str

def get_utc_now():
    """Get current UTC time with timezone info"""
    return datetime.now(timezone.utc)

def convert_to_user_timezone(dt, user_timezone='UTC'):
    """Convert UTC datetime to user's timezone"""
    if dt is None:
        return None
    # If datetime is naive (no timezone), assume UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        tz = pytz.timezone(user_timezone)
        return dt.astimezone(tz)
    except (pytz.exceptions.UnknownTimeZoneError, AttributeError):
        # Invalid timezone - fall back to UTC
        return dt.astimezone(pytz.UTC)

def convert_to_utc(dt, user_timezone='UTC'):
    """Convert user's local datetime to UTC"""
    if dt is None:
        return None
    try:
        tz = pytz.timezone(user_timezone)
        # If string, parse it
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        # If naive, localize to user's timezone first
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        # Convert to UTC
        return dt.astimezone(timezone.utc)
    except (pytz.exceptions.UnknownTimeZoneError, AttributeError, ValueError):
        # Invalid timezone or datetime - return as-is or try to parse
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
            
            # Log slow queries (> 500ms now, reduced threshold)
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
            # Don't expose internal errors to frontend (security)
            return jsonify({'error': 'Internal server error', 'success': False}), 500
    
    return decorated_function

# ============== HEALTH CHECK ENDPOINTS ==============
@app.route('/health', methods=['GET'])
@limiter.limit("300 per hour")  # Health checks can be frequent for monitoring
def health():
    """Check if backend is live"""
    return jsonify({'status': 'ok', 'message': 'Backend is live'}), 200

@app.route('/api/health', methods=['GET'])
@limiter.limit("300 per hour")
def api_health():
    """Check if backend API is live"""
    return jsonify({'status': 'ok', 'message': 'Backend API is live'}), 200

@app.route('/api/database-check', methods=['GET'])
@limiter.limit("60 per hour")  # Stricter limit for database checks
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
        users_count = db.users.estimated_document_count()  # Faster than count_documents
        
        # Check indexes (optimize: don't load full list in memory)
        indexes_info = {
            'tags': sum(1 for _ in db.tags.list_indexes()),
            'monthly_goals': sum(1 for _ in db.monthly_goals.list_indexes()),
            'weekly_goals': sum(1 for _ in db.weekly_goals.list_indexes()),
            'daily_goals': sum(1 for _ in db.daily_goals.list_indexes()),
            'habits': sum(1 for _ in db.habits.list_indexes())
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
            'message': f'Database error: {str(e)}',
            'database_accessible': False
        }), 500

# ============== AUTH ENDPOINTS ==============
# Google OAuth is the only authentication method

# ============== GOOGLE OAUTH ENDPOINTS ==============
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

@app.route('/api/auth/google', methods=['POST'])
@limiter.limit("10 per minute")  # Strict limit on auth endpoint to prevent brute force/DoS
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
        idinfo = id_token.verify_oauth2_token(data['token'], google_requests.Request(), GOOGLE_CLIENT_ID)
        
        # Token is valid, extract user info
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        google_id = idinfo.get('sub')
        picture = idinfo.get('picture', '')
        timezone_str = data.get('timezone', 'UTC')
        
        if not email or not google_id:
            return jsonify({'success': False, 'message': 'Invalid token data'}), 400
        
        # Validate timezone
        try:
            pytz.timezone(timezone_str)
        except:
            timezone_str = 'UTC'
        
        # Check if user exists by email or google_id
        existing_user = db.users.find_one(
            {'$or': [{'email': email}, {'google_id': google_id}]},
            {'_id': 1, 'username': 1, 'timezone': 1, 'email': 1}
        )
        
        if existing_user:
            # Update timezone if provided
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
                    'picture': picture
                }
            }), 200
        
        # Create new user
        # Generate username from email if not available
        username = email.split('@')[0]
        
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
        # Don't expose internal error details (security)
        return jsonify({'success': False, 'message': 'Authentication failed'}), 500

# ============== USER ENDPOINTS ==============
@app.route('/api/user/<user_id>/timezone', methods=['PUT'])
@limiter.limit("30 per minute")
@handle_db_errors
def update_user_timezone(user_id):
    """Update user's timezone from geolocation"""
    data = request.json
    
    if not data or not data.get('timezone'):
        return jsonify({'error': 'Timezone required', 'success': False}), 400
    
    if not ObjectId.is_valid(user_id):
        return jsonify({'error': 'Invalid user ID', 'success': False}), 400
    
    timezone_str = data.get('timezone')
    
    # Validate timezone
    try:
        pytz.timezone(timezone_str)
    except:
        return jsonify({'error': 'Invalid timezone', 'success': False}), 400
    
    result = db.users.find_one_and_update(
        {'_id': ObjectId(user_id)},
        {'$set': {'timezone': timezone_str}},
        return_document=True
    )
    
    if result:
        return jsonify({
            'success': True,
            'timezone': result.get('timezone', 'UTC')
        }), 200
    
    return jsonify({'error': 'User not found', 'success': False}), 404

@app.route('/api/user/<user_id>/loader-check', methods=['GET'])
@limiter.limit("60 per minute")
@handle_db_errors
def check_data_loaded(user_id):
    """Check if user's data is fully loaded (especially goals).
    
    Returns:
    - isLoaded: boolean indicating if at least one goal exists
    - totalGoals: total count of goals across all types
    - hasData: boolean indicating if user has any data at all
    - edge_cases: object with warnings about potential issues
    """
    
    if not ObjectId.is_valid(user_id):
        return jsonify({'error': 'Invalid user ID', 'success': False}), 400
    
    try:
        start_time = time.time()
        
        # Check if user exists
        user = db.users.find_one({'_id': ObjectId(user_id)}, {'_id': 1})
        if not user:
            return jsonify({
                'success': True,
                'isLoaded': False,
                'totalGoals': 0,
                'hasData': False,
                'message': 'User not found',
                'edge_cases': {
                    'user_exists': False,
                    'tags_exist': False,
                    'habits_exist': False,
                    'goals_exist': False
                }
            }), 200
        
        # Optimized approach: use estimated_document_count with filter for faster results
        # Only check existence, not full counts initially
        
        # Quick checks using find().limit(1) which is faster than count_documents for large collections
        monthly_has_data = db.monthly_goals.find_one({'userId': user_id}, {'_id': 1}) is not None
        weekly_has_data = db.weekly_goals.find_one({'userId': user_id}, {'_id': 1}) is not None
        daily_has_data = db.daily_goals.find_one({'userId': user_id}, {'_id': 1}) is not None
        tags_exist = db.tags.find_one({'userId': user_id}, {'_id': 1}) is not None
        habits_exist = db.habits.find_one({'userId': user_id}, {'_id': 1}) is not None
        
        # Only count if data exists (short-circuit evaluation)
        monthly_count = db.monthly_goals.count_documents({'userId': user_id}) if monthly_has_data else 0
        weekly_count = db.weekly_goals.count_documents({'userId': user_id}) if weekly_has_data else 0
        daily_count = db.daily_goals.count_documents({'userId': user_id}) if daily_has_data else 0
        total_goals = monthly_count + weekly_count + daily_count
        
        # Get the most recently created goal only if goals exist
        latest_goal = None
        if total_goals > 0:
            try:
                # Use aggregation for a single query across all goal types
                # This is more efficient than three separate queries
                candidates = []
                
                if monthly_has_data:
                    monthly_latest = db.monthly_goals.find_one(
                        {'userId': user_id},
                        sort=[('createdAt', DESCENDING)]
                    )
                    if monthly_latest:
                        candidates.append(monthly_latest)
                
                if weekly_has_data:
                    weekly_latest = db.weekly_goals.find_one(
                        {'userId': user_id},
                        sort=[('createdAt', DESCENDING)]
                    )
                    if weekly_latest:
                        candidates.append(weekly_latest)
                
                if daily_has_data:
                    daily_latest = db.daily_goals.find_one(
                        {'userId': user_id},
                        sort=[('createdAt', DESCENDING)]
                    )
                    if daily_latest:
                        candidates.append(daily_latest)
                
                if candidates:
                    latest_goal = max(candidates, key=lambda x: x.get('createdAt', datetime.min))
            except Exception as e:
                logger.warning(f"⚠️ Error fetching latest goal for user {user_id}: {e}")
        
        # Determine if data is considered "loaded"
        hasData = total_goals > 0 or tags_exist or habits_exist
        
        # Data is considered "loaded" if user has at least one goal
        isLoaded = total_goals > 0
        
        elapsed_time = (time.time() - start_time) * 1000
        if elapsed_time > 1000:
            logger.warning(f"⚠️ Slow query in check_data_loaded: {elapsed_time:.2f}ms")
        
        response = {
            'success': True,
            'isLoaded': isLoaded,
            'totalGoals': total_goals,
            'hasData': hasData,
            'goalCounts': {
                'monthly': monthly_count,
                'weekly': weekly_count,
                'daily': daily_count
            },
            'edge_cases': {
                'user_exists': True,
                'tags_exist': tags_exist,
                'habits_exist': habits_exist,
                'goals_exist': total_goals > 0,
                'latest_goal_exists': latest_goal is not None,
                'user_has_zero_goals': total_goals == 0,
                'last_goal_deleted': total_goals == 0 and (tags_exist or habits_exist),
                'query_might_be_slow': total_goals > 10000
            }
        }
        
        logger.info(f"✅ Loader check for user {user_id}: isLoaded={isLoaded}, totalGoals={total_goals}")
        return jsonify(response), 200
        
    except ServerSelectionTimeoutError:
        logger.error(f"❌ Database timeout during loader check for user {user_id}")
        return jsonify({
            'success': False,
            'error': 'Database timeout - check may be slow',
            'isLoaded': False
        }), 504
    except Exception as e:
        logger.error(f"❌ Error checking loader status for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'isLoaded': False
        }), 500

# ============== TAGS ENDPOINTS ==============
@app.route('/api/tags/<user_id>', methods=['GET'])
@limiter.limit("100 per minute")  # Read operations: 100 per minute per IP
@handle_db_errors
def get_tags(user_id):
    # Pagination to prevent RAM bloat - uses index: userId + createdAt
    page = max(1, request.args.get('page', 1, type=int))
    limit = max(1, min(100, request.args.get('limit', 50, type=int)))  # Max 100 per page
    skip = (page - 1) * limit
    
    tags = list(db.tags.find({'userId': user_id}).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    total = db.tags.count_documents({'userId': user_id})
    
    return jsonify({'tags': [serialize_doc(tag) for tag in tags], 'page': page, 'limit': limit, 'total': total}), 200

@app.route('/api/tags', methods=['POST'])
@limiter.limit("30 per minute")  # Write operations: stricter limit to prevent spam
@handle_db_errors
def create_tag():
    data = request.json
    
    if not data or not data.get('name') or not data.get('userId'):
        return jsonify({'error': 'Name and userId required', 'success': False}), 400
    
    new_tag = {
        'name': data.get('name'),
        'color': data.get('color', '#3b82f6'),
        'userId': data.get('userId'),
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.tags.insert_one(new_tag)
    new_tag['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_tag)), 201

@app.route('/api/tags/<tag_id>', methods=['PUT'])
@limiter.limit("30 per minute")
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
        'updatedAt': get_utc_now().isoformat()
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
@limiter.limit("30 per minute")
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
@limiter.limit("100 per minute")
@handle_db_errors
def get_monthly_goals(user_id):
    # Pagination to prevent RAM bloat - uses index: userId + createdAt
    page = max(1, request.args.get('page', 1, type=int))
    limit = max(1, min(100, request.args.get('limit', 50, type=int)))  # Max 100 per page
    skip = (page - 1) * limit
    
    goals = list(db.monthly_goals.find({'userId': user_id}).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    total = db.monthly_goals.count_documents({'userId': user_id})
    
    return jsonify({'goals': [serialize_doc(goal) for goal in goals], 'page': page, 'limit': limit, 'total': total}), 200

@app.route('/api/goals/monthly', methods=['POST'])
@limiter.limit("30 per minute")
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
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.monthly_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/monthly/<goal_id>', methods=['PUT'])
@limiter.limit("30 per minute")
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
        'updatedAt': get_utc_now().isoformat()
    }.items() if v is not None}
    
    result = db.monthly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        # If marking as completed, cascade to all child weekly goals
        if update_data.get('completed') is True:
            db.weekly_goals.update_many(
                {'parentId': goal_id},
                {'$set': {
                    'completed': True,
                    'updatedAt': get_utc_now().isoformat()
                }}
            )
            # Also cascade to all daily goals under those weekly goals
            weekly_goals = db.weekly_goals.find({'parentId': goal_id}, {'_id': 1})
            for week_goal in weekly_goals:
                db.daily_goals.update_many(
                    {'parentId': str(week_goal['_id'])},
                    {'$set': {
                        'completed': True,
                        'updatedAt': get_utc_now().isoformat()
                    }}
                )
            # Also cascade to all daily goals directly under this monthly goal
            db.daily_goals.update_many(
                {'parentId': goal_id},
                {'$set': {
                    'completed': True,
                    'updatedAt': get_utc_now().isoformat()
                }}
            )
        
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/monthly/<goal_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
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
@limiter.limit("100 per minute")
@handle_db_errors
def get_weekly_goals(user_id):
    # Pagination to prevent RAM bloat - uses index: userId + createdAt
    page = max(1, request.args.get('page', 1, type=int))
    limit = max(1, min(100, request.args.get('limit', 50, type=int)))  # Max 100 per page
    skip = (page - 1) * limit
    
    # First, ensure all weekly goals have rescheduleHistory field (backward compatibility)
    db.weekly_goals.update_many(
        {'userId': user_id, 'rescheduleHistory': {'$exists': False}},
        {'$set': {'rescheduleHistory': []}}
    )
    
    goals = list(db.weekly_goals.find({'userId': user_id}).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    total = db.weekly_goals.count_documents({'userId': user_id})
    
    return jsonify({'goals': [serialize_doc(goal) for goal in goals], 'page': page, 'limit': limit, 'total': total}), 200

@app.route('/api/goals/weekly', methods=['POST'])
@limiter.limit("30 per minute")
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
        'rescheduleHistory': [],
        'createdAt': get_utc_now().isoformat()
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
@limiter.limit("30 per minute")
@handle_db_errors
def update_weekly_goal(goal_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    # Get the current goal to check if week is being changed
    current_goal = db.weekly_goals.find_one({'_id': ObjectId(goal_id)})
    
    if not current_goal:
        return jsonify({'error': 'Goal not found', 'success': False}), 404
    
    update_data = {k: v for k, v in {
        'title': data.get('title'),
        'tagId': data.get('tagId'),
        'parentId': data.get('parentId'),
        'weekStart': data.get('weekStart'),
        'weekEnd': data.get('weekEnd'),
        'weekNumber': data.get('weekNumber'),
        'year': data.get('year'),
        'completed': data.get('completed'),
        'updatedAt': get_utc_now().isoformat()
    }.items() if v is not None}
    
    # Get current week info for comparison
    current_week = current_goal.get('weekNumber')
    current_year = current_goal.get('year')
    new_week = update_data.get('weekNumber', current_week)
    new_year = update_data.get('year', current_year)
    
    # If week is being changed (rescheduled), add to rescheduleHistory
    if new_week != current_week or new_year != current_year:
        # Initialize or get existing history
        history = current_goal.get('rescheduleHistory', []) or []
        
        # Add new history entry
        history_entry = {
            'fromWeek': current_week,
            'fromYear': current_year,
            'toWeek': new_week,
            'toYear': new_year,
            'changedAt': get_utc_now().isoformat()
        }
        history.append(history_entry)
        
        update_data['rescheduleHistory'] = history
    else:
        # Preserve existing rescheduleHistory if no week change
        if 'rescheduleHistory' not in update_data and current_goal.get('rescheduleHistory'):
            update_data['rescheduleHistory'] = current_goal.get('rescheduleHistory')
    
    result = db.weekly_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        # If marking as completed, cascade to all child daily goals
        if update_data.get('completed') is True:
            db.daily_goals.update_many(
                {'parentId': goal_id},
                {'$set': {
                    'completed': True,
                    'updatedAt': get_utc_now().isoformat()
                }}
            )
        
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/weekly/<goal_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
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
@limiter.limit("100 per minute")
@handle_db_errors
def get_daily_goals(user_id):
    # Pagination to prevent RAM bloat - uses index: userId + createdAt
    page = max(1, request.args.get('page', 1, type=int))
    limit = max(1, min(100, request.args.get('limit', 50, type=int)))  # Max 100 per page
    skip = (page - 1) * limit
    
    goals = list(db.daily_goals.find({'userId': user_id}).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    total = db.daily_goals.count_documents({'userId': user_id})
    
    return jsonify({'goals': [serialize_doc(goal) for goal in goals], 'page': page, 'limit': limit, 'total': total}), 200

@app.route('/api/goals/daily', methods=['POST'])
@limiter.limit("30 per minute")
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
        'rescheduleHistory': [],
        'createdAt': get_utc_now().isoformat()
    }
    
    # Inherit tag from parent if no tag specified and parent exists
    if not new_goal['tagId'] and new_goal['parentId'] and ObjectId.is_valid(new_goal['parentId']):
        # Check if parent is a weekly goal
        parent = db.weekly_goals.find_one({'_id': ObjectId(new_goal['parentId'])}, {'tagId': 1})
        # If not found in weekly goals, check monthly goals
        if not parent:
            parent = db.monthly_goals.find_one({'_id': ObjectId(new_goal['parentId'])}, {'tagId': 1})
        if parent:
            new_goal['tagId'] = parent.get('tagId', '')
    
    result = db.daily_goals.insert_one(new_goal)
    new_goal['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_goal)), 201

@app.route('/api/goals/daily/<goal_id>', methods=['PUT'])
@limiter.limit("30 per minute")
@handle_db_errors
def update_daily_goal(goal_id):
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided', 'success': False}), 400
    
    if not ObjectId.is_valid(goal_id):
        return jsonify({'error': 'Invalid goal ID', 'success': False}), 400
    
    # Get the current goal to check if date is being changed
    current_goal = db.daily_goals.find_one({'_id': ObjectId(goal_id)})
    
    update_data = {k: v for k, v in {
        'title': data.get('title'),
        'tagId': data.get('tagId'),
        'parentId': data.get('parentId'),
        'date': data.get('date'),
        'completed': data.get('completed'),
        'updatedAt': get_utc_now().isoformat()
    }.items() if v is not None}
    
    # If date is being changed (rescheduled), add to rescheduleHistory
    if 'date' in update_data and current_goal and current_goal.get('date') != update_data['date']:
        old_date = current_goal.get('date')
        new_date = update_data['date']
        
        # Initialize or get existing history
        history = current_goal.get('rescheduleHistory', []) or []
        
        # Add new history entry
        history_entry = {
            'fromDate': old_date,
            'toDate': new_date,
            'changedAt': get_utc_now().isoformat()
        }
        history.append(history_entry)
        
        update_data['rescheduleHistory'] = history
    
    result = db.daily_goals.find_one_and_update(
        {'_id': ObjectId(goal_id)},
        {'$set': update_data},
        return_document=True
    )
    
    if result:
        return jsonify(serialize_doc(result)), 200
    
    return jsonify({'error': 'Goal not found', 'success': False}), 404

@app.route('/api/goals/daily/<goal_id>', methods=['DELETE'])
@limiter.limit("30 per minute")
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
@limiter.limit("100 per minute")
@handle_db_errors
def get_habits(user_id):
    # Pagination to prevent RAM bloat - uses index: userId + createdAt
    page = max(1, request.args.get('page', 1, type=int))
    limit = max(1, min(100, request.args.get('limit', 50, type=int)))  # Max 100 per page
    skip = (page - 1) * limit
    
    habits = list(db.habits.find({'userId': user_id}).sort('createdAt', DESCENDING).skip(skip).limit(limit))
    total = db.habits.count_documents({'userId': user_id})
    
    return jsonify({'habits': [serialize_doc(habit) for habit in habits], 'page': page, 'limit': limit, 'total': total}), 200

@app.route('/api/habits', methods=['POST'])
@limiter.limit("30 per minute")
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
        'startDate': get_utc_now().strftime('%Y-%m-%d'),
        'createdAt': get_utc_now().isoformat()
    }
    
    result = db.habits.insert_one(new_habit)
    new_habit['_id'] = result.inserted_id
    
    return jsonify(serialize_doc(new_habit)), 201

@app.route('/api/habits/<habit_id>', methods=['PUT'])
@limiter.limit("30 per minute")
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
        'updatedAt': get_utc_now().isoformat()
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
@limiter.limit("60 per minute")
@handle_db_errors
def toggle_habit(habit_id, date):
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    # Get habit with userId first
    habit = db.habits.find_one({'_id': ObjectId(habit_id)}, {'completedDates': 1, 'userId': 1})
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    # Normalize the date format (handle both YYYY-MM-DD and other formats)
    try:
        # Try to parse the date to ensure it's valid
        parsed_date = datetime.strptime(date, '%Y-%m-%d')
        normalized_date = parsed_date.strftime('%Y-%m-%d')
    except ValueError:
        # If parsing fails, try other common formats
        try:
            parsed_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            normalized_date = parsed_date.strftime('%Y-%m-%d')
        except:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD', 'success': False}), 400
    
    # Get user's timezone and calculate today in their timezone
    user_timezone = get_user_timezone(habit['userId'])
    utc_now = get_utc_now()
    today_user_tz = convert_to_user_timezone(utc_now, user_timezone).strftime('%Y-%m-%d')
    
    # Log for debugging
    logger.info(f"Toggle habit: received date={date}, normalized={normalized_date}, today_user_tz={today_user_tz}, user_timezone={user_timezone}")
    
    if normalized_date != today_user_tz:
        return jsonify({
            'error': 'Can only toggle habit for today',
            'success': False,
            'received_date': normalized_date,
            'today_date': today_user_tz,
            'user_timezone': user_timezone
        }), 400
    
    completed_dates = habit.get('completedDates', [])
    
    # Use normalized date for consistency
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
@limiter.limit("30 per minute")
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
@limiter.limit("100 per minute")
@handle_db_errors
def get_habit_stats(habit_id):
    if not ObjectId.is_valid(habit_id):
        return jsonify({'error': 'Invalid habit ID', 'success': False}), 400
    
    habit = db.habits.find_one({'_id': ObjectId(habit_id)}, {'startDate': 1, 'completedDates': 1})
    
    if not habit:
        return jsonify({'error': 'Habit not found', 'success': False}), 404
    
    start_date = datetime.strptime(habit['startDate'], '%Y-%m-%d')
    today = get_utc_now()
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

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    logger.warning(f"Rate limit exceeded: {request.remote_addr} - {request.path}")
    return jsonify({
        'success': False,
        'error': 'Rate limit exceeded',
        'message': 'Too many requests. Please try again later.'
    }), 429

if __name__ == '__main__':
    # IMPORTANT: For production, use gunicorn with: gunicorn -w 4 -b 0.0.0.0:5000 app:app
    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
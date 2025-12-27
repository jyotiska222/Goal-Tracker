from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from pymongo.errors import OperationFailure
from bson.objectid import ObjectId
from datetime import datetime
import hashlib
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Disable logging for health checks
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# MongoDB Configuration
# Note: Update the MONGO_URI based on your actual MongoDB Atlas connection string
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://goaltracker_dev:25930374Jj@cluster0.hz9nmde.mongodb.net/goaltracker?retryWrites=true&w=majority&appName=Cluster0')
app.config['MONGO_URI'] = MONGO_URI

try:
    mongo = PyMongo(app)
except Exception as e:
    print(f"MongoDB Connection Warning: {e}")
    print(f"Using MONGO_URI: {MONGO_URI}")
    mongo = PyMongo(app)

CORS(app, 
     origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:5000", "http://192.168.31.175:5000", "https://goal-tracker-liart.vercel.app", "https://goal-tracker.vercel.app", "https://goal-tracker-pearl.vercel.app"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type"],
     supports_credentials=True)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if '_id' in doc and isinstance(doc['_id'], ObjectId):
        doc['_id'] = str(doc['_id'])
    return doc

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
    """Check if database is working properly"""
    try:
        # Try to access MongoDB
        mongo.db.users.find_one()
        return jsonify({
            'status': 'ok',
            'message': 'Database is working',
            'database_accessible': True
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Database error: {str(e)}',
            'database_accessible': False
        }), 500

# ============== AUTH ENDPOINTS ==============
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
        hashed_password = hash_password(password)
        user = mongo.db.users.find_one({
            'username': username,
            'password': hashed_password
        })
        
        if user:
            return jsonify({
                'success': True, 
                'user': {
                    'id': str(user['_id']), 
                    'username': user['username']
                }
            })
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
        
        if mongo.db.users.find_one({'username': username}):
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        new_user = {
            'username': username,
            'password': hash_password(password),
            'createdAt': datetime.now().isoformat()
        }
        result = mongo.db.users.insert_one(new_user)
        
        return jsonify({
            'success': True, 
            'user': {
                'id': str(result.inserted_id), 
                'username': new_user['username']
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ============== TAGS ENDPOINTS ==============
@app.route('/api/tags/<user_id>', methods=['GET'])
def get_tags(user_id):
    try:
        tags = list(mongo.db.tags.find({'userId': user_id}))
        return jsonify([serialize_doc(tag) for tag in tags])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags', methods=['POST'])
def create_tag():
    try:
        data = request.json
        
        new_tag = {
            'name': data.get('name'),
            'color': data.get('color', '#3b82f6'),
            'userId': data.get('userId'),
            'createdAt': datetime.now().isoformat()
        }
        result = mongo.db.tags.insert_one(new_tag)
        new_tag['_id'] = result.inserted_id
        
        return jsonify(serialize_doc(new_tag)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags/<tag_id>', methods=['PUT'])
def update_tag(tag_id):
    try:
        data = request.json
        update_data = {
            'name': data.get('name'),
            'color': data.get('color'),
            'updatedAt': datetime.now().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = mongo.db.tags.find_one_and_update(
            {'_id': ObjectId(tag_id)},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            return jsonify(serialize_doc(result))
        return jsonify({'error': 'Tag not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    try:
        mongo.db.tags.delete_one({'_id': ObjectId(tag_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== MONTHLY GOALS ENDPOINTS ==============
@app.route('/api/goals/monthly/<user_id>', methods=['GET'])
def get_monthly_goals(user_id):
    try:
        goals = list(mongo.db.monthly_goals.find({'userId': user_id}))
        return jsonify([serialize_doc(goal) for goal in goals])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly', methods=['POST'])
def create_monthly_goal():
    try:
        data = request.json
        
        new_goal = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'month': data.get('month'),
            'year': data.get('year'),
            'userId': data.get('userId'),
            'completed': False,
            'createdAt': datetime.now().isoformat()
        }
        result = mongo.db.monthly_goals.insert_one(new_goal)
        new_goal['_id'] = result.inserted_id
        
        return jsonify(serialize_doc(new_goal)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly/<goal_id>', methods=['PUT'])
def update_monthly_goal(goal_id):
    try:
        data = request.json
        update_data = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'month': data.get('month'),
            'year': data.get('year'),
            'completed': data.get('completed'),
            'updatedAt': datetime.now().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = mongo.db.monthly_goals.find_one_and_update(
            {'_id': ObjectId(goal_id)},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            return jsonify(serialize_doc(result))
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly/<goal_id>', methods=['DELETE'])
def delete_monthly_goal(goal_id):
    try:
        mongo.db.monthly_goals.delete_one({'_id': ObjectId(goal_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== WEEKLY GOALS ENDPOINTS ==============
@app.route('/api/goals/weekly/<user_id>', methods=['GET'])
def get_weekly_goals(user_id):
    try:
        goals = list(mongo.db.weekly_goals.find({'userId': user_id}))
        return jsonify([serialize_doc(goal) for goal in goals])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly', methods=['POST'])
def create_weekly_goal():
    try:
        data = request.json
        
        new_goal = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
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
        if not new_goal['tagId'] and new_goal['parentId']:
            parent = mongo.db.monthly_goals.find_one({'_id': ObjectId(new_goal['parentId'])})
            if parent:
                new_goal['tagId'] = parent.get('tagId')
        
        result = mongo.db.weekly_goals.insert_one(new_goal)
        new_goal['_id'] = result.inserted_id
        
        return jsonify(serialize_doc(new_goal)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly/<goal_id>', methods=['PUT'])
def update_weekly_goal(goal_id):
    try:
        data = request.json
        update_data = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'parentId': data.get('parentId'),
            'weekStart': data.get('weekStart'),
            'weekEnd': data.get('weekEnd'),
            'weekNumber': data.get('weekNumber'),
            'year': data.get('year'),
            'completed': data.get('completed'),
            'updatedAt': datetime.now().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = mongo.db.weekly_goals.find_one_and_update(
            {'_id': ObjectId(goal_id)},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            return jsonify(serialize_doc(result))
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly/<goal_id>', methods=['DELETE'])
def delete_weekly_goal(goal_id):
    try:
        mongo.db.weekly_goals.delete_one({'_id': ObjectId(goal_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== DAILY GOALS ENDPOINTS ==============
@app.route('/api/goals/daily/<user_id>', methods=['GET'])
def get_daily_goals(user_id):
    try:
        goals = list(mongo.db.daily_goals.find({'userId': user_id}))
        return jsonify([serialize_doc(goal) for goal in goals])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily', methods=['POST'])
def create_daily_goal():
    try:
        data = request.json
        
        new_goal = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'parentId': data.get('parentId', ''),
            'date': data.get('date'),
            'userId': data.get('userId'),
            'completed': False,
            'createdAt': datetime.now().isoformat()
        }
        
        # Inherit tag from parent if no tag specified and parent exists
        if not new_goal['tagId'] and new_goal['parentId']:
            parent = mongo.db.weekly_goals.find_one({'_id': ObjectId(new_goal['parentId'])})
            if parent:
                new_goal['tagId'] = parent.get('tagId')
        
        result = mongo.db.daily_goals.insert_one(new_goal)
        new_goal['_id'] = result.inserted_id
        
        return jsonify(serialize_doc(new_goal)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily/<goal_id>', methods=['PUT'])
def update_daily_goal(goal_id):
    try:
        data = request.json
        update_data = {
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'parentId': data.get('parentId'),
            'date': data.get('date'),
            'completed': data.get('completed'),
            'updatedAt': datetime.now().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = mongo.db.daily_goals.find_one_and_update(
            {'_id': ObjectId(goal_id)},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            return jsonify(serialize_doc(result))
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily/<goal_id>', methods=['DELETE'])
def delete_daily_goal(goal_id):
    try:
        mongo.db.daily_goals.delete_one({'_id': ObjectId(goal_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== HABITS ENDPOINTS ==============
@app.route('/api/habits/<user_id>', methods=['GET'])
def get_habits(user_id):
    try:
        habits = list(mongo.db.habits.find({'userId': user_id}))
        return jsonify([serialize_doc(habit) for habit in habits])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits', methods=['POST'])
def create_habit():
    try:
        data = request.json
        
        new_habit = {
            'name': data.get('name'),
            'tagId': data.get('tagId'),
            'userId': data.get('userId'),
            'completedDates': [],
            'startDate': datetime.now().strftime('%Y-%m-%d'),
            'createdAt': datetime.now().isoformat()
        }
        result = mongo.db.habits.insert_one(new_habit)
        new_habit['_id'] = result.inserted_id
        
        return jsonify(serialize_doc(new_habit)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>', methods=['PUT'])
def update_habit(habit_id):
    try:
        data = request.json
        update_data = {
            'name': data.get('name'),
            'tagId': data.get('tagId'),
            'completedDates': data.get('completedDates'),
            'updatedAt': datetime.now().isoformat()
        }
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = mongo.db.habits.find_one_and_update(
            {'_id': ObjectId(habit_id)},
            {'$set': update_data},
            return_document=True
        )
        
        if result:
            return jsonify(serialize_doc(result))
        return jsonify({'error': 'Habit not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>/toggle/<date>', methods=['POST'])
def toggle_habit(habit_id, date):
    try:
        # Only allow toggling for today
        today = datetime.now().strftime('%Y-%m-%d')
        if date != today:
            return jsonify({'error': 'Can only toggle habit for today'}), 400
        
        habit = mongo.db.habits.find_one({'_id': ObjectId(habit_id)})
        
        if not habit:
            return jsonify({'error': 'Habit not found'}), 404
        
        completed_dates = habit.get('completedDates', [])
        
        if date in completed_dates:
            completed_dates.remove(date)
        else:
            completed_dates.append(date)
        
        result = mongo.db.habits.find_one_and_update(
            {'_id': ObjectId(habit_id)},
            {'$set': {
                'completedDates': completed_dates,
                'updatedAt': datetime.now().isoformat()
            }},
            return_document=True
        )
        
        return jsonify(serialize_doc(result))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    try:
        mongo.db.habits.delete_one({'_id': ObjectId(habit_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== STATS ENDPOINT ==============
@app.route('/api/habits/<habit_id>/stats', methods=['GET'])
def get_habit_stats(habit_id):
    try:
        habit = mongo.db.habits.find_one({'_id': ObjectId(habit_id)})
        
        if not habit:
            return jsonify({'error': 'Habit not found'}), 404
        
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
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== HEALTH CHECK ==============
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
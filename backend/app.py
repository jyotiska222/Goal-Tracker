from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
import hashlib

app = Flask(__name__)

# Disable logging for health checks
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

CORS(app, 
     origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:5000", "http://192.168.31.175:5000", "https://goal-tracker-liart.vercel.app"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type"],
     supports_credentials=True)

DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Initialize JSON files if they don't exist
def init_json_files():
    files = ['users.json', 'tags.json', 'monthly_goals.json', 'weekly_goals.json', 'daily_goals.json', 'habits.json']
    for file in files:
        filepath = os.path.join(DATA_DIR, file)
        if not os.path.exists(filepath):
            with open(filepath, 'w') as f:
                json.dump([], f)

init_json_files()

# Helper functions to read/write JSON
def read_json(filename):
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def write_json(filename, data):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

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
        # Try to read from users file to verify database connectivity
        users = read_json('users.json')
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
        
        users = read_json('users.json')
        hashed_password = hash_password(password)
        user = next((u for u in users if u['username'] == username and u['password'] == hashed_password), None)
        
        if user:
            return jsonify({
                'success': True, 
                'user': {
                    'id': user['id'], 
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
        
        users = read_json('users.json')
        
        if any(u['username'] == username for u in users):
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        new_user = {
            'id': str(len(users) + 1),
            'username': username,
            'password': hash_password(password),
            'createdAt': datetime.now().isoformat()
        }
        users.append(new_user)
        write_json('users.json', users)
        
        return jsonify({
            'success': True, 
            'user': {
                'id': new_user['id'], 
                'username': new_user['username']
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ============== TAGS ENDPOINTS ==============
@app.route('/api/tags/<user_id>', methods=['GET'])
def get_tags(user_id):
    try:
        tags = read_json('tags.json')
        user_tags = [t for t in tags if t.get('userId') == user_id]
        return jsonify(user_tags)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags', methods=['POST'])
def create_tag():
    try:
        data = request.json
        tags = read_json('tags.json')
        
        new_tag = {
            'id': str(len(tags) + 1),
            'name': data.get('name'),
            'color': data.get('color', '#3b82f6'),
            'userId': data.get('userId'),
            'createdAt': datetime.now().isoformat()
        }
        tags.append(new_tag)
        write_json('tags.json', tags)
        return jsonify(new_tag), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags/<tag_id>', methods=['PUT'])
def update_tag(tag_id):
    try:
        data = request.json
        tags = read_json('tags.json')
        tag_idx = next((i for i, t in enumerate(tags) if t['id'] == tag_id), None)
        
        if tag_idx is not None:
            tags[tag_idx].update({
                'name': data.get('name', tags[tag_idx]['name']),
                'color': data.get('color', tags[tag_idx]['color']),
                'updatedAt': datetime.now().isoformat()
            })
            write_json('tags.json', tags)
            return jsonify(tags[tag_idx])
        return jsonify({'error': 'Tag not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    try:
        tags = read_json('tags.json')
        tags = [t for t in tags if t['id'] != tag_id]
        write_json('tags.json', tags)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== MONTHLY GOALS ENDPOINTS ==============
@app.route('/api/goals/monthly/<user_id>', methods=['GET'])
def get_monthly_goals(user_id):
    try:
        goals = read_json('monthly_goals.json')
        user_goals = [g for g in goals if g.get('userId') == user_id]
        return jsonify(user_goals)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly', methods=['POST'])
def create_monthly_goal():
    try:
        data = request.json
        goals = read_json('monthly_goals.json')
        
        new_goal = {
            'id': str(len(goals) + 1),
            'title': data.get('title'),
            'tagId': data.get('tagId'),
            'month': data.get('month'),
            'year': data.get('year'),
            'userId': data.get('userId'),
            'completed': False,
            'createdAt': datetime.now().isoformat()
        }
        goals.append(new_goal)
        write_json('monthly_goals.json', goals)
        return jsonify(new_goal), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly/<goal_id>', methods=['PUT'])
def update_monthly_goal(goal_id):
    try:
        data = request.json
        goals = read_json('monthly_goals.json')
        goal_idx = next((i for i, g in enumerate(goals) if g['id'] == goal_id), None)
        
        if goal_idx is not None:
            goals[goal_idx].update({
                'title': data.get('title', goals[goal_idx]['title']),
                'tagId': data.get('tagId', goals[goal_idx]['tagId']),
                'month': data.get('month', goals[goal_idx]['month']),
                'year': data.get('year', goals[goal_idx]['year']),
                'completed': data.get('completed', goals[goal_idx]['completed']),
                'updatedAt': datetime.now().isoformat()
            })
            write_json('monthly_goals.json', goals)
            return jsonify(goals[goal_idx])
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/monthly/<goal_id>', methods=['DELETE'])
def delete_monthly_goal(goal_id):
    try:
        goals = read_json('monthly_goals.json')
        goals = [g for g in goals if g['id'] != goal_id]
        write_json('monthly_goals.json', goals)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== WEEKLY GOALS ENDPOINTS ==============
@app.route('/api/goals/weekly/<user_id>', methods=['GET'])
def get_weekly_goals(user_id):
    try:
        goals = read_json('weekly_goals.json')
        user_goals = [g for g in goals if g.get('userId') == user_id]
        return jsonify(user_goals)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly', methods=['POST'])
def create_weekly_goal():
    try:
        data = request.json
        goals = read_json('weekly_goals.json')
        
        new_goal = {
            'id': str(len(goals) + 1),
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
            monthly_goals = read_json('monthly_goals.json')
            parent = next((g for g in monthly_goals if g['id'] == new_goal['parentId']), None)
            if parent:
                new_goal['tagId'] = parent['tagId']
        
        goals.append(new_goal)
        write_json('weekly_goals.json', goals)
        return jsonify(new_goal), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly/<goal_id>', methods=['PUT'])
def update_weekly_goal(goal_id):
    try:
        data = request.json
        goals = read_json('weekly_goals.json')
        goal_idx = next((i for i, g in enumerate(goals) if g['id'] == goal_id), None)
        
        if goal_idx is not None:
            goals[goal_idx].update({
                'title': data.get('title', goals[goal_idx]['title']),
                'tagId': data.get('tagId', goals[goal_idx]['tagId']),
                'parentId': data.get('parentId', goals[goal_idx].get('parentId', '')),
                'weekStart': data.get('weekStart', goals[goal_idx]['weekStart']),
                'weekEnd': data.get('weekEnd', goals[goal_idx]['weekEnd']),
                'weekNumber': data.get('weekNumber', goals[goal_idx].get('weekNumber')),
                'year': data.get('year', goals[goal_idx].get('year')),
                'completed': data.get('completed', goals[goal_idx]['completed']),
                'updatedAt': datetime.now().isoformat()
            })
            write_json('weekly_goals.json', goals)
            return jsonify(goals[goal_idx])
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/weekly/<goal_id>', methods=['DELETE'])
def delete_weekly_goal(goal_id):
    try:
        goals = read_json('weekly_goals.json')
        goals = [g for g in goals if g['id'] != goal_id]
        write_json('weekly_goals.json', goals)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== DAILY GOALS ENDPOINTS ==============
@app.route('/api/goals/daily/<user_id>', methods=['GET'])
def get_daily_goals(user_id):
    try:
        goals = read_json('daily_goals.json')
        user_goals = [g for g in goals if g.get('userId') == user_id]
        return jsonify(user_goals)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily', methods=['POST'])
def create_daily_goal():
    try:
        data = request.json
        goals = read_json('daily_goals.json')
        
        new_goal = {
            'id': str(len(goals) + 1),
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
            weekly_goals = read_json('weekly_goals.json')
            parent = next((g for g in weekly_goals if g['id'] == new_goal['parentId']), None)
            if parent:
                new_goal['tagId'] = parent['tagId']
        
        goals.append(new_goal)
        write_json('daily_goals.json', goals)
        return jsonify(new_goal), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily/<goal_id>', methods=['PUT'])
def update_daily_goal(goal_id):
    try:
        data = request.json
        goals = read_json('daily_goals.json')
        goal_idx = next((i for i, g in enumerate(goals) if g['id'] == goal_id), None)
        
        if goal_idx is not None:
            goals[goal_idx].update({
                'title': data.get('title', goals[goal_idx]['title']),
                'tagId': data.get('tagId', goals[goal_idx]['tagId']),
                'parentId': data.get('parentId', goals[goal_idx].get('parentId', '')),
                'date': data.get('date', goals[goal_idx]['date']),
                'completed': data.get('completed', goals[goal_idx]['completed']),
                'updatedAt': datetime.now().isoformat()
            })
            write_json('daily_goals.json', goals)
            return jsonify(goals[goal_idx])
        return jsonify({'error': 'Goal not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/goals/daily/<goal_id>', methods=['DELETE'])
def delete_daily_goal(goal_id):
    try:
        goals = read_json('daily_goals.json')
        goals = [g for g in goals if g['id'] != goal_id]
        write_json('daily_goals.json', goals)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== HABITS ENDPOINTS ==============
@app.route('/api/habits/<user_id>', methods=['GET'])
def get_habits(user_id):
    try:
        habits = read_json('habits.json')
        user_habits = [h for h in habits if h.get('userId') == user_id]
        return jsonify(user_habits)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits', methods=['POST'])
def create_habit():
    try:
        data = request.json
        habits = read_json('habits.json')
        
        new_habit = {
            'id': str(len(habits) + 1),
            'name': data.get('name'),
            'tagId': data.get('tagId'),
            'userId': data.get('userId'),
            'completedDates': [],
            'startDate': datetime.now().strftime('%Y-%m-%d'),
            'createdAt': datetime.now().isoformat()
        }
        habits.append(new_habit)
        write_json('habits.json', habits)
        return jsonify(new_habit), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>', methods=['PUT'])
def update_habit(habit_id):
    try:
        data = request.json
        habits = read_json('habits.json')
        habit_idx = next((i for i, h in enumerate(habits) if h['id'] == habit_id), None)
        
        if habit_idx is not None:
            habits[habit_idx].update({
                'name': data.get('name', habits[habit_idx]['name']),
                'tagId': data.get('tagId', habits[habit_idx]['tagId']),
                'completedDates': data.get('completedDates', habits[habit_idx]['completedDates']),
                'updatedAt': datetime.now().isoformat()
            })
            write_json('habits.json', habits)
            return jsonify(habits[habit_idx])
        return jsonify({'error': 'Habit not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>/toggle/<date>', methods=['POST'])
def toggle_habit(habit_id, date):
    try:
        habits = read_json('habits.json')
        habit_idx = next((i for i, h in enumerate(habits) if h['id'] == habit_id), None)
        
        if habit_idx is not None:
            completed_dates = habits[habit_idx].get('completedDates', [])
            
            # Only allow toggling for today
            today = datetime.now().strftime('%Y-%m-%d')
            if date != today:
                return jsonify({'error': 'Can only toggle habit for today'}), 400
            
            if date in completed_dates:
                completed_dates.remove(date)
            else:
                completed_dates.append(date)
            
            habits[habit_idx]['completedDates'] = completed_dates
            habits[habit_idx]['updatedAt'] = datetime.now().isoformat()
            write_json('habits.json', habits)
            return jsonify(habits[habit_idx])
        return jsonify({'error': 'Habit not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/habits/<habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    try:
        habits = read_json('habits.json')
        habits = [h for h in habits if h['id'] != habit_id]
        write_json('habits.json', habits)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============== STATS ENDPOINT ==============
@app.route('/api/habits/<habit_id>/stats', methods=['GET'])
def get_habit_stats(habit_id):
    try:
        habits = read_json('habits.json')
        habit = next((h for h in habits if h['id'] == habit_id), None)
        
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
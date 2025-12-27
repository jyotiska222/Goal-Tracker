# Step-by-Step Deployment Instructions

## STEP 1: Update Frontend API URL

Edit `frontend/src/App.jsx` line 5:

**BEFORE:**
```javascript
const API_BASE = 'http://127.0.0.1:5000/api';
```

**AFTER (when you get Render URL):**
```javascript
const API_BASE = 'https://goal-tracker-backend.onrender.com/api';
```

---

## STEP 2: Ensure Backend is Ready for Deployment

Your `backend/requirements.txt` ✅ Already has:
- Flask==3.0.0
- flask-cors==4.0.0
- Werkzeug==3.0.1
- gunicorn==21.2.0

Make sure your `backend/app.py` has CORS enabled:
```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # This allows frontend to call the backend
```

---

## STEP 3: Commit Everything to Git

```powershell
cd c:\Users\jyoti\OneDrive\Desktop\goal tracker
git add .
git commit -m "Ready for Render and Vercel deployment"
git push origin main
```

---

## STEP 4: Deploy Backend to Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select your repository
5. Fill in these details:
   - **Name**: `goal-tracker-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Root Directory**: `backend`
6. Click "Create Web Service"
7. Wait 5-10 minutes for deployment
8. Copy your URL (looks like: `https://goal-tracker-backend.onrender.com`)

---

## STEP 5: Update Frontend with Backend URL

1. In `frontend/src/App.jsx`, update line 5 with your Render URL:
   ```javascript
   const API_BASE = 'https://goal-tracker-backend.onrender.com/api';
   ```

2. Commit and push:
   ```powershell
   git add .
   git commit -m "Update backend URL for production"
   git push origin main
   ```

---

## STEP 6: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click "Deploy"
6. Get your Vercel URL (looks like: `https://goal-tracker.vercel.app`)

---

## ✅ You're Done!

Your app is now live:
- **Backend**: https://goal-tracker-backend.onrender.com
- **Frontend**: https://goal-tracker.vercel.app

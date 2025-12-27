# Deployment Guide

## Backend Deployment (Render)

### Prerequisites
- GitHub account with your project pushed
- Render account (https://render.com)

### Steps

1. **Push your code to GitHub** (if not already done)
   ```powershell
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the Web Service**
   - **Name**: `goal-tracker-backend` (or any name)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Root Directory**: `backend`
   - **Instance Type**: Free (or paid if needed)

4. **Add Environment Variables (if needed)**
   - If your app uses `.env` variables, add them in Render dashboard under "Environment"

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Your backend URL will be like: `https://goal-tracker-backend.onrender.com`

6. **Update your frontend** with this backend URL

---

## Frontend Deployment (Vercel)

### Prerequisites
- GitHub account with your project pushed
- Vercel account (https://vercel.com)

### Steps

1. **Create `vercel.json` in root of `frontend` folder**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist"
   }
   ```

2. **Update your frontend API calls**
   - Replace localhost with your Render backend URL
   - In your React code, update API endpoints:
     ```javascript
     const API_URL = "https://goal-tracker-backend.onrender.com"
     // Instead of: const API_URL = "http://localhost:5000"
     ```

3. **Deploy to Vercel**
   - Go to https://vercel.com
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the `frontend` folder as root:
     - **Framework**: Vite
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

4. **Deploy**
   - Click "Deploy"
   - Your frontend URL will be like: `https://goal-tracker.vercel.app`

---

## Summary

After deployment:
- **Backend**: `https://goal-tracker-backend.onrender.com`
- **Frontend**: `https://goal-tracker.vercel.app`

Make sure your frontend API calls point to the Render backend URL!

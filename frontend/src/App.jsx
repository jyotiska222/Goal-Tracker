import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, Edit2, Trash2, Tag, BarChart3, ChevronDown } from 'lucide-react';

// API endpoint - uses environment variable if available, falls back to localhost for development
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000/api';

const GoalTrackerApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  
  // State management
  const [tags, setTags] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [dailyGoals, setDailyGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  
  // Modal states
  const [showTagModal, setShowTagModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [showHabitReport, setShowHabitReport] = useState(null);
  const [goalType, setGoalType] = useState('monthly');
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  
  // Form states
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [tagForm, setTagForm] = useState({ name: '', color: '#3b82f6' });
  const [goalForm, setGoalForm] = useState({ title: '', tagId: '', parentId: '' });
  const [habitForm, setHabitForm] = useState({ name: '', tagId: '' });

  // System status
  const [systemStatus, setSystemStatus] = useState({
    backendLive: false,
    connected: false,
    databaseWorking: false,
    changesSaved: false
  });

  // Weather and time
  const [weather, setWeather] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [forecastData, setForecastData] = useState({});

  // Health check function
  const checkSystemHealth = async () => {
    try {
      // Check if backend is live
      const healthRes = await fetch(`${API_BASE.replace('/api', '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      
      const backendLive = healthRes && healthRes.ok;
      
      // Check if API is connected
      const apiHealthRes = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      
      const connected = apiHealthRes && apiHealthRes.ok;

      // Check database connectivity
      let databaseWorking = false;
      
      try {
        const dbRes = await fetch(`${API_BASE}/database-check`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        databaseWorking = dbRes.ok;
      } catch (error) {
        databaseWorking = false;
      }

      // Changes are saved if backend, API, and database are all working
      const changesSaved = backendLive && connected && databaseWorking;

      setSystemStatus({
        backendLive,
        connected,
        databaseWorking,
        changesSaved
      });
    } catch (error) {
      console.error('Health check error:', error);
      setSystemStatus({
        backendLive: false,
        connected: false,
        databaseWorking: false,
        changesSaved: false
      });
    }
  };

  // Check system health only on user activity
  useEffect(() => {
    let interval;
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30000; // 30 seconds of inactivity to stop checking
    let lastCheckTime = 0;

    const handleActivity = () => {
      const now = Date.now();
      // Prevent multiple checks within 1 second
      if (now - lastCheckTime < 1000) return;
      
      lastCheckTime = now;

      // Clear any existing timers
      clearTimeout(inactivityTimer);
      clearInterval(interval);

      // Run health check immediately on activity
      checkSystemHealth();

      // Set up periodic checks while active
      interval = setInterval(checkSystemHealth, 10000); // Check every 10 seconds during activity

      // Set inactivity timer to stop checks after 30 seconds of no activity
      inactivityTimer = setTimeout(() => {
        clearInterval(interval);
      }, INACTIVITY_TIMEOUT);
    };

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      clearInterval(interval);
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [currentUser]);

  // Fetch location and weather
  const fetchWeather = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          
          try {
            // Fetch location name using reverse geocoding
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const geoData = await geoResponse.json();
            if (geoData.address) {
              const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county;
              setLocationName(city);
            }
            
            // Fetch weather from Open-Meteo with 10-day forecast
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
            );
            const data = await response.json();
            
            if (data.current) {
              setWeather({
                temp: Math.round(data.current.temperature_2m),
                weatherCode: data.current.weather_code,
                maxTemp: Math.round(data.daily.temperature_2m_max[0]),
                minTemp: Math.round(data.daily.temperature_2m_min[0])
              });
            }
            
            // Store 10-day forecast data
            if (data.daily) {
              const forecast = {};
              const today = new Date();
              for (let i = 0; i < Math.min(10, data.daily.time.length); i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                forecast[dateStr] = {
                  maxTemp: Math.round(data.daily.temperature_2m_max[i]),
                  minTemp: Math.round(data.daily.temperature_2m_min[i]),
                  weatherCode: data.daily.weather_code[i]
                };
              }
              setForecastData(forecast);
            }
          } catch (error) {
            console.error('Error fetching weather:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  // Get weather emoji based on weather code
  const getWeatherEmoji = (code) => {
    if (code === 0 || code === 1) return '☀️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code === 80 || code === 81 || code === 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 80 && code <= 82) return '⛈️';
    return '🌤️';
  };

  // Fetch location and weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for saved session on app load
  useEffect(() => {
    const savedUser = localStorage.getItem('goalTrackerUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setShowAuth(false);
      } catch (error) {
        console.error('Error loading saved session:', error);
        localStorage.removeItem('goalTrackerUser');
      }
    }
  }, []);

  // Initialize with demo data
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [tagsRes, monthlyRes, weeklyRes, dailyRes, habitsRes] = await Promise.all([
        fetch(`${API_BASE}/tags/${currentUser.id}`),
        fetch(`${API_BASE}/goals/monthly/${currentUser.id}`),
        fetch(`${API_BASE}/goals/weekly/${currentUser.id}`),
        fetch(`${API_BASE}/goals/daily/${currentUser.id}`),
        fetch(`${API_BASE}/habits/${currentUser.id}`)
      ]);

      if (tagsRes.ok) setTags(await tagsRes.json());
      if (monthlyRes.ok) setMonthlyGoals(await monthlyRes.json());
      if (weeklyRes.ok) setWeeklyGoals(await weeklyRes.json());
      if (dailyRes.ok) setDailyGoals(await dailyRes.json());
      if (habitsRes.ok) setHabits(await habitsRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const url = `${API_BASE}${endpoint}`;
      console.log('Attempting to fetch:', url);
      console.log('Request body:', authForm);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('goalTrackerUser', JSON.stringify(data.user));
        setShowAuth(false);
        setAuthForm({ username: '', password: '' });
      } else {
        alert(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(`Authentication error: ${error.message}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('goalTrackerUser');
    setShowAuth(true);
    setAuthForm({ username: '', password: '' });
  };

  // Tag handlers
  const handleSaveTag = async () => {
    try {
      if (!tagForm.name.trim()) {
        alert('Tag name cannot be empty');
        return;
      }
      const method = editingTag ? 'PUT' : 'POST';
      const endpoint = editingTag ? `/tags/${editingTag.id}` : '/tags';
      const body = {
        name: tagForm.name,
        color: tagForm.color,
        ...(editingTag ? {} : { userId: currentUser.id })
      };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadData();
        setShowTagModal(false);
        setTagForm({ name: '', color: '#3b82f6' });
        setEditingTag(null);
      } else {
        alert('Failed to save tag');
      }
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Error saving tag');
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      const response = await fetch(`${API_BASE}/tags/${tagId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to delete tag');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Error deleting tag');
    }
  };

  // Goal handlers
  const handleSaveGoal = async () => {
    try {
      if (!goalForm.title.trim()) {
        alert('Goal title cannot be empty');
        return;
      }
      let endpoint, body;

      if (goalType === 'monthly') {
        endpoint = editingGoal ? `/goals/monthly/${editingGoal.id}` : '/goals/monthly';
        body = {
          title: goalForm.title,
          tagId: goalForm.tagId,
          month: currentDate.getMonth(),
          year: currentDate.getFullYear(),
          ...(editingGoal ? {} : { userId: currentUser.id })
        };
      } else if (goalType === 'weekly') {
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = getWeekEnd(selectedDate);
        const weekNumber = getISOWeekNumber(selectedDate);
        const year = selectedDate.getFullYear();
        endpoint = editingGoal ? `/goals/weekly/${editingGoal.id}` : '/goals/weekly';
        body = {
          title: goalForm.title,
          tagId: goalForm.tagId,
          parentId: goalForm.parentId || '',
          weekStart,
          weekEnd,
          weekNumber,
          year,
          ...(editingGoal ? {} : { userId: currentUser.id })
        };
      } else {
        endpoint = editingGoal ? `/goals/daily/${editingGoal.id}` : '/goals/daily';
        body = {
          title: goalForm.title,
          tagId: goalForm.tagId,
          parentId: goalForm.parentId || '',
          date: selectedDate.toISOString().split('T')[0],
          ...(editingGoal ? {} : { userId: currentUser.id })
        };
      }

      const method = editingGoal ? 'PUT' : 'POST';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadData();
        setShowGoalModal(false);
        setGoalForm({ title: '', tagId: '', parentId: '' });
        setEditingGoal(null);
      } else {
        alert('Failed to save goal');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Error saving goal');
    }
  };

  const handleDeleteGoal = async (goalId, type) => {
    try {
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/goals/monthly/${goalId}`;
      } else if (type === 'weekly') {
        endpoint = `/goals/weekly/${goalId}`;
      } else {
        endpoint = `/goals/daily/${goalId}`;
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to delete goal');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Error deleting goal');
    }
  };

  // Toggle goal completion
  const handleToggleGoal = async (goalId, type, currentCompleted) => {
    try {
      let endpoint;
      if (type === 'monthly') {
        endpoint = `/goals/monthly/${goalId}`;
      } else if (type === 'weekly') {
        endpoint = `/goals/weekly/${goalId}`;
      } else {
        endpoint = `/goals/daily/${goalId}`;
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Error updating goal');
    }
  };

  // Habit handlers
  const handleSaveHabit = async () => {
    try {
      if (!habitForm.name.trim()) {
        alert('Habit name cannot be empty');
        return;
      }
      const endpoint = editingHabit ? `/habits/${editingHabit.id}` : '/habits';
      const body = {
        name: habitForm.name,
        tagId: habitForm.tagId,
        ...(editingHabit ? {} : { userId: currentUser.id })
      };

      const method = editingHabit ? 'PUT' : 'POST';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadData();
        setShowHabitModal(false);
        setHabitForm({ name: '', tagId: '' });
        setEditingHabit(null);
      } else {
        alert('Failed to save habit');
      }
    } catch (error) {
      console.error('Error saving habit:', error);
      alert('Error saving habit');
    }
  };

  const handleToggleHabit = async (habitId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${API_BASE}/habits/${habitId}/toggle/${today}`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to toggle habit');
      }
    } catch (error) {
      console.error('Error toggling habit:', error);
      alert('Error toggling habit');
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      const response = await fetch(`${API_BASE}/habits/${habitId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Failed to delete habit');
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
      alert('Error deleting habit');
    }
  };

  // Calendar helpers
  const getISOWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNum;
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const getWeekEnd = (date) => {
    const start = new Date(getWeekStart(date));
    return new Date(start.setDate(start.getDate() + 6)).toISOString().split('T')[0];
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startingDayOfWeek = firstDay.getDay();
    
    // Convert Sunday=0 to Monday=0 for week display
    // getDay returns: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // We want: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    startingDayOfWeek = (startingDayOfWeek + 6) % 7;
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getGoalsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dailyGoals.filter(g => g.date === dateStr);
  };

  const getTagColor = (tagId) => {
    const tag = tags.find(t => t.id === tagId);
    return tag?.color || '#6b7280';
  };

  const getTagName = (tagId) => {
    const tag = tags.find(t => t.id === tagId);
    return tag?.name || 'No Tag';
  };

  // Filter goals by selected date
  const getGoalsForSelectedDate = () => {
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const selectedWeek = getISOWeekNumber(selectedDate);
    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    return {
      monthly: monthlyGoals.filter(g => g.month === selectedMonth && g.year === selectedYear),
      weekly: weeklyGoals.filter(g => {
        // Filter by week number and year of the selected date
        return g.weekNumber === selectedWeek && g.year === selectedYear;
      }),
      daily: dailyGoals.filter(g => g.date === selectedDateStr)
    };
  };

  // Format month name
  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };

  // Format date as "28th Sep"
  const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const suffix = getDateSuffix(day);
    return `${day}${suffix} ${month}`;
  };

  // Get date suffix (st, nd, rd, th)
  const getDateSuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const getHabitStats = (habit) => {
    const startDate = new Date(habit.startDate);
    const today = new Date();
    const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const completedDays = habit.completedDates.length;
    const missedDays = totalDays - completedDays;
    
    return { totalDays, completedDays, missedDays };
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Auth Screen
  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-3 sm:p-4">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        
        <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 sm:p-8 w-full max-w-md border border-blue-500/20 shadow-2xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Calendar className="w-7 sm:w-8 h-7 sm:h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
              <p className="text-[10px] sm:text-xs text-gray-400">Achieve your goals with confidence</p>
            </div>
          </div>
          
          <div className="flex gap-2 mb-6 sm:mb-8 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm ${
                isLogin 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-md font-medium transition-all duration-200 text-xs sm:text-sm ${
                !isLogin 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Sign Up
            </button>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full bg-gray-800/50 text-white rounded-lg px-4 py-2.5 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full bg-gray-800/50 text-white rounded-lg px-4 py-2.5 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                placeholder="Enter your password"
                required
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 mt-6 text-sm sm:text-base"
            >
              {isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>
          
          <p className="text-center text-gray-400 text-xs sm:text-sm mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/95 to-gray-900/85 border-b border-blue-500/20 backdrop-blur-xl p-2 sm:p-4 sticky top-0 z-40">
        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Calendar className="w-5 sm:w-6 h-5 sm:h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
              </div>
            </div>
            
            {/* Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gray-800/50 border border-blue-500/20 backdrop-blur text-xs sm:text-sm">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                systemStatus.backendLive && systemStatus.connected && systemStatus.databaseWorking && systemStatus.changesSaved
                  ? 'bg-green-500'
                  : systemStatus.backendLive || systemStatus.connected
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}></div>
              <span className="text-gray-300 font-medium hidden lg:inline">
                {systemStatus.backendLive && systemStatus.connected && systemStatus.databaseWorking && systemStatus.changesSaved
                  ? 'All Systems Online'
                  : systemStatus.backendLive || systemStatus.connected
                  ? 'Partial Connection'
                  : 'System Offline'}
              </span>
              <div className="text-[10px] sm:text-xs text-gray-500 ml-1 flex gap-2">
                <span className="flex items-center gap-1" title="Backend Live">
                  <span className={systemStatus.backendLive ? 'text-green-400' : 'text-red-400'}>Backend</span>
                </span>
                <span className="flex items-center gap-1" title="Database Working">
                  <span className={systemStatus.databaseWorking ? 'text-green-400' : 'text-red-400'}>DB</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6 flex-wrap justify-end w-full sm:w-auto">
            {/* Weather Section */}
            {weather && (
              <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 rounded-lg bg-gradient-to-br from-blue-900/30 to-gray-800/30 border border-blue-500/20 backdrop-blur hover:border-blue-500/40 transition-all text-xs sm:text-sm">
                <div className="text-xl sm:text-2xl">{getWeatherEmoji(weather.weatherCode)}</div>
                <div className="flex flex-col gap-0.5">
                  <div className="font-bold text-blue-300">{weather.temp}°C</div>
                  <div className="text-gray-400">{weather.minTemp}° - {weather.maxTemp}°</div>
                  {locationName && (
                    <div className="text-[8px] sm:text-[9px] text-gray-500 font-medium mt-0.5">{locationName}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Time and Welcome Section */}
            <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs sm:text-sm">
              <div className="font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </div>
              <div className="text-gray-400">Welcome, {currentUser.username.slice(0, 8)}</div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-600 hover:to-red-700 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg whitespace-nowrap font-medium transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto p-2 sm:p-4 flex flex-col lg:flex-row gap-3 sm:gap-4">
        {/* Left Sidebar */}
        <div className="w-full lg:w-80 space-y-3 sm:space-y-4">
          {/* Tags */}
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/50 rounded-xl border border-blue-500/10 backdrop-blur hover:border-blue-500/20 transition-all">
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setTagsExpanded(!tagsExpanded)}
                className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
              >
                <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${tagsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-yellow-600/20 rounded-lg">
                    <Tag className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h2 className="font-semibold text-gray-100">Tags</h2>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowTagModal(true);
                  setEditingTag(null);
                  setTagForm({ name: '', color: '#3b82f6' });
                }}
                className="p-1.5 hover:bg-blue-600/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-400" />
              </button>
            </div>
            {tagsExpanded && (
              <div className="px-4 pb-4 border-t border-gray-800/50">
                {tags.length === 0 ? (
                  <p className="text-sm text-gray-500 pt-2">No tags yet</p>
                ) : (
                  <div className="space-y-2 pt-2">
                    {tags.map(tag => (
                      <div key={tag.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                        <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-sm text-gray-300">{tag.name}</span>
                        <button
                          onClick={() => {
                            setEditingTag(tag);
                            setTagForm(tag);
                            setShowTagModal(true);
                          }}
                          className="p-1 hover:bg-blue-600/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-1 hover:bg-red-600/20 rounded-lg transition-colors text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Monthly Goals */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Monthly Goals</h2>
              <button
                onClick={() => {
                  setGoalType('monthly');
                  setShowGoalModal(true);
                  setEditingGoal(null);
                  setGoalForm({ title: '', tagId: '', parentId: '' });
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {getGoalsForSelectedDate().monthly.length === 0 ? (
              <p className="text-sm text-gray-500">No monthly goals</p>
            ) : (
              <div className="space-y-2">
                {getGoalsForSelectedDate().monthly.map(goal => (
                  <div key={goal.id} className={`bg-gray-800 rounded p-2 flex items-center gap-2 ${goal.completed ? 'opacity-50' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={goal.completed}
                      onChange={() => handleToggleGoal(goal.id, 'monthly', goal.completed)}
                    />
                    <div className="flex-1">
                      <div className={`text-sm ${goal.completed ? 'line-through text-gray-500' : ''}`}>{goal.title}</div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-700">
                          {getMonthName(goal.month)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: getTagColor(goal.tagId) }}>
                          {getTagName(goal.tagId)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingGoal(goal);
                        setGoalType('monthly');
                        setGoalForm(goal);
                        setShowGoalModal(true);
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id, 'monthly')}
                      className="p-1 hover:bg-gray-700 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Goals */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Weekly Goals</h2>
              <button
                onClick={() => {
                  setGoalType('weekly');
                  setShowGoalModal(true);
                  setEditingGoal(null);
                  setGoalForm({ title: '', tagId: '', parentId: '' });
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {getGoalsForSelectedDate().weekly.length === 0 ? (
              <p className="text-sm text-gray-500">No weekly goals</p>
            ) : (
              <div className="space-y-2">
                {getGoalsForSelectedDate().weekly.map(goal => (
                  <div key={goal.id} className={`bg-gray-800 rounded p-2 flex items-center gap-2 ${goal.completed ? 'opacity-50' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={goal.completed}
                      onChange={() => handleToggleGoal(goal.id, 'weekly', goal.completed)}
                    />
                    <div className="flex-1">
                      <div className={`text-sm ${goal.completed ? 'line-through text-gray-500' : ''}`}>{goal.title}</div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-700">
                          {goal.year ? `Week ${goal.weekNumber}` : `${goal.weekStart} to ${goal.weekEnd}`}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: getTagColor(goal.tagId) }}>
                          {getTagName(goal.tagId)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingGoal(goal);
                        setGoalType('weekly');
                        setGoalForm(goal);
                        setShowGoalModal(true);
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id, 'weekly')}
                      className="p-1 hover:bg-gray-700 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Column - Habits and Daily Goals */}
        <div className="w-80 space-y-4">
          {/* Habit Tracker */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <h2 className="font-semibold">Habit Tracker</h2>
              </div>
              <button
                onClick={() => {
                  setShowHabitModal(true);
                  setEditingHabit(null);
                  setHabitForm({ name: '', tagId: '' });
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {habits.length === 0 ? (
              <p className="text-sm text-gray-500">No habits yet</p>
            ) : (
              <div className="space-y-3">
                {habits.map(habit => {
                  const today = new Date().toISOString().split('T')[0];
                  const isCompleted = habit.completedDates.includes(today);
                  const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    return d.toISOString().split('T')[0];
                  });
                  
                  return (
                    <div key={habit.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{habit.name}</span>
                        <button
                          onClick={() => setShowHabitReport(habit)}
                          className="p-1 hover:bg-gray-800 rounded"
                        >
                          <BarChart3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingHabit(habit);
                            setHabitForm({ name: habit.name, tagId: habit.tagId });
                            setShowHabitModal(true);
                          }}
                          className="p-1 hover:bg-gray-800 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="p-1 hover:bg-gray-800 rounded text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {last7Days.map((date, idx) => {
                          const isDateCompleted = habit.completedDates.includes(date);
                          const isDateToday = date === today;
                          return (
                            <button
                              key={idx}
                              onClick={() => isDateToday && handleToggleHabit(habit.id)}
                              disabled={!isDateToday}
                              className={`flex-1 h-8 rounded ${
                                isDateCompleted
                                  ? 'bg-green-600'
                                  : isDateToday
                                  ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                                  : 'bg-gray-800'
                              } ${!isDateToday && 'cursor-default'}`}
                            >
                              {isDateCompleted && <Check className="w-4 h-4 mx-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Goals */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Daily Goals</h2>
              <button
                onClick={() => {
                  setGoalType('daily');
                  setShowGoalModal(true);
                  setEditingGoal(null);
                  setGoalForm({ title: '', tagId: '', parentId: '' });
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {getGoalsForSelectedDate().daily.length === 0 ? (
              <p className="text-sm text-gray-500">No daily goals</p>
            ) : (
              <div className="space-y-2">
                {getGoalsForSelectedDate().daily.map(goal => (
                  <div key={goal.id} className={`bg-gray-800 rounded p-2 flex items-center gap-2 ${goal.completed ? 'opacity-50' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={goal.completed}
                      onChange={() => handleToggleGoal(goal.id, 'daily', goal.completed)}
                    />
                    <div className="flex-1">
                      <div className={`text-sm ${goal.completed ? 'line-through text-gray-500' : ''}`}>{goal.title}</div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-green-700">
                          {formatDateLabel(goal.date)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: getTagColor(goal.tagId) }}>
                          {getTagName(goal.tagId)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingGoal(goal);
                        setGoalType('daily');
                        setGoalForm(goal);
                        setShowGoalModal(true);
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id, 'daily')}
                      className="p-1 hover:bg-gray-700 rounded text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Calendar */}
        <div className="w-full lg:flex-1 bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-800 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentDate(d);
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
                }}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded"
              >
                →
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(100px, 1fr) repeat(7, 1fr)' }}>
              {/* Empty corner cell for week numbers */}
              <div className="text-center text-xs text-gray-500 py-2 font-semibold">Week</div>
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                <div key={day} className="text-center text-xs text-gray-500 py-2">
                  {day}
                </div>
              ))}
              
              {(() => {
                const daysInMonth = getDaysInMonth(currentDate);
                const rows = [];
                let currentWeek = [];
                let weekNum = null;

                for (let i = 0; i < daysInMonth.length; i++) {
                  const day = daysInMonth[i];
                  
                  if (day && weekNum === null) {
                    weekNum = getISOWeekNumber(day);
                  }
                  
                  currentWeek.push(day);
                  
                  if (currentWeek.length === 7) {
                    rows.push({ days: currentWeek, weekNum });
                    currentWeek = [];
                    weekNum = null;
                  }
                }
                
                if (currentWeek.length > 0) {
                  rows.push({ days: currentWeek, weekNum });
                }

                return rows.map((row, rowIdx) => (
                  <React.Fragment key={`week-${rowIdx}`}>
                    <div className="min-h-24 p-2 rounded border border-gray-700 bg-gray-800 flex flex-col items-center justify-start overflow-y-auto">
                      <div className="text-center font-semibold text-sm text-purple-300 mb-2">
                        W{row.weekNum}
                      </div>
                      <div className="flex flex-col gap-0.5 w-full">
                        {(() => {
                          const weekGoals = weeklyGoals.filter(g => g.weekNumber === row.weekNum && g.year === currentDate.getFullYear());
                          let textSize = 'text-xs';
                          let goalLimit = 10;
                          if (weekGoals.length > 5) {
                            textSize = 'text-[10px]';
                          } else if (weekGoals.length > 4) {
                            textSize = 'text-[11px]';
                          }
                          return (
                            <>
                              {weekGoals.slice(0, goalLimit).map(goal => (
                                <div
                                  key={goal.id}
                                  className={`${textSize} px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 ${goal.completed ? 'line-through opacity-50' : ''}`}
                                  style={{ backgroundColor: getTagColor(goal.tagId) }}
                                  title={goal.title}
                                >
                                  {goal.title}
                                </div>
                              ))}
                              {weekGoals.length > goalLimit && (
                                <div className="text-[9px] text-gray-400 text-center">+{weekGoals.length - goalLimit}</div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {row.days.map((day, dayIdx) => {
                      if (!day) return <div key={`empty-${rowIdx}-${dayIdx}`} />;
                      
                      const goalsForDay = getGoalsForDate(day);
                      const dayIsToday = isToday(day);
                      const dateStr = day.toISOString().split('T')[0];
                      const dayForecast = forecastData[dateStr];
                      
                      // Calculate dynamic text size based on number of goals
                      let textSize = 'text-xs';
                      let goalLimit = 10;
                      if (goalsForDay.length > 5) {
                        textSize = 'text-[10px]';
                      } else if (goalsForDay.length > 4) {
                        textSize = 'text-[11px]';
                      }
                      
                      return (
                        <div
                          key={`${rowIdx}-${dayIdx}`}
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-24 p-2 rounded border cursor-pointer overflow-y-auto ${
                            dayIsToday
                              ? 'border-blue-500 bg-blue-950/30'
                              : day.toDateString() === selectedDate.toDateString()
                              ? 'border-blue-400 bg-gray-850'
                              : 'border-gray-800 bg-gray-850 hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm">{day.getDate()}</div>
                            {dayForecast && (
                              <div className="flex items-center gap-0.5">
                                <div className="text-base">{getWeatherEmoji(dayForecast.weatherCode)}</div>
                                <div className="text-[7px] text-gray-400 leading-none">
                                  <div>{dayForecast.maxTemp}°</div>
                                  <div>{dayForecast.minTemp}°</div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {goalsForDay.slice(0, goalLimit).map(goal => (
                              <div
                                key={goal.id}
                                className={`${textSize} px-1 py-0.5 rounded truncate ${goal.completed ? 'line-through opacity-50' : ''}`}
                                style={{ backgroundColor: getTagColor(goal.tagId) }}
                                title={goal.title}
                              >
                                {goal.title}
                              </div>
                            ))}
                            {goalsForDay.length > goalLimit && (
                              <div className="text-[9px] text-gray-400 text-center">+{goalsForDay.length - goalLimit}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-base sm:text-lg font-semibold mb-4">{editingTag ? 'Edit Tag' : 'New Tag'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Tag Name</label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                  placeholder="Enter tag name"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Color</label>
                <input
                  type="color"
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  className="w-full h-10 bg-gray-800 rounded border border-gray-700"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveTag}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowTagModal(false);
                    setEditingTag(null);
                    setTagForm({ name: '', color: '#3b82f6' });
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-gray-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold mb-4">
              {editingGoal ? 'Edit' : 'New'} {goalType.charAt(0).toUpperCase() + goalType.slice(1)} Goal
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                  placeholder="Enter goal title"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Tag</label>
                <select
                  value={goalForm.tagId}
                  onChange={(e) => setGoalForm({ ...goalForm, tagId: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                >
                  <option value="">Select a tag</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
              {(goalType === 'weekly' || goalType === 'daily') && (
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">Parent Goal (Optional)</label>
                  <select
                    value={goalForm.parentId}
                    onChange={(e) => setGoalForm({ ...goalForm, parentId: e.target.value })}
                    className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                  >
                    <option value="">Independent</option>
                    {goalType === 'daily' && (() => {
                      // Filter weekly goals for the selected week
                      const selectedWeek = getISOWeekNumber(selectedDate);
                      const selectedYear = selectedDate.getFullYear();
                      return weeklyGoals
                        .filter(goal => goal.weekNumber === selectedWeek && goal.year === selectedYear)
                        .map(goal => (
                          <option key={goal.id} value={goal.id}>{goal.title} (Weekly)</option>
                        ));
                    })()}
                    {goalType === 'weekly' && (() => {
                      // Filter monthly goals for the selected month
                      const selectedMonth = selectedDate.getMonth();
                      const selectedYear = selectedDate.getFullYear();
                      return monthlyGoals
                        .filter(goal => goal.month === selectedMonth && goal.year === selectedYear)
                        .map(goal => (
                          <option key={goal.id} value={goal.id}>{goal.title} (Monthly)</option>
                        ));
                    })()}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveGoal}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowGoalModal(false);
                    setEditingGoal(null);
                    setGoalForm({ title: '', tagId: '', parentId: '' });
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Habit Modal */}
      {showHabitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-base sm:text-lg font-semibold mb-4">{editingHabit ? 'Edit Habit' : 'New Habit'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Habit Name</label>
                <input
                  type="text"
                  value={habitForm.name}
                  onChange={(e) => setHabitForm({ ...habitForm, name: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                  placeholder="Enter habit name"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-gray-400 mb-1">Tag</label>
                <select
                  value={habitForm.tagId}
                  onChange={(e) => setHabitForm({ ...habitForm, tagId: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 text-sm"
                >
                  <option value="">Select a tag</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveHabit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowHabitModal(false);
                    setEditingHabit(null);
                    setHabitForm({ name: '', tagId: '' });
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Habit Report Modal */}
      {showHabitReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-6xl border border-gray-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Habit Report: {showHabitReport.name}</h3>
            <div className="space-y-4">
              {(() => {
                const stats = getHabitStats(showHabitReport);
                
                // Calculate current streak
                let currentStreak = 0;
                const today = new Date();
                for (let i = 0; i < 365; i++) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().split('T')[0];
                  if (showHabitReport.completedDates.includes(dateStr)) {
                    currentStreak++;
                  } else {
                    break;
                  }
                }
                
                // Generate GitHub-style contribution grid for whole year (365 days)
                const last365Days = [];
                for (let i = 364; i >= 0; i--) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  last365Days.push(d.toISOString().split('T')[0]);
                }
                
                // Group by weeks (Sunday to Saturday) - 52 weeks
                const weeks = [];
                for (let i = 0; i < last365Days.length; i += 7) {
                  weeks.push(last365Days.slice(i, i + 7));
                }
                
                return (
                  <>
                    {/* Stats Row with Streak */}
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-orange-900/30 rounded p-3 border border-orange-700">
                        <div className="text-sm text-gray-400">Current Streak</div>
                        <div className="text-3xl font-bold text-orange-500">{currentStreak}</div>
                        <div className="text-xs text-gray-500">days</div>
                      </div>
                      <div className="bg-gray-800 rounded p-3">
                        <div className="text-sm text-gray-400">Total Days</div>
                        <div className="text-2xl font-bold">{stats.totalDays}</div>
                      </div>
                      <div className="bg-green-900/30 rounded p-3">
                        <div className="text-sm text-gray-400">Days Completed</div>
                        <div className="text-2xl font-bold text-green-500">{stats.completedDays}</div>
                      </div>
                      <div className="bg-red-900/30 rounded p-3">
                        <div className="text-sm text-gray-400">Days Missed</div>
                        <div className="text-2xl font-bold text-red-500">{stats.missedDays}</div>
                      </div>
                      <div className="bg-gray-800 rounded p-3">
                        <div className="text-sm text-gray-400">Completion Rate</div>
                        <div className="text-2xl font-bold">
                          {stats.totalDays > 0 ? Math.round((stats.completedDays / stats.totalDays) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                    
                    {/* GitHub-style Contribution Grid - Full Year */}
                    <div className="bg-gray-800/50 rounded p-4">
                      <div className="text-sm text-gray-400 mb-3">Last 52 Weeks</div>
                      <div className="flex gap-1 overflow-x-auto pb-2">
                        {weeks.map((week, weekIdx) => (
                          <div key={weekIdx} className="flex flex-col gap-1">
                            {week.map((date, dayIdx) => {
                              const isCompleted = showHabitReport.completedDates.includes(date);
                              const isCurrentDay = date === new Date().toISOString().split('T')[0];
                              return (
                                <div
                                  key={date}
                                  className={`w-4 h-4 rounded-sm cursor-pointer transition-all ${
                                    isCompleted
                                      ? 'bg-green-500 hover:ring-1 hover:ring-green-400'
                                      : 'bg-gray-700 hover:bg-gray-600'
                                  } ${isCurrentDay ? 'ring-1 ring-blue-400' : ''}`}
                                  title={`${date}: ${isCompleted ? 'Completed' : 'Missed'}`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                        <span>Less</span>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-sm bg-gray-700"></div>
                          <div className="w-4 h-4 rounded-sm bg-green-400"></div>
                          <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                        </div>
                        <span>More</span>
                      </div>
                    </div>
                  </>
                );
              })()}
              <button
                onClick={() => setShowHabitReport(null)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalTrackerApp;
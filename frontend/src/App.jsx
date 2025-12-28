import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, Edit2, Trash2, Tag, BarChart3, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Toaster, toast } from 'sonner';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://goal-tracker-tihi.onrender.com/api'
  : 'http://127.0.0.1:5000/api';

const GoalTrackerApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  
  const [tags, setTags] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [dailyGoals, setDailyGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showTagModal, setShowTagModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [showHabitReport, setShowHabitReport] = useState(null);
  const [goalType, setGoalType] = useState('monthly');
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [tagForm, setTagForm] = useState({ name: '', color: '#3b82f6' });
  const [goalForm, setGoalForm] = useState({ title: '', tagId: '', parentId: '' });
  const [habitForm, setHabitForm] = useState({ name: '', tagId: '' });

  const [systemStatus, setSystemStatus] = useState({
    backendLive: false,
    connected: false,
    databaseWorking: false,
    changesSaved: false
  });

  const [weather, setWeather] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [forecastData, setForecastData] = useState({});

  const checkSystemHealth = async () => {
    try {
      const healthRes = await fetch(`${API_BASE.replace('/api', '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      
      const backendLive = healthRes && healthRes.ok;
      const apiHealthRes = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      }).catch(() => null);
      
      const connected = apiHealthRes && apiHealthRes.ok;
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

      setSystemStatus({
        backendLive,
        connected,
        databaseWorking,
        changesSaved: backendLive && connected && databaseWorking
      });
    } catch (error) {
      setSystemStatus({
        backendLive: false,
        connected: false,
        databaseWorking: false,
        changesSaved: false
      });
    }
  };

  const fetchWeather = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
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
        }
      );
    }
  };

  const getWeatherEmoji = (code) => {
    if (code === 0 || code === 1) return '☀️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    return '🌤️';
  };

  useEffect(() => {
    fetchWeather();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('goalTrackerUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setShowAuth(false);
      } catch (error) {
        localStorage.removeItem('goalTrackerUser');
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  // Health check - periodic without interfering with user interactions
  useEffect(() => {
    if (!currentUser) return;
    
    // Initial health check
    checkSystemHealth();
    
    // Periodic health check every 45 seconds (non-blocking)
    const healthCheckInterval = setInterval(() => {
      checkSystemHealth();
    }, 45000);
    
    return () => clearInterval(healthCheckInterval);
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

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('goalTrackerUser', JSON.stringify(data.user));
        setShowAuth(false);
        setAuthForm({ username: '', password: '' });
        toast.success(isLogin ? 'Login successful!' : 'Account created!');
      } else {
        toast.error(data.message || 'Authentication failed');
      }
    } catch (error) {
      toast.error(`Authentication error: ${error.message}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('goalTrackerUser');
    setShowAuth(true);
  };

  const handleSaveTag = async () => {
    if (!tagForm.name.trim()) return toast.error('Tag name cannot be empty');
    try {
      const method = editingTag ? 'PUT' : 'POST';
      const endpoint = editingTag ? `/tags/${editingTag.id}` : '/tags';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagForm.name,
          color: tagForm.color,
          ...(editingTag ? {} : { userId: currentUser.id })
        })
      });

      if (response.ok) {
        await loadData();
        setShowTagModal(false);
        setTagForm({ name: '', color: '#3b82f6' });
        setEditingTag(null);
        toast.success(editingTag ? 'Tag updated!' : 'Tag created!');
      } else {
        toast.error('Failed to save tag');
      }
    } catch (error) {
      toast.error('Error saving tag');
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      const response = await fetch(`${API_BASE}/tags/${tagId}`, { method: 'DELETE' });
      if (response.ok) {
        await loadData();
        toast.success('Tag deleted!');
      } else {
        const error = await response.json();
        toast.error(`Error deleting tag: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Error deleting tag');
    }
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title.trim()) return toast.error('Goal title cannot be empty');
    try {
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
        endpoint = editingGoal ? `/goals/weekly/${editingGoal.id}` : '/goals/weekly';
        body = {
          title: goalForm.title,
          tagId: goalForm.tagId,
          parentId: goalForm.parentId || '',
          weekStart: getWeekStart(selectedDate),
          weekEnd: getWeekEnd(selectedDate),
          weekNumber: getISOWeekNumber(selectedDate),
          year: selectedDate.getFullYear(),
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

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: editingGoal ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadData();
        setShowGoalModal(false);
        setGoalForm({ title: '', tagId: '', parentId: '' });
        setEditingGoal(null);
        toast.success(editingGoal ? 'Goal updated!' : 'Goal created!');
      } else {
        toast.error('Failed to save goal');
      }
    } catch (error) {
      toast.error('Error saving goal');
    }
  };

  const handleDeleteGoal = async (goalId, type) => {
    try {
      const endpoints = { monthly: `/goals/monthly/${goalId}`, weekly: `/goals/weekly/${goalId}`, daily: `/goals/daily/${goalId}` };
      const response = await fetch(`${API_BASE}${endpoints[type]}`, { method: 'DELETE' });
      if (response.ok) {
        await loadData();
        toast.success('Goal deleted!');
      } else {
        const error = await response.json();
        toast.error(`Error deleting goal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Error deleting goal');
    }
  };

  const handleToggleGoal = async (goalId, type, currentCompleted) => {
    try {
      const endpoints = { monthly: `/goals/monthly/${goalId}`, weekly: `/goals/weekly/${goalId}`, daily: `/goals/daily/${goalId}` };
      const response = await fetch(`${API_BASE}${endpoints[type]}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      });
      if (response.ok) {
        await loadData();
        toast.success('Goal updated!');
      } else {
        const error = await response.json();
        toast.error(`Error updating goal: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Error updating goal');
    }
  };

  const handleSaveHabit = async () => {
    if (!habitForm.name.trim()) return toast.error('Habit name cannot be empty');
    try {
      const endpoint = editingHabit ? `/habits/${editingHabit.id}` : '/habits';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: editingHabit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: habitForm.name,
          tagId: habitForm.tagId,
          ...(editingHabit ? {} : { userId: currentUser.id })
        })
      });

      if (response.ok) {
        await loadData();
        setShowHabitModal(false);
        setHabitForm({ name: '', tagId: '' });
        setEditingHabit(null);
        toast.success(editingHabit ? 'Habit updated!' : 'Habit created!');
      } else {
        toast.error('Failed to save habit');
      }
    } catch (error) {
      toast.error('Error saving habit');
    }
  };

const handleToggleHabit = async (habitId, date) => {
  try {
    const response = await fetch(`${API_BASE}/habits/${habitId}/toggle/${date}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to toggle habit');
    }
    
    const updatedHabit = await response.json();
    
    // Update the habit in state
    setHabits(habits.map(h => h.id === habitId ? updatedHabit : h));
    toast.success('Habit toggled!');
  } catch (error) {
    console.error('Error toggling habit:', error);
    toast.error(error.message);
  }
};

  const handleDeleteHabit = async (habitId) => {
    try {
      const response = await fetch(`${API_BASE}/habits/${habitId}`, { method: 'DELETE' });
      if (response.ok) {
        await loadData();
        toast.success('Habit deleted!');
      } else {
        const error = await response.json();
        toast.error(`Error deleting habit: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
      toast.error('Error deleting habit');
    }
  };

  const getISOWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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
    let startingDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const getGoalsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return dailyGoals.filter(g => g.date === dateStr);
  };

  const getTagColor = (tagId) => tags.find(t => t.id === tagId)?.color || '#6b7280';
  const getTagName = (tagId) => tags.find(t => t.id === tagId)?.name || 'No Tag';

  const getGoalsForSelectedDate = () => {
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const selectedWeek = getISOWeekNumber(selectedDate);
    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    return {
      monthly: monthlyGoals.filter(g => g.month === selectedMonth && g.year === selectedYear),
      weekly: weeklyGoals.filter(g => g.weekNumber === selectedWeek && g.year === selectedYear),
      daily: dailyGoals.filter(g => g.date === selectedDateStr)
    };
  };

  const getMonthName = (monthIndex) => {
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][monthIndex];
  };

  const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const suffix = day >= 11 && day <= 13 ? 'th' : ['st', 'nd', 'rd'][day % 10 - 1] || 'th';
    return `${day}${suffix} ${month}`;
  };

  const getHabitStats = (habit) => {
    const startDate = new Date(habit.startDate);
    const today = new Date();
    const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const completedDays = habit.completedDates.length;
    return { totalDays, completedDays, missedDays: totalDays - completedDays };
  };

  const isToday = (date) => date.toDateString() === new Date().toDateString();

  if (showAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>
        
        <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 sm:p-8 w-full max-w-md border border-blue-500/20 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-xl">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
              <p className="text-xs text-gray-400 mt-0.5">Achieve your goals with confidence</p>
            </div>
          </div>
          
          <div className="flex gap-2 mb-8 bg-gray-800/50 rounded-xl p-1.5">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                isLogin ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-400'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                !isLogin ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-400'
              }`}
            >
              Sign Up
            </button>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm"
                placeholder="Enter your password"
                required
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3.5 rounded-xl font-semibold shadow-lg">
              {isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>
          
          <p className="text-center text-gray-400 text-sm mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setIsLogin(!isLogin)} className="text-blue-400 hover:text-blue-300 font-semibold">
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const GoalSection = ({ title, goals, type, onAdd, onEdit, onDelete, onToggle }) => (
    <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-100">{title}</h2>
        <button onClick={onAdd} className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors">
          <Plus className="w-4 h-4 text-blue-400" />
        </button>
      </div>
      {goals.length === 0 ? (
        <p className="text-sm text-gray-500">No {title.toLowerCase()}</p>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => (
            <div key={goal.id} className={`bg-gray-800/50 rounded-lg p-2.5 flex items-start gap-2 ${goal.completed ? 'opacity-60' : ''}`}>
              <input 
                type="checkbox" 
                className="rounded mt-0.5 cursor-pointer accent-blue-600" 
                checked={goal.completed}
                onChange={() => onToggle(goal.id, goal.completed)}
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${goal.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                  {goal.title}
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {type === 'monthly' && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-blue-600/80 text-white">
                      {getMonthName(goal.month)}
                    </span>
                  )}
                  {type === 'weekly' && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-600/80 text-white">
                      Week {goal.weekNumber}
                    </span>
                  )}
                  {type === 'daily' && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-green-600/80 text-white">
                      {formatDateLabel(goal.date)}
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: getTagColor(goal.tagId) }}>
                    {getTagName(goal.tagId)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(goal)} className="p-1.5 hover:bg-blue-600/20 rounded-lg">
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <button onClick={() => onDelete(goal.id)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Toaster
        position="top-center"
        richColors
        theme="dark"
        toastOptions={{
          style: {
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            color: '#e0f2fe'
          }
        }}
      />
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900/95 via-gray-900/90 to-gray-900/95 border-b border-blue-500/20 backdrop-blur-xl p-3 sm:p-4 sticky top-0 z-50 shadow-xl">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-xl">
              <Calendar className="w-5 sm:w-6 h-5 sm:h-6 text-blue-400" />
            </div>
            <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800/60 border border-blue-500/20 text-xs">
              <div className={`w-2 h-2 rounded-full animate-pulse ${systemStatus.changesSaved ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-300">{systemStatus.changesSaved ? 'Online' : 'Offline'}</span>
            </div>

            {weather && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-blue-900/40 to-gray-800/40 border border-blue-500/20">
                <div className="text-xl">{getWeatherEmoji(weather.weatherCode)}</div>
                <div className="flex flex-col">
                  <div className="font-bold text-blue-300 text-sm">{weather.temp}°C</div>
                  <div className="text-gray-400 text-xs">{weather.minTemp}° - {weather.maxTemp}°</div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-end">
              <div className="font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent text-sm">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
              <div className="text-gray-400 text-xs hidden sm:block">Hi, {currentUser.username}</div>
            </div>
            
            <button onClick={handleLogout} className="text-xs sm:text-sm bg-gradient-to-r from-red-600 to-red-700 px-3 py-2 rounded-xl font-semibold">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile View - Stacked Components */}
      <div className="lg:hidden px-3 py-4 space-y-4">
        {/* Tags */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setTagsExpanded(!tagsExpanded)} className="flex items-center gap-2 flex-1">
              <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${tagsExpanded ? 'rotate-0' : '-rotate-90'}`} />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-600/20 rounded-lg">
                  <Tag className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="font-semibold text-gray-100">Tags</h2>
              </div>
            </button>
            <button onClick={() => { setShowTagModal(true); setEditingTag(null); setTagForm({ name: '', color: '#3b82f6' }); }} className="p-2 hover:bg-blue-600/20 rounded-lg">
              <Plus className="w-4 h-4 text-blue-400" />
            </button>
          </div>
          {tagsExpanded && (
            <div className="px-4 pb-4 border-t border-gray-800/50">
              {tags.length === 0 ? (
                <p className="text-sm text-gray-500 pt-3">No tags yet</p>
              ) : (
                <div className="space-y-2 pt-3">
                  {tags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-800/50">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-sm text-gray-300">{tag.name}</span>
                      <button onClick={() => { setEditingTag(tag); setTagForm(tag); setShowTagModal(true); }} className="p-1.5 hover:bg-blue-600/20 rounded-lg">
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button onClick={() => handleDeleteTag(tag.id)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


        {/* Habits */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-600/20 rounded-lg">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <h2 className="font-semibold">Habits</h2>
            </div>
            <button
              onClick={() => {
                setShowHabitModal(true);
                setEditingHabit(null);
                setHabitForm({ name: '', tagId: '' });
              }}
              className="p-2 hover:bg-gray-800/50 rounded-lg"
            >
              <Plus className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          {habits.length === 0 ? (
            <p className="text-sm text-gray-500">No habits yet</p>
          ) : (
            <div className="space-y-3">
              {habits.map(habit => {
                const today = new Date().toISOString().split('T')[0];
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
                        className="p-1.5 hover:bg-gray-800/50 rounded-lg"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingHabit(habit);
                          setHabitForm({ name: habit.name, tagId: habit.tagId });
                          setShowHabitModal(true);
                        }}
                        className="p-1.5 hover:bg-gray-800/50 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="p-1.5 hover:bg-gray-800/50 rounded-lg text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Last 7 days tracker */}
                    <div className="flex gap-1">
                      {last7Days.map((date, idx) => {
                        const isDateCompleted = habit.completedDates.includes(date);
                        const isDateToday = date === today;

                        return (
                          <button
                            key={idx}
                            onClick={() => isDateToday && handleToggleHabit(habit.id, today)}
                            disabled={!isDateToday}
                            title={isDateToday ? 'Click to toggle today' : date}
                            className={`flex-1 h-8 rounded-lg transition-all ${isDateCompleted
                                ? 'bg-gradient-to-br from-green-600 to-green-700'
                                : isDateToday
                                  ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                                  : 'bg-gray-800/50'
                              } ${isDateToday ? 'cursor-pointer' : 'cursor-default'}`}
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
        <GoalSection
          title="Daily Goals"
          goals={getGoalsForSelectedDate().daily}
          type="daily"
          onAdd={() => { setGoalType('daily'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
          onEdit={(goal) => { setEditingGoal(goal); setGoalType('daily'); setGoalForm(goal); setShowGoalModal(true); }}
          onDelete={(id) => handleDeleteGoal(id, 'daily')}
          onToggle={(id, completed) => handleToggleGoal(id, 'daily', completed)}
        />

        {/* Weekly Goals */}
        <GoalSection
          title="Weekly Goals"
          goals={getGoalsForSelectedDate().weekly}
          type="weekly"
          onAdd={() => { setGoalType('weekly'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
          onEdit={(goal) => { setEditingGoal(goal); setGoalType('weekly'); setGoalForm(goal); setShowGoalModal(true); }}
          onDelete={(id) => handleDeleteGoal(id, 'weekly')}
          onToggle={(id, completed) => handleToggleGoal(id, 'weekly', completed)}
        />

        {/* Monthly Goals */}
        <GoalSection
          title="Monthly Goals"
          goals={getGoalsForSelectedDate().monthly}
          type="monthly"
          onAdd={() => { setGoalType('monthly'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
          onEdit={(goal) => { setEditingGoal(goal); setGoalType('monthly'); setGoalForm(goal); setShowGoalModal(true); }}
          onDelete={(id) => handleDeleteGoal(id, 'monthly')}
          onToggle={(id, completed) => handleToggleGoal(id, 'monthly', completed)}
        />

        {/* Mobile Calendar */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/60 rounded-xl p-4 border border-blue-500/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="p-2 bg-gray-800/60 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-xs font-medium">
                Today
              </button>
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="p-2 bg-gray-800/60 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
              <div key={idx} className="text-center text-xs text-gray-400 py-1 font-medium">{day}</div>
            ))}
            
            {getDaysInMonth(currentDate).map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              
              const goalsForDay = getGoalsForDate(day);
              const dayIsToday = isToday(day);
              const dateStr = day.toISOString().split('T')[0];
              const dayForecast = forecastData[dateStr];
              
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square p-1 rounded-lg border cursor-pointer ${
                    dayIsToday ? 'border-blue-500 bg-blue-950/50' : day.toDateString() === selectedDate.toDateString() ? 'border-blue-400/60 bg-gray-800/60' : 'border-gray-700/50 bg-gray-800/40'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${dayIsToday ? 'text-blue-400' : 'text-gray-300'}`}>{day.getDate()}</span>
                      {dayForecast && <span className="text-xs">{getWeatherEmoji(dayForecast.weatherCode)}</span>}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
                      {goalsForDay.slice(0, 2).map(goal => (
                        <div key={goal.id} className="h-1 rounded-full" style={{ backgroundColor: getTagColor(goal.tagId) }} />
                      ))}
                      {goalsForDay.length > 2 && <div className="text-[8px] text-gray-400">+{goalsForDay.length - 2}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop View - Original Layout */}
      <div className="hidden lg:block">
        <div className="max-w-full mx-auto p-4 flex gap-4">
          {/* Left Sidebar */}
          <div className="w-80 space-y-4">
            {/* Tags */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10">
              <div className="flex items-center justify-between p-4">
                <button onClick={() => setTagsExpanded(!tagsExpanded)} className="flex items-center gap-2 flex-1">
                  <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${tagsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-yellow-600/20 rounded-lg">
                      <Tag className="w-4 h-4 text-yellow-400" />
                    </div>
                    <h2 className="font-semibold text-gray-100">Tags</h2>
                  </div>
                </button>
                <button onClick={() => { setShowTagModal(true); setEditingTag(null); setTagForm({ name: '', color: '#3b82f6' }); }} className="p-2 hover:bg-blue-600/20 rounded-lg">
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>
              {tagsExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800/50">
                  {tags.length === 0 ? (
                    <p className="text-sm text-gray-500 pt-3">No tags yet</p>
                  ) : (
                    <div className="space-y-2 pt-3">
                      {tags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-800/50">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="flex-1 text-sm text-gray-300">{tag.name}</span>
                          <button onClick={() => { setEditingTag(tag); setTagForm(tag); setShowTagModal(true); }} className="p-1.5 hover:bg-blue-600/20 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                          <button onClick={() => handleDeleteTag(tag.id)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <GoalSection
              title="Monthly Goals"
              goals={getGoalsForSelectedDate().monthly}
              type="monthly"
              onAdd={() => { setGoalType('monthly'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
              onEdit={(goal) => { setEditingGoal(goal); setGoalType('monthly'); setGoalForm(goal); setShowGoalModal(true); }}
              onDelete={(id) => handleDeleteGoal(id, 'monthly')}
              onToggle={(id, completed) => handleToggleGoal(id, 'monthly', completed)}
            />

            <GoalSection
              title="Weekly Goals"
              goals={getGoalsForSelectedDate().weekly}
              type="weekly"
              onAdd={() => { setGoalType('weekly'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
              onEdit={(goal) => { setEditingGoal(goal); setGoalType('weekly'); setGoalForm(goal); setShowGoalModal(true); }}
              onDelete={(id) => handleDeleteGoal(id, 'weekly')}
              onToggle={(id, completed) => handleToggleGoal(id, 'weekly', completed)}
            />
          </div>

          {/* Middle Column */}
          <div className="w-80 space-y-4">
            {/* Habit Tracker */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-600/20 rounded-lg">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <h2 className="font-semibold">Habits</h2>
                </div>
                <button onClick={() => { setShowHabitModal(true); setEditingHabit(null); setHabitForm({ name: '', tagId: '' }); }} className="p-2 hover:bg-gray-800/50 rounded-lg">
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>
              {habits.length === 0 ? (
                <p className="text-sm text-gray-500">No habits yet</p>
              ) : (
                <div className="space-y-3">
                  {habits.map(habit => {
                    const today = new Date().toISOString().split('T')[0];
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      return d.toISOString().split('T')[0];
                    });
                    
                    return (
                      <div key={habit.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm">{habit.name}</span>
                          <button onClick={() => setShowHabitReport(habit)} className="p-1.5 hover:bg-gray-800/50 rounded-lg">
                            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                          <button onClick={() => { setEditingHabit(habit); setHabitForm({ name: habit.name, tagId: habit.tagId }); setShowHabitModal(true); }} className="p-1.5 hover:bg-gray-800/50 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                          <button onClick={() => handleDeleteHabit(habit.id)} className="p-1.5 hover:bg-gray-800/50 rounded-lg text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {last7Days.map((date, idx) => {
                            const isDateCompleted = habit.completedDates.includes(date);
                            const isDateToday = date === today;
                            return (
                              <button
                                key={idx}
                                onClick={() => isDateToday && handleToggleHabit(habit.id, date)}
                                disabled={!isDateToday}
                                className={`flex-1 h-8 rounded-lg transition-all ${
                                  isDateCompleted ? 'bg-gradient-to-br from-green-600 to-green-700' : isDateToday ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-800/50'
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

            <GoalSection
              title="Daily Goals"
              goals={getGoalsForSelectedDate().daily}
              type="daily"
              onAdd={() => { setGoalType('daily'); setShowGoalModal(true); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }}
              onEdit={(goal) => { setEditingGoal(goal); setGoalType('daily'); setGoalForm(goal); setShowGoalModal(true); }}
              onDelete={(id) => handleDeleteGoal(id, 'daily')}
              onToggle={(id, completed) => handleToggleGoal(id, 'daily', completed)}
            />
          </div>

          {/* Calendar */}
          <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-900/60 rounded-xl p-4 border border-blue-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="px-3 py-2 bg-gray-800/60 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-sm font-medium">
                  Today
                </button>
                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="px-3 py-2 bg-gray-800/60 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(80px, 100px) repeat(7, 1fr)' }}>
              <div className="text-center text-xs text-gray-500 py-2 font-semibold">Week</div>
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                <div key={day} className="text-center text-xs text-gray-400 py-2 font-medium">{day}</div>
              ))}
              
              {(() => {
                const daysInMonth = getDaysInMonth(currentDate);
                const rows = [];
                let currentWeek = [];
                let weekNum = null;

                for (let i = 0; i < daysInMonth.length; i++) {
                  const day = daysInMonth[i];
                  if (day && weekNum === null) weekNum = getISOWeekNumber(day);
                  currentWeek.push(day);
                  
                  if (currentWeek.length === 7) {
                    rows.push({ days: currentWeek, weekNum });
                    currentWeek = [];
                    weekNum = null;
                  }
                }
                if (currentWeek.length > 0) rows.push({ days: currentWeek, weekNum });

                return rows.map((row, rowIdx) => (
                  <React.Fragment key={`week-${rowIdx}`}>
                    <div className="min-h-24 p-2 rounded-lg border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 flex flex-col items-center overflow-y-auto">
                      <div className="text-center font-semibold text-sm text-purple-400 mb-2">W{row.weekNum}</div>
                      <div className="flex flex-col gap-0.5 w-full">
                        {weeklyGoals.filter(g => g.weekNumber === row.weekNum && g.year === currentDate.getFullYear()).slice(0, 8).map(goal => (
                          <div key={goal.id} className={`text-xs px-1.5 py-1 rounded truncate text-white ${goal.completed ? 'line-through opacity-50' : ''}`} style={{ backgroundColor: getTagColor(goal.tagId) }} title={goal.title}>
                            {goal.title}
                          </div>
                        ))}
                      </div>
                    </div>
                    {row.days.map((day, dayIdx) => {
                      if (!day) return <div key={`empty-${rowIdx}-${dayIdx}`} />;
                      
                      const goalsForDay = getGoalsForDate(day);
                      const dayIsToday = isToday(day);
                      const dateStr = day.toISOString().split('T')[0];
                      const dayForecast = forecastData[dateStr];
                      
                      return (
                        <div
                          key={`${rowIdx}-${dayIdx}`}
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-24 p-2 rounded-lg border cursor-pointer overflow-y-auto ${
                            dayIsToday ? 'border-blue-500 bg-gradient-to-br from-blue-950/50 to-blue-900/30' : day.toDateString() === selectedDate.toDateString() ? 'border-blue-400/60 bg-gradient-to-br from-gray-800/60 to-gray-900/60' : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className={`text-sm font-medium ${dayIsToday ? 'text-blue-400' : 'text-gray-300'}`}>{day.getDate()}</div>
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
                            {goalsForDay.slice(0, 8).map(goal => (
                              <div key={goal.id} className={`text-xs px-1.5 py-1 rounded truncate ${goal.completed ? 'line-through opacity-50' : ''}`} style={{ backgroundColor: getTagColor(goal.tagId) }} title={goal.title}>
                                {goal.title}
                              </div>
                            ))}
                            {goalsForDay.length > 8 && <div className="text-[9px] text-gray-400 text-center">+{goalsForDay.length - 8}</div>}
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

      {/* Modals */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20">
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{editingTag ? 'Edit Tag' : 'New Tag'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tag Name</label>
                <input type="text" value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm" placeholder="Enter tag name" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Color</label>
                <input type="color" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} className="w-full h-12 bg-gray-800/60 rounded-xl border border-gray-700/50 cursor-pointer" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveTag} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold">Save</button>
                <button onClick={() => { setShowTagModal(false); setEditingTag(null); setTagForm({ name: '', color: '#3b82f6' }); }} className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{editingGoal ? 'Edit' : 'New'} {goalType.charAt(0).toUpperCase() + goalType.slice(1)} Goal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Title</label>
                <input type="text" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm" placeholder="Enter goal title" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tag</label>
                <select value={goalForm.tagId} onChange={(e) => setGoalForm({ ...goalForm, tagId: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm">
                  <option value="">Select a tag</option>
                  {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
              </div>
              {(goalType === 'weekly' || goalType === 'daily') && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Parent Goal (Optional)</label>
                  <select value={goalForm.parentId} onChange={(e) => setGoalForm({ ...goalForm, parentId: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm">
                    <option value="">Independent</option>
                    {goalType === 'daily' && weeklyGoals.filter(g => g.weekNumber === getISOWeekNumber(selectedDate) && g.year === selectedDate.getFullYear()).map(goal => (
                      <option key={goal.id} value={goal.id}>{goal.title} (Weekly)</option>
                    ))}
                    {goalType === 'weekly' && monthlyGoals.filter(g => g.month === selectedDate.getMonth() && g.year === selectedDate.getFullYear()).map(goal => (
                      <option key={goal.id} value={goal.id}>{goal.title} (Monthly)</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveGoal} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold">Save</button>
                <button onClick={() => { setShowGoalModal(false); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); }} className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHabitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20">
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{editingHabit ? 'Edit Habit' : 'New Habit'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Habit Name</label>
                <input type="text" value={habitForm.name} onChange={(e) => setHabitForm({ ...habitForm, name: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm" placeholder="Enter habit name" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tag</label>
                <select value={habitForm.tagId} onChange={(e) => setHabitForm({ ...habitForm, tagId: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm">
                  <option value="">Select a tag</option>
                  {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveHabit} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold">Save</button>
                <button onClick={() => { setShowHabitModal(false); setEditingHabit(null); setHabitForm({ name: '', tagId: '' }); }} className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHabitReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-6xl border border-blue-500/20 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Habit Report: {showHabitReport.name}</h3>
            <div className="space-y-5">
              {(() => {
                const stats = getHabitStats(showHabitReport);
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
                
                const last365Days = [];
                for (let i = 364; i >= 0; i--) {
                  const d = new Date(today);
                  d.setDate(d.getDate() - i);
                  last365Days.push(d.toISOString().split('T')[0]);
                }
                
                const weeks = [];
                for (let i = 0; i < last365Days.length; i += 7) {
                  weeks.push(last365Days.slice(i, i + 7));
                }
                
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/30 rounded-xl p-4 border border-orange-700/30">
                        <div className="text-xs text-gray-400 mb-1">Current Streak</div>
                        <div className="text-3xl font-bold text-orange-400">{currentStreak}</div>
                        <div className="text-xs text-gray-500 mt-1">days</div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-gray-700/30">
                        <div className="text-xs text-gray-400 mb-1">Total Days</div>
                        <div className="text-2xl font-bold text-blue-400">{stats.totalDays}</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-900/40 to-green-800/30 rounded-xl p-4 border border-green-700/30">
                        <div className="text-xs text-gray-400 mb-1">Completed</div>
                        <div className="text-2xl font-bold text-green-400">{stats.completedDays}</div>
                      </div>
                      <div className="bg-gradient-to-br from-red-900/40 to-red-800/30 rounded-xl p-4 border border-red-700/30">
                        <div className="text-xs text-gray-400 mb-1">Missed</div>
                        <div className="text-2xl font-bold text-red-400">{stats.missedDays}</div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-gray-700/30">
                        <div className="text-xs text-gray-400 mb-1">Rate</div>
                        <div className="text-2xl font-bold text-purple-400">
                          {stats.totalDays > 0 ? Math.round((stats.completedDays / stats.totalDays) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                      <div className="text-sm text-gray-400 mb-4 font-medium">Last 52 Weeks</div>
                      <div className="flex gap-1 overflow-x-auto pb-2">
                        {weeks.map((week, weekIdx) => (
                          <div key={weekIdx} className="flex flex-col gap-1 flex-shrink-0">
                            {week.map((date) => {
                              const isCompleted = showHabitReport.completedDates.includes(date);
                              const isCurrentDay = date === new Date().toISOString().split('T')[0];
                              return (
                                <div key={date} className={`w-3.5 h-3.5 rounded-sm cursor-pointer transition-all hover:scale-110 ${isCompleted ? 'bg-green-500 shadow-md shadow-green-500/30' : 'bg-gray-700/50'} ${isCurrentDay ? 'ring-2 ring-blue-400' : ''}`} title={`${date}: ${isCompleted ? 'Completed' : 'Missed'}`} />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-4 flex items-center gap-3">
                        <span>Less</span>
                        <div className="flex gap-1.5">
                          <div className="w-4 h-4 rounded-sm bg-gray-700/50"></div>
                          <div className="w-4 h-4 rounded-sm bg-green-400/60"></div>
                          <div className="w-4 h-4 rounded-sm bg-green-500"></div>
                        </div>
                        <span>More</span>
                      </div>
                    </div>
                  </>
                );
              })()}
              <button onClick={() => setShowHabitReport(null)} className="w-full bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default GoalTrackerApp;

















// import React, { useState, useEffect } from 'react';
// import { Calendar, Plus, Check, X, Edit2, Trash2, Tag, BarChart3, ChevronDown, Menu, ChevronLeft, ChevronRight } from 'lucide-react';

// // API Base URL - automatically uses production or local backend
// const API_BASE = process.env.NODE_ENV === 'production' 
//   ? 'https://goal-tracker-tihi.onrender.com/api'
//   : 'http://127.0.0.1:5000/api';

// const GoalTrackerApp = () => {
//   const [currentUser, setCurrentUser] = useState(null);
//   const [showAuth, setShowAuth] = useState(true);
//   const [isLogin, setIsLogin] = useState(true);
  
//   // State management
//   const [tags, setTags] = useState([]);
//   const [monthlyGoals, setMonthlyGoals] = useState([]);
//   const [weeklyGoals, setWeeklyGoals] = useState([]);
//   const [dailyGoals, setDailyGoals] = useState([]);
//   const [habits, setHabits] = useState([]);
  
//   const [currentDate, setCurrentDate] = useState(new Date());
//   const [selectedDate, setSelectedDate] = useState(new Date());
//   const [viewMode, setViewMode] = useState('month');
  
//   // Modal states
//   const [showTagModal, setShowTagModal] = useState(false);
//   const [showGoalModal, setShowGoalModal] = useState(false);
//   const [showHabitModal, setShowHabitModal] = useState(false);
//   const [tagsExpanded, setTagsExpanded] = useState(true);
//   const [showHabitReport, setShowHabitReport] = useState(null);
//   const [goalType, setGoalType] = useState('monthly');
//   const [editingGoal, setEditingGoal] = useState(null);
//   const [editingTag, setEditingTag] = useState(null);
//   const [editingHabit, setEditingHabit] = useState(null);
  
//   // Mobile menu state
//   const [showMobileMenu, setShowMobileMenu] = useState(false);
  
//   // Form states
//   const [authForm, setAuthForm] = useState({ username: '', password: '' });
//   const [tagForm, setTagForm] = useState({ name: '', color: '#3b82f6' });
//   const [goalForm, setGoalForm] = useState({ title: '', tagId: '', parentId: '' });
//   const [habitForm, setHabitForm] = useState({ name: '', tagId: '' });

//   // System status
//   const [systemStatus, setSystemStatus] = useState({
//     backendLive: false,
//     connected: false,
//     databaseWorking: false,
//     changesSaved: false
//   });

//   // Weather and time
//   const [weather, setWeather] = useState(null);
//   const [currentTime, setCurrentTime] = useState(new Date());
//   const [location, setLocation] = useState(null);
//   const [locationName, setLocationName] = useState(null);
//   const [forecastData, setForecastData] = useState({});

//   // Health check function
//   const checkSystemHealth = async () => {
//     try {
//       const healthRes = await fetch(`${API_BASE.replace('/api', '')}/health`, {
//         method: 'GET',
//         signal: AbortSignal.timeout(3000)
//       }).catch(() => null);
      
//       const backendLive = healthRes && healthRes.ok;
      
//       const apiHealthRes = await fetch(`${API_BASE}/health`, {
//         method: 'GET',
//         signal: AbortSignal.timeout(3000)
//       }).catch(() => null);
      
//       const connected = apiHealthRes && apiHealthRes.ok;

//       let databaseWorking = false;
      
//       try {
//         const dbRes = await fetch(`${API_BASE}/database-check`, {
//           method: 'GET',
//           signal: AbortSignal.timeout(3000)
//         });
//         databaseWorking = dbRes.ok;
//       } catch (error) {
//         databaseWorking = false;
//       }

//       const changesSaved = backendLive && connected && databaseWorking;

//       setSystemStatus({
//         backendLive,
//         connected,
//         databaseWorking,
//         changesSaved
//       });
//     } catch (error) {
//       console.error('Health check error:', error);
//       setSystemStatus({
//         backendLive: false,
//         connected: false,
//         databaseWorking: false,
//         changesSaved: false
//       });
//     }
//   };

//   useEffect(() => {
//     let interval;
//     let inactivityTimer;
//     const INACTIVITY_TIMEOUT = 30000;
//     let lastCheckTime = 0;

//     const handleActivity = () => {
//       const now = Date.now();
//       if (now - lastCheckTime < 1000) return;
      
//       lastCheckTime = now;
//       clearTimeout(inactivityTimer);
//       clearInterval(interval);

//       checkSystemHealth();
//       interval = setInterval(checkSystemHealth, 10000);

//       inactivityTimer = setTimeout(() => {
//         clearInterval(interval);
//       }, INACTIVITY_TIMEOUT);
//     };

//     const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
//     events.forEach(event => {
//       document.addEventListener(event, handleActivity);
//     });

//     return () => {
//       clearInterval(interval);
//       clearTimeout(inactivityTimer);
//       events.forEach(event => {
//         document.removeEventListener(event, handleActivity);
//       });
//     };
//   }, [currentUser]);

//   const fetchWeather = async () => {
//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         async (position) => {
//           const { latitude, longitude } = position.coords;
//           setLocation({ latitude, longitude });
          
//           try {
//             const geoResponse = await fetch(
//               `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
//             );
//             const geoData = await geoResponse.json();
//             if (geoData.address) {
//               const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county;
//               setLocationName(city);
//             }
            
//             const response = await fetch(
//               `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
//             );
//             const data = await response.json();
            
//             if (data.current) {
//               setWeather({
//                 temp: Math.round(data.current.temperature_2m),
//                 weatherCode: data.current.weather_code,
//                 maxTemp: Math.round(data.daily.temperature_2m_max[0]),
//                 minTemp: Math.round(data.daily.temperature_2m_min[0])
//               });
//             }
            
//             if (data.daily) {
//               const forecast = {};
//               const today = new Date();
//               for (let i = 0; i < Math.min(10, data.daily.time.length); i++) {
//                 const date = new Date(today);
//                 date.setDate(date.getDate() + i);
//                 const dateStr = date.toISOString().split('T')[0];
//                 forecast[dateStr] = {
//                   maxTemp: Math.round(data.daily.temperature_2m_max[i]),
//                   minTemp: Math.round(data.daily.temperature_2m_min[i]),
//                   weatherCode: data.daily.weather_code[i]
//                 };
//               }
//               setForecastData(forecast);
//             }
//           } catch (error) {
//             console.error('Error fetching weather:', error);
//           }
//         },
//         (error) => {
//           console.error('Geolocation error:', error);
//         }
//       );
//     }
//   };

//   const getWeatherEmoji = (code) => {
//     if (code === 0 || code === 1) return '☀️';
//     if (code === 2) return '⛅';
//     if (code === 3) return '☁️';
//     if (code === 45 || code === 48) return '🌫️';
//     if (code >= 51 && code <= 67) return '🌧️';
//     if (code >= 71 && code <= 77) return '🌨️';
//     if (code === 80 || code === 81 || code === 82) return '🌧️';
//     if (code >= 85 && code <= 86) return '🌨️';
//     if (code >= 80 && code <= 82) return '⛈️';
//     return '🌤️';
//   };

//   useEffect(() => {
//     fetchWeather();
//   }, []);

//   useEffect(() => {
//     const timer = setInterval(() => {
//       setCurrentTime(new Date());
//     }, 1000);
//     return () => clearInterval(timer);
//   }, []);

//   useEffect(() => {
//     const savedUser = localStorage.getItem('goalTrackerUser');
//     if (savedUser) {
//       try {
//         const user = JSON.parse(savedUser);
//         setCurrentUser(user);
//         setShowAuth(false);
//       } catch (error) {
//         console.error('Error loading saved session:', error);
//         localStorage.removeItem('goalTrackerUser');
//       }
//     }
//   }, []);

//   useEffect(() => {
//     if (currentUser) {
//       loadData();
//     }
//   }, [currentUser]);

//   const loadData = async () => {
//     try {
//       const [tagsRes, monthlyRes, weeklyRes, dailyRes, habitsRes] = await Promise.all([
//         fetch(`${API_BASE}/tags/${currentUser.id}`),
//         fetch(`${API_BASE}/goals/monthly/${currentUser.id}`),
//         fetch(`${API_BASE}/goals/weekly/${currentUser.id}`),
//         fetch(`${API_BASE}/goals/daily/${currentUser.id}`),
//         fetch(`${API_BASE}/habits/${currentUser.id}`)
//       ]);

//       if (tagsRes.ok) setTags(await tagsRes.json());
//       if (monthlyRes.ok) setMonthlyGoals(await monthlyRes.json());
//       if (weeklyRes.ok) setWeeklyGoals(await weeklyRes.json());
//       if (dailyRes.ok) setDailyGoals(await dailyRes.json());
//       if (habitsRes.ok) setHabits(await habitsRes.json());
//     } catch (error) {
//       console.error('Error loading data:', error);
//     }
//   };

//   const handleAuth = async (e) => {
//     e.preventDefault();
//     try {
//       const endpoint = isLogin ? '/auth/login' : '/auth/signup';
//       const url = `${API_BASE}${endpoint}`;
      
//       const response = await fetch(url, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(authForm)
//       });
      
//       if (!response.ok) {
//         const errorText = await response.text();
//         console.error('Error response:', errorText);
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       if (data.success) {
//         setCurrentUser(data.user);
//         localStorage.setItem('goalTrackerUser', JSON.stringify(data.user));
//         setShowAuth(false);
//         setAuthForm({ username: '', password: '' });
//       } else {
//         alert(data.message || 'Authentication failed');
//       }
//     } catch (error) {
//       console.error('Auth error:', error);
//       alert(`Authentication error: ${error.message}`);
//     }
//   };

//   const handleLogout = () => {
//     setCurrentUser(null);
//     localStorage.removeItem('goalTrackerUser');
//     setShowAuth(true);
//     setAuthForm({ username: '', password: '' });
//   };

//   const handleSaveTag = async () => {
//     try {
//       if (!tagForm.name.trim()) {
//         alert('Tag name cannot be empty');
//         return;
//       }
//       const method = editingTag ? 'PUT' : 'POST';
//       const endpoint = editingTag ? `/tags/${editingTag.id}` : '/tags';
//       const body = {
//         name: tagForm.name,
//         color: tagForm.color,
//         ...(editingTag ? {} : { userId: currentUser.id })
//       };

//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method,
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       });

//       if (response.ok) {
//         await loadData();
//         setShowTagModal(false);
//         setTagForm({ name: '', color: '#3b82f6' });
//         setEditingTag(null);
//       } else {
//         alert('Failed to save tag');
//       }
//     } catch (error) {
//       console.error('Error saving tag:', error);
//       alert('Error saving tag');
//     }
//   };

//   const handleDeleteTag = async (tagId) => {
//     try {
//       const response = await fetch(`${API_BASE}/tags/${tagId}`, {
//         method: 'DELETE'
//       });

//       if (response.ok) {
//         await loadData();
//       } else {
//         alert('Failed to delete tag');
//       }
//     } catch (error) {
//       console.error('Error deleting tag:', error);
//       alert('Error deleting tag');
//     }
//   };

//   const handleSaveGoal = async () => {
//     try {
//       if (!goalForm.title.trim()) {
//         alert('Goal title cannot be empty');
//         return;
//       }
//       let endpoint, body;

//       if (goalType === 'monthly') {
//         endpoint = editingGoal ? `/goals/monthly/${editingGoal.id}` : '/goals/monthly';
//         body = {
//           title: goalForm.title,
//           tagId: goalForm.tagId,
//           month: currentDate.getMonth(),
//           year: currentDate.getFullYear(),
//           ...(editingGoal ? {} : { userId: currentUser.id })
//         };
//       } else if (goalType === 'weekly') {
//         const weekStart = getWeekStart(selectedDate);
//         const weekEnd = getWeekEnd(selectedDate);
//         const weekNumber = getISOWeekNumber(selectedDate);
//         const year = selectedDate.getFullYear();
//         endpoint = editingGoal ? `/goals/weekly/${editingGoal.id}` : '/goals/weekly';
//         body = {
//           title: goalForm.title,
//           tagId: goalForm.tagId,
//           parentId: goalForm.parentId || '',
//           weekStart,
//           weekEnd,
//           weekNumber,
//           year,
//           ...(editingGoal ? {} : { userId: currentUser.id })
//         };
//       } else {
//         endpoint = editingGoal ? `/goals/daily/${editingGoal.id}` : '/goals/daily';
//         body = {
//           title: goalForm.title,
//           tagId: goalForm.tagId,
//           parentId: goalForm.parentId || '',
//           date: selectedDate.toISOString().split('T')[0],
//           ...(editingGoal ? {} : { userId: currentUser.id })
//         };
//       }

//       const method = editingGoal ? 'PUT' : 'POST';
//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method,
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       });

//       if (response.ok) {
//         await loadData();
//         setShowGoalModal(false);
//         setGoalForm({ title: '', tagId: '', parentId: '' });
//         setEditingGoal(null);
//       } else {
//         alert('Failed to save goal');
//       }
//     } catch (error) {
//       console.error('Error saving goal:', error);
//       alert('Error saving goal');
//     }
//   };

//   const handleDeleteGoal = async (goalId, type) => {
//     try {
//       let endpoint;
//       if (type === 'monthly') {
//         endpoint = `/goals/monthly/${goalId}`;
//       } else if (type === 'weekly') {
//         endpoint = `/goals/weekly/${goalId}`;
//       } else {
//         endpoint = `/goals/daily/${goalId}`;
//       }

//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method: 'DELETE'
//       });

//       if (response.ok) {
//         await loadData();
//       } else {
//         alert('Failed to delete goal');
//       }
//     } catch (error) {
//       console.error('Error deleting goal:', error);
//       alert('Error deleting goal');
//     }
//   };

//   const handleToggleGoal = async (goalId, type, currentCompleted) => {
//     try {
//       let endpoint;
//       if (type === 'monthly') {
//         endpoint = `/goals/monthly/${goalId}`;
//       } else if (type === 'weekly') {
//         endpoint = `/goals/weekly/${goalId}`;
//       } else {
//         endpoint = `/goals/daily/${goalId}`;
//       }

//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ completed: !currentCompleted })
//       });

//       if (response.ok) {
//         await loadData();
//       } else {
//         alert('Failed to update goal');
//       }
//     } catch (error) {
//       console.error('Error updating goal:', error);
//       alert('Error updating goal');
//     }
//   };

//   const handleSaveHabit = async () => {
//     try {
//       if (!habitForm.name.trim()) {
//         alert('Habit name cannot be empty');
//         return;
//       }
//       const endpoint = editingHabit ? `/habits/${editingHabit.id}` : '/habits';
//       const body = {
//         name: habitForm.name,
//         tagId: habitForm.tagId,
//         ...(editingHabit ? {} : { userId: currentUser.id })
//       };

//       const method = editingHabit ? 'PUT' : 'POST';
//       const response = await fetch(`${API_BASE}${endpoint}`, {
//         method,
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body)
//       });

//       if (response.ok) {
//         await loadData();
//         setShowHabitModal(false);
//         setHabitForm({ name: '', tagId: '' });
//         setEditingHabit(null);
//       } else {
//         alert('Failed to save habit');
//       }
//     } catch (error) {
//       console.error('Error saving habit:', error);
//       alert('Error saving habit');
//     }
//   };

//   const handleToggleHabit = async (habitId) => {
//     try {
//       const today = new Date().toISOString().split('T')[0];
//       const response = await fetch(`${API_BASE}/habits/${habitId}/toggle/${today}`, {
//         method: 'POST'
//       });

//       if (response.ok) {
//         await loadData();
//       } else {
//         alert('Failed to toggle habit');
//       }
//     } catch (error) {
//       console.error('Error toggling habit:', error);
//       alert('Error toggling habit');
//     }
//   };

//   const handleDeleteHabit = async (habitId) => {
//     try {
//       const response = await fetch(`${API_BASE}/habits/${habitId}`, {
//         method: 'DELETE'
//       });

//       if (response.ok) {
//         await loadData();
//       } else {
//         alert('Failed to delete habit');
//       }
//     } catch (error) {
//       console.error('Error deleting habit:', error);
//       alert('Error deleting habit');
//     }
//   };

//   const getISOWeekNumber = (date) => {
//     const d = new Date(date);
//     d.setHours(0, 0, 0, 0);
//     d.setDate(d.getDate() + 4 - (d.getDay() || 7));
//     const yearStart = new Date(d.getFullYear(), 0, 1);
//     const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
//     return weekNum;
//   };

//   const getWeekStart = (date) => {
//     const d = new Date(date);
//     const day = d.getDay();
//     const diff = d.getDate() - day + (day === 0 ? -6 : 1);
//     return new Date(d.setDate(diff)).toISOString().split('T')[0];
//   };

//   const getWeekEnd = (date) => {
//     const start = new Date(getWeekStart(date));
//     return new Date(start.setDate(start.getDate() + 6)).toISOString().split('T')[0];
//   };

//   const getDaysInMonth = (date) => {
//     const year = date.getFullYear();
//     const month = date.getMonth();
//     const firstDay = new Date(year, month, 1);
//     const lastDay = new Date(year, month + 1, 0);
//     const daysInMonth = lastDay.getDate();
//     let startingDayOfWeek = firstDay.getDay();
    
//     startingDayOfWeek = (startingDayOfWeek + 6) % 7;
    
//     const days = [];
//     for (let i = 0; i < startingDayOfWeek; i++) {
//       days.push(null);
//     }
//     for (let i = 1; i <= daysInMonth; i++) {
//       days.push(new Date(year, month, i));
//     }
//     return days;
//   };

//   const getGoalsForDate = (date) => {
//     const dateStr = date.toISOString().split('T')[0];
//     return dailyGoals.filter(g => g.date === dateStr);
//   };

//   const getTagColor = (tagId) => {
//     const tag = tags.find(t => t.id === tagId);
//     return tag?.color || '#6b7280';
//   };

//   const getTagName = (tagId) => {
//     const tag = tags.find(t => t.id === tagId);
//     return tag?.name || 'No Tag';
//   };

//   const getGoalsForSelectedDate = () => {
//     const selectedMonth = selectedDate.getMonth();
//     const selectedYear = selectedDate.getFullYear();
//     const selectedWeek = getISOWeekNumber(selectedDate);
//     const selectedDateStr = selectedDate.toISOString().split('T')[0];

//     return {
//       monthly: monthlyGoals.filter(g => g.month === selectedMonth && g.year === selectedYear),
//       weekly: weeklyGoals.filter(g => {
//         return g.weekNumber === selectedWeek && g.year === selectedYear;
//       }),
//       daily: dailyGoals.filter(g => g.date === selectedDateStr)
//     };
//   };

//   const getMonthName = (monthIndex) => {
//     const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
//     return months[monthIndex];
//   };

//   const formatDateLabel = (dateString) => {
//     const date = new Date(dateString);
//     const day = date.getDate();
//     const month = date.toLocaleString('default', { month: 'short' });
//     const suffix = getDateSuffix(day);
//     return `${day}${suffix} ${month}`;
//   };

//   const getDateSuffix = (day) => {
//     if (day >= 11 && day <= 13) return 'th';
//     switch (day % 10) {
//       case 1: return 'st';
//       case 2: return 'nd';
//       case 3: return 'rd';
//       default: return 'th';
//     }
//   };

//   const getHabitStats = (habit) => {
//     const startDate = new Date(habit.startDate);
//     const today = new Date();
//     const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
//     const completedDays = habit.completedDates.length;
//     const missedDays = totalDays - completedDays;
    
//     return { totalDays, completedDays, missedDays };
//   };

//   const isToday = (date) => {
//     const today = new Date();
//     return date.toDateString() === today.toDateString();
//   };

//   // Auth Screen
//   if (showAuth) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex items-center justify-center p-4">
//         <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
//         <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>
        
//         <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 sm:p-8 w-full max-w-md border border-blue-500/20 shadow-2xl">
//           <div className="flex items-center gap-3 mb-8">
//             <div className="p-2.5 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-xl">
//               <Calendar className="w-8 h-8 text-blue-400" />
//             </div>
//             <div>
//               <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
//               <p className="text-xs text-gray-400 mt-0.5">Achieve your goals with confidence</p>
//             </div>
//           </div>
          
//           <div className="flex gap-2 mb-8 bg-gray-800/50 rounded-xl p-1.5">
//             <button
//               onClick={() => setIsLogin(true)}
//               className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm ${
//                 isLogin 
//                   ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' 
//                   : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
//               }`}
//             >
//               Login
//             </button>
//             <button
//               onClick={() => setIsLogin(false)}
//               className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-300 text-sm ${
//                 !isLogin 
//                   ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' 
//                   : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
//               }`}
//             >
//               Sign Up
//             </button>
//           </div>
          
//           <form onSubmit={handleAuth} className="space-y-5">
//             <div>
//               <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
//               <input
//                 type="text"
//                 value={authForm.username}
//                 onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
//                 className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm placeholder-gray-500"
//                 placeholder="Enter your username"
//                 required
//               />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
//               <input
//                 type="password"
//                 value={authForm.password}
//                 onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
//                 className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm placeholder-gray-500"
//                 placeholder="Enter your password"
//                 required
//               />
//             </div>
//             <button 
//               type="submit" 
//               className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] mt-6 text-sm"
//             >
//               {isLogin ? 'Login' : 'Create Account'}
//             </button>
//           </form>
          
//           <p className="text-center text-gray-400 text-sm mt-6">
//             {isLogin ? "Don't have an account? " : 'Already have an account? '}
//             <button
//               onClick={() => setIsLogin(!isLogin)}
//               className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
//             >
//               {isLogin ? 'Sign Up' : 'Login'}
//             </button>
//           </p>
//         </div>
//       </div>
//     );
//   }

//   // Main App
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
//       {/* Header */}
//       <div className="bg-gradient-to-r from-gray-900/95 via-gray-900/90 to-gray-900/95 border-b border-blue-500/20 backdrop-blur-xl p-3 sm:p-4 sticky top-0 z-50 shadow-xl">
//         <div className="w-full flex items-center justify-between gap-3">
//           <div className="flex items-center gap-3">
//             {/* Mobile Menu Button */}
//             <button
//               onClick={() => setShowMobileMenu(!showMobileMenu)}
//               className="lg:hidden p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
//             >
//               <Menu className="w-5 h-5 text-blue-400" />
//             </button>
            
//             <div className="flex items-center gap-2 sm:gap-3">
//               <div className="p-2 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-xl">
//                 <Calendar className="w-5 sm:w-6 h-5 sm:h-6 text-blue-400" />
//               </div>
//               <div className="hidden sm:block">
//                 <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Goal Tracker</h1>
//               </div>
//             </div>
//           </div>
          
//           <div className="flex items-center gap-2 sm:gap-4">
//             {/* Status Pill - Hidden on small screens */}
//             <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800/60 border border-blue-500/20 backdrop-blur text-xs">
//               <div className={`w-2 h-2 rounded-full animate-pulse ${
//                 systemStatus.changesSaved ? 'bg-green-500' : 'bg-red-500'
//               }`}></div>
//               <span className="text-gray-300 font-medium hidden lg:inline">
//                 {systemStatus.changesSaved ? 'Online' : 'Offline'}
//               </span>
//             </div>

//             {/* Weather - Hidden on mobile */}
//             {weather && (
//               <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-blue-900/40 to-gray-800/40 border border-blue-500/20 backdrop-blur">
//                 <div className="text-xl">{getWeatherEmoji(weather.weatherCode)}</div>
//                 <div className="flex flex-col gap-0.5">
//                   <div className="font-bold text-blue-300 text-sm">{weather.temp}°C</div>
//                   <div className="text-gray-400 text-xs">{weather.minTemp}° - {weather.maxTemp}°</div>
//                 </div>
//               </div>
//             )}
            
//             {/* Time and User - Simplified on mobile */}
//             <div className="flex flex-col items-end gap-0.5">
//               <div className="font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent text-sm">
//                 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
//               </div>
//               <div className="text-gray-400 text-xs hidden sm:block">Hi, {currentUser.username}</div>
//             </div>
            
//             <button
//               onClick={handleLogout}
//               className="text-xs sm:text-sm bg-gradient-to-r from-red-600/90 to-red-700/90 hover:from-red-600 hover:to-red-700 px-3 py-2 rounded-xl font-semibold transition-all shadow-lg"
//             >
//               Logout
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Mobile Sidebar Overlay */}
//       {showMobileMenu && (
//         <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowMobileMenu(false)}>
//           <div className="w-80 max-w-[85vw] h-full bg-gradient-to-b from-gray-900 to-gray-950 border-r border-blue-500/20 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
//             <div className="p-4 space-y-4">
//               {/* Tags Section */}
//               <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10 backdrop-blur">
//                 <div className="flex items-center justify-between p-4">
//                   <button
//                     onClick={() => setTagsExpanded(!tagsExpanded)}
//                     className="flex items-center gap-2 flex-1"
//                   >
//                     <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${tagsExpanded ? 'rotate-0' : '-rotate-90'}`} />
//                     <div className="flex items-center gap-2">
//                       <div className="p-1.5 bg-yellow-600/20 rounded-lg">
//                         <Tag className="w-4 h-4 text-yellow-400" />
//                       </div>
//                       <h2 className="font-semibold text-gray-100">Tags</h2>
//                     </div>
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowTagModal(true);
//                       setEditingTag(null);
//                       setTagForm({ name: '', color: '#3b82f6' });
//                       setShowMobileMenu(false);
//                     }}
//                     className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
//                   >
//                     <Plus className="w-4 h-4 text-blue-400" />
//                   </button>
//                 </div>
//                 {tagsExpanded && (
//                   <div className="px-4 pb-4 border-t border-gray-800/50">
//                     {tags.length === 0 ? (
//                       <p className="text-sm text-gray-500 pt-3">No tags yet</p>
//                     ) : (
//                       <div className="space-y-2 pt-3">
//                         {tags.map(tag => (
//                           <div key={tag.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors">
//                             <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: tag.color }} />
//                             <span className="flex-1 text-sm text-gray-300">{tag.name}</span>
//                             <button
//                               onClick={() => {
//                                 setEditingTag(tag);
//                                 setTagForm(tag);
//                                 setShowTagModal(true);
//                                 setShowMobileMenu(false);
//                               }}
//                               className="p-1.5 hover:bg-blue-600/20 rounded-lg transition-colors"
//                             >
//                               <Edit2 className="w-3.5 h-3.5 text-blue-400" />
//                             </button>
//                             <button
//                               onClick={() => handleDeleteTag(tag.id)}
//                               className="p-1.5 hover:bg-red-600/20 rounded-lg transition-colors text-red-400"
//                             >
//                               <Trash2 className="w-3.5 h-3.5" />
//                             </button>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                 )}
//               </div>

//               {/* Monthly Goals in Mobile */}
//               <GoalSection
//                 title="Monthly Goals"
//                 goals={getGoalsForSelectedDate().monthly}
//                 type="monthly"
//                 onAdd={() => {
//                   setGoalType('monthly');
//                   setShowGoalModal(true);
//                   setEditingGoal(null);
//                   setGoalForm({ title: '', tagId: '', parentId: '' });
//                   setShowMobileMenu(false);
//                 }}
//                 onEdit={(goal) => {
//                   setEditingGoal(goal);
//                   setGoalType('monthly');
//                   setGoalForm(goal);
//                   setShowGoalModal(true);
//                   setShowMobileMenu(false);
//                 }}
//                 onDelete={(id) => handleDeleteGoal(id, 'monthly')}
//                 onToggle={(id, completed) => handleToggleGoal(id, 'monthly', completed)}
//                 getTagColor={getTagColor}
//                 getTagName={getTagName}
//                 getMonthName={getMonthName}
//               />

//               {/* Weekly Goals in Mobile */}
//               <GoalSection
//                 title="Weekly Goals"
//                 goals={getGoalsForSelectedDate().weekly}
//                 type="weekly"
//                 onAdd={() => {
//                   setGoalType('weekly');
//                   setShowGoalModal(true);
//                   setEditingGoal(null);
//                   setGoalForm({ title: '', tagId: '', parentId: '' });
//                   setShowMobileMenu(false);
//                 }}
//                 onEdit={(goal) => {
//                   setEditingGoal(goal);
//                   setGoalType('weekly');
//                   setGoalForm(goal);
//                   setShowGoalModal(true);
//                   setShowMobileMenu(false);
//                 }}
//                 onDelete={(id) => handleDeleteGoal(id, 'weekly')}
//                 onToggle={(id, completed) => handleToggleGoal(id, 'weekly', completed)}
//                 getTagColor={getTagColor}
//                 getTagName={getTagName}
//               />

//               {/* Habits in Mobile */}
//               <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className="flex items-center gap-2">
//                     <div className="p-1.5 bg-green-600/20 rounded-lg">
//                       <Check className="w-4 h-4 text-green-400" />
//                     </div>
//                     <h2 className="font-semibold">Habits</h2>
//                   </div>
//                   <button
//                     onClick={() => {
//                       setShowHabitModal(true);
//                       setEditingHabit(null);
//                       setHabitForm({ name: '', tagId: '' });
//                       setShowMobileMenu(false);
//                     }}
//                     className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
//                   >
//                     <Plus className="w-4 h-4 text-blue-400" />
//                   </button>
//                 </div>
//                 {habits.length === 0 ? (
//                   <p className="text-sm text-gray-500">No habits yet</p>
//                 ) : (
//                   <div className="space-y-3">
//                     {habits.map(habit => {
//                       const today = new Date().toISOString().split('T')[0];
//                       const isCompleted = habit.completedDates.includes(today);
//                       const last7Days = Array.from({ length: 7 }, (_, i) => {
//                         const d = new Date();
//                         d.setDate(d.getDate() - (6 - i));
//                         return d.toISOString().split('T')[0];
//                       });
                      
//                       return (
//                         <div key={habit.id} className="space-y-2">
//                           <div className="flex items-center gap-2">
//                             <span className="flex-1 text-sm">{habit.name}</span>
//                             <button
//                               onClick={() => {
//                                 setShowHabitReport(habit);
//                                 setShowMobileMenu(false);
//                               }}
//                               className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
//                             >
//                               <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
//                             </button>
//                             <button
//                               onClick={() => {
//                                 setEditingHabit(habit);
//                                 setHabitForm({ name: habit.name, tagId: habit.tagId });
//                                 setShowHabitModal(true);
//                                 setShowMobileMenu(false);
//                               }}
//                               className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
//                             >
//                               <Edit2 className="w-3.5 h-3.5 text-blue-400" />
//                             </button>
//                             <button
//                               onClick={() => handleDeleteHabit(habit.id)}
//                               className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors text-red-400"
//                             >
//                               <Trash2 className="w-3.5 h-3.5" />
//                             </button>
//                           </div>
//                           <div className="flex gap-1">
//                             {last7Days.map((date, idx) => {
//                               const isDateCompleted = habit.completedDates.includes(date);
//                               const isDateToday = date === today;
//                               return (
//                                 <button
//                                   key={idx}
//                                   onClick={() => isDateToday && handleToggleHabit(habit.id)}
//                                   disabled={!isDateToday}
//                                   className={`flex-1 h-8 rounded-lg transition-all ${
//                                     isDateCompleted
//                                       ? 'bg-gradient-to-br from-green-600 to-green-700 shadow-md'
//                                       : isDateToday
//                                       ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600'
//                                       : 'bg-gray-800/50'
//                                   } ${!isDateToday && 'cursor-default'}`}
//                                 >
//                                   {isDateCompleted && <Check className="w-4 h-4 mx-auto" />}
//                                 </button>
//                               );
//                             })}
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 )}
//               </div>

//               {/* Daily Goals in Mobile */}
//               <GoalSection
//                 title="Daily Goals"
//                 goals={getGoalsForSelectedDate().daily}
//                 type="daily"
//                 onAdd={() => {
//                   setGoalType('daily');
//                   setShowGoalModal(true);
//                   setEditingGoal(null);
//                   setGoalForm({ title: '', tagId: '', parentId: '' });
//                   setShowMobileMenu(false);
//                 }}
//                 onEdit={(goal) => {
//                   setEditingGoal(goal);
//                   setGoalType('daily');
//                   setGoalForm(goal);
//                   setShowGoalModal(true);
//                   setShowMobileMenu(false);
//                 }}
//                 onDelete={(id) => handleDeleteGoal(id, 'daily')}
//                 onToggle={(id, completed) => handleToggleGoal(id, 'daily', completed)}
//                 getTagColor={getTagColor}
//                 getTagName={getTagName}
//                 formatDateLabel={formatDateLabel}
//               />
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="max-w-full mx-auto p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
//         {/* Left Sidebar - Desktop Only */}
//         <div className="hidden lg:block w-80 space-y-4">
//           {/* Tags */}
//           <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10 backdrop-blur shadow-xl">
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setTagsExpanded(!tagsExpanded)}
//                 className="flex items-center gap-2 flex-1"
//               >
//                 <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${tagsExpanded ? 'rotate-0' : '-rotate-90'}`} />
//                 <div className="flex items-center gap-2">
//                   <div className="p-1.5 bg-yellow-600/20 rounded-lg">
//                     <Tag className="w-4 h-4 text-yellow-400" />
//                   </div>
//                   <h2 className="font-semibold text-gray-100">Tags</h2>
//                 </div>
//               </button>
//               <button
//                 onClick={() => {
//                   setShowTagModal(true);
//                   setEditingTag(null);
//                   setTagForm({ name: '', color: '#3b82f6' });
//                 }}
//                 className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
//               >
//                 <Plus className="w-4 h-4 text-blue-400" />
//               </button>
//             </div>
//             {tagsExpanded && (
//               <div className="px-4 pb-4 border-t border-gray-800/50">
//                 {tags.length === 0 ? (
//                   <p className="text-sm text-gray-500 pt-3">No tags yet</p>
//                 ) : (
//                   <div className="space-y-2 pt-3">
//                     {tags.map(tag => (
//                       <div key={tag.id} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors">
//                         <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: tag.color }} />
//                         <span className="flex-1 text-sm text-gray-300">{tag.name}</span>
//                         <button
//                           onClick={() => {
//                             setEditingTag(tag);
//                             setTagForm(tag);
//                             setShowTagModal(true);
//                           }}
//                           className="p-1.5 hover:bg-blue-600/20 rounded-lg transition-colors"
//                         >
//                           <Edit2 className="w-3.5 h-3.5 text-blue-400" />
//                         </button>
//                         <button
//                           onClick={() => handleDeleteTag(tag.id)}
//                           className="p-1.5 hover:bg-red-600/20 rounded-lg transition-colors text-red-400"
//                         >
//                           <Trash2 className="w-3.5 h-3.5" />
//                         </button>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Monthly Goals */}
//           <GoalSection
//             title="Monthly Goals"
//             goals={getGoalsForSelectedDate().monthly}
//             type="monthly"
//             onAdd={() => {
//               setGoalType('monthly');
//               setShowGoalModal(true);
//               setEditingGoal(null);
//               setGoalForm({ title: '', tagId: '', parentId: '' });
//             }}
//             onEdit={(goal) => {
//               setEditingGoal(goal);
//               setGoalType('monthly');
//               setGoalForm(goal);
//               setShowGoalModal(true);
//             }}
//             onDelete={(id) => handleDeleteGoal(id, 'monthly')}
//             onToggle={(id, completed) => handleToggleGoal(id, 'monthly', completed)}
//             getTagColor={getTagColor}
//             getTagName={getTagName}
//             getMonthName={getMonthName}
//           />

//           {/* Weekly Goals */}
//           <GoalSection
//             title="Weekly Goals"
//             goals={getGoalsForSelectedDate().weekly}
//             type="weekly"
//             onAdd={() => {
//               setGoalType('weekly');
//               setShowGoalModal(true);
//               setEditingGoal(null);
//               setGoalForm({ title: '', tagId: '', parentId: '' });
//             }}
//             onEdit={(goal) => {
//               setEditingGoal(goal);
//               setGoalType('weekly');
//               setGoalForm(goal);
//               setShowGoalModal(true);
//             }}
//             onDelete={(id) => handleDeleteGoal(id, 'weekly')}
//             onToggle={(id, completed) => handleToggleGoal(id, 'weekly', completed)}
//             getTagColor={getTagColor}
//             getTagName={getTagName}
//           />
//         </div>

//         {/* Middle Column - Habits and Daily Goals (Desktop Only) */}
//         <div className="hidden lg:block w-80 space-y-4">
//           {/* Habit Tracker */}
//           <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10 shadow-xl">
//             <div className="flex items-center justify-between mb-3">
//               <div className="flex items-center gap-2">
//                 <div className="p-1.5 bg-green-600/20 rounded-lg">
//                   <Check className="w-4 h-4 text-green-400" />
//                 </div>
//                 <h2 className="font-semibold">Habits</h2>
//               </div>
//               <button
//                 onClick={() => {
//                   setShowHabitModal(true);
//                   setEditingHabit(null);
//                   setHabitForm({ name: '', tagId: '' });
//                 }}
//                 className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
//               >
//                 <Plus className="w-4 h-4 text-blue-400" />
//               </button>
//             </div>
//             {habits.length === 0 ? (
//               <p className="text-sm text-gray-500">No habits yet</p>
//             ) : (
//               <div className="space-y-3">
//                 {habits.map(habit => {
//                   const today = new Date().toISOString().split('T')[0];
//                   const isCompleted = habit.completedDates.includes(today);
//                   const last7Days = Array.from({ length: 7 }, (_, i) => {
//                     const d = new Date();
//                     d.setDate(d.getDate() - (6 - i));
//                     return d.toISOString().split('T')[0];
//                   });
                  
//                   return (
//                     <div key={habit.id} className="space-y-2">
//                       <div className="flex items-center gap-2">
//                         <span className="flex-1 text-sm">{habit.name}</span>
//                         <button
//                           onClick={() => setShowHabitReport(habit)}
//                           className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
//                         >
//                           <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
//                         </button>
//                         <button
//                           onClick={() => {
//                             setEditingHabit(habit);
//                             setHabitForm({ name: habit.name, tagId: habit.tagId });
//                             setShowHabitModal(true);
//                           }}
//                           className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
//                         >
//                           <Edit2 className="w-3.5 h-3.5 text-blue-400" />
//                         </button>
//                         <button
//                           onClick={() => handleDeleteHabit(habit.id)}
//                           className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors text-red-400"
//                         >
//                           <Trash2 className="w-3.5 h-3.5" />
//                         </button>
//                       </div>
//                       <div className="flex gap-1">
//                         {last7Days.map((date, idx) => {
//                           const isDateCompleted = habit.completedDates.includes(date);
//                           const isDateToday = date === today;
//                           return (
//                             <button
//                               key={idx}
//                               onClick={() => isDateToday && handleToggleHabit(habit.id)}
//                               disabled={!isDateToday}
//                               className={`flex-1 h-8 rounded-lg transition-all ${
//                                 isDateCompleted
//                                   ? 'bg-gradient-to-br from-green-600 to-green-700 shadow-md'
//                                   : isDateToday
//                                   ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600'
//                                   : 'bg-gray-800/50'
//                               } ${!isDateToday && 'cursor-default'}`}
//                             >
//                               {isDateCompleted && <Check className="w-4 h-4 mx-auto" />}
//                             </button>
//                           );
//                         })}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </div>

//           {/* Daily Goals */}
//           <GoalSection
//             title="Daily Goals"
//             goals={getGoalsForSelectedDate().daily}
//             type="daily"
//             onAdd={() => {
//               setGoalType('daily');
//               setShowGoalModal(true);
//               setEditingGoal(null);
//               setGoalForm({ title: '', tagId: '', parentId: '' });
//             }}
//             onEdit={(goal) => {
//               setEditingGoal(goal);
//               setGoalType('daily');
//               setGoalForm(goal);
//               setShowGoalModal(true);
//             }}
//             onDelete={(id) => handleDeleteGoal(id, 'daily')}
//             onToggle={(id, completed) => handleToggleGoal(id, 'daily', completed)}
//             getTagColor={getTagColor}
//             getTagName={getTagName}
//             formatDateLabel={formatDateLabel}
//           />
//         </div>

//         {/* Calendar - Full width on mobile */}
//         <div className="w-full lg:flex-1 bg-gradient-to-br from-gray-900/80 to-gray-900/60 rounded-xl p-3 sm:p-4 border border-blue-500/10 shadow-xl">
//           <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
//             <h2 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
//               {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
//             </h2>
//             <div className="flex gap-2">
//               <button
//                 onClick={() => {
//                   const d = new Date(currentDate);
//                   d.setMonth(d.getMonth() - 1);
//                   setCurrentDate(d);
//                 }}
//                 className="p-2 sm:px-3 sm:py-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-lg transition-all"
//               >
//                 <ChevronLeft className="w-4 h-4" />
//               </button>
//               <button
//                 onClick={() => setCurrentDate(new Date())}
//                 className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-sm font-medium transition-all shadow-lg"
//               >
//                 Today
//               </button>
//               <button
//                 onClick={() => {
//                   const d = new Date(currentDate);
//                   d.setMonth(d.getMonth() + 1);
//                   setCurrentDate(d);
//                 }}
//                 className="p-2 sm:px-3 sm:py-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-lg transition-all"
//               >
//                 <ChevronRight className="w-4 h-4" />
//               </button>
//             </div>
//           </div>

//           <div className="overflow-x-auto">
//             <div className="min-w-[600px]">
//               <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(80px, 100px) repeat(7, 1fr)' }}>
//                 <div className="text-center text-xs text-gray-500 py-2 font-semibold">Week</div>
//                 {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
//                   <div key={day} className="text-center text-xs text-gray-400 py-2 font-medium">
//                     {day}
//                   </div>
//                 ))}
                
//                 {(() => {
//                   const daysInMonth = getDaysInMonth(currentDate);
//                   const rows = [];
//                   let currentWeek = [];
//                   let weekNum = null;

//                   for (let i = 0; i < daysInMonth.length; i++) {
//                     const day = daysInMonth[i];
                    
//                     if (day && weekNum === null) {
//                       weekNum = getISOWeekNumber(day);
//                     }
                    
//                     currentWeek.push(day);
                    
//                     if (currentWeek.length === 7) {
//                       rows.push({ days: currentWeek, weekNum });
//                       currentWeek = [];
//                       weekNum = null;
//                     }
//                   }
                  
//                   if (currentWeek.length > 0) {
//                     rows.push({ days: currentWeek, weekNum });
//                   }

//                   return rows.map((row, rowIdx) => (
//                     <React.Fragment key={`week-${rowIdx}`}>
//                       <div className="min-h-24 p-2 rounded-lg border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 flex flex-col items-center justify-start overflow-y-auto backdrop-blur">
//                         <div className="text-center font-semibold text-sm text-purple-400 mb-2">
//                           W{row.weekNum}
//                         </div>
//                         <div className="flex flex-col gap-0.5 w-full">
//                           {(() => {
//                             const weekGoals = weeklyGoals.filter(g => g.weekNumber === row.weekNum && g.year === currentDate.getFullYear());
//                             let textSize = 'text-xs';
//                             let goalLimit = 8;
//                             if (weekGoals.length > 5) {
//                               textSize = 'text-[10px]';
//                             }
//                             return (
//                               <>
//                                 {weekGoals.slice(0, goalLimit).map(goal => (
//                                   <div
//                                     key={goal.id}
//                                     className={`${textSize} px-1.5 py-1 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity shadow-sm ${goal.completed ? 'line-through opacity-50' : ''}`}
//                                     style={{ backgroundColor: getTagColor(goal.tagId) }}
//                                     title={goal.title}
//                                   >
//                                     {goal.title}
//                                   </div>
//                                 ))}
//                                 {weekGoals.length > goalLimit && (
//                                   <div className="text-[9px] text-gray-400 text-center mt-1">+{weekGoals.length - goalLimit}</div>
//                                 )}
//                               </>
//                             );
//                           })()}
//                         </div>
//                       </div>
//                       {row.days.map((day, dayIdx) => {
//                         if (!day) return <div key={`empty-${rowIdx}-${dayIdx}`} />;
                        
//                         const goalsForDay = getGoalsForDate(day);
//                         const dayIsToday = isToday(day);
//                         const dateStr = day.toISOString().split('T')[0];
//                         const dayForecast = forecastData[dateStr];
                        
//                         let textSize = 'text-xs';
//                         let goalLimit = 8;
//                         if (goalsForDay.length > 5) {
//                           textSize = 'text-[10px]';
//                         }
                        
//                         return (
//                           <div
//                             key={`${rowIdx}-${dayIdx}`}
//                             onClick={() => setSelectedDate(day)}
//                             className={`min-h-24 p-2 rounded-lg border cursor-pointer overflow-y-auto transition-all backdrop-blur ${
//                               dayIsToday
//                                 ? 'border-blue-500 bg-gradient-to-br from-blue-950/50 to-blue-900/30 shadow-lg shadow-blue-500/20'
//                                 : day.toDateString() === selectedDate.toDateString()
//                                 ? 'border-blue-400/60 bg-gradient-to-br from-gray-800/60 to-gray-900/60'
//                                 : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 hover:bg-gray-800/60'
//                             }`}
//                           >
//                             <div className="flex items-center justify-between mb-1">
//                               <div className={`text-sm font-medium ${dayIsToday ? 'text-blue-400' : 'text-gray-300'}`}>
//                                 {day.getDate()}
//                               </div>
//                               {dayForecast && (
//                                 <div className="flex items-center gap-0.5">
//                                   <div className="text-base">{getWeatherEmoji(dayForecast.weatherCode)}</div>
//                                   <div className="text-[7px] text-gray-400 leading-none">
//                                     <div>{dayForecast.maxTemp}°</div>
//                                     <div>{dayForecast.minTemp}°</div>
//                                   </div>
//                                 </div>
//                               )}
//                             </div>
//                             <div className="space-y-0.5">
//                               {goalsForDay.slice(0, goalLimit).map(goal => (
//                                 <div
//                                   key={goal.id}
//                                   className={`${textSize} px-1.5 py-1 rounded truncate shadow-sm ${goal.completed ? 'line-through opacity-50' : ''}`}
//                                   style={{ backgroundColor: getTagColor(goal.tagId) }}
//                                   title={goal.title}
//                                 >
//                                   {goal.title}
//                                 </div>
//                               ))}
//                               {goalsForDay.length > goalLimit && (
//                                 <div className="text-[9px] text-gray-400 text-center mt-1">+{goalsForDay.length - goalLimit}</div>
//                               )}
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </React.Fragment>
//                   ));
//                 })()}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Tag Modal */}
//       {showTagModal && (
//         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
//           <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20 shadow-2xl animate-slideUp">
//             <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
//               {editingTag ? 'Edit Tag' : 'New Tag'}
//             </h3>
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Tag Name</label>
//                 <input
//                   type="text"
//                   value={tagForm.name}
//                   onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
//                   className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm placeholder-gray-500"
//                   placeholder="Enter tag name"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Color</label>
//                 <input
//                   type="color"
//                   value={tagForm.color}
//                   onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
//                   className="w-full h-12 bg-gray-800/60 rounded-xl border border-gray-700/50 cursor-pointer"
//                 />
//               </div>
//               <div className="flex gap-3 pt-2">
//                 <button
//                   onClick={handleSaveTag}
//                   className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all shadow-lg"
//                 >
//                   Save
//                 </button>
//                 <button
//                   onClick={() => {
//                     setShowTagModal(false);
//                     setEditingTag(null);
//                     setTagForm({ name: '', color: '#3b82f6' });
//                   }}
//                   className="flex-1 bg-gray-800/60 hover:bg-gray-700/60 text-white py-3 rounded-xl font-semibold transition-all"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Goal Modal */}
//       {showGoalModal && (
//         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
//           <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20 shadow-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
//             <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
//               {editingGoal ? 'Edit' : 'New'} {goalType.charAt(0).toUpperCase() + goalType.slice(1)} Goal
//             </h3>
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Title</label>
//                 <input
//                   type="text"
//                   value={goalForm.title}
//                   onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
//                   className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm placeholder-gray-500"
//                   placeholder="Enter goal title"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Tag</label>
//                 <select
//                   value={goalForm.tagId}
//                   onChange={(e) => setGoalForm({ ...goalForm, tagId: e.target.value })}
//                   className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm"
//                 >
//                   <option value="">Select a tag</option>
//                   {tags.map(tag => (
//                     <option key={tag.id} value={tag.id}>{tag.name}</option>
//                   ))}
//                 </select>
//               </div>
//               {(goalType === 'weekly' || goalType === 'daily') && (
//                 <div>
//                   <label className="block text-sm text-gray-300 mb-2 font-medium">Parent Goal (Optional)</label>
//                   <select
//                     value={goalForm.parentId}
//                     onChange={(e) => setGoalForm({ ...goalForm, parentId: e.target.value })}
//                     className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm"
//                   >
//                     <option value="">Independent</option>
//                     {goalType === 'daily' && (() => {
//                       const selectedWeek = getISOWeekNumber(selectedDate);
//                       const selectedYear = selectedDate.getFullYear();
//                       return weeklyGoals
//                         .filter(goal => goal.weekNumber === selectedWeek && goal.year === selectedYear)
//                         .map(goal => (
//                           <option key={goal.id} value={goal.id}>{goal.title} (Weekly)</option>
//                         ));
//                     })()}
//                     {goalType === 'weekly' && (() => {
//                       const selectedMonth = selectedDate.getMonth();
//                       const selectedYear = selectedDate.getFullYear();
//                       return monthlyGoals
//                         .filter(goal => goal.month === selectedMonth && goal.year === selectedYear)
//                         .map(goal => (
//                           <option key={goal.id} value={goal.id}>{goal.title} (Monthly)</option>
//                         ));
//                     })()}
//                   </select>
//                 </div>
//               )}
//               <div className="flex gap-3 pt-2">
//                 <button
//                   onClick={handleSaveGoal}
//                   className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all shadow-lg"
//                 >
//                   Save
//                 </button>
//                 <button
//                   onClick={() => {
//                     setShowGoalModal(false);
//                     setEditingGoal(null);
//                     setGoalForm({ title: '', tagId: '', parentId: '' });
//                   }}
//                   className="flex-1 bg-gray-800/60 hover:bg-gray-700/60 text-white py-3 rounded-xl font-semibold transition-all"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Habit Modal */}
//       {showHabitModal && (
//         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
//           <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20 shadow-2xl animate-slideUp">
//             <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
//               {editingHabit ? 'Edit Habit' : 'New Habit'}
//             </h3>
//             <div className="space-y-4">
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Habit Name</label>
//                 <input
//                   type="text"
//                   value={habitForm.name}
//                   onChange={(e) => setHabitForm({ ...habitForm, name: e.target.value })}
//                   className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm placeholder-gray-500"
//                   placeholder="Enter habit name"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm text-gray-300 mb-2 font-medium">Tag</label>
//                 <select
//                   value={habitForm.tagId}
//                   onChange={(e) => setHabitForm({ ...habitForm, tagId: e.target.value })}
//                   className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm"
//                 >
//                   <option value="">Select a tag</option>
//                   {tags.map(tag => (
//                     <option key={tag.id} value={tag.id}>{tag.name}</option>
//                   ))}
//                 </select>
//               </div>
//               <div className="flex gap-3 pt-2">
//                 <button
//                   onClick={handleSaveHabit}
//                   className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all shadow-lg"
//                 >
//                   Save
//                 </button>
//                 <button
//                   onClick={() => {
//                     setShowHabitModal(false);
//                     setEditingHabit(null);
//                     setHabitForm({ name: '', tagId: '' });
//                   }}
//                   className="flex-1 bg-gray-800/60 hover:bg-gray-700/60 text-white py-3 rounded-xl font-semibold transition-all"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Habit Report Modal */}
//       {showHabitReport && (
//         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
//           <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-6xl border border-blue-500/20 shadow-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
//             <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
//               Habit Report: {showHabitReport.name}
//             </h3>
//             <div className="space-y-5">
//               {(() => {
//                 const stats = getHabitStats(showHabitReport);
                
//                 let currentStreak = 0;
//                 const today = new Date();
//                 for (let i = 0; i < 365; i++) {
//                   const d = new Date(today);
//                   d.setDate(d.getDate() - i);
//                   const dateStr = d.toISOString().split('T')[0];
//                   if (showHabitReport.completedDates.includes(dateStr)) {
//                     currentStreak++;
//                   } else {
//                     break;
//                   }
//                 }
                
//                 const last365Days = [];
//                 for (let i = 364; i >= 0; i--) {
//                   const d = new Date(today);
//                   d.setDate(d.getDate() - i);
//                   last365Days.push(d.toISOString().split('T')[0]);
//                 }
                
//                 const weeks = [];
//                 for (let i = 0; i < last365Days.length; i += 7) {
//                   weeks.push(last365Days.slice(i, i + 7));
//                 }
                
//                 return (
//                   <>
//                     <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
//                       <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/30 rounded-xl p-4 border border-orange-700/30">
//                         <div className="text-xs text-gray-400 mb-1">Current Streak</div>
//                         <div className="text-3xl font-bold text-orange-400">{currentStreak}</div>
//                         <div className="text-xs text-gray-500 mt-1">days</div>
//                       </div>
//                       <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-gray-700/30">
//                         <div className="text-xs text-gray-400 mb-1">Total Days</div>
//                         <div className="text-2xl font-bold text-blue-400">{stats.totalDays}</div>
//                       </div>
//                       <div className="bg-gradient-to-br from-green-900/40 to-green-800/30 rounded-xl p-4 border border-green-700/30">
//                         <div className="text-xs text-gray-400 mb-1">Completed</div>
//                         <div className="text-2xl font-bold text-green-400">{stats.completedDays}</div>
//                       </div>
//                       <div className="bg-gradient-to-br from-red-900/40 to-red-800/30 rounded-xl p-4 border border-red-700/30">
//                         <div className="text-xs text-gray-400 mb-1">Missed</div>
//                         <div className="text-2xl font-bold text-red-400">{stats.missedDays}</div>
//                       </div>
//                       <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-gray-700/30">
//                         <div className="text-xs text-gray-400 mb-1">Rate</div>
//                         <div className="text-2xl font-bold text-purple-400">
//                           {stats.totalDays > 0 ? Math.round((stats.completedDays / stats.totalDays) * 100) : 0}%
//                         </div>
//                       </div>
//                     </div>
                    
//                     <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
//                       <div className="text-sm text-gray-400 mb-4 font-medium">Last 52 Weeks</div>
//                       <div className="flex gap-1 overflow-x-auto pb-2">
//                         {weeks.map((week, weekIdx) => (
//                           <div key={weekIdx} className="flex flex-col gap-1 flex-shrink-0">
//                             {week.map((date, dayIdx) => {
//                               const isCompleted = showHabitReport.completedDates.includes(date);
//                               const isCurrentDay = date === new Date().toISOString().split('T')[0];
//                               return (
//                                 <div
//                                   key={date}
//                                   className={`w-3.5 h-3.5 rounded-sm cursor-pointer transition-all hover:scale-110 ${
//                                     isCompleted
//                                       ? 'bg-green-500 shadow-md shadow-green-500/30'
//                                       : 'bg-gray-700/50'
//                                   } ${isCurrentDay ? 'ring-2 ring-blue-400' : ''}`}
//                                   title={`${date}: ${isCompleted ? 'Completed' : 'Missed'}`}
//                                 />
//                               );
//                             })}
//                           </div>
//                         ))}
//                       </div>
//                       <div className="text-xs text-gray-500 mt-4 flex items-center gap-3">
//                         <span>Less</span>
//                         <div className="flex gap-1.5">
//                           <div className="w-4 h-4 rounded-sm bg-gray-700/50"></div>
//                           <div className="w-4 h-4 rounded-sm bg-green-400/60"></div>
//                           <div className="w-4 h-4 rounded-sm bg-green-500"></div>
//                         </div>
//                         <span>More</span>
//                       </div>
//                     </div>
//                   </>
//                 );
//               })()}
//               <button
//                 onClick={() => setShowHabitReport(null)}
//                 className="w-full bg-gray-800/60 hover:bg-gray-700/60 text-white py-3 rounded-xl font-semibold transition-all"
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // Goal Section Component
// const GoalSection = ({ title, goals, type, onAdd, onEdit, onDelete, onToggle, getTagColor, getTagName, getMonthName, formatDateLabel }) => {
//   return (
//     <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/10 shadow-xl">
//       <div className="flex items-center justify-between mb-3">
//         <h2 className="font-semibold text-gray-100">{title}</h2>
//         <button
//           onClick={onAdd}
//           className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
//         >
//           <Plus className="w-4 h-4 text-blue-400" />
//         </button>
//       </div>
//       {goals.length === 0 ? (
//         <p className="text-sm text-gray-500">No {title.toLowerCase()}</p>
//       ) : (
//         <div className="space-y-2">
//           {goals.map(goal => (
//             <div key={goal.id} className={`bg-gray-800/50 rounded-lg p-2.5 flex items-start gap-2 transition-all hover:bg-gray-800/70 ${goal.completed ? 'opacity-60' : ''}`}>
//               <input 
//                 type="checkbox" 
//                 className="rounded mt-0.5 cursor-pointer accent-blue-600" 
//                 checked={goal.completed}
//                 onChange={() => onToggle(goal.id, goal.completed)}
//               />
//               <div className="flex-1 min-w-0">
//                 <div className={`text-sm ${goal.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
//                   {goal.title}
//                 </div>
//                 <div className="flex gap-1 mt-1.5 flex-wrap">
//                   {type === 'monthly' && (
//                     <span className="text-xs px-2 py-0.5 rounded-md bg-blue-600/80 text-white font-medium">
//                       {getMonthName(goal.month)}
//                     </span>
//                   )}
//                   {type === 'weekly' && (
//                     <span className="text-xs px-2 py-0.5 rounded-md bg-purple-600/80 text-white font-medium">
//                       Week {goal.weekNumber}
//                     </span>
//                   )}
//                   {type === 'daily' && formatDateLabel && (
//                     <span className="text-xs px-2 py-0.5 rounded-md bg-green-600/80 text-white font-medium">
//                       {formatDateLabel(goal.date)}
//                     </span>
//                   )}
//                   <span className="text-xs px-2 py-0.5 rounded-md text-white font-medium shadow-sm" style={{ backgroundColor: getTagColor(goal.tagId) }}>
//                     {getTagName(goal.tagId)}
//                   </span>
//                 </div>
//               </div>
//               <div className="flex gap-1">
//                 <button
//                   onClick={() => onEdit(goal)}
//                   className="p-1.5 hover:bg-blue-600/20 rounded-lg transition-colors"
//                 >
//                   <Edit2 className="w-3.5 h-3.5 text-blue-400" />
//                 </button>
//                 <button
//                   onClick={() => onDelete(goal.id)}
//                   className="p-1.5 hover:bg-red-600/20 rounded-lg transition-colors text-red-400"
//                 >
//                   <Trash2 className="w-3.5 h-3.5" />
//                 </button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default GoalTrackerApp;
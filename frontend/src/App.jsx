import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, Edit2, Trash2, Tag, BarChart3, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from './context/ToastContext';
import Auth from './components/Auth';
import NavBar from './components/NavBar';
import { executeWithToast, toastConfigs } from './utils/toastConfigs';
import { getUserTimezone, formatDateLocal, getTodayLocal, getLocalTime, isTodayLocal } from './utils/timezoneHelper';
import { FiLogOut } from "react-icons/fi";

const API_BASE = import.meta.env.VITE_API_BASE || (process.env.NODE_ENV);

const GoalTrackerApp = () => {
  const { showToast, updateToast } = useToast();
  
  // Check for existing user in localStorage immediately
  const savedUser = typeof window !== 'undefined' 
    ? localStorage.getItem('goalTrackerUser')
    : null;
  const initialUser = savedUser ? JSON.parse(savedUser) : null;
  
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);  // Always checking initially
  const [isLoading, setIsLoading] = useState(false);
  
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
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [habitsExpanded, setHabitsExpanded] = useState(false);
  const [showHabitReport, setShowHabitReport] = useState(null);
  const [goalType, setGoalType] = useState('monthly');
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  
  const [tagForm, setTagForm] = useState({ name: '', color: '#3b82f6' });
  const [goalForm, setGoalForm] = useState({ title: '', tagId: '', parentId: '' });
  const [habitForm, setHabitForm] = useState({ name: '', tagId: '' });

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Drag and drop state
  const [draggedGoal, setDraggedGoal] = useState(null);

  const [showStartupLoader, setShowStartupLoader] = useState(true);

  const [showGoalDetailsModal, setShowGoalDetailsModal] = useState(false);
  const [selectedGoalForDetails, setSelectedGoalForDetails] = useState(null);
  const [showRescheduleHistoryWeekly, setShowRescheduleHistoryWeekly] = useState(false);
  const [showRescheduleHistoryDaily, setShowRescheduleHistoryDaily] = useState(false);
  const [goalRescheduleCount, setGoalRescheduleCount] = useState({});


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
          
          // Detect user's timezone from browser
          const userTimezone = getUserTimezone();
          
          // Update user's timezone on backend if user is logged in
          if (currentUser) {
            try {
              await fetch(`${API_BASE}/user/${currentUser.id}/timezone`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: userTimezone })
              }).catch(() => {}); // Silently fail if timezone update fails
            } catch (error) {
              console.error('Error updating timezone:', error);
            }
          }
          
          // Update user object in state and localStorage
          setCurrentUser(prev => {
            const updated = { ...prev, timezone: userTimezone };
            localStorage.setItem('goalTrackerUser', JSON.stringify(updated));
            return updated;
          });
          
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
                const dateStr = formatDateLocal(date);
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
    
    // Update weather every 5 minutes (300000 milliseconds)
    const weatherInterval = setInterval(() => {
      fetchWeather();
      console.log('🌤️ Updating weather...');
    }, 300000);
    
    return () => {
      clearInterval(timer);
      clearInterval(weatherInterval);
    };
  }, []);

  useEffect(() => {
    const checkDataLoaded = async () => {
      if (!currentUser || !currentUser.id) {
        setShowStartupLoader(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/user/${currentUser.id}/loader-check`);
        if (response.ok) {
          const data = await response.json();
          
          // If data is loaded (has goals) or user has no data at all, hide loader
          if (data.isLoaded || !data.hasData) {
            setShowStartupLoader(false);
          } else {
            // Data might be loading, check again after a brief delay
            setTimeout(checkDataLoaded, 1000);
          }
        } else {
          // API error, hide loader after timeout
          setTimeout(() => setShowStartupLoader(false), 3000);
        }
      } catch (error) {
        console.error('Loader check failed:', error);
        // Fallback to timeout if check fails
        setTimeout(() => setShowStartupLoader(false), 3000);
      }
    };

    // Start checking after a brief delay to allow initial load
    const initialTimer = setTimeout(checkDataLoaded, 500);
    return () => clearTimeout(initialTimer);
  }, [currentUser]);


  // Validate and restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('goalTrackerUser');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          // Validate user has required fields
          if (user && user.id && user.username) {
            setCurrentUser(user);
            setShowAuth(false);
          } else {
            // Invalid user data
            localStorage.removeItem('goalTrackerUser');
            setShowAuth(true);
          }
        } catch (error) {
          console.error('Error restoring session:', error);
          localStorage.removeItem('goalTrackerUser');
          setShowAuth(true);
        }
      } else {
        setShowAuth(true);
      }
      setIsAuthChecking(false);  // Done checking
    };
    
    restoreSession();
  }, []);

  useEffect(() => {
    if (currentUser) loadData(isAuthChecking);
  }, [currentUser, isAuthChecking]);

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

  const loadData = async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      const [tagsRes, monthlyRes, weeklyRes, dailyRes, habitsRes] = await Promise.all([
        fetch(`${API_BASE}/tags/${currentUser.id}`),
        fetch(`${API_BASE}/goals/monthly/${currentUser.id}`),
        fetch(`${API_BASE}/goals/weekly/${currentUser.id}`),
        fetch(`${API_BASE}/goals/daily/${currentUser.id}`),
        fetch(`${API_BASE}/habits/${currentUser.id}`)
      ]);

      // Backend now returns paginated objects with { tags: [], page, limit, total }
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.tags || []);
      }
      if (monthlyRes.ok) {
        const data = await monthlyRes.json();
        setMonthlyGoals(data.goals || []);
      }
      if (weeklyRes.ok) {
        const data = await weeklyRes.json();
        setWeeklyGoals(data.goals || []);
      }
      if (dailyRes.ok) {
        const data = await dailyRes.json();
        setDailyGoals(data.goals || []);
      }
      if (habitsRes.ok) {
        const data = await habitsRes.json();
        setHabits(data.habits || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };



  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('goalTrackerUser');
    setShowAuth(true);
  };

  const handleSaveTag = async () => {
    if (!tagForm.name.trim()) {
      showToast('Tag name cannot be empty', { type: 'error', duration: 2000 });
      return;
    }
    
    const { success } = await executeWithToast(
      async () => {
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

        if (!response.ok) throw new Error('Failed to save tag');
        await loadData();
      },
      { showToast, updateToast },
      editingTag ? toastConfigs.tag.update : toastConfigs.tag.create
    );

    if (success) {
      setShowTagModal(false);
      setTagForm({ name: '', color: '#3b82f6' });
      setEditingTag(null);
    }
  };

  const handleDeleteTag = async (tagId) => {
    const { success } = await executeWithToast(
      async () => {
        const response = await fetch(`${API_BASE}/tags/${tagId}`, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete tag');
        }
        await loadData();
      },
      { showToast, updateToast },
      toastConfigs.tag.delete
    );
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title.trim()) {
      showToast('Goal title cannot be empty', { type: 'error', duration: 2000 });
      return;
    }

    const { success } = await executeWithToast(
      async () => {
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
            date: formatDateLocal(selectedDate),
            ...(editingGoal ? {} : { userId: currentUser.id })
          };
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: editingGoal ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to save goal');
        await loadData();
      },
      { showToast, updateToast },
      editingGoal ? toastConfigs.goal.update : toastConfigs.goal.create
    );

    if (success) {
      setShowGoalModal(false);
      setGoalForm({ title: '', tagId: '', parentId: '' });
      setEditingGoal(null);
    }
  };

  const handleDeleteGoal = async (goalId, type) => {
    const { success } = await executeWithToast(
      async () => {
        const endpoints = { 
          monthly: `/goals/monthly/${goalId}`, 
          weekly: `/goals/weekly/${goalId}`, 
          daily: `/goals/daily/${goalId}` 
        };
        const response = await fetch(`${API_BASE}${endpoints[type]}`, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete goal');
        }
        await loadData();
      },
      { showToast, updateToast },
      toastConfigs.goal.delete
    );
  };

  const handleToggleGoal = async (goalId, type, currentCompleted) => {
    const { success } = await executeWithToast(
      async () => {
        const endpoints = { 
          monthly: `/goals/monthly/${goalId}`, 
          weekly: `/goals/weekly/${goalId}`, 
          daily: `/goals/daily/${goalId}` 
        };
        const response = await fetch(`${API_BASE}${endpoints[type]}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !currentCompleted })
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update goal');
        }
        await loadData();
      },
      { showToast, updateToast },
      toastConfigs.goal.toggle
    );
  };

  const handleDragStartGoal = (e, goal) => {
    // Only allow dragging uncompleted daily goals
    if (goal.completed) {
      e.preventDefault();
      return;
    }
    setDraggedGoal({ ...goal, type: 'daily' });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartWeeklyGoal = (e, goal) => {
    // Only allow dragging uncompleted weekly goals
    if (goal.completed) {
      e.preventDefault();
      return;
    }
    setDraggedGoal({ ...goal, type: 'weekly' });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverDay = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropGoal = async (e, targetDate, targetWeek = null) => {
    e.preventDefault();
    
    if (!draggedGoal) return;

    // Handle weekly goal drop
    if (draggedGoal.type === 'weekly') {
      if (!targetWeek) {
        setDraggedGoal(null);
        return;
      }

      // Don't allow dropping completed goals
      if (draggedGoal.completed) {
        setDraggedGoal(null);
        return;
      }

      const oldWeekKey = `${draggedGoal.year}-W${draggedGoal.weekNumber}`;
      const newWeekKey = `${targetWeek.year}-W${targetWeek.weekNumber}`;

      // Don't update if dropping on the same week
      if (oldWeekKey === newWeekKey) {
        setDraggedGoal(null);
        return;
      }

      const { success } = await executeWithToast(
        async () => {
          const response = await fetch(`${API_BASE}/goals/weekly/${draggedGoal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              weekNumber: targetWeek.weekNumber,
              year: targetWeek.year,
              weekStart: targetWeek.weekStart,
              weekEnd: targetWeek.weekEnd
            })
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to move goal');
          }
          const updatedGoal = await response.json();
          // Update the selected goal details if it's currently open in the modal
          if (selectedGoalForDetails && selectedGoalForDetails.id === draggedGoal.id) {
            setSelectedGoalForDetails(updatedGoal);
          }
          await loadData();
        },
        { showToast, updateToast },
        { ...toastConfigs.goal.update, message: 'Goal moved to new week' }
      );

      setDraggedGoal(null);
      return;
    }
    
    // Original daily goal drop logic
    if (draggedGoal.type !== 'daily') {
      setDraggedGoal(null);
      return;
    }

    // Don't allow dropping completed goals
    if (draggedGoal.completed) {
      setDraggedGoal(null);
      return;
    }

    const newDateStr = formatDateLocal(targetDate);
    const oldDateStr = draggedGoal.date;

    // Don't update if dropping on the same date
    if (oldDateStr === newDateStr) {
      setDraggedGoal(null);
      return;
    }

    const { success } = await executeWithToast(
      async () => {
        const response = await fetch(`${API_BASE}/goals/daily/${draggedGoal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: newDateStr })
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to move goal');
        }
        const updatedGoal = await response.json();
        // Update the selected goal details if it's currently open in the modal
        if (selectedGoalForDetails && selectedGoalForDetails.id === draggedGoal.id) {
          setSelectedGoalForDetails(updatedGoal);
        }
        await loadData();
      },
      { showToast, updateToast },
      { ...toastConfigs.goal.update, message: 'Goal moved to new date' }
    );

    setDraggedGoal(null);
  };

  const handleSaveHabit = async () => {
    if (!habitForm.name.trim()) {
      showToast('Habit name cannot be empty', { type: 'error', duration: 2000 });
      return;
    }

    const { success } = await executeWithToast(
      async () => {
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

        if (!response.ok) throw new Error('Failed to save habit');
        await loadData();
      },
      { showToast, updateToast },
      editingHabit ? toastConfigs.habit.update : toastConfigs.habit.create
    );

    if (success) {
      setShowHabitModal(false);
      setHabitForm({ name: '', tagId: '' });
      setEditingHabit(null);
    }
  };

const handleToggleHabit = async (habitId, date) => {
  const { success, data } = await executeWithToast(
    async () => {
      const response = await fetch(`${API_BASE}/habits/${habitId}/toggle/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle habit');
      }
      
      return response.json();
    },
    { showToast, updateToast },
    toastConfigs.habit.log
  );

  if (success) {
    setHabits(habits.map(h => h.id === habitId ? data : h));
  }
};

  const handleDeleteHabit = async (habitId) => {
    const { success } = await executeWithToast(
      async () => {
        const response = await fetch(`${API_BASE}/habits/${habitId}`, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete habit');
        }
        await loadData();
      },
      { showToast, updateToast },
      toastConfigs.habit.delete
    );
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
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const day = d.getDay();
    // Calculate days to go back to reach Monday
    // If Sunday (0), go forward 1 day to Monday; otherwise go back (day - 1) days
    const offset = day === 0 ? 1 : -(day - 1);
    const weekStartDate = new Date(d);
    weekStartDate.setDate(weekStartDate.getDate() + offset);
    return formatDateLocal(weekStartDate);
  };

  const getWeekEnd = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const offset = day === 0 ? 1 : -(day - 1);
    const weekStartDate = new Date(d);
    weekStartDate.setDate(weekStartDate.getDate() + offset);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    return formatDateLocal(weekEndDate);
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
    const dateStr = formatDateLocal(date);
    return dailyGoals.filter(g => g.date === dateStr);
  };

  const getTagColor = (tagId) => tags.find(t => t.id === tagId)?.color || '#6b7280';
  const getTagName = (tagId) => tags.find(t => t.id === tagId)?.name || 'No Tag';

  const getGoalsForSelectedDate = () => {
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const selectedWeek = getISOWeekNumber(selectedDate);
    const selectedDateStr = formatDateLocal(selectedDate);

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

  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getHabitStats = (habit) => {
    const startDate = new Date(habit.startDate);
    const today = new Date();
    const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const completedDays = habit.completedDates.length;
    return { totalDays, completedDays, missedDays: totalDays - completedDays };
  };

  const isToday = (date) => isTodayLocal(date);

  // Helper functions for goal hierarchy
  const getWeeklyGoalsUnderMonthly = (monthlyGoal) => {
    return weeklyGoals.filter(wg => 
      wg.parentId === monthlyGoal.id && 
      wg.year === monthlyGoal.year
    );
  };

  const getDailyGoalsUnderWeekly = (weeklyGoal) => {
    return dailyGoals.filter(dg => 
      dg.parentId === weeklyGoal.id
    );
  };

  const getDailyGoalsUnderDaily = (dailyGoal) => {
    // For daily goals, we show related goals with same parentId
    return dailyGoals.filter(dg => 
      dg.parentId === dailyGoal.parentId && 
      dg.id !== dailyGoal.id
    );
  };

  const getGoalRescheduleCount = (dailyGoal) => {
    // Return the count of reschedule history entries
    return dailyGoal?.rescheduleHistory?.length || 0;
  };

  const handleGoogleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('goalTrackerUser', JSON.stringify(user));
    setShowAuth(false);
  };

  if (showAuth) {
    return <Auth isLoading={isLoading} onLoginSuccess={handleGoogleLoginSuccess} />;
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
            <div key={goal.id} className={`bg-gray-800/50 hover:bg-gray-800/70 rounded-lg p-3 flex items-center gap-3 transition-colors cursor-pointer ${goal.completed ? 'opacity-60' : ''}`} onClick={() => { setSelectedGoalForDetails(goal); setShowGoalDetailsModal(true); }}>
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(goal.id, goal.completed); }}
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                  goal.completed
                    ? 'bg-gradient-to-br from-green-600 to-green-700'
                    : 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                {goal.completed && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${goal.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                  {goal.title}
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {type === 'monthly' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-600/80 text-white">
                      {getMonthName(goal.month)}
                    </span>
                  )}
                  {type === 'weekly' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-600/80 text-white">
                      Week {goal.weekNumber}
                    </span>
                  )}
                  {type === 'daily' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-green-600/80 text-white">
                      {formatDateLabel(goal.date)}
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: getTagColor(goal.tagId) }}>
                    {getTagName(goal.tagId)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onEdit(goal); }} className="p-1.5 hover:bg-blue-600/20 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }} className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const CustomDropdown = ({ id, value, options, onChange, placeholder = "Select an option", displayKey = "name" }) => {
    const selectedOption = options.find(opt => opt.id === value || opt.value === value);
    const displayValue = selectedOption ? selectedOption[displayKey] : placeholder;
    const [dropdownPosition, setDropdownPosition] = React.useState('below');

    const handleDropdownOpen = () => {
      if (openDropdown !== id) {
        const button = document.getElementById(`dropdown-${id}`);
        if (button) {
          const rect = button.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;
          
          // Position above if not enough space below
          if (spaceBelow < 280 && spaceAbove > 280) {
            setDropdownPosition('above');
          } else {
            setDropdownPosition('below');
          }
        }
      }
      setOpenDropdown(openDropdown === id ? null : id);
    };

    return (
      <>
        {openDropdown === id && (
          <div 
            className="fixed inset-0 z-[998]" 
            onClick={() => setOpenDropdown(null)}
            style={{ pointerEvents: 'none' }}
          />
        )}
        <div className="relative z-[100]">
          <button
            id={`dropdown-${id}`}
            onClick={handleDropdownOpen}
            className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm flex items-center justify-between hover:border-gray-600 transition-colors"
          >
            <span className={displayValue === placeholder ? 'text-gray-500' : 'text-white'}>
              {displayValue}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openDropdown === id ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === id && (
            <div 
              className="fixed bg-gray-800/95 border border-gray-700/50 rounded-xl shadow-2xl z-[9999] max-h-64 overflow-y-auto backdrop-blur-sm pointer-events-auto scrollbar-purple" 
              style={{
                top: dropdownPosition === 'below' 
                  ? `${document.getElementById(`dropdown-${id}`)?.getBoundingClientRect().bottom + 8 || 0}px`
                  : `${Math.max(0, document.getElementById(`dropdown-${id}`)?.getBoundingClientRect().top - 280 || 0)}px`,
                left: `${document.getElementById(`dropdown-${id}`)?.getBoundingClientRect().left || 0}px`,
                width: `${document.getElementById(`dropdown-${id}`)?.clientWidth || 'auto'}px`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2">
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-gray-400 text-sm">No options available</div>
                ) : (
                  options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onChange(option.id || option.value);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        (option.id || option.value) === value
                          ? 'bg-blue-600/80 text-white'
                          : 'text-gray-200 hover:bg-gray-700/60'
                      }`}
                    >
                      {option.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span>{option[displayKey]}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Loading Screen */}
      {(showStartupLoader || isLoading) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999]">
          <div className="flex flex-col items-center gap-4">

            {/* Simple Spinner */}
            <div className="w-10 h-10 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>

            {/* Text */}
            <p className="text-sm text-gray-300">
              {showStartupLoader
                ? 'Preparing your dashboard...'
                : 'Loading your goals...'}
            </p>


          </div>
        </div>


      )}

      {/* Header */}
      <NavBar 
        systemStatus={systemStatus} 
        weather={weather} 
        getWeatherEmoji={getWeatherEmoji} 
        currentUser={currentUser} 
        currentTime={currentTime} 
        handleLogout={handleLogout} 
      />

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
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setHabitsExpanded(!habitsExpanded)} className="flex items-center gap-2 flex-1">
              <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${habitsExpanded ? 'rotate-0' : '-rotate-90'}`} />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-600/20 rounded-lg">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <h2 className="font-semibold text-gray-100">Habits</h2>
              </div>
            </button>
            <button
              onClick={() => {
                setShowHabitModal(true);
                setEditingHabit(null);
                setHabitForm({ name: '', tagId: '' });
              }}
              className="p-2 hover:bg-blue-600/20 rounded-lg"
            >
              <Plus className="w-4 h-4 text-blue-400" />
            </button>
          </div>

          {habitsExpanded && (
            <div className="px-4 pb-4 border-t border-gray-800/50">
              {habits.length === 0 ? (
                <p className="text-sm text-gray-500 pt-3">No habits yet</p>
              ) : (
                <div className="space-y-3 pt-3">
                  {habits.map(habit => {
                    const today = getTodayLocal();
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      return formatDateLocal(d);
                    });

                    return (
                      <div key={habit.id} className="space-y-2 pb-2 border-b border-gray-700/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 text-sm">{habit.name}</span>
                          <button
                            onClick={() => setShowHabitReport(habit)}
                            className="p-1.5 hover:bg-purple-600/20 rounded-lg"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingHabit(habit);
                              setHabitForm({ name: habit.name, tagId: habit.tagId });
                              setShowHabitModal(true);
                            }}
                            className="p-1.5 hover:bg-blue-600/20 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteHabit(habit.id)}
                            className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400"
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
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/60 rounded-xl p-2 border border-blue-500/10 select-none">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base font-semibold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
              {currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="p-1.5 bg-gray-800/60 rounded-lg">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="px-2 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-[10px] font-medium">
                Today
              </button>
              <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }} className="p-1.5 bg-gray-800/60 rounded-lg">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
            <div className="text-center text-[9px] text-gray-500 py-0.5 font-semibold">W</div>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
              <div key={idx} className="text-center text-[9px] text-gray-400 py-0.5 font-medium">{day}</div>
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
                  <div className="min-h-20 px-0.5 py-1 rounded border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 flex flex-col items-center justify-start overflow-hidden"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedGoal?.type === 'weekly') {
                        e.currentTarget.classList.add('border-purple-500', 'bg-purple-950/30');
                      }
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/30');
                    }}
                    onDrop={(e) => {
                      e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/30');
                      if (draggedGoal?.type === 'weekly' && row.weekNum) {
                        const jan1 = new Date(currentDate.getFullYear(), 0, 1);
                        const jan1DayOfWeek = jan1.getDay();
                        const daysToAddForWeek1 = jan1DayOfWeek === 0 ? 1 : 2 - jan1DayOfWeek;
                        const firstMonday = new Date(currentDate.getFullYear(), 0, 1 + daysToAddForWeek1);
                        
                        const weekStartDate = new Date(firstMonday);
                        weekStartDate.setDate(weekStartDate.getDate() + (row.weekNum - 1) * 7);
                        
                        const weekEndDate = new Date(weekStartDate);
                        weekEndDate.setDate(weekEndDate.getDate() + 6);
                        
                        handleDropGoal(e, null, { 
                          weekNumber: row.weekNum, 
                          year: currentDate.getFullYear(),
                          weekStart: formatDateLocal(weekStartDate),
                          weekEnd: formatDateLocal(weekEndDate)
                        });
                      }
                    }}
                  >
                    <div className="text-center font-bold text-[10px] text-purple-400 mb-0.5">W{row.weekNum}</div>
                    <div className="flex flex-col gap-0.5 w-full">
                      {weeklyGoals.filter(g => g.weekNumber === row.weekNum && g.year === currentDate.getFullYear()).slice(0, 2).map(goal => (
                        <div 
                          key={goal.id} 
                          draggable={!goal.completed}
                          onDragStart={(e) => handleDragStartWeeklyGoal(e, goal)}
                          onDragEnd={() => setDraggedGoal(null)}
                          onTouchStart={(e) => {
                            if (!goal.completed) {
                              let longPressTimer = setTimeout(() => {
                                e.currentTarget.style.opacity = '0.5';
                                setDraggedGoal(goal);
                              }, 500);
                              e.currentTarget.dataset.longPressTimer = longPressTimer;
                            }
                          }}
                          onTouchMove={(e) => {
                            if (draggedGoal && draggedGoal.id === goal.id) {
                              e.preventDefault();
                            }
                          }}
                          onTouchEnd={(e) => {
                            clearTimeout(e.currentTarget.dataset.longPressTimer);
                            e.currentTarget.style.opacity = '1';
                            if (draggedGoal && draggedGoal.id === goal.id) {
                              const touch = e.changedTouches[0];
                              const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                              if (elem) {
                                const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
                                elem.dispatchEvent(dropEvent);
                              }
                              setDraggedGoal(null);
                            }
                          }}
                          onClick={() => { setSelectedGoalForDetails(goal); setShowGoalDetailsModal(true); }}
                          className={`text-[8px] px-1 py-0.5 rounded truncate text-white ${goal.completed ? 'opacity-40 line-through' : ''}`} 
                          style={{ backgroundColor: getTagColor(goal.tagId) }} 
                          title={goal.title}
                        >
                          {goal.title}
                        </div>
                      ))}
                    </div>
                  </div>
                  {row.days.map((day, dayIdx) => {
                    if (!day) return <div key={`empty-${rowIdx}-${dayIdx}`} />;
                    
                    const goalsForDay = getGoalsForDate(day);
                    const dayIsToday = isToday(day);
                    const dateStr = formatDateLocal(day);
                    const dayForecast = forecastData[dateStr];
                    
                    return (
                      <div
                        key={`${rowIdx}-${dayIdx}`}
                        onClick={() => setSelectedDate(day)}
                        onDragOver={handleDragOverDay}
                        onDrop={(e) => handleDropGoal(e, day)}
                        style={{ minHeight: `${Math.max(72, 40 + goalsForDay.slice(0, 4).length * 16)}px` }}
                        className={`px-0.5 py-1 rounded border cursor-pointer overflow-hidden transition-all ${
                          draggedGoal ? 'opacity-80' : 'opacity-100'
                        } ${
                          dayIsToday ? 'border-blue-500 bg-gradient-to-br from-blue-950/50 to-blue-900/30' : day.toDateString() === selectedDate.toDateString() ? 'border-blue-400/60 bg-gradient-to-br from-gray-800/60 to-gray-900/60' : 'border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-0.5">
                          <div className={`text-[11px] font-medium leading-none ${dayIsToday ? 'text-blue-400' : 'text-gray-300'}`}>{day.getDate()}</div>
                          {dayForecast && (
                            <div className="text-[10px] leading-none">{getWeatherEmoji(dayForecast.weatherCode)}</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {goalsForDay.slice(0, 4).map(goal => (
                            <div 
                              key={goal.id} 
                              draggable={!goal.completed}
                              onDragStart={(e) => handleDragStartGoal(e, goal)}
                              onDragEnd={() => setDraggedGoal(null)}
                              onTouchStart={(e) => {
                                if (!goal.completed) {
                                  let longPressTimer = setTimeout(() => {
                                    e.currentTarget.style.opacity = '0.5';
                                    setDraggedGoal(goal);
                                  }, 500);
                                  e.currentTarget.dataset.longPressTimer = longPressTimer;
                                }
                              }}
                              onTouchMove={(e) => {
                                if (draggedGoal && draggedGoal.id === goal.id) {
                                  e.preventDefault();
                                }
                              }}
                              onTouchEnd={(e) => {
                                clearTimeout(e.currentTarget.dataset.longPressTimer);
                                e.currentTarget.style.opacity = '1';
                                if (draggedGoal && draggedGoal.id === goal.id) {
                                  const touch = e.changedTouches[0];
                                  const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                                  if (elem) {
                                    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
                                    elem.dispatchEvent(dropEvent);
                                  }
                                  setDraggedGoal(null);
                                }
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelectedGoalForDetails(goal); setShowGoalDetailsModal(true); }}
                              className={`text-[8px] px-1 py-0.5 rounded truncate text-white ${goal.completed ? 'opacity-40 line-through' : ''}`} 
                              style={{ backgroundColor: getTagColor(goal.tagId) }} 
                              title={goal.title}
                            >
                              {goal.title}
                            </div>
                          ))}
                          {goalsForDay.length > 4 && <div className="text-[7px] text-gray-400 text-center leading-none mt-px">+{goalsForDay.length - 4}</div>}
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
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-blue-500/10">
              <div className="flex items-center justify-between p-4">
                <button onClick={() => setHabitsExpanded(!habitsExpanded)} className="flex items-center gap-2 flex-1">
                  <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${habitsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-600/20 rounded-lg">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <h2 className="font-semibold text-gray-100">Habits</h2>
                  </div>
                </button>
                <button onClick={() => { setShowHabitModal(true); setEditingHabit(null); setHabitForm({ name: '', tagId: '' }); }} className="p-2 hover:bg-blue-600/20 rounded-lg">
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>

              {habitsExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800/50">
                  {habits.length === 0 ? (
                    <p className="text-sm text-gray-500 pt-3">No habits yet</p>
                  ) : (
                    <div className="space-y-3 pt-3">
                      {habits.map(habit => {
                        const today = getTodayLocal();
                        const last7Days = Array.from({ length: 7 }, (_, i) => {
                          const d = new Date();
                          d.setDate(d.getDate() - (6 - i));
                          return formatDateLocal(d);
                        });
                        
                        return (
                          <div key={habit.id} className="space-y-2 pb-2 border-b border-gray-700/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-sm">{habit.name}</span>
                              <button onClick={() => setShowHabitReport(habit)} className="p-1.5 hover:bg-purple-600/20 rounded-lg">
                                <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                              </button>
                              <button onClick={() => { setEditingHabit(habit); setHabitForm({ name: habit.name, tagId: habit.tagId }); setShowHabitModal(true); }} className="p-1.5 hover:bg-blue-600/20 rounded-lg">
                                <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                              <button onClick={() => handleDeleteHabit(habit.id)} className="p-1.5 hover:bg-red-600/20 rounded-lg text-red-400">
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
          <div className="flex-1 bg-gradient-to-br from-gray-900/80 to-gray-900/60 rounded-xl p-4 border border-blue-500/10 select-none">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }} className="px-3 py-2 bg-gray-800/60 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-sm font-medium">
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
                    <div className="min-h-24 p-2 rounded-lg border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 flex flex-col items-center overflow-y-auto scrollbar-custom"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (draggedGoal?.type === 'weekly') {
                          e.currentTarget.classList.add('border-purple-500', 'bg-purple-950/30');
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/30');
                      }}
                      onDrop={(e) => {
                        e.currentTarget.classList.remove('border-purple-500', 'bg-purple-950/30');
                        if (draggedGoal?.type === 'weekly' && row.weekNum) {
                          // Calculate the proper week start and end dates for the target week
                          const jan1 = new Date(currentDate.getFullYear(), 0, 1);
                          const jan1DayOfWeek = jan1.getDay();
                          // Monday is day 1, Sunday is day 0 -> adjust to ISO week (Monday = 1)
                          const daysToAddForWeek1 = jan1DayOfWeek === 0 ? 1 : 2 - jan1DayOfWeek;
                          const firstMonday = new Date(currentDate.getFullYear(), 0, 1 + daysToAddForWeek1);
                          
                          const weekStartDate = new Date(firstMonday);
                          weekStartDate.setDate(weekStartDate.getDate() + (row.weekNum - 1) * 7);
                          
                          const weekEndDate = new Date(weekStartDate);
                          weekEndDate.setDate(weekEndDate.getDate() + 6);
                          
                          handleDropGoal(e, null, { 
                            weekNumber: row.weekNum, 
                            year: currentDate.getFullYear(),
                            weekStart: formatDateLocal(weekStartDate),
                            weekEnd: formatDateLocal(weekEndDate)
                          });
                        }
                      }}
                    >
                      <div className="text-center font-semibold text-sm text-purple-400 mb-2">W{row.weekNum}</div>
                      <div className="flex flex-col gap-0.5 w-full">
                        {weeklyGoals.filter(g => g.weekNumber === row.weekNum && g.year === currentDate.getFullYear()).slice(0, 8).map(goal => (
                          <div 
                            key={goal.id} 
                            draggable={!goal.completed}
                            onDragStart={(e) => handleDragStartWeeklyGoal(e, goal)}
                            onDragEnd={() => setDraggedGoal(null)}
                            onClick={() => { setSelectedGoalForDetails(goal); setShowGoalDetailsModal(true); }}
                            className={`text-xs px-1.5 py-1 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity ${goal.completed ? 'line-through opacity-50' : ''}`} 
                            style={{ backgroundColor: getTagColor(goal.tagId) }} 
                            title={goal.title}
                          >
                            {goal.title}
                          </div>
                        ))}
                      </div>
                    </div>
                    {row.days.map((day, dayIdx) => {
                      if (!day) return <div key={`empty-${rowIdx}-${dayIdx}`} />;
                      
                      const goalsForDay = getGoalsForDate(day);
                      const dayIsToday = isToday(day);
                      const dateStr = formatDateLocal(day);
                      const dayForecast = forecastData[dateStr];
                      
                      return (
                        <div
                          key={`${rowIdx}-${dayIdx}`}
                          onClick={() => setSelectedDate(day)}
                          onDragOver={handleDragOverDay}
                          onDrop={(e) => handleDropGoal(e, day)}
                          className={`min-h-24 p-2 rounded-lg border cursor-pointer overflow-y-auto scrollbar-custom transition-all ${
                            draggedGoal ? 'opacity-80' : 'opacity-100'
                          } ${
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
                              <div 
                                key={goal.id} 
                                draggable={!goal.completed}
                                onDragStart={(e) => handleDragStartGoal(e, goal)}
                                onDragEnd={() => setDraggedGoal(null)}
                                onClick={(e) => { e.stopPropagation(); setSelectedGoalForDetails(goal); setShowGoalDetailsModal(true); }}
                                className={`text-xs px-1.5 py-1 rounded truncate cursor-pointer ${goal.completed ? 'line-through opacity-50' : 'hover:opacity-80'}`} 
                                style={{ backgroundColor: getTagColor(goal.tagId) }} 
                                title={goal.title}
                              >
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
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowTagModal(false);
            setEditingTag(null);
            setTagForm({ name: '', color: '#3b82f6' });
            setOpenDropdown(null);
            setShowColorPicker(false);
          }}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              {editingTag ? 'Edit Tag' : 'New Tag'}
            </h3>

            <div className="space-y-4">
              {/* Tag Name Input */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="Enter tag name"
                />
              </div>

              {/* Color Selector */}
              <div className="relative">
                <label className="block text-sm text-gray-300 mb-2">
                  Color
                </label>
                
                {/* Color Display Button */}
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-full bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700/50 hover:border-gray-600 focus:border-blue-500 focus:outline-none transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg border-2 border-white/20"
                      style={{ backgroundColor: tagForm.color }}
                    />
                    <span className="text-white font-medium">
                      {['Blue', 'Purple', 'Pink', 'Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Cyan', 'Indigo', 'Gray', 'Slate'][['#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1', '#6b7280', '#64748b'].indexOf(tagForm.color)] || 'Custom'}
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${showColorPicker ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Color Picker Dropdown */}
                {showColorPicker && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 shadow-2xl z-50">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { name: 'Blue', value: '#3b82f6' },
                        { name: 'Purple', value: '#a855f7' },
                        { name: 'Pink', value: '#ec4899' },
                        { name: 'Red', value: '#ef4444' },
                        { name: 'Orange', value: '#f97316' },
                        { name: 'Yellow', value: '#eab308' },
                        { name: 'Green', value: '#22c55e' },
                        { name: 'Teal', value: '#14b8a6' },
                        { name: 'Cyan', value: '#06b6d4' },
                        { name: 'Indigo', value: '#6366f1' },
                        { name: 'Gray', value: '#6b7280' },
                        { name: 'Slate', value: '#64748b' }
                      ].map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => {
                            setTagForm({ ...tagForm, color: color.value });
                            setShowColorPicker(false);
                          }}
                          className="group relative aspect-square rounded-lg border-2 transition-all hover:scale-110"
                          style={{ 
                            backgroundColor: color.value,
                            borderColor: tagForm.color === color.value ? '#ffffff' : 'transparent'
                          }}
                          title={color.name}
                        >
                          {tagForm.color === color.value && (
                            <svg 
                              className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg"
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {color.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveTag}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowTagModal(false);
                  setEditingTag(null);
                  setTagForm({ name: '', color: '#3b82f6' });
                  setOpenDropdown(null);
                  setShowColorPicker(false);
                }}
                className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { setShowGoalModal(false); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); setOpenDropdown(null); }}>
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20 max-h-[90vh] overflow-y-auto scrollbar-custom" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{editingGoal ? 'Edit' : 'New'} {goalType.charAt(0).toUpperCase() + goalType.slice(1)} Goal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Title</label>
                <input type="text" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm" placeholder="Enter goal title" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tag</label>
                <CustomDropdown
                  id="goalTagDropdown"
                  value={goalForm.tagId}
                  options={[{ id: '', name: 'Select a tag' }, ...tags]}
                  onChange={(value) => setGoalForm({ ...goalForm, tagId: value })}
                  placeholder="Select a tag"
                  displayKey="name"
                />
              </div>
              {(goalType === 'weekly' || goalType === 'daily') && (
                <div className={`transition-opacity ${openDropdown === 'goalTagDropdown' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <label className="block text-sm text-gray-300 mb-2">Parent Goal (Optional)</label>
                  <CustomDropdown
                    id="goalParentDropdown"
                    value={goalForm.parentId}
                    options={[
                      { id: '', name: 'Independent' },
                      ...(goalType === 'daily' 
                        ? [
                            ...weeklyGoals.filter(g => g.weekNumber === getISOWeekNumber(selectedDate) && g.year === selectedDate.getFullYear()).map(goal => ({ id: goal.id, name: `${goal.title} (Weekly)` })),
                            ...monthlyGoals.filter(g => g.month === selectedDate.getMonth() && g.year === selectedDate.getFullYear()).map(goal => ({ id: goal.id, name: `${goal.title} (Monthly)` }))
                          ]
                        : monthlyGoals.filter(g => g.month === selectedDate.getMonth() && g.year === selectedDate.getFullYear()).map(goal => ({ id: goal.id, name: `${goal.title} (Monthly)` }))
                      )
                    ]}
                    onChange={(value) => setGoalForm({ ...goalForm, parentId: value })}
                    placeholder="Select a parent goal"
                    displayKey="name"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveGoal} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold">Save</button>
                <button onClick={() => { setShowGoalModal(false); setEditingGoal(null); setGoalForm({ title: '', tagId: '', parentId: '' }); setOpenDropdown(null); }} className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHabitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { setShowHabitModal(false); setEditingHabit(null); setHabitForm({ name: '', tagId: '' }); setOpenDropdown(null); }}>
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-md border border-blue-500/20" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">{editingHabit ? 'Edit Habit' : 'New Habit'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Habit Name</label>
                <input type="text" value={habitForm.name} onChange={(e) => setHabitForm({ ...habitForm, name: e.target.value })} className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 border border-gray-700/50 focus:border-blue-500 focus:outline-none text-sm" placeholder="Enter habit name" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tag</label>
                <CustomDropdown
                  id="habitTagDropdown"
                  value={habitForm.tagId}
                  options={[{ id: '', name: 'Select a tag' }, ...tags]}
                  onChange={(value) => setHabitForm({ ...habitForm, tagId: value })}
                  placeholder="Select a tag"
                  displayKey="name"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveHabit} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold">Save</button>
                <button onClick={() => { setShowHabitModal(false); setEditingHabit(null); setHabitForm({ name: '', tagId: '' }); setOpenDropdown(null); }} className="flex-1 bg-gray-800/60 text-white py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHabitReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowHabitReport(null)}>
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-6xl border border-blue-500/20 max-h-[90vh] overflow-y-auto scrollbar-custom" onClick={(e) => e.stopPropagation()}>
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
                  last365Days.push(formatDateLocal(d));
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
                              const isCurrentDay = date === getTodayLocal();
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

      {showGoalDetailsModal && selectedGoalForDetails && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowGoalDetailsModal(false);
            setSelectedGoalForDetails(null);
          }}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 w-full max-w-2xl border border-blue-500/20 max-h-[90vh] overflow-y-auto scrollbar-custom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  {selectedGoalForDetails.title}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm px-3 py-1 rounded-lg text-white" style={{ backgroundColor: getTagColor(selectedGoalForDetails.tagId) }}>
                    {getTagName(selectedGoalForDetails.tagId)}
                  </span>
                  {selectedGoalForDetails.completed && (
                    <span className="text-sm px-3 py-1 rounded-lg bg-green-600/60 text-white flex items-center gap-1">
                      <Check className="w-4 h-4" /> Completed
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowGoalDetailsModal(false);
                  setSelectedGoalForDetails(null);
                }}
                className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Goal Info */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-blue-400 mb-4">Goal Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Type</div>
                    <div className="text-white font-medium capitalize">
                      {selectedGoalForDetails.date ? 'Daily' : selectedGoalForDetails.weekNumber ? 'Weekly' : 'Monthly'}
                    </div>
                  </div>
                  {selectedGoalForDetails.month !== undefined && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Month</div>
                      <div className="text-white font-medium">{getMonthName(selectedGoalForDetails.month)} {selectedGoalForDetails.year}</div>
                    </div>
                  )}
                  {selectedGoalForDetails.weekNumber && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Week</div>
                      <div className="text-white font-medium">Week {selectedGoalForDetails.weekNumber}</div>
                    </div>
                  )}
                  {selectedGoalForDetails.date && (
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Date</div>
                      <div className="text-white font-medium">{formatDateLabel(selectedGoalForDetails.date)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parent Goal & Reschedule Count */}
              {(selectedGoalForDetails.date || selectedGoalForDetails.weekNumber) && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-4">Goal Info</h3>
                  <div className="space-y-3">
                    {/* Parent Goal */}
                    <div>
                      <div className="text-sm text-gray-400 mb-2">Parent Goal</div>
                      {selectedGoalForDetails.parentId ? (
                        <div className="bg-gray-700/40 rounded-lg p-3 border border-gray-600/30">
                          {selectedGoalForDetails.weekNumber && !selectedGoalForDetails.date ? (
                            // Weekly goal - parent is monthly
                            (() => {
                              const parentGoal = monthlyGoals.find(g => g.id === selectedGoalForDetails.parentId);
                              return parentGoal ? (
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="font-medium text-white">{parentGoal.title}</div>
                                    <div className="text-xs text-gray-400 mt-1">{getMonthName(parentGoal.month)} {parentGoal.year}</div>
                                  </div>
                                  <span className="text-xs px-2 py-1 rounded bg-blue-600/40 text-blue-300">Monthly</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">Parent goal not found</span>
                              );
                            })()
                          ) : (
                            // Daily goal - parent can be weekly or monthly
                            (() => {
                              const weeklyParent = weeklyGoals.find(g => g.id === selectedGoalForDetails.parentId);
                              const monthlyParent = monthlyGoals.find(g => g.id === selectedGoalForDetails.parentId);
                              const parent = weeklyParent || monthlyParent;
                              return parent ? (
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="font-medium text-white">{parent.title}</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      {weeklyParent ? `Week ${parent.weekNumber}` : `${getMonthName(parent.month)} ${parent.year}`}
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${weeklyParent ? 'bg-purple-600/40 text-purple-300' : 'bg-blue-600/40 text-blue-300'}`}>
                                    {weeklyParent ? 'Weekly' : 'Monthly'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">Parent goal not found</span>
                              );
                            })()
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 bg-gray-700/20 rounded-lg p-3">
                          <span className="inline-block px-3 py-1 rounded-full bg-gray-700/40">Independent Goal</span>
                        </div>
                      )}
                    </div>

                    {/* Reschedule Count */}
                    {/* <div>
                      <div className="text-sm text-gray-400 mb-2">Reschedule History</div>
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-700/40 rounded-lg p-3 border border-gray-600/30 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-orange-400">
                              {selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length > 0 
                                ? selectedGoalForDetails.rescheduleHistory.length 
                                : '0'}
                            </span>
                            <span className="text-sm text-gray-400">
                              {selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length === 1 
                                ? 'reschedule' 
                                : 'reschedules'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div> */}
                  </div>
                </div>
              )}
              {!selectedGoalForDetails.date && !selectedGoalForDetails.weekNumber && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <h3 className="text-lg font-semibold text-purple-400 mb-4">Weekly Goals</h3>
                  {getWeeklyGoalsUnderMonthly(selectedGoalForDetails).length === 0 ? (
                    <p className="text-sm text-gray-500">No weekly goals under this monthly goal</p>
                  ) : (
                    <div className="space-y-3">
                      {getWeeklyGoalsUnderMonthly(selectedGoalForDetails).map(weeklyGoal => (
                        <div 
                          key={weeklyGoal.id} 
                          draggable={!weeklyGoal.completed}
                          onDragStart={(e) => handleDragStartWeeklyGoal(e, weeklyGoal)}
                          onDragEnd={() => setDraggedGoal(null)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (draggedGoal?.type === 'weekly') {
                              e.currentTarget.classList.add('border-blue-500', 'bg-blue-950/30');
                            }
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-950/30');
                          }}
                          onDrop={(e) => {
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-950/30');
                            handleDropGoal(e, null, { 
                              weekNumber: weeklyGoal.weekNumber, 
                              year: weeklyGoal.year,
                              weekStart: weeklyGoal.weekStart,
                              weekEnd: weeklyGoal.weekEnd
                            });
                          }}
                          className={`bg-gray-700/30 rounded-lg p-3 border border-gray-600/30 transition-all ${!weeklyGoal.completed ? 'cursor-move hover:border-blue-500/50' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className={`font-semibold ${weeklyGoal.completed ? 'line-through opacity-60 text-gray-500' : 'text-gray-200'}`}>{weeklyGoal.title}</div>
                              <div className="text-xs text-gray-400 mt-1">Week {weeklyGoal.weekNumber}</div>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-purple-600/60 text-white">
                              {getDailyGoalsUnderWeekly(weeklyGoal).length} daily
                            </span>
                          </div>
                          
                          {/* Daily Goals under Weekly */}
                          {getDailyGoalsUnderWeekly(weeklyGoal).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600/30 space-y-1">
                              {getDailyGoalsUnderWeekly(weeklyGoal).map(dailyGoal => (
                                <div key={dailyGoal.id} className="text-sm text-gray-300 flex items-center gap-2 ml-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  <span className={dailyGoal.completed ? 'line-through opacity-60' : ''}>
                                    {dailyGoal.title} ({formatDateLabel(dailyGoal.date)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Weekly Goal Hierarchy */}
              {selectedGoalForDetails.weekNumber && !selectedGoalForDetails.date && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <h3 className="text-lg font-semibold text-green-400 mb-4">Daily Goals</h3>
                  {getDailyGoalsUnderWeekly(selectedGoalForDetails).length === 0 ? (
                    <p className="text-sm text-gray-500">No daily goals under this weekly goal</p>
                  ) : (
                    <div className="space-y-2">
                      {getDailyGoalsUnderWeekly(selectedGoalForDetails).map(dailyGoal => (
                        <div key={dailyGoal.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30 flex items-start gap-3">
                          <div className="flex-1">
                            <div className={`font-semibold ${dailyGoal.completed ? 'line-through opacity-60 text-gray-500' : 'text-gray-200'}`}>{dailyGoal.title}</div>
                            <div className="text-xs text-gray-400 mt-1">{formatDateLabel(dailyGoal.date)}</div>
                          </div>
                          {dailyGoal.completed && (
                            <span className="text-xs px-2 py-1 rounded bg-green-600/60 text-white flex items-center gap-1 flex-shrink-0">
                              <Check className="w-3 h-3" /> Done
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Weekly Goal Reschedule Info */}
              {selectedGoalForDetails.weekNumber && !selectedGoalForDetails.date && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <button
                    onClick={() => setShowRescheduleHistoryWeekly(!showRescheduleHistoryWeekly)}
                    className="w-full flex items-center justify-between hover:bg-gray-800/30 transition-colors p-2 -m-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-orange-400">Reschedule History</h3>
                      {selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-600/40 text-orange-300">
                          {selectedGoalForDetails.rescheduleHistory.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-orange-400 transition-transform ${showRescheduleHistoryWeekly ? 'rotate-0' : '-rotate-90'}`} />
                  </button>

                  {showRescheduleHistoryWeekly && selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2 max-h-64 overflow-y-auto scrollbar-vibrant">
                      {selectedGoalForDetails.rescheduleHistory.map((history, idx) => (
                        <div key={idx} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-300 font-medium">W{history.fromWeek}, {history.fromYear}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-300 font-medium">W{history.toWeek}, {history.toYear}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(history.changedAt).toLocaleDateString('en-US', { 
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(!selectedGoalForDetails.rescheduleHistory || selectedGoalForDetails.rescheduleHistory.length === 0) && (
                    <div className="text-xs text-gray-500 mt-2">No reschedules yet</div>
                  )}
                </div>
              )}

              {/* Daily Goal Reschedule Info */}
              {selectedGoalForDetails.date && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <button
                    onClick={() => setShowRescheduleHistoryDaily(!showRescheduleHistoryDaily)}
                    className="w-full flex items-center justify-between hover:bg-gray-800/30 transition-colors p-2 -m-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-orange-400">Reschedule History</h3>
                      {selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-600/40 text-orange-300">
                          {selectedGoalForDetails.rescheduleHistory.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-orange-400 transition-transform ${showRescheduleHistoryDaily ? 'rotate-0' : '-rotate-90'}`} />
                  </button>

                  {showRescheduleHistoryDaily && selectedGoalForDetails.rescheduleHistory && selectedGoalForDetails.rescheduleHistory.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2 max-h-64 overflow-y-auto scrollbar-vibrant">
                      {selectedGoalForDetails.rescheduleHistory.map((history, idx) => {
                        const formatDateForDisplay = (dateStr) => {
                          const [year, month, day] = dateStr.split('-');
                          return `${day}-${month}-${year}`;
                        };
                        return (
                          <div key={idx} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-blue-300 font-medium">{formatDateForDisplay(history.fromDate)}</span>
                              <span className="text-gray-500">→</span>
                              <span className="text-green-300 font-medium">{formatDateForDisplay(history.toDate)}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(history.changedAt).toLocaleDateString('en-US', { 
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(!selectedGoalForDetails.rescheduleHistory || selectedGoalForDetails.rescheduleHistory.length === 0) && (
                    <div className="text-xs text-gray-500 mt-2">No reschedules yet</div>
                  )}
                </div>
              )}

              {/* Related Daily Goals (for daily goals with same parent) */}
              {selectedGoalForDetails.date && selectedGoalForDetails.parentId && getDailyGoalsUnderDaily(selectedGoalForDetails).length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <h3 className="text-lg font-semibold text-blue-400 mb-4">Related Goals</h3>
                  <div className="space-y-2">
                    {getDailyGoalsUnderDaily(selectedGoalForDetails).map(relatedGoal => (
                      <div key={relatedGoal.id} className="text-sm text-gray-300 flex items-center gap-2 p-2 rounded bg-gray-700/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span className={relatedGoal.completed ? 'line-through opacity-60' : ''}>
                          {relatedGoal.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setShowGoalDetailsModal(false);
                setSelectedGoalForDetails(null);
              }}
              className="w-full mt-6 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white py-3 rounded-xl font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalTrackerApp;

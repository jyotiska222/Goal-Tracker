import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Cloud, LogOut, Menu, X, User, Mail, MapPin, GoalIcon } from 'lucide-react';

// Analog Clock Component
const AnalogClock = ({ size = 'sm' }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDegrees = (hours * 30) + (minutes * 0.5);
  const minuteDegrees = (minutes * 6) + (seconds * 0.1);
  const secondDegrees = seconds * 6;

  const sizeClass = size === 'lg' ? 'w-8 h-8' : 'w-7 h-7';

  return (
    <svg className={`${sizeClass} flex-shrink-0`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="clockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      
      {/* Clock face background */}
      <circle cx="50" cy="50" r="48" fill="url(#clockGradient)" opacity="0.15"/>
      
      {/* Clock face border */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="#a78bfa" strokeWidth="3"/>
      
      {/* Hour markers - colorful */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x1 = 50 + 40 * Math.cos(angle);
        const y1 = 50 + 40 * Math.sin(angle);
        const x2 = 50 + 47 * Math.cos(angle);
        const y2 = 50 + 47 * Math.sin(angle);
        
        // Alternate colors for every 3 hours
        const colors = ['#c084fc', '#a78bfa', '#f97316'];
        const color = colors[Math.floor(i / 4) % 3];
        
        return (
          <line 
            key={i} 
            x1={x1} 
            y1={y1} 
            x2={x2} 
            y2={y2} 
            stroke={color} 
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })}

      {/* Center dot - colorful */}
      <circle cx="50" cy="50" r="3.5" fill="#c084fc"/>
      <circle cx="50" cy="50" r="2" fill="#a78bfa"/>

      {/* Hour hand - bold and colorful */}
      <line
        x1="50"
        y1="50"
        x2={50 + 18 * Math.sin((hourDegrees * Math.PI) / 180)}
        y2={50 - 18 * Math.cos((hourDegrees * Math.PI) / 180)}
        stroke="#c084fc"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Minute hand - bold and colorful */}
      <line
        x1="50"
        y1="50"
        x2={50 + 28 * Math.sin((minuteDegrees * Math.PI) / 180)}
        y2={50 - 28 * Math.cos((minuteDegrees * Math.PI) / 180)}
        stroke="#a78bfa"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Second hand - bold and vibrant */}
      <line
        x1="50"
        y1="50"
        x2={50 + 33 * Math.sin((secondDegrees * Math.PI) / 180)}
        y2={50 - 33 * Math.cos((secondDegrees * Math.PI) / 180)}
        stroke="#f97316"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

// Weather Box Component
const WeatherBox = ({ weather, getWeatherEmoji, isMobile = false }) => {
  if (!weather) {
    return (
      <div className={`flex items-center gap-2 ${isMobile ? 'px-4 py-3 w-full' : 'px-2.5 py-1.5'} rounded-lg bg-blue-900/20 border border-blue-500/20 hover:border-blue-500/40 transition-all`}>
        <Cloud className={`${isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} text-blue-400`} />
        <span className={`${isMobile ? 'text-sm' : 'text-xs'} text-blue-300`}>Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${isMobile ? 'px-4 py-3 w-full rounded-xl' : 'px-4 py-3 rounded-lg h-[56px] min-w-[140px]'} bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-blue-600/10 border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/15 transition-all cursor-pointer group`}>
      <div className={`${isMobile ? 'text-3xl' : 'text-2xl'} group-hover:scale-120 transition-transform flex-shrink-0`}>{getWeatherEmoji(weather.weatherCode)}</div>
      <div className="flex flex-col flex-1 justify-center min-w-0">
        <span className="text-[9px] text-gray-500 font-small tracking-wide leading-tight">Weather</span>
        <span className={`${isMobile ? 'text-lg' : 'text-base'} font-bold text-blue-400 leading-tight`}>{weather.temp}°C</span>
        <span className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">{weather.minTemp}° - {weather.maxTemp}°</span>
      </div>
    </div>
  );
};

// DateTime Box Component
const DateTimeBox = ({ timezone, currentTime, isMobile = false }) => {
  const [timeDisplay, setTimeDisplay] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      
      const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      });

      const date = now.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      setTimeDisplay(time);
      setDateDisplay(date);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [isMobile]);

  return (
    <div className={`flex items-center gap-3 ${isMobile ? 'px-4 py-3 w-full rounded-xl' : 'px-4 py-3 rounded-lg h-[56px] min-w-[160px]'} bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-600/10 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/15 transition-all cursor-pointer group`}>
      <div className="group-hover:scale-110 transition-transform duration-300">
        <AnalogClock size="lg" />
      </div>
      <div className="flex flex-col flex-1 justify-center min-w-0">
        <span className="text-[9px] text-gray-500 font-small tracking-wide leading-tight">Date & Time</span>
        <span className={`${isMobile ? 'text-lg' : 'text-base'} font-bold text-purple-400 leading-tight whitespace-nowrap`}>{timeDisplay}</span>
        <span className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">{dateDisplay}</span>
        {/* <span className="text-[10px] text-gray-400 leading-tight whitespace-nowrap">{timezone}</span> */}
      </div>
    </div>
  );
};

// User Welcome Box Component
const UserWelcomeBox = ({ user, onLogout, isMobile = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0].toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const getFirstName = (name) => {
    return name.split(' ')[0];
  };

  const initials = getInitials(user?.name || user?.username || user?.email?.split('@')[0] || 'User');
  const firstName = getFirstName(user?.name || user?.username || user?.email?.split('@')[0] || 'User');

  if (isMobile) {
    return (
      <div className="w-full space-y-4">
        {/* User Profile Card */}
        <div className="flex items-center gap-4 px-4 py-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-emerald-600/10 border border-emerald-500/20">
          {user?.picture ? (
            <img 
              src={user.picture} 
              alt={user.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/50 shadow-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">{initials}</span>
            </div>
          )}
          
          <div className="flex flex-col flex-1">
            <span className="text-xs text-gray-500 font-semibold tracking-wider">Welcome Back</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5">{firstName}</span>
          </div>
        </div>

        {/* User Details */}
        <div className="space-y-2 px-2">
          {user?.email && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/30">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300 truncate">{user.email}</span>
            </div>
          )}
          
          {user?.timezone && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/30">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{user.timezone}</span>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-3 px-4 py-3 rounded-lg h-[56px] min-w-[180px] bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-emerald-600/10 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/15 transition-all relative cursor-pointer group"
      onMouseEnter={() => setShowDropdown(true)}
      onMouseLeave={() => setShowDropdown(false)}
    >
      {user?.picture ? (
        <img 
          src={user.picture} 
          alt={user.username}
          className="w-9 h-9 rounded-full object-cover border border-emerald-500/50 group-hover:scale-110 transition-transform flex-shrink-0"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <span className="text-white font-bold text-xs">{initials}</span>
        </div>
      )}
      
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="text-[9px] text-gray-500 font-small tracking-wide leading-tight">Welcome Back</span>
        <span className="text-base font-bold text-emerald-400 leading-tight truncate">{firstName}</span>
        <span className="text-[10px] text-gray-400 leading-tight truncate">{user?.email || 'No email'}</span>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-gray-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-lg shadow-2xl p-1.5 min-w-[140px] z-50">
          <button
            onClick={() => {
              onLogout();
              setShowDropdown(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 rounded-md transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Mobile Sidebar Component
const MobileSidebar = ({ isOpen, onClose, systemStatus, weather, getWeatherEmoji, currentUser, currentTime, handleLogout }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 bg-gradient-to-b from-gray-900 via-gray-900/98 to-gray-900 border-l border-blue-500/20 shadow-2xl z-50 transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                Menu
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800/60 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400 hover:text-white transition-colors" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-custom">
            {/* System Status */}
            {/* <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/40 border border-blue-500/20">
              <span className="text-sm font-medium text-gray-300">System Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${systemStatus.changesSaved ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-semibold text-gray-300">{systemStatus.changesSaved ? 'Online' : 'Offline'}</span>
              </div>
            </div> */}

            {/* User Info */}
            <UserWelcomeBox 
              user={currentUser} 
              onLogout={() => {
                handleLogout();
                onClose();
              }} 
              isMobile={true}
            />

            {/* Weather */}
            <WeatherBox 
              weather={weather} 
              getWeatherEmoji={getWeatherEmoji}
              isMobile={true}
            />

            {/* DateTime */}
            <DateTimeBox 
              timezone={currentUser?.timezone || 'UTC'} 
              currentTime={currentTime}
              isMobile={true}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-800/50">
            <p className="text-xs text-center text-gray-500">
              Goal Tracker
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

// Main NavBar Component
const NavBar = ({ systemStatus, weather, getWeatherEmoji, currentUser, currentTime, handleLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="bg-gradient-to-r from-gray-900/98 via-gray-900/95 to-gray-900/98 border-b border-blue-500/20 backdrop-blur-xl sticky top-0 z-30 shadow-xl">
        <div className="px-4 sm:px-6 py-3 w-full">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600/30 to-blue-700/20 rounded-lg shadow-lg">
                <GoalIcon className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                  Goal Tracker
                </h1>
                <div
                  className={`w-3 h-3 rounded-full animate-pulse shadow-lg flex-shrink-0 ${systemStatus.changesSaved
                    ? 'bg-green-500 shadow-green-500/60'
                    : 'bg-red-500 shadow-red-500/60'
                  }`}
                ></div>
              </div>
            </div>
                      {/* Desktop Right side - Pills/Compact boxes */}
                      <div className="hidden lg:flex items-center gap-3">
                          {/* Weather Pill */}
                          <WeatherBox weather={weather} getWeatherEmoji={getWeatherEmoji} />

                          {/* DateTime Pill */}
              <DateTimeBox 
                timezone={currentUser?.timezone || 'UTC'} 
                currentTime={currentTime}
              />

              {/* User Welcome Pill with Dropdown */}
              <UserWelcomeBox user={currentUser} onLogout={handleLogout} />
            </div>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 hover:border-blue-500/50 transition-all"
            >
              <Menu className="w-5 h-5 text-blue-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        systemStatus={systemStatus}
        weather={weather}
        getWeatherEmoji={getWeatherEmoji}
        currentUser={currentUser}
        currentTime={currentTime}
        handleLogout={handleLogout}
      />
    </>
  );
};

export default NavBar;
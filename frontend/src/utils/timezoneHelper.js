/**
 * Timezone Helper - Converts between user's local timezone and UTC
 * Uses browser's timezone detection via Intl API
 */

/**
 * Get user's timezone from browser
 * @returns {string} IANA timezone string (e.g., 'Asia/Kolkata', 'America/New_York')
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get timezone offset in hours from UTC
 * @param {Date} date - Date to check offset for
 * @returns {number} Hours offset from UTC
 */
export const getTimezoneOffset = (date = new Date()) => {
  return -date.getTimezoneOffset() / 60;
};

/**
 * Format a date in the user's local timezone as YYYY-MM-DD
 * @param {Date|string} date - Date to format
 * @returns {string} YYYY-MM-DD format in local timezone
 */
export const formatDateLocal = (date) => {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date in YYYY-MM-DD format (user's local timezone)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayLocal = () => {
  return formatDateLocal(new Date());
};

/**
 * Convert UTC date string to local timezone
 * @param {string} utcDateStr - Date string in ISO format (UTC)
 * @returns {Date} Date in user's local timezone
 */
export const convertFromUTC = (utcDateStr) => {
  if (!utcDateStr) return null;
  return new Date(utcDateStr);
};

/**
 * Convert local date to UTC ISO string
 * @param {Date|string} localDate - Date in user's local timezone
 * @returns {string} ISO string in UTC
 */
export const convertToUTC = (localDate) => {
  if (typeof localDate === 'string') {
    localDate = new Date(localDate);
  }
  return localDate.toISOString();
};

/**
 * Get local time as HH:MM:SS with AM/PM
 * @param {Date} date - Date to format (defaults to now)
 * @returns {string} Formatted time string
 */
export const getLocalTime = (date = new Date()) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

/**
 * Get local date and time in readable format
 * @param {Date} date - Date to format
 * @returns {string} Formatted date and time string
 */
export const getLocalDateTime = (date = new Date()) => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Check if two dates are the same day (in user's local timezone)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export const isSameDayLocal = (date1, date2) => {
  return formatDateLocal(date1) === formatDateLocal(date2);
};

/**
 * Check if given date is today (in user's local timezone)
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isTodayLocal = (date) => {
  return isSameDayLocal(date, new Date());
};

/**
 * Get date at start of day in user's local timezone
 * @param {Date} date - Date to use
 * @returns {Date} Date at 00:00:00 in local timezone
 */
export const getStartOfDayLocal = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get date at end of day in user's local timezone
 * @param {Date} date - Date to use
 * @returns {Date} Date at 23:59:59 in local timezone
 */
export const getEndOfDayLocal = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Get ISO week number for a date (ISO 8601)
 * @param {Date} date - Date to get week number for
 * @returns {number} Week number (1-53)
 */
export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/**
 * Get start of ISO week (Monday)
 * @param {Date} date - Date in the week
 * @returns {Date} Monday of that week
 */
export const getWeekStart = (date) => {
  const d = new Date(date);
  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = d.getDay();
  // Calculate offset to reach Monday
  // If Sunday (0), go forward 1 day to Monday; otherwise go back (day - 1) days
  const offset = day === 0 ? 1 : -(day - 1);
  d.setDate(d.getDate() + offset);
  return d;
};

/**
 * Get end of ISO week (Sunday)
 * @param {Date} date - Date in the week
 * @returns {Date} Sunday of that week
 */
export const getWeekEnd = (date) => {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
};

/**
 * Date utility functions for consistent IST (Indian Standard Time) formatting
 */

/**
 * Format a date string to IST (Indian Standard Time)
 * Handles UTC timestamps from the backend and converts them to IST
 * @param dateString - ISO date string from backend (UTC)
 * @returns Formatted date string in IST
 */
export const formatToIST = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    // Ensure the date is treated as UTC by appending 'Z' if not present
    let utcDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      utcDateString = dateString + 'Z';
    }
    
    // Parse the UTC date and convert to IST (Indian Standard Time)
    const date = new Date(utcDateString);
    
    // Format with IST timezone
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    return `${formatted} IST`;
  } catch {
    return dateString;
  }
};

/**
 * Format a date string to IST date only (no time)
 * @param dateString - ISO date string from backend (UTC)
 * @returns Formatted date string in IST (date only)
 */
export const formatDateToIST = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    let utcDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      utcDateString = dateString + 'Z';
    }
    
    const date = new Date(utcDateString);
    
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  } catch {
    return dateString;
  }
};

/**
 * Format a date string to IST time only (no date)
 * @param dateString - ISO date string from backend (UTC)
 * @returns Formatted time string in IST
 */
export const formatTimeToIST = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    let utcDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      utcDateString = dateString + 'Z';
    }
    
    const date = new Date(utcDateString);
    
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return dateString;
  }
};

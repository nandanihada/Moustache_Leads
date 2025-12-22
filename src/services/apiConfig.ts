/**
 * Centralized API Configuration
 * Detects environment and returns the correct API base URL
 */

export const getApiBaseUrl = (): string => {
  // Check environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Detect based on frontend hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // Vercel deployment - use Render backend
  if (hostname.includes('vercel.app') || hostname.includes('moustache-leads')) {
    return 'https://moustacheleads-backend.onrender.com';
  }

  // theinterwebsite.space deployment
  if (hostname.includes('theinterwebsite.space')) {
    return 'https://api.theinterwebsite.space';
  }

  // Local network IP (192.168.x.x or 10.x.x.x) - use same IP with port 5000
  if (hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
    return `http://${hostname}:5000`;
  }

  // Default fallback - use HTTPS for production
  return `${protocol}//${hostname}`;
};

// Export the API base URL
export const API_BASE_URL = getApiBaseUrl();

// Log for debugging
console.log('🌐 API Configuration:');
console.log('  Hostname:', window.location.hostname);
console.log('  API Base URL:', API_BASE_URL);

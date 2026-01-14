// Cookie utilities for cross-subdomain authentication

export const setCookie = (name: string, value: string, days: number = 7) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Set cookie for all subdomains of moustacheleads.com
  const domain = window.location.hostname.includes('moustacheleads.com') 
    ? '.moustacheleads.com' 
    : window.location.hostname;
  
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;domain=${domain};secure;samesite=lax`;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  
  return null;
};

export const deleteCookie = (name: string) => {
  const domain = window.location.hostname.includes('moustacheleads.com') 
    ? '.moustacheleads.com' 
    : window.location.hostname;
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain}`;
};

// Sync with localStorage for backward compatibility
export const setAuthToken = (token: string) => {
  setCookie('auth_token', token, 7);
  localStorage.setItem('token', token);
};

export const getAuthToken = (): string | null => {
  // Try cookie first, fallback to localStorage
  return getCookie('auth_token') || localStorage.getItem('token');
};

export const setAuthUser = (user: any) => {
  const userStr = JSON.stringify(user);
  setCookie('auth_user', userStr, 7);
  localStorage.setItem('user', userStr);
};

export const getAuthUser = (): any | null => {
  // Try cookie first, fallback to localStorage
  const cookieUser = getCookie('auth_user');
  if (cookieUser) {
    try {
      return JSON.parse(cookieUser);
    } catch (e) {
      console.error('Failed to parse user cookie:', e);
    }
  }
  
  const localUser = localStorage.getItem('user');
  if (localUser) {
    try {
      return JSON.parse(localUser);
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
    }
  }
  
  return null;
};

export const clearAuth = () => {
  deleteCookie('auth_token');
  deleteCookie('auth_user');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

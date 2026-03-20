import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuthToken, getAuthUser, setAuthToken, setAuthUser, clearAuth } from '../utils/cookies';
import { clearPlacementCache } from '../hooks/usePlacementApproval';
import { upsertSession, clearAllSessions } from '../components/AccountSwitcher';

interface User {
  id: string;
  username?: string;
  email: string;
  role?: string;
  account_status?: string;  // pending_approval, approved, rejected
  email_verified?: boolean;
  user_type?: 'publisher' | 'advertiser';
  first_name?: string;
  last_name?: string;
  company_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  isAdmin: boolean;
  isAdminOrSubadmin: boolean;
  isAccountApproved: boolean;  // New: check if account is approved
  isPublisher: boolean;
  isAdvertiser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on app load (from cookies or localStorage)
    const storedToken = getAuthToken();
    const storedUser = getAuthUser();

    if (storedToken && storedUser) {
      // Verify token is still valid with the backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      fetch(`${API_URL}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`
        }
      })
        .then(res => {
          if (res.ok) {
            setToken(storedToken);
            setUser(storedUser);
          } else {
            // Token is invalid/expired — clear everything
            console.warn('Stored token is invalid, clearing auth');
            clearAuth();
          }
        })
        .catch(() => {
          // Network error — still use stored token (offline-friendly)
          setToken(storedToken);
          setUser(storedUser);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // Store in both cookies (for cross-subdomain) and localStorage (for backward compatibility)
    setAuthToken(newToken);
    setAuthUser(newUser);
    // Save to multi-account sessions
    upsertSession(newToken, {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      user_type: newUser.user_type,
      account_status: newUser.account_status,
    });
    // Mark that this is a fresh login so the support popup fires
    sessionStorage.setItem('just_logged_in', '1');
    sessionStorage.removeItem(`support_popup_shown_${newUser.id}`);
  };

  const logout = async () => {
    // Call backend logout endpoint if we have a session_id
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ session_id: sessionId })
        });
      } catch (error) {
        console.error('Logout tracking error:', error);
      }
    }

    // Clear local storage and cookies
    setToken(null);
    setUser(null);
    clearAuth();
    clearPlacementCache(); // Clear placement cache on logout
    clearAllSessions(); // Clear all multi-account sessions
    localStorage.removeItem('session_id');
    localStorage.removeItem('gift_promo_popup_dismissed'); // Reset popup so it shows on next login
    localStorage.removeItem('gift_card_popup_dismissed');
    localStorage.removeItem('promo_code_popup_dismissed');
    // Reset support popup so it fires again on next login
    sessionStorage.removeItem('support_reply_checked');
  };

  // Check if account is approved (admins are always approved)
  // Legacy users without account_status are treated as pending
  const isAccountApproved = user?.role === 'admin' || user?.role === 'subadmin' || user?.account_status === 'approved';
  
  // User type checks
  const isPublisher = user?.user_type === 'publisher' || !user?.user_type; // Default to publisher for legacy users
  const isAdvertiser = user?.user_type === 'advertiser';

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    loading,
    isAdmin: user?.role === 'admin',
    isAdminOrSubadmin: user?.role === 'admin' || user?.role === 'subadmin',
    isAccountApproved,
    isPublisher,
    isAdvertiser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

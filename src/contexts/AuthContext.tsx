import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuthToken, getAuthUser, setAuthToken, setAuthUser, clearAuth } from '../utils/cookies';

interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
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
      setToken(storedToken);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // Store in both cookies (for cross-subdomain) and localStorage (for backward compatibility)
    setAuthToken(newToken);
    setAuthUser(newUser);
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
    localStorage.removeItem('session_id');
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    loading,
    isAdmin: user?.role === 'admin',
    isAdminOrSubadmin: user?.role === 'admin' || user?.role === 'subadmin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setAuthToken, setAuthUser, getAuthToken } from '@/utils/cookies';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StoredSession {
  token: string;
  user: {
    id: string;
    username?: string;
    email: string;
    role?: string;
    user_type?: string;
    account_status?: string;
  };
}

const SESSIONS_KEY = 'ml_sessions';

// Get all stored sessions
const getSessions = (): StoredSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

// Save sessions
const saveSessions = (sessions: StoredSession[]) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

// Add or update a session
export const upsertSession = (token: string, user: StoredSession['user']) => {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.user.id === user.id);
  if (idx >= 0) {
    sessions[idx] = { token, user };
  } else {
    sessions.push({ token, user });
  }
  saveSessions(sessions);
};

// Remove a session
const removeSession = (userId: string) => {
  const sessions = getSessions().filter(s => s.user.id !== userId);
  saveSessions(sessions);
};

// Clear all sessions
export const clearAllSessions = () => {
  localStorage.removeItem(SESSIONS_KEY);
};

const AccountSwitcher: React.FC = () => {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  // Sync current session into stored sessions whenever auth changes
  useEffect(() => {
    if (token && user) {
      upsertSession(token, {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_type: user.user_type,
        account_status: user.account_status,
      });
    }
    setSessions(getSessions());
  }, [token, user]);

  const switchTo = (session: StoredSession) => {
    if (session.user.id === user?.id) return; // Already active

    // Save current session first
    if (token && user) {
      upsertSession(token, {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_type: user.user_type,
        account_status: user.account_status,
      });
    }

    // Switch to selected session
    login(session.token, session.user as any);

    // Navigate to appropriate dashboard
    if (session.user.role === 'admin' || session.user.role === 'subadmin') {
      navigate('/admin');
    } else if (session.user.user_type === 'advertiser') {
      navigate('/advertiser');
    } else {
      navigate('/dashboard');
    }
  };

  const removeAccount = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (userId === user?.id) return; // Can't remove active session
    removeSession(userId);
    setSessions(getSessions());
  };

  const addNewAccount = () => {
    // Save current session before navigating to login
    if (token && user) {
      upsertSession(token, {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        user_type: user.user_type,
        account_status: user.account_status,
      });
    }
    // Navigate to login without logging out
    navigate('/publisher/signin?add_account=true');
  };

  const getRoleBadge = (session: StoredSession) => {
    const role = session.user.role;
    if (role === 'admin') return <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">Admin</Badge>;
    if (role === 'subadmin') return <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0">Subadmin</Badge>;
    if (session.user.user_type === 'advertiser') return <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">Advertiser</Badge>;
    return <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">Publisher</Badge>;
  };

  if (!user || sessions.length <= 1) {
    // Show a minimal "Add Account" button if only one session
    return (
      <Button variant="ghost" size="sm" onClick={addNewAccount} className="gap-1.5 text-xs h-8">
        <Plus className="h-3.5 w-3.5" />
        Add Account
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <Users className="h-3.5 w-3.5" />
          {user.username || user.email}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sessions.map((session) => (
          <DropdownMenuItem
            key={session.user.id}
            onClick={() => switchTo(session)}
            className={`flex items-center justify-between cursor-pointer ${session.user.id === user.id ? 'bg-accent' : ''}`}
          >
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{session.user.username || session.user.email}</span>
                {session.user.id === user.id && (
                  <span className="text-[10px] text-muted-foreground">(active)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {getRoleBadge(session)}
                <span className="text-[10px] text-muted-foreground truncate">{session.user.email}</span>
              </div>
            </div>
            {session.user.id !== user.id && (
              <button
                onClick={(e) => removeAccount(e, session.user.id)}
                className="ml-2 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remove account"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={addNewAccount} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Add another account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountSwitcher;

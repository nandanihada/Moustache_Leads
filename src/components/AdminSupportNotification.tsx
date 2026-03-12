import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, ExternalLink } from 'lucide-react';
import { supportApi, SupportMessage } from '@/services/supportApi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'admin_support_dismissed_at';
const POLL_INTERVAL = 60_000; // 1 minute

const AdminSupportNotification: React.FC = () => {
  const { isAdmin, isAdminOrSubadmin } = useAuth();
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState<SupportMessage[]>([]);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnread = async () => {
    try {
      const res = await supportApi.adminGetAll('open');
      if (!res.success) return;
      const unread = res.messages.filter(m => !m.read_by_admin);
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      const newOnes = dismissedAt
        ? unread.filter(m => new Date(m.created_at) > new Date(dismissedAt))
        : unread;
      if (newOnes.length > 0) {
        setUnreadMessages(newOnes);
        setVisible(true);
        setDismissed(false);
      }
    } catch {
      // silently fail — this is a non-critical background poll
    }
  };

  useEffect(() => {
    if (!isAdminOrSubadmin) return;
    fetchUnread();
    timerRef.current = setInterval(fetchUnread, POLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAdminOrSubadmin]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
    setDismissed(true);
  };

  const handleGoToInbox = () => {
    handleDismiss();
    navigate('/support-inbox');
  };

  if (!visible || dismissed || unreadMessages.length === 0) return null;

  const preview = unreadMessages[0];

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[8px] font-bold">{unreadMessages.length}</span>
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">New Support Message{unreadMessages.length > 1 ? 's' : ''}</span>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(preview.username || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{preview.username || preview.email}</p>
              <p className="text-xs text-muted-foreground truncate">{preview.subject}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 pl-9">{preview.body}</p>
          {unreadMessages.length > 1 && (
            <p className="text-xs text-primary pl-9">+{unreadMessages.length - 1} more unread message{unreadMessages.length > 2 ? 's' : ''}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={handleGoToInbox}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Inbox
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-xs border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSupportNotification;

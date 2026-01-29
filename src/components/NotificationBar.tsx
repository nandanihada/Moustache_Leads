import React from 'react';
import { 
  Bell, 
  Gift, 
  Tag, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  AlertTriangle,
  Clock
} from 'lucide-react';

export interface Notification {
  id: string;
  type: string;
  icon: string;
  title: string;
  message: string;
  timestamp: string;
  time_ago: string;
  color: string;
}

// Storage key for seen notifications
const SEEN_NOTIFICATIONS_KEY = 'seen_notifications';
const NOTIFICATION_EXPIRY_HOURS = 24;

// Get seen notifications from localStorage
const getSeenNotifications = (): Record<string, number> => {
  try {
    const stored = localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Save seen notifications to localStorage
const saveSeenNotifications = (seen: Record<string, number>) => {
  localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify(seen));
};

// Mark a notification as seen
export const markNotificationAsSeen = (notificationId: string) => {
  const seen = getSeenNotifications();
  seen[notificationId] = Date.now();
  saveSeenNotifications(seen);
};

// Clear all seen notifications (useful for testing/debugging)
export const clearSeenNotifications = () => {
  localStorage.removeItem(SEEN_NOTIFICATIONS_KEY);
  console.log('📬 Cleared all seen notifications from localStorage');
};

// Check if notification is seen or expired
const isNotificationVisible = (notificationId: string, timestamp?: string): boolean => {
  const seen = getSeenNotifications();
  
  // If already seen, don't show
  if (seen[notificationId]) {
    return false;
  }
  
  // If older than 24 hours, don't show
  if (timestamp) {
    const notificationTime = new Date(timestamp).getTime();
    const now = Date.now();
    const hoursDiff = (now - notificationTime) / (1000 * 60 * 60);
    if (hoursDiff > NOTIFICATION_EXPIRY_HOURS) {
      return false;
    }
  }
  
  return true;
};

// Filter notifications based on rules
export const filterNotifications = (notifications: Notification[]): Notification[] => {
  // Clean up old seen notifications (older than 7 days)
  const seen = getSeenNotifications();
  console.log('📬 Seen notifications in localStorage:', seen);
  
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const cleanedSeen: Record<string, number> = {};
  
  Object.entries(seen).forEach(([id, time]) => {
    if (time > sevenDaysAgo) {
      cleanedSeen[id] = time;
    }
  });
  saveSeenNotifications(cleanedSeen);
  
  // Filter to only unseen and not expired notifications
  const visible = notifications.filter(n => {
    const isVisible = isNotificationVisible(n.id, n.timestamp);
    if (!isVisible) {
      console.log(`📬 Notification ${n.id} (${n.title}) filtered out - seen: ${!!seen[n.id]}, timestamp: ${n.timestamp}`);
    }
    return isVisible;
  });
  
  console.log(`📬 Visible notifications: ${visible.length} out of ${notifications.length}`);
  
  // Limit to max 3
  return visible.slice(0, 3);
};

// Get icon component
export const getNotificationIcon = (iconName: string, color: string) => {
  const colorClass = {
    green: 'text-green-500',
    red: 'text-red-500',
    orange: 'text-orange-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
  }[color] || 'text-gray-500';

  const iconProps = { className: `h-4 w-4 ${colorClass}` };

  switch (iconName) {
    case 'gift':
      return <Gift {...iconProps} />;
    case 'tag':
      return <Tag {...iconProps} />;
    case 'check-circle':
      return <CheckCircle {...iconProps} />;
    case 'x-circle':
      return <XCircle {...iconProps} />;
    case 'dollar-sign':
      return <DollarSign {...iconProps} />;
    case 'alert-triangle':
      return <AlertTriangle {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
};

// The NotificationBar component is now deprecated - notifications are shown in the bell icon dropdown
// This component is kept for backward compatibility but returns null
const NotificationBar: React.FC = () => {
  // Notifications are now shown in the TopBar bell icon dropdown
  return null;
};

export default NotificationBar;

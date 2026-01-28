import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Gift, 
  Tag, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Clock
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

interface Notification {
  id: string;
  type: string;
  icon: string;
  title: string;
  message: string;
  timestamp: string;
  time_ago: string;
  color: string;
}

const NotificationBar: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [hasApprovedPlacement, setHasApprovedPlacement] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate notifications every 5 seconds
  useEffect(() => {
    if (notifications.length <= 1 || isPaused) return;
    
    const rotateInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notifications.length);
    }, 5000);
    
    return () => clearInterval(rotateInterval);
  }, [notifications.length, isPaused]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/dashboard/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setHasApprovedPlacement(data.has_approved_placement !== false);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string, color: string) => {
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

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + notifications.length) % notifications.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
  };

  // Don't show notification bar if loading or no notifications
  if (!isVisible || loading || notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[currentIndex];

  return (
    <div 
      className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-full mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevious}
              className="p-1 hover:bg-purple-100 rounded transition-colors"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4 text-purple-600" />
            </button>
          </div>

          {/* Center: Notification Content */}
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              {getIcon(currentNotification.icon, currentNotification.color)}
              <span className="font-medium text-sm text-gray-800 hidden sm:inline">
                {currentNotification.title}
              </span>
            </div>
            <span className="text-sm text-gray-600 truncate">
              {currentNotification.message}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0 hidden md:inline">
              {currentNotification.time_ago}
            </span>
          </div>

          {/* Right: Navigation & Close */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToNext}
              className="p-1 hover:bg-purple-100 rounded transition-colors"
              title="Next"
            >
              <ChevronRight className="h-4 w-4 text-purple-600" />
            </button>
            
            {/* Notification counter */}
            <span className="text-xs text-purple-600 font-medium px-2">
              {currentIndex + 1}/{notifications.length}
            </span>
            
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-purple-100 rounded transition-colors ml-1"
              title="Dismiss"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        {notifications.length > 1 && (
          <div className="flex justify-center gap-1 mt-1">
            {notifications.slice(0, 10).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentIndex ? 'bg-purple-500' : 'bg-purple-200'
                }`}
              />
            ))}
            {notifications.length > 10 && (
              <span className="text-xs text-purple-400">+{notifications.length - 10}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationBar;

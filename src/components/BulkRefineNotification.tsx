import React, { useState, useEffect, useCallback } from 'react';
import { offerwallManagerApi } from '@/services/offerwallManagerApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, X, Sparkles, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface BulkRefineNotificationProps {
  onViewOffers?: (offerIds: string[]) => void;
}

// Play a pleasant notification chime using Web Audio API (~2 seconds)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Create a pleasant two-tone chime
    const notes = [
      { freq: 587.33, start: 0, duration: 0.3 },    // D5
      { freq: 880, start: 0.2, duration: 0.4 },      // A5
      { freq: 1174.66, start: 0.5, duration: 0.6 },  // D6
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.3, now + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration + 0.1);
    });

    // Close context after sound finishes
    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Silently fail if audio not supported
  }
};

const BulkRefineNotification: React.FC<BulkRefineNotificationProps> = ({ onViewOffers }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await offerwallManagerApi.getBulkRefineNotifications();
      if (data.notifications && data.notifications.length > 0) {
        // Play sound if new notifications appeared
        if (data.notifications.length > notifications.length || (!visible && data.notifications.length > 0)) {
          playNotificationSound();
        }
        setNotifications(data.notifications);
        setVisible(true);
      } else {
        setNotifications([]);
        setVisible(false);
      }
    } catch {
      // Silently fail
    }
  }, [notifications.length, visible]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleDismiss = async (jobId: string) => {
    try {
      await offerwallManagerApi.markBulkRefineNotificationRead(jobId);
      setNotifications((prev) => prev.filter((n) => n.job_id !== jobId));
      if (notifications.length <= 1) setVisible(false);
    } catch {
      // ignore
    }
  };

  const handleMarkReviewed = async (notification: any) => {
    try {
      await offerwallManagerApi.markOffersReviewed(notification.offer_ids);
      await offerwallManagerApi.markBulkRefineNotificationRead(notification.job_id);
      setNotifications((prev) => prev.filter((n) => n.job_id !== notification.job_id));
      if (notifications.length <= 1) setVisible(false);
      toast.success('Offers marked as reviewed — highlight removed');
    } catch {
      toast.error('Failed to mark reviewed');
    }
  };

  if (!visible || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notif) => (
        <div
          key={notif.job_id}
          className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 dark:bg-amber-900 rounded-full p-2">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Bulk Refinement Complete
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-auto"
                  onClick={() => handleDismiss(notif.job_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {notif.message || `${notif.completed}/${notif.total} offers refined (${notif.field})`}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {notif.completed} done
                </Badge>
                {notif.failed > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {notif.failed} failed
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {onViewOffers && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                    onClick={() => onViewOffers(notif.offer_ids)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Offers
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => handleMarkReviewed(notif)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mark All Reviewed
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BulkRefineNotification;

import { Bell, Moon, Sun, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/services/apiConfig";
import { 
  Notification, 
  filterNotifications, 
  markNotificationAsSeen, 
  getNotificationIcon 
} from "@/components/NotificationBar";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [earnings, setEarnings] = useState<{ monthly: number; nextPayout: string } | null>(null);
  const [hasApprovedPlacement, setHasApprovedPlacement] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/dashboard/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const allNotifications = data.notifications || [];
        console.log('📬 Raw notifications from API:', allNotifications);
        // Apply filtering rules (unseen, not expired, max 3)
        const filtered = filterNotifications(allNotifications);
        console.log('📬 Filtered notifications:', filtered);
        setNotifications(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkPlacementAndFetchData();
    }
  }, [user]);

  const checkPlacementAndFetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Check placement status
      const placementResponse = await fetch(`${API_BASE_URL}/api/placements`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (placementResponse.ok) {
        const placementData = await placementResponse.json();
        const placements = placementData.placements || [];
        const approved = placements.some((p: any) => p.approvalStatus === 'APPROVED');
        setHasApprovedPlacement(approved);

        // Always fetch notifications (they include placement-related ones)
        fetchNotifications();
        
        if (approved) {
          fetchEarnings();
        }
      }
    } catch (error) {
      console.error('Failed to check placement status:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setEarnings({
            monthly: data.stats.total_revenue || 0,
            nextPayout: data.stats.next_payout || 'N/A'
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    markNotificationAsSeen(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleDismissAll = () => {
    notifications.forEach(n => markNotificationAsSeen(n.id));
    setNotifications([]);
    setIsNotificationOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="h-16 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-8">
          {/* Only show earnings for users with approved placement */}
          {hasApprovedPlacement && earnings && (
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="text-muted-foreground">Monthly Earnings:</span>
                <span className="ml-2 font-semibold text-primary">${earnings.monthly.toFixed(2)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Next Payout:</span>
                <span className="ml-2 font-semibold">{earnings.nextPayout}</span>
              </div>
            </div>
          )}
          {!hasApprovedPlacement && user && (
            <div className="text-sm text-muted-foreground">
              Create a placement to start earning
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <DropdownMenu open={isNotificationOpen} onOpenChange={(open) => {
            setIsNotificationOpen(open);
            // Refresh notifications when dropdown is opened
            if (open) {
              fetchNotifications();
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold text-sm">Notifications</span>
                {notifications.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-auto py-1 px-2"
                    onClick={handleDismissAll}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 border-b last:border-b-0"
                    >
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.icon, notification.color)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time_ago}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/dashboard/profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
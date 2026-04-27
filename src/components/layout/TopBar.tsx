import { Bell, Moon, Sun, User, X, MessageCircle } from "lucide-react";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAuthToken } from "@/utils/cookies";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [earnings, setEarnings] = useState<{ monthly: number; nextPayout: string } | null>(null);
  const [hasApprovedPlacement, setHasApprovedPlacement] = useState(false);
  const [supportNotification, setSupportNotification] = useState<{ count: number; preview: string | null } | null>(null);

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

  const fetchSupportNotification = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/support/unread-replies`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res.success && res.unread_count > 0) {
        setSupportNotification({ count: res.unread_count, preview: res.preview });
      } else {
        setSupportNotification(null);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkPlacementAndFetchData();
      fetchSupportNotification();
      // Poll support notifications every 60s
      const interval = setInterval(fetchSupportNotification, 60_000);
      return () => clearInterval(interval);
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

  const totalNotificationCount = notifications.length + (supportNotification ? 1 : 0);

  const handleDismissSupportNotification = () => {
    setSupportNotification(null);
  };

  const handleDismissAll = () => {
    notifications.forEach(n => markNotificationAsSeen(n.id));
    setNotifications([]);
    setSupportNotification(null);
    setIsNotificationOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="h-14 sm:h-16 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
      <div className="flex items-center justify-between h-full px-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8 min-w-0 flex-1">
          {/* Sidebar toggle — always visible */}
          <SidebarTrigger className="h-9 w-9" />
          
          {/* Only show earnings for users with approved placement */}
          {hasApprovedPlacement && earnings && (
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
              <div className="hidden sm:block">
                <span className="text-muted-foreground">Monthly Earnings:</span>
                <span className="ml-2 font-semibold text-primary">${earnings.monthly.toFixed(2)}</span>
              </div>
              <div className="sm:hidden">
                <span className="font-semibold text-primary">${earnings.monthly.toFixed(2)}</span>
              </div>
              <div className="hidden md:block">
                <span className="text-muted-foreground">Next Payout:</span>
                <span className="ml-2 font-semibold">{earnings.nextPayout}</span>
              </div>
            </div>
          )}
          {!hasApprovedPlacement && user && (
            <div className="text-xs sm:text-sm text-muted-foreground truncate">
              <span className="hidden sm:inline">Create a placement to start earning</span>
              <span className="sm:hidden">Create placement</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
              fetchSupportNotification();
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {totalNotificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {totalNotificationCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold text-sm">Notifications</span>
                {totalNotificationCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-auto py-1 px-2"
                    onClick={() => {
                      handleDismissAll();
                      handleDismissSupportNotification();
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              {totalNotificationCount === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {/* Support reply notification */}
                  {supportNotification && (
                    <div 
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 border-b cursor-pointer bg-primary/5"
                      onClick={() => {
                        handleDismissSupportNotification();
                        setIsNotificationOpen(false);
                        navigate('/dashboard/support');
                      }}
                    >
                      <div className="mt-0.5">
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Admin: New reply in support</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {supportNotification.preview || `You have ${supportNotification.count} unread support ${supportNotification.count === 1 ? 'reply' : 'replies'}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismissSupportNotification();
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
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
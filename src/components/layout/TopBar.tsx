import { Bell, Moon, Sun, User } from "lucide-react";
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
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/services/apiConfig";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [earnings, setEarnings] = useState<{ monthly: number; nextPayout: string } | null>(null);
  const [hasApprovedPlacement, setHasApprovedPlacement] = useState(false);

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

        if (approved) {
          fetchNotificationCount();
          fetchEarnings();
        }
      }
    } catch (error) {
      console.error('Failed to check placement status:', error);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/dashboard/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
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

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                {notificationCount > 9 ? '9+' : notificationCount}
              </Badge>
            )}
          </Button>

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
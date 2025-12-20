import {
  Shield,
  Gift,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ArrowLeft,
  Handshake,
  Activity,
  Inbox,
  FileText,
  Monitor,
  TestTube,
  CheckSquare,
  UserCheck,
  Zap,
  Wallet,
  TrendingUp,
  AlertTriangle,
  MousePointerClick,
  LogIn,
  UserCog
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import subadminService from "@/services/subadminService";

const adminMenuItems = [
  { title: "Overview", url: "/admin", icon: Shield, tab: "overview" },
  { title: "Offers", url: "/admin/offers", icon: Gift, tab: "offers" },
  { title: "Promo Codes", url: "/admin/promo-codes", icon: Zap, tab: "promo-codes" },
  { title: "Gift Cards", url: "/admin/gift-cards", icon: Gift, tab: "gift-cards" },
  { title: "Bonus Management", url: "/admin/bonus-management", icon: Wallet, tab: "bonus-management" },
  { title: "Offer Access Requests", url: "/admin/offer-access-requests", icon: UserCheck, tab: "offer-access-requests" },
  { title: "Placement Approval", url: "/admin/placement-approval", icon: CheckSquare, tab: "placement-approval" },
  { title: "Offerwall Analytics", url: "/admin/offerwall-analytics", icon: TrendingUp, tab: "offerwall-analytics" },
  { title: "Comprehensive Analytics", url: "/admin/comprehensive-analytics", icon: BarChart3, tab: "comprehensive-analytics" },
  { title: "Click Tracking", url: "/admin/click-tracking", icon: MousePointerClick, tab: "click-tracking" },
  { title: "Login Logs", url: "/admin/login-logs", icon: LogIn, tab: "login-logs" },
  { title: "Active Users", url: "/admin/active-users", icon: UserCog, tab: "active-users" },
  { title: "Subadmin Management", url: "/admin/subadmin-management", icon: Shield, tab: "subadmin-management" },
  { title: "Fraud Management", url: "/admin/fraud-management", icon: AlertTriangle, tab: "fraud-management" },
  { title: "Reports", url: "/admin/reports", icon: FileText, tab: "reports" },
  { title: "Tracking", url: "/admin/tracking", icon: Monitor, tab: "tracking" },
  { title: "Test Tracking", url: "/admin/test-tracking", icon: TestTube, tab: "test-tracking" },
  { title: "Partners", url: "/admin/partners", icon: Handshake, tab: "partners" },
  { title: "Postback Receiver", url: "/admin/postback-receiver", icon: Inbox, tab: "postback-receiver" },
  { title: "Postback Logs", url: "/admin/postback-logs", icon: Activity, tab: "postback-logs" },
  { title: "Users", url: "/admin/users", icon: Users, tab: "publishers" },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3, tab: "analytics" },
  { title: "Settings", url: "/admin/settings", icon: Settings, tab: "settings" },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        if (user?.role === 'admin') {
          // Admin sees all tabs
          setAllowedTabs(adminMenuItems.map(item => item.tab));
        } else if (user?.role === 'subadmin') {
          // Fetch subadmin permissions
          const perms = await subadminService.getMyPermissions();
          setAllowedTabs(perms.allowed_tabs);
        } else {
          // Other roles see no tabs
          setAllowedTabs([]);
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        // On error, show no tabs for safety
        setAllowedTabs([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPermissions();
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  // Filter menu items based on permissions
  const visibleMenuItems = adminMenuItems.filter(item =>
    user?.role === 'admin' || allowedTabs.includes(item.tab)
  );

  return (
    <Sidebar className="w-64 border-r border-border/60">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <Shield className="text-white h-4 w-4" />
          </div>
          <span className="font-bold text-lg text-foreground">Admin Panel</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Welcome, {user?.username}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
              ) : visibleMenuItems.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No permissions</div>
              ) : (
                visibleMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                            ? "bg-orange-100 text-orange-700 border-r-2 border-orange-500"
                            : "text-muted-foreground hover:text-foreground hover:bg-orange-50"
                          }`
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <SidebarMenuButton
          onClick={handleBackToDashboard}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </SidebarMenuButton>

        <SidebarMenuButton
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}

import {
  Shield,
  Gift,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ArrowLeft,
  Handshake,
  Inbox,
  UserCheck,
  CheckSquare,
  Zap,
  TrendingUp,
  AlertTriangle,
  MousePointerClick,
  LogIn,
  UserCog,
  ChevronRight,
  ChevronDown,
  Building2
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import subadminService from "@/services/subadminService";

// Hierarchical admin menu structure
const adminMenuStructure = [
  {
    title: "Overview",
    url: "/admin",
    icon: Shield,
    tab: "overview",
    type: "single" as const
  },
  {
    title: "Users & Access",
    icon: Users,
    type: "group" as const,
    subtabs: [
      { title: "Users", url: "/admin/users", icon: Users, tab: "publishers" },
      { title: "Advertisers", url: "/admin/advertisers", icon: Building2, tab: "advertisers" },
      { title: "Subadmin Management", url: "/admin/subadmin-management", icon: Shield, tab: "subadmin-management" },
      { title: "Offer Access Requests", url: "/admin/offer-access-requests", icon: UserCheck, tab: "offer-access-requests" },
      { title: "Placement Approval", url: "/admin/placement-approval", icon: CheckSquare, tab: "placement-approval" },
    ]
  },
  {
    title: "Offers & Rewards",
    icon: Gift,
    type: "group" as const,
    subtabs: [
      { title: "Offers", url: "/admin/offers", icon: Gift, tab: "offers" },
      { title: "Missing Offers", url: "/admin/missing-offers", icon: AlertTriangle, tab: "missing-offers" },
      { title: "Promo Codes", url: "/admin/promo-codes", icon: Zap, tab: "promo-codes" },
      { title: "Gift Cards", url: "/admin/gift-cards", icon: Gift, tab: "gift-cards" },
    ]
  },
  {
    title: "Tracking & Analytics",
    icon: TrendingUp,
    type: "group" as const,
    subtabs: [
      { title: "Offerwall Analytics", url: "/admin/offerwall-analytics", icon: TrendingUp, tab: "offerwall-analytics" },
      { title: "Click Tracking", url: "/admin/click-tracking", icon: MousePointerClick, tab: "click-tracking" },
    ]
  },
  {
    title: "Fraud & Security",
    icon: AlertTriangle,
    type: "group" as const,
    subtabs: [
      { title: "Fraud Management", url: "/admin/fraud-management", icon: AlertTriangle, tab: "fraud-management" },
      { title: "Login Logs", url: "/admin/login-logs", icon: LogIn, tab: "login-logs" },
      { title: "Active Users", url: "/admin/active-users", icon: UserCog, tab: "active-users" },
    ]
  },
  {
    title: "Integration",
    icon: Handshake,
    type: "group" as const,
    subtabs: [
      { title: "Partners", url: "/admin/partners", icon: Handshake, tab: "partners" },
      { title: "Postback", url: "/admin/postback", icon: Inbox, tab: "postback" },
      { title: "Test Postback", url: "/admin/test-postback", icon: Zap, tab: "test-postback" },
    ]
  },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Track which main tabs are expanded
  const [expandedTabs, setExpandedTabs] = useState<string[]>(() => {
    // Auto-expand the tab containing the current route
    const currentPath = location.pathname;
    const expandedTab = adminMenuStructure.find(item =>
      item.type === 'group' && item.subtabs?.some(sub => currentPath === sub.url)
    );
    return expandedTab ? [expandedTab.title] : [];
  });

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        if (user?.role === 'admin') {
          // Admin sees all tabs
          const allTabs: string[] = [];
          adminMenuStructure.forEach(item => {
            if (item.type === 'single') {
              allTabs.push(item.tab);
            } else if (item.subtabs) {
              item.subtabs.forEach(sub => allTabs.push(sub.tab));
            }
          });
          setAllowedTabs(allTabs);
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

  const toggleTab = (tabTitle: string) => {
    setExpandedTabs(prev =>
      prev.includes(tabTitle)
        ? prev.filter(t => t !== tabTitle)
        : [...prev, tabTitle]
    );
  };

  // Check if user has permission for a tab
  const hasPermission = (tab: string) => {
    return user?.role === 'admin' || allowedTabs.includes(tab);
  };

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
              ) : (
                adminMenuStructure.map((item) => {
                  if (item.type === 'single') {
                    // Single menu item (Overview)
                    if (!hasPermission(item.tab)) return null;

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url!}
                            end
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
                    );
                  } else {
                    // Grouped menu item with subtabs
                    const visibleSubtabs = item.subtabs?.filter(sub => hasPermission(sub.tab)) || [];

                    // Don't show the group if no subtabs are visible
                    if (visibleSubtabs.length === 0) return null;

                    const isExpanded = expandedTabs.includes(item.title);
                    const isActive = visibleSubtabs.some(sub => location.pathname === sub.url);

                    return (
                      <Collapsible
                        key={item.title}
                        open={isExpanded}
                        onOpenChange={() => toggleTab(item.title)}
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full ${isActive
                                  ? "bg-orange-50 text-orange-700"
                                  : "text-muted-foreground hover:text-foreground hover:bg-orange-50"
                                }`}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="font-medium flex-1 text-left">{item.title}</span>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1">
                            <SidebarMenu className="ml-6 border-l-2 border-orange-200 pl-2">
                              {visibleSubtabs.map((subtab) => (
                                <SidebarMenuItem key={subtab.title}>
                                  <SidebarMenuButton asChild>
                                    <NavLink
                                      to={subtab.url}
                                      className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive
                                          ? "bg-orange-100 text-orange-700 font-medium"
                                          : "text-muted-foreground hover:text-foreground hover:bg-orange-50"
                                        }`
                                      }
                                    >
                                      <subtab.icon className="h-4 w-4" />
                                      <span>{subtab.title}</span>
                                    </NavLink>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }
                })
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

import {
  LayoutDashboard,
  Target,
  FileImage,
  Gift,
  BarChart3,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  Shield,
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  ChevronRight,
  ChevronDown,
  LucideIcon
} from "lucide-react";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useRequireApprovedPlacement } from "../../hooks/usePlacementApproval";
import { Badge } from "@/components/ui/badge";
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
import { useState } from "react";

// Type definitions for menu structure
interface SubTab {
  title: string;
  url: string;
  icon: LucideIcon;
  alwaysAccessible?: boolean;
  requiresPlacement?: boolean;
}

interface MenuItem {
  title: string;
  icon: LucideIcon;
  type: "single" | "group";
  url?: string;
  requiresPlacement?: boolean;
  subtabs?: SubTab[];
}

// Hierarchical menu structure
const menuStructure: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    type: "single"
  },
  {
    title: "Offers",
    icon: Gift,
    type: "group",
    subtabs: [
      { title: "Placements", url: "/dashboard/placements", icon: Target, alwaysAccessible: true },
      { title: "Offers", url: "/dashboard/offers", icon: Gift, requiresPlacement: true },
      { title: "Assets", url: "/dashboard/assets", icon: FileImage, requiresPlacement: true },
    ]
  },
  {
    title: "Reports",
    icon: BarChart3,
    type: "group",
    requiresPlacement: true,
    subtabs: [
      { title: "Performance Report", url: "/dashboard/performance-report", icon: TrendingUp },
      { title: "Conversion Report", url: "/dashboard/conversion-report", icon: Receipt },
    ]
  },
  {
    title: "Rewards",
    icon: Trophy,
    type: "group",
    requiresPlacement: true,
    subtabs: [
      { title: "Promo Codes", url: "/dashboard/promo-codes", icon: Zap },
      { title: "Redeem Gift Card", url: "/dashboard/redeem-gift-card", icon: Gift },
      { title: "Rewards", url: "/dashboard/rewards", icon: Trophy },
    ]
  },
  {
    title: "Account",
    icon: Users,
    type: "group",
    subtabs: [
      { title: "Payments", url: "/dashboard/payments", icon: CreditCard, requiresPlacement: true },
      { title: "Users", url: "/dashboard/users", icon: Users },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ]
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAdminOrSubadmin } = useAuth();
  const {
    hasApprovedPlacement,
    hasPendingPlacement,
    hasRejectedPlacement,
    canAccessPlatform
  } = useRequireApprovedPlacement();

  // Track which main tabs are expanded
  const [expandedTabs, setExpandedTabs] = useState<string[]>(() => {
    // Auto-expand the tab containing the current route
    const currentPath = location.pathname;
    const expandedTab = menuStructure.find(item =>
      item.type === 'group' && item.subtabs?.some(sub => currentPath.startsWith(sub.url))
    );
    return expandedTab ? [expandedTab.title] : [];
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleTab = (tabTitle: string) => {
    setExpandedTabs(prev =>
      prev.includes(tabTitle)
        ? prev.filter(t => t !== tabTitle)
        : [...prev, tabTitle]
    );
  };

  const getPlacementStatusBadge = () => {
    if (hasApprovedPlacement) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    } else if (hasPendingPlacement) {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    } else if (hasRejectedPlacement) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 text-xs">
        Required
      </Badge>
    );
  };

  return (
    <Sidebar className="w-64 border-r border-border/60">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="font-bold text-lg text-foreground">Lovable</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Placement Status Section */}
        <SidebarGroup>
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Placement Status</span>
              {getPlacementStatusBadge()}
            </div>
            {!canAccessPlatform && (
              <p className="text-xs text-muted-foreground">
                {hasPendingPlacement
                  ? "Your placement is under review"
                  : "Create a placement to access offers"
                }
              </p>
            )}
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuStructure.map((item) => {
                if (item.type === 'single') {
                  // Single menu item (Dashboard)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url!}
                          end
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                              ? "bg-primary/10 text-primary border-r-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                  const isExpanded = expandedTabs.includes(item.title);
                  const isGroupDisabled = item.requiresPlacement && !canAccessPlatform;
                  const isActive = item.subtabs?.some(sub => location.pathname.startsWith(sub.url));
                  
                  // Check if all subtabs require placement (for showing group as disabled)
                  const allSubtabsRequirePlacement = item.subtabs?.every(sub => sub.requiresPlacement && !sub.alwaysAccessible);
                  const isDisabled = isGroupDisabled || (allSubtabsRequirePlacement && !canAccessPlatform);

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
                                ? "bg-primary/5 text-primary"
                                : isDisabled
                                  ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              }`}
                            onClick={(e) => {
                              if (isDisabled) {
                                e.preventDefault();
                                navigate('/dashboard/placements');
                              }
                            }}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="font-medium flex-1 text-left">{item.title}</span>
                            {isDisabled ? (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                <Clock className="h-3 w-3" />
                              </Badge>
                            ) : (
                              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1">
                          <SidebarMenu className="ml-6 border-l-2 border-muted pl-2">
                            {item.subtabs?.map((subtab) => {
                              // Check if this specific subtab is disabled
                              const isSubtabDisabled = !subtab.alwaysAccessible && (isGroupDisabled || (subtab.requiresPlacement && !canAccessPlatform));
                              
                              return (
                                <SidebarMenuItem key={subtab.title}>
                                  <SidebarMenuButton asChild>
                                    <NavLink
                                      to={isSubtabDisabled ? '#' : subtab.url}
                                      onClick={(e) => {
                                        if (isSubtabDisabled) {
                                          e.preventDefault();
                                          navigate('/dashboard/placements');
                                        }
                                      }}
                                      className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isSubtabDisabled
                                          ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                                          : isActive
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        }`
                                      }
                                    >
                                      <subtab.icon className="h-4 w-4" />
                                      <span>{subtab.title}</span>
                                      {isSubtabDisabled && (
                                        <Clock className="h-3 w-3 ml-auto text-yellow-600" />
                                      )}
                                    </NavLink>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              );
                            })}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
              })}

              {/* Admin Dashboard - Show for admin and subadmin users */}
              {isAdminOrSubadmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link
                      to="/admin"
                      reloadDocument
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-orange-50 cursor-pointer"
                    >
                      <Shield className="h-5 w-5" />
                      <span className="font-medium">Admin Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Terms & Privacy Links */}
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground border-t pt-3">
          <a 
            href="/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline transition-colors"
          >
            Terms
          </a>
          <span>•</span>
          <a 
            href="/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline transition-colors"
          >
            Privacy
          </a>
          <span>•</span>
          <a 
            href="/team" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline transition-colors"
          >
            Team
          </a>
        </div>
        
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

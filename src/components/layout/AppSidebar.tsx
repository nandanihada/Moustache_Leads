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
  Rocket, // 🚀 New icon for Ascend
  Shield, // 🛡️ Admin icon
  TrendingUp, // 📈 Performance Report
  Receipt, // 📝 Conversion Report
  Clock,
  CheckCircle,
  XCircle,
  Trophy
} from "lucide-react";
import { NavLink, useNavigate, Link } from "react-router-dom";
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

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Placements", url: "/dashboard/placements", icon: Target },
  { title: "Assets", url: "/dashboard/assets", icon: FileImage },
  { title: "Offers", url: "/dashboard/offers", icon: Gift },
  { title: "Promo Codes", url: "/dashboard/promo-codes", icon: Zap },
  { title: "Redeem Gift Card", url: "/dashboard/redeem-gift-card", icon: Gift },
  { title: "Rewards", url: "/dashboard/rewards", icon: Trophy },
  { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
  { title: "Performance Report", url: "/dashboard/performance-report", icon: TrendingUp },
  { title: "Conversion Report", url: "/dashboard/conversion-report", icon: Receipt },
  { title: "Users", url: "/dashboard/users", icon: Users },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Campaign Builder", url: "/dashboard/campaign-builder", icon: Zap },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
  { title: "Ascend", url: "/dashboard/ascend", icon: Rocket }, // ✅ New Ascend menu item
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { logout, isAdminOrSubadmin } = useAuth();
  const {
    hasApprovedPlacement,
    hasPendingPlacement,
    hasRejectedPlacement,
    canAccessPlatform
  } = useRequireApprovedPlacement();

  const handleLogout = () => {
    logout();
    navigate("/");
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
              {menuItems.map((item) => {
                // Items that require placement approval
                const requiresPlacement = ['Offers', 'Reports', 'Performance Report', 'Conversion Report'].includes(item.title);
                const isDisabled = requiresPlacement && !canAccessPlatform;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={isDisabled ? '#' : item.url}
                        onClick={(e) => {
                          if (isDisabled) {
                            e.preventDefault();
                            navigate('/dashboard/placements');
                          }
                        }}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isDisabled
                            ? "text-muted-foreground/50 cursor-not-allowed opacity-50"
                            : isActive
                              ? "bg-primary/10 text-primary border-r-2 border-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                        {isDisabled && (
                          <Badge variant="outline" className="ml-auto text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Clock className="h-3 w-3 mr-1" />
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
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

      <SidebarFooter className="p-4">
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

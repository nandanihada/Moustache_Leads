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
  Shield // 🛡️ Admin icon
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

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Placements", url: "/dashboard/placements", icon: Target },
  { title: "Assets", url: "/dashboard/assets", icon: FileImage },
  { title: "Offers", url: "/dashboard/offers", icon: Gift },
  { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
  { title: "Users", url: "/dashboard/users", icon: Users },
  { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
  { title: "Campaign Builder", url: "/dashboard/campaign-builder", icon: Zap },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
  { title: "Ascend", url: "/dashboard/ascend", icon: Rocket }, // ✅ New Ascend menu item
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive 
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
              ))}
              
              {/* Admin Dashboard - Only show for admin users */}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/admin" 
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive 
                            ? "bg-orange-100 text-orange-700 border-r-2 border-orange-500" 
                            : "text-muted-foreground hover:text-foreground hover:bg-orange-50"
                        }`
                      }
                    >
                      <Shield className="h-5 w-5" />
                      <span className="font-medium">Admin Dashboard</span>
                    </NavLink>
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

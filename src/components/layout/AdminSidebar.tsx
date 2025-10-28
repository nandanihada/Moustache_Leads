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
  TestTube
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

const adminMenuItems = [
  { title: "Overview", url: "/admin", icon: Shield },
  { title: "Offers", url: "/admin/offers", icon: Gift },
  { title: "Reports", url: "/admin/reports", icon: FileText },
  { title: "Tracking", url: "/admin/tracking", icon: Monitor },
  { title: "Test Tracking", url: "/admin/test-tracking", icon: TestTube },
  { title: "Partners", url: "/admin/partners", icon: Handshake },
  { title: "Postback Receiver", url: "/admin/postback-receiver", icon: Inbox },
  { title: "Postback Logs", url: "/admin/postback-logs", icon: Activity },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
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
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/admin"}
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive 
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
              ))}
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

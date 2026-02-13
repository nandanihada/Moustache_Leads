import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  User,
  CreditCard,
  HelpCircle
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
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

const advertiserMenuItems = [
  {
    title: "Dashboard",
    url: "/advertiser",
    icon: LayoutDashboard,
  },
  {
    title: "Campaigns",
    url: "/advertiser/campaigns",
    icon: Megaphone,
  },
  {
    title: "Statistics",
    url: "/advertiser/statistics",
    icon: BarChart3,
  },
  {
    title: "Billing",
    url: "/advertiser/billing",
    icon: CreditCard,
  },
  {
    title: "Profile",
    url: "/advertiser/profile",
    icon: User,
  },
  {
    title: "Settings",
    url: "/advertiser/settings",
    icon: Settings,
  },
];

export function AdvertiserSidebar() {
  const navigate = useNavigate();
  
  // Get advertiser user from localStorage
  const advertiserUser = JSON.parse(localStorage.getItem('advertiser_user') || '{}');
  const displayName = advertiserUser?.first_name || advertiserUser?.company_name || advertiserUser?.email || 'Advertiser';

  const handleLogout = () => {
    // Clear advertiser-specific tokens
    localStorage.removeItem('advertiser_token');
    localStorage.removeItem('advertiser_user');
    navigate("/advertiser/signin");
  };

  return (
    <Sidebar className="w-56 lg:w-64 border-r border-border/60 flex-shrink-0">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <Megaphone className="text-white h-4 w-4" />
          </div>
          <span className="font-bold text-lg text-foreground">Advertiser</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Welcome, {displayName}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {advertiserMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/advertiser"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-700 border-r-2 border-blue-500"
                            : "text-muted-foreground hover:text-foreground hover:bg-blue-50"
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
          className="text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <HelpCircle className="h-5 w-5" />
          <span>Help & Support</span>
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

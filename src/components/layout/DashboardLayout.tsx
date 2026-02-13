import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import NotificationBar from "@/components/NotificationBar";

const DashboardLayout = () => {
  // Automatically track page visits and send heartbeats
  useActivityTracking();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen w-screen max-w-full flex bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
          <TopBar />
          <NotificationBar />
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto scrollbar-thin">
            <div className="min-w-0 max-w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
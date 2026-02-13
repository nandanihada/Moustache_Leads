import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { TopBar } from "./TopBar";

const AdminLayout = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen w-screen max-w-full flex bg-background overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
          <TopBar />
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

export default AdminLayout;

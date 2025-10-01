import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Offers from "./pages/Offers";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Placements from "./pages/Placements";
import Assets from "./pages/Assets";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import CampaignBuilder from "./pages/CampaignBuilder";  
import AscendIframe from "@/pages/AscendIframe";   // ✅ Updated import

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/" element={<DashboardLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="offers" element={<Offers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<Users />} />
              <Route path="placements" element={<Placements />} />
              <Route path="assets" element={<Assets />} />
              <Route path="payments" element={<Payments />} />
              <Route path="settings" element={<Settings />} />
              <Route path="campaign-builder" element={<CampaignBuilder />} /> 
              <Route path="ascend" element={<AscendIframe />} /> {/* ✅ Updated route */}
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

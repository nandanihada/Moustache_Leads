import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import DashboardLayout from "./components/layout/DashboardLayout";
import AdminLayout from "./components/layout/AdminLayout";
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
import AdminDashboard from "./pages/AdminDashboard";
import AdminOffers from "./pages/AdminOffers";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminReports from "./pages/AdminReports";
import AdminTracking from "./pages/AdminTracking";
import TrackingTest from "./pages/TrackingTest";
import Partners from "./pages/Partners";
import PostbackLogs from "./pages/PostbackLogs";
import PostbackReceiver from "./pages/PostbackReceiver";
import PartnerProfile from "./pages/PartnerProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthDebug } from "./components/AuthDebug";
import { SmartRedirect } from "./components/SmartRedirect";
import { TestOfferModal } from "./components/TestOfferModal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/test-modal" element={<TestOfferModal />} />
            
            {/* Protected dashboard routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="offers" element={<Offers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<Users />} />
              <Route path="placements" element={<Placements />} />
              <Route path="assets" element={<Assets />} />
              <Route path="payments" element={<Payments />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<PartnerProfile />} />
              <Route path="campaign-builder" element={<CampaignBuilder />} /> 
              <Route path="ascend" element={<AscendIframe />} />
            </Route>
            
            {/* Admin Dashboard routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="offers" element={<AdminOffers />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="tracking" element={<AdminTracking />} />
              <Route path="test-tracking" element={<TrackingTest />} />
              <Route path="partners" element={<Partners />} />
              <Route path="postback-logs" element={<PostbackLogs />} />
              <Route path="postback-receiver" element={<PostbackReceiver />} />
            </Route>
            
            {/* Smart redirect based on authentication status */}
            <Route path="*" element={<SmartRedirect />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

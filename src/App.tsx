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
import PublisherOffers from "./pages/PublisherOffers";
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
import AdminPlacementApproval from "./pages/AdminPlacementApproval";
import AdminOfferAccessRequests from "./pages/AdminOfferAccessRequests";
import AdminPublisherManagementFixed from "./pages/AdminPublisherManagementFixed";
import PartnerProfile from "./pages/PartnerProfile";
import PerformanceReport from "./pages/PerformanceReport";
import ConversionReport from "./pages/ConversionReport";
import AdminPromoCodeManagement from "./pages/AdminPromoCodeManagement";
import PublisherPromoCodeManagement from "./pages/PublisherPromoCodeManagement";
import AdminBonusManagement from "./pages/AdminBonusManagement";
import TestPage from "./pages/TestPage";
import AdminOfferwallAnalytics from "./pages/AdminOfferwallAnalytics";
import AdminFraudManagement from "./pages/AdminFraudManagement";
import UserRewardsDashboard from "./pages/UserRewardsDashboard";
import ComprehensiveOfferwallAnalytics from "./pages/ComprehensiveOfferwallAnalytics";
import AdminClickTracking from "./pages/AdminClickTracking";
import AdminLoginLogs from "./pages/AdminLoginLogs";
import AdminActiveUsers from "./pages/AdminActiveUsers";
import AdminSubadminManagement from "./pages/AdminSubadminManagement";
import GiftCardRedemption from "./pages/GiftCardRedemption";
import RedeemGiftCard from "./pages/RedeemGiftCard";
import AdminGiftCardManagement from "./pages/AdminGiftCardManagement";
import OfferwallPage from "./pages/OfferwallPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Landing from "./pages/Landing";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthDebug } from "./components/AuthDebug";
import { SmartRedirect } from "./components/SmartRedirect";
import { TestOfferModal } from "./components/TestOfferModal";
import { SubdomainRouter } from "./middleware/subdomainRouter";

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
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/test-modal" element={<TestOfferModal />} />
              <Route path="/offerwall" element={<OfferwallPage />} />

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
                <Route path="offers" element={<PublisherOffers />} />
                <Route path="promo-codes" element={<PublisherPromoCodeManagement />} />
                <Route path="reports" element={<Reports />} />
                <Route path="performance-report" element={<PerformanceReport />} />
                <Route path="conversion-report" element={<ConversionReport />} />
                <Route path="users" element={<Users />} />
                <Route path="placements" element={<Placements />} />
                <Route path="assets" element={<Assets />} />
                <Route path="payments" element={<Payments />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<PartnerProfile />} />
                <Route path="gift-cards" element={<GiftCardRedemption />} />
                <Route path="redeem-gift-card" element={<RedeemGiftCard />} />
                <Route path="test" element={<TestPage />} />
                <Route path="rewards" element={<UserRewardsDashboard />} />
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
                <Route path="promo-codes" element={<AdminPromoCodeManagement />} />
                <Route path="offer-access-requests" element={<AdminOfferAccessRequests />} />
                <Route path="placement-approval" element={<AdminPlacementApproval />} />
                <Route path="offerwall-analytics" element={<AdminOfferwallAnalytics />} />
                <Route path="click-tracking" element={<AdminClickTracking />} />
                <Route path="login-logs" element={<AdminLoginLogs />} />
                <Route path="active-users" element={<AdminActiveUsers />} />
                <Route path="fraud-management" element={<AdminFraudManagement />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="partners" element={<Partners />} />
                <Route path="postback" element={<PostbackReceiver />} />
                <Route path="subadmin-management" element={<AdminSubadminManagement />} />
                <Route path="gift-cards" element={<AdminGiftCardManagement />} />
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

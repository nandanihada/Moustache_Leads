import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import React, { Suspense, lazy } from "react";
import DashboardLayout from "./components/layout/DashboardLayout";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Offers from "./pages/Offers";
import PublisherOffers from "./pages/PublisherOffers";
import PublisherSmartLink from "./pages/PublisherSmartLink";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Placements from "./pages/Placements";
import Assets from "./pages/Assets";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import APIAccess from "./pages/APIAccess";
import APIStats from "./pages/APIStats";
import APIConversions from "./pages/APIConversions";
import CampaignBuilder from "./pages/CampaignBuilder";
import AscendIframe from "@/pages/AscendIframe";   // ✅ Updated import

// Lazy-loaded admin pages (only downloaded when admin navigates to them)
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminOffers = lazy(() => import("./pages/AdminOffers"));
const AdminOffersV3 = lazy(() => import("./pages/AdminOffersV3"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminTracking = lazy(() => import("./pages/AdminTracking"));
const AdminOffersV2 = lazy(() => import("./pages/AdminOffersV2"));
const TrackingTest = lazy(() => import("./pages/TrackingTest"));
import Partners from "./pages/Partners";
const PostbackLogs = lazy(() => import("./pages/PostbackLogs"));
const PostbackReceiver = lazy(() => import("./pages/PostbackReceiver"));
const AdminPlacementApproval = lazy(() => import("./pages/AdminPlacementApproval"));
const AdminOfferAccessRequests = lazy(() => import("./pages/AdminOfferAccessRequests"));
const AdminPublisherManagementFixed = lazy(() => import("./pages/AdminPublisherManagementFixed"));
import PartnerProfile from "./pages/PartnerProfile";
const PerformanceReport = lazy(() => import("./pages/PerformanceReport"));
const ConversionReport = lazy(() => import("./pages/ConversionReport"));
const AdminPromoCodeManagement = lazy(() => import("./pages/AdminPromoCodeManagement"));
const AdminTestPostback = lazy(() => import("./pages/AdminTestPostback"));
const AdminPostbackPipeline = lazy(() => import("./pages/AdminPostbackPipeline"));
import PublisherPromoCodeManagement from "./pages/PublisherPromoCodeManagement";
const AdminBonusManagement = lazy(() => import("./pages/AdminBonusManagement"));
const TestPage = lazy(() => import("./pages/TestPage"));
const AdminOfferwallAnalytics = lazy(() => import("./pages/AdminOfferwallAnalytics"));
const AdminFraudManagement = lazy(() => import("./pages/AdminFraudManagement"));
import UserRewardsDashboard from "./pages/UserRewardsDashboard";
const ComprehensiveOfferwallAnalytics = lazy(() => import("./pages/ComprehensiveOfferwallAnalytics"));
const AdminClickTracking = lazy(() => import("./pages/AdminClickTracking"));
const AdminLoginLogs = lazy(() => import("./pages/AdminLoginLogs"));
const AdminActiveUsers = lazy(() => import("./pages/AdminActiveUsers"));
const AdminSubadminManagement = lazy(() => import("./pages/AdminSubadminManagement"));
import GiftCardRedemption from "./pages/GiftCardRedemption";
import RedeemGiftCard from "./pages/RedeemGiftCard";
const AdminGiftCardManagement = lazy(() => import("./pages/AdminGiftCardManagement"));
const AdminMissingOffers = lazy(() => import("./pages/AdminMissingOffers"));
const AdminOfferInsights = lazy(() => import("./pages/AdminOfferInsights"));
const AdminEmailActivityLogs = lazy(() => import("./pages/AdminEmailActivityLogs"));
const AdminAdvertiserManagement = lazy(() => import("./pages/AdminAdvertiserManagement"));
const AdminPlacementProofs = lazy(() => import("./pages/AdminPlacementProofs"));
const AdminSupportInbox = lazy(() => import("./pages/AdminSupportInbox"));
const AdminOfferAnalytics = lazy(() => import("./pages/AdminOfferAnalytics"));
const AdminDetailedAnalytics = lazy(() => import("./pages/AdminDetailedAnalytics"));
const AdminSearchLogs = lazy(() => import("./pages/AdminSearchLogs"));
const AdminActivityLogs = lazy(() => import("./pages/AdminActivityLogs"));
const AdminRecentActivity = lazy(() => import("./pages/AdminRecentActivity"));
const AdminReportsTracking = lazy(() => import("./pages/AdminReportsTracking"));
const AdminReactivation = lazy(() => import("./pages/AdminReactivation"));
const AdminPerUserOfferTrack = lazy(() => import("./pages/AdminPerUserOfferTrack"));
const AdminMaskedLinks = lazy(() => import("./pages/AdminMaskedLinks"));
const AdminReferrals = lazy(() => import("./pages/AdminReferrals"));
const AdminSurveyGateway = lazy(() => import("./pages/AdminSurveyGateway"));
import Referrals from "./pages/Referrals";
const AdminPolls = lazy(() => import("./pages/AdminPolls"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
import Invoice from "./pages/Invoice";
import SupportPage from "./pages/SupportPage";
import AdvertiserDashboard from "./pages/AdvertiserDashboard";
import AdvertiserCampaigns from "./pages/AdvertiserCampaigns";
import AdvertiserLayout from "./components/layout/AdvertiserLayout";
import OfferwallPage from "./pages/OfferwallPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PublisherSignIn from "./pages/PublisherSignIn";
import AdvertiserSignIn from "./pages/AdvertiserSignIn";
import AdvertiserRegister from "./pages/AdvertiserRegister";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Team from "./pages/Team";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthDebug } from "./components/AuthDebug";
import { SmartRedirect } from "./components/SmartRedirect";
import { SmartLinkRedirector } from "./components/SmartLinkRedirector";
import { TestOfferModal } from "./components/TestOfferModal";
import { SubdomainRouter } from "./middleware/subdomainRouter";
import PublicSmartLink from "./pages/PublicSmartLink";
const AdminSmartLinks = lazy(() => import("./pages/AdminSmartLinks"));
const AdminApiStats = lazy(() => import("./pages/AdminApiStats"));
const AdminNotes = lazy(() => import("./pages/AdminNotes"));
const AdminPublisherAnalytics = lazy(() => import("./pages/AdminPublisherAnalytics"));
import PromoTabV2 from "./components/PromoTabV2";
const AdminPromoAnalyticsV2 = lazy(() => import("./pages/AdminPromoAnalyticsV2"));
const AdminAutomationDashboard = lazy(() => import("./pages/AdminAutomationDashboard"));
const AdminSupportHub = lazy(() => import("./pages/AdminSupportHub"));
import { AgreementPage } from "./pages/AgreementPage";
import { SignaturePage } from "./pages/SignaturePage";
import { AdminSearchIntelligence } from "./pages/AdminSearchIntelligence";
import AdminPlatformSettings from "./pages/AdminPlatformSettings";
import AdminReviewSubmissions from "./pages/AdminReviewSubmissions";
const AdminOfferwallManager = lazy(() => import("./pages/AdminOfferwallManager"));
const AdminSurveyBuilder = lazy(() => import("./pages/AdminSurveyBuilder"));
const AdminSubWalls = lazy(() => import("./pages/AdminSubWalls"));
const AdminRedirectRouter = lazy(() => import("./pages/AdminRedirectRouter"));
import SubWallPage from "./pages/SubWallPage";
import SurveyFunnelPage from "./pages/SurveyFunnelPage";
import SurveyPage from "./pages/SurveyPage";
import SurveyRouterPage from "./pages/SurveyRouterPage";
import SurveyResultPage from "./pages/SurveyResultPage";

// Loading fallback for lazy-loaded pages
const PageLoader = () => <div className="flex items-center justify-center h-full min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <SubdomainRouter>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Navigate to="/publisher/signin" replace />} />
                <Route path="/register" element={<Navigate to="/publisher/register" replace />} />
                <Route path="/publisher/signin" element={<PublisherSignIn />} />
                <Route path="/publisher/register" element={<Register />} />
                <Route path="/advertiser/signin" element={<AdvertiserSignIn />} />
                <Route path="/advertiser/register" element={<AdvertiserRegister />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/team" element={<Team />} />
                <Route path="/test-modal" element={<TestOfferModal />} />
                <Route path="/offerwall" element={<OfferwallPage />} />
                <Route path="/agreement" element={<AgreementPage />} />
                <Route path="/signature" element={<SignaturePage />} />
                <Route path="/smart-link-preview" element={<PublicSmartLink />} />
                <Route path="/smart/:slug" element={<SmartLinkRedirector />} />
                <Route path="/wall/:slug" element={<SubWallPage />} />
                <Route path="/survey/:surveyId" element={<SurveyPage />} />
                <Route path="/funnel/:funnelId" element={<SurveyFunnelPage />} />
                <Route path="/survey-router/return" element={<SurveyRouterPage />} />
                <Route path="/survey-router/poll" element={<SurveyRouterPage />} />
                <Route path="/survey-result" element={<SurveyResultPage />} />

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
                <Route path="smart-link" element={<Navigate to="/dashboard" replace />} />
                <Route path="promo-codes" element={<PublisherPromoCodeManagement />} />
                <Route path="reports" element={<Reports />} />
                <Route path="performance-report" element={<PerformanceReport />} />
                <Route path="conversion-report" element={<ConversionReport />} />
                <Route path="users" element={<Users />} />
                <Route path="placements" element={<Placements />} />
                <Route path="assets" element={<Assets />} />
                <Route path="payments" element={<Payments />} />
                <Route path="payments/invoice/:id" element={<Invoice />} />
                <Route path="settings" element={<Settings />} />
                <Route path="api-access" element={<Navigate to="/dashboard" replace />} />
                <Route path="api-stats" element={<Navigate to="/dashboard" replace />} />
                <Route path="api-conversions" element={<Navigate to="/dashboard" replace />} />
                <Route path="profile" element={<PartnerProfile />} />
                <Route path="gift-cards" element={<GiftCardRedemption />} />
                <Route path="redeem-gift-card" element={<RedeemGiftCard />} />
                <Route path="test" element={<TestPage />} />
                <Route path="rewards" element={<UserRewardsDashboard />} />
                <Route path="campaign-builder" element={<CampaignBuilder />} />
                <Route path="ascend" element={<AscendIframe />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="referrals" element={<Referrals />} />
                <Route path="test-promo-v2" element={<Navigate to="/dashboard" replace />} />
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
                <Route path="users" element={<Users />} />
                <Route path="offers" element={<AdminOffers />} />
                <Route path="offers-new" element={<AdminOffersV2 />} />
                <Route path="offers-v3" element={<AdminOffersV3 />} />
                <Route path="missing-offers" element={<AdminMissingOffers />} />
                <Route path="offer-insights" element={<AdminOfferInsights />} />
                <Route path="email-activity" element={<AdminEmailActivityLogs />} />
                <Route path="offer-analytics" element={<AdminOfferAnalytics />} />
                <Route path="promo-codes" element={<AdminPromoCodeManagement />} />
                <Route path="promo-analytics-v2" element={<AdminPromoAnalyticsV2 />} />
                <Route path="offer-access-requests" element={<AdminOfferAccessRequests />} />
                <Route path="placement-approval" element={<AdminPlacementApproval />} />
                <Route path="offerwall-analytics" element={<AdminOfferwallAnalytics />} />
                <Route path="network-analytics" element={<AdminDetailedAnalytics type="network" />} />
                <Route path="vertical-analytics" element={<AdminDetailedAnalytics type="vertical" />} />
                <Route path="geo-analytics" element={<AdminDetailedAnalytics type="geo" />} />
                <Route path="status-analytics" element={<AdminDetailedAnalytics type="status" />} />
                <Route path="click-tracking" element={<AdminClickTracking />} />
                <Route path="login-logs" element={<AdminLoginLogs />} />
                <Route path="active-users" element={<AdminActiveUsers />} />
                <Route path="fraud-management" element={<AdminFraudManagement />} />
                <Route path="activity-logs" element={<AdminActivityLogs />} />
                <Route path="recent-activity" element={<AdminRecentActivity />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="partners" element={<Partners />} />
                <Route path="postback" element={<PostbackReceiver />} />
                <Route path="test-postback" element={<AdminTestPostback />} />
                <Route path="postback-pipeline" element={<AdminPostbackPipeline />} />
                <Route path="subadmin-management" element={<AdminSubadminManagement />} />
                <Route path="gift-cards" element={<AdminGiftCardManagement />} />
                <Route path="advertisers" element={<AdminAdvertiserManagement />} />
                <Route path="placement-proofs" element={<AdminPlacementProofs />} />
                <Route path="support-inbox" element={<AdminSupportInbox />} />
                <Route path="search-logs" element={<AdminSearchLogs />} />
                <Route path="tracking-reports" element={<AdminReportsTracking />} />
                <Route path="reactivation" element={<AdminReactivation />} />
                <Route path="per-user-offers" element={<AdminPerUserOfferTrack />} />
                <Route path="masked-links" element={<AdminMaskedLinks />} />
                <Route path="referrals" element={<AdminReferrals />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="survey-gateway" element={<AdminSurveyGateway />} />
                <Route path="polls" element={<AdminPolls />} />
                <Route path="smart-links" element={<AdminSmartLinks />} />
                <Route path="api-stats" element={<AdminApiStats />} />
                <Route path="notes" element={<AdminNotes />} />
                <Route path="publisher-analytics" element={<AdminPublisherAnalytics />} />
                <Route path="automation" element={<AdminAutomationDashboard />} />
                <Route path="support-hub" element={<AdminSupportHub />} />
                <Route path="search-intelligence" element={<AdminSearchIntelligence />} />
                <Route path="platform-settings" element={<AdminPlatformSettings />} />
                <Route path="review-submissions" element={<AdminReviewSubmissions />} />
                <Route path="offerwall-manager" element={<AdminOfferwallManager />} />
                <Route path="survey-builder" element={<AdminSurveyBuilder />} />
                <Route path="sub-walls" element={<AdminSubWalls />} />
                <Route path="redirect-router" element={<AdminRedirectRouter />} />
              </Route>

              {/* Advertiser Dashboard routes */}
              <Route
                path="/advertiser"
                element={<AdvertiserLayout />}
              >
                <Route index element={<AdvertiserDashboard />} />
                <Route path="campaigns" element={<AdvertiserCampaigns />} />
                <Route path="statistics" element={<AdvertiserDashboard />} />
                <Route path="billing" element={<AdvertiserDashboard />} />
                <Route path="profile" element={<AdvertiserDashboard />} />
                <Route path="settings" element={<AdvertiserDashboard />} />
              </Route>

              {/* Smart redirect based on authentication status */}
              <Route path="*" element={<SmartRedirect />} />
            </Routes>
              </Suspense>
            </SubdomainRouter>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

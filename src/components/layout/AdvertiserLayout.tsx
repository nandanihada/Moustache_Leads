import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdvertiserSidebar } from "./AdvertiserSidebar";
import { TopBar } from "./TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface AdvertiserInfo {
  company_name: string;
  email: string;
  first_name: string;
}

const AdvertiserLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<string>('pending_approval');
  const [advertiser, setAdvertiser] = useState<AdvertiserInfo | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem('advertiser_token');
        if (!token) {
          navigate('/advertiser/signin');
          return;
        }

        const response = await fetch(`${API_BASE}/api/advertiser/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('advertiser_token');
          localStorage.removeItem('advertiser_user');
          navigate('/advertiser/signin');
          return;
        }

        const data = await response.json();
        if (response.ok) {
          setAccountStatus(data.account_status || 'pending_approval');
          setAdvertiser(data.advertiser || null);
        }
      } catch (err) {
        console.error('Error verifying advertiser status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen w-screen max-w-full flex bg-background overflow-hidden">
        <AdvertiserSidebar />
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-auto scrollbar-thin">
            <div className="min-w-0 max-w-full">
              {accountStatus === 'approved' ? (
                <Outlet />
              ) : (
                <div className="space-y-6 p-4 md:p-6">
                  <div>
                    <h1 className="text-2xl font-bold">
                      Welcome{advertiser?.first_name ? `, ${advertiser.first_name}` : ''}!
                    </h1>
                    <p className="text-muted-foreground">
                      {advertiser?.company_name || 'Your advertiser dashboard'}
                    </p>
                  </div>

                  <Alert className="border-yellow-200 bg-yellow-50">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Account Under Review</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                      Your account is currently being reviewed by our team. This process typically takes 1-3 business days.
                      Once approved, you'll be able to create and manage advertising campaigns.
                      <br /><br />
                      We'll send you an email notification once your account is activated.
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardHeader>
                      <CardTitle>What happens next?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">1</div>
                        <div>
                          <p className="font-medium">Account Review</p>
                          <p className="text-sm text-muted-foreground">Our team reviews your application and company details</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">2</div>
                        <div>
                          <p className="font-medium">Approval Notification</p>
                          <p className="text-sm text-muted-foreground">You'll receive an email once your account is approved</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">3</div>
                        <div>
                          <p className="font-medium">Start Advertising</p>
                          <p className="text-sm text-muted-foreground">Create campaigns and reach your target audience</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdvertiserLayout;

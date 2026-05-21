import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/services/apiConfig";
import { useToast } from "@/components/ui/use-toast";
import { getAuthToken } from '@/utils/cookies';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ExternalLink, MousePointer, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Submission {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  proof_image_url: string;
  status: string;
  submitted_at: string;
  reward_amount?: number;
  review_url?: string;
}

interface ButtonClick {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  clicked_at: string;
  ip_address?: string;
  review_url?: string;
}

export default function AdminReviewSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [clicks, setClicks] = useState<ButtonClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [clicksLoading, setClicksLoading] = useState(true);
  const [clicksTotal, setClicksTotal] = useState(0);
  const [clicksPage, setClicksPage] = useState(1);
  const { toast } = useToast();
  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchSubmissions();
    fetchClicks();
  }, []);

  useEffect(() => {
    fetchClicks();
  }, [clicksPage]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/review-submissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error("Failed to fetch review submissions:", err);
      toast({
        title: "Error",
        description: "Failed to load submissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClicks = async () => {
    setClicksLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/review-button-clicks?page=${clicksPage}&per_page=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.clicks) {
        setClicks(data.clicks);
        setClicksTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch button clicks:", err);
    } finally {
      setClicksLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/review-submissions/${id}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast({
          title: "Success",
          description: `Submission ${action}d successfully.`,
        });
        fetchSubmissions();
      } else {
        throw new Error(data.error || 'Action failed');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Submissions</h1>
        <p className="text-muted-foreground mt-2">
          Approve or reject user review proofs and track button click history.
        </p>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList>
          <TabsTrigger value="submissions" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Submissions ({submissions.length})
          </TabsTrigger>
          <TabsTrigger value="clicks" className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Button Clicks ({clicksTotal})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Review Proof Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading submissions...</p>
              ) : submissions.length === 0 ? (
                <p className="text-muted-foreground">No submissions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Review Link</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Proof Image</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Reward</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {submissions.map((sub) => (
                        <tr key={sub._id} className="bg-card hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-4 font-medium">
                            <div>{sub.username}</div>
                            <div className="text-xs text-muted-foreground">{sub.email}</div>
                          </td>
                          <td className="px-4 py-4 max-w-[200px] truncate">
                            {sub.review_url ? (
                              <a 
                                href={sub.review_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline truncate block text-xs"
                                title={sub.review_url}
                              >
                                {sub.review_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">Legacy Link</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {new Date(sub.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            <a 
                              href={`${API_BASE_URL}${sub.proof_image_url}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:underline"
                            >
                              View Image <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="px-4 py-4">
                            <Badge 
                              variant={
                                sub.status === 'approved' ? 'default' : 
                                sub.status === 'rejected' ? 'destructive' : 
                                'secondary'
                              }
                            >
                              {sub.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 font-semibold text-green-600">
                            {sub.reward_amount ? `$${sub.reward_amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-4">
                            {sub.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleAction(sub._id, 'approve')}
                                  className="bg-green-600 hover:bg-green-700 h-8"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleAction(sub._id, 'reject')}
                                  className="h-8"
                                >
                                  <XCircle className="w-4 h-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clicks">
          <Card>
            <CardHeader>
              <CardTitle>Review Us Button Click History</CardTitle>
            </CardHeader>
            <CardContent>
              {clicksLoading ? (
                <p>Loading click history...</p>
              ) : clicks.length === 0 ? (
                <p className="text-muted-foreground">No button clicks recorded yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                        <tr>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Clicked Link</th>
                          <th className="px-4 py-3">Clicked At</th>
                          <th className="px-4 py-3">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {clicks.map((click) => (
                          <tr key={click._id} className="bg-card hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-4 font-medium">
                              <div>{click.username}</div>
                              <div className="text-xs text-muted-foreground">{click.email}</div>
                            </td>
                            <td className="px-4 py-4 max-w-[200px] truncate">
                              {click.review_url ? (
                                <a 
                                  href={click.review_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline truncate block text-xs"
                                  title={click.review_url}
                                >
                                  {click.review_url}
                                </a>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Legacy Link</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">
                              {new Date(click.clicked_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 text-muted-foreground font-mono text-xs">
                              {click.ip_address || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {clicksTotal > 50 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {(clicksPage - 1) * 50 + 1}-{Math.min(clicksPage * 50, clicksTotal)} of {clicksTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={clicksPage <= 1}
                          onClick={() => setClicksPage(p => p - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={clicksPage * 50 >= clicksTotal}
                          onClick={() => setClicksPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/services/apiConfig";
import { useToast } from "@/components/ui/use-toast";
import { getAuthToken } from '@/utils/cookies';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface Submission {
  _id: string;
  user_id: string;
  username: string;
  email: string;
  proof_image_url: string;
  status: string;
  submitted_at: string;
  reward_amount?: number;
}

export default function AdminReviewSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchSubmissions();
  }, []);

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
          Approve or reject user review proofs to issue rewards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
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
    </div>
  );
}

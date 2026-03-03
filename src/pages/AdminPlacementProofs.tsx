import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { placementProofApi } from '@/services/placementProofApi';
import {
  Camera, CheckCircle, XCircle, Clock, Eye, ChevronLeft, ChevronRight, Loader2, Star,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

interface Proof {
  _id: string;
  user_id: string;
  offer_id: string;
  offer_name: string;
  proof_type: string;
  image_urls: string[];
  placement_url: string;
  description: string;
  traffic_source: string;
  status: string;
  admin_notes: string;
  score_awarded: number;
  created_at: string;
  user_info?: { username: string; email: string; name: string };
}

const AdminPlacementProofs = () => {
  const { toast } = useToast();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewing, setReviewing] = useState(false);

  const fetchProofs = async () => {
    setLoading(true);
    try {
      const res = await placementProofApi.getAllProofs(page, 20, statusFilter);
      setProofs(res.proofs || []);
      setTotalPages(res.pages || 1);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProofs(); }, [page, statusFilter]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedProof) return;
    setReviewing(true);
    try {
      await placementProofApi.reviewProof(
        selectedProof._id,
        status,
        reviewNotes,
        status === 'approved' ? reviewScore : 0
      );
      toast({ title: `Proof ${status}`, description: `Placement proof has been ${status}.` });
      setReviewOpen(false);
      setSelectedProof(null);
      setReviewNotes('');
      setReviewScore(5);
      fetchProofs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Camera className="h-6 w-6" /> Placement Proofs
        </h1>
        <p className="text-sm text-muted-foreground">Review placement proofs submitted by publishers</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Submitted Proofs ({total})</CardTitle>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : proofs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No placement proofs found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase">Publisher</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Offer</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Traffic Source</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Proof</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Score</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((proof) => (
                  <TableRow key={proof._id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="text-sm font-medium">{proof.user_info?.name || proof.user_info?.username || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{proof.user_info?.email || ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium truncate max-w-[180px]">{proof.offer_name}</div>
                      <div className="text-xs text-muted-foreground">{proof.offer_id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{proof.traffic_source || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {proof.image_urls.slice(0, 3).map((url, i) => (
                          <img
                            key={i}
                            src={url.startsWith('/') ? `${API_BASE_URL}${url}` : url}
                            alt=""
                            className="w-10 h-10 rounded border object-cover cursor-pointer hover:opacity-80"
                            onClick={() => { setSelectedProof(proof); setReviewOpen(true); }}
                          />
                        ))}
                        {proof.image_urls.length > 3 && (
                          <span className="text-xs text-muted-foreground self-center">+{proof.image_urls.length - 3}</span>
                        )}
                        {proof.image_urls.length === 0 && proof.placement_url && (
                          <a href={proof.placement_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            View URL
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(proof.status)}</TableCell>
                    <TableCell>
                      {proof.score_awarded > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm">{proof.score_awarded}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(proof.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setSelectedProof(proof); setReviewOpen(true); }}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Placement Proof</DialogTitle>
          </DialogHeader>
          {selectedProof && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Publisher:</span>
                  <p className="font-medium">{selectedProof.user_info?.name || selectedProof.user_info?.username}</p>
                  <p className="text-xs text-muted-foreground">{selectedProof.user_info?.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Offer:</span>
                  <p className="font-medium">{selectedProof.offer_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedProof.offer_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Traffic Source:</span>
                  <p className="font-medium">{selectedProof.traffic_source || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">{getStatusBadge(selectedProof.status)}</div>
                </div>
              </div>

              {selectedProof.placement_url && (
                <div>
                  <span className="text-sm text-muted-foreground">Placement URL:</span>
                  <a href={selectedProof.placement_url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:underline truncate">{selectedProof.placement_url}</a>
                </div>
              )}

              {selectedProof.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Notes:</span>
                  <p className="text-sm mt-1">{selectedProof.description}</p>
                </div>
              )}

              {selectedProof.image_urls.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Screenshots:</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedProof.image_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url.startsWith('/') ? `${API_BASE_URL}${url}` : url}
                        alt={`Proof ${i + 1}`}
                        className="w-full rounded-lg border object-cover max-h-[300px]"
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedProof.status === 'pending' && (
                <div className="border-t pt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Notes</label>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Optional notes..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Score (if approving)</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                        <button
                          key={s}
                          onClick={() => setReviewScore(s)}
                          className={`w-8 h-8 rounded-full text-xs font-medium border transition-colors ${
                            s <= reviewScore ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => handleReview('approved')}
                      disabled={reviewing}
                    >
                      {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleReview('rejected')}
                      disabled={reviewing}
                    >
                      {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlacementProofs;

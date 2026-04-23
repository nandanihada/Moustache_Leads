import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, Copy, Eye, ListFilter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { getApiBaseUrl } from '@/services/apiConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const AdminOffersV3 = () => {
  const { toast } = useToast();
  const [publicApprovedCount, setPublicApprovedCount] = useState<number | null>(null);
  const [publicOffers, setPublicOffers] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Fetch the exact count of publicly approved running offers for the admin smart link tab.
    fetch(`${getApiBaseUrl()}/api/public/smart-link/offers?all_countries=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPublicApprovedCount(data.offers_count);
          setPublicOffers(data.offers || []);
        } else {
          console.error('Failed to fetch public offers count:', data.error || 'Unknown error');
        }
      })
      .catch((err) => console.error('Failed to fetch public offers count:', err));
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Public Smart Link</h1>
          <p className="text-muted-foreground">Manage and share your dynamic offers link</p>
        </div>
      </div>

      {/* Smart Link Panel */}
      <Card className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 border-purple-500/30 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-400" />
                Your Public Smart Link
              </h3>
              <p className="text-gray-400 max-w-2xl mb-6">
                This single rotating link dynamically contains all your currently running offers which are publically approved.
                You can share this link anywhere to send traffic to all your active public offers instantly without requiring any placement credentials.
              </p>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="bg-purple-500/20 p-3 rounded-md">
                <Globe className="h-7 w-7 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-purple-400/80 font-medium uppercase tracking-wider mb-1">
                  Publicly Approved
                </p>
                <p className="text-4xl font-black text-white flex items-baseline gap-2">
                  {publicApprovedCount !== null ? publicApprovedCount : '...'} 
                  <span className="text-base font-medium text-gray-400">Live Offers</span>
                </p>
              </div>
            </div>
            
            {publicApprovedCount !== null && publicApprovedCount > 0 && (
              <Button 
                onClick={() => setModalOpen(true)}
                variant="outline" 
                className="border-purple-500/50 hover:bg-purple-500/20 text-purple-300"
              >
                <ListFilter className="h-4 w-4 mr-2" />
                View Approved Offers
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Input
              value={`${window.location.origin}/smart-link`}
              readOnly
              className="font-mono bg-black/40 border-purple-500/50 text-purple-300 w-full max-w-xl"
            />
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const smartLinkUrl = `${window.location.origin}/smart-link`;
                navigator.clipboard.writeText(smartLinkUrl);
                toast({ title: 'Success', description: 'Smart Link copied to clipboard!' });
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              className="border-purple-500/50 hover:bg-purple-500/10 text-purple-400"
              onClick={() => window.open(`${window.location.origin}/smart-link-preview`, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Link
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6 border-purple-500/20">
          <DialogHeader className="mb-2 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Globe className="h-6 w-6 text-purple-500" />
              {publicApprovedCount} Publicly Approved Offers
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              These are the offers dynamically injected into your smart link.
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto pr-2 rounded-md border border-border/50 relative">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium">Offer ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Payout</th>
                  <th className="px-4 py-3 font-medium">Countries</th>
                  <th className="px-4 py-3 font-medium">Approved Time</th>
                </tr>
              </thead>
              <tbody>
                {publicOffers.map((offer, i) => (
                  <tr key={offer.offer_id || i} className="border-b last:border-0 border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {offer.offer_id}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {offer.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-purple-500/5 text-purple-600 border-purple-200">
                        {offer.category || offer.vertical || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600">
                      {offer.currency === 'USD' ? '$' : ''}{offer.payout?.toFixed(2)}{offer.currency !== 'USD' ? ` ${offer.currency}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {offer.countries?.slice(0, 3).map((c: string) => (
                          <Badge key={c} variant="secondary" className="text-[10px]">
                            {c}
                          </Badge>
                        ))}
                        {offer.countries?.length > 3 && (
                          <Badge variant="secondary" className="text-[10px]">
                            +{offer.countries.length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {offer.updated_at || offer.created_at 
                        ? new Date(offer.updated_at || offer.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                          })
                        : 'N/A'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminOffersV3WithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOffersV3 />
  </AdminPageGuard>
);

export default AdminOffersV3WithGuard;

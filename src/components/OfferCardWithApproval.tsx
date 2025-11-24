import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Lock, 
  Unlock, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Send,
  AlertCircle,
  Info,
  Gift
} from 'lucide-react';
import { PublisherOffer } from '@/services/publisherOfferApi';
import { publisherOfferApi } from '@/services/publisherOfferApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface OfferCardWithApprovalProps {
  offer: PublisherOffer;
  onViewDetails: (offer: PublisherOffer) => void;
  onAccessGranted?: () => void;
}

const OfferCardWithApproval: React.FC<OfferCardWithApprovalProps> = ({
  offer,
  onViewDetails,
  onAccessGranted
}) => {
  const [requestDialog, setRequestDialog] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [applyPromoDialog, setApplyPromoDialog] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Handle request access
  const handleRequestAccess = async () => {
    try {
      setLoading(true);
      await publisherOfferApi.requestOfferAccess(offer.offer_id, requestMessage);
      
      toast({
        title: "Request Submitted",
        description: `Your access request for "${offer.name}" has been submitted successfully.`,
      });
      
      setRequestDialog(false);
      setRequestMessage('');
      onAccessGranted?.();
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.response?.data?.error || "Failed to submit access request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle apply promo code
  const handleApplyPromoCode = async () => {
    if (!selectedPromoCode) {
      toast({
        title: "Error",
        description: "Please select a promo code",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/publisher/offers/${offer.offer_id}/apply-promo-code`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ promo_code_id: selectedPromoCode })
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Promo code applied successfully!",
        });
        setApplyPromoDialog(false);
        setSelectedPromoCode('');
        onAccessGranted?.();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to apply promo code",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply promo code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get status badge for request status
  const getRequestStatusBadge = () => {
    if (!offer.request_status) return null;
    
    switch (offer.request_status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get access status icon
  const getAccessIcon = () => {
    if (offer.has_access) {
      return <Unlock className="w-4 h-4 text-green-600" />;
    } else if (offer.request_status === 'pending') {
      return <Clock className="w-4 h-4 text-yellow-600" />;
    } else {
      return <Lock className="w-4 h-4 text-red-600" />;
    }
  };

  // Determine if card should be blurred
  const isBlurred = offer.is_preview && !offer.has_access;

  return (
    <>
      <Card 
        className={cn(
          "hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-500",
          isBlurred && "relative overflow-hidden"
        )}
        onClick={() => onViewDetails(offer)}
      >
        {/* Blur overlay for restricted offers */}
        {isBlurred && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center p-4">
              <Lock className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-sm font-medium text-gray-700 mb-2">Access Required</p>
              <p className="text-xs text-gray-500 mb-3">
                {offer.estimated_approval_time && `Approval time: ${offer.estimated_approval_time}`}
              </p>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setRequestDialog(true);
                }}
                disabled={offer.request_status === 'pending'}
              >
                {offer.request_status === 'pending' ? (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Request Pending
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 mr-1" />
                    Request Access
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-4">
          {/* Access Status Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getAccessIcon()}
              <span className="text-xs font-medium">
                {offer.has_access ? 'Full Access' : 'Preview Mode'}
              </span>
            </div>
            {getRequestStatusBadge()}
          </div>

          {/* Offer Image */}
          {(offer.thumbnail_url || offer.image_url) && (
            <div className="mb-3">
              <img 
                src={offer.thumbnail_url || offer.image_url} 
                alt={offer.name}
                className={cn(
                  "w-full h-32 object-cover rounded",
                  isBlurred && "blur-sm"
                )}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Offer Name */}
          <h3 className="font-bold text-lg mb-2 line-clamp-2">{offer.name}</h3>

          {/* Offer ID */}
          <div className="text-xs text-muted-foreground font-mono mb-2">
            ID: {offer.offer_id}
          </div>

          {/* Payout */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Payout:</span>
            <div className="flex items-center gap-2">
              {(offer as any).promo_code && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">
                    ${offer.payout.toFixed(2)}
                  </div>
                  <Badge className="bg-green-500 text-white text-lg font-bold">
                    ${(offer.payout + (offer.payout * (offer as any).bonus_amount / 100)).toFixed(2)}
                  </Badge>
                </div>
              )}
              {!(offer as any).promo_code && (
                <Badge className="bg-green-500 text-white text-lg font-bold">
                  ${offer.payout.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>

          {/* Promo Code Bonus */}
          {(offer as any).promo_code && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-1">
                🎉 Bonus Code Available
              </p>
              <p className="text-xs text-blue-700 font-mono font-bold">
                Code: {(offer as any).promo_code}
              </p>
              <p className="text-xs text-blue-700">
                +{(offer as any).bonus_amount}% Extra Bonus
              </p>
            </div>
          )}

          {/* Countries */}
          {offer.countries && offer.countries.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Countries:</div>
              <div className="flex flex-wrap gap-1">
                {offer.countries.slice(0, 5).map((country) => (
                  <Badge key={country} variant="outline" className="text-xs">
                    {country}
                  </Badge>
                ))}
                {offer.countries.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{offer.countries.length - 5}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Device Targeting */}
          {(offer as any).device_targeting && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Device:</span>
              <Badge variant="outline" className="text-xs capitalize">
                {(offer as any).device_targeting}
              </Badge>
            </div>
          )}

          {/* Access Information */}
          {!offer.has_access && offer.requires_approval && (
            <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-blue-800">Approval Required</p>
                  <p className="text-blue-600">
                    {offer.access_reason}
                  </p>
                  {offer.estimated_approval_time && (
                    <p className="text-blue-600 mt-1">
                      Est. approval time: {offer.estimated_approval_time}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status and Action */}
          <div className="flex items-center justify-between">
            <Badge className={offer.approval_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {offer.approval_status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={(e) => {
                e.stopPropagation();
                onViewDetails(offer);
              }}>
                <Eye className="w-3 h-3 mr-1" />
                View Details
              </Button>
              {(offer as any).promo_code && (
                <Button size="sm" variant="secondary" onClick={(e) => {
                  e.stopPropagation();
                  setApplyPromoDialog(true);
                }}>
                  <Gift className="w-3 h-3 mr-1" />
                  Apply Code
                </Button>
              )}
              {!offer.has_access && offer.requires_approval && offer.request_status !== 'pending' && (
                <Button size="sm" onClick={(e) => {
                  e.stopPropagation();
                  setRequestDialog(true);
                }}>
                  <Send className="w-3 h-3 mr-1" />
                  Request
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Access Dialog */}
      <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Access to Offer</DialogTitle>
            <DialogDescription>
              Request access to "{offer.name}" - ${offer.payout}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Approval Process</p>
                  <p className="text-blue-600">
                    Type: {offer.approval_type?.replace('_', ' ')}
                  </p>
                  {offer.estimated_approval_time && (
                    <p className="text-blue-600">
                      Estimated time: {offer.estimated_approval_time}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a message to your access request..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestAccess} disabled={loading}>
              {loading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Promo Code Dialog */}
      <Dialog open={applyPromoDialog} onOpenChange={setApplyPromoDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Apply Promo Code</DialogTitle>
            <DialogDescription>
              Apply a promo code to "{offer.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <Gift className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">Available Promo Code</p>
                  <p className="text-green-700 mt-1">
                    Code: <span className="font-mono font-bold">{(offer as any).promo_code}</span>
                  </p>
                  <p className="text-green-700">
                    Bonus: +{(offer as any).bonus_amount}% {(offer as any).bonus_type}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-select">Select Promo Code</Label>
              <select
                id="promo-select"
                value={selectedPromoCode}
                onChange={(e) => setSelectedPromoCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">-- Select a code --</option>
                <option value={String((offer as any).promo_code_id || '')}>
                  {(offer as any).promo_code} (+{(offer as any).bonus_amount}%)
                </option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyPromoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyPromoCode} disabled={loading}>
              {loading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  Apply Code
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfferCardWithApproval;

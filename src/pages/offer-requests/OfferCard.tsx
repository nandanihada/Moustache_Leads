import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, Loader2, AlertCircle, Heart, Users,
  Globe, DollarSign, Edit, Trash2, Send, Calendar, Briefcase, UserCheck, Activity,
} from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';
import { EditOfferModal } from '@/components/EditOfferModal';
import { adminOfferApi } from '@/services/adminOfferApi';

export interface TabOfferRequest {
  _id: string;
  request_id?: string;
  offer_id: string;
  offer_name: string;
  offer_payout: number;
  offer_network: string;
  offer_category: string;
  offer_countries: string[];
  offer_status?: string;
  status: string;
  requested_at?: string;
  message?: string;
  request_count?: number;
  offer_health?: { status: string; failures: { criterion: string; detail?: string }[] };
  publisher_id?: string;
  publisher_username?: string;
  publisher_email?: string;
  rejection_reason?: string;
  rejection_category?: string;
  is_in_collection?: { direct_partner: boolean; affiliate: boolean };
  // Most Requested fields
  total_requests?: number;
  unique_users?: number;
  approved_count?: number;
  rejected_count?: number;
  pending_count?: number;
  last_requested_at?: string;
  // Collection fields
  collection_type?: string;
  added_by_username?: string;
  created_at?: string;
}

interface OfferCardProps {
  item: TabOfferRequest;
  tab: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCollectionChange?: () => void;
  onSend?: (offerId: string) => void;
  onSchedule?: (offerId: string) => void;
  onDelete?: (item: TabOfferRequest) => void;
}

export default function OfferCard({ item, tab, isSelected, onToggleSelect, onCollectionChange, onSend, onSchedule, onDelete }: OfferCardProps) {
  const [addingDP, setAddingDP] = useState(false);
  const [addingAF, setAddingAF] = useState(false);
  const [inDP, setInDP] = useState(item.is_in_collection?.direct_partner ?? false);
  const [inAF, setInAF] = useState(item.is_in_collection?.affiliate ?? false);
  const [showHealth, setShowHealth] = useState(false);
  const [editOffer, setEditOffer] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const token = localStorage.getItem('token');

  const handleEdit = async () => {
    setLoadingEdit(true);
    try {
      const res = await adminOfferApi.getOffer(item.offer_id);
      if (res.offer) {
        setEditOffer(res.offer);
        setEditModalOpen(true);
      }
    } catch { toast.error('Failed to load offer'); }
    finally { setLoadingEdit(false); }
  };

  const addToCollection = async (type: 'direct_partner' | 'affiliate') => {
    const setter = type === 'direct_partner' ? setAddingDP : setAddingAF;
    const inSetter = type === 'direct_partner' ? setInDP : setInAF;
    const isIn = type === 'direct_partner' ? inDP : inAF;

    if (isIn) {
      // Remove
      setter(true);
      try {
        await fetch(`${API_BASE_URL}/api/admin/offer-collections/remove`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ offer_id: item.offer_id, collection_type: type }),
        });
        inSetter(false);
        toast.success(`Removed from ${type === 'direct_partner' ? 'Direct Partner' : 'Affiliate'}`);
        onCollectionChange?.();
      } catch { toast.error('Failed to remove'); }
      finally { setter(false); }
      return;
    }

    setter(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/offer-collections/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ offer_id: item.offer_id, request_id: item.request_id, collection_type: type }),
      });
      const d = await res.json();
      if (d.success) {
        inSetter(true);
        toast.success(d.already_exists ? 'Already in collection' : `Added to ${type === 'direct_partner' ? 'Direct Partner' : 'Affiliate'}`);
        onCollectionChange?.();
      }
    } catch { toast.error('Failed to add'); }
    finally { setter(false); }
  };

  const health = item.offer_health;
  const isUnhealthy = health?.status === 'unhealthy';
  const isHealthy = health?.status === 'healthy';
  const countries = (item.offer_countries || []).slice(0, 5);

  return (
    <Card className={`p-3 transition-all ${isSelected ? 'ring-2 ring-primary/50 bg-primary/5' : 'hover:shadow-md'}`}>
      <div className="flex items-start gap-3">
        <div className="pt-0.5" onClick={e => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: Name + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate max-w-[280px]">{item.offer_name}</span>
            {item.offer_status === 'active' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">🟢 Active</Badge>}
            {item.offer_status === 'inactive' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200">⚫ Inactive</Badge>}
            {item.offer_status === 'running' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">🏃 Running</Badge>}
            {item.offer_status === 'paused' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">⏸ Paused</Badge>}
            {item.offer_status === 'hidden' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">👁 Hidden</Badge>}
            {isHealthy && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Healthy</Badge>}
            {isUnhealthy && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{health!.failures.length} issues</Badge>}
            {(item.request_count || 0) > 1 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">{item.request_count}x</Badge>}
          </div>

          {/* Row 2: Meta */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${item.offer_payout?.toFixed(2) || '0.00'}</span>
            {item.offer_category && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{item.offer_category}</span>}
            {countries.length > 0 && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{countries.join(', ')}{(item.offer_countries?.length || 0) > 5 ? '…' : ''}</span>}
            {item.publisher_username && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{item.publisher_username}</span>}
          </div>

          {/* Most Requested stats */}
          {tab === 'most_requested' && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">{item.total_requests} requests</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.unique_users} users</span>
              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="w-3 h-3" />{item.approved_count}</span>
              <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" />{item.rejected_count}</span>
              <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="w-3 h-3" />{item.pending_count}</span>
            </div>
          )}

          {/* Rejection reason */}
          {tab === 'rejected' && item.rejection_reason && (
            <div className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 rounded px-2 py-1 text-red-700 dark:text-red-400">
              <span className="font-medium">Reason:</span> {item.rejection_reason}
              {item.rejection_category && <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 border-red-300">{item.rejection_category}</Badge>}
            </div>
          )}

          {/* Health failures */}
          {isUnhealthy && health!.failures.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {health!.failures.map(f => (
                <span key={f.criterion} className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{f.criterion.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Collection buttons */}
          <Button size="sm" variant={inDP ? 'default' : 'outline'}
            className={`h-7 px-2 text-[10px] gap-1 ${inDP ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 border-blue-300'}`}
            onClick={() => addToCollection('direct_partner')} disabled={addingDP}>
            {addingDP ? <Loader2 className="w-3 h-3 animate-spin" /> : inDP ? <CheckCircle className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
            DP
          </Button>
          <Button size="sm" variant={inAF ? 'default' : 'outline'}
            className={`h-7 px-2 text-[10px] gap-1 ${inAF ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'text-violet-600 border-violet-300'}`}
            onClick={() => addToCollection('affiliate')} disabled={addingAF}>
            {addingAF ? <Loader2 className="w-3 h-3 animate-spin" /> : inAF ? <CheckCircle className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
            AF
          </Button>

          {/* Edit button */}
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-gray-600 border-gray-300"
            onClick={handleEdit} disabled={loadingEdit}>
            {loadingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit className="w-3 h-3" />}Edit
          </Button>

          {/* Health button */}
          <div className="relative">
            <Button size="sm" variant="outline"
              className={`h-7 px-2 text-[10px] gap-1 ${isUnhealthy ? 'text-red-600 border-red-300' : isHealthy ? 'text-emerald-600 border-emerald-300' : 'text-gray-500 border-gray-300'}`}
              onClick={() => setShowHealth(!showHealth)}>
              <Activity className="w-3 h-3" />Health
            </Button>
            {showHealth && health && (
              <div className="absolute right-0 top-8 z-50 w-56 rounded-lg border bg-popover p-3 shadow-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Health Status</span>
                  <Badge variant={isHealthy ? 'default' : isUnhealthy ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                    {health.status}
                  </Badge>
                </div>
                {health.failures && health.failures.length > 0 ? (
                  <div className="space-y-1">
                    {health.failures.map(f => (
                      <div key={f.criterion} className="flex items-start gap-1.5 text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
                        <span>{f.criterion.replace(/_/g, ' ')}{f.detail ? `: ${f.detail}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-emerald-600">No issues detected</p>
                )}
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] w-full" onClick={() => setShowHealth(false)}>Close</Button>
              </div>
            )}
          </div>

          {onSend && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => onSend(item.offer_id)}>
              <Send className="w-3 h-3" />Send
            </Button>
          )}
          {onSchedule && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => onSchedule(item.offer_id)}>
              <Calendar className="w-3 h-3" />Schedule
            </Button>
          )}
          {onDelete && (tab === 'direct_partner' || tab === 'affiliate') && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1 text-red-600 border-red-300" onClick={() => onDelete(item)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Offer Modal */}
      <EditOfferModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        offer={editOffer}
        onOfferUpdated={() => { setEditOffer(null); onCollectionChange?.(); }}
      />
    </Card>
  );
}

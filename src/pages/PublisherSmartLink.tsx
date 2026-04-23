import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit, Trash2, BarChart3, ExternalLink, Copy, Check, 
  Settings, Globe, Activity, Zap, RefreshCw, 
  Search, Filter, ArrowRight, TrendingUp, DollarSign,
  ShieldCheck, AlertCircle, Info
} from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SmartLink {
  _id: string;
  name: string;
  slug: string;
  status: string;
  traffic_type?: string;
  allow_adult?: boolean;
  rotation_strategy?: string;
  total_clicks?: number;
  revenue?: number;
  created_at: string;
}

const PublisherSmartLink: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [smartLinks, setSmartLinks] = useState<SmartLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLink, setEditingLink] = useState<SmartLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [eligibleOffers, setEligibleOffers] = useState<any[]>([]);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [fetchingOffers, setFetchingOffers] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSmartLinks();
  }, []);

  const fetchSmartLinks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/publisher/smart-links`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSmartLinks(data.smart_links);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to fetch smart links", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this tracking node? This action is irreversible.")) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/publisher/smart-links/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Node Terminated", description: "Smart link has been permanently removed." });
        fetchSmartLinks();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Deletion failed", variant: "destructive" });
    }
  };

  const handleSave = async (payload: any) => {
    const isEdit = !!editingLink;
    // Publishers now use their dedicated endpoint for creation
    const url = isEdit 
      ? `${getApiBaseUrl()}/api/admin/smart-links/${editingLink?._id}` 
      : `${getApiBaseUrl()}/api/publisher/smart-links`; 
    
    try {
      console.log('Finalizing Smart Link Deployment:', payload);
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          publisher_id: user?.id
        }),
      });

      const data = await response.json();
      console.log('Deployment Result:', data);
      
      if (data.success || response.status === 201) {
        toast({ title: "Deployment Successful", description: `Your tracking node is now LIVE.` });
        toast({ title: "Success", description: `Smart Link ${isEdit ? 'updated' : 'created'} successfully` });
        fetchSmartLinks();
        setShowCreateModal(false);
        setEditingLink(null);
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Action failed", variant: "destructive" });
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: "Copied!", description: "Tracking link copied to clipboard." });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const fetchEligibleOffers = async (type: string = 'mainstream', adult: boolean = false) => {
    setFetchingOffers(true);
    setShowOffersModal(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/publisher/eligible-offers?traffic_type=${type}&allow_adult=${adult}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEligibleOffers(data.offers);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to fetch offers", variant: "destructive" });
    } finally {
      setFetchingOffers(false);
    }
  };

  const getSmartLinkUrl = (slug: string) => {
    return `${window.location.origin}/smart/${slug}?pub_id=${user?.id || ''}`;
  };

  const globalLink = `${window.location.origin}/smart/global?pub_id=${user?.id}`;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in-50 duration-500">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 py-1 mb-2">
            Smart Routing v2.0
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Zap className="h-10 w-10 text-blue-600 fill-blue-600/10" />
            Monetization Dashboard
          </h1>
          <p className="text-slate-500 max-w-2xl">
            Our high-performance selection engine automatically probes hundreds of offers to serve the highest-paying campaign to every user you send.
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 gap-2 h-14 px-8 rounded-2xl"
        >
          <Plus className="h-5 w-5" />
          Create Custom Smart Link
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Volume', value: smartLinks.reduce((acc, l) => acc + (l.total_clicks || 0), 0), icon: Activity, color: 'blue' },
          { label: 'Active Links', value: smartLinks.filter(l => l.status === 'active').length, icon: ShieldCheck, color: 'emerald' },
          { label: 'Est. Revenue', value: `$${smartLinks.reduce((acc, l) => acc + (l.revenue || 0), 0).toFixed(2)}`, icon: DollarSign, color: 'amber' },
          { label: 'Avg. EPC', value: `$${(smartLinks.reduce((acc, l) => acc + (l.revenue || 0), 0) / (smartLinks.reduce((acc, l) => acc + (l.total_clicks || 0), 0) || 1)).toFixed(3)}`, icon: TrendingUp, color: 'indigo' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white overflow-hidden relative group">
            <div className={`absolute top-0 left-0 w-1 h-full bg-${stat.color}-500`} />
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 bg-${stat.color}-50 rounded-lg text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Key Rotation Card - ADDED AS REQUESTED */}
      <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white overflow-hidden shadow-sm">
        <div className="h-1 bg-amber-400 w-full" />
        <CardHeader className="pb-3 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-lg">API Integration & Security</CardTitle>
                <CardDescription>Your unique key for offer distribution & live tracking</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-200 text-amber-700 hover:bg-amber-100 font-bold h-9"
              onClick={async () => {
                if (!window.confirm("WARNING: Rotating your key will instantly invalidate ALL existing integration links. Proceed?")) return;
                try {
                  const res = await fetch(`${getApiBaseUrl()}/api/generate-api-key`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.api_key) {
                    toast({ title: "Key Rotated", description: "Your fresh live key is now active." });
                    window.location.reload();
                  }
                } catch (e) {
                  toast({ title: "Error", description: "Key rotation failed", variant: "destructive" });
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Generate Fresh Key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-amber-600 tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3" />
                  Your Live API Key
                </Label>
                <div className="relative group/key">
                  <Input 
                    readOnly 
                    value={(user as any)?.api_key || '••••••••••••••••••••••••••••••••'} 
                    className="font-mono text-sm bg-white/70 border-amber-200 pr-12 h-11 focus-visible:ring-amber-400"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-9 w-9 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                    onClick={() => copyToClipboard((user as any)?.api_key || '', 'apiKey')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  Live Distribution Feed (JSON)
                </Label>
                <div className="relative group/feed">
                  <Input 
                    readOnly 
                    value={(user as any)?.api_key 
                      ? `${getApiBaseUrl()}/api/v1/offers?api_key=${(user as any)?.api_key}`
                      : 'Logout and Login again to see your Distribution Link'} 
                    className={`font-mono text-[10px] pr-12 h-10 ${
                      (user as any)?.api_key 
                        ? 'bg-blue-50/50 border-blue-100 text-blue-700' 
                        : 'bg-rose-50 border-rose-100 text-rose-600'
                    }`}
                  />
                  {(user as any)?.api_key && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-0.5 h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                      onClick={() => copyToClipboard(`${getApiBaseUrl()}/api/v1/offers?api_key=${(user as any)?.api_key}`, 'distributionFeed')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-64 space-y-4">
              <div className="p-4 rounded-2xl bg-amber-100/30 border border-amber-100 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                  <Info className="h-4 w-4 shrink-0" />
                  Security Alert
                </div>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Rotating your key instantly invalidates the <b>Distribution Feed</b> and all existing <b>Smart Links</b>. Use this if your key has been compromised or shared.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Links Table */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-slate-400" />
          My Custom Segments
        </h2>
        
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Name & ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Tracking URL</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Volume</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Revenue</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={7} className="p-12 text-center text-slate-400">Syncing nodes...</td></tr>
                ) : smartLinks.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center text-slate-400 italic font-medium">No custom smart links created yet.</td></tr>
                ) : (
                  smartLinks.map((link) => (
                    <tr key={link._id} className="group hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <td className="px-6 py-6 font-bold text-slate-800 text-sm">
                        {link.name}
                      </td>
                      <td className="px-6 py-6 min-w-[300px]">
                        <div className="flex items-center gap-2 group/url">
                          <code className="bg-slate-50 px-3 py-2 rounded-lg text-[10px] font-mono text-slate-500 border border-slate-100 flex-1 truncate max-w-[200px]">
                            {getSmartLinkUrl(link.slug)}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-300 hover:text-blue-600 hover:bg-white shadow-sm opacity-0 group-hover/url:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(getSmartLinkUrl(link.slug), `table-link-${link._id}`)}
                          >
                            {copiedId === `table-link-${link._id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          <a 
                            href={getSmartLinkUrl(link.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open tracking link"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:text-indigo-600 hover:bg-white shadow-sm opacity-0 group-hover/url:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-6" colSpan={2}>
                        <Badge 
                          className={`rounded-full px-3 py-0.5 text-[10px] font-bold ${
                            link.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                          variant="outline"
                        >
                          {link.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td colSpan={3} className="px-6 py-6">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            className="text-[10px] font-black tracking-widest text-slate-400 hover:text-blue-600 gap-2 h-9 px-4 border border-transparent hover:border-blue-100 hover:bg-blue-50/30"
                            onClick={() => fetchEligibleOffers(link.traffic_type, link.allow_adult)}
                          >
                            <BarChart3 className="h-4 w-4" />
                            VIEW OFFERS
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="text-[10px] font-black tracking-widest text-slate-400 hover:text-amber-600 gap-2 h-9 px-4 border border-transparent hover:border-amber-100 hover:bg-amber-50/30"
                            onClick={() => {
                              setEditingLink(link);
                              setShowCreateModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            EDIT
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="text-[10px] font-black tracking-widest text-slate-400 hover:text-rose-600 gap-2 h-9 px-4 border border-transparent hover:border-rose-100 hover:bg-rose-50/30"
                            onClick={() => handleDelete(link._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            DELETE
                          </Button>
                          <Button 
                            variant="ghost" 
                            className={`text-[10px] font-black tracking-widest gap-2 h-9 px-4 border border-transparent transition-all duration-300 ${
                              copiedId === `link-${link._id}` 
                                ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                                : 'text-slate-400 hover:text-emerald-600 hover:border-emerald-100 hover:bg-emerald-50/30'
                            }`}
                            onClick={() => copyToClipboard(getSmartLinkUrl(link.slug), `link-${link._id}`)}
                          >
                            {copiedId === `link-${link._id}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copiedId === `link-${link._id}` ? 'COPIED!' : 'COPY LINK'}
                          </Button>
                          <Button
                            variant="ghost" 
                            className="bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white h-9 w-9 p-0 rounded-md transition-colors shadow-sm ml-1"
                            onClick={() => window.open(getSmartLinkUrl(link.slug), '_blank', 'noopener,noreferrer')}
                            title="Open Link in New Tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Creation Modal */}
      {(showCreateModal || editingLink) && (
        <PublisherSmartLinkModal
          link={editingLink}
          onClose={() => { setShowCreateModal(false); setEditingLink(null); }}
          onSave={handleSave}
          onPreview={(type, adult) => fetchEligibleOffers(type, adult)}
        />
      )}

      {/* Offers Preview Modal */}
      <Dialog open={showOffersModal} onOpenChange={setShowOffersModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-8 rounded-[32px] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              Campaign Inventory
            </DialogTitle>
            <DialogDescription className="text-lg">
              Below are the offers currently eligible for your tracking link in your region.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-6 pr-2 space-y-4">
            {fetchingOffers ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
                <p className="font-bold text-slate-400">Syncing with our global server nodes...</p>
              </div>
            ) : eligibleOffers.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-10 text-center space-y-2">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600 text-lg">No offers eligible for your region at this moment.</p>
                <p className="text-slate-400 text-sm">Our rotation engine will automatically show fallbacks if no primary offers are found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eligibleOffers.map((offer, idx) => (
                  <Card key={idx} className="border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden bg-slate-50/50 group">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 font-bold text-[10px] uppercase tracking-wider">
                          {offer.category || 'Campaign'}
                        </Badge>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Payout</p>
                          <p className="text-lg font-black text-emerald-600">${offer.payout || '0.00'}</p>
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-800 line-clamp-1">{offer.name}</h4>
                      <div className="flex items-center gap-3 mt-4 text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {Array.isArray(offer.countries) ? offer.countries.join(', ') : (offer.countries || 'Global')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          EPC Optimized
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="pt-6 border-t border-slate-100">
            <Button 
              onClick={() => setShowOffersModal(false)}
              className="w-full h-14 rounded-2xl bg-slate-900 font-bold"
            >
              Close Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PublisherSmartLinkModal: React.FC<{
  link: SmartLink | null;
  onClose: () => void;
  onSave: (payload: any) => void;
  onPreview: (type: string, adult: boolean) => void;
}> = ({ link, onClose, onSave, onPreview }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(link?.name || '');
  const [slug, setSlug] = useState(link?.slug || '');
  const [trafficType, setTrafficType] = useState(link?.traffic_type || '');
  const [allowAdult, setAllowAdult] = useState(link?.allow_adult || false);
  const [rotationStrategy, setRotationStrategy] = useState(link?.rotation_strategy || 'performance');
  
  const [previewOffers, setPreviewOffers] = useState<any[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);

  const steps = [
    { id: 1, name: 'Vertical' },
    { id: 2, name: 'Filters' },
    { id: 3, name: 'Rotation' },
    { id: 4, name: 'Generate' }
  ];

  // Auto-fetch offers when vertical is selected
  useEffect(() => {
    if (!trafficType) {
      setPreviewOffers([]);
      return;
    }
    const loadPreviews = async () => {
      setIsLoadingOffers(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${getApiBaseUrl()}/api/publisher/eligible-offers?traffic_type=${trafficType}&allow_adult=${allowAdult}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.offers) {
          setPreviewOffers(data.offers.slice(0, 4));
        }
      } catch (err) {} finally {
        setIsLoadingOffers(false);
      }
    };
    loadPreviews();
  }, [trafficType, allowAdult]);

  // Auto-generate name and slug if empty based on vertical
  useEffect(() => {
    if (!link && trafficType && !name) {
      const ts = new Date().getTime().toString().slice(-4);
      const generatedName = `${trafficType.charAt(0).toUpperCase() + trafficType.slice(1)} Campaign ${ts}`;
      setName(generatedName);
      setSlug(generatedName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6));
    }
  }, [trafficType]);

  const handleSubmit = () => {
    onSave({
      name: name || `${trafficType} Link`,
      slug: slug || `${trafficType}-link-${Math.random().toString(36).substring(2, 6)}`,
      traffic_type: trafficType,
      allow_adult: allowAdult,
      rotation_strategy: 'performance', // Default to performance, hidden from UI
      status: link?.status || 'active'
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="!max-w-5xl w-[95vw] h-[90vh] md:h-[650px] p-0 overflow-hidden border-none shadow-2xl rounded-[24px] bg-slate-50 flex flex-col md:flex-row gap-0">
        
        {/* LEFT PANEL: Form Content (60%) */}
        <div className="flex flex-col h-full w-full md:w-[60%] flex-shrink-0 relative z-10 bg-white">
          
          {/* Header */}
          <div className="p-6 md:p-8 bg-white space-y-2 shrink-0 border-b border-slate-100">
            <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Zap className="h-7 w-7 text-blue-600" />
              {link ? 'Edit Smart Link' : 'Create Smart Link'}
            </DialogTitle>
            <p className="text-slate-500 font-medium">Select your traffic vertical and deploy instantly. Our engine handles the rest.</p>
          </div>

          {/* Body Content */}
          <div className="px-6 md:px-8 flex-1 overflow-y-auto py-6 space-y-8">
            <div className="space-y-4">
              <Label className="text-xs text-slate-400 uppercase tracking-widest font-black block">Campaign Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g., Global Mixed Traffic"
                className="font-bold text-lg text-slate-900 bg-white border-slate-200 h-14 rounded-xl px-4 focus-visible:ring-blue-600 shadow-sm" 
              />
            </div>
            
            <div className="space-y-4">
               <Label className="text-xs text-slate-400 uppercase tracking-widest font-black block">Primary Vertical</Label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'mainstream', title: 'Mainstream', desc: 'All Global Audiences', icon: Globe },
                  { id: 'insurance', title: 'Insurance', desc: 'Finance & Lead Gen', icon: ShieldCheck },
                  { id: 'free_trial', title: 'Free Trial', desc: 'CC Submits & Sweeps', icon: Zap },
                  { id: 'dating', title: 'Dating', desc: 'Social & Adult Options', icon: Activity }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTrafficType(type.id)}
                    className={`p-5 rounded-[20px] border-2 text-left transition-all duration-300 flex items-center gap-4 group ${trafficType === type.id ? 'border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-500/10' : 'border-slate-100 hover:border-slate-200 bg-white hover:shadow-sm'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${trafficType === type.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className={`font-black text-md ${trafficType === type.id ? 'text-blue-900' : 'text-slate-800'}`}>{type.title}</div>
                        <div className={`text-xs mt-0.5 ${trafficType === type.id ? 'text-blue-700/80' : 'text-slate-500'}`}>{type.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subtle Adult toggle for Dating or specific uses */}
            <div className={`p-5 rounded-[20px] border-2 transition-all flex items-center justify-between cursor-pointer ${allowAdult ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-white hover:shadow-sm'}`}
                  onClick={() => setAllowAdult(!allowAdult)}
            >
                <div className="flex gap-4 items-center">
                  <div className={`h-10 w-10 flex items-center justify-center rounded-xl shrink-0 transition-colors ${allowAdult ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className={`font-black text-md ${allowAdult ? 'text-slate-900' : 'text-slate-800'}`}>Allow Explicit Content (18+)</h4>
                    <p className="text-xs text-slate-500">Enable to safely stream adult-vertical inventory.</p>
                  </div>
                </div>
                <div className="flex items-center shrink-0 ml-4">
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${allowAdult ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <div className={`bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${allowAdult ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
            </div>

          </div>

          {/* Footer CTA */}
          <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex gap-4 shrink-0 rounded-bl-[24px]">
            <Button 
              onClick={handleSubmit} 
              disabled={!trafficType || !name.trim()}
              className="h-14 flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl shadow-emerald-500/25 font-black text-lg gap-2 focus-visible:ring-emerald-500 disabled:opacity-50 transition-all"
            >
              🚀 Generate Smart Link
            </Button>
          </div>
        </div>

        {/* RIGHT PANEL: Live Preview (40%) */}
        <div className="hidden md:flex w-[40%] bg-slate-50 border-l border-slate-100 flex-col relative shrink-0">
          <div className="p-8 pb-4">
             <div className="flex items-center gap-2 mb-2">
               <Globe className="w-4 h-4 text-blue-500" />
               <span className="text-xs font-black uppercase tracking-widest text-blue-500">Live Preview Engine</span>
             </div>
             <h3 className="text-xl font-black text-slate-900 mb-1">Top Matching Offers</h3>
             <p className="text-sm text-slate-500">Inventory injected dynamically based on {trafficType ? <span className="font-bold text-slate-700">'{trafficType}'</span> : 'your selection'}.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
             {isLoadingOffers ? (
               <div className="space-y-3 mt-4">
                 {[1,2,3,4].map(n => (
                   <div key={n} className="bg-slate-100 animate-pulse h-20 rounded-2xl w-full" />
                 ))}
               </div>
             ) : !trafficType ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-50 mt-10">
                 <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                   <Search className="w-8 h-8 text-slate-400" />
                 </div>
                 <p className="font-bold text-slate-600">No Vertical Selected</p>
                 <p className="text-sm text-slate-400">Select a vertical to preview hits.</p>
               </div>
             ) : previewOffers.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-60 mt-10">
                 <ShieldCheck className="w-12 h-12 text-slate-400 mb-4" />
                 <p className="font-bold text-slate-600">No Inventory Found</p>
                 <p className="text-sm text-slate-400">Try enabling Adult Content or changing vertical.</p>
               </div>
             ) : (
               <div className="space-y-3 mt-2">
                 <AnimatePresence>
                   {previewOffers.map((o, i) => (
                     <motion.div 
                       key={o._id}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.05 }}
                       className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
                     >
                       <div className="flex gap-3 items-center min-w-0">
                         {o.country ? (
                           <div className="w-8 h-6 rounded bg-slate-100 flex items-center justify-center text-xs shrink-0 font-bold border border-slate-200">
                             {o.country === 'GLOBAL' ? '🌎' : o.country}
                           </div>
                         ) : (
                           <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                             <Zap className="w-4 h-4" />
                           </div>
                         )}
                         <div className="min-w-0">
                           <p className="font-bold text-slate-900 truncate text-sm">{o.name}</p>
                           <p className="text-xs text-slate-500 truncate">{o.category || trafficType}</p>
                         </div>
                       </div>
                       <div className="font-black text-emerald-600 shrink-0 ml-3">
                         ${o.payout?.toFixed(2)}
                       </div>
                     </motion.div>
                   ))}
                 </AnimatePresence>
                 {previewOffers.length >= 4 && (
                   <div className="text-center pt-2">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">+ Hundreds More Active</span>
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PublisherSmartLink;

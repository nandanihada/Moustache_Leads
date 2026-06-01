import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiImportService, PreviewOffer, ImportSummary, FullPreviewOffer } from '@/services/apiImportService';
import { adminOfferApi } from '@/services/adminOfferApi';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Download, Filter, Image, FileText, Globe, DollarSign, Link2, Copy, Search, Pencil, X, Check, ChevronDown, ChevronUp, Sparkles, Wand2, ImagePlus, Link } from 'lucide-react';
import { API_BASE_URL } from '@/services/apiConfig';

interface ApiImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = 'credentials' | 'audit' | 'options' | 'importing' | 'complete';
type AuditFilter = 'all' | 'missing_vertical' | 'missing_description' | 'missing_image' | 'missing_countries' | 'missing_payout' | 'missing_tracking_url' | 'is_duplicate';

export const ApiImportModal: React.FC<ApiImportModalProps> = ({ open, onOpenChange, onImportComplete }) => {
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<Step>('credentials');
  
  // Form state
  const [networkType, setNetworkType] = useState('hasoffers');
  const [networkId, setNetworkId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchMode, setFetchMode] = useState<'my_offers' | 'all_offers'>('my_offers');
  
  // Full preview / audit state
  const [fullPreviewOffers, setFullPreviewOffers] = useState<FullPreviewOffer[]>([]);
  const [auditSummary, setAuditSummary] = useState<any>(null);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedOfferIds, setSelectedOfferIds] = useState<Set<string>>(new Set());
  const [totalAvailable, setTotalAvailable] = useState(0);
  
  // Inline edit state
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editedOffers, setEditedOffers] = useState<Record<string, Partial<FullPreviewOffer>>>({});
  
  // Import options
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [autoActivate, setAutoActivate] = useState(true);
  const [defaultStatus, setDefaultStatus] = useState<string>('active');
  const [defaultStarRating, setDefaultStarRating] = useState<number>(4);
  const [defaultTimer, setDefaultTimer] = useState<number>(0);
  
  // Approval workflow options
  const [approvalType, setApprovalType] = useState<string>('auto_approve');
  const [autoApproveDelay, setAutoApproveDelay] = useState<number>(0);
  const [autoApproveDelayUnit, setAutoApproveDelayUnit] = useState<string>('minutes');
  const [showInOfferwall, setShowInOfferwall] = useState<boolean>(true);
  
  // Email notification options
  const [sendEmail, setSendEmail] = useState<boolean>(false);
  const [emailRecipients, setEmailRecipients] = useState<string>('all_publishers');
  const [emailSchedule, setEmailSchedule] = useState<string>('now');
  const [emailScheduleTime, setEmailScheduleTime] = useState<string>('');
  const [offersPerEmail, setOffersPerEmail] = useState<number>(0);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [publishersList, setPublishersList] = useState<Array<{_id: string; username: string; email: string}>>([]);
  const [publisherSearch, setPublisherSearch] = useState('');
  const [loadingPublishers, setLoadingPublishers] = useState(false);

  const fetchPublishers = async () => {
    if (publishersList.length > 0) return;
    setLoadingPublishers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/auth/admin/users?status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const users = (data.users || []).map((u: any) => ({
        _id: u._id || u.id,
        username: u.username || u.first_name || '',
        email: u.email || ''
      }));
      setPublishersList(users);
    } catch { /* ignore */ } finally {
      setLoadingPublishers(false);
    }
  };
  
  // Import progress
  const [importProgress, setImportProgress] = useState(0);
  const [importStep, setImportStep] = useState<string>('');
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ offer_name: string; error: string }>>([]);
  
  // Loading states
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const getEffectiveNetworkId = () => {
    if (networkType === 'everflow') return apiUrl || 'https://api.eflow.team';
    if (networkType === 'mobplus') return apiUrl || 'http://mob.mobplus.net';
    return networkId;
  };

  // Get the display value for an offer field (edited or original)
  const getOfferValue = (offer: FullPreviewOffer, field: keyof FullPreviewOffer) => {
    const edited = editedOffers[offer._temp_id];
    if (edited && field in edited) return edited[field as string];
    return offer[field];
  };

  // Update an edited field
  const updateOfferField = (tempId: string, field: string, value: any) => {
    setEditedOffers(prev => ({
      ...prev,
      [tempId]: { ...prev[tempId], [field]: value }
    }));
  };
  
  const handleTestConnection = async () => {
    const effectiveId = getEffectiveNetworkId();
    if (!effectiveId || !apiKey) {
      toast({ title: 'Error', description: networkType === 'everflow' ? 'Please enter API URL and API Key' : 'Please enter Network ID and API Key', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const response = await apiImportService.testConnection({ network_id: effectiveId, api_key: apiKey, network_type: networkType, fetch_mode: fetchMode });
      if (response.success) {
        toast({ title: 'Connection Successful', description: `Found ${response.offer_count} offers available` });
        setTotalAvailable(response.offer_count || 0);
      }
    } catch (error) {
      toast({ title: 'Connection Failed', description: error instanceof Error ? error.message : 'Failed to connect to API', variant: 'destructive' });
    } finally { setTesting(false); }
  };
  
  const handleFetchFullPreview = async () => {
    const effectiveId = getEffectiveNetworkId();
    if (!effectiveId || !apiKey) { toast({ title: 'Error', description: 'Please test connection first', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const response = await apiImportService.fetchFullPreview({ network_id: effectiveId, api_key: apiKey, network_type: networkType, fetch_mode: fetchMode });
      if (response.success && response.offers) {
        setFullPreviewOffers(response.offers);
        setAuditSummary(response.audit_summary);
        setTotalAvailable(response.total || response.offers.length);
        const nonDupIds = new Set(response.offers.filter(o => !o.is_duplicate).map(o => o._temp_id));
        setSelectedOfferIds(nonDupIds);
        setCurrentStep('audit');
      }
    } catch (error) {
      toast({ title: 'Preview Failed', description: error instanceof Error ? error.message : 'Failed to fetch offers', variant: 'destructive' });
    } finally { setLoading(false); }
  };
  
  const handleImport = async () => {
    setCurrentStep('importing');
    setImporting(true);
    setImportProgress(0);
    setImportStep('📡 Fetching offers from network API...');
    const steps = [
      { pct: 15, msg: '📡 Fetching offers from network API...' },
      { pct: 30, msg: '🔍 Validating offer data...' },
      { pct: 45, msg: '🌐 Checking partner networks...' },
      { pct: 60, msg: '🔗 Injecting tracking parameters...' },
      { pct: 75, msg: '💾 Saving offers to database...' },
    ];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < steps.length) { setImportProgress(steps[stepIndex].pct); setImportStep(steps[stepIndex].msg); stepIndex++; }
      else { setImportProgress((prev) => Math.min(prev + 2, 90)); }
    }, 600);
    
    try {
      let delayInMinutes = autoApproveDelay;
      if (autoApproveDelayUnit === 'hours') delayInMinutes = autoApproveDelay * 60;
      else if (autoApproveDelayUnit === 'days') delayInMinutes = autoApproveDelay * 60 * 24;
      
      const response = await apiImportService.importOffers({
        network_id: getEffectiveNetworkId(),
        api_key: apiKey,
        network_type: networkType,
        fetch_mode: fetchMode,
        options: {
          skip_duplicates: skipDuplicates,
          update_existing: updateExisting,
          auto_activate: autoActivate,
          default_status: defaultStatus,
          show_in_offerwall: showInOfferwall,
          approval_type: approvalType,
          auto_approve_delay: delayInMinutes,
          require_approval: approvalType !== 'auto_approve',
          send_email: sendEmail,
          email_recipients: emailRecipients,
          email_schedule: emailSchedule,
          email_schedule_time: emailScheduleTime,
          offers_per_email: offersPerEmail,
          selected_user_ids: emailRecipients === 'specific_users' ? selectedUserIds : [],
        },
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportStep('✅ Import complete!');
      
      if (response.summary) {
        setImportSummary(response.summary);
        setImportErrors(response.errors || []);
        setCurrentStep('complete');
        const imported = response.summary.imported || 0;
        const errors = response.summary.errors || 0;
        if (imported > 0 && errors > 0) toast({ title: 'Import Partially Complete', description: `Imported ${imported} offers, ${errors} failed.` });
        else if (imported > 0) toast({ title: 'Import Complete', description: `Successfully imported ${imported} offers` });
        else toast({ title: 'Import Failed', description: `No offers were imported. ${errors} errors occurred.`, variant: 'destructive' });
        onImportComplete();
      } else if (response.success) { setCurrentStep('complete'); setImportSummary({ total_fetched: 0, imported: 0, skipped: 0, errors: 0 }); onImportComplete(); }
    } catch (error) {
      clearInterval(progressInterval);
      toast({ title: 'Import Failed', description: error instanceof Error ? error.message : 'Failed to import offers', variant: 'destructive' });
      setCurrentStep('options');
    } finally { setImporting(false); }
  };
  
  const handleClose = () => {
    setCurrentStep('credentials'); setNetworkId(''); setApiKey(''); setApiUrl('');
    setFetchMode('my_offers');
    setFullPreviewOffers([]); setAuditSummary(null); setAuditFilter('all');
    setSelectedOfferIds(new Set()); setEditedOffers({}); setEditingOfferId(null);
    setImportSummary(null); setImportErrors([]); setImportStep(''); setTotalAvailable(0);
    onOpenChange(false);
  };

  const filteredAuditOffers = useMemo(() => {
    let filtered = fullPreviewOffers;
    if (auditFilter !== 'all') filtered = filtered.filter(o => o.issues.includes(auditFilter));
    if (auditSearch.trim()) {
      const search = auditSearch.toLowerCase();
      filtered = filtered.filter(o => o.name.toLowerCase().includes(search) || o.campaign_id.toLowerCase().includes(search));
    }
    return filtered;
  }, [fullPreviewOffers, auditFilter, auditSearch]);

  const toggleOfferSelection = (tempId: string) => {
    setSelectedOfferIds(prev => { const next = new Set(prev); if (next.has(tempId)) next.delete(tempId); else next.add(tempId); return next; });
  };
  const selectAllFiltered = () => { setSelectedOfferIds(prev => { const next = new Set(prev); filteredAuditOffers.forEach(o => next.add(o._temp_id)); return next; }); };
  const deselectAllFiltered = () => { setSelectedOfferIds(prev => { const next = new Set(prev); filteredAuditOffers.forEach(o => next.delete(o._temp_id)); return next; }); };

  // Bulk AI action states
  const [aiLoading, setAiLoading] = useState<string | null>(null); // 'verticals' | 'descriptions' | 'images' | 'masking'

  // AI Suggest Verticals for selected offers
  const handleAiSuggestVerticals = async () => {
    const selectedOffers = fullPreviewOffers.filter(o => selectedOfferIds.has(o._temp_id));
    if (selectedOffers.length === 0) { toast({ title: 'No offers selected', variant: 'destructive' }); return; }
    
    setAiLoading('verticals');
    try {
      const payload = selectedOffers.slice(0, 50).map(o => ({
        offer_id: o._temp_id,
        name: (getOfferValue(o, 'name') as string) || o.name,
        description: (getOfferValue(o, 'description') as string) || o.description || '',
      }));
      
      const res = await adminOfferApi.bulkSuggestVerticals(payload);
      if (res.success && res.suggestions) {
        const newEdits = { ...editedOffers };
        for (const [tempId, vertical] of Object.entries(res.suggestions)) {
          newEdits[tempId] = { ...newEdits[tempId], vertical };
        }
        setEditedOffers(newEdits);
        toast({ title: 'Verticals Suggested', description: `AI suggested verticals for ${Object.keys(res.suggestions).length} offers` });
      }
    } catch (err: any) {
      toast({ title: 'AI Suggest Failed', description: err.message || 'Failed to suggest verticals', variant: 'destructive' });
    } finally { setAiLoading(null); }
  };

  // AI Generate Descriptions for selected offers
  const handleAiGenerateDescriptions = async () => {
    const selectedOffers = fullPreviewOffers.filter(o => selectedOfferIds.has(o._temp_id));
    if (selectedOffers.length === 0) { toast({ title: 'No offers selected', variant: 'destructive' }); return; }
    
    setAiLoading('descriptions');
    try {
      const payload = selectedOffers.slice(0, 30).map(o => ({
        offer_id: o._temp_id,
        name: (getOfferValue(o, 'name') as string) || o.name,
        vertical: (getOfferValue(o, 'vertical') as string) || o.vertical || '',
        category: o.category || '',
        countries: o.countries || [],
      }));
      
      const res = await adminOfferApi.bulkGenerateDescriptions(payload);
      if (res.success && res.descriptions) {
        const newEdits = { ...editedOffers };
        for (const [tempId, description] of Object.entries(res.descriptions)) {
          newEdits[tempId] = { ...newEdits[tempId], description };
        }
        setEditedOffers(newEdits);
        toast({ title: 'Descriptions Generated', description: `AI generated descriptions for ${Object.keys(res.descriptions).length} offers` });
      }
    } catch (err: any) {
      toast({ title: 'AI Generate Failed', description: err.message || 'Failed to generate descriptions', variant: 'destructive' });
    } finally { setAiLoading(null); }
  };

  // Assign stock images to offers missing images
  const handleAssignImages = async () => {
    const selectedOffers = fullPreviewOffers.filter(o => selectedOfferIds.has(o._temp_id) && o.issues.includes('missing_image'));
    if (selectedOffers.length === 0) { toast({ title: 'No offers with missing images in selection' }); return; }
    
    setAiLoading('images');
    try {
      // For pre-import offers, we assign category-based stock images locally
      const newEdits = { ...editedOffers };
      const categoryImageMap: Record<string, string> = {
        'FINANCE': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
        'GAMBLING': 'https://cdn-icons-png.flaticon.com/512/3425/3425924.png',
        'GAMES_INSTALL': 'https://cdn-icons-png.flaticon.com/512/3612/3612569.png',
        'INSTALLS': 'https://cdn-icons-png.flaticon.com/512/2920/2920349.png',
        'SURVEY': 'https://cdn-icons-png.flaticon.com/512/1484/1484799.png',
        'SWEEPSTAKES': 'https://cdn-icons-png.flaticon.com/512/3132/3132693.png',
        'HEALTH': 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png',
        'DATING': 'https://cdn-icons-png.flaticon.com/512/1077/1077035.png',
        'EDUCATION': 'https://cdn-icons-png.flaticon.com/512/3976/3976625.png',
        'FREE_TRIAL': 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
        'INSURANCE': 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png',
        'ENTERTAINMENT': 'https://cdn-icons-png.flaticon.com/512/3659/3659784.png',
        'CRYPTO': 'https://cdn-icons-png.flaticon.com/512/6001/6001527.png',
      };
      
      let assigned = 0;
      for (const offer of selectedOffers) {
        const vertical = (getOfferValue(offer, 'vertical') as string) || offer.vertical || '';
        const img = categoryImageMap[vertical.toUpperCase()] || 'https://cdn-icons-png.flaticon.com/512/1170/1170576.png';
        newEdits[offer._temp_id] = { ...newEdits[offer._temp_id], image_url: img };
        assigned++;
      }
      setEditedOffers(newEdits);
      toast({ title: 'Images Assigned', description: `Assigned category-based images to ${assigned} offers` });
    } catch (err: any) {
      toast({ title: 'Image Assignment Failed', description: err.message, variant: 'destructive' });
    } finally { setAiLoading(null); }
  };

  // Preview masking — show what tracking params will be injected
  const handlePreviewMasking = async () => {
    toast({ 
      title: '🔗 Masking Info', 
      description: 'Tracking URL masking & partner param injection happens automatically during import. The system detects the Upward Partner by domain and injects the correct parameters.' 
    });
  };

  // Inline edit row component
  const renderOfferRow = (offer: FullPreviewOffer) => {
    const isEditing = editingOfferId === offer._temp_id;
    const isSelected = selectedOfferIds.has(offer._temp_id);
    const displayVertical = getOfferValue(offer, 'vertical') as string;
    const displayDesc = getOfferValue(offer, 'description') as string;
    const displayImage = getOfferValue(offer, 'image_url') as string;
    const displayUrl = getOfferValue(offer, 'target_url') as string;
    const displayPayout = getOfferValue(offer, 'payout') as number;

    if (isEditing) {
      return (
        <TableRow key={offer._temp_id} className="bg-blue-50/50 border-blue-200">
          <TableCell colSpan={5} className="p-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{offer.name}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingOfferId(null)}>
                    <Check className="h-3 w-3 mr-1" /> Done
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Vertical / Category</Label>
                  <Select value={displayVertical || ''} onValueChange={(v) => updateOfferField(offer._temp_id, 'vertical', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      {['HEALTH','SURVEY','SWEEPSTAKES','EDUCATION','INSURANCE','LOAN','FINANCE','DATING','FREE_TRIAL','INSTALLS','GAMES_INSTALL','GAMBLING','ENTERTAINMENT','SHOPPING','TRAVEL','CRYPTO'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Payout ({offer.currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs"
                    value={displayPayout || ''}
                    onChange={(e) => updateOfferField(offer._temp_id, 'payout', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground">Description</Label>
                <Textarea
                  className="text-xs min-h-[60px] resize-none"
                  value={displayDesc || ''}
                  onChange={(e) => updateOfferField(offer._temp_id, 'description', e.target.value)}
                  placeholder="Enter offer description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Image URL</Label>
                  <div className="flex gap-1">
                    <Input
                      className="h-8 text-xs flex-1"
                      value={displayImage || ''}
                      onChange={(e) => updateOfferField(offer._temp_id, 'image_url', e.target.value)}
                      placeholder="https://..."
                    />
                    {displayImage && (
                      <img src={displayImage} alt="" className="h-8 w-8 rounded border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Tracking URL (Masking)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={displayUrl || ''}
                    onChange={(e) => updateOfferField(offer._temp_id, 'target_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              {offer.is_duplicate && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800">
                    Duplicate detected (Campaign ID: {offer.campaign_id} already exists). You can still select it to re-import if needed.
                  </span>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow key={offer._temp_id} className={`text-xs hover:bg-gray-50 ${offer.is_duplicate ? 'opacity-60 bg-red-50/20' : ''}`}>
        <TableCell className="w-8 pr-0">
          <input type="checkbox" checked={isSelected} onChange={() => toggleOfferSelection(offer._temp_id)} className="rounded border-gray-300 h-3.5 w-3.5" />
        </TableCell>
        <TableCell className="max-w-[280px]">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-xs leading-tight truncate">{offer.name || 'Unnamed'}</span>
            <div className="flex items-center gap-1 flex-wrap">
              {displayVertical && <Badge variant="outline" className="text-[9px] px-1 py-0">{displayVertical}</Badge>}
              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{offer.network}</span>
            </div>
          </div>
        </TableCell>
        <TableCell className="w-16">
          <span className="font-medium">{offer.currency === 'USD' ? '$' : offer.currency === 'EUR' ? '€' : offer.currency}{(displayPayout || 0).toFixed(2)}</span>
        </TableCell>
        <TableCell className="w-20">
          <div className="flex gap-0.5 flex-wrap">
            {(offer.countries || []).slice(0, 2).map((c) => (<Badge key={c} variant="outline" className="text-[9px] px-1 py-0">{c}</Badge>))}
            {(offer.countries || []).length > 2 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{offer.countries.length - 2}</Badge>}
          </div>
        </TableCell>
        <TableCell className="w-24">
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              {offer.issues.includes('missing_image') && <span title="Missing Image">🖼️</span>}
              {offer.issues.includes('missing_description') && <span title="Missing Description">📝</span>}
              {offer.issues.includes('missing_vertical') && <span title="Missing Vertical">⚠️</span>}
              {offer.issues.includes('missing_payout') && <span title="Missing Payout">💸</span>}
              {offer.issues.includes('missing_tracking_url') && <span title="Missing URL">🔗</span>}
              {offer.is_duplicate && <Badge variant="destructive" className="text-[9px] px-1 py-0">DUP</Badge>}
              {offer.issues.length === 0 && !offer.is_duplicate && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => setEditingOfferId(offer._temp_id)}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Offers from API</DialogTitle>
          <DialogDescription>Import offers directly from affiliate network APIs</DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Credentials */}
        {currentStep === 'credentials' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Network Type *</Label>
              <Select value={networkType} onValueChange={(v) => { setNetworkType(v); setTotalAvailable(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hasoffers">HasOffers / Tune</SelectItem>
                  <SelectItem value="everflow">Everflow</SelectItem>
                  <SelectItem value="mobplus">MobPlus</SelectItem>
                  <SelectItem value="cj" disabled>Commission Junction (Coming Soon)</SelectItem>
                  <SelectItem value="shareasale" disabled>ShareASale (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {networkType === 'hasoffers' && (
              <div className="space-y-2">
                <Label>Network ID *</Label>
                <Input placeholder="e.g., cpamerchant" value={networkId} onChange={(e) => setNetworkId(e.target.value)} />
              </div>
            )}
            
            {networkType === 'everflow' && (
              <div className="space-y-2">
                <Label>API URL / Endpoint *</Label>
                <Input placeholder="https://api.eflow.team" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Default: https://api.eflow.team — auto-appends /v1/affiliates/offersrunnable</p>
              </div>
            )}
            
            {networkType === 'mobplus' && (
              <div className="space-y-2">
                <Label>API URL / Endpoint *</Label>
                <Input placeholder="http://mob.mobplus.net" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Default: http://mob.mobplus.net — auto-appends /api/affiliate/offers</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>API Key *</Label>
              <div className="relative">
                <Input type={showApiKey ? 'text' : 'password'} placeholder={networkType === 'everflow' ? 'Enter your x-eflow-api-key' : networkType === 'mobplus' ? 'Enter your MobPlus Authorization token' : 'Enter your API key'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="pr-10" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {(networkType === 'hasoffers' || networkType === 'everflow') && (
              <div className="space-y-2">
                <Label>Fetch Mode</Label>
                <Select value={fetchMode} onValueChange={(v) => { setFetchMode(v as 'my_offers' | 'all_offers'); setTotalAvailable(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="my_offers">📋 My Offers (Approved for your account)</SelectItem>
                    <SelectItem value="all_offers">🌐 All Offers (Entire network catalog)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {fetchMode === 'my_offers' 
                    ? 'Fetches only offers approved/available for your affiliate account.' 
                    : 'Fetches all offers in the network — includes offers you may not be approved for yet.'}
                </p>
              </div>
            )}
            
            <Button onClick={handleTestConnection} disabled={testing || (networkType === 'hasoffers' ? !networkId : !apiUrl) || !apiKey}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Test Connection
            </Button>
            
            {totalAvailable > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800">Connection successful! Found {totalAvailable} offers</span>
              </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleFetchFullPreview} disabled={loading || (networkType === 'hasoffers' ? !networkId : !apiUrl) || !apiKey}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Next: Fetch & Preview Offers
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Audit / Full Preview */}
        {currentStep === 'audit' && (
          <div className="space-y-3 flex flex-col h-full min-h-0">
            {auditSummary && (
              <div className="space-y-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Offer Audit Preview</h3>
                  <Badge variant="outline">{fullPreviewOffers.length} offers fetched</Badge>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'missing_vertical' as AuditFilter, count: auditSummary.missing_vertical, label: '⚠️ No Vertical', color: 'amber' },
                    { key: 'missing_description' as AuditFilter, count: auditSummary.missing_description, label: '📝 No Description', color: 'blue' },
                    { key: 'missing_image' as AuditFilter, count: auditSummary.missing_image, label: '🖼️ No Image', color: 'violet' },
                    { key: 'is_duplicate' as AuditFilter, count: auditSummary.is_duplicate, label: '🔁 Duplicates', color: 'red' },
                  ].map(card => (
                    <button key={card.key} onClick={() => setAuditFilter(auditFilter === card.key ? 'all' : card.key)}
                      className={`p-2.5 rounded-lg border-2 text-left transition-all ${auditFilter === card.key ? `border-${card.color}-400 bg-${card.color}-50 ring-1 ring-${card.color}-200` : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`text-xl font-bold text-${card.color}-600`}>{card.count}</div>
                      <div className="text-[10px] text-muted-foreground">{card.label}</div>
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: 'missing_payout' as AuditFilter, label: `💸 No Payout (${auditSummary.missing_payout})` },
                    { key: 'missing_countries' as AuditFilter, label: `🌍 No GEO (${auditSummary.missing_countries})` },
                    { key: 'missing_tracking_url' as AuditFilter, label: `🔗 No URL (${auditSummary.missing_tracking_url})` },
                    { key: 'all' as AuditFilter, label: `📋 All (${auditSummary.total})` },
                  ].map(pill => (
                    <button key={pill.key} onClick={() => setAuditFilter(pill.key)}
                      className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${auditFilter === pill.key ? 'border-gray-600 bg-gray-100 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search + Select */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search offers by name or campaign ID..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filteredAuditOffers.length > 0 && filteredAuditOffers.every(o => selectedOfferIds.has(o._temp_id))}
                    onChange={() => { if (filteredAuditOffers.every(o => selectedOfferIds.has(o._temp_id))) deselectAllFiltered(); else selectAllFiltered(); }}
                    className="rounded border-gray-300 h-3.5 w-3.5" />
                  Select all
                </label>
                <Badge variant="secondary" className="text-[10px]">{selectedOfferIds.size} selected</Badge>
              </div>
            </div>
            
            {/* Bulk AI Actions Bar */}
            <div className="flex items-center gap-2 flex-shrink-0 p-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
              <span className="text-[11px] font-medium text-purple-700 mr-1">🤖 AI Actions:</span>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-purple-200 hover:bg-purple-100" onClick={handleAiSuggestVerticals} disabled={aiLoading !== null || selectedOfferIds.size === 0}>
                {aiLoading === 'verticals' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-600" />}
                Suggest Verticals
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-blue-200 hover:bg-blue-100" onClick={handleAiGenerateDescriptions} disabled={aiLoading !== null || selectedOfferIds.size === 0}>
                {aiLoading === 'descriptions' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 text-blue-600" />}
                Generate Descriptions
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-green-200 hover:bg-green-100" onClick={handleAssignImages} disabled={aiLoading !== null || selectedOfferIds.size === 0}>
                {aiLoading === 'images' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3 text-green-600" />}
                Assign Images
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-cyan-200 hover:bg-cyan-100" onClick={handlePreviewMasking} disabled={aiLoading !== null}>
                <Link className="h-3 w-3 text-cyan-600" />
                Masking Info
              </Button>
            </div>
            
            {/* Offer Table — scrollable */}
            <div className="border rounded-md flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(95vh - 430px)' }}>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs sticky top-0 bg-white z-10">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-16">Payout</TableHead>
                    <TableHead className="w-20">GEO</TableHead>
                    <TableHead className="w-24">Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditOffers.slice(0, 200).map(renderOfferRow)}
                </TableBody>
              </Table>
              {filteredAuditOffers.length > 200 && (
                <div className="text-center py-2 text-xs text-muted-foreground border-t">Showing 200 of {filteredAuditOffers.length} offers</div>
              )}
              {filteredAuditOffers.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">No offers match the current filter</div>
              )}
            </div>
            
            {/* Duplicate info note */}
            {auditSummary && auditSummary.is_duplicate > 0 && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-amber-800">Duplicate Detection:</span>
                  <span className="text-amber-700"> Checked by Campaign ID match against existing offers in your database. Duplicates are deselected by default but you can still select and re-import them if needed. No legit offer will be lost.</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-2 flex-shrink-0">
              <Button variant="outline" onClick={() => setCurrentStep('credentials')}>Back</Button>
              <Button onClick={() => setCurrentStep('options')} disabled={selectedOfferIds.size === 0}>
                Next: Import {selectedOfferIds.size} Offers →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Options */}
        {currentStep === 'options' && (
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 150px)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import Settings</h3>
              <Badge className="bg-green-100 text-green-800">{selectedOfferIds.size} offers selected</Badge>
            </div>
            
            <div className="space-y-3 p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold">Import Options</h4>
              <div className="flex items-center space-x-2">
                <Checkbox id="skip-duplicates" checked={skipDuplicates} onCheckedChange={(c) => setSkipDuplicates(c as boolean)} />
                <label htmlFor="skip-duplicates" className="text-sm cursor-pointer">Skip duplicate offers (check by Campaign ID)</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="update-existing" checked={updateExisting} onCheckedChange={(c) => setUpdateExisting(c as boolean)} disabled={skipDuplicates} />
                <label htmlFor="update-existing" className="text-sm cursor-pointer">Update existing offers with new data</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="auto-activate" checked={autoActivate} onCheckedChange={(c) => setAutoActivate(c as boolean)} />
                <label htmlFor="auto-activate" className="text-sm cursor-pointer">Auto-activate imported offers</label>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Default Status</Label>
                <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="pending">🟡 Pending</SelectItem>
                    <SelectItem value="inactive">⚫ Inactive</SelectItem>
                    <SelectItem value="paused">⏸️ Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="show-in-offerwall" checked={showInOfferwall} onCheckedChange={(c) => setShowInOfferwall(c as boolean)} />
                <label htmlFor="show-in-offerwall" className="text-sm cursor-pointer">🖼️ Show offers in Offerwall</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="send-email-api" checked={sendEmail} onCheckedChange={(c) => setSendEmail(c as boolean)} />
                <label htmlFor="send-email-api" className="text-sm cursor-pointer">📧 Send email notification to publishers</label>
              </div>
              
              {sendEmail && (
                <div className="space-y-3 ml-6 pl-3 border-l-2 border-blue-200">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Send To</Label>
                    <Select value={emailRecipients} onValueChange={(v) => { setEmailRecipients(v); if (v === 'specific_users') fetchPublishers(); }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_publishers">👥 All Publishers</SelectItem>
                        <SelectItem value="active_publishers">✅ Active Publishers Only</SelectItem>
                        <SelectItem value="specific_users">🎯 Select Specific Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {emailRecipients === 'specific_users' && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Select Users ({selectedUserIds.length} selected)</Label>
                      <Input placeholder="Search..." value={publisherSearch} onChange={(e) => setPublisherSearch(e.target.value)} className="h-8 text-sm" />
                      <div className="max-h-32 overflow-y-auto border rounded p-1 bg-white space-y-0.5">
                        {loadingPublishers ? <p className="text-xs text-center py-2">Loading...</p> :
                          publishersList.filter(u => !publisherSearch || u.username.toLowerCase().includes(publisherSearch.toLowerCase()) || u.email.toLowerCase().includes(publisherSearch.toLowerCase()))
                            .map(u => (
                              <label key={u._id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-xs">
                                <input type="checkbox" checked={selectedUserIds.includes(u._id)} onChange={(e) => { if (e.target.checked) setSelectedUserIds(p => [...p, u._id]); else setSelectedUserIds(p => p.filter(id => id !== u._id)); }} className="h-3 w-3" />
                                <span>{u.username}</span><span className="text-muted-foreground">{u.email}</span>
                              </label>
                            ))
                        }
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">When to Send</Label>
                    <Select value={emailSchedule} onValueChange={setEmailSchedule}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="now">⚡ Send Immediately</SelectItem>
                        <SelectItem value="scheduled">🕐 Schedule for Later</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {emailSchedule === 'scheduled' && (
                    <Input type="datetime-local" value={emailScheduleTime} onChange={(e) => setEmailScheduleTime(e.target.value)} className="h-8 text-sm" />
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Offers per Email</Label>
                    <Select value={offersPerEmail.toString()} onValueChange={(v) => setOffersPerEmail(parseInt(v))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">📦 All in one email</SelectItem>
                        <SelectItem value="5">5 per email</SelectItem>
                        <SelectItem value="10">10 per email</SelectItem>
                        <SelectItem value="20">20 per email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <div className="border-t pt-3 mt-3">
                <h5 className="font-medium text-sm mb-3">Approval Workflow</h5>
                <Select value={approvalType} onValueChange={setApprovalType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_approve">🟢 Direct Access (Instant)</SelectItem>
                    <SelectItem value="time_based">⏰ Time-Based Auto-Approval</SelectItem>
                    <SelectItem value="manual">🔐 Manual Admin Approval</SelectItem>
                  </SelectContent>
                </Select>
                {approvalType === 'time_based' && (
                  <div className="flex gap-2 mt-2">
                    <Input type="number" min="1" placeholder="60" value={autoApproveDelay || ''} onChange={(e) => setAutoApproveDelay(parseInt(e.target.value) || 0)} className="flex-1" />
                    <Select value={autoApproveDelayUnit} onValueChange={setAutoApproveDelayUnit}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-3 mt-3">
                <h5 className="font-medium text-sm mb-3">Default Values</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm">Star Rating</Label>
                    <Select value={defaultStarRating.toString()} onValueChange={(v) => setDefaultStarRating(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">⭐ 1</SelectItem><SelectItem value="2">⭐⭐ 2</SelectItem>
                        <SelectItem value="3">⭐⭐⭐ 3</SelectItem><SelectItem value="4">⭐⭐⭐⭐ 4</SelectItem>
                        <SelectItem value="5">⭐⭐⭐⭐⭐ 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Timer (min)</Label>
                    <Input type="number" min="0" max="999" value={defaultTimer || ''} onChange={(e) => setDefaultTimer(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep('audit')}>← Back to Preview</Button>
              <Button onClick={handleImport} disabled={importing}>Import {selectedOfferIds.size} Offers</Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {currentStep === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center mb-2">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-1">Importing Offers...</h3>
            </div>
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{importStep || 'Processing...'}</span>
              </div>
              <Progress value={importProgress} className="h-2" />
              <div className="flex justify-between text-xs text-blue-600">
                <span>Step {Math.max(1, Math.ceil(importProgress / 20))} of 5</span>
                <span>{importProgress}%</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 5: Complete */}
        {currentStep === 'complete' && importSummary && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-2xl font-bold text-blue-600">{importSummary.total_fetched}</div>
                <div className="text-sm text-blue-800">Total Fetched</div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="text-2xl font-bold text-green-600">{importSummary.imported}</div>
                <div className="text-sm text-green-800">Imported</div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-2xl font-bold text-yellow-600">{importSummary.skipped}</div>
                <div className="text-sm text-yellow-800">Skipped</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-2xl font-bold text-red-600">{importSummary.errors}</div>
                <div className="text-sm text-red-800">Errors</div>
              </div>
            </div>
            {importErrors.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-md p-3 bg-red-50">
                {importErrors.map((error, i) => (
                  <div key={i} className="text-sm mb-1"><span className="font-medium">{error.offer_name}:</span> <span className="text-red-600">{error.error}</span></div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button onClick={handleClose}>View Imported Offers</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

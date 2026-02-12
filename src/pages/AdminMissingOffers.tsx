import { useState, useEffect, useRef } from "react";
import {
  Search, Mail, Calendar, Clock, CheckCircle, XCircle,
  Loader2, RefreshCw, MoreHorizontal, Send, Eye, Package, Upload, FileSpreadsheet, ChevronDown, ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";

// Email History Card Component with expandable offer details
const EmailHistoryCard = ({ 
  email, 
  onSendNow, 
  onCancel 
}: { 
  email: ScheduledEmail; 
  onSendNow: (id: string) => void; 
  onCancel: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  
  // Parse offers from email body
  const parseOffersFromBody = (body: string): Array<{name: string; country: string; platform: string; model: string}> => {
    const offers: Array<{name: string; country: string; platform: string; model: string}> = [];
    const lines = body.split('\n');
    
    let currentOffer: {name: string; country: string; platform: string; model: string} | null = null;
    
    for (const line of lines) {
      // Match offer name line like "  1. Offer Name"
      const nameMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
      if (nameMatch) {
        if (currentOffer) {
          offers.push(currentOffer);
        }
        currentOffer = { name: nameMatch[2].trim(), country: '', platform: '', model: '' };
      }
      
      // Match details line like "     Country: US | Platform: iOS | Model: CPA"
      const detailsMatch = line.match(/Country:\s*([^|]+)\s*\|\s*Platform:\s*([^|]+)\s*\|\s*Model:\s*(.+)/i);
      if (detailsMatch && currentOffer) {
        currentOffer.country = detailsMatch[1].trim();
        currentOffer.platform = detailsMatch[2].trim();
        currentOffer.model = detailsMatch[3].trim();
      }
    }
    
    if (currentOffer) {
      offers.push(currentOffer);
    }
    
    return offers;
  };
  
  const offers = parseOffersFromBody(email.body);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-700 border-gray-300">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      'iOS': 'bg-blue-100 text-blue-800',
      'Android': 'bg-green-100 text-green-800',
      'Web': 'bg-purple-100 text-purple-800',
      'All': 'bg-gray-100 text-gray-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };
  
  const getPayoutModelBadge = (model: string) => {
    const colors: Record<string, string> = {
      'CPA': 'bg-orange-100 text-orange-800',
      'CPI': 'bg-cyan-100 text-cyan-800',
      'CPL': 'bg-yellow-100 text-yellow-800',
      'CPS': 'bg-pink-100 text-pink-800',
      'RevShare': 'bg-indigo-100 text-indigo-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[model] || 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className={`border rounded-lg overflow-hidden ${email.status === 'sent' ? 'bg-green-50/30' : email.status === 'pending' ? 'bg-yellow-50/30' : ''}`}>
      {/* Header Row */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status indicator */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            email.status === 'sent' ? 'bg-green-500' : 
            email.status === 'pending' ? 'bg-yellow-500' : 
            email.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          
          {/* Subject and recipient */}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{email.subject}</p>
            <p className="text-xs text-muted-foreground truncate">
              To: {email.recipients?.join(', ')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Offer count */}
          <Badge variant="secondary" className="text-xs">
            {offers.length} offers
          </Badge>
          
          {/* Scheduled time */}
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(email.scheduled_at).toLocaleDateString()}
            <Clock className="h-3 w-3 ml-1" />
            {new Date(email.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          {/* Status */}
          {getStatusBadge(email.status)}
          
          {/* Actions */}
          {email.status === 'pending' && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onSendNow(email._id)} title="Send Now">
                <Send className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => onCancel(email._id)} title="Cancel">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {/* Expand icon */}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      
      {/* Expanded Offer Details */}
      {expanded && offers.length > 0 && (
        <div className="border-t bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Offers in this email:</p>
          <div className="space-y-2">
            {offers.map((offer, idx) => (
              <div key={idx} className={`flex items-center justify-between p-2 rounded-md ${email.status === 'sent' ? 'bg-green-100/50' : 'bg-white'} border`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${email.status === 'sent' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {email.status === 'sent' ? <CheckCircle className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span className={`text-sm truncate ${email.status === 'sent' ? 'line-through text-muted-foreground' : ''}`}>
                    {offer.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">{offer.country || 'GLOBAL'}</Badge>
                  <Badge className={`text-xs ${getPlatformBadge(offer.platform)}`}>{offer.platform}</Badge>
                  <Badge className={`text-xs ${getPayoutModelBadge(offer.model)}`}>{offer.model}</Badge>
                </div>
              </div>
            ))}
          </div>
          
          {/* Sent timestamp if sent */}
          {email.status === 'sent' && email.sent_at && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Delivered on {new Date(email.sent_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface MissingOffer {
  _id: string;
  match_key: string;
  name: string;
  country: string;
  platform: string;
  payout_model: string;
  payout: number;
  description: string;
  tracking_url: string;
  vertical: string;
  reason: string;
  reason_display: string;
  source: string;
  network: string;
  status: string;
  email_sent: boolean;
  seen_count: number;
  created_at: string;
}

interface ScheduledEmail {
  _id: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduled_at: string;
  status: string;
  network: string;
  offer_count: number;
  created_at: string;
  sent_at: string;
  related_offer_ids?: string[];
  offer_details?: Array<{
    name: string;
    country: string;
    platform: string;
    payout_model: string;
  }>;
}

interface Stats {
  total: number;
  pending: number;
  resolved: number;
  ignored: number;
  by_platform: Record<string, number>;
  by_payout_model: Record<string, number>;
  by_network: Record<string, number>;
  top_countries: Record<string, number>;
}

const AdminMissingOffers = () => {
  const [activeTab, setActiveTab] = useState("check");
  const [offers, setOffers] = useState<MissingOffer[]>([]);
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [payoutModels, setPayoutModels] = useState<string[]>([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [payoutModelFilter, setPayoutModelFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Selection
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  
  // Email composer
  const [composeOpen, setComposeOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [sendInDays, setSendInDays] = useState("0");
  const [sending, setSending] = useState(false);
  
  // View offer details
  const [viewOffer, setViewOffer] = useState<MissingOffer | null>(null);
  
  // Inventory cross-check
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResults, setCheckResults] = useState<{
    in_inventory: any[];
    not_in_inventory: any[];
    stats: { total: number; have: number; dont_have: number; have_percent: number; dont_have_percent: number };
  } | null>(null);
  const [checkResultsTab, setCheckResultsTab] = useState<'have' | 'dont_have'>('dont_have');
  const [sheetUrl, setSheetUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Email automation for missing offers
  const [emailAutomationOpen, setEmailAutomationOpen] = useState(false);
  const [automationEmail, setAutomationEmail] = useState("");
  const [automationInterval, setAutomationInterval] = useState("24"); // hours between emails (24 = 1 day)
  const [automationOffersPerEmail, setAutomationOffersPerEmail] = useState("5");
  const [automationSending, setAutomationSending] = useState(false);
  const [scheduledOfferIndices, setScheduledOfferIndices] = useState<Set<number>>(new Set()); // Scheduled but not sent
  const [deliveredOfferIndices, setDeliveredOfferIndices] = useState<Set<number>>(new Set()); // Actually sent
  
  const { toast } = useToast();

  // Load persisted check results on mount
  useEffect(() => {
    const savedResults = localStorage.getItem('inventoryCheckResults');
    if (savedResults) {
      try {
        const parsed = JSON.parse(savedResults);
        setCheckResults(parsed.results);
        setScheduledOfferIndices(new Set(parsed.scheduledIndices || []));
        setDeliveredOfferIndices(new Set(parsed.deliveredIndices || []));
      } catch (e) {
        console.error('Failed to parse saved results:', e);
      }
    }
  }, []);

  // Save check results to localStorage when they change
  useEffect(() => {
    if (checkResults) {
      localStorage.setItem('inventoryCheckResults', JSON.stringify({
        results: checkResults,
        scheduledIndices: Array.from(scheduledOfferIndices),
        deliveredIndices: Array.from(deliveredOfferIndices),
        savedAt: new Date().toISOString()
      }));
    }
  }, [checkResults, scheduledOfferIndices, deliveredOfferIndices]);

  // Sync offer status with email status from backend
  const syncOfferStatusWithEmails = () => {
    if (!checkResults || checkResults.not_in_inventory.length === 0) return;
    
    // Get all sent emails
    const sentEmails = emails.filter(e => e.status === 'sent');
    const pendingEmails = emails.filter(e => e.status === 'pending');
    
    // Parse offer names from sent emails to mark as delivered
    const deliveredOfferNames = new Set<string>();
    sentEmails.forEach(email => {
      const lines = email.body.split('\n');
      lines.forEach(line => {
        const nameMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (nameMatch) {
          deliveredOfferNames.add(nameMatch[1].trim().toLowerCase());
        }
      });
    });
    
    // Parse offer names from pending emails to mark as scheduled
    const scheduledOfferNames = new Set<string>();
    pendingEmails.forEach(email => {
      const lines = email.body.split('\n');
      lines.forEach(line => {
        const nameMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (nameMatch) {
          scheduledOfferNames.add(nameMatch[1].trim().toLowerCase());
        }
      });
    });
    
    // Update indices based on offer names
    const newDeliveredIndices = new Set<number>();
    const newScheduledIndices = new Set<number>();
    
    checkResults.not_in_inventory.forEach((offer, idx) => {
      const offerName = (offer.name || '').toLowerCase();
      if (deliveredOfferNames.has(offerName)) {
        newDeliveredIndices.add(idx);
        newScheduledIndices.add(idx); // Delivered implies was scheduled
      } else if (scheduledOfferNames.has(offerName)) {
        newScheduledIndices.add(idx);
      }
    });
    
    setDeliveredOfferIndices(newDeliveredIndices);
    setScheduledOfferIndices(newScheduledIndices);
  };

  // Sync status when emails change
  useEffect(() => {
    syncOfferStatusWithEmails();
  }, [emails, checkResults]);

  useEffect(() => {
    fetchData();
  }, [statusFilter, networkFilter, platformFilter, payoutModelFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // First, auto-resolve any missing offers that now exist in inventory
      try {
        await fetch(`${API_BASE_URL}/api/admin/missing-offers/auto-resolve`, {
          method: 'POST',
          headers
        });
      } catch (autoResolveError) {
        console.log('Auto-resolve check completed');
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (networkFilter !== 'all') params.append('network', networkFilter);
      if (platformFilter !== 'all') params.append('platform', platformFilter);
      if (payoutModelFilter !== 'all') params.append('payout_model', payoutModelFilter);
      params.append('per_page', '100');
      
      const [offersRes, statsRes, networksRes, platformsRes, payoutModelsRes, emailsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/missing-offers?${params}`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/missing-offers/stats`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/missing-offers/networks`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/missing-offers/platforms`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/missing-offers/payout-models`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/scheduled-emails?per_page=50`, { headers })
      ]);
      
      if (offersRes.ok) {
        const data = await offersRes.json();
        setOffers(data.offers || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      
      if (networksRes.ok) {
        const data = await networksRes.json();
        setNetworks(data.networks || []);
      }
      
      if (platformsRes.ok) {
        const data = await platformsRes.json();
        setPlatforms(data.platforms || []);
      }
      
      if (payoutModelsRes.ok) {
        const data = await payoutModelsRes.json();
        setPayoutModels(data.payout_models || []);
      }
      
      if (emailsRes.ok) {
        const data = await emailsRes.json();
        setEmails(data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (offerId: string, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/${offerId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        toast({ title: "Success", description: "Status updated" });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedOffers.length === 0) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/bulk-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ offer_ids: selectedOffers, status })
      });
      
      if (res.ok) {
        toast({ title: "Success", description: `Updated ${selectedOffers.length} offers` });
        setSelectedOffers([]);
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  const handleScheduleEmail = async () => {
    if (!emailSubject || !emailBody || !emailRecipients) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const recipients = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
      
      const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/compose-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          recipients,
          offer_ids: selectedOffers.length > 0 ? selectedOffers : undefined,
          network: networkFilter !== 'all' ? networkFilter : undefined,
          send_in_days: parseInt(sendInDays)
        })
      });
      
      if (res.ok) {
        toast({ title: "Success", description: "Email scheduled successfully" });
        setComposeOpen(false);
        setEmailSubject("");
        setEmailBody("");
        setEmailRecipients("");
        setSendInDays("0");
        setSelectedOffers([]);
        fetchData();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to schedule email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCancelEmail = async (emailId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/scheduled-emails/${emailId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast({ title: "Success", description: "Email cancelled" });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel", variant: "destructive" });
    }
  };

  const handleSendNow = async (emailId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/admin/scheduled-emails/${emailId}/send-now`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast({ title: "Success", description: "Email sent" });
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send", variant: "destructive" });
    }
  };

  const handleInventoryCheck = async (file: File) => {
    setCheckLoading(true);
    setCheckResults(null);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/check-inventory`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setCheckResults(data);
        toast({ 
          title: "Check Complete", 
          description: `Found ${data.stats.have} offers you have, ${data.stats.dont_have} you don't have` 
        });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to check inventory", variant: "destructive" });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSheetUrlCheck = async () => {
    if (!sheetUrl.trim()) {
      toast({ title: "Error", description: "Please enter a Google Sheets URL", variant: "destructive" });
      return;
    }
    
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      toast({ title: "Error", description: "Please enter a valid Google Sheets URL", variant: "destructive" });
      return;
    }
    
    setCheckLoading(true);
    setCheckResults(null);
    
    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/check-inventory`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: sheetUrl })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCheckResults(data);
        setSheetUrl("");
        toast({ 
          title: "Check Complete", 
          description: `Found ${data.stats.have} offers you have, ${data.stats.dont_have} you don't have` 
        });
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to check inventory", variant: "destructive" });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleInventoryCheck(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
        handleInventoryCheck(file);
      } else {
        toast({ title: "Error", description: "Only Excel (.xlsx, .xls) and CSV files are supported", variant: "destructive" });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleEmailAutomation = async () => {
    if (!automationEmail.trim()) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    
    if (!checkResults || checkResults.not_in_inventory.length === 0) {
      toast({ title: "Error", description: "No missing offers to send", variant: "destructive" });
      return;
    }
    
    const offersPerEmail = parseInt(automationOffersPerEmail) || 4;
    const intervalHours = parseFloat(automationInterval) || 0;
    const missingOffers = checkResults.not_in_inventory;
    
    // Calculate how many emails we need
    const totalEmails = Math.ceil(missingOffers.length / offersPerEmail);
    
    setAutomationSending(true);
    
    try {
      const token = localStorage.getItem('token');
      const scheduledIndices = new Set<number>();
      
      for (let i = 0; i < totalEmails; i++) {
        const startIdx = i * offersPerEmail;
        const endIdx = Math.min(startIdx + offersPerEmail, missingOffers.length);
        const batchOffers = missingOffers.slice(startIdx, endIdx);
        
        // Build HTML email body with table format and logo
        const offersTableRows = batchOffers.map((offer, idx) => 
          `<tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${startIdx + idx + 1}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${offer.name || 'Unknown'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${offer.country || 'GLOBAL'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${offer.platform || 'All'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${offer.payout_model || 'CPA'}</td>
          </tr>`
        ).join('');
        
        const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header with Logo -->
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center;">
      <img src="https://moustacheleads.com/logo.png" alt="Moustache Leads" style="height: 50px; margin-bottom: 10px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Missing Offers Request</h1>
      <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px;">Batch ${i + 1} of ${totalEmails}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Dear Partner,
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        We noticed the following <strong>${batchOffers.length} offers</strong> are not currently in our inventory. Could you please add them to your platform?
      </p>
      
      <!-- Offers Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; width: 50px;">#</th>
            <th style="padding: 14px 12px; text-align: left; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #e5e7eb;">Offer Name</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; width: 100px;">Country</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; width: 90px;">Platform</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; width: 80px;">Model</th>
          </tr>
        </thead>
        <tbody>
          ${offersTableRows}
        </tbody>
      </table>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 10px;">
        Thank you for your assistance in expanding our offer catalog.
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Best regards,<br>
        <strong style="color: #1e3a5f;">Moustache Leads Team</strong>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
        This is an automated message from Moustache Leads Inventory System.<br>
        © ${new Date().getFullYear()} Moustache Leads. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

        const emailSubject = `Missing Offers Request (Batch ${i + 1}/${totalEmails}) - ${batchOffers.length} offers`;
        
        // Convert hours to days for the API (supports fractional days)
        // Backend adds minimum 2-minute delay, so we just need to space them out
        // For "send all at once" (intervalHours=0), space batches 30 seconds apart to avoid overwhelming
        let sendInDays: number;
        if (intervalHours === 0) {
          // Send all at once - space 30 seconds apart (0.000347 days = 30 seconds)
          sendInDays = i * 0.000347;
        } else {
          // Use the specified interval
          sendInDays = (i * intervalHours) / 24;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/admin/missing-offers/compose-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: emailSubject,
            body: emailBody,
            recipients: [automationEmail.trim()],
            send_in_days: sendInDays
          })
        });
        
        if (res.ok) {
          // Mark these offers as scheduled (not delivered yet)
          for (let j = startIdx; j < endIdx; j++) {
            scheduledIndices.add(j);
          }
        } else {
          const error = await res.json();
          toast({ title: "Error", description: `Failed to schedule batch ${i + 1}: ${error.error}`, variant: "destructive" });
        }
      }
      
      setScheduledOfferIndices(scheduledIndices);
      setEmailAutomationOpen(false);
      
      toast({ 
        title: "Success", 
        description: `Scheduled ${totalEmails} emails for ${missingOffers.length} offers` 
      });
      
      // Refresh scheduled emails
      fetchData();
      
    } catch (error) {
      toast({ title: "Error", description: "Failed to schedule emails", variant: "destructive" });
    } finally {
      setAutomationSending(false);
    }
  };

  const filteredOffers = offers.filter(offer => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return offer.name?.toLowerCase().includes(term) ||
           offer.match_key?.toLowerCase().includes(term) ||
           offer.network?.toLowerCase().includes(term) ||
           offer.country?.toLowerCase().includes(term);
  });

  const toggleSelectAll = () => {
    if (selectedOffers.length === filteredOffers.length) {
      setSelectedOffers([]);
    } else {
      setSelectedOffers(filteredOffers.map(o => o._id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedOffers(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      'iOS': 'bg-blue-100 text-blue-800',
      'Android': 'bg-green-100 text-green-800',
      'Web': 'bg-purple-100 text-purple-800',
      'All': 'bg-gray-100 text-gray-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  const getPayoutModelBadge = (model: string) => {
    const colors: Record<string, string> = {
      'CPA': 'bg-orange-100 text-orange-800',
      'CPI': 'bg-cyan-100 text-cyan-800',
      'CPL': 'bg-yellow-100 text-yellow-800',
      'CPS': 'bg-pink-100 text-pink-800',
      'RevShare': 'bg-indigo-100 text-indigo-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[model] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-600">Pending</Badge>;
      case 'resolved': return <Badge variant="outline" className="text-green-600">Resolved</Badge>;
      case 'ignored': return <Badge variant="outline" className="text-gray-600">Ignored</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-orange-500" />
            Inventory Cross-Check
          </h1>
          <p className="text-muted-foreground">
            Upload a spreadsheet to check which offers you have vs don't have
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="check">Check Inventory</TabsTrigger>
          <TabsTrigger value="history">
            History
            {emails.filter(e => e.status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {emails.filter(e => e.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Cross-Check Inventory
              </CardTitle>
              <CardDescription>
                Upload a spreadsheet or paste a Google Sheets link to check which offers you have vs don't have.
                This is a read-only check - nothing gets created or stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Google Sheets URL Input */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Paste Google Sheets URL here..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="flex-1"
                  disabled={checkLoading}
                />
                <Button 
                  onClick={handleSheetUrlCheck} 
                  disabled={checkLoading || !sheetUrl.trim()}
                >
                  {checkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 border-t" />
                <span className="text-sm text-muted-foreground">OR</span>
                <div className="flex-1 border-t" />
              </div>

              {/* Upload Area */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {checkLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Checking inventory...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Drop your spreadsheet here or click to upload</p>
                    <p className="text-sm text-muted-foreground">Supports Excel (.xlsx, .xls) and CSV files</p>
                  </div>
                )}
              </div>

              {/* Results */}
              {checkResults && (
                <div className="mt-6 space-y-4">
                  {/* Stats Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gray-50">
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold">{checkResults.stats.total}</div>
                        <p className="text-sm text-muted-foreground">Total Checked</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{checkResults.stats.have}</div>
                        <p className="text-sm text-green-700">You Have ✓</p>
                        <p className="text-xs text-green-600">{checkResults.stats.have_percent}%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{checkResults.stats.dont_have}</div>
                        <p className="text-sm text-red-700">You Don't Have ✗</p>
                        <p className="text-xs text-red-600">{checkResults.stats.dont_have_percent}%</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Results Tabs */}
                  <div className="border rounded-lg">
                    <div className="flex border-b">
                      <button
                        className={`flex-1 px-4 py-2 text-sm font-medium ${checkResultsTab === 'dont_have' ? 'bg-red-50 text-red-700 border-b-2 border-red-500' : 'text-muted-foreground hover:bg-gray-50'}`}
                        onClick={() => setCheckResultsTab('dont_have')}
                      >
                        <XCircle className="h-4 w-4 inline mr-1" />
                        Don't Have ({checkResults.not_in_inventory.length})
                      </button>
                      <button
                        className={`flex-1 px-4 py-2 text-sm font-medium ${checkResultsTab === 'have' ? 'bg-green-50 text-green-700 border-b-2 border-green-500' : 'text-muted-foreground hover:bg-gray-50'}`}
                        onClick={() => setCheckResultsTab('have')}
                      >
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        Have ({checkResults.in_inventory.length})
                      </button>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Network</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(checkResultsTab === 'have' ? checkResults.in_inventory : checkResults.not_in_inventory).map((item, idx) => {
                            const isScheduled = checkResultsTab === 'dont_have' && scheduledOfferIndices.has(idx);
                            const isDelivered = checkResultsTab === 'dont_have' && deliveredOfferIndices.has(idx);
                            return (
                            <TableRow key={idx} className={isDelivered ? 'opacity-50 bg-gray-50' : ''}>
                              <TableCell className="text-muted-foreground">{item.row}</TableCell>
                              <TableCell>
                                <div className={`max-w-[200px] truncate font-medium ${isDelivered ? 'line-through' : ''}`} title={item.name}>
                                  {item.name || 'Unknown'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{item.country || 'GLOBAL'}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={getPlatformBadge(item.platform)}>
                                  {item.platform}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={getPayoutModelBadge(item.payout_model)}>
                                  {item.payout_model}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.network || '-'}</Badge>
                              </TableCell>
                              <TableCell>
                                {isDelivered ? (
                                  <Badge className="bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Delivered
                                  </Badge>
                                ) : isScheduled ? (
                                  <Badge className="bg-yellow-100 text-yellow-700">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Scheduled
                                  </Badge>
                                ) : checkResultsTab === 'have' ? (
                                  <Badge className="bg-green-100 text-green-700">In Stock</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700">Missing</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )})}
                          {(checkResultsTab === 'have' ? checkResults.in_inventory : checkResults.not_in_inventory).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                {checkResultsTab === 'have' ? 'No matching offers found in your inventory' : 'All offers exist in your inventory!'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      {checkResults.not_in_inventory.length > 0 && (
                        <Button 
                          onClick={() => setEmailAutomationOpen(true)}
                          className="gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          Email Automation ({checkResults.not_in_inventory.length - deliveredOfferIndices.size} remaining)
                        </Button>
                      )}
                      
                      {/* Status Summary */}
                      {(scheduledOfferIndices.size > 0 || deliveredOfferIndices.size > 0) && (
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 rounded-md text-sm">
                          {deliveredOfferIndices.size > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              {deliveredOfferIndices.size} delivered
                            </span>
                          )}
                          {scheduledOfferIndices.size > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <Clock className="h-3.5 w-3.5" />
                              {scheduledOfferIndices.size - deliveredOfferIndices.size} pending
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          fetchData();
                          toast({ title: "Refreshing", description: "Syncing offer status with email history..." });
                        }}
                        className="gap-1"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh Status
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab('history')}
                        className="gap-1"
                      >
                        <Calendar className="h-4 w-4" />
                        View History
                      </Button>
                      <Button variant="outline" onClick={() => { 
                        setCheckResults(null); 
                        setScheduledOfferIndices(new Set()); 
                        setDeliveredOfferIndices(new Set()); 
                        localStorage.removeItem('inventoryCheckResults');
                      }}>
                        Clear Results
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Email History
                  </CardTitle>
                  <CardDescription>View and manage scheduled partner notifications with offer details</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : emails.length === 0 ? (
                <Alert>
                  <AlertDescription>No scheduled emails. Upload a spreadsheet and use Email Automation to schedule emails.</AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                      <div className="text-xl font-bold text-yellow-600">{emails.filter(e => e.status === 'pending').length}</div>
                      <p className="text-xs text-yellow-700">Pending</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                      <div className="text-xl font-bold text-green-600">{emails.filter(e => e.status === 'sent').length}</div>
                      <p className="text-xs text-green-700">Sent</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                      <div className="text-xl font-bold text-red-600">{emails.filter(e => e.status === 'failed').length}</div>
                      <p className="text-xs text-red-700">Failed</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border text-center">
                      <div className="text-xl font-bold">{emails.length}</div>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                  
                  {/* Email List with Expandable Offer Details */}
                  <div className="space-y-3">
                    {emails.map((email) => (
                      <EmailHistoryCard 
                        key={email._id} 
                        email={email} 
                        onSendNow={handleSendNow}
                        onCancel={handleCancelEmail}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Composer Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose Email to Partner</DialogTitle>
            <DialogDescription>
              Request missing offers from partner
              {selectedOffers.length > 0 && ` (${selectedOffers.length} offers selected)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipients (comma separated)</Label>
              <Input
                placeholder="partner@example.com, support@network.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Request for Missing Offers"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Dear Partner,&#10;&#10;We noticed some offers are not in our inventory..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
              />
            </div>
            <div>
              <Label>Schedule</Label>
              <Select value={sendInDays} onValueChange={setSendInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Send Immediately</SelectItem>
                  <SelectItem value="1">Send in 1 day</SelectItem>
                  <SelectItem value="2">Send in 2 days</SelectItem>
                  <SelectItem value="3">Send in 3 days</SelectItem>
                  <SelectItem value="7">Send in 1 week</SelectItem>
                  <SelectItem value="14">Send in 2 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleEmail} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {sendInDays === "0" ? "Send Now" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Offer Details Dialog */}
      <Dialog open={!!viewOffer} onOpenChange={() => setViewOffer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory Gap Details</DialogTitle>
          </DialogHeader>
          {viewOffer && (
            <div className="space-y-4">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <Label className="text-orange-700 text-xs">Match Key</Label>
                <p className="font-mono text-sm mt-1">{viewOffer.match_key}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{viewOffer.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Country</Label>
                  <p>{viewOffer.country || 'GLOBAL'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Platform</Label>
                  <Badge className={getPlatformBadge(viewOffer.platform)}>{viewOffer.platform}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Payout Model</Label>
                  <Badge className={getPayoutModelBadge(viewOffer.payout_model)}>{viewOffer.payout_model}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Payout</Label>
                  <p>{viewOffer.payout ? `$${viewOffer.payout}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Network</Label>
                  <p>{viewOffer.network || '-'}</p>
                </div>
              </div>
              {viewOffer.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm mt-1">{viewOffer.description}</p>
                </div>
              )}
              {viewOffer.tracking_url && (
                <div>
                  <Label className="text-muted-foreground text-xs">Tracking URL</Label>
                  <p className="text-sm break-all mt-1">{viewOffer.tracking_url}</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Source: {viewOffer.source}</span>
                  <span>Seen {viewOffer.seen_count}x</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Automation Dialog */}
      <Dialog open={emailAutomationOpen} onOpenChange={setEmailAutomationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Automation
            </DialogTitle>
            <DialogDescription>
              Schedule batched emails for {checkResults?.not_in_inventory.length || 0} missing offers
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5">
            {/* Recipient Email */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recipient Email</Label>
              <Input
                placeholder="partner@example.com"
                value={automationEmail}
                onChange={(e) => setAutomationEmail(e.target.value)}
                type="email"
                className="h-10"
              />
            </div>
            
            {/* Two column layout for interval and offers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Interval</Label>
                <Select value={automationInterval} onValueChange={setAutomationInterval}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Send all at once</SelectItem>
                    <SelectItem value="0.5">Every 30 minutes</SelectItem>
                    <SelectItem value="1">Every 1 hour</SelectItem>
                    <SelectItem value="2">Every 2 hours</SelectItem>
                    <SelectItem value="4">Every 4 hours</SelectItem>
                    <SelectItem value="6">Every 6 hours</SelectItem>
                    <SelectItem value="12">Every 12 hours</SelectItem>
                    <SelectItem value="24">Every 1 day</SelectItem>
                    <SelectItem value="48">Every 2 days</SelectItem>
                    <SelectItem value="72">Every 3 days</SelectItem>
                    <SelectItem value="168">Every week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Offers Per Email</Label>
                <Select value={automationOffersPerEmail} onValueChange={setAutomationOffersPerEmail}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 offers</SelectItem>
                    <SelectItem value="4">4 offers</SelectItem>
                    <SelectItem value="5">5 offers</SelectItem>
                    <SelectItem value="10">10 offers</SelectItem>
                    <SelectItem value="15">15 offers</SelectItem>
                    <SelectItem value="20">20 offers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Schedule Preview */}
            {checkResults && checkResults.not_in_inventory.length > 0 && (() => {
              const offersPerEmail = parseInt(automationOffersPerEmail) || 4;
              const intervalHours = parseFloat(automationInterval) || 0;
              const totalOffers = checkResults.not_in_inventory.length;
              const totalEmails = Math.ceil(totalOffers / offersPerEmail);
              
              // Generate schedule items
              const scheduleItems = [];
              for (let i = 0; i < Math.min(totalEmails, 6); i++) {
                const startIdx = i * offersPerEmail;
                const endIdx = Math.min(startIdx + offersPerEmail, totalOffers);
                const offerCount = endIdx - startIdx;
                
                let timeLabel = '';
                if (intervalHours === 0) {
                  timeLabel = 'Now';
                } else {
                  const totalHours = i * intervalHours;
                  if (totalHours === 0) {
                    timeLabel = 'Now';
                  } else if (totalHours < 1) {
                    timeLabel = `+${Math.round(totalHours * 60)} min`;
                  } else if (totalHours < 24) {
                    timeLabel = `+${totalHours} hr${totalHours > 1 ? 's' : ''}`;
                  } else {
                    const days = Math.floor(totalHours / 24);
                    const hrs = totalHours % 24;
                    timeLabel = hrs > 0 ? `+${days}d ${hrs}h` : `+${days} day${days > 1 ? 's' : ''}`;
                  }
                }
                
                scheduleItems.push({ batch: i + 1, offers: `${startIdx + 1}-${endIdx}`, count: offerCount, time: timeLabel });
              }
              
              return (
                <div className="rounded-lg border bg-slate-50/50 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-100 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">📋 Schedule Preview</span>
                      <Badge variant="secondary" className="text-xs">
                        {totalEmails} emails • {totalOffers} offers
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                    {scheduleItems.map((item, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2.5 rounded-md ${idx === 0 ? 'bg-green-50 border border-green-200' : 'bg-white border'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${idx === 0 ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {item.batch}
                          </div>
                          <div>
                            <p className="text-sm font-medium">Batch {item.batch}</p>
                            <p className="text-xs text-muted-foreground">Offers {item.offers} ({item.count} offers)</p>
                          </div>
                        </div>
                        <Badge variant={idx === 0 ? "default" : "outline"} className={idx === 0 ? "bg-green-500" : ""}>
                          <Clock className="h-3 w-3 mr-1" />
                          {item.time}
                        </Badge>
                      </div>
                    ))}
                    
                    {totalEmails > 6 && (
                      <div className="text-center py-2 text-sm text-muted-foreground">
                        ... and {totalEmails - 6} more batches
                      </div>
                    )}
                  </div>
                  
                  {/* Summary footer */}
                  <div className="px-4 py-2.5 bg-slate-100 border-t text-xs text-slate-600">
                    {intervalHours === 0 ? (
                      <span>All {totalEmails} emails will be sent immediately</span>
                    ) : (
                      <span>
                        Total duration: {(() => {
                          const totalHours = (totalEmails - 1) * intervalHours;
                          if (totalHours < 24) return `${totalHours} hours`;
                          const days = Math.floor(totalHours / 24);
                          const hrs = totalHours % 24;
                          return hrs > 0 ? `${days} days ${hrs} hours` : `${days} days`;
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmailAutomationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEmailAutomation} disabled={automationSending || !automationEmail.trim()} className="gap-2">
              {automationSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Schedule Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMissingOffers;

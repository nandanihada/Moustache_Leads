import { useState, useEffect } from "react";
import { Search, UserCheck, UserX, Mail, Clock, CheckCircle, XCircle, Loader2, Building2, Globe, Phone, MapPin, CreditCard, Eye, Link, Copy, Plus, Key, TestTube, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/apiConfig";
import { Label } from "@/components/ui/label";

interface Advertiser {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  company_name: string;
  website_url: string;
  offer_landing_page: string;
  address: string;
  apartment?: string;
  country: string;
  city: string;
  zip_code: string;
  accounting_contact_name: string;
  accounting_contact_role?: string;
  accounting_contact_number: string;
  accounting_contact_email: string;
  payment_agreement: string;
  payment_terms: string;
  ein_vat_number: string;
  account_status: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  account_status_updated_at?: string;
  balance?: number;
  unique_postback_key?: string;
  postback_receiver_url?: string;
  postback_parameters?: string[];
  postback_custom_params?: string[];
  postback_parameter_mappings?: Record<string, string>;
}

interface DepositTransaction {
  _id: string;
  advertiser_id: string;
  advertiser: {
    company_name: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  amount: number;
  method: string;
  status: string;
  external_ref: string;
  created_at: string;
}

interface AdvertiserCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

const AdminAdvertiserManagement = () => {
  const [activeTab, setActiveTab] = useState("pending_approval");
  const [searchTerm, setSearchTerm] = useState("");
  const [postbackFilter, setPostbackFilter] = useState("all");
  const [isPostbackModalOpen, setIsPostbackModalOpen] = useState(false);
  const [selectedAdvertiserForPostback, setSelectedAdvertiserForPostback] = useState<Advertiser | null>(null);
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [parameterMappings, setParameterMappings] = useState<Record<string, string>>({});
  const [customParams, setCustomParams] = useState<string[]>([]);
  const [generatingPostback, setGeneratingPostback] = useState(false);
  const [deletingPostback, setDeletingPostback] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  
  const predefinedParameters = [
    { key: 'user_id', label: 'User ID (Publisher)', placeholder: '{user_id}' },
    { key: 'sub1', label: 'Sub1 (End User)', placeholder: '{sub1}' },
    { key: 'payout', label: 'Payout', placeholder: '{payout}' },
    { key: 'transaction_id', label: 'Transaction ID', placeholder: '{transaction_id}' },
    { key: 'click_id', label: 'Click ID', placeholder: '{click_id}' },
    { key: 'offer_id', label: 'Offer ID', placeholder: '{offer_id}' },
    { key: 'offer_name', label: 'Offer Name', placeholder: '{offer_name}' },
    { key: 'cid', label: 'Campaign ID (cid)', placeholder: '{cid}' },
    { key: 'cname', label: 'Campaign Name (cname)', placeholder: '{cname}' },
    { key: 'status', label: 'Status', placeholder: '{status}' },
    { key: 'event_type', label: 'Event Type', placeholder: '{event_type}' },
    { key: 'sub_id1', label: 'Sub ID 1', placeholder: '{sub_id1}' },
    { key: 'sub_id2', label: 'Sub ID 2', placeholder: '{sub_id2}' },
    { key: 'sub_id3', label: 'Sub ID 3', placeholder: '{sub_id3}' },
    { key: 'sub_id4', label: 'Sub ID 4', placeholder: '{sub_id4}' },
    { key: 'sub_id5', label: 'Sub ID 5', placeholder: '{sub_id5}' },
    { key: 'ip_address', label: 'IP Address', placeholder: '{ip_address}' },
    { key: 'country', label: 'Country', placeholder: '{country}' },
    { key: 'user_agent', label: 'User Agent', placeholder: '{user_agent}' }
  ];
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [counts, setCounts] = useState<AdvertiserCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [depMethodFilter, setDepMethodFilter] = useState("all");
  const [depStatusFilter, setDepStatusFilter] = useState("all");
  const [depStartDate, setDepStartDate] = useState("");
  const [depEndDate, setDepEndDate] = useState("");
  const [depCurrentPage, setDepCurrentPage] = useState(1);
  const [depRowsPerPage, setDepRowsPerPage] = useState(20);
  const { toast } = useToast();

  const fetchAdvertisers = async (status?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = status && status !== 'all' 
        ? `${API_BASE_URL}/api/admin/advertisers?status=${status}`
        : `${API_BASE_URL}/api/admin/advertisers`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch advertisers');
      }

      const data = await response.json();
      setAdvertisers(data.advertisers || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (error) {
      console.error('Error fetching advertisers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch advertisers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDeposits = async () => {
    try {
      setDepositsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/deposits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch deposits');
      const data = await response.json();
      setDeposits(data.deposits || []);
    } catch (error) {
      console.error('Error fetching deposits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch deposits",
        variant: "destructive"
      });
    } finally {
      setDepositsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'deposits') {
      fetchDeposits();
    } else {
      const status = activeTab === 'all' ? undefined : activeTab;
      fetchAdvertisers(status);
    }
  }, [activeTab]);

  const handleApprove = async (advertiserId: string) => {
    try {
      setActionLoading(advertiserId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/${advertiserId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve advertiser');
      }

      if (data.email_sent) {
        toast({
          title: "Advertiser Approved",
          description: "Advertiser has been approved and activation email sent.",
        });
      } else {
        toast({
          title: "Advertiser Approved",
          description: `Advertiser approved but email failed: ${data.email_error || 'Unknown error'}`,
          variant: "destructive"
        });
      }

      fetchAdvertisers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve advertiser",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (advertiser: Advertiser) => {
    setSelectedAdvertiser(advertiser);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const openDetailsDialog = (advertiser: Advertiser) => {
    setSelectedAdvertiser(advertiser);
    setDetailsDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedAdvertiser) return;

    try {
      setActionLoading(selectedAdvertiser._id);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/${selectedAdvertiser._id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject advertiser');
      }

      toast({
        title: "Advertiser Rejected",
        description: "Advertiser application has been rejected.",
      });

      setRejectDialogOpen(false);
      setSelectedAdvertiser(null);
      
      fetchAdvertisers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject advertiser",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAutoApprovalCheck = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/auto-approve-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Auto-approval check failed');
      }

      toast({
        title: "Auto-Approval Complete",
        description: data.message,
      });

      fetchAdvertisers(activeTab === 'all' ? undefined : activeTab);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Auto-approval check failed",
        variant: "destructive"
      });
    }
  };

  const handleApproveDeposit = async (depositId: string) => {
    try {
      setActionLoading(depositId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve deposit');
      }

      toast({
        title: "Deposit Approved",
        description: "Deposit has been approved and credited to advertiser's balance.",
      });

      fetchDeposits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve deposit",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    try {
      setActionLoading(depositId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject deposit');
      }

      toast({
        title: "Deposit Rejected",
        description: "Deposit has been rejected.",
      });

      fetchDeposits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject deposit",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevertDeposit = async (depositId: string) => {
    if (!window.confirm("Are you sure you want to revert this deposit? This will deduct the deposit amount from the advertiser's balance and mark the deposit as failed.")) {
      return;
    }
    
    try {
      setActionLoading(depositId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/deposits/${depositId}/revert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revert deposit');
      }

      toast({
        title: "Deposit Reverted",
        description: "Deposit has been successfully reverted and balance deducted.",
      });

      fetchDeposits();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revert deposit",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };



  const openPostbackModal = (adv: Advertiser) => {
    setSelectedAdvertiserForPostback(adv);
    setSelectedParameters(adv.postback_parameters || ['click_id', 'payout']);
    setCustomParams(adv.postback_custom_params || ['']);
    setParameterMappings(adv.postback_parameter_mappings || { click_id: 'click_id', payout: 'payout' });
    setIsPostbackModalOpen(true);
  };

  const handleParameterToggle = (key: string) => {
    if (selectedParameters.includes(key)) {
      setSelectedParameters(selectedParameters.filter(p => p !== key));
      const newMappings = { ...parameterMappings };
      delete newMappings[key];
      setParameterMappings(newMappings);
    } else {
      setSelectedParameters([...selectedParameters, key]);
      setParameterMappings({ ...parameterMappings, [key]: key });
    }
  };

  const handleParameterMappingChange = (key: string, value: string) => {
    setParameterMappings({ ...parameterMappings, [key]: value });
  };

  const handleCustomParamChange = (index: number, value: string) => {
    const newParams = [...customParams];
    newParams[index] = value;
    setCustomParams(newParams);
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, '']);
  };

  const removeCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  const handleSavePostback = async (regenerate = false) => {
    if (!selectedAdvertiserForPostback) return;
    
    try {
      setGeneratingPostback(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/${selectedAdvertiserForPostback._id}/postback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          parameters: selectedParameters,
          custom_params: customParams.filter(p => p.trim() !== ''),
          parameter_mappings: parameterMappings,
          regenerate
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save postback configuration');
      
      toast({
        title: 'Success',
        description: 'Postback configuration saved successfully',
      });
      
      // Update local advertisers state
      setAdvertisers(prev => prev.map(a => {
        if (a._id === selectedAdvertiserForPostback._id) {
          return {
            ...a,
            unique_postback_key: data.unique_key,
            postback_receiver_url: data.full_url,
            postback_parameters: data.parameters,
            postback_custom_params: data.custom_params,
            postback_parameter_mappings: data.parameter_mappings
          };
        }
        return a;
      }));
      
      // Update the selected advertiser for postback state to show the result
      setSelectedAdvertiserForPostback(prev => {
        if (!prev) return null;
        return {
          ...prev,
          unique_postback_key: data.unique_key,
          postback_receiver_url: data.full_url,
          postback_parameters: data.parameters,
          postback_custom_params: data.custom_params,
          postback_parameter_mappings: data.parameter_mappings
        };
      });
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setGeneratingPostback(false);
    }
  };

  const handleDeletePostback = async () => {
    if (!selectedAdvertiserForPostback) return;
    if (!confirm('Are you sure you want to delete the postback configuration? This cannot be undone.')) return;
    
    try {
      setDeletingPostback(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/advertisers/${selectedAdvertiserForPostback._id}/postback`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete postback configuration');
      
      toast({
        title: 'Success',
        description: 'Postback configuration deleted successfully',
      });
      
      // Update local state
      setAdvertisers(prev => prev.map(a => {
        if (a._id === selectedAdvertiserForPostback._id) {
          const updated = { ...a };
          delete updated.unique_postback_key;
          delete updated.postback_receiver_url;
          delete updated.postback_parameters;
          delete updated.postback_custom_params;
          delete updated.postback_parameter_mappings;
          return updated;
        }
        return a;
      }));
      
      setIsPostbackModalOpen(false);
      setSelectedAdvertiserForPostback(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDeletingPostback(false);
    }
  };

  const testPostbackUrl = async () => {
    if (!selectedAdvertiserForPostback || !selectedAdvertiserForPostback.unique_postback_key) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/postback-receiver/test-quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          unique_key: selectedAdvertiserForPostback.unique_postback_key,
          params: testParams
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate test URL');
      
      window.open(data.test_url, '_blank');
      
      toast({
        title: 'Success',
        description: 'Test postback opened in new tab',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "URL copied to clipboard",
    });
  };

  const filteredAdvertisers = advertisers.filter(adv => {
    const name = `${adv.first_name || ''} ${adv.last_name || ''} ${adv.company_name || ''}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
                          adv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          adv._id.toLowerCase().includes(searchTerm.toLowerCase());
                          
    let matchesPostback = true;
    if (postbackFilter === 'configured') {
      matchesPostback = !!adv.postback_receiver_url;
    } else if (postbackFilter === 'not_configured') {
      matchesPostback = !adv.postback_receiver_url;
    }
    
    return matchesSearch && matchesPostback;
  });

  const filteredDeposits = deposits.filter(dep => {
    const term = searchTerm.toLowerCase();
    const advName = `${dep.advertiser?.first_name || ''} ${dep.advertiser?.last_name || ''} ${dep.advertiser?.company_name || ''}`.toLowerCase();
    
    // Search filter
    const matchesSearch = advName.includes(term) ||
                          dep.advertiser?.email?.toLowerCase().includes(term) ||
                          dep.external_ref?.toLowerCase().includes(term) ||
                          dep._id.toLowerCase().includes(term);
                          
    // Method filter
    const matchesMethod = depMethodFilter === 'all' || 
                          (depMethodFilter === 'paypal' && dep.method === 'paypal') ||
                          (depMethodFilter === 'usdt' && dep.method === 'usdt');
                          
    // Status filter
    const matchesStatus = depStatusFilter === 'all' || dep.status === depStatusFilter;
    
    // Date filter
    let matchesDate = true;
    if (dep.created_at) {
      const depDate = new Date(dep.created_at);
      if (depStartDate) {
        const start = new Date(depStartDate);
        start.setHours(0, 0, 0, 0);
        if (depDate < start) matchesDate = false;
      }
      if (depEndDate) {
        const end = new Date(depEndDate);
        end.setHours(23, 59, 59, 999);
        if (depDate > end) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesMethod && matchesStatus && matchesDate;
  });

  const paginatedDeposits = filteredDeposits.slice(
    (depCurrentPage - 1) * depRowsPerPage,
    depCurrentPage * depRowsPerPage
  );
  
  const totalDepPages = Math.ceil(filteredDeposits.length / depRowsPerPage) || 1;

  useEffect(() => {
    setDepCurrentPage(1);
  }, [searchTerm, depMethodFilter, depStatusFilter, depStartDate, depEndDate, depRowsPerPage]);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "pending_approval":
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getDepositStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };


  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Advertisers</h1>
          <p className="text-muted-foreground">Manage advertiser accounts and approve new applications</p>
        </div>
        <Button onClick={handleAutoApprovalCheck} variant="outline">
          <Clock className="w-4 h-4 mr-2" />
          Run Auto-Approval (3+ days)
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Advertisers</p>
                <p className="text-2xl font-bold">{counts.total}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Advertiser Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending_approval">
                Pending ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="all">All Advertisers</TabsTrigger>
            </TabsList>

            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === 'deposits'
                    ? "Search deposits by advertiser name, company, email, or reference..."
                    : "Search advertisers by name, company, email, or ID..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {activeTab !== 'deposits' && (
                <div className="w-56">
                  <select 
                    value={postbackFilter} 
                    onChange={e => setPostbackFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="all">All Postbacks</option>
                    <option value="configured">Postback Configured</option>
                    <option value="not_configured">No Postback</option>
                  </select>
                </div>
              )}
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              {activeTab === 'deposits' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card shadow-sm">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</label>
                    <select 
                      value={depMethodFilter} 
                      onChange={e => setDepMethodFilter(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="all">All Methods</option>
                      <option value="paypal">PayPal / Card</option>
                      <option value="usdt">USDT (TRC20)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                    <select 
                      value={depStatusFilter} 
                      onChange={e => setDepStatusFilter(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="failed">Failed / Reverted</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date</label>
                    <Input 
                      type="date" 
                      value={depStartDate} 
                      onChange={e => setDepStartDate(e.target.value)} 
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">End Date</label>
                    <Input 
                      type="date" 
                      value={depEndDate} 
                      onChange={e => setDepEndDate(e.target.value)} 
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'deposits' ? (
                depositsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDeposits.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No deposits found
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Advertiser / Company</TableHead>
                          <TableHead className="whitespace-nowrap">Amount</TableHead>
                          <TableHead className="whitespace-nowrap">Method</TableHead>
                          <TableHead className="whitespace-nowrap">Order ID / TXID</TableHead>
                          <TableHead className="whitespace-nowrap">Deposit Date</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDeposits.map((dep) => (
                          <TableRow key={dep._id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="bg-gradient-to-br from-orange-400 to-pink-500">
                                  <AvatarFallback className="text-white">
                                    {(dep.advertiser?.first_name?.[0] || 'A').toUpperCase()}
                                    {(dep.advertiser?.last_name?.[0] || '').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {dep.advertiser?.first_name} {dep.advertiser?.last_name}
                                  </p>
                                  <p className="text-xs font-semibold text-orange-600">{dep.advertiser?.company_name}</p>
                                  <p className="text-xs text-muted-foreground">{dep.advertiser?.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-green-600 font-mono">
                              ${dep.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize bg-orange-50 border-orange-200 text-orange-700">
                                {dep.method === 'paypal' ? 'PayPal / Card' : dep.method}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground select-all">
                              {dep.external_ref || dep._id}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(dep.created_at)}
                            </TableCell>
                            <TableCell>
                              {getDepositStatusBadge(dep.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              {dep.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1 h-8"
                                    onClick={() => handleApproveDeposit(dep._id)}
                                    disabled={actionLoading === dep._id}
                                  >
                                    {actionLoading === dep._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Approve"
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    className="text-xs px-2.5 py-1 h-8"
                                    onClick={() => handleRejectDeposit(dep._id)}
                                    disabled={actionLoading === dep._id}
                                  >
                                    {actionLoading === dep._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Reject"
                                    )}
                                  </Button>
                                </div>
                              )}
                              {dep.status === 'confirmed' && (
                                <div className="flex justify-end">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-xs px-2.5 py-1 h-8"
                                    onClick={() => handleRevertDeposit(dep._id)}
                                    disabled={actionLoading === dep._id}
                                  >
                                    {actionLoading === dep._id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Revert"
                                    )}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Pagination Footer */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                        <select
                          value={depRowsPerPage}
                          onChange={e => setDepRowsPerPage(Number(e.target.value))}
                          className="flex h-8 w-20 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={70}>70</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-muted-foreground ml-4">
                          Showing {filteredDeposits.length > 0 ? (depCurrentPage - 1) * depRowsPerPage + 1 : 0} to{" "}
                          {Math.min(depCurrentPage * depRowsPerPage, filteredDeposits.length)} of {filteredDeposits.length} deposits
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={depCurrentPage === 1}
                          onClick={() => setDepCurrentPage(prev => Math.max(1, prev - 1))}
                          className="h-8 px-3"
                        >
                          Previous
                        </Button>
                        
                        {Array.from({ length: totalDepPages }, (_, i) => i + 1).map(page => {
                          if (totalDepPages > 6 && Math.abs(page - depCurrentPage) > 2 && page !== 1 && page !== totalDepPages) {
                            if (page === 2 || page === totalDepPages - 1) {
                              return <span key={page} className="px-1 text-muted-foreground">...</span>;
                            }
                            return null;
                          }
                          
                          return (
                            <Button
                              key={page}
                              variant={depCurrentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setDepCurrentPage(page)}
                              className={`h-8 w-8 p-0 ${depCurrentPage === page ? "bg-primary text-primary-foreground" : ""}`}
                            >
                              {page}
                            </Button>
                          );
                        })}

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={depCurrentPage === totalDepPages}
                          onClick={() => setDepCurrentPage(prev => Math.min(totalDepPages, prev + 1))}
                          className="h-8 px-3"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAdvertisers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No advertisers found
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Advertiser</TableHead>
                          <TableHead className="whitespace-nowrap">Company</TableHead>
                          <TableHead className="whitespace-nowrap">Contact</TableHead>
                          <TableHead className="whitespace-nowrap">Wallet Balance</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap">Postback</TableHead>
                          <TableHead className="whitespace-nowrap">Join Date</TableHead>
                          <TableHead className="whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAdvertisers.map((adv) => (
                          <TableRow key={adv._id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="bg-gradient-to-br from-purple-500 to-indigo-600">
                                  <AvatarFallback className="text-white">
                                    {(adv.first_name?.[0] || 'A').toUpperCase()}
                                    {(adv.last_name?.[0] || '').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {adv.first_name} {adv.last_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{adv.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{adv.company_name}</span>
                                </div>
                                {adv.website_url && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Globe className="h-3 w-3" />
                                    <a href={adv.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[150px]">
                                      {adv.website_url.replace(/^https?:\/\//, '')}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span>{adv.phone_number}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span>{adv.city}, {adv.country}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold font-mono text-green-700">
                              ${adv.balance !== undefined ? adv.balance.toFixed(2) : "0.00"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(adv.account_status)}
                            </TableCell>
                            <TableCell>
                              {adv.account_status === "approved" ? (
                                adv.postback_receiver_url ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                                    Configured
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-100 text-gray-400">
                                    No Postback
                                  </Badge>
                                )
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(adv.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDetailsDialog(adv)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {adv.account_status === "pending_approval" && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => handleApprove(adv._id)}
                                      disabled={actionLoading === adv._id}
                                    >
                                      {actionLoading === adv._id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <UserCheck className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => openRejectDialog(adv)}
                                      disabled={actionLoading === adv._id}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {adv.account_status === "approved" && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-green-600">Active</Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => openPostbackModal(adv)}
                                    >
                                      <Link className="h-4 w-4 mr-1" />
                                      Postback
                                    </Button>
                                  </div>
                                )}
                                {adv.account_status === "rejected" && (
                                  <Badge variant="outline" className="text-red-600">Rejected</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Advertiser Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedAdvertiser?.company_name}'s application?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for rejection (optional)</label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={actionLoading === selectedAdvertiser?._id}
            >
              {actionLoading === selectedAdvertiser?._id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Advertiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advertiser Details</DialogTitle>
            <DialogDescription>
              Full information for {selectedAdvertiser?.company_name}
            </DialogDescription>
          </DialogHeader>
          {selectedAdvertiser && (
            <div className="space-y-6">
              {/* General Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">General Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Full Name</p>
                    <p className="font-medium">{selectedAdvertiser.first_name} {selectedAdvertiser.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedAdvertiser.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedAdvertiser.phone_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {getStatusBadge(selectedAdvertiser.account_status)}
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Company Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company Name</p>
                    <p className="font-medium">{selectedAdvertiser.company_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Website</p>
                    <a href={selectedAdvertiser.website_url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                      {selectedAdvertiser.website_url}
                    </a>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Offer Landing Page</p>
                    <a href={selectedAdvertiser.offer_landing_page} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                      {selectedAdvertiser.offer_landing_page}
                    </a>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Address</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Street Address</p>
                    <p className="font-medium">{selectedAdvertiser.address} {selectedAdvertiser.apartment && `, ${selectedAdvertiser.apartment}`}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="font-medium">{selectedAdvertiser.city}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Country</p>
                    <p className="font-medium">{selectedAdvertiser.country}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ZIP/Postal Code</p>
                    <p className="font-medium">{selectedAdvertiser.zip_code}</p>
                  </div>
                </div>
              </div>

              {/* Accounting */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Accounting Contact</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contact Name</p>
                    <p className="font-medium">{selectedAdvertiser.accounting_contact_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Role</p>
                    <p className="font-medium">{selectedAdvertiser.accounting_contact_role || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedAdvertiser.accounting_contact_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedAdvertiser.accounting_contact_email}</p>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Payment Agreement</p>
                    <p className="font-medium">{selectedAdvertiser.payment_agreement}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Terms</p>
                    <p className="font-medium">{selectedAdvertiser.payment_terms}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">EIN/VAT Number</p>
                    <p className="font-medium">{selectedAdvertiser.ein_vat_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Wallet Balance</p>
                    <p className="font-semibold text-green-700 font-mono">
                      ${selectedAdvertiser.balance !== undefined ? selectedAdvertiser.balance.toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Account Dates</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Registration Date</p>
                    <p className="font-medium">{formatDate(selectedAdvertiser.created_at)}</p>
                  </div>
                  {selectedAdvertiser.account_status_updated_at && (
                    <div>
                      <p className="text-muted-foreground">Status Updated</p>
                      <p className="font-medium">{formatDate(selectedAdvertiser.account_status_updated_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {selectedAdvertiser?.account_status === "pending_approval" && (
              <>
                <Button 
                  variant="outline"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    handleApprove(selectedAdvertiser._id);
                  }}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    openRejectDialog(selectedAdvertiser);
                  }}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advertiser Postback Configuration Modal */}
      <Dialog open={isPostbackModalOpen} onOpenChange={setIsPostbackModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advertiser Postback Generator</DialogTitle>
            <DialogDescription>
              Set up parameters and generate a postback URL for {selectedAdvertiserForPostback?.company_name || selectedAdvertiserForPostback?.first_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* Advertiser Info */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Advertiser Information</Label>
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">Company:</span>{' '}
                  <span className="font-semibold">{selectedAdvertiserForPostback?.company_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="font-semibold">{selectedAdvertiserForPostback?.email}</span>
                </div>
              </div>
            </div>

            {/* Parameter Selection */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Select Parameters</Label>
              <p className="text-xs text-gray-500 mb-4">
                Check the parameters Moustache Leads needs, then enter what the advertiser calls each parameter in their system.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {predefinedParameters.map((param) => {
                  const isSelected = selectedParameters.includes(param.key);
                  return (
                    <div key={param.key} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        id={`param-${param.key}`}
                        checked={isSelected}
                        onChange={() => handleParameterToggle(param.key)}
                        className="rounded border-gray-300 h-4 w-4"
                      />
                      <div className="flex-shrink-0 w-32">
                        <Label htmlFor={`param-${param.key}`} className="text-sm font-medium cursor-pointer">
                          {param.label}
                        </Label>
                      </div>
                      {isSelected ? (
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Advertiser's macro name:</span>
                          <Input
                            value={parameterMappings[param.key] || ''}
                            onChange={(e) => handleParameterMappingChange(param.key, e.target.value)}
                            placeholder={`e.g. ${param.key}`}
                            className="h-8 text-sm flex-1"
                          />
                          <code className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap">
                            {param.key}={`{${parameterMappings[param.key] || param.key}}`}
                          </code>
                        </div>
                      ) : (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-400">
                          {param.placeholder}
                        </code>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>



            {/* URL Display */}
            {selectedAdvertiserForPostback?.postback_receiver_url && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <Label className="text-sm font-semibold text-green-800 block">Generated Postback URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={selectedAdvertiserForPostback.postback_receiver_url}
                    readOnly
                    className="font-mono text-sm bg-white border-green-300"
                  />
                  <Button
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => copyToClipboard(selectedAdvertiserForPostback.postback_receiver_url!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => {
                      setTestParams(selectedParameters.reduce((acc, p) => ({ ...acc, [p]: `test_${p}` }), {}));
                      setIsTestModalOpen(true);
                    }}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test URL
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingPostback}
                    onClick={handleDeletePostback}
                  >
                    {deletingPostback ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete URL
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPostbackModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => handleSavePostback(false)}
              disabled={generatingPostback}
            >
              {generatingPostback && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {selectedAdvertiserForPostback?.postback_receiver_url ? 'Update' : 'Generate'} URL
            </Button>
            {selectedAdvertiserForPostback?.postback_receiver_url && (
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700"
                onClick={() => handleSavePostback(true)}
                disabled={generatingPostback}
              >
                Regenerate Key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Postback Modal */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Postback URL</DialogTitle>
            <DialogDescription>
              Enter test values to trigger the advertiser postback receiver
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="grid grid-cols-2 gap-4">
              {selectedParameters.map((param) => (
                <div key={param} className="space-y-1">
                  <Label htmlFor={`test-${param}`}>{param}</Label>
                  <Input
                    id={`test-${param}`}
                    value={testParams[param] || ''}
                    onChange={(e) => setTestParams(prev => ({ ...prev, [param]: e.target.value }))}
                    placeholder={`Enter test value for ${param}`}
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setIsTestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={testPostbackUrl}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Fire Test Postback
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAdvertiserManagement;

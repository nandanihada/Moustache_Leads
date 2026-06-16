import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl } from "@/services/apiConfig";
import { useToast } from "@/components/ui/use-toast";
import { getAuthToken } from "@/utils/cookies";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  Globe,
  Monitor,
  Laptop,
  Layers,
  ArrowLeft,
  X,
  AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Advertiser {
  company_name: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Campaign {
  _id: string;
  name: string;
  campaign_type: string;
  status: string;
  bid_type: string;
  bid_amount: number;
  daily_limit: number;
  total_budget: number;
  target_countries: string[];
  target_devices: string[];
  target_os: string[];
  target_browsers: string[];
  landing_url: string;
  form_data?: any;
  created_at: string;
  updated_at: string;
  advertiser: Advertiser;
  rejection_reason?: string;
  approved_date?: string;
}

export default function AdminCampaignRequests() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  const [selectedAdvertiserEmail, setSelectedAdvertiserEmail] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedAdvertiserEmail, startDate, endDate, pageSize]);
  
  // Rejection dialog state
  const [rejectingCampaign, setRejectingCampaign] = useState<Campaign | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const { toast } = useToast();
  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/advertiser-campaigns`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.campaigns) {
        setCampaigns(data.campaigns);
      } else {
        throw new Error(data.error || "Failed to load campaigns.");
      }
    } catch (err: any) {
      console.error("Failed to fetch campaigns:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load campaigns.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string, extraData = {}) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/advertiser-campaigns/${id}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus, ...extraData })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast({
          title: "Success",
          description: `Campaign updated to ${newStatus} status.`
        });
        
        // Update local state
        const updatedFields = {
          status: newStatus,
          approved_date: data.approved_date || new Date().toISOString(),
          ...extraData
        };
        setCampaigns(prev => prev.map(c => c._id === id ? { ...c, ...updatedFields } : c));
        if (selectedCampaign?._id === id) {
          setSelectedCampaign(prev => prev ? { ...prev, ...updatedFields } : null);
        }
      } else {
        throw new Error(data.error || "Update status action failed.");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const submitRejection = async () => {
    if (!rejectingCampaign) return;
    if (!rejectionReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please enter a reason for rejecting this campaign.",
        variant: "destructive"
      });
      return;
    }

    setRejectSubmitting(true);
    await handleStatusChange(rejectingCampaign._id, "rejected", { rejection_reason: rejectionReason });
    setRejectSubmitting(false);
    setRejectingCampaign(null);
    setRejectionReason("");
  };

  // Stats calculation
  const stats = {
    total: campaigns.length,
    pending: campaigns.filter(c => c.status === "pending").length,
    running: campaigns.filter(c => c.status === "running").length,
    rejected: campaigns.filter(c => c.status === "rejected").length
  };

  // Filter and search campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    
    const searchString = `${c.name} ${c.advertiser?.company_name || ""} ${c.advertiser?.email || ""} ${c.campaign_type}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    
    const matchesAdvertiser = selectedAdvertiserEmail === "all" || c.advertiser?.email === selectedAdvertiserEmail;

    // Date filtering
    let matchesDate = true;
    if (c.created_at) {
      const campDate = new Date(c.created_at);
      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        if (campDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59");
        if (campDate > end) matchesDate = false;
      }
    } else if (startDate || endDate) {
      matchesDate = false;
    }
    
    return matchesStatus && matchesSearch && matchesAdvertiser && matchesDate;
  });

  // Calculate unique list of advertisers from campaigns
  const uniqueAdvertisers = Array.from(new Map(
    campaigns
      .filter(c => c.advertiser)
      .map(c => [c.advertiser.email, c.advertiser])
  ).values());

  // Pagination calculation
  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Running</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex items-center gap-1"><Clock className="w-3.5 h-3.5 animate-pulse" /> Pending Approval</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Rejected</Badge>;
      case "paused":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Paused</Badge>;
      case "draft":
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Campaign Requests</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Approve, reject, or request review for advertiser self-serve campaigns.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          onClick={() => setStatusFilter("all")}
          className={`hover:shadow-md transition-shadow cursor-pointer ${statusFilter === "all" ? "border-orange-500 ring-1 ring-orange-500/20" : ""}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">All Campaigns</p>
                <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStatusFilter("pending")}
          className={`hover:shadow-md transition-shadow cursor-pointer border-amber-200 bg-amber-50/20 ${statusFilter === "pending" ? "border-amber-500 ring-1 ring-amber-500/20" : ""}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Pending Approval</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-700">{stats.pending}</h3>
              </div>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStatusFilter("running")}
          className={`hover:shadow-md transition-shadow cursor-pointer border-green-200 bg-green-50/20 ${statusFilter === "running" ? "border-green-500 ring-1 ring-green-500/20" : ""}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Running / Live</p>
                <h3 className="text-2xl font-bold mt-1 text-green-700">{stats.running}</h3>
              </div>
              <div className="p-3 bg-green-100 text-green-700 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStatusFilter("rejected")}
          className={`hover:shadow-md transition-shadow cursor-pointer border-red-200 bg-red-50/20 ${statusFilter === "rejected" ? "border-red-500 ring-1 ring-red-500/20" : ""}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Rejected</p>
                <h3 className="text-2xl font-bold mt-1 text-red-700">{stats.rejected}</h3>
              </div>
              <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main filter list panel */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b bg-slate-50/30">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Advertiser Campaigns List
              </CardTitle>
              
              <div className="flex bg-muted rounded-lg p-0.5 border">
                {(["all", "pending", "running", "rejected"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className="capitalize text-xs font-semibold px-3 h-8"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Unified advanced filter panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              <div className="relative flex flex-col gap-1.5 sm:col-span-1 md:col-span-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search campaigns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Advertiser Filter</label>
                <select
                  value={selectedAdvertiserEmail}
                  onChange={(e) => setSelectedAdvertiserEmail(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Advertisers</option>
                  {uniqueAdvertisers.map(adv => (
                    <option key={adv.email} value={adv.email}>
                      {adv.company_name || `${adv.first_name} ${adv.last_name}`} ({adv.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Show per Page</label>
                <div className="flex gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value={20}>20 rows</option>
                    <option value={30}>30 rows</option>
                    <option value={50}>50 rows</option>
                    <option value={100}>100 rows</option>
                  </select>

                  {(searchQuery || selectedAdvertiserEmail !== "all" || startDate || endDate || statusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedAdvertiserEmail("all");
                        setStartDate("");
                        setEndDate("");
                        setStatusFilter("all");
                      }}
                      className="h-9 w-9 flex-shrink-0"
                      title="Clear Filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="text-sm">Fetching campaigns...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <p className="text-sm">No campaigns match the selection.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground bg-muted/30">
                    <th className="px-4 py-3">Campaign Name & Type</th>
                    <th className="px-4 py-3">Advertiser</th>
                    <th className="px-4 py-3">Bid / Rate</th>
                    <th className="px-4 py-3">Daily Budget / Total</th>
                    <th className="px-4 py-3">Target Countries</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3">Approved Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedCampaigns.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-foreground text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-medium">{c.campaign_type.replace("_", " ")}</Badge>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-medium">{c.bid_type}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-sm text-foreground">{c.advertiser?.company_name || "Unknown Company"}</div>
                        <div className="text-xs text-muted-foreground">{c.advertiser?.email || "No email"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono font-semibold text-sm">${c.bid_amount.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          Daily: <span className="font-semibold">{c.daily_limit > 0 ? `$${c.daily_limit.toFixed(2)}` : "Unlimited"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Total: {c.total_budget > 0 ? `$${c.total_budget.toFixed(2)}` : "Unlimited"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {c.target_countries?.slice(0, 4).map((country) => (
                            <Badge key={country} variant="secondary" className="text-[10px] py-0 px-1">{country}</Badge>
                          ))}
                          {c.target_countries?.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{c.target_countries.length - 4} more</span>
                          )}
                          {(!c.target_countries || c.target_countries.length === 0) && (
                            <span className="text-xs text-muted-foreground">Worldwide</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {getStatusBadge(c.status)}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : "N/A"}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground font-medium">
                        {c.approved_date ? new Date(c.approved_date).toLocaleString() : (
                          c.status === "pending" ? (
                            <span className="text-amber-600 font-semibold italic">Awaiting Action</span>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCampaign(c)}
                            className="h-8 px-2.5"
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                          
                          {c.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(c._id, "running")}
                                className="bg-green-600 hover:bg-green-700 text-white h-8"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRejectingCampaign(c)}
                                className="h-8"
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {c.status !== "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(c._id, "pending")}
                              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 h-8"
                              title="Reset to Pending Approval"
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {filteredCampaigns.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold">{Math.min(filteredCampaigns.length, (currentPage - 1) * pageSize + 1)}</span> to{" "}
                    <span className="font-semibold">{Math.min(filteredCampaigns.length, currentPage * pageSize)}</span> of{" "}
                    <span className="font-semibold">{filteredCampaigns.length}</span> campaigns
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="h-8 text-xs px-3"
                    >
                      Previous
                    </Button>
                    
                    <div className="text-xs font-semibold px-2">
                      Page {currentPage} of {totalPages || 1}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="h-8 text-xs px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={selectedCampaign !== null} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        {selectedCampaign && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    {selectedCampaign.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Campaign ID: {selectedCampaign._id}
                  </DialogDescription>
                </div>
                <div>{getStatusBadge(selectedCampaign.status)}</div>
              </div>
            </DialogHeader>

            <div className="space-y-6 my-4 py-2">
              {/* Advertiser Section */}
              <div className="bg-slate-50 rounded-xl p-4 border space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advertiser Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Company Name</span>
                    <span className="font-semibold text-slate-900">{selectedCampaign.advertiser?.company_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Email Address</span>
                    <span className="font-semibold text-slate-900">{selectedCampaign.advertiser?.email || "N/A"}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t mt-1">
                    <span className="text-muted-foreground block text-xs">Contact Person</span>
                    <span className="font-medium text-slate-900">
                      {selectedCampaign.advertiser?.first_name} {selectedCampaign.advertiser?.last_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* General Config */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-b pb-4">
                <div>
                  <span className="text-muted-foreground block text-xs">Campaign Format</span>
                  <Badge variant="secondary" className="mt-1 capitalize">{selectedCampaign.campaign_type.replace("_", " ")}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Pricing & Bid</span>
                  <span className="font-semibold block text-sm mt-1 uppercase">
                    {selectedCampaign.bid_type}: ${selectedCampaign.bid_amount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Dates</span>
                  <span className="text-xs block mt-1">
                    Created: {new Date(selectedCampaign.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Target / Destination Link */}
              <div className="space-y-1">
                <span className="text-muted-foreground block text-xs">Target / Destination URL</span>
                <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all flex items-center justify-between border">
                  <span>{selectedCampaign.landing_url}</span>
                  <a
                    href={selectedCampaign.landing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-orange-600 hover:underline flex items-center gap-0.5 flex-shrink-0"
                  >
                    Open <Eye className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Targeting specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 border rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Globe className="w-3.5 h-3.5 text-slate-400" /> Geos & Bids split
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCampaign.target_countries?.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs font-semibold bg-white">{c}</Badge>
                    ))}
                    {(!selectedCampaign.target_countries || selectedCampaign.target_countries.length === 0) && (
                      <span className="text-xs text-muted-foreground">Worldwide (All Countries)</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 p-3 border rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" /> Device & OS targeting
                  </div>
                  <div className="space-y-2 pt-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Devices:</span>{" "}
                      <span className="font-semibold capitalize">
                        {selectedCampaign.target_devices?.join(", ") || "All Devices"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Operating Systems:</span>{" "}
                      <span className="font-semibold capitalize">
                        {selectedCampaign.target_os?.join(", ") || "All OS"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Browsers:</span>{" "}
                      <span className="font-semibold capitalize">
                        {selectedCampaign.target_browsers?.join(", ") || "All"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Budgets */}
              <div className="bg-slate-50 rounded-xl p-4 border grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground block text-xs">Daily Budget Limit</span>
                  <span className="font-bold text-base text-slate-800">
                    {selectedCampaign.daily_limit > 0 ? `$${selectedCampaign.daily_limit.toFixed(2)}` : "Unlimited / None"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Total Budget Limit</span>
                  <span className="font-bold text-base text-slate-800">
                    {selectedCampaign.total_budget > 0 ? `$${selectedCampaign.total_budget.toFixed(2)}` : "Unlimited / None"}
                  </span>
                </div>
              </div>

              {/* Rejection Details if rejected */}
              {selectedCampaign.status === "rejected" && selectedCampaign.rejection_reason && (
                <div className="p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-sm text-red-900">Rejection Reason</h5>
                    <p className="text-sm mt-1">{selectedCampaign.rejection_reason}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setSelectedCampaign(null)}>
                Close Details
              </Button>
              
              {selectedCampaign.status === "pending" && (
                <>
                  <Button
                    onClick={() => {
                      handleStatusChange(selectedCampaign._id, "running");
                      setSelectedCampaign(null);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Approve Campaign
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectingCampaign(selectedCampaign);
                      setSelectedCampaign(null);
                    }}
                  >
                    Reject Campaign
                  </Button>
                </>
              )}

              {selectedCampaign.status !== "pending" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleStatusChange(selectedCampaign._id, "pending");
                    setSelectedCampaign(null);
                  }}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  Mark Pending / Review
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Rejection Reason Input Modal */}
      <Dialog open={rejectingCampaign !== null} onOpenChange={(open) => !open && setRejectingCampaign(null)}>
        {rejectingCampaign && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-1.5 text-red-600">
                <AlertTriangle className="w-5 h-5" /> Reject Campaign Request
              </DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting the campaign "{rejectingCampaign.name}". This reason will be saved for advertiser feedback.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Reason for Rejection</label>
              <textarea
                placeholder="e.g. Invalid landing URL or inappropriate creative content."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full h-24 p-3 border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectingCampaign(null); setRejectionReason(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={rejectSubmitting}
                onClick={submitRejection}
              >
                {rejectSubmitting ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

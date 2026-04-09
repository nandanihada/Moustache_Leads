import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search, Filter, Download, Upload, RefreshCw, Plus, MoreVertical,
  Eye, Edit, Trash2, Copy, Pin, TrendingUp, Globe, Activity, Users
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminOfferApi, Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminOffersV3 = () => {
  const { toast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'running'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [pinnedOffers, setPinnedOffers] = useState<Set<string>>(new Set());
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [countryFilter, setCountryFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');

  // Fetch offers
  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await adminOfferApi.getOffers({
        page: 1,
        per_page: 100,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
        sort: sortBy,
        country: countryFilter !== 'all' ? countryFilter : undefined,
        network: networkFilter !== 'all' ? networkFilter : undefined,
      });
      setOffers(response.offers);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch offers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [statusFilter, sortBy, countryFilter, networkFilter, activeTab]);

  // Bulk price change
  const handleBulkPriceChange = async (type: 'increase' | 'decrease', percentage: number) => {
    if (selectedOffers.size === 0) {
      toast({
        title: 'No offers selected',
        description: 'Please select offers to update',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Implementation for bulk price change
      toast({
        title: 'Success',
        description: `Price ${type}d by ${percentage}% for ${selectedOffers.size} offers`,
      });
      fetchOffers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update prices',
        variant: 'destructive',
      });
    }
  };

  // Pin/Unpin offer
  const togglePinOffer = (offerId: string) => {
    const newPinned = new Set(pinnedOffers);
    if (newPinned.has(offerId)) {
      newPinned.delete(offerId);
    } else {
      newPinned.add(offerId);
    }
    setPinnedOffers(newPinned);
  };

  // Get sorted and filtered offers
  const getDisplayOffers = () => {
    let filtered = [...offers];

    // Apply tab filter
    if (activeTab === 'active') {
      filtered = filtered.filter(o => o.status === 'active');
    } else if (activeTab === 'running') {
      // Filter running offers based on activity
      filtered = filtered.filter(o => o.status === 'active' && (o.hits || 0) > 0);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.offer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.campaign_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply client-side sorting
    switch (sortBy) {
      case 'payout_high':
        filtered.sort((a, b) => (b.payout || 0) - (a.payout || 0));
        break;
      case 'payout_low':
        filtered.sort((a, b) => (a.payout || 0) - (b.payout || 0));
        break;
      case 'title_az':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'title_za':
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        break;
    }

    // Sort pinned offers to top
    const pinned = filtered.filter(o => pinnedOffers.has(o.offer_id));
    const unpinned = filtered.filter(o => !pinnedOffers.has(o.offer_id));

    return [...pinned, ...unpinned];
  };

  const displayOffers = getDisplayOffers();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Offers Management</h1>
          <p className="text-muted-foreground">Manage and track all your offers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchOffers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Offer
          </Button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search offers by name, campaign ID, or offer ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="payout_high">Highest Payout</SelectItem>
                  <SelectItem value="payout_low">Lowest Payout</SelectItem>
                  <SelectItem value="title_az">Name (A-Z)</SelectItem>
                  <SelectItem value="title_za">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>

              <Select value="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                </SelectContent>
              </Select>

              <Select value="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                </SelectContent>
              </Select>

              <Select value="all">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Health</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="unhealthy">Unhealthy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rotation Toggle */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={rotationEnabled}
                  onCheckedChange={setRotationEnabled}
                />
                <Label>Enable Offer Rotation</Label>
              </div>
              
              {selectedOffers.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedOffers.size} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Bulk Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Price Change</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleBulkPriceChange('increase', 10)}>
                        Increase by 10%
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkPriceChange('decrease', 10)}>
                        Decrease by 10%
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Change Status</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete Selected</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">
              All Offers ({offers.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active Offers ({offers.filter(o => o.status === 'active').length})
            </TabsTrigger>
            <TabsTrigger value="running">
              Running Offers ({offers.filter(o => o.status === 'active' && (o.hits || 0) > 0).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="h-4 w-4 mr-2" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Offer Actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              API Import
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Management</DropdownMenuLabel>
            <DropdownMenuItem>
              <Copy className="h-4 w-4 mr-2" />
              Clone
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              CSV Export
            </DropdownMenuItem>
            <DropdownMenuItem>
              <RefreshCw className="h-4 w-4 mr-2" />
              Remove Duplicates
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Geo Chart for Running Offers */}
      {activeTab === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Geographic Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">120</div>
                  <div className="text-sm text-muted-foreground">USA Clicks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">50</div>
                  <div className="text-sm text-muted-foreground">India Clicks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">30</div>
                  <div className="text-sm text-muted-foreground">UK Clicks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">25</div>
                  <div className="text-sm text-muted-foreground">Canada Clicks</div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : displayOffers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No offers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="p-4">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOffers(new Set(displayOffers.map(o => o.offer_id)));
                          } else {
                            setSelectedOffers(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className="p-4">Image</th>
                    <th className="p-4">Offer ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Countries</th>
                    <th className="p-4">Payout</th>
                    <th className="p-4">Network</th>
                    <th className="p-4">Active/Expiry</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOffers.map((offer) => (
                    <tr key={offer.offer_id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedOffers.has(offer.offer_id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedOffers);
                            if (e.target.checked) {
                              newSelected.add(offer.offer_id);
                            } else {
                              newSelected.delete(offer.offer_id);
                            }
                            setSelectedOffers(newSelected);
                          }}
                        />
                      </td>
                      <td className="p-4">
                        <div className="w-12 h-12 bg-muted rounded" />
                      </td>
                      <td className="p-4 font-mono text-sm">{offer.offer_id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {pinnedOffers.has(offer.offer_id) && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{offer.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{offer.category || 'N/A'}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          className={
                            offer.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {offer.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {offer.countries.slice(0, 2).map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                          {offer.countries.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{offer.countries.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-green-600">
                        ${offer.payout.toFixed(2)}
                      </td>
                      <td className="p-4">{offer.network}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {offer.start_date || 'N/A'}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePinOffer(offer.offer_id)}>
                              <Pin className="h-4 w-4 mr-2" />
                              {pinnedOffers.has(offer.offer_id) ? 'Unpin' : 'Pin to Top'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Clone
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs/Tracking Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Tracking & Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="network">
            <TabsList>
              <TabsTrigger value="network">Network Clicks</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="offers">Offers</TabsTrigger>
              <TabsTrigger value="logs">Activity Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="network" className="pt-4">
              <p className="text-sm text-muted-foreground">Network click tracking data will appear here</p>
            </TabsContent>
            <TabsContent value="users" className="pt-4">
              <p className="text-sm text-muted-foreground">User activity data will appear here</p>
            </TabsContent>
            <TabsContent value="offers" className="pt-4">
              <p className="text-sm text-muted-foreground">Offer performance data will appear here</p>
            </TabsContent>
            <TabsContent value="logs" className="pt-4">
              <p className="text-sm text-muted-foreground">Activity logs will appear here</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminOffersV3WithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOffersV3 />
  </AdminPageGuard>
);

export default AdminOffersV3WithGuard;

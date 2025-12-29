import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Copy,
  X,
  Eye,
  Download,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Globe,
  Link,
  Settings,
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddOfferModal } from '@/components/AddOfferModal';
import { EditOfferModal } from '@/components/EditOfferModal';
import { LinkMaskingModal } from '@/components/LinkMaskingModal';
import { DomainManagementModal } from '@/components/DomainManagementModal';
import { AdvancedSettingsModal } from '@/components/AdvancedSettingsModal';
import { OfferDetailsModal } from '@/components/OfferDetailsModal';
import { BulkOfferUpload } from '@/components/BulkOfferUpload';
import { adminOfferApi, Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';

const AdminOffers = () => {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOfferModalOpen, setAddOfferModalOpen] = useState(false);
  const [editOfferModalOpen, setEditOfferModalOpen] = useState(false);
  const [linkMaskingModalOpen, setLinkMaskingModalOpen] = useState(false);
  const [domainManagementModalOpen, setDomainManagementModalOpen] = useState(false);
  const [advancedSettingsModalOpen, setAdvancedSettingsModalOpen] = useState(false);
  const [offerDetailsModalOpen, setOfferDetailsModalOpen] = useState(false);
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        per_page: pagination.per_page,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      };

      const response = await adminOfferApi.getOffers(params);
      setOffers(response.offers);
      setPagination(response.pagination);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch offers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      await adminOfferApi.deleteOffer(offerId);
      toast({
        title: "Success",
        description: "Offer deleted successfully",
      });
      fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete offer",
        variant: "destructive",
      });
    }
  };

  const handleCloneOffer = async (offerId: string) => {
    try {
      await adminOfferApi.cloneOffer(offerId);
      toast({
        title: "Success",
        description: "Offer cloned successfully",
      });
      fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clone offer",
        variant: "destructive",
      });
    }
  };

  const handleEditOffer = (offer: Offer) => {
    setSelectedOffer(offer);
    setEditOfferModalOpen(true);
  };

  const handleCreateMaskedLink = (offer: Offer) => {
    setSelectedOffer(offer);
    setLinkMaskingModalOpen(true);
  };

  const handleAdvancedSettings = (offer: Offer) => {
    setSelectedOffer(offer);
    setAdvancedSettingsModalOpen(true);
  };

  const handleViewDetails = (offer: Offer) => {
    setSelectedOffer(offer);
    setOfferDetailsModalOpen(true);
  };

  const handleCSVExport = async () => {
    try {
      setLoading(true);

      // Get all offers for export (without pagination)
      const allOffers = await adminOfferApi.getOffers({
        page: 1,
        per_page: 1000, // Get up to 1000 offers
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined
      });

      if (!allOffers.offers || allOffers.offers.length === 0) {
        toast({
          title: "No Data",
          description: "No offers found to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare CSV data with comprehensive fields
      const csvData = allOffers.offers.map(offer => ({
        'Offer ID': offer.offer_id,
        'Campaign ID': offer.campaign_id,
        'Name': offer.name,
        'Description': offer.description || '',
        'Status': offer.status,
        'Category': offer.category || '',
        'Offer Type': offer.offer_type || '',
        'Network': offer.network,
        'Payout': (() => {
          const revenueSharePercent = (offer as any).revenue_share_percent || 0;
          const currency = offer.currency || 'USD';
          const currencySymbols: Record<string, string> = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
            'RUB': '₽', 'BRL': 'R$', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF',
            'SEK': 'kr', 'PLN': 'zł', 'ILS': '₪', 'KRW': '₩', 'THB': '฿',
            'VND': '₫', 'IDR': 'Rp', 'MYR': 'RM', 'PHP': '₱', 'SGD': 'S$',
            'HKD': 'HK$', 'TWD': 'NT$', 'ZAR': 'R', 'AED': 'د.إ', 'SAR': 'SR',
            'QAR': 'QR', 'BHD': 'BD', 'KWD': 'KD', 'OMR': 'OMR'
          };
          const symbol = currencySymbols[currency] || '$';
          
          if (revenueSharePercent > 0) {
            return `${revenueSharePercent}%`;
          } else {
            return `${symbol}${offer.payout}`;
          }
        })(),
        'Payout Model': (offer as any).payout_model || '',
        'Payout Type': (offer as any).payout_type || 'fixed',
        'Incentive': (offer as any).incentive_type || 'Incent',
        'Currency': offer.currency || 'USD',
        'Revenue': offer.revenue ? `$${offer.revenue}` : '',
        'Countries': Array.isArray(offer.countries) ? offer.countries.join(', ') : '',
        'Device Targeting': offer.device_targeting,
        'Affiliates': offer.affiliates,
        'Target URL': offer.target_url,
        'Preview URL': offer.preview_url || '',
        'Image URL': offer.image_url || '',
        'Hits': offer.hits || 0,
        'Limit': offer.limit || '',
        'Hash Code': offer.hash_code || '',
        'Start Date': offer.start_date || '',
        'Expiration Date': offer.expiration_date || '',
        'Created At': offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '',
        'Updated At': offer.updated_at ? new Date(offer.updated_at).toLocaleDateString() : '',
        'Created By': offer.created_by || '',
        'Tags': Array.isArray(offer.tags) ? offer.tags.join(', ') : '',
        'Languages': Array.isArray(offer.languages) ? offer.languages.join(', ') : '',
        'OS Targeting': Array.isArray(offer.os_targeting) ? offer.os_targeting.join(', ') : '',
        'Browser Targeting': Array.isArray(offer.browser_targeting) ? offer.browser_targeting.join(', ') : '',
        'Connection Type': offer.connection_type || '',
        'Timezone': offer.timezone || '',
        'Daily Cap': offer.caps?.daily || '',
        'Weekly Cap': offer.caps?.weekly || '',
        'Monthly Cap': offer.caps?.monthly || '',
        'Total Cap': offer.caps?.total || '',
        'Auto Pause on Cap': offer.caps?.auto_pause ? 'Yes' : 'No',
        'Tracking Protocol': offer.tracking?.protocol || '',
        'Click Expiration': offer.tracking?.click_expiration ? `${offer.tracking.click_expiration} days` : '',
        'Conversion Window': offer.tracking?.conversion_window ? `${offer.tracking.conversion_window} days` : '',
        'Access Type': offer.access_type || '',
        'Manager': offer.manager || '',
        'Creative Category': offer.creative_category || '',
        'Auto Expire Action': offer.auto_expire_action || '',
        'Fallback URL': offer.fallback_url || '',
        'External Offer ID': offer.integrations?.external_offer_id || '',
        'Sync Frequency': offer.integrations?.sync_frequency || '',
        'Conversion Goal': offer.monitoring?.conversion_goal || '',
        'Quality Threshold': offer.monitoring?.quality_threshold || '',
        'Validation Type': offer.monitoring?.validation_type || ''
      }));

      // Convert to CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row =>
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV
            const stringValue = String(value || '');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `offers-export-${timestamp}.csv`;
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${csvData.length} offers to ${filename}`,
      });

    } catch (error) {
      console.error('CSV Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export offers to CSV",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (pagination.page === 1) {
        fetchOffers();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Offers Management</h2>
          <p className="text-muted-foreground">
            Create, manage, and track your offers with advanced masking and analytics.
          </p>
        </div>
      </div>

      {/* Top Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => setAddOfferModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Offer
              </Button>
              <Button
                variant="secondary"
                onClick={() => setBulkUploadModalOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Button variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Clone
              </Button>
              <Button variant="outline">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" onClick={handleCSVExport} disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                CSV Export
              </Button>
              <Button variant="outline" onClick={fetchOffers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => setDomainManagementModalOpen(true)}>
                <Globe className="h-4 w-4 mr-2" />
                Manage Domains
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search offers by name, campaign ID, or offer ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
                  Inactive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Offers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Offers ({pagination.total})</CardTitle>
          <CardDescription>
            Manage your offers with full tracking and masking capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading offers...
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No offers found</p>
              <Button
                className="mt-4"
                onClick={() => setAddOfferModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Offer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Offer ID</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Countries</TableHead>
                  <TableHead>Payout/Revenue</TableHead>
                  <TableHead>Incentive</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Hits/Limit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.offer_id}>
                    <TableCell>
                      {(() => {
                        const creativeType = (offer as any).creative_type || 'image';

                        if (creativeType === 'image' || creativeType === 'upload') {
                          return (offer.thumbnail_url || offer.image_url) ? (
                            <img
                              src={offer.thumbnail_url || offer.image_url}
                              alt={offer.name}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                              <span className="text-xs text-gray-400">No Image</span>
                            </div>
                          );
                        } else if (creativeType === 'html' && (offer as any).html_code) {
                          return (
                            <div
                              className="w-12 h-12 rounded border overflow-hidden text-xs"
                              dangerouslySetInnerHTML={{ __html: (offer as any).html_code }}
                              style={{ transform: 'scale(0.2)', transformOrigin: 'top left', width: '240px', height: '240px' }}
                            />
                          );
                        } else if (creativeType === 'email' && (offer as any).email_template) {
                          return (
                            <div
                              className="w-12 h-12 rounded border overflow-hidden text-xs"
                              dangerouslySetInnerHTML={{ __html: (offer as any).email_template }}
                              style={{ transform: 'scale(0.2)', transformOrigin: 'top left', width: '240px', height: '240px' }}
                            />
                          );
                        } else {
                          return (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                              <span className="text-xs text-gray-400">
                                {creativeType === 'html' ? 'HTML' : creativeType === 'email' ? 'Email' : 'No Image'}
                              </span>
                            </div>
                          );
                        }
                      })()}
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {offer.offer_id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {offer.campaign_id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{offer.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {offer.affiliates === 'all' ? 'All Users' :
                            offer.affiliates === 'premium' ? 'Premium Only' : 'Selected Users'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(offer.status)}>
                        {offer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {offer.countries.slice(0, 3).map((country) => (
                          <Badge key={country} variant="outline" className="text-xs">
                            {country}
                          </Badge>
                        ))}
                        {offer.countries.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{offer.countries.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {(() => {
                        const revenueSharePercent = (offer as any).revenue_share_percent || 0;
                        const currency = offer.currency || 'USD';
                        const currencySymbols: Record<string, string> = {
                          'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
                          'RUB': '₽', 'BRL': 'R$', 'CAD': 'C$', 'AUD': 'A$', 'CHF': 'CHF',
                          'SEK': 'kr', 'PLN': 'zł', 'ILS': '₪', 'KRW': '₩', 'THB': '฿',
                          'VND': '₫', 'IDR': 'Rp', 'MYR': 'RM', 'PHP': '₱', 'SGD': 'S$',
                          'HKD': 'HK$', 'TWD': 'NT$', 'ZAR': 'R', 'AED': 'د.إ', 'SAR': 'SR',
                          'QAR': 'QR', 'BHD': 'BD', 'KWD': 'KD', 'OMR': 'OMR'
                        };
                        const symbol = currencySymbols[currency] || '$';
                        
                        if (revenueSharePercent > 0) {
                          return `${revenueSharePercent}%`;
                        } else {
                          return `${symbol}${offer.payout.toFixed(2)}`;
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const incentiveType = (offer as any).incentive_type || 'Incent';
                        const isIncent = incentiveType === 'Incent';
                        return (
                          <Badge
                            className={isIncent
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            }
                          >
                            {isIncent ? '🟢 Incent' : '🔴 Non-Incent'}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {offer.network}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{offer.hits.toLocaleString()}</div>
                        <div className="text-muted-foreground">
                          {offer.limit ? `/ ${offer.limit.toLocaleString()}` : '/ ∞'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(offer)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditOffer(offer)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCreateMaskedLink(offer)}>
                            <Link className="h-4 w-4 mr-2" />
                            Create Masked Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAdvancedSettings(offer)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Advanced Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCloneOffer(offer.offer_id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                            window.open(`${baseUrl}/preview/${offer.offer_id}`, '_blank');
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteOffer(offer.offer_id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Offer Modal */}
      <AddOfferModal
        open={addOfferModalOpen}
        onOpenChange={setAddOfferModalOpen}
        onOfferCreated={fetchOffers}
      />

      {/* Edit Offer Modal */}
      <EditOfferModal
        open={editOfferModalOpen}
        onOpenChange={setEditOfferModalOpen}
        offer={selectedOffer}
        onOfferUpdated={fetchOffers}
      />

      {/* Link Masking Modal */}
      <LinkMaskingModal
        open={linkMaskingModalOpen}
        onOpenChange={setLinkMaskingModalOpen}
        offer={selectedOffer}
        onLinkCreated={() => {
          toast({
            title: "Success",
            description: "Masked link created successfully",
          });
        }}
      />

      {/* Domain Management Modal */}
      <DomainManagementModal
        open={domainManagementModalOpen}
        onOpenChange={setDomainManagementModalOpen}
      />

      {/* Advanced Settings Modal */}
      <AdvancedSettingsModal
        open={advancedSettingsModalOpen}
        onOpenChange={setAdvancedSettingsModalOpen}
        offer={selectedOffer}
        onSettingsUpdated={() => {
          toast({
            title: "Success",
            description: "Advanced settings updated successfully",
          });
        }}
      />

      {/* Offer Details Modal */}
      <OfferDetailsModal
        open={offerDetailsModalOpen}
        onOpenChange={setOfferDetailsModalOpen}
        offer={selectedOffer}
      />

      {/* Bulk Upload Modal */}
      <BulkOfferUpload
        open={bulkUploadModalOpen}
        onOpenChange={setBulkUploadModalOpen}
        onUploadComplete={fetchOffers}
      />
    </div>
  );
};

const AdminOffersWithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOffers />
  </AdminPageGuard>
);

export default AdminOffersWithGuard;

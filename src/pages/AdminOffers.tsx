import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Layers
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
import { ApiImportModal } from '@/components/ApiImportModal';
import { adminOfferApi, Offer } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminOffers = () => {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deletedOffers, setDeletedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [recycleBinSearchTerm, setRecycleBinSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('offers');
  const [addOfferModalOpen, setAddOfferModalOpen] = useState(false);
  const [editOfferModalOpen, setEditOfferModalOpen] = useState(false);
  const [linkMaskingModalOpen, setLinkMaskingModalOpen] = useState(false);
  const [domainManagementModalOpen, setDomainManagementModalOpen] = useState(false);
  const [advancedSettingsModalOpen, setAdvancedSettingsModalOpen] = useState(false);
  const [offerDetailsModalOpen, setOfferDetailsModalOpen] = useState(false);
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [apiImportModalOpen, setApiImportModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [selectedDeletedOffers, setSelectedDeletedOffers] = useState<Set<string>>(new Set());
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [assigningImages, setAssigningImages] = useState(false);
  const [duplicatePreviewOpen, setDuplicatePreviewOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [keepStrategy, setKeepStrategy] = useState<'newest' | 'oldest'>('newest');
  const [carouselViewOpen, setCarouselViewOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [verticalFilter, setVerticalFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0
  });
  const [recycleBinPagination, setRecycleBinPagination] = useState({
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
        ...(searchTerm && { search: searchTerm }),
        ...(sortBy && { sort: sortBy }),
        ...(countryFilter !== 'all' && { country: countryFilter })
      };

      const response = await adminOfferApi.getOffers(params);
      
      // Apply client-side sorting and filtering
      let filteredOffers = [...response.offers];
      
      // Apply country filter client-side if backend doesn't support it
      if (countryFilter !== 'all') {
        filteredOffers = filteredOffers.filter(offer => {
          const offerCountries = offer.countries || [];
          return offerCountries.some(c => c.toUpperCase() === countryFilter.toUpperCase());
        });
      }
      
      // Apply vertical/category filter
      if (verticalFilter !== 'all') {
        filteredOffers = filteredOffers.filter(offer => {
          const offerVertical = (offer.vertical || offer.category || '').toLowerCase();
          const filterValue = verticalFilter.toLowerCase();
          // Handle E-commerce special case
          return offerVertical === filterValue || 
                 (filterValue === 'e-commerce' && (offerVertical === 'ecommerce' || offerVertical === 'e-commerce'));
        });
      }
      
      // Apply sorting
      switch (sortBy) {
        case 'id_asc':
          filteredOffers.sort((a, b) => (a.offer_id || '').localeCompare(b.offer_id || ''));
          break;
        case 'id_desc':
          filteredOffers.sort((a, b) => (b.offer_id || '').localeCompare(a.offer_id || ''));
          break;
        case 'payout_high':
          filteredOffers.sort((a, b) => (b.payout || 0) - (a.payout || 0));
          break;
        case 'payout_low':
          filteredOffers.sort((a, b) => (a.payout || 0) - (b.payout || 0));
          break;
        case 'title_az':
          filteredOffers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'title_za':
          filteredOffers.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
        case 'newest':
          filteredOffers.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          break;
        case 'oldest':
          filteredOffers.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          break;
      }
      
      setOffers(filteredOffers);
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
        description: "Offer moved to recycle bin",
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

  const handleBulkDelete = async () => {
    if (selectedOffers.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select offers to delete",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to move ${selectedOffers.size} offer(s) to recycle bin?`)) {
      return;
    }

    try {
      const result = await adminOfferApi.bulkDeleteOffers(Array.from(selectedOffers));
      toast({
        title: "Bulk Delete Complete",
        description: `Moved ${result.deleted} offer(s) to recycle bin. ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`,
      });
      setSelectedOffers(new Set());
      fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to bulk delete offers",
        variant: "destructive",
      });
    }
  };

  // Generate tracking link for an offer
  const generateTrackingLink = (offer: Offer) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    let userId = '';
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        userId = user._id || user.id || '';
      }
    } catch (e) {}
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    params.append('sub1', 'default');
    return `${baseUrl}/track/${offer.offer_id}?${params.toString()}`;
  };

  // Bulk copy tracking links for selected offers
  const handleBulkCopyLinks = () => {
    if (selectedOffers.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select offers to copy links",
        variant: "destructive",
      });
      return;
    }

    const selectedOffersList = offers.filter(o => selectedOffers.has(o.offer_id));
    const links = selectedOffersList.map(offer => {
      const link = generateTrackingLink(offer);
      return `${offer.name}\n${link}`;
    }).join('\n\n');

    navigator.clipboard.writeText(links).then(() => {
      toast({
        title: "Links Copied!",
        description: `${selectedOffers.size} tracking link(s) copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  // Bulk copy full details for selected offers
  const handleBulkCopyDetails = () => {
    if (selectedOffers.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select offers to copy",
        variant: "destructive",
      });
      return;
    }

    const selectedOffersList = offers.filter(o => selectedOffers.has(o.offer_id));
    const details = selectedOffersList.map(offer => {
      const link = generateTrackingLink(offer);
      return [
        `Name: ${offer.name}`,
        `Offer ID: ${offer.offer_id}`,
        `Payout: $${offer.payout?.toFixed(2) || '0.00'}`,
        `Countries: ${offer.countries?.join(', ') || 'N/A'}`,
        `Tracking Link: ${link}`,
        '---'
      ].join('\n');
    }).join('\n');

    navigator.clipboard.writeText(details).then(() => {
      toast({
        title: "Details Copied!",
        description: `${selectedOffers.size} offer(s) details copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  // ============================================
  // RECYCLE BIN FUNCTIONS
  // ============================================

  const fetchRecycleBin = async () => {
    try {
      setRecycleBinLoading(true);
      const response = await adminOfferApi.getRecycleBin({
        page: recycleBinPagination.page,
        per_page: recycleBinPagination.per_page,
        search: recycleBinSearchTerm || undefined
      });
      setDeletedOffers(response.offers);
      setRecycleBinPagination(response.pagination);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch recycle bin",
        variant: "destructive",
      });
    } finally {
      setRecycleBinLoading(false);
    }
  };

  const handleRestoreOffer = async (offerId: string) => {
    try {
      await adminOfferApi.restoreOffer(offerId);
      toast({
        title: "Success",
        description: "Offer restored successfully",
      });
      fetchRecycleBin();
      fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to restore offer",
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async (offerId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this offer? This cannot be undone!')) {
      return;
    }

    try {
      await adminOfferApi.permanentDeleteOffer(offerId);
      toast({
        title: "Success",
        description: "Offer permanently deleted",
      });
      fetchRecycleBin();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to permanently delete offer",
        variant: "destructive",
      });
    }
  };

  const handleBulkRestore = async () => {
    if (selectedDeletedOffers.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select offers to restore",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await adminOfferApi.bulkRestoreOffers(Array.from(selectedDeletedOffers));
      toast({
        title: "Bulk Restore Complete",
        description: `Restored ${result.restored} offer(s). ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`,
      });
      setSelectedDeletedOffers(new Set());
      fetchRecycleBin();
      fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to bulk restore offers",
        variant: "destructive",
      });
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (!confirm('Are you sure you want to PERMANENTLY delete ALL offers in the recycle bin? This cannot be undone!')) {
      return;
    }

    try {
      const result = await adminOfferApi.emptyRecycleBin();
      toast({
        title: "Success",
        description: `Permanently deleted ${result.deleted_count} offer(s)`,
      });
      fetchRecycleBin();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to empty recycle bin",
        variant: "destructive",
      });
    }
  };

  const toggleDeletedOfferSelection = (offerId: string) => {
    const newSelection = new Set(selectedDeletedOffers);
    if (newSelection.has(offerId)) {
      newSelection.delete(offerId);
    } else {
      newSelection.add(offerId);
    }
    setSelectedDeletedOffers(newSelection);
  };

  const toggleSelectAllDeleted = () => {
    if (selectedDeletedOffers.size === deletedOffers.length) {
      setSelectedDeletedOffers(new Set());
    } else {
      setSelectedDeletedOffers(new Set(deletedOffers.map(o => o.offer_id)));
    }
  };

  const handleCheckAndRemoveDuplicates = async () => {
    try {
      setCheckingDuplicates(true);

      // First, check for duplicates
      const checkResult = await adminOfferApi.checkDuplicates();

      if (!checkResult.success) {
        toast({
          title: "Error",
          description: "Failed to check for duplicates",
          variant: "destructive",
        });
        return;
      }

      const { summary } = checkResult;

      if (summary.total_duplicate_groups === 0) {
        toast({
          title: "No Duplicates Found",
          description: "All offers have unique offer_ids",
        });
        return;
      }

      // Store duplicate data and open preview modal
      setDuplicateData(summary);
      setDuplicatePreviewOpen(true);

    } catch (error) {
      console.error('Duplicate check error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check duplicates",
        variant: "destructive",
      });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleConfirmRemoveDuplicates = async () => {
    try {
      setCheckingDuplicates(true);

      // Remove duplicates with selected strategy
      const removeResult = await adminOfferApi.removeDuplicates(keepStrategy);

      if (removeResult.success) {
        toast({
          title: "Duplicates Removed",
          description: `Successfully removed ${removeResult.removed} duplicate offer(s)`,
        });

        // Close modal and refresh
        setDuplicatePreviewOpen(false);
        setDuplicateData(null);
        fetchOffers();
      } else {
        toast({
          title: "Error",
          description: removeResult.errors?.[0] || "Failed to remove duplicates",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Duplicate removal error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove duplicates",
        variant: "destructive",
      });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // Carousel navigation functions
  const handleCarouselPrev = () => {
    setCarouselIndex(prev => (prev > 0 ? prev - 1 : offers.length - 1));
  };

  const handleCarouselNext = () => {
    setCarouselIndex(prev => (prev < offers.length - 1 ? prev + 1 : 0));
  };

  const openCarouselView = (index: number = 0) => {
    setCarouselIndex(index);
    setCarouselViewOpen(true);
  };

  const handleAssignRandomImages = async () => {
    try {
      setAssigningImages(true);

      // First check how many offers need images
      const countResult = await adminOfferApi.countOffersWithoutImages();
      
      if (!countResult.success) {
        toast({
          title: "Error",
          description: "Failed to check offers without images",
          variant: "destructive",
        });
        return;
      }

      if (countResult.count === 0) {
        toast({
          title: "All Good!",
          description: "All offers already have images",
        });
        return;
      }

      // Confirm with user
      if (!confirm(`Found ${countResult.count} offers without images. Assign random placeholder images to them?`)) {
        return;
      }

      // Assign images
      const result = await adminOfferApi.assignRandomImages();

      if (result.success) {
        toast({
          title: "Images Assigned",
          description: `Assigned images to ${result.updated_count} offers`,
        });
        fetchOffers();
      } else {
        toast({
          title: "Error",
          description: "Failed to assign images",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Assign images error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign images",
        variant: "destructive",
      });
    } finally {
      setAssigningImages(false);
    }
  };

  const toggleOfferSelection = (offerId: string) => {
    const newSelection = new Set(selectedOffers);
    if (newSelection.has(offerId)) {
      newSelection.delete(offerId);
    } else {
      newSelection.add(offerId);
    }
    setSelectedOffers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedOffers.size === offers.length) {
      setSelectedOffers(new Set());
    } else {
      setSelectedOffers(new Set(offers.map(o => o.offer_id)));
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
  }, [pagination.page, statusFilter, sortBy, countryFilter]);

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

  // Fetch recycle bin when tab changes
  useEffect(() => {
    if (activeTab === 'recycle-bin') {
      fetchRecycleBin();
    }
  }, [activeTab, recycleBinPagination.page]);

  // Debounced search for recycle bin
  useEffect(() => {
    if (activeTab === 'recycle-bin') {
      const delayedSearch = setTimeout(() => {
        if (recycleBinPagination.page === 1) {
          fetchRecycleBin();
        } else {
          setRecycleBinPagination(prev => ({ ...prev, page: 1 }));
        }
      }, 500);
      return () => clearTimeout(delayedSearch);
    }
  }, [recycleBinSearchTerm]);

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
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              variant="secondary"
              onClick={() => setApiImportModalOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              API Import
            </Button>
            {selectedOffers.size > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Selected ({selectedOffers.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleBulkCopyLinks}>
                      <Link className="h-4 w-4 mr-2" />
                      Copy Tracking Links Only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkCopyDetails}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Full Details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedOffers.size})
                </Button>
              </>
            )}
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
            <Button 
              variant="outline" 
              onClick={handleCheckAndRemoveDuplicates} 
              disabled={checkingDuplicates || loading}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <Trash2 className={`h-4 w-4 mr-2 ${checkingDuplicates ? 'animate-pulse' : ''}`} />
              {checkingDuplicates ? 'Checking...' : 'Remove Duplicates'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleAssignRandomImages} 
              disabled={assigningImages || loading}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <ImageIcon className={`h-4 w-4 mr-2 ${assigningImages ? 'animate-pulse' : ''}`} />
              {assigningImages ? 'Assigning...' : 'Assign Images'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => openCarouselView(0)} 
              disabled={loading || offers.length === 0}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              <Layers className="h-4 w-4 mr-2" />
              Carousel View
            </Button>
            <Button variant="outline" onClick={() => setDomainManagementModalOpen(true)}>
              <Globe className="h-4 w-4 mr-2" />
              Manage Domains
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search offers by name, campaign ID, or offer ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Sort: {
                    sortBy === 'newest' ? 'Newest' :
                    sortBy === 'oldest' ? 'Oldest' :
                    sortBy === 'id_asc' ? 'ID (A→Z)' :
                    sortBy === 'id_desc' ? 'ID (Z→A)' :
                    sortBy === 'payout_high' ? 'Payout (High)' :
                    sortBy === 'payout_low' ? 'Payout (Low)' :
                    sortBy === 'title_az' ? 'Title (A→Z)' :
                    sortBy === 'title_za' ? 'Title (Z→A)' : 'Newest'
                  }
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortBy('newest')}>
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('id_asc')}>
                  ID (A → Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('id_desc')}>
                  ID (Z → A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('payout_high')}>
                  Payout (Highest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('payout_low')}>
                  Payout (Lowest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title_az')}>
                  Title (A → Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title_za')}>
                  Title (Z → A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Globe className="h-4 w-4 mr-2" />
                  Country: {countryFilter === 'all' ? 'All' : countryFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setCountryFilter('all')}>
                  All Countries
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('US')}>🇺🇸 United States</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('GB')}>🇬🇧 United Kingdom</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('CA')}>🇨🇦 Canada</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('AU')}>🇦🇺 Australia</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('DE')}>🇩🇪 Germany</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('FR')}>🇫🇷 France</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('ES')}>🇪🇸 Spain</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('IT')}>🇮🇹 Italy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('NL')}>🇳🇱 Netherlands</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('BE')}>🇧🇪 Belgium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('AT')}>🇦🇹 Austria</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('CH')}>🇨🇭 Switzerland</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('SE')}>🇸🇪 Sweden</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('NO')}>🇳🇴 Norway</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('DK')}>🇩🇰 Denmark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('FI')}>🇫🇮 Finland</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('PL')}>🇵🇱 Poland</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('BR')}>🇧🇷 Brazil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('MX')}>🇲🇽 Mexico</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('IN')}>🇮🇳 India</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('JP')}>🇯🇵 Japan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('KR')}>🇰🇷 South Korea</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('SG')}>🇸🇬 Singapore</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('NZ')}>🇳🇿 New Zealand</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCountryFilter('ZA')}>🇿🇦 South Africa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  📁 Category: {verticalFilter === 'all' ? 'All' : verticalFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setVerticalFilter('all')}>All Categories</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Finance')}>💰 Finance</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Gaming')}>🎮 Gaming</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Dating')}>❤️ Dating</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Health')}>💊 Health</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('E-commerce')}>🛒 E-commerce</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Entertainment')}>🎬 Entertainment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Education')}>📚 Education</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Travel')}>✈️ Travel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Utilities')}>🔧 Utilities</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVerticalFilter('Lifestyle')}>🌟 Lifestyle</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Offers and Recycle Bin */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Active Offers ({pagination.total})
          </TabsTrigger>
          <TabsTrigger value="recycle-bin" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Recycle Bin ({recycleBinPagination.total})
          </TabsTrigger>
        </TabsList>

        {/* Active Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          {/* Offers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Offers ({pagination.total})</CardTitle>
              <CardDescription>
                Manage your offers with full tracking and masking capabilities
              </CardDescription>
            </CardHeader>
        <CardContent className="overflow-x-auto">
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedOffers.size === offers.length && offers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Offer ID</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Countries</TableHead>
                  <TableHead>Payout/Revenue</TableHead>
                  <TableHead>Incentive</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Hits/Limit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.offer_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOffers.has(offer.offer_id)}
                        onChange={() => toggleOfferSelection(offer.offer_id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
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
                          {offer.affiliates === 'all' || !offer.affiliates ? 'All Users' :
                            offer.affiliates === 'premium' ? 'Premium Only' : 
                            offer.affiliates === 'selected' ? 'Selected Users' : 'All Users'}
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
                    <TableCell className="text-sm">
                      {(() => {
                        const createdAt = (offer as any).created_at;
                        if (!createdAt) return 'N/A';
                        
                        const date = new Date(createdAt);
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - date.getTime());
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        
                        // Format date
                        const formattedDate = date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });
                        
                        // Show relative time for recent offers
                        if (diffDays === 0) {
                          return (
                            <div>
                              <div className="font-medium">Today</div>
                              <div className="text-xs text-muted-foreground">{formattedDate}</div>
                            </div>
                          );
                        } else if (diffDays === 1) {
                          return (
                            <div>
                              <div className="font-medium">Yesterday</div>
                              <div className="text-xs text-muted-foreground">{formattedDate}</div>
                            </div>
                          );
                        } else if (diffDays < 7) {
                          return (
                            <div>
                              <div className="font-medium">{diffDays} days ago</div>
                              <div className="text-xs text-muted-foreground">{formattedDate}</div>
                            </div>
                          );
                        } else {
                          return (
                            <div>
                              <div className="font-medium">{formattedDate}</div>
                              <div className="text-xs text-muted-foreground">
                                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          );
                        }
                      })()}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} offers
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {pagination.per_page} per page
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 20, page: 1 }))}>
                        20 per page
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 50, page: 1 }))}>
                        50 per page
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 100, page: 1 }))}>
                        100 per page
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: 200, page: 1 }))}>
                        200 per page
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPagination(prev => ({ ...prev, per_page: pagination.total, page: 1 }))}>
                        Show All ({pagination.total})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1 || loading}
                >
                  Previous
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                        disabled={loading}
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <span className="sm:hidden text-sm text-muted-foreground">
                  {pagination.page} / {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        {/* Recycle Bin Tab */}
        <TabsContent value="recycle-bin" className="space-y-4">
          {/* Recycle Bin Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Recycle Bin
                  </CardTitle>
                  <CardDescription>
                    Deleted offers can be restored or permanently removed
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDeletedOffers.size > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleBulkRestore}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore Selected ({selectedDeletedOffers.size})
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleEmptyRecycleBin}
                    disabled={deletedOffers.length === 0}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Empty Recycle Bin
                  </Button>
                  <Button variant="outline" onClick={fetchRecycleBin} disabled={recycleBinLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${recycleBinLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search deleted offers..."
                  value={recycleBinSearchTerm}
                  onChange={(e) => setRecycleBinSearchTerm(e.target.value)}
                  className="pl-10 max-w-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Recycle Bin Table */}
          <Card>
            <CardContent className="pt-6">
              {recycleBinLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading deleted offers...
                </div>
              ) : deletedOffers.length === 0 ? (
                <div className="text-center py-8">
                  <Trash2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Recycle bin is empty</p>
                  <p className="text-sm text-muted-foreground mt-1">Deleted offers will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedDeletedOffers.size === deletedOffers.length && deletedOffers.length > 0}
                          onChange={toggleSelectAllDeleted}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Offer ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Deleted At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedOffers.map((offer) => (
                      <TableRow key={offer.offer_id} className="bg-red-50/30">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedDeletedOffers.has(offer.offer_id)}
                            onChange={() => toggleDeletedOfferSelection(offer.offer_id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell>
                          {(offer.thumbnail_url || offer.image_url) ? (
                            <img
                              src={offer.thumbnail_url || offer.image_url}
                              alt={offer.name}
                              className="w-12 h-12 object-cover rounded border opacity-60"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center opacity-60">
                              <span className="text-xs text-gray-400">No Image</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-muted-foreground">
                          {offer.offer_id}
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground">{offer.name}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {offer.network}
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          {(offer as any).deleted_at ? new Date((offer as any).deleted_at).toLocaleString() : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreOffer(offer.offer_id)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePermanentDelete(offer.offer_id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete Forever
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recycle Bin Pagination */}
          {recycleBinPagination.total > recycleBinPagination.per_page && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {((recycleBinPagination.page - 1) * recycleBinPagination.per_page) + 1} to {Math.min(recycleBinPagination.page * recycleBinPagination.per_page, recycleBinPagination.total)} of {recycleBinPagination.total} deleted offers
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecycleBinPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={recycleBinPagination.page === 1 || recycleBinLoading}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, recycleBinPagination.pages) }, (_, i) => {
                        let pageNum;
                        if (recycleBinPagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (recycleBinPagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (recycleBinPagination.page >= recycleBinPagination.pages - 2) {
                          pageNum = recycleBinPagination.pages - 4 + i;
                        } else {
                          pageNum = recycleBinPagination.page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={recycleBinPagination.page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setRecycleBinPagination(prev => ({ ...prev, page: pageNum }))}
                            disabled={recycleBinLoading}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecycleBinPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={recycleBinPagination.page === recycleBinPagination.pages || recycleBinLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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

      {/* API Import Modal */}
      <ApiImportModal
        open={apiImportModalOpen}
        onOpenChange={setApiImportModalOpen}
        onImportComplete={fetchOffers}
      />

      {/* Duplicate Preview Modal */}
      <Dialog open={duplicatePreviewOpen} onOpenChange={setDuplicatePreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Duplicate Offers Found
            </DialogTitle>
            <DialogDescription>
              Review the duplicate offers below and choose which version to keep.
            </DialogDescription>
          </DialogHeader>
          
          {duplicateData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{duplicateData.total_duplicate_groups}</div>
                  <div className="text-sm text-muted-foreground">Duplicate Groups</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{duplicateData.total_duplicate_documents}</div>
                  <div className="text-sm text-muted-foreground">Total Duplicates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{duplicateData.total_documents_to_remove}</div>
                  <div className="text-sm text-muted-foreground">To Be Removed</div>
                </div>
              </div>

              {/* Keep Strategy Selection */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">Keep:</span>
                <div className="flex gap-2">
                  <Button
                    variant={keepStrategy === 'newest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setKeepStrategy('newest')}
                  >
                    Newest Version
                  </Button>
                  <Button
                    variant={keepStrategy === 'oldest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setKeepStrategy('oldest')}
                  >
                    Oldest Version
                  </Button>
                </div>
              </div>

              {/* Duplicate Groups List */}
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {duplicateData.duplicate_groups?.slice(0, 10).map((group: any, index: number) => (
                  <div key={`${group.duplicate_type}-${group.duplicate_value}-${index}`} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={group.duplicate_type === 'offer_id' ? 'text-blue-600 border-blue-300' : 'text-purple-600 border-purple-300'}
                        >
                          {group.duplicate_type === 'offer_id' ? 'By ID' : 'By Name'}
                        </Badge>
                        <span className="font-mono font-medium text-sm truncate max-w-[300px]">
                          {group.duplicate_value}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-orange-600">
                        {group.count} copies
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {group.documents?.slice(0, 3).map((doc: any, docIndex: number) => (
                        <div key={doc._id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            {docIndex === 0 && keepStrategy === 'newest' && (
                              <Badge className="bg-green-100 text-green-800 text-xs">KEEP</Badge>
                            )}
                            {docIndex === group.documents.length - 1 && keepStrategy === 'oldest' && (
                              <Badge className="bg-green-100 text-green-800 text-xs">KEEP</Badge>
                            )}
                            {!(docIndex === 0 && keepStrategy === 'newest') && 
                             !(docIndex === group.documents.length - 1 && keepStrategy === 'oldest') && (
                              <Badge className="bg-red-100 text-red-800 text-xs">DELETE</Badge>
                            )}
                            <span className="truncate max-w-[200px]">{doc.name}</span>
                            {group.duplicate_type === 'name' && (
                              <span className="text-xs text-muted-foreground font-mono">({doc.offer_id})</span>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown date'}
                          </div>
                        </div>
                      ))}
                      {group.documents?.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          +{group.documents.length - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {duplicateData.duplicate_groups?.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    +{duplicateData.duplicate_groups.length - 10} more duplicate groups...
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDuplicatePreviewOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmRemoveDuplicates}
              disabled={checkingDuplicates}
            >
              {checkingDuplicates ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove {duplicateData?.total_documents_to_remove || 0} Duplicates
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carousel View Modal */}
      <Dialog open={carouselViewOpen} onOpenChange={setCarouselViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Offer {carouselIndex + 1} of {offers.length}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCarouselPrev}
                  disabled={offers.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCarouselNext}
                  disabled={offers.length <= 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {offers[carouselIndex] && (
            <div className="space-y-4">
              {/* Offer Header */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                {(offers[carouselIndex].thumbnail_url || offers[carouselIndex].image_url) ? (
                  <img
                    src={offers[carouselIndex].thumbnail_url || offers[carouselIndex].image_url}
                    alt={offers[carouselIndex].name}
                    className="w-24 h-24 object-cover rounded border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-200 rounded border flex items-center justify-center">
                    <span className="text-xs text-gray-400">No Image</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{offers[carouselIndex].name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatusColor(offers[carouselIndex].status)}>
                      {offers[carouselIndex].status}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">
                      {offers[carouselIndex].offer_id}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 mt-2">
                    ${offers[carouselIndex].payout?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </div>

              {/* Offer Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Network</div>
                    <div className="font-medium">{offers[carouselIndex].network}</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Device Targeting</div>
                    <div className="font-medium capitalize">{offers[carouselIndex].device_targeting}</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Affiliates</div>
                    <div className="font-medium capitalize">
                      {offers[carouselIndex].affiliates === 'all' ? 'All Users' :
                       offers[carouselIndex].affiliates === 'premium' ? 'Premium Only' : 
                       offers[carouselIndex].affiliates === 'selected' ? 'Selected Users' : 'All Users'}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Countries</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offers[carouselIndex].countries?.slice(0, 6).map((country) => (
                        <Badge key={country} variant="outline" className="text-xs">
                          {country}
                        </Badge>
                      ))}
                      {(offers[carouselIndex].countries?.length || 0) > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{offers[carouselIndex].countries.length - 6}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Hits / Limit</div>
                    <div className="font-medium">
                      {offers[carouselIndex].hits?.toLocaleString() || 0} / {offers[carouselIndex].limit?.toLocaleString() || '∞'}
                    </div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {offers[carouselIndex].created_at 
                        ? new Date(offers[carouselIndex].created_at).toLocaleDateString() 
                        : 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {offers[carouselIndex].description && (
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground mb-1">Description</div>
                  <div className="text-sm">{offers[carouselIndex].description}</div>
                </div>
              )}

              {/* Target URL */}
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground mb-1">Target URL</div>
                <div className="font-mono text-sm break-all">{offers[carouselIndex].target_url}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button onClick={() => handleEditOffer(offers[carouselIndex])}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" onClick={() => handleViewDetails(offers[carouselIndex])}>
                  <Eye className="h-4 w-4 mr-2" />
                  Full Details
                </Button>
                <Button variant="outline" onClick={() => handleCloneOffer(offers[carouselIndex].offer_id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </Button>
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    handleDeleteOffer(offers[carouselIndex].offer_id);
                    setCarouselViewOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminOffersWithGuard = () => (
  <AdminPageGuard requiredTab="offers">
    <AdminOffers />
  </AdminPageGuard>
);

export default AdminOffersWithGuard;

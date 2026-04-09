import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Eye,
  Download,
  Search,
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  Activity,
  Play,
  Pause,
  SkipForward,
  Timer,
  Zap,
  FileSpreadsheet,
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
import { adminOfferApi, Offer, RunningOffer, RotationStatus } from '@/services/adminOfferApi';
import { useToast } from '@/hooks/use-toast';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOfferImage } from '@/utils/categoryImages';
import ActionsDropdown from '@/components/ActionsDropdown';
import FilterPanel from '@/components/FilterPanel';
import HealthIcon from '@/components/HealthIcon';
import HealthPopup from '@/components/HealthPopup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const AdminOffers = () => {
  const { toast } = useToast();
  const [deletedOffers, setDeletedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [recycleBinSearchTerm, setRecycleBinSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('offers');
  const [offersSubView, setOffersSubView] = useState<'all' | 'running'>('all');
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
  const [duplicateRemovalProgress, setDuplicateRemovalProgress] = useState<{current: number, total: number} | null>(null);
  const [assigningImages, setAssigningImages] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [duplicatePreviewOpen, setDuplicatePreviewOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [keepStrategy, setKeepStrategy] = useState<'newest' | 'oldest'>('newest');
  const [carouselViewOpen, setCarouselViewOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedCategories, setSelectedCategories] = useState<string>('all');
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'range'>('all');
  const [exportStart, setExportStart] = useState(0);
  const [exportEnd, setExportEnd] = useState(100);
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [networks, setNetworks] = useState<string[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [healthPopupOffer, setHealthPopupOffer] = useState<Offer | null>(null);
  const [rawOffers, setRawOffers] = useState<Offer[]>([]);

  // Rotation state
  const [rotationStatus, setRotationStatus] = useState<RotationStatus | null>(null);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationActionLoading, setRotationActionLoading] = useState(false);
  const [editBatchSize, setEditBatchSize] = useState<string>('1000');
  const [editWindowMinutes, setEditWindowMinutes] = useState<string>('420');
  const [rotationCountdown, setRotationCountdown] = useState<string>('');

  // Running offers state
  const [runningOffers, setRunningOffers] = useState<RunningOffer[]>([]);
  const [runningLoading, setRunningLoading] = useState(false);
  const [runningSearchTerm, setRunningSearchTerm] = useState('');
  const [runningPagination, setRunningPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 0 });
  const [runningWarningOpen, setRunningWarningOpen] = useState(false);
  const [simpleDeleteConfirmOpen, setSimpleDeleteConfirmOpen] = useState(false);
  const [simpleBulkDeleteConfirmOpen, setSimpleBulkDeleteConfirmOpen] = useState(false);
  const [deleteCheckFailed, setDeleteCheckFailed] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const [pendingDeleteRunningDetail, setPendingDeleteRunningDetail] = useState<{ offer_id: string; name: string; total_clicks: number; days_remaining: number; sub_statuses: string[] } | null>(null);
  const [runningSubcategory, setRunningSubcategory] = useState<string>('all');
  const [runningStatusFilter, setRunningStatusFilter] = useState<string>('all');
  const [runningCategoryFilter, setRunningCategoryFilter] = useState<string>('all');
  const [runningCountryFilter, setRunningCountryFilter] = useState<string>('all');
  const [runningNetworkFilter, setRunningNetworkFilter] = useState<string>('all');
  const [runningSortBy, setRunningSortBy] = useState<string>('newest');
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const [selectedRunningOffers, setSelectedRunningOffers] = useState<Set<string>>(new Set());
  const [bulkDeleteWarningOpen, setBulkDeleteWarningOpen] = useState(false);
  const [bulkDeleteRunningDetails, setBulkDeleteRunningDetails] = useState<Array<{ offer_id: string; name: string; total_clicks: number; days_remaining: number; sub_statuses: string[] }>>([]);
  const [bulkDeleteNonRunningIds, setBulkDeleteNonRunningIds] = useState<string[]>([]);
  // Category definitions for multi-select filter
  const CATEGORIES = [
    { id: 'all', name: 'All', icon: '🎯' },
    { id: 'HEALTH', name: 'Health', icon: '💊' },
    { id: 'SURVEY', name: 'Survey', icon: '📋' },
    { id: 'SWEEPSTAKES', name: 'Sweepstakes', icon: '🎰' },
    { id: 'EDUCATION', name: 'Education', icon: '📚' },
    { id: 'INSURANCE', name: 'Insurance', icon: '🛡️' },
    { id: 'LOAN', name: 'Loan', icon: '💳' },
    { id: 'FINANCE', name: 'Finance', icon: '💰' },
    { id: 'DATING', name: 'Dating', icon: '❤️' },
    { id: 'FREE_TRIAL', name: 'Free Trial', icon: '🎁' },
    { id: 'INSTALLS', name: 'Installs', icon: '📲' },
    { id: 'GAMES_INSTALL', name: 'Games', icon: '🎮' },
    { id: 'OTHER', name: 'Other', icon: '📦' },
  ];

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

  const fetchOffers = async (overridePage?: number) => {
    try {
      setLoading(true);
      const params = {
        page: overridePage ?? pagination.page,
        per_page: pagination.per_page,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(sortBy && { sort: sortBy }),
        ...(countryFilter !== 'all' && { country: countryFilter }),
        ...(networkFilter !== 'all' && { network: networkFilter })
      };

      const response = await adminOfferApi.getOffers(params);
      
      // Apply sorting
      let sortedOffers = [...response.offers];
      switch (sortBy) {
        case 'id_asc':
          sortedOffers.sort((a, b) => (a.offer_id || '').localeCompare(b.offer_id || ''));
          break;
        case 'id_desc':
          sortedOffers.sort((a, b) => (b.offer_id || '').localeCompare(a.offer_id || ''));
          break;
        case 'payout_high':
          sortedOffers.sort((a, b) => (b.payout || 0) - (a.payout || 0));
          break;
        case 'payout_low':
          sortedOffers.sort((a, b) => (a.payout || 0) - (b.payout || 0));
          break;
        case 'title_az':
          sortedOffers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'title_za':
          sortedOffers.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
        case 'newest':
          sortedOffers.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          break;
        case 'oldest':
          sortedOffers.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
          break;
      }
      
      setRawOffers(sortedOffers);
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

  // Category mappings for client-side filtering
  const categoryMappings: Record<string, string[]> = {
    'HEALTH': ['HEALTH', 'HEALTHCARE', 'MEDICAL'],
    'SURVEY': ['SURVEY', 'SURVEYS'],
    'SWEEPSTAKES': ['SWEEPSTAKES', 'SWEEPS', 'GIVEAWAY', 'PRIZE', 'LOTTERY', 'RAFFLE', 'CONTEST'],
    'EDUCATION': ['EDUCATION', 'LEARNING'],
    'INSURANCE': ['INSURANCE'],
    'LOAN': ['LOAN', 'LOANS', 'LENDING'],
    'FINANCE': ['FINANCE', 'FINANCIAL'],
    'DATING': ['DATING', 'RELATIONSHIPS'],
    'FREE_TRIAL': ['FREE_TRIAL', 'FREETRIAL', 'TRIAL'],
    'INSTALLS': ['INSTALLS', 'INSTALL', 'APP', 'APPS'],
    'GAMES_INSTALL': ['GAMES_INSTALL', 'GAMESINSTALL', 'GAME', 'GAMES', 'GAMING'],
    'OTHER': ['OTHER', 'LIFESTYLE', 'ENTERTAINMENT', 'TRAVEL', 'UTILITIES', 'E-COMMERCE', 'ECOMMERCE', 'SHOPPING', 'VIDEO', 'SIGNUP', 'GENERAL']
  };

  // Client-side filtering via useMemo — no re-fetch needed
  const offers = useMemo(() => {
    let filtered = [...rawOffers];

    // Apply category filter
    if (selectedCategories !== 'all') {
      filtered = filtered.filter(offer => {
        const offerVertical = (offer.vertical || offer.category || '').toUpperCase();
        const catUpper = selectedCategories.toUpperCase();
        const matching = categoryMappings[catUpper] || [catUpper];
        return matching.includes(offerVertical);
      });
    }

    // Apply health filter
    if (healthFilter !== 'all') {
      if (healthFilter === 'healthy') {
        filtered = filtered.filter(o => o.health?.status === 'healthy');
      } else if (healthFilter === 'unhealthy') {
        filtered = filtered.filter(o => (o.health?.status || 'unhealthy') === 'unhealthy');
      } else {
        // Specific criterion filters (no_image, no_partner, etc.)
        const criterionMap: Record<string, string> = {
          no_tracking_url: 'tracking_url',
          no_upward_partner: 'upward_partner',
          no_image: 'image',
          no_country: 'country',
          no_payout: 'payout',
          no_payout_model: 'payout_model',
        };
        const criterion = criterionMap[healthFilter];
        if (criterion) {
          filtered = filtered.filter(o => {
            const failures = o.health?.failures || [];
            return failures.some((f: { criterion: string }) => f.criterion === criterion);
          });
        }
      }
    }

    return filtered;
  }, [rawOffers, selectedCategories, healthFilter]);

  const handleDeleteOffer = async (offerId: string, offerName?: string) => {
    // Check if this offer is running before deleting
    try {
      const { running_ids, running_details } = await adminOfferApi.checkRunningOffers([offerId]);
      if (running_ids.includes(offerId)) {
        setPendingDeleteId(offerId);
        setPendingDeleteName(offerName || offerId);
        const detail = (running_details || []).find(d => d.offer_id === offerId);
        setPendingDeleteRunningDetail(detail || null);
        setRunningWarningOpen(true);
        return;
      }
    } catch (err) {
      // API check failed — show a simple confirmation dialog with amber warning
      console.warn('Running offer check failed:', err);
      setPendingDeleteId(offerId);
      setPendingDeleteName(offerName || offerId);
      setPendingDeleteRunningDetail(null);
      setDeleteCheckFailed(true);
      setSimpleDeleteConfirmOpen(true);
      return;
    }
    // Not running — show a clean confirmation (no amber warning)
    setPendingDeleteId(offerId);
    setPendingDeleteName(offerName || offerId);
    setPendingDeleteRunningDetail(null);
    setDeleteCheckFailed(false);
    setSimpleDeleteConfirmOpen(true);
  };

  const executeDelete = async (offerId: string) => {
    try {
      await adminOfferApi.deleteOffer(offerId);
      toast({ title: "Success", description: "Offer moved to recycle bin" });
      const remainingOnPage = offers.length - 1;
      if (remainingOnPage === 0 && pagination.page > 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchOffers(1);
      } else {
        fetchOffers();
      }
      if (activeTab === 'offers' && offersSubView === 'running') fetchRunningOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete offer",
        variant: "destructive",
      });
    }
  };

  const confirmRunningDelete = async () => {
    if (pendingDeleteId) await executeDelete(pendingDeleteId);
    setRunningWarningOpen(false);
    setPendingDeleteId(null);
    setPendingDeleteName('');
    setPendingDeleteRunningDetail(null);
  };

  const confirmSimpleDelete = async () => {
    if (pendingDeleteId) await executeDelete(pendingDeleteId);
    setSimpleDeleteConfirmOpen(false);
    setPendingDeleteId(null);
    setPendingDeleteName('');
  };

  const confirmSimpleBulkDelete = async () => {
    setSimpleBulkDeleteConfirmOpen(false);
    setBulkDeleting(true);
    try {
      const result = await adminOfferApi.bulkDeleteOffers(Array.from(selectedOffers));
      toast({
        title: "Bulk Delete Complete",
        description: `Moved ${result.deleted} offer(s) to recycle bin. ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`,
      });
      setSelectedOffers(new Set());
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOffers(1);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to bulk delete offers",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const fetchRunningOffers = async (pageOverride?: number) => {
    setRunningLoading(true);
    try {
      const res = await adminOfferApi.getRunningOffers({
        page: pageOverride || runningPagination.page,
        per_page: runningPagination.per_page,
        search: runningSearchTerm,
        subcategory: runningSubcategory,
        status: runningStatusFilter,
        category: runningCategoryFilter,
        country: runningCountryFilter,
        network: runningNetworkFilter,
        sort: runningSortBy,
      });
      setRunningOffers(res.offers);
      setSubcategoryCounts(res.subcategory_counts || {});
      setRunningPagination(prev => ({ ...prev, ...res.pagination }));
    } catch {
      toast({ title: "Error", description: "Failed to load running offers", variant: "destructive" });
    } finally {
      setRunningLoading(false);
    }
  };

  const handleRunningBulkDelete = async () => {
    if (selectedRunningOffers.size === 0) {
      toast({ title: "No Selection", description: "Please select offers to delete", variant: "destructive" });
      return;
    }
    // Check which selected offers are running
    try {
      setBulkDeleting(true);
      const ids = Array.from(selectedRunningOffers);
      const { running_ids, running_details } = await adminOfferApi.checkRunningOffers(ids);
      const nonRunning = ids.filter(id => !running_ids.includes(id));
      if (running_ids.length > 0) {
        setBulkDeleteRunningDetails(running_details || []);
        setBulkDeleteNonRunningIds(nonRunning);
        setBulkDeleteWarningOpen(true);
        setBulkDeleting(false);
        return;
      }
      // No running offers, proceed with delete
      const result = await adminOfferApi.bulkDeleteOffers(ids);
      toast({ title: "Bulk Delete Complete", description: `Moved ${result.deleted} offer(s) to recycle bin` });
      setSelectedRunningOffers(new Set());
      fetchRunningOffers(1);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to bulk delete", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const executeBulkDeleteSkipRunning = async () => {
    // Delete only non-running offers
    setBulkDeleteWarningOpen(false);
    if (bulkDeleteNonRunningIds.length === 0) {
      toast({ title: "Skipped", description: "All selected offers are running. Nothing deleted." });
      return;
    }
    setBulkDeleting(true);
    try {
      const result = await adminOfferApi.bulkDeleteOffers(bulkDeleteNonRunningIds);
      toast({ title: "Bulk Delete Complete", description: `Moved ${result.deleted} non-running offer(s) to recycle bin. Skipped ${bulkDeleteRunningDetails.length} running offer(s).` });
      setSelectedRunningOffers(new Set());
      setSelectedOffers(new Set());
      if (offersSubView === 'running') fetchRunningOffers(1);
      else { setPagination(prev => ({ ...prev, page: 1 })); fetchOffers(1); }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const executeBulkDeleteAll = async () => {
    // Delete all including running
    setBulkDeleteWarningOpen(false);
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedRunningOffers.size > 0 ? selectedRunningOffers : selectedOffers);
      const result = await adminOfferApi.bulkDeleteOffers(ids);
      toast({ title: "Bulk Delete Complete", description: `Moved ${result.deleted} offer(s) to recycle bin (including running offers)` });
      setSelectedRunningOffers(new Set());
      setSelectedOffers(new Set());
      if (offersSubView === 'running') fetchRunningOffers(1);
      else { setPagination(prev => ({ ...prev, page: 1 })); fetchOffers(1); }
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleRunningOfferSelection = (offerId: string) => {
    const newSet = new Set(selectedRunningOffers);
    if (newSet.has(offerId)) newSet.delete(offerId);
    else newSet.add(offerId);
    setSelectedRunningOffers(newSet);
  };

  const toggleSelectAllRunning = () => {
    if (selectedRunningOffers.size === runningOffers.length) {
      setSelectedRunningOffers(new Set());
    } else {
      setSelectedRunningOffers(new Set(runningOffers.map(o => o.offer_id)));
    }
  };

  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case 'searched': return 'bg-blue-100 text-blue-800';
      case 'picked': return 'bg-purple-100 text-purple-800';
      case 'requested': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'has_clicks': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
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

    // Check for running offers before deleting
    try {
      setBulkDeleting(true);
      const ids = Array.from(selectedOffers);
      const { running_ids, running_details } = await adminOfferApi.checkRunningOffers(ids);
      if (running_ids.length > 0) {
        const nonRunning = ids.filter(id => !running_ids.includes(id));
        setBulkDeleteRunningDetails(running_details || []);
        setBulkDeleteNonRunningIds(nonRunning);
        // Temporarily store selected offers in running set for the dialog actions
        setSelectedRunningOffers(selectedOffers);
        setBulkDeleteWarningOpen(true);
        setBulkDeleting(false);
        return;
      }
    } catch (err) {
      // If check fails, show a simple confirmation with amber warning
      console.warn('Running offer check failed:', err);
      setBulkDeleting(false);
      setDeleteCheckFailed(true);
      setSimpleBulkDeleteConfirmOpen(true);
      return;
    }

    // No running offers found — show clean confirmation
    setBulkDeleting(false);
    setDeleteCheckFailed(false);
    setSimpleBulkDeleteConfirmOpen(true);
  };

  // Get tracking base URL - uses offers subdomain in production
  const getTrackingBaseUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
        return 'https://offers.moustacheleads.com';
      }
    }
    return 'http://localhost:5000';
  };

  // Generate tracking link for an offer
  const generateTrackingLink = (offer: Offer) => {
    const baseUrl = getTrackingBaseUrl();
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

    setBulkDeleting(true);
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
    } finally {
      setBulkDeleting(false);
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

  const handleClearAllOffers = async () => {
    if (!confirm(`Are you sure you want to move ALL ${pagination.total} offers to the recycle bin?`)) {
      return;
    }
    if (!confirm('This will move EVERY offer to the recycle bin. Are you absolutely sure?')) {
      return;
    }

    try {
      setLoading(true);
      const result = await adminOfferApi.clearAllOffers();
      toast({
        title: "Success",
        description: `Moved ${result.moved_count} offer(s) to recycle bin`,
      });
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchOffers(1);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear offers",
        variant: "destructive",
      });
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    // Use the correct selection based on which sub-view is active
    const isRunningView = offersSubView === 'running';
    const ids = Array.from(isRunningView ? selectedRunningOffers : selectedOffers);

    if (ids.length === 0) {
      toast({ title: "No Selection", description: "Please select offers first", variant: "destructive" });
      return;
    }

    if (!confirm(`Change status of ${ids.length} selected offer(s) to "${newStatus}"?`)) return;

    try {
      const result = await adminOfferApi.bulkUpdateStatus(newStatus, ids);
      toast({
        title: "Success",
        description: `Updated ${result.updated_count} offer(s) to ${newStatus}`,
      });
      if (isRunningView) {
        setSelectedRunningOffers(new Set());
        fetchRunningOffers();
      } else {
        setSelectedOffers(new Set());
        fetchOffers();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleBulkPriceUpdate = async () => {
    const isRunningView = offersSubView === 'running';
    const ids = Array.from(isRunningView ? selectedRunningOffers : selectedOffers);

    if (ids.length === 0) {
      toast({ title: "No Selection", description: "Please select offers first", variant: "destructive" });
      return;
    }

    const price = prompt(`Enter new payout amount for ${ids.length} selected offer(s):`);
    if (price === null) return;
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast({ title: "Invalid Price", description: "Please enter a valid positive number", variant: "destructive" });
      return;
    }

    try {
      const result = await adminOfferApi.bulkUpdatePayout(numPrice, ids);
      toast({
        title: "Success",
        description: `Updated payouts for ${result.updated_count} offer(s)`,
      });
      if (isRunningView) fetchRunningOffers();
      else fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payouts",
        variant: "destructive",
      });
    }
  };

  const handleBulkPin = async (isPinned: boolean) => {
    const isRunningView = offersSubView === 'running';
    const ids = Array.from(isRunningView ? selectedRunningOffers : selectedOffers);

    if (ids.length === 0) {
      toast({ title: "No Selection", description: "Please select offers first", variant: "destructive" });
      return;
    }

    const action = isPinned ? 'Pin to top' : 'Unpin';
    if (!confirm(`${action} for ${ids.length} selected offer(s)?`)) return;

    try {
      const result = await adminOfferApi.bulkPinOffers(isPinned, ids);
      toast({
        title: "Success",
        description: `${isPinned ? 'Pinned' : 'Unpinned'} ${result.updated_count} offer(s)`,
      });
      if (isRunningView) fetchRunningOffers();
      else fetchOffers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update pinning status",
        variant: "destructive",
      });
    }
  };

  // Export running offers to CSV
  const handleRunningOffersExport = async () => {
    try {
      setRunningLoading(true);
      // Fetch all running offers (up to 1000) with current filters
      const res = await adminOfferApi.getRunningOffers({
        page: 1,
        per_page: 1000,
        search: runningSearchTerm || undefined,
        subcategory: runningSubcategory,
        status: runningStatusFilter === 'all' ? undefined : runningStatusFilter,
        category: runningCategoryFilter === 'all' ? undefined : runningCategoryFilter,
        country: runningCountryFilter === 'all' ? undefined : runningCountryFilter,
        network: runningNetworkFilter === 'all' ? undefined : runningNetworkFilter,
        sort: runningSortBy,
      });

      if (!res.offers || res.offers.length === 0) {
        toast({ title: "No Data", description: "No running offers found to export", variant: "destructive" });
        return;
      }

      const csvData = res.offers.map(offer => ({
        'Offer ID': offer.offer_id,
        'Name': offer.name,
        'Status': offer.status,
        'Category': offer.category || offer.vertical || '',
        'Network': offer.network || '',
        'Payout': `$${offer.payout?.toFixed(2) || '0.00'}`,
        'Countries': Array.isArray(offer.countries) ? offer.countries.join(', ') : '',
        'Total Clicks': offer.total_clicks || 0,
        'Sub Statuses': (offer.sub_statuses || []).join(', '),
        'When Active': offer.when_active ? new Date(offer.when_active).toLocaleDateString() : '',
        'When Expired': offer.when_expired ? new Date(offer.when_expired).toLocaleDateString() : '',
        'Days Remaining': offer.days_remaining ?? '',
        'Target URL': offer.target_url || '',
      }));

      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row =>
          headers.map(header => {
            const value = String(row[header as keyof typeof row] || '');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `running-offers-export-${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Export Successful", description: `Exported ${csvData.length} running offers` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to export running offers", variant: "destructive" });
    } finally {
      setRunningLoading(false);
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
      
      // Show initial progress
      const totalToRemove = duplicateData?.total_documents_to_remove || 0;
      if (totalToRemove > 0) {
        setDuplicateRemovalProgress({ current: 0, total: totalToRemove });
      }

      // Simulate progress animation while removal is happening
      const progressInterval = setInterval(() => {
        setDuplicateRemovalProgress(prev => {
          if (!prev) return null;
          // Gradually increase progress up to 90% while waiting for backend
          const newCurrent = Math.min(prev.current + Math.ceil(prev.total * 0.05), Math.floor(prev.total * 0.9));
          return { current: newCurrent, total: prev.total };
        });
      }, 300); // Update every 300ms

      // Remove duplicates with selected strategy
      const removeResult = await adminOfferApi.removeDuplicates(keepStrategy);

      // Clear the progress interval
      clearInterval(progressInterval);

      if (removeResult.success) {
        // Update progress to complete
        setDuplicateRemovalProgress({ current: removeResult.removed, total: totalToRemove });
        
        toast({
          title: "Duplicates Removed",
          description: `Successfully removed ${removeResult.removed} duplicate offer(s)`,
        });

        // Close modal and refresh after a brief delay to show completion
        setTimeout(() => {
          setDuplicatePreviewOpen(false);
          setDuplicateData(null);
          setDuplicateRemovalProgress(null);
          fetchOffers();
        }, 1500);
      } else {
        setDuplicateRemovalProgress(null);
        toast({
          title: "Error",
          description: removeResult.errors?.[0] || "Failed to remove duplicates",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Duplicate removal error:', error);
      setDuplicateRemovalProgress(null);
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

  const handleSelectUpTo200 = async () => {
    try {
      // Fetch up to 200 offers
      const response = await adminOfferApi.getOffers({
        page: 1,
        per_page: 200,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined,
        sort: sortBy,
        country: countryFilter === 'all' ? undefined : countryFilter,
        categories: selectedCategories === 'all' ? undefined : selectedCategories
      });

      const offerIds = response.offers.map((o: Offer) => o.offer_id);
      setSelectedOffers(new Set(offerIds));
      
      toast({
        title: "Selection Updated",
        description: `Selected ${offerIds.length} offers`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select offers",
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

      // Use the new export API with flexible range
      const exportResponse = await adminOfferApi.exportOffers({
        export_type: exportType,
        start: exportType === 'range' ? exportStart : undefined,
        end: exportType === 'range' ? exportEnd : undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined
      });

      if (!exportResponse.offers || exportResponse.offers.length === 0) {
        toast({
          title: "No Data",
          description: "No offers found to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare CSV data with comprehensive fields
      const csvData = exportResponse.offers.map(offer => ({
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
  }, [pagination.page, pagination.per_page, statusFilter, sortBy, countryFilter, networkFilter]);

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
  }, [activeTab, recycleBinPagination.page, recycleBinPagination.per_page]);

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

  // Fetch running offers when sub-view changes
  useEffect(() => {
    if (offersSubView === 'running') {
      fetchRunningOffers();
    }
  }, [offersSubView, runningPagination.page, runningPagination.per_page, runningSubcategory, runningStatusFilter, runningCategoryFilter, runningCountryFilter, runningNetworkFilter, runningSortBy]);

  // Debounced search for running offers
  useEffect(() => {
    if (offersSubView === 'running') {
      const delayedSearch = setTimeout(() => {
        if (runningPagination.page === 1) {
          fetchRunningOffers();
        } else {
          setRunningPagination(prev => ({ ...prev, page: 1 }));
        }
      }, 500);
      return () => clearTimeout(delayedSearch);
    }
  }, [runningSearchTerm]);

  // Pre-fetch running offers count for the dropdown
  useEffect(() => {
    const fetchRunningCount = async () => {
      try {
        const res = await adminOfferApi.getRunningOffers({ page: 1, per_page: 1, subcategory: 'all' });
        setRunningPagination(prev => ({ ...prev, total: res.pagination.total }));
        setSubcategoryCounts(res.subcategory_counts || {});
      } catch { /* silent */ }
    };
    if (offersSubView !== 'running') fetchRunningCount();
  }, []);

  // Fetch networks on mount
  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const result = await adminOfferApi.getNetworks();
        setNetworks(result.networks || []);
      } catch (error) {
        console.error('Failed to fetch networks:', error);
        setNetworks([]);
      }
    };
    fetchNetworks();
  }, []);

  // ---- Rotation helpers ----
  const fetchRotationStatus = async () => {
    setRotationLoading(true);
    try {
      const status = await adminOfferApi.getRotationStatus();
      setRotationStatus(status);
      setEditBatchSize(String(status.batch_size));
      setEditWindowMinutes(String(status.window_minutes));
    } catch {
      toast({ title: 'Error', description: 'Failed to load rotation status', variant: 'destructive' });
    } finally {
      setRotationLoading(false);
    }
  };

  const handleRotationToggle = async () => {
    setRotationActionLoading(true);
    try {
      const result = rotationStatus?.enabled
        ? await adminOfferApi.disableRotation()
        : await adminOfferApi.enableRotation();
      setRotationStatus(result);
      toast({ title: 'Success', description: result.message });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setRotationActionLoading(false);
    }
  };

  const handleRotationConfigSave = async () => {
    setRotationActionLoading(true);
    try {
      const result = await adminOfferApi.updateRotationConfig({
        batch_size: parseInt(editBatchSize) || 1000,
        window_minutes: parseInt(editWindowMinutes) || 420,
      });
      setRotationStatus(result);
      toast({ title: 'Success', description: 'Rotation config updated' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setRotationActionLoading(false);
    }
  };

  const handleForceRotation = async () => {
    setRotationActionLoading(true);
    try {
      const result = await adminOfferApi.forceRotation();
      if ('error' in result) {
        toast({ title: 'Error', description: (result as any).error, variant: 'destructive' });
      } else {
        setRotationStatus(result);
        toast({ title: 'Success', description: 'Rotation forced — new batch activated' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setRotationActionLoading(false);
    }
  };

  const handleResetRotation = async () => {
    setRotationActionLoading(true);
    try {
      const result = await adminOfferApi.resetRotation();
      setRotationStatus(result);
      toast({ title: 'Success', description: 'Rotation reset' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setRotationActionLoading(false);
    }
  };

  // Fetch rotation status when tab switches to rotation
  useEffect(() => {
    if (activeTab === 'rotation') {
      fetchRotationStatus();
    }
  }, [activeTab]);

  // Countdown timer for rotation
  useEffect(() => {
    if (activeTab !== 'rotation' || !rotationStatus?.enabled || !rotationStatus?.time_remaining_seconds) {
      setRotationCountdown('');
      return;
    }
    let remaining = rotationStatus.time_remaining_seconds;
    const tick = () => {
      if (remaining <= 0) {
        setRotationCountdown('Rotating...');
        fetchRotationStatus();
        return;
      }
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = Math.floor(remaining % 60);
      setRotationCountdown(`${h}h ${m}m ${s}s`);
      remaining -= 1;
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTab, rotationStatus?.enabled, rotationStatus?.time_remaining_seconds]);

  return (
    <div className="space-y-4 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Offers Management</h2>
          <p className="text-muted-foreground text-sm">
            Create, manage, and track your offers with advanced masking and analytics.
          </p>
        </div>
      </div>

      {/* Compact Toolbar */}
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search offers by name, campaign ID, or offer ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter icon button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setFilterPanelOpen((prev) => !prev)}
                className="relative shrink-0"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {(statusFilter !== 'all' || selectedCategories !== 'all' || sortBy !== 'newest' || countryFilter !== 'all' || networkFilter !== 'all' || healthFilter !== 'all') && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filters</TooltipContent>
          </Tooltip>

          {/* Selected offers actions (shown when offers are selected) */}
          {selectedOffers.size > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy ({selectedOffers.size})
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Settings className="h-4 w-4 mr-2" />
                    Status ({selectedOffers.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('active')}>
                    <span className="mr-2">🟢</span> Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('pending')}>
                    <span className="mr-2">🟡</span> Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('inactive')}>
                    <span className="mr-2">⚫</span> Inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('paused')}>
                    <span className="mr-2">⏸️</span> Paused
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange('hidden')}>
                    <span className="mr-2">👁️</span> Hidden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Zap className="h-4 w-4 mr-2" />
                    Actions ({selectedOffers.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleBulkPriceUpdate}>
                    <span className="mr-2">💰</span> Increase Price
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPin(true)}>
                    <span className="mr-2">📌</span> Pin to Top
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkPin(false)}>
                    <span className="mr-2">❌</span> Unpin
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="shrink-0"
              >
                {bulkDeleting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {bulkDeleting ? `Deleting...` : `Delete (${selectedOffers.size})`}
              </Button>
            </>
          )}

          {/* Actions dropdown */}
          <ActionsDropdown
            onCreateOffer={() => setAddOfferModalOpen(true)}
            onBulkUpload={() => setBulkUploadModalOpen(true)}
            onApiImport={() => setApiImportModalOpen(true)}
            onClone={() => {}}
            onClear={handleClearAllOffers}
            onPreview={() => {}}
            onExportCsv={() => setExportModalOpen(true)}
            onRefresh={() => fetchOffers()}
            onRemoveDuplicates={handleCheckAndRemoveDuplicates}
            onAssignImages={handleAssignRandomImages}
            onCarouselView={() => openCarouselView(0)}
            onManageDomains={() => setDomainManagementModalOpen(true)}
          />
        </div>
      </TooltipProvider>

      {/* Collapsible Filter Panel - only show for main offers view, not running offers */}
      {offersSubView !== 'running' && (
      <FilterPanel
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        categoryFilter={selectedCategories}
        onCategoryChange={setSelectedCategories}
        sortBy={sortBy}
        onSortChange={setSortBy}
        countryFilter={countryFilter}
        onCountryChange={setCountryFilter}
        networkFilter={networkFilter}
        onNetworkChange={setNetworkFilter}
        healthFilter={healthFilter}
        onHealthChange={setHealthFilter}
        networks={networks}
        open={filterPanelOpen}
      />
      )}

      {/* Tabs for Offers and Recycle Bin */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'offers') setOffersSubView('all'); }} className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="offers" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {offersSubView === 'running' ? `Running Offers (${runningPagination.total})` : `Active Offers (${pagination.total})`}
            </TabsTrigger>
            <TabsTrigger value="recycle-bin" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Recycle Bin ({recycleBinPagination.total})
            </TabsTrigger>
            <TabsTrigger value="rotation" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Rotation {rotationStatus?.enabled ? '🟢' : '⚪'}
            </TabsTrigger>
          </TabsList>
          {activeTab === 'offers' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-9">
                  <Activity className="h-4 w-4" />
                  {offersSubView === 'all' ? 'All Offers' : 'Running Offers'}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setOffersSubView('all')} className={offersSubView === 'all' ? 'bg-accent' : ''}>
                  <Globe className="h-4 w-4 mr-2" />
                  All Offers ({pagination.total})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setOffersSubView('running'); fetchRunningOffers(1); }} className={offersSubView === 'running' ? 'bg-accent' : ''}>
                  <Activity className="h-4 w-4 mr-2 text-green-500" />
                  Running Offers ({runningPagination.total})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Active Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          {offersSubView === 'running' ? (
          /* Running Offers Sub-View */
          <div className="space-y-4">
            {/* Search + Subcategory Dropdown + Filter + Bulk Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Subcategory Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-9 shrink-0">
                    <Activity className="h-4 w-4 text-green-500" />
                    {runningSubcategory === 'all' ? 'All' : runningSubcategory === 'has_clicks' ? 'Has Clicks' : runningSubcategory.charAt(0).toUpperCase() + runningSubcategory.slice(1)} ({subcategoryCounts[runningSubcategory] || 0})
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {[
                    { key: 'all', label: 'All', icon: '📊' },
                    { key: 'picked', label: 'Picked', icon: '👆' },
                    { key: 'requested', label: 'Requested', icon: '📩' },
                    { key: 'approved', label: 'Approved', icon: '✅' },
                    { key: 'rejected', label: 'Rejected', icon: '❌' },
                    { key: 'has_clicks', label: 'Has Clicks', icon: '🖱️' },
                  ].map(sub => (
                    <DropdownMenuItem
                      key={sub.key}
                      onClick={() => { setRunningSubcategory(sub.key); setRunningPagination(p => ({ ...p, page: 1 })); setSelectedRunningOffers(new Set()); }}
                      className={runningSubcategory === sub.key ? 'bg-accent' : ''}
                    >
                      <span className="mr-2">{sub.icon}</span>
                      {sub.label}
                      <span className="ml-auto text-xs text-muted-foreground">{subcategoryCounts[sub.key] || 0}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input placeholder="Search running offers..." value={runningSearchTerm} onChange={e => setRunningSearchTerm(e.target.value)} className="pl-10" />
              </div>

              {selectedRunningOffers.size > 0 && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0">
                        <Settings className="h-4 w-4 mr-2" />
                        Status ({selectedRunningOffers.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('active')}>
                        <span className="mr-2">🟢</span> Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('inactive')}>
                        <span className="mr-2">⚫</span> Inactive
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('paused')}>
                        <span className="mr-2">⏸️</span> Paused
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('hidden')}>
                        <span className="mr-2">👁️</span> Hidden
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0">
                        <Zap className="h-4 w-4 mr-2" />
                        Actions ({selectedRunningOffers.size})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={handleBulkPriceUpdate}>
                        <span className="mr-2">💰</span> Increase Price
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkPin(true)}>
                        <span className="mr-2">📌</span> Pin to Top
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkPin(false)}>
                        <span className="mr-2">❌</span> Unpin
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" size="sm" onClick={handleRunningBulkDelete} disabled={bulkDeleting} className="shrink-0">
                    {bulkDeleting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {bulkDeleting ? 'Deleting...' : `Delete (${selectedRunningOffers.size})`}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleRunningOffersExport} disabled={runningLoading} className="shrink-0" title="Export running offers to CSV">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchRunningOffers()} className="shrink-0"><RefreshCw className="h-4 w-4" /></Button>
            </div>

            {/* Running Offers Filter Panel - always visible */}
            <FilterPanel
              statusFilter={runningStatusFilter}
              onStatusChange={(v) => { setRunningStatusFilter(v); setRunningPagination(p => ({ ...p, page: 1 })); }}
              categoryFilter={runningCategoryFilter}
              onCategoryChange={(v) => { setRunningCategoryFilter(v); setRunningPagination(p => ({ ...p, page: 1 })); }}
              sortBy={runningSortBy}
              onSortChange={(v) => { setRunningSortBy(v); setRunningPagination(p => ({ ...p, page: 1 })); }}
              countryFilter={runningCountryFilter}
              onCountryChange={(v) => { setRunningCountryFilter(v); setRunningPagination(p => ({ ...p, page: 1 })); }}
              networkFilter={runningNetworkFilter}
              onNetworkChange={(v) => { setRunningNetworkFilter(v); setRunningPagination(p => ({ ...p, page: 1 })); }}
              healthFilter="all"
              onHealthChange={() => {}}
              networks={networks}
              open={true}
            />

            {/* Running Offers Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Running Offers ({runningPagination.total})
                </CardTitle>
                <CardDescription>Offers actively interacted with in the last 30 days. Subcategory: {runningSubcategory === 'all' ? 'All' : runningSubcategory}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {runningLoading ? (
                  <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...</div>
                ) : runningOffers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No running offers found for this filter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-[1400px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input type="checkbox" checked={selectedRunningOffers.size === runningOffers.length && runningOffers.length > 0} onChange={toggleSelectAllRunning} className="rounded border-gray-300" />
                          </TableHead>
                          <TableHead className="w-16">Image</TableHead>
                          <TableHead className="w-24">Offer ID</TableHead>
                          <TableHead className="min-w-[150px]">Name</TableHead>
                          <TableHead className="w-24">Category</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                          <TableHead className="w-24">Countries</TableHead>
                          <TableHead className="w-24">Payout</TableHead>
                          <TableHead className="w-20">Network</TableHead>
                          <TableHead className="w-28">When Active</TableHead>
                          <TableHead className="w-28">When Expired</TableHead>
                          <TableHead className="w-20 text-center">Total Clicks</TableHead>
                          <TableHead className="w-28">Sub-Status</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runningOffers.map(offer => (
                          <TableRow key={offer.offer_id}>
                            <TableCell>
                              <input type="checkbox" checked={selectedRunningOffers.has(offer.offer_id)} onChange={() => toggleRunningOfferSelection(offer.offer_id)} className="rounded border-gray-300" />
                            </TableCell>
                            <TableCell>
                              <img src={getOfferImage(offer as any)} alt="" className="w-10 h-10 rounded-lg object-cover bg-muted" onError={e => { (e.target as HTMLImageElement).src = getOfferImage({ category: offer.category }); }} />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{offer.offer_id}</TableCell>
                            <TableCell>
                              <span className="font-medium text-sm truncate max-w-[200px] block">{offer.name}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {(offer.vertical || offer.category || 'OTHER').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(offer.status)}>{offer.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {(offer.countries || []).slice(0, 2).map(c => (
                                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                                ))}
                                {(offer.countries || []).length > 2 && <Badge variant="outline" className="text-xs">+{offer.countries.length - 2}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-green-600">${offer.payout?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell className="text-sm">{offer.network || '—'}</TableCell>
                            <TableCell className="text-sm">
                              {offer.when_active ? (
                                <div>
                                  <div className="font-medium">{new Date(offer.when_active).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                  <div className="text-xs text-muted-foreground">{new Date(offer.when_active).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {offer.when_expired ? (
                                <div>
                                  <div className={`font-medium ${(offer.days_remaining || 0) <= 5 ? 'text-red-600' : ''}`}>
                                    {new Date(offer.when_expired).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {(offer.days_remaining || 0) > 0 ? `${offer.days_remaining}d left` : 'Expired'}
                                  </div>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600">
                                <Activity className="h-3.5 w-3.5" />{(offer.total_clicks || 0).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {(offer.sub_statuses || []).slice(0, 2).map(s => (
                                  <Badge key={s} variant="outline" className={`text-[10px] ${getSubStatusBadge(s)}`}>{s}</Badge>
                                ))}
                                {(offer.sub_statuses || []).length > 2 && <Badge variant="outline" className="text-[10px]">+{offer.sub_statuses.length - 2}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setSelectedOffer(offer); setOfferDetailsModalOpen(true); }}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedOffer(offer); setEditOfferModalOpen(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteOffer(offer.offer_id, offer.name)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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

            {/* Running Offers Pagination */}
            {runningPagination.total > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Page {runningPagination.page} of {runningPagination.pages} ({runningPagination.total} offers)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Show:</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">{runningPagination.per_page} per page</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {[20, 50, 100, 200].map(n => (
                              <DropdownMenuItem key={n} onClick={() => setRunningPagination(p => ({ ...p, per_page: n, page: 1 }))}>{n} per page</DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRunningPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={runningPagination.page === 1 || runningLoading}>Previous</Button>
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, runningPagination.pages) }, (_, i) => {
                          let pageNum;
                          if (runningPagination.pages <= 5) pageNum = i + 1;
                          else if (runningPagination.page <= 3) pageNum = i + 1;
                          else if (runningPagination.page >= runningPagination.pages - 2) pageNum = runningPagination.pages - 4 + i;
                          else pageNum = runningPagination.page - 2 + i;
                          return (
                            <Button key={pageNum} variant={runningPagination.page === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setRunningPagination(p => ({ ...p, page: pageNum }))} disabled={runningLoading} className="w-10">{pageNum}</Button>
                          );
                        })}
                      </div>
                      <span className="sm:hidden text-sm text-muted-foreground">{runningPagination.page} / {runningPagination.pages}</span>
                      <Button variant="outline" size="sm" onClick={() => setRunningPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))} disabled={runningPagination.page === runningPagination.pages || runningLoading}>Next</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          ) : (
          <>
          {/* Offers Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Offers ({offers.length})
                {(healthFilter !== 'all' || selectedCategories !== 'all') && offers.length !== rawOffers.length && (
                  <span className="text-sm font-normal text-orange-600 ml-2">
                    — {rawOffers.length} on page, {pagination.total} total
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Manage your offers with full tracking and masking capabilities
              </CardDescription>
            </CardHeader>
        <CardContent className="p-0">
          {bulkDeleting ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin mb-3 text-red-500" />
              <p className="text-lg font-medium">Deleting {selectedOffers.size} offers...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait, this may take a moment</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading offers...
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {(healthFilter !== 'all' || selectedCategories !== 'all' || statusFilter !== 'all' || countryFilter !== 'all' || networkFilter !== 'all')
                  ? 'No offers match the current filters'
                  : 'No offers found'}
              </p>
              {(healthFilter !== 'all' || selectedCategories !== 'all' || statusFilter !== 'all' || countryFilter !== 'all' || networkFilter !== 'all') ? (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => {
                    setHealthFilter('all');
                    setSelectedCategories('all');
                    setStatusFilter('all');
                    setCountryFilter('all');
                    setNetworkFilter('all');
                  }}
                >
                  Clear All Filters
                </Button>
              ) : (
                <Button
                  className="mt-4"
                  onClick={() => setAddOfferModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Offer
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 sticky left-0 bg-background z-10">
                    <div className="flex flex-col gap-1">
                      <input
                        type="checkbox"
                        checked={selectedOffers.size === offers.length && offers.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                        title="Select all on this page"
                      />
                      {pagination.total > offers.length && (
                        <button
                          onClick={handleSelectUpTo200}
                          className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          title="Select up to 200 offers across all pages"
                        >
                          200
                        </button>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-12">Health</TableHead>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead className="w-24">Offer ID</TableHead>
                  <TableHead className="w-20">Campaign</TableHead>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="w-24">Category</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24">Countries</TableHead>
                  <TableHead className="w-28">Payout/Revenue</TableHead>
                  <TableHead className="w-20">Incentive</TableHead>
                  <TableHead className="w-24">Network</TableHead>
                  <TableHead className="w-28">Date Added</TableHead>
                  <TableHead className="w-24">Hits/Limit</TableHead>
                  <TableHead className="w-20 sticky right-0 bg-background z-10">Actions</TableHead>
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
                      <HealthIcon
                        status={offer.health?.status === 'healthy' ? 'healthy' : 'unhealthy'}
                        failures={offer.health?.failures || []}
                        onClickUnhealthy={() => setHealthPopupOffer(offer)}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const creativeType = (offer as any).creative_type || 'image';

                        if (creativeType === 'image' || creativeType === 'upload') {
                          return (
                            <img
                              src={getOfferImage(offer as any)}
                              alt={offer.name}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="%23e5e7eb" width="48" height="48"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No Img</text></svg>';
                              }}
                            />
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
                      {(() => {
                        const category = (offer.vertical || offer.category || 'OTHER').toUpperCase();
                        const categoryIcons: Record<string, string> = {
                          'HEALTH': '💊',
                          'SURVEY': '📋',
                          'SWEEPSTAKES': '🎰',
                          'EDUCATION': '📚',
                          'INSURANCE': '🛡️',
                          'LOAN': '💳',
                          'FINANCE': '💰',
                          'DATING': '❤️',
                          'FREE_TRIAL': '🎁',
                          'INSTALLS': '📲',
                          'GAMES_INSTALL': '🎮',
                          'OTHER': '📦'
                        };
                        const icon = categoryIcons[category] || '📦';
                        return (
                          <Badge variant="outline" className="text-xs">
                            {icon} {category}
                          </Badge>
                        );
                      })()}
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
                        <div>{(offer.hits ?? 0).toLocaleString()}</div>
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
                            // Open tracking link
                            const hostname = window.location.hostname;
                            let baseUrl = 'http://localhost:5000';
                            if (hostname.includes('moustacheleads.com') || hostname.includes('vercel.app') || hostname.includes('onrender.com')) {
                              baseUrl = 'https://offers.moustacheleads.com';
                            }
                            let userId = '';
                            try {
                              const userStr = localStorage.getItem('user');
                              if (userStr) {
                                const user = JSON.parse(userStr);
                                userId = user._id || user.id || '';
                              }
                            } catch (e) {}
                            const trackingUrl = `${baseUrl}/track/${offer.offer_id}?user_id=${userId}&sub1=default`;
                            window.open(trackingUrl, '_blank');
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Offer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteOffer(offer.offer_id, offer.name)}
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
                  Showing {offers.length > 0 ? 1 : 0} to {offers.length} of {offers.length} offers
                  {(healthFilter !== 'all' || selectedCategories !== 'all') && offers.length !== rawOffers.length && (
                    <span className="text-orange-600 ml-1">(filtered from {rawOffers.length} on this page)</span>
                  )}
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
        </>
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
                      disabled={bulkDeleting}
                    >
                      {bulkDeleting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      {bulkDeleting ? `Restoring...` : `Restore Selected (${selectedDeletedOffers.size})`}
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
                          <img
                            src={getOfferImage(offer as any)}
                            alt={offer.name}
                            className="w-12 h-12 object-cover rounded border opacity-60"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect fill="%23e5e7eb" width="48" height="48"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">No Img</text></svg>';
                            }}
                          />
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

        {/* Rotation Tab */}
        <TabsContent value="rotation" className="space-y-4">
          {rotationLoading ? (
            <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading rotation status...</CardContent></Card>
          ) : rotationStatus ? (
            <div className="space-y-4">
              {/* Status Overview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Active Offer Rotation Loop
                      </CardTitle>
                      <CardDescription>
                        Automatically rotates inactive offers in batches. Clicked offers get promoted to "running" and stay live permanently.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rotationStatus.enabled ? 'default' : 'secondary'} className={rotationStatus.enabled ? 'bg-green-600' : ''}>
                        {rotationStatus.enabled ? '🟢 Active' : '⚪ Disabled'}
                      </Badge>
                      <Button
                        size="sm"
                        variant={rotationStatus.enabled ? 'destructive' : 'default'}
                        onClick={handleRotationToggle}
                        disabled={rotationActionLoading}
                      >
                        {rotationActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rotationStatus.enabled ? <><Pause className="h-4 w-4 mr-1" /> Disable</> : <><Play className="h-4 w-4 mr-1" /> Enable</>}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Current Batch</div>
                    <div className="text-2xl font-bold">{rotationStatus.current_batch_count}</div>
                    <div className="text-xs text-muted-foreground">of {rotationStatus.batch_size} max</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Running (Clicked)</div>
                    <div className="text-2xl font-bold text-green-600">{rotationStatus.running_count}</div>
                    <div className="text-xs text-muted-foreground">permanently active</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Inactive Pool</div>
                    <div className="text-2xl font-bold">{rotationStatus.inactive_pool_count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">waiting to rotate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="text-xs text-muted-foreground">Total Rotations</div>
                    <div className="text-2xl font-bold">{rotationStatus.total_rotations}</div>
                    <div className="text-xs text-muted-foreground">batch #{rotationStatus.batch_index}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Timer + Actions */}
              {rotationStatus.enabled && (
                <Card>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Timer className="h-5 w-5 text-blue-500" />
                          <div>
                            <div className="text-sm font-medium">Next Rotation In</div>
                            <div className="text-xl font-mono font-bold text-blue-600">{rotationCountdown || 'Waiting...'}</div>
                          </div>
                        </div>
                        {rotationStatus.batch_activated_at && (
                          <div className="text-xs text-muted-foreground">
                            Batch activated: {new Date(rotationStatus.batch_activated_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={handleForceRotation} disabled={rotationActionLoading}>
                          <SkipForward className="h-4 w-4 mr-1" /> Force Rotate Now
                        </Button>
                        <Button size="sm" variant="outline" onClick={fetchRotationStatus} disabled={rotationLoading}>
                          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" /> Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="batch-size">Batch Size (offers per rotation)</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        value={editBatchSize}
                        onChange={(e) => setEditBatchSize(e.target.value)}
                        min={1}
                        max={10000}
                      />
                      <p className="text-xs text-muted-foreground">How many inactive offers to activate each cycle</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="window-minutes">Window Duration (minutes)</Label>
                      <Input
                        id="window-minutes"
                        type="number"
                        value={editWindowMinutes}
                        onChange={(e) => setEditWindowMinutes(e.target.value)}
                        min={1}
                        max={10080}
                      />
                      <p className="text-xs text-muted-foreground">How long each batch stays active before rotating (e.g. 420 = 7 hours, 2 = 2 min for testing)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleRotationConfigSave} disabled={rotationActionLoading}>
                      {rotationActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                      Save Config
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleResetRotation} disabled={rotationActionLoading}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Reset All
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Current Batch Offer IDs */}
              {rotationStatus.current_batch_ids.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-500" /> Current Batch Offers ({rotationStatus.current_batch_ids.length})
                    </CardTitle>
                    <CardDescription>These offers are currently active in the rotation window. Click a tracking link to promote one to "running".</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {rotationStatus.current_batch_ids.map((id) => (
                        <Badge
                          key={id}
                          variant={rotationStatus.running_offer_ids.includes(id) ? 'default' : 'outline'}
                          className={`text-xs cursor-pointer ${rotationStatus.running_offer_ids.includes(id) ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-accent'}`}
                          onClick={() => {
                            navigator.clipboard.writeText(id);
                            toast({ title: 'Copied', description: `Offer ID "${id}" copied to clipboard` });
                          }}
                        >
                          {id} {rotationStatus.running_offer_ids.includes(id) && '🏃'}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Click an ID to copy it. 🏃 = promoted to running (clicked). Test with: <code className="bg-muted px-1 py-0.5 rounded text-xs">http://localhost:5000/track/OFFER_ID?user_id=test</code></p>
                  </CardContent>
                </Card>
              )}

              {/* Running Offers (Permanently Active) */}
              {rotationStatus.running_offer_ids.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" /> Running Offers ({rotationStatus.running_offer_ids.length})
                    </CardTitle>
                    <CardDescription>These offers received clicks and will stay active permanently — they are never deactivated by rotation.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {rotationStatus.running_offer_ids.map((id) => (
                        <Badge key={id} className="bg-green-600 text-xs">
                          {id} 🏃
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* How It Works */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1.5">
                    <p>1. The system picks <span className="font-medium text-foreground">{rotationStatus.batch_size}</span> inactive offers and activates them for <span className="font-medium text-foreground">{rotationStatus.window_minutes} minutes</span>.</p>
                    <p>2. Before activating, it deduplicates: if multiple offers share the same name + country, only the highest-payout one is included.</p>
                    <p>3. If an offer gets clicked during its window, it's promoted to <span className="font-medium text-green-600">"running"</span> and stays active permanently.</p>
                    <p>4. When the window expires, the previous batch is deactivated — except running offers, which are skipped.</p>
                    <p>5. The next batch of {rotationStatus.batch_size} rotates in, and the cycle continues through the entire inactive pool.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load rotation status. <Button variant="link" onClick={fetchRotationStatus}>Retry</Button></CardContent></Card>
          )}
        </TabsContent>

      </Tabs>

      {/* Running Offer Delete Warning Dialog */}
      <Dialog open={runningWarningOpen} onOpenChange={setRunningWarningOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> This is a Running Offer
            </DialogTitle>
            <DialogDescription>
              You are about to delete an offer that is currently active. This offer has had real user interactions in the last 30 days. Deleting it may affect ongoing traffic and tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 border rounded-lg bg-amber-50/50 space-y-3">
            <div>
              <div className="font-medium text-sm">{pendingDeleteName}</div>
              <div className="text-xs text-muted-foreground font-mono">{pendingDeleteId}</div>
            </div>
            {pendingDeleteRunningDetail && (
              <>
                <div className="pt-2 border-t">
                  <div className="text-xs font-medium text-amber-700 mb-1.5">Why is this a running offer?</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {pendingDeleteRunningDetail.sub_statuses.map(s => (
                      <Badge key={s} variant="outline" className={`text-[10px] px-2 py-0.5 ${getSubStatusBadge(s)}`}>
                        {s === 'searched' && '🔍 '}
                        {s === 'picked' && '⭐ '}
                        {s === 'requested' && '📩 '}
                        {s === 'approved' && '✅ '}
                        {s === 'rejected' && '❌ '}
                        {s === 'has_clicks' && '🖱️ '}
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-green-600">{pendingDeleteRunningDetail.total_clicks.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">total clicks</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-semibold ${pendingDeleteRunningDetail.days_remaining <= 5 ? 'text-red-600' : 'text-blue-600'}`}>{pendingDeleteRunningDetail.days_remaining} days</div>
                    <div className="text-[10px] text-muted-foreground">remaining active</div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Do you want to delete this offer or skip it?</div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setRunningWarningOpen(false); setPendingDeleteId(null); setPendingDeleteRunningDetail(null); }}>Cancel</Button>
            <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={() => { setRunningWarningOpen(false); setPendingDeleteId(null); setPendingDeleteRunningDetail(null); }}>Skip</Button>
            <Button variant="destructive" onClick={confirmRunningDelete}>Delete Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Running Offers Warning Dialog */}
      <Dialog open={bulkDeleteWarningOpen} onOpenChange={setBulkDeleteWarningOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Running Offers Detected
            </DialogTitle>
            <DialogDescription>
              {bulkDeleteRunningDetails.length} of your selected offers are currently running with active user interactions in the last 30 days. Deleting them may affect ongoing traffic and tracking. Review the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto">
            {bulkDeleteRunningDetails.map(detail => (
              <div key={detail.offer_id} className="p-3 border rounded-lg bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{detail.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{detail.offer_id}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-green-600">{detail.total_clicks.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">clicks</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-semibold ${detail.days_remaining <= 5 ? 'text-red-600' : 'text-blue-600'}`}>{detail.days_remaining}d</div>
                      <div className="text-[10px] text-muted-foreground">remaining</div>
                    </div>
                  </div>
                </div>
                <div className="pt-1.5 border-t">
                  <div className="text-[10px] text-amber-700 font-medium mb-1">Running because:</div>
                  <div className="flex gap-1 flex-wrap">
                    {detail.sub_statuses.map(s => (
                      <Badge key={s} variant="outline" className={`text-[9px] px-1.5 py-0 ${getSubStatusBadge(s)}`}>
                        {s === 'searched' && '🔍 '}
                        {s === 'picked' && '⭐ '}
                        {s === 'requested' && '📩 '}
                        {s === 'approved' && '✅ '}
                        {s === 'rejected' && '❌ '}
                        {s === 'has_clicks' && '🖱️ '}
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {bulkDeleteNonRunningIds.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <span className="font-medium text-blue-800">{bulkDeleteNonRunningIds.length}</span> non-running offer(s) can be safely deleted.
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" onClick={() => setBulkDeleteWarningOpen(false)}>Cancel</Button>
            {bulkDeleteNonRunningIds.length > 0 && (
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" onClick={executeBulkDeleteSkipRunning}>
                Skip Running, Delete {bulkDeleteNonRunningIds.length} Others
              </Button>
            )}
            <Button variant="destructive" onClick={executeBulkDeleteAll}>
              Delete All {selectedRunningOffers.size > 0 ? selectedRunningOffers.size : selectedOffers.size} (Including Running)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple Single Delete Confirmation Dialog */}
      <Dialog open={simpleDeleteConfirmOpen} onOpenChange={setSimpleDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete Offer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to move this offer to the recycle bin? This action can be undone from the Recycle Bin.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 border rounded-lg bg-muted/50 space-y-1">
            <div className="font-medium text-sm">{pendingDeleteName}</div>
            <div className="text-xs text-muted-foreground font-mono">{pendingDeleteId}</div>
          </div>
          {deleteCheckFailed && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Could not verify if this offer is currently running. Please restart the backend server if this persists.
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setSimpleDeleteConfirmOpen(false); setPendingDeleteId(null); setPendingDeleteName(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmSimpleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simple Bulk Delete Confirmation Dialog */}
      <Dialog open={simpleBulkDeleteConfirmOpen} onOpenChange={setSimpleBulkDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete {selectedOffers.size} Offer(s)
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to move {selectedOffers.size} selected offer(s) to the recycle bin? This action can be undone from the Recycle Bin.
            </DialogDescription>
          </DialogHeader>
          {deleteCheckFailed && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Could not verify if any selected offers are currently running. Please restart the backend server if this persists.
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSimpleBulkDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmSimpleBulkDelete}>Delete {selectedOffers.size} Offer(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              {/* Progress Bar */}
              {duplicateRemovalProgress && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">
                        Removing duplicates...
                      </span>
                    </div>
                    <span className="text-sm font-bold text-blue-700 bg-white px-3 py-1 rounded-full">
                      {duplicateRemovalProgress.current} / {duplicateRemovalProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out relative"
                      style={{ 
                        width: `${(duplicateRemovalProgress.current / duplicateRemovalProgress.total) * 100}%` 
                      }}
                    >
                      <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-blue-700 text-center">
                    {Math.round((duplicateRemovalProgress.current / duplicateRemovalProgress.total) * 100)}% Complete
                  </div>
                </div>
              )}

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
                <img
                  src={getOfferImage(offers[carouselIndex] as any)}
                  alt={offers[carouselIndex].name}
                  className="w-24 h-24 object-cover rounded border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect fill="%23e5e7eb" width="96" height="96"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="12">No Img</text></svg>';
                  }}
                />
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
                    handleDeleteOffer(offers[carouselIndex].offer_id, offers[carouselIndex].name);
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

      {/* CSV Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Offers to CSV
            </DialogTitle>
            <DialogDescription>
              Choose how many offers to export. Total available: {pagination.total}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Export Type Selection */}
            <div className="space-y-3">
              <Label>Export Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={exportType === 'all' ? 'default' : 'outline'}
                  onClick={() => setExportType('all')}
                  className="w-full"
                >
                  All Offers ({pagination.total})
                </Button>
                <Button
                  variant={exportType === 'range' ? 'default' : 'outline'}
                  onClick={() => setExportType('range')}
                  className="w-full"
                >
                  Custom Range
                </Button>
              </div>
            </div>

            {/* Range Selection (only shown when range is selected) */}
            {exportType === 'range' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="export-start">From (Row #)</Label>
                    <Input
                      id="export-start"
                      type="number"
                      min="1"
                      max={pagination.total}
                      value={exportStart + 1}
                      onChange={(e) => setExportStart(Math.max(0, parseInt(e.target.value) - 1 || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="export-end">To (Row #)</Label>
                    <Input
                      id="export-end"
                      type="number"
                      min={exportStart + 1}
                      max={pagination.total}
                      value={exportEnd}
                      onChange={(e) => setExportEnd(Math.min(pagination.total, parseInt(e.target.value) || 100))}
                    />
                  </div>
                </div>
                
                {/* Quick Range Buttons */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quick Select</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportStart(0); setExportEnd(100); }}
                    >
                      1-100
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportStart(100); setExportEnd(200); }}
                    >
                      101-200
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportStart(200); setExportEnd(300); }}
                    >
                      201-300
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportStart(0); setExportEnd(500); }}
                    >
                      First 500
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setExportStart(0); setExportEnd(1000); }}
                    >
                      First 1000
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Will export {Math.min(exportEnd - exportStart, pagination.total - exportStart)} offers (rows {exportStart + 1} to {Math.min(exportEnd, pagination.total)})
                </div>
              </div>
            )}

            {/* Current Filters Info */}
            {(statusFilter !== 'all' || searchTerm) && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <div className="font-medium text-blue-800 mb-1">Active Filters:</div>
                <div className="text-blue-600">
                  {statusFilter !== 'all' && <span>Status: {statusFilter}</span>}
                  {statusFilter !== 'all' && searchTerm && <span> • </span>}
                  {searchTerm && <span>Search: "{searchTerm}"</span>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { handleCSVExport(); setExportModalOpen(false); }} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export {exportType === 'all' ? pagination.total : Math.min(exportEnd - exportStart, pagination.total - exportStart)} Offers
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Health Popup */}
      <HealthPopup
        open={healthPopupOffer !== null}
        onClose={() => setHealthPopupOffer(null)}
        offerName={healthPopupOffer?.name || ''}
        failures={healthPopupOffer?.health?.failures || []}
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

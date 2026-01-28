import { useState, useEffect, useRef } from 'react';
import { placementApi } from '../services/placementApi';

interface PlacementApprovalStatus {
  hasApprovedPlacement: boolean;
  hasPendingPlacement: boolean;
  hasRejectedPlacement: boolean;
  approvedPlacement: any | null;
  pendingPlacements: any[];
  rejectedPlacements: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Cache placement status in memory to avoid repeated API calls
let cachedStatus: PlacementApprovalStatus | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export const usePlacementApproval = (): PlacementApprovalStatus => {
  const [status, setStatus] = useState<PlacementApprovalStatus>(() => {
    // Return cached status if available and not expired
    if (cachedStatus && (Date.now() - lastFetchTime) < CACHE_DURATION) {
      return { ...cachedStatus, loading: false };
    }
    return {
      hasApprovedPlacement: false,
      hasPendingPlacement: false,
      hasRejectedPlacement: false,
      approvedPlacement: null,
      pendingPlacements: [],
      rejectedPlacements: [],
      loading: true,
      error: null,
      refetch: () => { }
    };
  });

  const isMounted = useRef(true);
  const hasFetched = useRef(false);

  const checkPlacementStatus = async (forceRefresh = false) => {
    // Skip if we have valid cached data and not forcing refresh
    if (!forceRefresh && cachedStatus && (Date.now() - lastFetchTime) < CACHE_DURATION) {
      if (isMounted.current) {
        setStatus(prev => ({ ...cachedStatus!, loading: false, refetch: prev.refetch }));
      }
      return;
    }

    try {
      if (isMounted.current) {
        setStatus(prev => ({ ...prev, loading: true, error: null }));
      }

      const token = localStorage.getItem('token');
      if (!token) {
        const noTokenStatus = {
          hasApprovedPlacement: false,
          hasPendingPlacement: false,
          hasRejectedPlacement: false,
          approvedPlacement: null,
          pendingPlacements: [],
          rejectedPlacements: [],
          loading: false,
          error: null,
          refetch: () => checkPlacementStatus(true)
        };
        cachedStatus = noTokenStatus;
        if (isMounted.current) {
          setStatus(noTokenStatus);
        }
        return;
      }

      // Check if user is admin or subadmin - they should have full access
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (user.role === 'admin' || user.role === 'subadmin') {
        const adminStatus = {
          hasApprovedPlacement: true,
          hasPendingPlacement: false,
          hasRejectedPlacement: false,
          approvedPlacement: { id: 'admin', offerwallTitle: 'Admin Access' },
          pendingPlacements: [],
          rejectedPlacements: [],
          loading: false,
          error: null,
          refetch: () => checkPlacementStatus(true)
        };
        cachedStatus = adminStatus;
        lastFetchTime = Date.now();
        if (isMounted.current) {
          setStatus(adminStatus);
        }
        return;
      }

      // Get all placements for the current publisher
      const placementResponse = await placementApi.getPlacements();
      const placements = placementResponse.placements || [];

      // Categorize placements by approval status
      const approved = placements.filter(p => p.approvalStatus === 'APPROVED');
      const pending = placements.filter(p => p.approvalStatus === 'PENDING_APPROVAL');
      const rejected = placements.filter(p => p.approvalStatus === 'REJECTED');

      const newStatus = {
        hasApprovedPlacement: approved.length > 0,
        hasPendingPlacement: pending.length > 0,
        hasRejectedPlacement: rejected.length > 0,
        approvedPlacement: approved.length > 0 ? approved[0] : null,
        pendingPlacements: pending,
        rejectedPlacements: rejected,
        loading: false,
        error: null,
        refetch: () => checkPlacementStatus(true)
      };

      // Update cache
      cachedStatus = newStatus;
      lastFetchTime = Date.now();

      if (isMounted.current) {
        setStatus(newStatus);
      }

    } catch (error) {
      console.error('Error checking placement status:', error);
      
      if (isMounted.current) {
        setStatus(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch'
        }));
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch if we haven't fetched yet or cache is expired
    if (!hasFetched.current || !cachedStatus || (Date.now() - lastFetchTime) >= CACHE_DURATION) {
      hasFetched.current = true;
      checkPlacementStatus();
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Update refetch function
  useEffect(() => {
    setStatus(prev => ({
      ...prev,
      refetch: () => checkPlacementStatus(true)
    }));
  }, []);

  return status;
};

// Helper hook for simple access control
export const useRequireApprovedPlacement = () => {
  const placementStatus = usePlacementApproval();

  return {
    ...placementStatus,
    canAccessPlatform: placementStatus.hasApprovedPlacement && !placementStatus.loading,
    shouldShowPlacementRequired: !placementStatus.hasApprovedPlacement && !placementStatus.loading,
    shouldShowPendingMessage: placementStatus.hasPendingPlacement && !placementStatus.hasApprovedPlacement
  };
};

// Function to clear cache (call this on logout or when placement is created/updated)
export const clearPlacementCache = () => {
  cachedStatus = null;
  lastFetchTime = 0;
};

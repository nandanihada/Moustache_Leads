import { useState, useEffect } from 'react';
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

export const usePlacementApproval = (): PlacementApprovalStatus => {
  const [status, setStatus] = useState<PlacementApprovalStatus>({
    hasApprovedPlacement: false,
    hasPendingPlacement: false,
    hasRejectedPlacement: false,
    approvedPlacement: null,
    pendingPlacements: [],
    rejectedPlacements: [],
    loading: true,
    error: null,
    refetch: () => {}
  });

  const checkPlacementStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        setStatus(prev => ({
          ...prev,
          loading: false,
          error: 'No authentication token found'
        }));
        return;
      }

      // Check if user is admin - admins should have full access
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'admin') {
        setStatus(prev => ({
          ...prev,
          hasApprovedPlacement: true, // Give admin full access
          hasPendingPlacement: false,
          hasRejectedPlacement: false,
          approvedPlacement: { id: 'admin', offerwallTitle: 'Admin Access' },
          pendingPlacements: [],
          rejectedPlacements: [],
          loading: false,
          error: null
        }));
        return;
      }

      // Get all placements for the current publisher
      const placementResponse = await placementApi.getPlacements();
      const placements = placementResponse.placements || [];
      
      // Categorize placements by approval status
      const approved = placements.filter(p => p.approvalStatus === 'APPROVED');
      const pending = placements.filter(p => p.approvalStatus === 'PENDING_APPROVAL');
      const rejected = placements.filter(p => p.approvalStatus === 'REJECTED');

      setStatus(prev => ({
        ...prev,
        hasApprovedPlacement: approved.length > 0,
        hasPendingPlacement: pending.length > 0,
        hasRejectedPlacement: rejected.length > 0,
        approvedPlacement: approved.length > 0 ? approved[0] : null,
        pendingPlacements: pending,
        rejectedPlacements: rejected,
        loading: false,
        error: null
      }));

    } catch (error) {
      console.error('Error checking placement status:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check placement status'
      }));
    }
  };

  useEffect(() => {
    checkPlacementStatus();
    
    // Set up periodic refresh every 30 seconds to catch approval updates
    const interval = setInterval(checkPlacementStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Add refetch function to the status
  useEffect(() => {
    setStatus(prev => ({
      ...prev,
      refetch: checkPlacementStatus
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

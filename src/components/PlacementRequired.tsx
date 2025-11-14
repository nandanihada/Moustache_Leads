import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  ArrowRight,
  FileText,
  Shield,
  RefreshCw
} from 'lucide-react';
import { useRequireApprovedPlacement } from '../hooks/usePlacementApproval';

interface PlacementRequiredProps {
  children: React.ReactNode;
  showMessage?: boolean;
}

const PlacementRequired: React.FC<PlacementRequiredProps> = ({ 
  children, 
  showMessage = true 
}) => {
  const navigate = useNavigate();
  const {
    canAccessPlatform,
    shouldShowPlacementRequired,
    shouldShowPendingMessage,
    hasApprovedPlacement,
    hasPendingPlacement,
    hasRejectedPlacement,
    pendingPlacements,
    rejectedPlacements,
    loading,
    error,
    refetch
  } = useRequireApprovedPlacement();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking placement status...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            Error Loading Placement Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If user has approved placement, show the protected content
  if (canAccessPlatform) {
    return <>{children}</>;
  }

  // If not showing message, just block access
  if (!showMessage) {
    return null;
  }

  // Show placement requirement message
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Main Status Card */}
      <Card className="border-l-4 border-l-violet-600">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-6 w-6 mr-2 text-violet-600" />
            Placement Approval Required
          </CardTitle>
          <CardDescription>
            You need an approved placement to access platform features like offers, statistics, and reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="grid gap-4">
            {hasPendingPlacement && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-yellow-600 mr-3" />
                    <div>
                      <p className="font-medium text-yellow-800">Placement Under Review</p>
                      <p className="text-sm text-yellow-700">
                        Your placement is being reviewed by our team. You'll be notified once approved.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    {pendingPlacements.length} Pending
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-yellow-600">Status updates automatically every 30 seconds</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refetch}
                    className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Check Status
                  </Button>
                </div>
              </div>
            )}

            {hasRejectedPlacement && (
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-3" />
                  <div>
                    <p className="font-medium text-red-800">Placement Rejected</p>
                    <p className="text-sm text-red-700">
                      Your placement was rejected. Please review the feedback and create a new one.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  {rejectedPlacements.length} Rejected
                </Badge>
              </div>
            )}

            {!hasPendingPlacement && !hasRejectedPlacement && (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium text-blue-800">No Placement Found</p>
                    <p className="text-sm text-blue-700">
                      Create your first placement to start accessing offers and earning revenue.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              onClick={() => navigate('/dashboard/placements')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              {hasPendingPlacement || hasRejectedPlacement ? 'Manage Placements' : 'Create Placement'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            {(hasPendingPlacement || hasRejectedPlacement) && (
              <Button 
                variant="outline"
                onClick={() => navigate('/dashboard/placements')}
                className="flex-1"
              >
                View Status Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What is a Placement?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-sm mb-3">
              A placement is your integration point with our offerwall system. It defines:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Your platform type (Android, iOS, Website)</li>
              <li>• Currency and exchange rates</li>
              <li>• Postback URL for tracking conversions</li>
              <li>• Offerwall branding and settings</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Approval Process</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 text-xs font-medium">1</div>
                <span className="text-gray-600">Create placement with platform details</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mr-3 text-xs font-medium">2</div>
                <span className="text-gray-600">Admin reviews your submission</span>
              </div>
              <div className="flex items-center text-sm">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 text-xs font-medium">3</div>
                <span className="text-gray-600">Access granted to full platform</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejected Placement Details */}
      {hasRejectedPlacement && rejectedPlacements.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Rejected Placements</CardTitle>
            <CardDescription>
              Review the feedback below and create a new placement addressing these issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rejectedPlacements.map((placement, index) => (
                <div key={placement.id || index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-red-800">{placement.offerwallTitle}</h4>
                    <Badge variant="destructive">Rejected</Badge>
                  </div>
                  {placement.rejectionReason && (
                    <p className="text-sm text-red-700 mb-2">
                      <strong>Reason:</strong> {placement.rejectionReason}
                    </p>
                  )}
                  {placement.reviewMessage && (
                    <p className="text-sm text-red-600">
                      <strong>Feedback:</strong> {placement.reviewMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlacementRequired;

import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Campaign Queue has been replaced by the Automation Engine.
 * This component now redirects users to the new system.
 */
export default function CampaignQueueTab({ isActive }: { isActive: boolean }) {
  const navigate = useNavigate();

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Zap className="h-12 w-12 text-orange-500" />
      <h3 className="text-lg font-semibold text-gray-900">Campaign Queue has moved</h3>
      <p className="text-sm text-gray-500 text-center max-w-md">
        The email campaign queue has been upgraded to the new Automation Engine. 
        Access it from the Recent Activity page or click below.
      </p>
      <Button onClick={() => navigate('/admin/recent-activity')} className="gap-2 mt-2">
        <Zap className="h-4 w-4" />
        Go to Automation Engine
      </Button>
    </div>
  );
}

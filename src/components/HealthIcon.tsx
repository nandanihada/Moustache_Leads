import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HealthIconProps {
  status: 'healthy' | 'unhealthy';
  failures?: { criterion: string; description: string }[];
  onClickUnhealthy?: () => void;
}

const HealthIcon: React.FC<HealthIconProps> = ({ status, onClickUnhealthy }) => {
  if (status === 'healthy') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Healthy</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClickUnhealthy}
            className="inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Unhealthy</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HealthIcon;

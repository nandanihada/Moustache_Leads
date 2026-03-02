import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  Upload,
  Download,
  Copy,
  Eraser,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Image,
  LayoutGrid,
  Globe,
  Settings,
} from 'lucide-react';

interface ActionsDropdownProps {
  onCreateOffer: () => void;
  onBulkUpload: () => void;
  onApiImport: () => void;
  onClone: () => void;
  onClear: () => void;
  onPreview: () => void;
  onExportCsv: () => void;
  onRefresh: () => void;
  onRemoveDuplicates: () => void;
  onAssignImages: () => void;
  onCarouselView: () => void;
  onManageDomains: () => void;
  onBulkStatusChange?: (status: string) => void;
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({
  onCreateOffer,
  onBulkUpload,
  onApiImport,
  onClone,
  onClear,
  onPreview,
  onExportCsv,
  onRefresh,
  onRemoveDuplicates,
  onAssignImages,
  onCarouselView,
  onManageDomains,
  onBulkStatusChange,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MoreHorizontal className="h-4 w-4" />
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onCreateOffer}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Offer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBulkUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onApiImport}>
          <Download className="mr-2 h-4 w-4" />
          API Import
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClone}>
          <Copy className="mr-2 h-4 w-4" />
          Clone
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClear} className="text-destructive">
          <Eraser className="mr-2 h-4 w-4" />
          Clear All Offers
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExportCsv}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          CSV Export
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRemoveDuplicates}>
          <Trash2 className="mr-2 h-4 w-4" />
          Remove Duplicates
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAssignImages}>
          <Image className="mr-2 h-4 w-4" />
          Assign Images
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCarouselView}>
          <LayoutGrid className="mr-2 h-4 w-4" />
          Carousel View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManageDomains}>
          <Globe className="mr-2 h-4 w-4" />
          Manage Domains
        </DropdownMenuItem>
        {onBulkStatusChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground font-semibold">
              <Settings className="mr-2 h-4 w-4" />
              Set All Offers Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkStatusChange('active')}>
              <span className="mr-2 ml-6">🟢</span> Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkStatusChange('inactive')}>
              <span className="mr-2 ml-6">⚫</span> Inactive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkStatusChange('paused')}>
              <span className="mr-2 ml-6">⏸️</span> Paused
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkStatusChange('hidden')}>
              <span className="mr-2 ml-6">👁️</span> Hidden
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsDropdown;

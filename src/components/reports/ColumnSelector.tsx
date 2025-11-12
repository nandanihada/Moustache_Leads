import { useState } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Columns, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean; // Column that can't be hidden
}

interface ColumnSelectorProps {
  columns: ColumnDefinition[];
  visibleColumns: Record<string, boolean>;
  onColumnChange: (columnId: string, visible: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onColumnChange,
  onSelectAll,
  onClearAll,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns className="mr-2 h-4 w-4" />
          Columns ({visibleCount}/{columns.length})
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-semibold">Show Columns</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                className="h-7 text-xs"
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-7 text-xs"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Column list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded"
              >
                <Checkbox
                  id={`column-${column.id}`}
                  checked={visibleColumns[column.id]}
                  disabled={column.alwaysVisible}
                  onCheckedChange={(checked) => {
                    if (!column.alwaysVisible) {
                      onColumnChange(column.id, checked as boolean);
                    }
                  }}
                />
                <label
                  htmlFor={`column-${column.id}`}
                  className={`text-sm cursor-pointer flex-1 ${
                    column.alwaysVisible ? 'text-gray-400' : ''
                  }`}
                >
                  {column.label}
                  {column.alwaysVisible && (
                    <span className="ml-1 text-xs">(required)</span>
                  )}
                </label>
              </div>
            ))}
          </div>

          {/* Footer info */}
          <div className="border-t pt-2 text-xs text-gray-500">
            {visibleCount} of {columns.length} columns visible
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

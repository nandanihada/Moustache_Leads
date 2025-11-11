import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CalendarDays } from "lucide-react";

interface DatePresetsProps {
  onPresetSelect: (preset: { start: string; end: string; label: string }) => void;
}

export function DatePresets({ onPresetSelect }: DatePresetsProps) {
  const getPreset = (days: number, label: string) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      label
    };
  };

  const presets = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "Last 7 Days", days: 7 },
    { label: "Last 14 Days", days: 14 },
    { label: "Last 30 Days", days: 30 },
    { label: "This Month", custom: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: "This Month"
      };
    }},
    { label: "Last Month", custom: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        label: "Last Month"
      };
    }},
    { label: "This Year", custom: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: "This Year"
      };
    }}
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays className="h-4 w-4 mr-2" />
          Date Presets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          <h4 className="font-medium text-sm mb-2">Quick Date Ranges</h4>
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                const value = preset.custom 
                  ? preset.custom() 
                  : getPreset(preset.days!, preset.label);
                onPresetSelect(value);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

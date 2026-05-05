import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, CalendarClock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface QueueItem {
  id: string;
  userId: string;
  username: string;
  email: string;
  type: string;
  scheduledTime: string;
  status: 'Pending' | 'Sent' | 'Failed';
}

interface BulkMailSchedulerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: any[];
  onConfirmSchedule: (queue: QueueItem[]) => Promise<boolean>;
}

export const BulkMailScheduler: React.FC<BulkMailSchedulerProps> = ({ open, onOpenChange, selectedUsers, onConfirmSchedule }) => {
  const [template, setTemplate] = useState('welcome');
  const [intervalVal, setIntervalVal] = useState('0');
  const [intervalUnit, setIntervalUnit] = useState('minutes');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (open) {
      setQueue([]);
      setHasGenerated(false);
      setTemplate('welcome');
      setIntervalVal('0');
      setIntervalUnit('minutes');
    }
  }, [open]);

  const generateQueue = () => {
    if (selectedUsers.length === 0) return;

    let currentTime = new Date();
    // Add a few seconds buffer for the first one so it's strictly in the future if "now"
    currentTime = new Date(currentTime.getTime() + 2 * 60000); 

    const newQueue: QueueItem[] = [];
    
    // Determine number of mails per user based on template
    // If 'welcome_referral_separate' was an option, it would be 2.
    // For 'welcome', 'referral', 'welcome_referral', it's 1 combined email per user.
    const intervalMs = parseInt(intervalVal) * (intervalUnit === 'hours' ? 3600000 : 60000);

    selectedUsers.forEach((u, i) => {
      const scheduleDate = new Date(currentTime.getTime() + (i * intervalMs));
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      const isoLocal = `${scheduleDate.getFullYear()}-${pad(scheduleDate.getMonth()+1)}-${pad(scheduleDate.getDate())}T${pad(scheduleDate.getHours())}:${pad(scheduleDate.getMinutes())}`;

      newQueue.push({
        id: Math.random().toString(),
        userId: u.user_id || u._id,
        username: u.username || 'User',
        email: u.email,
        type: template,
        scheduledTime: isoLocal,
        status: 'Pending'
      });
    });

    setQueue(newQueue);
    setHasGenerated(true);
  };

  const updateQueueTime = (id: string, newTime: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, scheduledTime: newTime } : q));
  };

  const removeQueueItem = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const handleConfirm = async () => {
    setIsSending(true);
    try {
      const success = await onConfirmSchedule(queue);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  const formatTemplateName = (val: string) => {
    if (val === 'welcome') return 'Welcome';
    if (val === 'referral') return 'Referral';
    if (val === 'welcome_referral') return 'Welcome + Referral';
    if (val === 'warning') return 'Warning';
    return val;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Schedule Bulk Mail ({selectedUsers.length} users)</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4 shrink-0 border-b">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mail Template</label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="welcome">Welcome Mail</SelectItem>
                <SelectItem value="referral">Referral Mail</SelectItem>
                <SelectItem value="welcome_referral">Combined (Welcome + Referral)</SelectItem>
                <SelectItem value="warning">Warning Mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Interval Value</label>
            <Input type="number" min="0" value={intervalVal} onChange={e => setIntervalVal(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Interval Unit</label>
            <Select value={intervalUnit} onValueChange={setIntervalUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex items-end">
            <Button onClick={generateQueue} className="w-full" variant="secondary">
              <CalendarClock className="w-4 h-4 mr-2" /> Generate Queue
            </Button>
          </div>
        </div>

        {hasGenerated && (
          <div className="flex-1 overflow-y-auto py-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Queue Preview</h3>
              <div className="text-xs text-muted-foreground">
                Total: {queue.length} mails
              </div>
            </div>
            
            <div className="border rounded-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Schedule Time</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Queue is empty</td>
                    </tr>
                  ) : queue.map((q, i) => (
                    <tr key={q.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{q.username}</div>
                        <div className="text-xs text-muted-foreground">{q.email}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{formatTemplateName(q.type)}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Input 
                          type="datetime-local" 
                          value={q.scheduledTime} 
                          onChange={(e) => updateQueueTime(q.id, e.target.value)} 
                          className="h-8 text-xs w-[180px]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${q.status === 'Pending' ? 'bg-amber-100 text-amber-800' : q.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-slate-100'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeQueueItem(q.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!hasGenerated || queue.length === 0 || isSending}>
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Confirm & Schedule All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface HealthPopupProps {
  open: boolean;
  onClose: () => void;
  offerName: string;
  failures: { criterion: string; description: string }[];
}

const HealthPopup: React.FC<HealthPopupProps> = ({
  open,
  onClose,
  offerName,
  failures,
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Health Issues — {offerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {failures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found.</p>
          ) : (
            <ul className="space-y-2">
              {failures.map((failure) => (
                <li
                  key={failure.criterion}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <span>{failure.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HealthPopup;

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  applicationId: number | null;
  isLoading?: boolean;
  isApplicationCompleted?: boolean;
}

export const CancelModal: React.FC<CancelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  applicationId,
  isLoading,
  isApplicationCompleted,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isApplicationCompleted) {
      setError('Completed applications cannot be cancelled');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }
    setError(null);
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={handleClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-destructive/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-foreground">Cancel Application</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              Are you sure you want to cancel this application?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This action cannot be undone. All associated bookings will also be cancelled.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for cancellation..."
              rows={4}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" className="hover:bg-slate-100 hover:text-black" onClick={handleClose} disabled={isLoading}>
            Keep Application
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || isApplicationCompleted}
          >
            {isApplicationCompleted ? 'Cancellation Disabled' 
              : isLoading ? 'Cancelling...' : 'Cancel Application'}
          </Button>
        </div>
      </div>
    </div>
  );
};

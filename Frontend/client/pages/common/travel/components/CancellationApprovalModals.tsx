import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface CancellationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  applicationId?: string;
}

export const CancellationApprovalModal: React.FC<
  CancellationApprovalModalProps
> = ({ isOpen, onClose, onConfirm, isLoading, applicationId }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-center">
            Approve Cancellation
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            Are you sure you want to approve the cancellation for{" "}
            <strong className="text-slate-700">{applicationId}</strong>? This
            action will release any confirmed bookings and notify the employee.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Approving..." : "Yes, Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CancellationRejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
  applicationId?: string;
}

export const CancellationRejectionModal: React.FC<
  CancellationRejectionModalProps
> = ({ isOpen, onClose, onConfirm, isLoading, applicationId }) => {
  const [reason, setReason] = React.useState("");

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center">
            Reject Cancellation Request
          </DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            Please provide a reason for rejecting the cancellation request for{" "}
            <strong className="text-slate-700">{applicationId}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <textarea
            placeholder="Enter rejection reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full min-h-[100px] p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
          />
        </div>
        <DialogFooter className="sm:justify-center gap-2 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading ? "Rejecting..." : "Reject Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

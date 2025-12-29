import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Calendar,
  IndianRupee,
  MapPin,
  Loader2,
} from "lucide-react";

interface CancellationConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  application: any;
  reason: string;
  isLoading: boolean;
}

export const CancellationConfirmationDialog: React.FC<
  CancellationConfirmationDialogProps
> = ({ isOpen, onClose, onConfirm, application, reason, isLoading }) => {
  if (!application) return null;

  const trip = application.trip_details?.[0];
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">
            Confirm Cancellation Request
          </DialogTitle>
          <DialogDescription className="text-center">
            Please review the details before submitting your cancellation
            request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Application Summary */}
          <Alert>
            <AlertTitle className="text-sm font-semibold">
              Application Details
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Request ID:</span>
                <span className="font-medium font-mono">
                  {application.travel_request_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purpose:</span>
                <span className="font-medium text-right max-w-[60%]">
                  {application.purpose}
                </span>
              </div>
              {trip && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Route:</span>
                    <span className="font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {trip.from_location_name} → {trip.to_location_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Travel Dates:</span>
                    <span className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(trip.departure_date)} to{" "}
                      {formatDate(trip.return_date)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estimated Cost:</span>
                <span className="font-medium flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {Number(application.estimated_total_cost || 0).toLocaleString(
                    "en-IN",
                  )}
                </span>
              </div>
            </AlertDescription>
          </Alert>

          {/* Cancellation Reason */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">
              Your Cancellation Reason
            </p>
            <p className="text-sm text-amber-800 italic">{reason}</p>
          </div>

          {/* Information */}
          <p className="text-xs text-muted-foreground">
            This request will be sent to your manager for approval. You will be
            notified of their decision via email. You can withdraw this request
            before it is approved or rejected.
          </p>
        </div>

        <DialogFooter className="sm:justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="hover:bg-slate-100"
          >
            Go Back
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Confirm Cancellation Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

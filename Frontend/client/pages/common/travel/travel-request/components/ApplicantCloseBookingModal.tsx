import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BOOKING_REASON_MAX_LENGTH } from "@/src/constants/booking-closure";

const MIN_REASON_LENGTH = 10;

interface ApplicantCloseBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (closureReason: string) => void;
  isSubmitting?: boolean;
}

export function ApplicantCloseBookingModal({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ApplicantCloseBookingModalProps) {
  const [reason, setReason] = useState("");

  const trimmed = reason.trim();
  const isValid =
    trimmed.length >= MIN_REASON_LENGTH &&
    trimmed.length <= BOOKING_REASON_MAX_LENGTH;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(trimmed);
    setReason("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close booking line</DialogTitle>
          <DialogDescription>
            This booking is locked after approval for edit/remove. Closing keeps the record for
            travel desk and audit; it will not be claimable in expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="close-booking-reason">
            Reason for closing <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="close-booking-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this line is no longer required (e.g. trip plan changed, accommodation arranged separately)..."
            rows={4}
            className="resize-y min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            {MIN_REASON_LENGTH}–{BOOKING_REASON_MAX_LENGTH} characters (
            {trimmed.length}/{BOOKING_REASON_MAX_LENGTH})
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Closing..." : "Close booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

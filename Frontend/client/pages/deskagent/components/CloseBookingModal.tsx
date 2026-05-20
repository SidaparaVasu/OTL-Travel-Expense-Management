import React, { useState } from "react";
import { X, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BOOKING_REASON_MAX_LENGTH } from "@/src/constants/booking-closure";

interface CloseBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    closure_reason: string;
    claim_decision_reason: string;
    allow_claim: boolean;
  }) => void;
  isLoading?: boolean;
}

export const CloseBookingModal: React.FC<CloseBookingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [closureReason, setClosureReason] = useState("");
  const [claimDecisionReason, setClaimDecisionReason] = useState("");
  const [allowClaim, setAllowClaim] = useState<"yes" | "no">("yes");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validateReason = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) return `${label} is required`;
    if (trimmed.length > BOOKING_REASON_MAX_LENGTH) {
      return `${label} must be ${BOOKING_REASON_MAX_LENGTH} characters or fewer`;
    }
    return null;
  };

  const handleConfirm = () => {
    const closureError = validateReason(closureReason, "Closure reason");
    if (closureError) {
      setError(closureError);
      return;
    }

    const claimError = validateReason(
      claimDecisionReason,
      "Claim decision reason",
    );
    if (claimError) {
      setError(claimError);
      return;
    }

    setError(null);
    onConfirm({
      closure_reason: closureReason.trim(),
      claim_decision_reason: claimDecisionReason.trim(),
      allow_claim: allowClaim === "yes",
    });
  };

  const handleClose = () => {
    setClosureReason("");
    setClaimDecisionReason("");
    setAllowClaim("yes");
    setError(null);
    onClose();
  };

  const renderReasonField = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, BOOKING_REASON_MAX_LENGTH))}
        placeholder={placeholder}
        rows={3}
        maxLength={BOOKING_REASON_MAX_LENGTH}
        className={error ? "border-destructive" : ""}
      />
      <p className="text-xs text-muted-foreground text-right">
        {value.length}/{BOOKING_REASON_MAX_LENGTH}
      </p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-lg shadow-lg w-full max-w-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-foreground">
              Close Booking
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-slate-50 border rounded-lg p-4">
            <p className="text-sm text-slate-700 font-medium">
              Mark this booking as closed when the service was not used or an
              alternative arrangement was provided.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This action is recorded permanently and cannot be undone.
            </p>
          </div>

          {renderReasonField(
            "closure-reason",
            "Closure Reason",
            closureReason,
            setClosureReason,
            "Why is this booking being closed?",
          )}

          <div className="space-y-2">
            <Label>Allow claim for this booking? *</Label>
            <RadioGroup
              value={allowClaim}
              onValueChange={(value) => setAllowClaim(value as "yes" | "no")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="allow-claim-yes" />
                <Label htmlFor="allow-claim-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="allow-claim-no" />
                <Label htmlFor="allow-claim-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          {renderReasonField(
            "claim-decision-reason",
            "Claim Decision Reason",
            claimDecisionReason,
            setClaimDecisionReason,
            allowClaim === "yes"
              ? "Why should claim be allowed?"
              : "Why should claim not be allowed?",
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Closing..." : "Close Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BOOKING_REASON_MAX_LENGTH } from "@/src/constants/booking-closure";

interface UpdateClaimEligibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    allow_claim: boolean;
    claim_decision_reason: string;
  }) => void;
  currentAllowClaim: boolean | null;
  isLoading?: boolean;
}

export const UpdateClaimEligibilityModal: React.FC<
  UpdateClaimEligibilityModalProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  currentAllowClaim,
  isLoading,
}) => {
  const [allowClaim, setAllowClaim] = useState<"yes" | "no">(
    currentAllowClaim ? "yes" : "no",
  );
  const [claimDecisionReason, setClaimDecisionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setAllowClaim(currentAllowClaim ? "yes" : "no");
      setClaimDecisionReason("");
      setError(null);
    }
  }, [isOpen, currentAllowClaim]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = claimDecisionReason.trim();
    if (!trimmed) {
      setError("Claim decision reason is required");
      return;
    }
    if (trimmed.length > BOOKING_REASON_MAX_LENGTH) {
      setError(
        `Claim decision reason must be ${BOOKING_REASON_MAX_LENGTH} characters or fewer`,
      );
      return;
    }

    const nextAllowClaim = allowClaim === "yes";
    if (nextAllowClaim === currentAllowClaim) {
      setError("Select a different claim eligibility option to update");
      return;
    }

    setError(null);
    onConfirm({
      allow_claim: nextAllowClaim,
      claim_decision_reason: trimmed,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-lg w-full max-w-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-foreground">
              Update Claim Eligibility
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Allow claim for this booking? *</Label>
            <RadioGroup
              value={allowClaim}
              onValueChange={(value) => setAllowClaim(value as "yes" | "no")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="update-allow-claim-yes" />
                <Label htmlFor="update-allow-claim-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="update-allow-claim-no" />
                <Label htmlFor="update-allow-claim-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-claim-decision-reason">
              Claim Decision Reason *
            </Label>
            <Textarea
              id="update-claim-decision-reason"
              value={claimDecisionReason}
              onChange={(e) =>
                setClaimDecisionReason(
                  e.target.value.slice(0, BOOKING_REASON_MAX_LENGTH),
                )
              }
              placeholder="Explain why claim eligibility is being changed"
              rows={3}
              maxLength={BOOKING_REASON_MAX_LENGTH}
            />
            <p className="text-xs text-muted-foreground text-right">
              {claimDecisionReason.length}/{BOOKING_REASON_MAX_LENGTH}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Eligibility"}
          </Button>
        </div>
      </div>
    </div>
  );
};

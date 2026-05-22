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
import { AlertTriangle } from "lucide-react";

const MIN_REASON_LENGTH = 10;

interface EditReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function EditReasonDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
  isSubmitting = false,
}: EditReasonDialogProps) {
  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reason for modification</DialogTitle>
          <DialogDescription>
            This travel request was already submitted. You must explain what
            changed and why before updating.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Provide an accurate reason for this modification. Misuse or vague
            reasons may be reviewed by management. Approvers, travel desk, and
            booking agents can see this note.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-reason">
            Modification reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Describe what you changed and why (e.g. dates revised, new flight segment added, accommodation updated)..."
            rows={5}
            className="resize-y min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground">
            Minimum {MIN_REASON_LENGTH} characters ({trimmed.length}/
            {MIN_REASON_LENGTH})
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Confirm & continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

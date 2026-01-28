import React, { useEffect, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { bookingAgentAPI, type Booking } from "@/src/api/bookingAgentAPI";

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSuccess: () => void;
}

export const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) => {
  const { toast } = useToast();

  console.log("Booking: ", booking);

  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [actualCost, setActualCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setActualCost(booking.actual_cost ?? "");
      setRemarks("");
      setFile(null);
    }
  }, [booking]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("");
      setRemarks("");
      setFile(null);
      setActualCost("");
    }
  }, [isOpen]);

  if (!isOpen || !booking) return null;

  // Check if application is on hold
  const isOnHold =
    booking.travel_application_status === "cancellation_requested";

  const requiresCeoApproval = () => {
    if (status !== "confirmed") return false;
    if (booking.booking_type_name !== "Flight") return false;
    if (booking.ceo_approval_status === "approved") return false;
    if (!actualCost || booking.max_allowed_cost == null) return false;

    return Number(actualCost) > Number(booking.max_allowed_cost);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!status) {
      toast({
        title: "Status required",
        description: "Please select a status",
        variant: "destructive",
      });
      return;
    }

    // if (status === "confirmed" && !actualCost) {
    //   toast({
    //     title: "Actual cost required",
    //     description: "Actual cost is mandatory for confirmation",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    if (requiresCeoApproval()) {
      toast({
        title: "CEO approval required",
        description:
          "Cost exceeds allowed limit. Please wait for CEO approval.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("status", status);

      if (remarks.trim()) {
        formData.append("remarks", remarks.trim());
      }

      if (file) {
        formData.append("booking_file", file);
      }

      if (actualCost) {
        formData.append("actual_cost", actualCost);
      }

      const response = await bookingAgentAPI.bookings.updateStatus(
        booking.id,
        formData,
      );

      // Check if booking was escalated to CEO
      if (response.data?.status === "escalated") {
        toast({
          title: "Sent for CEO approval",
          description:
            "Booking cost exceeds limit and has been sent to CEO for approval.",
        });
      } else {
        toast({
          title: "Status updated",
          description: `Booking marked as ${status}`,
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Handle 403 error for hold status
      if (error.response?.status === 403) {
        toast({
          title: "Action not allowed",
          description:
            error.response?.data?.message ||
            "This travel application is on hold",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Update failed",
          description: "Unable to update booking status",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Update Booking Status</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Hold Status Banner */}
        {isOnHold && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900">
                  Application On Hold - Cancellation Pending
                </h4>
                <p className="text-sm text-amber-800 mt-1">
                  This travel application has a pending cancellation request.
                  All booking actions are temporarily disabled until the
                  approver makes a decision.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-muted-foreground">
            Booking ID:{" "}
            <span className="font-mono text-foreground">
              BK-{String(booking.id).padStart(5, "0")}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Status *</Label>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={isOnHold}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="confirmed"
                  disabled={booking.ceo_approval_status === "rejected"}
                >
                  Confirmed
                  {booking.ceo_approval_status === "rejected" &&
                    " (CEO Rejected)"}
                </SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {booking.ceo_approval_status === "rejected" && (
              <p className="text-xs text-destructive">
                CEO has rejected this booking. Only cancellation is allowed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Actual Cost {status === "confirmed" ? "(Optional)" : ""}
            </Label>
            {booking.max_allowed_cost != null && (
              <p className="text-xs text-muted-foreground">
                Max allowed: ₹{booking.max_allowed_cost}
              </p>
            )}
            <input
              type="number"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              className="w-full h-10 rounded-md border px-3 text-sm"
              placeholder="Enter actual cost (optional)"
              disabled={isSubmitting || isOnHold}
            />

            {requiresCeoApproval() && (
              <p className="text-xs text-amber-600 font-medium">
                Cost exceeds allowed limit. CEO approval is required before
                confirmation.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks"
              disabled={isOnHold}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                id="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "Click to upload"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || requiresCeoApproval() || isOnHold}
            className={
              requiresCeoApproval()
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : ""
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving
              </>
            ) : isOnHold ? (
              "Actions On Hold"
            ) : requiresCeoApproval() ? (
              "Need CEO Approval"
            ) : (
              "Update Status"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

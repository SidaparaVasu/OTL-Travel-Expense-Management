import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { travelAPI } from "@/src/api/travel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronsUpDown,
  FileText,
  FileX,
  SearchX,
  CalendarClock,
  Receipt,
  Train,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/routes/routes";
import { CancellationRequestModal } from "./components/CancellationRequestModal";
import { CancellationConfirmationDialog } from "./components/CancellationConfirmationDialog";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const TravelCancellationRequest = () => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [applications, setApplications] = useState([]);
  const [application, setApplication] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingReason, setPendingReason] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await travelAPI.getMyApplications("all", 1);
        setApplications(res.data?.applications || []);
      } catch {
        toast.error("Failed to load travel requests");
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const handleSelect = (app) => {
    setSelectedId(String(app.id));
    setApplication(app);
    setOpen(false);
  };

  const handlePrepareSubmit = (reason: string) => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    setPendingReason(reason);
    setIsModalOpen(false);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!application) return;
    setIsRequesting(true);
    try {
      await travelAPI.requestCancellation(application.id, pendingReason);
      toast.success("Cancellation request submitted successfully");
      setIsConfirmDialogOpen(false);
      setIsModalOpen(false);
      navigate(ROUTES.travelApplicationList);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to submit cancellation request",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const isCancellable =
    application &&
    ![
      "cancelled",
      "completed",
      "cancellation_requested",
      "draft",
      "rejected",
    ].includes(application.status?.toLowerCase());

  const trip = application?.trip_details?.[0];
  const bookings = trip?.bookings || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              Travel Cancellation Request
            </h1>
            <p className="text-sm text-muted-foreground">
              {/* Submit a request to cancel your travel application */}
              Cancel your travel application
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <Card className="p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">
            Select Travel Application
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Search and select an active travel request you wish to cancel
          </p>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-12"
              >
                {application
                  ? `${application.travel_request_id} — ${application.purpose}`
                  : "Search by request ID or purpose"}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              align="start"
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              <Command>
                <CommandInput placeholder="Type to search..." />
                <CommandList>
                  <CommandEmpty>
                    {loading ? "Loading..." : "No results found"}
                  </CommandEmpty>
                  <CommandGroup>
                    {applications.map((app) => (
                      <CommandItem
                        key={app.id}
                        value={`${app.travel_request_id} ${app.purpose}`}
                        onSelect={() => handleSelect(app)}
                        className="py-3 px-4"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedId === String(app.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {app.travel_request_id}
                          </span>
                          <span className="text-xs text-muted-foreground italic truncate">
                            {app.purpose}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Card>

        {application && (
          <Card className="shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">
                  Travel Application Details
                </h3>
              </div>
              <StatusBadge statusType="travel" status={application.status} />
            </div>

            <div className="p-6 bg-slate-50 border-b flex gap-6 flex-wrap">
              <Info
                label="Last Updated"
                value={new Date(application.updated_at).toLocaleString()}
              />
              <Info label="Impact" value="Policy based cancellation" />
            </div>

            <div className="px-8 pt-8">
              <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-100">
                <p className="text-xs font-medium text-slate-500">Purpose</p>
                <p className="text-sm text-slate-800 mt-1 italic">
                  {application.purpose || "Not specified"}
                </p>
              </div>
            </div>

            {/* Show rejection reason if cancellation was rejected */}
            {application.cancellation_rejection_reason && (
              <div className="px-8 pt-4">
                <div className="p-4 rounded-lg bg-red-50/60 border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                        Previous Cancellation Request Rejected
                      </p>
                      <p className="text-sm text-red-800 mt-1">
                        {application.cancellation_rejection_reason}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <Info
                  label="Request ID"
                  value={application.travel_request_id}
                />
                <Info
                  label="Employee Grade"
                  value={application.employee_grade}
                />
                <Info label="Purpose" value={application.purpose} italic />
              </div>

              <div className="space-y-6">
                <Info
                  label="Route"
                  value={
                    trip
                      ? `${trip.from_location_name} → ${trip.to_location_name}`
                      : "N/A"
                  }
                />
                <Info
                  label="Travel Dates"
                  value={
                    trip
                      ? `${trip.departure_date} to ${trip.return_date}`
                      : "N/A"
                  }
                />
                <Info
                  label="Duration"
                  value={trip ? `${trip.duration_days} Days` : "N/A"}
                />
              </div>

              <div className="space-y-6">
                <Info
                  label="Sanction Number"
                  value={application.sanction_number || "N/A"}
                />
                <Info
                  label="Advance Amount"
                  value={
                    application.advance_amount
                      ? `₹${Number(application.advance_amount).toLocaleString("en-IN")}`
                      : "N/A"
                  }
                />
                <Info
                  label="Estimated Total Cost"
                  value={`₹${Number(application.estimated_total_cost).toLocaleString("en-IN")}`}
                />
              </div>
            </div>

            <div className="px-8 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <Train className="h-4 w-4 text-blue-600" /> Booking Summary
                </h4>
                <Badge
                  variant="secondary"
                  className="font-medium bg-slate-100 text-slate-700"
                >
                  Total Bookings: {bookings.length}
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="font-semibold text-slate-800">
                        Booking Mode
                      </TableHead>
                      <TableHead className="font-semibold text-slate-800">
                        Sub Option
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-800">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center py-6 text-muted-foreground"
                        >
                          No bookings found for this application
                        </TableCell>
                      </TableRow>
                    ) : (
                      bookings.map((b) => (
                        <TableRow key={b.id} className="hover:bg-slate-50/30">
                          <TableCell className="font-medium text-slate-900">
                            {b.booking_type_name}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {b.sub_option_name || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge
                              statusType="travel"
                              status={b.status}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="px-8 pb-8">
              {!isCancellable ? (
                <div className="p-6 bg-red-50 border-red-500 border rounded-xl flex gap-4">
                  <SearchX className="h-6 w-6 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-500">
                      Action Restricted
                    </p>
                    <p className="text-sm text-red-500">
                      This application is not eligible for cancellation. You may
                      review details or submit a new travel request.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-red-50 border-red-500 border p-6 rounded-xl">
                  <div className="flex gap-3 items-center">
                    <FileX className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-semibold text-red-500">
                        Travel Request Cancellation
                      </p>
                      <p className="text-sm text-red-500">
                        This will notify your reporting manager/approver(s).
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => setIsModalOpen(true)}
                    disabled={isRequesting}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>

      <CancellationRequestModal
        isOpen={isModalOpen && !isConfirmDialogOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handlePrepareSubmit}
        isLoading={isRequesting}
      />

      <CancellationConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmedSubmit}
        application={application}
        reason={pendingReason}
        isLoading={isRequesting}
      />
    </div>
  );
};

const Info = ({
  label,
  value,
  italic,
}: {
  label: string;
  value: any;
  italic?: boolean;
}) => (
  <div>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={cn("text-sm font-medium", italic && "italic")}>
      {value || "N/A"}
    </p>
  </div>
);

export default TravelCancellationRequest;

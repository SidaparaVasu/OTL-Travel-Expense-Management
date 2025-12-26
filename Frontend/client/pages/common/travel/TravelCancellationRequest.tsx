import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { travelAPI } from "@/src/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  SearchX,
  Check,
  ChevronsUpDown,
  FileX,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/routes/routes";
import { CancellationRequestModal } from "./components/CancellationRequestModal";
import { cn } from "@/lib/utils";

const TravelCancellationRequest: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [applications, setApplications] = useState<any[]>([]);
  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const navigate = useNavigate();

  // Load applications
  useEffect(() => {
    const fetchApps = async () => {
      setLoading(true);
      try {
        const res: any = await travelAPI.getMyApplications("all", 1);
        const apps = res.data?.applications || [];
        setApplications(apps);
      } catch (err) {
        console.error("Failed to load applications", err);
        toast.error("Failed to load your travel requests.");
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const handleSelect = (app: any) => {
    setSelectedId(String(app.id));
    setApplication(app);
    setOpen(false);
  };

  const handleCancelRequest = async (reason: string) => {
    if (!application) return;

    setIsRequesting(true);
    try {
      await travelAPI.requestCancellation(application.id, reason);
      toast.success(
        "Cancellation requested successfully. Your manager will be notified.",
      );
      setIsModalOpen(false);
      navigate(ROUTES.travelApplicationList);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Something went wrong while submitting the request.",
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
    ].includes(application.status.toLowerCase());

  // Helper to get travel mode from bookings
  const getTravelMode = () => {
    if (!application?.trip_details?.[0]?.bookings?.[0]) return "Standard";
    return (
      application.trip_details[0].bookings[0].booking_type_name || "Standard"
    );
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Travel Cancellation Request
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submit a request to cancel your travel application
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* SELECT TRAVEL APPLICATION (Combobox) */}
        <Card className="p-6 mb-8 bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] border-none">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800">
                Select Travel Application
              </h3>
              <p className="text-sm text-muted-foreground">
                Search and select an active travel request you wish to cancel
              </p>
            </div>
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between h-12 text-slate-700 font-normal border-slate-200 hover:text-black hover:bg-white focus:ring-1 focus:ring-blue-500"
              >
                {application
                  ? `${application.travel_request_id} — ${application.purpose}`
                  : "Search travel application by travel request ID or purpose..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
            >
              <Command className="border-none">
                <CommandInput
                  placeholder="Type travel request ID or purpose to search..."
                  className="h-11 border-none focus:ring-0"
                />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty className="py-6 text-slate-500">
                    {loading
                      ? "Syncing applications..."
                      : "No travel requests found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {applications.map((app) => (
                      <CommandItem
                        key={app.id}
                        value={`${app.travel_request_id} ${app.purpose}`}
                        onSelect={() => handleSelect(app)}
                        className="cursor-pointer py-3 px-4 aria-selected:bg-slate-900 aria-selected:text-slate-50 data-[selected=true]:bg-slate-900 data-[selected=true]:text-slate-50 transition-colors"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedId === String(app.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col gap-0.5 text-inherit">
                          <span className="font-bold">
                            {app.travel_request_id}
                          </span>
                          <span className="text-xs opacity-80 italic truncate max-w-[400px]">
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
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            {/* TRAVEL APPLICATION SUMMARY (Referenced from ApplicationView.tsx) */}
            <Card className="p-0 bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] border-none overflow-hidden mb-8">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Travel Application Details
                  </h3>
                </div>
                <StatusBadge statusType="travel" status={application.status} />
              </div>

              <div className="p-8">
                {/* Information Grid: 3 Columns, Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <InfoItem
                      label="Request ID"
                      value={application.travel_request_id}
                    />
                    <InfoItem
                      label="Employee Grade"
                      value={application.employee_grade}
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Purpose of Travel
                      </p>
                      <p className="text-sm text-slate-800 font-medium italic border-l-2 border-slate-100 pl-3">
                        "{application.purpose}"
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Route & Timing
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-800">
                          {application.trip_details?.[0]?.from_location_name} →{" "}
                          {application.trip_details?.[0]?.to_location_name}
                        </p>
                        <p className="text-xs text-slate-600">
                          {application.trip_details?.[0]?.departure_date} to{" "}
                          {application.trip_details?.[0]?.return_date}
                        </p>
                        <p className="text-xs text-slate-600">
                          Duration:{" "}
                          {application.trip_details?.[0]?.duration_days ||
                            application.total_duration_days ||
                            0}{" "}
                          Days
                        </p>
                      </div>
                    </div>
                    <InfoItem
                      label="Internal Order"
                      value={application.internal_order}
                    />
                    <InfoItem
                      label="GL Code"
                      value={application.gl_code_name}
                    />
                  </div>

                  <div className="space-y-6">
                    <InfoItem
                      label="Sanction Number"
                      value={application.sanction_number || "N/A"}
                    />
                    <InfoItem label="Travel Mode" value={getTravelMode()} />
                    <InfoItem
                      label="Estimated Total Cost"
                      value={`₹${Number(application.estimated_total_cost || 0).toLocaleString("en-IN")}`}
                    />
                  </div>
                </div>

                {/* Action Area */}
                <div className="mt-12 pt-8 border-t border-slate-50">
                  {!isCancellable ? (
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-center gap-5 text-slate-500">
                      <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                        <SearchX className="h-6 w-6 text-slate-300" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">
                          Action Restricted
                        </p>
                        <p className="text-sm font-medium opacity-80">
                          Applications in{" "}
                          <span className="text-slate-900 font-bold italic">
                            "{application.status}"
                          </span>{" "}
                          status are not eligible for cancellation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                          <FileX className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            Request Cancellation
                          </p>
                          <p className="text-xs text-slate-500 font-medium">
                            Initiates a formal review by your reporting manager.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => setIsModalOpen(true)}
                        className="h-12 px-10 rounded-xl text-sm font-bold shadow-lg shadow-red-100 hover:shadow-red-200 transition-all gap-2"
                        disabled={isRequesting}
                      >
                        {isRequesting ? (
                          "Submitting..."
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4 order-last" />
                            Continue Request
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      <CancellationRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCancelRequest}
        isLoading={isRequesting}
      />
    </div>
  );
};

/* InfoItem — small reusable pair referenced from ApplicationView.tsx */
const InfoItem = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <p className="text-sm text-slate-800 font-medium">{value ?? "N/A"}</p>
  </div>
);

export default TravelCancellationRequest;

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  buildClaimableBookingRow,
  getClosedBookingClosureInfo,
  isClaimableBookingForExpense,
  isClosedNonClaimableBooking,
} from "./claimBookingHelpers";
import {
  Upload,
  PlusCircle,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  X,
  FileText,
  Info,
  AlertTriangle,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DatePickerField } from "@/pages/common/travel/travel-request/components/DatePickerField";
import { TimePickerField } from "@/pages/common/travel/travel-request/components/TimePickerField";
import { expenseAPI } from "@/src/api/expense";
import { ROUTES } from "@/routes/routes";

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateStr: string, timeStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const calculateDuration = (
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) => {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T${startTime || "00:00"}`);
  const end = new Date(`${endDate}T${endTime || "23:59"}`);
  const diff = end.getTime() - start.getTime();

  if (diff < 0) return "Invalid Duration";

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0 && hours === 0) return "0 Hours";

  const parts = [];
  if (days > 0) parts.push(`${days} Days`);
  if (hours > 0) parts.push(`${hours} Hours`);

  return parts.join(" ");
};

export default function CreateClaimApplicationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: claimId } = useParams(); // Get claim ID from URL for edit mode

  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [expenseTypes, setExpenseTypes] = useState([]);

  const [bookingRows, setBookingRows] = useState<any[]>([]);
  const [closedNonClaimableBookings, setClosedNonClaimableBookings] = useState<
    any[]
  >([]);
  const [otherExpenses, setOtherExpenses] = useState<any[]>([]);
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);

  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // File upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentUploadItem, setCurrentUploadItem] = useState<any>(null);
  const [errors, setErrors] = useState<any>({});

  // Edit mode state
  const isEditMode = Boolean(claimId);
  const [existingClaim, setExistingClaim] = useState<any>(null);
  const [financeRemarks, setFinanceRemarks] = useState<string>("");

  // Actual Travel Dates State
  const [useActualDates, setUseActualDates] = useState(false);
  const [actualStartDate, setActualStartDate] = useState("");
  const [actualStartTime, setActualStartTime] = useState("");
  const [actualEndDate, setActualEndDate] = useState("");
  const [actualEndTime, setActualEndTime] = useState("");
  const [oneWayDistance, setOneWayDistance] = useState<string>("");
  const [claimRemark, setClaimRemark] = useState("");

  // Load applications + expenses
  useEffect(() => {
    // Load expense types
    expenseAPI.expenseTypes.getAll().then((res) => {
      if (res?.data) setExpenseTypes(res.data);
    });

    // If edit mode, fetch existing claim data
    if (isEditMode && claimId) {
      fetchExistingClaim(Number(claimId));
    } else {
      // Create mode - load claimable applications
      expenseAPI.claimableApps.getAll().then((res) => {
        if (res?.data) setApplications(res.data);
      });
    }
  }, [isEditMode, claimId]);

  // Fetch existing claim for edit mode
  const fetchExistingClaim = async (id: number) => {
    try {
      setLoading(true);
      const claim = await expenseAPI.claims.get(id);
      console.log("Fetched claim for editing:", claim);

      setExistingClaim(claim);

      // Pre-fill one_way_distance_km
      setOneWayDistance(claim.one_way_distance_km ? String(claim.one_way_distance_km) : "");
      setClaimRemark(claim.claim_remark || "");

      // Pre-fill actual travel dates if present
      if (claim.actual_travel_start_date) {
        setUseActualDates(true);
        setActualStartDate(claim.actual_travel_start_date);
        setActualStartTime(claim.actual_travel_start_time || "");
        setActualEndDate(claim.actual_travel_end_date || "");
        setActualEndTime(claim.actual_travel_end_time || "");
      }

      // Extract finance remarks if available
      if (claim.finance_action_logs && claim.finance_action_logs.length > 0) {
        const returnLog = claim.finance_action_logs.find(
          (log: any) => log.action === "return_to_applicant",
        );
        if (returnLog) {
          setFinanceRemarks(returnLog.remarks || "");
        }
      }

      // Pre-fill form with existing data
      // Note: selectedApp will be set from claim.travel_application
      // We'll need to fetch the travel application details
      // Pre-fill form with existing data
      let fullTravelApp: any = null;
      if (claim.travel_application) {
        try {
          // Fetch full travel application details to get bookings list
          // This is needed to match bookings if booking_id is missing in claim items
          const importTravelAPI = (await import("@/src/api/travel")).travelAPI;
          fullTravelApp = await importTravelAPI.getApplication(
            claim.travel_application,
          );
          console.log("Fetched full travel app:", fullTravelApp);

          // Normalize the app object to match structure expected by component
          // Use .data if present (standard API wrapper), otherwise fallback to the object itself
          const appData = fullTravelApp.data || fullTravelApp;

          const allBookings = [
            ...(appData.ticketing_bookings || []),
            ...(appData.accommodation_bookings || []),
            ...(appData.conveyance_bookings || []),
          ];

          const normalizedApp = {
            ...appData,
            id: claim.travel_application, // Ensure ID is present
            travel_request_id: appData.travel_request_id || claim.travel_request_id,
            bookings: allBookings,
          };

          setSelectedApp(normalizedApp);

          // Use normalized app for recovery logic below if needed
          fullTravelApp = normalizedApp;
        } catch (err) {
          console.error("Failed to fetch travel application details:", err);
          // Fallback to minimal app object
          setSelectedApp({
            id: claim.travel_application,
            travel_request_id: claim.travel_request_id,
          });
        }
      }

      // Pre-fill expense items
      if (claim.items && claim.items.length > 0) {
        const bookings: any[] = [];
        const others: any[] = [];

        claim.items.forEach((item: any) => {
          // Common fields for all expense items
          const expenseItem = {
            id: item.id,
            expense_type: String(item.expense_type),
            expense_date: item.expense_date,
            amount: item.amount || item.actual_cost || 0, // Use 'amount' or 'actual_cost'
            has_receipt: item.has_receipt,
            receipt_file: item.receipt_file || item.receipt_url || null,
            distance_km: item.distance_km || "",
            remarks: item.remarks || "",
          };

          // Try to recover booking_id if missing (for legacy/bugged data)
          let bookingId = item.booking_id;

          if (!bookingId && fullTravelApp && fullTravelApp.bookings) {
            // Heuristic: If expense type matches a booking type, assume it's that booking
            // This is a "soft" match to recover data that wasn't saved correctly in backend
            const matchedBooking = fullTravelApp.bookings.find(
              (b: any) =>
                b.booking_type === item.expense_type_display ||
                (item.expense_type_display === "Hotel" &&
                  b.booking_type === "Hotel"), // Example mapping
            );

            if (matchedBooking) {
              console.log(
                `Recovered booking ID for item ${item.id} (${item.expense_type_display}):`,
                matchedBooking.id,
              );
              bookingId = matchedBooking.id;
            }
          }

          // If item has booking_id (either from DB or recovered), it's a booking expense
          if (bookingId) {
            bookings.push({
              ...expenseItem,
              bookingId: bookingId,
              typeName: item.expense_type_display || "", // Backend returns expense_type_display
              subType: "", // Not available in edit mode
              estimated: item.estimated_cost || item.amount || 0,
              booking_file: item.receipt_file || item.receipt_url || null,
            });
          } else {
            // Otherwise it's an additional expense
            others.push(expenseItem);
          }
        });

        setBookingRows(bookings);
        setOtherExpenses(others);
      }
    } catch (error) {
      console.error("Error fetching claim:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load claim data for editing",
      });
      navigate(ROUTES.indexClaimPage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // When user selects Travel App
  const handleSelectApplication = (appId: string) => {
    const app = applications.find((a: any) => a.id === Number(appId));
    setSelectedApp(app);
    setErrors({});

    const rows: any[] = [];
    const notClaimableClosed: any[] = [];

    if (app?.trip_details) {
      app.trip_details.forEach((trip: any) => {
        trip.bookings?.forEach((booking: any) => {
          if (isClaimableBookingForExpense(booking)) {
            rows.push(buildClaimableBookingRow(booking, trip));
          } else if (isClosedNonClaimableBooking(booking)) {
            notClaimableClosed.push({
              ...booking,
              tripDepartureDate: trip.departure_date,
            });
          }
        });
      });
    }

    setBookingRows(rows);
    setClosedNonClaimableBookings(notClaimableClosed);
    setOtherExpenses([]);
  };

  // Add Other Expense Row
  const addOtherExpense = () => {
    setOtherExpenses((prev) => [
      ...prev,
      {
        id: Date.now(),
        expense_type: "",
        expense_date: "",
        amount: "",
        has_receipt: false,
        receipt_file: null,
        distance_km: "",
        remarks: "",
      },
    ]);
  };

  // Delete Other Expense Row
  const deleteOtherExpense = (id: number) => {
    setOtherExpenses((prev) => prev.filter((row) => row.id !== id));
  };

  // Open upload modal
  const openUploadModal = (
    item: any,
    type: "booking" | "other",
    index: number,
  ) => {
    setCurrentUploadItem({ item, type, index });
    setUploadModalOpen(true);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItem) return;

    const { type, index } = currentUploadItem;

    if (type === "booking") {
      setBookingRows((prev) => {
        const updated = [...prev];
        updated[index].receipt_file = file;
        updated[index].has_receipt = true;
        return updated;
      });
    } else {
      setOtherExpenses((prev) => {
        const updated = [...prev];
        updated[index].receipt_file = file;
        updated[index].has_receipt = true;
        return updated;
      });
    }

    setUploadModalOpen(false);
    setCurrentUploadItem(null);
  };

  const formatFieldName = (field: string) => {
    if (field.startsWith("items[")) {
      const match = field.match(/items\[(\d+)\]\.(.+)/);
      if (match) {
        const index = Number(match[1]) + 1;
        const subField = match[2].replace(/_/g, " ");
        return `Expense Item #${index} – ${subField}`;
      }
    }
    return field.replace(/_/g, " ");
  };

  const normalizeErrors = (apiErrors: any) => {
    if (!apiErrors) return [];

    const list: { field: string; message: string }[] = [];

    Object.entries(apiErrors).forEach(([field, messages]) => {
      const formattedField = formatFieldName(field);

      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          list.push({
            field: formattedField,
            message: msg,
          });
        });
      } else {
        list.push({
          field: formattedField,
          message: String(messages),
        });
      }
    });

    return list;
  };

  const buildJsonPayload = () => {
    return {
      travel_application_id: selectedApp.id,
      claim_id: isEditMode && claimId ? Number(claimId) : undefined,
      one_way_distance_km: oneWayDistance ? Number(oneWayDistance) : null,
      actual_travel_start_date: useActualDates ? actualStartDate : null,
      actual_travel_start_time: useActualDates ? actualStartTime : null,
      actual_travel_end_date: useActualDates ? actualEndDate : null,
      actual_travel_end_time: useActualDates ? actualEndTime : null,
      claim_remark: claimRemark,
      items: [
        ...bookingRows.map((b) => ({
          expense_type: Number(b.expense_type),
          expense_date: b.expense_date,
          amount: Number(b.amount),
          booking_id: b.bookingId,
          is_booking_expense: true, // EXPLICIT from frontend
          has_receipt: Boolean(b.has_receipt),
          distance_km: Number(b.distance_km) || 0,
          remarks: b.remarks || "",
        })),
        ...otherExpenses.map((o) => ({
          expense_type: Number(o.expense_type),
          expense_date: o.expense_date,
          amount: Number(o.amount),
          has_receipt: true,
          is_booking_expense: false, // EXPLICIT from frontend
          distance_km: Number(o.distance_km) || 0,
          remarks: o.remarks || "",
        })),
      ],
      acknowledged_warnings: Array.isArray(validationResult?.data?.warnings)
        ? validationResult.data.warnings
        : [],
      exception_reasons: [],
    };
  };

  const submitClaimJson = async () => {
    const payload = buildJsonPayload();
    console.log("payload: ", payload);
    return await expenseAPI.claims.submit(payload); // JSON POST
  };

  const fetchCreatedItems = async (claimId: number) => {
    const res = await expenseAPI.claims.get(claimId);
    console.log("expense data: ", res);
    return res?.items || [];
  };

  const uploadReceipts = async (claimId: number, createdItems: any[]) => {
    const formData = new FormData();

    const itemList = createdItems;
    const allItems = [...bookingRows, ...otherExpenses];

    allItems.forEach((row, index) => {
      if (row.receipt_file) {
        const itemId = itemList[index]?.id;

        if (!itemId) {
          console.error("❌ No item ID for index:", index);
          return;
        }

        formData.append("files", row.receipt_file);
        formData.append("items", itemId);
      }
    });

    if ([...formData.values()].length === 0) {
      return { success: true, message: "No receipts to upload" };
    }

    return await expenseAPI.claims.uploadReceipts(claimId, formData);
  };

  // VALIDATE CLAIM
  const handleValidate = async () => {
    setErrors({});
    setLoading(true);

    // Additional expenses MUST have receipt
    const additionalExpensesWithoutReceipts = otherExpenses.filter(
      (e) => !e.receipt_file,
    );
    if (additionalExpensesWithoutReceipts.length > 0) {
      setErrors({
        general: "All additional expenses must have a receipt / bill uploaded.",
      });
      setLoading(false);
      return;
    }

    // Claim remarks must be provided
    if (!claimRemark.trim()) {
      setErrors({
        general: "Claim remarks field is mandatory.",
        claim_remark: "Remarks field cannot be empty.",
      });
      setLoading(false);
      return;
    }

    const payload = buildJsonPayload();

    try {
      const response = await expenseAPI.claims.validate(payload);

      if (response?.success) {
        setValidationResult(response);
        setDeclarationConfirmed(false); // Reset declaration
        setValidationModalOpen(true);
      } else {
        const friendly = normalizeErrors(response?.data || response?.errors);

        // Build a flat map of field-specific errors to highlight inputs
        const fieldErrors: any = {};
        const apiErrors = response?.data || response?.errors || {};
        
        Object.entries(apiErrors).forEach(([key, value]) => {
          if (key === "items" && Array.isArray(value)) {
            value.forEach((itemError: any, index: number) => {
              if (itemError && typeof itemError === "object") {
                Object.entries(itemError).forEach(([subKey, subVal]) => {
                  const msg = Array.isArray(subVal) ? subVal[0] : String(subVal);
                  fieldErrors[`items.${index}.${subKey}`] = msg;
                });
              }
            });
          } else {
            const msg = Array.isArray(value) ? value[0] : String(value);
            fieldErrors[key] = msg;
          }
        });

        setErrors({
          general: "Please fix the highlighted issues before proceeding.",
          list: friendly,
          ...fieldErrors
        });
      }
    } catch (error: any) {
      const message = extractErrorMessage(error);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  // SUBMIT CLAIM (Create or Edit + Resubmit)
  const handleSubmit = async () => {
    if (!selectedApp) return;
    setLoading(true);

    try {
      if (isEditMode && claimId) {
        // EDIT MODE: Update claim and resubmit
        const editPayload = buildJsonPayload();

        // Call edit API
        const editResult = await expenseAPI.claims.edit(
          Number(claimId),
          editPayload,
        );
        console.log("EDIT RESULT:", editResult);

        if (!editResult?.success) {
          toast({
            variant: "destructive",
            title: "Edit Failed",
            description: editResult?.message || "Failed to update claim",
          });
          return;
        }

        // Upload receipts if any
        const createdItems = await fetchCreatedItems(Number(claimId));
        await uploadReceipts(Number(claimId), createdItems);

        // Call resubmit API
        const resubmitResult = await expenseAPI.claims.resubmit(
          Number(claimId),
        );
        console.log("RESUBMIT RESULT:", resubmitResult);

        if (resubmitResult?.success) {
          toast({
            title: "Success",
            description: "Claim updated and resubmitted successfully",
          });
          navigate(ROUTES.claimDetailPage(claimId));
        } else {
          toast({
            variant: "destructive",
            title: "Resubmit Failed",
            description: resubmitResult?.message || "Failed to resubmit claim",
          });
        }
      } else {
        // CREATE MODE: Normal submission flow
        const submitResult = await submitClaimJson();
        console.log("SUBMIT RESULT: ", submitResult);

        // SUCCESS FLOW
        if (submitResult?.success === true) {
          const newClaimId = submitResult.data.claim_id;
          console.log("claimID: ", newClaimId);

          const createdItems = await fetchCreatedItems(newClaimId);
          console.log("createdItems: ", createdItems);
          const uploadRecieptRes = await uploadReceipts(
            newClaimId,
            createdItems,
          );
          console.log("Upload Res: ", uploadRecieptRes);

          toast({
            title: "Success",
            description: submitResult.message || "Claim submitted successfully",
          });

          navigate(ROUTES.indexClaimPage);
          return;
        }

        // BACKEND SENT success = false → VALIDATION ERRORS
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: submitResult?.message || "Validation failed.",
        });
      }
    } catch (error) {
      // NETWORK/UNEXPECTED ERRORS ONLY
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: "Unable to submit claim. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExpenseTypeName = (id: string | number) => {
    const type = expenseTypes.find((t: any) => t.id === Number(id));
    return type?.name || "";
  };

  const extractErrorMessage = (error: any) => {
    const api = error?.response?.data;
    return (
      api?.message || api?.detail || "Something went wrong. Please try again."
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-slate-50 text-black text-muted-foreground hover:text-foreground hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {isEditMode ? "Edit Expense Claim" : "Create Expense Claim"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEditMode
                  ? "Update your claim and resubmit for verification"
                  : "Submit eligible expenses for your completed travel"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* FINANCE FEEDBACK ALERT - Only in edit mode */}
        {isEditMode && financeRemarks && (
          <Alert className="mb-6 border-orange-300 bg-orange-50">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <AlertDescription className="ml-2">
              <div>
                <p className="font-semibold text-orange-900 mb-2">
                  Finance Feedback:
                </p>
                <p className="text-sm text-orange-800 italic">
                  "{financeRemarks}"
                </p>
                <p className="text-xs text-orange-700 mt-2">
                  Please review the feedback above, make necessary corrections,
                  and resubmit your claim.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* SELECT TRAVEL APPLICATION - Hide in edit mode */}
        {!isEditMode && (
          <Card className="p-6 mb-6 bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-medium text-foreground mb-1">
                  Select Completed Travel Application
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose an approved travel request to create expense claims
                </p>
              </div>
            </div>

            <Select onValueChange={handleSelectApplication}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select completed travel application" />
              </SelectTrigger>
              <SelectContent>
                {applications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No claimable applications found
                    </p>
                  </div>
                ) : (
                  applications.map((app: any) => (
                    <SelectItem key={app.id} value={String(app.id)}>
                      {app.travel_request_id} — {app.purpose}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Card>
        )}

        {selectedApp && (
          <>
            {/* TRAVEL APPLICATION SUMMARY */}
            <Card className="p-6 mb-6">
              <h3 className="text-sm font-semibold text-black mb-4">
                Travel Application Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">
                      Request ID
                    </span>
                    <p className="font-medium text-foreground">
                      {selectedApp.travel_request_id || "N/A"}
                    </p>
                  </div>
                </div>
                {selectedApp.trip_details && selectedApp.trip_details[0] && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          Travel Period
                        </span>
                        <p className="font-medium text-foreground">
                          {selectedApp.trip_details[0].departure_date} →{" "}
                          {selectedApp.trip_details[0].return_date}
                          <span className="font-xs text-slate-500 ml-2">
                            ({selectedApp.total_duration_days || 0} days)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          Trip Location
                        </span>
                        <p className="font-medium text-foreground">
                          {selectedApp.trip_details[0].from_location_name} →{" "}
                          {selectedApp.trip_details[0].to_location_name}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* ACTUAL DATE AND TIME SELECTION AREA */}
            <Card className="p-6 mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <h3 className="text-lg font-semibold">
                  DA & Incidentals Calculation Basis
                </h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        <span>
                          Select “Use Actual Travel Date & Time” only if your
                          actual travel duration differed from the approved
                          schedule.
                        </span>
                        <br />
                        <span>
                          DA & Incidentals will be calculated based on the
                          selected option.
                        </span>
                        <br />
                        <span>
                          <b>Note:</b> Actual dates must fall within the
                          approved trip window.
                        </span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <RadioGroup
                value={useActualDates ? "actual" : "approved"}
                onValueChange={(val) => {
                  if (val === "actual") {
                    setUseActualDates(true);
                  } else {
                    setUseActualDates(false);
                  }
                }}
                className="flex flex-col space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="approved" id="r-approved" />
                  <Label htmlFor="r-approved">
                    Use Approved Trip Schedule (Recommended)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="actual" id="r-actual" />
                  <Label htmlFor="r-actual">
                    Calculate based on Actual Travel Date & Time
                  </Label>
                </div>
              </RadioGroup>

              {/* DURATION PREVIEW (Use Approved) */}
              {!useActualDates && selectedApp?.trip_details?.[0] && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                    Calculation Basis (Approved)
                  </p>
                  <p className="font-medium text-sm">
                    {formatDateTime(
                      selectedApp.trip_details[0].departure_date,
                      selectedApp.trip_details[0].departure_time,
                    )}
                    {" → "}
                    {formatDateTime(
                      selectedApp.trip_details[0].return_date,
                      selectedApp.trip_details[0].return_time,
                    )}
                  </p>
                  <p className="text-sm font-semibold text-primary mt-1">
                    Duration:{" "}
                    {calculateDuration(
                      selectedApp.trip_details[0].departure_date,
                      selectedApp.trip_details[0].departure_time,
                      selectedApp.trip_details[0].return_date,
                      selectedApp.trip_details[0].return_time,
                    )}
                  </p>
                </div>
              )}

              {useActualDates && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <DatePickerField
                        label="Actual Start Date"
                        required
                        value={actualStartDate}
                        onChange={(val) => setActualStartDate(val)}
                        min={selectedApp?.trip_details?.[0]?.departure_date}
                        max={selectedApp?.trip_details?.[0]?.return_date}
                        // Disable error prop for now or pass local error if needed
                      />
                      <TimePickerField
                        label="Actual Start Time"
                        required
                        value={actualStartTime}
                        onChange={(val) => setActualStartTime(val)}
                      />
                    </div>

                    <div className="space-y-2">
                      <DatePickerField
                        label="Actual End Date"
                        required
                        value={actualEndDate}
                        onChange={(val) => setActualEndDate(val)}
                        min={
                          actualStartDate ||
                          selectedApp?.trip_details?.[0]?.departure_date
                        }
                        max={selectedApp?.trip_details?.[0]?.return_date}
                      />
                      <TimePickerField
                        label="Actual End Time"
                        required
                        value={actualEndTime}
                        onChange={(val) => setActualEndTime(val)}
                      />
                    </div>

                    {actualEndDate &&
                      actualStartDate &&
                      actualEndDate < actualStartDate && (
                        <p className="text-destructive text-sm col-span-2">
                          End date cannot be before start date.
                        </p>
                      )}
                  </div>

                  {/* INFO BOX & WARNING */}
                  {actualStartDate && actualEndDate && (
                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-blue-600 uppercase font-semibold mb-1">
                            Calculation Basis (Actual)
                          </p>
                          <p className="font-medium text-sm text-slate-700">
                            {formatDateTime(actualStartDate, actualStartTime)}
                            {" → "}
                            {formatDateTime(actualEndDate, actualEndTime)}
                          </p>
                          <p className="text-sm font-semibold text-blue-700 mt-1">
                            Duration:{" "}
                            {calculateDuration(
                              actualStartDate,
                              actualStartTime,
                              actualEndDate,
                              actualEndTime,
                            )}
                          </p>

                          <div className="mt-3 flex items-center gap-2 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-100 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            Changing travel duration may affect DA & Incidentals
                            amount.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-border space-y-2">
                <Label htmlFor="one-way-distance" className="text-sm font-semibold flex items-center gap-1.5">
                  One-Way Trip Distance (in K.M.) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Input
                      id="one-way-distance"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter distance"
                      value={oneWayDistance}
                      onChange={(e) => setOneWayDistance(e.target.value)}
                      className={errors.one_way_distance_km ? "border-destructive pr-12" : "pr-12"}
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">K.M.</span>
                  </div>
                  <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-100 flex items-start gap-1.5">
                    <Info className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <span>
                      <strong>Policy Rule:</strong> One-way distance must be greater than 50 K.M. and travel duration must be greater than 8 hours to calculate Daily Allowance (DA) & Incidentals.
                    </span>
                  </p>
                </div>
                {errors.one_way_distance_km && (
                  <p className="text-xs text-destructive mt-1 font-medium">{errors.one_way_distance_km}</p>
                )}
              </div>
            </Card>

            {closedNonClaimableBookings.length > 0 && (
              <Card className="p-6 mb-6 border-amber-200 bg-amber-50/40">
                <h3 className="text-base font-medium text-foreground mb-2">
                  Closed Bookings — Not Claimable
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Travel Desk closed these bookings and marked them as not
                  eligible for reimbursement. Details are shown for your
                  reference.
                </p>
                <div className="space-y-3">
                  {closedNonClaimableBookings.map((booking) => {
                    const info = getClosedBookingClosureInfo(booking);
                    return (
                      <div
                        key={booking.id}
                        className="rounded-md border border-amber-200 bg-white p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium text-slate-900">
                            {booking.booking_type_name}
                            {booking.sub_option_name
                              ? ` (${booking.sub_option_name})`
                              : ""}
                          </span>
                          <Badge variant="outline" className="text-red-700 border-red-200">
                            Closed — Claim Not Allowed
                          </Badge>
                        </div>
                        {info.closureReason ? (
                          <p className="text-slate-700">
                            <span className="font-medium">Closure reason: </span>
                            {info.closureReason}
                          </p>
                        ) : null}
                        {info.claimDecisionReason ? (
                          <p className="text-slate-700 mt-1">
                            <span className="font-medium">
                              Why claim is not allowed:{" "}
                            </span>
                            {info.claimDecisionReason}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* BOOKING EXPENSES TABLE */}
            <Card className="p-6 mb-6">
              <h3 className="text-base font-medium text-foreground mb-4">
                Claim Items — Bookings
              </h3>

              {bookingRows.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  No claimable booking line items for this travel application.
                </p>
              )}

              <div className="overflow-x-auto no-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead className="min-w-[180px]">
                        Expense Type *
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Travel Mode
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Expense Date *
                      </TableHead>
                      <TableHead className="min-w-[100px]">
                        Distance (km)
                      </TableHead>
                      <TableHead className="min-w-[120px]">
                        Advance Taken
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Actual Amount *
                      </TableHead>
                      <TableHead className="min-w-[200px]">Receipt</TableHead>
                      <TableHead className="min-w-[200px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {bookingRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>

                        <TableCell>
                          <Select
                            value={String(row.expense_type)}
                            onValueChange={(value) => {
                              setBookingRows((prev) => {
                                const updated = [...prev];
                                updated[index].expense_type = value;
                                return updated;
                              });
                            }}
                          >
                            <SelectTrigger
                              className={
                                errors[`items.${index}.expense_type`]
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypes.map((e: any) => (
                                <SelectItem key={e.id} value={String(e.id)}>
                                  {e.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            {row.typeName}
                            {row.subType && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({row.subType})
                              </span>
                            )}
                            {/* {row.isDeskClosed && (
                              <div className="mt-1 space-y-1">
                                Desk Closed — Claim Allowed
                                {row.closureReason ? (
                                  <p className="text-xs text-muted-foreground">
                                    {row.closureReason}
                                  </p>
                                ) : null}
                              </div>
                            )} */}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Input
                            type="date"
                            value={row.expense_date}
                            onChange={(e) => {
                              setBookingRows((prev) => {
                                const updated = [...prev];
                                updated[index].expense_date = e.target.value;
                                return updated;
                              });
                            }}
                            className={`bg-muted ${errors[`items.${index}.expense_date`] ? "border-destructive" : ""}`}
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.distance_km}
                            onChange={(e) => {
                              setBookingRows((prev) => {
                                const updated = [...prev];
                                updated[index].distance_km = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="0"
                            className={
                              errors[`items.${index}.distance_km`]
                                ? "border-destructive"
                                : ""
                            }
                            min={0}
                            step={0.01}
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            value={`₹${row.estimated}`}
                            disabled
                            className="bg-muted"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.amount}
                            onChange={(e) => {
                              setBookingRows((prev) => {
                                const updated = [...prev];
                                updated[index].amount = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="0"
                            className={
                              errors[`items.${index}.amount`]
                                ? "border-destructive"
                                : ""
                            }
                            min={0}
                            step={0.01}
                          />
                        </TableCell>

                        <TableCell>
                          {row.receipt_file ? (
                            // Claim receipt exists
                            <a
                              href={row.receipt_file}
                              target="_blank"
                              className="text-blue-600 underline"
                            >
                              View Receipt
                            </a>
                          ) : row.booking_file ? (
                            // Booking file exists from Travel Application
                            <a
                              href={row.booking_file}
                              target="_blank"
                              className="text-blue-600 underline"
                            >
                              View Booking File
                            </a>
                          ) : (
                            // No existing file → allow upload
                            <Checkbox
                              checked={row.has_receipt}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  openUploadModal(row, "booking", index);
                                } else {
                                  setBookingRows((prev) => {
                                    const updated = [...prev];
                                    updated[index].has_receipt = false;
                                    updated[index].receipt_file = null;
                                    return updated;
                                  });
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        {/* <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={row.has_receipt}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  openUploadModal(row, 'booking', index);
                                } else {
                                  setBookingRows(prev => {
                                    const updated = [...prev];
                                    updated[index].has_receipt = false;
                                    updated[index].receipt_file = null;
                                    return updated;
                                  });
                                }
                              }}
                            />
                            {row.receipt_file ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {row.receipt_file.name || row.receipt_file}
                              </span>
                            ) : (
                              <span className="text-xs text-red-500">Receipt required</span>
                            )}
                          </div>
                        </TableCell> */}

                        <TableCell>
                          <Input
                            value={row.remarks}
                            onChange={(e) => {
                              setBookingRows((prev) => {
                                const updated = [...prev];
                                updated[index].remarks = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="Optional"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* OTHER EXPENSES */}
            <Card className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-medium text-foreground">
                  Additional Expenses
                </h3>
                <Button onClick={addOtherExpense} variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              </div>

              {otherExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No additional expenses added
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[180px]">
                          Expense Type *
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          Expense Date *
                        </TableHead>
                        <TableHead className="min-w-[100px]">
                          Distance (km)
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          Amount Spent*
                        </TableHead>
                        <TableHead className="min-w-[180px]">
                          Receipt * (Mandatory)
                        </TableHead>
                        <TableHead className="min-w-[200px]">Remarks</TableHead>
                        <TableHead className="w-[80px]">Remove</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {otherExpenses.map((row, index) => {
                        const itemIndex = bookingRows.length + index;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-center font-medium text-muted-foreground">
                              {bookingRows.length + index + 1}
                            </TableCell>

                            <TableCell>
                              <Select
                                value={String(row.expense_type)}
                                onValueChange={(value) => {
                                  setOtherExpenses((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, expense_type: value }
                                        : r,
                                    ),
                                  );
                                }}
                              >
                                <SelectTrigger
                                  className={
                                    errors[`items.${itemIndex}.expense_type`]
                                      ? "border-destructive"
                                      : ""
                                  }
                                >
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseTypes.map((e: any) => (
                                    <SelectItem key={e.id} value={String(e.id)}>
                                      {e.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell>
                              <Input
                                type="date"
                                value={row.expense_date}
                                onChange={(e) =>
                                  setOtherExpenses((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, expense_date: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                className={
                                  errors[`items.${itemIndex}.expense_date`]
                                    ? "border-destructive"
                                    : ""
                                }
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                value={row.distance_km}
                                onChange={(e) =>
                                  setOtherExpenses((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, distance_km: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                placeholder="0"
                                className={
                                  errors[`items.${itemIndex}.distance_km`]
                                    ? "border-destructive"
                                    : ""
                                }
                                min={0}
                                step={0.01}
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                value={row.amount}
                                onChange={(e) =>
                                  setOtherExpenses((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, amount: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                placeholder="0"
                                className={
                                  errors[`items.${itemIndex}.amount`]
                                    ? "border-destructive"
                                    : ""
                                }
                                min={0}
                                step={0.01}
                              />
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openUploadModal(row, "other", index)
                                  }
                                  className={
                                    !row.receipt_file
                                      ? "border-destructive"
                                      : "border-green-500"
                                  }
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  {row.receipt_file ? "Change" : "Upload"}
                                </Button>
                                {row.receipt_file && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {row.receipt_file.name}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Input
                                value={row.remarks}
                                onChange={(e) =>
                                  setOtherExpenses((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, remarks: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                placeholder="Optional"
                              />
                            </TableCell>

                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteOtherExpense(row.id)}
                                className="text-destructive hover:text-destructive hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {/* Claim Remarks Card */}
            <Card className="p-6 mb-6 bg-white shadow-sm border border-slate-200">
              <div className="space-y-2">
                <Label htmlFor="claim-remark" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  Claim Remarks <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="claim-remark"
                  rows={4}
                  value={claimRemark}
                  onChange={(e) => {
                    setClaimRemark(e.target.value);
                    if (errors.claim_remark) {
                      setErrors((prev: any) => {
                        const updated = { ...prev };
                        delete updated.claim_remark;
                        return updated;
                      });
                    }
                  }}
                  placeholder="Enter detailed remarks for this claim submission..."
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.claim_remark
                      ? "border-destructive bg-destructive/5"
                      : "border-slate-300 bg-white"
                  }`}
                />
                {errors.claim_remark && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {errors.claim_remark}
                  </p>
                )}
              </div>
            </Card>

            {/* ERROR DISPLAY */}
            {errors.general && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <AlertDescription className="ml-2">
                  <p className="font-semibold">{errors.general}</p>
                  {errors.list && errors.list.length > 0 && (
                    <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                      {errors.list.map((err: any, idx: number) => (
                        <li key={idx}>
                          <strong>{err.field}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={loading}
              >
                {loading ? "Validating..." : "Validate Claim"}
              </Button>
            </div>
          </>
        )}
      </main>

      {/* FILE UPLOAD MODAL */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Receipt/Bill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary hover:text-primary/80 font-medium">
                  Click to upload
                </span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </label>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <p className="text-xs text-muted-foreground mt-2">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>

            {currentUploadItem?.type === "other" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Receipt is mandatory for additional expenses
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VALIDATION MODAL */}
      <Dialog open={validationModalOpen} onOpenChange={setValidationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validationResult?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">Validation Successful</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-red-600">Validation Failed</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {validationResult?.errors &&
              Object.keys(validationResult.errors).length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(validationResult.errors, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}

            {validationResult?.data?.warnings &&
              Object.keys(validationResult.data.warnings).length > 0 && (
                <Alert className="border-yellow-500 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Warnings:</strong>
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {Object.values(validationResult.data.warnings)
                        .flat()
                        .map((w: any, idx: number) => (
                          <li key={idx}>{w.message || w}</li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

            {validationResult?.success && (
              <div className="space-y-6">
                {/* DA Breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    Daily Allowance Breakdown
                  </h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">
                            Date
                          </th>
                          <th className="text-center px-4 py-2 font-medium">
                            Duration (hrs)
                          </th>
                          <th className="text-center px-4 py-2 font-medium">
                            DA
                          </th>
                          <th className="text-right px-4 py-2 font-medium">
                            Incidental
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validationResult.data.computed.da_breakdown.map(
                          (day, index: number) => (
                            <tr key={index}>
                              <td className="px-4 py-2">
                                {formatDate(day.date)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {day.duration_hours}
                              </td>
                              <td className="px-4 py-2 text-center font-medium">
                                {formatCurrency(day.da)}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {formatCurrency(day.incidental)}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    Claim Summary
                  </h3>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total DA</span>
                      <span className="font-medium">
                        {formatCurrency(
                          validationResult.data.computed.total_da,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total Incidental</span>
                      <span className="font-medium">
                        {formatCurrency(
                          validationResult.data.computed.total_incidental,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total Expenses</span>
                      <span className="font-medium">
                        {formatCurrency(
                          validationResult.data.computed.total_expenses,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm bg-muted">
                      <span className="text-foreground">Gross Total</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          validationResult.data.computed.gross_total,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Advance Received</span>
                      <span className="font-medium text-warning text-red-600">
                        -
                        {formatCurrency(
                          validationResult.data.computed.advance_received,
                        )}
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-primary/5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">
                          Final Amount
                        </span>

                        <span
                          className={`text-lg font-bold ${
                            Number(
                              validationResult.data.computed.final_amount,
                            ) < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatCurrency(
                            validationResult.data.computed.final_amount,
                          )}
                        </span>
                      </div>

                      {/* User-friendly info message */}
                      <p
                        className={`text-xs mt-1 text-right ${
                          Number(validationResult.data.computed.final_amount) <
                          0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {Number(validationResult.data.computed.final_amount) < 0
                          ? "The amount will be recovered from you."
                          : "The amount is payable to you."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2 my-4 p-4 bg-slate-50 rounded-md border border-slate-200">
                  <Checkbox
                    id="declaration"
                    checked={declarationConfirmed}
                    onCheckedChange={(checked) =>
                      setDeclarationConfirmed(checked as boolean)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="declaration"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I hereby declare that the expenses claimed are genuine and
                      incurred for official purposes.
                    </label>
                    <p className="text-sm text-muted-foreground">
                      This is to certify that all the information filled in by
                      me is true. Amount claimed by me is as per entitlements.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      I understand that any misrepresentation may lead to
                      disciplinary action.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    variant="outline"
                    className="hover:bg-slate-50 hover:text-foreground uppercase"
                    onClick={() => setValidationModalOpen(false)}
                  >
                    Review & Edit
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="uppercase"
                    disabled={loading || !declarationConfirmed}
                  >
                    {loading ? "Submitting..." : "Submit Claim"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTravelStore } from "@/src/store/travelStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  Search,
  Clock,
  CheckCircle,
  ClipboardList,
  SquarePen,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, SendHorizontal, Eye, Trash2, Edit } from "lucide-react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/routes/routes";
import { travelAPI } from "@/src/api/travel";

function Pagination({ pagination, onPageChange }) {
  if (!pagination) return null;

  const { current_page, total_pages, next, previous } = pagination;

  const [jumpPage, setJumpPage] = useState("");

  const handleJump = () => {
    const pageNum = parseInt(jumpPage);
    if (!pageNum || pageNum < 1 || pageNum > total_pages) return;
    onPageChange(pageNum);
    setJumpPage("");
  };

  return (
    <div
      className="
      sticky bottom-0 left-0 right-0 
      bg-white 
      border-t 
      mt-4 
      py-4 
      px-3 
      flex flex-col gap-3 
      md:flex-row md:items-center md:justify-between
      z-20
    "
    >
      {/* LEFT — Jump to page */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Jump to:</span>

        <Input
          value={jumpPage}
          onChange={(e) => setJumpPage(e.target.value)}
          className="w-16 h-8 text-center"
          placeholder="Page"
          type="number"
          min={1}
          max={total_pages}
        />

        <Button
          variant="default"
          size="sm"
          className="h-8 px-3"
          onClick={handleJump}
        >
          Go
        </Button>
      </div>

      {/* CENTER — Page Numbers (Responsive) */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!previous}
          onClick={() => onPageChange(current_page - 1)}
          className="h-8"
        >
          Previous
        </Button>

        {/* Page Numbers */}
        <div className="flex flex-wrap gap-1 justify-center">
          {Array.from({ length: total_pages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              size="sm"
              variant={page === current_page ? "default" : "outline"}
              className={`h-8 px-3 ${
                page === current_page
                  ? "bg-blue-600 text-white"
                  : "border-gray-300"
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => onPageChange(current_page + 1)}
          className="h-8"
        >
          Next
        </Button>
      </div>

      {/* RIGHT — Total pages */}
      <div className="text-sm text-gray-600 text-center md:text-right">
        Page <b>{current_page}</b> of <b>{total_pages}</b>
      </div>
    </div>
  );
}

export default function TravelApplicationList() {
  const [page, setPage] = useState(1);
  const {
    applications,
    stats,
    pagination,
    isLoading,
    loadApplications,
    loadStats,
    submitApplication,
    deleteApplication,
  } = useTravelStore();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("active");
  const [pendingCancellations, setPendingCancellations] = useState<any[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  useEffect(() => {
    loadApplications(statusFilter, page);
    loadStats();
  }, [statusFilter, page]);

  useEffect(() => {
    if (activeTab === "pending_cancellation") {
      fetchPendingCancellations();
    }
  }, [activeTab]);

  const fetchPendingCancellations = async () => {
    try {
      const res: any = await travelAPI.getMyApplications(
        "cancellation_requested",
        1,
      );
      const apps = res?.data?.applications || res || [];
      setPendingCancellations(Array.isArray(apps) ? apps : []);
    } catch (err) {
      toast.error("Failed to load pending cancellations");
    }
  };

  const handleWithdraw = async (applicationId: number) => {
    if (
      !confirm("Are you sure you want to withdraw this cancellation request?")
    ) {
      return;
    }

    setWithdrawingId(applicationId);
    try {
      await travelAPI.withdrawCancellation(applicationId);
      toast.success("Cancellation request withdrawn successfully");
      fetchPendingCancellations();
      loadApplications(statusFilter, page); // Refresh main list
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Failed to withdraw cancellation request",
      );
    } finally {
      setWithdrawingId(null);
    }
  };

  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: (id: number) => travelAPI.submitApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] }); // refresh list
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => travelAPI.deleteApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] }); // refresh list
    },
  });

  function extractErrorMessage(error: any): string {
    if (!error) return "Something went wrong.";

    // 1. If backend returned the nested error as a Python string
    if (typeof error === "string") {
      const msg = parsePythonErrorString(error);
      if (msg) return msg;
      return error;
    }

    // 2️. If it's an array
    if (Array.isArray(error)) {
      return extractErrorMessage(error[0]);
    }

    // 3️. If it's an object
    if (typeof error === "object") {
      const firstKey = Object.keys(error)[0];
      return extractErrorMessage(error[firstKey]);
    }

    return "Unexpected error occurred.";
  }

  function parsePythonErrorString(pyString: string): string | null {
    // Extract content inside ErrorDetail(string='...')
    const regex = /ErrorDetail\(string='([^']+)'/;
    const match = pyString.match(regex);

    if (match && match[1]) {
      return match[1];
    }

    // Extract plain text after "{'duplicate': "
    const altRegex = /'([^']+)'/;
    const altMatch = pyString.match(altRegex);

    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }

    return null;
  }

  const handleSubmitApplication = async (id: number) => {
    try {
      await submitApplication(id);
      toast.success("Application submitted successfully");
    } catch (error: any) {
      console.error("Failed to save draft:", error);
      console.log("RAW ERROR:", error.response?.data);
      console.log("RAW ERRORS:", error.response?.data?.errors);

      const responseData = error.response?.data;
      const backendErrors = responseData?.errors;
      let message = extractErrorMessage(backendErrors);

      // 1. If we got a generic extraction result but have a specific top-level message, use that
      if (
        message === "Something went wrong." ||
        message === "Unexpected error occurred."
      ) {
        if (responseData?.message) {
          message = responseData.message;
        } else if (responseData && typeof responseData === "object") {
          // Fallback: Try extracting from the root object (if response is unwrapped errors)
          const retry = extractErrorMessage(responseData);
          if (
            retry !== "Something went wrong." &&
            retry !== "Unexpected error occurred."
          ) {
            message = retry;
          }
        }
      }

      toast.error(message || "Failed to submit application");
    }
  };

  const handleDeleteApplication = async (id: number) => {
    if (confirm("Are you sure you want to delete this application?")) {
      try {
        // await deleteMutation.mutate(id);
        await deleteApplication(id);
        toast.success("Application deleted successfully");
      } catch (error) {
        toast.error("Failed to delete application");
      }
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "N/A";

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "N/A";

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    if (startDate === endDate) {
      return formatDate(start);
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold">My Travel Applications</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track your travel requests, approvals, and booking progress in one
            place.
          </p>
        </div>
        <Button onClick={() => navigate(ROUTES.makeTravelApplicationNew)}>
          <Plus className="w-4 h-4 mr-2" />
          New Application
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-blue-50 flex items-center justify-center">
                  <ClipboardList className="h-7 w-7 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.total_applications}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Applications
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-gray-100 flex items-center justify-center">
                  <SquarePen className="h-7 w-7 text-gray-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.draft}
                  </div>
                  <div className="text-sm text-muted-foreground">Draft(s)</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.pending}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Remaining submissions
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.approved}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Approved applications
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        {/* Filters */}
        <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by employee name or request ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                <TabsList className="grid grid-cols-2 h-10">
                  <TabsTrigger value="active" className="px-4">
                    Active Requests
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending_cancellation"
                    className="flex items-center gap-2 px-4"
                  >
                    Cancellations
                    {pendingCancellations.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0.5 text-[10px] font-bold"
                      >
                        {pendingCancellations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Contents */}
        <div className="space-y-4">
          {/* Active Tab - Existing Applications Table */}
          <TabsContent value="active" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>My Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead className="max-w-[200px]">Purpose</TableHead>
                        <TableHead className="max-w-2xs">Dates</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-gray-500"
                          >
                            {statusFilter === "all" &&
                              "No travel applications found. Create your first travel application."}
                            {statusFilter === "pending" &&
                              "No pending applications found."}
                            {statusFilter === "approved" &&
                              "No approved applications found."}
                            {statusFilter === "rejected" &&
                              "No rejected applications found."}
                            {statusFilter === "draft" &&
                              "No draft applications found."}
                            {statusFilter === "completed" &&
                              "No completed applications found."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        applications.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell className="font-medium">
                              {app.travel_request_id}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate"
                              title={app.purpose}
                            >
                              {app.purpose}
                            </TableCell>
                            <TableCell className="max-w-2xs">
                              {formatDateRange(
                                app.trip_details[0].departure_date,
                                app.trip_details[0].return_date,
                              )}
                            </TableCell>
                            <TableCell>
                              ₹
                              {parseFloat(
                                app.estimated_total_cost,
                              ).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge
                                statusType="travel"
                                status={app.status}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {app.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() =>
                                      handleSubmitApplication(app.id)
                                    }
                                  >
                                    <SendHorizontal /> Submit
                                  </Button>
                                )}
                                {app.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-red-600 text-white hover:bg-red-700"
                                    onClick={() =>
                                      handleDeleteApplication(app.id)
                                    }
                                  >
                                    <Trash2 className="w-2 h-2" /> Delete
                                  </Button>
                                )}
                                {app.can_edit && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                                    onClick={() =>
                                      navigate(
                                        ROUTES.editTravelApplication(app.id)
                                      )
                                    }
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="hover:bg-dark-200 hover:text-dark-foreground"
                                  onClick={() =>
                                    navigate(
                                      ROUTES.travelApplicationView(app.id),
                                    )
                                  }
                                >
                                  <Eye className="w-2 h-2" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  pagination={pagination}
                  onPageChange={(newPage) => setPage(newPage)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Cancellation Tab */}
          <TabsContent value="pending_cancellation">
            {pendingCancellations.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No pending cancellation requests
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingCancellations.map((app) => (
                  <Card
                    key={app.id}
                    className={`border-l-4 ${
                      app.status === "cancelled"
                        ? "border-l-red-500"
                        : "border-l-amber-500"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {app.status === "cancelled" ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600" />
                          )}
                          <div>
                            <h4 className="font-semibold text-sm">
                              {app.travel_request_id}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {app.purpose}
                            </p>
                          </div>
                        </div>
                        <StatusBadge statusType="travel" status={app.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Cancellation Reason */}
                      <div
                        className={`p-3 rounded ${
                          app.status === "cancelled"
                            ? "bg-red-50"
                            : "bg-amber-50"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold mb-1 ${
                            app.status === "cancelled"
                              ? "text-red-600"
                              : "text-amber-900"
                          }`}
                        >
                          Cancellation Reason
                        </p>
                        <p
                          className={`text-sm italic ${
                            app.status === "cancelled"
                              ? "text-red-600"
                              : "text-amber-800"
                          }`}
                        >
                          {app.cancellation_reason || (
                            <span className="text-amber-600/50">
                              No reason provided
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Trip Details */}
                      {app.trip_details?.[0] && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {app.trip_details[0].from_location_name} →{" "}
                              {app.trip_details[0].to_location_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatDateRange(
                                app.trip_details[0].departure_date,
                                app.trip_details[0].return_date,
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm pt-2 border-t">
                        <span className="text-muted-foreground">
                          Requested:{" "}
                          {app.cancellation_requested_at ? (
                            new Date(
                              app.cancellation_requested_at,
                            ).toLocaleDateString()
                          ) : (
                            <span className="italic text-slate-400">
                              Date not recorded
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          Status:{" "}
                          {app.status === "cancelled"
                            ? "Cancelled"
                            : app.status === "cancellation_requested"
                              ? "Awaiting manager approval"
                              : app.status
                                  .replace(/_/g, " ")
                                  .charAt(0)
                                  .toUpperCase() +
                                app.status.slice(1).replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Withdrawal Button (Only if travel has not started and cancellation is requested) */}
                      {(() => {
                        if (app.status === "cancelled") {
                          return (
                            <Alert className="bg-red-50 border-red-200">
                              <AlertDescription className="text-sm text-red-800 font-medium">
                                This application has been successfully
                                cancelled. No further action needed.
                              </AlertDescription>
                            </Alert>
                          );
                        }

                        if (app.status === "cancellation_requested") {
                          const isTravelStarted = app.trip_details?.some(
                            (trip: any) => {
                              if (!trip.departure_date) return false;
                              const departureDate = new Date(
                                trip.departure_date,
                              );
                              departureDate.setHours(0, 0, 0, 0);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return departureDate < today;
                            },
                          );

                          if (isTravelStarted) {
                            return (
                              <Alert
                                variant="destructive"
                                className="bg-red-50 border-red-200"
                              >
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-sm text-red-800">
                                  This travel has already started or passed.
                                  Withdrawal of cancellation request is not
                                  permitted.
                                </AlertDescription>
                              </Alert>
                            );
                          }

                          return (
                            <>
                              <Alert className="bg-amber-50 border-amber-200">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-sm text-amber-800">
                                  You can withdraw this request before your
                                  manager approves or rejects it.
                                </AlertDescription>
                              </Alert>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWithdraw(app.id)}
                                disabled={withdrawingId === app.id}
                                className="w-full border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                              >
                                {withdrawingId === app.id ? (
                                  <>
                                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                                    Withdrawing...
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Withdraw Cancellation Request
                                  </>
                                )}
                              </Button>
                            </>
                          );
                        }

                        return null;
                      })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Cancelled Tab Placeholder */}
          <TabsContent value="cancelled">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Feature coming soon: View your travel cancellation history
              </p>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

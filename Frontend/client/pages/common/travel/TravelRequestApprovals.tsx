import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
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
  Download,
  Filter,
  Search,
  Clock,
  CheckCircle,
  IndianRupeeIcon,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { approvalAPI } from "@/src/api/approval";
import { ROUTES } from "@/routes/routes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface ApprovalStats {
  pendingApproval: number;
  approvedToday: number;
  totalBudget: string;
  rejected: number;
}

export interface TripSummary {
  from: string;
  to: string;
  departure: string;
  return: string;
  duration: number;
}

export interface TravelApplication {
  id: number;
  travel_request_id: string;
  employee_name: string;
  employee_grade: string;
  department: string;
  purpose: string;
  estimated_total_cost: string;
  status: string;
  submitted_at: string | null;
  current_approval: string | null;
  trip_summary: TripSummary[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function Pagination({ pagination, onPageChange }) {
  console.log(pagination, onPageChange);
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

export default function TravelRequestApprovals() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const [statusFilter, setStatusFilter] = useState("pending"); // Default status 'pending'

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState();

  const [applications, setApplications] = useState<
    PaginatedResponse<TravelApplication>
  >({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });

  useEffect(() => {
    fetchApprovals(
      statusFilter,
      page,
      searchQuery,
      appliedStartDate,
      appliedEndDate,
    );
    fetchStatistics();
  }, [statusFilter, page, searchQuery, appliedStartDate, appliedEndDate]);

  const canUserApprove = (request) => {
    const pendingStatuses = ["pending_manager", "pending_chro", "pending_ceo"];

    // If request is not pending – cannot approve
    if (!pendingStatuses.includes(request.status)) return false;

    // Must match backend current approver
    if (
      request.current_approval !== null &&
      request.current_approval.can_approve
    ) {
      return true;
    } else {
      return false;
    }
  };

  const fetchApprovals = async (
    filter: string,
    page: number,
    search: string,
    startDate: string = "",
    endDate: string = "",
  ) => {
    setLoading(true);
    try {
      const res = await approvalAPI.getApprovals(
        filter,
        page,
        search,
        startDate,
        endDate,
      );
      setApplications({
        count: res.meta.pagination.count,
        next: res.meta.pagination.next,
        previous: res.meta.pagination.previous,
        results: Array.isArray(res.data) ? res.data : [],
      });

      setPagination(res.meta.pagination);
    } catch (err) {
      console.error("Failed to load pending approvals!", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await approvalAPI.getStats();
      setStats(stats);
      // console.log(stats.data);
    } catch (err) {
      console.error("Failed to load approval statistics!", err);
    } finally {
      setLoading(false);
    }
  };

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleStatusUpdate = async (
    id: number,
    action: "approve" | "reject",
  ) => {
    try {
      setUpdatingId(id); // disable buttons for this request
      if (action === "approve") {
        await approvalAPI.approve(id);
      } else {
        // Prompt user for rejection reason
        const notes = prompt("Enter reason for rejection") || "";
        if (!notes) {
          alert("Rejection reason is required");
          return;
        }
        await approvalAPI.reject(id, notes);
      }

      // Re-fetch data to reflect changes
      await fetchApprovals(statusFilter, page, searchQuery);
      fetchStatistics();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingId(null); // re-enable buttons
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

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

  function daysBetween(from_date: string, to_date: string) {
    // Convert strings to Date objects
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    // Calculate difference in milliseconds
    const diffTime = toDate - fromDate;

    // Convert milliseconds to days
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            Travel Request Approvals
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Review and process employee travel request.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button> */}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="h-9 w-9 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.data.pending_approval}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pending Approval
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-9 w-9 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.data.approved_today}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Approved Today
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-blue-50 flex items-center justify-center">
                  <IndianRupeeIcon className="h-9 w-9 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.data.total_budget}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Advance Amount
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-[70px] h-[70px] rounded-lg bg-red-50 flex items-center justify-center">
                  <XCircle className="h-9 w-9 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.data.rejected}
                  </div>
                  <div className="text-sm text-muted-foreground">Rejected</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by employee name or request ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearchQuery(searchInput);
                      setAppliedStartDate(startDate);
                      setAppliedEndDate(endDate);
                    }
                  }}
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={
                      startDate || endDate
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : ""
                    }
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {startDate || endDate ? "Dates Selected" : "Date Range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    {(startDate || endDate) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                      >
                        Clear Dates
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                onClick={() => {
                  setSearchQuery(searchInput);
                  setAppliedStartDate(startDate);
                  setAppliedEndDate(endDate);
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Travel Requests Table */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6">
            <h2 className="text-xl font-semibold text-foreground">
              Recent Travel Requests
            </h2>
            <div className="text-sm text-blue-800 font-medium mt-2 sm:mt-0">
              {applications.results.length} pending requests
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50/30">
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Employee
                  </TableHead>
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider max-w-[200px]">
                    Destination
                  </TableHead>
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Travel Dates
                  </TableHead>
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Advance Amount
                  </TableHead>
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  {/* <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Priority
                  </TableHead> */}
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.results.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                          {request.employee_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {request.employee_name}
                          </div>
                          <div className="text-sm text-muted-foreground"></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">
                          {request.trip_summary[0]?.from} →{" "}
                          {request.trip_summary[0]?.to}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-1 max-w-[200px] truncate">
                          {request.purpose}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">
                          {formatDateRange(
                            request.trip_summary[0]?.departure,
                            request.trip_summary[0]?.return,
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.trip_summary[0]?.duration} Days
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        &#x20b9;{request.estimated_total_cost}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        statusType="travel"
                        status={request.status}
                      />
                    </TableCell>
                    {/* <TableCell>
                        <StatusBadge statusType="approval" status="HIGH" />
                      </TableCell> */}
                    <TableCell>
                      <div className="flex gap-2">
                        {canUserApprove(request) && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                              onClick={() =>
                                handleStatusUpdate(request.id, "approve")
                              }
                              disabled={updatingId === request.id}
                            >
                              {updatingId === request.id ? (
                                <>
                                  <Spinner size="sm" /> Processing
                                </>
                              ) : (
                                "Approve"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleStatusUpdate(request.id, "reject")
                              }
                              disabled={updatingId === request.id}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(ROUTES.travelApplicationDetails(request.id))
                          }
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {applications.results.length === 0 && (
              <center className="m-5">
                {statusFilter === "all" &&
                  "No travel applications for approval."}
                {statusFilter === "pending" &&
                  "No pending applications for approval."}
                {statusFilter === "approved" &&
                  "No approved applications for approval."}
                {statusFilter === "rejected" &&
                  "No rejected applications for approval."}
              </center>
            )}
          </div>

          {/* Pagination */}
          <Pagination
            pagination={pagination}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

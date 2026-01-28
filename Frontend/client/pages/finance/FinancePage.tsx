import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/dashboard";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Search,
  CheckCircle,
  Eye,
  Timer,
  CircleCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { ROUTES } from "@/routes/routes";
import { useNavigate } from "react-router-dom";
import { expenseAPI } from "@/src/api/expense";
import type {
  FinanceDashboardClaim,
  FinanceDashboardStatistics,
} from "@/src/types/expense-2.types";

const FinanceDashboard = () => {
  const navigate = useNavigate();

  // API State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<FinanceDashboardClaim[]>([]);
  const [statistics, setStatistics] = useState<FinanceDashboardStatistics>({
    pending: 0,
    paid: 0,
    closed: 0,
  });

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending"); // default pending

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // modal state
  const [selectedClaim, setSelectedClaim] =
    useState<FinanceDashboardClaim | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isCloseAppModalOpen, setIsCloseAppModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [closeRemarks, setCloseRemarks] = useState("");

  // Fetch dashboard data
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await expenseAPI.finance.getDashboard({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchTerm || undefined,
        page: currentPage,
        page_size: pageSize,
      });

      if (response.success) {
        setStatistics(response.data.statistics);
        setClaims(response.data.results);
      } else {
        setError("Failed to fetch dashboard data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Finance dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchDashboard();
  }, [currentPage, statusFilter, searchTerm]);

  // Map backend status codes to frontend display values
  const getDisplayStatus = (statusCode: string | null): string => {
    switch (statusCode) {
      case "finance_pending":
        return "Pending";
      case "paid":
        return "Processed";
      case "closed":
        return "Closed";
      default:
        return "Unknown";
    }
  };

  // --- Handlers ---
  const handleMarkAsPaid = (claim: FinanceDashboardClaim) => {
    setSelectedClaim(claim);
    setPaymentRemarks(""); // Reset remarks
    setIsPayModalOpen(true);
  };

  const confirmMarkAsPaid = async () => {
    if (!selectedClaim) return;

    setActionLoading(selectedClaim.claim_application_id);

    try {
      const result = await expenseAPI.claims.financeAction(
        selectedClaim.claim_application_id,
        {
          action: "mark_paid",
          remarks:
            paymentRemarks.trim() || "Payment processed via finance dashboard",
        },
      );

      if (result.success) {
        // Refresh dashboard data
        await fetchDashboard();
        setIsPayModalOpen(false);
        setSelectedClaim(null);
        setPaymentRemarks("");
      } else {
        setError("Failed to mark claim as processed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Mark as processed error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscloseProcess = (claim: FinanceDashboardClaim) => {
    setSelectedClaim(claim);
    setCloseRemarks(""); // Reset remarks
    setIsCloseAppModalOpen(true);
  };

  const confirmCloseApplication = async (
    action: "keep_open" | "close_finish",
  ) => {
    if (!selectedClaim) return;

    setActionLoading(selectedClaim.claim_application_id);

    try {
      if (action === "close_finish") {
        const result = await expenseAPI.claims.financeAction(
          selectedClaim.claim_application_id,
          {
            action: "mark_closed",
            remarks:
              closeRemarks.trim() || "Claim processing completed and closed",
          },
        );

        if (result.success) {
          // Refresh dashboard data
          await fetchDashboard();
        } else {
          setError("Failed to close claim");
        }
      }
      // For "keep_open", we just close the modal without API call

      setIsCloseAppModalOpen(false);
      setSelectedClaim(null);
      setCloseRemarks("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Close application error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle search with debounce effect
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handle status filter change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("pending");
    setCurrentPage(1);
  };

  // Loading and error states
  if (loading && claims.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg">Loading finance dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-20">
            <div className="text-red-600 mb-4">Error: {error}</div>
            <Button
              onClick={fetchDashboard}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold">Claim Verification</h1>
            <p className="text-lg text-muted-foreground mt-1">
              Process pending claims, update payment status, and finalize
              closures.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pending Claims"
            value={String(statistics.pending || 0)}
            icon={<Timer className="h-9 w-9 text-orange-600" />}
            bgColor="bg-orange-50"
          />
          <StatCard
            title="Marked as Processed"
            value={String(statistics.paid || 0)}
            icon={<CheckCircle className="h-9 w-9 text-emerald-600" />}
            bgColor="bg-emerald-50"
          />
          <StatCard
            title="Closed / Processed"
            value={String(statistics.closed || 0)}
            icon={<CircleCheck className="h-9 w-9 text-blue-600" />}
            bgColor="bg-blue-50"
          />
        </div>

        {/* SEARCH + STATUS FILTER (match theme wrapper) */}
        <div className="bg-white border border-bottom p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <Input
                placeholder="Search by employee or request ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="w-full sm:w-[200px]">
              <Select
                value={statusFilter}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Processed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="hover:bg-slate-100 hover:text-black"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* CLAIM TABLE (ONE TABLE ONLY) */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-slate-800">
                    Employee Name
                  </TableHead>
                  <TableHead className="text-slate-800">
                    Travel Request ID
                  </TableHead>
                  <TableHead className="text-slate-800">
                    Final Payable
                  </TableHead>
                  <TableHead className="text-center text-slate-800">
                    Status
                  </TableHead>
                  <TableHead className="text-center text-slate-800">
                    Travel Details
                  </TableHead>
                  <TableHead className="text-center text-slate-800">
                    Claim Details
                  </TableHead>
                  <TableHead className="text-center text-slate-800">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <span className="text-slate-600">Loading claims...</span>
                    </TableCell>
                  </TableRow>
                ) : claims.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-10 text-slate-600"
                    >
                      No claim applications found.
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map((claim) => (
                    <TableRow
                      key={claim.claim_application_id}
                      className="hover:bg-muted/50 transition"
                    >
                      <TableCell className="font-medium">
                        {claim.employee_name}
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-sm font-medium">
                          {claim.travel_request_id || "N/A"}
                        </span>
                      </TableCell>

                      <TableCell className="font-semibold">
                        ₹ {claim.final_amount_payable.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-center">
                        <StatusBadge
                          statusType="claim"
                          status={getDisplayStatus(claim.status_code)}
                          variant="rounded"
                        />
                      </TableCell>

                      <TableCell className="text-center">
                        <Link
                          to={ROUTES.travelApplicationView(
                            claim.travel_application,
                          )}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View Travel details
                        </Link>
                      </TableCell>

                      <TableCell className="text-center">
                        <Link
                          to={ROUTES.claimDetailPage(
                            claim.claim_application_id,
                          )}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View Claim details
                        </Link>
                      </TableCell>

                      <TableCell className="text-center">
                        {/* Pending -> Mark Paid */}
                        {claim.status_code === "finance_pending" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            onClick={() => handleMarkAsPaid(claim)}
                            disabled={
                              actionLoading === claim.claim_application_id
                            }
                          >
                            {actionLoading === claim.claim_application_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Mark as Paid
                          </Button>
                        )}

                        {/* Paid -> Process */}
                        {claim.status_code === "paid" && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            onClick={() => handleDiscloseProcess(claim)}
                            disabled={
                              actionLoading === claim.claim_application_id
                            }
                          >
                            {actionLoading === claim.claim_application_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CircleCheck className="h-4 w-4" />
                            )}
                            Close
                          </Button>
                        )}

                        {/* Closed -> Done */}
                        {claim.status_code === "closed" && (
                          <span className="text-xs text-slate-600 font-bold">
                            Processed
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination mimic TravelDesk style (using same sticky style section) */}
          <div className="border-t px-4 py-3 flex items-center justify-between text-sm text-slate-600">
            <span>
              Showing{" "}
              <b>
                {claims.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </b>{" "}
              to <b>{Math.min(currentPage * pageSize, claims.length)}</b> of{" "}
              <b>{claims.length}</b>
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>

              <Button variant="default" size="sm" className="h-8 px-3">
                {currentPage}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={claims.length < pageSize}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* ====== MODALS ====== */}

        {/* Confirm Payment Modal */}
        <Dialog
          open={isPayModalOpen}
          onOpenChange={(open) => {
            // prevent closing while processing
            if (actionLoading !== null) return;

            setIsPayModalOpen(open);
            if (!open) {
              setSelectedClaim(null);
              setPaymentRemarks("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Confirmation Required</DialogTitle>
              <DialogDescription className="text-slate-500">
                Are you sure you want to mark this claim as{" "}
                <b className="text-slate-800">Processed</b>?
              </DialogDescription>
            </DialogHeader>

            {/* Claim Summary */}
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Employee</span>
                <span className="font-medium text-blue-900">
                  {selectedClaim?.employee_name || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Travel Request ID</span>
                <span className="font-semibold text-blue-900">
                  {selectedClaim?.travel_request_id || "-"}
                </span>
              </div>
            </div>

            {/* Warning / Info */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-orange-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-[2px]" />
                This action is irreversible
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Once you mark as processed, this claim will move to <b>Processed</b>{" "}
                status and cannot be modified later.
              </p>
            </div>

            {/* Remarks Input */}
            <div className="space-y-2">
              <label
                htmlFor="payment-remarks"
                className="text-sm font-medium text-slate-700"
              >
                Remarks (Optional)
              </label>
              <Input
                id="payment-remarks"
                placeholder="Enter payment remarks..."
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
                disabled={actionLoading !== null}
                className="bg-white"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="hover:bg-slate-100 hover:text-black"
                onClick={() => {
                  if (actionLoading !== null) return;
                  setIsPayModalOpen(false);
                  setSelectedClaim(null);
                  setPaymentRemarks("");
                }}
                disabled={actionLoading !== null}
              >
                Cancel
              </Button>

              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={confirmMarkAsPaid}
                disabled={actionLoading !== null}
              >
                {actionLoading !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>Yes, Mark Processed</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close Application Modal */}
        <Dialog
          open={isCloseAppModalOpen}
          onOpenChange={(open) => {
            if (actionLoading !== null) return;

            setIsCloseAppModalOpen(open);
            if (!open) {
              setSelectedClaim(null);
              setCloseRemarks("");
            }
          }}
        >
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Close Application?</DialogTitle>
              <DialogDescription>
                The claim has been marked as <b>Processed</b>.
                <br />
                Would you like to close this travel and claim application?
              </DialogDescription>
            </DialogHeader>

            {/* Explanation Card */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-900">
                What happens next?
              </p>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>
                  • <b>Keep Open</b> → Claim will remain in{" "}
                  <b>Closed / Processed</b>
                </li>
                <li>
                  • <b>Close & Finish</b> → Claim will move to <b>Closed</b>{" "}
                  (final state)
                </li>
              </ul>
              <p className="text-xs text-slate-600 pt-2">
                Closing will lock the claim for further updates.
              </p>
            </div>

            {/* Remarks Input */}
            <div className="space-y-2">
              <label
                htmlFor="close-remarks"
                className="text-sm font-medium text-slate-700"
              >
                Remarks (Optional)
              </label>
              <Input
                id="close-remarks"
                placeholder="Enter closing remarks..."
                value={closeRemarks}
                onChange={(e) => setCloseRemarks(e.target.value)}
                disabled={actionLoading !== null}
                className="bg-white"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="hover:bg-slate-100 hover:text-black"
                onClick={() => confirmCloseApplication("keep_open")}
                disabled={actionLoading !== null}
              >
                Keep Open
              </Button>

              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => confirmCloseApplication("close_finish")}
                disabled={actionLoading !== null}
              >
                {actionLoading !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  "Close & Finish"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default FinanceDashboard;

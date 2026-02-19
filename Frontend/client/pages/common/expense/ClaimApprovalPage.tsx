import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Search, Filter, XCircle } from "lucide-react";

import { expenseAPI } from "@/src/api/expense";
import { ROUTES } from "@/routes/routes";

// ----------------------------------
// Types
// ----------------------------------

interface ClaimItem {
  id: number;
  expense_type: string;
  amount: string;
  remarks: string;
}

interface ClaimApplication {
  id: number;
  employee_name: string;
  total_amount: string;
  status: string;
  submitted_at: string | null;
}

interface PaginatedClaims {
  count: number;
  next: string | null;
  previous: string | null;
  results: ClaimApplication[];
}

// ----------------------------------
// Helpers
// ----------------------------------

const formatCurrency = (amount: string | number) => {
  const num = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

// ----------------------------------
// Page Component
// ----------------------------------

export default function ClaimApprovalsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [claims, setClaims] = useState<any>({
    data: [],
    meta: {
      pagination: {
        count: 0,
        next: null,
        previous: null,
        total_pages: 1,
        current_page: 1,
        page_size: 10,
      },
    },
  });

  const [actionModal, setActionModal] = useState({
    open: false,
    claimId: null as number | null,
    action: "" as "approve" | "reject" | "",
  });
  const [remarks, setRemarks] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "manager_pending" | "approved" | "rejected"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ----------------------------------
  // Search debounce
  // ----------------------------------
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCurrentPage(1);
    }, 400);

    return () => clearTimeout(handle);
  }, [search]);

  // ----------------------------------
  // Fetch Approvals
  // ----------------------------------
  useEffect(() => {
    loadPendingApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, currentPage, debouncedSearch]);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: currentPage,
      };

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const res = await expenseAPI.claims.getPendingApprovals(params);
      setClaims(res);
    } catch (err) {
      console.error("Error loading approval claims:", err);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // Approve / Reject Actions (with confirmation modal)
  // ----------------------------------
  const openActionModal = (claimId: number, action: "approve" | "reject") => {
    setActionModal({ open: true, claimId, action });
    setRemarks("");
  };

  const submitModalAction = async () => {
    if (!actionModal.claimId || !actionModal.action) return;

    try {
      setModalLoading(true);

      const payload = {
        action: actionModal.action,
        remarks: remarks || "",
      };

      const res = await expenseAPI.claims.action(actionModal.claimId, payload);

      toast({
        title: "Success",
        description:
          res?.message || `Claim ${actionModal.action}d successfully`,
      });

      setActionModal({ open: false, claimId: null, action: "" });
      loadPendingApprovals();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.message || "Something went wrong.",
      });
    } finally {
      setModalLoading(false);
    }
  };

  // ----------------------------------
  // Derived stats for summary cards
  // ----------------------------------
  const pageData = claims?.data || [];
  const pagination = claims?.meta?.pagination || {};
  const totalCount = pagination?.count || 0;

  const pendingCount = pageData.filter(
    (c: any) =>
      c.status_code === "pending" || c.status_code === "manager_pending",
  ).length;

  const approvedCount = pageData.filter(
    (c: any) => c.status_code === "approved",
  ).length;
  const rejectedCount = pageData.filter(
    (c: any) => c.status_code === "rejected",
  ).length;

  const totalPayableOnPage = pageData.reduce((sum: number, c: any) => {
    const v = Number(c.final_amount_payable || 0);
    return v > 0 ? sum + v : sum;
  }, 0);

  const hasActiveFilters = !!debouncedSearch || statusFilter !== "all";

  const selectedClaim =
    actionModal.claimId != null
      ? pageData.find((c: any) => c.id === actionModal.claimId)
      : null;

  // ----------------------------------
  // Render
  // ----------------------------------

  if (loading && !claims?.data?.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner /> <span className="ml-2">Loading…</span>
      </div>
    );
  }

  const totalPages = pagination?.total_pages || 1;
  const current = pagination?.current_page || currentPage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            Claim Approvals
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Review and process employee reimbursement claims.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="border-amber-200 bg-amber-50/60">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase text-amber-700">Pending</div>
                            <div className="text-2xl font-semibold">{pendingCount}</div>
                            <div className="text-xs text-amber-800/80">On current page</div>
                        </div>
                        <Clock className="h-8 w-8 text-amber-500" />
                    </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/60">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase text-emerald-700">Approved</div>
                            <div className="text-2xl font-semibold">{approvedCount}</div>
                            <div className="text-xs text-emerald-800/80">On current page</div>
                        </div>
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </CardContent>
                </Card>

                <Card className="border-rose-200 bg-rose-50/60">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase text-rose-700">Rejected</div>
                            <div className="text-2xl font-semibold">{rejectedCount}</div>
                            <div className="text-xs text-rose-800/80">On current page</div>
                        </div>
                        <XCircle className="h-8 w-8 text-rose-500" />
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="py-4 flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase text-slate-700">Total Payable</div>
                            <div className="text-xl font-semibold">
                                {formatCurrency(totalPayableOnPage)}
                            </div>
                            <div className="text-xs text-slate-500">Positive amounts on current page</div>
                        </div>
                        <IndianRupeeIcon className="h-8 w-8 text-slate-500" />
                    </CardContent>
                </Card>
            </div> */}

      {/* Filters */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search + Clear */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by employee name, claim ID, or travel app ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-9"
              />
              {hasActiveFilters && (
                <XCircle
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                />
              )}
            </div>

            {/* Status filter chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "manager_pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(opt.value as any);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === opt.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[65vh] rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-slate-50 whitespace-nowrap">
                  <TableHead className="whitespace-nowrap">
                    Travel Request
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Employee</TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    Total Expenses
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    Advance Received
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    Payable Amount
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    Status
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageData.map((cl: any) => {
                  const finalPayable = Number(cl.final_amount_payable || 0);
                  const totalExpenses = Number(cl.total_expenses || 0);

                  let rowClass = "";
                  if (finalPayable < 0) {
                    rowClass = "bg-rose-50 whitespace-nowrap";
                  } else if (totalExpenses >= 10000 || finalPayable >= 10000) {
                    rowClass = "bg-amber-50/50 whitespace-nowrap";
                  }

                  return (
                    <TableRow key={cl.id} className={rowClass}>
                      {/* Travel App ID */}
                      <TableCell className="whitespace-nowrap font-semibold text-gray-800">
                        {cl.travel_request_id || `#${cl.travel_application}`}
                      </TableCell>

                      {/* Employee Name */}
                      <TableCell className="whitespace-nowrap">
                        {cl.employee_name}
                      </TableCell>

                      {/* Total Expenses */}
                      <TableCell className="whitespace-nowrap text-center">
                        {formatCurrency(cl.total_expenses)}
                      </TableCell>

                      {/* Advance Received */}
                      <TableCell className="whitespace-nowrap text-center">
                        {formatCurrency(cl.advance_received)}
                      </TableCell>

                      {/* Final Amount Payable */}
                      <TableCell
                        className={`whitespace-nowrap font-semibold text-center ${
                          finalPayable >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(finalPayable)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="whitespace-nowrap text-center">
                        <StatusBadge
                          statusType="claim"
                          status={cl.status_code}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          {["pending", "manager_pending"].includes(
                            cl.status_code,
                          ) && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() =>
                                  openActionModal(cl.id, "approve")
                                }
                                disabled={updatingId === cl.id}
                              >
                                {updatingId === cl.id ? "..." : "Approve"}
                              </Button>

                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openActionModal(cl.id, "reject")}
                                disabled={updatingId === cl.id}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(ROUTES.claimDetailPage(cl.id))
                            }
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* No Data */}
            {pageData.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No claim applications found.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 border-t gap-4">
            <div className="text-sm text-gray-500">
              <div className="flex">
                <p>
                  Total claims:{" "}
                  <span className="font-medium">{totalCount}</span>
                </p>
              </div>
              <div>
                Page <span className="font-medium">{current}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </div>
            </div>

            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) {
                        setCurrentPage((prev) => prev - 1);
                      }
                    }}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-40" : ""
                    }
                  />
                </PaginationItem>

                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    {current}
                  </PaginationLink>
                </PaginationItem>

                {current < totalPages && (
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((prev) => prev + 1);
                        }
                      }}
                    />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          </div>

          {/* Approve / Reject Modal */}
          <Dialog
            open={actionModal.open}
            onOpenChange={(open) =>
              setActionModal((prev) => ({ ...prev, open }))
            }
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {actionModal.action === "approve"
                    ? "Approve Claim"
                    : "Reject Claim"}
                </DialogTitle>
                <DialogDescription>
                  {actionModal.action === "approve"
                    ? "Confirm approval for this claim. Please review the summary before proceeding."
                    : "Confirm rejection for this claim. Add a clear reason for audit trail."}
                </DialogDescription>
              </DialogHeader>

              {selectedClaim && (
                <div className="mt-3 mb-2 rounded-md border bg-slate-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employee</span>
                    <span className="font-medium text-slate-800">
                      {selectedClaim.employee_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Travel App</span>
                    <span className="font-medium text-slate-800">
                      {selectedClaim.travel_request_id ||
                        `#${selectedClaim.travel_application}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Expenses</span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency(selectedClaim.total_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Advance</span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency(selectedClaim.advance_received)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Final Payable</span>
                    <span
                      className={`font-semibold ${
                        Number(selectedClaim.final_amount_payable) < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(selectedClaim.final_amount_payable)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="text-sm font-medium">
                  Remarks{" "}
                  {actionModal.action === "reject" && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <Input
                  placeholder="Add remarks…"
                  className="mt-2"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <DialogFooter className="mt-4 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    setActionModal({ open: false, claimId: null, action: "" })
                  }
                >
                  Cancel
                </Button>

                <Button
                  variant={
                    actionModal.action === "approve" ? "default" : "destructive"
                  }
                  onClick={submitModalAction}
                  disabled={
                    modalLoading ||
                    (actionModal.action === "reject" && !remarks.trim())
                  }
                >
                  {modalLoading
                    ? "Processing..."
                    : actionModal.action === "approve"
                      ? "Approve"
                      : "Reject"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { approvalAPI } from "@/src/api/approval";
import { travelAPI } from "@/src/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  ShieldCheck,
  AlertTriangle,
  Download,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/routes/routes";
import {
  CancellationApprovalModal,
  CancellationRejectionModal,
} from "./components/CancellationApprovalModals";

const TravelCancellationApproval: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Modal states
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCancellationRequests();
  }, []);

  const fetchCancellationRequests = async () => {
    setLoading(true);
    try {
      const res: any = await approvalAPI.getApprovals(
        "cancellation_requested",
        1,
      );
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error("Failed to load cancellation requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setUpdatingId(selectedRequest.id);
    try {
      await travelAPI.approveCancellation(selectedRequest.id, "approve");
      toast.success(
        `Cancellation for ${selectedRequest.travel_request_id} approved.`,
      );
      setIsApproveModalOpen(false);
      fetchCancellationRequests();
    } catch (err) {
      toast.error("Failed to approve cancellation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequest) return;
    setUpdatingId(selectedRequest.id);
    try {
      await travelAPI.approveCancellation(selectedRequest.id, "reject", reason);
      toast.success(
        `Cancellation for ${selectedRequest.travel_request_id} rejected.`,
      );
      setIsRejectModalOpen(false);
      fetchCancellationRequests();
    } catch (err) {
      toast.error("Failed to reject cancellation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return "N/A";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options = {
      month: "short" as const,
      day: "numeric" as const,
      year: "numeric" as const,
    };

    if (startDate === endDate)
      return start.toLocaleDateString("en-US", options);
    return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
  };

  const filteredRequests = requests.filter(
    (req) =>
      req.travel_request_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.purpose.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground flex items-center gap-3">
            Travel Request Cancellation Approvals
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Review and process employee travel cancellation requests.
          </p>
        </div>
      </div>

      {/* Filters (Simplified like travel approvals) */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by employee name, request ID, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Requests Table */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)] overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6">
            <h2 className="text-xl font-semibold text-foreground">
              Pending Cancellation Requests
            </h2>
            <div className="text-sm text-blue-800 font-medium mt-2 sm:mt-0 px-3 py-1 bg-blue-50 rounded-full">
              {filteredRequests.length} requests in queue
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50/30">
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Employee
                  </TableHead>
                  <TableHead className="text-dark-600 text-left font-semibold text-xs uppercase tracking-wider">
                    Reason
                  </TableHead>
                  <TableHead className="text-dark-600 text-left font-semibold text-xs uppercase tracking-wider max-w-[200px]">
                    Destination & Purpose
                  </TableHead>
                  <TableHead className="text-dark-600 text-left font-semibold text-xs uppercase tracking-wider">
                    Travel Dates
                  </TableHead>
                  <TableHead className="text-dark-600 text-left font-semibold text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-dark-600 text-center font-semibold text-xs uppercase tracking-wider">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center p-0">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Spinner size="lg" />
                        <p className="text-muted-foreground font-medium">
                          Syncing cancellation data...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center p-0">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-4 bg-slate-50 rounded-full">
                          <ShieldCheck className="h-12 w-12 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-medium">
                          Clear sky! No pending cancellations.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shadow-md">
                            {request.employee_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {request.employee_name}
                            </div>
                            <div className="text-xs text-muted-foreground font-semibold">
                              {request.travel_request_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-foreground">
                          {request.cancellation_reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">
                            {request.trip_summary?.[0]?.from} →{" "}
                            {request.trip_summary?.[0]?.to}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px] italic">
                            "{request.purpose}"
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center sm:text-left">
                          <div className="font-medium text-foreground">
                            {formatDateRange(
                              request.trip_summary?.[0]?.departure,
                              request.trip_summary?.[0]?.return,
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.trip_summary?.[0]?.duration} Days
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          statusType="travel"
                          status={request.status}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigate(ROUTES.travelApplicationDetails(request.id))
                            }
                            className="h-9 w-9 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-9 px-3 gap-2"
                            onClick={() => {
                              setSelectedRequest(request);
                              setIsApproveModalOpen(true);
                            }}
                            disabled={updatingId === request.id}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-9 px-3 gap-2"
                            onClick={() => {
                              setSelectedRequest(request);
                              setIsRejectModalOpen(true);
                            }}
                            disabled={updatingId === request.id}
                          >
                            <XCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Reject</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CancellationApprovalModal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        onConfirm={handleApprove}
        isLoading={updatingId === selectedRequest?.id}
        applicationId={selectedRequest?.travel_request_id}
      />

      <CancellationRejectionModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleReject}
        isLoading={updatingId === selectedRequest?.id}
        applicationId={selectedRequest?.travel_request_id}
      />
    </div>
  );
};

export default TravelCancellationApproval;

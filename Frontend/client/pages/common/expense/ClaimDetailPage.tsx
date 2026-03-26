import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  IndianRupee,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  Lock,
  AlertCircle,
  Send,
  RefreshCw,
  Calendar,
  Printer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/routes/routes";
import { expenseAPI } from "@/src/api/expense";

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: claim, isLoading } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => expenseAPI.claims.get(parseInt(id!)),
    enabled: !!id,
  });

  console.log("Claim data: ", claim);

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(parseFloat(String(amount)));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return `${date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}, ${date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const statusColorClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 hover:bg-green-200";
      case "pending":
      case "manager_pending":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200";
      case "rejected":
        return "bg-red-100 text-red-700 hover:bg-red-200";
      case "paid":
        return "bg-blue-100 text-blue-700 hover:bg-blue-200";
      case "closed":
        return "bg-slate-200 text-slate-700 hover:bg-slate-300";
      case "revision_required":
        return "bg-orange-100 text-orange-700 hover:bg-orange-200";
      default:
        return "bg-slate-100 text-slate-700 hover:bg-slate-200";
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return {
          bg: "bg-gradient-to-br from-green-50 to-green-50/50 border-green-100",
          iconColor: "text-green-600",
          Icon: CheckCircle,
          label: "Claim Approved",
          message: "All approvals completed",
        };
      case "manager_pending":
      case "finance_pending":
      case "pending":
        return {
          bg: "bg-gradient-to-br from-yellow-50 to-yellow-50/50 border-yellow-100",
          iconColor: "text-yellow-600",
          Icon: Clock,
          label: "Approval Pending",
          message:
            status === "manager_pending"
              ? "Pending Manager Approval"
              : "Pending Finance Approval",
        };
      case "rejected":
        return {
          bg: "bg-gradient-to-br from-red-50 to-red-50/50 border-red-100",
          iconColor: "text-red-600",
          Icon: XCircle,
          label: "Claim Rejected",
          message: "This claim has been rejected",
        };
      case "paid":
        return {
          bg: "bg-gradient-to-br from-blue-50 to-blue-50/50 border-blue-100",
          iconColor: "text-blue-600",
          Icon: Banknote,
          label: "Payment Processed",
          message: "In Process",
        };
      case "closed":
        return {
          bg: "bg-gradient-to-br from-slate-100 to-slate-200 border-slate-200",
          iconColor: "text-slate-600",
          Icon: Lock,
          label: "Claim Closed",
          message: "This claim record is closed",
        };
      case "revision_required":
        return {
          bg: "bg-gradient-to-br from-orange-50 to-orange-50/50 border-orange-100",
          iconColor: "text-orange-600",
          Icon: AlertCircle,
          label: "Revision Required",
          message: "Claim returned for corrections",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-slate-50 to-slate-50/50 border-slate-200",
          iconColor: "text-slate-600",
          Icon: AlertCircle,
          label: claim?.status_label || status,
          message: "Status information",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading claim details...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Claim not found</p>
      </div>
    );
  }

  const finalAmount = parseFloat(String(claim.final_amount_payable));
  const isRefund = finalAmount > 0;
  const isBalance = finalAmount < 0;
  const statusConfig = getStatusConfig(claim?.status_code);
  const StatusIcon = statusConfig.Icon;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              onClick={() => navigate(ROUTES.indexClaimPage)}
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Expense Claim #{claim.id}
              </h1>
              <p className="text-sm text-slate-500">
                Travel Request ID:{" "}
                {claim.travel_request_id || claim.travel_application}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            disabled={isDownloading}
            onClick={async () => {
              try {
                setIsDownloading(true);
                toast.loading("Generating report... This may take a moment.", {
                  id: "report-download",
                });

                const blob = await expenseAPI.claims.downloadReport(
                  parseInt(id!),
                );

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Claim_Report_${claim.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

                toast.success("Report downloaded successfully", {
                  id: "report-download",
                });
              } catch (error: any) {
                console.error("Failed to download report", error);
                toast.error("Failed to download report", {
                  id: "report-download",
                });
              } finally {
                setIsDownloading(false);
              }
            }}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {isDownloading ? "Generating..." : "Download Report"}
          </Button>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Return Remarks Alert - Only show when status is revision_required */}
            {claim.status_code === "revision_required" && (
              <Card className="border-orange-300 bg-orange-50/50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-900 mb-2">
                        Revision Required
                      </h3>
                      <p className="text-sm text-orange-800 mb-3">
                        Your claim has been returned by the finance team for
                        corrections. Please review the feedback below, make
                        necessary changes, and resubmit.
                      </p>

                      {/* Find the latest return action from finance_action_logs */}
                      {claim.finance_action_logs &&
                        claim.finance_action_logs.length > 0 && (
                          <div className="bg-white border border-orange-200 rounded-md p-3 mb-3">
                            <p className="text-xs font-medium text-orange-900 mb-1">
                              Finance Feedback:
                            </p>
                            <p className="text-sm text-slate-700 italic">
                              "
                              {claim.finance_action_logs.find(
                                (log: any) =>
                                  log.action === "return_to_applicant",
                              )?.remarks || "No remarks provided"}
                              "
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              Returned by:{" "}
                              {
                                claim.finance_action_logs.find(
                                  (log: any) =>
                                    log.action === "return_to_applicant",
                                )?.action_by_name
                              }{" "}
                              on{" "}
                              {formatDateTime(
                                claim.finance_action_logs.find(
                                  (log: any) =>
                                    log.action === "return_to_applicant",
                                )?.action_date,
                              )}
                            </p>
                          </div>
                        )}

                      <Button
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => navigate(ROUTES.editClaimPage(claim.id))}
                      >
                        Edit Claim
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Expense Items Table */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Expense Items
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 whitespace-nowrap">
                      <TableHead className="text-xs font-semibold">
                        Expense Type
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Expense Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Actual Cost
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Receipt
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-left">
                        Remarks
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claim.items?.map((item: any) => (
                      <TableRow
                        key={item.id}
                        className="border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <TableCell className="text-sm font-medium text-slate-800">
                          {item.expense_type_display}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {formatDate(item.expense_date)}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-800">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          {item.has_receipt ? (
                            <a
                              href={item.receipt_file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="no-underline"
                            >
                              <Badge
                                className="text-xs bg-green-100 hover:bg-green-100 text-green-700 cursor-pointer"
                                variant="success"
                              >
                                View Receipt
                              </Badge>
                            </a>
                          ) : item.is_self_certified ? (
                            <Badge
                              className="text-xs bg-yellow-100 hover:bg-yellow-100 text-yellow-700"
                              variant="success"
                            >
                              Self-Cert
                            </Badge>
                          ) : (
                            <Badge
                              className="text-xs bg-slate-200 hover:bg-slate-100 text-slate-700"
                              variant="success"
                            >
                              Not Provided
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 text-left">
                          {item.remarks || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* DA Breakdown Table */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                  Daily Allowance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div
                  className={
                    claim.da_breakdown?.length > 10
                      ? "max-h-[400px] overflow-y-auto pr-2"
                      : ""
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 whitespace-nowrap">
                        <TableHead className="text-xs font-semibold">
                          Date
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-right">
                          Hours
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-right">
                          DA
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-right">
                          Incidental
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claim.da_breakdown?.map((item: any, idx: number) => (
                        <TableRow
                          key={idx}
                          className="border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <TableCell className="text-sm font-medium text-slate-800">
                            {formatDate(item.date)}
                          </TableCell>
                          <TableCell className="text-sm text-right text-slate-700">
                            {item.hours}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium text-slate-800">
                            {formatCurrency(item.eligible_da)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium text-slate-800">
                            {formatCurrency(item.eligible_incidental)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      Booking(s) Expenses + Other Expenses:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(claim.total_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Daily Allowance:</span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(claim.total_da)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Incidental:</span>
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(claim.total_incidental)}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between text-sm font-semibold mb-2">
                      <span className="text-slate-700">Gross Total:</span>
                      <span className="text-slate-800">
                        {formatCurrency(
                          parseFloat(String(claim.total_expenses)) +
                            parseFloat(String(claim.total_da)) +
                            parseFloat(String(claim.total_incidental)),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Advance Received:</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(claim.advance_received)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border mt-3 ${isRefund ? "bg-green-50 border-green-200" : isBalance ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"}`}
                  >
                    <p className="text-xs text-slate-600 mb-1">Final Amount</p>
                    <p
                      className={`text-lg font-bold ${isRefund ? "text-green-600" : isBalance ? "text-blue-600" : "text-slate-800"}`}
                    >
                      {isRefund ? "+" : ""}
                      {formatCurrency(claim.final_amount_payable)}
                    </p>
                    <p className="text-xs mt-1 text-slate-600">
                      {isRefund
                        ? "To be refunded"
                        : isBalance
                          ? "Balance deducted"
                          : "Settled"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Approval Timeline */}
          <div className="lg:col-span-1">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  Approval Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-0">
                  {claim.approval_flow?.map((flow: any, index: number) => (
                    <div key={flow.id}>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          {index < claim.approval_flow.length - 1 && (
                            <div className="w-0.5 h-12 bg-slate-200 mt-2 mb-2"></div>
                          )}
                        </div>
                        <div className="pb-6 w-full flex flex-row place-content-between">
                          <div className="flex flex-col">
                            <p className="font-semibold text-sm text-slate-800">
                              {flow.approver_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Level {flow.level}
                            </p>
                          </div>
                          <div className="flex flex-col pt-1">
                            <Badge
                              className={`text-center uppercase text-xs px-3 py-0 ${statusColorClass(claim.status)}`}
                              variant="success"
                            >
                              {flow.status}
                            </Badge>
                            {flow.acted_on && (
                              <p className="text-xs text-slate-600">
                                {formatDate(flow.acted_on)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className={`shadow-sm mt-6 ${statusConfig.bg}`}>
              <CardContent className="pt-6">
                <div className="space-y-3 text-center">
                  <StatusIcon
                    className={`w-10 h-10 mx-auto ${statusConfig.iconColor}`}
                  />
                  <div>
                    <p className="text-xs text-slate-600">Claim Status</p>
                    <p
                      className={`text-lg font-bold ${statusConfig.iconColor}`}
                    >
                      {statusConfig.label}
                    </p>
                    <p className="text-xs text-slate-600">
                      {statusConfig.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Timeline Card */}
            <Card className="shadow-sm border-slate-200 mt-6">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Audit & Finance Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-0">
                  {(() => {
                    const events: any[] = [];
                    
                    // 1. Created
                    if (claim.created_on) {
                      events.push({
                        type: "created",
                        date: claim.created_on,
                        label: "Claim Created",
                        Icon: FileText,
                        iconBg: "bg-blue-100",
                        iconColor: "text-blue-600"
                      });
                    }
                    
                    // 4. Hierarchical Approvals (Manager)
                    claim.approval_flow?.filter((f: any) => f.status === "approved" && f.level === 1)
                      .forEach((f: any) => {
                        events.push({
                          type: "approved",
                          date: f.acted_on,
                          label: "Claim Approved",
                          subLabel: `By: ${f.approver_name}`,
                          Icon: CheckCircle,
                          iconBg: "bg-emerald-100",
                          iconColor: "text-emerald-600"
                        });
                      });
                      
                    // 5. Finance Actions (Revision, Processed, Closed)
                    claim.finance_action_logs?.forEach((log: any) => {
                      let label = "";
                      let Icon = FileText;
                      let iconBg = "bg-slate-100";
                      let iconColor = "text-slate-600";

                      if (log.action === "mark_paid") {
                        label = "Mark as Processed";
                        Icon = Banknote;
                        iconBg = "bg-green-100";
                        iconColor = "text-green-600";
                      } else if (log.action === "mark_closed") {
                        label = "Claim Closed";
                        Icon = Lock;
                        iconBg = "bg-slate-200";
                        iconColor = "text-slate-800";
                      } else if (log.action === "return_to_applicant") {
                        label = "Revision Required";
                        Icon = AlertCircle;
                        iconBg = "bg-orange-100";
                        iconColor = "text-orange-600";
                      } else {
                        label = log.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                      }
                      
                      events.push({
                        type: "finance_action",
                        date: log.action_date,
                        label,
                        subLabel: `By: ${log.action_by_name}`,
                        remarks: log.remarks,
                        Icon,
                        iconBg,
                        iconColor
                      });
                    });

                    // Sort chronologically (ASC)
                    const sortedEvents = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    return sortedEvents.map((event, index) => (
                      <div key={`${event.type}-${index}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.iconBg}`}>
                            <event.Icon className={`h-4 w-4 ${event.iconColor}`} />
                          </div>
                          {index < sortedEvents.length - 1 && (
                            <div className="w-0.5 h-12 bg-slate-200 mt-2 mb-2"></div>
                          )}
                        </div>
                        <div className="pb-6 w-full">
                          <p className="font-semibold text-sm text-slate-800">
                            {event.label}
                          </p>
                          <p className="text-xs text-slate-500 mb-1">
                            {formatDateTime(event.date)}
                          </p>
                          {event.subLabel && (
                            <p className="text-xs text-slate-600">
                              {event.subLabel}
                            </p>
                          )}
                          {event.remarks && (
                            <p className="text-xs text-slate-500 mt-1 italic">
                              "{event.remarks}"
                            </p>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

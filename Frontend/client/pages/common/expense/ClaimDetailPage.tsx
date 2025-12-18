import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, IndianRupee, CheckCircle, XCircle, Clock, Banknote, Lock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/routes/routes';
import { expenseAPI } from '@/src/api/expense';

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: claim, isLoading } = useQuery({
    queryKey: ['claim', id],
    queryFn: () => expenseAPI.claims.get(parseInt(id!)),
    enabled: !!id,
  });

  console.log("Claim data: ", claim);

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(parseFloat(String(amount)));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColorClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700 hover:bg-green-200';
      case 'pending':
      case 'manager_pending':
        return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 hover:bg-red-200';
      case 'paid':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
      case 'closed':
        return 'bg-slate-200 text-slate-700 hover:bg-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-gradient-to-br from-green-50 to-green-50/50 border-green-100',
          iconColor: 'text-green-600',
          Icon: CheckCircle,
          label: 'Claim Approved',
          message: 'All approvals completed'
        };
      case 'manager_pending':
      case 'finance_pending':
      case 'pending':
        return {
          bg: 'bg-gradient-to-br from-yellow-50 to-yellow-50/50 border-yellow-100',
          iconColor: 'text-yellow-600',
          Icon: Clock,
          label: 'Approval Pending',
          message: status === 'manager_pending' ? 'Pending Manager Approval' : 'Pending Manager Approval'
        };
      case 'rejected':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-red-50/50 border-red-100',
          iconColor: 'text-red-600',
          Icon: XCircle,
          label: 'Claim Rejected',
          message: 'This claim has been rejected'
        };
      case 'paid':
        return {
          bg: 'bg-gradient-to-br from-blue-50 to-blue-50/50 border-blue-100',
          iconColor: 'text-blue-600',
          Icon: Banknote,
          label: 'Payment Processed',
          message: 'Amount has been disbursed'
        };
      case 'closed':
        return {
          bg: 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-200',
          iconColor: 'text-slate-600',
          Icon: Lock,
          label: 'Claim Closed',
          message: 'This claim record is closed'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-50 to-slate-50/50 border-slate-200',
          iconColor: 'text-slate-600',
          Icon: AlertCircle,
          label: claim?.status_label || status,
          message: 'Status information'
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
        <div className="flex items-center gap-3 mb-6">
          <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors" onClick={() => navigate(ROUTES.indexClaimPage)}>
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Expense Claim #{claim.id}</h1>
            <p className="text-sm text-slate-500">Travel Request ID: {claim.travel_application}</p>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
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
                    <TableRow className="border-slate-200">
                      <TableHead className="text-xs font-semibold">Expense Type</TableHead>
                      <TableHead className="text-xs font-semibold">Expense Date</TableHead>
                      <TableHead className="text-xs font-semibold">Actual Cost</TableHead>
                      <TableHead className="text-xs font-semibold">Receipt</TableHead>
                      <TableHead className="text-xs font-semibold text-left">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claim.items?.map((item: any) => (
                      <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
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
                            <a href={item.receipt_file} target="_blank" rel="noopener noreferrer" className="no-underline">
                              <Badge className="text-xs bg-green-100 hover:bg-green-100 text-green-700 cursor-pointer" variant='success'>
                                View Receipt
                              </Badge>
                            </a>
                            
                          ) : item.is_self_certified ? (
                            <Badge className="text-xs bg-yellow-100 hover:bg-yellow-100 text-yellow-700" variant='success'>Self-Cert</Badge>
                          ) : (
                            <Badge className="text-xs bg-slate-200 hover:bg-slate-100 text-slate-700" variant='success'>None</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 text-left">
                          {item.remarks || 'N/A'}
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
                <div className={claim.da_breakdown?.length > 10 ? "max-h-[400px] overflow-y-auto pr-2" : ""}>
                    <Table>
                    <TableHeader>
                        <TableRow className="border-slate-200">
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Hours</TableHead>
                        <TableHead className="text-xs font-semibold text-right">DA</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Incidental</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {claim.da_breakdown?.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
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
                    <span className="text-slate-600">Total Expenses:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(claim.total_expenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Daily Allowance:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(claim.total_da)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Incidental:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(claim.total_incidental)}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between text-sm font-semibold mb-2">
                      <span className="text-slate-700">Gross Total:</span>
                      <span className="text-slate-800">
                        {formatCurrency(
                          parseFloat(String(claim.total_expenses)) +
                          parseFloat(String(claim.total_da)) +
                          parseFloat(String(claim.total_incidental))
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Advance Received:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(claim.advance_received)}</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border mt-3 ${isRefund ? 'bg-green-50 border-green-200' : isBalance ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-xs text-slate-600 mb-1">Final Amount</p>
                    <p className={`text-lg font-bold ${isRefund ? 'text-green-600' : isBalance ? 'text-blue-600' : 'text-slate-800'}`}>
                      {isRefund ? '+' : ''}{formatCurrency(claim.final_amount_payable)}
                    </p>
                    <p className="text-xs mt-1 text-slate-600">
                      {isRefund ? 'To be refunded' : isBalance ? 'Balance deducted' : 'Settled'}
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
                            <p className="font-semibold text-sm text-slate-800">{flow.approver_name}</p>
                            <p className="text-xs text-slate-500">Level {flow.level}</p>
                            
                          </div>
                          <div className="flex flex-col pt-1">
                            <Badge className={`text-center uppercase text-xs px-3 py-0 ${statusColorClass(claim.status)}`} variant='success'>
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
                  <StatusIcon className={`w-10 h-10 mx-auto ${statusConfig.iconColor}`} />
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Claim Status</p>
                    <p className={`text-lg font-bold ${statusConfig.iconColor}`}>{statusConfig.label}</p>
                  </div>
                  <p className="text-xs text-slate-600">{statusConfig.message}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
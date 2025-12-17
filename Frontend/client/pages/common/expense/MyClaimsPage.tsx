import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ClipboardList, Clock, CheckCircle, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { expenseAPI } from '@/src/api/expense';
import { ROUTES } from '@/routes/routes';
import type { ClaimListParams } from '@/src/types/expense-2.types';

export const formatISODate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Invalid Date";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
};

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
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t mt-4 py-4 px-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between z-20">
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

        <Button variant="default" size="sm" className="h-8 px-3" onClick={handleJump}>Go</Button>
      </div>

      {/* CENTER — Page Numbers (Responsive) */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" disabled={!previous} onClick={() => onPageChange(current_page - 1)} className="h-8">Previous</Button>

        {/* Page Numbers */}
        <div className="flex flex-wrap gap-1 justify-center">
          {Array.from({ length: total_pages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              size="sm"
              variant={page === current_page ? "default" : "outline"}
              className={`h-8 px-3 ${page === current_page
                ? "bg-blue-600 text-white"
                : "border-gray-300"
                }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}
        </div>

        <Button className="h-8" variant="outline" size="sm" disabled={!next} onClick={() => onPageChange(current_page + 1)}>Next</Button>
      </div>

      {/* RIGHT — Total pages */}
      <div className="text-sm text-gray-600 text-center md:text-right">
        Page <b>{current_page}</b> of <b>{total_pages}</b>
      </div>
    </div>
  );
}

export default function MyClaimsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ClaimListParams>({ page: 1 });
  const [search, setSearch] = useState('');

  const { data: claimsResponse, isLoading } = useQuery({
    queryKey: ['claims', filters, page],
    queryFn: () => expenseAPI.claims.getAll({ ...filters, page }),
  });

  const claims = claimsResponse?.data || [];
  const pagination = claimsResponse?.meta?.pagination;

  const { data: statusResponse } = useQuery({
    queryKey: ['claim-status'],
    queryFn: () => expenseAPI.claimStatus.getAll(),
  });

  const statusList = statusResponse?.data || [];

  // Calculate stats from claims data
  const stats = {
    total_claims: pagination?.count || 0,
    pending: claims?.filter((c: any) => c.status_code === 'pending' || c.status_code === 'submitted')?.length || 0,
    approved: claims?.filter((c: any) => c.status_code === 'approved')?.length || 0,
    rejected: claims?.filter((c: any) => c.status_code === 'rejected')?.length || 0,
  };

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold">My Expense Claims</h1>
          <p className="text-lg text-muted-foreground mt-1">
            View and manage your expense claim submissions
          </p>
        </div>
        <Button onClick={() => navigate(ROUTES.claimApplicationPage)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Claim
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-[70px] h-[70px] rounded-lg bg-blue-50 flex items-center justify-center">
                <ClipboardList className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.total_claims}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Claims
                </div>
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
                  Pending Claims
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
                  Approved Claims
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-[70px] h-[70px] rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {stats.rejected}
                </div>
                <div className="text-sm text-muted-foreground">
                  Rejected Claims
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by Travel Request ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: value === "all" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusList?.map((status) => (
                    <SelectItem key={status.id} value={status.code}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* <Input
                type="date"
                placeholder="From Date"
                value={filters.from_date || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, from_date: e.target.value || undefined }))
                }
                className="w-full sm:w-[160px]"
              />

              <Input
                type="date"
                placeholder="To Date"
                value={filters.to_date || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, to_date: e.target.value || undefined }))
                }
                className="w-full sm:w-[160px]"
              /> */}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Travel Request</TableHead>
                  <TableHead>Total Expenses</TableHead>
                  <TableHead>Advance Taken</TableHead>
                  <TableHead>Final Payable</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No claims found. Create your first expense claim to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  claims?.map((claim: any) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">TR-{claim.travel_application}</TableCell>
                      <TableCell>
                        ₹{(Number(claim.total_expenses) + Number(claim.total_da) + Number(claim.total_incidental)).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        ₹{Number(claim.advance_received).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={
                          Number(claim.final_amount_payable) < 0
                            ? "text-red-600 font-semibold"
                            : "text-green-600 font-semibold"
                        }
                      >
                        ₹{Number(claim.final_amount_payable).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge statusType="claim" status={claim.status_code} />
                      </TableCell>
                      <TableCell>
                        {claim.created_on ? formatISODate(claim.created_on) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="hover:bg-dark-200 hover:text-dark-foreground"
                            onClick={() => navigate(ROUTES.claimDetailPage(claim.id))}
                          >
                            View
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
    </div>
  );
}
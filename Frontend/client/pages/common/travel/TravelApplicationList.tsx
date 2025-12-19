import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTravelStore } from '@/src/store/travelStore';
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Clock,
  CheckCircle,
  ClipboardList,
  SquarePen,
} from "lucide-react";
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, SendHorizontal, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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
    <div className="
      sticky bottom-0 left-0 right-0 
      bg-white 
      border-t 
      mt-4 
      py-4 
      px-3 
      flex flex-col gap-3 
      md:flex-row md:items-center md:justify-between
      z-20
    ">

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
  const { applications, stats, pagination, isLoading, loadApplications, loadStats, submitApplication, deleteApplication } = useTravelStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [application, setApplications] = useState<TravelApplication | null>(null);
  const { id } = useParams<{ id: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadApplications(statusFilter, page);
    loadStats();
  }, [statusFilter, page]);

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

    // 1️⃣ If backend returned the nested error as a Python string
    if (typeof error === "string") {
      const msg = parsePythonErrorString(error);
      if (msg) return msg;
      return error;
    }

    // 2️⃣ If it's an array
    if (Array.isArray(error)) {
      return extractErrorMessage(error[0]);
    }

    // 3️⃣ If it's an object
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
      toast({ title: 'Success', description: 'Application submitted successfully' });
    } catch (error: any) {
      console.error("Failed to save draft:", error);
      console.log("RAW ERROR:", error.response?.data);
      console.log("RAW ERRORS:", error.response?.data?.errors);
      const backendErrors = error.response?.data?.errors;
      const message = extractErrorMessage(backendErrors);
      toast({ title: 'Error', description: message || "Failed to submit application", variant: 'destructive' });
    }
  };

  const handleDeleteApplication = async (id: number) => {
    if (confirm('Are you sure you want to delete this application?')) {
      try {
        // await deleteMutation.mutate(id);
        await deleteApplication(id);
        toast({ title: 'Success', description: 'Application deleted successfully' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete application', variant: 'destructive' });
      }
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    if (startDate === endDate) {
      return formatDate(start);
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (isLoading) {
    return
    // <Layout>
    <div className="p-4">Loading...</div>
    // </Layout>;
  }

  return (
    // <Layout>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold">My Travel Applications</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Track your travel requests, approvals, and booking progress in one place.
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
                  <div className="text-sm text-muted-foreground">
                    Draft(s)
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
            <div className="flex flex-col sm:flex-row gap-4">
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
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
                  <TableHead className='max-w-[200px]'>Purpose</TableHead>
                  <TableHead className='max-w-2xs'>Dates</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      {statusFilter === "all" && "No travel applications found. Create your first travel application."}
                      {statusFilter === "pending" && "No pending applications found."}
                      {statusFilter === "approved" && "No approved applications found."}
                      {statusFilter === "rejected" && "No rejected applications found."}
                      {statusFilter === "draft" && "No draft applications found."}
                      {statusFilter === "completed" && "No completed applications found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.travel_request_id}</TableCell>
                      <TableCell className='max-w-[200px] truncate' title={app.purpose}>{app.purpose}</TableCell>
                      {/* <TableCell>{app.trip_details.length} trip(s)</TableCell> */}
                      <TableCell className='max-w-2xs'>{formatDateRange(app.trip_details[0].departure_date, app.trip_details[0].return_date)}</TableCell>
                      <TableCell>₹{parseFloat(app.estimated_total_cost).toLocaleString()}</TableCell>
                      <TableCell className="text-center"><StatusBadge statusType="travel" status={app.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {app.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              // onClick={() => navigate(`/employee/travel/${app.id}`)}
                              onClick={() => handleSubmitApplication(app.id)}
                            >
                              <SendHorizontal />
                            </Button>
                          )}
                          {app.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-red-600 text-white hover:bg-red-700"
                              onClick={() => handleDeleteApplication(app.id)}
                            >
                              <Trash2 className="w-2 h-2" />
                            </Button>
                          )}
                          {/* {!["cancelled", "completed"].includes(app.status) && (
                            <Button
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700"
                              onClick={() => navigate(ROUTES.makeTravelApplication(app.id))}
                            >
                              Edit
                            </Button>
                          )} */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="hover:bg-dark-200 hover:text-dark-foreground"
                            onClick={() => navigate(ROUTES.travelApplicationView(app.id))}
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
    </div>
    // </Layout>
  );
}
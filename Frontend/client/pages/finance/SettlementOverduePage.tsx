import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ROUTES } from "@/routes/routes";
import { expenseAPI } from "@/src/api/expense";

export interface SettlementOverdueRow {
  travel_application_id: number;
  travel_request_id: string;
  employee_name: string;
  employee_email: string;
  employee_code: string | null;
  department: string | null;
  designation: string | null;
  unit_location: string | null;
  branch_location: string | null;
  travel_purpose: string;
  travel_start_date: string | null;
  travel_end_date: string | null;
  settlement_due_date: string | null;
  days_overdue: number | null;
  advance_amount: number;
}

const SettlementOverduePage = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SettlementOverdueRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [assignedLocations, setAssignedLocations] = useState<
    { id: number; name: string }[]
  >([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchLocations = useCallback(async () => {
    try {
      const response = await expenseAPI.finance.getAssignedLocations();
      if (response.success && response.data) {
        setAssignedLocations(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await expenseAPI.finance.getSettlementOverdue({
        search: searchTerm || undefined,
        location_id:
          locationFilter === "all" ? undefined : Number(locationFilter),
        page: currentPage,
        page_size: pageSize,
      });
      if (response.success) {
        setRows(response.data.results || []);
        setTotalCount(response.data.count ?? 0);
      } else {
        setError("Failed to load settlement overdue records");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm, locationFilter]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await expenseAPI.finance.exportSettlementOverdue({
        search: searchTerm || undefined,
        location_id:
          locationFilter === "all" ? undefined : Number(locationFilter),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `settlement_overdue_claims_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="min-h-screen">
      <div className="max-w-full mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              Settlement Overdue
            </h1>
            <p className="text-muted-foreground mt-1">
              Travel completed but claim not raised after settlement due date
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Excel
          </Button>
        </div>

        <div className="bg-white border p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <Input
                placeholder="Search employee, email, TR ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            {assignedLocations.length > 0 && (
              <div className="w-full sm:w-[220px]">
                <Select
                  value={locationFilter}
                  onValueChange={(v) => {
                    setLocationFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {assignedLocations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border overflow-hidden">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              No overdue settlement records found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Travel Request ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Unit Location</TableHead>
                    <TableHead>Trip Start</TableHead>
                    <TableHead>Trip End</TableHead>
                    <TableHead>Settlement Due</TableHead>
                    <TableHead className="text-center">Days Overdue</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-center">Travel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.travel_application_id}>
                      <TableCell className="font-medium">
                        {row.travel_request_id}
                      </TableCell>
                      <TableCell>
                        <div>{row.employee_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.employee_code || row.employee_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.unit_location || row.branch_location || "—"}
                      </TableCell>
                      <TableCell>{row.travel_start_date || "—"}</TableCell>
                      <TableCell>{row.travel_end_date || "—"}</TableCell>
                      <TableCell>{row.settlement_due_date || "—"}</TableCell>
                      <TableCell className="text-center text-amber-700 font-semibold">
                        {row.days_overdue ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{row.advance_amount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          to={ROUTES.travelApplicationViewForFinance(
                            row.travel_application_id,
                          )}
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          Travel Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {totalCount > pageSize && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages} ({totalCount} records)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettlementOverduePage;

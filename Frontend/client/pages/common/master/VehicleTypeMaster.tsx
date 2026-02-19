import React, { useState, useEffect } from "react";
import { vehicleMasterAPI } from "@/src/api/master_vehicle";
import { FormModal } from "@/pages/common/reusables/Reusables";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function VehicleTypeMasterPage() {
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]); // For dropdown
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("true"); // Default Active
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const pageSize = 10;

  // Fetch Category Dropdown for the Form
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await vehicleMasterAPI.category.getDropdown();
        setCategoryOptions(
          data.map((cat: any) => ({ label: cat.name, value: cat.id })),
        );
      } catch (err) {
        console.error("Failed to load vehicle categories dropdown", err);
      }
    };
    fetchCategories();
  }, []);

  const fetchVehicleTypes = async () => {
    setLoading(true);
    try {
      const params = {
        page: page,
        page_size: pageSize,
        search: search || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
      };

      const data = await vehicleMasterAPI.type.getAll(params);

      if (data.results) {
        setVehicleTypes(data.results);
        console.log(data.results);
        setTotalCount(data.count);
        setTotalPages(Math.ceil(data.count / pageSize));
      } else {
        setVehicleTypes(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch vehicle types", err);
      toast.error("Failed to load vehicle types.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleTypes();
  }, [page, statusFilter, categoryFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchVehicleTypes();
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
  };

  // Open modal for adding
  const handleAdd = () => {
    setSelectedType(null);
    setIsFormOpen(true);
  };

  // Open modal for updating
  const handleEdit = (vType) => {
    setSelectedType(vType);
    setIsFormOpen(true);
  };

  // Handle form submit (Add / Update)
  const handleSubmit = async (formData) => {
    try {
      if (selectedType) {
        await vehicleMasterAPI.type.update(selectedType.id, formData);
        toast.success("Vehicle type updated successfully.");
      } else {
        await vehicleMasterAPI.type.create(formData);
        toast.success("Vehicle type created successfully.");
      }
      setIsFormOpen(false);
      fetchVehicleTypes();
    } catch (err) {
      console.error("Failed to save vehicle type", err);
      toast.error("Failed to save vehicle type. Check inputs.");
    }
  };

  // Open delete confirmation
  const handleDelete = (vType) => {
    setSelectedType(vType);
    setIsDeleteOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      if (selectedType) {
        await vehicleMasterAPI.type.delete(selectedType.id);
        toast.success("Vehicle type deleted (deactivated) successfully.");
        setIsDeleteOpen(false);
        fetchVehicleTypes();
      }
    } catch (err) {
      console.error("Failed to delete vehicle type", err);
      toast.error("Failed to delete vehicle type.");
    }
  };

  const fields = [
    {
      name: "category",
      label: "Vehicle Category",
      type: "select",
      options: categoryOptions,
      required: true,
      placeholder: "Select Category",
    },
    {
      name: "name",
      label: "Type Name",
      type: "text",
      required: true,
      maxLength: 100,
      placeholder: "e.g. Sedan Standard, SUV Luxury",
    },
    {
      name: "capacity",
      label: "Seating Capacity",
      type: "number",
      required: true,
      placeholder: "e.g. 5",
    },
    {
      name: "is_active",
      label: "Is Active",
      type: "checkbox",
      default: true,
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Vehicle Type Master
        </h1>
        <Button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Vehicle Type
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 md:grid-cols-[70%_30%] sm:grid-cols-1 gap-2 w-full">
            {/* Search Input */}
            <div className="flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-6 -translate-y-1/2 text-gray-500" />
                <Input
                  placeholder="Search name, code or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  className="pl-10 w-full"
                />
              </div>
              <Button
                variant="default"
                onClick={handleSearch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                Search
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Category Filter */}
              <Select
                value={categoryFilter.toString()}
                onValueChange={(val) => {
                  setCategoryFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryOptions.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Seating Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : vehicleTypes.length > 0 ? (
                vehicleTypes.map((vType) => (
                  <TableRow
                    key={vType.id}
                    className="border-b last:border-none"
                  >
                    <TableCell className="font-medium text-slate-700">
                      {vType.name}
                    </TableCell>
                    <TableCell>
                      {vType.category_name || (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>{vType.capacity} (Seater)</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${vType.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {vType.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(vType)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {vType.is_active && (
                          <button
                            onClick={() => handleDelete(vType)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-gray-500 py-8"
                  >
                    No vehicle types found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              Showing {vehicleTypes.length} of {totalCount} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-1 px-2 text-sm">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <FormModal
        title={selectedType ? "Update Vehicle Type" : "Add New Vehicle Type"}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        fields={fields}
        initialData={selectedType || { is_active: true }}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && selectedType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Confirm Deactivation
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete (deactivate){" "}
              <strong>{selectedType.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

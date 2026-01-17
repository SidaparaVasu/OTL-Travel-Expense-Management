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
import { Plus, Edit2, Trash2, Search, Filter, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function VehicleCategoryMasterPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("true"); // Default Active
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const pageSize = 10;

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const params = {
        page: page,
        page_size: pageSize,
        search: search || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter,
      };
      
      const data = await vehicleMasterAPI.category.getAll(params);
      
      if (data.results) {
        setCategories(data.results);
        setTotalCount(data.count);
        setTotalPages(Math.ceil(data.count / pageSize));
      } else {
        // Fallback if pagination disabled or different format
        setCategories(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch vehicle categories", err);
      toast.error("Failed to load vehicle categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchCategories();
  };

  const handleClearSearch = () => {
      setSearch("");
      setPage(1);
  };
    

  // Open modal for adding
  const handleAdd = () => {
    setSelectedCategory(null);
    setIsFormOpen(true);
  };

  // Open modal for updating
  const handleEdit = (category) => {
    setSelectedCategory(category);
    setIsFormOpen(true);
  };

  // Handle form submit (Add / Update)
  const handleSubmit = async (formData) => {
    try {
      if (selectedCategory) {
        await vehicleMasterAPI.category.update(selectedCategory.id, formData);
        toast.success("Vehicle category updated successfully.");
      } else {
        await vehicleMasterAPI.category.create(formData);
        toast.success("Vehicle category created successfully.");
      }
      setIsFormOpen(false);
      fetchCategories();
    } catch (err) {
      console.error("Failed to save vehicle category", err);
      toast.error("Failed to save vehicle category. Code might be unique.");
    }
  };

  // Open delete confirmation
  const handleDelete = (category) => {
    setSelectedCategory(category);
    setIsDeleteOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      if (selectedCategory) {
          await vehicleMasterAPI.category.delete(selectedCategory.id);
          toast.success("Vehicle category deleted (deactivated) successfully.");
          setIsDeleteOpen(false);
          fetchCategories();
      }
    } catch (err) {
      console.error("Failed to delete vehicle category", err);
      toast.error("Failed to delete vehicle category.");
    }
  };

  const fields = [
    {
      name: "name",
      label: "Category Name",
      type: "text",
      required: true,
      maxLength: 100,
      placeholder: "e.g. Sedan, SUV",
    },
    {
      name: "code",
      label: "Category Code",
      type: "text",
      required: true,
      maxLength: 30,
      placeholder: "e.g. sedan, suv",
    },
    {
        name: "is_active",
        label: "Is Active",
        type: "checkbox",
        default: true
    }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Vehicle Category Master
        </h1>
        <Button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Vehicle Categories List</CardTitle>
            <div className="flex gap-3">
              <div className="flex gap-2">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 h-4 w-6 -translate-y-1/2 text-gray-500" />
                    <Input
                    placeholder="Search by name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSearch();
                    }}
                    className="pl-10"
                    />
                </div>
                <Button variant="default" onClick={handleSearch} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700">
                    Search
                </Button>
              </div>

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
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <span>Loading...</span>
                          </div>
                      </TableCell>
                  </TableRow>
              ) : categories.length > 0 ? (
                categories.map((cat) => (
                  <TableRow key={cat.id} className="border-b last:border-none">
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.code}</TableCell>
                    <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cat.is_active ? "Active" : "Inactive"}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(cat)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {cat.is_active && (
                            <button
                            onClick={() => handleDelete(cat)}
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
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    No vehicle categories found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                  Showing {categories.length} of {totalCount} entries
              </div>
              <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
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
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
        title={
          selectedCategory
            ? "Update Vehicle Category"
            : "Add New Vehicle Category"
        }
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        fields={fields}
        initialData={selectedCategory || { is_active: true }}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Confirm Deactivation
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete (deactivate){" "}
              <strong>{selectedCategory.name}</strong>?
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

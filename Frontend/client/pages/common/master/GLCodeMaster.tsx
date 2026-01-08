import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/routes";
import { travelAPI } from "@/src/api/travel";
// import { Layout } from "@/components/Layout";
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
import { Plus, Save, Edit2, Trash2, X, UploadCloud } from "lucide-react";
import { check } from "prettier";

export default function GLCodeMasterPage() {
  const navigate = useNavigate();
  const [glCode, setGLCode] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGLCode, setSelectedGLCode] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
  });

  const fetchGLCodes = async (page = 1) => {
    try {
      const data = await travelAPI.getGLCodes(page, pagination.pageSize);
      if (data.results) {
        // Handle StandardResultsSetPagination format (standard DRF)
        setGLCode(data.results);
        setPagination((prev) => ({
          ...prev,
          page: page,
          totalCount: data.count,
          totalPages: Math.ceil(data.count / prev.pageSize),
        }));
      } else if (data.data && data.meta) {
        // Handle custom paginated_response format
        setGLCode(data.data);
        setPagination((prev) => ({
          ...prev,
          page: data.meta.pagination.current_page,
          totalCount: data.meta.pagination.count,
          totalPages: data.meta.pagination.total_pages,
        }));
      } else {
        // Fallback for non-paginated / legacy
        setGLCode(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch GL codes", err);
    }
  };

  useEffect(() => {
    fetchGLCodes(pagination.page);
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchGLCodes(newPage);
    }
  };

  // Open modal for adding
  const handleAdd = () => {
    setSelectedGLCode(null);
    setIsFormOpen(true);
  };

  // Open modal for updating
  const handleEdit = (type) => {
    setSelectedGLCode(type);
    setIsFormOpen(true);
  };

  // Handle form submit (Add / Update)
  const handleSubmit = async (formData) => {
    try {
      if (selectedGLCode) {
        await travelAPI.updateGLCodes(selectedGLCode.id, formData);
      } else {
        await travelAPI.createGLCodes(formData);
      }
      setIsFormOpen(false);
      fetchGLCodes();
    } catch (err) {
      console.error("Failed to save GL Code", err);
    }
  };

  // Open delete confirmation
  const handleDelete = (gl) => {
    setSelectedGLCode(gl);
    setIsDeleteOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      await travelAPI.deleteGLCode(selectedGLCode.id);
      setIsDeleteOpen(false);
      fetchGLCodes();
      setSelectedGLCode(null);
    } catch (err) {
      console.error("Failed to delete GL Code", err);
    }
  };

  const fields = [
        { name: "vertical_name", label: "Vertical Name", type: "text", required: true, maxLength: 100 },
    { name: "description", label: "Description", type: "textarea" },
        { name: "sorting_no", label: "Sorting No.", type: "number", required: true },
    { name: "gl_code", label: "GL Code", type: "text", required: true },
    { name: "is_active", label: "Active", type: "checkbox" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          GL Code Master
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(ROUTES.importExport)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            <UploadCloud className="w-4 h-4" /> Bulk Upload
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> GL Code
          </button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>GL Code List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sort no.</TableHead>
                <TableHead>GL Code</TableHead>
                <TableHead>Vertical Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">is Active</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {glCode.length > 0 ? (
                glCode.map((gl) => (
                  <TableRow key={gl.id} className="border-b last:border-none">
                    <TableCell>{gl.sorting_no}</TableCell>
                    <TableCell>{gl.gl_code}</TableCell>
                    <TableCell>{gl.vertical_name}</TableCell>
                    <TableCell>{gl.description}</TableCell>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="accent-blue-600"
                        checked={gl.is_active}
                        readOnly
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(gl)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(gl)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500">
                    No GL Code found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <FormModal
        title={selectedGLCode ? "Update GL Code" : "Add New GL Code"}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        fields={fields}
        initialData={selectedGLCode || {}}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Confirm Delete
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>{selectedGLCode.gl_code}</strong>?
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

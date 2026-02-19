import React, { useState, useEffect } from "react";
import { organizationMasterAPI } from "@/src/api/master_company";
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
import { Plus, Save, Edit2, Trash2, X } from "lucide-react";

export default function GradeMasterPage() {
  const [employeeType, setEmployeeType] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEmployeeType, setSelectedEmployeeType] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const fetchEmployeeTypes = async () => {
    try {
      const data = await organizationMasterAPI.employeeType.getAll();
      // console.log(data.data);
      setEmployeeType(data.data.results);
    } catch (err) {
      console.error("Failed to fetch employee types", err);
    }
  };

  useEffect(() => {
    fetchEmployeeTypes();
  }, []);

  // Open modal for adding
  const handleAdd = () => {
    setSelectedEmployeeType(null);
    setIsFormOpen(true);
  };

  // Open modal for updating
  const handleEdit = (type) => {
    setSelectedEmployeeType(type);
    setIsFormOpen(true);
  };

  // Handle form submit (Add / Update)
  const handleSubmit = async (formData) => {
    try {
      if (selectedEmployeeType) {
        await organizationMasterAPI.employeeType.update(
          selectedEmployeeType.id,
          formData,
        );
      } else {
        await organizationMasterAPI.employeeType.create(formData);
      }
      setIsFormOpen(false);
      fetchEmployeeTypes();
    } catch (err) {
      console.error("Failed to save employee type", err);
    }
  };

  // Open delete confirmation
  const handleDelete = (type) => {
    setSelectedEmployeeType(type);
    setIsDeleteOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    try {
      await organizationMasterAPI.employeeType.delete(selectedEmployeeType.id);
      setIsDeleteOpen(false);
      fetchEmployeeTypes();
    } catch (err) {
      console.error("Failed to delete employee", err);
    }
  };

  const fields = [
    {
      name: "type",
      label: "Employee Type",
      type: "text",
      required: true,
      maxLength: 100,
    },
    { name: "description", label: "Description", type: "textarea" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Employee Type Master
        </h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Employee Type
        </button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Employee Types List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="whitespace-nowrap">
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeType.length > 0 ? (
                employeeType.map((type) => (
                  <TableRow key={type.id} className="border-b last:border-none whitespace-nowrap">
                    <TableCell>{type.type}</TableCell>
                    <TableCell>{type.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(type)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(type)}
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
                    No employee type found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <FormModal
        title={
          selectedEmployeeType
            ? "Update Employee Type"
            : "Add New Employee Type"
        }
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        fields={fields}
        initialData={selectedEmployeeType || {}}
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
              <strong>{selectedEmployeeType.name}</strong>?
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

import React, { useState, useEffect } from "react";
import { masterAPI } from "@/src/api/master";
// import { Layout } from "@/components/Layout";
import { FormModal } from "@/pages/common/reusables/Reusables";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Save, Edit2, Trash2, X } from "lucide-react";

export default function GradeMasterPage() {
    const [grades, setGrades] = useState([]);
    const [glCodes, setGLCodes] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const fetchGrades = async () => {
        try {
            const data = await masterAPI.getGrades();
            setGrades(data.results ?? data.data?.results ?? []);
            console.log(data.results ?? data.data?.results);
        } catch (err) {
            console.error("Failed to fetch grades", err);
        }
    };

    const fetchGLCodes = async () => {
        try {
            const glcodes = await masterAPI.getGLCodes();
            // The API returns { success: true, data: [...], meta: ... }
            const glListData = glcodes.data || [];
            const formatted = Array.isArray(glListData) ? glListData.map(gl => ({
                value: gl.id,
                label: `${gl.gl_code} - ${gl.vertical_name}`,
            })) : [];
            console.log("Fetched GL Codes:", glListData);
            setGLCodes(formatted);
        } catch (err) {
            console.log("Failed to fetch GL Codes", err);
        }
    };

    useEffect(() => {
        fetchGrades();
        fetchGLCodes();
    }, []);

    // Open modal for adding
    const handleAdd = () => {
        setSelectedGrade(null);
        setIsFormOpen(true);
    };

    // Open modal for updating
    const handleEdit = (grade) => {
        setSelectedGrade({...grade, glcode: grade.glcode});
        setIsFormOpen(true);
    };

    // Handle form submit (Add / Update)
    const handleSubmit = async (formData) => {
        try {
            if (selectedGrade) {
                await masterAPI.updateGrade(selectedGrade.id, formData);
            } else {
                await masterAPI.createGrade(formData);
            }
            setIsFormOpen(false);
            fetchGrades();
        } catch (err) {
            console.error("Failed to save grade", err);
        }
    };

    // Open delete confirmation
    const handleDelete = (grade) => {
        setSelectedGrade(grade);
        setIsDeleteOpen(true);
    };

    // Confirm delete
    const confirmDelete = async () => {
        try {
            await masterAPI.deleteGrade(selectedGrade.id);
            setIsDeleteOpen(false);
            fetchGrades();
        } catch (err) {
            console.error("Failed to delete grade", err);
        }
    };

    const fields = [
        { name: "name", label: "Grade Name", type: "text", required: true, maxLength: 100 },
        { name: "description", label: "Description", type: "textarea" },
        { name: "sorting_no", label: "Sorting Number", type: "text", required: true },
        { name: "glcode", label: "GL Code", type: "select", options: glCodes, required: true },
        {
            name: "is_active", 
            label: "Active",
            type: "checkbox",
        },
    ];

    return (
        // <Layout>
            <div className="p-6 bg-gray-50 min-h-screen">
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-slate-800">Grade Master</h1>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" /> Add Grade
                    </button>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Grades List</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="whitespace-nowrap">
                                    <TableHead>Sort no.</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-center">GL Code</TableHead>
                                    <TableHead className="text-center">is Active</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {grades.length > 0 ? (
                                    grades.map((grade) => (
                                        <TableRow key={grade.id} className="border-b last:border-none whitespace-nowrap">
                                            <TableCell>{grade.sorting_no}</TableCell>
                                            <TableCell>{grade.name}</TableCell>
                                            <TableCell>{grade.description}</TableCell>
                                            <TableCell className="text-center">{grade.glcode_name || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <input type="checkbox" className="accent-blue-600" checked={grade.is_active} readOnly />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(grade)}
                                                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(grade)}
                                                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )))
                                    : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-gray-500">
                                                No grades found.
                                            </TableCell>
                                        </TableRow>
                                    )
                                }
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add / Edit Modal */}
                <FormModal
                    title={selectedGrade ? "Update Grade" : "Add New Grade"}
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    fields={fields}
                    initialData={selectedGrade || {}}
                    onSubmit={handleSubmit}
                />

                {/* Delete Confirmation Modal */}
                {
                    isDeleteOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                                    Confirm Delete
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Are you sure you want to delete <strong>{selectedGrade.name}</strong>?
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
                    )
                }
            </div >
        // </Layout >
    );
}


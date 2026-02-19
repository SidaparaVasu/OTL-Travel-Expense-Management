import React, { useEffect, useState } from "react";
import { locationAPI } from "@/src/api/master_location";
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
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CityCategory {
    id: number;
    name: string; // A, B, C
    description?: string;
}

interface Option {
    value: string;
    label: string;
}

export default function CityCategoriesMasterPage() {
    const [categories, setCategories] = useState<CityCategory[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<Option[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<CityCategory | null>(null);

    /* =========================
       Fetch City Categories
       ========================= */
    const fetchCategories = async () => {
        try {
            const res = await locationAPI.getCityCategories();
            console.log(res);
            setCategories(res.data.data.results || res.data);
        } catch (error) {
            console.error("Failed to fetch city categories", error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    /* =========================
       Handlers
       ========================= */
    const handleAdd = () => {
        setSelectedCategory(null);
        setIsFormOpen(true);
    };

    const handleEdit = (category: CityCategory) => {
        setSelectedCategory(category);
        setIsFormOpen(true);
    };

    const handleDelete = (category: CityCategory) => {
        setSelectedCategory(category);
        setIsDeleteOpen(true);
    };

    const handleSubmit = async (formData: any) => {
        try {
            // Normalize input
            const payload = {
                ...formData,
                name: formData.name?.toUpperCase(),
            };

            if (selectedCategory) {
                await locationAPI.updateCityCategoryForCity(
                    selectedCategory.id,
                    payload
                );
                toast.success("City category updated successfully");
            } else {
                await locationAPI.createCityCategory(payload);
                toast.success("City category created successfully");
            }

            setIsFormOpen(false);
            fetchCategories();

        } catch (error: any) {
            const apiError = error?.response?.data?.errors?.name[0];
            console.log(error?.response?.data?.errors?.name[0], typeof error?.response);
            // Unique constraint error
            if (apiError) {
                toast.error(apiError);
                return;
            }

            // Fallback
            toast.error("Failed to save city category");
            console.error("City category save error:", error);
        }
    };

    const confirmDelete = async () => {
        if (!selectedCategory) return;
        try {
            await locationAPI.deleteCityCategory(selectedCategory.id);
            setIsDeleteOpen(false);
            fetchCategories();
            toast.success("City category deleted successfully");
        } catch (error) {
            console.error("Failed to delete city category", error);
        }
    };

    /* =========================
       Form Fields
       ========================= */
    const fields = [
        {
            name: 'name',
            label: 'City Category Code',
            type: 'text',
            required: true,
            maxLength: 1,
            placeholder: 'Enter category code (e.g. A, B, C, D)',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Optional description for this city category'
        },
    ];

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6 sm:flex-row sm:gap-2 flex-col">
                <h1 className="text-2xl font-semibold text-slate-800">City Category Master</h1>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" /> Add Category
                </button>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>City Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="whitespace-nowrap">
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length > 0 ? (
                                categories.map((category) => (
                                    <TableRow key={category.id} className="whitespace-nowrap">
                                        <TableCell>{category.name}</TableCell>
                                        <TableCell>{category.description || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(category)}
                                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(category)}
                                                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-gray-500">
                                        No city categories found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add / Edit Modal */}
            <FormModal
                title={selectedCategory ? 'Update City Category' : 'Add City Category'}
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                fields={fields}
                initialData={selectedCategory || {}}
                onSubmit={handleSubmit}
            />

            {/* Delete Confirmation */}
            {isDeleteOpen && selectedCategory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Confirm Delete</h2>
                        <p className="text-sm text-slate-600 mb-6">
                            Are you sure you want to delete <strong>{selectedCategory.name}</strong>?
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

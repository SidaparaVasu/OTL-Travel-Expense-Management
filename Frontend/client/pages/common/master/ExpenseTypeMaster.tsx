import React, { useEffect, useState } from "react";
import {
    Search,
    Plus,
    Pen,
    Trash2,
    X,
    Check,
    AlertCircle,
    ToggleLeft,
    ToggleRight,
} from "lucide-react";
import { expenseAPI } from "@/src/api/expense";

interface ExpenseType {
    id: number;
    code: string;
    name: string;
    requires_receipt: boolean;
    is_distance_based: boolean;
    is_active: boolean;
}

type NotificationState = {
    message: string;
    type: "success" | "error";
} | null;

const ExpenseTypeMaster = () => {
    const [items, setItems] = useState<ExpenseType[]>([]);
    const [filteredItems, setFilteredItems] = useState<ExpenseType[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ExpenseType | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
    const [filterRequiresReceipt, setFilterRequiresReceipt] = useState<"all" | "yes" | "no">("all");
    const [filterDistanceBased, setFilterDistanceBased] = useState<"all" | "yes" | "no">("all");

    const [notification, setNotification] = useState<NotificationState>(null);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ExpenseType | null>(null);

    const [formData, setFormData] = useState({
        code: "",
        name: "",
        requires_receipt: true,
        is_distance_based: false,
        is_active: true,
    });

    useEffect(() => {
        fetchExpenseTypes();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [items, searchTerm, filterActive, filterRequiresReceipt, filterDistanceBased]);

    const fetchExpenseTypes = async () => {
        setLoading(true);
        try {
            const data = await expenseAPI.expenseTypes.getAll();
            const list: ExpenseType[] = Array.isArray(data)
                ? data
                : (data as any).data || [];
            setItems(list);
        } catch (error) {
            showNotification("Failed to fetch expense types", "error");
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let list = [...items];

        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(
                (e) =>
                    e.code.toLowerCase().includes(q) ||
                    e.name.toLowerCase().includes(q)
            );
        }

        if (filterActive !== "all") {
            list = list.filter((e) =>
                filterActive === "active" ? e.is_active : !e.is_active
            );
        }

        if (filterRequiresReceipt !== "all") {
            const flag = filterRequiresReceipt === "yes";
            list = list.filter((e) => e.requires_receipt === flag);
        }

        if (filterDistanceBased !== "all") {
            const flag = filterDistanceBased === "yes";
            list = list.filter((e) => e.is_distance_based === flag);
        }

        setFilteredItems(list);
    };

    const showNotification = (message: string, type: "success" | "error" = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSoftToggle = async (item: ExpenseType) => {
        const payload = {
            code: item.code,
            name: item.name,
            requires_receipt: item.requires_receipt,
            is_distance_based: item.is_distance_based,
            is_active: !item.is_active,
        };
        try {
            await expenseAPI.expenseTypes.update(item.id, payload);
            showNotification(
                `Expense type ${!item.is_active ? "activated" : "deactivated"} successfully`
            );
            fetchExpenseTypes();
        } catch (error) {
            showNotification("Failed to update active status", "error");
        }
    };

    const handleHardDelete = async () => {
        if (!deleteTarget) return;
        try {
            await expenseAPI.expenseTypes.delete(deleteTarget.id, true);
            showNotification("Expense type deleted successfully");
            fetchExpenseTypes();
            setShowDeleteConfirm(false);
            setDeleteTarget(null);
        } catch (error) {
            showNotification("Failed to delete expense type", "error");
        }
    };

    const openDeleteConfirm = (item: ExpenseType) => {
        setDeleteTarget(item);
        setShowDeleteConfirm(true);
    };

    const openModalForCreate = () => {
        setEditingItem(null);
        setFormData({
            code: "",
            name: "",
            requires_receipt: true,
            is_distance_based: false,
            is_active: true,
        });
        setShowModal(true);
    };

    const openModalForEdit = (item: ExpenseType) => {
        setEditingItem(item);
        setFormData({
            code: item.code,
            name: item.name,
            requires_receipt: item.requires_receipt,
            is_distance_based: item.is_distance_based,
            is_active: item.is_active,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({
            code: "",
            name: "",
            requires_receipt: true,
            is_distance_based: false,
            is_active: true,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            code: formData.code.trim(),
            name: formData.name.trim(),
            requires_receipt: formData.requires_receipt,
            is_distance_based: formData.is_distance_based,
            is_active: formData.is_active,
        };

        if (!payload.code || !payload.name) {
            showNotification("Code and Name are required", "error");
            return;
        }

        try {
            if (editingItem) {
                await expenseAPI.expenseTypes.update(editingItem.id, payload);
                showNotification("Expense type updated successfully");
            } else {
                await expenseAPI.expenseTypes.create(payload);
                showNotification("Expense type created successfully");
            }
            fetchExpenseTypes();
            closeModal();
        } catch (error) {
            showNotification("Something went wrong! please try again later.", "error");
        }
    };

    const renderBooleanChip = (flag: boolean, trueLabel: string, falseLabel: string) => {
        const base =
            "px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1";
        if (flag) {
            return (
                <span className={`${base} bg-emerald-50 text-emerald-700`}>
                    <Check className="w-3 h-3" />
                    {trueLabel}
                </span>
            );
        }
        return (
            <span className={`${base} bg-slate-100 text-slate-700`}>
                {falseLabel}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
            {/* Notification */}
            {notification && (
                <div
                    className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white animate-fade-in ${notification.type === "success" ? "bg-green-500" : "bg-red-500"
                        }`}
                >
                    {notification.type === "success" ? (
                        <Check size={20} />
                    ) : (
                        <AlertCircle size={20} />
                    )}
                    {notification.message}
                </div>
            )}

            {/* Hard Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Confirm Delete
                            </h3>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-slate-600 mb-6">
                            Are you sure you want to permanently delete this expense type? This
                            action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleHardDelete}
                                className="px-4 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                        Expense Type Master
                    </h1>
                    <p className="text-slate-600">
                        Manage different expense types used in claim processing
                    </p>
                </div>

                {/* Controls */}
                <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex-1 w-full md:w-auto flex flex-col gap-3">
                            <div className="flex-1 relative">
                                <Search
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                                    size={20}
                                />
                                <input
                                    type="text"
                                    placeholder="Search by code or name"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setFilterActive("all")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterActive === "all"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setFilterActive("active")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterActive === "active"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        onClick={() => setFilterActive("inactive")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterActive === "inactive"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Inactive
                                    </button>
                                </div>

                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setFilterRequiresReceipt("all")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterRequiresReceipt === "all"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Receipt: All
                                    </button>
                                    <button
                                        onClick={() => setFilterRequiresReceipt("yes")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterRequiresReceipt === "yes"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Required
                                    </button>
                                    <button
                                        onClick={() => setFilterRequiresReceipt("no")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterRequiresReceipt === "no"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Not Required
                                    </button>
                                </div>

                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setFilterDistanceBased("all")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterDistanceBased === "all"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Distance: All
                                    </button>
                                    <button
                                        onClick={() => setFilterDistanceBased("yes")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterDistanceBased === "yes"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Distance-based
                                    </button>
                                    <button
                                        onClick={() => setFilterDistanceBased("no")}
                                        className={`px-3 py-1.5 rounded-md transition-all text-xs font-medium ${filterDistanceBased === "no"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-600"
                                            }`}
                                    >
                                        Flat
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-full md:w-auto flex p-0">
                            <div className="grid grid-rows-1 items-start">
                                <button
                                    onClick={openModalForCreate}
                                    className="flex items-start gap-2 px-4 py-2.5 bg-blue-600 text-medium text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                >
                                    <Plus size={20} />
                                    <span className="hidden sm:inline">Add Expense Type</span>
                                    <span className="sm:hidden">Add</span>
                                </button>
                                <span className="py-5"></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-slate-600">Loading...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-12 text-center">
                            <Search className="mx-auto text-slate-300 mb-4" size={48} />
                            <p className="text-slate-600">No expense types found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Code
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Receipt Required
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Distance Based
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-medium text-slate-900">
                                                    {item.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-slate-800 text-sm">
                                                    {item.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {renderBooleanChip(
                                                    item.requires_receipt,
                                                    "Yes",
                                                    "No"
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {renderBooleanChip(
                                                    item.is_distance_based,
                                                    "Distance-based",
                                                    "Flat"
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.is_active
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                        }`}
                                                >
                                                    {item.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => openModalForEdit(item)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View / Edit"
                                                    >
                                                        <Pen size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleSoftToggle(item)}
                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                        title={item.is_active ? "Deactivate" : "Activate"}
                                                    >
                                                        {item.is_active ? (
                                                            <ToggleRight size={18} />
                                                        ) : (
                                                            <ToggleLeft size={18} />
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => openDeleteConfirm(item)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Form Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
                        <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {editingItem ? "Edit Expense Type" : "Create Expense Type"}
                                </h2>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Code *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    code: e.target.value,
                                                }))
                                            }
                                            required
                                            placeholder="e.g. taxi, train, hotel"
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    name: e.target.value,
                                                }))
                                            }
                                            required
                                            placeholder="Display name"
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="md:col-span-2 grid gap-3">
                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.requires_receipt}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        requires_receipt: e.target.checked,
                                                    }))
                                                }
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700">
                                                Receipt / bill is required for this expense type
                                            </span>
                                        </label>

                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_distance_based}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        is_distance_based: e.target.checked,
                                                    }))
                                                }
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700">
                                                Distance-based (e.g. own car / per km reimbursement)
                                            </span>
                                        </label>

                                        <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        is_active: e.target.checked,
                                                    }))
                                                }
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700">
                                                Active (available in expense claim forms)
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                    >
                                        {editingItem ? "Update" : "Create"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpenseTypeMaster;

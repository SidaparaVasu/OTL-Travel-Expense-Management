import React, { useEffect, useState } from "react";
import { Plane, Train, Car, Hotel, ChevronDown, ChevronRight, Plus, Edit2, Trash2, X, Save, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { travelAPI } from "@/src/api/travel";
// import { Layout } from "@/components/Layout";
import { ConfirmDialog } from "@/pages/common/reusables/ConfirmDialog";

const ICON_MAP = {
    Flight: Plane,
    Train: Train,
    Car: Car,
    Accommodation: Hotel,
};

function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
                    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

function TravelModeCard({ mode, subOptions, expanded, onToggle, onEdit, onDelete, onToggleActive, onAddSubOption, onEditSubOption, onDeleteSubOption, onToggleSubOptionActive }) {
    const Icon = ICON_MAP[mode.name] || Plane;
    const modeSubOptions = subOptions.filter(s => s.mode === mode.id);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-slate-50 from-blue-50 via-purple-50 to-pink-50 p-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                        <button onClick={onToggle} className="text-slate-600 hover:text-slate-800 transition-colors">
                            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        {/* <div className="p-3 bg-white rounded-lg shadow-sm">
                            <Icon className="w-7 h-7 text-blue-600" />
                        </div> */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-semibold text-slate-800">{mode.name}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${mode.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {mode.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {mode.is_self_arranged && (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                        Self-Arranged
                                    </span>
                                )}
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {modeSubOptions.length} options
                                </span>
                            </div>
                            {mode.description && <p className="text-sm text-slate-600 mt-1">{mode.description}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onToggleActive(mode)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={mode.is_active ? 'Deactivate' : 'Activate'}>
                            {mode.is_active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button onClick={() => onAddSubOption(mode)} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors">
                            <Plus className="w-4 h-4" />Add Option
                        </button>
                        <button onClick={() => onEdit(mode)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(mode.id)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className="p-5">
                    {modeSubOptions.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 from-slate-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <Icon className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-slate-600 font-medium">No options found for {mode.name}</p>
                                <button onClick={() => onAddSubOption(mode)} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 transition-colors">
                                    <Plus className="w-4 h-4" />Add first option
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {modeSubOptions.map(subOption => (
                                <div key={subOption.id} className="group bg-slate-50 from-white to-slate-50 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-slate-800 truncate">{subOption.name}</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${subOption.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {subOption.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                {subOption.is_self_arranged && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-amber-100 text-amber-700">
                                                        Self-Arranged
                                                    </span>
                                                )}
                                            </div>
                                            {subOption.description && (
                                                <p className="text-xs text-slate-600 line-clamp-2">{subOption.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onToggleSubOptionActive(subOption)} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={subOption.is_active ? 'Deactivate' : 'Activate'}>
                                                {subOption.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                                            </button>
                                            <button onClick={() => onEditSubOption(subOption)} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => onDeleteSubOption(subOption.id)} className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function TravelModeMaster() {
    const [travelModes, setTravelModes] = useState([]);
    const [subOptions, setSubOptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [modeModal, setModeModal] = useState({ open: false, data: null });
    const [subOptionModal, setSubOptionModal] = useState({ open: false, data: null, modeId: null });
    const [expandedModeId, setExpandedModeId] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: "", description: "", onConfirm: null });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [modesData, subOptionsData] = await Promise.all([
                travelAPI.getTravelModes(),
                travelAPI.getTravelSubOptions(),
            ]);
            setTravelModes(modesData.results || modesData.data || modesData || []);
            setSubOptions(subOptionsData || subOptionsData.data || subOptionsData || []);
            if (modesData.length > 0 && !expandedModeId) {
                setExpandedModeId(modesData[0].id);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const filteredModes = searchTerm
        ? travelModes.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.description?.toLowerCase().includes(searchTerm.toLowerCase()))
        : travelModes;

    const handleSaveMode = async (formData) => {
        try {
            if (modeModal.data) {
                await travelAPI.updateTravelModes(modeModal.data.id, formData);
                toast.success("Travel mode updated successfully!");
            } else {
                await travelAPI.createTravelModes(formData);
                toast.success("Travel mode created successfully!");
            }
            await fetchAll();
            setModeModal({ open: false, data: null });
        } catch (error) {
            console.error("Error saving mode:", error);
            toast.error("Failed to save travel mode");
        }
    };

    const handleDeleteMode = (id) => {
        setConfirmDialog({
            open: true,
            title: "Delete Travel Mode",
            description: "Are you sure you want to delete this travel mode? All sub-options will also be deleted.",
            onConfirm: async () => {
                try {
                    await travelAPI.deleteTravelModes(id);
                    toast.success("Travel mode deleted successfully!");
                    await fetchAll();
                } catch (error) {
                    console.error("Error deleting mode:", error);
                    toast.error("Failed to delete travel mode");
                } finally {
                    setConfirmDialog({ ...confirmDialog, open: false });
                }
            },
        });
    };

    const handleToggleModeActive = async (mode) => {
        try {
            await travelAPI.toggleTravelModeActive(mode.id, !mode.is_active);
            toast.success(`Travel mode ${mode.is_active ? 'deactivated' : 'activated'} successfully!`);
            await fetchAll();
        } catch (error) {
            console.error("Error toggling mode:", error);
            toast.error("Failed to update travel mode");
        }
    };

    const handleSaveSubOption = async (formData) => {
        try {
            if (subOptionModal.data) {
                await travelAPI.updateTravelSubOption(subOptionModal.data.id, { ...formData, mode: subOptionModal.modeId });
                toast.success("Sub-option updated successfully!");
            } else {
                await travelAPI.createTravelSubOption({ ...formData, mode: subOptionModal.modeId });
                toast.success("Sub-option created successfully!");
            }
            await fetchAll();
            setSubOptionModal({ open: false, data: null, modeId: null });
        } catch (error) {
            console.error("Error saving sub-option:", error);
            toast.error("Failed to save sub-option");
        }
    };

    const handleDeleteSubOption = (id) => {
        setConfirmDialog({
            open: true,
            title: "Delete Sub-Option",
            description: "Are you sure you want to delete this sub-option?",
            onConfirm: async () => {
                try {
                    await travelAPI.deleteTravelSubOption(id);
                    toast.success("Sub-option deleted successfully!");
                    await fetchAll();
                } catch (error) {
                    console.error("Error deleting sub-option:", error);
                    toast.error("Failed to delete sub-option");
                } finally {
                    setConfirmDialog({ ...confirmDialog, open: false });
                }
            },
        });
    };

    const handleToggleSubOptionActive = async (subOption) => {
        try {
            await travelAPI.toggleSubOptionActive(subOption.id, !subOption.is_active);
            toast.success(`Sub-option ${subOption.is_active ? 'deactivated' : 'activated'} successfully!`);
            await fetchAll();
        } catch (error) {
            console.error("Error toggling sub-option:", error);
            toast.error("Failed to update sub-option");
        }
    };

    if (loading) {
        return (
            // <Layout>
                <div className="p-6 bg-slate-50 from-slate-50 to-gray-100 min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <div className="text-slate-600 font-medium">Loading...</div>
                    </div>
                </div>
            // </Layout>
        );
    }

    return (
        // <Layout>
        <div>
            <div className="p-6 bg-slate-50 from-slate-50 to-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-1">Travel Mode Master</h1>
                            <p className="text-sm text-slate-600">Manage travel modes and their sub-options</p>
                        </div>
                        <button onClick={() => setModeModal({ open: true, data: null })} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                            <Plus className="w-5 h-5" />Add Travel Mode
                        </button>
                    </div>

                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="search" placeholder="Search travel modes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredModes.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-6 bg-blue-400 rounded-full">
                                        <Plane className="w-16 h-16 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold text-slate-800 mb-2">No travel modes found</p>
                                        <p className="text-slate-500 mb-4">Get started by adding your first travel mode</p>
                                    </div>
                                    <button onClick={() => setModeModal({ open: true, data: null })} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all">
                                        <Plus className="w-4 h-4" />Add Travel Mode
                                    </button>
                                </div>
                            </div>
                        ) : (
                            filteredModes.map(mode => (
                                <TravelModeCard
                                    key={mode.id}
                                    mode={mode}
                                    subOptions={subOptions}
                                    expanded={expandedModeId === mode.id}
                                    onToggle={() => setExpandedModeId(prev => prev === mode.id ? null : mode.id)}
                                    onEdit={(m) => setModeModal({ open: true, data: m })}
                                    onDelete={handleDeleteMode}
                                    onToggleActive={handleToggleModeActive}
                                    onAddSubOption={(m) => setSubOptionModal({ open: true, data: null, modeId: m.id })}
                                    onEditSubOption={(s) => setSubOptionModal({ open: true, data: s, modeId: s.mode })}
                                    onDeleteSubOption={handleDeleteSubOption}
                                    onToggleSubOptionActive={handleToggleSubOptionActive}
                                />
                            ))
                        )}
                    </div>

                    <Modal isOpen={modeModal.open} onClose={() => setModeModal({ open: false, data: null })} title={modeModal.data ? "Edit Travel Mode" : "Add Travel Mode"}>
                        <TravelModeForm data={modeModal.data} onSubmit={handleSaveMode} onCancel={() => setModeModal({ open: false, data: null })} />
                    </Modal>

                    <Modal isOpen={subOptionModal.open} onClose={() => setSubOptionModal({ open: false, data: null, modeId: null })} title={subOptionModal.data ? "Edit Sub-Option" : "Add Sub-Option"}>
                        <SubOptionForm data={subOptionModal.data} onSubmit={handleSaveSubOption} onCancel={() => setSubOptionModal({ open: false, data: null, modeId: null })} />
                    </Modal>
                </div>
            </div>
            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                description={confirmDialog.description}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
            />
        </div>
        // </Layout>
    );
}

function TravelModeForm({ data, onSubmit, onCancel }) {
    const [formData, setFormData] = useState(data || { name: "", description: "", is_active: true });

    const handleSubmit = () => {
        if (!formData.name) {
            toast.error("Please enter travel mode name");
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Travel Mode Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g., Flight, Train, Car" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea placeholder="Enter description" value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_self_arranged" checked={formData.is_self_arranged || false} onChange={(e) => setFormData({ ...formData, is_self_arranged: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="is_self_arranged" className="text-sm font-medium text-slate-700">Self-Arranged Booking</label>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md">Cancel</button>
                <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" />Save</button>
            </div>
        </div>
    );
}

function SubOptionForm({ data, onSubmit, onCancel }) {
    const [formData, setFormData] = useState(data || { name: "", description: "", is_active: true });

    const handleSubmit = () => {
        if (!formData.name) {
            toast.error("Please enter sub-option name");
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Option Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g., Economy, Business Class" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea placeholder="Enter description" value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="sub_is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="sub_is_active" className="text-sm font-medium text-slate-700">Active</label>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="sub_is_self_arranged" checked={formData.is_self_arranged || false} onChange={(e) => setFormData({ ...formData, is_self_arranged: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="sub_is_self_arranged" className="text-sm font-medium text-slate-700">Self-Arranged Booking</label>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md">Cancel</button>
                <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" />Save</button>
            </div>
        </div>
    );
}
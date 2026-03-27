import React, { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  AlertCircle,
  ShieldAlert,
  History,
  XCircle,
  User as UserIcon,
  Loader2,
  CalendarDays,
  Clock,
  UserPlus
} from "lucide-react";
import { backdatedAllowanceApi, BackdatedAllowance } from "@/src/api/backdated-allowance";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from "@headlessui/react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// --- User Selector Component (Themed) ---
interface UserOption {
  id: number;
  employee_id: string;
  full_name: string;
  department: string | null;
  roles: string;
}

const UserCombobox: React.FC<{
  onSelect: (user: UserOption | null) => void;
  selectedUser: UserOption | null;
}> = ({ onSelect, selectedUser }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 3) {
        setLoading(true);
        try {
          const results = await backdatedAllowanceApi.searchUsers(query);
          setUsers(results);
        } catch (err) {
          console.error("User search failed", err);
        } finally {
          setLoading(false);
        }
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        Employee *
      </label>
      <Combobox value={selectedUser} onChange={onSelect}>
        <div className="relative">
          <div className="relative group">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <ComboboxInput
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              displayValue={(user: UserOption | null) => user ? `${user.full_name} (${user.employee_id})` : ""}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or Employee ID..."
            />
            {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-blue-600" />}
          </div>

          <ComboboxOptions className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
            {users.length === 0 && query.length >= 3 && !loading ? (
              <div className="px-4 py-6 text-center text-slate-400">
                <p className="text-sm">No employees found</p>
              </div>
            ) : (
              users.map((user) => (
                <ComboboxOption
                  key={user.id}
                  value={user}
                  className={({ active }) =>
                    cn(
                      "relative cursor-pointer select-none px-4 py-3 transition-colors",
                      active ? "bg-blue-50" : ""
                    )
                  }
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">{user.full_name}</span>
                    <span className="text-xs text-slate-400">{user.employee_id} | {user.department || "No Department"}</span>
                  </div>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>
  );
};

// --- Main Page Component ---
export default function BackdatedAllowanceManager() {
  const [allowances, setAllowances] = useState<BackdatedAllowance[]>([]);
  const [filteredAllowances, setFilteredAllowances] = useState<BackdatedAllowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  // Form State
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [allowedFrom, setAllowedFrom] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [allowedUntil, setAllowedUntil] = useState(format(new Date(Date.now() + 2 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllowances = async () => {
    setLoading(true);
    try {
      const data = await backdatedAllowanceApi.list();
      setAllowances(data);
      setFilteredAllowances(data);
    } catch (err) {
      showNotification("Failed to fetch allowances", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowances();
  }, []);

  useEffect(() => {
    const filtered = allowances.filter(a => 
      a.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAllowances(filtered);
  }, [searchTerm, allowances]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      showNotification("Please select an employee", "error");
      return;
    }
    if (!reason) {
      showNotification("Reason is required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await backdatedAllowanceApi.create({
        user: selectedUser.id,
        allowed_from: new Date(allowedFrom).toISOString(),
        allowed_until: new Date(allowedUntil).toISOString(),
        reason
      });
      showNotification("Permission granted successfully");
      closeModal();
      fetchAllowances();
    } catch (err: any) {
      showNotification(err.response?.data?.detail || "Authorization failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await backdatedAllowanceApi.update(revokeTarget.id, { is_active: false });
      showNotification("Retrospective permission revoked");
      fetchAllowances();
      setShowRevokeConfirm(false);
      setRevokeTarget(null);
    } catch (err) {
      showNotification("Revocation failed", "error");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setReason("");
    setAllowedFrom(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setAllowedUntil(format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === "success" ? "bg-green-500" : "bg-red-500"
        } text-white animate-fade-in`}>
          {notification.type === "success" ? <Check size={20} /> : <AlertCircle size={20} />}
          {notification.message}
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Confirm Revocation</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Are you sure you want to revoke this back-dated submission permission? This will block retrospective TRs for this user immediately.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRevokeConfirm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-md">
                Cancel
              </button>
              <button onClick={handleRevoke} className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-md flex items-center gap-2">
                <XCircle size={16} /> Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider mb-2">
             <ShieldAlert size={14} /> Administrative Master
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            Back-dated TR Allowance
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Manage exceptions for retrospective travel request submissions. Grant time-bound windows to specific users.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by employee name or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-semibold"
            >
              <Plus size={20} /> Grant Permission
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          {loading ? (
            <div className="p-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
              <p className="mt-4 text-slate-500 font-medium italic">Synchronizing permission log...</p>
            </div>
          ) : filteredAllowances.length === 0 ? (
            <div className="p-20 text-center">
              <History className="mx-auto text-slate-200 mb-4" size={64} />
              <p className="text-slate-500 text-lg font-medium">No history found</p>
              <p className="text-slate-400 text-sm">Audit logs are currently empty for this master</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Validity Period</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Reason</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Granted By</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllowances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <UserIcon size={16} />
                          </div>
                          <span className="font-semibold text-slate-700">{item.user_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs">
                             <span className="text-slate-300 font-bold w-10">FROM:</span>
                             {format(new Date(item.allowed_from), "MMM dd, HH:mm")}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                             <span className="text-slate-300 font-bold w-10">UNTIL:</span>
                             <span className={item.is_valid ? "text-slate-600" : "text-slate-400 line-through"}>
                               {format(new Date(item.allowed_until), "MMM dd, HH:mm")}
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         {!item.is_active ? (
                            <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Revoked</span>
                          ) : item.is_valid ? (
                            <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Active</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-tighter">Expired</span>
                          )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate italic">
                        "{item.reason}"
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-600">{item.granted_by_name}</span>
                          <span>{format(new Date(item.created_at), "MMM dd, yyyy")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {item.is_active && item.is_valid && (
                          <button 
                            onClick={() => { setRevokeTarget(item); setShowRevokeConfirm(true); }}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Revoke Permission"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Grant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all scale-100">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center z-10">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 leading-none mb-1">Grant Protocol Exception</h2>
                    <p className="text-xs text-slate-400">Policy override for retrospective submission</p>
                  </div>
               </div>
               <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                 <X size={20} />
               </button>
            </div>

            <form onSubmit={handleGrant} className="p-8 space-y-6">
              <UserCombobox selectedUser={selectedUser} onSelect={setSelectedUser} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase">
                       <CalendarDays size={12} /> Validity Start
                    </div>
                    <input 
                      type="datetime-local" 
                      value={allowedFrom} 
                      onChange={(e) => setAllowedFrom(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
                    />
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase">
                       <Clock size={12} /> Validity End
                    </div>
                    <input 
                      type="datetime-local" 
                      value={allowedUntil} 
                      onChange={(e) => setAllowedUntil(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Administrative Justification *</label>
                <textarea 
                  placeholder="Detail the reason for granting this exception for audit compliance..." 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full min-h-[120px] px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none transition-all placeholder:text-slate-300"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-slate-200 shadow-offset-y-2 disabled:bg-slate-300"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>Authorize User <Plus size={18} /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { X, Search, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { spocAssignmentAPI } from "@/src/api/spoc_assignment";
import { userAPI } from "@/src/api/users";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";

const SPOCAssignmentModal = ({
  isOpen,
  onClose,
  onSuccess,
  editingItem,
  roles,
  locations,
}) => {
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    user: null, // Full user object {id, full_name, username}
    role_id: "",
    is_global: false,
    location_ids: [],
    is_active: true,
  });

  // Validations
  const [errors, setErrors] = useState({});
  const [roleValidationLoading, setRoleValidationLoading] = useState(false);

  // User Search State
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (editingItem) {
      // Populate form
      setFormData({
        user: editingItem.user,
        role_id: editingItem.role?.id?.toString() || "",
        is_global: editingItem.is_global,
        location_ids: editingItem.locations?.map((l) => l.location_id) || [],
        is_active: editingItem.is_active,
      });
      // Initial user search population if needed or just use passed user object
    } else {
      // Reset form
      setFormData({
        user: null,
        role_id: "",
        is_global: false,
        location_ids: [],
        is_active: true,
      });
    }
  }, [editingItem, isOpen]);

  // Handle User Search
  useEffect(() => {
    if (userSearchQuery.length < 2) {
      setUsersList([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const response = await userAPI.searchColleagues(
          userSearchQuery,
          true,
          true,
        ); // Include self, Ignore branch
        setUsersList(response || []);
      } catch (error) {
        console.error("User search failed", error);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounceRef.current);
  }, [userSearchQuery]);

  const handleUserSelect = (user) => {
    setFormData((prev) => ({ ...prev, user }));
    setUserSearchOpen(false);
    setUserSearchQuery("");
    // Validate role if role already selected
    if (formData.role_id) {
      validateUserRole(user.id, formData.role_id);
    }
  };

  const validateUserRole = async (userId, roleId) => {
    // Optional: Check if user has this role in UserRole table?
    // Backend serializer validates this ("User does not have the role assigned").
    // Frontend can try to pre-validate via User Details API if needed,
    // but let's rely on Backend validation on Submit for simplicity unless UX demands immediate feedback.
  };

  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setFormData((prev) => ({ ...prev, role_id: roleId }));
    // Could trigger immediate conflict check here
  };

  const handleScopeChange = (isGlobal) => {
    if (isGlobal && formData.location_ids.length > 0) {
      if (
        !confirm("Switching to Global will clear selected locations. Continue?")
      ) {
        return;
      }
      setFormData((prev) => ({ ...prev, is_global: true, location_ids: [] }));
    } else {
      setFormData((prev) => ({ ...prev, is_global: isGlobal }));
    }
  };

  const handleLocationToggle = (locationId) => {
    setFormData((prev) => {
      const current = prev.location_ids;
      if (current.includes(locationId)) {
        return {
          ...prev,
          location_ids: current.filter((id) => id !== locationId),
        };
      } else {
        return { ...prev, location_ids: [...current, locationId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Frontend Verification
    if (!formData.user) {
      setErrors((prev) => ({ ...prev, user: "User is required" }));
      setLoading(false);
      return;
    }
    if (!formData.role_id) {
      setErrors((prev) => ({ ...prev, role: "Role is required" }));
      setLoading(false);
      return;
    }
    if (!formData.is_global && formData.location_ids.length === 0) {
      setErrors((prev) => ({
        ...prev,
        locations:
          "At least one location is required for non-global assignment",
      }));
      setLoading(false);
      return;
    }

    const payload = {
      user_id: formData.user.id,
      role_id: parseInt(formData.role_id),
      is_global: formData.is_global,
      location_ids: formData.is_global ? [] : formData.location_ids,
      is_active: formData.is_active,
    };

    try {
      if (editingItem) {
        await spocAssignmentAPI.update(editingItem.id, payload);
        toast.success("Assignment updated successfully.");
      } else {
        await spocAssignmentAPI.create(payload);
        toast.success("Assignment created successfully.");
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      const response = error.response?.data;

      // Parse errors for toast
      let errorMsg = "Something went wrong.";
      const fieldErrors = {};

      if (response) {
        // Handle custom wrapper (success/message/errors)
        if (response.message) {
          errorMsg = response.message;
        }
        // Handle DRF standard "detail"
        if (response.detail) {
          errorMsg = response.detail;
        } else if (response.non_field_errors) {
          errorMsg = response.non_field_errors.join(", ");
        }

        // Determine where field errors are located
        const targetErrors = response.errors || response;

        let hasFieldErrors = false;
        Object.keys(targetErrors).forEach((key) => {
          // Skip non-error keys
          if (
            [
              "success",
              "message",
              "data",
              "detail",
              "non_field_errors",
            ].includes(key)
          )
            return;

          const val = targetErrors[key];
          if (Array.isArray(val)) {
            fieldErrors[key] = val[0]; // Take first error
            hasFieldErrors = true;
          } else if (typeof val === "string") {
            fieldErrors[key] = val;
            hasFieldErrors = true;
          }
        });

        if (hasFieldErrors) {
          setErrors(fieldErrors);
          // Promote first field error to toast if message is generic
          if (
            !errorMsg ||
            errorMsg === "Something went wrong." ||
            errorMsg === "Validation failed"
          ) {
            const firstKey = Object.keys(fieldErrors)[0];
            errorMsg = fieldErrors[firstKey];
          }
        }
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-800">
            {editingItem ? "Edit Assignment" : "New SPOC Assignment"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                User *
              </label>

              {formData.user ? (
                <div className="flex items-center justify-between p-3 border border-slate-300 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-medium text-slate-900">
                      {formData.user.full_name || formData.user.username}
                    </div>
                  </div>
                  {!editingItem && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, user: null }))
                      }
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Search employee by name..."
                      value={userSearchQuery}
                      onChange={(e) => {
                        setUserSearchQuery(e.target.value);
                        setUserSearchOpen(true);
                      }}
                      onFocus={() => setUserSearchOpen(true)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchingUsers && (
                      <Loader2
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-blue-500"
                        size={18}
                      />
                    )}
                  </div>

                  {/* Dropdown Results */}
                  {userSearchOpen && userSearchQuery.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {usersList.length === 0 && !searchingUsers ? (
                        <div className="p-3 text-sm text-slate-500 text-center">
                          No users found
                        </div>
                      ) : (
                        usersList.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleUserSelect(user)}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <div className="font-medium text-slate-800">
                              {user.full_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              Department: {user.department}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.user && (
                <p className="text-red-500 text-sm mt-1">{errors.user}</p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Role *
              </label>
              <select
                value={formData.role_id}
                onChange={handleRoleChange}
                disabled={!!editingItem} // Often roles are immutable on edit, or maybe allowed
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.role && (
                <p className="text-red-500 text-sm mt-1">{errors.role}</p>
              )}
            </div>

            {/* Scope Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Scope
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.is_global}
                    onChange={() => handleScopeChange(false)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Location Based</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.is_global}
                    onChange={() => handleScopeChange(true)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Global (All Locations)</span>
                </label>
              </div>
            </div>

            {/* Location Selection (Only if NOT Global) */}
            {!formData.is_global && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Locations *{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({formData.location_ids.length} selected)
                  </span>
                </label>
                <MultiSelectDropdown
                  options={locations.map((l) => ({
                    id: l.location_id,
                    name: l.location_name,
                  }))}
                  selected={formData.location_ids}
                  onChange={(selected) =>
                    setFormData((prev) => ({ ...prev, location_ids: selected }))
                  }
                  placeholder="Select locations..."
                  error={errors.locations}
                />
              </div>
            )}

            {/* Status */}
            <div>
              <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-700 font-medium">Active</span>
              </label>
            </div>

            {errors.detail && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex gap-2 text-sm">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {errors.detail}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {editingItem ? "Update Assignment" : "Create Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SPOCAssignmentModal;

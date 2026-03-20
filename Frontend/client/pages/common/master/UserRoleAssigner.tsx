import React, { useState, useEffect } from "react";
import { 
  UserCog, 
  Search, 
  Plus, 
  Trash2, 
  ShieldCheck,
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { roleManagementAPI } from "@/src/api/master_role_management";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string | null;
  roles: string;
}

interface Role {
  id: number;
  name: string;
  role_type: string;
  description: string;
}

interface UserRole {
  id: number;
  name: string;
  role_type: string;
  is_primary: boolean;
  description: string;
}

export default function UserRoleAssignerPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<string | null>(null);
  
  // Modal states
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [allAvailableRoles, setAllAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [isPrimaryForNew, setIsPrimaryForNew] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Search employees
  const fetchEmployees = async (query: string) => {
    if (query.length < 3) return;
    setLoading(true);
    try {
      const response = await roleManagementAPI.userRole.searchEmployees(query);
      if (response.success) {
        setEmployees(response.data);
      }
    } catch (error) {
      toast.error("Failed to search employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        fetchEmployees(searchTerm);
      } else {
        setEmployees([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchAvailableRoles = async () => {
    try {
      const response = await roleManagementAPI.role.getAll();
      if (response.success) {
        // Handle paginated responses where data contains a 'results' array
        const rolesArray = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.results || []);
        setAllAvailableRoles(rolesArray);
      }
    } catch (error) {
      console.error("Failed to fetch roles", error);
    }
  };

  const fetchUserRoles = async (userId: number) => {
    setIsModalLoading(true);
    try {
      const response = await roleManagementAPI.userRole.getUserRoles(userId);
      if (response.success && response.data) {
        setUserRoles(response.data.roles || []);
      }
    } catch (error) {
      toast.error("Failed to fetch user roles");
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleManageRoles = (employee: Employee) => {
    setSelectedEmployee(employee);
    fetchUserRoles(employee.id);
    fetchAvailableRoles();
    setIsModalOpen(true);
    // Reset new role form
    setSelectedRoleId("");
  };

  // Auto-primary logic: if no roles, first one is primary
  useEffect(() => {
    if (isModalOpen && userRoles.length === 0) {
      setIsPrimaryForNew(true);
    } else {
      setIsPrimaryForNew(false);
    }
  }, [userRoles, isModalOpen]);

  const handleAssignRole = async () => {
    if (!selectedEmployee || !selectedRoleId) return;

    const roleToAssign = allAvailableRoles.find(r => r.id.toString() === selectedRoleId);
    if (!roleToAssign) return;

    // Check for duplicate role (Role Conflict Warning)
    const exists = userRoles.find(ur => ur.name === roleToAssign.name);
    if (exists) {
      toast.warning(`User already has the '${roleToAssign.name}' role assigned.`);
      return;
    }

    try {
      const payload = {
        user_id: selectedEmployee.id,
        role_name: roleToAssign.name,
        is_primary: isPrimaryForNew,
        action: "assign"
      };

      await roleManagementAPI.userRole.assign(payload);
      toast.success(`Role '${roleToAssign.name}' assigned successfully`);
      
      // Refresh user roles
      fetchUserRoles(selectedEmployee.id);
      setSelectedRoleId("");
      // Update the main table list locally if needed, or re-search
      fetchEmployees(searchTerm); 
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to assign role");
    }
  };

  const handleRemoveRole = async (roleName: string) => {
    if (!selectedEmployee) return;

    try {
      const payload = {
        user_id: selectedEmployee.id,
        role_name: roleName,
        action: "remove"
      };

      await roleManagementAPI.userRole.assign(payload);
      toast.success(`Role '${roleName}' removed successfully`);
      fetchUserRoles(selectedEmployee.id);
      fetchEmployees(searchTerm);
      setRoleToRemove(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to remove role");
    }
  };

  const confirmRemoveRole = (roleName: string) => {
    setRoleToRemove(roleName);
    setIsConfirmOpen(true);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">User Role Assigner</h1>
          <p className="text-sm text-slate-500">Manage system roles and permissions for organizational employees.</p>
        </header>

        {/* Search Bar */}
        <div className="relative group max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input 
            placeholder="Search employee by name or ID (min 3 chars)..." 
            className="pl-10 bg-white border-slate-200 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[80px]">Sr No.</TableHead>
                <TableHead>Username (ID)</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role(s)</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Searching employees...
                  </TableCell>
                </TableRow>
              ) : employees.length > 0 ? (
                employees.map((emp, index) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-700">{emp.employee_id}</TableCell>
                    <TableCell>{emp.full_name}</TableCell>
                    <TableCell className="text-slate-500">{emp.email}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={emp.roles}>
                      {emp.roles || <span className="text-slate-300 italic">No roles</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-2"
                        onClick={() => handleManageRoles(emp)}
                      >
                        <UserCog className="w-4 h-4" />
                        Manage Roles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                    {searchTerm.length >= 3 ? "No employees found" : "Type at least 3 characters to search"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Role Management Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 bg-slate-50 text-black border-b border-slate-200">
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              Manage Roles: {selectedEmployee?.full_name}
            </DialogTitle>
            <DialogDescription className="text-black">
              Employee: {selectedEmployee?.employee_id}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Quick Add Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Assign New Role
              </h4>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allAvailableRoles.map(role => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Checkbox 
                    id="primary" 
                    checked={isPrimaryForNew} 
                    onCheckedChange={(checked) => setIsPrimaryForNew(!!checked)}
                    disabled={userRoles.length === 0} // Enabled only if there are existing roles (auto-primary takes over otherwise)
                  />
                  <label htmlFor="primary" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Primary?
                  </label>
                </div>

                <Button 
                  onClick={handleAssignRole} 
                  disabled={!selectedRoleId}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Assign
                </Button>
              </div>
              {userRoles.length === 0 && (
                <p className="text-[10px] text-blue-600 mt-2 flex items-center gap-1.5">
                   Auto-primary logic enabled for first role assignment.
                </p>
              )}
            </div>

            {/* Current Roles Table */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Current Assigned Roles</h4>
              <div className="rounded-md border border-slate-200 max-h-[250px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[60px]">Sr No.</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Primary?</TableHead>
                      <TableHead className="text-center">Active?</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isModalLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mr-2" />
                        </TableCell>
                      </TableRow>
                    ) : userRoles.length > 0 ? (
                      userRoles.map((role, idx) => (
                        <TableRow key={role.id}>
                          <TableCell className="text-slate-500">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-slate-700">{role.name}</TableCell>
                          <TableCell className="text-center">
                            {role.is_primary ? (
                              "Yes"
                            ) : "No"}
                          </TableCell>
                          <TableCell className="text-center">
                            {role.is_active ? (
                              "Yes"
                            ) : "No"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => confirmRemoveRole(role.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center py-4 bg-slate-50">
                          <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">No roles assigned yet.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <b className="text-black">{roleToRemove}</b> role from <b className="text-black">{selectedEmployee?.full_name}</b>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => roleToRemove && handleRemoveRole(roleToRemove)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
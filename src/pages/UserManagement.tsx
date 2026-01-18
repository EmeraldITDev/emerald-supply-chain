import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { userApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "employee",
    department: "",
    password: "",
    is_admin: false,
    can_manage_users: false,
  });

  // Check if user can manage users
  const canManageUsers = ['procurement', 'procurement_manager', 'executive', 'supply_chain_director', 'supply_chain'].includes(user?.role || '');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { role?: string; search?: string } = {};
      if (roleFilter !== "all") filters.role = roleFilter;
      if (searchQuery) filters.search = searchQuery;

      const response = await userApi.getAll(filters);
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load users",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, toast]);

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [canManageUsers, fetchUsers]);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "",
        password: "",
        is_admin: user.is_admin || false,
        can_manage_users: user.can_manage_users || false,
      });
    } else {
      setSelectedUser(null);
      setFormData({
        name: "",
        email: "",
        role: "employee",
        department: "",
        password: "",
        is_admin: false,
        can_manage_users: false,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || (!selectedUser && !formData.password)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedUser) {
        // Update existing user
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        if (['procurement', 'procurement_manager', 'executive', 'supply_chain_director', 'supply_chain', 'admin'].includes(formData.role)) {
          updateData.is_admin = true;
          updateData.can_manage_users = true;
        } else {
          updateData.is_admin = formData.is_admin;
          updateData.can_manage_users = formData.can_manage_users;
        }

        const response = await userApi.update(selectedUser.id, updateData);
        if (response.success) {
          toast({
            title: "Success",
            description: "User updated successfully",
          });
          setDialogOpen(false);
          fetchUsers();
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to update user",
            variant: "destructive",
          });
        }
      } else {
        // Create new user
        const createData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
          password: formData.password,
        };
        if (['procurement', 'procurement_manager', 'executive', 'supply_chain_director', 'supply_chain', 'admin'].includes(formData.role)) {
          createData.is_admin = true;
          createData.can_manage_users = true;
        } else {
          createData.is_admin = formData.is_admin;
          createData.can_manage_users = formData.can_manage_users;
        }

        const response = await userApi.create(createData);
        if (response.success) {
          toast({
            title: "Success",
            description: "User created successfully",
          });
          setDialogOpen(false);
          fetchUsers();
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create user",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const response = await userApi.delete(selectedUser.id);
      if (response.success) {
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
        setDeleteDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You do not have permission to manage users.
          </p>
        </CardContent>
      </Card>
    );
  }

  const roleOptions = [
    { value: "employee", label: "Regular Staff" },
    { value: "executive", label: "Executive" },
    { value: "procurement", label: "Procurement Manager" },
    { value: "supply_chain_director", label: "Supply Chain Director" },
    { value: "finance", label: "Finance Officer" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage system users and permissions</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Users List */}
          <div>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 border rounded-lg bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{u.name}</h3>
                        <Badge variant="outline" className="text-xs">{u.role.replace('_', ' ')}</Badge>
                        {u.is_admin && <Badge variant="default" className="text-xs">Admin</Badge>}
                        {u.can_manage_users && <Badge variant="secondary" className="text-xs">Can Manage Users</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Email</p>
                          <p className="font-medium">{u.email}</p>
                        </div>
                        {u.department && (
                          <div>
                            <p className="text-muted-foreground text-xs">Department</p>
                            <p className="font-medium">{u.department}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 self-start lg:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(u)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedUser(u);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedUser ? "Edit User" : "Create User"}</DialogTitle>
              <DialogDescription>
                {selectedUser ? "Update user information" : "Add a new user to the system"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Enter department"
                />
              </div>
              {!selectedUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
              )}
              {selectedUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>
              )}
              {!['procurement', 'procurement_manager', 'executive', 'supply_chain_director', 'supply_chain', 'admin'].includes(formData.role) && (
                <>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_admin"
                      checked={formData.is_admin}
                      onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_admin" className="cursor-pointer">
                      Admin Access
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="can_manage_users"
                      checked={formData.can_manage_users}
                      onChange={(e) => setFormData({ ...formData, can_manage_users: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="can_manage_users" className="cursor-pointer">
                      Can Manage Users
                    </Label>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {selectedUser ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  selectedUser ? "Update User" : "Create User"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete user {selectedUser?.name} ({selectedUser?.email}).
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
};

export default UserManagement;

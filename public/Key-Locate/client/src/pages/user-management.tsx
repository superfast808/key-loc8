import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { ROLES, PERMISSIONS, getRoleDisplayName, getPermissionDisplayName } from "@shared/permissions";
import type { Role, Permission } from "@shared/permissions";
import { Users, Plus, Edit, Shield, MapPin, Trash2, Key, History, ClipboardCheck, ShieldCheck, FileText, Shirt, BookOpen, Smartphone, ClipboardList } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Section definitions — must match header nav sectionId values
const NAV_SECTIONS = [
  { id: "keys",         label: "Keys",                icon: Key },
  { id: "locations",    label: "Locations",           icon: MapPin },
  { id: "history",      label: "History",             icon: History },
  { id: "audit",        label: "Audit",               icon: ClipboardCheck },
  { id: "lone_working", label: "Lone Working",        icon: ShieldCheck },
  { id: "assignments",  label: "Assignments",         icon: FileText },
  { id: "uniform",      label: "Uniform & Equipment", icon: Shirt },
  { id: "policies",     label: "Policies",            icon: BookOpen },
  { id: "reports",      label: "Reports",             icon: ClipboardList },
];

export default function UserManagement() {
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const { toast } = useToast();
  const { can, user: currentUser } = usePermissions();
  const queryClient = useQueryClient();

  // Redirect if user doesn't have permission
  if (!can(PERMISSIONS.USER_VIEW)) {
    return (
      <div className="p-6 text-center">
        <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to access user management.</p>
      </div>
    );
  }

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  }) as { data: any[] };

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  }) as { data: any[] };

  const updateUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const userResult = await apiRequest("PATCH", `/api/users/${userData.id}`, userData);
      // Also save policy access if it was included in the form data
      if (Array.isArray(userData.policyIds) && userData.id) {
        await apiRequest("PUT", `/api/users/${userData.id}/policies`, { policyIds: userData.policyIds });
        queryClient.invalidateQueries({ queryKey: ["/api/users", userData.id, "policy-ids"] });
      }
      return userResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setEditingUser(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const result = await apiRequest("POST", "/api/users", userData);
      // Save policy access if any were selected
      if (Array.isArray(userData.policyIds) && userData.policyIds.length > 0 && result?.id) {
        await apiRequest("PUT", `/api/users/${result.id}/policies`, { policyIds: userData.policyIds });
      }
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Show the temporary password if one was generated
      if (data.temporaryPassword) {
        toast({
          title: "User Created Successfully",
          description: (
            <div className="space-y-2">
              <p>Temporary password: <strong className="font-mono">{data.temporaryPassword}</strong></p>
              <p className="text-sm text-gray-600">Please share this password with the user securely.</p>
            </div>
          ),
          duration: 10000, // Show for 10 seconds
        });
      } else {
        toast({
          title: "Success",
          description: "User created successfully",
        });
      }
      
      setShowCreateUser(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/users/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleUpdateUser = (userData: any) => {
    updateUserMutation.mutate(userData);
  };

  const handleCreateUser = (userData: any) => {
    createUserMutation.mutate(userData);
  };

  const handleDeleteUser = (userId: number) => {
    deleteUserMutation.mutate(userId);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
        </div>
        {can(PERMISSIONS.USER_CREATE) && (
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with specific roles and permissions
                </DialogDescription>
              </DialogHeader>
              <UserForm
                user={null}
                locations={locations}
                onSubmit={handleCreateUser}
                onCancel={() => setShowCreateUser(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {users.map((user: any) => (
          <Card key={user.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {user.firstName} {user.lastName}
                    </h3>
                    <p className="text-gray-600">{user.email}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={user.role === 'super_admin' ? 'default' : user.role === 'admin' ? 'secondary' : 'outline'}>
                        {getRoleDisplayName(user.role)}
                      </Badge>
                      <Badge variant={user.isActive ? 'default' : 'destructive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-right text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="mr-1 h-3 w-3" />
                      {user.role === 'super_admin'
                        ? 'All Locations'
                        : !user.allowedLocationIds || user.allowedLocationIds.length === 0
                          ? 'No Locations'
                          : `${user.allowedLocationIds.length} Location${user.allowedLocationIds.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  
                  {can(PERMISSIONS.USER_EDIT) && (
                    <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => setEditingUser(open ? user : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid={`button-edit-user-${user.id}`}>
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit User</DialogTitle>
                          <DialogDescription>
                            Update user information, role, and permissions
                          </DialogDescription>
                        </DialogHeader>
                        <UserForm
                          user={user}
                          locations={locations}
                          onSubmit={handleUpdateUser}
                          onCancel={() => setEditingUser(null)}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  {can(PERMISSIONS.USER_DELETE) && currentUser?.id !== user.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {user.firstName} {user.lastName}'s account. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
                            className="bg-red-600 hover:bg-red-700"
                            data-testid="button-confirm-delete"
                          >
                            Delete User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface UserFormProps {
  user: any;
  locations: any[];
  onSubmit: (userData: any) => void;
  onCancel: () => void;
}

function UserForm({ user, locations, onSubmit, onCancel }: UserFormProps) {
  const { can } = usePermissions();
  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    password: '',
    role: user?.role || 'officer',
    allowedLocationIds: user?.allowedLocationIds || [],
    allowedSections: user?.allowedSections || [],
    customPermissions: user?.customPermissions || [],
    isActive: user?.isActive ?? true,
    mobilePhone: user?.mobilePhone || '',
    twoFactorEnabled: user?.twoFactorEnabled ?? false,
  });

  // Policy access state (only for existing users)
  const { data: fetchedPolicyIds = [], isLoading: policyIdsLoading } = useQuery<number[]>({
    queryKey: ["/api/users", user?.id, "policy-ids"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/policy-ids`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [policyIds, setPolicyIds] = useState<number[]>([]);
  const [policyIdsReady, setPolicyIdsReady] = useState(false);

  useEffect(() => {
    if (!policyIdsLoading && !policyIdsReady) {
      setPolicyIds(fetchedPolicyIds);
      setPolicyIdsReady(true);
    }
  }, [fetchedPolicyIds, policyIdsLoading, policyIdsReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: any = {
      ...formData,
      id: user?.id,
    };
    if (!submitData.password || submitData.password.trim() === '') {
      delete submitData.password;
    }
    // Always include policy IDs so they can be saved on both create and update
    submitData.policyIds = policyIds;
    onSubmit(submitData);
  };

  const handleLocationToggle = (locationId: number) => {
    setFormData(prev => ({
      ...prev,
      allowedLocationIds: prev.allowedLocationIds.includes(locationId)
        ? prev.allowedLocationIds.filter(id => id !== locationId)
        : [...prev.allowedLocationIds, locationId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          data-testid="input-email"
        />
      </div>

      <div>
        <Label htmlFor="mobilePhone" className="flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          Mobile Phone
        </Label>
        <Input
          id="mobilePhone"
          type="tel"
          value={formData.mobilePhone}
          onChange={(e) => setFormData(prev => ({ ...prev, mobilePhone: e.target.value }))}
          placeholder="+44 7700 000000"
        />
        <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +44). Required to enable two-factor authentication.</p>
      </div>

      {formData.mobilePhone && (
        <div className="flex items-start gap-3 p-3 border rounded-lg bg-blue-50">
          <Checkbox
            id="twoFactorEnabled"
            checked={formData.twoFactorEnabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, twoFactorEnabled: !!checked }))}
          />
          <div>
            <Label htmlFor="twoFactorEnabled" className="cursor-pointer font-medium">Enable Two-Factor Authentication</Label>
            <p className="text-xs text-gray-500 mt-0.5">User will receive an SMS code on every login.</p>
          </div>
        </div>
      )}

      {!user && (
        <div>
          <Label htmlFor="password">Password (Optional)</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Leave blank to auto-generate"
            data-testid="input-password"
          />
          <p className="text-sm text-gray-600 mt-1">
            If left blank, a secure random password will be generated
          </p>
        </div>
      )}

      {user && can(PERMISSIONS.USER_EDIT) && (
        <div>
          <Label htmlFor="password">Reset Password (Optional)</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Leave blank to keep current password"
            data-testid="input-reset-password"
          />
          <p className="text-sm text-gray-600 mt-1">
            Enter a new password to reset this user's password, or leave blank to keep their current password
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="role">Role</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ROLES).map((role) => (
                <SelectItem key={role} value={role}>
                  {getRoleDisplayName(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2 sm:pt-7">
          <Checkbox
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>

      <div>
        <Label>Allowed Locations</Label>
        <p className="text-sm text-gray-600 mb-2">
          Select every location this user should be able to access. Leaving all unchecked means they have no location access (super admins always have access to every location).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
          {locations.map((location: any) => (
            <div key={location.id} className="flex items-center space-x-2">
              <Checkbox
                id={`location-${location.id}`}
                checked={formData.allowedLocationIds.includes(location.id)}
                onCheckedChange={() => handleLocationToggle(location.id)}
              />
              <Label htmlFor={`location-${location.id}`} className="text-sm">
                {location.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {formData.role === 'officer' && (
        <div>
          <Label>Section Permissions</Label>
          <p className="text-sm text-gray-600 mb-3">
            Select every section this employee should be able to see. Leaving all unchecked means they have no section access.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 border rounded-lg p-3">
            {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={`section-${id}`}
                  checked={formData.allowedSections.includes(id)}
                  onCheckedChange={(checked) => {
                    setFormData(prev => ({
                      ...prev,
                      allowedSections: checked
                        ? [...prev.allowedSections, id]
                        : prev.allowedSections.filter(s => s !== id),
                    }));
                  }}
                />
                <Label htmlFor={`section-${id}`} className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {formData.role !== 'super_admin' && (
        <div>
          <Label>Custom Permissions</Label>
          <p className="text-sm text-gray-600 mb-3">
            Override default role permissions. Check specific permissions to grant additional access.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {Object.values(PERMISSIONS).map((permission) => (
              <div key={permission} className="flex items-center space-x-2">
                <Checkbox
                  id={`permission-${permission}`}
                  checked={formData.customPermissions?.includes(permission) || false}
                  onCheckedChange={(checked) => {
                    const currentPermissions = formData.customPermissions || [];
                    setFormData(prev => ({
                      ...prev,
                      customPermissions: checked
                        ? [...currentPermissions, permission]
                        : currentPermissions.filter(p => p !== permission)
                    }));
                  }}
                />
                <Label htmlFor={`permission-${permission}`} className="text-xs">
                  {getPermissionDisplayName(permission)}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <PolicyAccessSection
        policyIds={policyIds}
        onPolicyIdsChange={setPolicyIds}
      />

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {user ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}

function PolicyAccessSection({
  policyIds,
  onPolicyIdsChange,
}: {
  policyIds: number[];
  onPolicyIdsChange: (ids: number[]) => void;
}) {
  const { data: policies = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/policies"],
  });

  if (isLoading || policies.length === 0) return null;

  function toggle(id: number) {
    onPolicyIdsChange(
      policyIds.includes(id) ? policyIds.filter(x => x !== id) : [...policyIds, id]
    );
  }

  return (
    <div className="border-t pt-4 mt-2">
      <Label className="flex items-center gap-1.5 mb-1">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        Policy Access
      </Label>
      <p className="text-sm text-gray-600 mb-2">Select which policies this user can view.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
        {policies.map((p: any) => (
          <div key={p.id} className="flex items-center space-x-2">
            <Checkbox
              id={`policy-access-${p.id}`}
              checked={policyIds.includes(p.id)}
              onCheckedChange={() => toggle(p.id)}
            />
            <Label htmlFor={`policy-access-${p.id}`} className="text-sm cursor-pointer truncate">
              {p.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
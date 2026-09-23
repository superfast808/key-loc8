import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { User, Save, Mail, Building, Lock, Smartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { getRoleDisplayName } from "@shared/permissions";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  mobilePhone: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getLocationTypeDisplayName } = useSettingsHelpers();

  const [twoFactorPending, setTwoFactorPending] = useState(false);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      mobilePhone: (user as any)?.mobilePhone || "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      return apiRequest("PATCH", `/api/users/${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordForm) => {
      return apiRequest("POST", `/api/users/${user?.id}/change-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get user's allowed locations. Super admin sees every location; everyone else
  // only sees the ones they've been explicitly granted.
  const userLocations = user.role === 'super_admin'
    ? locations
    : locations.filter((location: any) => user.allowedLocationIds?.includes(location.id));

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="h-6 w-6" />
            My Profile
          </h1>
          <p className="text-gray-600">Manage your account information and settings</p>
        </div>

        {/* Profile Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your first name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your last name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input {...field} type="email" placeholder="Enter your email" className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobilePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                        Mobile Phone
                      </FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" placeholder="+44 7700 000000" />
                      </FormControl>
                      <p className="text-xs text-gray-500">Include country code. Used for two-factor authentication.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter your current password" data-testid="input-current-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter your new password" data-testid="input-new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Confirm your new password" data-testid="input-confirm-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!(user as any)?.mobilePhone ? (
              <p className="text-sm text-gray-500">
                Add a mobile phone number above and save your profile to enable two-factor authentication.
              </p>
            ) : (user as any)?.twoFactorEnabled ? (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">2FA is enabled</p>
                  <p className="text-sm text-gray-500 mb-3">
                    A verification code will be sent to <strong>{(user as any).mobilePhone}</strong> each time you log in.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={twoFactorPending}
                    onClick={async () => {
                      setTwoFactorPending(true);
                      try {
                        await apiRequest("PATCH", `/api/users/${user?.id}`, { twoFactorEnabled: false });
                        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                        toast({ title: "2FA disabled", description: "Two-factor authentication has been turned off." });
                      } catch {
                        toast({ title: "Error", description: "Failed to update 2FA settings.", variant: "destructive" });
                      } finally {
                        setTwoFactorPending(false);
                      }
                    }}
                  >
                    <ShieldOff className="h-4 w-4 mr-2" />
                    {twoFactorPending ? "Updating..." : "Disable 2FA"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <ShieldOff className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">2FA is disabled</p>
                  <p className="text-sm text-gray-500 mb-3">
                    Enable two-factor authentication to add an extra layer of security to your account.
                  </p>
                  <Button
                    size="sm"
                    disabled={twoFactorPending}
                    onClick={async () => {
                      setTwoFactorPending(true);
                      try {
                        await apiRequest("PATCH", `/api/users/${user?.id}`, { twoFactorEnabled: true });
                        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                        toast({ title: "2FA enabled", description: "A verification code will be sent to your mobile on every login." });
                      } catch {
                        toast({ title: "Error", description: "Failed to update 2FA settings.", variant: "destructive" });
                      } finally {
                        setTwoFactorPending(false);
                      }
                    }}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {twoFactorPending ? "Updating..." : "Enable 2FA"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <div className="mt-1">
                  <Badge variant="outline" className="text-sm">
                    {getRoleDisplayName(user.role)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">User ID</label>
                <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {user.id}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Account Created</label>
                <div className="mt-1 text-sm text-gray-900">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Location Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.role === 'super_admin' ? (
              <div className="text-center py-4">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  All Locations Access
                </Badge>
                <p className="text-sm text-gray-600 mt-2">
                  As a super administrator you have access to all locations
                </p>
              </div>
            ) : userLocations.length === 0 ? (
              <div className="text-center py-4">
                <Badge variant="secondary">
                  No Location Access
                </Badge>
                <p className="text-sm text-gray-600 mt-2">
                  Contact your administrator to request location access
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  You have access to the following locations:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {userLocations.map((location: any) => (
                    <div key={location.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{location.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {getLocationTypeDisplayName(location.type)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
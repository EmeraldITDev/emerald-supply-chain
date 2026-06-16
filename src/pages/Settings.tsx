import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AuditTrail } from "@/components/AuditTrail";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import UserManagement from "@/pages/UserManagement";
import { Settings as SettingsIcon, User, Bell, Shield, Database, Loader2, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/services/api";
import { signatureApi } from "@/services/api";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

export default function Settings() {
  const { user, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [phone, setPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isRemovingSignature, setIsRemovingSignature] = useState(false);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fromUser =
      user && "signature_url" in user
        ? (user as { signature_url?: string | null }).signature_url
        : null;
    const fromUserAlt =
      user && "signatureUrl" in user
        ? (user as { signatureUrl?: string | null }).signatureUrl
        : null;
    const fromContext = fromUser ?? fromUserAlt ?? null;
    if (fromContext) {
      setSavedSignatureUrl(fromContext);
      return;
    }
    try {
      const raw = localStorage.getItem("userData") || sessionStorage.getItem("userData");
      if (!raw) {
        setSavedSignatureUrl(null);
        return;
      }
      const parsed = JSON.parse(raw) as { signature_url?: string; signatureUrl?: string };
      setSavedSignatureUrl(parsed.signature_url || parsed.signatureUrl || null);
    } catch {
      setSavedSignatureUrl(null);
    }
  }, [user]);

  // Role-based access control
  const isRegularEmployee = getScmRole(user) === "employee" || getScmRole(user) === "general_employee";
  const canViewProfile = !isRegularEmployee;
  const canViewAuditTrail = ['chairman', 'executive', 'supply_chain_director', 'procurement', 'finance', 'logistics'].includes(getScmRole(user) || '');
  const canManageUsers = ['procurement', 'procurement_manager', 'executive', 'supply_chain_director', 'supply_chain'].includes(getScmRole(user) || '');
  const normalizedRole = (getScmRole(user) || '').toLowerCase();
  const canUploadSignature = [
    'supply_chain_director',
    'supply_chain',
    'supplychaindirector',
    'supply chain director',
    'admin',
  ].includes(normalizedRole);

  const handleSignatureFile = (file: File | null) => {
    setSignatureFile(file);
    if (signaturePreview) URL.revokeObjectURL(signaturePreview);
    setSignaturePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleUploadSignature = async () => {
    if (!signatureFile || !user?.id) {
      toast.error("Select a signature image first.");
      return;
    }
    setIsUploadingSignature(true);
    try {
      const res = await signatureApi.upload(String(user.id), signatureFile);
      if (res.success) {
        toast.success("Digital signature uploaded.");
        const sigUrl = res.data?.signature_url || res.data?.signatureUrl;
        if (sigUrl) {
          try {
            const raw = localStorage.getItem("userData") || sessionStorage.getItem("userData");
            if (raw) {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              parsed.signature_url = sigUrl;
              delete parsed.signatureUrl;
              if (localStorage.getItem("userData")) localStorage.setItem("userData", JSON.stringify(parsed));
              if (sessionStorage.getItem("userData")) sessionStorage.setItem("userData", JSON.stringify(parsed));
            }
          } catch {
            /* ignore */
          }
          setSavedSignatureUrl(sigUrl);
          window.dispatchEvent(new Event("app:refresh"));
        }
        handleSignatureFile(null);
        if (signatureInputRef.current) signatureInputRef.current.value = "";
        window.dispatchEvent(new Event("app:refresh"));
      } else {
        toast.error(res.error || "Failed to upload signature.");
      }
    } catch {
      toast.error("Failed to upload signature.");
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const clearStoredSignatureFields = () => {
    try {
      const raw = localStorage.getItem("userData") || sessionStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        delete parsed.signature_url;
        delete parsed.signatureUrl;
        if (localStorage.getItem("userData")) localStorage.setItem("userData", JSON.stringify(parsed));
        if (sessionStorage.getItem("userData")) sessionStorage.setItem("userData", JSON.stringify(parsed));
      }
    } catch {
      /* ignore */
    }
    setSavedSignatureUrl(null);
    window.dispatchEvent(new Event("app:refresh"));
  };

  const handleRemoveSignature = async () => {
    if (!user?.id) {
      toast.error("You must be signed in to remove a signature.");
      return;
    }
    if (!savedSignatureUrl) {
      toast.error("No saved signature to remove.");
      return;
    }
    setIsRemovingSignature(true);
    try {
      const res = await signatureApi.remove(String(user.id));
      if (res.success) {
        toast.success("Saved signature removed.");
        clearStoredSignatureFields();
      } else {
        toast.error(
          res.error ||
            "Could not remove signature. Ensure the API supports DELETE /users/{id}/signature.",
        );
      }
    } catch {
      toast.error("Failed to remove signature.");
    } finally {
      setIsRemovingSignature(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await authApi.updateProfile({
        name: name.trim(),
        department: department.trim() || null,
        phone: phone.trim() || undefined,
      });

      if (response.success) {
        toast.success("Profile updated successfully");
        // Update local user data
        if (response.data) {
          // The context will refresh on next page load or we can trigger a refresh
          window.location.reload(); // Simple refresh to get updated data
        }
      } else {
        toast.error(response.error || "Failed to update profile");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while updating profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);

      if (response.success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(response.error || "Failed to change password");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while changing password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and application preferences</p>
          </div>
        </div>

        <Tabs defaultValue={isRegularEmployee ? "security" : "profile"} className="space-y-6">
          <TabsList className="bg-muted">
            {canViewProfile && (
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            {canManageUsers && (
              <TabsTrigger value="users" className="gap-2">
                <User className="h-4 w-4" />
                User Management
              </TabsTrigger>
            )}
            {canViewAuditTrail && (
              <TabsTrigger value="audit" className="gap-2">
                <Database className="h-4 w-4" />
                Audit Trail
              </TabsTrigger>
            )}
          </TabsList>

          {!isRegularEmployee && (
            <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your account details and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={user?.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Supply Chain Role</Label>
                  <Input 
                    id="role" 
                    value={formatScmRoleLabel(getScmRole(user))} 
                    disabled 
                  />
                  <p className="text-xs text-muted-foreground">SCM role is assigned by administrators</p>
                </div>
                {user?.hris_role && (
                  <div className="space-y-2">
                    <Label htmlFor="hris_role">HRIS Role</Label>
                    <Input
                      id="hris_role"
                      value={formatScmRoleLabel(user.hris_role)}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">Managed in HRIS — read-only here</p>
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input 
                    id="department" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Procurement, Finance"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+971 XX XXX XXXX" 
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          <TabsContent value="notifications" className="space-y-6">
            <NotificationPreferences />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your password and security preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <PasswordInput
                    id="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <PasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </CardContent>
            </Card>

            {canUploadSignature && (
              <Card>
                <CardHeader>
                  <CardTitle>Digital Signature</CardTitle>
                  <CardDescription>
                    Upload your signature image (PNG or JPG, transparent background recommended). It is
                    used when you click Attach Signature on Purchase Orders, and when you save it from
                    this page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {savedSignatureUrl && (
                    <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Saved signature</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleRemoveSignature()}
                          disabled={isRemovingSignature || isUploadingSignature}
                        >
                          {isRemovingSignature ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </>
                          )}
                        </Button>
                      </div>
                      <img
                        src={savedSignatureUrl}
                        alt="Saved signature"
                        className="max-h-24 object-contain"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signature-file">Signature Image</Label>
                    <Input
                      id="signature-file"
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > 2 * 1024 * 1024) {
                          toast.error("Signature image must be 2MB or less.");
                          return;
                        }
                        handleSignatureFile(f);
                      }}
                    />
                  </div>
                  {signaturePreview && (
                    <div className="rounded-md border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs text-muted-foreground">Preview (not saved yet)</p>
                        {signatureFile && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground"
                            onClick={() => {
                              handleSignatureFile(null);
                              if (signatureInputRef.current) signatureInputRef.current.value = "";
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                      <img
                        src={signaturePreview}
                        alt="Signature preview"
                        className="max-h-24 object-contain"
                      />
                    </div>
                  )}
                  <Button
                    onClick={handleUploadSignature}
                    disabled={!signatureFile || isUploadingSignature}
                  >
                    {isUploadingSignature ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Signature"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {canManageUsers && (
            <TabsContent value="users" className="space-y-6">
              <UserManagement />
            </TabsContent>
          )}

          {canViewAuditTrail && (
            <TabsContent value="audit" className="space-y-6">
              <AuditTrail userRole={getScmRole(user)} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

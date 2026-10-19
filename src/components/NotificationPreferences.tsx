import { useEffect, useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Volume2, Mail, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { previewNotificationSound } from "@/utils/notificationSound";

export function NotificationPreferences() {
  const { preferences, updatePreferences, clearAllNotifications } = useNotifications();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleSoundToggle = async (checked: boolean) => {
    setLocalPreferences((prev) => ({ ...prev, enableSoundNotifications: checked }));
    if (checked) {
      const played = await previewNotificationSound();
      if (!played) {
        toast.message("Sound enabled", {
          description: "Click anywhere on the page if you don't hear the preview chime.",
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      updatePreferences(localPreferences);
      if (localPreferences.enableSoundNotifications) {
        await previewNotificationSound();
      }
      toast.success("Notification preferences saved");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all notifications?")) {
      return;
    }
    setClearing(true);
    try {
      await clearAllNotifications();
      toast.success("All notifications cleared");
    } catch {
      toast.error("Could not clear notifications. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Manage how you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Notification Channels</h3>
          
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="in-app" className="text-sm font-normal">
                In-App Notifications
              </Label>
            </div>
            <Switch
              id="in-app"
              checked={localPreferences.enableInAppNotifications}
              onCheckedChange={(checked) =>
                setLocalPreferences({ ...localPreferences, enableInAppNotifications: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email" className="text-sm font-normal">
                Email Notifications
              </Label>
            </div>
            <Switch
              id="email"
              checked={localPreferences.enableEmailNotifications}
              onCheckedChange={(checked) =>
                setLocalPreferences({ ...localPreferences, enableEmailNotifications: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sound" className="text-sm font-normal">
                Sound Notifications
              </Label>
            </div>
            <Switch
              id="sound"
              checked={localPreferences.enableSoundNotifications}
              onCheckedChange={(checked) => {
                void handleSoundToggle(checked);
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button onClick={() => void handleSave()} className="flex-1" disabled={saving || clearing}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleClearAll()}
            className="flex-1"
            disabled={saving || clearing}
          >
            {clearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              "Clear All Notifications"
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p>• High-priority notifications will always be shown</p>
          <p>• Email notifications depend on system configuration</p>
          <p>• Sound notifications may require browser permissions</p>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Volume2, Mail, Settings } from "lucide-react";
import { toast } from "sonner";

export function NotificationPreferences() {
  const { preferences, updatePreferences, clearAllNotifications } = useNotifications();
  const [localPreferences, setLocalPreferences] = useState(preferences);

  const handleSave = () => {
    updatePreferences(localPreferences);
    toast.success("Notification preferences saved");
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all notifications?")) {
      clearAllNotifications();
      toast.success("All notifications cleared");
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
              onCheckedChange={(checked) =>
                setLocalPreferences({ ...localPreferences, enableSoundNotifications: checked })
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            Save Preferences
          </Button>
          <Button variant="outline" onClick={handleClearAll} className="flex-1">
            Clear All Notifications
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

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/services/api";

type LazarusToggle = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

type LazarusSettings = {
  email: string;
  toggles: LazarusToggle[];
};

export function LazarusNotificationSettings() {
  const [toggles, setToggles] = useState<LazarusToggle[]>([]);
  const [email, setEmail] = useState("lazarus.angbazo@emeraldcfze.com");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiRequest<LazarusSettings>("/settings/lazarus-notifications");
      if (cancelled) return;
      if (res.success && res.data) {
        setEmail(res.data.email);
        setToggles(res.data.toggles);
      } else {
        toast.error(res.error || "Could not load Lazarus email settings.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(toggles.map((toggle) => [toggle.key, toggle.enabled]));
      const res = await apiRequest<LazarusSettings>("/settings/lazarus-notifications", {
        method: "PUT",
        body: JSON.stringify({ toggles: payload }),
      });
      if (!res.success || !res.data) {
        toast.error(res.error || "Could not save Lazarus email settings.");
        return;
      }
      setToggles(res.data.toggles);
      toast.success("Lazarus email settings saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          <CardTitle>Lazarus email</CardTitle>
        </div>
        <CardDescription>
          {email} does not receive workflow email unless a switch below is on.
          Every switch starts off. An MRF amount rule can be added later; until then he gets no MRF email unless you turn that switch on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading email switches…
          </div>
        ) : (
          toggles.map((toggle) => (
            <div key={toggle.key} className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor={`lazarus-${toggle.key}`} className="text-sm font-medium">
                  {toggle.label}
                </Label>
                <p className="text-xs text-muted-foreground">{toggle.description}</p>
              </div>
              <Switch
                id={`lazarus-${toggle.key}`}
                checked={toggle.enabled}
                onCheckedChange={(checked) =>
                  setToggles((current) =>
                    current.map((item) =>
                      item.key === toggle.key ? { ...item, enabled: checked } : item,
                    ),
                  )
                }
              />
            </div>
          ))
        )}
        <Button onClick={save} disabled={loading || saving || toggles.length === 0}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Lazarus email settings"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

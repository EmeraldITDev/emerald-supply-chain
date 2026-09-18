import { Badge } from "@/components/ui/badge";
import { getLatestRevisionChanges, getPoRevisionNumber } from "@/utils/poHelpers";

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

interface PoRevisionSummaryProps {
  mrf: unknown;
  /** Compact badge-only presentation for queues. */
  badgeOnly?: boolean;
}

export function PoRevisedBadge({ mrf }: { mrf: unknown }) {
  const revision = getPoRevisionNumber(mrf);
  if (revision <= 0) return null;
  return (
    <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/20">
      Revised
    </Badge>
  );
}

export function PoRevisionSummary({ mrf, badgeOnly = false }: PoRevisionSummaryProps) {
  const revision = getPoRevisionNumber(mrf);
  const changes = getLatestRevisionChanges(mrf);

  if (badgeOnly) {
    return <PoRevisedBadge mrf={mrf} />;
  }

  if (revision <= 0 && changes.length === 0) return null;

  const record = (mrf ?? {}) as Record<string, unknown>;
  const history = (record.revision_history ?? record.revisionHistory) as
    | Array<Record<string, unknown>>
    | undefined;
  const latest = Array.isArray(history) && history.length > 0 ? history[history.length - 1] : null;
  const editorName = String(latest?.editor_name ?? latest?.editorName ?? "");
  const timestamp = String(latest?.timestamp ?? "");

  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PoRevisedBadge mrf={mrf} />
        <p className="text-sm font-semibold">Revision Summary</p>
        {revision > 0 && (
          <span className="text-xs text-muted-foreground">Revision {revision}</span>
        )}
      </div>
      {(editorName || timestamp) && (
        <p className="text-xs text-muted-foreground">
          {editorName ? `Revised by ${editorName}` : "Revised"}
          {timestamp ? ` · ${new Date(timestamp).toLocaleString()}` : ""}
        </p>
      )}
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          This PO was revised and needs a new SCD signature.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Field</th>
                <th className="py-1.5 pr-3 font-medium">Previous</th>
                <th className="py-1.5 font-medium">New</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change, index) => (
                <tr key={`${change.field}-${index}`} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3 font-medium">
                    {change.label || change.field}
                  </td>
                  <td className="py-1.5 pr-3 text-amber-900">
                    {change.before_display ?? displayValue(change.before)}
                  </td>
                  <td className="py-1.5 text-emerald-800">
                    {change.after_display ?? displayValue(change.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

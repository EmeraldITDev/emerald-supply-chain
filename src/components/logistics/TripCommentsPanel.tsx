import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import { tripsApi } from "@/services/logisticsApi";
import type { TripComment as TripRequestComment } from "@/types/trip-request";
import type { TripComment as LogisticsTripComment } from "@/types/logistics";

type Comment = TripRequestComment | LogisticsTripComment;

interface TripCommentsPanelProps {
  /** Trip request id (staff submission) */
  tripRequestId?: string | null;
  /** Linked logistics trip id (after approval) */
  logisticsTripId?: string | null;
  /** Hide composer when user cannot comment (org-wide read-only viewers) */
  readOnly?: boolean;
  /** Explicit override from API `canComment` flag */
  canComment?: boolean;
  className?: string;
}

function normalizeComment(c: Comment) {
  return {
    id: String(c.id),
    body: c.body,
    author:
      (c as TripRequestComment).authorName ??
      (c as TripRequestComment).author_name ??
      (c as LogisticsTripComment).authorName ??
      (c as LogisticsTripComment).author_name ??
      "Staff",
    role:
      (c as TripRequestComment).authorRole ??
      (c as TripRequestComment).author_role ??
      (c as LogisticsTripComment).authorRole ??
      (c as LogisticsTripComment).author_role ??
      "",
    createdAt:
      (c as TripRequestComment).createdAt ??
      (c as TripRequestComment).created_at ??
      (c as LogisticsTripComment).createdAt ??
      (c as LogisticsTripComment).created_at ??
      "",
  };
}

export function TripCommentsPanel({
  tripRequestId,
  logisticsTripId,
  readOnly = false,
  canComment: canCommentProp,
  className,
}: TripCommentsPanelProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<ReturnType<typeof normalizeComment>[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [canCommentFromApi, setCanCommentFromApi] = useState<boolean | undefined>(undefined);

  const entityId = logisticsTripId || tripRequestId;
  const useLogisticsApi = Boolean(logisticsTripId);

  const fetchComments = useCallback(async () => {
    if (!entityId) {
      setComments([]);
      return;
    }
    setLoading(true);
    try {
      if (useLogisticsApi) {
        const res = await tripsApi.getComments(String(entityId));
        if (res.success && res.data) {
          setComments(res.data.comments.map(normalizeComment));
          setCanCommentFromApi(res.data.canComment);
        } else {
          setComments([]);
        }
      } else if (tripRequestId) {
        const res = await tripRequestApi.getComments(tripRequestId);
        if (res.success && res.data?.comments) {
          setComments(res.data.comments.map(normalizeComment));
          setCanCommentFromApi(res.data.canComment);
        } else {
          setComments([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, tripRequestId, useLogisticsApi]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || !entityId) return;
    setSubmitting(true);
    try {
      const res = useLogisticsApi
        ? await tripsApi.addComment(String(entityId), body)
        : await tripRequestApi.addComment(String(entityId), body);
      if (res.success) {
        setDraft("");
        await fetchComments();
        toast({ title: "Comment added" });
      } else {
        toast({
          title: "Could not add comment",
          description: res.error,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!entityId) return null;

  const showComposer =
    !readOnly &&
    (canCommentProp !== undefined ? canCommentProp : canCommentFromApi !== false);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Trip comments</h4>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No comments yet.</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium">{c.author}</span>
                {c.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
              {c.role && (
                <p className="text-xs text-muted-foreground mb-1 capitalize">{c.role.replace(/_/g, " ")}</p>
              )}
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {showComposer && (
        <div className="space-y-2">
          <Textarea
            placeholder="Leave a comment visible to trip participants and logistics…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Post comment
          </Button>
        </div>
      )}
    </div>
  );
}

export default TripCommentsPanel;

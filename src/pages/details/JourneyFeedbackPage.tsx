import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { journeysApi } from "@/services/logisticsApi";
import type { Journey, JourneyFeedbackStatus } from "@/types/logistics";

const STATUS_OPTIONS: Array<{ value: JourneyFeedbackStatus; label: string }> = [
  { value: "satisfactory", label: "Satisfactory" },
  { value: "excellent", label: "Excellent" },
  { value: "still_ongoing", label: "Still ongoing" },
  { value: "took_longer_than_expected", label: "Took longer than expected" },
];

/**
 * Public-after-auth landing page for the passenger feedback deep link.
 * The backend notification links to exactly `/journeys/{numeric id}/feedback`.
 */
export default function JourneyFeedbackPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<JourneyFeedbackStatus | "">("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await journeysApi.getDetail(id);
      if (!cancelled) {
        setJourney(res.success && res.data ? res.data : null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async () => {
    if (!rating || !status) {
      toast({
        title: "Almost there",
        description: "Please give a rating and pick how the trip went.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await journeysApi.submitFeedback(id, {
        rating,
        status,
        comments: comments.trim() || undefined,
      });
      if (res.success) {
        setSubmitted(true);
        toast({ title: "Thank you", description: "Your feedback has been recorded." });
      } else {
        toast({
          title: "Could not submit feedback",
          description: res.error || "Please try again in a moment.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Trip feedback</CardTitle>
          <CardDescription>
            {loading
              ? "Loading journey…"
              : journey
                ? `${journey.tripNumber ?? `Journey #${id}`}${
                    journey.currentLocation ? ` · ${journey.currentLocation}` : ""
                  }`
                : `Journey #${id}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="font-medium">Feedback submitted</p>
              <p className="text-sm text-muted-foreground">
                Thanks for helping us improve staff travel.
              </p>
              <Button variant="outline" onClick={() => navigate("/logistics")}>
                Back to Logistics
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>How would you rate this trip?</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      onClick={() => setRating(n)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          "h-7 w-7",
                          n <= rating
                            ? "fill-warning text-warning"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>How did the trip go?</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as JourneyFeedbackStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comments (optional)</Label>
                <Textarea
                  rows={4}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Anything the logistics team should know?"
                />
              </div>

              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit feedback
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** Live countdown to the backend-provided requester edit deadline. */
export function EditCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (Number.isNaN(diff)) {
        setTimeLeft("");
        return;
      }
      if (diff <= 0) {
        setTimeLeft("Edit window has closed");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(
        hours > 0
          ? `${hours}h ${minutes}m remaining to edit`
          : `${minutes}m remaining to edit`,
      );
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;

  return (
    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <Clock className="h-3 w-3" />
      {timeLeft}
    </p>
  );
}

export default EditCountdown;
import { useMemo } from "react";
import type { DayTotal } from "@/services/DashboardService";
import { cn } from "@/utils/cn";

interface SpendingTimelineProps {
  days: DayTotal[];
}

export function SpendingTimeline({ days }: SpendingTimelineProps) {
  const max = useMemo(() => Math.max(...days.map((d) => d.total), 1), [days]);
  const today = new Date().toDateString();

  return (
    <div
      className="flex items-end justify-between gap-8"
      role="img"
      aria-label="Spending over the last 7 days"
    >
      {days.map((d) => {
        const heightPct = Math.max((d.total / max) * 100, d.total > 0 ? 6 : 2);
        const isToday = d.date.toDateString() === today;
        return (
          <div
            key={d.date.toISOString()}
            className="flex flex-1 flex-col items-center gap-8"
          >
            <div className="flex h-64 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-sm",
                  isToday ? "bg-income" : "bg-neutral-200 dark:bg-neutral-700",
                )}
                style={{ height: `${heightPct}%` }}
                title={`₹${d.total.toLocaleString("en-IN")}`}
              />
            </div>
            <span
              className={cn(
                "text-caption",
                isToday ? "font-semibold text-income" : "text-text-tertiary",
              )}
            >
              {d.date.toLocaleDateString("en-IN", { weekday: "narrow" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

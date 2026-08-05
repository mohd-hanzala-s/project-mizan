import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/utils/cn";

interface TrendIndicatorProps {
  /** % change vs. the previous period, or null if undefined (e.g. previous
   * period was zero). */
  value: number | null;
  /** Whether an increase is good news (income) or bad news (expense) —
   * flips which direction gets the "positive" color. */
  positiveDirection: "up" | "down";
}

export function TrendIndicator({
  value,
  positiveDirection,
}: TrendIndicatorProps) {
  if (value === null) return null;

  const isUp = value > 0;
  const isFlat = Math.round(value) === 0;
  const isGood = isFlat
    ? null
    : (isUp && positiveDirection === "up") ||
      (!isUp && positiveDirection === "down");

  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-4 text-caption font-medium tabular-nums",
        isFlat ? "text-text-tertiary" : isGood ? "text-income" : "text-expense",
      )}
    >
      <Icon className="size-12" aria-hidden="true" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

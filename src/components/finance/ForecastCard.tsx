import {
  CalendarRange,
  Info,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardCard } from "@/components/finance/DashboardCard";
import type { Forecast, ForecastConfidence } from "@/services/ForecastService";
import { cn } from "@/utils/cn";

interface ForecastCardProps {
  forecast: Forecast;
}

const CONFIDENCE_PILL: Record<ForecastConfidence, string> = {
  high: "bg-income-subtle text-income",
  medium: "bg-info-subtle text-info",
  low: "bg-warning-subtle text-warning",
};

function formatSigned(amount: number): string {
  const sign = amount < 0 ? "−" : "+";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN")}`;
}

interface StatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}

function Stat({ label, value, icon, valueClassName }: StatProps) {
  return (
    <div className="flex flex-col gap-8 rounded-md border border-border bg-surface-card p-12">
      <div className="flex items-center gap-8 text-body-sm text-text-secondary">
        <span className="text-text-tertiary" aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn("text-h3 tabular-nums text-text-primary", valueClassName)}
      >
        {value}
      </p>
    </div>
  );
}

/** §6 ForecastCard: month-end spending, expected balance, expected savings,
 * upcoming obligations — with the confidence explicitly stated (low = a
 * projection to treat carefully). Values come pre-computed from
 * ForecastService; this is a pure presentation layer. */
export function ForecastCard({ forecast }: ForecastCardProps) {
  const topObligations = forecast.obligations.slice(0, 4);
  const extraCount = forecast.obligations.length - topObligations.length;

  return (
    <DashboardCard
      title="Month-End Forecast"
      action={
        <span
          className={cn(
            "rounded-full px-8 py-4 text-caption font-semibold capitalize",
            CONFIDENCE_PILL[forecast.confidence],
          )}
        >
          {forecast.confidence} confidence
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
        <Stat
          label="Projected balance"
          value={`₹${forecast.expectedBalance.toLocaleString("en-IN")}`}
          icon={<Wallet className="size-16" />}
          valueClassName={
            forecast.expectedBalance < 0 ? "text-expense" : "text-income"
          }
        />
        <Stat
          label="Expected savings"
          value={formatSigned(forecast.expectedSavings)}
          icon={<PiggyBank className="size-16" />}
          valueClassName={
            forecast.expectedSavings < 0 ? "text-expense" : "text-income"
          }
        />
        <Stat
          label={`${forecast.remainingDays} day${forecast.remainingDays === 1 ? "" : "s"} left`}
          value={format(forecast.period.end, "d MMM")}
          icon={<CalendarRange className="size-16" />}
        />
      </div>

      <div className="flex flex-col gap-4 text-body-sm tabular-nums text-text-secondary">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-8">
            <TrendingUp className="size-16 text-income" aria-hidden="true" />
            Expected income
          </span>
          <span className="font-medium text-income">
            +₹{forecast.monthEndIncome.toLocaleString("en-IN")}
          </span>
        </span>
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-8">
            <TrendingDown className="size-16 text-expense" aria-hidden="true" />
            Expected expense
          </span>
          <span className="font-medium text-expense">
            −₹{forecast.monthEndExpense.toLocaleString("en-IN")}
          </span>
        </span>
      </div>

      {topObligations.length > 0 && (
        <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
          {topObligations.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between gap-8 px-12 py-8"
            >
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-text-primary">
                  {o.title}
                </p>
                <p className="text-caption text-text-secondary">
                  {format(o.date, "d MMM yyyy")}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 tabular-nums text-body-sm font-semibold",
                  o.amount < 0 ? "text-expense" : "text-income",
                )}
              >
                {formatSigned(o.amount)}
              </span>
            </div>
          ))}
          {extraCount > 0 && (
            <p className="px-12 py-8 text-caption text-text-tertiary">
              +{extraCount} more obligation{extraCount === 1 ? "" : "s"} this
              period
            </p>
          )}
        </div>
      )}

      <p className="flex items-start gap-8 text-body-sm text-text-tertiary">
        <Info className="mt-4 size-16 shrink-0" aria-hidden="true" />
        {forecast.confidenceReason}
      </p>
    </DashboardCard>
  );
}

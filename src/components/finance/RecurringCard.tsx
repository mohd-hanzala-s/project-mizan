import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Pause,
  Pencil,
  Play,
  SkipForward,
  Trash2,
} from "lucide-react";
import type {
  Category,
  RecurringRule,
  Transaction,
  TransactionStatus,
} from "@/types/entities";
import { FREQUENCY_LABELS } from "@/services/RecurringService";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

interface RecurringCardProps {
  rule: RecurringRule;
  history: Transaction[];
  category: Category | undefined;
  accountName: string;
  onEdit: () => void;
  onTogglePause: () => void;
  onSkipNext: () => void;
  onDelete: () => void;
  onMarkPaid: (transaction: Transaction) => void;
  onMarkStatus: (
    transaction: Transaction,
    status: Exclude<TransactionStatus, "paid">,
  ) => void;
}

const STATUS_STYLE: Record<TransactionStatus, string> = {
  paid: "bg-income-subtle text-income",
  pending: "bg-info-subtle text-info",
  postponed: "bg-warning-subtle text-warning",
  skipped: "bg-neutral-100 text-text-secondary dark:bg-neutral-800",
  missed: "bg-expense-subtle text-expense",
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  postponed: "Postponed",
  skipped: "Skipped",
  missed: "Missed",
};

export function RecurringCard({
  rule,
  history,
  category,
  accountName,
  onEdit,
  onTogglePause,
  onSkipNext,
  onDelete,
  onMarkPaid,
  onMarkStatus,
}: RecurringCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = rule.type === "income";
  const nextDate = new Date(rule.nextExecution);
  const hasHistory = history.length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface-card">
      <div className="flex flex-col gap-12 p-16">
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-8">
              <span
                className={cn(
                  "flex size-32 shrink-0 items-center justify-center rounded-full",
                  isIncome
                    ? "bg-income-subtle text-income"
                    : "bg-expense-subtle text-expense",
                )}
              >
                {isIncome ? (
                  <ArrowUpRight className="size-16" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="size-16" aria-hidden="true" />
                )}
              </span>
              <p className="truncate text-body font-medium text-text-primary">
                {rule.title}
              </p>
            </div>
            <p className="mt-8 truncate text-body-sm text-text-secondary">
              {category?.name ?? "Uncategorized"} · {accountName} ·{" "}
              {FREQUENCY_LABELS[rule.frequency]}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-4">
            <span
              className={cn(
                "text-body-lg font-semibold tabular-nums",
                isIncome ? "text-income" : "text-expense",
              )}
            >
              {isIncome ? "+" : "−"}₹{rule.amount.toLocaleString("en-IN")}
            </span>
            <span
              className={cn(
                "rounded-full px-8 py-4 text-caption font-medium",
                rule.active
                  ? "bg-income-subtle text-income"
                  : "bg-neutral-100 text-text-secondary dark:bg-neutral-800",
              )}
            >
              {rule.active ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-body-sm text-text-secondary">
          <span className="flex items-center gap-8">
            <CalendarClock className="size-16" aria-hidden="true" />
            Next {format(nextDate, "d MMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-touch items-center gap-4 text-body-sm font-medium text-text-primary"
          >
            {hasHistory ? `${history.length} entries` : "No entries yet"}
            {expanded ? (
              <ChevronUp className="size-16" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-16" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-8 border-t border-border-subtle pt-12">
          <Button variant="tertiary" size="sm" onClick={onEdit}>
            <Pencil className="size-16" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="tertiary" size="sm" onClick={onTogglePause}>
            {rule.active ? (
              <>
                <Pause className="size-16" aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play className="size-16" aria-hidden="true" /> Resume
              </>
            )}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onClick={onSkipNext}
            disabled={!rule.active}
          >
            <SkipForward className="size-16" aria-hidden="true" />
            Skip next
          </Button>
          <Button variant="tertiary" size="sm" onClick={onDelete}>
            <Trash2 className="size-16 text-expense" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col divide-y divide-border-subtle border-t border-border bg-neutral-50 dark:bg-neutral-900">
          {history.length === 0 ? (
            <p className="p-16 text-body-sm text-text-tertiary">
              No generated entries yet. The first one arrives on the next
              scheduled date.
            </p>
          ) : (
            history.map((t) => (
              <div key={t.id} className="flex flex-col gap-8 px-16 py-12">
                <div className="flex items-center justify-between gap-8">
                  <span className="text-body-sm text-text-secondary">
                    {format(new Date(t.transactionDate), "d MMM yyyy")}
                  </span>
                  <div className="flex items-center gap-8">
                    <span
                      className={cn(
                        "rounded-full px-8 py-4 text-caption font-medium",
                        STATUS_STYLE[t.status],
                      )}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span
                      className={cn(
                        "text-body-sm font-semibold tabular-nums",
                        t.type === "income" ? "text-income" : "text-expense",
                      )}
                    >
                      {t.type === "income" ? "+" : "−"}₹
                      {t.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {t.status === "pending" ? (
                  <div className="flex flex-wrap gap-8">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMarkPaid(t)}
                    >
                      Mark paid
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onMarkStatus(t, "skipped")}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onMarkStatus(t, "postponed")}
                    >
                      Postpone
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onMarkStatus(t, "missed")}
                    >
                      Mark missed
                    </Button>
                  </div>
                ) : t.status !== "paid" ? (
                  <div className="flex flex-wrap gap-8">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMarkPaid(t)}
                    >
                      Mark paid
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onMarkStatus(t, "pending")}
                    >
                      Back to pending
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

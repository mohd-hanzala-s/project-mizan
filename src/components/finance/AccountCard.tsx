import type { Account } from "@/types/entities";
import { DynamicIcon } from "@/components/common/DynamicIcon";
import { cn } from "@/utils/cn";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const isNegative = account.currentBalance < 0;

  return (
    <div className="flex min-h-touch items-center gap-12 rounded-md border border-border bg-surface-card px-16 py-12">
      <span
        className="flex size-40 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${account.color}22`, color: account.color }}
      >
        <DynamicIcon name={account.icon} className="size-24" />
      </span>
      <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
        {account.name}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums text-body-lg font-semibold",
          isNegative ? "text-expense" : "text-text-primary",
        )}
      >
        {isNegative ? "−" : ""}₹
        {Math.abs(account.currentBalance).toLocaleString("en-IN")}
      </span>
    </div>
  );
}

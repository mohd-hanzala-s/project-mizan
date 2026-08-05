import { useEffect, useMemo, useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { useRecurringStore } from "./recurringStore";
import { useTransactionsStore } from "@/features/transactions/transactionsStore";
import { useAccountsStore } from "@/features/accounts/accountsStore";
import { RecurringService } from "@/services/RecurringService";
import { TransactionService } from "@/services/TransactionService";
import { RecurringCard } from "@/components/finance/RecurringCard";
import { RecurringForm } from "./RecurringForm";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { db } from "@/database/db";
import type {
  Category,
  RecurringRule,
  Transaction,
  TransactionStatus,
} from "@/types/entities";

export function RecurringPage() {
  const rules = useRecurringStore((s) => s.rules);
  const generated = useRecurringStore((s) => s.generated);
  const loadRecurring = useRecurringStore((s) => s.load);
  const loadTransactions = useTransactionsStore((s) => s.load);
  const accounts = useAccountsStore((s) => s.accounts);
  const loadAccounts = useAccountsStore((s) => s.load);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] =
    useState<RecurringRule | null>(null);
  const { show } = useToast();

  useEffect(() => {
    loadRecurring();
    loadTransactions();
    loadAccounts();
    db.categories.toArray().then(setCategories);
  }, [loadRecurring, loadTransactions, loadAccounts]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const historyByRule = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of generated) {
      if (!t.recurringRuleId) continue;
      const list = map.get(t.recurringRuleId) ?? [];
      list.push(t);
      map.set(t.recurringRuleId, list);
    }
    return map;
  }, [generated]);

  const activeRules = rules.filter((r) => r.active);
  const pausedRules = rules.filter((r) => !r.active);

  function openAdd() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(rule: RecurringRule) {
    setEditing(rule);
    setSheetOpen(true);
  }

  async function refresh() {
    await Promise.all([loadRecurring(), loadTransactions()]);
  }

  async function handleSaved() {
    setSheetOpen(false);
    await refresh();
    show(editing ? "Rule updated" : "Rule created");
  }

  async function handleDelete() {
    if (!confirmingDelete) return;
    await RecurringService.remove(confirmingDelete.id);
    setConfirmingDelete(null);
    await refresh();
    show("Rule deleted");
  }

  async function handleTogglePause(rule: RecurringRule) {
    if (rule.active) {
      await RecurringService.pause(rule.id);
      show("Rule paused");
    } else {
      await RecurringService.resume(rule.id);
      show("Rule resumed");
    }
    await refresh();
  }

  async function handleSkipNext(rule: RecurringRule) {
    await RecurringService.skipNext(rule.id);
    await refresh();
    show("Skipped the next occurrence");
  }

  async function handleMarkPaid(transaction: Transaction) {
    await TransactionService.markPaid(transaction.id);
    await refresh();
    show("Marked as paid");
  }

  async function handleMarkStatus(
    transaction: Transaction,
    status: Exclude<TransactionStatus, "paid">,
  ) {
    await TransactionService.updateStatus(transaction.id, status);
    await refresh();
    show(`Marked as ${status}`);
  }

  if (rules.length === 0) {
    return (
      <>
        <EmptyState
          icon={Repeat}
          title="No recurring rules yet"
          description="Set up rent, subscriptions, or salary to auto-generate entries, get reminders, and never miss a payment again."
          actionLabel="Create a rule"
          onAction={openAdd}
        />
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="New Recurring Rule"
        >
          <RecurringForm
            onSaved={handleSaved}
            onCancel={() => setSheetOpen(false)}
          />
        </BottomSheet>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-16 p-16 md:p-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-text-primary">Recurring</h1>
        <Button variant="secondary" size="sm" onClick={openAdd}>
          <Plus className="size-16" aria-hidden="true" />
          Add
        </Button>
      </div>

      {activeRules.length > 0 && (
        <section className="flex flex-col gap-12">
          <h2 className="text-overline text-text-tertiary">Active</h2>
          {activeRules.map((rule) => (
            <RecurringCard
              key={rule.id}
              rule={rule}
              history={historyByRule.get(rule.id) ?? []}
              category={categoryById.get(rule.categoryId)}
              accountName={accountById.get(rule.accountId)?.name ?? "Account"}
              onEdit={() => openEdit(rule)}
              onTogglePause={() => handleTogglePause(rule)}
              onSkipNext={() => handleSkipNext(rule)}
              onDelete={() => setConfirmingDelete(rule)}
              onMarkPaid={handleMarkPaid}
              onMarkStatus={handleMarkStatus}
            />
          ))}
        </section>
      )}

      {pausedRules.length > 0 && (
        <section className="flex flex-col gap-12">
          <h2 className="text-overline text-text-tertiary">Paused</h2>
          {pausedRules.map((rule) => (
            <RecurringCard
              key={rule.id}
              rule={rule}
              history={historyByRule.get(rule.id) ?? []}
              category={categoryById.get(rule.categoryId)}
              accountName={accountById.get(rule.accountId)?.name ?? "Account"}
              onEdit={() => openEdit(rule)}
              onTogglePause={() => handleTogglePause(rule)}
              onSkipNext={() => handleSkipNext(rule)}
              onDelete={() => setConfirmingDelete(rule)}
              onMarkPaid={handleMarkPaid}
              onMarkStatus={handleMarkStatus}
            />
          ))}
        </section>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit Recurring Rule" : "New Recurring Rule"}
      >
        <RecurringForm
          editing={editing}
          onSaved={handleSaved}
          onCancel={() => setSheetOpen(false)}
        />
      </BottomSheet>

      <ConfirmationDialog
        open={confirmingDelete !== null}
        title="Delete this rule?"
        description="Future payments won't be generated, but its generated history stays in your transactions."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(null)}
      />
    </div>
  );
}

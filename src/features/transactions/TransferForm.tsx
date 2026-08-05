import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { TransactionService } from "@/services/TransactionService";
import { AccountSelector } from "@/components/forms/AccountSelector";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/types/entities";

interface TransferFormProps {
  onSaved: (transaction: Transaction) => void;
}

export function TransferForm({ onSaved }: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(fromAccountId && toAccountId && amount && amount > 0);

  async function handleSave() {
    if (!canSave || !fromAccountId || !toAccountId || !amount) return;
    setSaving(true);
    setError(null);
    try {
      const transaction = await TransactionService.createTransfer({
        fromAccountId,
        toAccountId,
        amount,
        description: description.trim() || undefined,
        transactionDate: new Date().toISOString(),
      });
      onSaved(transaction);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save this transfer.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <CurrencyInput value={amount} onChange={setAmount} autoFocus />

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">From</span>
        <AccountSelector
          value={fromAccountId}
          onChange={setFromAccountId}
          excludeId={toAccountId ?? undefined}
          label="From account"
        />
      </div>

      <div
        className="flex justify-center text-text-tertiary"
        aria-hidden="true"
      >
        <ArrowDown className="size-16" />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">To</span>
        <AccountSelector
          value={toAccountId}
          onChange={setToAccountId}
          excludeId={fromAccountId ?? undefined}
          label="To account"
        />
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Note (optional)"
        aria-label="Description"
        className="min-h-touch rounded-md border border-border bg-surface-card px-16 text-body text-text-primary outline-none placeholder:text-text-tertiary"
      />

      {error && <p className="text-body-sm text-expense">{error}</p>}

      <Button
        variant="primary"
        size="lg"
        onClick={handleSave}
        disabled={!canSave}
        loading={saving}
      >
        Transfer
      </Button>
    </div>
  );
}

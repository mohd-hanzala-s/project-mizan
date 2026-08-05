import { useState } from "react";
import { LoanService } from "@/services/LoanService";
import type { Loan } from "@/types/entities";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { Button } from "@/components/ui/button";

interface PaymentFormProps {
  loan: Loan;
  onSaved: () => void;
  onCancel: () => void;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function PaymentForm({ loan, onSaved, onCancel }: PaymentFormProps) {
  const [paymentDate, setPaymentDate] = useState(today());
  const [amountPaid, setAmountPaid] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(paymentDate && amountPaid && amountPaid > 0);

  async function handleSave() {
    if (!canSave || !amountPaid) return;
    setSaving(true);
    setError(null);
    try {
      await LoanService.recordPayment(loan.id, {
        paymentDate,
        amountPaid,
        notes,
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not record this payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <p className="text-body-sm text-text-secondary">
        Recording a payment for{" "}
        <span className="font-medium text-text-primary">{loan.loanName}</span>{" "}
        reduces its outstanding balance and updates the payoff forecast.
      </p>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Payment date</span>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          aria-label="Payment date"
          autoFocus
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income"
        />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Amount paid</span>
        <CurrencyInput value={amountPaid} onChange={setAmountPaid} />
        <span className="text-caption text-text-tertiary">
          Outstanding balance is ₹{loan.currentBalance.toLocaleString("en-IN")}.
        </span>
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          Notes (optional)
        </span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Auto-debit, cash, UPI…"
          aria-label="Payment notes"
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
        />
      </div>

      {error && <p className="text-body-sm text-expense">{error}</p>}

      <div className="flex gap-8">
        <Button variant="tertiary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canSave}
          loading={saving}
          className="flex-1"
        >
          Record Payment
        </Button>
      </div>
    </div>
  );
}

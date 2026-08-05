import { useState } from "react";
import { LoanService } from "@/services/LoanService";
import type { Loan } from "@/types/entities";
import { CurrencyInput } from "@/components/forms/CurrencyInput";
import { Button } from "@/components/ui/button";

interface LoanFormProps {
  editing?: Loan;
  onSaved: () => void;
  onCancel: () => void;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LoanForm({ editing, onSaved, onCancel }: LoanFormProps) {
  const [loanName, setLoanName] = useState(editing?.loanName ?? "");
  const [lender, setLender] = useState(editing?.lender ?? "");
  const [originalAmount, setOriginalAmount] = useState<number | null>(
    editing?.originalAmount ?? null,
  );
  const [monthlyEMI, setMonthlyEMI] = useState<number | null>(
    editing?.monthlyEMI ?? null,
  );
  const [interestRate, setInterestRate] = useState<number | null>(
    editing?.interestRate ?? null,
  );
  const [startDate, setStartDate] = useState(editing?.startDate ?? today());
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [dueDay, setDueDay] = useState<number | null>(editing?.dueDay ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(
    loanName.trim() &&
    originalAmount &&
    originalAmount > 0 &&
    monthlyEMI &&
    monthlyEMI > 0 &&
    startDate &&
    dueDay &&
    dueDay >= 1 &&
    dueDay <= 31,
  );

  async function handleSave() {
    if (!canSave || !originalAmount || !monthlyEMI || !dueDay) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await LoanService.update(editing.id, {
          loanName,
          lender,
          monthlyEMI,
          interestRate,
          endDate: endDate || null,
          dueDay,
          notes,
        });
      } else {
        await LoanService.create({
          loanName,
          lender,
          originalAmount,
          monthlyEMI,
          interestRate,
          startDate,
          endDate: endDate || null,
          dueDay,
          notes,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this loan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Loan name</span>
        <input
          value={loanName}
          onChange={(e) => setLoanName(e.target.value)}
          placeholder="Home Loan, Car Loan…"
          aria-label="Loan name"
          autoFocus={!editing}
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
        />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          Lender (optional)
        </span>
        <input
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          placeholder="Bank or lender"
          aria-label="Lender"
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
        />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          Original amount
        </span>
        <CurrencyInput value={originalAmount} onChange={setOriginalAmount} />
        {editing && (
          <span className="text-caption text-text-tertiary">
            The original amount is fixed after creation; outstanding balance
            moves only through recorded payments.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Monthly EMI</span>
        <CurrencyInput value={monthlyEMI} onChange={setMonthlyEMI} />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          Interest rate (% p.a., optional)
        </span>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={interestRate ?? ""}
          onChange={(e) =>
            setInterestRate(
              e.target.value === "" ? null : Number(e.target.value),
            )
          }
          placeholder="Leave blank if interest isn't tracked"
          aria-label="Annual interest rate"
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
        />
      </div>

      <div className="grid grid-cols-2 gap-16">
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Started</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            disabled={Boolean(editing)}
            className="min-h-touch rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">
            Ends (optional)
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="min-h-touch rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income"
          />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          EMI due on day of month
        </span>
        <input
          type="number"
          min={1}
          max={31}
          value={dueDay ?? ""}
          onChange={(e) =>
            setDueDay(e.target.value === "" ? null : Number(e.target.value))
          }
          aria-label="EMI due day"
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income"
        />
        <span className="text-caption text-text-tertiary">
          For months with fewer days, the due date falls on the last day.
        </span>
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          aria-label="Notes"
          className="w-full rounded-md border border-border bg-surface-card px-12 py-8 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
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
          {editing ? "Save" : "Create Loan"}
        </Button>
      </div>
    </div>
  );
}

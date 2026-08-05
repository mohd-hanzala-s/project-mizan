import { cn } from "@/utils/cn";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  error?: boolean;
  label: string;
}

export function PinInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  error,
  label,
}: PinInputProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <label className="sr-only" htmlFor="pin-input">
        {label}
      </label>
      <input
        id="pin-input"
        type="password"
        inputMode="numeric"
        pattern="\d*"
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={length}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, length))
        }
        aria-invalid={error || undefined}
        className={cn(
          "h-48 w-[200px] rounded-md border bg-surface-card text-center text-h2 tracking-[0.5em] text-text-primary",
          "placeholder:tracking-normal placeholder:text-body placeholder:text-text-tertiary",
          error ? "border-expense" : "border-border",
        )}
        placeholder="Enter PIN"
      />
    </div>
  );
}

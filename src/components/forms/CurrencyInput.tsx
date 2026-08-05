import { cn } from '@/utils/cn'

interface CurrencyInputProps {
  value: number | null
  onChange: (value: number | null) => void
  autoFocus?: boolean
  className?: string
}

export function CurrencyInput({ value, onChange, autoFocus, className }: CurrencyInputProps) {
  return (
    <div className={cn('flex items-center gap-8', className)}>
      <span className="text-h1 text-text-tertiary" aria-hidden="true">
        ₹
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '')
          onChange(raw === '' ? null : Number(raw))
        }}
        placeholder="0"
        aria-label="Amount"
        className="w-full min-w-0 border-none bg-transparent text-h1 tabular-nums text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </div>
  )
}

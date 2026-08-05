import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search transactions',
}: SearchBarProps) {
  return (
    <div className="flex min-h-touch items-center gap-8 rounded-md border border-border bg-surface-card px-12">
      <Search className="size-16 shrink-0 text-text-tertiary" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent py-12 text-body text-text-primary outline-none placeholder:text-text-tertiary"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="shrink-0 text-text-tertiary hover:text-text-primary"
        >
          <X className="size-16" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

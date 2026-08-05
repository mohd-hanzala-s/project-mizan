import type { Category } from '@/types/entities'
import { cn } from '@/utils/cn'

export type TypeFilter = 'all' | 'expense' | 'income' | 'transfer'

interface FilterBarProps {
  typeFilter: TypeFilter
  onTypeFilterChange: (value: TypeFilter) => void
  categories: Category[]
  selectedCategoryIds: Set<string>
  onToggleCategory: (categoryId: string) => void
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

export function FilterBar({
  typeFilter,
  onTypeFilterChange,
  categories,
  selectedCategoryIds,
  onToggleCategory,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-8 overflow-x-auto">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={typeFilter === opt.value}
            onClick={() => onTypeFilterChange(opt.value)}
            className={cn(
              'min-h-touch shrink-0 rounded-full border px-16 text-body-sm font-medium transition-colors duration-fast',
              typeFilter === opt.value
                ? 'border-income bg-income-subtle text-income'
                : 'border-border bg-surface-card text-text-secondary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-8 overflow-x-auto">
        {categories.map((category) => {
          const selected = selectedCategoryIds.has(category.id)
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleCategory(category.id)}
              className={cn(
                'min-h-touch shrink-0 rounded-full border px-16 text-body-sm font-medium transition-colors duration-fast',
                selected
                  ? 'border-income bg-income-subtle text-income'
                  : 'border-border bg-surface-card text-text-secondary'
              )}
            >
              {category.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

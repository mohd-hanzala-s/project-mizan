import { Plus } from 'lucide-react'
import { cn } from '@/utils/cn'

interface FabProps {
  onClick: () => void
  className?: string
}

export function FloatingActionButton({ onClick, className }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add transaction"
      className={cn(
        'flex size-64 items-center justify-center rounded-full bg-income text-white shadow-floating',
        'transition-transform duration-fast hover:scale-105 active:scale-95',
        className
      )}
    >
      <Plus className="size-24" aria-hidden="true" />
    </button>
  )
}

import { Search, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/navigation'

interface TopAppBarProps {
  onScaffoldAction: (label: string) => void
}

export function TopAppBar({ onScaffoldAction }: TopAppBarProps) {
  const location = useLocation()
  const current = NAV_ITEMS.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  )

  return (
    <header
      className="flex h-64 shrink-0 items-center justify-between border-b border-border bg-surface-card px-16 md:px-24"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <h1 className="text-h3 text-text-primary">{current?.label ?? 'Nexus Finance'}</h1>
      <div className="flex items-center gap-8">
        <button
          type="button"
          aria-label="Search"
          onClick={() => onScaffoldAction('Global search arrives in a later phase')}
          className="flex size-40 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-neutral-800"
        >
          <Search className="size-24" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => onScaffoldAction('Notifications arrive in a later phase')}
          className="flex size-40 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-neutral-800"
        >
          <Bell className="size-24" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

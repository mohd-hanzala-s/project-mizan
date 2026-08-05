import { NavLink } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { NAV_ITEMS } from '@/constants/navigation'
import { cn } from '@/utils/cn'

interface BottomNavigationProps {
  onMoreClick: () => void
  moreActive: boolean
}

export function BottomNavigation({ onMoreClick, moreActive }: BottomNavigationProps) {
  const primaryItems = NAV_ITEMS.filter((item) => item.primary)

  return (
    <nav
      aria-label="Primary"
      className="flex items-stretch border-t border-border bg-surface-card portrait:flex landscape:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {primaryItems.map(({ id, label, path, icon: Icon }) => (
        <NavLink
          key={id}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-h-touch flex-1 flex-col items-center justify-center gap-4 py-8 text-caption font-medium',
              isActive ? 'text-income' : 'text-text-secondary'
            )
          }
        >
          <Icon className="size-24" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="More destinations"
        aria-expanded={moreActive}
        className={cn(
          'flex min-h-touch flex-1 flex-col items-center justify-center gap-4 py-8 text-caption font-medium',
          moreActive ? 'text-income' : 'text-text-secondary'
        )}
      >
        <MoreHorizontal className="size-24" aria-hidden="true" />
        More
      </button>
    </nav>
  )
}

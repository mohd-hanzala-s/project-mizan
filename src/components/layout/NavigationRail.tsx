import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/navigation'
import { cn } from '@/utils/cn'

export function NavigationRail() {
  return (
    <nav
      aria-label="Primary"
      className="hidden w-[88px] flex-col items-center gap-8 border-r border-border bg-surface-card py-24 landscape:flex md:w-[240px] md:items-stretch md:px-16"
    >
      <div className="mb-16 px-8 text-h3 text-text-primary md:px-8">
        <span className="md:hidden" aria-hidden="true">
          N
        </span>
        <span className="hidden md:inline">Nexus Finance</span>
      </div>
      {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => (
        <NavLink
          key={id}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-h-touch items-center gap-12 rounded-md px-12 text-body-sm font-medium transition-colors duration-fast',
              'md:w-full',
              isActive
                ? 'bg-income-subtle text-income'
                : 'text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-neutral-800'
            )
          }
        >
          <Icon className="size-24 shrink-0" aria-hidden="true" />
          <span className="hidden md:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

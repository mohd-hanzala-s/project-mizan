import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  CalendarDays,
  PiggyBank,
  Landmark,
  Repeat,
  FileBarChart,
  Lightbulb,
  Settings as SettingsIcon,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: LucideIcon
  /** Shown in the compact bottom nav (portrait). Desktop/landscape rail
   * always shows all 10 — §2 "Never hide primary destinations in nested
   * menus." Bottom nav surfaces the 5 most-used; the rest are reachable via
   * "More" so touch targets stay comfortable on a phone-width screen. */
  primary: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, primary: true },
  {
    id: 'transactions',
    label: 'Transactions',
    path: '/transactions',
    icon: Receipt,
    primary: true,
  },
  { id: 'accounts', label: 'Accounts', path: '/accounts', icon: Wallet, primary: true },
  { id: 'budgets', label: 'Budgets', path: '/budgets', icon: PiggyBank, primary: true },
  { id: 'loans', label: 'Loans', path: '/loans', icon: Landmark, primary: false },
  { id: 'recurring', label: 'Recurring', path: '/recurring', icon: Repeat, primary: false },
  { id: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarDays, primary: false },
  { id: 'reports', label: 'Reports', path: '/reports', icon: FileBarChart, primary: false },
  { id: 'insights', label: 'Insights', path: '/insights', icon: Lightbulb, primary: true },
  { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon, primary: false },
]

import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}

export function PlaceholderPage({ icon, title, description, phase }: PlaceholderPageProps) {
  return (
    <EmptyState icon={icon} title={title} description={`${description} Arrives in ${phase}.`} />
  )
}

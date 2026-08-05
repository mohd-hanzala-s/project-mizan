import type { CSSProperties } from 'react'
import { getIcon } from '@/utils/icon-registry'

interface DynamicIconProps {
  name: string
  className?: string
  style?: CSSProperties
}

export function DynamicIcon({ name, className, style }: DynamicIconProps) {
  const Icon = getIcon(name)
  // Icon always resolves to a stable, module-level Lucide component from
  // ICON_REGISTRY, never a newly-defined one, so there's no remount/
  // state-reset risk despite the shape this rule normally guards against.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon className={className} style={style} aria-hidden="true" />
}

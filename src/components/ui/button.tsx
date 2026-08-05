import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * §2/§3 Buttons: Primary/Secondary/Tertiary/Destructive/Icon/FAB — hierarchy
 * via size/emphasis, not color overload. Accent colors carry meaning
 * elsewhere in the app, so Primary uses a strong neutral ("ink"), not an
 * accent color.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-8 whitespace-nowrap rounded-md text-body font-medium ' +
    'transition-colors duration-fast disabled:pointer-events-none disabled:opacity-40 ' +
    'min-h-touch',
  {
    variants: {
      variant: {
        primary:
          'bg-neutral-900 text-neutral-50 hover:bg-neutral-800 active:bg-neutral-950 ' +
          'dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:active:bg-neutral-300',
        secondary:
          'bg-neutral-100 text-text-primary hover:bg-neutral-200 active:bg-neutral-300 ' +
          'dark:bg-neutral-800 dark:text-text-primary dark:hover:bg-neutral-700 dark:active:bg-neutral-600',
        tertiary:
          'bg-transparent text-text-primary hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700',
        destructive: 'bg-expense text-white hover:bg-expense/90 active:bg-expense/80',
        icon: 'bg-transparent text-text-secondary hover:bg-neutral-100 hover:text-text-primary active:bg-neutral-200 dark:hover:bg-neutral-800',
      },
      size: {
        default: 'h-48 px-16',
        sm: 'h-40 px-12 text-body-sm',
        lg: 'h-48 px-24 text-body-lg',
        icon: 'h-48 w-48',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="size-16 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

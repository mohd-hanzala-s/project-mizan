import { cn } from '@/utils/cn'

interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-96 z-50 flex justify-center transition-opacity duration-standard',
        message ? 'opacity-100' : 'opacity-0'
      )}
    >
      {message && (
        <div className="rounded-md bg-neutral-900 px-16 py-12 text-body-sm text-neutral-50 shadow-floating dark:bg-neutral-50 dark:text-neutral-900">
          {message}
        </div>
      )}
    </div>
  )
}

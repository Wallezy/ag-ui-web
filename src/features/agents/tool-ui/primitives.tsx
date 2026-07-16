import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const nativeControlClassName =
  'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

export const textareaClassName =
  'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

export function IconFrame({
  icon: Icon,
  tone = 'default',
}: {
  icon: LucideIcon
  tone?: 'default' | 'warning' | 'danger' | 'success'
}) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : tone === 'warning'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : tone === 'success'
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-primary/10 text-primary'
      )}
    >
      <Icon />
    </div>
  )
}

export function OaMetric({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className='bg-muted/40 min-w-0 rounded-md border px-3 py-2'>
      <div className='text-muted-foreground truncate text-xs'>{label}</div>
      <div className='truncate text-sm font-medium'>{value}</div>
      {description ? (
        <div className='text-muted-foreground mt-0.5 truncate text-xs'>
          {description}
        </div>
      ) : null}
    </div>
  )
}

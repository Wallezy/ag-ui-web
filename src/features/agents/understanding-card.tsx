import { useState, useSyncExternalStore } from 'react'
import { ChevronDown, FileCheck2, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { AgentTaskViewStore } from './oa-public-events.ts'
import { understandingCardModel } from './understanding-card-data.ts'

export function AgentUnderstandingCard({
  store,
}: {
  store: AgentTaskViewStore
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const model = understandingCardModel(state)
  const [open, setOpen] = useState(true)
  if (!model) return null

  return (
    <div className='border-border/80 bg-background shrink-0 border-b px-4 py-2.5 sm:px-6'>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className='bg-card mx-auto max-w-3xl rounded-md border px-3 py-2.5 shadow-xs'>
          <div className='flex min-w-0 items-center gap-2'>
            <ListChecks className='text-primary size-4 shrink-0' />
            <div className='min-w-0 flex-1'>
              <div className='text-xs font-semibold'>我的理解</div>
              <div className='text-muted-foreground truncate text-xs'>
                {model.operation}
              </div>
            </div>
            {model.writePreview ? (
              <span className='inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400'>
                <FileCheck2 className='size-3.5' />
                {model.waitingConfirmation ? '等待确认' : '仅生成预览'}
              </span>
            ) : null}
            <CollapsibleTrigger
              className='hover:bg-muted focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none'
              aria-label={open ? '收起我的理解' : '展开我的理解'}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  !open && '-rotate-90'
                )}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <dl className='mt-2 grid grid-cols-1 gap-x-5 gap-y-1.5 border-t pt-2 sm:grid-cols-2'>
              <div className='flex min-w-0 items-center justify-between gap-3 text-xs'>
                <dt className='text-muted-foreground'>操作</dt>
                <dd className='truncate font-medium'>{model.operation}</dd>
              </div>
              {model.fields.map((field) => (
                <div
                  key={field.name}
                  className='flex min-w-0 items-center justify-between gap-3 text-xs'
                >
                  <dt className='text-muted-foreground truncate'>
                    {field.label}
                  </dt>
                  <dd className='shrink-0 font-medium'>{field.status}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}

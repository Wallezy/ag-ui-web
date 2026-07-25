import { useState, useSyncExternalStore } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { AgentTaskRepair, AgentTaskViewStore } from './oa-public-events'
import { repairActionLabel } from './repair-timeline-data'

export function AgentRepairTimeline({ store }: { store: AgentTaskViewStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [open, setOpen] = useState(false)
  if (!state.v2Observed || !state.repairs.length) return null
  return (
    <div className='border-border/80 bg-background shrink-0 border-b px-4 py-2 sm:px-6'>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className='mx-auto max-w-3xl'
      >
        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex min-h-7 items-center gap-2 text-xs font-medium'>
          <RotateCcw className='size-3.5' />
          已自动修正 {state.repairs.length} 次
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              !open && '-rotate-90'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className='mt-1 grid gap-1.5 border-l pl-3'>
            {state.repairs.map((repair) => (
              <RepairEntry key={repair.eventId} repair={repair} />
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function RepairEntry({ repair }: { repair: AgentTaskRepair }) {
  return (
    <li className='text-xs'>
      <div className='font-medium'>{repairActionLabel(repair.action)}</div>
      <div className='text-muted-foreground'>{repair.displayMessage}</div>
    </li>
  )
}

import { useState, type ReactNode } from 'react'
import type { ReasoningMessagePartComponent } from '@assistant-ui/react'
import {
  CheckCircle2,
  Circle,
  ListChecks,
  LoaderCircle,
  MousePointerClick,
  ShieldCheck,
  XCircle,
  ChevronDown,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  parseExecutionProgress,
  recoveredExecutionAttempts,
  type ExecutionProgressUpdate,
  visibleExecutionProgress,
} from './execution-progress-data'

export const AgentExecutionProgress: ReasoningMessagePartComponent = ({
  text,
}) => {
  const parsed = parseExecutionProgress(text)
  const steps = visibleExecutionProgress(parsed)
  const recovered = recoveredExecutionAttempts(parsed)
  if (!steps.length) return null

  const isRunning = steps.some((step) => step.status === 'running')
  const isWaiting = steps.some(
    (step) =>
      step.status === 'waiting_user' || step.status === 'waiting_confirmation'
  )
  const hasFailed = steps.some((step) => step.status === 'failed')
  const label = isRunning
    ? '决策与执行中'
    : isWaiting
      ? '等待你的操作'
      : hasFailed
        ? '执行与决策未完成'
        : '执行与决策已结束'

  return (
    <section
      className='my-2'
      aria-label='智能体执行与决策轨迹'
      aria-live='polite'
    >
      <div className='text-muted-foreground flex min-h-6 items-center gap-2 text-xs font-medium'>
        {isRunning ? (
          <LoaderCircle className='size-3.5 animate-spin' />
        ) : (
          <ListChecks className='size-3.5' />
        )}
        <span>{label}</span>
      </div>
      <ol className='mt-1 grid gap-1'>
        {steps.map((step) => (
          <li
            key={step.stepId}
            className='grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2'
          >
            <ProgressIcon status={step.status} />
            <div className='min-w-0'>
              <div
                className={cn(
                  'text-xs leading-5 font-medium',
                  step.status === 'failed'
                    ? 'text-destructive'
                    : 'text-foreground'
                )}
              >
                {step.title}
              </div>
              {step.detail ? (
                <div className='text-muted-foreground text-xs leading-4'>
                  {step.detail}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {recovered.length ? <RecoveredAttempts attempts={recovered} /> : null}
    </section>
  )
}

function RecoveredAttempts({
  attempts,
}: {
  attempts: ReturnType<typeof recoveredExecutionAttempts>
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className='mt-1'>
      <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs'>
        <RotateCcw className='size-3.5' />
        已自动修正 {attempts.length} 次
        <ChevronDown
          className={cn('size-3.5 transition-transform', !open && '-rotate-90')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className='text-muted-foreground mt-1 grid gap-1 border-l pl-3 text-xs'>
          {attempts.map((attempt) => (
            <li key={attempt.stepId}>
              {attempt.title}
              {attempt.detail ? `：${attempt.detail}` : ''}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AgentExecutionProgressGroup({
  children,
}: {
  children?: ReactNode
}) {
  return <>{children}</>
}

function ProgressIcon({
  status,
}: {
  status: ExecutionProgressUpdate['status']
}) {
  if (status === 'running') {
    return <LoaderCircle className='text-primary mt-1 size-3.5 animate-spin' />
  }
  if (status === 'failed') {
    return <XCircle className='text-destructive mt-1 size-3.5' />
  }
  if (status === 'completed') {
    return <CheckCircle2 className='mt-1 size-3.5 text-emerald-600' />
  }
  if (status === 'waiting_user') {
    return <MousePointerClick className='mt-1 size-3.5 text-amber-600' />
  }
  if (status === 'waiting_confirmation') {
    return <ShieldCheck className='mt-1 size-3.5 text-amber-600' />
  }
  return <Circle className='text-muted-foreground mt-1 size-3.5' />
}

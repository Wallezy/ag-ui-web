import type { ReactNode } from 'react'
import type { ReasoningMessagePartComponent } from '@assistant-ui/react'
import {
  CheckCircle2,
  Circle,
  ListChecks,
  LoaderCircle,
  MousePointerClick,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  parseExecutionProgress,
  type ExecutionProgressUpdate,
  visibleExecutionProgress,
} from './execution-progress-data'

export const AgentExecutionProgress: ReasoningMessagePartComponent = ({
  text,
}) => {
  const steps = visibleExecutionProgress(parseExecutionProgress(text))
  if (!steps.length) return null

  const isRunning = steps.some((step) => step.status === 'running')
  const isWaiting = steps.some(
    (step) =>
      step.status === 'waiting_user' || step.status === 'waiting_confirmation'
  )
  const hasFailed = steps.some((step) => step.status === 'failed')
  const label = isRunning
    ? '正在处理'
    : isWaiting
      ? '等待你的操作'
      : hasFailed
        ? '处理未完成'
        : '已执行'

  return (
    <section className='my-2' aria-label='业务处理进展' aria-live='polite'>
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
              {step.detail && step.status !== 'completed' ? (
                <div className='text-muted-foreground text-xs leading-4'>
                  {step.detail}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
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

import type { ReactNode } from 'react'
import type { ReasoningMessagePartComponent } from '@assistant-ui/react'
import {
  CheckCircle2,
  Circle,
  ListChecks,
  LoaderCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  parseExecutionProgress,
  type ExecutionProgressUpdate,
} from './execution-progress-data'

export const AgentExecutionProgress: ReasoningMessagePartComponent = ({
  text,
}) => {
  const steps = parseExecutionProgress(text)
  if (!steps.length) return null

  const isRunning = steps.some((step) => step.status === 'running')

  return (
    <section
      className='border-border/80 my-2 border-s-2 ps-3'
      aria-label='执行进度'
      aria-live='polite'
    >
      <div className='text-muted-foreground flex min-h-6 items-center gap-2 text-xs font-medium'>
        {isRunning ? (
          <LoaderCircle className='size-3.5 animate-spin' />
        ) : (
          <ListChecks className='size-3.5' />
        )}
        <span>执行进度</span>
      </div>
      <ol className='mt-1 grid gap-1.5'>
        {steps.map((step) => (
          <li
            key={step.stepId}
            className='grid min-h-9 grid-cols-[16px_minmax(0,1fr)] items-start gap-2'
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
  return <Circle className='text-muted-foreground mt-1 size-3.5' />
}

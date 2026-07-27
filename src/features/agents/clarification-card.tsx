import { useEffect, useState, useSyncExternalStore } from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RuntimeHttpAgent } from './runtime-http-agent'

export function AgentClarificationCard({ agent }: { agent: RuntimeHttpAgent }) {
  const state = useSyncExternalStore(
    agent.taskViewStore.subscribe,
    agent.taskViewStore.getSnapshot
  )
  const thread = useThreadRuntime()
  const [submitting, setSubmitting] = useState(false)
  const [expired, setExpired] = useState(false)
  const pending = state.pending
  const questionId = pending?.questionId
  useEffect(() => {
    setSubmitting(false)
  }, [questionId, state.taskVersion])
  useEffect(() => {
    if (!pending?.expiresAt) {
      setExpired(false)
      return
    }
    const remaining = Date.parse(pending.expiresAt) - Date.now()
    if (remaining <= 0) {
      setExpired(true)
      return
    }
    setExpired(false)
    const timer = window.setTimeout(() => setExpired(true), remaining)
    return () => window.clearTimeout(timer)
  }, [pending?.expiresAt])

  if (!pending || !questionId || pending.questionKind === 'WRITE_CONFIRMATION')
    return null
  const disabled = expired || submitting

  const submit = (label: string, optionId: string) => {
    if (disabled || !state.taskId) return
    const queued = agent.queueTaskDelta({
      schemaVersion: 1,
      operation: 'SELECT_CANDIDATE',
      taskId: state.taskId,
      expectedVersion: state.taskVersion,
      questionId,
      optionId,
      freeText: '',
      slotName: '',
      oldValue: null,
      newValue: null,
    })
    if (!queued) return
    setSubmitting(true)
    thread.append(label)
  }

  return (
    <section
      className='border-border/80 bg-card fade-in slide-in-from-bottom-1 animate-in rounded-md border p-4 shadow-xs duration-150'
      aria-labelledby={`question-${questionId}`}
      aria-live='polite'
    >
      <div className='flex items-start gap-3'>
        <div className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md'>
          <CircleHelp className='size-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <h2 id={`question-${questionId}`} className='text-sm font-semibold'>
            {pending.questionKind === 'USER_ACTION' ? '下一步' : '请选择一项'}
          </h2>
          <p className='text-muted-foreground mt-1 text-sm leading-6'>
            {pending.displayMessage}
          </p>
        </div>
      </div>
      {expired ? (
        <p className='mt-3 text-sm text-amber-700 dark:text-amber-400'>
          这项选择已过期，请重新描述需求。
        </p>
      ) : null}
      {!expired && pending.options?.length ? (
        <div
          className='mt-4 flex flex-wrap gap-2'
          role='group'
          aria-label={pending.displayMessage}
        >
          {pending.options.map((option) => (
            <Button
              key={option.optionId}
              type='button'
              variant='outline'
              size='sm'
              className='min-h-9 rounded-md px-4'
              disabled={disabled}
              onClick={() => submit(option.label, option.optionId)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
      {submitting ? (
        <p className='text-muted-foreground mt-3 text-xs' role='status'>
          正在处理你的选择...
        </p>
      ) : null}
    </section>
  )
}

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import { CircleHelp, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RuntimeHttpAgent } from './runtime-http-agent'

export function AgentClarificationCard({ agent }: { agent: RuntimeHttpAgent }) {
  const state = useSyncExternalStore(
    agent.taskViewStore.subscribe,
    agent.taskViewStore.getSnapshot
  )
  const thread = useThreadRuntime()
  const [freeText, setFreeText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expired, setExpired] = useState(false)
  const pending = state.pending
  const questionId = pending?.questionId
  useEffect(() => {
    setSubmitting(false)
    setFreeText('')
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

  const submit = (label: string, optionId?: string, text?: string) => {
    if (disabled || !state.taskId) return
    const queued = agent.queueTaskDelta({
      schemaVersion: 1,
      operation: optionId ? 'SELECT_CANDIDATE' : 'ANSWER_CLARIFICATION',
      taskId: state.taskId,
      expectedVersion: state.taskVersion,
      questionId,
      optionId: optionId ?? '',
      freeText: text ?? '',
      slotName: '',
      oldValue: null,
      newValue: null,
    })
    if (!queued) return
    setSubmitting(true)
    thread.append(label)
  }

  const submitFreeText = (event: FormEvent) => {
    event.preventDefault()
    const text = freeText.trim()
    if (text) submit(text, undefined, text)
  }

  return (
    <div className='border-border/80 bg-background shrink-0 border-b px-4 py-2.5 sm:px-6'>
      <section
        className='bg-card mx-auto max-w-3xl rounded-md border px-3 py-3 shadow-xs'
        aria-labelledby={`question-${questionId}`}
      >
        <div className='flex items-start gap-2'>
          <CircleHelp className='text-primary mt-0.5 size-4 shrink-0' />
          <div className='min-w-0 flex-1'>
            <h2 id={`question-${questionId}`} className='text-sm font-semibold'>
              需要确认
            </h2>
            <p className='text-muted-foreground mt-0.5 text-sm'>
              {pending.displayMessage}
            </p>
          </div>
        </div>
        {expired ? (
          <p className='mt-2 text-xs text-amber-700 dark:text-amber-400'>
            这个问题已过期，请重新描述你的需求。
          </p>
        ) : null}
        {!expired && pending.options?.length ? (
          <div className='mt-3 flex flex-wrap gap-2'>
            {pending.options.map((option) => (
              <Button
                key={option.optionId}
                type='button'
                variant='outline'
                size='sm'
                disabled={disabled}
                onClick={() => submit(option.label, option.optionId)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
        {!expired && pending.allowFreeText ? (
          <form className='mt-3 flex gap-2' onSubmit={submitFreeText}>
            <Input
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              disabled={disabled}
              maxLength={500}
              aria-label='补充说明'
              placeholder='补充说明'
            />
            <Button
              type='submit'
              size='icon'
              disabled={disabled || !freeText.trim()}
              aria-label='提交补充说明'
            >
              <Send className='size-4' />
            </Button>
          </form>
        ) : null}
        {submitting ? (
          <p className='text-muted-foreground mt-2 text-xs' role='status'>
            正在提交回答...
          </p>
        ) : null}
      </section>
    </div>
  )
}

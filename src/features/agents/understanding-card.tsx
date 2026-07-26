import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import {
  ChevronDown,
  FileCheck2,
  ListChecks,
  Pencil,
  Send,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { AgentTaskViewStore } from './oa-public-events.ts'
import type { RuntimeHttpAgent } from './runtime-http-agent'
import { fieldCorrectionDelta } from './task-delta'
import { understandingCardModel } from './understanding-card-data.ts'

export function AgentUnderstandingCard({
  store,
  agent,
}: {
  store: AgentTaskViewStore
  agent: RuntimeHttpAgent
}) {
  const thread = useThreadRuntime()
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const model = understandingCardModel(state)
  const shouldExpand =
    state.terminal === 'waiting_user' ||
    state.terminal === 'failed' ||
    state.understanding?.status === 'WAITING_CONFIRMATION'
  const [open, setOpen] = useState(shouldExpand)
  useEffect(() => {
    setOpen(shouldExpand)
  }, [shouldExpand, state.taskId, state.taskVersion])
  if (!model) return null

  const summary = [
    model.operation,
    ...model.fields
      .filter((field) => field.valueSummary)
      .slice(0, 4)
      .map((field) => `${field.label} ${field.valueSummary}`),
  ].join(' · ')

  return (
    <div className='border-border/80 bg-background shrink-0 border-b px-4 py-2 sm:px-6'>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className='bg-card mx-auto w-full max-w-(--agent-shell-max-width) rounded-md border px-3 py-2 shadow-xs'>
          <div className='flex min-w-0 items-center gap-2'>
            <ListChecks className='text-primary size-4 shrink-0' />
            <span className='shrink-0 text-xs font-semibold'>我的理解</span>
            <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
              {summary}
            </span>
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
              {model.fields.map((field) => (
                <UnderstandingFieldEditor
                  key={field.name}
                  field={field}
                  taskId={state.taskId}
                  taskVersion={state.taskVersion}
                  submit={(delta, message) => {
                    if (!agent.queueTaskDelta(delta)) return false
                    thread.append(message)
                    return true
                  }}
                />
              ))}
            </dl>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}

function UnderstandingFieldEditor({
  field,
  taskId,
  taskVersion,
  submit,
}: {
  field: {
    name: string
    label: string
    valueSummary: string | null
    status: string
    editable: boolean
  }
  taskId: string | null
  taskVersion: number
  submit: (
    delta: NonNullable<ReturnType<typeof fieldCorrectionDelta>>,
    message: string
  ) => boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const send = (event: FormEvent, nextValue: string | null) => {
    event.preventDefault()
    if (!taskId) return
    const delta = fieldCorrectionDelta({
      taskId,
      expectedVersion: taskVersion,
      slotName: field.name,
      value: nextValue,
    })
    if (!delta) return
    const normalized = nextValue?.trim() ?? ''
    const message = normalized
      ? `将${field.label}修改为${normalized}`
      : `清除${field.label}条件`
    if (submit(delta, message)) {
      setEditing(false)
      setValue('')
    }
  }

  return (
    <div className='col-span-1 min-w-0 text-xs'>
      <div className='flex items-center justify-between gap-3'>
        <dt className='text-muted-foreground truncate'>{field.label}</dt>
        <dd className='flex min-w-0 shrink items-center gap-1 font-medium'>
          {field.valueSummary ? (
            <span className='max-w-40 truncate'>{field.valueSummary}</span>
          ) : null}
          <span className='text-muted-foreground shrink-0'>{field.status}</span>
          {field.editable ? (
            <button
              type='button'
              className='hover:bg-muted focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none'
              aria-label={`修改${field.label}`}
              onClick={() => {
                setValue(field.valueSummary ?? '')
                setEditing((current) => !current)
              }}
            >
              <Pencil className='size-3.5' />
            </button>
          ) : null}
        </dd>
      </div>
      {editing && field.editable ? (
        <form
          className='mt-1.5 flex gap-1.5'
          onSubmit={(event) => send(event, value)}
        >
          <input
            className='border-input bg-background h-8 min-w-0 flex-1 rounded-md border px-2 text-xs'
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={500}
            autoFocus
            aria-label={`${field.label}的新值`}
          />
          <Button
            type='submit'
            size='icon'
            className='size-8'
            disabled={!value.trim()}
            aria-label={`提交${field.label}修改`}
          >
            <Send className='size-3.5' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            aria-label={`清除${field.label}`}
            onClick={(event) => send(event, null)}
          >
            <X className='size-3.5' />
          </Button>
        </form>
      ) : null}
    </div>
  )
}

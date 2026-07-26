'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentType,
  type FC,
  type PropsWithChildren,
} from 'react'
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  type ReasoningMessagePartComponent,
  SuggestionPrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartComponent,
  useAui,
  useAuiState,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UserMessageAttachments } from '@/components/assistant-ui/attachment'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from '@/components/assistant-ui/reasoning'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from '@/components/assistant-ui/tool-group'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined
  Welcome?: ComponentType | undefined
  ToolFallback?: ToolCallMessagePartComponent | undefined
  Reasoning?: ReasoningMessagePartComponent | undefined
  ToolGroup?:
    ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined
  ReasoningGroup?:
    ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined
}

export type ThreadQuickAction = {
  title: string
  description?: string | undefined
  prompt: string
}

export type ThreadProps = {
  components?: ThreadComponents | undefined
  quickActions?: ThreadQuickAction[] | undefined
}

const EMPTY_COMPONENTS: ThreadComponents = {}

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS)

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading)

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  quickActions = [],
}) => {
  const isEmpty = useAuiState(isNewChatView)

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} quickActions={quickActions} />
    </ThreadComponentsContext.Provider>
  )
}

const ThreadRoot: FC<{
  isEmpty: boolean
  quickActions: ThreadQuickAction[]
}> = ({ isEmpty, quickActions }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext)
  const hasQuickActions = quickActions.length > 0

  return (
    <ThreadPrimitive.Root
      className='aui-root aui-thread-root bg-background @container flex h-full flex-col'
      style={{
        ['--thread-max-width' as string]: 'var(--agent-shell-max-width, 72rem)',
        ['--thread-reading-max-width' as string]:
          'var(--agent-reading-max-width, 56rem)',
        ['--composer-bg' as string]:
          'color-mix(in oklab, var(--color-muted) 30%, var(--color-background))',
        ['--composer-radius' as string]: '1.5rem',
        ['--composer-padding' as string]: '8px',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor='top'
        data-slot='aui_thread-viewport'
        className='relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth'
      >
        <div
          className={cn(
            'mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4',
            isEmpty && 'justify-center'
          )}
        >
          <AuiIf condition={isNewChatView}>
            <Welcome />
          </AuiIf>

          <div
            data-slot='aui_message-group'
            className='mx-auto mb-10 flex w-full max-w-(--thread-reading-max-width) flex-col gap-y-5 empty:hidden'
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              'aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6',
              !isEmpty &&
                'sticky bottom-0 mt-auto rounded-t-(--composer-radius)'
            )}
          >
            <ThreadScrollToBottom />
            <div className='mx-auto flex w-full max-w-(--thread-reading-max-width) flex-col gap-2'>
              <Composer />
              {hasQuickActions ? (
                <ThreadQuickActionsSlot actions={quickActions} />
              ) : (
                <AuiIf condition={isNewChatView}>
                  <ThreadSuggestionsSlot />
                </AuiIf>
              )}
            </div>
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext)
  const role = useAuiState((s) => s.message.role)
  const isEditing = useAuiState((s) => s.message.composer.isEditing)

  if (isEditing) return <EditComposer />
  if (role === 'user') return <UserMessage />
  return <AssistantMessageComponent />
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip='Scroll to bottom'
        variant='outline'
        className='aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible'
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

const ThreadWelcome: FC = () => {
  return (
    <div className='aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center'>
      <h1 className='aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200'>
        How can I help you today?
      </h1>
    </div>
  )
}

const ThreadSuggestions: FC = () => {
  return (
    <div className='aui-thread-welcome-suggestions flex w-full flex-wrap items-center justify-center gap-2 px-4'>
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  )
}

const ThreadSuggestionsSlot: FC = () => {
  const isComposerEmpty = useAuiState((s) => s.composer.isEmpty)

  return (
    <div
      className={cn(
        'aui-thread-welcome-suggestions-slot transition-opacity',
        !isComposerEmpty && 'pointer-events-none invisible opacity-0'
      )}
    >
      <ThreadSuggestions />
    </div>
  )
}

const ThreadQuickActionsSlot: FC<{ actions: ThreadQuickAction[] }> = ({
  actions,
}) => {
  const visible = useAuiState((s) => s.composer.isEmpty && !s.thread.isRunning)

  return (
    <div
      className={cn(
        'aui-thread-quick-actions-slot transition-opacity',
        !visible && 'pointer-events-none invisible opacity-0'
      )}
    >
      <div className='aui-thread-quick-actions flex w-full flex-wrap items-center justify-center gap-2 px-4'>
        {actions.map((action) => (
          <div
            key={action.prompt}
            className='aui-thread-quick-action-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200'
          >
            <ThreadPrimitive.Suggestion prompt={action.prompt} send asChild>
              <Button
                variant='ghost'
                className='aui-thread-quick-action text-foreground hover:bg-muted border-border/60 h-auto gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors'
              >
                <span className='aui-thread-quick-action-title'>
                  {action.title}
                </span>
                {action.description ? (
                  <span className='aui-thread-quick-action-description text-muted-foreground'>
                    {action.description}
                  </span>
                ) : null}
              </Button>
            </ThreadPrimitive.Suggestion>
          </div>
        ))}
      </div>
    </div>
  )
}

const ThreadSuggestionItem: FC = () => {
  return (
    <div className='aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200'>
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant='ghost'
          className='aui-thread-welcome-suggestion text-foreground hover:bg-muted border-border/60 h-auto gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors'
        >
          <SuggestionPrimitive.Title className='aui-thread-welcome-suggestion-text-1' />
          <SuggestionPrimitive.Description className='aui-thread-welcome-suggestion-text-2 empty:hidden' />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  )
}

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className='aui-composer-root relative flex w-full flex-col'>
      <div
        data-slot='aui_composer-shell'
        className='border-border/60 focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex min-h-13 w-full items-end gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
      >
        <ComposerPrimitive.Input
          placeholder='输入消息…'
          className='aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-base outline-none'
          rows={1}
          autoFocus
          enterKeyHint='send'
          aria-label='Message input'
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  )
}

const ComposerAction: FC = () => {
  return (
    <div className='aui-composer-action-wrapper relative flex items-center justify-end'>
      <div className='flex items-center gap-1.5'>
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate asChild>
              <TooltipIconButton
                tooltip='Voice input'
                side='bottom'
                type='button'
                variant='ghost'
                size='icon'
                className='aui-composer-dictate size-7 rounded-full'
                aria-label='Start voice input'
              >
                <MicIcon className='aui-composer-dictate-icon size-4' />
              </TooltipIconButton>
            </ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation asChild>
              <TooltipIconButton
                tooltip='Stop dictation'
                side='bottom'
                type='button'
                variant='ghost'
                size='icon'
                className='aui-composer-stop-dictation text-destructive size-7 rounded-full'
                aria-label='Stop voice input'
              >
                <SquareIcon className='aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current' />
              </TooltipIconButton>
            </ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip='Send message'
              side='bottom'
              type='button'
              variant='default'
              size='icon'
              className='aui-composer-send size-7 rounded-full'
              aria-label='Send message'
            >
              <ArrowUpIcon className='aui-composer-send-icon size-4.5' />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type='button'
              variant='default'
              size='icon'
              className='aui-composer-cancel size-7 rounded-full'
              aria-label='Stop generating'
            >
              <SquareIcon className='aui-composer-cancel-icon size-3.5 fill-current' />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  )
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className='aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200'>
        <ErrorPrimitive.Message className='aui-message-error-message line-clamp-2' />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

const MessageTimestamp: FC<{ className?: string }> = ({ className }) => {
  const createdAt = useAuiState((s) => s.message.createdAt)
  const date = toValidDate(createdAt)

  if (!date) return null

  return (
    <time
      className={cn(
        'text-muted-foreground mt-1 block text-xs tabular-nums',
        className
      )}
      dateTime={date.toISOString()}
      title={formatFullMessageDate(date)}
    >
      {formatMessageDate(date)}
    </time>
  )
}

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    Reasoning: ReasoningComponent = Reasoning,
    ReasoningGroup,
  } = useContext(ThreadComponentsContext)

  // reserves space for action bar and compensates with `-mb` for consistent msg spacing
  // keeps hovered action bar from shifting layout (autohide doesn't support absolute positioning well)
  // for pt-[n] use -mb-[n + 6] & min-h-[n + 6] to preserve compensation
  const ACTION_BAR_PT = 'pt-1.5'
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`

  return (
    <MessagePrimitive.Root
      data-slot='aui_assistant-message-root'
      data-role='assistant'
      className='fade-in slide-in-from-bottom-1 animate-in relative duration-150'
    >
      <div
        data-slot='aui_assistant-message-content'
        // [contain-intrinsic-size:auto_24px] fixes issue #4104, don't change without checking for regressions
        className='text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]'
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ['group-chainOfThought', 'group-reasoning'],
            'tool-call': ['group-chainOfThought', 'group-tool'],
            'standalone-tool-call': [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case 'group-chainOfThought':
                return <div data-slot='aui_chain-of-thought'>{children}</div>
              case 'group-tool':
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>
                }
                return (
                  <ToolGroupRoot variant='ghost'>
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === 'running'}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                )
              case 'group-reasoning': {
                if (ReasoningGroup) {
                  return (
                    <ReasoningGroup group={part}>{children}</ReasoningGroup>
                  )
                }
                const running = part.status.type === 'running'
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                )
              }
              case 'text':
                return <MarkdownText />
              case 'reasoning':
                return <ReasoningComponent {...part} />
              case 'tool-call':
                return part.toolUI ?? <ToolFallbackComponent {...part} />
              case 'data':
                return part.dataRendererUI
              case 'indicator':
                return (
                  <span
                    data-slot='aui_assistant-message-indicator'
                    className='animate-pulse font-sans'
                    aria-label='Assistant is working'
                  >
                    {'●'}
                  </span>
                )
              default:
                return null
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>
      <MessageTimestamp className='ms-2' />

      <div
        data-slot='aui_assistant-message-footer'
        className={cn('ms-2 flex items-center', ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide='not-last'
      className='aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200'
    >
      <MessageCopyButton />
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip='Refresh'>
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip='More'
            className='data-[state=open]:bg-accent'
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side='bottom'
          align='start'
          sideOffset={6}
          className='aui-action-bar-more-content bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm'
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className='aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none'>
              <DownloadIcon className='size-4' />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  )
}

const MessageCopyButton: FC = () => {
  const aui = useAui()
  const resetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null
  )
  const isCopied = useAuiState((s) => s.message.isCopied)
  const canCopy = useAuiState(
    (s) =>
      s.message.status?.type !== 'running' &&
      s.message.parts.some(
        (part) => part.type === 'text' && part.text.length > 0
      )
  )

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    const text = aui.message().getCopyText()
    if (!text) return

    try {
      await copyTextToClipboard(text)
      aui.message().setIsCopied(true)
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = window.setTimeout(() => {
        aui.message().setIsCopied(false)
        resetTimerRef.current = null
      }, 3000)
    } catch {
      // Keep the original icon when the browser blocks both copy mechanisms.
    }
  }

  return (
    <TooltipIconButton
      tooltip={isCopied ? 'Copied' : 'Copy'}
      disabled={!canCopy}
      onClick={() => void handleCopy()}
    >
      {isCopied ? (
        <CheckIcon className='animate-in zoom-in-50 fade-in duration-200 ease-out' />
      ) : (
        <CopyIcon className='animate-in zoom-in-75 fade-in duration-150' />
      )}
    </TooltipIconButton>
  )
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall through for HTTP deployments and browsers that deny the API.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.inset = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy command was rejected')
    }
  } finally {
    textarea.remove()
  }
}

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot='aui_user-message-root'
      className='fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_60px] [content-visibility:auto] [&:where(>*)]:col-start-2'
      data-role='user'
    >
      <UserMessageAttachments />

      <div className='aui-user-message-content-wrapper relative col-start-2 min-w-0'>
        <div className='aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden'>
          <MessagePrimitive.Parts />
        </div>
        <div className='aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full'>
          <UserActionBar />
        </div>
      </div>
      <MessageTimestamp className='justify-self-end pe-1' />

      <BranchPicker
        data-slot='aui_user-branch-picker'
        className='col-span-full col-start-1 row-start-3 -me-1 justify-end'
      />
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide='not-last'
      className='aui-user-action-bar-root flex flex-col items-end'
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip='Edit' className='aui-user-action-edit'>
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

const messageDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const fullMessageDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function toValidDate(value: unknown) {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatMessageDate(date: Date) {
  return messageDateFormatter.format(date)
}

function formatFullMessageDate(date: Date) {
  return fullMessageDateFormatter.format(date)
}

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot='aui_edit-composer-wrapper'
      className='flex flex-col px-2'
    >
      <ComposerPrimitive.Root className='aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[85%] flex-col rounded-(--composer-radius) border bg-(--composer-bg) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none'>
        <ComposerPrimitive.Input
          className='aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none'
          autoFocus
        />
        <div className='aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end'>
          <ComposerPrimitive.Cancel asChild>
            <Button
              variant='ghost'
              size='sm'
              className='h-8 rounded-full px-3.5'
            >
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size='sm' className='h-8 rounded-full px-3.5'>
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs',
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip='Previous'>
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className='aui-branch-picker-state font-medium'>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip='Next'>
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}

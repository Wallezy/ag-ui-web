import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HttpAgent } from '@ag-ui/client'
import {
  AssistantRuntimeProvider,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from '@assistant-ui/react'
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui'
import {
  Bot,
  CloudSun,
  Eraser,
  FolderKanban,
  Home,
  LoaderCircle,
  LogIn,
  MessageSquarePlus,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Thread,
  type ThreadQuickAction,
} from '@/components/assistant-ui/thread'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  AGUI_RUN_URL,
  agentById,
  apiFetch,
  checkOaSession,
  clearConversations,
  createConversation,
  deleteConversation,
  loadConversationMessages,
  listConversations,
  redirectToOaLogin,
  type AgentConfig,
} from './api'
import { AgentToolFallback, AgentToolGroup } from './tool-ui'
import type { AgentId, ConversationSummary } from './types'

type RefreshOptions = {
  keepSelection?: boolean
  quiet?: boolean
}

const ADMIN_PORTAL_URL = '/app/admin/#/portal'
const PROJECT_MANAGER_QUICK_ACTIONS: ThreadQuickAction[] = [
  {
    title: '填工时',
    prompt: '我要填工时',
  },
  {
    title: '写日报',
    prompt: '我要写日报',
  },
]

export function AgentWorkspace({
  initialAgentId,
}: {
  initialAgentId: AgentId
}) {
  const activeAgentId = initialAgentId
  const requiresOaSession = activeAgentId === 'projectManagerAgent'
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [isClearingConversations, setIsClearingConversations] = useState(false)
  const [deletingConversationIds, setDeletingConversationIds] = useState<
    Set<string>
  >(() => new Set())
  const [conversationError, setConversationError] = useState<string | null>(
    null
  )
  const [isCheckingOaSession, setIsCheckingOaSession] =
    useState(requiresOaSession)
  const [oaSessionMessage, setOaSessionMessage] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null
  )

  const activeAgent = useMemo(() => agentById(activeAgentId), [activeAgentId])

  const activeConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) => conversation.agentId === activeAgentId
      ),
    [activeAgentId, conversations]
  )

  const refreshConversations = useCallback(
    async ({ keepSelection = true, quiet = false }: RefreshOptions = {}) => {
      if (!quiet) setIsLoadingConversations(true)
      setConversationError(null)

      try {
        const next = await listConversations()
        const nextForAgent = next.filter(
          (conversation) => conversation.agentId === activeAgentId
        )

        setConversations(next)
        setActiveConversationId((current) => {
          if (
            keepSelection &&
            current &&
            nextForAgent.some((conversation) => conversation.id === current)
          ) {
            return current
          }
          return nextForAgent[0]?.id ?? null
        })
      } catch {
        setConversationError('会话加载失败')
      } finally {
        if (!quiet) setIsLoadingConversations(false)
      }
    },
    [activeAgentId]
  )

  useEffect(() => {
    if (!requiresOaSession) {
      setIsCheckingOaSession(false)
      setOaSessionMessage(null)
      return
    }

    let cancelled = false
    let redirectTimer: ReturnType<typeof window.setTimeout> | null = null

    setIsCheckingOaSession(true)
    setOaSessionMessage(null)

    void checkOaSession()
      .then((session) => {
        if (cancelled) return
        if (session.authenticated) return

        setOaSessionMessage(
          session.message || '当前未登录，正在跳转到现有系统登录页'
        )
        redirectTimer = window.setTimeout(() => redirectToOaLogin(), 500)
      })
      .catch(() => {
        if (cancelled) return
        setOaSessionMessage(
          '无法确认 OA 登录态，正在跳转到现有系统登录页'
        )
        redirectTimer = window.setTimeout(() => redirectToOaLogin(), 500)
      })
      .finally(() => {
        if (!cancelled) setIsCheckingOaSession(false)
      })

    return () => {
      cancelled = true
      if (redirectTimer) window.clearTimeout(redirectTimer)
    }
  }, [requiresOaSession])

  const canLoadConversations =
    !requiresOaSession || (!isCheckingOaSession && !oaSessionMessage)

  useEffect(() => {
    if (!canLoadConversations) return
    void refreshConversations({ keepSelection: true })
  }, [canLoadConversations, refreshConversations])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const handleCreateConversation = useCallback(async () => {
    if (requiresOaSession && (isCheckingOaSession || oaSessionMessage)) {
      redirectToOaLogin()
      return
    }

    setIsCreatingConversation(true)
    setConversationError(null)

    try {
      const created = await createConversation(activeAgent)
      setConversations((current) => [
        created,
        ...current.filter((conversation) => conversation.id !== created.id),
      ])
      setActiveConversationId(created.id)
    } catch {
      setConversationError('会话创建失败')
    } finally {
      setIsCreatingConversation(false)
    }
  }, [activeAgent, isCheckingOaSession, oaSessionMessage, requiresOaSession])

  const handleClearConversations = useCallback(async () => {
    if (conversations.length === 0 || isClearingConversations) return
    const confirmed = window.confirm(
      '确认清空当前用户的全部智能体历史会话吗？'
    )
    if (!confirmed) return

    setIsClearingConversations(true)
    setConversationError(null)

    try {
      await clearConversations()
      setConversations([])
      setActiveConversationId(null)
    } catch {
      setConversationError('历史会话清空失败')
    } finally {
      setIsClearingConversations(false)
    }
  }, [conversations.length, isClearingConversations])

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      if (deletingConversationIds.has(conversationId)) return
      const confirmed = window.confirm('确认删除这条历史会话吗？')
      if (!confirmed) return

      setDeletingConversationIds((current) => {
        const next = new Set(current)
        next.add(conversationId)
        return next
      })
      setConversationError(null)

      try {
        await deleteConversation(conversationId)
        await refreshConversations({ keepSelection: true, quiet: true })
      } catch {
        setConversationError('历史会话删除失败')
      } finally {
        setDeletingConversationIds((current) => {
          const next = new Set(current)
          next.delete(conversationId)
          return next
        })
      }
    },
    [deletingConversationIds, refreshConversations]
  )

  const handleConversationActivity = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshConversations({ keepSelection: true, quiet: true })
    }, 800)
  }, [refreshConversations])

  const handleGoPortal = useCallback(() => {
    window.location.assign(ADMIN_PORTAL_URL)
  }, [])

  return (
    <>
      <Header fixed className='border-b'>
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <div className='bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md'>
            <Bot />
          </div>
          <div className='min-w-0'>
            <h1 className='truncate text-sm font-semibold'>智能体工作台</h1>
            <p className='text-muted-foreground truncate text-xs'>
              {activeAgent.description}
            </p>
          </div>
        </div>
        <div className='ms-auto flex items-center gap-2'>
          <Button
            size='sm'
            variant='ghost'
            aria-label='返回主页面'
            onClick={handleGoPortal}
          >
            <Home data-icon='inline-start' />
            <span className='hidden sm:inline'>主页面</span>
          </Button>
          <ThemeSwitch />
        </div>
      </Header>

      <Main fixed fluid className='p-0'>
        <div className='grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[18rem_minmax(0,1fr)]'>
          <aside className='bg-sidebar/60 hidden min-h-0 border-e md:flex md:flex-col'>
            <div className='flex h-14 items-center gap-2 px-4'>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>历史会话</div>
                <div className='text-muted-foreground truncate text-xs'>
                  后端会话
                </div>
              </div>
              <Button
                size='icon'
                variant='ghost'
                aria-label='清空历史会话'
                disabled={
                  isClearingConversations ||
                  isLoadingConversations ||
                  conversations.length === 0
                }
                onClick={handleClearConversations}
              >
                {isClearingConversations ? (
                  <LoaderCircle className='animate-spin' />
                ) : (
                  <Eraser />
                )}
              </Button>
              <Button
                size='icon'
                variant='ghost'
                aria-label='新建会话'
                disabled={isCreatingConversation}
                onClick={handleCreateConversation}
              >
                {isCreatingConversation ? (
                  <LoaderCircle className='animate-spin' />
                ) : (
                  <MessageSquarePlus />
                )}
              </Button>
            </div>
            <Separator />
            <ScrollArea className='min-h-0 flex-1'>
              <div className='flex flex-col gap-1 p-2'>
                {conversationError ? (
                  <div className='text-destructive px-3 py-2 text-xs'>
                    {conversationError}
                  </div>
                ) : null}

                {isLoadingConversations ? (
                  <ConversationListLoading />
                ) : activeConversations.length > 0 ? (
                  activeConversations.map((conversation) => (
                    <ConversationButton
                      key={conversation.id}
                      conversation={conversation}
                      active={activeConversationId === conversation.id}
                      agent={agentById(conversation.agentId)}
                      deleting={deletingConversationIds.has(conversation.id)}
                      onClick={() => setActiveConversationId(conversation.id)}
                      onDelete={() =>
                        void handleDeleteConversation(conversation.id)
                      }
                    />
                  ))
                ) : (
                  <div className='text-muted-foreground px-3 py-8 text-center text-xs'>
                    暂无会话
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className='bg-background min-h-0'>
            {requiresOaSession && (isCheckingOaSession || oaSessionMessage) ? (
              <OaLoginRedirectState
                checking={isCheckingOaSession}
                message={oaSessionMessage}
              />
            ) : activeConversationId ? (
              <AgentThread
                key={`${activeAgent.id}:${activeConversationId}`}
                agent={activeAgent}
                conversationId={activeConversationId}
                onConversationActivity={handleConversationActivity}
                quickActions={
                  activeAgent.id === 'projectManagerAgent'
                    ? PROJECT_MANAGER_QUICK_ACTIONS
                    : undefined
                }
              />
            ) : (
              <EmptyConversationState
                agent={activeAgent}
                isCreating={isCreatingConversation}
                onCreate={handleCreateConversation}
              />
            )}
          </section>
        </div>
      </Main>
    </>
  )
}

function AgentThread({
  agent: activeAgent,
  conversationId,
  onConversationActivity,
  quickActions,
}: {
  agent: AgentConfig
  conversationId: string
  onConversationActivity: () => void
  quickActions?: ThreadQuickAction[]
}) {
  const agent = useMemo(
    () =>
      new HttpAgent({
        url: AGUI_RUN_URL,
        agentId: activeAgent.backendAgentId,
        threadId: conversationId,
        fetch: apiFetch,
        headers: {
          'x-agent-platform-agent-id': activeAgent.backendAgentId,
          'x-agent-platform-resource-id': 'local-user',
        },
      }),
    [activeAgent.backendAgentId, conversationId]
  )

  const history = useMemo<ThreadHistoryAdapter>(
    () => ({
      load: async () => {
        const messages = await loadConversationMessages(conversationId)
        return toMessageRepository(messages)
      },
      append: async () => {
        onConversationActivity()
      },
    }),
    [conversationId, onConversationActivity]
  )

  const runtime = useAgUiRuntime({
    agent,
    adapters: { history },
    onError: onConversationActivity,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        components={{
          ToolFallback: AgentToolFallback,
          ToolGroup: AgentToolGroup,
        }}
        quickActions={quickActions}
      />
    </AssistantRuntimeProvider>
  )
}

function ConversationButton({
  conversation,
  active,
  agent,
  deleting,
  onClick,
  onDelete,
}: {
  conversation: ConversationSummary
  active: boolean
  agent: AgentConfig
  deleting: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div className='group relative rounded-md'>
      <button
        type='button'
        onClick={onClick}
        className={cn(
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full flex-col gap-2 rounded-md py-2 ps-3 pe-10 text-start transition-colors',
          active && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <div className='flex w-full items-center gap-2'>
          <span className='truncate text-sm font-medium'>
            {conversation.title}
          </span>
          <span className='text-muted-foreground ms-auto shrink-0 text-xs'>
            {conversation.updatedAt}
          </span>
        </div>
        <div className='text-muted-foreground line-clamp-2 text-xs'>
          {conversation.lastMessage}
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary' className='w-fit'>
            {agent.badge}
          </Badge>
          {conversation.status === 'running' ? (
            <Badge variant='outline' className='w-fit'>
              运行中
            </Badge>
          ) : null}
        </div>
      </button>
      <Button
        type='button'
        size='icon'
        variant='ghost'
        aria-label='删除会话'
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        className={cn(
          'text-destructive hover:bg-destructive/10 hover:text-destructive absolute top-1 right-1 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
          deleting && 'opacity-100'
        )}
      >
        {deleting ? (
          <LoaderCircle className='animate-spin' />
        ) : (
          <Trash2 />
        )}
      </Button>
    </div>
  )
}

function ConversationListLoading() {
  return (
    <div className='flex flex-col gap-2 px-2 py-1'>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className='flex flex-col gap-2 rounded-md px-1 py-2'>
          <div className='bg-muted h-4 w-3/4 rounded' />
          <div className='bg-muted h-3 w-full rounded' />
          <div className='bg-muted h-3 w-1/2 rounded' />
        </div>
      ))}
    </div>
  )
}

function OaLoginRedirectState({
  checking,
  message,
}: {
  checking: boolean
  message: string | null
}) {
  return (
    <div className='flex h-full items-center justify-center p-6'>
      <div className='flex w-full max-w-md flex-col items-center gap-4 text-center'>
        <div className='bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg'>
          {checking ? (
            <LoaderCircle className='animate-spin' />
          ) : (
            <ShieldAlert />
          )}
        </div>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>需要登录 OA</h2>
          <p className='text-muted-foreground text-sm'>
            {message ||
              '正在确认当前登录态'}
          </p>
        </div>
        <Button onClick={() => redirectToOaLogin()}>
          <LogIn />
          去登录
        </Button>
      </div>
    </div>
  )
}

function EmptyConversationState({
  agent,
  isCreating,
  onCreate,
}: {
  agent: AgentConfig
  isCreating: boolean
  onCreate: () => void
}) {
  const Icon = agent.id === 'projectManagerAgent' ? FolderKanban : CloudSun

  return (
    <div className='flex h-full items-center justify-center p-6'>
      <div className='flex w-full max-w-md flex-col items-center gap-4 text-center'>
        <div className='bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg'>
          <Icon />
        </div>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold'>{agent.emptyTitle}</h2>
          <p className='text-muted-foreground text-sm'>{agent.emptyMessage}</p>
        </div>
        <Button onClick={onCreate} disabled={isCreating}>
          {isCreating ? (
            <LoaderCircle className='animate-spin' />
          ) : (
            <MessageSquarePlus />
          )}
          新建会话
        </Button>
      </div>
    </div>
  )
}

function toMessageRepository(messages: ThreadMessage[]) {
  return {
    headId: messages.at(-1)?.id ?? null,
    messages: messages.map((message, index) => ({
      message,
      parentId: index === 0 ? null : (messages[index - 1]?.id ?? null),
    })),
  }
}

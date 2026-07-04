import { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, Button, Space, Tag, Typography } from 'antd';
import { Bot, Cable, CircleStop, KeyRound, LogOut, Play, RadioTower } from 'lucide-react';
import type { A2UIActionPayload } from '../a2ui/renderer';
import type { ActionItem, AguiEvent, AssistantMessage, ChatMessage, ChatRuntimeState, DemoScenario } from '../agui/eventTypes';
import { aguiEventReducer, createInitialRuntimeState, reduceAguiEvents, withUserQuestion } from '../agui/eventReducer';
import { runAgentSse } from '../agui/aguiClient';
import { demoScenarios, getDemoById } from '../data/demos';
import { ChatShell } from '../components/layout/ChatShell';
import { ConversationSidebar, type ConversationSummary } from '../components/layout/ConversationSidebar';
import { MessageList } from '../components/chat/MessageList';
import { RightInspector } from '../components/layout/RightInspector';
import { SenderBar } from '../components/chat/SenderBar';
import { OaLoginModal, type OaLoginValues } from '../components/oa/OaLoginModal';
import { getOaSession, loginOa, logoutOa, type OaAuthContext, type OaSessionStatus } from '../oa/oaAuthClient';

const { Text, Title } = Typography;

const buildDemoState = (demo: DemoScenario) =>
  reduceAguiEvents(demo.events, withUserQuestion(createInitialRuntimeState(demo.id), demo.question));

type RunMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string };

const assistantText = (message: AssistantMessage) =>
  message.blocks
    .flatMap((block) => {
      if (block.type === 'markdown') return block.content;
      if (block.type === 'alert') return `${block.message}${block.description ? `：${block.description}` : ''}`;
      if (block.type === 'toolResult') return `工具 ${block.toolName} 返回：${JSON.stringify(block.result)}`;
      if (block.type === 'table') return `表格结果：${JSON.stringify(block.dataSource).slice(0, 1200)}`;
      return [];
    })
    .join('\n')
    .trim();

const buildRunMessages = (messages: ChatMessage[]) =>
  messages
    .flatMap<RunMessage>((message) => {
      if (message.role === 'user') {
        return [{ id: message.id, role: 'user' as const, content: message.content }];
      }
      if (message.role === 'assistant') {
        const content = assistantText(message);
        return content ? [{ id: message.id, role: 'assistant' as const, content }] : [];
      }
      return [];
    })
    .slice(-10);

const liveScenario: DemoScenario = {
  id: 'live-backend',
  title: '后端实时会话',
  group: '联调',
  question: '连接 agent-platform 后端。',
  description: '输入区已接入 /api/agent/ag-ui，后端 SSE 事件会实时驱动消息、工具、状态和业务卡片。',
  blockOrder: ['User Message', 'AG-UI SSE', 'Reducer', 'Hybrid Blocks', 'Inspector'],
  visualEffect: '后端返回什么 AG-UI 事件，前端就按协议增量渲染。',
  interactions: ['发送消息', '停止运行', '查看事件流'],
  recovery: '后端未启动或 SSE 失败时会渲染 RUN_ERROR，并保留用户消息。',
  events: [],
};

const isLiveConversationId = (id: string) => id.startsWith('thread-web-');
const AGENT_ID = 'oa-agent';

type PendingAgentRun = {
  content: string;
  conversationId: string;
  authContext: OaAuthContext;
  appendUserMessage: boolean;
  retryExistingUser?: boolean;
  loginEndpoint?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const textValue = (value: unknown, fallback: string) => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return String(value);
};

const optionalText = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return String(value);
};

const isOaLoginRequiredEvent = (event: AguiEvent) => event.type === 'CUSTOM' && event.name === 'oa.login_required';

const createLiveConversationState = (threadId: string): ChatRuntimeState => ({
  ...createInitialRuntimeState(threadId),
  messages: [
    {
      id: `system-welcome-${threadId}`,
      role: 'system',
      content: (
        <div className="system-welcome">
          <Bot size={18} />
          这是一个新的后端实时会话。输入任务后会调用 /api/agent/ag-ui 接收 SSE 事件流。
        </div>
      ),
    },
  ],
});

const deriveConversationTitle = (chatState: ChatRuntimeState, fallback: string) => {
  const firstUser = chatState.messages.find((message) => message.role === 'user');
  if (firstUser?.role === 'user' && firstUser.content.trim()) {
    return firstUser.content.trim().slice(0, 18);
  }
  return fallback;
};

export function ChatAssistantPage() {
  const { message: toast } = AntdApp.useApp();
  const [activeId, setActiveId] = useState(demoScenarios[0].id);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationStates, setConversationStates] = useState<Record<string, ChatRuntimeState>>({});
  const activeDemo = useMemo(
    () => (isLiveConversationId(activeId) ? liveScenario : getDemoById(activeId)),
    [activeId],
  );
  const [state, setState] = useState<ChatRuntimeState>(() => buildDemoState(activeDemo));
  const [input, setInput] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);
  const [isBackendRunning, setIsBackendRunning] = useState(false);
  const [oaLoginOpen, setOaLoginOpen] = useState(false);
  const [oaLoginLoading, setOaLoginLoading] = useState(false);
  const [oaLoginMessage, setOaLoginMessage] = useState('');
  const [oaAuthContext, setOaAuthContext] = useState<OaAuthContext>();
  const [oaSession, setOaSession] = useState<OaSessionStatus | null>(null);
  const [pendingRun, setPendingRun] = useState<PendingAgentRun | null>(null);
  const replayTimer = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef<PendingAgentRun | null>(null);
  const transcriptRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (replayTimer.current) window.clearInterval(replayTimer.current);
      abortRef.current?.abort();
      activeRunRef.current = null;
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({
      top: transcript.scrollHeight,
      behavior: isBackendRunning || isReplaying ? 'auto' : 'smooth',
    });
  }, [state.eventLog.length, state.messages.length, isBackendRunning, isReplaying]);

  useEffect(() => {
    if (!isLiveConversationId(activeId)) return;
    setConversationStates((prev) => ({
      ...prev,
      [activeId]: state,
    }));
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeId
          ? {
              ...conversation,
              title: deriveConversationTitle(state, conversation.title),
              status: state.status,
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );
  }, [activeId, state]);

  const stopReplay = () => {
    if (replayTimer.current) window.clearInterval(replayTimer.current);
    replayTimer.current = undefined;
    setIsReplaying(false);
  };

  const stopBackendRun = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeRunRef.current = null;
    setIsBackendRunning(false);
  };

  const buildOaAuthContext = (
    threadId: string,
    runId?: string,
    traceId?: string,
    override?: Partial<OaAuthContext>,
  ): OaAuthContext => ({
    agentId: textValue(override?.agentId, AGENT_ID),
    threadId: textValue(override?.threadId, threadId),
    userId: optionalText(override?.userId),
    tenantId: optionalText(override?.tenantId),
    sessionId: optionalText(override?.sessionId),
    runId: textValue(override?.runId, runId ?? ''),
    traceId: textValue(override?.traceId, traceId ?? ''),
  });

  const authContextFromLoginEvent = (event: AguiEvent, fallback: OaAuthContext) => {
    const value = asRecord(event.value);
    const eventContext = asRecord(value.authContext) as Partial<OaAuthContext>;
    return buildOaAuthContext(fallback.threadId ?? '', fallback.runId, fallback.traceId, eventContext);
  };

  useEffect(() => {
    if (!isLiveConversationId(activeId)) return;
    const authContext = buildOaAuthContext(activeId);
    setOaAuthContext(authContext);
    let cancelled = false;
    void getOaSession(authContext)
      .then((session) => {
        if (!cancelled) setOaSession(session);
      })
      .catch(() => {
        if (!cancelled) setOaSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const openOaLogin = (run: PendingAgentRun, message: string) => {
    setPendingRun(run);
    setOaAuthContext(run.authContext);
    setOaLoginMessage(message);
    setOaLoginOpen(true);
  };

  const queueOaLogin = (run: PendingAgentRun, message: string) => {
    setPendingRun(run);
    setOaAuthContext(run.authContext);
    setOaLoginMessage(message);
    setOaLoginOpen(false);
  };

  const trimAfterLastUserMessage = (messages: ChatMessage[]) => {
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user');
    return lastUserIndex >= 0 ? messages.slice(0, lastUserIndex + 1) : messages;
  };

  const replayDemo = (demo = activeDemo) => {
    stopReplay();
    stopBackendRun();
    if (!demo.events.length) return;
    setActiveId(demo.id);
    let index = 0;
    let next = withUserQuestion(createInitialRuntimeState(demo.id), demo.question);
    setState(next);
    setIsReplaying(true);
    replayTimer.current = window.setInterval(() => {
      const event = demo.events[index];
      if (!event) {
        stopReplay();
        return;
      }
      next = aguiEventReducer(next, event);
      setState(next);
      index += 1;
    }, 180);
  };

  const selectDemo = (id: string) => {
    stopReplay();
    stopBackendRun();
    if (isLiveConversationId(id)) {
      const saved = conversationStates[id];
      if (saved) {
        setActiveId(id);
        setState(saved);
      }
      return;
    }
    const demo = getDemoById(id);
    setActiveId(id);
    setState(buildDemoState(demo));
  };

  const newConversation = () => {
    stopReplay();
    stopBackendRun();
    const threadId = `thread-web-${Date.now()}`;
    const next = createLiveConversationState(threadId);
    setActiveId(threadId);
    setConversations((prev) => [
      {
        id: threadId,
        title: '新实时会话',
        status: 'idle',
        updatedAt: Date.now(),
      },
      ...prev,
    ]);
    setConversationStates((prev) => ({
      ...prev,
      [threadId]: next,
    }));
    setState(next);
  };

  const startBackendRun = async (
    value: string,
    options: {
      conversationId?: string;
      appendUserMessage?: boolean;
      retryExistingUser?: boolean;
      authContext?: OaAuthContext;
    } = {},
  ) => {
    const content = value.trim();
    if (!content) return;
    stopReplay();
    stopBackendRun();
    setPendingRun(null);
    setOaLoginMessage('');

    const conversationId = options.conversationId ?? (isLiveConversationId(activeId) ? activeId : `thread-web-${Date.now()}`);
    const runId = `run-web-${Date.now()}`;
    const traceId = `trace-web-${Date.now()}`;
    const authContext = options.authContext
      ? buildOaAuthContext(conversationId, runId, traceId, { ...options.authContext, runId, traceId })
      : buildOaAuthContext(conversationId, runId, traceId);

    const existingState = conversationId === activeId && isLiveConversationId(activeId)
      ? state
      : conversationStates[conversationId];
    const baseState = existingState ?? createLiveConversationState(conversationId);
    const appendUserMessage = options.appendUserMessage ?? true;
    const preparedMessages = options.retryExistingUser ? trimAfterLastUserMessage(baseState.messages) : [...baseState.messages];
    let clientMessageId = `user-web-${Date.now()}`;
    if (appendUserMessage) {
      preparedMessages.push({
        id: clientMessageId,
        role: 'user',
        content,
        createdAt: Date.now(),
      });
    } else {
      const lastUser = [...preparedMessages].reverse().find((message): message is Extract<ChatMessage, { role: 'user' }> => message.role === 'user');
      if (lastUser) {
        clientMessageId = lastUser.id;
      } else {
        preparedMessages.push({
          id: clientMessageId,
          role: 'user',
          content,
          createdAt: Date.now(),
        });
      }
    }

    const pendingAssistantMessageId = `assistant-pending-${runId}`;
    const threadId = baseState.threadId;
    const next: ChatRuntimeState = {
      ...baseState,
      threadId,
      runId,
      status: 'running',
      toolCalls: {},
      activities: {},
      eventLog: [],
      currentAssistantMessageId: pendingAssistantMessageId,
      messages: preparedMessages,
    };
    setActiveId(conversationId);
    setConversations((prev) => {
      const existed = prev.some((conversation) => conversation.id === conversationId);
      if (!existed) {
        return [
          {
            id: conversationId,
            title: content.slice(0, 18) || '新实时会话',
            status: 'running',
            updatedAt: Date.now(),
          },
          ...prev,
        ];
      }
      return prev.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title: deriveConversationTitle(next, conversation.title),
              status: 'running',
              updatedAt: Date.now(),
            }
          : conversation,
      );
    });
    setState(next);
    setConversationStates((prev) => ({
      ...prev,
      [conversationId]: next,
    }));
    setInput('');
    const controller = new AbortController();
    abortRef.current = controller;
    let pausedForOaLogin = false;
    activeRunRef.current = {
      content,
      conversationId,
      authContext,
      appendUserMessage: false,
      retryExistingUser: true,
    };
    setIsBackendRunning(true);
    try {
      await runAgentSse(
        {
          threadId,
          runId,
          messages: buildRunMessages(next.messages),
          state: next.sharedState,
          context: [
            {
              description: 'ag-ui-web 当前页面运行时上下文，包含多轮会话摘要和可复用业务状态',
              value: JSON.stringify({
                source: 'ag-ui-web',
                clientMessageId,
                activeDraft: (next.sharedState as { activeDraft?: unknown } | null)?.activeDraft,
                pendingConfirmation: (next.sharedState as { pendingConfirmation?: unknown } | null)?.pendingConfirmation,
              }),
            },
          ],
          forwardedProps: {
            agentId: AGENT_ID,
            traceId: authContext.traceId,
            threadId: authContext.threadId,
            runtime: 'ag-ui-web',
          },
        },
        (event) => {
          setState((prev) => aguiEventReducer(prev, event));
          if (isOaLoginRequiredEvent(event)) {
            pausedForOaLogin = true;
            const value = asRecord(event.value);
            const loginContext = authContextFromLoginEvent(event, authContext);
            queueOaLogin(
              {
                content,
                conversationId,
                authContext: loginContext,
                appendUserMessage: false,
                retryExistingUser: true,
                loginEndpoint: textValue(value.loginEndpoint, '/api/agent/oa/login'),
              },
              textValue(value.message, '当前会话没有 OA 令牌，请先登录'),
            );
            controller.abort();
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : '后端 SSE 调用失败';
        setState((prev) =>
          aguiEventReducer(prev, {
            type: 'RUN_ERROR',
            message,
            code: 'FRONTEND_SSE_ERROR',
            threadId,
            runId: prev.runId,
          }),
        );
        toast.error('后端连接失败，请确认 agent-platform 已启动在 8081');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      if (!pausedForOaLogin && activeRunRef.current?.authContext.runId === runId) {
        activeRunRef.current = null;
      }
      setIsBackendRunning(false);
    }
  };

  const submitMessage = (value: string) => {
    void startBackendRun(value);
  };

  const handleOaLogin = async (values: OaLoginValues) => {
    if (!pendingRun && !oaAuthContext) return;
    const authContext = pendingRun?.authContext ?? oaAuthContext;
    if (!authContext) return;
    setOaLoginLoading(true);
    try {
      const session = await loginOa(
        {
          ...values,
          authContext,
        },
        pendingRun?.loginEndpoint,
      );
      setOaSession(session);
      if (!session.authenticated) {
        toast.error(session.message || 'OA 登录失败');
        return;
      }
      toast.success('OA 登录成功');
      setOaLoginOpen(false);
      setOaLoginMessage('');
      const run = pendingRun;
      setPendingRun(null);
      if (run) {
        await startBackendRun(run.content, {
          conversationId: run.conversationId,
          appendUserMessage: run.appendUserMessage,
          retryExistingUser: run.retryExistingUser,
          authContext: run.authContext,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OA 登录失败';
      toast.error(message);
    } finally {
      setOaLoginLoading(false);
    }
  };

  const handleOaLogout = async () => {
    const authContext = oaAuthContext ?? (isLiveConversationId(activeId) ? buildOaAuthContext(activeId) : undefined);
    if (!authContext) return;
    try {
      const session = await logoutOa(authContext);
      setOaSession(session);
      setPendingRun(null);
      setOaLoginMessage('');
      toast.success('OA 登录态已退出');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OA 退出失败';
      toast.error(message);
    }
  };

  const cancelOaLogin = () => {
    setOaLoginOpen(false);
    toast.warning('已取消 OA 登录，可在消息卡片中再次点击授权');
  };

  const handleAssistantAction = (action: ActionItem) => {
    if (action.name !== 'oa.login') return;
    if (pendingRun) {
      openOaLogin(pendingRun, oaLoginMessage || '当前会话没有 OA 令牌，请先登录');
      return;
    }
    toast.warning('这次授权请求已过期，请重新发送当前任务');
  };

  const handleA2UIAction = (payload: A2UIActionPayload) => {
    const event: AguiEvent = {
      type: 'CUSTOM',
      name: 'a2ui.action',
      value: payload,
      timestamp: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      eventLog: [...prev.eventLog, event],
      messages: [
        ...prev.messages,
        {
          id: `system-action-${Date.now()}`,
          role: 'system',
          content: (
            <div className="action-echo">
              <RadioTower size={15} />
              已回传 A2UI Action：{payload.surfaceId}.{payload.actionName}
            </div>
          ),
        },
      ],
    }));
    toast.success(`已回传 ${payload.actionName}`);
  };

  return (
    <>
      <ChatShell
      sidebar={
        <ConversationSidebar
          conversations={conversations}
          demos={demoScenarios}
          activeId={activeId}
          onSelect={selectDemo}
          onNew={newConversation}
        />
      }
      main={
        <>
          <header className="chat-header">
            <div>
              <Space size={8} wrap>
                <Title level={4}>PC 聊天助手工作台</Title>
                <Tag color="green">Ant Design X</Tag>
                <Tag color="blue">AG-UI</Tag>
                <Tag color="orange">A2UI</Tag>
                <Tag color={oaSession?.authenticated ? 'green' : 'default'}>
                  {oaSession?.authenticated ? `OA ${oaSession.username ?? '已登录'}` : 'OA 未登录'}
                </Tag>
              </Space>
              <div className="header-subtitle">
                <Text type="secondary">{activeDemo.description}</Text>
              </div>
            </div>
            <Space>
              {oaSession?.authenticated ? (
                <Button icon={<LogOut size={15} />} onClick={handleOaLogout}>
                  退出 OA
                </Button>
              ) : null}
              {pendingRun?.conversationId === activeId ? (
                <Button icon={<KeyRound size={15} />} onClick={() => openOaLogin(pendingRun, oaLoginMessage || '当前会话没有 OA 令牌，请先登录')}>
                  授权 OA
                </Button>
              ) : null}
              <Button icon={<Cable size={15} />} onClick={newConversation}>
                后端实时会话
              </Button>
              {isReplaying ? (
                <Button danger icon={<CircleStop size={15} />} onClick={stopReplay}>
                  停止重放
                </Button>
              ) : isBackendRunning ? (
                <Button danger icon={<CircleStop size={15} />} onClick={stopBackendRun}>
                  停止后端运行
                </Button>
              ) : (
                <Button type="primary" icon={<Play size={15} />} disabled={!activeDemo.events.length} onClick={() => replayDemo()}>
                  重放事件流
                </Button>
              )}
            </Space>
          </header>
          <section className="chat-transcript" ref={transcriptRef}>
            <MessageList
              messages={state.messages}
              surfaces={state.surfaces}
              onA2UIAction={handleA2UIAction}
              onAssistantAction={handleAssistantAction}
            />
          </section>
          <SenderBar
            value={input}
            loading={isReplaying || isBackendRunning}
            onChange={setInput}
            onSubmit={submitMessage}
            onQuickSubmit={submitMessage}
            onCancel={isBackendRunning ? stopBackendRun : stopReplay}
          />
        </>
      }
      inspector={<RightInspector state={state} demo={activeDemo} onReplay={() => replayDemo()} />}
      />
      <OaLoginModal
        open={oaLoginOpen}
        loading={oaLoginLoading}
        authContext={oaAuthContext}
        session={oaSession}
        message={oaLoginMessage}
        onCancel={cancelOaLogin}
        onLogin={handleOaLogin}
      />
    </>
  );
}

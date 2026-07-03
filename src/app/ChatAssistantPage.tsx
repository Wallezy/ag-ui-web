import { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, Button, Space, Tag, Typography } from 'antd';
import { Bot, Cable, CircleStop, Play, RadioTower } from 'lucide-react';
import type { A2UIActionPayload } from '../a2ui/renderer';
import type { AguiEvent, AssistantMessage, ChatMessage, ChatRuntimeState, DemoScenario } from '../agui/eventTypes';
import { aguiEventReducer, createInitialRuntimeState, reduceAguiEvents, withUserQuestion } from '../agui/eventReducer';
import { runAgentSse } from '../agui/aguiClient';
import { demoScenarios, getDemoById } from '../data/demos';
import { ChatShell } from '../components/layout/ChatShell';
import { ConversationSidebar, type ConversationSummary } from '../components/layout/ConversationSidebar';
import { MessageList } from '../components/chat/MessageList';
import { RightInspector } from '../components/layout/RightInspector';
import { SenderBar } from '../components/chat/SenderBar';

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
  const replayTimer = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (replayTimer.current) window.clearInterval(replayTimer.current);
      abortRef.current?.abort();
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
    setIsBackendRunning(false);
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

  const submitMessage = async (value: string) => {
    const content = value.trim();
    if (!content) return;
    stopReplay();
    stopBackendRun();
    const currentIsLive = isLiveConversationId(activeId);
    const conversationId = currentIsLive ? activeId : `thread-web-${Date.now()}`;
    const baseState = currentIsLive ? state : createLiveConversationState(conversationId);
    if (!currentIsLive) {
      setActiveId(conversationId);
      setConversations((prev) => [
        {
          id: conversationId,
          title: content.slice(0, 18),
          status: 'running',
          updatedAt: Date.now(),
        },
        ...prev,
      ]);
    }
    const clientMessageId = `user-web-${Date.now()}`;
    const runId = `run-web-${Date.now()}`;
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
      messages: [
        ...baseState.messages,
        {
          id: clientMessageId,
          role: 'user',
          content,
          createdAt: Date.now(),
        },
      ],
    };
    setActiveId(conversationId);
    setState(next);
    setConversationStates((prev) => ({
      ...prev,
      [conversationId]: next,
    }));
    setInput('');
    const controller = new AbortController();
    abortRef.current = controller;
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
            agentId: 'oa-agent',
            sessionId: threadId,
            traceId: `trace-web-${Date.now()}`,
            runtime: 'ag-ui-web',
          },
        },
        (event) => {
          setState((prev) => aguiEventReducer(prev, event));
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
        toast.error('后端连接失败，请确认 agent-platform 已启动在 8080');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsBackendRunning(false);
    }
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
              </Space>
              <div className="header-subtitle">
                <Text type="secondary">{activeDemo.description}</Text>
              </div>
            </div>
            <Space>
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
            <MessageList messages={state.messages} surfaces={state.surfaces} onA2UIAction={handleA2UIAction} />
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
  );
}

import type {
  AguiEvent,
  A2UICommand,
  AssistantBlock,
  AssistantMessage,
  ChatMessage,
  ChatRuntimeState,
  SourceItem,
  ThoughtChainItem,
  ToolCallState,
} from './eventTypes';
import { getEventId, now } from './eventTypes';
import { applyA2UICommands, applyJsonPatch, setByPath } from '../a2ui/validators';

export const createInitialRuntimeState = (threadId = 'thread-demo'): ChatRuntimeState => ({
  threadId,
  status: 'idle',
  messages: [],
  toolCalls: {},
  activities: {},
  sharedState: {},
  surfaces: {},
  eventLog: [],
});

export const withUserQuestion = (state: ChatRuntimeState, question: string): ChatRuntimeState => ({
  ...state,
  messages: [
    {
      id: `user-${state.eventLog.length + 1}`,
      role: 'user',
      content: question,
      createdAt: now(),
    },
  ],
});

const messageIdOf = (event: AguiEvent) => getEventId(event, 'messageId', 'message_id');
const runIdOf = (event: AguiEvent) => getEventId(event, 'runId', 'run_id');
const threadIdOf = (event: AguiEvent) => getEventId(event, 'threadId', 'thread_id');
const toolCallIdOf = (event: AguiEvent) => getEventId(event, 'toolCallId', 'tool_call_id');
const toolCallNameOf = (event: AguiEvent) => getEventId(event, 'toolCallName', 'tool_call_name');
const parentMessageIdOf = (event: AguiEvent) => getEventId(event, 'parentMessageId', 'parent_message_id');
const activityIdOf = (event: AguiEvent) => getEventId(event, 'activityId', 'activity_id') ?? messageIdOf(event);
const activityTypeOf = (event: AguiEvent) => getEventId(event, 'activityType', 'activity_type');

const isAssistant = (message: ChatMessage): message is AssistantMessage => message.role === 'assistant';

const createAssistantMessage = (id: string, blocks: AssistantBlock[] = []): AssistantMessage => ({
  id,
  role: 'assistant',
  status: 'streaming',
  blocks,
  createdAt: now(),
});

const upsertAssistantMessage = (
  state: ChatRuntimeState,
  requestedId: string,
  updater: (message: AssistantMessage) => AssistantMessage,
): ChatRuntimeState => {
  let found = false;
  const messages = state.messages.map((message) => {
    if (isAssistant(message) && message.id === requestedId) {
      found = true;
      return updater(message);
    }
    return message;
  });
  if (!found) messages.push(updater(createAssistantMessage(requestedId)));
  return {
    ...state,
    messages,
    currentAssistantMessageId: requestedId,
  };
};

const mergePendingReasoningMessage = (state: ChatRuntimeState, targetId: string): ChatRuntimeState => {
  const last = state.messages[state.messages.length - 1];
  if (!last || !isAssistant(last) || last.id === targetId) return state;
  const onlyPreTextBlocks = last.blocks.every((block) =>
    ['reasoning', 'thoughtChain', 'toolResult', 'alert', 'table', 'a2ui', 'steps', 'timeline', 'taskList'].includes(block.type),
  );
  if (!onlyPreTextBlocks || last.status !== 'streaming') return state;
  return {
    ...state,
    messages: state.messages.map((message) => (message === last ? { ...last, id: targetId } : message)),
    currentAssistantMessageId: targetId,
  };
};

const appendMarkdown = (message: AssistantMessage, delta: string): AssistantMessage => {
  const blocks = [...message.blocks];
  const last = blocks[blocks.length - 1];
  if (last?.type === 'markdown') {
    blocks[blocks.length - 1] = { ...last, content: last.content + delta };
  } else {
    blocks.push({ type: 'markdown', content: delta });
  }
  return { ...message, blocks };
};

const appendOrUpdateReasoning = (message: AssistantMessage, delta: string, status: 'running' | 'done' | 'error') => {
  const blocks = [...message.blocks];
  const index = blocks.findIndex((block) => block.type === 'reasoning' && block.status !== 'done');
  if (index >= 0 && blocks[index].type === 'reasoning') {
    const existing = blocks[index];
    blocks[index] = { ...existing, content: existing.content + delta, status };
  } else {
    blocks.push({ type: 'reasoning', title: '执行摘要', content: delta, status });
  }
  return { ...message, blocks };
};

const appendThought = (message: AssistantMessage, item: ThoughtChainItem) => {
  const blocks = [...message.blocks];
  const index = blocks.findIndex((block) => block.type === 'thoughtChain');
  if (index >= 0 && blocks[index].type === 'thoughtChain') {
    const existing = blocks[index];
    const rest = existing.items.filter((old) => old.key !== item.key);
    blocks[index] = { ...existing, items: [...rest, item] };
  } else {
    blocks.push({ type: 'thoughtChain', items: [item] });
  }
  return { ...message, blocks };
};

const appendToolBlock = (message: AssistantMessage, toolCall: ToolCallState) => {
  const blocks = message.blocks.filter(
    (block) => !(block.type === 'toolResult' && block.toolName === toolCall.name && toolCall.status !== 'running'),
  );
  blocks.push({
    type: 'toolResult',
    toolName: toolCall.name,
    result: toolCall.result ?? { args: toolCall.args || '{}', toolCallId: toolCall.id },
    status: toolCall.status === 'error' ? 'error' : toolCall.status === 'success' ? 'success' : 'running',
  });
  return { ...message, blocks };
};

const appendBlock = (message: AssistantMessage, block: AssistantBlock) => ({
  ...message,
  blocks: [...message.blocks, block],
});

const parseToolResult = (content: unknown) => {
  if (typeof content !== 'string') return content;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
};

const deltaText = (event: AguiEvent) => (typeof event.delta === 'string' ? event.delta : '');

const customValue = <T,>(event: AguiEvent): T => (event.value ?? {}) as T;

const appendA2UIBlock = (state: ChatRuntimeState, messageId: string, surfaceId: string, commands?: A2UICommand[]) =>
  upsertAssistantMessage(state, messageId, (message) => {
    if (message.blocks.some((block) => block.type === 'a2ui' && block.surfaceId === surfaceId)) {
      return message;
    }
    return appendBlock(message, { type: 'a2ui', surfaceId, commands });
  });

const mapOACustomEvent = (state: ChatRuntimeState, event: AguiEvent): ChatRuntimeState => {
  const messageId = messageIdOf(event) ?? state.currentAssistantMessageId ?? `assistant-${state.eventLog.length}`;
  const value = customValue<Record<string, unknown>>(event);
  if (event.name === 'oa.task_card') {
    const items = ((value.items as Record<string, unknown>[] | undefined) ?? []).map((item, index) => ({
      key: item.id ?? item.workItemId ?? index,
      ...item,
    }));
    const next = upsertAssistantMessage(state, messageId, (message) =>
      appendBlock(message, {
        type: 'table',
        columns: [
          { title: '工作项', dataIndex: 'title' },
          { title: '状态', dataIndex: 'status' },
          { title: '项目', dataIndex: 'projectName' },
          { title: '截止', dataIndex: 'dueDate' },
        ],
        dataSource: items,
      }),
    );
    return {
      ...next,
      sharedState: setByPath(next.sharedState, '/lastWorkItems', items),
    };
  }
  if (event.name === 'oa.daily_report_draft') {
    const next = upsertAssistantMessage(state, messageId, (message) =>
      appendBlock(message, {
        type: 'alert',
        level: 'warning',
        message: '日报草稿等待确认',
        description: String(value.content ?? ''),
      }),
    );
    return {
      ...next,
      sharedState: setByPath(next.sharedState, '/activeDraft', {
        draftId: value.draftId,
        draftVersion: value.draftVersion ?? 1,
        content: value.content,
        requiresConfirmation: value.requiresConfirmation ?? true,
        confirmationAction: value.confirmationAction,
        idempotencyKey: value.idempotencyKey,
        mock: value.mock ?? true,
      }),
    };
  }
  if (event.name === 'oa.permission_required') {
    return {
      ...state,
      sharedState: setByPath(state.sharedState, '/pendingConfirmation', value),
    };
  }
  if (event.name === 'oa.daily_report_submit_result') {
    return upsertAssistantMessage(state, messageId, (message) =>
      appendBlock(message, {
        type: 'alert',
        level: 'success',
        message: String(value.message ?? '提交成功'),
        description: `审计编号：${String(value.auditId ?? '-')}`,
      }),
    );
  }
  if (event.name === 'oa.error_card') {
    return upsertAssistantMessage(state, messageId, (message) =>
      appendBlock(message, {
        type: 'alert',
        level: 'error',
        message: String(value.title ?? '业务错误'),
        description: String(value.message ?? ''),
      }),
    );
  }
  return state;
};

export const aguiEventReducer = (state: ChatRuntimeState, event: AguiEvent): ChatRuntimeState => {
  let next: ChatRuntimeState = {
    ...state,
    eventLog: [...state.eventLog, event],
  };

  switch (event.type) {
    case 'RUN_STARTED':
      return {
        ...next,
        status: 'running',
        runId: runIdOf(event) ?? next.runId,
        threadId: threadIdOf(event) ?? next.threadId,
      };
    case 'RUN_FINISHED':
      return {
        ...next,
        status: 'completed',
        messages: next.messages.map((message) =>
          isAssistant(message) ? { ...message, status: 'completed' } : message,
        ),
      };
    case 'RUN_ERROR': {
      const id = next.currentAssistantMessageId ?? messageIdOf(event) ?? `error-${next.eventLog.length}`;
      next = upsertAssistantMessage(next, id, (message) =>
        appendBlock(
          { ...message, status: 'error' },
          {
            type: 'alert',
            level: 'error',
            message: String(event.message ?? '运行失败'),
            description: event.code ? `错误码：${event.code}` : undefined,
          },
        ),
      );
      return { ...next, status: 'error' };
    }
    case 'TEXT_MESSAGE_START': {
      const id = messageIdOf(event) ?? `assistant-${next.eventLog.length}`;
      next = mergePendingReasoningMessage(next, id);
      return upsertAssistantMessage(next, id, (message) => ({ ...message, status: 'streaming' }));
    }
    case 'TEXT_MESSAGE_CONTENT':
    case 'TEXT_MESSAGE_CHUNK': {
      const id = messageIdOf(event) ?? next.currentAssistantMessageId ?? `assistant-${next.eventLog.length}`;
      return upsertAssistantMessage(next, id, (message) => appendMarkdown(message, deltaText(event)));
    }
    case 'TEXT_MESSAGE_END': {
      const id = messageIdOf(event) ?? next.currentAssistantMessageId ?? `assistant-${next.eventLog.length}`;
      return upsertAssistantMessage(next, id, (message) => ({ ...message, status: 'completed' }));
    }
    case 'REASONING_START':
    case 'REASONING_MESSAGE_START': {
      const id = next.currentAssistantMessageId ?? messageIdOf(event) ?? `reasoning-${next.eventLog.length}`;
      return upsertAssistantMessage(next, id, (message) => appendOrUpdateReasoning(message, '', 'running'));
    }
    case 'REASONING_MESSAGE_CONTENT': {
      const id = next.currentAssistantMessageId ?? messageIdOf(event) ?? `reasoning-${next.eventLog.length}`;
      return upsertAssistantMessage(next, id, (message) => appendOrUpdateReasoning(message, deltaText(event), 'running'));
    }
    case 'REASONING_MESSAGE_END':
    case 'REASONING_END': {
      const id = next.currentAssistantMessageId ?? messageIdOf(event) ?? `reasoning-${next.eventLog.length}`;
      return upsertAssistantMessage(next, id, (message) => ({
        ...message,
        blocks: message.blocks.map((block) => (block.type === 'reasoning' ? { ...block, status: 'done' } : block)),
      }));
    }
    case 'STEP_STARTED':
    case 'STEP_FINISHED': {
      const id = activityIdOf(event) ?? `activity-${next.eventLog.length}`;
      const title = String(event.message ?? event.name ?? event.type);
      const status = event.type === 'STEP_STARTED' ? 'running' : 'success';
      const activity = {
        id,
        title,
        status,
        type: 'STEP',
        content: event.value,
        updatedAt: now(),
      } as const;
      const messageId = next.currentAssistantMessageId ?? `activity-message-${next.eventLog.length}`;
      next = upsertAssistantMessage(next, messageId, (message) =>
        appendThought(message, {
          key: id,
          title,
          status,
          timestamp: event.timestamp,
        }),
      );
      return {
        ...next,
        activities: { ...next.activities, [id]: activity },
      };
    }
    case 'TOOL_CALL_START': {
      const toolCallId = toolCallIdOf(event) ?? `tool-${next.eventLog.length}`;
      const toolCall: ToolCallState = {
        id: toolCallId,
        name: toolCallNameOf(event) ?? 'unknown_tool',
        args: '',
        status: 'running',
        parentMessageId: parentMessageIdOf(event) ?? next.currentAssistantMessageId,
        riskLevel: String(event.riskLevel ?? ''),
        startedAt: now(),
      };
      next = {
        ...next,
        toolCalls: { ...next.toolCalls, [toolCallId]: toolCall },
      };
      const targetMessageId = toolCall.parentMessageId ?? next.currentAssistantMessageId ?? `assistant-${next.eventLog.length}`;
      return upsertAssistantMessage(next, targetMessageId, (message) => appendToolBlock(message, toolCall));
    }
    case 'TOOL_CALL_ARGS': {
      const toolCallId = toolCallIdOf(event) ?? '';
      const current = next.toolCalls[toolCallId];
      if (!current) return next;
      return {
        ...next,
        toolCalls: {
          ...next.toolCalls,
          [toolCallId]: {
            ...current,
            args: current.args + deltaText(event),
            status: 'args',
          },
        },
      };
    }
    case 'TOOL_CALL_END': {
      const toolCallId = toolCallIdOf(event) ?? '';
      const current = next.toolCalls[toolCallId];
      if (!current) return next;
      return {
        ...next,
        toolCalls: {
          ...next.toolCalls,
          [toolCallId]: {
            ...current,
            status: 'finished',
            finishedAt: now(),
          },
        },
      };
    }
    case 'TOOL_CALL_RESULT': {
      const toolCallId = toolCallIdOf(event) ?? '';
      const current = next.toolCalls[toolCallId] ?? {
        id: toolCallId,
        name: 'tool',
        args: '',
        status: 'finished',
      };
      const result = parseToolResult(event.content ?? event.result);
      const updated: ToolCallState = {
        ...current,
        result,
        status: 'success',
        finishedAt: now(),
      };
      next = {
        ...next,
        toolCalls: { ...next.toolCalls, [toolCallId]: updated },
      };
      const targetMessageId = parentMessageIdOf(event) ?? current.parentMessageId ?? next.currentAssistantMessageId ?? messageIdOf(event) ?? `assistant-${next.eventLog.length}`;
      return upsertAssistantMessage(next, targetMessageId, (message) => appendToolBlock(message, updated));
    }
    case 'STATE_SNAPSHOT':
      return {
        ...next,
        sharedState: event.snapshot ?? event.state ?? {},
      };
    case 'STATE_DELTA':
      return {
        ...next,
        sharedState: applyJsonPatch(next.sharedState, event.delta ?? event.value),
      };
    case 'MESSAGES_SNAPSHOT':
      return next;
    case 'ACTIVITY_SNAPSHOT':
    case 'ACTIVITY_DELTA': {
      const id = activityIdOf(event) ?? `activity-${next.eventLog.length}`;
      return {
        ...next,
        activities: {
          ...next.activities,
          [id]: {
            id,
            title: String(event.message ?? activityTypeOf(event) ?? '运行活动'),
            status: event.type === 'ACTIVITY_DELTA' ? 'running' : 'success',
            type: activityTypeOf(event),
            content: event.content ?? event.value,
            updatedAt: now(),
          },
        },
      };
    }
    case 'CUSTOM': {
      if (event.name === 'a2ui.commands') {
        const value = customValue<{ messageId?: string; message_id?: string; surfaceId: string; commands: A2UICommand[] }>(event);
        const commands = value.commands ?? [];
        const surfaceId = value.surfaceId;
        const messageId = value.messageId ?? value.message_id ?? next.currentAssistantMessageId ?? `assistant-${next.eventLog.length}`;
        next = {
          ...next,
          surfaces: applyA2UICommands(next.surfaces, commands),
        };
        return appendA2UIBlock(next, messageId, surfaceId, commands);
      }
      return mapOACustomEvent(next, event);
    }
    default:
      return next;
  }
};

export const reduceAguiEvents = (events: AguiEvent[], initialState?: ChatRuntimeState): ChatRuntimeState =>
  events.reduce(aguiEventReducer, initialState ?? createInitialRuntimeState());

export const collectSources = (messages: ChatMessage[]): SourceItem[] =>
  messages.flatMap((message) => {
    if (!isAssistant(message)) return [];
    return message.blocks.flatMap((block) => (block.type === 'sources' ? block.items : []));
  });

import type { ChatRuntimeState } from './eventTypes';

export type WorkflowStepStatus = 'wait' | 'process' | 'finish' | 'error';

export type WorkflowStep = {
  key: string;
  title: string;
  description: string;
  status: WorkflowStepStatus;
};

const hasEvent = (state: ChatRuntimeState, type: string) => state.eventLog.some((event) => event.type === type);
const eventCount = (state: ChatRuntimeState, type: string) => state.eventLog.filter((event) => event.type === type).length;

const finishOrWait = (finished: boolean, waitingForPrevious: boolean): WorkflowStepStatus => {
  if (finished) return 'finish';
  return waitingForPrevious ? 'wait' : 'process';
};

export function deriveWorkflowSteps(state: ChatRuntimeState): WorkflowStep[] {
  const toolCalls = Object.values(state.toolCalls);
  const toolNames = toolCalls.map((tool) => tool.name).filter(Boolean);
  const hasRunStarted = hasEvent(state, 'RUN_STARTED');
  const hasRunFinished = hasEvent(state, 'RUN_FINISHED');
  const hasRunError = hasEvent(state, 'RUN_ERROR') || state.status === 'error';
  const hasToolStart = hasEvent(state, 'TOOL_CALL_START');
  const hasToolArgs = hasEvent(state, 'TOOL_CALL_ARGS');
  const hasToolEnd = hasEvent(state, 'TOOL_CALL_END');
  const hasToolResult = hasEvent(state, 'TOOL_CALL_RESULT');
  const hasCustom = hasEvent(state, 'CUSTOM');
  const hasA2UI = Object.keys(state.surfaces).length > 0 || state.eventLog.some((event) => event.name === 'a2ui.commands');
  const hasTextStart = hasEvent(state, 'TEXT_MESSAGE_START');
  const hasTextContent = hasEvent(state, 'TEXT_MESSAGE_CONTENT') || hasEvent(state, 'TEXT_MESSAGE_CHUNK');
  const hasTextEnd = hasEvent(state, 'TEXT_MESSAGE_END');

  return [
    {
      key: 'run-started',
      title: '运行启动',
      description: hasRunStarted ? `Thread ${state.threadId} / Run ${state.runId ?? '-'}` : '等待 RUN_STARTED',
      status: hasRunError ? 'finish' : finishOrWait(hasRunStarted, false),
    },
    {
      key: 'tool-selected',
      title: '工具选择',
      description: hasToolStart ? `已选择 ${toolNames.join('、') || '工具'}，共 ${eventCount(state, 'TOOL_CALL_START')} 次调用` : '等待工具调用或直接文本回答',
      status: hasRunError && !hasToolStart ? 'error' : finishOrWait(hasToolStart, !hasRunStarted),
    },
    {
      key: 'tool-args',
      title: '参数流',
      description: hasToolArgs ? `已接收 ${eventCount(state, 'TOOL_CALL_ARGS')} 个参数片段` : '等待 TOOL_CALL_ARGS',
      status: hasToolEnd ? 'finish' : hasToolArgs ? 'process' : hasToolStart ? 'process' : 'wait',
    },
    {
      key: 'tool-result',
      title: '工具结果',
      description: hasToolResult ? `已返回 ${eventCount(state, 'TOOL_CALL_RESULT')} 个 Tool Result` : '等待业务工具返回',
      status: hasRunError && !hasToolResult ? 'error' : finishOrWait(hasToolResult, !hasToolEnd),
    },
    {
      key: 'business-ui',
      title: '业务卡片',
      description: hasCustom || hasA2UI ? `已处理 ${eventCount(state, 'CUSTOM')} 个 CUSTOM 事件，${Object.keys(state.surfaces).length} 个 A2UI Surface` : '等待 OA 卡片或 A2UI 命令',
      status: hasCustom || hasA2UI ? 'finish' : hasToolResult ? 'process' : 'wait',
    },
    {
      key: 'text-stream',
      title: '文本生成',
      description: hasTextContent ? `已接收 ${eventCount(state, 'TEXT_MESSAGE_CONTENT') + eventCount(state, 'TEXT_MESSAGE_CHUNK')} 个文本片段` : '等待 TEXT_MESSAGE_CONTENT',
      status: hasTextEnd ? 'finish' : hasTextStart || hasTextContent ? 'process' : 'wait',
    },
    {
      key: 'run-finished',
      title: '运行结束',
      description: hasRunError ? '运行异常，已进入错误恢复路径' : hasRunFinished ? 'RUN_FINISHED 已收到' : '等待 RUN_FINISHED',
      status: hasRunError ? 'error' : hasRunFinished || state.status === 'completed' ? 'finish' : hasRunStarted ? 'process' : 'wait',
    },
  ];
}

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
      title: '开始处理',
      description: hasRunStarted ? '已接收用户需求，正在组织处理流程。' : '等待开始处理',
      status: hasRunError ? 'finish' : finishOrWait(hasRunStarted, false),
    },
    {
      key: 'tool-selected',
      title: '业务数据准备',
      description: hasToolStart ? `已开始处理 OA 业务数据，共 ${eventCount(state, 'TOOL_CALL_START')} 次请求。` : '等待业务数据处理或直接回复',
      status: hasRunError && !hasToolStart ? 'error' : finishOrWait(hasToolStart, !hasRunStarted),
    },
    {
      key: 'tool-args',
      title: '参数准备',
      description: hasToolArgs ? '已完成业务请求参数整理。' : '等待参数准备',
      status: hasToolEnd ? 'finish' : hasToolArgs ? 'process' : hasToolStart ? 'process' : 'wait',
    },
    {
      key: 'tool-result',
      title: '业务数据响应',
      description: hasToolResult ? `已收到 ${eventCount(state, 'TOOL_CALL_RESULT')} 个业务响应。` : '等待 OA 业务响应',
      status: hasRunError && !hasToolResult ? 'error' : finishOrWait(hasToolResult, !hasToolEnd),
    },
    {
      key: 'business-ui',
      title: '业务卡片',
      description: hasCustom || hasA2UI ? '已生成授权、校验、草稿或结果卡片。' : '等待 OA 业务卡片',
      status: hasCustom || hasA2UI ? 'finish' : hasToolResult ? 'process' : 'wait',
    },
    {
      key: 'text-stream',
      title: '回复整理',
      description: hasTextContent ? '正在整理面向用户的回复。' : '等待回复整理',
      status: hasTextEnd ? 'finish' : hasTextStart || hasTextContent ? 'process' : 'wait',
    },
    {
      key: 'run-finished',
      title: '处理完成',
      description: hasRunError ? '处理异常，已进入错误恢复路径。' : hasRunFinished ? '本轮处理已结束。' : '等待处理完成',
      status: hasRunError ? 'error' : hasRunFinished || state.status === 'completed' ? 'finish' : hasRunStarted ? 'process' : 'wait',
    },
  ];
}

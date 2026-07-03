import type { ReactNode } from 'react';

export type MessageRole = 'user' | 'assistant' | 'system';
export type AssistantStatus = 'streaming' | 'completed' | 'error' | 'interrupted';

export type SourceItem = {
  id: string;
  title: string;
  url?: string;
  file?: string;
  chunk?: string;
  updatedAt?: string;
  score?: number;
};

export type ThoughtChainItem = {
  key: string;
  title: string;
  description?: string;
  status?: 'pending' | 'running' | 'success' | 'error';
  timestamp?: number;
};

export type FileItem = {
  id: string;
  name: string;
  type?: string;
  size?: string;
  status?: 'ready' | 'uploading' | 'done' | 'error';
};

export type ImageItem = {
  id: string;
  title?: string;
  url: string;
  description?: string;
};

export type ActionItem = {
  name: string;
  label: string;
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  danger?: boolean;
  context?: Record<string, unknown>;
};

export type AssistantBlock =
  | { type: 'markdown'; content: string }
  | { type: 'sources'; items: SourceItem[] }
  | { type: 'reasoning'; title?: string; content: string; status?: 'running' | 'done' | 'error' }
  | { type: 'thoughtChain'; items: ThoughtChainItem[] }
  | { type: 'a2ui'; surfaceId: string; commands?: A2UICommand[] }
  | { type: 'fileCard'; files: FileItem[] }
  | { type: 'imageCard'; images: ImageItem[] }
  | { type: 'table'; columns: unknown[]; dataSource: unknown[] }
  | { type: 'code'; language: string; code: string; fileName?: string }
  | { type: 'chart'; chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter'; data: unknown[] }
  | { type: 'timeline'; items: unknown[] }
  | { type: 'taskList'; items: unknown[] }
  | { type: 'statistic'; items: unknown[] }
  | { type: 'toolResult'; toolName: string; result: unknown; status?: 'running' | 'success' | 'error' }
  | { type: 'alert'; level: 'info' | 'success' | 'warning' | 'error'; message: string; description?: string }
  | { type: 'steps'; items: unknown[] }
  | { type: 'actions'; items: ActionItem[] };

export type UserMessage = {
  id: string;
  role: 'user';
  content: string;
  createdAt?: number;
};

export type SystemMessage = {
  id: string;
  role: 'system';
  content: ReactNode;
  createdAt?: number;
};

export type AssistantMessage = {
  id: string;
  role: 'assistant';
  status?: AssistantStatus;
  blocks: AssistantBlock[];
  createdAt?: number;
};

export type ChatMessage = UserMessage | AssistantMessage | SystemMessage;

export type BindingValue = { path: string };

export type A2UIComponentNode = {
  id: string;
  component: string;
  props?: Record<string, unknown>;
  children?: string[];
};

export type A2UICommand =
  | {
      version: 'v0.9';
      createSurface: {
        surfaceId: string;
        catalogId: string;
      };
    }
  | {
      version: 'v0.9';
      updateDataModel: {
        surfaceId: string;
        path: string;
        value: unknown;
      };
    }
  | {
      version: 'v0.9';
      updateComponents: {
        surfaceId: string;
        components: A2UIComponentNode[];
      };
    };

export type A2UISurfaceState = {
  surfaceId: string;
  catalogId?: string;
  dataModel: unknown;
  components: A2UIComponentNode[];
  validationErrors: string[];
  updatedAt?: number;
};

export type ToolCallState = {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  status: 'running' | 'args' | 'finished' | 'success' | 'error';
  parentMessageId?: string;
  riskLevel?: string;
  startedAt?: number;
  finishedAt?: number;
};

export type ActivityState = {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error';
  type?: string;
  content?: unknown;
  updatedAt?: number;
};

export type ChatRuntimeState = {
  threadId: string;
  runId?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  messages: ChatMessage[];
  toolCalls: Record<string, ToolCallState>;
  activities: Record<string, ActivityState>;
  sharedState: unknown;
  surfaces: Record<string, A2UISurfaceState>;
  eventLog: AguiEvent[];
  currentAssistantMessageId?: string;
};

export type AguiEvent = {
  type: string;
  name?: string;
  value?: unknown;
  timestamp?: number;
  threadId?: string;
  thread_id?: string;
  runId?: string;
  run_id?: string;
  sessionId?: string;
  session_id?: string;
  messageId?: string;
  message_id?: string;
  parentMessageId?: string;
  parent_message_id?: string;
  toolCallId?: string;
  tool_call_id?: string;
  toolCallName?: string;
  tool_call_name?: string;
  activityId?: string;
  activity_id?: string;
  activityType?: string;
  activity_type?: string;
  role?: string;
  delta?: unknown;
  content?: string;
  snapshot?: unknown;
  state?: unknown;
  code?: string;
  message?: string;
  result?: unknown;
  [key: string]: unknown;
};

export type DemoScenario = {
  id: string;
  title: string;
  group: string;
  question: string;
  description: string;
  blockOrder: string[];
  events: AguiEvent[];
  visualEffect: string;
  interactions: string[];
  recovery: string;
};

export const getEventId = (event: AguiEvent, camel: string, snake: string) =>
  (event[camel] ?? event[snake]) as string | undefined;

export const now = () => Date.now();

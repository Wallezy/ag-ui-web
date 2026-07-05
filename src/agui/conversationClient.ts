import type { AguiEvent } from './eventTypes';

export type CloudConversationOwner = {
  ownerId: string;
  tenantId: string;
  authenticated: boolean;
};

export type CloudConversationSummary = {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting_auth';
  updatedAt: number;
  ownerId?: string;
  tenantId?: string;
};

export type CloudStoredChatMessage = {
  id: string;
  role: 'user';
  content: string;
  createdAt: number;
};

export type CloudConversationTimelineEntry = {
  id: string;
  kind: 'user_message' | 'agui_event';
  timestamp?: string;
  message?: CloudStoredChatMessage;
  event?: AguiEvent;
};

export type CloudConversationDetail = {
  summary: CloudConversationSummary;
  timeline: CloudConversationTimelineEntry[];
};

export type CloudConversationListResponse = {
  owner: CloudConversationOwner;
  browserSessionId: string;
  conversations: CloudConversationSummary[];
};

export type CloudConversationCreateResponse = {
  owner: CloudConversationOwner;
  conversation: CloudConversationSummary;
};

const requestJson = async <T,>(endpoint: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const error = new Error(`Conversation API failed: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
};

export const isConversationApiUnavailable = (error: unknown) =>
  error instanceof Error && (error as Error & { status?: number }).status === 404;

export const listCloudConversations = (endpoint = '/api/agent/conversations') =>
  requestJson<CloudConversationListResponse>(endpoint);

export const createCloudConversation = (
  input: { conversationId: string; title?: string },
  endpoint = '/api/agent/conversations',
) =>
  requestJson<CloudConversationCreateResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getCloudConversation = (conversationId: string, endpoint = `/api/agent/conversations/${conversationId}`) =>
  requestJson<CloudConversationDetail>(endpoint);

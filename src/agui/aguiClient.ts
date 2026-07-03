import type { AguiEvent } from './eventTypes';

export type RunAgentInput = {
  threadId?: string;
  runId?: string;
  messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }>;
  state?: unknown;
  context?: Array<{ description: string; value: unknown }>;
  tools?: unknown[];
  forwardedProps?: Record<string, unknown>;
};

const parseSseChunk = (chunk: string): AguiEvent[] => {
  return chunk
    .split('\n\n')
    .map((frame) => frame.trim())
    .filter(Boolean)
    .flatMap((frame) => {
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) return [];
      try {
        return [JSON.parse(dataLines.join('\n')) as AguiEvent];
      } catch {
        return [{ type: 'RAW', content: dataLines.join('\n') }];
      }
    });
};

export async function runAgentSse(
  input: RunAgentInput,
  onEvent: (event: AguiEvent) => void,
  signal?: AbortSignal,
  endpoint = '/api/agent/ag-ui',
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Agent SSE failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    parseSseChunk(frames.join('\n\n')).forEach(onEvent);
  }
  parseSseChunk(buffer).forEach(onEvent);
}

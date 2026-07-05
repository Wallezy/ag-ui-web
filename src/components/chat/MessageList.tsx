import type { ReactNode } from 'react';
import { Avatar, Space, Tag, Typography } from 'antd';
import { Bubble } from '@ant-design/x';
import { Bot, UserRound } from 'lucide-react';
import type { A2UIActionPayload } from '../../a2ui/renderer';
import type { A2UISurfaceState, ActionItem, AssistantBlock, ChatMessage } from '../../agui/eventTypes';
import { HybridBlockRenderer } from './HybridBlockRenderer';

const { Text } = Typography;

const assistantStatusColor = {
  streaming: 'processing',
  completed: 'green',
  error: 'red',
  interrupted: 'orange',
} as const;

const assistantStatusText = {
  streaming: '运行中',
  completed: '已完成',
  error: '异常',
  interrupted: '待授权',
} as const;

const isInternalThoughtTitle = (title: string) =>
  title.startsWith('调用工具') || title.startsWith('工具结果') || title.includes('load_skill');

const userFacingBlocks = (blocks: AssistantBlock[]): AssistantBlock[] =>
  blocks.reduce<AssistantBlock[]>((visible, block) => {
    if (block.type === 'reasoning' || block.type === 'toolResult') return visible;
    if (block.type !== 'thoughtChain') {
      visible.push(block);
      return visible;
    }
    const items = block.items.filter((item) => !isInternalThoughtTitle(item.title));
    if (items.length) visible.push({ ...block, items });
    return visible;
  }, []);

type BubbleItem = {
  key: string;
  role: 'user' | 'system' | 'ai';
  header?: ReactNode;
  content: ReactNode;
};

export function MessageList({
  messages,
  surfaces,
  onA2UIAction,
  onAssistantAction,
}: {
  messages: ChatMessage[];
  surfaces: Record<string, A2UISurfaceState>;
  onA2UIAction?: (payload: A2UIActionPayload) => void;
  onAssistantAction?: (action: ActionItem) => void;
}) {
  const items = messages.reduce<BubbleItem[]>((visible, message) => {
    if (message.role === 'user') {
      visible.push({
        key: message.id,
        role: 'user',
        content: <div className="user-message">{message.content}</div>,
      });
      return visible;
    }
    if (message.role === 'system') {
      visible.push({
        key: message.id,
        role: 'system',
        content: message.content,
      });
      return visible;
    }
    const blocks = userFacingBlocks(message.blocks);
    if (!blocks.length) return visible;
    visible.push({
      key: message.id,
      role: 'ai',
      header: (
        <Space size={8}>
          <Text strong>融卡智能体</Text>
          <Tag color={assistantStatusColor[message.status ?? 'completed']}>
            {assistantStatusText[message.status ?? 'completed']}
          </Tag>
        </Space>
      ),
      content: (
        <div className="assistant-message">
          {blocks.map((block, index) => (
            <HybridBlockRenderer
              key={`${message.id}-${index}`}
              block={block}
              surfaces={surfaces}
              onA2UIAction={onA2UIAction}
              onAssistantAction={onAssistantAction}
            />
          ))}
        </div>
      ),
    });
    return visible;
  }, []);

  return (
    <Bubble.List
      className="message-list"
      autoScroll
      items={items}
      role={{
        ai: {
          placement: 'start',
          avatar: <Avatar icon={<Bot size={18} />} className="assistant-avatar" />,
          variant: 'borderless',
          rootClassName: 'bubble-ai',
        },
        user: {
          placement: 'end',
          avatar: <Avatar icon={<UserRound size={18} />} className="user-avatar" />,
          variant: 'filled',
          rootClassName: 'bubble-user',
        },
        system: {
          placement: 'start',
          variant: 'borderless',
        },
      }}
    />
  );
}

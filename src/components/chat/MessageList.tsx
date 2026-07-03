import { Avatar, Space, Tag, Typography } from 'antd';
import { Bubble } from '@ant-design/x';
import { Bot, UserRound } from 'lucide-react';
import type { A2UIActionPayload } from '../../a2ui/renderer';
import type { A2UISurfaceState, ChatMessage } from '../../agui/eventTypes';
import { HybridBlockRenderer } from './HybridBlockRenderer';

const { Text } = Typography;

export function MessageList({
  messages,
  surfaces,
  onA2UIAction,
}: {
  messages: ChatMessage[];
  surfaces: Record<string, A2UISurfaceState>;
  onA2UIAction?: (payload: A2UIActionPayload) => void;
}) {
  const items = messages.map((message) => {
    if (message.role === 'user') {
      return {
        key: message.id,
        role: 'user',
        content: <div className="user-message">{message.content}</div>,
      };
    }
    if (message.role === 'system') {
      return {
        key: message.id,
        role: 'system',
        content: message.content,
      };
    }
    return {
      key: message.id,
      role: 'ai',
      header: (
        <Space size={8}>
          <Text strong>融卡智能体</Text>
          <Tag color={message.status === 'error' ? 'red' : message.status === 'streaming' ? 'processing' : 'green'}>
            {message.status === 'streaming' ? '运行中' : message.status === 'error' ? '异常' : '已完成'}
          </Tag>
        </Space>
      ),
      content: (
        <div className="assistant-message">
          {message.blocks.map((block, index) => (
            <HybridBlockRenderer key={`${message.id}-${index}`} block={block} surfaces={surfaces} onA2UIAction={onA2UIAction} />
          ))}
        </div>
      ),
    };
  });

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

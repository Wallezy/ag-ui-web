import { Conversations } from '@ant-design/x';
import { Button, Input, Space, Tag, Typography } from 'antd';
import { MessageSquarePlus, Pin, Search, Trash2 } from 'lucide-react';
import type { DemoScenario } from '../../agui/eventTypes';

const { Text, Title } = Typography;

export type ConversationSummary = {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'waiting_auth';
  updatedAt: number;
};

const statusColor = {
  idle: 'default',
  running: 'processing',
  completed: 'success',
  error: 'error',
  waiting_auth: 'warning',
} as const;

const statusText = {
  idle: '新建',
  running: '运行中',
  completed: '完成',
  error: '失败',
  waiting_auth: '待授权',
} as const;

export function ConversationSidebar({
  conversations,
  demos,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: ConversationSummary[];
  demos: DemoScenario[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const items = [
    ...conversations.map((conversation) => ({
      key: conversation.id,
      label: (
        <div className="conversation-label">
          <span>{conversation.title}</span>
          <Tag color={statusColor[conversation.status]}>{statusText[conversation.status]}</Tag>
        </div>
      ),
      group: '实时会话',
    })),
    ...demos.map((demo) => ({
      key: demo.id,
      label: (
        <div className="conversation-label">
          <span>{demo.title}</span>
          <Tag>{demo.group}</Tag>
        </div>
      ),
      group: `Demo / ${demo.group}`,
    })),
  ];

  return (
    <aside className="conversation-sidebar">
      <div className="brand">
        <div className="brand-mark">RK</div>
        <div>
          <Title level={5}>融卡智能体</Title>
          <Text type="secondary">AG-UI Hybrid Workbench</Text>
        </div>
      </div>
      <Button type="primary" block icon={<MessageSquarePlus size={16} />} onClick={onNew}>
        新建会话
      </Button>
      <Input className="sidebar-search" prefix={<Search size={15} />} placeholder="搜索会话或 Demo" />
      <Conversations
        className="conversation-list"
        activeKey={activeId}
        groupable
        items={items}
        onActiveChange={(key) => onSelect(String(key))}
        menu={() => ({
          items: [
            { key: 'pin', label: '置顶', icon: <Pin size={14} /> },
            { key: 'delete', label: '删除', danger: true, icon: <Trash2 size={14} /> },
          ],
        })}
      />
      <div className="sidebar-footer">
        <Space size={6} wrap>
          <Tag color="processing">运行中</Tag>
          <Tag color="warning">待确认</Tag>
          <Tag color="success">已完成</Tag>
        </Space>
      </div>
    </aside>
  );
}

import { Alert, Space, Tag, Typography } from 'antd';
import { Activity } from 'lucide-react';

const { Text } = Typography;

export function ReasoningBlock({
  title = '执行摘要',
  content,
  status,
}: {
  title?: string;
  content: string;
  status?: 'running' | 'done' | 'error';
}) {
  return (
    <Alert
      className="reasoning-block"
      type={status === 'error' ? 'error' : 'info'}
      showIcon
      icon={<Activity size={16} />}
      title={
        <Space size={8}>
          <Text strong>{title}</Text>
          <Tag color={status === 'running' ? 'processing' : status === 'error' ? 'red' : 'green'}>
            {status === 'running' ? '进行中' : status === 'error' ? '异常' : '完成'}
          </Tag>
        </Space>
      }
      description={content || '正在整理可公开的执行摘要。'}
    />
  );
}

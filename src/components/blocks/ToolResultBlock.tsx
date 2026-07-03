import { Alert, Tag, Typography } from 'antd';
import { Wrench } from 'lucide-react';

const { Text } = Typography;

export function ToolResultBlock({
  toolName,
  result,
  status,
}: {
  toolName: string;
  result: unknown;
  status?: 'running' | 'success' | 'error';
}) {
  return (
    <Alert
      className="tool-result-block"
      type={status === 'error' ? 'error' : status === 'success' ? 'success' : 'info'}
      showIcon
      icon={<Wrench size={16} />}
      title={
        <span>
          <Text strong>{toolName}</Text> <Tag>{status === 'running' ? '调用中' : status === 'error' ? '失败' : '完成'}</Tag>
        </span>
      }
      description={<pre className="inline-json">{JSON.stringify(result, null, 2)}</pre>}
    />
  );
}

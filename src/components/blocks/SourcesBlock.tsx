import { List, Tag, Typography } from 'antd';
import { BookOpen } from 'lucide-react';
import type { SourceItem } from '../../agui/eventTypes';

const { Text } = Typography;

export function SourcesBlock({ items }: { items: SourceItem[] }) {
  return (
    <List
      className="sources-block"
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <BookOpen size={16} />
          <Text>{item.title}</Text>
          {item.chunk ? <Tag>{item.chunk}</Tag> : null}
          {item.score ? <Tag color="blue">{Math.round(item.score * 100)}%</Tag> : null}
        </List.Item>
      )}
    />
  );
}

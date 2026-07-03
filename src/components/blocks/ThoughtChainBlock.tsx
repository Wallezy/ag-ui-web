import { Timeline, Typography } from 'antd';
import type { ThoughtChainItem } from '../../agui/eventTypes';

const { Text } = Typography;

export function ThoughtChainBlock({ items }: { items: ThoughtChainItem[] }) {
  return (
    <Timeline
      className="thought-chain"
      items={items.map((item) => ({
        color: item.status === 'error' ? 'red' : item.status === 'running' ? 'blue' : 'green',
        children: (
          <div>
            <Text strong>{item.title}</Text>
            {item.description ? <div className="muted">{item.description}</div> : null}
          </div>
        ),
      }))}
    />
  );
}

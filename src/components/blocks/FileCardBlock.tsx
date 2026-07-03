import { List, Tag, Typography } from 'antd';
import { FileText } from 'lucide-react';
import type { FileItem } from '../../agui/eventTypes';

const { Text } = Typography;

export function FileCardBlock({ files }: { files: FileItem[] }) {
  return (
    <List
      className="file-list-block"
      size="small"
      dataSource={files}
      renderItem={(file) => (
        <List.Item>
          <FileText size={16} />
          <Text strong>{file.name}</Text>
          {file.type ? <Tag>{file.type}</Tag> : null}
          {file.size ? <Text type="secondary">{file.size}</Text> : null}
        </List.Item>
      )}
    />
  );
}

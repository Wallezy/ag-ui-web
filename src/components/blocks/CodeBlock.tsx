import { Typography } from 'antd';

const { Text } = Typography;

export function CodeBlock({ language, code, fileName }: { language: string; code: string; fileName?: string }) {
  return (
    <div className="code-card">
      <div className="code-card-header">
        <Text strong>{fileName ?? language}</Text>
        <Text type="secondary">{language}</Text>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

import { Alert, Button, Image, Space, Steps, Table, Tag, Timeline } from 'antd';
import { A2UISurfaceBlock, type A2UIActionPayload } from '../../a2ui/renderer';
import type { A2UISurfaceState, AssistantBlock } from '../../agui/eventTypes';
import { CodeBlock } from '../blocks/CodeBlock';
import { FileCardBlock } from '../blocks/FileCardBlock';
import { MarkdownBlock } from '../blocks/MarkdownBlock';
import { ReasoningBlock } from '../blocks/ReasoningBlock';
import { SourcesBlock } from '../blocks/SourcesBlock';
import { ThoughtChainBlock } from '../blocks/ThoughtChainBlock';
import { ToolResultBlock } from '../blocks/ToolResultBlock';

export function HybridBlockRenderer({
  block,
  surfaces,
  onA2UIAction,
}: {
  block: AssistantBlock;
  surfaces: Record<string, A2UISurfaceState>;
  onA2UIAction?: (payload: A2UIActionPayload) => void;
}) {
  switch (block.type) {
    case 'markdown':
      return <MarkdownBlock content={block.content} />;
    case 'sources':
      return <SourcesBlock items={block.items} />;
    case 'reasoning':
      return <ReasoningBlock title={block.title} content={block.content} status={block.status} />;
    case 'thoughtChain':
      return <ThoughtChainBlock items={block.items} />;
    case 'a2ui': {
      const surface = surfaces[block.surfaceId];
      return surface ? (
        <A2UISurfaceBlock surface={surface} onAction={onA2UIAction} />
      ) : (
        <Alert type="warning" showIcon title={`Surface ${block.surfaceId} 尚未创建`} />
      );
    }
    case 'fileCard':
      return <FileCardBlock files={block.files} />;
    case 'imageCard':
      return (
        <Image.PreviewGroup>
          <Space wrap>
            {block.images.map((image) => (
              <Image key={image.id} width={180} src={image.url} alt={image.title} />
            ))}
          </Space>
        </Image.PreviewGroup>
      );
    case 'table':
      return (
        <Table
          size="small"
          pagination={false}
          columns={block.columns as never[]}
          dataSource={(block.dataSource as Record<string, unknown>[]).map((item, index) => ({
            key: item.key ?? item.id ?? item.workItemId ?? index,
            ...item,
          })) as never[]}
        />
      );
    case 'code':
      return <CodeBlock language={block.language} code={block.code} fileName={block.fileName} />;
    case 'chart':
      return <Alert type="info" showIcon title={`${block.chartType} 图表`} description="图表 block 已预留，复杂图表推荐走 A2UI Chart surface。" />;
    case 'timeline':
      return <Timeline items={block.items as never[]} />;
    case 'taskList':
      return <Table size="small" pagination={false} dataSource={block.items as never[]} />;
    case 'statistic':
      return (
        <Space wrap>
          {block.items.map((item, index) => (
            <Tag key={index}>{JSON.stringify(item)}</Tag>
          ))}
        </Space>
      );
    case 'toolResult':
      return <ToolResultBlock toolName={block.toolName} result={block.result} status={block.status} />;
    case 'alert':
      return <Alert type={block.level} showIcon title={block.message} description={block.description} />;
    case 'steps':
      return <Steps size="small" orientation="vertical" items={block.items as never[]} />;
    case 'actions':
      return (
        <Space wrap>
          {block.items.map((item) => (
            <Button key={item.name} size="small" type={item.type} danger={item.danger}>
              {item.label}
            </Button>
          ))}
        </Space>
      );
    default:
      return null;
  }
}

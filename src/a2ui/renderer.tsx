import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { MenuProps, TableProps } from 'antd';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileCode2,
  FileText,
  FolderTree,
  ListChecks,
  Play,
  ShieldCheck,
} from 'lucide-react';
import type { A2UIComponentNode, A2UISurfaceState } from '../agui/eventTypes';
import { resolveValue } from './validators';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

export type A2UIActionPayload = {
  surfaceId: string;
  actionName: string;
  sourceComponentId: string;
  context?: Record<string, unknown>;
};

type RendererProps = {
  surface: A2UISurfaceState;
  onAction?: (payload: A2UIActionPayload) => void;
};

const palette = ['#247C73', '#2F6F9F', '#B56A18', '#7A5CFA', '#C44747', '#4E7D2F'];

const asRecord = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asString = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value));
const asNumber = (value: unknown, fallback = 0) => (typeof value === 'number' ? value : Number(value) || fallback);

const normalizeTableColumns = (columns: unknown[]): TableProps<Record<string, unknown>>['columns'] => {
  if (columns.length) return columns as TableProps<Record<string, unknown>>['columns'];
  return [];
};

const ActionButton = ({
  action,
  surfaceId,
  sourceComponentId,
  onAction,
}: {
  action: Record<string, unknown>;
  surfaceId: string;
  sourceComponentId: string;
  onAction?: (payload: A2UIActionPayload) => void;
}) => {
  const name = asString(action.name, 'action');
  return (
    <Button
      size="small"
      type={action.type === 'primary' ? 'primary' : 'default'}
      danger={Boolean(action.danger)}
      icon={name.includes('approve') ? <ShieldCheck size={15} /> : <Play size={15} />}
      onClick={() =>
        onAction?.({
          surfaceId,
          actionName: name,
          sourceComponentId,
          context: asRecord(action.context),
        })
      }
    >
      {asString(action.label, name)}
    </Button>
  );
};

const ChartFrame = ({ children }: { children: React.ReactNode }) => <div className="a2ui-chart">{children}</div>;

const renderLineChart = (props: Record<string, unknown>, type: 'line' | 'bar' | 'area' | 'mini') => {
  const data = asArray<Record<string, unknown>>(props.data);
  const xField = asString(props.xField, 'day');
  const yField = asString(props.yField, 'value');
  if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图表数据" />;
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#E6ECEA" />
      <XAxis dataKey={xField} tickLine={false} axisLine={false} />
      {type !== 'mini' && <YAxis tickLine={false} axisLine={false} />}
      <Tooltip />
    </>
  );
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height={type === 'mini' ? 92 : 220}>
        {type === 'bar' ? (
          <RechartsBarChart data={data}>
            {common}
            <Bar dataKey={yField} fill="#247C73" radius={[4, 4, 0, 0]} />
          </RechartsBarChart>
        ) : type === 'area' ? (
          <RechartsAreaChart data={data}>
            {common}
            <Area dataKey={yField} stroke="#247C73" fill="#DCEFEB" strokeWidth={2} />
          </RechartsAreaChart>
        ) : (
          <RechartsLineChart data={data}>
            {common}
            <Line type="monotone" dataKey={yField} stroke="#247C73" strokeWidth={2} dot={type !== 'mini'} />
          </RechartsLineChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  );
};

const renderPieChart = (props: Record<string, unknown>) => {
  const data = asArray<Record<string, unknown>>(props.data);
  const nameField = asString(props.nameField, 'name');
  const valueField = asString(props.valueField, 'value');
  if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无占比数据" />;
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height={220}>
        <RechartsPieChart>
          <Pie data={data} dataKey={valueField} nameKey={nameField} innerRadius={44} outerRadius={82} paddingAngle={3}>
            {data.map((_, index) => (
              <Cell key={index} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};

const toDescriptionItems = (items: unknown[]) =>
  items.map((item, index) => {
    const record = asRecord(item);
    return {
      key: asString(record.key ?? record.label ?? index),
      label: asString(record.label),
      children: asString(record.value),
    };
  });

export function A2UISurfaceBlock({ surface, onAction }: RendererProps) {
  const nodeMap = new Map(surface.components.map((node) => [node.id, node]));
  const renderNode = (node: A2UIComponentNode): React.ReactNode => {
    const props = resolveValue(node.props ?? {}, surface.dataModel) as Record<string, unknown>;
    const children = node.children?.map((childId) => {
      const child = nodeMap.get(childId);
      return child ? <div key={child.id}>{renderNode(child)}</div> : null;
    });

    switch (node.component) {
      case 'Card':
        return (
          <Card size="small" title={props.title as React.ReactNode} extra={props.extra as React.ReactNode}>
            {children}
          </Card>
        );
      case 'Section':
        return (
          <section className="a2ui-section">
            {props.title ? <Title level={5}>{props.title as React.ReactNode}</Title> : null}
            {children}
          </section>
        );
      case 'Row':
        return (
          <Row gutter={[12, 12]} align={(props.align as 'top') ?? 'top'}>
            {children}
          </Row>
        );
      case 'Col':
        return <Col span={asNumber(props.span, 24)}>{children}</Col>;
      case 'Space':
        return (
          <Space size={asNumber(props.size, 8)} wrap>
            {children}
          </Space>
        );
      case 'Divider':
        return <Divider plain>{props.text as React.ReactNode}</Divider>;
      case 'Tabs':
        return <Tabs size="small" items={asArray(props.items)} />;
      case 'Collapse':
        return <Collapse ghost size="small" items={asArray(props.items)} />;
      case 'Title':
        return <Title level={asNumber(props.level, 4) as 1 | 2 | 3 | 4 | 5}>{props.text as React.ReactNode}</Title>;
      case 'Text':
        return <Text type={props.type as 'secondary' | undefined}>{props.text as React.ReactNode}</Text>;
      case 'Paragraph':
        return <Paragraph>{props.text as React.ReactNode}</Paragraph>;
      case 'Tag':
        return <Tag color={asString(props.color, 'default')}>{props.text as React.ReactNode}</Tag>;
      case 'Badge':
        return <Badge status={(props.status as 'success') ?? 'processing'} text={props.text as React.ReactNode} />;
      case 'Alert':
        return (
          <Alert
            showIcon
            type={(props.type as 'info' | 'success' | 'warning' | 'error') ?? 'info'}
            title={props.message as React.ReactNode}
            description={props.description as React.ReactNode}
          />
        );
      case 'Statistic':
        return <Statistic title={props.title as React.ReactNode} value={props.value as string | number} suffix={props.suffix as React.ReactNode} />;
      case 'KPIGrid':
        return (
          <div className="a2ui-kpi-grid">
            {asArray<Record<string, unknown>>(props.items).map((item, index) => (
              <div className="a2ui-kpi" key={index}>
                <Text type="secondary">{item.label as React.ReactNode}</Text>
                <div className="a2ui-kpi-value">
                  {asString(item.value)}
                  {item.suffix ? <span>{asString(item.suffix)}</span> : null}
                </div>
                {item.delta ? (
                  <Tag color={item.trend === 'down' ? 'orange' : 'green'}>{asString(item.delta)}</Tag>
                ) : null}
              </div>
            ))}
          </div>
        );
      case 'Table':
        return (
          <Table
            size="small"
            pagination={false}
            columns={normalizeTableColumns(asArray(props.columns))}
            dataSource={asArray<Record<string, unknown>>(props.dataSource ?? props.data).map((item, index) => ({
              key: item.key ?? index,
              ...item,
            }))}
          />
        );
      case 'DescriptionList':
        return <Descriptions size="small" column={1} items={toDescriptionItems(asArray(props.items))} />;
      case 'Progress':
        return <Progress percent={asNumber(props.percent)} status={props.status as 'active' | 'exception' | 'success'} />;
      case 'LineChart':
        return renderLineChart(props, 'line');
      case 'BarChart':
        return renderLineChart(props, 'bar');
      case 'AreaChart':
        return renderLineChart(props, 'area');
      case 'MiniTrend':
        return renderLineChart(props, 'mini');
      case 'PieChart':
        return renderPieChart(props);
      case 'Steps':
        return <Steps size="small" orientation="vertical" current={asNumber(props.current, 0)} items={asArray(props.items)} />;
      case 'Timeline':
        return <Timeline items={asArray(props.items)} />;
      case 'TaskList':
        return (
          <List
            size="small"
            dataSource={asArray<Record<string, unknown>>(props.items)}
            renderItem={(item) => (
              <List.Item>
                <Checkbox checked={Boolean(item.done)} />
                <span className="a2ui-task-title">{item.title as React.ReactNode}</span>
                {item.owner ? <Tag>{asString(item.owner)}</Tag> : null}
              </List.Item>
            )}
          />
        );
      case 'ApprovalCard':
        return (
          <div className="a2ui-approval">
            <div className="a2ui-approval-header">
              <ShieldCheck size={18} />
              <Text strong>{props.title as React.ReactNode}</Text>
              <Tag color={props.status === 'pending' ? 'orange' : 'green'}>{asString(props.status, 'pending')}</Tag>
            </div>
            <Descriptions size="small" column={1} items={toDescriptionItems(asArray(props.fields))} />
            <Space wrap>
              {asArray<Record<string, unknown>>(props.actions).map((action) => (
                <ActionButton
                  key={asString(action.name)}
                  action={action}
                  surfaceId={surface.surfaceId}
                  sourceComponentId={node.id}
                  onAction={onAction}
                />
              ))}
            </Space>
          </div>
        );
      case 'ImagePreview':
        return <img className="a2ui-image" src={asString(props.url)} alt={asString(props.title, 'preview')} />;
      case 'FileCard':
        return (
          <div className="a2ui-file-card">
            <FileText size={18} />
            <div>
              <Text strong>{props.name as React.ReactNode}</Text>
              <div>
                <Text type="secondary">{props.description as React.ReactNode}</Text>
              </div>
            </div>
          </div>
        );
      case 'AttachmentList':
        return (
          <List
            size="small"
            dataSource={asArray<Record<string, unknown>>(props.items)}
            renderItem={(item) => (
              <List.Item>
                <FileText size={15} />
                <Text>{item.name as React.ReactNode}</Text>
                {item.size ? <Text type="secondary">{item.size as React.ReactNode}</Text> : null}
              </List.Item>
            )}
          />
        );
      case 'CodeBlock':
        return (
          <pre className="code-block">
            <code>{asString(props.code)}</code>
          </pre>
        );
      case 'DiffView':
        return (
          <div className="a2ui-diff">
            <div>
              <Text type="secondary">Before</Text>
              <pre>{asString(props.before)}</pre>
            </div>
            <div>
              <Text type="secondary">After</Text>
              <pre>{asString(props.after)}</pre>
            </div>
          </div>
        );
      case 'FileTree':
        return (
          <List
            size="small"
            dataSource={asArray<Record<string, unknown>>(props.files)}
            renderItem={(item) => (
              <List.Item>
                <FolderTree size={15} />
                <Text code>{item.path as React.ReactNode}</Text>
                {item.risk ? <Tag color={item.risk === 'high' ? 'red' : 'orange'}>{item.risk as React.ReactNode}</Tag> : null}
              </List.Item>
            )}
          />
        );
      case 'SourceList':
        return (
          <List
            size="small"
            dataSource={asArray<Record<string, unknown>>(props.items)}
            renderItem={(item) => (
              <List.Item>
                <FileText size={15} />
                <Text>{item.title as React.ReactNode}</Text>
                <Tag color="blue">{asString(item.score)}</Tag>
              </List.Item>
            )}
          />
        );
      case 'KnowledgeCard':
        return (
          <div className="a2ui-knowledge">
            <CheckCircle2 size={18} />
            <Paragraph>{props.summary as React.ReactNode}</Paragraph>
          </div>
        );
      case 'CitationCard':
        return (
          <Alert
            type="info"
            showIcon
            title={props.title as React.ReactNode}
            description={props.chunk as React.ReactNode}
          />
        );
      case 'Form':
        return (
          <Form layout="vertical" size="small" className="a2ui-form">
            {props.title ? <Title level={5}>{props.title as React.ReactNode}</Title> : null}
            {children}
          </Form>
        );
      case 'Input':
        return (
          <Form.Item label={props.label as React.ReactNode} name={asString(props.path ?? node.id).replaceAll('/', '.')} required={Boolean(props.required)}>
            <Input placeholder={asString(props.placeholder)} defaultValue={props.value as string} />
          </Form.Item>
        );
      case 'Select':
        return (
          <Form.Item label={props.label as React.ReactNode} name={asString(props.path ?? node.id).replaceAll('/', '.')} required={Boolean(props.required)}>
            <Select options={asArray<string>(props.options).map((option) => ({ label: option, value: option }))} placeholder={asString(props.placeholder)} />
          </Form.Item>
        );
      case 'DatePicker':
        return (
          <Form.Item label={props.label as React.ReactNode} name={asString(props.path ?? node.id).replaceAll('/', '.')} required={Boolean(props.required)}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'Checkbox':
        return <Checkbox>{props.label as React.ReactNode}</Checkbox>;
      case 'Radio':
        return <Radio.Group options={asArray<string>(props.options).map((option) => ({ label: option, value: option }))} />;
      case 'TextArea':
        return (
          <Form.Item label={props.label as React.ReactNode} name={asString(props.path ?? node.id).replaceAll('/', '.')} required={Boolean(props.required)}>
            <TextArea rows={3} placeholder={asString(props.placeholder)} />
          </Form.Item>
        );
      case 'SubmitButton':
        return (
          <Button
            type="primary"
            size="small"
            icon={<Play size={15} />}
            onClick={() =>
              onAction?.({
                surfaceId: surface.surfaceId,
                actionName: asString(props.action, 'submit'),
                sourceComponentId: node.id,
              })
            }
          >
            {asString(props.label, '提交')}
          </Button>
        );
      case 'Button':
        return (
          <ActionButton
            action={props}
            surfaceId={surface.surfaceId}
            sourceComponentId={node.id}
            onAction={onAction}
          />
        );
      case 'ButtonGroup':
        return (
          <Space wrap>
            {asArray<Record<string, unknown>>(props.actions).map((action) => (
              <ActionButton
                key={asString(action.name)}
                action={action}
                surfaceId={surface.surfaceId}
                sourceComponentId={node.id}
                onAction={onAction}
              />
            ))}
          </Space>
        );
      case 'DropdownAction': {
        const items: MenuProps['items'] = asArray<Record<string, unknown>>(props.actions).map((action) => ({
          key: asString(action.name),
          label: asString(action.label, asString(action.name)),
        }));
        return (
          <Dropdown
            menu={{
              items,
              onClick: ({ key }) =>
                onAction?.({
                  surfaceId: surface.surfaceId,
                  actionName: String(key),
                  sourceComponentId: node.id,
                }),
            }}
          >
            <Button size="small" icon={<ChevronDown size={15} />}>
              {asString(props.label, '更多操作')}
            </Button>
          </Dropdown>
        );
      }
      case 'ToolCallCard':
        return (
          <Alert
            type="info"
            showIcon
            icon={<FileCode2 size={16} />}
            title={props.title as React.ReactNode}
            description={props.description as React.ReactNode}
          />
        );
      case 'ToolResultCard':
        return (
          <Alert
            type={props.status === 'error' ? 'error' : 'success'}
            showIcon
            icon={props.status === 'error' ? <CircleAlert size={16} /> : <ListChecks size={16} />}
            title={props.title as React.ReactNode}
            description={<pre className="inline-json">{JSON.stringify(props.result ?? {}, null, 2)}</pre>}
          />
        );
      default:
        return <Alert type="warning" showIcon title={`未支持组件：${node.component}`} />;
    }
  };

  const root = nodeMap.get('root') ?? surface.components[0];

  return (
    <div className="a2ui-surface">
      {surface.validationErrors.length ? (
        <Alert
          className="a2ui-validation"
          type="warning"
          showIcon
          title="A2UI 校验提示"
          description={surface.validationErrors.join('；')}
        />
      ) : null}
      {root ? renderNode(root) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Surface 尚未收到组件命令" />}
    </div>
  );
}

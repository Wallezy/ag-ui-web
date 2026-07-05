import { Alert, Badge, Button, Descriptions, Empty, List, Space, Steps, Tabs, Tag, Typography } from 'antd';
import { Braces, Database, FileSearch, PanelRight, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import type { ChatRuntimeState, DemoScenario } from '../../agui/eventTypes';
import { assistantCatalog } from '../../a2ui/catalog';
import { deriveWorkflowSteps } from '../../agui/workflow';

const { Paragraph, Text } = Typography;

const JsonView = ({ value }: { value: unknown }) => <pre className="inspector-json">{JSON.stringify(value, null, 2)}</pre>;

const runtimeBadgeStatus = (status: ChatRuntimeState['status']) => {
  if (status === 'error') return 'error';
  if (status === 'running') return 'processing';
  if (status === 'waiting_auth') return 'warning';
  if (status === 'idle') return 'default';
  return 'success';
};

export function RightInspector({
  state,
  demo,
  onReplay,
}: {
  state: ChatRuntimeState;
  demo: DemoScenario;
  onReplay: () => void;
}) {
  const toolCalls = Object.values(state.toolCalls);
  const surfaces = Object.values(state.surfaces);
  const activities = Object.values(state.activities);
  const workflowSteps = deriveWorkflowSteps(state);
  const approvalSurfaces = surfaces.filter((surface) =>
    surface.components.some((component) => component.component === 'ApprovalCard'),
  );

  return (
    <aside className="right-inspector">
      <div className="inspector-header">
        <Space>
          <PanelRight size={17} />
          <Text strong>运行时面板</Text>
        </Space>
        <Button size="small" icon={<RefreshCw size={14} />} onClick={onReplay}>
          重放
        </Button>
      </div>
      <Tabs
        size="small"
        items={[
          {
            key: 'runtime',
            label: '状态',
            children: (
              <Space direction="vertical" size={12} className="fill">
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    { key: 'demo', label: '当前 Demo', children: demo.title },
                    { key: 'thread', label: 'Thread', children: state.threadId },
                    { key: 'run', label: 'Run', children: state.runId ?? '-' },
                    {
                      key: 'status',
                      label: '状态',
                      children: <Badge status={runtimeBadgeStatus(state.status)} text={state.status === 'waiting_auth' ? '待授权' : state.status} />,
                    },
                  ]}
                />
                <Alert type="info" showIcon title="处理链路" description={demo.blockOrder.join(' → ')} />
                <div className="workflow-card">
                  <Text strong>工作流状态</Text>
                  <Steps
                    size="small"
                    orientation="vertical"
                    items={workflowSteps.map((step) => ({
                      title: step.title,
                      content: step.description,
                      status: step.status,
                    }))}
                  />
                </div>
                <Paragraph className="muted">{demo.visualEffect}</Paragraph>
              </Space>
            ),
          },
          {
            key: 'tools',
            label: '工具',
            children: toolCalls.length ? (
              <List
                size="small"
                dataSource={toolCalls}
                renderItem={(tool) => (
                  <List.Item>
                    <Wrench size={15} />
                    <Text strong>{tool.name}</Text>
                    <Tag>{tool.status}</Tag>
                    {tool.riskLevel ? <Tag color="orange">{tool.riskLevel}</Tag> : null}
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工具调用" />
            ),
          },
          {
            key: 'surfaces',
            label: 'A2UI',
            children: (
              <Space direction="vertical" size={10} className="fill">
                <Alert type="success" showIcon title="Catalog 白名单" description={`${assistantCatalog.length} 个组件已注册`} />
                {surfaces.map((surface) => (
                  <div className="surface-mini" key={surface.surfaceId}>
                    <Space>
                      <Braces size={15} />
                      <Text strong>{surface.surfaceId}</Text>
                      <Tag>{surface.components.length} components</Tag>
                    </Space>
                    {surface.validationErrors.length ? <Tag color="orange">校验提示</Tag> : <Tag color="green">已校验</Tag>}
                  </div>
                ))}
              </Space>
            ),
          },
          {
            key: 'state',
            label: 'State',
            children: <JsonView value={state.sharedState} />,
          },
          {
            key: 'activity',
            label: '活动',
            children: activities.length ? (
              <List
                size="small"
                dataSource={activities}
                renderItem={(activity) => (
                  <List.Item>
                    <Database size={15} />
                    <Text>{activity.title}</Text>
                    <Tag>{activity.status}</Tag>
                  </List.Item>
                )}
              />
            ) : workflowSteps.length ? (
              <List
                size="small"
                dataSource={workflowSteps}
                renderItem={(step) => (
                  <List.Item>
                    <Database size={15} />
                    <Text>{step.title}</Text>
                    <Tag color={step.status === 'error' ? 'red' : step.status === 'finish' ? 'green' : step.status === 'process' ? 'blue' : 'default'}>
                      {step.status}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活动" />
            ),
          },
          {
            key: 'approval',
            label: '审批',
            children: approvalSurfaces.length ? (
              <List
                size="small"
                dataSource={approvalSurfaces}
                renderItem={(surface) => (
                  <List.Item>
                    <ShieldAlert size={15} />
                    <Text>{surface.surfaceId}</Text>
                    <Tag color="warning">等待确认</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前无待审批任务" />
            ),
          },
          {
            key: 'events',
            label: '事件',
            children: (
              <div className="event-log">
                {state.eventLog.map((event, index) => (
                  <div className="event-line" key={`${event.type}-${index}`}>
                    <FileSearch size={13} />
                    <Text code>{event.type}</Text>
                    {event.name ? <Tag>{event.name}</Tag> : null}
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </aside>
  );
}

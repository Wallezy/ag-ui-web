import type { A2UICommand, AguiEvent, DemoScenario } from '../agui/eventTypes';
import { ASSISTANT_CATALOG_ID } from '../a2ui/catalog';

const base = {
  timestamp: Date.now(),
  traceId: 'trace-demo',
  sessionId: 'session-demo',
};

const runStarted = (threadId: string, runId: string): AguiEvent => ({
  ...base,
  type: 'RUN_STARTED',
  threadId,
  runId,
  agentId: 'oa-agent',
});

const runFinished = (threadId: string, runId: string): AguiEvent => ({
  ...base,
  type: 'RUN_FINISHED',
  threadId,
  runId,
  result: { status: 'success' },
});

const text = (messageId: string, content: string): AguiEvent[] => [
  { ...base, type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
  { ...base, type: 'TEXT_MESSAGE_CONTENT', messageId, delta: content },
  { ...base, type: 'TEXT_MESSAGE_END', messageId },
];

const reasoning = (messageId: string, content: string): AguiEvent[] => [
  { ...base, type: 'REASONING_START', messageId },
  { ...base, type: 'REASONING_MESSAGE_START', messageId, role: 'reasoning' },
  { ...base, type: 'REASONING_MESSAGE_CONTENT', messageId, delta: content },
  { ...base, type: 'REASONING_MESSAGE_END', messageId },
  { ...base, type: 'REASONING_END', messageId },
];

const tool = (messageId: string, id: string, name: string, args: unknown, result: unknown): AguiEvent[] => [
  { ...base, type: 'TOOL_CALL_START', messageId, parentMessageId: messageId, toolCallId: id, toolCallName: name },
  { ...base, type: 'TOOL_CALL_ARGS', toolCallId: id, delta: JSON.stringify(args) },
  { ...base, type: 'TOOL_CALL_END', toolCallId: id },
  {
    ...base,
    type: 'TOOL_CALL_RESULT',
    messageId: `tool-result-${id}`,
    parentMessageId: messageId,
    toolCallId: id,
    role: 'tool',
    content: JSON.stringify(result),
  },
];

const commandsEvent = (messageId: string, surfaceId: string, commands: A2UICommand[]): AguiEvent => ({
  ...base,
  type: 'CUSTOM',
  name: 'a2ui.commands',
  value: {
    messageId,
    surfaceId,
    commands,
  },
});

const create = (surfaceId: string): A2UICommand => ({
  version: 'v0.9',
  createSurface: {
    surfaceId,
    catalogId: ASSISTANT_CATALOG_ID,
  },
});

export const demoScenarios: DemoScenario[] = [
  {
    id: 'sales-analysis',
    title: '销售数据分析',
    group: '数据分析',
    question: '分析一下本周销售数据，告诉我增长点和风险。',
    description: 'KPI、趋势图、风险提醒和下钻动作混合呈现。',
    blockOrder: ['Markdown', 'Reasoning', 'A2UI KPI', 'A2UI Chart', 'Table', 'Sources', 'Actions'],
    visualEffect: '消息顶部给出结论，中部是轻量 BI 卡片，底部提供导出、下钻、创建待办。',
    interactions: ['导出报告', '继续下钻', '创建待办'],
    recovery: '销售服务失败时保留缓存摘要，A2UI Alert 提供重试和切换数据源。',
    events: [
      runStarted('thread-sales', 'run-sales-001'),
      {
        ...base,
        type: 'STATE_SNAPSHOT',
        snapshot: { intent: 'sales_analysis', filters: { range: 'this_week' }, status: 'collecting' },
      },
      ...reasoning('reasoning-sales-001', '正在汇总订单、渠道和地区维度数据，并生成可视化摘要。'),
      ...tool(
        'msg-sales-001',
        'tool-sales-query',
        'query_sales_metrics',
        { range: 'this_week', dimensions: ['channel', 'region'] },
        { revenue: 1280000, growth: 0.184, risk: '华东线索转化下降' },
      ),
      ...text('msg-sales-001', '本周销售额 128 万，环比增长 18.4%。主要增长来自企业版续费和华南渠道，但华东线索转化率下降，需要关注。'),
      commandsEvent('msg-sales-001', 'sales-analysis', [
        create('sales-analysis'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'sales-analysis',
            path: '/',
            value: {
              kpis: [
                { label: '销售额', value: 128, suffix: '万元', trend: 'up', delta: '+18.4%' },
                { label: '订单数', value: 842, trend: 'up', delta: '+9.7%' },
                { label: '转化率', value: '12.8%', trend: 'down', delta: '-2.1%' },
              ],
              trend: [
                { day: 'Mon', value: 18 },
                { day: 'Tue', value: 21 },
                { day: 'Wed', value: 19.5 },
                { day: 'Thu', value: 26 },
                { day: 'Fri', value: 30.5 },
              ],
              risks: ['华东线索转化下降', '大客户回款周期变长'],
              table: [
                { channel: '企业续费', revenue: '48 万', growth: '+22%' },
                { channel: '华南渠道', revenue: '36 万', growth: '+31%' },
                { channel: '华东线索', revenue: '19 万', growth: '-8%' },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'sales-analysis',
            components: [
              { id: 'root', component: 'Card', props: { title: '本周销售分析' }, children: ['kpi-grid', 'trend-chart', 'risk-alert', 'detail-table', 'actions'] },
              { id: 'kpi-grid', component: 'KPIGrid', props: { items: { path: '/kpis' } } },
              { id: 'trend-chart', component: 'LineChart', props: { data: { path: '/trend' }, xField: 'day', yField: 'value' } },
              { id: 'risk-alert', component: 'Alert', props: { type: 'warning', message: '风险提醒', description: { path: '/risks/0' } } },
              {
                id: 'detail-table',
                component: 'Table',
                props: {
                  columns: [
                    { title: '渠道', dataIndex: 'channel' },
                    { title: '收入', dataIndex: 'revenue' },
                    { title: '增长', dataIndex: 'growth' },
                  ],
                  dataSource: { path: '/table' },
                },
              },
              {
                id: 'actions',
                component: 'ButtonGroup',
                props: {
                  actions: [
                    { name: 'export_report', label: '导出报告' },
                    { name: 'drill_down', label: '继续下钻', type: 'primary' },
                    { name: 'create_task', label: '创建待办' },
                  ],
                },
              },
            ],
          },
        },
      ]),
      runFinished('thread-sales', 'run-sales-001'),
    ],
  },
  {
    id: 'code-review',
    title: '代码审查',
    group: '研发辅助',
    question: '帮我 review 这个 PR，重点看性能和安全问题。',
    description: 'PR 文件、风险摘要、Diff 和修复动作在一个 surface 内聚合。',
    blockOrder: ['Reasoning', 'ToolCallCard', 'FileCard', 'DiffView', 'Alert', 'Steps', 'Actions'],
    visualEffect: '像 Review 面板：左侧文件风险，右侧显示关键 diff 和可执行修复动作。',
    interactions: ['应用修复', '打开文件', '生成 Review 评论'],
    recovery: '应用补丁失败时返回 Alert，并保留可复制的修复建议。',
    events: [
      runStarted('thread-review', 'run-review-001'),
      { ...base, type: 'STEP_STARTED', messageId: 'msg-review-001', activityId: 'read-pr', message: '读取 PR 文件' },
      ...tool('msg-review-001', 'tool-fetch-pr', 'fetch_pr_diff', { prId: 42 }, { files: 8, additions: 210, deletions: 64 }),
      { ...base, type: 'STEP_FINISHED', messageId: 'msg-review-001', activityId: 'read-pr', message: 'PR Diff 已读取' },
      ...reasoning('msg-review-001', '重点检查了鉴权边界、数据库访问路径和列表渲染性能。'),
      ...text('msg-review-001', '发现 2 个高优先级问题：订单读取缺少用户维度约束，列表页存在潜在 N+1 查询。建议先修复鉴权问题再合并。'),
      commandsEvent('msg-review-001', 'code-review', [
        create('code-review'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'code-review',
            path: '/',
            value: {
              files: [
                { path: 'src/api/order.ts', risk: 'high' },
                { path: 'src/components/OrderTable.tsx', risk: 'medium' },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'code-review',
            components: [
              { id: 'root', component: 'Card', props: { title: 'PR Review 摘要' }, children: ['risk-summary', 'file-list', 'diff-view', 'steps', 'fix-actions'] },
              { id: 'risk-summary', component: 'Alert', props: { type: 'warning', message: '发现 2 个高优先级问题', description: '一个越权读取风险，一个 N+1 查询问题。' } },
              { id: 'file-list', component: 'FileTree', props: { files: { path: '/files' } } },
              { id: 'diff-view', component: 'DiffView', props: { before: 'const order = await getOrder(id)', after: 'const order = await getOrderByUser(userId, id)' } },
              {
                id: 'steps',
                component: 'Steps',
                props: {
                  current: 1,
                  items: [
                    { title: '加用户维度约束', status: 'process' },
                    { title: '批量预加载订单明细', status: 'wait' },
                    { title: '补充越权测试', status: 'wait' },
                  ],
                },
              },
              {
                id: 'fix-actions',
                component: 'ButtonGroup',
                props: {
                  actions: [
                    { name: 'apply_patch', label: '应用修复', type: 'primary' },
                    { name: 'open_file', label: '打开文件' },
                    { name: 'create_comment', label: '生成 Review 评论' },
                  ],
                },
              },
            ],
          },
        },
      ]),
      runFinished('thread-review', 'run-review-001'),
    ],
  },
  {
    id: 'knowledge-policy',
    title: '知识库问答',
    group: '知识库',
    question: '根据公司制度，差旅报销审批流程是什么？',
    description: '检索来源、流程 Timeline 和后续动作可追溯。',
    blockOrder: ['Markdown', 'KnowledgeCard', 'Timeline', 'Sources', 'Follow-up Actions'],
    visualEffect: '顶部一句话回答，中间时间线展示流程，底部 Sources 显示制度出处。',
    interactions: ['生成报销申请', '查看制度原文', '问后续问题'],
    recovery: '检索无结果时展示空状态和换关键词建议。',
    events: [
      runStarted('thread-policy', 'run-policy-001'),
      ...tool('msg-policy-001', 'tool-kb-search', 'search_knowledge_base', { query: '差旅报销审批流程' }, { hits: 2, topScore: 0.92 }),
      ...text('msg-policy-001', '差旅报销需要先提交申请，再上传票据，部门负责人审批后由财务复核，最终打款归档。'),
      commandsEvent('msg-policy-001', 'policy-answer', [
        create('policy-answer'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'policy-answer',
            path: '/',
            value: {
              summary: '出差前提交申请，返程后 7 日内上传发票和行程单，经部门负责人和财务复核后进入付款流程。',
              steps: [
                { children: '提交差旅申请：填写目的、预算和时间' },
                { children: '上传票据：返程后 7 日内提交发票和行程单' },
                { children: '部门审批：直属负责人审核合理性' },
                { children: '财务复核：检查票据和预算' },
                { children: '打款归档：通过后进入付款流程' },
              ],
              sources: [
                { title: '差旅报销制度 V3.2', chunk: '第 4.1 条', score: 0.92 },
                { title: '财务审批规范', chunk: '第 2.3 条', score: 0.87 },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'policy-answer',
            components: [
              { id: 'root', component: 'Card', props: { title: '差旅报销流程' }, children: ['knowledge', 'timeline', 'sources', 'actions'] },
              { id: 'knowledge', component: 'KnowledgeCard', props: { summary: { path: '/summary' } } },
              { id: 'timeline', component: 'Timeline', props: { items: { path: '/steps' } } },
              { id: 'sources', component: 'SourceList', props: { items: { path: '/sources' } } },
              {
                id: 'actions',
                component: 'ButtonGroup',
                props: {
                  actions: [
                    { name: 'create_expense_request', label: '生成报销申请', type: 'primary' },
                    { name: 'open_policy', label: '查看制度原文' },
                    { name: 'ask_followup', label: '问一个后续问题' },
                  ],
                },
              },
            ],
          },
        },
      ]),
      runFinished('thread-policy', 'run-policy-001'),
    ],
  },
  {
    id: 'contract-summary',
    title: '文档总结',
    group: '文档处理',
    question: '总结这份合同，帮我标出风险条款。',
    description: '附件、摘要、风险条款和页码跳转动作组合。',
    blockOrder: ['FileCard', 'Reasoning', 'SummaryCard', 'RiskList', 'Sources', 'Actions'],
    visualEffect: '像一页合同审阅报告，风险条款按等级展开，并能跳转到原文页码。',
    interactions: ['跳转原文页码', '导出风险清单', '生成谈判建议'],
    recovery: '解析失败时保留文件卡片，提示重新上传或切换 OCR。',
    events: [
      runStarted('thread-contract', 'run-contract-001'),
      { ...base, type: 'STATE_SNAPSHOT', snapshot: { attachments: [{ fileId: 'file-contract-001', name: '采购合同.pdf', pages: 18 }] } },
      ...tool('msg-contract-001', 'tool-parse-doc', 'parse_document', { fileId: 'file-contract-001' }, { pages: 18, clauses: 42 }),
      ...tool('msg-contract-001', 'tool-clauses', 'extract_clauses', { fileId: 'file-contract-001', riskOnly: true }, { risks: 3 }),
      ...text('msg-contract-001', '合同整体可签，但建议重点关注自动续约、提前终止责任和付款验收口径三处条款。'),
      commandsEvent('msg-contract-001', 'contract-summary', [
        create('contract-summary'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'contract-summary',
            path: '/',
            value: {
              fields: [
                { label: '文件', value: '采购合同.pdf' },
                { label: '页数', value: '18 页' },
                { label: '风险条款', value: '3 处' },
              ],
              risks: [
                { title: '自动续约', description: '未提前 30 天书面通知则自动续约一年', status: 'process' },
                { title: '提前终止责任', description: '违约金比例较高，建议调整上限', status: 'wait' },
                { title: '验收口径', description: '缺少明确验收周期和异议窗口', status: 'wait' },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'contract-summary',
            components: [
              { id: 'root', component: 'Card', props: { title: '合同风险摘要' }, children: ['file', 'fields', 'risks', 'actions'] },
              { id: 'file', component: 'FileCard', props: { name: '采购合同.pdf', description: '18 页，已完成条款抽取' } },
              { id: 'fields', component: 'DescriptionList', props: { items: { path: '/fields' } } },
              { id: 'risks', component: 'Steps', props: { current: 0, items: { path: '/risks' } } },
              {
                id: 'actions',
                component: 'ButtonGroup',
                props: {
                  actions: [
                    { name: 'open_clause', label: '跳转第 12 页', type: 'primary', context: { fileId: 'file-contract-001', page: 12, clauseId: 'termination-liability' } },
                    { name: 'export_risks', label: '导出风险清单' },
                    { name: 'draft_negotiation', label: '生成谈判建议' },
                  ],
                },
              },
            ],
          },
        },
      ]),
      runFinished('thread-contract', 'run-contract-001'),
    ],
  },
  {
    id: 'approval-card',
    title: '人机协作审批',
    group: '业务流程',
    question: '帮我创建一个采购单，金额 12 万，需要主管审批。',
    description: 'Agent 创建草稿后进入等待确认，前端用 ApprovalCard 回传动作。',
    blockOrder: ['Steps', 'ToolCallCard', 'ApprovalCard', 'Alert', 'Actions'],
    visualEffect: '采购单字段、风险和审批动作集中展示，状态清楚地停在 pending。',
    interactions: ['批准', '驳回', '要求补充材料'],
    recovery: '确认 token 失效时提示重新生成草稿，不允许前端直接声称提交成功。',
    events: [
      runStarted('thread-approval', 'run-approval-001'),
      ...tool('msg-approval-001', 'tool-create-po', 'create_purchase_order_draft', { amount: 120000 }, { purchaseOrderId: 'PO-2026-0712', status: 'DRAFT' }),
      { ...base, type: 'STATE_SNAPSHOT', snapshot: { approval: { status: 'waiting_user', purchaseOrderId: 'PO-2026-0712' } } },
      ...text('msg-approval-001', '采购单草稿已生成。由于金额超过 10 万，需要你确认后再进入主管审批流。'),
      commandsEvent('msg-approval-001', 'purchase-approval', [
        create('purchase-approval'),
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'purchase-approval',
            components: [
              {
                id: 'root',
                component: 'ApprovalCard',
                props: {
                  title: '采购单审批',
                  status: 'pending',
                  fields: [
                    { label: '采购单号', value: 'PO-2026-0712' },
                    { label: '金额', value: '¥120,000' },
                    { label: '供应商', value: '上海某某科技有限公司' },
                    { label: '风险', value: '超过 10 万，需要主管审批' },
                  ],
                  actions: [
                    { name: 'approve', label: '批准', type: 'primary', context: { purchaseOrderId: 'PO-2026-0712', approved: true } },
                    { name: 'reject', label: '驳回', danger: true, context: { purchaseOrderId: 'PO-2026-0712', approved: false } },
                    { name: 'request_more_info', label: '要求补充材料' },
                  ],
                },
              },
            ],
          },
        },
      ]),
      runFinished('thread-approval', 'run-approval-001'),
    ],
  },
  {
    id: 'dynamic-form',
    title: '动态表单',
    group: '客户运营',
    question: '帮我生成一个客户回访计划。',
    description: 'Agent 先生成表单，前端本地校验，提交动作再回到 Agent。',
    blockOrder: ['Markdown', 'A2UI Form', 'Validation Alert', 'Preview Card', 'Actions'],
    visualEffect: '一个可填写的回访计划表单，默认值可由 Agent 通过 dataModel 局部更新。',
    interactions: ['填写表单', '生成计划', '预览短信'],
    recovery: '必填项缺失时在表单内展示校验错误，不发送后端工具调用。',
    events: [
      runStarted('thread-form', 'run-form-001'),
      ...text('msg-form-001', '我先收集客户类型、回访时间、目标和联系人，再生成回访计划。'),
      commandsEvent('msg-form-001', 'followup-plan-form', [
        create('followup-plan-form'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'followup-plan-form',
            path: '/form',
            value: { customerType: '重点客户', date: '2026-07-05', goal: '确认续约意向' },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'followup-plan-form',
            components: [
              { id: 'root', component: 'Card', props: { title: '客户回访计划' }, children: ['form', 'preview'] },
              { id: 'form', component: 'Form', props: { title: '回访信息', submitAction: 'generate_plan' }, children: ['customer-type', 'visit-date', 'goal', 'contact', 'submit'] },
              { id: 'customer-type', component: 'Select', props: { label: '客户类型', path: '/form/customerType', required: true, options: ['新客户', '重点客户', '流失风险客户'] } },
              { id: 'visit-date', component: 'DatePicker', props: { label: '回访时间', path: '/form/date', required: true } },
              { id: 'goal', component: 'TextArea', props: { label: '回访目标', path: '/form/goal', required: true } },
              { id: 'contact', component: 'Input', props: { label: '联系人', path: '/form/contact', required: true, placeholder: '请输入联系人' } },
              { id: 'submit', component: 'SubmitButton', props: { label: '生成计划', action: 'generate_plan' } },
              { id: 'preview', component: 'Alert', props: { type: 'info', message: '预览', description: '提交后将生成回访节奏、话术和后续待办。' } },
            ],
          },
        },
      ]),
      runFinished('thread-form', 'run-form-001'),
    ],
  },
  {
    id: 'multi-surface',
    title: '多卡片同步',
    group: '方案测算',
    question: '帮我对比三个套餐，并计算不同人数下的成本。',
    description: '两个 A2UI surface 共享 AG-UI state，人数变化后一起刷新。',
    blockOrder: ['PlanComparison Surface', 'Calculator Surface', 'Statistic', 'Chart', 'Actions'],
    visualEffect: '套餐对比卡和成本计算卡并排出现，共享人数、周期和选中套餐。',
    interactions: ['修改人数', '切换周期', '选中套餐'],
    recovery: '价格接口失败时保留本地目录价，并显示数据更新时间。',
    events: [
      runStarted('thread-pricing', 'run-pricing-001'),
      { ...base, type: 'STATE_SNAPSHOT', snapshot: { pricing: { seats: 50, billingCycle: 'annual', selectedPlan: 'pro' } } },
      ...text('msg-pricing-001', '我按 50 人、年付口径对比了基础版、专业版和企业版。专业版当前性价比最高。'),
      commandsEvent('msg-pricing-001', 'plan-comparison', [
        create('plan-comparison'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'plan-comparison',
            path: '/',
            value: {
              plans: [
                { plan: '基础版', price: '¥29/人/月', features: '知识库问答、基础工具' },
                { plan: '专业版', price: '¥59/人/月', features: 'AG-UI 工作流、审批、人机协作' },
                { plan: '企业版', price: '定制', features: '私有化、审计、权限治理' },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'plan-comparison',
            components: [
              { id: 'root', component: 'Card', props: { title: '套餐对比' }, children: ['table', 'actions'] },
              {
                id: 'table',
                component: 'Table',
                props: {
                  columns: [
                    { title: '套餐', dataIndex: 'plan' },
                    { title: '价格', dataIndex: 'price' },
                    { title: '能力', dataIndex: 'features' },
                  ],
                  dataSource: { path: '/plans' },
                },
              },
              { id: 'actions', component: 'ButtonGroup', props: { actions: [{ name: 'select_pro', label: '选择专业版', type: 'primary' }, { name: 'request_quote', label: '询企业报价' }] } },
            ],
          },
        },
      ]),
      commandsEvent('msg-pricing-001', 'cost-calculator', [
        create('cost-calculator'),
        {
          version: 'v0.9',
          updateDataModel: {
            surfaceId: 'cost-calculator',
            path: '/',
            value: {
              kpis: [
                { label: '人数', value: 50, suffix: '人' },
                { label: '专业版年费', value: '¥35,400' },
                { label: '较基础版增加', value: '¥18,000' },
              ],
              trend: [
                { seats: '20', value: 14160 },
                { seats: '50', value: 35400 },
                { seats: '120', value: 84960 },
              ],
            },
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'cost-calculator',
            components: [
              { id: 'root', component: 'Card', props: { title: '成本测算' }, children: ['kpis', 'bar'] },
              { id: 'kpis', component: 'KPIGrid', props: { items: { path: '/kpis' } } },
              { id: 'bar', component: 'BarChart', props: { data: { path: '/trend' }, xField: 'seats', yField: 'value' } },
            ],
          },
        },
      ]),
      { ...base, type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/pricing/seats', value: 120 }] },
      runFinished('thread-pricing', 'run-pricing-001'),
    ],
  },
  {
    id: 'error-recovery',
    title: '错误恢复',
    group: '异常处理',
    question: '查询一下今天的库存预警。',
    description: '工具超时后显示诊断、恢复路径和备用数据源动作。',
    blockOrder: ['Alert', 'ToolResult', 'Diagnostic Steps', 'Retry Action', 'Fallback Markdown'],
    visualEffect: '错误不是一段红字，而是一个可恢复的任务面板。',
    interactions: ['重试', '查看缓存', '切换数据源'],
    recovery: '服务不可用时用 RUN_ERROR + A2UI Alert/ButtonGroup 给出恢复路径。',
    events: [
      runStarted('thread-inventory', 'run-inventory-001'),
      { ...base, type: 'TOOL_CALL_START', toolCallId: 'tool-inventory', toolCallName: 'query_inventory_alerts', parentMessageId: 'msg-inventory-001' },
      { ...base, type: 'TOOL_CALL_ARGS', toolCallId: 'tool-inventory', delta: '{"date":"today"}' },
      { ...base, type: 'TOOL_CALL_END', toolCallId: 'tool-inventory' },
      { ...base, type: 'RUN_ERROR', message: '库存服务暂时不可用', code: 'INVENTORY_SERVICE_TIMEOUT' },
      commandsEvent('msg-inventory-001', 'inventory-error', [
        create('inventory-error'),
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'inventory-error',
            components: [
              { id: 'root', component: 'Card', props: { title: '库存预警查询失败' }, children: ['error', 'steps', 'actions'] },
              { id: 'error', component: 'Alert', props: { type: 'error', message: '库存服务暂时不可用', description: '可以重试、切换备用数据源，或查看上一次缓存结果。' } },
              {
                id: 'steps',
                component: 'Steps',
                props: {
                  current: 1,
                  items: [
                    { title: '参数校验通过', status: 'finish' },
                    { title: '库存服务超时', status: 'error' },
                    { title: '等待恢复动作', status: 'wait' },
                  ],
                },
              },
              {
                id: 'actions',
                component: 'ButtonGroup',
                props: {
                  actions: [
                    { name: 'retry', label: '重试', type: 'primary' },
                    { name: 'use_cache', label: '查看缓存' },
                    { name: 'switch_source', label: '切换数据源' },
                  ],
                },
              },
            ],
          },
        },
      ]),
    ],
  },
];

export const getDemoById = (id: string) => demoScenarios.find((demo) => demo.id === id) ?? demoScenarios[0];

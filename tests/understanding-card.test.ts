import assert from 'node:assert/strict'
import test from 'node:test'
import {
  initialAgentTaskViewState,
  type AgentTaskViewState,
} from '../src/features/agents/oa-public-events.ts'
import { understandingCardModel } from '../src/features/agents/understanding-card-data.ts'

test('does not render an empty shell without a v2 understanding event', () => {
  assert.equal(understandingCardModel(initialAgentTaskViewState), null)
})

test('shows a current-run placeholder before the first understanding event', () => {
  const model = understandingCardModel({
    ...initialAgentTaskViewState,
    activeRunId: 'run-current',
  })

  assert.equal(model?.operation, '正在理解当前请求…')
  assert.deepEqual(model?.fields, [])
  assert.equal(model?.writePreview, false)
})

test('shows structured pending fields instead of an old write preview', () => {
  const current = state({
    selectedIntentId: 'WORK_HOUR_PREPARE',
    fields: ['workDate'],
  })
  const model = understandingCardModel({
    ...current,
    terminal: 'waiting_user',
    pending: {
      reasonCode: 'PERIOD_REQUIRED',
      displayMessage: '请补充日期',
      questionId: 'question-1',
      questionKind: 'SEMANTIC_CLARIFICATION',
      fields: ['period'],
    },
  })

  assert.equal(model?.operation, '需要补充信息')
  assert.equal(model?.writePreview, false)
  assert.deepEqual(model?.fields.map((field) => field.label), ['日期'])
})

test('maps only public server fields and status labels', () => {
  const model = understandingCardModel(
    state({
      selectedIntentId: 'WORK_ITEM_QUERY',
      fields: ['assigneeName', 'beginDate', 'projectName'],
      status: 'VERIFIED',
    })
  )

  assert.deepEqual(model, {
    operation: '查询工作项',
    fields: [
      { name: 'assigneeName', label: '人员', valueSummary: null, source: null, status: '系统验证', editable: true },
      { name: 'beginDate', label: '开始日期', valueSummary: null, source: null, status: '系统验证', editable: true },
      { name: 'projectName', label: '项目', valueSummary: null, source: null, status: '系统验证', editable: true },
    ],
    writePreview: false,
    waitingConfirmation: false,
  })
})

test('localizes the legacy work-item operation id emitted by public events', () => {
  const model = understandingCardModel(
    state({ selectedIntentId: 'QUERY_WORK_ITEMS', fields: [] })
  )

  assert.equal(model?.operation, '查询工作项')
})

test('uses authoritative v3 values, status and editability', () => {
  const model = understandingCardModel(state({
    selectedIntentId: 'WORK_ITEM_QUERY',
    slots: [{
      name: 'assigneeName', label: '成员', valueSummary: '王翔',
      source: 'USER_CORRECTION', status: 'GROUNDED', critical: true,
      editable: true, conflictReason: '',
    }],
  }))

  assert.deepEqual(model?.fields[0], {
    name: 'assigneeName', label: '人员', valueSummary: '王翔',
    source: 'USER_CORRECTION', status: '系统验证', editable: true,
  })
})

test('hides internal slots and unknown public statuses by default', () => {
  const model = understandingCardModel(state({
    selectedIntentId: 'WORK_ITEM_QUERY',
    slots: [
      {
        name: 'goal', label: '操作', valueSummary: 'QUERY_WORK_ITEMS',
        source: 'DEFAULT', status: 'EXPLICIT', critical: false,
        editable: true, conflictReason: '',
      },
      {
        name: 'semanticWorkItemReview', label: 'semanticWorkItemReview',
        valueSummary: 'UNAVAILABLE', source: 'DEFAULT', status: 'EXPLICIT',
        critical: false, editable: false, conflictReason: '',
      },
      {
        name: 'assigneeName', label: '人员', valueSummary: '李文卓',
        source: 'EXPLICIT_CURRENT_TURN', status: 'UNAVAILABLE', critical: true,
        editable: true, conflictReason: '',
      },
      {
        name: 'statusList', label: '状态', valueSummary: '进行中',
        source: 'EXPLICIT_CURRENT_TURN', status: 'EXPLICIT', critical: false,
        editable: false, conflictReason: '',
      },
    ],
  }))

  assert.deepEqual(model?.fields.map((field) => field.name), ['statusList'])
})

test('keeps write operations behind a visible preview and confirmation boundary', () => {
  const model = understandingCardModel(
    state({
      selectedIntentId: 'DAILY_REPORT_SUBMIT_PREPARE',
      fields: ['workDate'],
      status: 'WAITING_CONFIRMATION',
    })
  )

  assert.equal(model?.writePreview, true)
  assert.equal(model?.waitingConfirmation, true)
  assert.equal(model?.fields[0]?.status, '需要确认')
})

function state(
  understanding: NonNullable<AgentTaskViewState['understanding']>
): AgentTaskViewState {
  return {
    ...initialAgentTaskViewState,
    taskId: 'task-1',
    taskVersion: 1,
    v2Observed: true,
    understanding: {
      reasonCode: 'READY',
      displayMessage: '理解已更新',
      ...understanding,
    },
  }
}

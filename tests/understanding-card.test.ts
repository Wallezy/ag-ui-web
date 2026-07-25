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
    name: 'assigneeName', label: '成员', valueSummary: '王翔',
    source: 'USER_CORRECTION', status: '系统验证', editable: true,
  })
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

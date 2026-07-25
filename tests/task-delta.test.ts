import assert from 'node:assert/strict'
import test from 'node:test'
import { fieldCorrectionDelta } from '../src/features/agents/task-delta.ts'

test('builds replace and clear deltas only for editable business fields', () => {
  assert.deepEqual(fieldCorrectionDelta({ taskId: 'task-1', expectedVersion: 3, slotName: 'projectName', value: ' 项目甲 ' }), {
    schemaVersion: 1, operation: 'REPLACE_SLOT', taskId: 'task-1', expectedVersion: 3,
    slotName: 'projectName', oldValue: null, newValue: '项目甲',
  })
  for (const slotName of ['tenantId', 'userId', 'sessionId']) {
    assert.equal(fieldCorrectionDelta({ taskId: 'task-1', expectedVersion: 3, slotName, value: 'other' }), null)
  }
  assert.equal(fieldCorrectionDelta({ taskId: 'task-1', expectedVersion: 3, slotName: 'projectName', value: ' ' })?.operation, 'CLEAR_SLOT')
})

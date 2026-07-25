import assert from 'node:assert/strict'
import test from 'node:test'
import { repairActionLabel } from '../src/features/agents/repair-timeline-data.ts'

test('maps only public recovery actions to user-facing labels', () => {
  assert.equal(repairActionLabel('REPAIR_ARGUMENTS'), '已修正查询条件')
  assert.equal(repairActionLabel('INTERNAL_POLICY_DETAIL'), '已执行受约束的修正')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUserWorkHoursResult } from '../src/features/agents/tool-ui/work-hour-query-data.ts'

test('projects a work-hour response into user-visible business fields only', () => {
  const result = parseUserWorkHoursResult({
    auditId: 'audit-secret',
    targetUser: { userName: '张扬', userId: '1171' },
    dateRange: {
      beginDate: '2026-07-17',
      endDate: '2026-07-23',
      dayCount: 7,
    },
    summary: { totalWorkHours: 1, recordCount: 1, activeDayCount: 1 },
    typeBreakdown: [
      {
        type: 'task',
        typeName: '任务',
        workHours: 1,
        recordCount: 1,
      },
    ],
    days: [
      {
        workDate: '2026-07-17',
        details: [
          {
            typeName: '任务',
            projectName: '智能办公平台',
            title: '意图模型联调',
            workHours: 1,
            workCategory: '开发',
            executionDesc: '验证最近七天工作总结',
            workItemId: 'task-secret',
          },
        ],
      },
    ],
    completeness: { complete: true, discardedRecordCount: 0 },
  })

  assert.deepEqual(result, {
    targetUserName: '张扬',
    dateRange: {
      beginDate: '2026-07-17',
      endDate: '2026-07-23',
      dayCount: 7,
    },
    totalWorkHours: 1,
    recordCount: 1,
    activeDayCount: 1,
    typeBreakdown: [{ typeName: '任务', workHours: 1 }],
    details: [
      {
        workDate: '2026-07-17',
        typeName: '任务',
        projectName: '智能办公平台',
        title: '意图模型联调',
        workHours: 1,
        workCategory: '开发',
        executionDesc: '验证最近七天工作总结',
      },
    ],
    complete: true,
  })
  assert.doesNotMatch(
    JSON.stringify(result),
    /audit-secret|userId|1171|workItemId|task-secret/
  )
})

test('marks discarded or truncated work-hour data as incomplete', () => {
  assert.equal(
    parseUserWorkHoursResult({
      summary: {},
      completeness: { complete: false },
    })?.complete,
    false
  )
  assert.equal(
    parseUserWorkHoursResult({
      summary: {},
      completeness: { complete: true },
      detailsTruncated: true,
    })?.complete,
    false
  )
})

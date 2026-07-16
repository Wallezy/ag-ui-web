import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasUnsavedDailyReportChanges,
  isDailyReportPersisted,
  resolveDailyReportStatus,
} from '../src/features/agents/tool-ui/daily-report-status.ts'

test('parses a complete daily report status payload into an editable detail', () => {
  const status = resolveDailyReportStatus(
    {
      found: true,
      draftId: 'DRAFT-1',
      draftVersion: 1,
      idempotencyKey: 'confirm-1',
      workDate: '2026-07-16',
      content: '2026-07-16 工作日报\n今日任务：完成日报查询',
      remark: '完成日报查询页面联调',
      operationMode: 'update',
      existingReport: true,
      oaReportId: 'daily-1',
      taskWork: [
        {
          id: 'task-1',
          title: '完成日报查询',
          totalWorkHours: 2,
        },
      ],
      bugWork: [],
      tomorrowWorkPlan: [],
      unresolvedProblem: [],
      unresolvedRisk: [],
      submitReady: true,
      requiresConfirmation: true,
    },
    (payload) => ({
      operationMode: payload.operationMode,
      remark: payload.remark,
    })
  )

  assert.equal(status?.found, true)
  assert.equal(status?.draft?.operationMode, 'update')
  assert.equal(status?.draft?.remark, '完成日报查询页面联调')
  assert.match(String(status?.payload.content), /今日任务/)
})

test('does not mistake a local draft id for an existing OA report', () => {
  const status = resolveDailyReportStatus(
    {
      found: false,
      draftId: 'DRAFT-LOCAL',
      localStatus: 'READY',
      workDate: '2026-07-16',
      oaRecords: [],
    },
    () => ({ shouldNotExist: true })
  )

  assert.equal(status?.found, false)
  assert.equal(status?.draft, undefined)
  assert.equal(status?.payload.workDate, '2026-07-16')
})

test('accepts nested OA detail payloads without exposing transport fields', () => {
  const status = resolveDailyReportStatus(
    {
      found: true,
      auditId: 'audit-internal',
      detail: {
        workDate: '2026-07-16',
        content: '完整日报正文',
        remark: '工作总结',
      },
    },
    () => undefined
  )

  assert.equal(status?.found, true)
  assert.equal(status?.payload.content, '完整日报正文')
  assert.equal(status?.payload.remark, '工作总结')
})

test('treats an unchanged OA report as submitted instead of pending save', () => {
  assert.equal(
    isDailyReportPersisted({
      detailView: true,
      existingReport: true,
      submitted: false,
      hasUnsavedChanges: false,
    }),
    true
  )
})

test('marks an existing OA report pending only after the user edits it', () => {
  const hasUnsavedChanges = hasUnsavedDailyReportChanges({
    currentRemark: '修改后的工作总结',
    savedRemark: '原工作总结',
    currentOverdueReasons: { 'task:1': '依赖未就绪' },
    savedOverdueReasons: { 'task:1': '依赖未就绪' },
  })

  assert.equal(hasUnsavedChanges, true)
  assert.equal(
    isDailyReportPersisted({
      detailView: true,
      existingReport: true,
      submitted: false,
      hasUnsavedChanges,
    }),
    false
  )
})

test('ignores empty overdue-reason keys when checking report edits', () => {
  assert.equal(
    hasUnsavedDailyReportChanges({
      currentRemark: '工作总结',
      savedRemark: '工作总结',
      currentOverdueReasons: { 'task:1': '', 'task:2': ' 原因 ' },
      savedOverdueReasons: { 'task:2': '原因' },
    }),
    false
  )
})

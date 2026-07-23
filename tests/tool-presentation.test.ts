import assert from 'node:assert/strict'
import test from 'node:test'
import {
  oaToolNames,
  parseOaToolResult,
  publicToolMessage,
  safeToolFallbackPresentation,
} from '../src/features/agents/tool-ui/tool-presentation.ts'

test('registers the work-hour query as a business tool', () => {
  assert.equal(oaToolNames.has('getUserWorkHours'), true)
  assert.deepEqual(
    parseOaToolResult(
      {
        toolName: 'getUserWorkHours',
        success: true,
        message: '已查询到 1 条工时记录。',
        result: { summary: { recordCount: 1 } },
      },
      'getUserWorkHours'
    ),
    {
      toolName: 'getUserWorkHours',
      success: true,
      message: '已查询到 1 条工时记录。',
      errorCode: undefined,
      result: { summary: { recordCount: 1 } },
    }
  )
})

test('unknown tools use a status-only presentation without protocol details', () => {
  const presentation = safeToolFallbackPresentation({
    toolName: 'internalAdminLookup',
    argsText: '{"userId":"1171"}',
    result: {
      auditId: 'audit-secret',
      errorCode: 'INTERNAL_ENDPOINT_ERROR',
    },
    status: {
      type: 'incomplete',
      error: 'stack trace: secret',
    } as { type: string },
  })
  const visibleText = JSON.stringify(presentation)

  assert.deepEqual(presentation, {
    title: '业务操作未完成',
    detail: '未收到可用的业务结果，请根据最终回复重试。',
    state: 'failed',
  })
  assert.doesNotMatch(
    visibleText,
    /internalAdminLookup|userId|1171|audit|INTERNAL_ENDPOINT_ERROR|stack trace/
  )
  assert.equal(
    parseOaToolResult({ success: true }, 'internalAdminLookup'),
    undefined
  )
})

test('filters internal codes and identifiers from server messages', () => {
  assert.equal(
    publicToolMessage(
      '缺少 MISSING_WORK_HOURS，请调用 getUserWorkHours',
      '请先登记有效工时。'
    ),
    '请先登记有效工时。'
  )
  assert.equal(
    publicToolMessage('读取 /internal/work-hours 失败', '暂时无法读取工时。'),
    '暂时无法读取工时。'
  )
  assert.equal(
    publicToolMessage('Tool execution failed', '业务操作暂未完成。'),
    '业务操作暂未完成。'
  )
  assert.equal(
    publicToolMessage('该日期范围内未查询到已登记工时。'),
    '该日期范围内未查询到已登记工时。'
  )
})

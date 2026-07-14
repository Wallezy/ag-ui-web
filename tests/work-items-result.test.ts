import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseWorkItemsResult,
  workItemQueryPresentation,
} from '../src/features/agents/work-items-result.ts'

test('treats a complete empty response as a real empty result', () => {
  const result = parseWorkItemsResult({
    items: [],
    count: 0,
    queryStatus: 'COMPLETE',
    completeness: {
      status: 'COMPLETE',
      complete: true,
      availableTypeCount: 2,
      unavailableTypeCount: 0,
    },
    errors: [],
  })

  assert.ok(result)
  assert.equal(result.completeness.status, 'COMPLETE')
  const presentation = workItemQueryPresentation(
    result,
    '当前条件下没有查询到工作项。'
  )
  assert.equal(presentation.badge, '查询完整')
  assert.equal(presentation.emptyTitle, '当前没有符合条件的工作项')
  assert.match(presentation.emptyDescription, /调整日期范围或工作项类型/)
})

test('keeps available items and explains which data is missing on partial success', () => {
  const result = parseWorkItemsResult({
    items: [{ id: 'task:1', title: '完成查询体验优化' }],
    count: 1,
    queryStatus: 'PARTIAL',
    queriedWorkItemTypes: ['task', 'requirement'],
    completeness: {
      status: 'PARTIAL',
      complete: false,
      unavailableWorkItemTypes: ['requirement'],
      unavailableWorkItemTypeNames: ['需求'],
    },
    errors: [
      {
        type: 'requirement',
        typeName: '需求',
        scope: 'WORK_ITEMS',
        errorCode: 'INTERNAL_ENDPOINT_ERROR',
        message: '/internal/requirement/page failed',
      },
    ],
  })

  assert.ok(result)
  assert.equal(result.completeness.status, 'PARTIAL')
  assert.deepEqual(result.completeness.unavailableWorkItemTypeNames, ['需求'])
  const presentation = workItemQueryPresentation(result)
  assert.equal(presentation.badge, '结果不完整')
  assert.match(presentation.noticeDescription ?? '', /需求暂时未能读取/)
  assert.doesNotMatch(
    JSON.stringify(presentation),
    /INTERNAL_ENDPOINT_ERROR|\/internal\/requirement\/page/
  )
})

test('never presents a total query failure as no matching work items', () => {
  const result = parseWorkItemsResult({
    items: [],
    count: 0,
    queryStatus: 'FAILED',
    queriedWorkItemTypes: ['task', 'bug'],
    completeness: {
      status: 'FAILED',
      complete: false,
      availableTypeCount: 0,
      unavailableTypeCount: 2,
      unavailableWorkItemTypes: ['task', 'bug'],
      unavailableWorkItemTypeNames: ['任务', '缺陷'],
    },
    errors: [],
  })

  assert.ok(result)
  const presentation = workItemQueryPresentation(result)
  assert.equal(presentation.badge, '查询失败')
  assert.equal(presentation.countLabel, '未读取')
  assert.equal(presentation.emptyTitle, '暂时无法读取工作项')
  assert.doesNotMatch(presentation.emptyTitle, /没有.*工作项/)
  assert.match(presentation.emptyDescription, /重新查询/)
})

test('infers failure from legacy page errors when every requested type failed', () => {
  const result = parseWorkItemsResult({
    items: [],
    count: 0,
    queriedWorkItemTypes: ['task'],
    errors: [
      {
        type: 'task',
        typeName: '任务',
        phase: 'page',
        errorCode: 'TASK_PAGE_FAILED',
      },
    ],
  })

  assert.ok(result)
  assert.equal(result.completeness.status, 'FAILED')
  assert.deepEqual(result.completeness.unavailableWorkItemTypes, ['task'])
})

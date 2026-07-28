import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyReportDraftStatus } from '../src/features/agents/api.ts'

test('scopes daily-report draft status reads to the current conversation', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(
      JSON.stringify({
        draftId: 'DRAFT/1',
        status: 'READY',
        submitted: false,
        submissionPending: false,
        submitReady: true,
        requiresConfirmation: true,
        overdueReasons: {},
        message: '日报草稿待确认',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    )
  }

  try {
    const result = await getDailyReportDraftStatus(
      'DRAFT/1',
      'thread web/project-manager'
    )

    assert.equal(result.draftId, 'DRAFT/1')
    assert.equal(
      requestedUrl,
      '/api/agent/daily-report-drafts/DRAFT%2F1' +
        '?conversationId=thread%20web%2Fproject-manager'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

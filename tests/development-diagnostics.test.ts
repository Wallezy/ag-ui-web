import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBackendDiagnostics } from '../src/features/agents/development-diagnostics-data.ts'

test('parses only the sanitized stable diagnostics contract', () => {
  const parsed = parseBackendDiagnostics({
    status: 'UP',
    oaDevelopmentDiagnostics: {
      activeProfiles: ['dev-stable', 'invalid/profile'],
      publicEventSchemaVersion: 3,
      taskStateSchemaVersion: 1,
      calibration: { executionEligible: false, source: 'private/path' },
      secret: 'must-not-appear',
    },
    agentRuntimeErrorCount: 2,
  })

  assert.deepEqual(parsed, {
    status: 'UP',
    activeProfiles: ['dev-stable'],
    publicEventSchemaVersion: 3,
    taskStateSchemaVersion: 1,
    calibrationExecutionEligible: false,
    agentRuntimeErrorCount: 2,
  })
  assert.equal(JSON.stringify(parsed).includes('must-not-appear'), false)
  assert.equal(JSON.stringify(parsed).includes('private/path'), false)
})

test('treats a missing or malformed runtime error count as unknown', () => {
  const parsed = parseBackendDiagnostics({
    status: 'UP',
    oaDevelopmentDiagnostics: { activeProfiles: ['dev-stable'] },
    agentRuntimeErrorCount: 'not-a-number',
  })

  assert.equal(parsed?.agentRuntimeErrorCount, null)
})

test('fails closed when development diagnostics are unavailable', () => {
  assert.equal(parseBackendDiagnostics({ status: 'UP' }), null)
})

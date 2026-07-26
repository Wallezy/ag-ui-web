import assert from 'node:assert/strict'
import test from 'node:test'
import {
  displayRevision,
  parseBackendDiagnostics,
} from '../src/features/agents/development-diagnostics-data.ts'

test('parses only the sanitized stable diagnostics contract', () => {
  const parsed = parseBackendDiagnostics({
    status: 'UP',
    oaV2EffectiveConfig: {
      rolloutStage: 'dev-stable',
      backendRevision: 'a'.repeat(40),
      frontendRevision: 'b'.repeat(40),
      activeProfiles: ['dev-stable', 'invalid/profile'],
      publicEventSchemaVersion: 3,
      taskStateSchemaVersion: 1,
      calibration: { executionEligible: false, source: 'private/path' },
      secret: 'must-not-appear',
    },
  })

  assert.deepEqual(parsed, {
    status: 'UP',
    rolloutStage: 'dev-stable',
    backendRevision: 'a'.repeat(40),
    expectedFrontendRevision: 'b'.repeat(40),
    activeProfiles: ['dev-stable'],
    publicEventSchemaVersion: 3,
    taskStateSchemaVersion: 1,
    calibrationExecutionEligible: false,
  })
  assert.equal(JSON.stringify(parsed).includes('must-not-appear'), false)
  assert.equal(JSON.stringify(parsed).includes('private/path'), false)
  assert.equal(displayRevision('a'.repeat(40)), 'a'.repeat(12))
})

test('fails closed when the effective config is unavailable', () => {
  assert.equal(parseBackendDiagnostics({ status: 'UP' }), null)
})

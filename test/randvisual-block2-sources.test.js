import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RAND_VISUAL_SOURCES,
  RandVisualSourceRole,
  assertRandVisualSources,
  createRandVisualImagePlan,
  getRandVisualSource,
} from '../src/randai/visual/index.js'

test('RandVisual keeps external visual repositories as governed non-runtime sources', () => {
  assert.equal(assertRandVisualSources(), true)
  assert.equal(RAND_VISUAL_SOURCES.length, 2)

  const diagram = getRandVisualSource('diagram-design')
  assert.equal(diagram.role, RandVisualSourceRole.ADAPT)
  assert.equal(diagram.runtimeDependency, false)
  assert.equal(diagram.remoteExecution, false)

  const images = getRandVisualSource('awesome-gpt-image-2')
  assert.equal(images.role, RandVisualSourceRole.SOURCE_ONLY)
  assert.equal(images.runtimeDependency, false)
  assert.equal(images.remoteExecution, false)
  assert.equal(images.copyThirdPartyCasePrompts, false)
  assert.equal(images.commercialRightsReviewRequired, true)
})

test('RandVisual image plans preserve hotel scope, draft authority and sensitive-data minimization', () => {
  assert.throws(
    () => createRandVisualImagePlan({ objective: 'procedura visiva' }),
    /hotelId/,
  )

  const plan = createRandVisualImagePlan({
    hotelId: 'hotel-gio',
    objective: 'crea una procedura visuale per il personale',
    sensitive: true,
  })

  assert.equal(plan.hotelId, 'hotel-gio')
  assert.equal(plan.pipeline, 'GENERATIVE_IMAGE_PROMPT')
  assert.equal(plan.outputAuthority, 'DRAFT_UNTIL_USER_OR_WORKFLOW_APPROVAL')
  assert.equal(plan.providerBoundary, 'APPROVED_IMAGE_PROVIDER_ONLY')
  assert.equal(plan.provenanceRequired, true)
  assert.equal(plan.allowRemoteCodeExecution, false)
  assert.equal(plan.allowRuntimeSourceInstall, false)
  assert.equal(plan.copyThirdPartyCasePrompts, false)
  assert.equal(plan.commercialRightsReviewRequired, true)
  assert.equal(plan.dataPolicy, 'MINIMIZE_AND_REDACT_BEFORE_RENDER')
})

test('RandVisual rejects source registries that introduce runtime or remote execution', () => {
  assert.throws(
    () => assertRandVisualSources([
      {
        id: 'bad-runtime',
        repository: 'example/bad-runtime',
        role: RandVisualSourceRole.ADAPT,
        runtimeDependency: true,
        remoteExecution: false,
      },
    ]),
    /runtime dependency/,
  )

  assert.throws(
    () => assertRandVisualSources([
      {
        id: 'bad-remote',
        repository: 'example/bad-remote',
        role: RandVisualSourceRole.SOURCE_ONLY,
        runtimeDependency: false,
        remoteExecution: true,
      },
    ]),
    /remote code/,
  )
})

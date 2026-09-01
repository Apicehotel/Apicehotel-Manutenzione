import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyHorizontalSwipe } from '../src/randapp/swipe-navigation.js'

test('left swipe opens only after a deliberate horizontal gesture', () => {
  assert.equal(classifyHorizontalSwipe({ x: 320, y: 400 }, { x: 210, y: 410 }), 'left')
  assert.equal(classifyHorizontalSwipe({ x: 210, y: 400 }, { x: 320, y: 410 }), 'right')
})

test('short, vertical and edge gestures are ignored', () => {
  assert.equal(classifyHorizontalSwipe({ x: 320, y: 400 }, { x: 270, y: 405 }), null)
  assert.equal(classifyHorizontalSwipe({ x: 320, y: 400 }, { x: 220, y: 480 }), null)
  assert.equal(classifyHorizontalSwipe({ x: 8, y: 400 }, { x: 120, y: 405 }), null)
})

test('thresholds can be tuned without changing the gesture contract', () => {
  assert.equal(classifyHorizontalSwipe({ x: 200, y: 200 }, { x: 150, y: 205 }, { minDistance: 40 }), 'left')
})

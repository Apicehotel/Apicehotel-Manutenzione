import test from 'node:test'
import assert from 'node:assert/strict'
import { compareHealthChecks, normalizeHealthCheck, summarizeHealthHistory } from '../src/randai/core/health-snapshot.js'

const finding=(fingerprint,severity='WARN')=>({fingerprint,severity,title:fingerprint})

test('health snapshot normalizes unknown state and clamps score',()=>{
  const item=normalizeHealthCheck({status:'BOGUS',score:140,findings:[{title:'x'}]})
  assert.equal(item.status,'UNKNOWN')
  assert.equal(item.score,100)
  assert.equal(item.findings[0].severity,'INFO')
})

test('drift detects new and resolved findings',()=>{
  const previous={status:'DEGRADED',score:70,findings:[finding('a'),finding('b','HIGH')]}
  const current={status:'DEGRADED',score:76,findings:[finding('b','HIGH'),finding('c')]}
  const drift=compareHealthChecks(current,previous)
  assert.equal(drift.direction,'BETTER')
  assert.equal(drift.scoreDelta,6)
  assert.deepEqual(drift.newFindings.map((x)=>x.fingerprint),['c'])
  assert.deepEqual(drift.resolvedFindings.map((x)=>x.fingerprint),['a'])
})

test('drift worsens on status or severity regression',()=>{
  const previous={status:'HEALTHY',score:100,findings:[finding('a','INFO')]}
  const current={status:'CRITICAL',score:60,findings:[finding('a','CRITICAL')]}
  const drift=compareHealthChecks(current,previous)
  assert.equal(drift.direction,'WORSE')
  assert.equal(drift.worsened,true)
})

test('history summary keeps latest and previous',()=>{
  const summary=summarizeHealthHistory([{id:'2',status:'HEALTHY',score:95},{id:'1',status:'DEGRADED',score:80}])
  assert.equal(summary.latest.id,'2')
  assert.equal(summary.previous.id,'1')
  assert.equal(summary.drift.direction,'BETTER')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { clearVisualViewportState, syncVisualViewportState } from '../src/randapp/system-insets.js'

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const adaptive=read('src/randapp/adaptive-layout.css')
const detail=read('src/randapp/operational-detail.css')
const coherence=read('src/randapp/ui-coherence.css')
const bridge=read('src/randapp/system-insets.js')

function withDocument(run) {
  const oldDocument=global.document
  const values=new Map()
  const dataset={}
  global.document={documentElement:{dataset,style:{
    setProperty:(name,value)=>values.set(name,value),
    removeProperty:(name)=>values.delete(name),
  }}}
  try{return run({values,dataset})}finally{global.document=oldDocument}
}

test('one canonical viewport token drives shell focus mode and legacy full-screen surfaces',()=>{
  assert.match(adaptive,/--rs-app-viewport-height:\s*100dvh/)
  assert.match(adaptive,/--rs-app-viewport-min-height:\s*100svh/)
  assert.match(adaptive,/html\[data-keyboard-open='true'\][\s\S]*--rs-app-viewport-height:\s*var\(--rs-visual-viewport-height/)
  assert.match(detail,/height:\s*var\(--rs-app-viewport-height\)/)
  assert.match(detail,/min-height:\s*var\(--rs-app-viewport-min-height\)/)
  assert.doesNotMatch(detail,/html\[data-keyboard-open='true'\] \.rs-operational-detail/)
  assert.match(coherence,/\.rs-fullpage\s*\{[^}]*height:\s*var\(--rs-app-viewport-height\)/s)
})

test('visual viewport bridge distinguishes keyboard from browser chrome and tracks orientation',()=>{
  withDocument(({values,dataset})=>{
    syncVisualViewportState({innerHeight:844,innerWidth:390,visualViewport:{height:780,width:390,offsetTop:0}})
    assert.equal(dataset.keyboardOpen,'false')
    assert.equal(dataset.viewportOrientation,'portrait')
    assert.equal(values.get('--rs-visual-viewport-height'),'780px')

    syncVisualViewportState({innerHeight:844,innerWidth:390,visualViewport:{height:480,width:390,offsetTop:4}})
    assert.equal(dataset.keyboardOpen,'true')
    assert.equal(values.get('--rs-visual-viewport-offset-top'),'4px')

    syncVisualViewportState({innerHeight:390,innerWidth:844,visualViewport:{height:390,width:844,offsetTop:0}})
    assert.equal(dataset.keyboardOpen,'false')
    assert.equal(dataset.viewportOrientation,'landscape')
    assert.equal(values.get('--rs-visual-viewport-width'),'844px')
  })
})

test('visual viewport teardown clears transient tokens and datasets',()=>{
  withDocument(({values,dataset})=>{
    syncVisualViewportState({innerHeight:800,innerWidth:400,visualViewport:{height:500,width:400,offsetTop:0}})
    clearVisualViewportState()
    assert.equal(values.has('--rs-visual-viewport-height'),false)
    assert.equal(values.has('--rs-visual-viewport-width'),false)
    assert.equal('keyboardOpen' in dataset,false)
    assert.equal('viewportOrientation' in dataset,false)
  })
})

test('bridge observes browser resize, rotation and VisualViewport without device forks',()=>{
  assert.match(bridge,/window\.addEventListener\('resize', sync/)
  assert.match(bridge,/window\.addEventListener\('orientationchange', sync/)
  assert.match(bridge,/visualViewport\?\.addEventListener\('resize', sync/)
  assert.match(bridge,/visualViewport\?\.addEventListener\('scroll', sync/)
  assert.doesNotMatch(bridge,/iPhone|iPad|Android/)
})

test('large UI enlarges Focus Mode controls and narrow phones stack the dock',()=>{
  assert.match(adaptive,/html\[data-ui-size='large'\] \.rs-operational-dock > \.rs-btn[\s\S]*min-height:\s*max\(var\(--rs-control-h-lg\), 56px\)/)
  assert.match(adaptive,/@media \(max-width:\s*420px\)[\s\S]*html\[data-ui-size='large'\] \.rs-operational-dock[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(adaptive,/@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/)
  assert.match(adaptive,/@media \(min-width:\s*1200px\)/)
})

import { chromium, webkit } from 'playwright'
import assert from 'node:assert/strict'

const baseURL = process.env.CHAOS_BASE_URL || 'http://127.0.0.1:4174'
const projects = [
  ['chromium', chromium],
  ['webkit', webkit],
]

async function withFreshContext(browserType, fn) {
  const browser = await browserType.launch({ headless: true })
  const context = await browser.newContext()
  try { await fn(context) } finally { await context.close(); await browser.close() }
}

async function openHarness(context, { offline = true } = {}) {
  // Playwright's context offline mode also disconnects localhost. Bootstrap the
  // harness while online, then cut the network before exercising offline code.
  await context.setOffline(false)
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await api(page)
  if (offline) await context.setOffline(true)
  return page
}

async function api(page) {
  return page.evaluate(async () => {
    const m = await import('/src/offline-store.js')
    window.__offlineChaos = m
    return true
  })
}

async function status(page) { return page.evaluate(() => window.__offlineChaos.getOfflineStatus()) }
async function waitForStatus(page, expected, timeout = 5000) {
  await page.waitForFunction((wanted) => {
    const m = window.__offlineChaos
    if (!m) return false
    return m.getOfflineStatus().then((current) => Object.entries(wanted).every(([key, value]) => current[key] === value)).catch(() => false)
  }, expected, { timeout })
  return status(page)
}

for (const [name, browserType] of projects) {
  console.log(`\n[chaos] ${name}`)

  await withFreshContext(browserType, async (context) => {
    const page = await openHarness(context)
    const result = await page.evaluate(async () => {
      const m = window.__offlineChaos
      const tempId = m.makeOfflineId('offline-chaos')
      await m.enqueueMutation({ entity: 'chaos-compact', hotelId: 'hotelgio', action: 'create', tempId, payload: { title: 'prima' }, cachePayload: { title: 'prima' } })
      await m.enqueueMutation({ entity: 'chaos-compact', hotelId: 'hotelgio', action: 'update', targetId: tempId, payload: { title: 'seconda', priority: 'alta' }, cachePayload: { title: 'seconda', priority: 'alta' } })
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('apiceOffline'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      const tx = db.transaction('outbox', 'readonly')
      const rows = await new Promise((resolve, reject) => { const r = tx.objectStore('outbox').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      db.close(); return rows.map((row) => ({ action: row.action, payload: row.payload, revision: row.revision }))
    })
    assert.equal(result.length, 1); assert.equal(result[0].action, 'create'); assert.equal(result[0].payload.title, 'seconda'); assert.equal(result[0].payload.priority, 'alta'); assert.ok(result[0].payload.clientMutationId); assert.ok(result[0].revision >= 2); assert.equal((await status(page)).pending, 1)
  })

  await withFreshContext(browserType, async (context) => {
    const page = await openHarness(context)
    const blobId = await page.evaluate(async () => window.__offlineChaos.putOfflineBlob(new Blob([new Uint8Array([1,2,3,4,5])], { type:'image/jpeg' }), { hotelId:'hotelgio' }))
    await context.setOffline(false)
    await page.reload({ waitUntil:'domcontentloaded' })
    await api(page)
    await context.setOffline(true)
    const persisted = await page.evaluate(async (id) => { const row=await window.__offlineChaos.getOfflineBlob(id); return row ? { size:row.blob.size,type:row.blob.type,bytes:Array.from(new Uint8Array(await row.blob.arrayBuffer()))}:null }, blobId)
    assert.deepEqual(persisted,{size:5,type:'image/jpeg',bytes:[1,2,3,4,5]})
  })

  await withFreshContext(browserType, async (context) => {
    const page=await openHarness(context)
    await page.evaluate(async()=>{const m=window.__offlineChaos; const tempId=m.makeOfflineId('offline-cancel'); const blobId=await m.putOfflineBlob(new Blob(['photo'],{type:'image/jpeg'})); await m.enqueueMutation({entity:'chaos-cancel',hotelId:'hotelgio',action:'create',tempId,payload:{photo:`offline-blob:${blobId}`}}); await m.enqueueMutation({entity:'chaos-cancel',hotelId:'hotelgio',action:'delete',targetId:tempId})})
    const counts=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('apiceOffline');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); const readCount=(store)=>new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).count();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); const result={outbox:await readCount('outbox'),blobs:await readCount('blobs')};db.close();return result}); assert.deepEqual(counts,{outbox:0,blobs:0})
  })

  await withFreshContext(browserType, async(context)=>{const page=await openHarness(context); await page.evaluate(async()=>{const m=window.__offlineChaos;await m.enqueueMutation({entity:'chaos-retry',hotelId:'hotelgio',action:'update',targetId:'server-1',payload:{value:1}});m.registerOfflineHandler('chaos-retry',async()=>{throw new Error('forbidden')})}); await context.setOffline(false); await page.evaluate(()=>window.__offlineChaos.drainOfflineQueue()); let s=await waitForStatus(page,{pending:0,blocked:1});assert.equal(s.pending,0);assert.equal(s.blocked,1);const failureId=await page.evaluate(async()=>(await window.__offlineChaos.getOfflineFailures())[0].id);await page.evaluate(async(id)=>{const m=window.__offlineChaos;m.registerOfflineHandler('chaos-retry',async()=>({id:'server-1'}));await m.retryOfflineFailure(id,{force:true});await m.drainOfflineQueue()},failureId);s=await waitForStatus(page,{pending:0,blocked:0});assert.equal(s.pending,0);assert.equal(s.blocked,0)})

  await withFreshContext(browserType,async(context)=>{const page1=await openHarness(context); await context.setOffline(false); const page2=await openHarness(context,{offline:false}); await Promise.all([api(page1),api(page2)]);await context.setOffline(true);await page1.evaluate(async()=>{const m=window.__offlineChaos;await m.enqueueMutation({entity:'chaos-multitab',hotelId:'hotelgio',action:'update',targetId:'server-1',payload:{value:1}})});await context.setOffline(false);const install=(page)=>page.evaluate(()=>{window.__calls=0;window.__offlineChaos.registerOfflineHandler('chaos-multitab',async()=>{window.__calls+=1;await new Promise(r=>setTimeout(r,250));return{id:'server-1'}})});await Promise.all([install(page1),install(page2)]);await Promise.all([page1.evaluate(()=>window.__offlineChaos.drainOfflineQueue()),page2.evaluate(()=>window.__offlineChaos.drainOfflineQueue())]);await waitForStatus(page1,{pending:0});const calls=(await page1.evaluate(()=>window.__calls))+(await page2.evaluate(()=>window.__calls));assert.equal(calls,1);assert.equal((await status(page1)).pending,0)})

  await withFreshContext(browserType,async(context)=>{const page=await openHarness(context);await page.evaluate(async()=>{const m=window.__offlineChaos;const temp=m.makeOfflineId('offline-parent');await m.enqueueMutation({entity:'chaos-parent',hotelId:'hotelgio',action:'create',tempId:temp,payload:{name:'parent'}});await m.enqueueMutation({entity:'chaos-child',hotelId:'hotelgio',action:'update',targetId:temp,payload:{name:'child'}});m.registerOfflineHandler('chaos-parent',async()=>({id:'real-parent-1'}));m.registerOfflineHandler('chaos-child',async(_op,targetId)=>{window.__resolvedTarget=targetId;return{id:targetId}})});await context.setOffline(false);await page.evaluate(()=>window.__offlineChaos.drainOfflineQueue());await waitForStatus(page,{pending:0});assert.equal(await page.evaluate(()=>window.__resolvedTarget),'real-parent-1');assert.equal((await status(page)).pending,0)})
}
console.log('\nOffline chaos gate OK: compaction, persistence, cleanup, failure recovery, multi-tab lease and temp-ID replay verified on Chromium + WebKit')

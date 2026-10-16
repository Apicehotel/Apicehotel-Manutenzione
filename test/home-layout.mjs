import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium, webkit } from 'playwright'

const root = process.cwd()
const artifacts = path.join(root, 'test/artifacts')
await fs.mkdir(artifacts, { recursive: true })
const cssImports = async file => (await fs.readFile(path.join(root, file), 'utf8')).split('\n')
  .filter(line => /^import ['"].*\.css['"]/.test(line))
  .map(line => line.replace(/(['"])([^'"]+)\1/, (_all, _quote, css) => JSON.stringify(path.resolve(root, path.dirname(file), css))))
const mocks = {
  '@tanstack/react-query': `export class QueryClient { invalidateQueries(){} }
    const client = new QueryClient(); export const useQueryClient=()=>client;
    export const QueryClientProvider=({children})=>children;
    export const useQuery=({queryKey})=>({data:queryKey[2]==='issues'?{issues:[]}:queryKey[2]==='presence'?{ok:true,people:[]}:queryKey[2]==='reminders'?[]:queryKey[2]==='weather'?null:{items:[]},isLoading:false,isError:false});`,
  'issues-data.js': 'export const fetchIssues=async()=>({issues:[]});',
  'urgents-data.js': 'export const fetchUrgents=async()=>({items:[]});',
  'planned-data.js': 'export const fetchPlanned=async()=>({items:[]});',
  'weather-data.js': 'export const fetchOperationalWeather=async()=>null;',
  'home-presence.js': 'export const fetchPeopleInStructure=async()=>({ok:true,people:[]}); export const buildColleaguePresenceRows=()=>[];',
  'offline-store.js': 'export const getOfflineStatus=async()=>null;export const drainOfflineQueue=async()=>{};',
  'reminder-data.js': 'export const fetchReminders=async()=>[];',
  'permissions.js': 'export const canUser=()=>true;',
  'session.js': 'export const loadSession=()=>({hotelId:"hotelgio"});',
  'supabase.js': `export const supabase={functions:{invoke:async()=>{
    const f=window.presenceFixture;
    if(f.failRead)return {error:new Error('Lettura presenza non disponibile')};
    return {data:{ok:true,eligible:f.role==='admin',role:f.role,present:f.present,hotel_id:f.hotelId}};
  }}};`,
  'auth-data.js': `export const setOwnPresence=async(present,hotelId)=>{
    const f=window.presenceFixture;
    if(!navigator.onLine||f.failWrite)throw new Error('Salvataggio presenza non riuscito');
    f.writes.push({present,hotelId});f.present=present;f.hotelId=hotelId;
    return {in_struttura:present,in_struttura_hotel_id:hotelId};
  };`,
  'RandAIPriorityCard.jsx': 'export default function Priority(){return null}',
}
const css = [...await cssImports('src/main.jsx'), ...await cssImports('src/randapp/Shell.jsx')].join('\n')
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
  import Home from './src/randapp/Home.jsx';
  import PresenceChip from './src/randapp/PresenceChip.jsx';
  import {RandTopbar,RandDesktopSidebar,RandMobileNav,RandSwipeStage} from './src/randapp/v2/RandChrome.jsx';
  import {Icon,IconButton,ThemeSwitch} from './src/randapp/ui.jsx';
  import {setThemeChoice} from './src/randapp/theme.js';
  ${css}
  const params=new URLSearchParams(location.search);
  document.documentElement.dataset.uiSize=params.get('size')||'normal';
  setThemeChoice(params.get('theme')||'light');
  window.presenceFixture={present:false,hotelId:null,writes:[],role:params.get('role')||'admin',failRead:params.get('read')==='fail',failWrite:false};
  const initialHotel={id:'hotelgio',name:'Hotel Giò'};const user={id:'fixture',name:'Randagio',role:window.presenceFixture.role};
  const nav=[['operations','wrench','Operatività'],['issues','issues','Segnalazioni'],['home','home','Home'],['my-work','check','Task'],['planning-work','calendar','Planning']].map(([id,icon,label],slot)=>({id,icon,label,slot:slot+1}));
  function Fixture(){const [view,setView]=React.useState('home');const [hotel,setHotel]=React.useState(initialHotel);return <div className="rs-root"><div className="rnx-app">
    <RandDesktopSidebar brand={<><img src="/logos/randapp-hotelgio.webp" alt=""/><div className="rnx-brandcopy"><b>RandApp</b><small>Hotel Giò</small></div></>} navigation={<nav>{nav.map(n=><button className="rs-sidebar__item" key={n.id} onClick={()=>setView(n.id)}><Icon name={n.icon}/><span>{n.label}</span></button>)}</nav>} onLogout={()=>{}}/>
    <RandTopbar hotel={<button className="rnx-hotelchip" aria-label="Cambia struttura" onClick={()=>setHotel(hotel.id==='hotelgio'?{id:'chocohotel',name:'Chocohotel'}:initialHotel)}><img src="/logos/randapp-hotelgio.webp" alt="Hotel Giò"/><span><small>Struttura</small><b>Hotel Giò</b></span><Icon name="chevronDown"/></button>} presence={<PresenceChip user={user} hotel={hotel}/>} themeSwitch={<ThemeSwitch/>} notifications={<span className="rnx-notify"><IconButton icon="bell" label="Notifiche"/></span>} randai={<button aria-label="Apri RandAI"/>} profile={<button className="rnx-profile" aria-label="Apri menu"><span className="rnx-profile__avatar">R</span><span className="rnx-profile__copy"><b>Randagio</b><small>admin</small></span></button>}/>
    <RandSwipeStage items={nav} isActive={n=>n.id===view} onPick={n=>setView(n.id)}><main className="rnx-content"><Home hotel={hotel} user={user} onNavigate={setView}/><section className="rs-card rs-card--pad" data-testid="shared-form"><div className="rs-pagehead"><div><h2>Richiesta di manutenzione con intestazione lunga</h2></div></div><label className="rs-field">Categoria<select className="rs-select" aria-label="Categoria"><option>Manutenzione ordinaria e straordinaria</option></select></label></section><output data-testid="fixture-navigation">{view}</output></main></RandSwipeStage>
    <RandMobileNav items={nav} isActive={n=>n.id===view} onPick={n=>setView(n.id)}/>
  </div></div>}
  createRoot(document.getElementById('root')).render(<Fixture/>);`
const output = path.join(artifacts, 'home-layout-bundle')
const bundled = await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, absWorkingDir: root, bundle: true, write: false, outdir: output, entryNames: 'fixture', loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.webp': 'file', '.svg': 'file' }, define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic', plugins: [{ name: 'layout-only-data', setup(builder) {
  builder.onResolve({ filter: /./ }, args => {
    if (args.path.startsWith('/logos/')) return { path: args.path, external: true }
    const key = args.path === '@tanstack/react-query' ? args.path : path.basename(args.path)
    if (key in mocks) return { path: key, namespace: 'layout-data' }
  })
  builder.onLoad({ filter: /.*/, namespace: 'layout-data' }, args => ({ contents: mocks[args.path], loader: 'jsx', resolveDir: root }))
} } ] })
const files = new Map(bundled.outputFiles.map(file => [path.relative(output, file.path).split(path.sep).join('/'), Buffer.from(file.contents)]))
files.set('index.html', Buffer.from('<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>'))
if (process.env.HOME_LAYOUT_BUILD_ONLY === '1') { console.log('Home layout fixture built'); process.exit(0) }
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch({ headless: true })
  try {
    for (const size of ['normal','small','large']) {
    for (const width of (size === 'normal' ? [320,390,768,1254,1440] : [320,1254])) {
      for (const theme of ['light','dark']) {
        const context = await browser.newContext({ viewport: { width, height: 884 } })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.route('**/__home_layout/**', async route => {
          const pathname = new URL(route.request().url()).pathname.split('/__home_layout/')[1]
          const bytes = files.get(pathname)
          const ext = path.extname(pathname)
          await route.fulfill({ status: bytes ? 200 : 404, contentType: { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.woff':'font/woff' }[ext] || 'application/octet-stream', body: bytes || 'Not found' })
        })
        // Any accidental operational request fails the fixture instead of using live data.
        await page.route('**/*.supabase.co/**', route => route.abort())
        await page.goto(`${base}/__home_layout/index.html?theme=${theme}&size=${size}`, { waitUntil: 'domcontentloaded' })
        await page.getByTestId('home-stats').waitFor()
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        await page.screenshot({ path: path.join(artifacts, `home-layout-${engineName}-${width}-${theme}${size==='normal'?'':'-'+size}.png`), fullPage: true })
        assert.equal(await page.getByLabel('Apri RandAI', { exact: true }).count(), 0)
        const presence=page.getByTestId('presence-chip')
        await presence.waitFor()
        await page.waitForFunction(()=>document.querySelector('[data-testid="presence-chip"]')?.dataset.presence==='out')
        await presence.click()
        await page.waitForFunction(()=>document.querySelector('[data-testid="presence-chip"]')?.dataset.here==='true')
        assert.match(await presence.innerText(), /Sono fuori struttura/)
        await presence.click()
        await page.waitForFunction(()=>document.querySelector('[data-testid="presence-chip"]')?.dataset.presence==='out')
        assert.deepEqual(await page.evaluate(()=>window.presenceFixture.writes),[{present:true,hotelId:'hotelgio'},{present:false,hotelId:null}])
        assert.equal(errors.length, 0, errors.join('\n'))
        const geometry = await page.evaluate(() => {
          const inside=(child,parent)=>{const c=child.getBoundingClientRect(),p=parent.getBoundingClientRect();return c.left>=p.left-1&&c.right<=p.right+1&&c.top>=p.top-1&&c.bottom<=p.bottom+1}
          return { overflow: document.documentElement.scrollWidth-innerWidth,
            icons: [...document.querySelectorAll('.rs-randui-statcard__icon')].every(el=>inside(el,el.closest('.rs-randui-statcard'))),
            heads: [...document.querySelectorAll('.rnx-panel__head,.rnx-tray>.rnx-desk__head')].every(el=>inside(el,el.parentElement)),
            chart: inside(document.querySelector('.rnx-chartcard__plot'),document.querySelector('.rnx-chartcard')),
            deskGap: innerWidth < 1000 || document.querySelector('.rnx-tools').getBoundingClientRect().top - document.querySelector('.rnx-desk').getBoundingClientRect().bottom <= 24,
            header: [...document.querySelectorAll('.rnx-topbar__actions>*,.rnx-topbar__hotel,.rnx-topbar__presence')].every(el=>inside(el,document.querySelector('.rnx-topbar'))),
          }
        })
        assert.ok(geometry.overflow <= 1, `${engineName}/${width}/${theme}: overflow ${geometry.overflow}`)
        for (const key of ['icons','heads','chart','header','deskGap']) assert.equal(geometry[key], true, `${engineName}/${width}/${theme}: ${key} out of bounds`)
        await page.getByLabel('Visualizzazione grafico Home').selectOption('hidden')
        assert.equal(await page.getByTestId('home-week-chart').count(), 0)
        await page.getByLabel('Visualizzazione grafico Home').selectOption('compact')
        await page.getByTestId('home-week-chart').waitFor()
        await page.screenshot({ path: path.join(artifacts, `home-layout-${engineName}-${width}-${theme}${size==='normal'?'':'-'+size}-compact.png`), fullPage: true })
        const navBoxes=await page.locator('.rnx-bottomnav__item').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom})))
        if(width<768) assert.ok(navBoxes.every(box=>Math.abs(box.top-navBoxes[0].top)<=1 && Math.abs(box.bottom-navBoxes[0].bottom)<=1),'bottom nav stays on one row')
        const chipBox=await presence.boundingBox()
        assert.ok(chipBox.height>=40 && chipBox.width>=44, 'presence touch target')
        const field=page.getByLabel('Categoria')
        const fieldBox=await field.boundingBox()
        assert.ok(fieldBox.x>=0 && fieldBox.x+fieldBox.width<=width+1,'shared select containment')
        // Pointer gestures must leave interactive controls in their current destination.
        await field.evaluate(el=>{
          el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:1,clientX:250,clientY:50}));
          el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:1,clientX:50,clientY:50}));
        })
        assert.equal(await page.getByTestId('fixture-navigation').innerText(),'home')
        await page.getByTestId('shared-form').evaluate(el=>{
          el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:1,clientX:250,clientY:50}));
          el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',isPrimary:true,pointerId:1,clientX:50,clientY:50}));
        })
        assert.equal(await page.getByTestId('fixture-navigation').innerText(),'my-work')
        assert.equal(await presence.isVisible(),true,'presence persists away from Home')
        if(width===390 && theme==='light' && size==='normal') {
          await page.evaluate(()=>{window.presenceFixture.failWrite=true})
          await presence.click()
          await page.getByRole('status').filter({hasText:'Salvataggio presenza non riuscito'}).waitFor()
          assert.equal(await presence.getAttribute('data-presence'),'out')
          await page.evaluate(()=>{window.presenceFixture.failWrite=false})
          await presence.click()
          await page.waitForFunction(()=>document.querySelector('[data-testid="presence-chip"]')?.dataset.here==='true')
          await page.getByLabel('Cambia struttura').click()
          await page.waitForFunction(()=>document.querySelector('[data-testid="presence-chip"]')?.dataset.here==='false')
          await presence.click()
          await page.waitForFunction(()=>window.presenceFixture.hotelId==='chocohotel')
          await page.goto(`${base}/__home_layout/index.html?theme=light&read=fail`)
          await page.getByTestId('presence-chip').waitFor()
          await page.getByRole('status').filter({hasText:'Servizio presenza temporaneamente non disponibile. Riprova.'}).waitFor()
          assert.equal(await page.getByTestId('presence-chip').getAttribute('data-presence'),'unknown')
          await page.getByTestId('presence-chip').click()
          await page.waitForFunction(()=>window.presenceFixture.present===true)
          await page.goto(`${base}/__home_layout/index.html?theme=light&role=reception`)
          await page.getByTestId('home-stats').waitFor()
          assert.equal(await page.getByTestId('presence-chip').count(),0)
        }
        await context.close()
      }
    }
    }
  } finally { await browser.close() }
}
console.log('Home layout OK: actual Home and topbar, 320/390/768/1254/1440, Chromium/WebKit, light/dark, card containment and chart interaction')

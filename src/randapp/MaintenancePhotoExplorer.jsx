import React, { useMemo, useState } from 'react'

/**
 * Read-only visual explorer for maintenance attachments.
 * Expects already-authorized photo records from the calling screen.
 * { id, url, title, hotel, location, interventionId, date, phase }
 * Does not fetch, upload, delete or change existing attachments.
 */
export default function MaintenancePhotoExplorer({ photos = [], onClose }) {
  const [path, setPath] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [compare, setCompare] = useState(false)
  const [zoom, setZoom] = useState(120)
  const [phase, setPhase] = useState('Tutte')
  const records = useMemo(() => photos.filter(p => p && typeof p.url === 'string' && /^https?:\/\/|^blob:|^data:image\//i.test(p.url)).map((p, i) => ({
    ...p, id: String(p.id ?? i), hotel: String(p.hotel || 'Senza hotel'),
    location: String(p.location || 'Ambiente non indicato'),
    interventionId: String(p.interventionId || 'Senza intervento'),
    phase: String(p.phase || 'Altro'),
    title: String(p.title || 'Foto manutenzione')
  })), [photos])
  const fields = ['hotel', 'location', 'interventionId']
  const filtered = useMemo(() => records.filter(p => {
    const matches = [p.title, p.hotel, p.location, p.interventionId, p.date, p.phase].join(' ').toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'))
    return matches && (phase === 'Tutte' || p.phase.toLocaleLowerCase('it') === phase.toLocaleLowerCase('it'))
      && path.every((name, level) => p[fields[level]] === name)
  }), [records, search, phase, path])
  const groups = path.length < 3 ? Array.from(new Set(filtered.map(p => p[fields[path.length]]))) : []
  const visible = path.length === 3 || search ? filtered : []
  const selectedRecord = selected ? records.find(p => p.id === selected) : null
  const pairs = selectedRecord ? records.filter(p => p.interventionId === selectedRecord.interventionId) : []
  const before = pairs.find(p => /prima/i.test(p.phase))
  const after = pairs.find(p => /dopo/i.test(p.phase))
  const css = `
    .rpe{color:var(--text-primary,#17202d);font:inherit;max-width:100%}
    .rpe button,.rpe input{font:inherit}.rpe button{cursor:pointer}
    .rpe-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}
    .rpe-btn{padding:8px 11px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;color:#17202d}
    .rpe-input{flex:1;min-width:150px;border:1px solid #cbd5e1;padding:10px;border-radius:9px}
    .rpe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--rpe-width),1fr));gap:12px}
    .rpe-folder,.rpe-photo{border:1px solid #dce4ec;background:#fff;border-radius:12px;padding:12px;min-width:0;text-align:left;color:#17202d}
    .rpe-folder{min-height:92px;display:flex;flex-direction:column;gap:12px;justify-content:center}
    .rpe-photo img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}
    .rpe-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650}
    .rpe-sub{display:block;color:#64748b;font-size:11px;margin-top:5px}
    .rpe-overlay{position:fixed;inset:0;z-index:2000;background:rgba(2,6,23,.88);padding:18px;display:flex;align-items:center;justify-content:center}
    .rpe-preview{background:#fff;color:#17202d;border-radius:14px;padding:16px;max-width:900px;max-height:95dvh;width:100%;overflow:auto}
    .rpe-preview img{max-width:100%;max-height:65dvh;object-fit:contain;border-radius:9px}
    .rpe-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    @media(max-width:560px){.rpe-pair{grid-template-columns:1fr}.rpe-preview img{max-height:42dvh}}
  `
  return <section className="rpe" aria-label="Esplora foto manutenzioni" style={{'--rpe-width': `${zoom}px`}}>
    <style>{css}</style>
    <header className="rpe-bar"><strong style={{flex:1}}>📷 Archivio foto manutenzioni</strong>{onClose && <button className="rpe-btn" onClick={onClose}>Chiudi</button>}</header>
    <nav className="rpe-bar" aria-label="Percorso foto">
      <button className="rpe-btn" disabled={!path.length} onClick={() => {setPath(path.slice(0,-1));setSelected(null)}}>←</button>
      <button className="rpe-btn" onClick={() => {setPath([]);setSearch('')}}>⌂ Hotel</button>
      {path.map((v,i) => <button key={i} className="rpe-btn" onClick={() => setPath(path.slice(0,i+1))}>{v}</button>)}
    </nav>
    <div className="rpe-bar">
      <input className="rpe-input" type="search" aria-label="Cerca foto" placeholder="Cerca camera, hotel, intervento…" value={search} onChange={e => setSearch(e.target.value)}/>
      <select className="rpe-btn" aria-label="Filtra fase" value={phase} onChange={e => setPhase(e.target.value)}>{['Tutte','Prima','Durante','Dopo','Altro'].map(x => <option key={x}>{x}</option>)}</select>
      <button className="rpe-btn" onClick={() => setZoom(Math.max(90,zoom-30))} aria-label="Riduci miniature">−</button>
      <button className="rpe-btn" onClick={() => setZoom(Math.min(240,zoom+30))} aria-label="Ingrandisci miniature">+</button>
    </div>
    <p className="rpe-sub">{filtered.length} foto nell'archivio selezionato · sola lettura</p>
    <div className="rpe-grid">
      {!search && groups.map(name => <button key={name} className="rpe-folder" onClick={() => setPath([...path,name])}><span aria-hidden="true" style={{fontSize:30}}>📁</span><span className="rpe-name">{name}</span><span className="rpe-sub">{filtered.filter(p => p[fields[path.length]]===name).length} foto</span></button>)}
      {visible.map(p => <button key={p.id} className="rpe-photo" onClick={() => {setSelected(p.id);setCompare(false)}}><img src={p.url} alt={p.title} loading="lazy"/><span className="rpe-name">{p.title}</span><span className="rpe-sub">{p.phase} · {p.date || p.location}</span></button>)}
    </div>
    {!groups.length && !visible.length && <p>Nessuna foto trovata per questi filtri.</p>}
    {selectedRecord && <div className="rpe-overlay" role="presentation" onClick={() => setSelected(null)}>
      <div className="rpe-preview" role="dialog" aria-modal="true" aria-label="Anteprima foto" onClick={e => e.stopPropagation()}>
        <div className="rpe-bar"><strong style={{flex:1}}>{selectedRecord.title}</strong><button className="rpe-btn" onClick={() => setSelected(null)}>✕ Chiudi</button></div>
        {compare && before && after ? <div className="rpe-pair"><figure><img src={before.url} alt="Prima"/><figcaption>Prima</figcaption></figure><figure><img src={after.url} alt="Dopo"/><figcaption>Dopo</figcaption></figure></div> : <img src={selectedRecord.url} alt={selectedRecord.title}/>}
        <p className="rpe-sub">{selectedRecord.hotel} · {selectedRecord.location} · Intervento {selectedRecord.interventionId}</p>
        {before && after && <button className="rpe-btn" onClick={() => setCompare(!compare)}>{compare ? 'Foto singola' : 'Confronta prima / dopo'}</button>}
      </div>
    </div>}
  </section>
}

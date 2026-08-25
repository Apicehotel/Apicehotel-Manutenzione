const text = (value) => value == null ? '' : String(value).trim()

const isDateHeader = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true
  return /^\d{2}\/\d{2}\/\d{4}$/.test(text(value))
}

export function normalizeBrigantinoDescription(value) {
  const raw = text(value)
  if (!raw || /^\(?n\.a\.\)?$/i.test(raw) || /^totali?$/i.test(raw)) return null
  if (/^\d+\*$/.test(raw)) return { key:'LETTO_FISSO', label:'Letto fisso', fixedBed:true, source:raw }
  const cleaned = raw.replace(/\d+$/,'').replace(/[-_\s]+$/,'').trim()
  if (!cleaned) return null
  return { key:cleaned.toUpperCase(), label:cleaned.toUpperCase(), fixedBed:false, source:raw }
}

function sumValue(a,b) {
  const na = typeof a === 'number' && Number.isFinite(a) ? a : Number(a)
  const nb = typeof b === 'number' && Number.isFinite(b) ? b : Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na + nb
  if (Number.isFinite(na)) return na
  if (Number.isFinite(nb)) return nb
  return text(a) || text(b)
}

export function parseBrigantinoBookingRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return null
  const headerIndex = rows.findIndex((row) => text(row?.[0]).toLowerCase() === 'descrizione')
  if (headerIndex < 0) return null
  const header = rows[headerIndex] || []
  const metric = rows[headerIndex + 1] || []
  const dateColumns = header.reduce((out,value,index) => {
    if (index > 0 && isDateHeader(value)) out.push(index)
    return out
  },[])
  const looksLikeBrigantino = dateColumns.length >= 3 && metric.some((value)=>/room nights|presenze|revenue/i.test(text(value)))
  if (!looksLikeBrigantino) return null

  const width = Math.max(header.length,metric.length,...rows.slice(headerIndex+2).map((row)=>row.length))
  const headers = Array.from({length:width},(_,index)=>{
    if(index===0)return'DESCRIZIONE'
    const d=text(header[index]); const m=text(metric[index])
    return [d,m].filter(Boolean).join(' ')
  })
  const grouped = new Map()
  for (const row of rows.slice(headerIndex+2)) {
    const normalized = normalizeBrigantinoDescription(row?.[0])
    if (!normalized) continue
    const values = Array.from({length:width},(_,index)=>row[index]??'')
    values[0] = normalized.label
    const existing = grouped.get(normalized.key)
    if (!existing) grouped.set(normalized.key,{...normalized,values})
    else {
      for(let index=1;index<width;index+=1) existing.values[index]=sumValue(existing.values[index],values[index])
      existing.fixedBed ||= normalized.fixedBed
    }
  }
  const output = [...grouped.values()]
  if (!output.length) return null
  return {
    kind:'brigantino-report',
    hotelId:'brigantino',
    structureName:'Hotel Il Brigantino',
    headers,
    rows:output.map((item)=>item.values),
    normalizedDescriptions:output.map(({key,label,fixedBed,source})=>({key,label,fixedBed,source})),
  }
}

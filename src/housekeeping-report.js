const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

export const normalizeRoomType = (value) => {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return 'Standard'
  if (s.includes('accessibile') || s.includes('handicap')) return 'Accessibile'
  if (s.includes('suite')) return 'Suite'
  if (s.includes('cantina')) return 'Cantina'
  if (s.includes('superior')) return 'Superior'
  if (s.includes('quadrupla')) return 'Quadrupla'
  if (s.includes('tripla')) return 'Tripla'
  if (s.includes('singola')) return 'Singola'
  if (s.includes('economy')) return 'Economy'
  if (s.includes('matrimon')) return 'Matrimoniale'
  return 'Standard'
}

const classifySlope = (value) => {
  const s = String(value || '').toLowerCase()
  if (s.includes('partenza') && s.includes('arrivo')) return 'b2b'
  if (s.includes('partenza')) return 'partenza'
  if (s.includes('arrivo')) return 'arrivo'
  if (s.includes('soggiorno') || s.includes('fermata')) return 'fermata'
  return 'libera'
}

const shortDate = (value) => {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0,5)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}

// Privacy boundary del file Slope.
// Il parser costruisce oggetti nuovi e ignora deliberatamente tutte le colonne
// non necessarie: nessun nome ospite, contatto, identificativo prenotazione,
// tariffa o testo libero viene restituito o persistito. Le note Slope (row[8])
// NON vengono importate: le note operative devono nascere dentro RandApp.
export function parseSlopePrivacyRows(rows, roomMeta) {
  const found = new Map()
  for (const row of rows || []) {
    const camera = String(row?.[2] ?? '').trim()
    const meta = roomMeta?.[camera]
    if (!camera || !meta) continue
    const current = found.get(camera) || {
      camera,
      gruppo: meta.group || '',
      tipologia: normalizeRoomType(row?.[1]),
      letti: '',
      arrivo: '',
      partenza: '',
      states: [],
    }
    current.states.push(classifySlope(row?.[3]))
    current.arrivo ||= shortDate(row?.[4])
    current.partenza ||= shortDate(row?.[5])
    // Solo configurazione letto operativa; nessun altro campo del file entra.
    current.letti ||= String(row?.[7] || row?.[6] || '').trim()
    found.set(camera,current)
  }

  return Object.entries(roomMeta || {}).map(([camera,meta]) => {
    const item = found.get(camera) || {
      camera,
      gruppo: meta.group || '',
      tipologia: normalizeRoomType(meta.roomType),
      letti: '', arrivo: '', partenza: '', states: [],
    }
    const stato_slope = item.states.includes('partenza') && item.states.includes('arrivo')
      ? 'b2b'
      : item.states.find((state) => state !== 'libera') || 'libera'
    return {
      camera: item.camera,
      gruppo: item.gruppo,
      tipologia: item.tipologia || normalizeRoomType(meta.roomType),
      letti: item.letti,
      arrivo: item.arrivo,
      partenza: item.partenza,
      stato_slope,
    }
  })
}

const isoDate = (value) => {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
const dateLabel = (value) => {
  const d = isoDate(value)
  return d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : String(value || '')
}
const uniq = (values) => [...new Set(values.filter(Boolean))]
const safeSheetName = (name) => String(name).slice(0,31)

function monthMatrix(records, year, monthIndex) {
  const monthRows = records.filter((row) => {
    const d = isoDate(row.work_date)
    return d && d.getFullYear() === year && d.getMonth() === monthIndex
  })
  const names = uniq(monthRows.map((r) => r.housekeeper_name_snapshot)).sort((a,b)=>a.localeCompare(b,'it'))
  const types = uniq(monthRows.map((r) => normalizeRoomType(r.room_type))).sort((a,b)=>a.localeCompare(b,'it'))
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const effectiveTypes = types.length ? types : ['Standard']
  const rows = [[],[]]
  rows[0][0] = 'Governante'
  rows[1][0] = ''
  const merges = [{ s:{r:0,c:0}, e:{r:1,c:0} }]

  let col = 1
  for (let day=1; day<=daysInMonth; day += 1) {
    const start = col
    for (const type of effectiveTypes) rows[1][col++] = type
    rows[0][start] = dateLabel(new Date(year,monthIndex,day))
    merges.push({ s:{r:0,c:start}, e:{r:0,c:col-1} })
  }

  const monthlyStart = col
  for (const type of effectiveTypes) rows[1][col++] = type
  rows[1][col++] = 'Totale'
  rows[0][monthlyStart] = 'TOTALE MESE'
  merges.push({ s:{r:0,c:monthlyStart}, e:{r:0,c:col-1} })

  for (const name of names) {
    const out = [name]
    const own = monthRows.filter((r) => r.housekeeper_name_snapshot === name)
    for (let day=1; day<=daysInMonth; day += 1) {
      for (const type of effectiveTypes) {
        out.push(own.filter((r) => {
          const d = isoDate(r.work_date)
          return d && d.getDate()===day && normalizeRoomType(r.room_type)===type
        }).length)
      }
    }
    for (const type of effectiveTypes) out.push(own.filter((r)=>normalizeRoomType(r.room_type)===type).length)
    out.push(own.length)
    rows.push(out)
  }
  return { rows, merges, names, types: effectiveTypes }
}

function yearlySummary(records, year) {
  const yearRows = records.filter((r)=>isoDate(r.work_date)?.getFullYear()===year)
  const names = uniq(yearRows.map((r)=>r.housekeeper_name_snapshot)).sort((a,b)=>a.localeCompare(b,'it'))
  const types = uniq(yearRows.map((r)=>normalizeRoomType(r.room_type))).sort((a,b)=>a.localeCompare(b,'it'))
  const header = ['Governante', ...types, 'Totale anno']
  const rows = [header]
  for (const name of names) {
    const own = yearRows.filter((r)=>r.housekeeper_name_snapshot===name)
    rows.push([name, ...types.map((type)=>own.filter((r)=>normalizeRoomType(r.room_type)===type).length), own.length])
  }
  return rows
}

export async function exportHousekeepingYearXlsx({ hotelName, year, records }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (let month=0; month<12; month += 1) {
    const matrix = monthMatrix(records, year, month)
    const ws = XLSX.utils.aoa_to_sheet(matrix.rows)
    ws['!merges'] = matrix.merges
    ws['!cols'] = [{wch:24}, ...Array.from({length:Math.max(1,(matrix.rows[1]?.length||1)-1)},()=>({wch:12}))]
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(MONTHS_IT[month]))
  }
  const summary = XLSX.utils.aoa_to_sheet(yearlySummary(records,year))
  summary['!cols'] = [{wch:24}, ...Array.from({length:20},()=>({wch:14}))]
  XLSX.utils.book_append_sheet(wb, summary, 'Riepilogo Anno')
  const cleanHotel = String(hotelName || 'Hotel').replace(/[^a-zA-Z0-9À-ÿ_-]+/g,'_')
  XLSX.writeFile(wb, `Housekeeping_${cleanHotel}_${year}.xlsx`)
}

export { MONTHS_IT }

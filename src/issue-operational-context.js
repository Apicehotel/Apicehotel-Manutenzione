const clean = (value) => String(value ?? '').trim()

export const normalizeIssueAreaCode = (value) => clean(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'') || null

function finiteFloor(value) {
  if(value===null||value===undefined||value==='')return null
  const floor=Number(value)
  return Number.isFinite(floor)?floor:null
}

function groupContext(hotelId, groupName) {
  const name=clean(groupName)
  if(!name)return{}
  if(hotelId==='hotelgio') {
    const area=name.match(/^(Jazz|Wine)\b/i)?.[1]||''
    const floor=finiteFloor(name.match(/\bP(?:iano)?\s*(\d+)\b/i)?.[1])
    return {
      areaCode:area?normalizeIssueAreaCode(area):null,
      areaLabel:area?area[0].toUpperCase()+area.slice(1).toLowerCase():null,
      floorNumber:floor,
      floorLabel:floor===null?null:`Piano ${floor}`,
    }
  }
  const floor=finiteFloor(name.match(/\bP(?:iano)?\s*(\d+)\b/i)?.[1])
  return { floorNumber:floor, floorLabel:floor===null?null:`Piano ${floor}` }
}

export function inferIssueOperationalContext({ hotelId, catalog, mode, location, prefill=null }) {
  const normalizedMode=mode==='zona'?'zona':'camera'
  const value=clean(location)
  if(normalizedMode==='zona') {
    return { locationMode:'zona', roomNumber:null, areaCode:null, areaLabel:null, floorNumber:null, floorLabel:null, sourceModule:prefill?.sourceModule||null, sourceRef:prefill?.sourceRef||null }
  }

  const prefilled=clean(prefill?.location)===value ? prefill : null
  if(prefilled) {
    const floor=finiteFloor(prefilled.floorNumber)
    return {
      locationMode:'camera',
      roomNumber:value||null,
      areaCode:prefilled.areaCode||normalizeIssueAreaCode(prefilled.areaLabel),
      areaLabel:prefilled.areaLabel||null,
      floorNumber:floor,
      floorLabel:prefilled.floorLabel||(floor===null?null:`Piano ${floor}`),
      sourceModule:prefilled.sourceModule||null,
      sourceRef:prefilled.sourceRef||null,
    }
  }

  const group=(catalog?.roomGroups||[]).find((item)=>(item.rooms||[]).map(String).includes(value))
  const inferred=groupContext(hotelId,group?.name)
  return {
    locationMode:'camera',roomNumber:value||null,
    areaCode:inferred.areaCode||null,areaLabel:inferred.areaLabel||null,
    floorNumber:inferred.floorNumber??null,floorLabel:inferred.floorLabel||null,
    sourceModule:null,sourceRef:null,
  }
}

export function issueOperationalContextLabel(context) {
  return [context?.areaLabel,context?.floorLabel,context?.roomNumber?`Camera ${context.roomNumber}`:null].filter(Boolean).join(' · ')
}

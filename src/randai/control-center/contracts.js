export const ControlSection = Object.freeze({ ACTIVE:'ACTIVE', ATTENTION:'ATTENTION', PROPOSALS:'PROPOSALS', BLOCKED:'BLOCKED', COMPLETED:'COMPLETED' })

export function classifyControlItem(item={}) {
  const status=String(item.status||'')
  if(['RUNNING','PLANNED','ACTIONED'].includes(status)) return ControlSection.ACTIVE
  if(['BLOCKED','NEEDS_REVIEW','PENDING'].includes(status)) return ControlSection.BLOCKED
  if(['PROPOSED','RECOMMENDED'].includes(status)) return ControlSection.PROPOSALS
  if(['SUCCEEDED','RESOLVED','COMPLETED','PASSED'].includes(status)) return ControlSection.COMPLETED
  return ControlSection.ATTENTION
}

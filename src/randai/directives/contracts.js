export const DirectiveStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
})

export function createDirectiveId(sequence) {
  return `DIR-${String(sequence).padStart(4, '0')}`
}

const MANAGER_ROLES = new Set(['Direzione', 'Direttore Centro Congressi', 'Reception', 'admin'])

export const TECHNICIAN_DIRECTORY_MANAGER_ROLES = Object.freeze([...MANAGER_ROLES])

export function canManageTechnicianDirectory(user) {
  return MANAGER_ROLES.has(user?.role)
}

export function isAdmin(role?: string) {
  return role === 'admin' || role === 'superadmin';
}

export function isSuperAdmin(role?: string) {
  return role === 'superadmin';
}

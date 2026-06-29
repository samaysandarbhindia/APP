const ROLE_RANK = { viewer: 1, developer: 2, member: 2, admin: 3, owner: 4 };

export const normalizeRole = (role) => {
  const value = String(role || '').toLowerCase();
  if (value === 'member') return 'developer';
  return ['owner', 'admin', 'developer', 'viewer'].includes(value) ? value : 'viewer';
};

export const roleAtLeast = (role, minimum) => (ROLE_RANK[normalizeRole(role)] || 0) >= (ROLE_RANK[normalizeRole(minimum)] || 0);

export const canManageTeam = (role) => roleAtLeast(role, 'admin');
export const canManageKeys = (role) => roleAtLeast(role, 'admin');
export const canManageSubkeys = (role) => roleAtLeast(role, 'developer');
export const canManageProject = (role) => roleAtLeast(role, 'admin');

export const pageAccess = (page, role) => {
  if (['masterkeys', 'members', 'roles', 'invites', 'general', 'security', 'audit', 'danger'].includes(page)) return canManageTeam(role);
  if (['subkeys'].includes(page)) return canManageSubkeys(role);
  return true;
};

export const roleDeniedMessage = (action = 'use this feature') => `Your role does not allow you to ${action}.`;

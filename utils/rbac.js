import { sendError } from './apiHelpers.js';

const ROLES = { 'read-only': 1, operator: 2, admin: 3 };

const parse = (v) => (v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export function getUserRole(user = {}) {
  const email = String(user.email || '').toLowerCase();
  if (parse(process.env.RBAC_ADMIN_EMAILS).includes(email)) return 'admin';
  if (parse(process.env.RBAC_OPERATOR_EMAILS).includes(email)) return 'operator';
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || 'read-only').toLowerCase();
  return ROLES[role] ? role : 'read-only';
}

export function hasRole(required, actual) {
  return ROLES[actual || 'read-only'] >= ROLES[required || 'read-only'];
}

export function enforceRole(req, res, required) {
  req.userRole = req.userRole || getUserRole(req.user);
  if (!hasRole(required, req.userRole)) {
    sendError(res, 'Insufficient role', 403, { requiredRole: required, currentRole: req.userRole });
    return false;
  }
  return true;
}

import { sendError } from './apiHelpers';

export function enforceRole(req, res, role) {
  const userRole = req.user?.role;
  if (userRole === role || userRole === 'admin') return true;
  sendError(res, 'Forbidden', 403);
  return false;
}

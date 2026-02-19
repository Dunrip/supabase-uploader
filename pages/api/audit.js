import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers.js';
import { withAuth } from '../../utils/authMiddleware.js';
import { queryAuditEvents } from '../../utils/auditLog.js';

function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  try {
    const { actorUserId, action, method, from, to, limit } = req.query;
    const events = queryAuditEvents({ actorUserId, action, method, from, to, limit });
    return sendSuccess(res, { events, count: events.length });
  } catch (error) {
    return sendError(res, error.message || 'Failed to query audit log', 500);
  }
}

export default withAuth(handler, { rolesAllowed: ['operator', 'admin'] });

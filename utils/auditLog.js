import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const filePath = () => path.join(process.cwd(), process.env.AUDIT_LOG_FILE || 'audit-events.log');
const hash = (payload, prev = '') => crypto.createHash('sha256').update(`${prev}:${JSON.stringify(payload)}`).digest('hex');

function lastHash(p) {
  if (!fs.existsSync(p)) return '';
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  if (!lines.length) return '';
  try { return JSON.parse(lines[lines.length - 1]).hash || ''; } catch { return ''; }
}

export function appendAuditEvent(event) {
  const p = filePath();
  const payload = { timestamp: new Date().toISOString(), ...event };
  const previousHash = lastHash(p);
  const record = { ...payload, previousHash, hash: hash(payload, previousHash) };
  fs.appendFileSync(p, `${JSON.stringify(record)}\n`);
  return record;
}

export function buildAuditEventFromRequest(req, partial = {}) {
  return { actorUserId: req.user?.id || null, actorEmail: req.user?.email || null, actorRole: req.userRole || null, method: req.method, endpoint: req.url, ...partial };
}

export function queryAuditEvents(filters = {}) {
  const p = filePath();
  if (!fs.existsSync(p)) return [];
  const rows = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return rows.filter(r => (!filters.actorUserId || r.actorUserId === filters.actorUserId) && (!filters.action || r.action === filters.action) && (!filters.method || r.method === filters.method)).slice(-(Number(filters.limit) || 100));
}

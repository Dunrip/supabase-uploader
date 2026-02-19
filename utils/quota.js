import { sendError } from './apiHelpers.js';

const windows = new Map();
const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };

export const quotaConfig = () => ({
  requestWindowMs: n(process.env.QUOTA_REQUEST_WINDOW_MS, 60000),
  maxRequestsPerWindow: n(process.env.QUOTA_MAX_REQUESTS_PER_WINDOW, 300),
  maxBandwidthBytesPerWindow: n(process.env.QUOTA_MAX_BANDWIDTH_BYTES_PER_WINDOW, 1024 * 1024 * 1024),
  maxStorageBytes: n(process.env.QUOTA_MAX_STORAGE_BYTES, 10 * 1024 * 1024 * 1024),
});

const win = (u, c) => {
  const now = Date.now();
  const w = windows.get(u);
  if (!w || now - w.start > c.requestWindowMs) { const nw = { start: now, req: 0, bw: 0 }; windows.set(u, nw); return nw; }
  return w;
};

export function enforceRequestQuota(req, res) {
  if (!req.user?.id) return true;
  const c = quotaConfig(); const w = win(req.user.id, c); w.req += 1;
  if (w.req > c.maxRequestsPerWindow) { sendError(res, 'Request quota exceeded', 429); return false; }
  return true;
}

export function enforceBandwidthQuota(req, res, bytes = 0) {
  if (!req.user?.id) return true;
  const c = quotaConfig(); const w = win(req.user.id, c); w.bw += Number(bytes) || 0;
  if (w.bw > c.maxBandwidthBytesPerWindow) { sendError(res, 'Bandwidth quota exceeded', 429); return false; }
  return true;
}

async function usage(supabase, bucket, folder = '') {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset: 0 });
  if (error) throw error;
  let total = 0;
  for (const i of data || []) total += i.id === null ? await usage(supabase, bucket, folder ? `${folder}/${i.name}` : i.name) : (i.metadata?.size || 0);
  return total;
}

export async function enforceStorageQuota(req, res, supabase, bucket, incoming = 0) {
  const c = quotaConfig();
  const used = await usage(supabase, bucket);
  if (used + (Number(incoming) || 0) > c.maxStorageBytes) { sendError(res, 'Storage quota exceeded', 429); return false; }
  return true;
}

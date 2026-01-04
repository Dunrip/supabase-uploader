import path from 'path';
import fs from 'fs';
import { validateMethod, sendSuccess, sendError } from '../../utils/apiHelpers';

const LOG_FILE = process.env.LOG_FILE || 'supabase-uploader.log';
const MAX_LOG_LINES = 50;

export default function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  try {
    const logPath = path.join(process.cwd(), LOG_FILE);

    if (!fs.existsSync(logPath)) {
      return sendSuccess(res, {
        logs: [],
        message: 'No log file found',
      });
    }

    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-MAX_LOG_LINES);

    sendSuccess(res, {
      logs: lastLines,
      totalLines: lines.length,
    });
  } catch (error) {
    console.error('❌ Error reading logs:', error);
    sendError(res, error.message || 'Failed to read logs', 500);
  }
}

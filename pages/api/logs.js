import path from 'path';
import fs from 'fs';

const LOG_FILE = process.env.LOG_FILE || 'supabase-uploader.log';
const MAX_LOG_LINES = 50;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const logPath = path.join(process.cwd(), LOG_FILE);

    if (!fs.existsSync(logPath)) {
      return res.json({
        success: true,
        logs: [],
        message: 'No log file found',
      });
    }

    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-MAX_LOG_LINES);

    res.json({
      success: true,
      logs: lastLines,
      totalLines: lines.length,
    });
  } catch (error) {
    console.error('❌ Error reading logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to read logs',
    });
  }
}

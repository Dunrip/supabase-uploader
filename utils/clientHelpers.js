/**
 * Client-side utility functions (safe for browser)
 */

/**
 * Escape HTML content (for text nodes)
 * Escapes: < > & " '
 * NOTE: Not currently used in React components (React handles escaping automatically)
 * Reserved for future use cases like server-side rendering or email templates
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape HTML attribute values (for use in HTML attributes)
 * Escapes: < > & " ' and converts single quotes to &#39;
 * NOTE: Not currently used in React components (React handles escaping automatically)
 * Reserved for future use cases like server-side rendering or email templates
 * @param {string} text - Text to escape for attribute context
 * @returns {string} Escaped HTML attribute value
 */
export function escapeHtmlAttribute(text) {
  if (typeof text !== 'string') return '';
  return escapeHtml(text)
    .replace(/'/g, '&#39;')  // Escape single quotes for attribute contexts
    .replace(/"/g, '&quot;'); // Also escape double quotes
}

/**
 * Escape JavaScript string for use in JavaScript code
 * Escapes quotes and backslashes for safe use in JavaScript strings
 * NOTE: Not currently used in React components (React handles escaping automatically)
 * Reserved for future use cases like server-side rendering or email templates
 * @param {string} text - Text to escape for JavaScript
 * @returns {string} Escaped JavaScript string
 */
export function escapeJsString(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
}

/**
 * Format bytes to human-readable file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Get file icon based on extension
 * @param {string} fileName - File name
 * @returns {string} Emoji icon
 */
export function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const icons = {
    pdf: '📄',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    svg: '🖼️',
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    tar: '📦',
    gz: '📦',
    txt: '📝',
    json: '📋',
    csv: '📊',
    xlsx: '📊',
    xls: '📊',
    html: '🌐',
    css: '🎨',
    js: '⚡',
    ts: '⚡',
    jsx: '⚡',
    tsx: '⚡',
    mp4: '🎬',
    avi: '🎬',
    mov: '🎬',
    mp3: '🎵',
    wav: '🎵',
    default: '📁',
  };
  return icons[ext] || icons.default;
}

/**
 * Get file type based on extension
 * @param {string} fileName - File name
 * @returns {string} File type string
 */
export function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const types = {
    pdf: 'PDF',
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    webp: 'Image',
    svg: 'Image',
    bmp: 'Image',
    zip: 'Archive',
    rar: 'Archive',
    '7z': 'Archive',
    tar: 'Archive',
    gz: 'Archive',
    txt: 'Text',
    json: 'JSON',
    csv: 'CSV',
    xlsx: 'Spreadsheet',
    xls: 'Spreadsheet',
    html: 'HTML',
    css: 'CSS',
    js: 'JavaScript',
    ts: 'TypeScript',
    jsx: 'React',
    tsx: 'React',
    mp4: 'Video',
    avi: 'Video',
    mov: 'Video',
    wmv: 'Video',
    flv: 'Video',
    webm: 'Video',
    mkv: 'Video',
    mp3: 'Audio',
    wav: 'Audio',
    ogg: 'Audio',
    default: 'File',
  };
  return types[ext] || types.default;
}

/**
 * Check if a file is previewable
 * @param {string} fileName - File name
 * @returns {boolean} True if file can be previewed
 */
export function isPreviewable(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const previewableExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', // Images
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', // Videos
    'mp3', 'wav', 'ogg', // Audio
    'pdf', // PDFs
  ];
  return previewableExtensions.includes(ext);
}

/**
 * Get file type category for filtering
 * @param {string} fileName - File name
 * @returns {string} Category name (Image, Video, Audio, Document, Archive, Code, Other)
 */
export function getFileCategory(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const categories = {
    // Images
    jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image',
    webp: 'Image', svg: 'Image', bmp: 'Image', ico: 'Image',
    // Videos
    mp4: 'Video', avi: 'Video', mov: 'Video', wmv: 'Video',
    flv: 'Video', webm: 'Video', mkv: 'Video',
    // Audio
    mp3: 'Audio', wav: 'Audio', ogg: 'Audio', flac: 'Audio',
    // Documents
    pdf: 'Document', doc: 'Document', docx: 'Document',
    txt: 'Document', rtf: 'Document',
    // Spreadsheets
    xlsx: 'Spreadsheet', xls: 'Spreadsheet', csv: 'Spreadsheet',
    // Archives
    zip: 'Archive', rar: 'Archive', '7z': 'Archive',
    tar: 'Archive', gz: 'Archive',
    // Code
    js: 'Code', ts: 'Code', jsx: 'Code', tsx: 'Code',
    html: 'Code', css: 'Code', json: 'Code', xml: 'Code',
    py: 'Code', java: 'Code', cpp: 'Code', c: 'Code',
    php: 'Code', rb: 'Code', go: 'Code', rs: 'Code',
  };
  return categories[ext] || 'Other';
}

/**
 * Available file type categories for filtering
 */
export const FILE_CATEGORIES = [
  'All',
  'Image',
  'Video',
  'Audio',
  'Document',
  'Spreadsheet',
  'Archive',
  'Code',
  'Other',
];

/**
 * Available sort options
 */
export const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'date-desc', label: 'Date (Newest)' },
  { value: 'date-asc', label: 'Date (Oldest)' },
  { value: 'size-desc', label: 'Size (Largest)' },
  { value: 'size-asc', label: 'Size (Smallest)' },
];
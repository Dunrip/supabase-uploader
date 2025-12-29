/**
 * Handle API response and errors consistently
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} Parsed response data
 */
export async function handleApiResponse(response) {
  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    } catch {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
  return response.json();
}

/**
 * Download file from API
 * @param {string} url - Download URL
 * @param {string} fileName - Name for downloaded file
 * @returns {Promise<void>}
 */
export async function downloadFileFromApi(url, fileName) {
  const response = await fetch(url);
  
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      throw new Error(data.error || 'Download failed');
    }
    throw new Error(`Download failed: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

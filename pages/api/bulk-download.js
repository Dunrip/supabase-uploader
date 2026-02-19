import path from 'path';
import archiver from 'archiver';
import { validateMethod, sendError } from '../../utils/apiHelpers';
import { validateStoragePath, validateBucketName } from '../../utils/security';
import { withAuth } from '../../utils/authMiddleware.js';
import { createStorageClientWithErrorHandling } from '../../utils/storageClientFactory.js';

// Maximum number of files allowed in a single bulk download
const MAX_FILES = 100;

// Maximum total size for bulk download (500MB)
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

export const config = {
  api: {
    responseLimit: false,
  },
};

async function handler(req, res) {
  if (!validateMethod(req, res, 'POST')) return;

  // Get user's storage client
  const storageResult = await createStorageClientWithErrorHandling(req, res);
  if (!storageResult) return;

  const { client: supabase, settings } = storageResult;

  const { paths, bucket } = req.body;

  // Validate paths array
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return sendError(res, 'No files selected', 400);
  }

  if (paths.length > MAX_FILES) {
    return sendError(res, `Maximum ${MAX_FILES} files allowed per download`, 400);
  }

  // Validate bucket name
  const bucketName = bucket || settings.default_bucket || 'files';
  const bucketValidation = validateBucketName(bucketName);
  if (!bucketValidation.valid) {
    return sendError(res, bucketValidation.error, 400);
  }

  // Validate all paths
  const validatedPaths = [];
  for (const filePath of paths) {
    const pathValidation = validateStoragePath(filePath);
    if (!pathValidation.valid) {
      return sendError(res, `Invalid path: ${pathValidation.error}`, 400);
    }
    validatedPaths.push(pathValidation.sanitized);
  }

  try {

    // Set up response headers for zip download
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="files-${timestamp}.zip"`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 6 }, // Balanced compression
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        sendError(res, 'Failed to create archive', 500);
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    let totalSize = 0;

    // Download and add each file to the archive
    for (const storagePath of validatedPaths) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .download(storagePath);

        if (error) {
          console.error(`Failed to download ${storagePath}:`, error);
          continue; // Skip failed files
        }

        if (!data) continue;

        const buffer = Buffer.from(await data.arrayBuffer());
        totalSize += buffer.length;

        // Check total size limit
        if (totalSize > MAX_TOTAL_SIZE) {
          archive.abort();
          if (!res.headersSent) {
            return sendError(res, 'Total file size exceeds limit (500MB)', 400);
          }
          return;
        }

        if (!enforceBandwidthQuota(req, res, buffer.length)) {
          archive.abort();
          return;
        }

        // Add file to archive using just the filename (not full path)
        const fileName = path.basename(storagePath);
        archive.append(buffer, { name: fileName });
      } catch (fileError) {
        console.error(`Error processing ${storagePath}:`, fileError);
        // Continue with other files
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      sendError(res, error.message || 'Failed to create download', 500);
    }
  }
}

export default withAuth(handler);

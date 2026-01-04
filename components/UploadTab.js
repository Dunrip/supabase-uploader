import { useState, useRef, useEffect, useMemo } from 'react';
import { formatFileSize, getFileIcon } from '../utils/clientHelpers';
import { loadBucketsFromApi } from '../utils/bucketHelpers';
import { uploadFileWithProgress } from '../utils/uploadHelpers';
import Toast from './Toast';
import { useAuth } from '../contexts/AuthContext';

export default function UploadTab() {
  const { authFetch, session } = useAuth();
  const [files, setFiles] = useState([]);
  const [currentBucket, setCurrentBucket] = useState('files');
  const [buckets, setBuckets] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBuckets();
  }, []);

  const loadBuckets = async () => {
    const { buckets: loadedBuckets, preferredBucket } = await loadBucketsFromApi(authFetch);
    if (loadedBuckets.length > 0) {
      setBuckets(loadedBuckets);
      if (preferredBucket) {
        setCurrentBucket(preferredBucket);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Recursively read entries from a directory
  const readDirectory = async (directoryEntry, basePath = '') => {
    const files = [];
    const reader = directoryEntry.createReader();

    const readEntries = () => new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    // Keep reading until no more entries (readEntries returns batches)
    let entries = await readEntries();
    while (entries.length > 0) {
      for (const entry of entries) {
        if (entry.isFile) {
          // Get file and add path info
          const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
          });
          // Create a new File object with the relative path
          const relativePath = basePath ? `${basePath}/${file.name}` : file.name;
          files.push({ file, relativePath });
        } else if (entry.isDirectory) {
          // Recursively read subdirectory
          const subPath = basePath ? `${basePath}/${entry.name}` : entry.name;
          const subFiles = await readDirectory(entry, subPath);
          files.push(...subFiles);
        }
      }
      entries = await readEntries();
    }

    return files;
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const allFiles = [];

    // Use DataTransfer API to handle both files and folders
    if (items && items.length > 0) {
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        }
      }

      // Process each entry (file or directory)
      for (const entry of entries) {
        if (entry.isFile) {
          const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
          });
          allFiles.push({ file, relativePath: file.name });
        } else if (entry.isDirectory) {
          const dirFiles = await readDirectory(entry, entry.name);
          allFiles.push(...dirFiles);
        }
      }

      // Upload all files with their paths
      handleFilesWithPaths(allFiles);
    } else {
      // Fallback for browsers without webkitGetAsEntry
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    e.target.value = '';
  };

  // Handle files with relative paths (from folder drops)
  const handleFilesWithPaths = (fileEntries) => {
    fileEntries.forEach(({ file, relativePath }) => {
      // Skip empty/directory entries
      if (file.size === 0 && file.type === '') {
        console.log('Skipping directory entry:', relativePath);
        return;
      }
      uploadFileWithPath(file, relativePath);
    });
  };

  // Handle regular files (from file picker)
  const handleFiles = (fileList) => {
    fileList.forEach(file => {
      // Skip directories (they have size 0 and no type)
      if (file.size === 0 && file.type === '') {
        console.log('Skipping directory:', file.name);
        return;
      }
      uploadFile(file);
    });
  };

  const uploadFile = (file) => {
    const fileId = Date.now() + Math.random();
    const newFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
      error: null,
      startTime: Date.now(),
    };

    setFiles(prev => [...prev, newFile]);

    // Get access token from session
    const accessToken = session?.access_token || null;

    uploadFileWithProgress(
      file,
      currentBucket,
      (percent) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: percent } : f)
        );
      },
      (response) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'success', progress: 100, endTime: Date.now() } : f)
        );
        const uploadedFileName = response.path ? response.path.split('/').pop() : file.name;
        setNotification({
          message: `${uploadedFileName} has been uploaded successfully`,
          type: 'success',
        });
      },
      (errorMsg) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'error', error: errorMsg, endTime: Date.now() } : f)
        );
        setNotification({
          message: `Failed to upload ${file.name}: ${errorMsg}`,
          type: 'error',
        });
      },
      '', // No folder path in UploadTab
      accessToken // Pass access token for authentication
    );
  };

  // Upload file with a custom relative path (for folder uploads)
  const uploadFileWithPath = (file, relativePath) => {
    const fileId = Date.now() + Math.random();
    // Extract folder path from relativePath (everything except the filename)
    const pathParts = relativePath.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');

    const newFile = {
      id: fileId,
      name: relativePath, // Show full path in UI
      size: file.size,
      status: 'uploading',
      progress: 0,
      error: null,
      startTime: Date.now(),
    };

    setFiles(prev => [...prev, newFile]);

    // Get access token from session
    const accessToken = session?.access_token || null;

    uploadFileWithProgress(
      file,
      currentBucket,
      (percent) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: percent } : f)
        );
      },
      (response) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'success', progress: 100, endTime: Date.now() } : f)
        );
        setNotification({
          message: `${relativePath} uploaded successfully`,
          type: 'success',
        });
      },
      (errorMsg) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'error', error: errorMsg, endTime: Date.now() } : f)
        );
        setNotification({
          message: `Failed to upload ${relativePath}: ${errorMsg}`,
          type: 'error',
        });
      },
      folderPath, // Pass the folder path for proper placement
      accessToken // Pass access token for authentication
    );
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status === 'uploading'));
  };

  // Calculate stats
  const stats = useMemo(() => {
    const uploading = files.filter(f => f.status === 'uploading').length;
    const completed = files.filter(f => f.status === 'success').length;
    const failed = files.filter(f => f.status === 'error').length;
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    return { uploading, completed, failed, totalSize };
  }, [files]);

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={notification.type === 'success' ? 4000 : 5000}
        />
      )}

      <div className="space-y-6 animate-fade-in">
        {/* Bucket Selector with Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {buckets.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-dark-textMuted">Upload to:</label>
              <select
                value={currentBucket}
                onChange={(e) => setCurrentBucket(e.target.value)}
                className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent"
              >
                {buckets.map(bucket => (
                  <option key={bucket.name} value={bucket.name}>
                    {bucket.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Stats */}
          {files.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              {stats.uploading > 0 && (
                <span className="px-3 py-1.5 bg-dark-accent/20 text-dark-accent rounded-full font-medium flex items-center gap-1.5">
                  <span className="animate-spin">⏳</span> {stats.uploading} uploading
                </span>
              )}
              {stats.completed > 0 && (
                <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full font-medium">
                  ✅ {stats.completed} completed
                </span>
              )}
              {stats.failed > 0 && (
                <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full font-medium">
                  ❌ {stats.failed} failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 ${isDragging
            ? 'border-dark-accent bg-dark-accent/10 scale-[1.02] shadow-lg shadow-dark-accent/20'
            : 'border-dark-border bg-dark-surface/50 hover:border-dark-accent/50 hover:bg-dark-surface'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={`absolute inset-0 bg-gradient-to-br from-dark-accent/5 to-purple-600/5 rounded-2xl transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`} />
          <div className="relative z-10">
            <div className={`text-7xl mb-6 transition-transform ${isDragging ? 'scale-110 animate-bounce' : 'animate-pulse-slow'}`} style={{ animationDuration: isDragging ? '0.5s' : '3s' }}>
              {isDragging ? '📥' : '☁️'}
            </div>
            <h2 className="text-2xl font-bold text-dark-text mb-3">
              {isDragging ? 'Drop files here!' : 'Drag & Drop Files Here'}
            </h2>
            <p className="text-dark-textMuted mb-6">or click to browse from your device</p>
            <button className="px-8 py-3 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-xl font-semibold hover:from-dark-accentHover hover:to-purple-500 transition-all transform hover:scale-105 shadow-lg shadow-dark-accent/30">
              Browse Files
            </button>
            <p className="text-xs text-dark-textMuted mt-4 flex items-center justify-center gap-2">
              <span>📁 Multiple files</span>
              <span className="w-1 h-1 rounded-full bg-dark-textMuted"></span>
              <span>📦 Max 100MB each</span>
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Upload Progress List */}
        {files.length > 0 && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-dark-text flex items-center gap-2">
                Upload Queue
                <span className="px-2 py-0.5 bg-dark-border rounded-full text-xs text-dark-textMuted font-normal">
                  {files.length}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {(stats.completed > 0 || stats.failed > 0) && (
                  <button
                    onClick={clearCompleted}
                    className="px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all"
                  >
                    Clear Completed
                  </button>
                )}
                <button
                  onClick={() => setFiles([])}
                  className="px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            {files.map((file, index) => (
              <div
                key={file.id}
                className={`bg-dark-surface border rounded-xl p-4 transition-all animate-slide-up ${file.status === 'success'
                  ? 'border-green-500/30 bg-green-500/5'
                  : file.status === 'error'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-dark-border hover:border-dark-accent/50'
                  }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl flex-shrink-0">{getFileIcon(file.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-dark-text truncate">{file.name}</div>
                      <div className="text-xs text-dark-textMuted mt-0.5 flex items-center gap-2">
                        <span>{formatFileSize(file.size)}</span>
                        {file.status === 'uploading' && file.progress > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-dark-textMuted"></span>
                            <span className="text-dark-accent font-medium">{Math.round(file.progress)}%</span>
                          </>
                        )}
                        {file.status === 'success' && file.endTime && file.startTime && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-dark-textMuted"></span>
                            <span className="text-green-400">Completed in {((file.endTime - file.startTime) / 1000).toFixed(1)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {file.status === 'uploading' && (
                      <div className="w-8 h-8 flex items-center justify-center">
                        <div className="animate-spin text-xl">⏳</div>
                      </div>
                    )}
                    {file.status === 'success' && (
                      <div className="w-8 h-8 flex items-center justify-center text-xl animate-bounce" style={{ animationDuration: '0.5s', animationIterationCount: '2' }}>
                        ✅
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="w-8 h-8 flex items-center justify-center text-xl">❌</div>
                    )}
                    {file.status !== 'uploading' && (
                      <button
                        onClick={() => removeFile(file.id)}
                        className="w-8 h-8 flex items-center justify-center text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover rounded-lg transition-all"
                        title="Remove from list"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${file.status === 'success'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : file.status === 'error'
                        ? 'bg-gradient-to-r from-red-500 to-rose-500'
                        : 'bg-gradient-to-r from-dark-accent to-purple-600'
                      }`}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>

                {file.error && (
                  <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{file.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

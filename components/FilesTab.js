import { useState, useEffect, useRef } from 'react';
import { formatDate, getFileIcon, getFileType, isPreviewable } from '../utils/clientHelpers';
import { downloadFileFromApi, handleApiResponse } from '../utils/api';
import { loadBucketsFromApi } from '../utils/bucketHelpers';
import { uploadFileWithProgress } from '../utils/uploadHelpers';
import FilePreview from './FilePreview';
import Toast from './Toast';

export default function FilesTab() {
  const [files, setFiles] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [currentBucket, setCurrentBucket] = useState('files');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBuckets();
  }, []);

  useEffect(() => {
    if (currentBucket && buckets.length > 0) {
      loadFiles();
    }
  }, [currentBucket, buckets.length]);

  const loadBuckets = async () => {
    const { buckets: loadedBuckets, preferredBucket } = await loadBucketsFromApi();
    setBuckets(loadedBuckets);
    if (preferredBucket) {
      setCurrentBucket(preferredBucket);
    }
    if (loadedBuckets.length === 0) {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/files?bucket=${currentBucket}`);
      const data = await handleApiResponse(response);
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath, fileName) => {
    try {
      const url = `/api/download?path=${encodeURIComponent(filePath)}&bucket=${currentBucket}`;
      await downloadFileFromApi(url, fileName);
    } catch (error) {
      alert('Download failed: ' + error.message);
    }
  };

  const deleteFile = async (filePath, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(filePath)}&bucket=${currentBucket}`, {
        method: 'DELETE',
      });
      const data = await handleApiResponse(response);
      if (data.success) {
        loadFiles();
      } else {
        alert('Delete failed: ' + data.error);
      }
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const handlePreviewFile = async (file) => {
    if (!isPreviewable(file.name)) {
      alert('Preview not available for this file type');
      return;
    }

    setLoadingPreview(true);
    try {
      const response = await fetch(`/api/files/url?path=${encodeURIComponent(file.path)}&bucket=${currentBucket}`);
      const data = await handleApiResponse(response);
      if (data.success) {
        setPreviewFile({
          ...file,
          icon: getFileIcon(file.name),
        });
        setPreviewUrl(data.url);
      } else {
        alert('Failed to load preview: ' + data.error);
      }
    } catch (error) {
      alert('Failed to load preview: ' + error.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    selectedFiles.forEach(file => uploadFile(file));
    e.target.value = '';
  };

  const uploadFile = (file) => {
    uploadFileWithProgress(
      file,
      currentBucket,
      null, // No progress tracking needed in FilesTab
      (response) => {
        const uploadedFileName = response.path ? response.path.split('/').pop() : file.name;
        setNotification({
          message: `${uploadedFileName} has been uploaded successfully`,
          type: 'success',
        });
        loadFiles(); // Refresh the file list after successful upload
      },
      (errorMsg) => {
        setNotification({
          message: `Failed to upload ${file.name}: ${errorMsg}`,
          type: 'error',
        });
      }
    );
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <div className="space-y-6 animate-fade-in min-h-0 flex flex-col">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-dark-textMuted">Bucket:</label>
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
            <button
              onClick={loadFiles}
              className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all"
            >
              🔄 Refresh
            </button>
          </div>
          
          {/* Search with Upload Button */}
          <div className="flex items-center gap-3 flex-1 sm:max-w-md justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-lg hover:from-dark-accentHover hover:to-purple-500 transition-all transform hover:scale-105 text-sm font-medium shadow-lg shadow-dark-accent/20 flex items-center gap-2 whitespace-nowrap"
            >
              📤 Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent"
              />
              <span className="absolute left-3 top-2.5 text-dark-textMuted">🔍</span>
            </div>
          </div>
        </div>

      {/* Files List */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
            <p className="text-dark-textMuted">Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-4 opacity-30">📁</div>
            <p className="text-dark-textMuted text-lg">
              {searchQuery ? 'No files match your search' : 'No files found'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-dark-accent hover:text-dark-accentHover"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-dark-textMuted mb-2">
              Showing {filteredFiles.length} of {files.length} files
            </div>
            {filteredFiles.map(file => (
              <div
                key={file.path}
                className="group bg-dark-surface border border-dark-border rounded-xl p-4 hover:border-dark-accent/50 hover:bg-dark-surfaceHover transition-all animate-slide-up"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-3xl flex-shrink-0">{getFileIcon(file.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-dark-text truncate group-hover:text-dark-accent transition-colors">
                        {file.name}
                      </div>
                      <div className="text-sm text-dark-textMuted mt-1 flex items-center gap-3 flex-wrap">
                        <span>{file.sizeFormatted}</span>
                        <span>•</span>
                        <span>{getFileType(file.name)}</span>
                        <span>•</span>
                        <span>{formatDate(file.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {isPreviewable(file.name) && (
                      <button
                        onClick={() => handlePreviewFile(file)}
                        disabled={loadingPreview}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 hover:border-blue-500/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Preview file"
                      >
                        👁️ Preview
                      </button>
                    )}
                    <button
                      onClick={() => downloadFile(file.path, file.name)}
                      className="px-4 py-2 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-lg hover:from-dark-accentHover hover:to-purple-500 transition-all transform hover:scale-105 text-sm font-medium shadow-lg shadow-dark-accent/20"
                    >
                      ⬇️ Download
                    </button>
                    <button
                      onClick={() => deleteFile(file.path, file.name)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 hover:border-red-500/50 transition-all text-sm font-medium"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Preview Modal */}
        {previewFile && previewUrl && (
          <FilePreview
            file={previewFile}
            url={previewUrl}
            onClose={closePreview}
            onDownload={() => downloadFile(previewFile.path, previewFile.name)}
          />
        )}
      </div>
    </>
  );
}

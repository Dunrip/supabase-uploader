import { useState, useRef, useEffect } from 'react';
import { formatFileSize } from '../utils/clientHelpers';
import { loadBucketsFromApi } from '../utils/bucketHelpers';
import { uploadFileWithProgress } from '../utils/uploadHelpers';
import Toast from './Toast';

export default function UploadTab() {
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
    const { buckets: loadedBuckets, preferredBucket } = await loadBucketsFromApi();
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
    e.target.value = '';
  };

  const handleFiles = (fileList) => {
    fileList.forEach(file => uploadFile(file));
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
    };

    setFiles(prev => [...prev, newFile]);

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
          prev.map(f => f.id === fileId ? { ...f, status: 'success', progress: 100 } : f)
        );
        const uploadedFileName = response.path ? response.path.split('/').pop() : file.name;
        setNotification({
          message: `${uploadedFileName} has been uploaded successfully`,
          type: 'success',
        });
      },
      (errorMsg) => {
        setFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, status: 'error', error: errorMsg } : f)
        );
        setNotification({
          message: `Failed to upload ${file.name}: ${errorMsg}`,
          type: 'error',
        });
      }
    );
  };


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
      {/* Bucket Selector */}
      {buckets.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-dark-textMuted">Upload to bucket:</label>
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

      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-dark-accent bg-dark-accent/10 scale-[1.02]'
            : 'border-dark-border bg-dark-surface/50 hover:border-dark-accent/50 hover:bg-dark-surface'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-dark-accent/5 to-transparent rounded-2xl opacity-0 hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="text-7xl mb-6 animate-pulse-slow">☁️</div>
          <h2 className="text-2xl font-bold text-dark-text mb-3">
            Drag & Drop Files Here
          </h2>
          <p className="text-dark-textMuted mb-6">or click to browse from your device</p>
          <button className="px-8 py-3 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-xl font-semibold hover:from-dark-accentHover hover:to-purple-500 transition-all transform hover:scale-105 shadow-lg shadow-dark-accent/30">
            Browse Files
          </button>
          <p className="text-xs text-dark-textMuted mt-4">Supports multiple files • Max 100MB per file</p>
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
            <h3 className="text-lg font-semibold text-dark-text">Upload Queue</h3>
            <button
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all"
            >
              Clear History
            </button>
          </div>
          {files.map(file => (
            <div
              key={file.id}
              className="bg-dark-surface border border-dark-border rounded-xl p-4 hover:border-dark-accent/50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-dark-text truncate">{file.name}</div>
                  <div className="text-xs text-dark-textMuted mt-1">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <div className="ml-4 text-2xl">
                  {file.status === 'uploading' && (
                    <div className="animate-spin">⏳</div>
                  )}
                  {file.status === 'success' && '✅'}
                  {file.status === 'error' && '❌'}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    file.status === 'success'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : file.status === 'error'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500'
                      : 'bg-gradient-to-r from-dark-accent to-purple-600'
                  }`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              
              {file.error && (
                <div className="mt-2 text-sm text-red-400">{file.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { formatDate, getFileIcon, getFileType, isPreviewable, getFileCategory, FILE_CATEGORIES, SORT_OPTIONS } from '../utils/clientHelpers';
import { downloadFileFromApi, handleApiResponse } from '../utils/api';
import { loadBucketsFromApi } from '../utils/bucketHelpers';
import { uploadFileWithProgress } from '../utils/uploadHelpers';
import FilePreview from './FilePreview';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';

export default function FilesTab() {
  const { authFetch, session } = useAuth();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(''); // Current folder path
  const [buckets, setBuckets] = useState([]);
  const [currentBucket, setCurrentBucket] = useState(''); // Start empty to prevent premature loading
  const [loading, setLoading] = useState(true);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Track if initial bucket selection is done
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [renamingFile, setRenamingFile] = useState(null); // { path, name }
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  // Folder management states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingFile, setMovingFile] = useState(null);
  const [moveDestination, setMoveDestination] = useState('');
  const [movingLoading, setMovingLoading] = useState(false);
  const fileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const newFolderInputRef = useRef(null);

  useEffect(() => {
    loadBuckets();
  }, []);

  // Only load files after initial bucket selection is complete
  useEffect(() => {
    if (currentBucket && initialLoadComplete) {
      loadFiles();
    }
  }, [currentBucket, currentFolder, initialLoadComplete]);

  const loadBuckets = async () => {
    setLoadingBuckets(true);
    try {
      const { buckets: loadedBuckets, preferredBucket } = await loadBucketsFromApi(authFetch);
      setBuckets(loadedBuckets);

      if (loadedBuckets.length === 0) {
        setLoading(false);
        setInitialLoadComplete(true);
      } else if (preferredBucket) {
        // Set the bucket and mark initial load complete in the same update cycle
        setCurrentBucket(preferredBucket);
        setInitialLoadComplete(true);
      } else {
        // Fallback to first bucket if no preferred bucket
        setCurrentBucket(loadedBuckets[0]?.name || 'files');
        setInitialLoadComplete(true);
      }
    } catch (error) {
      console.error('Error loading buckets:', error);
      setNotification({
        message: 'Failed to load buckets: ' + error.message,
        type: 'error',
      });
      setInitialLoadComplete(true);
      setLoading(false);
    } finally {
      setLoadingBuckets(false);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    setSelectedFiles(new Set()); // Clear selection when loading new files
    try {
      const folderParam = currentFolder ? `&folder=${encodeURIComponent(currentFolder)}` : '';
      const response = await authFetch(`/api/files?bucket=${currentBucket}${folderParam}`);
      const data = await handleApiResponse(response);
      if (data.success) {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle bucket change - reset folder path to root
  const handleBucketChange = (newBucket) => {
    setCurrentBucket(newBucket);
    setCurrentFolder(''); // Reset to root when changing buckets
    setSearchQuery('');
    setFilterCategory('All');
  };

  // Folder navigation
  const navigateToFolder = (folderPath) => {
    setCurrentFolder(folderPath);
    setSearchQuery('');
    setFilterCategory('All');
  };

  const navigateUp = () => {
    if (!currentFolder) return;
    const parts = currentFolder.split('/');
    parts.pop();
    setCurrentFolder(parts.join('/'));
  };

  // Breadcrumb parts
  const breadcrumbParts = currentFolder ? currentFolder.split('/') : [];

  // Create folder handler
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const response = await authFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: newFolderName.trim(),
          parentPath: currentFolder,
          bucket: currentBucket,
        }),
      });

      const data = await handleApiResponse(response);
      if (data.success) {
        setNotification({
          message: `Folder "${newFolderName.trim()}" created`,
          type: 'success',
        });
        setNewFolderName('');
        setShowCreateFolder(false);
        loadFiles();
      } else {
        setNotification({
          message: data.error || 'Failed to create folder',
          type: 'error',
        });
      }
    } catch (error) {
      setNotification({
        message: error.message || 'Failed to create folder',
        type: 'error',
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  // Delete folder handler
  const deleteFolder = async (folderPath, folderName) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and all its contents?`)) {
      return;
    }

    try {
      const response = await authFetch(
        `/api/folders?path=${encodeURIComponent(folderPath)}&bucket=${currentBucket}`,
        { method: 'DELETE' }
      );
      const data = await handleApiResponse(response);
      if (data.success) {
        setNotification({
          message: `Folder "${folderName}" deleted (${data.deletedCount} items)`,
          type: 'success',
        });
        loadFiles();
      } else {
        setNotification({
          message: data.error || 'Failed to delete folder',
          type: 'error',
        });
      }
    } catch (error) {
      setNotification({
        message: error.message || 'Failed to delete folder',
        type: 'error',
      });
    }
  };

  // Move file handler
  const handleMoveFile = async () => {
    if (!movingFile) return;

    setMovingLoading(true);
    try {
      const response = await authFetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: movingFile.path,
          destinationFolder: moveDestination,
          bucket: currentBucket,
        }),
      });

      const data = await handleApiResponse(response);
      if (data.success) {
        setNotification({
          message: `Moved "${movingFile.name}" successfully`,
          type: 'success',
        });
        setShowMoveModal(false);
        setMovingFile(null);
        setMoveDestination('');
        loadFiles();
      } else {
        setNotification({
          message: data.error || 'Failed to move file',
          type: 'error',
        });
      }
    } catch (error) {
      setNotification({
        message: error.message || 'Failed to move file',
        type: 'error',
      });
    } finally {
      setMovingLoading(false);
    }
  };

  const openMoveModal = (file) => {
    setMovingFile(file);
    setMoveDestination(currentFolder);
    setShowMoveModal(true);
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
      const response = await authFetch(`/api/files?path=${encodeURIComponent(filePath)}&bucket=${currentBucket}`, {
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
      const response = await authFetch(`/api/files/url?path=${encodeURIComponent(file.path)}&bucket=${currentBucket}`);
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
    // Get access token from session
    const accessToken = session?.access_token || null;

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
      },
      currentFolder, // Pass current folder path for upload destination
      accessToken // Pass access token for authentication
    );
  };

  // Selection handlers
  const toggleFileSelection = (filePath) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.path)));
    }
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}?`;
    if (!confirm(confirmMessage)) return;

    setBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const filePath of selectedFiles) {
      try {
        const response = await authFetch(
          `/api/files?path=${encodeURIComponent(filePath)}&bucket=${currentBucket}`,
          { method: 'DELETE' }
        );
        const data = await handleApiResponse(response);
        if (data.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setBulkActionLoading(false);
    setSelectedFiles(new Set());

    if (errorCount === 0) {
      setNotification({
        message: `Successfully deleted ${successCount} file${successCount > 1 ? 's' : ''}`,
        type: 'success',
      });
    } else {
      setNotification({
        message: `Deleted ${successCount} file${successCount > 1 ? 's' : ''}, ${errorCount} failed`,
        type: 'error',
      });
    }

    loadFiles();
  };

  // Bulk download handler (downloads as zip)
  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;

    setBulkActionLoading(true);

    try {
      const paths = Array.from(selectedFiles);
      const response = await authFetch('/api/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, bucket: currentBucket }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Get the blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `files-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setNotification({
        message: `Downloaded ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} as zip`,
        type: 'success',
      });
    } catch (error) {
      setNotification({
        message: `Bulk download failed: ${error.message}`,
        type: 'error',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Rename handlers
  const startRename = (file) => {
    setRenamingFile({ path: file.path, name: file.name });
    setRenameValue(file.name);
    // Focus the input after it renders
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const cancelRename = () => {
    setRenamingFile(null);
    setRenameValue('');
  };

  const handleRename = async () => {
    if (!renamingFile || !renameValue.trim()) return;

    const newName = renameValue.trim();
    if (newName === renamingFile.name) {
      cancelRename();
      return;
    }

    setRenameLoading(true);

    try {
      const response = await authFetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: renamingFile.path,
          newName: newName,
          bucket: currentBucket,
        }),
      });

      const data = await handleApiResponse(response);

      if (data.success) {
        setNotification({
          message: `Renamed to "${newName}"`,
          type: 'success',
        });
        cancelRename();
        loadFiles();
      } else {
        setNotification({
          message: data.error || 'Rename failed',
          type: 'error',
        });
      }
    } catch (error) {
      setNotification({
        message: error.message || 'Rename failed',
        type: 'error',
      });
    } finally {
      setRenameLoading(false);
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  // Filter and sort files with memoization for performance
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(file =>
        file.name.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (filterCategory !== 'All') {
      result = result.filter(file =>
        getFileCategory(file.name) === filterCategory
      );
    }

    // Sort files
    const [sortField, sortDirection] = sortBy.split('-');
    result = [...result].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.updatedAt) - new Date(b.updatedAt);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [files, searchQuery, filterCategory, sortBy]);

  // Count files by category for filter badges
  const categoryCounts = useMemo(() => {
    const counts = { All: files.length };
    files.forEach(file => {
      const category = getFileCategory(file.name);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
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

      <div className="space-y-6 animate-fade-in min-h-0 flex flex-col">
        {/* Controls - Row 1: Bucket & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-dark-textMuted">Bucket:</label>
            <select
              value={currentBucket}
              onChange={(e) => handleBucketChange(e.target.value)}
              disabled={loadingBuckets}
              className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingBuckets ? (
                <option>Loading buckets...</option>
              ) : (
                buckets.map(bucket => (
                  <option key={bucket.name} value={bucket.name}>
                    {bucket.name}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={loadFiles}
              disabled={loading || !currentBucket}
              className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {/* Upload & Create Folder Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowCreateFolder(true);
                setTimeout(() => newFolderInputRef.current?.focus(), 50);
              }}
              className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text hover:bg-dark-surfaceHover hover:border-dark-accent/50 transition-all text-sm font-medium flex items-center gap-2"
            >
              📁 New Folder
            </button>
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
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm flex-shrink-0 flex-wrap">
          <button
            onClick={() => setCurrentFolder('')}
            className={`hover:text-dark-accent transition-colors ${!currentFolder ? 'text-dark-accent font-medium' : 'text-dark-textMuted'
              }`}
          >
            🏠 Root
          </button>
          {breadcrumbParts.map((part, index) => {
            const pathUpToHere = breadcrumbParts.slice(0, index + 1).join('/');
            const isLast = index === breadcrumbParts.length - 1;
            return (
              <span key={pathUpToHere} className="flex items-center gap-2">
                <span className="text-dark-border">/</span>
                <button
                  onClick={() => setCurrentFolder(pathUpToHere)}
                  className={`hover:text-dark-accent transition-colors ${isLast ? 'text-dark-accent font-medium' : 'text-dark-textMuted'
                    }`}
                >
                  {part}
                </button>
              </span>
            );
          })}
          {currentFolder && (
            <button
              onClick={navigateUp}
              className="ml-2 px-2 py-1 bg-dark-surface border border-dark-border rounded text-dark-textMuted hover:text-dark-text hover:border-dark-accent/50 transition-all text-xs"
            >
              ⬆️ Up
            </button>
          )}
        </div>

        {/* Create Folder Input */}
        {showCreateFolder && (
          <div className="flex items-center gap-2 p-3 bg-dark-surface border border-dark-accent/30 rounded-lg flex-shrink-0 animate-slide-up">
            <span className="text-2xl">📁</span>
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setShowCreateFolder(false);
                  setNewFolderName('');
                }
              }}
              placeholder="New folder name..."
              disabled={creatingFolder}
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent disabled:opacity-50"
            />
            <button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="px-4 py-2 bg-dark-accent text-white rounded-lg hover:bg-dark-accentHover transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingFolder ? '⏳' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowCreateFolder(false);
                setNewFolderName('');
              }}
              disabled={creatingFolder}
              className="px-3 py-2 bg-dark-surface border border-dark-border text-dark-textMuted rounded-lg hover:text-dark-text hover:border-dark-accent/50 transition-all text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Controls - Row 2: Search, Filter & Sort */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center flex-shrink-0">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-textMuted focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent"
            />
            <span className="absolute left-3 top-2.5 text-dark-textMuted">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-dark-textMuted hover:text-dark-text"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter by Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-dark-textMuted">Filter:</span>
            <div className="flex flex-wrap gap-1">
              {FILE_CATEGORIES.filter(cat => cat === 'All' || categoryCounts[cat] > 0).map(category => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterCategory === category
                    ? 'bg-dark-accent text-white'
                    : 'bg-dark-surface border border-dark-border text-dark-textMuted hover:border-dark-accent/50 hover:text-dark-text'
                    }`}
                >
                  {category}
                  {categoryCounts[category] > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${filterCategory === category
                      ? 'bg-white/20'
                      : 'bg-dark-border'
                      }`}>
                      {categoryCounts[category]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-textMuted">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar - appears when files are selected */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between gap-4 p-4 bg-dark-accent/10 border border-dark-accent/30 rounded-xl flex-shrink-0 animate-slide-up">
            <div className="flex items-center gap-3">
              <span className="text-dark-accent font-medium">
                {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-dark-textMuted hover:text-dark-text transition-colors"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDownload}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-lg hover:from-dark-accentHover hover:to-purple-500 transition-all text-sm font-medium shadow-lg shadow-dark-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {bulkActionLoading ? '⏳' : '📦'} Download as ZIP
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 hover:border-red-500/50 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {bulkActionLoading ? '⏳' : '🗑️'} Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="space-y-3">
              <div className="text-sm text-dark-textMuted mb-4 flex items-center gap-2">
                <div className="inline-block animate-spin">⏳</div>
                Loading files...
              </div>
              {/* Skeleton loaders */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="bg-dark-surface border border-dark-border rounded-xl p-4 animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-dark-surfaceHover rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-dark-surfaceHover rounded w-3/4"></div>
                      <div className="h-3 bg-dark-surfaceHover rounded w-1/2"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24 h-9 bg-dark-surfaceHover rounded-lg"></div>
                      <div className="w-24 h-9 bg-dark-surfaceHover rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 && folders.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-7xl mb-4 opacity-30">📁</div>
              <p className="text-dark-textMuted text-lg">
                {searchQuery || filterCategory !== 'All'
                  ? 'No files match your filters'
                  : 'This folder is empty'}
              </p>
              {(searchQuery || filterCategory !== 'All') && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:border-dark-accent/50 transition-all text-sm"
                    >
                      Clear search
                    </button>
                  )}
                  {filterCategory !== 'All' && (
                    <button
                      onClick={() => setFilterCategory('All')}
                      className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-textMuted hover:text-dark-text hover:border-dark-accent/50 transition-all text-sm"
                    >
                      Clear filter
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('All');
                    }}
                    className="px-4 py-2 bg-dark-accent text-white rounded-lg hover:bg-dark-accentHover transition-all text-sm"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Folders Section */}
              {folders.length > 0 && !searchQuery && filterCategory === 'All' && (
                <>
                  <div className="text-sm text-dark-textMuted mb-2">
                    {folders.length} folder{folders.length !== 1 ? 's' : ''}
                  </div>
                  {folders.map(folder => (
                    <div
                      key={folder.path}
                      className="group bg-dark-surface border border-dark-border rounded-xl p-4 hover:border-dark-accent/50 hover:bg-dark-surfaceHover transition-all cursor-pointer"
                      onClick={() => navigateToFolder(folder.path)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="text-3xl flex-shrink-0">📁</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-dark-text truncate group-hover:text-dark-accent transition-colors">
                              {folder.name}
                            </div>
                            <div className="text-sm text-dark-textMuted mt-1">
                              Folder
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFolder(folder.path, folder.name);
                            }}
                            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 hover:border-red-500/50 transition-all text-sm font-medium"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredFiles.length > 0 && (
                    <div className="border-t border-dark-border my-4"></div>
                  )}
                </>
              )}

              {/* Files Header with Select All */}
              {filteredFiles.length > 0 && (
                <div className="flex items-center justify-between text-sm text-dark-textMuted mb-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-dark-text transition-colors">
                      <input
                        type="checkbox"
                        checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-dark-border bg-dark-surface text-dark-accent focus:ring-dark-accent focus:ring-offset-0 cursor-pointer"
                      />
                      <span>Select all files</span>
                    </label>
                    <span>•</span>
                    <span>Showing {filteredFiles.length} of {files.length} files</span>
                  </div>
                </div>
              )}
              {filteredFiles.map(file => (
                <div
                  key={file.path}
                  className={`group bg-dark-surface border rounded-xl p-4 hover:border-dark-accent/50 hover:bg-dark-surfaceHover transition-all animate-slide-up ${selectedFiles.has(file.path)
                    ? 'border-dark-accent/50 bg-dark-accent/5'
                    : 'border-dark-border'
                    }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="w-5 h-5 rounded border-dark-border bg-dark-surface text-dark-accent focus:ring-dark-accent focus:ring-offset-0 cursor-pointer flex-shrink-0"
                      />
                      <div className="text-3xl flex-shrink-0">{getFileIcon(file.name)}</div>
                      <div className="flex-1 min-w-0">
                        {renamingFile?.path === file.path ? (
                          /* Rename Input - Apple style inline editing */
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              onBlur={() => {
                                // Only cancel if not loading (to allow save to complete)
                                if (!renameLoading) {
                                  setTimeout(() => cancelRename(), 150);
                                }
                              }}
                              disabled={renameLoading}
                              className="px-2 py-1 bg-dark-bg border border-dark-accent rounded text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-dark-accent disabled:opacity-50"
                              style={{
                                width: `${Math.max(100, Math.min(400, renameValue.length * 8 + 24))}px`
                              }}
                              placeholder="Enter name..."
                            />
                            <button
                              onClick={handleRename}
                              disabled={renameLoading || !renameValue.trim()}
                              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Save"
                            >
                              {renameLoading ? (
                                <span className="animate-spin inline-block">⏳</span>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                  <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={cancelRename}
                              disabled={renameLoading}
                              className="p-1.5 text-dark-textMuted hover:text-red-400 hover:bg-red-500/20 rounded transition-all disabled:opacity-50"
                              title="Cancel"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          /* Normal Display */
                          <>
                            <div className="font-medium text-dark-text truncate group-hover:text-dark-accent transition-colors flex items-center gap-2">
                              <span className="truncate">{file.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRename(file);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-dark-textMuted hover:text-dark-accent transition-all p-1 rounded hover:bg-dark-surfaceHover flex-shrink-0"
                                title="Rename"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.25 10.276a.75.75 0 0 0-.183.31l-.857 2.997a.75.75 0 0 0 .925.926l2.997-.858a.75.75 0 0 0 .31-.183l7.763-7.762a1.75 1.75 0 0 0 0-2.475l-.717-.718ZM11.72 3.22a.25.25 0 0 1 .354 0l.718.718a.25.25 0 0 1 0 .354l-7.763 7.762-1.61.46.46-1.61 7.76-7.762-.003.004.084-.088Z" />
                                </svg>
                              </button>
                            </div>
                            <div className="text-sm text-dark-textMuted mt-1 flex items-center gap-3 flex-wrap">
                              <span>{file.sizeFormatted}</span>
                              <span>•</span>
                              <span>{getFileType(file.name)}</span>
                              <span>•</span>
                              <span>{formatDate(file.updatedAt)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {/* Hide action buttons when renaming this file */}
                      {renamingFile?.path !== file.path && (
                        <>
                          <button
                            onClick={() => openMoveModal(file)}
                            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 hover:border-cyan-500/50 transition-all text-sm font-medium"
                            title="Move file"
                          >
                            📦 Move
                          </button>
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
                        </>
                      )}
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

        {/* Move File Modal */}
        {showMoveModal && movingFile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-surface border border-dark-border rounded-xl p-6 w-full max-w-md animate-slide-up">
              <h3 className="text-lg font-medium text-dark-text mb-4">
                Move "{movingFile.name}"
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-dark-textMuted mb-2">
                    Destination folder:
                  </label>
                  <select
                    value={moveDestination}
                    onChange={(e) => setMoveDestination(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-dark-accent"
                  >
                    <option value="">/ (Root)</option>
                    {folders.map(folder => (
                      <option key={folder.path} value={folder.path}>
                        /{folder.path}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dark-textMuted mt-2">
                    Tip: Navigate to a folder first to see its subfolders here.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                  <button
                    onClick={() => {
                      setShowMoveModal(false);
                      setMovingFile(null);
                      setMoveDestination('');
                    }}
                    disabled={movingLoading}
                    className="px-4 py-2 bg-dark-surface border border-dark-border text-dark-textMuted rounded-lg hover:text-dark-text hover:border-dark-accent/50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMoveFile}
                    disabled={movingLoading}
                    className="px-4 py-2 bg-dark-accent text-white rounded-lg hover:bg-dark-accentHover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {movingLoading ? '⏳ Moving...' : 'Move'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

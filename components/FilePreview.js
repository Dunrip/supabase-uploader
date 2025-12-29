import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FilePreview({ file, url, onClose, onDownload }) {
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (!file || !url || !mounted) return null;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
  const isPDF = ext === 'pdf';

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <div
        className="relative bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden animate-slide-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isAudio ? 'min(90vw, 500px)' : isPDF ? 'min(90vw, 900px)' : 'fit-content',
          height: isAudio ? 'auto' : 'min(90vh, 700px)',
          maxWidth: isAudio ? '500px' : isPDF ? '900px' : 'min(90vw, 800px)',
          maxHeight: isAudio ? 'none' : 'min(90vh, 700px)',
          minWidth: isImage || isVideo ? '400px' : 'auto',
          margin: 'auto',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-dark-border bg-dark-surface/50 flex-shrink-0 relative">
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-12">
            <span className="text-xl">{file.icon || '📄'}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-dark-text truncate text-sm">{file.name}</h3>
              <p className="text-xs text-dark-textMuted">{file.sizeFormatted}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 px-3 py-1.5 text-dark-text hover:text-white hover:bg-red-500/20 rounded-lg transition-all text-xl font-bold flex-shrink-0 z-10"
            aria-label="Close preview"
            style={{ fontSize: '1.5rem', lineHeight: '1' }}
          >
            ✕
          </button>
        </div>

        {/* Preview Content */}
        <div className="relative flex items-center justify-center p-6 overflow-hidden flex-1 min-h-0" style={{ minHeight: 0, width: '100%', maxHeight: '100%' }}>
          {hasError ? (
            <div className="flex flex-col items-center justify-center text-center p-8 w-full">
              <div className="text-5xl mb-3 opacity-50">⚠️</div>
              <p className="text-dark-textMuted mb-1">Preview not available</p>
              <p className="text-dark-textMuted text-sm">The file may be corrupted or the format is not supported</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 px-5 py-2 bg-dark-accent text-white rounded-lg hover:bg-dark-accentHover transition-all text-sm"
              >
                Open in new tab
              </a>
            </div>
          ) : (
            <>
              {isImage && (
                <div className="flex items-center justify-center w-full h-full min-h-0 max-w-full max-h-full">
                  <img
                    src={url}
                    alt={file.name}
                    className="object-contain rounded-lg shadow-xl max-w-full max-h-full"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      display: 'block',
                    }}
                    onError={() => setHasError(true)}
                  />
                </div>
              )}
              {isVideo && (
                <div className="flex items-center justify-center w-full h-full min-h-0 max-w-full max-h-full">
                  <video
                    src={url}
                    controls
                    className="object-contain rounded-lg shadow-xl max-w-full max-h-full"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: 'auto',
                      height: 'auto',
                      display: 'block',
                    }}
                    onError={() => setHasError(true)}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              {isAudio && (
                <div className="w-full max-w-md px-4">
                  <div className="text-center mb-4">
                    <div className="text-5xl mb-3">🎵</div>
                    <h4 className="text-lg font-semibold text-dark-text break-words">{file.name}</h4>
                  </div>
                  <audio
                    src={url}
                    controls
                    className="w-full"
                    onError={() => setHasError(true)}
                  >
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              )}
              {isPDF && (
                <iframe
                  src={url}
                  className="w-full h-full rounded-lg shadow-xl border border-dark-border"
                  style={{ width: '100%', height: '100%', maxHeight: '100%' }}
                  title={file.name}
                  onError={() => setHasError(true)}
                />
              )}
            </>
          )}
        </div>

        {/* Footer with Download Button */}
        {!hasError && (
          <div className="flex items-center justify-center p-4 border-t border-dark-border bg-dark-surface/50 flex-shrink-0">
            <button
              onClick={() => {
                if (onDownload) {
                  onDownload();
                } else {
                  // Fallback: create download link
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = file.name;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-dark-accent to-purple-600 text-white rounded-lg hover:from-dark-accentHover hover:to-purple-500 transition-all transform hover:scale-105 text-sm font-medium shadow-lg shadow-dark-accent/20 flex items-center gap-2"
            >
              ⬇️ Download
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Render using Portal to document.body to ensure it's outside any parent modal
  return createPortal(modalContent, document.body);
}

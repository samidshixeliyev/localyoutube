import React, { useState } from 'react';
import { Download, ChevronDown, Loader2 } from 'lucide-react';

const VideoDownloadButton = ({ video }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Don't show button if video isn't ready
  if (!video?.hlsUrl || video.status !== 'ready') {
    return null;
  }

  const qualities = video.availableQualities || ['1080p', '720p', '480p'];
  
  const estimateSize = (quality) => {
    if (!video.fileSize) return 'Unknown';
    const qualityNum = parseInt(quality.replace('p', ''));
    const ratio = qualityNum / 1080; // Assuming 1080p is the reference
    const estimatedBytes = video.fileSize * ratio;
    const estimatedGB = estimatedBytes / (1024 * 1024 * 1024);
    return estimatedGB.toFixed(2) + ' GB';
  };

  const handleDownload = async (quality) => {
    setDownloading(true);
    setShowMenu(false);
    
    try {
      // Construct quality-specific URL
      const baseUrl = video.hlsUrl.replace('/master.m3u8', '');
      const qualityUrl = `${baseUrl}/${quality}/index.m3u8`;
      
      // Open in new tab
      window.open(qualityUrl, '_blank');
      
      // Show info message
      setTimeout(() => {
        alert(`Downloading ${quality} quality stream.\n\nNote: This downloads the HLS streaming playlist. For MP4 format, please use a video downloader tool or contact support.`);
        setDownloading(false);
      }, 1000);
    } catch (error) {
      alert('Download failed. Please try again.');
      setDownloading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={downloading}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
        title="Download video"
      >
        {downloading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Downloading...</span>
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            <span>Download</span>
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
              Select Quality
            </div>
            
            {qualities
              .sort((a, b) => {
                const aNum = parseInt(a.replace('p', ''));
                const bNum = parseInt(b.replace('p', ''));
                return bNum - aNum; // Highest first
              })
              .map(quality => (
                <button
                  key={quality}
                  onClick={() => handleDownload(quality)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{quality}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        High quality
                      </p>
                    </div>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      ~{estimateSize(quality)}
                    </span>
                  </div>
                </button>
              ))}
            
            {video.fileSize && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                Original: {(video.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VideoDownloadButton;
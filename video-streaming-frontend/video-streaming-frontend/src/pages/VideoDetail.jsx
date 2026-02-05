import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { videoService } from "../services/videoService";
import VideoPlayer from "../components/VideoPlayer";
import ThumbnailUpload from "../components/ThumbnailUpload";
import CommentSection from "../components/CommentSection";
import Navbar from "../components/Navbar";
import { ThumbsUp, Eye, Calendar, Trash2, Loader2, Image } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [viewIncremented, setViewIncremented] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showThumbnailUpload, setShowThumbnailUpload] = useState(false);

useEffect(() => {
  // Decode JWT token to get email (only if logged in)
  const token = localStorage.getItem('jwt_token');
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const decoded = JSON.parse(jsonPayload);
      
      // EMAIL is the primary identifier
      const userEmail = decoded.email || decoded.sub || decoded.username;
      
      setCurrentUser({
        id: userEmail,
        email: userEmail,
        username: decoded.username || decoded.name || userEmail.split('@')[0]
      });
      
      console.log('Current user email:', userEmail);
    } catch (err) {
      console.error('Error decoding token:', err);
      setCurrentUser(null);
    }
  } else {
    setCurrentUser(null); // No token = guest user
  }
}, []);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const handlePrivacyChange = async (visibility) => {
    try {
      await api.post(`/videos/${id}/privacy`, { visibility });
      setVideo((prev) => ({ ...prev, visibility }));
    } catch (err) {
      console.error("Error updating privacy:", err);
      alert("Failed to update privacy settings");
    }
  };
  const loadVideo = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideo(id);
      setVideo(data);
      setError("");
    } catch (err) {
      console.error("Error loading video:", err);
      setError("Failed to load video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = (currentTime) => {
    // Increment view after 3 seconds
    if (currentTime > 3 && !viewIncremented) {
      videoService.incrementView(id).catch(console.error);
      setViewIncremented(true);
      setVideo((prev) => ({ ...prev, views: (prev.views || 0) + 1 }));
    }
  };

const handleLike = async () => {
  // Check if user is logged in
  if (!currentUser) {
    alert('Please login to like videos');
    navigate('/login');
    return;
  }
  
  try {
    if (liked) {
      await videoService.unlikeVideo(id);
      setLiked(false);
      setVideo(prev => ({ ...prev, likes: Math.max(0, (prev.likes || 0) - 1) }));
    } else {
      await videoService.likeVideo(id);
      setLiked(true);
      setVideo(prev => ({ ...prev, likes: (prev.likes || 0) + 1 }));
    }
  } catch (err) {
    console.error('Error toggling like:', err);
    if (err.response?.status === 401) {
      alert('Please login to like videos');
      navigate('/login');
    }
  }
};

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this video?")) {
      return;
    }

    try {
      await videoService.deleteVideo(id);
      navigate("/my-videos");
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Failed to delete video");
    }
  };

  const handleThumbnailUploadSuccess = () => {
    // Reload video to get updated thumbnail
    loadVideo();
    setShowThumbnailUpload(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatViews = (views) => {
    if (!views) return "0 views";
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  if (error || !video) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-red-600 mb-4">{error || "Video not found"}</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go Home
          </button>
        </div>
      </>
    );
  }

const canEdit = currentUser && (
  currentUser.email === video.uploaderEmail ||
  currentUser.id === video.uploaderEmail  // Email-based check
);

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="bg-black rounded-lg overflow-hidden">
              {video.hlsUrl && video.status === "ready" ? (
                <VideoPlayer
                  hlsUrl={video.hlsUrl}
                  onTimeUpdate={handleTimeUpdate}
                />
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                    <p className="text-lg">
                      {video.status === "processing"
                        ? "Video is being processed..."
                        : "Video not available"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {video.title}
              </h1>

              {/* Stats and Actions */}
              <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-6 text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>{formatViews(video.views)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>{formatDate(video.uploadedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      liked
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span>{video.likes || 0}</span>
                  </button>

                  {canEdit && (
                    <>
                      <button
                        onClick={() =>
                          setShowThumbnailUpload(!showThumbnailUpload)
                        }
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Image className="h-5 w-5" />
                        <span>Thumbnail</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                  {/* Privacy Settings - Admin Only */}
                  {canEdit && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Lock className="h-5 w-5" />
                        <span>Privacy Settings</span>
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Visibility
                          </label>
                          <select
                            value={video.visibility || "public"}
                            onChange={(e) =>
                              handlePrivacyChange(e.target.value)
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="public">
                              Public - Everyone can see
                            </option>
                            <option value="unlisted">
                              Unlisted - Anyone with link
                            </option>
                            <option value="private">
                              Private - Only admins
                            </option>
                            <option value="restricted">
                              Restricted - Specific users
                            </option>
                          </select>
                        </div>

                        <p className="text-sm text-gray-500">
                          Current:{" "}
                          <span className="font-semibold capitalize">
                            {video.visibility || "public"}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Uploader */}
              {video.uploaderName && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {video.uploaderName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">
                      {video.uploaderName}
                    </span>
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">
                    Description
                  </h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Video Details */}
              {(video.width || video.height || video.duration) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h2 className="font-semibold text-gray-900 mb-3">Details</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {video.width && video.height && (
                      <div>
                        <span className="text-gray-500">Resolution:</span>
                        <span className="ml-2 text-gray-900">
                          {video.width}x{video.height}
                        </span>
                      </div>
                    )}
                    {video.duration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 text-gray-900">
                          {Math.floor(video.duration / 60)}:
                          {(video.duration % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    )}
                    {video.availableQualities &&
                      video.availableQualities.length > 0 && (
                        <div>
                          <span className="text-gray-500">Qualities:</span>
                          <span className="ml-2 text-gray-900">
                            {video.availableQualities.join(", ")}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Upload Section */}
            {canEdit && showThumbnailUpload && (
              <ThumbnailUpload
                videoId={id}
                currentThumbnail={video.thumbnailUrl}
                onUploadSuccess={handleThumbnailUploadSuccess}
              />
            )}

            {/* Comments Section */}
            <CommentSection
              videoId={id}
              currentUserId={currentUser?.id?.toString()}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-4">
                Related Videos
              </h2>
              <p className="text-gray-500 text-sm">Coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoDetail;

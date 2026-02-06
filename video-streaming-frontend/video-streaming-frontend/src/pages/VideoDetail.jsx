import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { videoService } from "../services/videoService";
import VideoPlayer from "../components/VideoPlayer";
import ThumbnailUpload from "../components/ThumbnailUpload";
import VideoDownloadButton from "../components/VideoDownloadButton";
import CommentSection from "../components/CommentSection";
import Navbar from "../components/Navbar";
import { 
  ThumbsUp, 
  Eye, 
  Calendar, 
  Trash2, 
  Loader2, 
  Image, 
  Edit2, 
  Lock,
  Globe,
  Link2,
  Users,
  Save,
  X,
  Check,
  Plus
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, hasPermission } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [viewIncremented, setViewIncremented] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showThumbnailUpload, setShowThumbnailUpload] = useState(false);
  
  // Inline editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    visibility: 'public',
    allowedEmails: [],
    tags: []
  });
  const [emailInput, setEmailInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );

        const decoded = JSON.parse(jsonPayload);
        const userEmail = decoded.email || decoded.sub || decoded.username;
        const userPermissions = decoded.permissions || [];
        const userRole = decoded.role || '';

        setCurrentUser({
          id: userEmail,
          email: userEmail,
          username: decoded.username || decoded.name || userEmail.split("@")[0],
          permissions: userPermissions,
          role: userRole,
          hasAdminPermission: userPermissions.includes('admin-modtube') || userRole === 'ADMIN'
        });
      } catch (err) {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    loadVideo();
  }, [id]);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentUser || !id) return;

      try {
        const response = await videoService.getLikeStatus(id);
        setLiked(response.liked);
      } catch (err) {
        setLiked(false);
      }
    };

    checkLikeStatus();
  }, [id, currentUser]);

  const loadVideo = async () => {
    try {
      setLoading(true);
      const data = await videoService.getVideo(id);
      setVideo(data);
      setEditForm({
        title: data.title || '',
        description: data.description || '',
        visibility: data.visibility || 'public',
        allowedEmails: data.allowedEmails || [],
        tags: data.tags || []
      });
      setError("");
    } catch (err) {
      setError("Failed to load video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = (currentTime) => {
    if (currentTime > 3 && !viewIncremented) {
      videoService.incrementView(id).catch(() => {});
      setViewIncremented(true);
      setVideo((prev) => ({ ...prev, views: (prev.views || 0) + 1 }));
    }
  };

  const handleLike = async () => {
    if (!currentUser) {
      alert("Please login to like videos");
      navigate("/login");
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    try {
      const response = await videoService.toggleLike(id);
      setLiked(response.liked);
      setVideo((prev) => ({
        ...prev,
        likes: response.likes,
      }));
    } catch (err) {
      if (err.response?.status === 401) {
        alert("Please login to like videos");
        navigate("/login");
      } else {
        alert("Failed to like video. Please try again.");
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    try {
      await videoService.deleteVideo(id);
      alert("Video deleted successfully");
      navigate("/my-videos");
    } catch (err) {
      alert("Failed to delete video: " + (err.response?.data?.message || err.message));
    }
  };

  const handleThumbnailUploadSuccess = () => {
    loadVideo();
    setShowThumbnailUpload(false);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      alert('Title is required');
      return;
    }

    if (editForm.visibility === 'restricted' && editForm.allowedEmails.length === 0) {
      alert('Please add at least one email for restricted access');
      return;
    }

    setSaving(true);

    try {
      await api.put(`/videos/${id}`, {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags
      });

      await api.post(`/videos/${id}/privacy`, {
        visibility: editForm.visibility,
        allowedUserEmails: editForm.allowedEmails
      });

      await loadVideo();
      setIsEditing(false);
      alert('Video updated successfully!');
    } catch (err) {
      alert('Failed to update video: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    if (editForm.allowedEmails.includes(email)) {
      alert('This email is already added');
      return;
    }
    
    setEditForm(prev => ({
      ...prev,
      allowedEmails: [...prev.allowedEmails, email]
    }));
    setEmailInput('');
  };

  const removeEmail = (email) => {
    setEditForm(prev => ({
      ...prev,
      allowedEmails: prev.allowedEmails.filter(e => e !== email)
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    
    if (editForm.tags.includes(tag)) {
      alert('This tag is already added');
      return;
    }
    
    if (editForm.tags.length >= 10) {
      alert('Maximum 10 tags allowed');
      return;
    }
    
    setEditForm(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
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

  const getVisibilityInfo = () => {
    if (!video.visibility || video.visibility === 'public') {
      return { icon: Globe, text: 'Public', color: 'bg-green-500' };
    }
    
    const visibilityMap = {
      private: { icon: Lock, text: 'Private', color: 'bg-red-500' },
      unlisted: { icon: Link2, text: 'Unlisted', color: 'bg-yellow-500' },
      restricted: { icon: Users, text: 'Restricted', color: 'bg-purple-500' }
    };
    
    return visibilityMap[video.visibility] || visibilityMap.public;
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

  const isOwner = currentUser && (
    currentUser.email === video.uploaderEmail ||
    currentUser.id === video.uploaderEmail
  );
  
  const isAdmin = currentUser && (
    currentUser.hasAdminPermission ||
    (user && hasPermission && hasPermission('admin-modtube'))
  );
  
  const canEdit = isOwner || isAdmin;

  const visibilityInfo = getVisibilityInfo();
  const VisibilityIcon = visibilityInfo.icon;

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
                        : video.status === "uploading"
                        ? "Video is uploading..."
                        : "Video not available"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* INLINE EDITING MODE */}
              {isEditing ? (
                <div className="space-y-4">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add tag..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={addTag} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editForm.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
                          #{tag}
                          <button onClick={() => removeTag(tag)} className="text-red-600 hover:text-red-700">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visibility Radio Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'public', icon: Globe, label: 'Public', color: 'green' },
                        { value: 'unlisted', icon: Link2, label: 'Unlisted', color: 'yellow' },
                        { value: 'private', icon: Lock, label: 'Private', color: 'red' },
                        { value: 'restricted', icon: Users, label: 'Restricted', color: 'purple' }
                      ].map(option => {
                        const Icon = option.icon;
                        return (
                          <label key={option.value} className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            editForm.visibility === option.value 
                              ? `border-${option.color}-500 bg-${option.color}-50` 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}>
                            <input
                              type="radio"
                              name="visibility"
                              value={option.value}
                              checked={editForm.visibility === option.value}
                              onChange={(e) => setEditForm({...editForm, visibility: e.target.value})}
                              className="sr-only"
                            />
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{option.label}</span>
                            {editForm.visibility === option.value && <Check className="h-4 w-4 ml-auto" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Restricted Emails */}
                  {editForm.visibility === 'restricted' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-purple-900 mb-2">Allowed Users</label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                          placeholder="user@example.com"
                          className="flex-1 px-3 py-2 border border-purple-300 rounded-lg"
                        />
                        <button onClick={addEmail} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editForm.allowedEmails.map(email => (
                          <div key={email} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-purple-200">
                            <span className="text-sm">{email}</span>
                            <button onClick={() => removeEmail(email)} className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          title: video.title || '',
                          description: video.description || '',
                          visibility: video.visibility || 'public',
                          allowedEmails: video.allowedEmails || [],
                          tags: video.tags || []
                        });
                      }}
                      disabled={saving}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* VIEW MODE */}
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 flex-1">
                      {video.title}
                    </h1>
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-white text-sm ${visibilityInfo.color} flex-shrink-0`}>
                      <VisibilityIcon className="h-4 w-4" />
                      <span>{visibilityInfo.text}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-6 pb-6 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Eye className="h-5 w-5" />
                      <span className="font-medium">{formatViews(video.views)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>{formatDate(video.uploadedAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-gray-200">
                    <button
                      onClick={handleLike}
                      disabled={isLiking}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                        liked
                          ? "bg-primary-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      <ThumbsUp className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
                      <span className="font-medium">{video.likes || 0}</span>
                    </button>

                    <VideoDownloadButton video={video} />

                    {canEdit && (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-medium"
                        >
                          <Edit2 className="h-5 w-5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setShowThumbnailUpload(!showThumbnailUpload)}
                          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-md font-medium"
                        >
                          <Image className="h-5 w-5" />
                          <span>Thumbnail</span>
                        </button>

                        <button
                          onClick={handleDelete}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md font-medium"
                        >
                          <Trash2 className="h-5 w-5" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>

                  {video.uploaderName && (
                    <div className="mb-6 pb-6 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {video.uploaderName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-lg">
                            {video.uploaderName}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {video.description && (
                    <div className="mb-6">
                      <h2 className="font-semibold text-gray-900 mb-3 text-lg">Description</h2>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {video.description}
                      </p>
                    </div>
                  )}

                  {video.tags && video.tags.length > 0 && (
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {video.tags.map((tag, index) => (
                          <span key={index} className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {canEdit && showThumbnailUpload && (
              <ThumbnailUpload
                videoId={id}
                currentThumbnail={video.thumbnailUrl}
                onUploadSuccess={handleThumbnailUploadSuccess}
              />
            )}

            <CommentSection
              videoId={id}
              currentUserId={currentUser?.email}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-4">
                Video Information
              </h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium px-2 py-1 rounded ${
                    video.status === 'ready' ? 'bg-green-100 text-green-800' :
                    video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {video.status ? video.status.charAt(0).toUpperCase() + video.status.slice(1) : 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Visibility:</span>
                  <span className={`font-medium px-2 py-1 rounded text-white ${visibilityInfo.color}`}>
                    {visibilityInfo.text}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoDetail;
import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";

const CommentSection = ({ videoId, currentUserId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [page, setPage] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadComments();
  }, [videoId, page]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/videos/${videoId}/comments`, {
        params: { page, size: 20 },
      });

      if (page === 0) {
        setComments(response.data.comments || []);
      } else {
        setComments((prev) => [...prev, ...(response.data.comments || [])]);
      }

      setTotalComments(response.data.totalElements || 0);
      setHasMore(page < (response.data.totalPages || 0) - 1);
      setError("");
    } catch (err) {
      console.error("Error loading comments:", err);
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!commentText.trim()) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.post(`/videos/${videoId}/comments`, {
        text: commentText.trim(),
      });

      // Add new comment to the beginning of the list
      setComments((prev) => [response.data, ...prev]);
      setTotalComments((prev) => prev + 1);
      setCommentText("");
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError(err.response?.data?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await api.delete(`/videos/${videoId}/comments/${commentId}`);

      // Remove comment from list
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotalComments((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("Failed to delete comment");
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60)
      return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffDays < 30)
      return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
    if (diffDays < 365)
      return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? "s" : ""} ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <MessageSquare className="h-6 w-6 text-gray-700" />
        <h3 className="text-xl font-semibold text-gray-900">
          Comments {totalComments > 0 && `(${totalComments})`}
        </h3>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Comment Form */}
      {currentUserId ? (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                {currentUserId ? "U" : "?"}
              </div>
            </div>
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                disabled={submitting}
              />
              <div className="mt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCommentText("")}
                  disabled={submitting || !commentText.trim()}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Comment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600 mb-3">Want to comment?</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Login to Comment
          </a>
        </div>
      )}

      {/* Comments List */}
      {loading && page === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No comments yet</p>
          <p className="text-gray-400 text-sm mt-1">Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0"
            >
              {/* ... existing code ... */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">
                      {comment.username || "Anonymous"}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  {/* EMAIL-BASED: Compare comment userId (email) with current user email */}
                  {currentUserId && comment.userId === currentUserId && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-gray-700 whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load more comments</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;

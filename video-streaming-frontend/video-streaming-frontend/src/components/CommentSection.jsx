import React, { useState, useEffect } from "react";
import { MessageSquare, Send, Trash2, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

const fmtAge = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (d < 1)   return 'İndicə';
  if (d < 60)  return `${d} dəq. əvvəl`;
  const h = Math.floor(d / 60);
  if (h < 24)  return `${h} saat əvvəl`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} gün əvvəl`;
  if (day < 30) return `${Math.floor(day/7)} həftə əvvəl`;
  if (day < 365) return `${Math.floor(day/30)} ay əvvəl`;
  return `${Math.floor(day/365)} il əvvəl`;
};

const CommentSection = ({ videoId, currentUserId }) => {
  const [comments,      setComments]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [commentText,   setCommentText]   = useState('');
  const [page,          setPage]          = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [hasMore,       setHasMore]       = useState(false);

  useEffect(() => { loadComments(); }, [videoId, page]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/videos/${videoId}/comments`, { params: { page, size: 20 } });
      const list = res.data.comments || [];
      setComments(p => page === 0 ? list : [...p, ...list]);
      setTotalComments(res.data.totalElements || 0);
      setHasMore(page < (res.data.totalPages || 0) - 1);
      setError('');
    } catch { setError('Şərhlər yüklənə bilmədi'); }
    finally  { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/videos/${videoId}/comments`, { text: commentText.trim() });
      setComments(p => [res.data, ...p]);
      setTotalComments(p => p + 1);
      setCommentText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Şərh göndərilə bilmədi');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Bu şərhi silmək istədiyinizə əminsinizmi?')) return;
    try {
      await api.delete(`/videos/${videoId}/comments/${commentId}`);
      setComments(p => p.filter(c => c.id !== commentId));
      setTotalComments(p => Math.max(0, p - 1));
    } catch { alert('Şərh silinə bilmədi'); }
  };

  const initials = (name) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Input */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex gap-3">
            <div className="h-9 w-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {initials(currentUserId)}
            </div>
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Şərh əlavə et…"
                rows={2}
                disabled={submitting}
                className="w-full px-3 py-2 border-b-2 border-gray-200 dark:border-army-600 bg-transparent
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:border-primary-500 dark:focus:border-primary-500
                           resize-none text-sm transition-colors"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setCommentText('')}
                  disabled={submitting || !commentText.trim()}
                  className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-army-700
                             rounded-full transition-colors disabled:opacity-40">
                  Ləğv et
                </button>
                <button type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-full
                             hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                  {submitting
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Göndərilir…</>
                    : <><Send className="h-3.5 w-3.5" />Göndər</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-5 p-4 bg-gray-50 dark:bg-army-900 border border-gray-200 dark:border-army-700 rounded-xl text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Şərh yazmaq üçün daxil olun</p>
          <a href="/login"
            className="inline-block px-5 py-2 bg-primary-600 text-white text-sm rounded-full hover:bg-primary-700 transition-colors font-medium">
            Daxil ol
          </a>
        </div>
      )}

      {/* List */}
      {loading && page === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="h-10 w-10 text-gray-200 dark:text-army-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Hələ şərh yoxdur</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">İlk şərhi sən yaz!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 group">
              <div className="h-8 w-8 bg-gradient-to-br from-army-600 to-army-800 rounded-full flex items-center justify-center
                              text-white font-bold text-xs flex-shrink-0 mt-0.5">
                {initials(c.username)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {c.username || 'Anonim'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{fmtAge(c.createdAt)}</span>
                  </div>
                  {currentUserId && c.userId === currentUserId && (
                    <button onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600
                                 hover:text-red-500 dark:hover:text-red-400 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                  {c.text}
                </p>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setPage(p => p + 1)} disabled={loading}
                className="px-5 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20
                           rounded-full transition-colors disabled:opacity-50 flex items-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Yüklənir…</> : 'Daha çox yüklə'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;

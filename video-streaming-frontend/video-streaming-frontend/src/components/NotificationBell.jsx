import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Video, X, Megaphone, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/api';

const TYPE_ICON = {
  MEETING_INVITE:   { icon: Video,         color: 'text-blue-500' },
  MEETING_STARTED:  { icon: Video,         color: 'text-green-500' },
  ANNOUNCEMENT:     { icon: Megaphone,     color: 'text-blue-500' },
  WARNING:          { icon: AlertTriangle, color: 'text-orange-500' },
  NEW_VIDEO:        { icon: Video,         color: 'text-green-500' },
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)      return `${diff}s`;
  if (diff < 3600)    return `${Math.floor(diff / 60)}dq`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}s`;
  return `${Math.floor(diff / 86400)}g`;
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen]           = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]       = useState(0);
  const panelRef                  = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      const list = res.data || [];
      setNotifications(list);
      setUnread(list.filter(n => !n.read).length);
    } catch {
      // ignore — not critical
    }
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────────
  // SSE (EventSource) is buffered by Cloudflare and leaves a request hanging
  // "pending" forever. Short polling is reliable behind the proxy, holds no
  // long-lived connection, and is cheap (indexed query, ~15s cadence).
  useEffect(() => {
    if (!isAuthenticated) return;

    loadNotifications();
    const iv = setInterval(loadNotifications, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, loadNotifications]);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const handleClick = async (n) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        setUnread(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.meetingId) {
      // Invites carry a signed token → one-click join (no room code needed).
      const suffix = (n.type === 'MEETING_INVITE' && n.data)
        ? `?invite=${encodeURIComponent(n.data)}` : '';
      navigate(`/meetings/${n.meetingId}/room${suffix}`);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400
                   hover:bg-primary-50 dark:hover:bg-army-700 transition-colors"
        title="Bildirişlər"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center
                           rounded-full bg-red-600 text-white text-[10px] font-bold leading-none px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] flex flex-col
                        bg-white dark:bg-army-800 border border-gray-200 dark:border-army-600
                        rounded-xl shadow-xl z-[200] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-gray-100 dark:border-army-700 flex-shrink-0">
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Bildirişlər
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400
                             hover:underline"
                >
                  <Check className="h-3 w-3" />
                  Hamısını oxu
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Bildiriş yoxdur</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_ICON[n.type] || { icon: Bell, color: 'text-gray-400' };
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
                                hover:bg-gray-50 dark:hover:bg-army-700
                                ${!n.read ? 'bg-primary-50/60 dark:bg-primary-900/20' : ''}`}
                  >
                    {/* Unread dot */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center
                                      ${!n.read
                                        ? 'bg-primary-100 dark:bg-primary-800/40'
                                        : 'bg-gray-100 dark:bg-army-700'}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      {!n.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5
                                         rounded-full bg-red-500 border-2 border-white dark:border-army-800" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-tight truncate
                                     ${!n.read
                                       ? 'text-gray-900 dark:text-gray-100'
                                       : 'text-gray-600 dark:text-gray-300'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-snug">
                          {n.message}
                        </p>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

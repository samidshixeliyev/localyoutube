import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Send, ArrowLeft, AlertTriangle, Video, CheckCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { broadcastNotification } from '../../services/api';

const TYPES = [
  { value: 'ANNOUNCEMENT', label: 'Elan',       Icon: Megaphone,     color: 'text-blue-500' },
  { value: 'WARNING',      label: 'Xəbərdarlıq', Icon: AlertTriangle, color: 'text-orange-500' },
  { value: 'NEW_VIDEO',    label: 'Yeni Video',  Icon: Video,         color: 'text-green-500' },
];

export default function NotificationManagement() {
  const navigate = useNavigate();
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [type, setType]       = useState('ANNOUNCEMENT');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);   // { ok, text }

  const send = async () => {
    if (!title.trim()) { setResult({ ok: false, text: 'Başlıq tələb olunur' }); return; }
    setSending(true); setResult(null);
    try {
      const res = await broadcastNotification(title.trim(), message.trim(), type);
      setResult({ ok: true, text: `Bildiriş ${res.data?.recipients ?? ''} istifadəçiyə göndərildi` });
      setTitle(''); setMessage('');
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.error || 'Bildiriş göndərilə bilmədi' });
    } finally { setSending(false); }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-army-700 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bildiriş İdarəetməsi</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bütün istifadəçilərə elan və ya xəbərdarlıq göndərin.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-army-800 rounded-xl shadow-sm border border-gray-200 dark:border-army-700 p-6 space-y-5">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Növ</label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      type === t.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-army-600 hover:border-gray-300 dark:hover:border-army-500'
                    }`}>
                    <t.Icon className={`w-5 h-5 ${t.color}`} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Başlıq <span className="text-red-500">*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={255}
                placeholder="Məs: Sistem yenilənməsi"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-army-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20" />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mətn</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                placeholder="Bildiriş mətni (istəyə bağlı)"
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-army-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none" />
            </div>

            {result && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${
                result.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {result.text}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={send} disabled={sending || !title.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
                {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                Hamıya göndər
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, Trash2, Edit2, X, PhoneCall, Square,
  Globe, Users, MoreVertical, Radio, Link2, Check, AlertTriangle,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import UserEmailPicker from '../components/UserEmailPicker';
import {
  getMeetings, createMeeting, updateMeeting, deleteMeeting, startMeeting, endMeeting,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── Visibility ──────────────────────────────────────────────── */
const VIS_OPTS = [
  { value: 'PUBLIC',     label: 'İctimai', Icon: Globe, desc: 'Link vasitəsilə hər qeydiyyatlı istifadəçi qoşula bilər' },
  { value: 'RESTRICTED', label: 'Məhdud',  Icon: Users, desc: 'Yalnız seçilmiş istifadəçilər'                },
];

const VIS_CLS = {
  PUBLIC:     { text: 'text-green-500',  bg: 'bg-green-500/10'  },
  RESTRICTED: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
};

function VisBadge({ value }) {
  const key = (value || 'PUBLIC').toUpperCase();
  const opt = VIS_OPTS.find(o => o.value === key) || VIS_OPTS[0];
  const cls = VIS_CLS[key] || VIS_CLS.PUBLIC;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${cls.text} ${cls.bg}`}>
      <opt.Icon className="w-2.5 h-2.5" />{opt.label}
    </span>
  );
}

/* ── Status ──────────────────────────────────────────────────── */
const STATUS_META = {
  SCHEDULED: { label: 'Planlaşdırılıb', cls: 'text-gray-500 bg-gray-500/10' },
  LIVE:      { label: 'Canlı',          cls: 'text-red-600 bg-red-500/10' },
  ENDED:     { label: 'Bitib',          cls: 'text-gray-400 bg-gray-400/10' },
};

function StatusBadge({ value }) {
  const meta = STATUS_META[value] || STATUS_META.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${meta.cls}`}>
      {value === 'LIVE' && <Radio className="w-2.5 h-2.5 animate-pulse" />}
      {meta.label}
    </span>
  );
}

/* ── Meeting form modal (create + edit) ──────────────────────── */
function MeetingModal({ open, onClose, onSave, canSearch, initial }) {
  const isEdit = !!initial;
  const [title,   setTitle]   = useState('');
  const [desc,    setDesc]    = useState('');
  const [vis,     setVis]     = useState('PUBLIC');
  const [emails,  setEmails]  = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || '');
      setDesc(initial?.description || '');
      setVis((initial?.visibility || 'PUBLIC').toUpperCase());
      setEmails(Array.isArray(initial?.allowedEmails) ? initial.allowedEmails : []);
      setError('');
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSave = async () => {
    if (!title.trim()) { setError('Başlıq tələb olunur'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), description: desc.trim(), visibility: vis, allowedEmails: emails.join(',') });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (isEdit ? 'Görüş yenilənə bilmədi' : 'Görüş yaradıla bilmədi'));
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-army-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-army-700 overflow-hidden max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-army-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Görüşü redaktə et' : 'Yeni görüş yarat'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-army-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Başlıq <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Görüşün adı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Açıqlama</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="İsteğe bağlı açıqlama"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Görünürlük</label>
            <div className="grid grid-cols-2 gap-2">
              {VIS_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setVis(opt.value)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${
                    vis === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-200 dark:border-army-600 hover:border-gray-300 dark:hover:border-army-500'
                  }`}>
                  <opt.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${vis === opt.value ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${vis === opt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>{opt.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {vis === 'RESTRICTED' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">İcazə verilən istifadəçilər</label>
              <UserEmailPicker emails={emails} onChange={setEmails} canSearch={canSearch} />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-army-700 flex justify-end gap-2.5 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-army-700 hover:bg-gray-200 dark:hover:bg-army-600 rounded-xl transition-colors disabled:opacity-50">
            Ləğv et
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? 'Yadda saxla' : 'Yarat'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Meeting card ────────────────────────────────────────────── */
function MeetingCard({ m, onJoin, onStart, onEnd, onDelete, onEdit, busy }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const menuRef = useRef(null);

  const isLive   = m.status === 'LIVE';
  const isEnded  = m.status === 'ENDED';
  const manage   = m.canManage;           // host OR super-admin

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const copyLink = () => {
    const url = `${window.location.origin}/meetings/${m.id}/room`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const created = m.createdAt ? new Date(m.createdAt).toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div className="group flex flex-col bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-xl overflow-hidden">
      <div className="relative aspect-video bg-gradient-to-br from-primary-900 via-army-800 to-army-900 flex items-center justify-center">
        <Video className="w-10 h-10 text-white/25" />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <StatusBadge value={m.status} />
          <VisBadge value={m.visibility} />
        </div>
        {manage && (
          <div className="absolute top-2 right-2" ref={menuRef}>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
                className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-20 bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-xl shadow-lg overflow-hidden w-44">
                  {/* Edit — not while live */}
                  <button onClick={() => { setMenuOpen(false); onEdit(m); }}
                    disabled={isLive}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Edit2 className="w-3.5 h-3.5" /> Redaktə et
                  </button>
                  {/* End — while live */}
                  {isLive && (
                    <button onClick={() => { setMenuOpen(false); onEnd(m); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                      <Square className="w-3.5 h-3.5" /> Görüşü bitir
                    </button>
                  )}
                  {/* Delete — blocked while live */}
                  <button onClick={() => { if (!isLive) { setMenuOpen(false); onDelete(m); } }}
                    disabled={isLive}
                    title={isLive ? 'Canlı görüşü silmək olmaz — əvvəlcə bitirin' : ''}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                  {isLive && (
                    <p className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-army-700 leading-tight">
                      Silmək üçün əvvəlcə görüşü bitirin
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">{m.title}</h3>
        {m.description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{m.description}</p>
        )}
        <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          {m.hostName || m.hostEmail} · {created}
        </div>

        <div className="mt-3 flex gap-2">
          {/* Start — managers, not yet started */}
          {manage && !isLive && !isEnded && (
            <button onClick={() => onStart(m)} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <PhoneCall className="w-3.5 h-3.5" /> Başlat
            </button>
          )}
          {/* Join — anyone with access, while live */}
          {isLive && (
            <button onClick={() => onJoin(m)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors">
              <PhoneCall className="w-3.5 h-3.5" /> Qoşul
            </button>
          )}
          {/* End — managers, while live */}
          {manage && isLive && (
            <button onClick={() => onEnd(m)} disabled={busy} title="Görüşü bitir"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
          {isEnded && (
            <span className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-army-700 text-gray-400 dark:text-gray-500 rounded-lg text-xs font-semibold">
              Görüş bitib
            </span>
          )}
          {!manage && m.status === 'SCHEDULED' && (
            <span className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-army-700 text-gray-400 dark:text-gray-500 rounded-lg text-xs font-semibold">
              Hələ başlamayıb
            </span>
          )}

          <button
            onClick={copyLink}
            title={copied ? 'Kopyalandı!' : 'Linki kopyala'}
            className={`flex items-center justify-center px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors
              ${copied
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-army-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-army-600'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function VideoMeetings() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canSearch = hasPermission('manage-users') || hasPermission('super-admin') || hasPermission('admin-modtube');

  const [meetings, setMeetings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState(null);
  const [toast,    setToast]    = useState('');

  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);   // null = create
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  // Auto-refresh so LIVE/ENDED status changes appear without a manual reload.
  useEffect(() => {
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = async (silent = false) => {
    try {
      const res = await getMeetings();
      setMeetings(res.data || []);
    } catch { if (!silent) setMeetings([]); }
    finally { if (!silent) setLoading(false); }
  };

  const handleCreate = async ({ title, description, visibility, allowedEmails }) => {
    const res = await createMeeting(title, description, visibility, allowedEmails);
    setMeetings(m => [res.data, ...m]);
  };

  const handleUpdate = async ({ title, description, visibility, allowedEmails }) => {
    const res = await updateMeeting(editTarget.id, title, description, visibility, allowedEmails);
    setMeetings(list => list.map(x => x.id === editTarget.id ? res.data : x));
  };

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit   = (m) => { setEditTarget(m); setModalOpen(true); };

  const handleStart = async (m) => {
    setBusyId(m.id);
    try {
      const res = await startMeeting(m.id);
      setMeetings(list => list.map(x => x.id === m.id ? res.data : x));
      navigate(`/meetings/${m.id}/room`);
    } catch (err) {
      setToast(err.response?.data?.error || 'Görüş başladıla bilmədi');
    } finally { setBusyId(null); }
  };

  const handleEnd = async (m) => {
    setBusyId(m.id);
    try {
      const res = await endMeeting(m.id);
      setMeetings(list => list.map(x => x.id === m.id ? res.data : x));
      setToast('Görüş bitirildi');
    } catch (err) {
      setToast(err.response?.data?.error || 'Görüş bitirilə bilmədi');
    } finally { setBusyId(null); }
  };

  const handleJoin = (m) => navigate(`/meetings/${m.id}/room`);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id);
      setMeetings(list => list.filter(m => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      // Surface the server reason (e.g. live meeting can't be deleted).
      setToast(err.response?.data?.error || 'Görüş silinə bilmədi');
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 dark:bg-army-900">
        <div className="max-w-6xl mx-auto px-4 py-8">

          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Görüşlər</h1>
              {!loading && meetings.length > 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500 font-normal">{meetings.length}</span>
              )}
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Yeni görüş
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="aspect-video rounded-xl bg-gray-200 dark:bg-army-800 animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-army-800 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-army-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-army-800 flex items-center justify-center mb-5">
                <Video className="w-10 h-10 text-gray-300 dark:text-army-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Hələ görüş yoxdur</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
                Canlı video görüş yaratmaq üçün aşağıdakı düyməyə klikləyin.
              </p>
              <button onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> İlk görüşünü yarat
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {meetings.map(m => (
                <MeetingCard
                  key={m.id}
                  m={m}
                  busy={busyId === m.id}
                  onJoin={handleJoin}
                  onStart={handleStart}
                  onEnd={handleEnd}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / edit modal */}
      <MeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={editTarget ? handleUpdate : handleCreate}
        canSearch={canSearch}
        initial={editTarget}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Görüş silinsin?"
        message={`"${deleteTarget?.title}" görüşünü silmək istədiyinizə əminsinizmi? Bu əməliyyat geri alına bilməz.`}
        confirmLabel={deleting ? 'Silinir…' : 'Sil'}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-army-700 text-white text-sm shadow-2xl border border-white/10">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </>
  );
}

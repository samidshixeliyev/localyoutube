import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, LogOut,
  Users, Lock, Monitor, MonitorOff, RefreshCw,
  MessageSquare, Send, X, Minimize2, Maximize2,
  KeyRound, UserPlus, UserX, Pin, PinOff, Paperclip, FileText, Download,
  ExternalLink, ChevronDown, Globe,
} from 'lucide-react';
import {
  getMeeting, startMeeting, endMeeting,
  joinMeeting, inviteToMeeting, uploadMeetingAttachment,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import MeetingMedia, { isMeetingMediaSupported } from '../lib/meetingMedia';

/* How many remote cameras to actually pull video for at once (the rest show an
   avatar). Keeps 10-30-person rooms smooth — you only decode what you display. */
const MAX_VIDEO_TILES = 20;

/* ─── helpers ─────────────────────────────────────────────────── */
const gridClass = (n) => {
  if (n <= 1) return 'grid-cols-1 max-w-2xl';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-4xl';
  if (n <= 4) return 'grid-cols-2 max-w-5xl';
  if (n <= 6) return 'grid-cols-2 lg:grid-cols-3 max-w-6xl';
  return 'grid-cols-2 lg:grid-cols-4';
};

const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();
const fmtTime  = (ts) => new Date(ts).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
const isImageAtt = (att) =>
  (!!att?.contentType && att.contentType.startsWith('image/')) ||
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att?.name || '');
const fmtSize  = (b) => {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
function Linkify({ text, self }) {
  if (!text) return null;
  return String(text).split(URL_RE).map((part, i) => {
    if (!part) return null;
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          className={`underline break-all hover:opacity-80 ${self ? 'text-white' : 'text-primary-300'}`}>{part}</a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* Local preview from a MediaStream. */
function VideoStream({ stream, muted = false, mirror = false, contain = false }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream ?? null; }, [stream]);
  return (
    <video ref={ref} autoPlay playsInline muted={muted}
      className={['w-full h-full', contain ? 'object-contain' : 'object-cover', mirror ? '-scale-x-100' : ''].join(' ')} />
  );
}

/* Remote video: hosts the engine's decode <canvas> for this sender/kind. */
function RemoteVideo({ engine, email, kind, contain = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !engine) return;
    const canvas = engine.canvasFor(email, kind);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = contain ? 'contain' : 'cover';
    host.appendChild(canvas);
    return () => { try { host.removeChild(canvas); } catch { /* ignore */ } };
  }, [engine, email, kind, contain]);
  return <div ref={ref} className="w-full h-full flex items-center justify-center" />;
}

function PinButton({ pinned, onToggle }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      title={pinned ? 'Sancağı çıxar' : 'Sancaqla (böyüt)'}
      className={`p-1.5 rounded-lg text-white transition-colors ${pinned ? 'bg-primary-600 hover:bg-primary-700' : 'bg-black/60 hover:bg-black/80'}`}>
      {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
    </button>
  );
}

/* Local self tile (MediaStream). */
function LocalTile({ camStream, screenStream, micOn, camOn, screenOn, name, full = false, pinned, onPin }) {
  const activeStream = screenOn && screenStream ? screenStream : camStream;
  const showVideo    = screenOn ? !!screenStream : (camOn && !!camStream);
  return (
    <div className={`group relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center ${full ? 'w-full h-full' : 'aspect-video'}`}>
      {activeStream && <VideoStream stream={activeStream} muted mirror={!screenOn} contain={screenOn} />}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">{initial(name)}</div>
        </div>
      )}
      {onPin && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <PinButton pinned={pinned} onToggle={onPin} />
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
        <span className="max-w-[120px] truncate">{name} (Siz)</span>
        {!micOn && <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
        {screenOn && <Monitor className="w-3 h-3 text-primary-400 flex-shrink-0" />}
      </div>
    </div>
  );
}

/* Remote tile (engine canvas). showScreen → render their screen-share canvas. */
function RemoteTile({ engine, peer, full = false, contain = false, canManage = false,
                      onKick, onMute, onCamOff, pinned, onPin, onDm, showScreen = false }) {
  const kind = showScreen ? 'screen' : 'camera';
  const hasVideo = showScreen ? peer.screen : peer.camera;
  return (
    <div className={`group relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center ${full ? 'w-full h-full' : 'aspect-video'}`}>
      {hasVideo
        ? <RemoteVideo engine={engine} email={peer.email} kind={kind} contain={contain || showScreen} />
        : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-army-600 flex items-center justify-center text-white text-2xl font-bold">{initial(peer.name || peer.email)}</div>
          </div>
        )}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onPin && <PinButton pinned={pinned} onToggle={onPin} />}
        {onDm && (
          <button onClick={() => onDm(peer)} title="Şəxsi mesaj"
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white"><MessageSquare className="w-3.5 h-3.5" /></button>
        )}
        {canManage && (
          <>
            <button onClick={() => onMute?.(peer.email)} title="Mikrofonu söndür"
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white"><MicOff className="w-3.5 h-3.5" /></button>
            <button onClick={() => onCamOff?.(peer.email)} title="Kameranı söndür"
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white"><VideoOff className="w-3.5 h-3.5" /></button>
            <button onClick={() => onKick?.(peer)} title="Görüşdən çıxar"
              className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white"><UserX className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm max-w-[150px]">
        <span className="truncate">{peer.name || peer.email || 'Qonaq'}</span>
        {!peer.audio && <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />}
      </div>
    </div>
  );
}

/* Strip thumbnail — self (stream) or remote (engine canvas). */
function StripTile({ stream, engine, email, hasVideo, name, onPin }) {
  return (
    <div className="group relative bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 w-28 sm:w-full aspect-video">
      {stream
        ? <VideoStream stream={stream} muted />
        : (engine && hasVideo)
          ? <RemoteVideo engine={engine} email={email} kind="camera" />
          : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-army-600 flex items-center justify-center text-white text-sm font-bold">{initial(name)}</div>
            </div>
          )}
      {onPin && (
        <button onClick={onPin} title="Sancaqla"
          className="absolute top-1 right-1 p-1 rounded bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <Pin className="w-3 h-3" />
        </button>
      )}
      <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded truncate">{name}</div>
    </div>
  );
}

function AttachmentView({ att, self, onPreview }) {
  if (!att?.url) return null;
  if (isImageAtt(att)) {
    return (
      <button type="button" onClick={() => onPreview?.(att)}
        className="block mt-1.5 w-full overflow-hidden rounded-lg border border-white/10 group/att">
        <img src={att.url} alt={att.name} className="max-h-52 w-full object-cover group-hover/att:opacity-90 transition-opacity" />
      </button>
    );
  }
  return (
    <div className={`mt-1.5 flex items-center gap-2 px-2.5 py-2 rounded-lg border ${self ? 'bg-primary-700/50 border-primary-400/30' : 'bg-army-700/50 border-army-600'}`}>
      <FileText className="w-5 h-5 flex-shrink-0 text-gray-200" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-100 truncate" title={att.name}>{att.name}</div>
        <div className="text-[10px] text-gray-400">{fmtSize(att.size)}</div>
      </div>
      <a href={att.url} target="_blank" rel="noopener noreferrer" title="Bax"
        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-200 flex-shrink-0"><ExternalLink className="w-4 h-4" /></a>
      <a href={att.url} download={att.name} title="Yüklə"
        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-200 flex-shrink-0"><Download className="w-4 h-4" /></a>
    </div>
  );
}

function Lightbox({ att, onClose }) {
  if (!att) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a href={att.url} download={att.name} onClick={e => e.stopPropagation()} title="Yüklə"
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><Download className="w-5 h-5" /></a>
        <button onClick={onClose} title="Bağla" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X className="w-5 h-5" /></button>
      </div>
      <img src={att.url} alt={att.name} onClick={e => e.stopPropagation()}
        className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg shadow-2xl" />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/50 px-3 py-1 rounded-full max-w-[80vw] truncate">{att.name}</div>
    </div>
  );
}

function ChatPanel({ messages, onSend, onUpload, onClose, messagesEndRef, participants, recipient, onRecipientChange }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const recipientName = recipient
    ? (participants.find(p => p.id === recipient)?.name || participants.find(p => p.id === recipient)?.email || 'İştirakçı')
    : '';

  const submit = () => { const t = text.trim(); if (!t) return; onSend(t, null); setText(''); };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };
  const pickFile = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploadErr(''); setUploading(true);
    try { const att = await onUpload(file); onSend('', att); }
    catch (err) { setUploadErr(err?.response?.data?.error || 'Fayl göndərilə bilmədi'); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col bg-army-950 border-l border-army-800 flex-shrink-0 min-h-0
                    fixed inset-0 z-40 w-full h-full sm:static sm:inset-auto sm:z-auto sm:h-auto sm:w-80 xl:w-96">
      <div className="flex items-center justify-between px-4 py-3 border-b border-army-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-primary-400 flex-shrink-0" />
          <span className="text-gray-100 font-semibold text-sm">Söhbət</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-army-800"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="w-10 h-10 text-army-700 mb-3" />
            <p className="text-gray-500 text-xs">Hələ mesaj yoxdur.<br />İlk mesajı siz yazın.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.isSelf ? 'items-end' : 'items-start'}`}>
            {!m.isSelf && <span className="text-[11px] text-gray-400 mb-0.5 px-1 font-medium">{m.name || m.email}</span>}
            {m.private && (
              <span className="text-[10px] text-primary-300 mb-0.5 px-1 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />{m.isSelf ? `Şəxsi → ${m.toName || m.toEmail || 'İştirakçı'}` : 'Şəxsi mesaj'}
              </span>
            )}
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
              m.private
                ? (m.isSelf ? 'bg-primary-700 text-white rounded-br-md ring-1 ring-primary-400/40' : 'bg-army-700 text-gray-100 rounded-bl-md ring-1 ring-primary-400/30')
                : (m.isSelf ? 'bg-primary-600 text-white rounded-br-md' : 'bg-army-800 text-gray-100 rounded-bl-md')}`}>
              {m.text && <Linkify text={m.text} self={m.isSelf} />}
              {m.attachment && <AttachmentView att={m.attachment} self={m.isSelf} onPreview={setLightbox} />}
            </div>
            <span className="text-[10px] text-gray-600 mt-0.5 px-1">{fmtTime(m.ts)}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-army-800 flex-shrink-0 space-y-2">
        <div className="relative">
          <Globe className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select value={recipient} onChange={e => onRecipientChange(e.target.value)}
            className="w-full appearance-none bg-army-800 border border-army-700 rounded-lg pl-8 pr-8 py-2 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer">
            <option value="">Hamıya (ümumi)</option>
            {participants.map(p => <option key={p.id} value={p.id}>Şəxsi → {p.name || p.email}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {recipient && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-primary-600/15 border border-primary-500/30">
            <span className="flex items-center gap-1.5 text-[11px] text-primary-200 min-w-0">
              <Lock className="w-3 h-3 flex-shrink-0" /><span className="truncate">Yalnız <b>{recipientName}</b> görəcək</span>
            </span>
            <button onClick={() => onRecipientChange('')} title="Ümumi söhbətə qayıt" className="text-primary-300 hover:text-white flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {uploadErr && <p className="text-[11px] text-red-400">{uploadErr}</p>}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
          <button onClick={pickFile} disabled={uploading} title="Fayl əlavə et"
            className="p-2.5 rounded-xl bg-army-800 hover:bg-army-700 text-gray-300 disabled:opacity-40 transition-colors flex-shrink-0">
            {uploading ? <span className="w-4 h-4 border-2 border-gray-500 border-t-gray-200 rounded-full animate-spin block" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey}
            placeholder={recipient ? `${recipientName}-ə şəxsi mesaj…` : 'Mesaj yazın… (Enter göndər)'} rows={1}
            className="flex-1 resize-none bg-army-800 border border-army-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 max-h-28 overflow-y-auto"
            style={{ minHeight: '42px' }} />
          <button onClick={submit} disabled={!text.trim()}
            className="p-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 transition-colors flex-shrink-0"><Send className="w-4 h-4" /></button>
        </div>
      </div>
      <Lightbox att={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MeetingRoom — WebCodecs media over the backend (no WebRTC, no ports).
   Chat / roster / moderation ride the text WS; audio/video/screen ride the
   binary media WS through MeetingMedia.
═══════════════════════════════════════════════════════════════ */
export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const { user } = useAuth();

  const [meeting, setMeeting]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [ended, setEnded]         = useState(false);
  const [roomFull, setRoomFull]   = useState(0);
  const [kicked, setKicked]       = useState(false);

  const [roomCode, setRoomCode]   = useState(null);
  const [pinNeeded, setPinNeeded] = useState(false);
  const [pinInput, setPinInput]   = useState('');
  const [pinError, setPinError]   = useState('');
  const [joining, setJoining]     = useState(false);

  const [hasMic, setHasMic] = useState(true);
  const [hasCam, setHasCam] = useState(true);

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg]     = useState('');
  const [inviting, setInviting]       = useState(false);

  const [camStream, setCamStream]       = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn, setMicOn]     = useState(false);
  const [camOn, setCamOn]     = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [mediaError, setMediaError]     = useState('');
  const [mediaWarning, setMediaWarning] = useState('');
  const [connecting, setConnecting]     = useState(true);

  const [roster, setRoster] = useState([]);            // [{email,name}] excl. self
  const [, force] = useReducer(n => n + 1, 0);         // re-render on media state change

  const [screenPip, setScreenPip] = useState(false);
  const [chatOpen, setChatOpen]   = useState(false);
  const [messages, setMessages]   = useState([]);
  const [unread, setUnread]       = useState(0);
  const [chatRecipient, setChatRecipient] = useState('');   // '' = all, else email
  const messagesEndRef = useRef(null);
  const chatOpenRef    = useRef(false);

  const [pinnedPeerId, setPinnedPeerId] = useState(null);   // null | 'self' | email
  const [kickTarget, setKickTarget]     = useState(null);

  const engineRef   = useRef(null);
  const wsRef       = useRef(null);
  const camStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const sessionsRef = useRef(new Map());   // sessionId → {email,name}
  const leavingRef  = useRef(false);
  const noReconnectRef = useRef(false);
  const reconnectsRef = useRef(0);
  const [retryKey, setRetryKey] = useState(0);

  const SS_KEY = `mt_room_${id}`;
  const displayName = user?.fullName || user?.name || user?.email || 'Mən';
  const isHost = meeting?.isHost;
  const isSelfEmail = useCallback((email) =>
    !!email && !!user?.email && email.toLowerCase() === user.email.toLowerCase(), [user]);

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { if (chatOpen) { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setUnread(0); } }, [messages, chatOpen]);

  /* ── Load meeting + resolve access ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMeeting(id);
        let m = res.data;
        if (m.isHost && m.status === 'SCHEDULED') { const r2 = await startMeeting(id); m = r2.data; }
        if (cancelled) return;
        setMeeting(m);
        if (m.roomCode) { setRoomCode(m.roomCode); sessionStorage.setItem(SS_KEY, m.roomCode); return; }
        const saved = sessionStorage.getItem(SS_KEY);
        if (saved) { setRoomCode(saved); return; }
        if (inviteToken) {
          try {
            const jr = await joinMeeting(id, { token: inviteToken });
            if (!cancelled) { setRoomCode(jr.data.roomCode); sessionStorage.setItem(SS_KEY, jr.data.roomCode); }
            return;
          } catch { /* fall through */ }
        }
        if (!cancelled) setPinNeeded(true);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403) setForbidden(true);
        else navigate('/meetings');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, navigate, inviteToken]);

  const submitPin = useCallback(async () => {
    if (pinInput.trim().length < 4) { setPinError('4 rəqəmli kodu daxil edin'); return; }
    setJoining(true); setPinError('');
    try {
      const jr = await joinMeeting(id, { pin: pinInput.trim() });
      setRoomCode(jr.data.roomCode); sessionStorage.setItem(SS_KEY, jr.data.roomCode); setPinNeeded(false);
    } catch (err) { setPinError(err.response?.data?.error || 'Otaq kodu yanlışdır'); }
    finally { setJoining(false); }
  }, [id, pinInput]);

  const sendInvite = useCallback(async () => {
    const email = inviteEmail.trim(); if (!email) return;
    setInviting(true); setInviteMsg('');
    try { await inviteToMeeting(id, email); setInviteMsg(`Dəvət göndərildi: ${email}`); setInviteEmail(''); }
    catch (err) { setInviteMsg(err.response?.data?.error || 'Dəvət göndərilə bilmədi'); }
    finally { setInviting(false); }
  }, [id, inviteEmail]);

  /* ── roster (from chat WS) ── */
  const rebuildRoster = useCallback(() => {
    const byEmail = new Map();
    sessionsRef.current.forEach(({ email, name }) => {
      if (!email || isSelfEmail(email)) return;
      const key = email.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, { email, name: name || email });
    });
    setRoster(Array.from(byEmail.values()));
  }, [isSelfEmail]);

  /* ════════════════════════════════════════════════════════════
     Media engine (WebCodecs over the backend)
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!meeting || !roomCode) return;
    let cancelled = false;
    setMediaError(''); setMediaWarning(''); setConnecting(true);

    if (!isMeetingMediaSupported()) {
      setMediaError('Bu brauzer dəstəklənmir. Zəhmət olmasa Chrome və ya Edge istifadə edin.');
      setConnecting(false);
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('jwt_token') || '';
    const url = `${proto}://${window.location.host}/ws/meetings/media/${roomCode}?token=${encodeURIComponent(token)}`;
    const engine = new MeetingMedia({ url, selfEmail: user?.email, onChange: force, onClose: () => {} });
    engineRef.current = engine;
    engine.connect();
    engine.resumeAudio();

    (async () => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } }); setHasCam(false); }
        catch { setHasMic(false); setHasCam(false); setMediaWarning('Mikrofon/kamera əlçatınsızdır — izləyici kimi qoşulursunuz.'); }
      }
      if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return; }
      if (stream) {
        camStreamRef.current = stream; setCamStream(stream);
        const v = stream.getVideoTracks()[0];
        const a = stream.getAudioTracks()[0];
        setHasCam(!!v); setHasMic(!!a); setCamOn(!!v); setMicOn(!!a);
        if (v) engine.setCamera(v);
        if (a) engine.setMic(a);
      }
      setConnecting(false);
    })();

    return () => {
      cancelled = true;
      try { engine.close(); } catch { /* ignore */ }
      if (engineRef.current === engine) engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, roomCode]);

  // Stop local capture only on real unmount.
  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ════════════════════════════════════════════════════════════
     Chat / roster / lifecycle WebSocket (text)
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!meeting || !roomCode) return;
    let cancelled = false;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('jwt_token') || '';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/meetings/${roomCode}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => { reconnectsRef.current = 0; };
    ws.onerror = () => {};
    ws.onmessage = (evt) => {
      let msg; try { msg = JSON.parse(evt.data); } catch { return; }
      switch (msg.type) {
        case 'peers':
          sessionsRef.current.clear();
          (msg.peers || []).forEach(p => sessionsRef.current.set(p.id, { email: p.email, name: p.name }));
          rebuildRoster();
          break;
        case 'peer-joined':
          sessionsRef.current.set(msg.id, { email: msg.email, name: msg.name });
          rebuildRoster();
          break;
        case 'peer-left':
          sessionsRef.current.delete(msg.id);
          rebuildRoster();
          break;
        case 'meeting-ended': noReconnectRef.current = true; sessionStorage.removeItem(SS_KEY); setEnded(true); cleanup(); break;
        case 'room-full':     noReconnectRef.current = true; setRoomFull(msg.max || 1); cleanup(); break;
        case 'kicked':        noReconnectRef.current = true; sessionStorage.removeItem(SS_KEY); setKicked(true); cleanup(); break;
        case 'force-mute':
          camStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
          engineRef.current?.setMic(null); setMicOn(false);
          break;
        case 'force-cam':
          camStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
          engineRef.current?.setCamera(null); setCamOn(false);
          break;
        case 'chat-history': {
          setMessages((msg.messages || []).map(m => ({
            id: `${m.from}-${m.ts}`, from: m.from, email: m.email, name: m.name || m.email || 'Qonaq',
            text: m.text, ts: m.ts, attachment: m.attachment || null,
            private: !!m.private, toEmail: m.toEmail, toName: m.toName, isSelf: isSelfEmail(m.email),
          })));
          break;
        }
        case 'chat': {
          const self = isSelfEmail(msg.email);
          setMessages(prev => [...prev, {
            id: `${msg.from}-${msg.ts}`, from: msg.from, email: msg.email, name: msg.name || msg.email || 'Qonaq',
            text: msg.text, ts: msg.ts, attachment: msg.attachment || null,
            private: !!msg.private, toEmail: msg.toEmail, toName: msg.toName, isSelf: self,
          }]);
          if (!chatOpenRef.current && !self) setUnread(n => n + 1);
          break;
        }
        default: break;
      }
    };
    ws.onclose = () => {
      if (cancelled || leavingRef.current || noReconnectRef.current) return;
      if (reconnectsRef.current >= 6) return;
      reconnectsRef.current += 1;
      setTimeout(() => { if (!leavingRef.current && !noReconnectRef.current) setRetryKey(k => k + 1); }, 2500);
    };
    return () => { cancelled = true; if (wsRef.current === ws) wsRef.current = null; ws.onclose = null; try { ws.close(); } catch { /* ignore */ } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, roomCode, retryKey]);

  const sendSignal = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  }, []);

  const cleanup = useCallback(() => {
    leavingRef.current = true;
    try { engineRef.current?.close(); } catch { /* ignore */ }
    engineRef.current = null;
    if (wsRef.current) { wsRef.current.onclose = null; try { wsRef.current.close(); } catch { /* ignore */ } wsRef.current = null; }
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  /* ── derived view model ── */
  const eng = engineRef.current;
  const remotePeers = roster.map(r => {
    const st = eng ? eng.stateFor(r.email) : { camera: false, screen: false, audio: false };
    return { email: r.email, name: r.name, camera: st.camera, screen: st.screen, audio: st.audio };
  });
  const remoteSharer = remotePeers.find(p => p.screen) || null;
  const amISharing = screenOn && !!screenStream;
  const isSomeoneSharing = amISharing || !!remoteSharer;
  const screenSharingName = amISharing ? displayName : remoteSharer?.name;
  const screenSharingPeerId = amISharing ? 'self' : remoteSharer?.email;

  const screenSpotlight = isSomeoneSharing && !screenPip;
  const pinnedPeer = (!screenSpotlight && pinnedPeerId && pinnedPeerId !== 'self')
    ? remotePeers.find(p => p.email === pinnedPeerId) : null;
  const pinSelf = !screenSpotlight && pinnedPeerId === 'self';
  const pinSpotlight = pinSelf || !!pinnedPeer;
  const spotlightId = screenSpotlight ? (amISharing ? 'self' : screenSharingPeerId) : (pinSelf ? 'self' : pinnedPeer?.email);

  /* ── selective forwarding: tell the relay which cameras we want ── */
  useEffect(() => {
    if (!eng) return;
    const wanted = [];
    if (spotlightId && spotlightId !== 'self') wanted.push(spotlightId);
    for (const p of remotePeers) {
      if (wanted.length >= MAX_VIDEO_TILES) break;
      if (!wanted.includes(p.email)) wanted.push(p.email);
    }
    eng.setWanted(wanted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, roster, spotlightId]);

  /* ── ESC → PiP ── */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isSomeoneSharing && !screenPip) setScreenPip(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSomeoneSharing, screenPip]);

  /* ── controls ── */
  const toggleMic = useCallback(() => {
    const a = camStreamRef.current?.getAudioTracks()[0]; if (!a) return;
    const next = !micOn; a.enabled = next;
    engineRef.current?.setMic(next ? a : null); setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const v = camStreamRef.current?.getVideoTracks()[0]; if (!v) return;
    const next = !camOn; v.enabled = next;
    engineRef.current?.setCamera(next ? v : null); setCamOn(next);
  }, [camOn]);

  const stopScreen = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null; setScreenStream(null); setScreenOn(false);
    engineRef.current?.setScreen(null);
  }, []);

  const startScreen = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { max: 1920 }, height: { max: 1080 } }, audio: false,
      });
      const track = ss.getVideoTracks()[0];
      if ('contentHint' in track) track.contentHint = 'detail';
      screenStreamRef.current = ss; setScreenStream(ss); setScreenOn(true);
      engineRef.current?.setScreen(track);
      track.onended = stopScreen;
    } catch { /* cancelled */ }
  }, [stopScreen]);

  const toggleScreen = () => { if (screenOn) stopScreen(); else startScreen(); };

  const sendChat = useCallback((text, attachment = null) =>
    sendSignal({ type: 'chat', text, attachment, to: chatRecipient || undefined }), [sendSignal, chatRecipient]);
  const uploadAttachment = useCallback(async (file) => (await uploadMeetingAttachment(id, file)).data, [id]);
  const openDm = useCallback((peer) => { setChatRecipient(peer.email); setChatOpen(true); }, []);
  const togglePin = useCallback((target) => setPinnedPeerId(prev => (prev === target ? null : target)), []);

  const mutePeer   = useCallback((email) => sendSignal({ type: 'force-mute', target: email }), [sendSignal]);
  const camOffPeer = useCallback((email) => sendSignal({ type: 'force-cam',  target: email }), [sendSignal]);
  const confirmKick = useCallback((peer) => setKickTarget(peer), []);
  const doKick = useCallback(() => { if (kickTarget) sendSignal({ type: 'kick', target: kickTarget.email }); setKickTarget(null); }, [kickTarget, sendSignal]);

  const handleLeave = () => { leavingRef.current = true; sessionStorage.removeItem(SS_KEY); cleanup(); navigate('/meetings'); };
  const handleEnd = async () => {
    leavingRef.current = true; noReconnectRef.current = true; sessionStorage.removeItem(SS_KEY);
    try { await endMeeting(id); } catch { /* ignore */ }
    cleanup(); navigate('/meetings');
  };

  /* ── render states ── */
  const Spinner = () => (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  const Notice = ({ Icon, title, text }) => (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="text-center px-4 max-w-sm">
        <Icon className="w-16 h-16 text-army-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-100 mb-2">{title}</h2>
        {text && <p className="text-gray-400 mb-6">{text}</p>}
        <button onClick={() => navigate('/meetings')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Görüşlərə qayıt</button>
      </div>
    </div>
  );

  if (loading) return <Spinner />;
  if (forbidden) return <Notice Icon={Lock} title="Giriş qadağandır" text="Bu görüşə qoşulmaq icazəniz yoxdur." />;
  if (ended) return <Notice Icon={PhoneOff} title="Görüş sona çatdı" />;
  if (roomFull) return <Notice Icon={Users} title="Görüş doludur" text={`Maksimum iştirakçı sayına (${roomFull}) çatılıb.`} />;
  if (kicked) return <Notice Icon={LogOut} title="Görüşdən çıxarıldınız" text="Aparıcı sizi görüşdən çıxardı." />;
  if (!meeting) return null;

  if (pinNeeded && !roomCode) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-600/20 flex items-center justify-center mx-auto mb-4"><KeyRound className="w-7 h-7 text-primary-400" /></div>
        <h2 className="text-xl font-bold text-gray-100 mb-1">{meeting.title}</h2>
        <p className="text-gray-400 text-sm mb-6">Qoşulmaq üçün 4 rəqəmli otaq kodunu daxil edin</p>
        <input autoFocus inputMode="numeric" maxLength={4} value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && submitPin()} placeholder="••••"
          className="w-40 mx-auto block text-center tracking-[0.6em] text-2xl font-bold py-3 rounded-xl bg-army-800 border border-army-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        {pinError && <p className="text-red-400 text-sm mt-3">{pinError}</p>}
        <div className="flex gap-2 mt-6">
          <button onClick={() => navigate('/meetings')} className="flex-1 px-4 py-2.5 bg-army-700 hover:bg-army-600 text-gray-200 rounded-xl text-sm font-medium">Ləğv et</button>
          <button onClick={submitPin} disabled={joining || pinInput.length < 4} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {joining && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Qoşul
          </button>
        </div>
      </div>
    </div>
  );
  if (!roomCode) return <Spinner />;

  const tileCount = remotePeers.length + 1;
  const canManage = meeting.canManage;
  const chatParticipants = remotePeers.map(p => ({ id: p.email, name: p.name, email: p.email }));

  return (
    <div className="h-screen overflow-hidden bg-army-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-army-800 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-gray-100 font-semibold text-sm sm:text-base truncate">{meeting.title}</h1>
          <p className="text-gray-500 text-xs truncate">{meeting.hostName || meeting.hostEmail}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSomeoneSharing && (
            <span className="hidden sm:flex items-center gap-1 text-primary-400 text-xs bg-primary-900/30 px-2 py-0.5 rounded-full">
              <Monitor className="w-3 h-3" />{amISharing ? 'Siz paylaşırsınız' : `${screenSharingName} paylaşır`}
            </span>
          )}
          {canManage && meeting.joinPin && (
            <span className="hidden sm:flex items-center gap-1 text-gray-200 text-xs bg-army-800 px-2.5 py-1 rounded-full font-mono" title="Otaq kodu (yalnız siz görürsünüz)">
              <KeyRound className="w-3.5 h-3.5 text-primary-400" />{meeting.joinPin}
            </span>
          )}
          {canManage && (
            <button onClick={() => { setInviteOpen(o => !o); setInviteMsg(''); }} title="İstifadəçi dəvət et"
              className={`p-2 rounded-lg transition-colors ${inviteOpen ? 'bg-primary-600 text-white' : 'bg-army-800 text-gray-300 hover:bg-army-700'}`}><UserPlus className="w-4 h-4" /></button>
          )}
          <div className="flex items-center gap-1 text-gray-300 text-xs bg-army-800 px-2.5 py-1 rounded-full"><Users className="w-3.5 h-3.5" />{tileCount}</div>
          <button onClick={() => setChatOpen(o => !o)} title="Söhbət"
            className={`relative p-2 rounded-lg transition-colors ${chatOpen ? 'bg-primary-600 text-white' : 'bg-army-800 text-gray-300 hover:bg-army-700'}`}>
            <MessageSquare className="w-4 h-4" />
            {!chatOpen && unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>
      </div>

      {inviteOpen && canManage && (
        <div className="absolute right-3 top-16 z-30 w-72 bg-army-800 border border-army-700 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-200 text-sm font-semibold flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-primary-400" /> İstifadəçi dəvət et</span>
            <button onClick={() => setInviteOpen(false)} className="p-1 text-gray-400 hover:text-gray-200"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-gray-500 mb-2 leading-snug">Dəvət olunan istifadəçi bildiriş və birbaşa qoşulma linki alacaq.</p>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInvite()} placeholder="E-poçt ünvanı"
            className="w-full px-3 py-2 rounded-lg bg-army-700 border border-army-600 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          {inviteMsg && <p className="text-[11px] text-primary-300 mt-2">{inviteMsg}</p>}
          <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()} className="w-full mt-3 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {inviting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Dəvət göndər
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex flex-col gap-1 px-4 pt-3 flex-shrink-0">
            {mediaError && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-xs px-3 py-2 rounded-lg flex items-start justify-between gap-3">
                <span>{mediaError}</span>
                <button onClick={() => setRetryKey(k => k + 1)} className="flex items-center gap-1 text-red-200 hover:text-white font-semibold whitespace-nowrap flex-shrink-0"><RefreshCw className="w-3 h-3" /> Yenidən cəhd</button>
              </div>
            )}
            {!mediaError && mediaWarning && <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs px-3 py-2 rounded-lg">{mediaWarning}</div>}
            {!mediaError && connecting && (
              <div className="bg-army-800/60 border border-army-700 text-gray-300 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> Qoşulur…
              </div>
            )}
          </div>

          {(screenSpotlight || pinSpotlight) ? (
            <div className="flex flex-col sm:flex-row flex-1 min-h-0 gap-2 p-3 overflow-hidden">
              <div className="flex-1 min-w-0 min-h-0 relative">
                {screenSpotlight ? (
                  amISharing ? (
                    <LocalTile camStream={camStream} screenStream={screenStream} micOn={micOn} camOn={camOn} screenOn={screenOn} name={displayName} full />
                  ) : remoteSharer ? (
                    <RemoteTile engine={eng} peer={remoteSharer} full contain showScreen />
                  ) : <div className="w-full h-full bg-gray-950 rounded-xl flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : pinSelf ? (
                  <LocalTile camStream={camStream} screenStream={screenStream} micOn={micOn} camOn={camOn} screenOn={screenOn} name={displayName} full pinned onPin={() => togglePin('self')} />
                ) : (
                  <RemoteTile engine={eng} peer={pinnedPeer} full canManage={canManage} onKick={confirmKick} onMute={mutePeer} onCamOff={camOffPeer} pinned onPin={() => togglePin(pinnedPeer.email)} onDm={openDm} />
                )}
                {screenSpotlight && !amISharing && remoteSharer && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary-600/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg"><Monitor className="w-3.5 h-3.5" />{screenSharingName} ekranı paylaşır</div>
                )}
                {pinSpotlight && <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary-600/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg"><Pin className="w-3.5 h-3.5" /> Sancaqlanıb</div>}
                {screenSpotlight ? (
                  <button onClick={() => setScreenPip(true)} className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg" title="Kiçilt (ESC)"><Minimize2 className="w-3.5 h-3.5" /> Kiçilt</button>
                ) : (
                  <button onClick={() => setPinnedPeerId(null)} className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg" title="Sancağı çıxar"><PinOff className="w-3.5 h-3.5" /> Sancağı çıxar</button>
                )}
              </div>
              <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 w-full sm:w-40 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto">
                {spotlightId !== 'self' && (
                  <StripTile stream={screenOn ? screenStream : camStream} name={`${displayName} (Siz)`} onPin={() => togglePin('self')} />
                )}
                {remotePeers.filter(p => p.email !== spotlightId).map(p => (
                  <StripTile key={p.email} engine={eng} email={p.email} hasVideo={p.camera} name={p.name || p.email} onPin={() => togglePin(p.email)} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto relative">
              <div className={`grid ${gridClass(tileCount)} gap-3 mx-auto`}>
                <LocalTile camStream={camStream} screenStream={screenStream} micOn={micOn} camOn={camOn} screenOn={screenOn} name={displayName} pinned={pinnedPeerId === 'self'} onPin={() => togglePin('self')} />
                {remotePeers.map(p => (
                  <RemoteTile key={p.email} engine={eng} peer={p} canManage={canManage} onKick={confirmKick} onMute={mutePeer} onCamOff={camOffPeer} pinned={pinnedPeerId === p.email} onPin={() => togglePin(p.email)} onDm={openDm} />
                ))}
              </div>
              {isSomeoneSharing && screenPip && (
                <div className="absolute bottom-4 right-4 w-64 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-20 cursor-pointer group" onClick={() => setScreenPip(false)} title="Tam ekrana keç">
                  <div className="aspect-video bg-gray-900 relative">
                    {amISharing ? screenStream && <VideoStream stream={screenStream} muted contain /> : remoteSharer && <RemoteVideo engine={eng} email={remoteSharer.email} kind="screen" contain />}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="w-8 h-8 text-white" /></div>
                    <div className="absolute top-1.5 left-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm"><Monitor className="w-2.5 h-2.5 text-primary-400" />{amISharing ? 'Siz (ekran)' : (screenSharingName || 'Ekran')}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 px-4 py-3 border-t border-army-800 flex-shrink-0">
            <button onClick={toggleMic} disabled={!hasMic} title={!hasMic ? 'Mikrofon tapılmadı' : micOn ? 'Mikrofonu söndür' : 'Mikrofonu aç'}
              className={`p-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${micOn && hasMic ? 'bg-army-700 hover:bg-army-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {micOn && hasMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button onClick={toggleCam} disabled={!hasCam || screenOn} title={!hasCam ? 'Kamera tapılmadı' : camOn ? 'Kameranı söndür' : 'Kameranı aç'}
              className={`p-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${camOn && !screenOn && hasCam ? 'bg-army-700 hover:bg-army-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {camOn && !screenOn && hasCam ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            {!!navigator.mediaDevices?.getDisplayMedia && (
              <button onClick={toggleScreen} title={screenOn ? 'Ekran paylaşımını dayandır' : 'Ekranı paylaş'}
                className={`p-3 rounded-full transition-colors ${screenOn ? 'bg-primary-600 hover:bg-primary-700 text-white ring-2 ring-primary-400' : 'bg-army-700 hover:bg-army-600 text-white'}`}>
                {screenOn ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
            )}
            {isSomeoneSharing && (
              <button onClick={() => setScreenPip(p => !p)} title={screenPip ? 'Tam ekrana keç' : 'Kiçilt (ESC)'} className="p-3 rounded-full bg-army-700 hover:bg-army-600 text-white transition-colors">
                {screenPip ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              </button>
            )}
            <button onClick={() => setChatOpen(o => !o)} className={`p-3 rounded-full transition-colors sm:hidden relative ${chatOpen ? 'bg-primary-600 text-white' : 'bg-army-700 hover:bg-army-600 text-white'}`}>
              <MessageSquare className="w-5 h-5" />
              {!chatOpen && unread > 0 && <span className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button onClick={handleLeave} title="Tərk et" className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-army-700 hover:bg-army-600 text-white text-sm font-semibold transition-colors">
              <LogOut className="w-5 h-5" /><span className="hidden sm:inline">Tərk et</span>
            </button>
            {isHost && (
              <button onClick={handleEnd} title="Görüşü bitir" className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                <PhoneOff className="w-5 h-5" /><span className="hidden sm:inline">Görüşü bitir</span>
              </button>
            )}
          </div>
        </div>

        {chatOpen && (
          <ChatPanel messages={messages} onSend={sendChat} onUpload={uploadAttachment} onClose={() => setChatOpen(false)}
            messagesEndRef={messagesEndRef} participants={chatParticipants} recipient={chatRecipient} onRecipientChange={setChatRecipient} />
        )}
      </div>

      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setKickTarget(null)}>
          <div className="bg-army-900 border border-army-700 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2"><UserX className="w-5 h-5 text-red-400" /><h3 className="text-gray-100 font-semibold">İştirakçını çıxar</h3></div>
            <p className="text-gray-400 text-sm mb-5"><span className="text-gray-200 font-medium">{kickTarget.name || kickTarget.email || 'İştirakçı'}</span> görüşdən çıxarılsın?</p>
            <div className="flex gap-2">
              <button onClick={() => setKickTarget(null)} className="flex-1 px-4 py-2.5 bg-army-700 hover:bg-army-600 text-gray-200 rounded-xl text-sm font-medium">Ləğv et</button>
              <button onClick={doKick} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">Çıxar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

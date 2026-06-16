import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, LogOut,
  Users, Lock, Monitor, MonitorOff, RefreshCw,
  MessageSquare, Send, X, Minimize2, Maximize2,
  KeyRound, UserPlus,
} from 'lucide-react';
import {
  getMeeting, startMeeting, endMeeting, getIceConfig,
  joinMeeting, inviteToMeeting, getMeetingParticipants,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

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

/* ─── VideoStream: attaches a MediaStream to a <video> ─────────── */
function VideoStream({ stream, muted = false, mirror = false, contain = false }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream ?? null; }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay playsInline
      muted={muted}
      className={[
        'w-full h-full',
        contain ? 'object-contain' : 'object-cover',
        mirror  ? '-scale-x-100'  : '',
      ].join(' ')}
    />
  );
}

/* ─── LocalTile ──────────────────────────────────────────────── */
function LocalTile({ camStream, screenStream, micOn, camOn, screenOn, name, full = false }) {
  const activeStream = screenOn && screenStream ? screenStream : camStream;
  const showVideo    = screenOn ? !!screenStream : (camOn && !!camStream);
  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center ${full ? 'w-full h-full' : 'aspect-video'}`}>
      {activeStream && <VideoStream stream={activeStream} muted mirror={!screenOn} contain={screenOn} />}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
            {initial(name)}
          </div>
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

/* ─── RemoteTile ─────────────────────────────────────────────── */
function RemoteTile({ peer, full = false, contain = false }) {
  const hasVideo = peer.stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center ${full ? 'w-full h-full' : 'aspect-video'}`}>
      {peer.stream && <VideoStream stream={peer.stream} contain={contain} />}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-army-600 flex items-center justify-center text-white text-2xl font-bold">
            {initial(peer.name || peer.email)}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm max-w-[140px] truncate">
        {peer.name || peer.email || 'Qonaq'}
      </div>
    </div>
  );
}

/* ─── StripTile: small thumbnail in side strip ───────────────── */
function StripTile({ stream, muted = false, name }) {
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-shrink-0" style={{ height: '90px' }}>
      {stream && <VideoStream stream={stream} muted={muted} />}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-army-600 flex items-center justify-center text-white text-sm font-bold">
            {initial(name)}
          </div>
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded truncate">
        {name}
      </div>
    </div>
  );
}

/* ─── ChatPanel ──────────────────────────────────────────────── */
function ChatPanel({ messages, onSend, onClose, messagesEndRef }) {
  const [text, setText] = useState('');
  const submit = () => { const t = text.trim(); if (!t) return; onSend(t); setText(''); };
  const onKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  return (
    <div className="flex flex-col w-72 xl:w-80 border-l border-army-800 bg-army-950 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-army-800 flex-shrink-0">
        <span className="text-gray-200 font-semibold text-sm">Söhbət</span>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-200"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-xs mt-8">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.isSelf ? 'items-end' : 'items-start'}`}>
            {!m.isSelf && <span className="text-[11px] text-gray-500 mb-0.5 px-1">{m.name || m.email}</span>}
            <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
              m.isSelf ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-army-800 text-gray-100 rounded-bl-sm'
            }`}>{m.text}</div>
            <span className="text-[10px] text-gray-600 mt-0.5 px-1">{fmtTime(m.ts)}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-3 border-t border-army-800 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey}
            placeholder="Mesaj yazın… (Enter göndər)" rows={1}
            className="flex-1 resize-none bg-army-800 border border-army-700 rounded-xl px-3 py-2 text-sm text-gray-100
                       placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 max-h-24 overflow-y-auto"
            style={{ minHeight: '36px' }}
          />
          <button onClick={submit} disabled={!text.trim()}
            className="p-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 transition-colors flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function MeetingRoom() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const { user, hasPermission } = useAuth();

  /* ── meeting ── */
  const [meeting,   setMeeting]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [ended,     setEnded]     = useState(false);
  const [roomFull,  setRoomFull]  = useState(0);   // 0 = not full, else the cap

  /* ── join gate (room code) ── */
  const [roomCode,  setRoomCode]  = useState(null);   // null until access granted
  const [pinNeeded, setPinNeeded] = useState(false);
  const [pinInput,  setPinInput]  = useState('');
  const [pinError,  setPinError]  = useState('');
  const [joining,   setJoining]   = useState(false);

  /* ── device availability (graceful no mic/cam) ── */
  const [hasMic, setHasMic] = useState(true);
  const [hasCam, setHasCam] = useState(true);

  /* ── invite panel ── */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviting, setInviting] = useState(false);

  /* ── media ── */
  const [camStream,    setCamStream]    = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [micOn,    setMicOn]    = useState(true);
  const [camOn,    setCamOn]    = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [mediaError,   setMediaError]   = useState('');
  const [mediaWarning, setMediaWarning] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  /* ── peers ── */
  const [remotePeers, setRemotePeers] = useState([]);

  /* ── screen-sharing coordination ──────────────────────────────
     screenSharingEmail: who is sharing (null = nobody)
     screenSharingPeerId: WS session id of sharer (to find remote tile)
     screenSharingName: display name of sharer
     screenPip: false = full layout, true = PiP overlay
  ─────────────────────────────────────────────────────────────── */
  const [screenSharingEmail,  setScreenSharingEmail]  = useState(null);
  const [screenSharingPeerId, setScreenSharingPeerId] = useState(null);
  const [screenSharingName,   setScreenSharingName]   = useState(null);
  const [screenPip,           setScreenPip]           = useState(false);
  const [shareRejected,       setShareRejected]       = useState('');

  /* ── chat ── */
  const [chatOpen,  setChatOpen]  = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [unread,    setUnread]    = useState(0);
  const messagesEndRef = useRef(null);
  const chatOpenRef    = useRef(false);

  /* ── refs ── */
  const camStreamRef    = useRef(null);
  const screenStreamRef = useRef(null);
  const wsRef           = useRef(null);
  const pcsRef          = useRef(new Map());
  const peerInfoRef     = useRef(new Map());
  const pendingIceRef   = useRef(new Map());
  const iceConfigRef    = useRef({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const leavingRef      = useRef(false);   // true once the user intentionally leaves/ends
  const noReconnectRef  = useRef(false);   // true when meeting ended / room full (don't retry)
  const reconnectsRef   = useRef(0);

  // Per-tab room-code cache so a page refresh / brief network drop rejoins
  // without re-entering the PIN.
  const SS_KEY = `mt_room_${id}`;
  const displayName = user?.fullName || user?.name || user?.email || 'Mən';
  const isHost      = meeting?.isHost;

  // Skip our own identity in peer lists so we never render a second tile of ourselves.
  const isSelfEmail = (email) =>
    !!email && !!user?.email && email.toLowerCase() === user.email.toLowerCase();

  /* derived */
  const isSomeoneSharing = !!screenSharingEmail;
  const amISharing       = screenSharingEmail === user?.email;
  const sharerPeer       = remotePeers.find(p => p.id === screenSharingPeerId);
  const otherPeers       = remotePeers.filter(p => p.id !== screenSharingPeerId);

  /* ── sync refs ── */
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  /* ── auto-scroll chat ── */
  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  /* ── ESC → minimize shared screen to PiP ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isSomeoneSharing && !screenPip) setScreenPip(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSomeoneSharing, screenPip]);

  /* ── clear share-rejected toast ── */
  useEffect(() => {
    if (!shareRejected) return;
    const t = setTimeout(() => setShareRejected(''), 4000);
    return () => clearTimeout(t);
  }, [shareRejected]);

  /* ════════════════════════════════════════════════════════════
     Load meeting
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMeeting(id);
        let m = res.data;
        if (m.isHost && m.status === 'SCHEDULED') { const r2 = await startMeeting(id); m = r2.data; }
        if (cancelled) return;
        setMeeting(m);

        // Managers (host/super-admin/moderator) already receive roomCode directly.
        if (m.roomCode) { setRoomCode(m.roomCode); sessionStorage.setItem(SS_KEY, m.roomCode); return; }

        // Already passed the gate earlier this session (e.g. page refresh) →
        // rejoin straight away without asking for the PIN again.
        const saved = sessionStorage.getItem(SS_KEY);
        if (saved) { setRoomCode(saved); return; }

        // Invited via link → exchange the token for the roomCode, no PIN needed.
        if (inviteToken) {
          try {
            const jr = await joinMeeting(id, { token: inviteToken });
            if (!cancelled) { setRoomCode(jr.data.roomCode); sessionStorage.setItem(SS_KEY, jr.data.roomCode); }
            return;
          } catch { /* fall through to PIN entry */ }
        }
        // Otherwise require the 4-digit room code.
        if (!cancelled) setPinNeeded(true);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403) setForbidden(true);
        else navigate('/meetings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, navigate, inviteToken]);

  /* Submit the room-code PIN to obtain the roomCode and join. */
  const submitPin = useCallback(async () => {
    if (pinInput.trim().length < 4) { setPinError('4 rəqəmli kodu daxil edin'); return; }
    setJoining(true); setPinError('');
    try {
      const jr = await joinMeeting(id, { pin: pinInput.trim() });
      setRoomCode(jr.data.roomCode);
      sessionStorage.setItem(SS_KEY, jr.data.roomCode);
      setPinNeeded(false);
    } catch (err) {
      setPinError(err.response?.data?.error || 'Otaq kodu yanlışdır');
    } finally { setJoining(false); }
  }, [id, pinInput]);

  /* Host/moderator sends an invite. */
  const sendInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true); setInviteMsg('');
    try {
      await inviteToMeeting(id, email);
      setInviteMsg(`Dəvət göndərildi: ${email}`);
      setInviteEmail('');
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Dəvət göndərilə bilmədi');
    } finally { setInviting(false); }
  }, [id, inviteEmail]);

  /* ════════════════════════════════════════════════════════════
     Signaling helpers
  ════════════════════════════════════════════════════════════ */
  const sendSignal = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(payload));
  }, []);

  const flushPendingIce = useCallback(async (peerId, pc) => {
    const queue = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.delete(peerId);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }, []);

  const createPeerConnection = useCallback((peerId, info, isInitiator) => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId);
    if (info) peerInfoRef.current.set(peerId, info);

    const pc = new RTCPeerConnection(iceConfigRef.current);
    pcsRef.current.set(peerId, pc);

    setRemotePeers(prev =>
      prev.some(p => p.id === peerId) ? prev
        : [...prev, { id: peerId, ...(peerInfoRef.current.get(peerId) || {}), stream: null }]
    );

    if (camStreamRef.current) {
      const audioTrack  = camStreamRef.current.getAudioTracks()[0];
      const screenVideo = screenStreamRef.current?.getVideoTracks()[0];
      const cameraVideo = camStreamRef.current.getVideoTracks()[0];
      const videoTrack  = screenVideo || cameraVideo;
      if (audioTrack) pc.addTrack(audioTrack, camStreamRef.current);
      if (videoTrack) {
        const sender = pc.addTrack(videoTrack, screenStreamRef.current || camStreamRef.current);
        // If we join/connect while screen sharing, raise this sender's bitrate too.
        if (screenVideo) {
          try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings.forEach(e => { e.maxBitrate = 5_000_000; e.maxFramerate = 30; });
            params.degradationPreference = 'maintain-resolution';
            sender.setParameters(params).catch(() => {});
          } catch { /* ignore */ }
        }
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal({ type: 'ice-candidate', target: peerId, candidate });
    };
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (stream) setRemotePeers(prev => prev.map(p => p.id === peerId ? { ...p, stream } : p));
    };

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => sendSignal({ type: 'offer', target: peerId, sdp: pc.localDescription }))
        .catch(() => {});
    }
    return pc;
  }, [sendSignal]);

  const handleOffer = useCallback(async (msg) => {
    const pc = createPeerConnection(msg.from, peerInfoRef.current.get(msg.from), false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      await flushPendingIce(msg.from, pc);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      sendSignal({ type: 'answer', target: msg.from, sdp: pc.localDescription });
    } catch { /* ignore */ }
  }, [createPeerConnection, flushPendingIce, sendSignal]);

  const handleAnswer = useCallback(async (msg) => {
    const pc = pcsRef.current.get(msg.from);
    if (!pc) return;
    try { await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)); await flushPendingIce(msg.from, pc); }
    catch { /* ignore */ }
  }, [flushPendingIce]);

  const handleIce = useCallback(async (msg) => {
    const pc = pcsRef.current.get(msg.from);
    if (!pc) return;
    if (pc.remoteDescription?.type) {
      try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { /* ignore */ }
    } else {
      if (!pendingIceRef.current.has(msg.from)) pendingIceRef.current.set(msg.from, []);
      pendingIceRef.current.get(msg.from).push(msg.candidate);
    }
  }, []);

  const clearScreenShare = useCallback((peerId) => {
    setScreenSharingPeerId(prev => {
      if (prev === peerId || peerId == null) {
        setScreenSharingEmail(null);
        setScreenSharingName(null);
        return null;
      }
      return prev;
    });
  }, []);

  const removePeer = useCallback((peerId) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    peerInfoRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    setRemotePeers(prev => prev.filter(p => p.id !== peerId));
    clearScreenShare(peerId);
  }, [clearScreenShare]);

  /* ════════════════════════════════════════════════════════════
     Cleanup
  ════════════════════════════════════════════════════════════ */
  const cleanup = useCallback(() => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    peerInfoRef.current.clear();
    pendingIceRef.current.clear();
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setCamStream(null);
    setScreenStream(null);
    setScreenOn(false);
    setRemotePeers([]);
    setScreenSharingEmail(null);
    setScreenSharingPeerId(null);
    setScreenSharingName(null);
  }, []);

  /* ════════════════════════════════════════════════════════════
     Media + WebSocket
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!meeting || !roomCode) return;   // wait until access is granted (roomCode resolved)
    let cancelled = false;
    setMediaError('');
    setMediaWarning('');

    (async () => {
      try {
        const res = await getIceConfig();
        if (res.data?.iceServers?.length) iceConfigRef.current = { iceServers: res.data.iceServers };
      } catch { /* keep default */ }

      if (!window.isSecureContext) {
        setMediaError('Kamera/mikrofon üçün HTTPS tələb olunur. Brauzerinizdə sertifikatı qəbul edin (Advanced → Proceed).');
      } else if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('Brauzeriniz kamera API-ni dəstəkləmir (Chrome/Firefox/Edge istifadə edin).');
      } else {
        // Enumerate devices FIRST so we never request a device that isn't present
        // (avoids NotFoundError) and can disable the matching UI toggle.
        let wantAudio = true, wantVideo = true;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          wantAudio = devices.some(d => d.kind === 'audioinput');
          wantVideo = devices.some(d => d.kind === 'videoinput');
        } catch { /* enumeration unsupported — assume both, fallbacks below handle it */ }
        if (!cancelled) { setHasMic(wantAudio); setHasCam(wantVideo); }

        if (!wantAudio && !wantVideo) {
          setMediaWarning('Mikrofon və kamera tapılmadı — izləyici kimi qoşulursunuz.');
        } else {
          const tryGet = async (constraints) => navigator.mediaDevices.getUserMedia(constraints);
          let stream = null;
          try {
            stream = await tryGet({ audio: wantAudio, video: wantVideo });
          } catch (err1) {
            if (err1.name === 'NotAllowedError' || err1.name === 'PermissionDeniedError') {
              setMediaError('Kamera/mikrofon girişi rədd edildi. Brauzer ünvan çubuğundakı kilid ikonasından icazə verin.');
            } else if (err1.name === 'OverconstrainedError' || err1.name === 'NotFoundError') {
              // Retry audio-only — the camera may have vanished or constraints failed
              try {
                stream = await tryGet({ audio: wantAudio, video: false });
                if (!cancelled) setHasCam(false);
                setMediaWarning('Kamera əlçatınsızdır — yalnız mikrofon ilə qoşulursunuz.');
              } catch (err2) {
                if (err2.name === 'NotAllowedError') {
                  setMediaError('Mikrofon girişi rədd edildi. Brauzer kilid ikonasından icazə verin.');
                } else {
                  if (!cancelled) { setHasMic(false); setHasCam(false); }
                  setMediaWarning('Cihaz əlçatınsız — izləyici kimi qoşulursunuz.');
                }
              }
            } else {
              setMediaWarning(`Cihaz əlçatınsız (${err1.name}) — izləyici kimi qoşulursunuz.`);
            }
          }
          if (stream && !cancelled) {
            camStreamRef.current = stream;
            setCamStream(stream);
            setMicOn(stream.getAudioTracks().length > 0);
            setCamOn(stream.getVideoTracks().length > 0);
          }
        }
      }

      if (cancelled) return;

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const token = localStorage.getItem('jwt_token') || '';
      const ws = new WebSocket(
        `${proto}://${window.location.host}/ws/meetings/${roomCode}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        let msg; try { msg = JSON.parse(evt.data); } catch { return; }

        switch (msg.type) {
          case 'peers':
            (msg.peers || []).forEach(p => {
              if (isSelfEmail(p.email)) return;   // never create a tile for ourselves
              peerInfoRef.current.set(p.id, { email: p.email, name: p.name });
              createPeerConnection(p.id, { email: p.email, name: p.name }, true);
            });
            break;
          case 'peer-joined':
            if (isSelfEmail(msg.email)) break;     // ignore our own (e.g. stale) session
            peerInfoRef.current.set(msg.id, { email: msg.email, name: msg.name });
            setRemotePeers(prev =>
              prev.some(p => p.id === msg.id) ? prev
                : [...prev, { id: msg.id, email: msg.email, name: msg.name, stream: null }]
            );
            break;
          case 'offer':          handleOffer(msg); break;
          case 'answer':         handleAnswer(msg); break;
          case 'ice-candidate':  handleIce(msg); break;
          case 'peer-left':      removePeer(msg.id); break;
          case 'meeting-ended':  noReconnectRef.current = true; sessionStorage.removeItem(SS_KEY); setEnded(true); cleanup(); break;
          case 'room-full':      noReconnectRef.current = true; setRoomFull(msg.max || 1); cleanup(); break;
          case 'screen-start':
            setScreenSharingEmail(msg.email);
            setScreenSharingPeerId(msg.from);
            setScreenSharingName(msg.name || msg.email);
            setScreenPip(false);
            break;
          case 'screen-stop':
            setScreenSharingEmail(null);
            setScreenSharingPeerId(null);
            setScreenSharingName(null);
            break;
          case 'screen-rejected':
            setShareRejected(msg.reason || 'Ekran paylaşımı rədd edildi');
            break;
          case 'chat': {
            const isSelf = msg.email === user?.email;
            setMessages(prev => [...prev, {
              id: `${msg.from}-${msg.ts}`, from: msg.from,
              email: msg.email, name: msg.name || msg.email || 'Qonaq',
              text: msg.text, ts: msg.ts, isSelf,
            }]);
            if (!chatOpenRef.current) setUnread(n => n + 1);
            break;
          }
          default: break;
        }
      };
      ws.onopen = async () => {
        reconnectsRef.current = 0;   // healthy connection — reset backoff
        // Snapshot the current participant list from the server so late joiners
        // see everyone immediately, not only those who join after us.
        try {
          const pr = await getMeetingParticipants(id);
          (pr.data || []).forEach(p => {
            if (!p.id || isSelfEmail(p.email)) return;   // skip our own session (no self-tile)
            peerInfoRef.current.set(p.id, { email: p.email, name: p.name });
            createPeerConnection(p.id, { email: p.email, name: p.name }, true);
          });
        } catch { /* WS 'peers' message is the primary path; ignore */ }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        // Unintentional drop (refresh elsewhere / network blip) → auto-reconnect a
        // few times instead of throwing the user out of the meeting.
        if (cancelled || leavingRef.current || noReconnectRef.current) return;
        if (reconnectsRef.current >= 6) return;   // give up after ~ a minute
        reconnectsRef.current += 1;
        setTimeout(() => {
          if (!leavingRef.current && !noReconnectRef.current) setRetryKey(k => k + 1);
        }, 2500);
      };
    })();

    return () => { cancelled = true; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, roomCode, retryKey]);

  /* ════════════════════════════════════════════════════════════
     Controls
  ════════════════════════════════════════════════════════════ */
  const toggleMic = () => {
    if (!camStreamRef.current) return;
    const next = !micOn;
    camStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicOn(next);
  };

  const toggleCam = () => {
    if (!camStreamRef.current) return;
    const next = !camOn;
    camStreamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
    setCamOn(next);
  };

  /** Renegotiate a single peer connection (used after addTrack changes the m-lines). */
  const renegotiate = useCallback(async (peerId, pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'offer', target: peerId, sdp: pc.localDescription });
    } catch { /* ignore — glare unlikely with single sharer */ }
  }, [sendSignal]);

  /**
   * Replace (or add) the outgoing video track on every peer connection.
   * If a peer has no existing video sender — e.g. we joined without a camera —
   * the track is ADDED and that connection is renegotiated, so the screen share
   * reaches every participant, not just those we already sent video to.
   * When `highBitrate` is set (screen sharing), raise the encoder ceiling so
   * text/detail stays sharp instead of being smeared by the default ~1 Mbps cap.
   */
  const replaceVideoTrack = useCallback((newTrack, highBitrate = false) => {
    pcsRef.current.forEach((pc, peerId) => {
      let sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(newTrack).catch(() => {});
      } else if (newTrack) {
        try {
          const stream = screenStreamRef.current || camStreamRef.current || new MediaStream([newTrack]);
          sender = pc.addTrack(newTrack, stream);
          renegotiate(peerId, pc);   // adding a track requires renegotiation
        } catch { return; }
      } else {
        return;
      }
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings.forEach(e => {
          if (highBitrate) {
            e.maxBitrate = 5_000_000;          // 5 Mbps for crisp screen share
            e.maxFramerate = 30;
            e.scaleResolutionDownBy = 1;        // never downscale shared screen
          } else {
            delete e.maxBitrate;
            delete e.scaleResolutionDownBy;
          }
        });
        if (newTrack) params.degradationPreference = highBitrate ? 'maintain-resolution' : 'balanced';
        sender.setParameters(params).catch(() => {});
      } catch { /* setParameters unsupported — ignore */ }
    });
  }, [renegotiate]);

  /**
   * Adaptive mesh quality. In a mesh every browser sends its camera to every
   * other peer, so total uplink scales with participant count. To keep larger
   * meetings usable we shrink each outgoing camera stream as the room grows.
   * Screen sharing keeps its own high-bitrate path (handled in replaceVideoTrack).
   */
  const applyAdaptiveQuality = useCallback((participantCount) => {
    let maxBitrate, scale;
    if      (participantCount <= 4)  { maxBitrate = 1_200_000; scale = 1;   }
    else if (participantCount <= 8)  { maxBitrate =   600_000; scale = 1.5; }
    else if (participantCount <= 16) { maxBitrate =   300_000; scale = 2;   }
    else                             { maxBitrate =   150_000; scale = 3;   }

    pcsRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (!sender || !sender.track) return;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings.forEach(e => { e.maxBitrate = maxBitrate; e.scaleResolutionDownBy = scale; });
        params.degradationPreference = 'balanced';
        sender.setParameters(params).catch(() => {});
      } catch { /* setParameters unsupported — ignore */ }
    });
  }, []);

  /* Re-tune camera quality whenever the participant count changes (skip while
     screen sharing — that stream is intentionally high-bitrate). */
  useEffect(() => {
    if (screenOn) return;
    applyAdaptiveQuality(remotePeers.length + 1);
  }, [remotePeers.length, screenOn, applyAdaptiveQuality]);

  const stopScreen = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenOn(false);
    const camTrack = camStreamRef.current?.getVideoTracks()[0];
    if (camTrack) replaceVideoTrack(camTrack, false);
    sendSignal({ type: 'screen-stop' });
  }, [replaceVideoTrack, sendSignal]);

  const startScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    // Optimistically attempt; server will reject if someone else is sharing
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
          width:  { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
        },
        audio: false,
      });
      screenStreamRef.current = ss;
      const screenTrack = ss.getVideoTracks()[0];
      // Hint the encoder to optimise for sharp detail (text) over smooth motion.
      if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail';
      replaceVideoTrack(screenTrack, true);
      setScreenStream(ss);
      setScreenOn(true);
      screenTrack.onended = stopScreen;
      // Notify server — server will reject if someone else is already sharing
      sendSignal({ type: 'screen-start' });
    } catch { /* user cancelled picker */ }
  };

  const toggleScreen = () => { if (screenOn) stopScreen(); else startScreen(); };

  const sendChat = useCallback((text) => sendSignal({ type: 'chat', text }), [sendSignal]);

  // Leave: I exit the meeting; it keeps running for everyone else.
  const handleLeave = () => {
    leavingRef.current = true;
    sessionStorage.removeItem(SS_KEY);
    cleanup();
    navigate('/meetings');
  };
  // Finish: host only — ends the meeting for everyone.
  const handleEnd = async () => {
    leavingRef.current = true;
    noReconnectRef.current = true;
    sessionStorage.removeItem(SS_KEY);
    try { await endMeeting(id); } catch { /* ignore */ }
    cleanup();
    navigate('/meetings');
  };

  /* ════════════════════════════════════════════════════════════
     Render states
  ════════════════════════════════════════════════════════════ */
  if (loading) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (forbidden) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="text-center px-4">
        <Lock className="w-16 h-16 text-army-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-100 mb-2">Giriş qadağandır</h2>
        <p className="text-gray-400 mb-6">Bu görüşə qoşulmaq icazəniz yoxdur.</p>
        <button onClick={() => navigate('/meetings')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Görüşlərə qayıt</button>
      </div>
    </div>
  );

  if (ended) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="text-center px-4">
        <PhoneOff className="w-16 h-16 text-army-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-100 mb-2">Görüş sona çatdı</h2>
        <button onClick={() => navigate('/meetings')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Görüşlərə qayıt</button>
      </div>
    </div>
  );

  if (roomFull) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="text-center px-4 max-w-sm">
        <Users className="w-16 h-16 text-army-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-100 mb-2">Görüş doludur</h2>
        <p className="text-gray-400 mb-6">
          Bu görüşdə maksimum iştirakçı sayına ({roomFull} nəfər) çatılıb. Bir az sonra yenidən cəhd edin.
        </p>
        <button onClick={() => navigate('/meetings')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Görüşlərə qayıt</button>
      </div>
    </div>
  );

  if (!meeting) return null;

  // Room-code gate — non-managers must enter the 4-digit PIN before the roomCode
  // (and thus the call) is revealed.
  if (pinNeeded && !roomCode) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-primary-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-100 mb-1">{meeting.title}</h2>
        <p className="text-gray-400 text-sm mb-6">Qoşulmaq üçün 4 rəqəmli otaq kodunu daxil edin</p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && submitPin()}
          placeholder="••••"
          className="w-40 mx-auto block text-center tracking-[0.6em] text-2xl font-bold py-3 rounded-xl
                     bg-army-800 border border-army-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {pinError && <p className="text-red-400 text-sm mt-3">{pinError}</p>}
        <div className="flex gap-2 mt-6">
          <button onClick={() => navigate('/meetings')}
            className="flex-1 px-4 py-2.5 bg-army-700 hover:bg-army-600 text-gray-200 rounded-xl text-sm font-medium transition-colors">
            Ləğv et
          </button>
          <button onClick={submitPin} disabled={joining || pinInput.length < 4}
            className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {joining && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Qoşul
          </button>
        </div>
      </div>
    </div>
  );

  // Still resolving access (manager roomCode / invite token) — brief spinner.
  if (!roomCode) return (
    <div className="min-h-screen bg-army-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tileCount = remotePeers.length + 1;
  const canManage = meeting.canManage;

  return (
    <div className="min-h-screen bg-army-950 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-army-800 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-gray-100 font-semibold text-sm sm:text-base truncate">{meeting.title}</h1>
          <p className="text-gray-500 text-xs truncate">{meeting.hostName || meeting.hostEmail}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSomeoneSharing && (
            <span className="hidden sm:flex items-center gap-1 text-primary-400 text-xs bg-primary-900/30 px-2 py-0.5 rounded-full">
              <Monitor className="w-3 h-3" />
              {amISharing ? 'Siz paylaşırsınız' : `${screenSharingName} paylaşır`}
            </span>
          )}
          {/* Room PIN — visible only to managers (host/super-admin/moderator) */}
          {canManage && meeting.joinPin && (
            <span className="hidden sm:flex items-center gap-1 text-gray-200 text-xs bg-army-800 px-2.5 py-1 rounded-full font-mono"
                  title="Otaq kodu (yalnız siz görürsünüz)">
              <KeyRound className="w-3.5 h-3.5 text-primary-400" />{meeting.joinPin}
            </span>
          )}
          {/* Invite — managers only */}
          {canManage && (
            <button onClick={() => { setInviteOpen(o => !o); setInviteMsg(''); }}
              className={`p-2 rounded-lg transition-colors ${inviteOpen ? 'bg-primary-600 text-white' : 'bg-army-800 text-gray-300 hover:bg-army-700'}`}
              title="İstifadəçi dəvət et">
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 text-gray-300 text-xs bg-army-800 px-2.5 py-1 rounded-full">
            <Users className="w-3.5 h-3.5" />{tileCount}
          </div>
          <button onClick={() => setChatOpen(o => !o)}
            className={`relative p-2 rounded-lg transition-colors ${chatOpen ? 'bg-primary-600 text-white' : 'bg-army-800 text-gray-300 hover:bg-army-700'}`}
            title="Söhbət">
            <MessageSquare className="w-4 h-4" />
            {!chatOpen && unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Invite panel (managers) ─────────────────────────────── */}
      {inviteOpen && canManage && (
        <div className="absolute right-3 top-16 z-30 w-72 bg-army-800 border border-army-700 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-200 text-sm font-semibold flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-primary-400" /> İstifadəçi dəvət et
            </span>
            <button onClick={() => setInviteOpen(false)} className="p-1 text-gray-400 hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mb-2 leading-snug">
            Dəvət olunan istifadəçi bildiriş və birbaşa qoşulma linki alacaq (kod tələb olunmur).
          </p>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="E-poçt ünvanı"
            className="w-full px-3 py-2 rounded-lg bg-army-700 border border-army-600 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {inviteMsg && <p className="text-[11px] text-primary-300 mt-2">{inviteMsg}</p>}
          <button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}
            className="w-full mt-3 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {inviting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Dəvət göndər
          </button>
        </div>
      )}

      {/* ── Main body ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Banners */}
          <div className="flex flex-col gap-1 px-4 pt-3 flex-shrink-0">
            {shareRejected && (
              <div className="bg-orange-900/30 border border-orange-700/50 text-orange-300 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
                {shareRejected}
              </div>
            )}
            {mediaError && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-xs px-3 py-2 rounded-lg flex items-start justify-between gap-3">
                <span>{mediaError}</span>
                <button onClick={() => setRetryKey(k => k + 1)}
                  className="flex items-center gap-1 text-red-200 hover:text-white font-semibold whitespace-nowrap flex-shrink-0">
                  <RefreshCw className="w-3 h-3" /> Yenidən cəhd
                </button>
              </div>
            )}
            {!mediaError && mediaWarning && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-xs px-3 py-2 rounded-lg">{mediaWarning}</div>
            )}
          </div>

          {/* ── VIDEO AREA ─────────────────────────────────────── */}
          {isSomeoneSharing && !screenPip ? (
            /* ── Full screen-share layout ─────────────────────
               Left: large shared screen
               Right: side strip of other participants           */
            <div className="flex flex-1 min-h-0 gap-2 p-3 overflow-hidden">
              {/* Large tile */}
              <div className="flex-1 min-w-0 relative">
                {amISharing ? (
                  <LocalTile
                    camStream={camStream} screenStream={screenStream}
                    micOn={micOn} camOn={camOn} screenOn={screenOn}
                    name={displayName} full
                  />
                ) : sharerPeer ? (
                  <RemoteTile peer={sharerPeer} full contain />
                ) : (
                  <div className="w-full h-full bg-gray-950 rounded-xl flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {/* Sharer label */}
                {!amISharing && sharerPeer && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary-600/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg">
                    <Monitor className="w-3.5 h-3.5" />
                    {screenSharingName} ekranı paylaşır
                  </div>
                )}
                {/* Minimize button */}
                <button onClick={() => setScreenPip(true)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  title="Kiçilt (ESC)">
                  <Minimize2 className="w-3.5 h-3.5" /> Kiçilt
                </button>
              </div>

              {/* Side strip */}
              <div className="flex flex-col gap-2 overflow-y-auto flex-shrink-0" style={{ width: '160px' }}>
                {/* My tile in strip when I'm watching someone else's screen */}
                {!amISharing && (
                  <StripTile
                    stream={screenOn ? screenStream : camStream}
                    muted name={`${displayName} (Siz)`}
                  />
                )}
                {otherPeers.map(p => (
                  <StripTile key={p.id} stream={p.stream} name={p.name || p.email || 'Qonaq'} />
                ))}
                {/* If I am sharing, show all remote peers in strip */}
                {amISharing && remotePeers.map(p => (
                  <StripTile key={p.id} stream={p.stream} name={p.name || p.email || 'Qonaq'} />
                ))}
              </div>
            </div>
          ) : (
            /* ── Normal / PiP layout ─────────────────────────── */
            <div className="flex-1 p-4 overflow-y-auto relative">
              <div className={`grid ${gridClass(tileCount)} gap-3 mx-auto`}>
                <LocalTile
                  camStream={camStream} screenStream={screenStream}
                  micOn={micOn} camOn={camOn} screenOn={screenOn}
                  name={displayName}
                />
                {remotePeers.map(p => <RemoteTile key={p.id} peer={p} />)}
              </div>

              {/* PiP overlay — click to go back to full view */}
              {isSomeoneSharing && screenPip && (
                <div
                  className="absolute bottom-4 right-4 w-64 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-20 cursor-pointer group"
                  onClick={() => setScreenPip(false)}
                  title="Tam ekrana keç">
                  <div className="aspect-video bg-gray-900 relative">
                    {amISharing
                      ? screenStream && <VideoStream stream={screenStream} muted contain />
                      : sharerPeer?.stream && <VideoStream stream={sharerPeer.stream} contain />
                    }
                    {/* Expand overlay on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute top-1.5 left-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                      <Monitor className="w-2.5 h-2.5 text-primary-400" />
                      {amISharing ? 'Siz (ekran)' : (screenSharingName || 'Ekran')}
                    </div>
                    <div className="absolute top-1.5 right-2 bg-primary-600/80 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                      Böyüt
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Controls ───────────────────────────────────────── */}
          <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 px-4 py-3 border-t border-army-800 flex-shrink-0">

            {/* Mic — disabled & labelled when no microphone is present */}
            <button onClick={toggleMic} disabled={!hasMic || !camStreamRef.current?.getAudioTracks().length}
              title={!hasMic ? 'Mikrofon tapılmadı' : micOn ? 'Mikrofonu söndür' : 'Mikrofonu aç'}
              className={`p-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${micOn && hasMic ? 'bg-army-700 hover:bg-army-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {micOn && hasMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Camera — disabled & labelled when no camera is present */}
            <button onClick={toggleCam} disabled={!hasCam || screenOn || !camStreamRef.current?.getVideoTracks().length}
              title={!hasCam ? 'Kamera tapılmadı' : camOn ? 'Kameranı söndür' : 'Kameranı aç'}
              className={`p-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${camOn && !screenOn && hasCam ? 'bg-army-700 hover:bg-army-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {camOn && !screenOn && hasCam ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Screen share */}
            {!!navigator.mediaDevices?.getDisplayMedia && (
              <div className="relative group">
                <button onClick={toggleScreen}
                  disabled={isSomeoneSharing && !amISharing}
                  title={isSomeoneSharing && !amISharing
                    ? `${screenSharingName} artıq ekranını paylaşır`
                    : screenOn ? 'Ekran paylaşımını dayandır' : 'Ekranı paylaş'}
                  className={`p-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    screenOn
                      ? 'bg-primary-600 hover:bg-primary-700 text-white ring-2 ring-primary-400'
                      : 'bg-army-700 hover:bg-army-600 text-white'
                  }`}>
                  {screenOn ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </button>
                {isSomeoneSharing && !amISharing && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 text-center bg-gray-900 border border-army-700 text-gray-300 text-xs px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                    {screenSharingName} artıq ekranını paylaşır
                  </div>
                )}
              </div>
            )}

            {/* Full / PiP toggle — shown whenever someone is sharing */}
            {isSomeoneSharing && (
              <button onClick={() => setScreenPip(p => !p)}
                title={screenPip ? 'Tam ekrana keç' : 'Kiçilt (ESC)'}
                className="p-3 rounded-full bg-army-700 hover:bg-army-600 text-white transition-colors">
                {screenPip ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
              </button>
            )}

            {/* Chat (mobile shortcut) */}
            <button onClick={() => setChatOpen(o => !o)}
              className={`p-3 rounded-full transition-colors sm:hidden relative ${chatOpen ? 'bg-primary-600 text-white' : 'bg-army-700 hover:bg-army-600 text-white'}`}>
              <MessageSquare className="w-5 h-5" />
              {!chatOpen && unread > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Leave */}
            <button onClick={handleLeave} title="Tərk et"
              className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-army-700 hover:bg-army-600 text-white text-sm font-semibold transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Tərk et</span>
            </button>

            {/* End meeting (host) */}
            {isHost && (
              <button onClick={handleEnd} title="Görüşü bitir"
                className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline">Görüşü bitir</span>
              </button>
            )}
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <ChatPanel messages={messages} onSend={sendChat} onClose={() => setChatOpen(false)} messagesEndRef={messagesEndRef} />
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * meetingMedia.js — WebCodecs media engine for video meetings.
 *
 * Media goes entirely over a binary WebSocket (the app backend relays it to the
 * other participants). No WebRTC, no media ports — works over the single 443.
 *
 *   Publish : capture track → MediaStreamTrackProcessor → VideoEncoder/AudioEncoder
 *             (VP8 / Opus) → binary frames → WS
 *   Receive : WS → per-sender VideoDecoder/AudioDecoder → <canvas> / WebAudio
 *
 * Wire format (after the backend prepends [1 senderLen][sender email]):
 *   [1 kind][1 flags][8 ts f64][4 sampleRate u32][1 channels u8][1 rsv][payload]
 *   kind: 0=camera video, 1=screen video, 2=audio   flags bit0 = keyframe
 *
 * Requires WebCodecs + MediaStreamTrackProcessor → Chromium (Chrome/Edge).
 * ════════════════════════════════════════════════════════════════════════════ */

const KIND_CAM = 0, KIND_SCREEN = 1, KIND_AUDIO = 2;
const HEADER = 16;
const INACTIVE_MS = 1500;          // no frames for this long → mark track inactive
const KEYFRAME_EVERY = 60;         // force a keyframe ~every 2s (lets late joiners start)

export function isMeetingMediaSupported() {
  return typeof window !== 'undefined'
    && 'VideoEncoder' in window && 'VideoDecoder' in window
    && 'AudioEncoder' in window && 'AudioDecoder' in window
    && 'MediaStreamTrackProcessor' in window;
}

export default class MeetingMedia {
  constructor({ url, selfEmail, onChange, onClose }) {
    this.url = url;
    this.selfEmail = (selfEmail || '').toLowerCase();
    this.onChange = onChange || (() => {});
    this.onClose = onClose || (() => {});

    this.ws = null;
    this._wanted = [];              // emails whose camera we want (selective forwarding)
    this.pubs = {};                 // kind → { reader, encoder, active, w, h, frameCount, sr, ch }
    this.videoTiles = new Map();    // "email|kind" → { canvas, ctx }
    this.videoDecoders = new Map(); // "email|kind" → { decoder, gotKey }
    this.audioDecoders = new Map(); // email → AudioDecoder
    this.state = new Map();         // email → { camera, screen, audio }
    this.lastSeen = new Map();      // "email|kind" → ts ; "email|audio" → ts

    this.audioCtx = null;
    this.audioNext = new Map();     // email → next scheduled play time

    this._watch = null;
  }

  /* ── lifecycle ─────────────────────────────────────────────── */
  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this._sendControl();          // tell the relay what we want
    this.ws.onmessage = (ev) => this._onMessage(ev.data);
    this.ws.onclose = () => this.onClose();
    this.ws.onerror = () => {};
    this._watch = setInterval(() => this._reapInactive(), 700);
  }

  /**
   * Declare which senders' CAMERA video we want (the tiles we're displaying). The
   * relay only forwards those camera streams to us — audio + screen always arrive.
   * Call whenever the visible tile set changes. Pass an array of emails.
   */
  setWanted(emails) {
    this._wanted = (emails || []).map(e => (e || '').toLowerCase());
    this._sendControl();
  }

  _sendControl() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      const body = new TextEncoder().encode(JSON.stringify(this._wanted || []));
      const buf = new Uint8Array(1 + body.length);
      buf[0] = 255;                 // KIND_CONTROL
      buf.set(body, 1);
      this.ws.send(buf.buffer);
    } catch { /* ignore */ }
  }

  resumeAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.audioCtx = new AC();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
  }

  close() {
    if (this._watch) clearInterval(this._watch);
    Object.keys(this.pubs).forEach(k => this._stopPub(Number(k)));
    this.videoDecoders.forEach(d => { try { d.decoder?.close(); } catch { /* ignore */ } });
    this.audioDecoders.forEach(d => { try { d.close(); } catch { /* ignore */ } });
    this.videoDecoders.clear(); this.audioDecoders.clear();
    if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch { /* ignore */ } this.ws = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch { /* ignore */ } this.audioCtx = null; }
  }

  /* ── what the UI reads ─────────────────────────────────────── */
  // canvas element for a remote sender's camera/screen (created lazily so a tile
  // can attach it even before the first frame arrives).
  canvasFor(email, kind /* 'camera' | 'screen' */) {
    const k = `${email.toLowerCase()}|${kind === 'screen' ? KIND_SCREEN : KIND_CAM}`;
    let t = this.videoTiles.get(k);
    if (!t) {
      const canvas = document.createElement('canvas');
      canvas.width = 16; canvas.height = 9;
      t = { canvas, ctx: canvas.getContext('2d') };
      this.videoTiles.set(k, t);
    }
    return t.canvas;
  }

  stateFor(email) {
    return this.state.get((email || '').toLowerCase()) || { camera: false, screen: false, audio: false };
  }

  /* ── publishing (local) ────────────────────────────────────── */
  setCamera(track) { this._setVideo(KIND_CAM, track, { bitrate: 1_200_000, fps: 30 }); }
  setScreen(track) { this._setVideo(KIND_SCREEN, track, { bitrate: 2_500_000, fps: 30 }); }
  setMic(track)    { this._setAudio(track); }

  _setVideo(kind, track, cfg) {
    this._stopPub(kind);
    if (!track) return;
    this._runVideoCapture(kind, track, cfg);
  }
  _setAudio(track) {
    this._stopPub(KIND_AUDIO);
    if (!track) return;
    this._runAudioCapture(track);
  }

  _stopPub(kind) {
    const pub = this.pubs[kind];
    if (!pub) return;
    pub.active = false;
    try { pub.reader?.cancel(); } catch { /* ignore */ }
    try { pub.encoder?.close(); } catch { /* ignore */ }
    delete this.pubs[kind];
  }

  async _runVideoCapture(kind, track, cfg) {
    let processor;
    try { processor = new MediaStreamTrackProcessor({ track }); }
    catch { return; }
    const reader = processor.readable.getReader();
    const pub = { reader, encoder: null, active: true, w: 0, h: 0, frameCount: 0 };
    this.pubs[kind] = pub;

    while (pub.active) {
      let res;
      try { res = await reader.read(); } catch { break; }
      const { value: frame, done } = res;
      if (done) break;
      if (!frame) continue;
      try {
        const w = frame.displayWidth, h = frame.displayHeight;
        if (!pub.encoder || pub.w !== w || pub.h !== h) {
          try { pub.encoder?.close(); } catch { /* ignore */ }
          pub.w = w; pub.h = h; pub.frameCount = 0;
          pub.encoder = new VideoEncoder({
            output: (chunk) => this._send(kind, chunk),
            error: (e) => console.warn('VideoEncoder', e),
          });
          pub.encoder.configure({
            codec: 'vp8', width: w, height: h,
            bitrate: cfg.bitrate, framerate: cfg.fps, latencyMode: 'realtime',
          });
        }
        if (pub.encoder.encodeQueueSize > 2) { frame.close(); continue; }  // drop → low latency
        const keyFrame = (pub.frameCount % KEYFRAME_EVERY === 0);
        pub.encoder.encode(frame, { keyFrame });
        pub.frameCount++;
        frame.close();
      } catch (e) {
        try { frame.close(); } catch { /* ignore */ }
      }
    }
    try { reader.cancel(); } catch { /* ignore */ }
  }

  async _runAudioCapture(track) {
    let processor;
    try { processor = new MediaStreamTrackProcessor({ track }); }
    catch { return; }
    const reader = processor.readable.getReader();
    const pub = { reader, encoder: null, active: true, sr: 48000, ch: 1 };
    this.pubs[KIND_AUDIO] = pub;
    let configured = false;
    pub.encoder = new AudioEncoder({
      output: (chunk) => this._send(KIND_AUDIO, chunk, pub.sr, pub.ch),
      error: (e) => console.warn('AudioEncoder', e),
    });

    while (pub.active) {
      let res;
      try { res = await reader.read(); } catch { break; }
      const { value: ad, done } = res;
      if (done) break;
      if (!ad) continue;
      try {
        if (!configured) {
          pub.sr = ad.sampleRate; pub.ch = ad.numberOfChannels;
          pub.encoder.configure({ codec: 'opus', sampleRate: pub.sr, numberOfChannels: pub.ch, bitrate: 32_000 });
          configured = true;
        }
        pub.encoder.encode(ad);
        ad.close();
      } catch (e) {
        try { ad.close(); } catch { /* ignore */ }
      }
    }
    try { reader.cancel(); } catch { /* ignore */ }
  }

  _send(kind, chunk, sampleRate = 0, channels = 0) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const size = chunk.byteLength;
    const buf = new ArrayBuffer(HEADER + size);
    const dv = new DataView(buf);
    dv.setUint8(0, kind);
    dv.setUint8(1, chunk.type === 'key' ? 1 : 0);
    dv.setFloat64(2, chunk.timestamp || 0, true);
    dv.setUint32(10, sampleRate, true);
    dv.setUint8(14, channels);
    try {
      chunk.copyTo(new Uint8Array(buf, HEADER));
      this.ws.send(buf);
    } catch { /* ignore */ }
  }

  /* ── receiving (remote) ────────────────────────────────────── */
  _onMessage(data) {
    if (!(data instanceof ArrayBuffer)) return;
    const dv = new DataView(data);
    const senderLen = dv.getUint8(0);
    const sender = new TextDecoder().decode(new Uint8Array(data, 1, senderLen)).toLowerCase();
    if (!sender || sender === this.selfEmail) return;     // ignore our own (other tab)
    const off = 1 + senderLen;
    const kind = dv.getUint8(off);
    const flags = dv.getUint8(off + 1);
    const ts = dv.getFloat64(off + 2, true);
    const sampleRate = dv.getUint32(off + 10, true);
    const channels = dv.getUint8(off + 14);
    const payload = new Uint8Array(data, off + HEADER);

    if (kind === KIND_AUDIO) this._onAudio(sender, ts, sampleRate, channels, payload);
    else this._onVideo(sender, kind, flags, ts, payload);
  }

  _onVideo(email, kind, flags, ts, payload) {
    const k = `${email}|${kind}`;
    let d = this.videoDecoders.get(k);
    if (!d) { d = { decoder: null, gotKey: false }; this.videoDecoders.set(k, d); }
    const tile = this._ensureTile(email, kind);
    if (!d.decoder) {
      d.decoder = new VideoDecoder({
        output: (frame) => this._draw(tile, frame),
        error: (e) => { console.warn('VideoDecoder', e); d.gotKey = false; },
      });
      try { d.decoder.configure({ codec: 'vp8', optimizeForLatency: true }); } catch { /* ignore */ }
    }
    const isKey = (flags & 1) === 1;
    if (!d.gotKey) { if (!isKey) return; d.gotKey = true; }
    try {
      d.decoder.decode(new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta', timestamp: ts, data: payload,
      }));
      this._touch(email, kind === KIND_SCREEN ? 'screen' : 'camera');
    } catch { d.gotKey = false; }
  }

  _onAudio(email, ts, sampleRate, channels, payload) {
    let d = this.audioDecoders.get(email);
    if (!d) {
      d = new AudioDecoder({
        output: (ad) => this._playAudio(email, ad),
        error: (e) => console.warn('AudioDecoder', e),
      });
      try { d.configure({ codec: 'opus', sampleRate: sampleRate || 48000, numberOfChannels: channels || 1 }); }
      catch { /* ignore */ }
      this.audioDecoders.set(email, d);
    }
    try {
      d.decode(new EncodedAudioChunk({ type: 'key', timestamp: ts, data: payload }));
      this._touch(email, 'audio');
    } catch { /* ignore */ }
  }

  _ensureTile(email, kind) {
    const k = `${email}|${kind}`;
    let t = this.videoTiles.get(k);
    if (!t) {
      const canvas = document.createElement('canvas');
      canvas.width = 16; canvas.height = 9;
      t = { canvas, ctx: canvas.getContext('2d') };
      this.videoTiles.set(k, t);
    }
    return t;
  }

  _draw(tile, frame) {
    try {
      const c = tile.canvas;
      if (c.width !== frame.displayWidth || c.height !== frame.displayHeight) {
        c.width = frame.displayWidth; c.height = frame.displayHeight;
      }
      tile.ctx.drawImage(frame, 0, 0);
    } catch { /* ignore */ }
    frame.close();
  }

  _playAudio(email, ad) {
    this.resumeAudio();
    const ctx = this.audioCtx;
    if (!ctx) { ad.close(); return; }
    try {
      const ab = ctx.createBuffer(ad.numberOfChannels, ad.numberOfFrames, ad.sampleRate);
      const tmp = new Float32Array(ad.numberOfFrames);
      for (let ch = 0; ch < ad.numberOfChannels; ch++) {
        ad.copyTo(tmp, { planeIndex: ch, format: 'f32-planar' });
        ab.copyToChannel(tmp, ch);
      }
      const src = ctx.createBufferSource();
      src.buffer = ab; src.connect(ctx.destination);
      const now = ctx.currentTime;
      let t = this.audioNext.get(email) || 0;
      if (t < now + 0.06) t = now + 0.06;           // small jitter buffer
      src.start(t);
      this.audioNext.set(email, t + ab.duration);
    } catch { /* ignore */ }
    ad.close();
  }

  /* ── active-state tracking ─────────────────────────────────── */
  _touch(email, what) {
    this.lastSeen.set(`${email}|${what}`, performance.now());
    const s = this.state.get(email) || { camera: false, screen: false, audio: false };
    if (!s[what]) { s[what] = true; this.state.set(email, s); this.onChange(); }
    else this.state.set(email, s);
  }

  _reapInactive() {
    const now = performance.now();
    let changed = false;
    this.state.forEach((s, email) => {
      ['camera', 'screen', 'audio'].forEach(what => {
        if (s[what] && now - (this.lastSeen.get(`${email}|${what}`) || 0) > INACTIVE_MS) {
          s[what] = false; changed = true;
        }
      });
    });
    if (changed) this.onChange();
  }
}

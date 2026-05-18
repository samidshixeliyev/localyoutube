import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, RefreshCw,
  Cpu, MemoryStick, HardDrive, Globe,
  Upload, Clapperboard, Eye, Database,
  Network, Server, Clock, Layers,
  AlertCircle, Wifi, Zap, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';
import Navbar from '../../components/Navbar';
import api, { adminGetStats } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

// ── Prometheus proxy helpers ──────────────────────────────────────────────────

const instant = (query) =>
  api.get('/admin/metrics/instant', { params: { query } }).then(r => r.data);

const range = (query, start, end, step) =>
  api.get('/admin/metrics/range', { params: { query, start, end, step } }).then(r => r.data);

function scalar(data, fallback = null) {
  try {
    const v = parseFloat(data.data.result[0].value[1]);
    return isNaN(v) ? fallback : v;
  } catch { return fallback; }
}

function toSeries(data, labelFn = () => 'value') {
  try {
    const results = data.data.result;
    if (!results || results.length === 0) return [];
    const map = new Map();
    results.forEach(r => {
      const name = labelFn(r.metric);
      r.values.forEach(([ts, val]) => {
        const t = ts * 1000;
        if (!map.has(t)) map.set(t, { ts: t });
        map.get(t)[name] = parseFloat(val);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  } catch { return []; }
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtTime  = ts  => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtBytes = b   => {
  if (b == null) return '—';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b.toFixed(0) + ' B';
};
const fmtBps   = b   => b == null ? '—' : fmtBytes(b) + '/s';
const fmtNum   = (n, dec = 1) => n == null ? '—' : n.toFixed(dec);
const fmtUptime = s  => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}g ${h}s`;
  if (h > 0) return `${h}s ${m}d`;
  return `${m} dəq`;
};

// ── Time range config ─────────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: '1d',  seconds: 60,    step: 10,   rateWin: '30s' },
  { label: '5d',  seconds: 300,   step: 15,   rateWin: '1m'  },
  { label: '30d', seconds: 1800,  step: 30,   rateWin: '2m'  },
  { label: '1s',  seconds: 3600,  step: 60,   rateWin: '5m'  },
  { label: '6s',  seconds: 21600, step: 360,  rateWin: '10m' },
  { label: '24s', seconds: 86400, step: 1440, rateWin: '30m' },
];

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  orange: '#f97316', blue:  '#3b82f6', green:  '#22c55e',
  red:    '#ef4444', purple:'#a855f7', sky:    '#0ea5e9',
  amber:  '#f59e0b', teal:  '#14b8a6', indigo: '#6366f1',
  rose:   '#f43f5e', lime:  '#84cc16', cyan:   '#06b6d4',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, unit = '', fmtVal }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-500 dark:text-gray-400 mb-1">{fmtTime(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtVal ? fmtVal(p.value) : (typeof p.value === 'number' ? p.value.toFixed(2) : p.value)}{!fmtVal ? unit : ''}
        </p>
      ))}
    </div>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, value, unit = '', color, sub, loading, hasError, zeroDefault, wide }) {
  const unavailable = !loading && hasError && value == null;
  const displayValue = value != null
    ? `${fmtNum(value, value < 10 ? 2 : 0)}${unit}`
    : (zeroDefault && !hasError ? `0${unit}` : '—');
  return (
    <div className={`bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm p-4 flex items-center gap-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
           style={{ backgroundColor: (unavailable ? '#9ca3af' : color) + '18' }}>
        <Icon className="w-5 h-5" style={{ color: unavailable ? '#9ca3af' : color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        {loading
          ? <div className="h-5 w-16 bg-gray-100 dark:bg-army-700 rounded animate-pulse mt-1"/>
          : <p className={`text-xl font-bold leading-tight ${unavailable ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {displayValue}
            </p>}
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── RawStatCard — for pre-formatted string values (bytes/s, uptime, etc.) ────
function RawStatCard({ icon: Icon, title, value, color, sub, loading, hasError }) {
  const unavailable = !loading && hasError && !value;
  return (
    <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
           style={{ backgroundColor: (unavailable ? '#9ca3af' : color) + '18' }}>
        <Icon className="w-5 h-5" style={{ color: unavailable ? '#9ca3af' : color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        {loading
          ? <div className="h-5 w-16 bg-gray-100 dark:bg-army-700 rounded animate-pulse mt-1"/>
          : <p className={`text-lg font-bold leading-tight truncate ${unavailable ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {value || '—'}
            </p>}
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────
function ChartCard({ title, children, loading, empty, span2 }) {
  return (
    <div className={`bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm overflow-hidden ${span2 ? 'lg:col-span-2' : ''}`}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      </div>
      <div className="p-4" style={{ height: 220 }}>
        {loading
          ? <div className="h-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-gray-300 dark:text-gray-600 animate-spin" />
            </div>
          : empty
          ? <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
              <Activity className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Hələ məlumat yoxdur</p>
            </div>
          : children}
      </div>
    </div>
  );
}

const Section = ({ children, icon: Icon }) => (
  <div className="flex items-center gap-2 mt-8 mb-3">
    {Icon && <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{children}</p>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export default function Metrics() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const gridColor = dark ? '#374151' : '#e5e7eb';
  const axisColor = dark ? '#4b5563' : '#d1d5db';
  const tickColor = dark ? '#9ca3af' : '#6b7280';

  const [range_, setRange]         = useState(TIME_RANGES[3]);
  const [stats,   setStats]        = useState({});
  const [charts,  setCharts]       = useState({});
  const [loading, setLoading]      = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [error,   setError]        = useState(null);
  const [lastRefresh, setLastRefresh]     = useState(null);
  const timerRef = useRef(null);

  const [dbStats,   setDbStats]    = useState(null);
  const [dbLoading, setDbLoading]  = useState(true);


  // ── Fetch instant stats ───────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const empty = { data: { result: [] } };
      const settled = await Promise.allSettled([
        instant('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        instant('(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100'),
        instant('max((1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|devtmpfs|squashfs"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay|devtmpfs|squashfs"}) * 100)'),
        instant('sum(rate(http_server_requests_seconds_count[5m]))'),
        instant('localtube_uploads_success_total'),
        instant('localtube_active_transcodings'),
        instant('localtube_video_views_total'),
        instant('sum(localtube_disk_usage_bytes)'),
        instant('sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))'),
        instant('sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))'),
        instant('node_load1'),
        instant('node_load5'),
        instant('time() - node_boot_time_seconds'),
        instant('jvm_threads_live'),
        instant('process_open_fds{job="modtube-backend"}'),
        instant('sum(rate(node_disk_read_bytes_total[5m]))'),
        instant('sum(rate(node_disk_written_bytes_total[5m]))'),
      ]);
      const [cpu, mem, disk, http_, uploads, transcodings, views, storage,
             netIn, netOut, load1, load5, uptime_, threads, fds, diskRd, diskWr] =
        settled.map(r => r.status === 'fulfilled' ? r.value : empty);
      setStats({
        cpu, mem, disk,
        http:          scalar(http_),
        uploads:       scalar(uploads),
        transcodings:  scalar(transcodings),
        views:         scalar(views),
        storage:       scalar(storage),
        netIn:         scalar(netIn),
        netOut:        scalar(netOut),
        load1:         scalar(load1),
        load5:         scalar(load5),
        uptime:        scalar(uptime_),
        threads:       scalar(threads),
        fds:           scalar(fds),
        diskRd:        scalar(diskRd),
        diskWr:        scalar(diskWr),
        cpu:           scalar(cpu),
        mem:           scalar(mem),
        disk:          scalar(disk),
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.response?.status === 403 || e.response?.status === 401 ? 'permission' : 'unavailable');
    } finally { setLoading(false); }
  }, []);

  // ── Fetch chart data ──────────────────────────────────────────────────────
  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const now   = Math.floor(Date.now() / 1000);
      const start = now - range_.seconds;
      const step  = range_.step;
      const rw    = range_.rateWin;
      const S = String(start), E = String(now), T = String(step);

      const empty = { data: { result: [] } };
      const chartSettled = await Promise.allSettled([
        range(`100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[${rw}])) * 100)`, S, E, T),
        range('node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes', S, E, T),
        range(`sum by(status)(rate(http_server_requests_seconds_count[${rw}]))`, S, E, T),
        range(`histogram_quantile(0.95, sum by(le)(rate(http_server_requests_seconds_bucket[${rw}])))`, S, E, T),
        range('sum(jvm_memory_used_bytes{area="heap"})', S, E, T),
        range('sum(jvm_memory_max_bytes{area="heap"})', S, E, T),
        range(`rate(localtube_uploads_success_total[${rw}]) * 60`, S, E, T),
        range(`rate(localtube_video_views_total[${rw}]) * 60`, S, E, T),
        range('localtube_disk_usage_bytes', S, E, T),
        range('localtube_active_transcodings', S, E, T),
        range(`sum(rate(node_network_receive_bytes_total{device!="lo"}[${rw}]))`, S, E, T),
        range(`sum(rate(node_network_transmit_bytes_total{device!="lo"}[${rw}]))`, S, E, T),
        range('node_load1', S, E, T),
        range(`sum(rate(node_disk_read_bytes_total[${rw}]))`, S, E, T),
        range(`sum(rate(node_disk_written_bytes_total[${rw}]))`, S, E, T),
        range(`sum(rate(http_server_requests_seconds_count{status=~"[45].."}[${rw}])) / sum(rate(http_server_requests_seconds_count[${rw}])) * 100`, S, E, T),
      ]);
      const [cpuTs, memTs, httpTs, p95Ts, heapUsed, heapMax,
             uploadRate, viewRate, diskTs, transTs,
             netInTs, netOutTs, loadTs, diskRdTs, diskWrTs, errRateTs] =
        chartSettled.map(r => r.status === 'fulfilled' ? r.value : empty);

      const heapData = (() => {
        const u = toSeries(heapUsed, () => 'İstifadə');
        const m = toSeries(heapMax,  () => 'Maksimum');
        const mMap = new Map(m.map(d => [d.ts, d['Maksimum']]));
        return u.map(d => ({ ...d, 'Maksimum': mMap.get(d.ts) ?? null }));
      })();

      const netData = (() => {
        const rx = toSeries(netInTs,  () => 'Giriş');
        const tx = toSeries(netOutTs, () => 'Çıxış');
        const txMap = new Map(tx.map(d => [d.ts, d['Çıxış']]));
        return rx.map(d => ({ ...d, 'Çıxış': txMap.get(d.ts) ?? null }));
      })();

      const diskIoData = (() => {
        const rd = toSeries(diskRdTs, () => 'Oxuma');
        const wr = toSeries(diskWrTs, () => 'Yazma');
        const wrMap = new Map(wr.map(d => [d.ts, d['Yazma']]));
        return rd.map(d => ({ ...d, 'Yazma': wrMap.get(d.ts) ?? null }));
      })();

      setCharts({
        cpu:        toSeries(cpuTs,      () => 'CPU %'),
        mem:        memTs,
        http:       toSeries(httpTs,     m => `HTTP ${m.status || 'all'}`),
        p95:        toSeries(p95Ts,      () => 'P95'),
        heap:       heapData,
        uploadRate: toSeries(uploadRate, () => 'Yüklənmə/dəq'),
        viewRate:   toSeries(viewRate,   () => 'Baxış/dəq'),
        disk:       toSeries(diskTs,     m => m.type || 'bytes'),
        transcodings: toSeries(transTs,  () => 'Aktiv'),
        net:        netData,
        diskIo:     diskIoData,
        load:       toSeries(loadTs,     () => 'Yük'),
        errRate:    toSeries(errRateTs,  () => 'Xəta %'),
        rawMem:     toSeries(memTs,      () => 'İstifadə'),
      });
    } catch {/* charts fail gracefully */}
    finally { setChartsLoading(false); }
  }, [range_]);

  const fetchDbStats = useCallback(async () => {
    setDbLoading(true);
    try { setDbStats((await adminGetStats()).data); }
    catch { setDbStats(null); }
    finally { setDbLoading(false); }
  }, []);

  const refresh = useCallback(() => {
    fetchStats(); fetchCharts(); fetchDbStats();
  }, [fetchStats, fetchCharts, fetchDbStats]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 30_000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  // ── Tick formatter — shows seconds for very short ranges ─────────────────
  const tickFmt = range_.step < 60
    ? ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Derived colours ───────────────────────────────────────────────────────
  const cpuColor  = stats.cpu  > 85 ? C.red : stats.cpu  > 70 ? C.amber : C.green;
  const memColor  = stats.mem  > 85 ? C.red : stats.mem  > 70 ? C.amber : C.blue;
  const diskColor = stats.disk > 85 ? C.red : stats.disk > 70 ? C.amber : C.teal;
  const loadColor = stats.load1 > 4 ? C.red : stats.load1 > 2 ? C.amber : C.green;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-army-700 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sistem Metriklər</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Prometheus — hər 30 san yenilənir
                {lastRefresh && <> · Son yeniləmə: {lastRefresh.toLocaleTimeString()}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-lg overflow-hidden">
                {TIME_RANGES.map(r => (
                  <button key={r.label} onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      range_.label === r.label
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-army-700'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={refresh}
                className="p-2 bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-army-700 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div className="mb-4 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {error === 'permission'
                  ? <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Bu səhifəyə giriş icazəniz yoxdur.
                    </p>
                  : <>
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium">Prometheus əlçatmazdır.</p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-0.5 font-mono">
                        docker exec modtube supervisorctl status
                      </p>
                    </>}
              </div>
              {error !== 'permission' && (
                <button onClick={refresh}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors">
                  Yenidən cəhd et
                </button>
              )}
            </div>
          )}

          {/* ══ DB STATS ══════════════════════════════════════════════════════ */}
          <Section icon={Database}>Verilənlər Bazası</Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Upload}       title="Yüklənmiş Videolar"   value={dbStats?.totalVideos}        color={C.orange} loading={dbLoading} hasError={!dbStats && !dbLoading} zeroDefault />
            <StatCard icon={Eye}          title="Ümumi Baxışlar"       value={dbStats?.totalViews}         color={C.purple} loading={dbLoading} hasError={!dbStats && !dbLoading} zeroDefault />
            <StatCard icon={HardDrive}    title="Video Yaddaşı"
              value={dbStats?.totalFileSizeBytes != null ? dbStats.totalFileSizeBytes / 1e9 : null}
              unit=" GB" color={C.teal} loading={dbLoading}
              sub={dbStats?.totalFileSizeBytes != null ? fmtBytes(dbStats.totalFileSizeBytes) : null}
              hasError={!dbStats && !dbLoading} />
            <StatCard icon={Clapperboard} title="Aktiv Transkodlama"   value={dbStats?.activeTranscodings} color={C.amber} loading={dbLoading} hasError={!dbStats && !dbLoading} zeroDefault />
          </div>

          {/* ══ SYSTEM INSTANT ════════════════════════════════════════════════ */}
          <Section icon={Server}>Sistem Resursu</Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Cpu}        title="CPU İstifadəsi"      value={stats.cpu}    unit="%" color={cpuColor}  loading={loading} sub="5 dəq ortalaması"   hasError={!!error} />
            <StatCard icon={MemoryStick} title="RAM İstifadəsi"     value={stats.mem}    unit="%" color={memColor}  loading={loading} sub="cəmi RAM-dan"       hasError={!!error} />
            <StatCard icon={HardDrive}  title="Disk İstifadəsi"     value={stats.disk}   unit="%" color={diskColor} loading={loading} sub="ən böyük bölümdən"  hasError={!!error} />
            <StatCard icon={Zap}        title="Yük Ortalaması (1d)" value={stats.load1}  unit=""  color={loadColor}  loading={loading} sub={stats.load5 != null ? `5d: ${fmtNum(stats.load5)}` : undefined} hasError={!!error} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <RawStatCard icon={Clock}   title="Server Vaxtı"   value={fmtUptime(stats.uptime)} sub="açıq qalma"      color={C.indigo} loading={loading} hasError={!!error} />
            <RawStatCard icon={Wifi}    title="Şəbəkə Girişi"  value={fmtBps(stats.netIn)}     sub="giriş sürəti"    color={C.sky}    loading={loading} hasError={!!error} />
            <RawStatCard icon={Network} title="Şəbəkə Çıxışı"  value={fmtBps(stats.netOut)}    sub="çıxış sürəti"   color={C.cyan}   loading={loading} hasError={!!error} />
            <StatCard    icon={Globe}   title="HTTP Sorğu/san" value={stats.http} unit=""       sub="5 dəq dərəcəsi" color={C.blue}   loading={loading} hasError={!!error} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <RawStatCard icon={HardDrive} title="Disk Oxuma"       value={fmtBps(stats.diskRd)}  sub="oxuma sürəti"    color={C.lime}   loading={loading} hasError={!!error} />
            <RawStatCard icon={HardDrive} title="Disk Yazma"       value={fmtBps(stats.diskWr)}  sub="yazma sürəti"   color={C.rose}   loading={loading} hasError={!!error} />
            <StatCard    icon={Layers}    title="JVM Threads"      value={stats.threads} unit=""                       color={C.teal}   loading={loading} hasError={!!error} zeroDefault />
            <StatCard    icon={BarChart2} title="Fayl Deskriptoru" value={stats.fds}     unit=""                       color={C.purple} loading={loading} hasError={!!error} zeroDefault />
          </div>

          {/* ══ APP INSTANT ═══════════════════════════════════════════════════ */}
          <Section icon={Upload}>Tətbiq</Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Upload}       title="Cəmi Yüklənmə"       value={stats.uploads}      color={C.orange} loading={loading} hasError={!!error} zeroDefault />
            <StatCard icon={Clapperboard} title="Aktiv Transkodlama"   value={stats.transcodings} color={stats.transcodings > 0 ? C.amber : C.green} loading={loading} hasError={!!error} zeroDefault />
            <StatCard icon={Eye}          title="Cəmi Baxış"           value={stats.views}        color={C.purple} loading={loading} hasError={!!error} zeroDefault />
            <StatCard icon={Database}     title="Video Yaddaşı"
              value={stats.storage != null ? stats.storage / 1e9 : null}
              unit=" GB" color={C.teal} loading={loading} sub={fmtBytes(stats.storage)} hasError={!!error} />
          </div>

          {/* ══ SYSTEM CHARTS ═════════════════════════════════════════════════ */}
          <Section icon={Cpu}>Sistem Zaman Sırası</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="CPU İstifadəsi %" loading={chartsLoading} empty={!charts.cpu?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.cpu} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.orange} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.orange} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis domain={[0,100]} unit="%" tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Area type="monotone" dataKey="CPU %" stroke={C.orange} fill="url(#gCpu)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="RAM İstifadəsi" loading={chartsLoading} empty={!charts.rawMem?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.rawMem} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip fmtVal={fmtBytes} />} />
                  <Area type="monotone" dataKey="İstifadə" stroke={C.blue} fill="url(#gMem)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Şəbəkə I/O (bayt/san)" loading={chartsLoading} empty={!charts.net?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={charts.net} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip fmtVal={fmtBps} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Giriş"  stroke={C.sky}  fill={C.sky + '22'}  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Çıxış"  stroke={C.cyan} fill={C.cyan + '22'} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Disk I/O (bayt/san)" loading={chartsLoading} empty={!charts.diskIo?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={charts.diskIo} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip fmtVal={fmtBps} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Oxuma" stroke={C.lime} fill={C.lime + '22'} strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Yazma" stroke={C.rose} fill={C.rose + '22'} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sistem Yükü (1 dəq)" loading={chartsLoading} empty={!charts.load?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.load} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.indigo} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.indigo} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Yük" stroke={C.indigo} fill="url(#gLoad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Aktiv Transkodlama" loading={chartsLoading} empty={!charts.transcodings?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.transcodings} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTrans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.amber} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="stepAfter" dataKey="Aktiv" stroke={C.amber} fill="url(#gTrans)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ══ HTTP / JVM CHARTS ═════════════════════════════════════════════ */}
          <Section icon={Globe}>HTTP və JVM</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="HTTP Sorğu/san (status üzrə)" loading={chartsLoading} empty={!charts.http?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.http} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {charts.http?.length > 0 &&
                    Object.keys(charts.http[0]).filter(k => k !== 'ts').map((k, i) => {
                      const colours = [C.green, C.red, C.amber, C.blue, C.purple];
                      return <Line key={k} type="monotone" dataKey={k}
                        stroke={colours[i % colours.length]} strokeWidth={2} dot={false} />;
                    })}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="HTTP Cavab Müddəti P95 (san)" loading={chartsLoading} empty={!charts.p95?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.p95} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gP95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.purple} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis unit="s" tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip unit="s" />} />
                  <Area type="monotone" dataKey="P95" stroke={C.purple} fill="url(#gP95)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="HTTP Xəta Dərəcəsi (4xx+5xx %)" loading={chartsLoading} empty={!charts.errRate?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.errRate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.red} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis domain={[0,100]} unit="%" tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Area type="monotone" dataKey="Xəta %" stroke={C.red} fill="url(#gErr)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="JVM Heap Yaddaşı" loading={chartsLoading} empty={!charts.heap?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={charts.heap} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gHeap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.sky} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip fmtVal={fmtBytes} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="İstifadə" stroke={C.sky}  fill="url(#gHeap)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Maksimum" stroke={C.red}  strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ══ APP CHARTS ════════════════════════════════════════════════════ */}
          <Section icon={Clapperboard}>Tətbiq Zaman Sırası</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="Video Yüklənmə Sürəti (dəq)" loading={chartsLoading} empty={!charts.uploadRate?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.uploadRate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Yüklənmə/dəq" fill={C.orange} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Baxış Sürəti (dəqiqə)" loading={chartsLoading} empty={!charts.viewRate?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.viewRate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Baxış/dəq" fill={C.purple} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Video Disk İstifadəsi" loading={chartsLoading} empty={!charts.disk?.length} span2>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.disk} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gUploads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.orange} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={C.orange} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gHls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.teal} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={C.teal} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gThumb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.sky} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="ts" tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} />
                  <Tooltip content={<ChartTooltip fmtVal={fmtBytes} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="uploads"    stroke={C.orange} fill="url(#gUploads)" strokeWidth={2} dot={false} stackId="s" />
                  <Area type="monotone" dataKey="hls"        stroke={C.teal}   fill="url(#gHls)"     strokeWidth={2} dot={false} stackId="s" />
                  <Area type="monotone" dataKey="thumbnails" stroke={C.sky}    fill="url(#gThumb)"   strokeWidth={2} dot={false} stackId="s" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            Prometheus hər 15 san Spring Boot /actuator/prometheus və node_exporter-i sorğulayır.
            Tətbiq metrikleri (yüklənmə, baxış) ilk fəaliyyətdən sonra doldurulur.
          </p>

        </div>
      </div>
    </>
  );
}

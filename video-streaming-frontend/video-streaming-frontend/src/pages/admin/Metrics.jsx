import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, RefreshCw, ExternalLink,
  Cpu, MemoryStick, HardDrive, Globe,
  Upload, Clapperboard, Eye, Database,
  TrendingUp, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import Navbar from '../../components/Navbar';
import api from '../../services/api';

// ── Prometheus proxy helpers ──────────────────────────────────────────────────

const instant = (query) =>
  api.get('/admin/metrics/instant', { params: { query } })
     .then(r => r.data);

const range = (query, start, end, step) =>
  api.get('/admin/metrics/range', { params: { query, start, end, step } })
     .then(r => r.data);

// Safely extract the first scalar value from a Prometheus instant result
function scalar(data, fallback = null) {
  try {
    const v = parseFloat(data.data.result[0].value[1]);
    return isNaN(v) ? fallback : v;
  } catch { return fallback; }
}

// Convert a Prometheus matrix result to recharts [{time, ...series}]
function toSeries(data, labelFn = () => 'value') {
  try {
    const results = data.data.result;
    if (!results || results.length === 0) return [];
    // Merge all series on timestamp
    const map = new Map();
    results.forEach(r => {
      const seriesName = labelFn(r.metric);
      r.values.forEach(([ts, val]) => {
        const t = ts * 1000;
        if (!map.has(t)) map.set(t, { ts: t });
        map.get(t)[seriesName] = parseFloat(val);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
  } catch { return []; }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtBytes(b) {
  if (b == null) return '—';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}
function fmtNum(n, dec = 1) {
  if (n == null) return '—';
  return n.toFixed(dec);
}

// ── Time range config ─────────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: '30m', seconds: 1800,  step: 30  },
  { label: '1h',  seconds: 3600,  step: 60  },
  { label: '6h',  seconds: 21600, step: 360 },
  { label: '24h', seconds: 86400, step: 1440},
];

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  orange:  '#f97316',
  blue:    '#3b82f6',
  green:   '#22c55e',
  red:     '#ef4444',
  purple:  '#a855f7',
  sky:     '#0ea5e9',
  amber:   '#f59e0b',
  teal:    '#14b8a6',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{fmtTime(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{unit}
        </p>
      ))}
    </div>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, value, unit = '', color, sub, loading }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
           style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        {loading ? (
          <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-1"/>
        ) : (
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {value != null ? `${fmtNum(value, value < 10 ? 2 : 0)}${unit}` : '—'}
          </p>
        )}
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────
function ChartCard({ title, children, loading, empty }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      </div>
      <div className="p-4" style={{ height: 220 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-gray-300 dark:text-gray-600 animate-spin" />
          </div>
        ) : empty ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No data yet</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
const Section = ({ children }) => (
  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-6 mb-3">{children}</p>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

export default function Metrics() {
  const navigate = useNavigate();
  const [range_,  setRange]   = useState(TIME_RANGES[1]); // 1h default
  const [stats,   setStats]   = useState({});
  const [charts,  setCharts]  = useState({});
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const timerRef = useRef(null);

  // Grafana URL — fetched from admin settings; falls back to same-host:3000
  const [grafanaBase, setGrafanaBase] = useState('');
  useEffect(() => {
    fetch('/api/config/grafana')
      .then(r => r.json())
      .then(cfg => setGrafanaBase(cfg.grafanaUrl || ''))
      .catch(() => {});
  }, []);
  const GRAFANA_BASE = grafanaBase || `${window.location.protocol}//${window.location.hostname}:3000`;

  // ── Fetch instant stats ───────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [cpu, mem, disk, http_, uploads, transcodings, views, storage] =
        await Promise.all([
          instant('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
          instant('(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100'),
          instant('max((1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|devtmpfs|squashfs"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay|devtmpfs|squashfs"}) * 100)'),
          instant('sum(rate(http_server_requests_seconds_count[5m]))'),
          instant('modtube_uploads_success_total'),
          instant('modtube_active_transcodings'),
          instant('modtube_video_views_total'),
          instant('sum(modtube_disk_usage_bytes)'),
        ]);
      setStats({
        cpu:           scalar(cpu),
        mem:           scalar(mem),
        disk:          scalar(disk),
        http:          scalar(http_),
        uploads:       scalar(uploads),
        transcodings:  scalar(transcodings),
        views:         scalar(views),
        storage:       scalar(storage),
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError('Cannot reach Prometheus. Is the container running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch chart data ──────────────────────────────────────────────────────
  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const now   = Math.floor(Date.now() / 1000);
      const start = now - range_.seconds;
      const step  = range_.step;
      const S     = String(start), E = String(now), T = String(step);

      const [cpuTs, memTs, httpTs, p95Ts, heapUsed, heapMax,
             uploadRate, viewRate, diskTs, transTs] =
        await Promise.all([
          range('100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)', S, E, T),
          range('node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes', S, E, T),
          range('sum by(status)(rate(http_server_requests_seconds_count[5m]))', S, E, T),
          range('histogram_quantile(0.95, sum by(le)(rate(http_server_requests_seconds_bucket[5m])))', S, E, T),
          range('sum(jvm_memory_used_bytes{area="heap"})', S, E, T),
          range('sum(jvm_memory_max_bytes{area="heap"})', S, E, T),
          range('rate(modtube_uploads_success_total[10m]) * 60', S, E, T),
          range('rate(modtube_video_views_total[5m]) * 60', S, E, T),
          range('modtube_disk_usage_bytes', S, E, T),
          range('modtube_active_transcodings', S, E, T),
        ]);

      // merge heapUsed + heapMax into one series
      const heapData = (() => {
        const u = toSeries(heapUsed, () => 'used');
        const m = toSeries(heapMax, () => 'max');
        const mMap = new Map(m.map(d => [d.ts, d.max]));
        return u.map(d => ({ ...d, max: mMap.get(d.ts) ?? null }));
      })();

      setCharts({
        cpu:        toSeries(cpuTs,        () => 'CPU %'),
        mem:        toSeries(memTs,        () => 'Used'),
        http:       toSeries(httpTs,       m => `HTTP ${m.status || 'all'}`),
        p95:        toSeries(p95Ts,        () => 'p95'),
        heap:       heapData,
        uploadRate: toSeries(uploadRate,   () => 'Uploads/min'),
        viewRate:   toSeries(viewRate,     () => 'Views/min'),
        disk:       toSeries(diskTs,       m => m.type || 'bytes'),
        transcodings: toSeries(transTs,   () => 'Active'),
      });
    } catch {/* charts fail gracefully */}
    finally { setChartsLoading(false); }
  }, [range_]);

  // ── Auto-refresh ──────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    fetchStats();
    fetchCharts();
  }, [fetchStats, fetchCharts]);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 30_000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  // ─────────────────────────────────────────────────────────────────────────

  const cpuColor  = stats.cpu  > 85 ? C.red : stats.cpu  > 70 ? C.amber : C.green;
  const memColor  = stats.mem  > 85 ? C.red : stats.mem  > 70 ? C.amber : C.blue;
  const diskColor = stats.disk > 85 ? C.red : stats.disk > 70 ? C.amber : C.teal;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Metrics</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Live Prometheus data — auto-refreshes every 30 s
                {lastRefresh && <> · last updated {lastRefresh.toLocaleTimeString()}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Time range */}
              <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {TIME_RANGES.map(r => (
                  <button key={r.label} onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      range_.label === r.label
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={refresh}
                className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              <a href={`${GRAFANA_BASE}/d/modtube-main`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <ExternalLink className="w-4 h-4" /> Grafana
              </a>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div className="mb-4 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                  Prometheus runs inside the container on port 9090. Run{' '}
                  <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded font-mono">
                    docker exec modtube supervisorctl status
                  </code>{' '}
                  on the VPS to check its status, or{' '}
                  <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded font-mono">
                    docker exec modtube tail -30 /var/log/supervisor/prometheus.log
                  </code>{' '}
                  to read its logs.
                </p>
              </div>
              <button
                onClick={refresh}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* ══ SYSTEM STATS ══════════════════════════════════════════════════ */}
          <Section>System</Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Cpu}        title="CPU Usage"     value={stats.cpu}    unit="%" color={cpuColor}  loading={loading} sub="5-min avg" />
            <StatCard icon={MemoryStick} title="Memory Used"  value={stats.mem}    unit="%" color={memColor}  loading={loading} sub="of total RAM" />
            <StatCard icon={HardDrive}   title="Disk Used"    value={stats.disk}   unit="%" color={diskColor} loading={loading} sub="largest partition" />
            <StatCard icon={Globe}       title="HTTP Req/s"   value={stats.http}   unit="" color={C.sky}     loading={loading} sub="5-min rate" />
          </div>

          {/* ══ APP STATS ═════════════════════════════════════════════════════ */}
          <Section>Application</Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Upload}       title="Total Uploads"      value={stats.uploads}       unit="" color={C.orange} loading={loading} />
            <StatCard icon={Clapperboard} title="Active Transcodings" value={stats.transcodings} unit="" color={stats.transcodings > 0 ? C.amber : C.green} loading={loading} />
            <StatCard icon={Eye}          title="Total Views"         value={stats.views}         unit="" color={C.purple} loading={loading} />
            <StatCard icon={Database}     title="Video Storage"       value={stats.storage != null ? stats.storage / 1e9 : null} unit=" GB" color={C.teal} loading={loading} sub={fmtBytes(stats.storage)} />
          </div>

          {/* ══ SYSTEM CHARTS ═════════════════════════════════════════════════ */}
          <Section>System over time</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="CPU Usage %" loading={chartsLoading} empty={!charts.cpu?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.cpu} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.orange} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.orange} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis domain={[0,100]} unit="%" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                  <Area type="monotone" dataKey="CPU %" stroke={C.orange} fill="url(#gCpu)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Memory Usage" loading={chartsLoading} empty={!charts.mem?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.mem} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip />} formatter={v => fmtBytes(v)} />
                  <Area type="monotone" dataKey="Used" stroke={C.blue} fill="url(#gMem)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ══ HTTP / JVM CHARTS ═════════════════════════════════════════════ */}
          <Section>HTTP &amp; JVM</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="HTTP Requests / s  (by status)" loading={chartsLoading} empty={!charts.http?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.http} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {charts.http?.length > 0 &&
                    Object.keys(charts.http[0])
                      .filter(k => k !== 'ts')
                      .map((k, i) => {
                        const colours = [C.green, C.red, C.amber, C.blue, C.purple];
                        return <Line key={k} type="monotone" dataKey={k}
                          stroke={colours[i % colours.length]} strokeWidth={2} dot={false} />;
                      })}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="HTTP Response Time" loading={chartsLoading} empty={!charts.p95?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.p95} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gP95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.purple} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis unit="s" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip unit="s" />} />
                  <Area type="monotone" dataKey="p95" stroke={C.purple} fill="url(#gP95)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="JVM Heap Memory" loading={chartsLoading} empty={!charts.heap?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.heap} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gHeap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.sky} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip formatter={v => fmtBytes(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="used" stroke={C.sky}  fill="url(#gHeap)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="max"  stroke={C.red}  strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Active Transcodings" loading={chartsLoading} empty={!charts.transcodings?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.transcodings} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTrans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.amber} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="stepAfter" dataKey="Active" stroke={C.amber} fill="url(#gTrans)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ══ APP CHARTS ════════════════════════════════════════════════════ */}
          <Section>Application over time</Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <ChartCard title="Upload Rate  (uploads / min)" loading={chartsLoading} empty={!charts.uploadRate?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.uploadRate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Uploads/min" fill={C.orange} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Video Views / min" loading={chartsLoading} empty={!charts.viewRate?.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.viewRate} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Views/min" fill={C.purple} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Video Storage Breakdown" loading={chartsLoading} empty={!charts.disk?.length}
              className="lg:col-span-2">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tickFormatter={v => fmtBytes(v)} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <Tooltip formatter={v => fmtBytes(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="uploads"    stroke={C.orange} fill="url(#gUploads)" strokeWidth={2} dot={false} stackId="s" />
                  <Area type="monotone" dataKey="hls"        stroke={C.teal}   fill="url(#gHls)"     strokeWidth={2} dot={false} stackId="s" />
                  <Area type="monotone" dataKey="thumbnails" stroke={C.sky}    fill="url(#gThumb)"   strokeWidth={2} dot={false} stackId="s" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            Data from Prometheus scraping Spring Boot /actuator/prometheus and node_exporter every 15 s.
            App metrics (uploads, views) populate after first activity.
          </p>

        </div>
      </div>
    </>
  );
}

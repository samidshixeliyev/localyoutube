import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Eye, Users, Video, TrendingUp, Clock,
  RefreshCw, BarChart2, Calendar, UserCheck,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Navbar from '../../components/Navbar';
import {
  adminAnalyticsSummary, adminTopVideos, adminTopUsers,
  adminDailyViews, adminHourlyViews,
} from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const C = {
  red: '#e02020', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', purple: '#a855f7', teal: '#14b8a6',
};

const DAY_OPTIONS = [7, 30, 90];

function SummaryCard({ icon: Icon, title, value, color, loading }) {
  return (
    <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {loading
          ? <div className="h-6 w-20 bg-gray-100 dark:bg-army-700 rounded animate-pulse mt-1" />
          : <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value != null ? value.toLocaleString() : '—'}
            </p>}
      </div>
    </div>
  );
}

function TableCard({ title, icon: Icon, children, loading }) {
  return (
    <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-army-700">
        {Icon && <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      </div>
      {loading
        ? <div className="p-6 flex justify-center">
            <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        : children}
    </div>
  );
}

const fmtTime = ts => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function Analytics() {
  const navigate  = useNavigate();
  const { dark }  = useTheme();
  const gridColor = dark ? '#374151' : '#e5e7eb';
  const tickColor = dark ? '#9ca3af' : '#6b7280';
  const axisColor = dark ? '#4b5563' : '#d1d5db';

  const [days, setDays]           = useState(30);
  const [summary, setSummary]     = useState(null);
  const [topVideos, setTopVideos] = useState([]);
  const [topUsers, setTopUsers]   = useState([]);
  const [daily, setDaily]         = useState([]);
  const [hourly, setHourly]       = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const [sumRes, vidRes, usrRes, dayRes, hrRes] = await Promise.allSettled([
        adminAnalyticsSummary(d),
        adminTopVideos(d, 20),
        adminTopUsers(d, 20),
        adminDailyViews(d),
        adminHourlyViews(d),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (vidRes.status === 'fulfilled') setTopVideos(vidRes.value.data);
      if (usrRes.status === 'fulfilled') setTopUsers(usrRes.value.data);
      if (dayRes.status === 'fulfilled') {
        setDaily(dayRes.value.data.map(r => ({
          day: r.day,
          'Baxış': r.viewCount,
        })));
      }
      if (hrRes.status === 'fulfilled') {
        const map = {};
        hrRes.value.data.forEach(r => { map[r.hour] = r.viewCount; });
        setHourly(Array.from({ length: 24 }, (_, h) => ({
          hour: `${String(h).padStart(2, '0')}:00`,
          'Baxış': map[h] ?? 0,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-army-700 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Baxış Analitikası</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kim nəyə baxır, ən populyar videolar</p>
            </div>
            {/* Day selector */}
            <div className="flex bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-lg overflow-hidden">
              {DAY_OPTIONS.map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    days === d
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-army-700'
                  }`}>
                  {d}g
                </button>
              ))}
            </div>
            <button onClick={() => load(days)}
              className="p-2 bg-white dark:bg-army-800 border border-gray-200 dark:border-army-700 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-army-700 transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-500' : ''}`} />
            </button>
          </div>

          {/* Summary cards - views */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
            <SummaryCard icon={Eye}        title="Son 24 saat baxış"   value={summary?.views24h}      color={C.red}    loading={loading} />
            <SummaryCard icon={Calendar}   title="Son 7 gün baxış"     value={summary?.views7d}       color={C.amber}  loading={loading} />
            <SummaryCard icon={TrendingUp} title="Son 30 gün baxış"    value={summary?.views30d}      color={C.blue}   loading={loading} />
          </div>
          {/* Summary cards - users */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <SummaryCard icon={UserCheck}  title="Aktiv istifadəçi (7g)"  value={summary?.activeUsers7d}  color={C.green}  loading={loading} />
            <SummaryCard icon={Users}      title="Aktiv istifadəçi (30g)" value={summary?.activeUsers30d} color={C.purple} loading={loading} />
            <SummaryCard icon={Video}      title="Baxılan video (30g)"    value={summary?.watchedVideos}   color={C.teal}   loading={loading} />
          </div>

          {/* Daily views chart */}
          <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Günlük Baxışlar</p>
            </div>
            <div className="p-4" style={{ height: 220 }}>
              {loading
                ? <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                  </div>
                : daily.length === 0
                ? <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
                    Məlumat yoxdur
                  </div>
                : <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.red} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor}
                             tickFormatter={v => v?.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Baxış" stroke={C.red} fill="url(#gDaily)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>}
            </div>
          </div>

          {/* Hourly distribution */}
          <div className="bg-white dark:bg-army-800 rounded-xl border border-gray-200 dark:border-army-700 shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saatlıq Bölgü (UTC)</p>
            </div>
            <div className="p-4" style={{ height: 200 }}>
              {loading
                ? <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-gray-300 animate-spin" />
                  </div>
                : <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourly} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: tickColor }} stroke={axisColor}
                             interval={2} />
                      <YAxis tick={{ fontSize: 10, fill: tickColor }} stroke={axisColor} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Baxış" fill={C.purple} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Videos */}
            <TableCard title="Ən Çox Baxılan Videolar" icon={Video} loading={loading}>
              {topVideos.length === 0
                ? <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-8">Baxış məlumatı yoxdur</p>
                : <div className="divide-y divide-gray-100 dark:divide-army-700">
                    {topVideos.map((v, i) => (
                      <div key={v.videoId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-army-700/50 transition-colors">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-50 dark:bg-army-700 text-gray-500'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <Link to={`/video/${v.videoId}`}
                            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 truncate block">
                            {v.title || v.videoId}
                          </Link>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {v.uploaderName || '—'} · {fmtTime(v.lastViewed)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            {v.viewCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </TableCard>

            {/* Top Users */}
            <TableCard title="Ən Aktiv İzləyicilər" icon={Users} loading={loading}>
              {topUsers.length === 0
                ? <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-8">Məlumat yoxdur</p>
                : <div className="divide-y divide-gray-100 dark:divide-army-700">
                    {topUsers.map((u, i) => (
                      <div key={u.userEmail} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-army-700/50 transition-colors">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0 ? 'bg-amber-100 text-amber-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-50 dark:bg-army-700 text-gray-500'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {u.userEmail}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {u.uniqueVideos} fərqli video · {fmtTime(u.lastViewed)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Eye className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                            {u.viewCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>}
            </TableCard>
          </div>

        </div>
      </div>
    </>
  );
}

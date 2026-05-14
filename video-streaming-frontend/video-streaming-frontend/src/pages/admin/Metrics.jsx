import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, ExternalLink, RefreshCw } from 'lucide-react';
import Navbar from '../../components/Navbar';

// Grafana is on port 3000 of the same host.
// We build the URL relative to the current host so it works on any server.
const GRAFANA_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;
const DASHBOARD_UID = 'localtube-main';

// System stat tiles (panel IDs match the dashboard JSON)
const SYS_PANELS = [
  { id: 2,  title: 'CPU'        },
  { id: 3,  title: 'Memory'     },
  { id: 4,  title: 'Disk'       },
  { id: 5,  title: 'HTTP Req/s' },
];

// App-specific stat tiles
const APP_PANELS = [
  { id: 40, title: 'Uploads'           },
  { id: 41, title: 'Transcodings'      },
  { id: 42, title: 'Total Views'       },
  { id: 43, title: 'Video Storage'     },
];

function panelUrl(panelId, from = 'now-1h', to = 'now') {
  return `${GRAFANA_BASE}/d-solo/${DASHBOARD_UID}?orgId=1&from=${from}&to=${to}&panelId=${panelId}&theme=light`;
}

const TIME_RANGES = [
  { label: '30m', from: 'now-30m' },
  { label: '1h',  from: 'now-1h'  },
  { label: '6h',  from: 'now-6h'  },
  { label: '24h', from: 'now-24h' },
];

export default function Metrics() {
  const navigate = useNavigate();
  const [range,  setRange]  = useState(TIME_RANGES[1]);
  const [reload, setReload] = useState(0);

  const refresh = () => setReload(r => r + 1);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Activity className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900">System Metrics</h1>
              </div>
              <p className="text-sm text-gray-500">Live Prometheus + Grafana — refreshes every 30 s</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
                {TIME_RANGES.map(r => (
                  <button key={r.label} onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      range.from === r.from
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <button onClick={refresh}
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              <a href={`${GRAFANA_BASE}/d/${DASHBOARD_UID}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all">
                <ExternalLink className="w-4 h-4" />
                Open Grafana
              </a>
            </div>
          </div>

          {/* System stat tiles */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">System</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {SYS_PANELS.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 px-3 pt-3 pb-1">{p.title}</p>
                <iframe
                  key={`${p.id}-${range.from}-${reload}`}
                  src={panelUrl(p.id, range.from)}
                  className="w-full h-24 border-0"
                  title={p.title}
                />
              </div>
            ))}
          </div>

          {/* App stat tiles */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Application</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {APP_PANELS.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <p className="text-xs font-semibold text-gray-500 px-3 pt-3 pb-1">{p.title}</p>
                <iframe
                  key={`${p.id}-${range.from}-${reload}`}
                  src={panelUrl(p.id, range.from)}
                  className="w-full h-24 border-0"
                  title={p.title}
                />
              </div>
            ))}
          </div>

          {/* Full dashboard embed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Full Dashboard</p>
              <span className="text-xs text-gray-400">Grafana · anonymous viewer</span>
            </div>
            <iframe
              key={`full-${range.from}-${reload}`}
              src={`${GRAFANA_BASE}/d/${DASHBOARD_UID}?orgId=1&from=${range.from}&to=now&theme=light&kiosk=tv`}
              className="w-full border-0"
              style={{ height: '80vh' }}
              title="LocalTube Dashboard"
            />
          </div>

          {/* Fallback hint */}
          <p className="text-xs text-gray-400 text-center mt-4">
            If panels show "No data" wait ~60 s for Prometheus to scrape the first metrics.
            Use "Open Grafana" if the iframe is blocked (login: <strong>admin / admin</strong>).
          </p>
        </div>
      </div>
    </>
  );
}

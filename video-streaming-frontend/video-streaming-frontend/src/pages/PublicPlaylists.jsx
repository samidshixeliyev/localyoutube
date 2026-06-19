import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Library, Play, ListVideo, Globe } from 'lucide-react';
import Navbar from '../components/Navbar';
import { getPublicPlaylists } from '../services/api';

/* Stacked-thumbnail playlist card (matches MyPlaylists styling). */
function PlaylistCard({ p }) {
  return (
    <Link to={`/playlists/${p.id}`} className="group block">
      <div className="relative">
        {/* stacked-depth effect */}
        <div className="absolute -top-1.5 left-1.5 right-1.5 h-full rounded-xl bg-gray-200 dark:bg-army-700/60" />
        <div className="absolute -top-0.5 left-0.5 right-0.5 h-full rounded-xl bg-gray-300 dark:bg-army-700" />
        <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-army-800">
          {p.coverUrl ? (
            <img src={p.coverUrl} alt={p.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ListVideo className="w-10 h-10 text-gray-400 dark:text-army-500" />
            </div>
          )}
          {/* count badge */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 text-white text-xs font-medium px-2 py-1 rounded-md">
            <ListVideo className="w-3.5 h-3.5" />{p.itemCount ?? 0}
          </div>
          {/* play-all overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="flex items-center gap-2 bg-white/90 text-gray-900 text-sm font-semibold px-3 py-1.5 rounded-full">
              <Play className="w-4 h-4 fill-current" /> Hamısını oynat
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{p.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate flex items-center gap-1">
          <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
          {p.ownerEmail || 'İstifadəçi'}
        </p>
      </div>
    </Link>
  );
}

export default function PublicPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicPlaylists();
        if (!cancelled) setPlaylists(res.data || []);
      } catch {
        if (!cancelled) setError('Pleylistlər yüklənmədi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Library className="w-7 h-7 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pleylistlər</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">İctimai pleylistlər — hər kəs üçün</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-20">
              <Library className="w-14 h-14 text-gray-300 dark:text-army-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Hələ ictimai pleylist yoxdur.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6">
              {playlists.map(p => <PlaylistCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { adminGetUsers } from '../services/api';

export default function UserEmailPicker({ emails, onChange, canSearch }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [open,  setOpen]  = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) { setUsers([]); setOpen(false); return; }
    try {
      const res = await adminGetUsers();
      const filtered = (res.data || []).filter(u =>
        u.email?.toLowerCase().includes(q.toLowerCase()) ||
        u.fullName?.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8);
      setUsers(filtered);
      setOpen(filtered.length > 0);
    } catch { setUsers([]); setOpen(false); }
  };

  const addEmail = (email) => {
    const e = email.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    onChange([...emails, e]);
    setQuery(''); setUsers([]); setOpen(false);
  };

  const addManual = () => {
    const e = query.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    addEmail(e);
  };

  return (
    <div className="space-y-2">
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map(e => (
            <span key={e} className="flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-1 rounded-full">
              {e}
              <button onClick={() => onChange(emails.filter(x => x !== e))} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={dropRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-army-600 bg-white dark:bg-army-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={canSearch ? 'İstifadəçi axtar…' : 'E-poçt daxil edin…'}
              value={query}
              onChange={e => { if (canSearch) search(e.target.value); else setQuery(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && addManual()}
            />
          </div>
          <button onClick={addManual} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-army-800 border border-gray-200 dark:border-army-600 rounded-xl shadow-lg overflow-hidden">
            {users.map(u => (
              <button key={u.email} type="button" onMouseDown={() => addEmail(u.email)}
                className="w-full text-left px-3 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-army-700 last:border-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName || u.name}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

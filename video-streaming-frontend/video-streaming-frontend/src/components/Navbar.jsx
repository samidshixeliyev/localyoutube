import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Search, Sun, Moon, X } from "lucide-react";
import UserDropdown from "./UserDropdown";
import ModTubeLogo from "./ModTubeLogo";
import api from "../services/api";

const Navbar = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { dark, toggle } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const sugTimer = useRef(null);
  const inputRef = useRef(null);

  /* ── search suggestions ───────────────────────────────────────────── */
  const fetchSuggestions = (q) => {
    clearTimeout(sugTimer.current);
    if (!q.trim() || q.trim().length < 2) { setSuggestions([]); setShowSug(false); return; }
    sugTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/videos/suggestions', { params: { query: q, size: 8 } });
        setSuggestions(res.data || []);
        setShowSug((res.data || []).length > 0);
      } catch { setSuggestions([]); }
    }, 250);
  };

  useEffect(() => () => clearTimeout(sugTimer.current), []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSug(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const pickSuggestion = (title) => {
    setSearchQuery(title);
    setShowSug(false);
    navigate(`/search?q=${encodeURIComponent(title)}`);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-army-800 border-b-2 border-primary-600/30 dark:border-primary-700/50 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">

          {/* ── Logo ─────────────────────────────────────────────────── */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <ModTubeLogo size={34} className="hidden sm:block" />
            <ModTubeLogo size={30} mini className="sm:hidden" />
          </Link>

          {/* ── Search ───────────────────────────────────────────────── */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); fetchSuggestions(e.target.value); }}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSug(true)}
                placeholder="Video axtar..."
                className="w-full pl-4 pr-10 py-2 border border-primary-300 dark:border-primary-700 rounded-full text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           bg-primary-50 dark:bg-army-700 hover:bg-white dark:hover:bg-army-600
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
              />
              {searchQuery && (
                <button type="button"
                  onClick={() => { setSearchQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="submit"
                className="absolute right-0 top-0 h-full px-3 text-primary-500 hover:text-primary-700 transition-colors">
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Suggestions dropdown */}
            {showSug && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-army-800
                              border border-primary-200 dark:border-army-600 rounded-xl shadow-lg z-50 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} type="button" onMouseDown={() => pickSuggestion(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200
                               hover:bg-primary-50 dark:hover:bg-army-700 flex items-center gap-2.5 transition-colors">
                    <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* ── Right side ───────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggle}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                         hover:bg-primary-50 dark:hover:bg-army-700 transition-colors"
              title={dark ? 'İşıqlı rejim' : 'Qaranlıq rejim'}>
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {isAuthenticated
              ? <UserDropdown />
              : <button onClick={() => navigate("/login")}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-full
                             hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-sm">
                  Daxil Ol
                </button>
            }
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

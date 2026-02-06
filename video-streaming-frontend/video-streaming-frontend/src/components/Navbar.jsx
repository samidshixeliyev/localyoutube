import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Upload, LogOut, Menu, X, LogIn } from 'lucide-react';

const Navbar = () => {
  const { logout, user, isAuthenticated, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo - FIXED: Removed nested <a> tags and changed class to className */}
          <Link to="/" className="inline-flex items-center gap-2 select-none group">
            <div className="flex items-center font-sans text-[2rem] font-black tracking-tight">
              <span className="text-slate-800 group-hover:text-slate-950 group-hover:drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                Mod
              </span>
              <span className="ml-1 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 px-3 py-1 text-slate-100 shadow-md ring-1 ring-black/10 group-hover:from-amber-500 group-hover:to-orange-600">
                Tube
              </span>
            </div>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </form>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Upload & My Videos - Only for admin-modtube */}
                {hasPermission('admin-modtube') && (
                  <>
                    <Link
                      to="/upload"
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Upload className="h-5 w-5" />
                      <span>Upload</span>
                    </Link>

                    <Link
                      to="/my-videos"
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      My Videos
                    </Link>
                  </>
                )}

                {/* User Info */}
                <div className="flex items-center space-x-3 px-4 py-2 bg-gray-100 rounded-lg">
                  <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{user?.username || user?.email || 'User'}</div>
                    {user?.role && (
                      <div className="text-gray-500 text-xs capitalize">{user.role.toLowerCase()}</div>
                    )}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              /* Login Button - For guests */
              <Link
                to="/login"
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <LogIn className="h-5 w-5" />
                <span>Login</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="md:hidden pb-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </form>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-2">
            {isAuthenticated ? (
              <>
                {/* Admin actions */}
                {hasPermission('admin-modtube') && (
                  <>
                    <Link
                      to="/upload"
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Upload className="h-5 w-5" />
                      <span>Upload Video</span>
                    </Link>
                    
                    <Link
                      to="/my-videos"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      My Videos
                    </Link>
                  </>
                )}
                
                {/* Logout */}
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              /* Login Button - For guests */
              <Link
                to="/login"
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn className="h-5 w-5" />
                <span>Login</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search } from 'lucide-react';
import UserDropdown from './UserDropdown';

const Navbar = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 text-gray-900 font-bold text-lg hover:opacity-80 transition-opacity">
                        <span className="text-2xl">🎬</span>
                        <span className="hidden sm:inline">ModTube</span>
                    </Link>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-4 sm:mx-8">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search videos..."
                                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-full text-sm
                                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                                    bg-gray-50 hover:bg-white transition-colors"
                            />
                            <button
                                type="submit"
                                className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </div>
                    </form>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {isAuthenticated ? (
                            <UserDropdown />
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-full
                                    hover:bg-primary-700 transition-colors"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
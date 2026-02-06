import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Video, Key, Users, Shield, Upload, ChevronDown } from 'lucide-react';

const UserDropdown = () => {
    const { user, logout, hasPermission } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const timeoutRef = useRef(null);
    const navigate = useNavigate();

    const isSuperAdmin = hasPermission('super-admin');
    const isAdmin = hasPermission('admin-modtube') || isSuperAdmin;

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getInitials = () => {
        if (!user) return '?';
        const name = user.fullName || user.name || user.email || '';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const handleLogout = () => {
        setIsOpen(false);
        logout();
    };

    return (
        <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-1.5 h-9 w-9 rounded-full text-white text-sm font-semibold
                    items-center justify-center transition-all
                    ${isSuperAdmin ? 'bg-red-600 ring-2 ring-yellow-400' : 'bg-primary-600 hover:bg-primary-700'}`}
                title={user?.fullName || user?.email || ''}
            >
                {getInitials()}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="font-semibold text-gray-900 text-sm">
                            {user?.fullName || user?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium
                            ${isSuperAdmin ? 'bg-red-100 text-red-700' : isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                            {isSuperAdmin ? '⭐ Super Admin' : isAdmin ? '🔧 Admin' : '👤 User'}
                        </span>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        {isAdmin && (
                            <>
                                <Link
                                    to="/my-videos"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Video className="h-4 w-4 text-gray-400" />
                                    My Videos
                                </Link>
                                <Link
                                    to="/upload"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Upload className="h-4 w-4 text-gray-400" />
                                    Upload Video
                                </Link>
                                <div className="border-t border-gray-100 my-1" />
                            </>
                        )}

                        <Link
                            to="/change-password"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Key className="h-4 w-4 text-gray-400" />
                            Change Password
                        </Link>

                        {isSuperAdmin && (
                            <>
                                <div className="border-t border-gray-100 my-1" />
                                <Link
                                    to="/admin/users"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Users className="h-4 w-4 text-gray-400" />
                                    Manage Users
                                </Link>
                                <Link
                                    to="/admin/roles"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    Manage Roles
                                </Link>
                            </>
                        )}

                        <div className="border-t border-gray-100 my-1" />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDropdown;
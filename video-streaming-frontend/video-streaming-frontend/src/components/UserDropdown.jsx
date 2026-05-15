import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import { LogOut, Video, Key, Users, Shield, Upload, Settings, BarChart2 } from 'lucide-react';

const UserDropdown = () => {
    const { user, logout, hasPermission } = useAuth();
    const { closeMiniPlayer } = useMiniPlayer();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const timeoutRef = useRef(null);
    const navigate = useNavigate();

    const isSuperAdmin    = hasPermission('super-admin');
    const isAdmin         = hasPermission('admin-modtube') || isSuperAdmin;
    const canViewMetrics  = isSuperAdmin || hasPermission('view-metrics');
    const canManageSettings = isSuperAdmin || hasPermission('manage-settings');

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
        closeMiniPlayer();
        logout();
        navigate('/login');
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
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-army-800 rounded-xl shadow-2xl border border-gray-100 dark:border-army-700 z-50 overflow-hidden">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-army-700 bg-gray-50 dark:bg-army-900">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                            {user?.fullName || user?.name || 'İstifadəçi'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
                        <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium
                            ${isSuperAdmin ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : isAdmin ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-gray-100 text-gray-600 dark:bg-army-700 dark:text-gray-400'}`}>
                            {isSuperAdmin ? '⭐ Super Admin' : isAdmin ? '🔧 Admin' : '👤 İstifadəçi'}
                        </span>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        {isAdmin && (
                            <>
                                <Link
                                    to="/my-videos"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                                >
                                    <Video className="h-4 w-4 text-gray-400" />
                                    Videolarım
                                </Link>
                                <Link
                                    to="/upload"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                                >
                                    <Upload className="h-4 w-4 text-gray-400" />
                                    Video Yüklə
                                </Link>
                                <div className="border-t border-gray-100 dark:border-army-700 my-1" />
                            </>
                        )}

                        <Link
                            to="/change-password"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                        >
                            <Key className="h-4 w-4 text-gray-400" />
                            Şifrəni Dəyiş
                        </Link>

                        {(canViewMetrics || canManageSettings || isSuperAdmin) && (
                            <div className="border-t border-gray-100 dark:border-army-700 my-1" />
                        )}

                        {canViewMetrics && (
                            <Link
                                to="/admin/metrics"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                            >
                                <BarChart2 className="h-4 w-4 text-gray-400" />
                                Metriklər
                            </Link>
                        )}

                        {canManageSettings && (
                            <Link
                                to="/admin/settings"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                            >
                                <Settings className="h-4 w-4 text-gray-400" />
                                Parametrlər
                            </Link>
                        )}

                        {isSuperAdmin && (
                            <>
                                <Link
                                    to="/admin/users"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                                >
                                    <Users className="h-4 w-4 text-gray-400" />
                                    İstifadəçilər
                                </Link>
                                <Link
                                    to="/admin/roles"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-army-700 transition-colors"
                                >
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    Rollar
                                </Link>
                            </>
                        )}

                        <div className="border-t border-gray-100 dark:border-army-700 my-1" />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            Çıxış
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDropdown;

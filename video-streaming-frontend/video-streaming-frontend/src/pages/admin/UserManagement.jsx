import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGetUsers, adminDeleteUser, adminResetPassword } from '../../services/api';
import { Plus, Edit2, Trash2, Key, ArrowLeft, Shield, Users as UsersIcon, Search, X } from 'lucide-react';
import Navbar from '../../components/Navbar';

const UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals
    const [resetModal, setResetModal] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [permissionModal, setPermissionModal] = useState(null);
    
    const [resetPassword, setResetPassword] = useState('');
    const [toast, setToast] = useState('');

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredUsers(users);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredUsers(users.filter(user => 
                user.email?.toLowerCase().includes(query) ||
                user.fullName?.toLowerCase().includes(query) ||
                user.name?.toLowerCase().includes(query) ||
                user.surname?.toLowerCase().includes(query) ||
                user.roleName?.toLowerCase().includes(query)
            ));
        }
    }, [searchQuery, users]);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await adminGetUsers();
            setUsers(res.data);
            setFilteredUsers(res.data);
            setError('');
        } catch (err) {
            setError('Failed to load users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        try {
            await adminDeleteUser(deleteModal.id);
            setUsers(users.filter(u => u.id !== deleteModal.id));
            setDeleteModal(null);
            showToast('✓ User deleted successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete user');
        }
    };

    const handleResetPassword = async () => {
        if (!resetPassword || resetPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        try {
            await adminResetPassword(resetModal.id, resetPassword);
            setResetModal(null);
            setResetPassword('');
            showToast('✓ Password reset successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reset password');
        }
    };

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const getRoleBadge = (roleName, permissions = []) => {
        if (permissions.includes('super-admin')) {
            return { bg: 'bg-gradient-to-r from-red-500 to-pink-600', text: 'text-white', border: 'border-red-300', icon: '⭐' };
        }
        if (permissions.includes('admin-modtube') || roleName === 'ADMIN') {
            return { bg: 'bg-gradient-to-r from-blue-500 to-indigo-600', text: 'text-white', border: 'border-blue-300', icon: '🔧' };
        }
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', icon: '👤' };
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading users...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all shadow-sm hover:shadow"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to Home</span>
                            </button>
                            <button
                                onClick={() => navigate('/admin/roles')}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all shadow-sm hover:shadow"
                            >
                                <Shield className="h-4 w-4" />
                                <span>Manage Roles</span>
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                                    <UsersIcon className="h-10 w-10 text-primary-600" />
                                    User Management
                                </h1>
                                <p className="text-gray-600 mt-2">Manage system users and permissions</p>
                            </div>
                            <button
                                onClick={() => navigate('/admin/users/new')}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-orange-600 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                <Plus className="h-5 w-5" />
                                Create User
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name, email, or role..."
                                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow">
                            <p className="text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Total Users</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <UsersIcon className="h-8 w-8 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Super Admins</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {users.filter(u => u.permissions?.includes('super-admin')).length}
                                    </p>
                                </div>
                                <div className="bg-red-100 p-3 rounded-lg">
                                    <Shield className="h-8 w-8 text-red-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Admins</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {users.filter(u => u.permissions?.includes('admin-modtube')).length}
                                    </p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg">
                                    <Key className="h-8 w-8 text-green-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Permissions</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                <UsersIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                <p className="text-gray-500 font-medium">
                                                    {searchQuery ? 'No users found matching your search' : 'No users found'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user, index) => {
                                            const badge = getRoleBadge(user.roleName, user.permissions);
                                            return (
                                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 bg-gradient-to-br from-primary-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                                                                {(user.fullName || user.name || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-900">
                                                                    {user.fullName || `${user.name} ${user.surname || ''}`.trim()}
                                                                </p>
                                                                <p className="text-xs text-gray-500">ID: {user.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-700">{user.email}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm ${badge.bg} ${badge.text}`}>
                                                            <span>{badge.icon}</span>
                                                            <span>{user.roleName}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.permissions && user.permissions.length > 0 ? (
                                                            <button
                                                                onClick={() => setPermissionModal(user)}
                                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                                            >
                                                                View {user.permissions.length} permission{user.permissions.length !== 1 ? 's' : ''}
                                                            </button>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">No permissions</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all transform hover:scale-110"
                                                                title="Edit User"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setResetModal(user); setResetPassword(''); }}
                                                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all transform hover:scale-110"
                                                                title="Reset Password"
                                                            >
                                                                <Key className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteModal(user)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all transform hover:scale-110"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {deleteModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                    <Trash2 className="h-8 w-8 text-red-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete User</h3>
                                <p className="text-gray-600">
                                    Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteModal.fullName || deleteModal.email}</span>?
                                </p>
                                <p className="text-red-600 text-sm mt-2 font-medium">This action cannot be undone!</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteModal(null)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-lg"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reset Password Modal */}
                {resetModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                                    <Key className="h-8 w-8 text-yellow-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h3>
                                <p className="text-gray-600">
                                    For: <span className="font-semibold text-gray-900">{resetModal.fullName || resetModal.email}</span>
                                </p>
                            </div>
                            <input
                                type="password"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                placeholder="New password (min 6 characters)"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setResetModal(null)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors shadow-lg"
                                >
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Permission Details Modal */}
                {permissionModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-gray-900">User Permissions</h3>
                                <button
                                    onClick={() => setPermissionModal(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-1">User:</p>
                                <p className="text-lg font-semibold text-gray-900">{permissionModal.fullName || permissionModal.email}</p>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-3">Permissions:</p>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {permissionModal.permissions && permissionModal.permissions.length > 0 ? (
                                        permissionModal.permissions.map((perm, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                                                <span className="font-medium text-gray-900">{perm}</span>
                                                <Shield className="h-5 w-5 text-blue-600" />
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">No permissions assigned</p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setPermissionModal(null)}
                                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {/* Toast Notification */}
                {toast && (
                    <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-slide-up flex items-center gap-3">
                        <div className="bg-green-500 rounded-full p-1">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="font-medium">{toast}</span>
                    </div>
                )}
            </div>
        </>
    );
};

export default UserManagement;
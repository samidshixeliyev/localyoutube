import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGetUsers, adminDeleteUser, adminResetPassword, adminGetRoles } from '../../services/api';
import { Plus, Edit2, Trash2, Key } from 'lucide-react';

const UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [resetModal, setResetModal] = useState(null);
    const [resetPassword, setResetPassword] = useState('');
    const [toast, setToast] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await adminGetUsers();
            setUsers(res.data);
        } catch (err) {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (user) => {
        if (!confirm(`Delete user "${user.fullName || user.email}"? This cannot be undone.`)) return;
        try {
            await adminDeleteUser(user.id);
            setUsers(users.filter(u => u.id !== user.id));
            showToast('User deleted');
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
            showToast('Password reset successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reset password');
        }
    };

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const getRoleBadge = (roleName) => {
        const map = {
            SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
            ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
        };
        return map[roleName] || 'bg-gray-100 text-gray-600 border-gray-200';
    };

    if (loading) return <div className="text-center py-16 text-gray-500">Loading users...</div>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">👥 User Management</h1>
                <button
                    onClick={() => navigate('/admin/users/new')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium
                        hover:bg-primary-700 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Create User
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {['Name', 'Email', 'Role', 'Permissions', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {user.fullName || `${user.name} ${user.surname || ''}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getRoleBadge(user.roleName)}`}>
                                        {user.roleName}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                    {(user.permissions || []).join(', ') || '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <button onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => { setResetModal(user); setResetPassword(''); }}
                                            className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors" title="Reset Password">
                                            <Key className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(user)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <div className="text-center py-12 text-gray-400">No users found</div>}
            </div>

            {/* Reset Password Modal */}
            {resetModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
                        <h3 className="text-lg font-semibold mb-2">Reset Password</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            For: <span className="font-medium text-gray-700">{resetModal.fullName || resetModal.email}</span>
                        </p>
                        <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="New password (min 6 chars)"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-4
                                focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setResetModal(null)}
                                className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                            <button onClick={handleResetPassword}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm z-50 animate-fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
};

export default UserManagement;
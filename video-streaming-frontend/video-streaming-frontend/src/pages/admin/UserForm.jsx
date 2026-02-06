import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminGetUser, adminCreateUser, adminUpdateUser, adminGetRoles } from '../../services/api';

const UserForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;

    const [form, setForm] = useState({ name: '', surname: '', email: '', password: '', roleId: '' });
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadRoles();
        if (isEdit) loadUser();
    }, [id]);

    const loadRoles = async () => {
        try {
            const res = await adminGetRoles();
            setRoles(res.data);
        } catch (err) { console.error('Failed to load roles', err); }
    };

    const loadUser = async () => {
        try {
            const res = await adminGetUser(id);
            const u = res.data;
            setForm({ name: u.name || '', surname: u.surname || '', email: u.email || '', password: '', roleId: u.roleId || '' });
        } catch (err) { setError('Failed to load user'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isEdit) {
                await adminUpdateUser(id, {
                    name: form.name, surname: form.surname,
                    email: form.email, roleId: form.roleId ? Number(form.roleId) : null,
                });
            } else {
                if (!form.password || form.password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setLoading(false);
                    return;
                }
                await adminCreateUser({ ...form, roleId: Number(form.roleId) });
            }
            navigate('/admin/users');
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} user`);
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-lg mx-auto mt-10 px-4">
            <div className="bg-white rounded-xl shadow-md p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {isEdit ? 'Edit User' : 'Create New User'}
                </h2>

                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                            <input type="text" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>

                    {!isEdit && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required minLength={6} placeholder="Min 6 characters"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                        <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">Select role...</option>
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.name} — {(role.permissions || []).join(', ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => navigate('/admin/users')}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="flex-1 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium
                                hover:bg-primary-700 disabled:opacity-50 transition-colors">
                            {loading ? 'Saving...' : (isEdit ? 'Update User' : 'Create User')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;
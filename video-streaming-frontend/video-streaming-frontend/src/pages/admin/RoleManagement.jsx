import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGetRoles } from '../../services/api';
import { ArrowLeft } from 'lucide-react';

const RoleManagement = () => {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminGetRoles()
            .then(res => setRoles(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-center py-16 text-gray-500">Loading roles...</div>;

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">🛡️ Roles & Permissions</h1>
                <button onClick={() => navigate('/admin/users')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Users
                </button>
            </div>

            <div className="space-y-4">
                {roles.map(role => (
                    <div key={role.id} className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                            <span className="text-xs text-gray-400">ID: {role.id}</span>
                        </div>
                        {role.description && (
                            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {(role.permissions || []).map(perm => (
                                <span key={perm}
                                    className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md border
                                        ${perm === 'super-admin' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    {perm}
                                </span>
                            ))}
                            {(!role.permissions || role.permissions.length === 0) && (
                                <span className="text-sm text-gray-400">No permissions</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoleManagement;
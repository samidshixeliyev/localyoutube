import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/api';
import { Lock } from 'lucide-react';

const ChangePassword = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (form.newPassword !== form.confirmPassword) {
            setError('Yeni şifrələr uyğun gəlmir');
            return;
        }
        if (form.newPassword.length < 6) {
            setError('Yeni şifrə ən az 6 simvol olmalıdır');
            return;
        }

        setLoading(true);
        try {
            await changePassword(form.currentPassword, form.newPassword);
            setSuccess('Şifrə uğurla dəyişdirildi!');
            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Şifrə dəyişdirilə bilmədi');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-xl text-sm " +
        "bg-white dark:bg-army-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 " +
        "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all";

    return (
        <div className="min-h-screen bg-primary-50 dark:bg-army-900 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bg-white dark:bg-army-800 rounded-2xl shadow-xl dark:border dark:border-army-700 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-8 py-5 flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                        <Lock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold tracking-widest uppercase text-primary-200">Hesab</p>
                        <h2 className="text-lg font-black text-white">Şifrəni Dəyiş</h2>
                    </div>
                </div>

                <div className="px-8 py-7">
                    {error && (
                        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">{error}</div>
                    )}
                    {success && (
                        <div className="mb-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-xl border border-green-200 dark:border-green-800">{success}</div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Cari şifrə</label>
                            <input
                                type="password"
                                value={form.currentPassword}
                                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                                required placeholder="••••••••"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Yeni şifrə</label>
                            <input
                                type="password"
                                value={form.newPassword}
                                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                required minLength={6} placeholder="••••••••"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Yeni şifrəni təsdiqlə</label>
                            <input
                                type="password"
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                required placeholder="••••••••"
                                className={inputClass}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => navigate(-1)}
                                className="px-5 py-2.5 bg-gray-100 dark:bg-army-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-army-600 transition-colors">
                                İmtina et
                            </button>
                            <button type="submit" disabled={loading}
                                className="flex-1 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
                                {loading ? 'Dəyişdirilir…' : 'Şifrəni Dəyiş'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;

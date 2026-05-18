import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, RefreshCw, ArrowLeft, Shield, CheckCircle, AlertCircle, ToggleLeft, ToggleRight, Upload } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { adminGetSettings, adminUpdateSettings } from '../../services/api';

const CONN_FIELDS = [
  {
    key: 'idp.base-url',
    label: 'IDP Base URL',
    placeholder: 'https://auth.example.com',
    description: 'OAuth2 authorization server root URL. No trailing slash.',
    type: 'url',
  },
  {
    key: 'idp.client-id',
    label: 'Client ID',
    placeholder: 'your-client-id',
    description: 'Public OAuth2 client ID registered in the IDP.',
    type: 'text',
  },
  {
    key: 'idp.redirect-uri',
    label: 'Redirect URI',
    placeholder: 'http://your-app:4000/',
    description: 'Must be registered in the IDP. Users are sent here after login.',
    type: 'url',
  },
  {
    key: 'idp.logout-redirect-uri',
    label: 'Logout Redirect URI',
    placeholder: 'http://your-app:4000/logged_out',
    description: 'Must be registered in the IDP. Users are sent here after logout.',
    type: 'url',
  },
  {
    key: 'idp.jwks-uri',
    label: 'JWKS URI',
    placeholder: 'https://auth.example.com/jwks',
    description: 'Endpoint exposing the public keys used to verify JWT signatures. Requires restart to apply.',
    type: 'url',
  },
  {
    key: 'idp.issuer',
    label: 'JWT Issuer',
    placeholder: 'https://auth.example.com',
    description: 'Expected "iss" claim in the ID token. Must match exactly.',
    type: 'text',
  },
];

const CLAIM_FIELDS = [
  {
    key: 'idp.claim.email',
    label: 'Email claim',
    placeholder: 'mail',
    description: 'JWT/LDAP claim that holds the user\'s email address.',
  },
  {
    key: 'idp.claim.fullname',
    label: 'Full name claim',
    placeholder: 'cn',
    description: 'Claim for full display name (e.g. "Daniel Hernandez"). Preferred over first+last.',
  },
  {
    key: 'idp.claim.first',
    label: 'First name claim',
    placeholder: 'givenName',
    description: 'Claim for given / first name. Combined with last name if full-name claim is absent.',
  },
  {
    key: 'idp.claim.last',
    label: 'Last name claim',
    placeholder: 'sn',
    description: 'Claim for surname / family name.',
  },
  {
    key: 'idp.claim.username',
    label: 'Username claim',
    placeholder: 'uid',
    description: 'Claim for login username (used as display-name fallback when name claims are missing).',
  },
];

const IdpSettings = () => {
  const navigate = useNavigate();
  const [values, setValues]     = useState({});
  const [original, setOriginal] = useState({});
  const [idpEnabled, setIdpEnabled] = useState(true);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null); // { type: 'success'|'error', msg }

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await adminGetSettings();
      const raw = res.data;
      const parsed = {};
      Object.entries(raw).forEach(([k, v]) => {
        parsed[k] = typeof v === 'object' ? v.value : v;
      });
      setValues(parsed);
      setOriginal(parsed);
      setIdpEnabled(parsed['idp.enabled'] !== 'false');
    } catch (err) {
      showToast('error', 'Parametrlər yüklənmədi');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...values, 'idp.enabled': idpEnabled ? 'true' : 'false' };
      await adminUpdateSettings(payload);
      setOriginal(payload);
      showToast('success', 'Parametrlər uğurla saxlanıldı');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Parametrlər saxlanmadı');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues(original);
    setIdpEnabled(original['idp.enabled'] !== 'false');
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const isDirty = JSON.stringify({ ...values, 'idp.enabled': idpEnabled ? 'true' : 'false' })
               !== JSON.stringify(original);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-primary-50 dark:bg-army-900 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Parametrlər yüklənir…</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-primary-50 dark:bg-army-900 transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/admin/users')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-army-700 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">OAuth2 / IDP Parametrləri</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Xarici identifikasiya provayderini konfiqurasiya edin. Dəyişikliklər dərhal qüvvəyə minir — yenidən qurma tələb olunmur.
              </p>
            </div>
          </div>

          {/* IDP Enabled toggle */}
          <div className="bg-white dark:bg-army-800 rounded-xl shadow-sm border border-gray-200 dark:border-army-700 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SSO Girişini Aktivləşdir</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Giriş səhifəsində "AO ID" düyməsini göstər.
                </p>
              </div>
              <button
                onClick={() => setIdpEnabled(v => !v)}
                className="flex-shrink-0 ml-4 focus:outline-none"
              >
                {idpEnabled
                  ? <ToggleRight className="w-10 h-10 text-primary-600" />
                  : <ToggleLeft  className="w-10 h-10 text-gray-400" />
                }
              </button>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="bg-white dark:bg-army-800 rounded-xl shadow-sm border border-gray-200 dark:border-army-700 divide-y divide-gray-100 dark:divide-army-700">
            <div className="px-6 py-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bağlantı Parametrləri</h2>
            </div>
            {CONN_FIELDS.map(({ key, label, placeholder, description, type }) => (
              <div key={key} className="px-6 py-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input
                  type={type}
                  value={values[key] || ''}
                  onChange={e => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-army-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-army-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-mono"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{description}</p>
              </div>
            ))}
          </div>

          {/* JWT Claim Mappings */}
          <div className="mt-6 bg-white dark:bg-army-800 rounded-xl shadow-sm border border-gray-200 dark:border-army-700 divide-y divide-gray-100 dark:divide-army-700">
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-0.5">
                <Shield className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">JWT Tələb Xəritəsi</h2>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Sistemə id_token-dakı hansı JWT tələblərinin (claim) istifadəçi məlumatlarını daşıdığını bildirin.
                Adi LDAP dəyərləri placeholder kimi göstərilib.
              </p>
            </div>
            {CLAIM_FIELDS.map(({ key, label, placeholder, description }) => (
              <div key={key} className="px-6 py-4 flex items-center gap-4">
                <div className="w-36 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={values[key] || ''}
                    onChange={e => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-army-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-army-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all font-mono"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload Settings */}
          <div className="mt-6 bg-white dark:bg-army-800 rounded-xl shadow-sm border border-gray-200 dark:border-army-700 divide-y divide-gray-100 dark:divide-army-700">
            <div className="px-6 py-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Yükləmə Parametrləri</h2>
            </div>

            {/* Max parallel chunks per file */}
            <div className="px-6 py-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Eyni anda yüklənəcək hissə sayı (paralel chunk)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1" max="10" step="1"
                  value={values['upload.max-parallel'] || '2'}
                  onChange={e => handleChange('upload.max-parallel', e.target.value)}
                  className="flex-1 h-2 accent-primary-600 cursor-pointer"
                />
                <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {values['upload.max-parallel'] || '2'}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Hər bir yükləmə zamanı eyni vaxtda göndəriləcək fayl hissələrinin sayı (1 = ardıcıl, 10 = maksimum paralellik).
                Yüksək dəyərlər sürətli internet bağlantılarında yükləməni sürətləndirir, lakin daha çox bant genişliyi istifadə edir.
                Standart: 2.
              </p>
            </div>

            {/* Max concurrent uploads */}
            <div className="px-6 py-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Eyni anda aktiv yükləmə sayı (1-5)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1" max="5" step="1"
                  value={values['upload.max-concurrent'] || '2'}
                  onChange={e => handleChange('upload.max-concurrent', e.target.value)}
                  className="flex-1 h-2 accent-primary-600 cursor-pointer"
                />
                <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {values['upload.max-concurrent'] || '2'}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Eyni anda aktiv şəkildə işləyəcək yükləmələrin maksimum sayı. Bu limitdən artıq fayllar növbəyə alınır
                və əvvəlkilər tamamlandıqca avtomatik başlayır. Standart: 2.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-army-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-army-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Dəyişiklikləri Sıfırla
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-orange-600 hover:-translate-y-px active:translate-y-0 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
            >
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saxlanılır…</>
                : <><Save className="w-4 h-4" /> Parametrləri Saxla</>
              }
            </button>
          </div>

          {/* Info box */}
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium mb-1">IDP parametrlərini dəyişdikdən sonra</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
                  <li>Token mübadiləsi URL-i dərhal yenilənir (yenidən qurma tələb olunmur)</li>
                  <li>JWKS URI dəyişiklikləri JWT dekoderini yenidən yükləmək üçün <strong>konteynerin yenidən başladılmasını</strong> tələb edir</li>
                  <li>Saxlamadan əvvəl yeni Redirect URI-nin IDP-də ağ siyahıya əlavə edildiyinə əmin olun</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium transition-all z-50 ${
          toast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </>
  );
};

export default IdpSettings;

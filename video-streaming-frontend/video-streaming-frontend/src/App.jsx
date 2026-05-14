import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import { UploadProvider } from './context/UploadContext';
import { ThemeProvider } from './context/ThemeContext';
import MiniPlayer from './components/MiniPlayer';
import UploadManager from './components/UploadManager';
import PrivateRoute from './components/PrivateRoute';

// Eagerly-loaded (tiny, always needed)
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import LoggedOut from './pages/LoggedOut';

// Lazily-loaded pages — only fetched when the route is visited
const Home           = lazy(() => import('./pages/Home'));
const VideoDetail    = lazy(() => import('./pages/VideoDetail'));
const UploadPage     = lazy(() => import('./pages/UploadPage'));
const MyVideos       = lazy(() => import('./pages/MyVideos'));
const SearchResults  = lazy(() => import('./pages/SearchResults'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const UserForm       = lazy(() => import('./pages/admin/UserForm'));
const RoleManagement = lazy(() => import('./pages/admin/RoleManagement'));
const IdpSettings    = lazy(() => import('./pages/admin/IdpSettings'));
const Metrics        = lazy(() => import('./pages/admin/Metrics'));
const Embed          = lazy(() => import('./pages/Embed'));

// Minimal full-page spinner shown while a lazy chunk loads
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <svg className="w-8 h-8 text-primary-600 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 00-8 8z"/>
    </svg>
  </div>
);

// Root wrapper: if IDP redirected here with ?code=, handle OAuth2 callback;
// otherwise render the normal Home page.
function RootRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.has('code') || params.has('error')) {
    return <OAuthCallback />;
  }
  return <Home />;
}

function AppContent() {
  const { isAuthenticated } = useAuth();     // ← now works

  return (
    <UploadProvider>
    <MiniPlayerProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          {/* Root doubles as OAuth2 callback — IDP redirects to http://host:4000/?code=... */}
          <Route path="/" element={<RootRoute />} />
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            }
          />
          <Route path="/video/:id" element={<VideoDetail />} />
          {/* Embed route — public, minimal player for iframe embedding */}
          <Route path="/embed/:id" element={<Embed />} />
          <Route path="/search" element={<SearchResults />} />
          {/* Legacy /callback kept for safety; root is the real IDP redirect target */}
          <Route path="/callback" element={<OAuthCallback />} />
          <Route path="/logged_out" element={<LoggedOut />} />

          {/* Authenticated - any logged in user */}
          <Route 
            path="/change-password" 
            element={
              <PrivateRoute>
                <ChangePassword />
              </PrivateRoute>
            } 
          />

          {/* admin-modtube OR super-admin */}
          <Route 
            path="/upload" 
            element={
              <PrivateRoute requiredPermission="admin-modtube">
                <UploadPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/my-videos" 
            element={
              <PrivateRoute requiredPermission="admin-modtube">
                <MyVideos />
              </PrivateRoute>
            } 
          />

          {/* Super-admin only */}
          <Route 
            path="/admin/users" 
            element={
              <PrivateRoute requiredPermission="super-admin">
                <UserManagement />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/admin/users/new" 
            element={
              <PrivateRoute requiredPermission="super-admin">
                <UserForm />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/admin/users/:id/edit" 
            element={
              <PrivateRoute requiredPermission="super-admin">
                <UserForm />
              </PrivateRoute>
            } 
          />
          <Route
            path="/admin/roles"
            element={
              <PrivateRoute requiredPermission="super-admin">
                <RoleManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute requiredPermission={['super-admin', 'manage-settings']}>
                <IdpSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/metrics"
            element={
              <PrivateRoute requiredPermission={['super-admin', 'view-metrics']}>
                <Metrics />
              </PrivateRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>

        <MiniPlayer />
      </div>
      {/* UploadManager uses fixed positioning — rendered outside the page div
          so no ancestor transform/overflow can ever clip it */}
      <UploadManager />
    </MiniPlayerProvider>
    </UploadProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
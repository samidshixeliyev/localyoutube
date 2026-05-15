import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import { UploadProvider } from './context/UploadContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider, useSidebar } from './context/SidebarContext';
import MiniPlayer from './components/MiniPlayer';
import UploadManager from './components/UploadManager';
import Sidebar from './components/Sidebar';
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
const Shorts         = lazy(() => import('./pages/Shorts'));

const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const UserForm       = lazy(() => import('./pages/admin/UserForm'));
const RoleManagement = lazy(() => import('./pages/admin/RoleManagement'));
const IdpSettings    = lazy(() => import('./pages/admin/IdpSettings'));
const Metrics        = lazy(() => import('./pages/admin/Metrics'));
const Embed          = lazy(() => import('./pages/Embed'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-primary-50 dark:bg-army-900">
    <svg className="w-8 h-8 text-primary-600 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 00-8 8z"/>
    </svg>
  </div>
);

function RootRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.has('code') || params.has('error')) {
    return <OAuthCallback />;
  }
  return <Home />;
}

// Reads sidebar state and shifts the content area accordingly
// Hides sidebar for login, callback, embed, and logged_out routes
function SidebarAwareLayout({ children }) {
  const { isOpen } = useSidebar();
  const location = useLocation();

  const noSidebar = ['/login', '/callback', '/logged_out'].includes(location.pathname)
    || location.pathname.startsWith('/embed/');

  if (noSidebar) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <div
        className="min-h-screen bg-primary-50 dark:bg-army-900 transition-all duration-200"
        style={{ paddingLeft: isOpen ? '240px' : '64px' }}
      >
        {children}
      </div>
    </>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <SidebarProvider>
      <UploadProvider>
        <MiniPlayerProvider>
          <SidebarAwareLayout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<RootRoute />} />
                <Route
                  path="/login"
                  element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
                />
                <Route path="/video/:id" element={<VideoDetail />} />
                <Route path="/embed/:id" element={<Embed />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/shorts" element={<Shorts />} />
                <Route path="/callback" element={<OAuthCallback />} />
                <Route path="/logged_out" element={<LoggedOut />} />

                {/* Authenticated — any logged-in user */}
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
          </SidebarAwareLayout>
          <UploadManager />
        </MiniPlayerProvider>
      </UploadProvider>
    </SidebarProvider>
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

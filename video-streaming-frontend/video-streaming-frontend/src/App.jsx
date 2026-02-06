import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';      // ← added useAuth here
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import MiniPlayer from './components/MiniPlayer';
import PrivateRoute from './components/PrivateRoute'; // adjust path if needed

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import VideoDetail from './pages/VideoDetail';
import UploadPage from './pages/UploadPage';
import MyVideos from './pages/MyVideos';
import SearchResults from './pages/SearchResults';
import ChangePassword from './pages/ChangePassword';

// Admin Pages
import UserManagement from './pages/admin/UserManagement';
import UserForm from './pages/admin/UserForm';
import RoleManagement from './pages/admin/RoleManagement';

function AppContent() {
  const { isAuthenticated } = useAuth();     // ← now works

  return (
    <MiniPlayerProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            } 
          />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/search" element={<SearchResults />} />

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

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <MiniPlayer />
      </div>
    </MiniPlayerProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
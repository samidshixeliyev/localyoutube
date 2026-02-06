import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import Navbar from './components/Navbar';
import MiniPlayer from './components/MiniPlayer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import VideoDetail from './pages/VideoDetail';
import Upload from './pages/Upload';
import MyVideos from './pages/MyVideos';
import SearchResults from './pages/SearchResults';
import ChangePassword from './pages/ChangePassword';

// Admin Pages
import UserManagement from './pages/admin/UserManagement';
import UserForm from './pages/admin/UserForm';
import RoleManagement from './pages/admin/RoleManagement';

// Protected route component
function PrivateRoute({ children, requiredPermission }) {
    const { isAuthenticated, hasPermission } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function AppContent() {
    const { user, isAuthenticated, logout } = useAuth();

    return (
        <MiniPlayerProvider>
            <div className="min-h-screen bg-gray-50">
                <Navbar user={user} onLogout={logout} />

                <Routes>
                    {/* Public */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={
                        isAuthenticated ? <Navigate to="/" replace /> : <Login />
                    } />
                    <Route path="/video/:id" element={<VideoDetail />} />
                    <Route path="/search" element={<SearchResults />} />

                    {/* Authenticated */}
                    <Route path="/change-password" element={
                        <PrivateRoute><ChangePassword /></PrivateRoute>
                    } />

                    {/* Admin (admin-modtube) */}
                    <Route path="/upload" element={
                        <PrivateRoute requiredPermission="admin-modtube"><Upload /></PrivateRoute>
                    } />
                    <Route path="/my-videos" element={
                        <PrivateRoute requiredPermission="admin-modtube"><MyVideos /></PrivateRoute>
                    } />

                    {/* Super Admin Only */}
                    <Route path="/admin/users" element={
                        <PrivateRoute requiredPermission="super-admin"><UserManagement /></PrivateRoute>
                    } />
                    <Route path="/admin/users/new" element={
                        <PrivateRoute requiredPermission="super-admin"><UserForm /></PrivateRoute>
                    } />
                    <Route path="/admin/users/:id/edit" element={
                        <PrivateRoute requiredPermission="super-admin"><UserForm /></PrivateRoute>
                    } />
                    <Route path="/admin/roles" element={
                        <PrivateRoute requiredPermission="super-admin"><RoleManagement /></PrivateRoute>
                    } />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                {/* Global Mini Player */}
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
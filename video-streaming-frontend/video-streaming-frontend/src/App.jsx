import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import VideoDetail from './pages/VideoDetail';
import Upload from './pages/Upload';
import Search from './pages/Search';
import MyVideos from './pages/MyVideos';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes - No login required */}
          <Route path="/login" element={<Login />} />
          
          {/* Public video routes - Anyone can view */}
          <Route
            path="/"
            element={
              <PrivateRoute requireAuth={false}>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/video/:id"
            element={
              <PrivateRoute requireAuth={false}>
                <VideoDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/search"
            element={
              <PrivateRoute requireAuth={false}>
                <Search />
              </PrivateRoute>
            }
          />

          {/* Protected routes - Require login */}
          <Route
            path="/upload"
            element={
              <PrivateRoute requireAuth={true}>
                <Upload />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-videos"
            element={
              <PrivateRoute requireAuth={true}>
                <MyVideos />
              </PrivateRoute>
            }
          />

          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Meetings from './pages/Meetings';
import Chat from './pages/Chat';
import TeamManagement from './pages/TeamManagement';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { profile, loading, isAdmin } = useAuth();
  
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="chat" element={<Chat />} />
            <Route path="team" element={
              <AdminRoute>
                <TeamManagement />
              </AdminRoute>
            } />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<Profile />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

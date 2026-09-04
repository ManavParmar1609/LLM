import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import WorkerLayout from './pages/worker/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import Loading from './pages/worker/Loading';
import Unloading from './pages/worker/Unloading';
import TrailerInspection from './pages/worker/TrailerInspection';
import IssueResolution from './pages/worker/IssueResolution';
import Chat from './pages/worker/Chat';
import MyIssues from './pages/worker/MyIssues';
import SupervisorLayout from './pages/supervisor/SupervisorLayout';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import IssueDetail from './pages/supervisor/IssueDetail';
import IssueLogs from './pages/supervisor/IssueLogs';
import Analytics from './pages/supervisor/Analytics';
import ShiftHandoff from './pages/supervisor/ShiftHandoff';

function ProtectedRoutes() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;

  if (user.role === 'operator') {
    return (
      <WorkerLayout>
        <Routes>
          <Route index element={<WorkerDashboard />} />
          <Route path="inspection" element={<TrailerInspection />} />
          <Route path="loading" element={<Loading />} />
          <Route path="unloading" element={<Unloading />} />
          <Route path="resolve/:issueId" element={<IssueResolution />} />
          <Route path="chat" element={<Chat />} />
          <Route path="my-issues" element={<MyIssues />} />
        </Routes>
      </WorkerLayout>
    );
  }

  return (
    <SupervisorLayout>
      <Routes>
        <Route index element={<SupervisorDashboard />} />
        <Route path="issue/:issueId" element={<IssueDetail />} />
        <Route path="logs" element={<IssueLogs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="chat" element={<Chat />} />
        <Route path="handoff" element={<ShiftHandoff />} />
      </Routes>
    </SupervisorLayout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginWrapper />} />
      <Route path="/app/*" element={<ProtectedRoutes />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function LoginWrapper() {
  const { logout } = useAuth();
  // Always clear session when visiting login so user can switch
  React.useEffect(() => { logout(); }, []);
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

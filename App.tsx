import React, { useRef } from 'react';
import { App as AntdApp } from 'antd';

import { Provider } from 'react-redux';
import '@/styles/main.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GuestProvider } from './contexts/GuestContext';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { store } from './stores/store';
import { ROUTES } from './constants/routes';
import Header from './components/layout/Header';
import LandingPage from './pages/LandingPage';
import AdminSettingPage from './pages/AdminSettingPage';
import UserProfilePage from './pages/UserProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import LoginRequiredModal from './components/modal/LoginRequiredModal';
import { GuestOnboardingTourRef } from './components/GuestOnboardingTour';
import ErrorBoundary from './components/ErrorBoundary';
import { AntdStaticHelper } from './utils/antd';


// Main Layout Component - allows both authenticated and guest users
const MainLayout: React.FC = () => {
  const { isLoading } = useAuth();
  const tourRef = useRef<GuestOnboardingTourRef>(null);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Allow both authenticated and guest users to access the main app
  return (
    <ErrorBoundary level="page">
      <div className="h-screen flex flex-col overflow-hidden">

        <Header />
        <div className="flex-1 overflow-hidden">

          <div className="app-viewport">
            <Routes>
              <Route path={ROUTES.HOME} element={<LandingPage tourRef={tourRef} />} />
              <Route path={ROUTES.PROJECT} element={<LandingPage tourRef={tourRef} />} />
              <Route path={ROUTES.SPACE} element={<LandingPage tourRef={tourRef} />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </div>
        {/* Global Login Required Modal */}
        <LoginRequiredModal />
      </div>
    </ErrorBoundary>
  );
};

// Protected Route Wrapper Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
};

// Shared Layout for Protected Pages (Admin & Profile)
const ProtectedPageLayout: React.FC = () => {
  return (
    <ProtectedRoute>
      <ErrorBoundary level="page">
        <div className="h-screen flex flex-col overflow-hidden">
          <Header />
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  );
};

// App Content (inside AuthProvider and GuestProvider)
const AppContent: React.FC = () => {
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
        <Routes>
          {/* Group protected routes under the shared layout */}
          <Route element={<ProtectedPageLayout />}>
            <Route path={ROUTES.ADMIN_SETTING} element={<AdminSettingPage />} />
            <Route path={ROUTES.USER_PROFILE} element={<UserProfilePage />} />
          </Route>
          
          <Route path="/*" element={<MainLayout />} />
        </Routes>
        <SpeedInsights />
      </Router>
    </GoogleOAuthProvider>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary level="app">
      <AntdApp>
        <AntdStaticHelper />
        <Provider store={store}>
          <AuthProvider>
            <GuestProvider>
              <AppContent />
            </GuestProvider>
          </AuthProvider>
        </Provider>
      </AntdApp>
    </ErrorBoundary>

  );
};

export default App;

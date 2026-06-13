/**
 * app/router/index.jsx — All routes in one place
 *
 * ROUTE PROTECTION PATTERN:
 * <ProtectedRoute> wraps routes that need login
 * <PublicRoute>    wraps routes that redirect if already logged in
 *
 * LAZY LOADING:
 * React.lazy() loads page components only when the route is visited.
 * App bundle stays small — users only download code for pages they visit.
 */

import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectIsAuthenticated, selectIsLoading } from "../store/authSlice";

// Lazy load all pages — code splitting
const LoginPage         = lazy(() => import("../../modules/auth/LoginPage"));
const RegisterPage      = lazy(() => import("../../modules/auth/RegisterPage"));
const DashboardPage     = lazy(() => import("../../modules/dashboard/DashboardPage"));
const AnalysisPage      = lazy(() => import("../../modules/conversation-analysis/AnalysisPage"));
const AnalysisResult    = lazy(() => import("../../modules/conversation-analysis/AnalysisResult"));
const ThreatPage        = lazy(() => import("../../modules/threat-intelligence/ThreatPage"));

// Loading spinner shown while lazy components load
const PageLoader = () => (
  <div className="min-h-screen bg-surface-900 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading       = useSelector(selectIsLoading);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// Redirects to /dashboard if already logged in (for login/register pages)
function PublicRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/analyze"   element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
        <Route path="/analysis/:id" element={<ProtectedRoute><AnalysisResult /></ProtectedRoute>} />
        <Route path="/threats"   element={<ProtectedRoute><ThreatPage /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
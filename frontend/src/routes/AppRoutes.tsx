// src/routes/AppRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/auth/ProtectedRoute";

import Dashboard from "../pages/Dashboard/Dashboard";
import Chat from "../pages/Chat/chat";
import Analytics from "../pages/Analytics/Analytics";
import Planner from "../pages/Planner/Planner";
import Settings from "../pages/Settings/Settings";
import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import ResetPassword from "../pages/Auth/ResetPassword";
import Landing from "../pages/Landing/Landing";
import TermsOfService from "../pages/Legal/TermsOfService";
import PrivacyPolicy from "../pages/Legal/PrivacyPolicy";
import RefundPolicy from "../pages/Legal/RefundPolicy";
import CookiesPolicy from "../pages/Legal/CookiesPolicy";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/refund" element={<RefundPolicy />} />
      <Route path="/cookies" element={<CookiesPolicy />} />

      {/* Protected routes wrapped in Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Error / Catch-all - STOP REDIRECTING TO DASHBOARD TO BREAK LOOP */}
      <Route path="*" element={
        <div style={{ padding: '2rem', color: 'white', background: '#020617', minHeight: '100vh' }}>
          <h2>404 - Page Not Found</h2>
          <p>Current path: {window.location.pathname}</p>
          <a href="/" style={{ color: '#3b82f6' }}>Go back to Landing Page</a>
        </div>
      } />
    </Routes>
  );
}

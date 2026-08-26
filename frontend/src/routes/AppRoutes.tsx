// src/routes/AppRoutes.tsx
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import Landing from "../pages/Landing/Landing";

const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Chat = lazy(() => import("../pages/Chat/chat"));
const Analytics = lazy(() => import("../pages/Analytics/Analytics"));
const Planner = lazy(() => import("../pages/Planner/Planner"));
const Settings = lazy(() => import("../pages/Settings/Settings"));
const Login = lazy(() => import("../pages/Auth/Login"));
const Register = lazy(() => import("../pages/Auth/Register"));
const GetAccess = lazy(() => import("../pages/Auth/GetAccess"));
const ForgotPassword = lazy(() => import("../pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/Auth/ResetPassword"));
const FeaturePage = lazy(() => import("../pages/Marketing/FeaturePage"));
const ComparisonPage = lazy(() => import("../pages/Marketing/ComparisonPage"));
const AITools = lazy(() => import("../pages/Tools/AITools"));
const TermsOfService = lazy(() => import("../pages/Legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("../pages/Legal/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("../pages/Legal/RefundPolicy"));
const CookiesPolicy = lazy(() => import("../pages/Legal/CookiesPolicy"));

import { FullScreenLoader } from '../components/common/loader/Loader';
import NotFound from '../components/common/NotFound';

function RouteLoader() {
  return <FullScreenLoader size={88} />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/get-access" element={<GetAccess />} />
        <Route path="/chat-leno" element={<FeaturePage featureKey="chat-leno" />} />
        <Route path="/plan-task" element={<FeaturePage featureKey="plan-task" />} />
        <Route path="/ai-planner" element={<FeaturePage featureKey="ai-planner" />} />
        <Route path="/ai-calendar-planner" element={<FeaturePage featureKey="ai-calendar-planner" />} />
        <Route path="/workflow-automation-agency-owners" element={<FeaturePage featureKey="workflow-automation-agency-owners" />} />
        <Route path="/agency-workflow-automation" element={<FeaturePage featureKey="workflow-automation-agency-owners" />} />
        <Route path="/vs/motion" element={<ComparisonPage competitorKey="motion" />} />
        <Route path="/vs/sunsama" element={<ComparisonPage competitorKey="sunsama" />} />
        <Route path="/vs/:competitor" element={<ComparisonPage />} />
        <Route path="/ai-task-manager" element={<FeaturePage featureKey="ai-task-manager" />} />
        <Route path="/ai-task" element={<FeaturePage featureKey="ai-task" />} />
        <Route path="/ai-productivity" element={<FeaturePage featureKey="ai-productivity" />} />
        <Route path="/ai-daily-productivity" element={<FeaturePage featureKey="ai-daily-productivity" />} />
        <Route path="/tools" element={<AITools initialTool="task-prioritizer" />} />
        <Route path="/free-ai-tools" element={<AITools initialTool="task-prioritizer" />} />
        <Route path="/tools/ai-task-prioritizer" element={<AITools initialTool="task-prioritizer" />} />
        <Route path="/tools/ai-weekly-planner" element={<AITools initialTool="weekly-planner" />} />
        <Route path="/show-analytics" element={<FeaturePage featureKey="show-analytics" />} />
        <Route path="/dashboard-preview" element={<FeaturePage featureKey="dashboard-preview" />} />
        <Route path="/goal-progress" element={<FeaturePage featureKey="goal-progress" />} />
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
          <Route path="/settings/:tab" element={<Settings />} />
        </Route>

        {/* Error / Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

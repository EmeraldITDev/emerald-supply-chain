import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PageLoader } from "@/components/ui/PageLoader";
import { AppUpdateBanner } from "@/components/AppUpdateBanner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getScmRole } from "@/utils/scmRole";
import { canAccessProcurementPage } from "@/utils/procurementAccess";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import {
  Dashboard,
  DepartmentDashboard,
  ExecutiveDashboard,
  ChairmanDashboard,
  SupplyChainDashboard,
  Procurement,
  NewMRF,
  NewMRN,
  MRNDetail,
  NewAnnualPlan,
  NewSRF,
  Logistics,
  Inventory,
  Warehouse,
  Vendors,
  VendorRegistrationReview,
  Reports,
  ProcurementReports,
  TripRequest,
  AllTrips,
  Settings,
  UserManagement,
  AccountsPayable,
  AccountsReceivable,
  BudgetControl,
  Projects,
  VendorPortal,
  VendorRegistrationSuccess,
  MRFDetailPage,
  PODetailPage,
  RFQDetailPage,
  TripDetailPage,
  TripRequestDetailPage,
  FleetDetailPage,
  DriverDetailPage,
  VendorDetailPage,
  MaintenanceDetailPage,
} from "@/routes/lazyPages";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const ProcurementRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  const scmRole = getScmRole(user);
  if (!canAccessProcurementPage(scmRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/department" element={<ProtectedRoute><DepartmentDashboard /></ProtectedRoute>} />
          <Route path="/department/mrn/new" element={<ProtectedRoute><NewMRN /></ProtectedRoute>} />
          <Route path="/department/mrn/:id" element={<ProtectedRoute><MRNDetail /></ProtectedRoute>} />
          <Route path="/department/annual-plan/new" element={<ProtectedRoute><NewAnnualPlan /></ProtectedRoute>} />
          <Route path="/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
          <Route path="/chairman" element={<ProtectedRoute><ChairmanDashboard /></ProtectedRoute>} />
          <Route path="/supply-chain" element={<ProtectedRoute><SupplyChainDashboard /></ProtectedRoute>} />
          <Route path="/procurement" element={<ProcurementRoute><Procurement /></ProcurementRoute>} />
          <Route path="/new-mrf" element={<ProtectedRoute><NewMRF /></ProtectedRoute>} />
          <Route path="/new-srf" element={<ProtectedRoute><NewSRF /></ProtectedRoute>} />
          <Route path="/trip-request" element={<ProtectedRoute><TripRequest /></ProtectedRoute>} />
          <Route path="/trips" element={<ProtectedRoute><AllTrips /></ProtectedRoute>} />
          <Route path="/procurement/mrf/new" element={<ProtectedRoute><NewMRF /></ProtectedRoute>} />
          <Route path="/procurement/srf/new" element={<ProtectedRoute><NewSRF /></ProtectedRoute>} />
          <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><Warehouse /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
          <Route path="/vendors/registration/:id" element={<ProtectedRoute><VendorRegistrationReview /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/reports/procurement" element={<ProtectedRoute><ProcurementReports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/accounts-payable" element={<ProtectedRoute><AccountsPayable /></ProtectedRoute>} />
          <Route path="/accounts-receivable" element={<ProtectedRoute><AccountsReceivable /></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><BudgetControl /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/vendor-portal" element={<VendorPortal />} />
          <Route path="/vendor-registration-success" element={<VendorRegistrationSuccess />} />
          <Route path="/mrfs/:id" element={<ProtectedRoute><MRFDetailPage /></ProtectedRoute>} />
          <Route path="/pos/:id" element={<ProtectedRoute><PODetailPage /></ProtectedRoute>} />
          <Route path="/rfqs/:id" element={<ProtectedRoute><RFQDetailPage /></ProtectedRoute>} />
          <Route path="/trip-requests/:id" element={<ProtectedRoute><TripRequestDetailPage /></ProtectedRoute>} />
          <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
          <Route path="/fleet/:id" element={<ProtectedRoute><FleetDetailPage /></ProtectedRoute>} />
          <Route path="/drivers/:id" element={<ProtectedRoute><DriverDetailPage /></ProtectedRoute>} />
          <Route path="/vendors/:id" element={<ProtectedRoute><VendorDetailPage /></ProtectedRoute>} />
          <Route path="/maintenance/:id" element={<ProtectedRoute><MaintenanceDetailPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AppUpdateBanner />
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <NotificationProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </TooltipProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

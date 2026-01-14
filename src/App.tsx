import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DepartmentDashboard from "./pages/DepartmentDashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import ChairmanDashboard from "./pages/ChairmanDashboard";
import SupplyChainDashboard from "./pages/SupplyChainDashboard";
import Procurement from "./pages/Procurement";
import NewMRF from "./pages/NewMRF";
import NewMRN from "./pages/NewMRN";
import MRNDetail from "./pages/MRNDetail";
import NewAnnualPlan from "./pages/NewAnnualPlan";
import NewSRF from "./pages/NewSRF";
import Logistics from "./pages/Logistics";
import Inventory from "./pages/Inventory";
import Warehouse from "./pages/Warehouse";
import Vendors from "./pages/Vendors";
import VendorRegistrationReview from "./pages/VendorRegistrationReview";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import AccountsPayable from "./pages/AccountsPayable";
import AccountsReceivable from "./pages/AccountsReceivable";
import BudgetControl from "./pages/BudgetControl";
import Projects from "./pages/Projects";
import VendorPortal from "./pages/VendorPortal";
import VendorRegistrationSuccess from "./pages/VendorRegistrationSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Roles that can access procurement pages (full system visibility)
const PROCUREMENT_ACCESS_ROLES = ["procurement", "procurement_manager", "executive", "chairman", "supply_chain_director", "supply_chain"];

const ProcurementRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user?.role || !PROCUREMENT_ACCESS_ROLES.includes(user.role)) {
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
        {/* Only employees can create MRF/SRF */}
        <Route path="/new-mrf" element={<ProtectedRoute><NewMRF /></ProtectedRoute>} />
        <Route path="/new-srf" element={<ProtectedRoute><NewSRF /></ProtectedRoute>} />
        <Route path="/procurement/mrf/new" element={<ProtectedRoute><NewMRF /></ProtectedRoute>} />
        <Route path="/procurement/srf/new" element={<ProtectedRoute><NewSRF /></ProtectedRoute>} />
        <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/warehouse" element={<ProtectedRoute><Warehouse /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
        <Route path="/vendors/registration/:id" element={<ProtectedRoute><VendorRegistrationReview /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/accounts-payable" element={<ProtectedRoute><AccountsPayable /></ProtectedRoute>} />
        <Route path="/accounts-receivable" element={<ProtectedRoute><AccountsReceivable /></ProtectedRoute>} />
        <Route path="/budget" element={<ProtectedRoute><BudgetControl /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/vendor-portal" element={<VendorPortal />} />
        <Route path="/vendor-registration-success" element={<VendorRegistrationSuccess />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
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

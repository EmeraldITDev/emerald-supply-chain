import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Procurement from "./pages/Procurement";
import NewMRF from "./pages/NewMRF";
import NewSRF from "./pages/NewSRF";
import Logistics from "./pages/Logistics";
import Inventory from "./pages/Inventory";
import Warehouse from "./pages/Warehouse";
import Vendors from "./pages/Vendors";
import Reports from "./pages/Reports";
import VendorPortal from "./pages/VendorPortal";
import PlaceholderModule from "./pages/PlaceholderModule";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/procurement" element={<ProtectedRoute><Procurement /></ProtectedRoute>} />
          <Route path="/procurement/mrf/new" element={<ProtectedRoute><NewMRF /></ProtectedRoute>} />
          <Route path="/procurement/srf/new" element={<ProtectedRoute><NewSRF /></ProtectedRoute>} />
          <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><Warehouse /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><PlaceholderModule title="Settings" description="Configure system settings and preferences" /></ProtectedRoute>} />
          <Route path="/vendor-portal" element={<VendorPortal />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

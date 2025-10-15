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
          <Route path="/logistics" element={<ProtectedRoute><PlaceholderModule title="Logistics" description="Manage personnel trips and material movements" /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><PlaceholderModule title="Inventory" description="Track stock levels and material issuance" /></ProtectedRoute>} />
          <Route path="/warehouse" element={<ProtectedRoute><PlaceholderModule title="Warehouse" description="Manage storage operations and EHS compliance" /></ProtectedRoute>} />
          <Route path="/vendors" element={<ProtectedRoute><PlaceholderModule title="Vendors" description="Manage vendor information and KYC" /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><PlaceholderModule title="Reports" description="Generate analytics and performance reports" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><PlaceholderModule title="Settings" description="Configure system settings and preferences" /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

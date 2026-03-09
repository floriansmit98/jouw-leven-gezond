import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import Index from "./pages/Index";
import Premium from "./pages/Premium";
import FoodTracker from "./pages/FoodTracker";
import FluidTracker from "./pages/FluidTracker";
import SymptomTracker from "./pages/SymptomTracker";
import DialysisLog from "./pages/DialysisLog";
import Coach from "./pages/Coach";
import Recipes from "./pages/Recipes";
import MealScanner from "./pages/MealScanner";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
          <Route path="/voeding" element={<FoodTracker />} />
          <Route path="/vocht" element={<Navigate to="/voeding" replace />} />
        <Route path="/symptomen" element={<SymptomTracker />} />
        <Route path="/dialyse" element={<DialysisLog />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/recepten" element={<Recipes />} />
        <Route path="/scanner" element={<Navigate to="/voeding" replace />} />
        <Route path="/rapport" element={<Report />} />
        <Route path="/instellingen" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

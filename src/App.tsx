import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import FoodTracker from "./pages/FoodTracker";
import SymptomTracker from "./pages/SymptomTracker";
import DialysisLog from "./pages/DialysisLog";
import Coach from "./pages/Coach";
import Recipes from "./pages/Recipes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/voeding" element={<FoodTracker />} />
          <Route path="/symptomen" element={<SymptomTracker />} />
          <Route path="/dialyse" element={<DialysisLog />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/recepten" element={<Recipes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

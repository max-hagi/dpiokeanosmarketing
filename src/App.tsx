import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CreateContent from "./pages/CreateContent";
import ReviewContent from "./pages/ReviewContent";
import ContentHistory from "./pages/ContentHistory";
import LeadCapture from "./pages/LeadCapture";
import LeadList from "./pages/LeadList";
import LeadDetail from "./pages/LeadDetail";
import LeadPipeline from "./pages/LeadPipeline";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateContent />} />
            <Route path="/review/:id" element={<ReviewContent />} />
            <Route path="/history" element={<ContentHistory />} />
            <Route path="/leads" element={<LeadList />} />
            <Route path="/leads/pipeline" element={<LeadPipeline />} />
            <Route path="/leads/capture" element={<LeadCapture />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

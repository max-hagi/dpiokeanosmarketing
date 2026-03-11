import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Overview from "./pages/Overview";
import Pipeline from "./pages/Pipeline";
import CrmPage from "./pages/CrmPage";
import Marketing from "./pages/Marketing";
import SettingsPage from "./pages/SettingsPage";
import LeadCapture from "./pages/LeadCapture";
import ReviewContent from "./pages/ReviewContent";
import NotFound from "./pages/NotFound";

function LegacyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/pipeline/lead/${id}`} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/pipeline/lead/:id" element={<Pipeline />} />
            <Route path="/chat" element={<LeadCapture />} />
            <Route path="/crm" element={<CrmPage />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/review/:id" element={<ReviewContent />} />
            {/* Legacy redirects */}
            <Route path="/leads" element={<Navigate to="/pipeline" replace />} />
            <Route path="/leads/pipeline" element={<Navigate to="/pipeline" replace />} />
            <Route path="/leads/capture" element={<Navigate to="/chat" replace />} />
            <Route path="/pipeline/capture" element={<Navigate to="/chat" replace />} />
            <Route path="/leads/:id" element={<LegacyRedirect />} />
            <Route path="/crm/:id" element={<LegacyRedirect />} />
            <Route path="/create" element={<Navigate to="/marketing" replace />} />
            <Route path="/history" element={<Navigate to="/marketing?tab=history" replace />} />
            <Route path="/follow-up" element={<Navigate to="/settings?tab=sequences" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

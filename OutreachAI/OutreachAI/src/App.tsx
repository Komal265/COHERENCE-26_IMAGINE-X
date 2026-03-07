import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import LeadsPage from "./pages/LeadsPage";
import WorkflowPage from "./pages/WorkflowPage";
import AutomationPage from "./pages/AutomationPage";
import ExecutionPage from "./pages/ExecutionPage";
import InboxPage from "./pages/InboxPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const FIVE_MIN_MS = 5 * 60 * 1000;

function AutoFollowUpPoller() {
  useEffect(() => {
    const run = async () => {
      try {
        await fetch(`${window.location.origin}/api/process-auto-follow-ups`, { method: "POST" });
      } catch {
        // ignore
      }
    };
    run();
    const t = setInterval(run, FIVE_MIN_MS);
    return () => clearInterval(t);
  }, []);
  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <AutoFollowUpPoller />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/workflow" element={<WorkflowPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
